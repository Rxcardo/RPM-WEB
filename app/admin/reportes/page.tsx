'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'

type ClienteRow = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  estado: string
  created_at: string
}

type PlanRow = {
  id: string
  fecha_inicio: string | null
  fecha_fin: string | null
  sesiones_totales: number
  sesiones_usadas: number
  estado: string
  created_at: string
  clientes: { nombre: string } | null
  planes: { nombre: string; precio: number } | null
}

type CitaRow = {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: string
  clientes: { nombre: string } | null
  empleados: { nombre: string } | null
  servicios: { nombre: string; precio?: number } | null
}

type IngresoRow = {
  id: string
  fecha: string
  concepto: string
  categoria: string
  monto: number
  estado: string
  tipo_origen: string
  created_at: string
  clientes: { nombre: string } | null
  metodos_pago: { nombre: string } | null
}

type EgresoRow = {
  id: string
  fecha: string
  concepto: string
  categoria: string
  proveedor: string | null
  monto: number
  estado: string
  created_at: string
  metodos_pago: { nombre: string } | null
}

const TIPOS = [
  { value: 'clientes', label: 'Clientes' },
  { value: 'planes', label: 'Planes' },
  { value: 'citas', label: 'Citas' },
  { value: 'ingresos', label: 'Ingresos' },
  { value: 'egresos', label: 'Egresos' },
  { value: 'financiero', label: 'Financiero' },
]

const PIE_COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#94a3b8']
const BAR_INGRESOS = '#34d399'
const BAR_EGRESOS = '#f87171'
const BAR_CATEGORIA = '#60a5fa'

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function firstDayOfMonthISO() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function downloadCSV(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return

  const headers = Object.keys(rows[0])

  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((field) => {
          const value = row[field] ?? ''
          const escaped = String(value).replace(/"/g, '""')
          return `"${escaped}"`
        })
        .join(',')
    ),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function shortDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
  } catch {
    return value
  }
}

export default function ReportesPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [tipo, setTipo] = useState('financiero')
  const [fechaInicio, setFechaInicio] = useState(firstDayOfMonthISO())
  const [fechaFin, setFechaFin] = useState(todayISO())
  const [search, setSearch] = useState('')

  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [planes, setPlanes] = useState<PlanRow[]>([])
  const [citas, setCitas] = useState<CitaRow[]>([])
  const [ingresos, setIngresos] = useState<IngresoRow[]>([])
  const [egresos, setEgresos] = useState<EgresoRow[]>([])

  useEffect(() => {
    void loadReporte('financiero')
  }, [])

  function limpiarDatos() {
    setClientes([])
    setPlanes([])
    setCitas([])
    setIngresos([])
    setEgresos([])
  }

  async function loadReporte(tipoActual = tipo) {
    try {
      setLoading(true)
      setError('')
      limpiarDatos()

      if (tipoActual === 'clientes') {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nombre, telefono, email, estado, created_at')
          .order('created_at', { ascending: false })

        if (error) throw error
        setClientes((data || []) as ClienteRow[])
      }

      if (tipoActual === 'planes') {
        const { data, error } = await supabase
          .from('clientes_planes')
          .select(`
            id,
            fecha_inicio,
            fecha_fin,
            sesiones_totales,
            sesiones_usadas,
            estado,
            created_at,
            clientes:cliente_id ( nombre ),
            planes:plan_id ( nombre, precio )
          `)
          .order('created_at', { ascending: false })

        if (error) throw error
        setPlanes((data || []) as unknown as PlanRow[])
      }

      if (tipoActual === 'citas') {
        let query = supabase
          .from('citas')
          .select(`
            id,
            fecha,
            hora_inicio,
            hora_fin,
            estado,
            clientes:cliente_id ( nombre ),
            empleados:terapeuta_id ( nombre ),
            servicios:servicio_id ( nombre, precio )
          `)
          .order('fecha', { ascending: false })
          .order('hora_inicio', { ascending: false })

        if (fechaInicio) query = query.gte('fecha', fechaInicio)
        if (fechaFin) query = query.lte('fecha', fechaFin)

        const { data, error } = await query
        if (error) throw error
        setCitas((data || []) as unknown as CitaRow[])
      }

      if (tipoActual === 'ingresos' || tipoActual === 'financiero') {
        let query = supabase
          .from('pagos')
          .select(`
            id,
            fecha,
            concepto,
            categoria,
            monto,
            estado,
            tipo_origen,
            created_at,
            clientes:cliente_id ( nombre ),
            metodos_pago:metodo_pago_id ( nombre )
          `)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false })

        if (fechaInicio) query = query.gte('fecha', fechaInicio)
        if (fechaFin) query = query.lte('fecha', fechaFin)

        const { data, error } = await query
        if (error) throw error
        setIngresos((data || []) as unknown as IngresoRow[])
      }

      if (tipoActual === 'egresos' || tipoActual === 'financiero') {
        let query = supabase
          .from('egresos')
          .select(`
            id,
            fecha,
            concepto,
            categoria,
            proveedor,
            monto,
            estado,
            created_at,
            metodos_pago:metodo_pago_id ( nombre )
          `)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false })

        if (fechaInicio) query = query.gte('fecha', fechaInicio)
        if (fechaFin) query = query.lte('fecha', fechaFin)

        const { data, error } = await query
        if (error) throw error
        setEgresos((data || []) as unknown as EgresoRow[])
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'No se pudo generar el reporte.')
      limpiarDatos()
    } finally {
      setLoading(false)
    }
  }

  const clientesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clientes

    return clientes.filter((row) => {
      return (
        row.nombre?.toLowerCase().includes(q) ||
        row.telefono?.toLowerCase().includes(q) ||
        row.email?.toLowerCase().includes(q) ||
        row.estado?.toLowerCase().includes(q)
      )
    })
  }, [clientes, search])

  const planesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return planes

    return planes.filter((row) => {
      return (
        row.clientes?.nombre?.toLowerCase().includes(q) ||
        row.planes?.nombre?.toLowerCase().includes(q) ||
        row.estado?.toLowerCase().includes(q)
      )
    })
  }, [planes, search])

  const citasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return citas

    return citas.filter((row) => {
      return (
        row.clientes?.nombre?.toLowerCase().includes(q) ||
        row.empleados?.nombre?.toLowerCase().includes(q) ||
        row.servicios?.nombre?.toLowerCase().includes(q) ||
        row.estado?.toLowerCase().includes(q)
      )
    })
  }, [citas, search])

  const ingresosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ingresos

    return ingresos.filter((row) => {
      return (
        row.concepto?.toLowerCase().includes(q) ||
        row.categoria?.toLowerCase().includes(q) ||
        row.tipo_origen?.toLowerCase().includes(q) ||
        row.clientes?.nombre?.toLowerCase().includes(q) ||
        row.metodos_pago?.nombre?.toLowerCase().includes(q) ||
        row.estado?.toLowerCase().includes(q)
      )
    })
  }, [ingresos, search])

  const egresosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return egresos

    return egresos.filter((row) => {
      return (
        row.concepto?.toLowerCase().includes(q) ||
        row.categoria?.toLowerCase().includes(q) ||
        row.proveedor?.toLowerCase().includes(q) ||
        row.metodos_pago?.nombre?.toLowerCase().includes(q) ||
        row.estado?.toLowerCase().includes(q)
      )
    })
  }, [egresos, search])

  const resumen = useMemo(() => {
    const ingresosPagados = ingresosFiltrados
      .filter((x) => x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const egresosPagados = egresosFiltrados
      .filter((x) => x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const citasCompletadas = citasFiltradas.filter(
      (x) => x.estado === 'completada' || x.estado === 'realizada'
    ).length

    const citasCanceladas = citasFiltradas.filter((x) => x.estado === 'cancelada').length

    const planesActivos = planesFiltrados.filter((x) => x.estado === 'activo').length
    const clientesActivos = clientesFiltrados.filter((x) => x.estado === 'activo').length

    return {
      totalClientes: clientesFiltrados.length,
      totalClientesActivos: clientesActivos,
      totalPlanes: planesFiltrados.length,
      totalPlanesActivos: planesActivos,
      totalCitas: citasFiltradas.length,
      totalCitasCompletadas: citasCompletadas,
      totalCitasCanceladas: citasCanceladas,
      totalIngresos: ingresosPagados,
      totalEgresos: egresosPagados,
      balance: ingresosPagados - egresosPagados,
    }
  }, [
    clientesFiltrados,
    planesFiltrados,
    citasFiltradas,
    ingresosFiltrados,
    egresosFiltrados,
  ])

  const citasEstadoChart = useMemo(() => {
    const map = new Map<string, number>()

    for (const row of citasFiltradas) {
      const key = row.estado || 'sin estado'
      map.set(key, (map.get(key) || 0) + 1)
    }

    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [citasFiltradas])

  const financieroDiaChart = useMemo(() => {
    const map = new Map<string, { fecha: string; ingresos: number; egresos: number }>()

    for (const row of ingresosFiltrados.filter((x) => x.estado === 'pagado')) {
      const prev = map.get(row.fecha) || { fecha: row.fecha, ingresos: 0, egresos: 0 }
      prev.ingresos += Number(row.monto || 0)
      map.set(row.fecha, prev)
    }

    for (const row of egresosFiltrados.filter((x) => x.estado === 'pagado')) {
      const prev = map.get(row.fecha) || { fecha: row.fecha, ingresos: 0, egresos: 0 }
      prev.egresos += Number(row.monto || 0)
      map.set(row.fecha, prev)
    }

    return Array.from(map.values())
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((row) => ({
        ...row,
        label: shortDate(row.fecha),
      }))
  }, [ingresosFiltrados, egresosFiltrados])

  const categoriaChart = useMemo(() => {
    const map = new Map<string, number>()

    if (tipo === 'ingresos') {
      for (const row of ingresosFiltrados.filter((x) => x.estado === 'pagado')) {
        const key = row.categoria || 'general'
        map.set(key, (map.get(key) || 0) + Number(row.monto || 0))
      }
    } else if (tipo === 'egresos') {
      for (const row of egresosFiltrados.filter((x) => x.estado === 'pagado')) {
        const key = row.categoria || 'operativo'
        map.set(key, (map.get(key) || 0) + Number(row.monto || 0))
      }
    } else {
      for (const row of ingresosFiltrados.filter((x) => x.estado === 'pagado')) {
        const key = row.categoria || 'general'
        map.set(key, (map.get(key) || 0) + Number(row.monto || 0))
      }
      for (const row of egresosFiltrados.filter((x) => x.estado === 'pagado')) {
        const key = row.categoria || 'operativo'
        map.set(key, (map.get(key) || 0) + Number(row.monto || 0))
      }
    }

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [tipo, ingresosFiltrados, egresosFiltrados])

  function handleExport() {
    if (tipo === 'clientes') {
      downloadCSV(
        'reporte_clientes.csv',
        clientesFiltrados.map((row) => ({
          nombre: row.nombre,
          telefono: row.telefono || '',
          email: row.email || '',
          estado: row.estado,
          creado: row.created_at,
        }))
      )
      return
    }

    if (tipo === 'planes') {
      downloadCSV(
        'reporte_planes.csv',
        planesFiltrados.map((row) => ({
          cliente: row.clientes?.nombre || '',
          plan: row.planes?.nombre || '',
          precio: Number(row.planes?.precio || 0),
          fecha_inicio: row.fecha_inicio || '',
          fecha_fin: row.fecha_fin || '',
          sesiones_totales: row.sesiones_totales,
          sesiones_usadas: row.sesiones_usadas,
          sesiones_restantes:
            Number(row.sesiones_totales || 0) - Number(row.sesiones_usadas || 0),
          estado: row.estado,
          creado: row.created_at,
        }))
      )
      return
    }

    if (tipo === 'citas') {
      downloadCSV(
        'reporte_citas.csv',
        citasFiltradas.map((row) => ({
          fecha: row.fecha,
          hora_inicio: row.hora_inicio,
          hora_fin: row.hora_fin,
          cliente: row.clientes?.nombre || '',
          personal: row.empleados?.nombre || '',
          servicio: row.servicios?.nombre || '',
          valor_servicio: Number(row.servicios?.precio || 0),
          estado: row.estado,
        }))
      )
      return
    }

    if (tipo === 'ingresos') {
      downloadCSV(
        'reporte_ingresos.csv',
        ingresosFiltrados.map((row) => ({
          fecha: row.fecha,
          concepto: row.concepto,
          categoria: row.categoria,
          tipo_origen: row.tipo_origen,
          cliente: row.clientes?.nombre || '',
          metodo_pago: row.metodos_pago?.nombre || '',
          estado: row.estado,
          monto: Number(row.monto || 0),
          creado: row.created_at,
        }))
      )
      return
    }

    if (tipo === 'egresos') {
      downloadCSV(
        'reporte_egresos.csv',
        egresosFiltrados.map((row) => ({
          fecha: row.fecha,
          concepto: row.concepto,
          categoria: row.categoria,
          proveedor: row.proveedor || '',
          metodo_pago: row.metodos_pago?.nombre || '',
          estado: row.estado,
          monto: Number(row.monto || 0),
          creado: row.created_at,
        }))
      )
      return
    }

    if (tipo === 'financiero') {
      const rows = [
        ...ingresosFiltrados.map((row) => ({
          fecha: row.fecha,
          created_at: row.created_at,
          tipo: 'ingreso',
          concepto: row.concepto,
          categoria: row.categoria,
          tercero: row.clientes?.nombre || '',
          metodo_pago: row.metodos_pago?.nombre || '',
          estado: row.estado,
          monto: Number(row.monto || 0),
        })),
        ...egresosFiltrados.map((row) => ({
          fecha: row.fecha,
          created_at: row.created_at,
          tipo: 'egreso',
          concepto: row.concepto,
          categoria: row.categoria,
          tercero: row.proveedor || '',
          metodo_pago: row.metodos_pago?.nombre || '',
          estado: row.estado,
          monto: Number(row.monto || 0),
        })),
      ].sort((a, b) => {
        const dateA = `${a.fecha} ${a.created_at || ''}`
        const dateB = `${b.fecha} ${b.created_at || ''}`
        return dateA < dateB ? 1 : -1
      })

      downloadCSV('reporte_financiero.csv', rows)
    }
  }

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <div>
        <p className="text-sm text-white/55">Administración</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Reportes</h1>
        <p className="mt-2 text-sm text-white/55">
          Reportes administrativos, operativos y financieros con exportación CSV.
        </p>
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      <Section
        title="Filtros del reporte"
        description="Selecciona el tipo, rango de fechas y búsqueda."
      >
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/75">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={inputClassName}
            >
              {TIPOS.map((item) => (
                <option key={item.value} value={item.value} className="bg-[#11131a] text-white">
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/75">Desde</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className={inputClassName}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/75">Hasta</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className={inputClassName}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/75">Buscar</label>
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => loadReporte()}
              disabled={loading}
              className="
                flex-1 rounded-2xl border border-white/10 bg-white/[0.08]
                px-4 py-3 text-sm font-semibold text-white transition
                hover:bg-white/[0.12] disabled:opacity-60
              "
            >
              {loading ? 'Cargando...' : 'Generar'}
            </button>

            <button
              onClick={handleExport}
              className="
                rounded-2xl border border-white/10 bg-white/[0.03]
                px-4 py-3 text-sm font-semibold text-white/80 transition
                hover:bg-white/[0.06]
              "
            >
              CSV
            </button>
          </div>
        </div>
      </Section>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Clientes"
          value={resumen.totalClientes}
          subtitle={`Activos: ${resumen.totalClientesActivos}`}
          color="text-sky-400"
        />

        <StatCard
          title="Planes"
          value={resumen.totalPlanes}
          subtitle={`Activos: ${resumen.totalPlanesActivos}`}
          color="text-violet-400"
        />

        <StatCard
          title="Citas"
          value={resumen.totalCitas}
          subtitle={`Completadas: ${resumen.totalCitasCompletadas} · Canceladas: ${resumen.totalCitasCanceladas}`}
          color="text-amber-300"
        />

        <StatCard
          title="Ingresos"
          value={money(resumen.totalIngresos)}
          color="text-emerald-400"
        />

        <StatCard
          title="Egresos"
          value={money(resumen.totalEgresos)}
          color="text-rose-400"
        />

        <StatCard
          title="Balance"
          value={money(resumen.balance)}
          color={resumen.balance >= 0 ? 'text-cyan-400' : 'text-rose-400'}
        />
      </div>

      {(tipo === 'citas' || tipo === 'ingresos' || tipo === 'egresos' || tipo === 'financiero') && (
        <div className="grid gap-6 xl:grid-cols-2">
          {tipo === 'citas' && (
            <Section
              title="Estados de citas"
              description="Distribución por estado."
            >
              <div className="h-80">
                {citasEstadoChart.length === 0 ? (
                  <Card className="flex h-full items-center justify-center p-4">
                    <p className="text-sm text-white/55">No hay datos para mostrar.</p>
                  </Card>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={citasEstadoChart}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                      >
                        {citasEstadoChart.map((entry, index) => (
                          <Cell
                            key={`${entry.name}-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#11131a',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 16,
                          color: '#fff',
                        }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Section>
          )}

          {tipo === 'financiero' && (
            <Section
              title="Ingresos vs egresos por día"
              description="Comparativo diario del período."
            >
              <div className="h-80">
                {financieroDiaChart.length === 0 ? (
                  <Card className="flex h-full items-center justify-center p-4">
                    <p className="text-sm text-white/55">No hay datos para mostrar.</p>
                  </Card>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financieroDiaChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="label" stroke="rgba(255,255,255,0.45)" />
                      <YAxis stroke="rgba(255,255,255,0.45)" />
                      <Tooltip
                        formatter={(value) => money(Number(value))}
                        contentStyle={{
                          background: '#11131a',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 16,
                          color: '#fff',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="ingresos" fill={BAR_INGRESOS} radius={[8, 8, 0, 0]} />
                      <Bar dataKey="egresos" fill={BAR_EGRESOS} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Section>
          )}

          {(tipo === 'ingresos' || tipo === 'egresos' || tipo === 'financiero') && (
            <Section
              title="Distribución por categoría"
              description="Top categorías del período."
            >
              <div className="h-80">
                {categoriaChart.length === 0 ? (
                  <Card className="flex h-full items-center justify-center p-4">
                    <p className="text-sm text-white/55">No hay datos para mostrar.</p>
                  </Card>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoriaChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="name" stroke="rgba(255,255,255,0.45)" />
                      <YAxis stroke="rgba(255,255,255,0.45)" />
                      <Tooltip
                        formatter={(value) => money(Number(value))}
                        contentStyle={{
                          background: '#11131a',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 16,
                          color: '#fff',
                        }}
                      />
                      <Bar dataKey="value" fill={BAR_CATEGORIA} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Section>
          )}
        </div>
      )}

      {tipo === 'clientes' && (
        <Section
          title="Reporte de clientes"
          description="Listado filtrado de clientes."
          className="p-0"
          contentClassName="overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium">Teléfono</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {clientesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-white/55">No hay clientes.</td>
                  </tr>
                ) : (
                  clientesFiltrados.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-white">{row.nombre}</td>
                      <td className="px-4 py-3 text-white/75">{row.telefono || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.email || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.estado}</td>
                      <td className="px-4 py-3 text-white/75">{row.created_at}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tipo === 'planes' && (
        <Section
          title="Reporte de planes"
          description="Listado filtrado de planes asignados."
          className="p-0"
          contentClassName="overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Plan</th>
                  <th className="px-4 py-3 text-left font-medium">Precio</th>
                  <th className="px-4 py-3 text-left font-medium">Inicio</th>
                  <th className="px-4 py-3 text-left font-medium">Fin</th>
                  <th className="px-4 py-3 text-left font-medium">Usadas</th>
                  <th className="px-4 py-3 text-left font-medium">Restantes</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {planesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-white/55">No hay planes.</td>
                  </tr>
                ) : (
                  planesFiltrados.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-white">{row.clientes?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.planes?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{money(Number(row.planes?.precio || 0))}</td>
                      <td className="px-4 py-3 text-white/75">{row.fecha_inicio || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.fecha_fin || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.sesiones_usadas}</td>
                      <td className="px-4 py-3 text-white/75">
                        {Number(row.sesiones_totales || 0) - Number(row.sesiones_usadas || 0)}
                      </td>
                      <td className="px-4 py-3 text-white/75">{row.estado}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tipo === 'citas' && (
        <Section
          title="Reporte de citas"
          description="Listado filtrado de citas."
          className="p-0"
          contentClassName="overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Hora</th>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Personal</th>
                  <th className="px-4 py-3 text-left font-medium">Servicio</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {citasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-white/55">No hay citas.</td>
                  </tr>
                ) : (
                  citasFiltradas.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white/75">{row.fecha}</td>
                      <td className="px-4 py-3 text-white/75">
                        {row.hora_inicio?.slice(0, 5)} - {row.hora_fin?.slice(0, 5)}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{row.clientes?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.empleados?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.servicios?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.estado}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tipo === 'ingresos' && (
        <Section
          title="Reporte de ingresos"
          description="Listado filtrado de ingresos."
          className="p-0"
          contentClassName="overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Concepto</th>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Categoría</th>
                  <th className="px-4 py-3 text-left font-medium">Método</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {ingresosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-white/55">No hay ingresos.</td>
                  </tr>
                ) : (
                  ingresosFiltrados.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white/75">{row.fecha}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{row.concepto}</p>
                        <p className="text-xs text-white/45">{row.tipo_origen}</p>
                      </td>
                      <td className="px-4 py-3 text-white/75">{row.clientes?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.categoria}</td>
                      <td className="px-4 py-3 text-white/75">{row.metodos_pago?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.estado}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-400">{money(row.monto)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tipo === 'egresos' && (
        <Section
          title="Reporte de egresos"
          description="Listado filtrado de egresos."
          className="p-0"
          contentClassName="overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Concepto</th>
                  <th className="px-4 py-3 text-left font-medium">Proveedor</th>
                  <th className="px-4 py-3 text-left font-medium">Categoría</th>
                  <th className="px-4 py-3 text-left font-medium">Método</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {egresosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-white/55">No hay egresos.</td>
                  </tr>
                ) : (
                  egresosFiltrados.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white/75">{row.fecha}</td>
                      <td className="px-4 py-3 font-medium text-white">{row.concepto}</td>
                      <td className="px-4 py-3 text-white/75">{row.proveedor || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.categoria}</td>
                      <td className="px-4 py-3 text-white/75">{row.metodos_pago?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.estado}</td>
                      <td className="px-4 py-3 font-semibold text-rose-400">{money(row.monto)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tipo === 'financiero' && (
        <Section
          title="Reporte financiero"
          description="Consolidado de ingresos y egresos."
          className="p-0"
          contentClassName="overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Concepto</th>
                  <th className="px-4 py-3 text-left font-medium">Categoría</th>
                  <th className="px-4 py-3 text-left font-medium">Tercero</th>
                  <th className="px-4 py-3 text-left font-medium">Método</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {[
                  ...ingresosFiltrados.map((row) => ({
                    key: `ingreso-${row.id}`,
                    fecha: row.fecha,
                    created_at: row.created_at,
                    tipo: 'Ingreso',
                    concepto: row.concepto,
                    categoria: row.categoria,
                    tercero: row.clientes?.nombre || 'Sin cliente',
                    metodo: row.metodos_pago?.nombre || '—',
                    estado: row.estado,
                    monto: Number(row.monto || 0),
                  })),
                  ...egresosFiltrados.map((row) => ({
                    key: `egreso-${row.id}`,
                    fecha: row.fecha,
                    created_at: row.created_at,
                    tipo: 'Egreso',
                    concepto: row.concepto,
                    categoria: row.categoria,
                    tercero: row.proveedor || 'Sin proveedor',
                    metodo: row.metodos_pago?.nombre || '—',
                    estado: row.estado,
                    monto: Number(row.monto || 0),
                  })),
                ]
                  .sort((a, b) => {
                    const dateA = `${a.fecha} ${a.created_at || ''}`
                    const dateB = `${b.fecha} ${b.created_at || ''}`
                    return dateA < dateB ? 1 : -1
                  })
                  .map((row) => (
                    <tr key={row.key} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white/75">{row.fecha}</td>
                      <td className="px-4 py-3 text-white/75">{row.tipo}</td>
                      <td className="px-4 py-3 font-medium text-white">{row.concepto}</td>
                      <td className="px-4 py-3 text-white/75">{row.categoria}</td>
                      <td className="px-4 py-3 text-white/75">{row.tercero}</td>
                      <td className="px-4 py-3 text-white/75">{row.metodo}</td>
                      <td className="px-4 py-3 text-white/75">{row.estado}</td>
                      <td
                        className={`px-4 py-3 font-semibold ${
                          row.tipo === 'Ingreso' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {row.tipo === 'Ingreso' ? '+' : '-'}
                        {money(row.monto)}
                      </td>
                    </tr>
                  ))}

                {ingresosFiltrados.length === 0 && egresosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-white/55">
                      No hay movimientos financieros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  )
}