'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

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
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const citasCanceladas = citasFiltradas.filter(
      (x) => x.estado === 'cancelada'
    ).length

    const planesActivos = planesFiltrados.filter(
      (x) => x.estado === 'activo'
    ).length

    const clientesActivos = clientesFiltrados.filter(
      (x) => x.estado === 'activo'
    ).length

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
            Number(row.sesiones_totales || 0) -
            Number(row.sesiones_usadas || 0),
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
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-6">
        <p className="text-sm text-slate-500">Administración</p>
        <h1 className="text-2xl font-bold text-slate-900">Reportes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Reportes administrativos, operativos y financieros con exportación CSV.
        </p>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Tipo
            </label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              {TIPOS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Desde
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Hasta
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => loadReporte()}
              disabled={loading}
              className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? 'Cargando...' : 'Generar'}
            </button>

            <button
              onClick={handleExport}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              CSV
            </button>
          </div>
        </div>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Clientes</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {resumen.totalClientes}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Activos: {resumen.totalClientesActivos}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Planes</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {resumen.totalPlanes}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Activos: {resumen.totalPlanesActivos}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Citas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {resumen.totalCitas}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Completadas: {resumen.totalCitasCompletadas} · Canceladas:{' '}
            {resumen.totalCitasCanceladas}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Ingresos</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {money(resumen.totalIngresos)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Egresos</p>
          <p className="mt-2 text-2xl font-bold text-red-700">
            {money(resumen.totalEgresos)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Balance</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {money(resumen.balance)}
          </p>
        </div>
      </div>

      {tipo === 'clientes' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Reporte de clientes
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                  <th className="px-4 py-3 text-left font-semibold">Teléfono</th>
                  <th className="px-4 py-3 text-left font-semibold">Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold">Creado</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-slate-500">
                      No hay clientes.
                    </td>
                  </tr>
                ) : (
                  clientesFiltrados.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.nombre}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.telefono || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.email || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.estado}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.created_at}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tipo === 'planes' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Reporte de planes
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-left font-semibold">Plan</th>
                  <th className="px-4 py-3 text-left font-semibold">Precio</th>
                  <th className="px-4 py-3 text-left font-semibold">Inicio</th>
                  <th className="px-4 py-3 text-left font-semibold">Fin</th>
                  <th className="px-4 py-3 text-left font-semibold">Usadas</th>
                  <th className="px-4 py-3 text-left font-semibold">Restantes</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {planesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-slate-500">
                      No hay planes.
                    </td>
                  </tr>
                ) : (
                  planesFiltrados.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.clientes?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.planes?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {money(Number(row.planes?.precio || 0))}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.fecha_inicio || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.fecha_fin || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.sesiones_usadas}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {Number(row.sesiones_totales || 0) -
                          Number(row.sesiones_usadas || 0)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.estado}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tipo === 'citas' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Reporte de citas
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold">Hora</th>
                  <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-left font-semibold">Personal</th>
                  <th className="px-4 py-3 text-left font-semibold">Servicio</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {citasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-slate-500">
                      No hay citas.
                    </td>
                  </tr>
                ) : (
                  citasFiltradas.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-700">{row.fecha}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.hora_inicio?.slice(0, 5)} -{' '}
                        {row.hora_fin?.slice(0, 5)}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.clientes?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.empleados?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.servicios?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.estado}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tipo === 'ingresos' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Reporte de ingresos
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold">Concepto</th>
                  <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                  <th className="px-4 py-3 text-left font-semibold">Método</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold">Monto</th>
                </tr>
              </thead>
              <tbody>
                {ingresosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-slate-500">
                      No hay ingresos.
                    </td>
                  </tr>
                ) : (
                  ingresosFiltrados.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-700">{row.fecha}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {row.concepto}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.tipo_origen}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.clientes?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.categoria}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.metodos_pago?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.estado}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-700">
                        {money(row.monto)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tipo === 'egresos' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Reporte de egresos
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold">Concepto</th>
                  <th className="px-4 py-3 text-left font-semibold">Proveedor</th>
                  <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                  <th className="px-4 py-3 text-left font-semibold">Método</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold">Monto</th>
                </tr>
              </thead>
              <tbody>
                {egresosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-slate-500">
                      No hay egresos.
                    </td>
                  </tr>
                ) : (
                  egresosFiltrados.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-700">{row.fecha}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.concepto}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.proveedor || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.categoria}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.metodos_pago?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.estado}</td>
                      <td className="px-4 py-3 font-semibold text-red-700">
                        {money(row.monto)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tipo === 'financiero' && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Reporte financiero
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                  <th className="px-4 py-3 text-left font-semibold">Concepto</th>
                  <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                  <th className="px-4 py-3 text-left font-semibold">Tercero</th>
                  <th className="px-4 py-3 text-left font-semibold">Método</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold">Monto</th>
                </tr>
              </thead>
              <tbody>
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
                    <tr key={row.key} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-700">{row.fecha}</td>
                      <td className="px-4 py-3 text-slate-700">{row.tipo}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.concepto}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.categoria}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.tercero}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.metodo}</td>
                      <td className="px-4 py-3 text-slate-700">{row.estado}</td>
                      <td
                        className={`px-4 py-3 font-semibold ${
                          row.tipo === 'Ingreso'
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {row.tipo === 'Ingreso' ? '+' : '-'}
                        {money(row.monto)}
                      </td>
                    </tr>
                  ))}

                {ingresosFiltrados.length === 0 &&
                  egresosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-slate-500">
                        No hay movimientos financieros.
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}