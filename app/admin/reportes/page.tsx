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
  AreaChart,
  Area,
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
  terapeuta_id: string | null
  empleados: { nombre: string } | null
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
  precio_final_usd: number | null
  monto_final_bs: number | null
  moneda_venta: string | null
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
  moneda_pago: string | null
  monto_equivalente_usd: number | null
  monto_equivalente_bs: number | null
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
  moneda: string | null
  monto_equivalente_usd: number | null
  monto_equivalente_bs: number | null
  metodos_pago: { nombre: string } | null
  empleados?: { nombre: string } | null
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

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

function money(value: number, currency: 'USD' | 'VES' = 'USD') {
  if (currency === 'VES') {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'VES',
      maximumFractionDigits: 2,
    }).format(Number(value || 0))
  }

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
  if (!rows.length) {
    alert('No hay datos para exportar.')
    return
  }

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

  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
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

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
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
  const [monedaVista, setMonedaVista] = useState<'USD' | 'BS'>('USD')

  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [planes, setPlanes] = useState<PlanRow[]>([])
  const [citas, setCitas] = useState<CitaRow[]>([])
  const [ingresos, setIngresos] = useState<IngresoRow[]>([])
  const [egresos, setEgresos] = useState<EgresoRow[]>([])

  const [totalGlobal, setTotalGlobal] = useState({
    clientes: 0,
    clientesActivos: 0,
    planes: 0,
    planesActivos: 0,
    citas: 0,
  })

  useEffect(() => {
    void loadReporte('financiero')
    void loadTotalesGlobales()
  }, [])

  useEffect(() => {
    if (tipo === 'ingresos' || tipo === 'egresos' || tipo === 'financiero') {
      void loadReporte()
    }
  }, [fechaInicio, fechaFin])

  async function loadTotalesGlobales() {
    try {
      const { count: totalClientes } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })

      const { count: clientesActivos } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'activo')

      const { count: totalPlanes } = await supabase
        .from('clientes_planes')
        .select('*', { count: 'exact', head: true })

      const { count: planesActivos } = await supabase
        .from('clientes_planes')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'activo')

      const { count: totalCitas } = await supabase
        .from('citas')
        .select('*', { count: 'exact', head: true })

      setTotalGlobal({
        clientes: totalClientes || 0,
        clientesActivos: clientesActivos || 0,
        planes: totalPlanes || 0,
        planesActivos: planesActivos || 0,
        citas: totalCitas || 0,
      })
    } catch (err) {
      console.error('Error cargando totales globales:', err)
    }
  }

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
          .select(`
            id, 
            nombre, 
            telefono, 
            email, 
            estado, 
            created_at,
            terapeuta_id,
            empleados:terapeuta_id ( nombre )
          `)
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
            precio_final_usd,
            monto_final_bs,
            moneda_venta,
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
            moneda_pago,
            monto_equivalente_usd,
            monto_equivalente_bs,
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
            moneda,
            monto_equivalente_usd,
            monto_equivalente_bs,
            metodos_pago:metodo_pago_id ( nombre ),
            empleados:empleado_id ( nombre )
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
        row.estado?.toLowerCase().includes(q) ||
        row.empleados?.nombre?.toLowerCase().includes(q)
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
        row.empleados?.nombre?.toLowerCase().includes(q) ||
        row.metodos_pago?.nombre?.toLowerCase().includes(q) ||
        row.estado?.toLowerCase().includes(q)
      )
    })
  }, [egresos, search])

  const resumen = useMemo(() => {
    const ingresosUsd = ingresosFiltrados
      .filter((x) => x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.monto_equivalente_usd || 0), 0)

    const ingresosBs = ingresosFiltrados
      .filter((x) => x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.monto_equivalente_bs || 0), 0)

    const egresosUsd = egresosFiltrados
      .filter((x) => x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.monto_equivalente_usd || 0), 0)

    const egresosBs = egresosFiltrados
      .filter((x) => x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.monto_equivalente_bs || 0), 0)

    const citasCompletadas = citasFiltradas.filter((x) => x.estado === 'completada').length
    const citasCanceladas = citasFiltradas.filter((x) => x.estado === 'cancelada').length

    return {
      ingresosUsd,
      ingresosBs,
      egresosUsd,
      egresosBs,
      balanceUsd: ingresosUsd - egresosUsd,
      balanceBs: ingresosBs - egresosBs,
      totalCitas: citasFiltradas.length,
      totalCitasCompletadas: citasCompletadas,
      totalCitasCanceladas: citasCanceladas,
    }
  }, [citasFiltradas, ingresosFiltrados, egresosFiltrados])

  const citasEstadoChart = useMemo(() => {
    const map = new Map<string, number>()

    for (const row of citasFiltradas) {
      const key = row.estado || 'sin estado'
      map.set(key, (map.get(key) || 0) + 1)
    }

    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [citasFiltradas])

  const financieroDiaChart = useMemo(() => {
    const map = new Map<
      string,
      {
        fecha: string
        ingresosUsd: number
        egresosUsd: number
        ingresosBs: number
        egresosBs: number
      }
    >()

    for (const row of ingresosFiltrados.filter((x) => x.estado === 'pagado')) {
      const prev = map.get(row.fecha) || {
        fecha: row.fecha,
        ingresosUsd: 0,
        egresosUsd: 0,
        ingresosBs: 0,
        egresosBs: 0,
      }
      prev.ingresosUsd += Number(row.monto_equivalente_usd || 0)
      prev.ingresosBs += Number(row.monto_equivalente_bs || 0)
      map.set(row.fecha, prev)
    }

    for (const row of egresosFiltrados.filter((x) => x.estado === 'pagado')) {
      const prev = map.get(row.fecha) || {
        fecha: row.fecha,
        ingresosUsd: 0,
        egresosUsd: 0,
        ingresosBs: 0,
        egresosBs: 0,
      }
      prev.egresosUsd += Number(row.monto_equivalente_usd || 0)
      prev.egresosBs += Number(row.monto_equivalente_bs || 0)
      map.set(row.fecha, prev)
    }

    return Array.from(map.values())
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((row) => ({
        label: shortDate(row.fecha),
        fecha: row.fecha,
        ingresos: monedaVista === 'USD' ? row.ingresosUsd : row.ingresosBs,
        egresos: monedaVista === 'USD' ? row.egresosUsd : row.egresosBs,
      }))
  }, [ingresosFiltrados, egresosFiltrados, monedaVista])

  const categoriaChart = useMemo(() => {
    const map = new Map<string, number>()

    if (tipo === 'ingresos') {
      for (const row of ingresosFiltrados.filter((x) => x.estado === 'pagado')) {
        const key = row.categoria || 'general'
        const valor =
          monedaVista === 'USD'
            ? Number(row.monto_equivalente_usd || 0)
            : Number(row.monto_equivalente_bs || 0)
        map.set(key, (map.get(key) || 0) + valor)
      }
    } else if (tipo === 'egresos') {
      for (const row of egresosFiltrados.filter((x) => x.estado === 'pagado')) {
        const key = row.categoria || 'operativo'
        const valor =
          monedaVista === 'USD'
            ? Number(row.monto_equivalente_usd || 0)
            : Number(row.monto_equivalente_bs || 0)
        map.set(key, (map.get(key) || 0) + valor)
      }
    } else {
      for (const row of ingresosFiltrados.filter((x) => x.estado === 'pagado')) {
        const key = row.categoria || 'general'
        const valor =
          monedaVista === 'USD'
            ? Number(row.monto_equivalente_usd || 0)
            : Number(row.monto_equivalente_bs || 0)
        map.set(key, (map.get(key) || 0) + valor)
      }
      for (const row of egresosFiltrados.filter((x) => x.estado === 'pagado')) {
        const key = row.categoria || 'operativo'
        const valor =
          monedaVista === 'USD'
            ? Number(row.monto_equivalente_usd || 0)
            : Number(row.monto_equivalente_bs || 0)
        map.set(key, (map.get(key) || 0) + valor)
      }
    }

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [tipo, ingresosFiltrados, egresosFiltrados, monedaVista])

  const acumuladoChart = useMemo(() => {
    let acumulado = 0
    return financieroDiaChart.map((d) => {
      const saldo = d.ingresos - d.egresos
      acumulado += saldo
      return {
        ...d,
        saldo,
        acumulado: Math.round(acumulado * 100) / 100,
      }
    })
  }, [financieroDiaChart])

  function handleExport() {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')

    if (tipo === 'clientes') {
      downloadCSV(
        `RPM_Clientes_${timestamp}.csv`,
        clientesFiltrados.map((row) => ({
          ID: row.id,
          Nombre: row.nombre,
          Teléfono: row.telefono || '',
          Email: row.email || '',
          Terapeuta: row.empleados?.nombre || '',
          Estado: row.estado,
          'Fecha Creación': formatDateTime(row.created_at),
        }))
      )
      return
    }

    if (tipo === 'planes') {
      downloadCSV(
        `RPM_Planes_${timestamp}.csv`,
        planesFiltrados.map((row) => ({
          ID: row.id,
          Cliente: row.clientes?.nombre || '',
          Plan: row.planes?.nombre || '',
          'Precio Base Plan': Number(row.planes?.precio || 0),
          'Precio Final USD': Number(row.precio_final_usd || 0),
          'Precio Final BS': Number(row.monto_final_bs || 0),
          'Moneda Venta': row.moneda_venta || '',
          'Fecha Inicio': row.fecha_inicio || '',
          'Fecha Fin': row.fecha_fin || '',
          'Sesiones Totales': row.sesiones_totales,
          'Sesiones Usadas': row.sesiones_usadas,
          'Sesiones Restantes': Number(row.sesiones_totales || 0) - Number(row.sesiones_usadas || 0),
          Estado: row.estado,
          'Fecha Creación': formatDateTime(row.created_at),
        }))
      )
      return
    }

    if (tipo === 'citas') {
      downloadCSV(
        `RPM_Citas_${timestamp}.csv`,
        citasFiltradas.map((row) => ({
          ID: row.id,
          Fecha: row.fecha,
          'Hora Inicio': row.hora_inicio,
          'Hora Fin': row.hora_fin,
          Cliente: row.clientes?.nombre || '',
          Terapeuta: row.empleados?.nombre || '',
          Servicio: row.servicios?.nombre || '',
          'Precio Servicio': Number(row.servicios?.precio || 0),
          Estado: row.estado,
        }))
      )
      return
    }

    if (tipo === 'ingresos') {
      downloadCSV(
        `RPM_Ingresos_${timestamp}.csv`,
        ingresosFiltrados.map((row) => ({
          ID: row.id,
          Fecha: row.fecha,
          Concepto: row.concepto,
          Categoría: row.categoria,
          'Tipo Origen': row.tipo_origen,
          Cliente: row.clientes?.nombre || '',
          'Método Pago': row.metodos_pago?.nombre || '',
          'Moneda Pago': row.moneda_pago || '',
          'Monto Original': Number(row.monto || 0),
          'Monto USD': Number(row.monto_equivalente_usd || 0),
          'Monto BS': Number(row.monto_equivalente_bs || 0),
          Estado: row.estado,
          'Fecha Creación': formatDateTime(row.created_at),
        }))
      )
      return
    }

    if (tipo === 'egresos') {
      downloadCSV(
        `RPM_Egresos_${timestamp}.csv`,
        egresosFiltrados.map((row) => ({
          ID: row.id,
          Fecha: row.fecha,
          Concepto: row.concepto,
          Categoría: row.categoria,
          Proveedor: row.proveedor || '',
          Empleado: row.empleados?.nombre || '',
          'Método Pago': row.metodos_pago?.nombre || '',
          Moneda: row.moneda || '',
          'Monto Original': Number(row.monto || 0),
          'Monto USD': Number(row.monto_equivalente_usd || 0),
          'Monto BS': Number(row.monto_equivalente_bs || 0),
          Estado: row.estado,
          'Fecha Creación': formatDateTime(row.created_at),
        }))
      )
      return
    }

    if (tipo === 'financiero') {
      const rows = [
        ...ingresosFiltrados.map((row) => ({
          ID: row.id,
          Fecha: row.fecha,
          Tipo: 'Ingreso',
          Concepto: row.concepto,
          Categoría: row.categoria,
          Tercero: row.clientes?.nombre || '',
          'Método Pago': row.metodos_pago?.nombre || '',
          'Moneda Pago': row.moneda_pago || '',
          'Monto Original': Number(row.monto || 0),
          'Monto USD': Number(row.monto_equivalente_usd || 0),
          'Monto BS': Number(row.monto_equivalente_bs || 0),
          Estado: row.estado,
          'Fecha Creación': formatDateTime(row.created_at),
        })),
        ...egresosFiltrados.map((row) => ({
          ID: row.id,
          Fecha: row.fecha,
          Tipo: 'Egreso',
          Concepto: row.concepto,
          Categoría: row.categoria,
          Tercero: row.empleados?.nombre || row.proveedor || '',
          'Método Pago': row.metodos_pago?.nombre || '',
          'Moneda Pago': row.moneda || '',
          'Monto Original': Number(row.monto || 0),
          'Monto USD': Number(row.monto_equivalente_usd || 0),
          'Monto BS': Number(row.monto_equivalente_bs || 0),
          Estado: row.estado,
          'Fecha Creación': formatDateTime(row.created_at),
        })),
      ].sort((a, b) => {
        const dateA = `${a.Fecha} ${a['Fecha Creación']}`
        const dateB = `${b.Fecha} ${b['Fecha Creación']}`
        return dateA < dateB ? 1 : -1
      })

      downloadCSV(`RPM_Financiero_${timestamp}.csv`, rows)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Administración</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Reportes</h1>
          <p className="mt-2 text-sm text-white/55">
            Reportes operativos y financieros con exportación a Excel
          </p>
        </div>

        {(tipo === 'ingresos' || tipo === 'egresos' || tipo === 'financiero') && (
          <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.02] p-1">
            <button
              type="button"
              onClick={() => setMonedaVista('USD')}
              className={`rounded-xl px-6 py-2.5 text-sm font-medium transition ${
                monedaVista === 'USD'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                  : 'text-white/45 hover:text-white/70'
              }`}
            >
              💵 USD
            </button>
            <button
              type="button"
              onClick={() => setMonedaVista('BS')}
              className={`rounded-xl px-6 py-2.5 text-sm font-medium transition ${
                monedaVista === 'BS'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                  : 'text-white/45 hover:text-white/70'
              }`}
            >
              💰 BS
            </button>
          </div>
        )}
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      <Section title="Filtros del reporte" description="Configura los parámetros del reporte.">
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
              {loading ? 'Cargando...' : '🔄 Generar'}
            </button>

            <button
              onClick={handleExport}
              disabled={loading}
              className="
                rounded-2xl border border-emerald-400/30 bg-emerald-400/10
                px-4 py-3 text-sm font-semibold text-emerald-300 transition
                hover:bg-emerald-400/20 disabled:opacity-60
              "
            >
              📊 Excel
            </button>
          </div>
        </div>
      </Section>

      {tipo !== 'citas' && tipo !== 'planes' && (
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard
            title="Clientes"
            value={totalGlobal.clientes}
            subtitle={`Activos: ${totalGlobal.clientesActivos}`}
            color="text-sky-400"
          />

          <StatCard
            title="Planes"
            value={totalGlobal.planes}
            subtitle={`Activos: ${totalGlobal.planesActivos}`}
            color="text-violet-400"
          />

          <StatCard
            title="Citas"
            value={totalGlobal.citas}
            subtitle={`✓${resumen.totalCitasCompletadas} · ✗${resumen.totalCitasCanceladas}`}
            color="text-amber-300"
          />

          <StatCard
            title={`Ingresos ${monedaVista}`}
            value={money(
              monedaVista === 'USD' ? resumen.ingresosUsd : resumen.ingresosBs,
              monedaVista === 'USD' ? 'USD' : 'VES'
            )}
            color="text-emerald-400"
          />

          <StatCard
            title={`Egresos ${monedaVista}`}
            value={money(
              monedaVista === 'USD' ? resumen.egresosUsd : resumen.egresosBs,
              monedaVista === 'USD' ? 'USD' : 'VES'
            )}
            color="text-rose-400"
          />

          <StatCard
            title={`Balance ${monedaVista}`}
            value={money(
              monedaVista === 'USD' ? resumen.balanceUsd : resumen.balanceBs,
              monedaVista === 'USD' ? 'USD' : 'VES'
            )}
            color={
              (monedaVista === 'USD' ? resumen.balanceUsd : resumen.balanceBs) >= 0
                ? 'text-cyan-400'
                : 'text-rose-400'
            }
          />
        </div>
      )}

      {(tipo === 'citas' || tipo === 'ingresos' || tipo === 'egresos' || tipo === 'financiero') && (
        <div className="grid gap-6 xl:grid-cols-2">
          {tipo === 'citas' && citasEstadoChart.length > 0 && (
            <Section title="Estados de citas" description="Distribución por estado.">
              <div className="h-80">
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
              </div>
            </Section>
          )}

          {tipo === 'financiero' && acumuladoChart.length > 0 && (
            <Section
              title={`Flujo de caja acumulado (${monedaVista})`}
              description="Evolución del saldo en el período."
            >
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={acumuladoChart}>
                    <defs>
                      <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="label" stroke="rgba(255,255,255,0.45)" />
                    <YAxis stroke="rgba(255,255,255,0.45)" />
                    <Tooltip
                      formatter={(v) => money(Number(v), monedaVista === 'USD' ? 'USD' : 'VES')}
                      contentStyle={{
                        background: '#11131a',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 16,
                        color: '#fff',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="acumulado"
                      stroke="#a78bfa"
                      strokeWidth={2}
                      fill="url(#colorAcumulado)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Section>
          )}

          {tipo === 'financiero' && financieroDiaChart.length > 0 && (
            <Section
              title={`Ingresos vs Egresos (${monedaVista})`}
              description="Comparativo diario."
            >
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financieroDiaChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="label" stroke="rgba(255,255,255,0.45)" />
                    <YAxis stroke="rgba(255,255,255,0.45)" />
                    <Tooltip
                      formatter={(value) =>
                        money(Number(value), monedaVista === 'USD' ? 'USD' : 'VES')
                      }
                      contentStyle={{
                        background: '#11131a',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 16,
                        color: '#fff',
                      }}
                    />
                    <Legend />
                    <Bar dataKey="ingresos" fill="#34d399" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="egresos" fill="#f87171" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          )}

          {(tipo === 'ingresos' || tipo === 'egresos' || tipo === 'financiero') &&
            categoriaChart.length > 0 && (
              <Section
                title={`Distribución por categoría (${monedaVista})`}
                description="Top categorías del período."
              >
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoriaChart} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis type="number" stroke="rgba(255,255,255,0.45)" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="rgba(255,255,255,0.45)"
                        width={100}
                      />
                      <Tooltip
                        formatter={(value) =>
                          money(Number(value), monedaVista === 'USD' ? 'USD' : 'VES')
                        }
                        contentStyle={{
                          background: '#11131a',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 16,
                          color: '#fff',
                        }}
                      />
                      <Bar dataKey="value" fill="#60a5fa" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            )}
        </div>
      )}

      {/* TABLAS */}
      {tipo === 'clientes' && (
        <Section
          title="Reporte de clientes"
          description={`${clientesFiltrados.length} registros`}
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
                  <th className="px-4 py-3 text-left font-medium">Terapeuta</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {clientesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-white/55">
                      No hay clientes.
                    </td>
                  </tr>
                ) : (
                  clientesFiltrados.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-white">{row.nombre}</td>
                      <td className="px-4 py-3 text-white/75">{row.telefono || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.email || '—'}</td>
                      <td className="px-4 py-3 text-white/75">
                        {row.empleados?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-white/75">{row.estado}</td>
                      <td className="px-4 py-3 text-white/75">
                        {shortDate(row.created_at.slice(0, 10))}
                      </td>
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
          description={`${planesFiltrados.length} registros`}
          className="p-0"
          contentClassName="overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Plan</th>
                  <th className="px-4 py-3 text-left font-medium">Precio Final</th>
                  <th className="px-4 py-3 text-left font-medium">Moneda</th>
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
                    <td colSpan={9} className="px-4 py-6 text-center text-white/55">
                      No hay planes.
                    </td>
                  </tr>
                ) : (
                  planesFiltrados.map((row) => {
                    const precioFinal =
                      row.moneda_venta === 'USD'
                        ? row.precio_final_usd || row.planes?.precio || 0
                        : row.monto_final_bs || 0

                    return (
                      <tr key={row.id} className="transition hover:bg-white/[0.03]">
                        <td className="px-4 py-3 font-medium text-white">
                          {row.clientes?.nombre || '—'}
                        </td>
                        <td className="px-4 py-3 text-white/75">{row.planes?.nombre || '—'}</td>
                        <td className="px-4 py-3 text-white/75">
                          {row.moneda_venta === 'USD'
                            ? money(precioFinal)
                            : money(precioFinal, 'VES')}
                        </td>
                        <td className="px-4 py-3 text-white/75">{row.moneda_venta || 'USD'}</td>
                        <td className="px-4 py-3 text-white/75">{row.fecha_inicio || '—'}</td>
                        <td className="px-4 py-3 text-white/75">{row.fecha_fin || '—'}</td>
                        <td className="px-4 py-3 text-white/75">{row.sesiones_usadas}</td>
                        <td className="px-4 py-3 text-white/75">
                          {Number(row.sesiones_totales || 0) - Number(row.sesiones_usadas || 0)}
                        </td>
                        <td className="px-4 py-3 text-white/75">{row.estado}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tipo === 'citas' && (
        <Section
          title="Reporte de citas"
          description={`${citasFiltradas.length} registros`}
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
                  <th className="px-4 py-3 text-left font-medium">Precio</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {citasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-white/55">
                      No hay citas.
                    </td>
                  </tr>
                ) : (
                  citasFiltradas.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white/75">{row.fecha}</td>
                      <td className="px-4 py-3 text-white/75">
                        {row.hora_inicio?.slice(0, 5)} - {row.hora_fin?.slice(0, 5)}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        {row.clientes?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-white/75">
                        {row.empleados?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-white/75">
                        {row.servicios?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-emerald-400 font-semibold">
                        {money(row.servicios?.precio || 0)}
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

      {tipo === 'ingresos' && (
        <Section
          title="Reporte de ingresos"
          description={`${ingresosFiltrados.length} registros`}
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
                  <th className="px-4 py-3 text-left font-medium">Monto USD</th>
                  <th className="px-4 py-3 text-left font-medium">Monto BS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {ingresosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-white/55">
                      No hay ingresos.
                    </td>
                  </tr>
                ) : (
                  ingresosFiltrados.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white/75">{row.fecha}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{row.concepto}</p>
                        <p className="text-xs text-white/45">{row.tipo_origen}</p>
                      </td>
                      <td className="px-4 py-3 text-white/75">
                        {row.clientes?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-white/75">{row.categoria}</td>
                      <td className="px-4 py-3 text-white/75">
                        {row.metodos_pago?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-white/75">{row.estado}</td>
                      <td className="px-4 py-3 font-semibold text-emerald-400">
                        {money(row.monto_equivalente_usd || 0)}
                      </td>
                      <td className="px-4 py-3 text-white/75">
                        {money(row.monto_equivalente_bs || 0, 'VES')}
                      </td>
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
          description={`${egresosFiltrados.length} registros`}
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
                  <th className="px-4 py-3 text-left font-medium">Monto USD</th>
                  <th className="px-4 py-3 text-left font-medium">Monto BS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {egresosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-white/55">
                      No hay egresos.
                    </td>
                  </tr>
                ) : (
                  egresosFiltrados.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white/75">{row.fecha}</td>
                      <td className="px-4 py-3 font-medium text-white">{row.concepto}</td>
                      <td className="px-4 py-3 text-white/75">
                        {row.empleados?.nombre || row.proveedor || '—'}
                      </td>
                      <td className="px-4 py-3 text-white/75">{row.categoria}</td>
                      <td className="px-4 py-3 text-white/75">
                        {row.metodos_pago?.nombre || '—'}
                      </td>
                      <td className="px-4 py-3 text-white/75">{row.estado}</td>
                      <td className="px-4 py-3 font-semibold text-rose-400">
                        {money(row.monto_equivalente_usd || 0)}
                      </td>
                      <td className="px-4 py-3 text-white/75">
                        {money(row.monto_equivalente_bs || 0, 'VES')}
                      </td>
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
          description={`${ingresosFiltrados.length + egresosFiltrados.length} registros`}
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
                  <th className="px-4 py-3 text-left font-medium">Monto USD</th>
                  <th className="px-4 py-3 text-left font-medium">Monto BS</th>
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
                    montoUsd: Number(row.monto_equivalente_usd || 0),
                    montoBs: Number(row.monto_equivalente_bs || 0),
                  })),
                  ...egresosFiltrados.map((row) => ({
                    key: `egreso-${row.id}`,
                    fecha: row.fecha,
                    created_at: row.created_at,
                    tipo: 'Egreso',
                    concepto: row.concepto,
                    categoria: row.categoria,
                    tercero: row.empleados?.nombre || row.proveedor || 'Sin proveedor',
                    metodo: row.metodos_pago?.nombre || '—',
                    estado: row.estado,
                    montoUsd: Number(row.monto_equivalente_usd || 0),
                    montoBs: Number(row.monto_equivalente_bs || 0),
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
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                            row.tipo === 'Ingreso'
                              ? 'border-sky-400/20 bg-sky-400/10 text-sky-300'
                              : 'border-amber-400/20 bg-amber-400/10 text-amber-300'
                          }`}
                        >
                          {row.tipo}
                        </span>
                      </td>
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
                        {money(row.montoUsd)}
                      </td>
                      <td className="px-4 py-3 text-white/75">{money(row.montoBs, 'VES')}</td>
                    </tr>
                  ))}

                {ingresosFiltrados.length === 0 && egresosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-white/55">
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
