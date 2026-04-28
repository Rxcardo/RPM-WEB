'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
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

type Pago = {
  id: string
  fecha: string
  concepto: string
  categoria: string
  monto: number
  estado: string
  tipo_origen: string
  created_at?: string
  moneda_pago: string | null
  monto_equivalente_usd: number | null
  monto_equivalente_bs: number | null
  clientes: { nombre: string } | null
  metodo_pago_v2?: {
    nombre: string
    moneda?: string | null
    tipo?: string | null
    cartera?: {
      nombre: string
      codigo: string
      moneda?: string | null
    } | null
  } | null
}

type Egreso = {
  id: string
  fecha: string
  concepto: string
  categoria: string
  monto: number
  estado: string
  proveedor: string | null
  created_at?: string
  moneda: string | null
  monto_equivalente_usd: number | null
  monto_equivalente_bs: number | null
  empleado_id: string | null
  empleados?: { nombre: string } | null
  metodo_pago_v2?: {
    nombre: string
    moneda?: string | null
    tipo?: string | null
    cartera?: {
      nombre: string
      codigo: string
      moneda?: string | null
    } | null
  } | null
}

type MetodoSubcartera = {
  id: string
  metodo_nombre: string
  metodo_codigo: string
  tipo: string | null
  moneda: string
  saldo_actual: number | null
  banco: string | null
  numero_cuenta: string | null
  activo: boolean | null
  cartera_id: string
  cartera_nombre: string
  cartera_codigo: string
  cartera_color: string | null
  cartera_icono: string | null
}

type ComisionResumen = {
  empleado_id: string
  nombre: string
  total_base_usd: number
  total_base_bs: number
  total_profesional_usd: number
  total_profesional_bs: number
  total_rpm_usd: number
  total_rpm_bs: number
  cantidad: number
}

type Movimiento = {
  id: string
  fecha: string
  tipo: 'ingreso' | 'egreso'
  concepto: string
  categoria: string
  tercero: string
  metodo: string
  cartera: string
  cartera_codigo: string
  moneda_metodo: string
  estado: string
  moneda_origen: string
  monto_usd: number
  monto_bs: number
  created_at?: string
}

const PIE_COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#94a3b8']
const MOVIMIENTOS_POR_SUBCARTERA = 10

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/75">{label}</label>
      {children}
    </div>
  )
}

function StatCard({
  title,
  value,
  color,
}: {
  title: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6 backdrop-blur-xl">
      <p className="text-sm text-white/55">{title}</p>
      <p className={`mt-3 text-2xl md:text-3xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6 backdrop-blur-xl">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {description ? <p className="mt-1 text-sm text-white/55">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </div>
  )
}

function money(v: number, currency: 'USD' | 'VES' = 'USD') {
  if (currency === 'VES') {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'VES',
      maximumFractionDigits: 2,
    }).format(Number(v || 0))
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(v || 0))
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function firstDayOfMonthISO() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function shortDate(v: string) {
  try {
    return new Date(v).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
  } catch {
    return v
  }
}

function estadoBadge(e: string) {
  if (e === 'pagado') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
  if (e === 'anulado') return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
  if (e === 'pendiente') return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
  return 'border-white/10 bg-white/[0.05] text-white/70'
}

function tipoBadge(t: 'ingreso' | 'egreso') {
  return t === 'ingreso'
    ? 'border-sky-400/20 bg-sky-400/10 text-sky-300'
    : 'border-amber-400/20 bg-amber-400/10 text-amber-300'
}

function getCurrencyStyles(monedaVista: 'USD' | 'BS') {
  if (monedaVista === 'USD') {
    return {
      active: 'border-emerald-400/30 bg-emerald-500/20 text-emerald-300',
      amount: 'text-emerald-400',
      badge: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
      soft: 'border-emerald-400/15 bg-emerald-400/[0.06]',
    }
  }

  return {
    active: 'border-amber-400/30 bg-amber-500/20 text-amber-300',
    amount: 'text-amber-300',
    badge: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    soft: 'border-amber-400/15 bg-amber-400/[0.06]',
  }
}

function getMetodoEmoji(codigo: string, moneda: string) {
  const key = `${codigo} ${moneda}`.toLowerCase()

  if (key.includes('zelle')) return '💸'
  if (key.includes('binance')) return '🟡'
  if (key.includes('paypal')) return '🅿️'
  if (key.includes('pago_movil')) return '📲'
  if (key.includes('punto_venta')) return '💳'
  if (key.includes('transferencia')) return '🏦'
  if (key.includes('efectivo') && moneda === 'USD') return '💵'
  if (key.includes('efectivo') && (moneda === 'VES' || moneda === 'BS')) return '💰'

  return moneda === 'USD' ? '💵' : '💰'
}

function normalizeMoneda(moneda: string | null | undefined) {
  const m = (moneda || '').toUpperCase()
  if (m === 'BS') return 'VES'
  return m
}

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizePago(row: any): Pago {
  const cliente = firstOrNull(row?.clientes)
  const metodo = firstOrNull(row?.metodo_pago_v2)
  const cartera = firstOrNull(metodo?.cartera)

  return {
    id: String(row?.id ?? ''),
    fecha: String(row?.fecha ?? ''),
    concepto: String(row?.concepto ?? ''),
    categoria: String(row?.categoria ?? ''),
    monto: Number(row?.monto || 0),
    estado: String(row?.estado ?? ''),
    tipo_origen: String(row?.tipo_origen ?? ''),
    created_at: row?.created_at ?? undefined,
    moneda_pago: row?.moneda_pago ?? null,
    monto_equivalente_usd:
      row?.monto_equivalente_usd != null ? Number(row.monto_equivalente_usd) : null,
    monto_equivalente_bs:
      row?.monto_equivalente_bs != null ? Number(row.monto_equivalente_bs) : null,
    clientes: cliente ? { nombre: String(cliente?.nombre ?? '') } : null,
    metodo_pago_v2: metodo
      ? {
          nombre: String(metodo?.nombre ?? ''),
          moneda: metodo?.moneda ?? null,
          tipo: metodo?.tipo ?? null,
          cartera: cartera
            ? {
                nombre: String(cartera?.nombre ?? ''),
                codigo: String(cartera?.codigo ?? ''),
                moneda: cartera?.moneda ?? null,
              }
            : null,
        }
      : null,
  }
}

function normalizeEgreso(row: any): Egreso {
  const empleado = firstOrNull(row?.empleados)
  const metodo = firstOrNull(row?.metodo_pago_v2)
  const cartera = firstOrNull(metodo?.cartera)

  return {
    id: String(row?.id ?? ''),
    fecha: String(row?.fecha ?? ''),
    concepto: String(row?.concepto ?? ''),
    categoria: String(row?.categoria ?? ''),
    monto: Number(row?.monto || 0),
    estado: String(row?.estado ?? ''),
    proveedor: row?.proveedor ?? null,
    created_at: row?.created_at ?? undefined,
    moneda: row?.moneda ?? null,
    monto_equivalente_usd:
      row?.monto_equivalente_usd != null ? Number(row.monto_equivalente_usd) : null,
    monto_equivalente_bs:
      row?.monto_equivalente_bs != null ? Number(row.monto_equivalente_bs) : null,
    empleado_id: row?.empleado_id ?? null,
    empleados: empleado ? { nombre: String(empleado?.nombre ?? '') } : null,
    metodo_pago_v2: metodo
      ? {
          nombre: String(metodo?.nombre ?? ''),
          moneda: metodo?.moneda ?? null,
          tipo: metodo?.tipo ?? null,
          cartera: cartera
            ? {
                nombre: String(cartera?.nombre ?? ''),
                codigo: String(cartera?.codigo ?? ''),
                moneda: cartera?.moneda ?? null,
              }
            : null,
        }
      : null,
  }
}

export default function FinanzasResumenPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fechaInicio, setFechaInicio] = useState(firstDayOfMonthISO())
  const [fechaFin, setFechaFin] = useState(todayISO())
  const [search, setSearch] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'ingreso' | 'egreso'>('todos')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos')
  const [monedaVista, setMonedaVista] = useState<'USD' | 'BS'>('USD')
  const [subcarteraAbiertaId, setSubcarteraAbiertaId] = useState<string | null>(null)
  const [subcarteraPaginas, setSubcarteraPaginas] = useState<Record<string, number>>({})

  const [monedaFiltro, setMonedaFiltro] = useState<'todas' | 'USD' | 'VES' | 'BS'>('todas')
  const [carteraFiltro, setCarteraFiltro] = useState('todas')

  const [pagos, setPagos] = useState<Pago[]>([])
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [subcarteras, setSubcarteras] = useState<MetodoSubcartera[]>([])
  const [comisiones, setComisiones] = useState<ComisionResumen[]>([])

  useEffect(() => {
    void loadFinanzas()
  }, [fechaInicio, fechaFin])

  useEffect(() => {
    setSubcarteraAbiertaId(null)
    setSubcarteraPaginas({})
  }, [monedaVista, fechaInicio, fechaFin])

  useEffect(() => {
    if (carteraFiltro === 'todas') return

    const carterasDisponibles = new Set(movimientos.map((m) => m.cartera_codigo).filter(Boolean))

    if (!carterasDisponibles.has(carteraFiltro)) {
      setCarteraFiltro('todas')
    }
  }, [monedaFiltro]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadFinanzas() {
    try {
      setLoading(true)
      setError('')

      const [pagosRes, egresosRes, comisionesRes, subcarterasRes] = await Promise.all([
        supabase
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
            metodo_pago_v2:metodo_pago_v2_id (
              nombre,
              moneda,
              tipo,
              cartera:cartera_id (
                nombre,
                codigo,
                moneda
              )
            )
          `)
          .gte('fecha', fechaInicio)
          .lte('fecha', fechaFin)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false }),

        supabase
          .from('egresos')
          .select(`
            id,
            fecha,
            concepto,
            categoria,
            monto,
            estado,
            proveedor,
            created_at,
            moneda,
            monto_equivalente_usd,
            monto_equivalente_bs,
            empleado_id,
            empleados:empleado_id ( nombre ),
            metodo_pago_v2:metodo_pago_v2_id (
              nombre,
              moneda,
              tipo,
              cartera:cartera_id (
                nombre,
                codigo,
                moneda
              )
            )
          `)
          .gte('fecha', fechaInicio)
          .lte('fecha', fechaFin)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false }),

        supabase
          .from('comisiones_detalle')
          .select(`
            empleado_id,
            monto_base_usd,
            monto_base_bs,
            monto_profesional_usd,
            monto_profesional_bs,
            monto_rpm_usd,
            monto_rpm_bs,
            empleados:empleado_id ( nombre )
          `)
          .gte('fecha', fechaInicio)
          .lte('fecha', fechaFin)
          .eq('estado', 'pendiente'),

        supabase
          .from('v_metodos_pago_completo')
          .select(`
            id,
            metodo_nombre,
            metodo_codigo,
            tipo,
            moneda,
            saldo_actual,
            banco,
            numero_cuenta,
            activo,
            cartera_id,
            cartera_nombre,
            cartera_codigo,
            cartera_color,
            cartera_icono
          `)
          .eq('activo', true)
          .order('moneda', { ascending: true })
          .order('cartera_nombre', { ascending: true })
          .order('metodo_nombre', { ascending: true }),
      ])

      if (pagosRes.error) throw pagosRes.error
      if (egresosRes.error) throw egresosRes.error
      if (comisionesRes.error) throw comisionesRes.error
      if (subcarterasRes.error) throw subcarterasRes.error

      const pagosNormalizados = ((pagosRes.data || []) as any[]).map(normalizePago)
      const egresosNormalizados = ((egresosRes.data || []) as any[]).map(normalizeEgreso)

      setPagos(pagosNormalizados)
      setEgresos(egresosNormalizados)
      setSubcarteras((subcarterasRes.data || []) as MetodoSubcartera[])

      const comisionesRaw = (comisionesRes.data || []) as any[]
      const grouped = new Map<string, ComisionResumen>()

      comisionesRaw.forEach((c: any) => {
        const empleado = firstOrNull(c?.empleados)
        const nombre = empleado?.nombre || 'Sin nombre'
        const key = String(c.empleado_id)

        const existing = grouped.get(key)

        if (existing) {
          existing.total_base_usd += Number(c.monto_base_usd || 0)
          existing.total_base_bs += Number(c.monto_base_bs || 0)
          existing.total_profesional_usd += Number(c.monto_profesional_usd || 0)
          existing.total_profesional_bs += Number(c.monto_profesional_bs || 0)
          existing.total_rpm_usd += Number(c.monto_rpm_usd || 0)
          existing.total_rpm_bs += Number(c.monto_rpm_bs || 0)
          existing.cantidad += 1
        } else {
          grouped.set(key, {
            empleado_id: key,
            nombre,
            total_base_usd: Number(c.monto_base_usd || 0),
            total_base_bs: Number(c.monto_base_bs || 0),
            total_profesional_usd: Number(c.monto_profesional_usd || 0),
            total_profesional_bs: Number(c.monto_profesional_bs || 0),
            total_rpm_usd: Number(c.monto_rpm_usd || 0),
            total_rpm_bs: Number(c.monto_rpm_bs || 0),
            cantidad: 1,
          })
        }
      })

      setComisiones(Array.from(grouped.values()))
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Error cargando finanzas.')
    } finally {
      setLoading(false)
    }
  }

  const movimientos = useMemo(() => {
    const ingresos: Movimiento[] = pagos.map((p) => ({
      id: p.id,
      fecha: p.fecha,
      tipo: 'ingreso' as const,
      concepto: p.concepto,
      categoria: p.categoria,
      tercero: p.clientes?.nombre || '—',
      metodo: p.metodo_pago_v2?.nombre || '—',
      cartera: p.metodo_pago_v2?.cartera?.nombre || 'Sin cartera',
      cartera_codigo: p.metodo_pago_v2?.cartera?.codigo || '',
      moneda_metodo: (
        p.metodo_pago_v2?.moneda ||
        p.metodo_pago_v2?.cartera?.moneda ||
        p.moneda_pago ||
        'USD'
      ).toUpperCase(),
      estado: p.estado,
      moneda_origen: p.moneda_pago || 'USD',
      monto_usd: Number(p.monto_equivalente_usd || 0),
      monto_bs: Number(p.monto_equivalente_bs || 0),
      created_at: p.created_at,
    }))

    const egs: Movimiento[] = egresos.map((e) => ({
      id: e.id,
      fecha: e.fecha,
      tipo: 'egreso' as const,
      concepto: e.concepto,
      categoria: e.categoria,
      tercero: e.empleados?.nombre || e.proveedor || '—',
      metodo: e.metodo_pago_v2?.nombre || '—',
      cartera: e.metodo_pago_v2?.cartera?.nombre || 'Sin cartera',
      cartera_codigo: e.metodo_pago_v2?.cartera?.codigo || '',
      moneda_metodo: (
        e.metodo_pago_v2?.moneda ||
        e.metodo_pago_v2?.cartera?.moneda ||
        e.moneda ||
        'USD'
      ).toUpperCase(),
      estado: e.estado,
      moneda_origen: e.moneda || 'USD',
      monto_usd: Number(e.monto_equivalente_usd || 0),
      monto_bs: Number(e.monto_equivalente_bs || 0),
      created_at: e.created_at,
    }))

    return [...ingresos, ...egs].sort(
      (a, b) =>
        new Date(`${b.fecha}T${b.created_at || '00:00'}`).getTime() -
        new Date(`${a.fecha}T${a.created_at || '00:00'}`).getTime()
    )
  }, [pagos, egresos])

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      if (tipoFiltro !== 'todos' && m.tipo !== tipoFiltro) return false
      if (estadoFiltro !== 'todos' && m.estado !== estadoFiltro) return false
      if (categoriaFiltro !== 'todos' && m.categoria !== categoriaFiltro) return false

      if (monedaFiltro !== 'todas') {
        const monedaNormalizada = normalizeMoneda(m.moneda_metodo)
        const filtroNormalizado = normalizeMoneda(monedaFiltro)
        if (monedaNormalizada !== filtroNormalizado) return false
      }

      if (carteraFiltro !== 'todas' && m.cartera_codigo !== carteraFiltro) return false

      if (search) {
        const s = search.toLowerCase()
        return (
          m.concepto.toLowerCase().includes(s) ||
          m.tercero.toLowerCase().includes(s) ||
          m.categoria.toLowerCase().includes(s) ||
          m.metodo.toLowerCase().includes(s) ||
          m.cartera.toLowerCase().includes(s)
        )
      }

      return true
    })
  }, [movimientos, tipoFiltro, estadoFiltro, categoriaFiltro, monedaFiltro, carteraFiltro, search])

  const totales = useMemo(() => {
    const pagados = movimientosFiltrados.filter((m) => m.estado === 'pagado')

    const ingresosUsd = pagados
      .filter((m) => m.tipo === 'ingreso')
      .reduce((a, m) => a + Number(m.monto_usd || 0), 0)

    const ingresosBs = pagados
      .filter((m) => m.tipo === 'ingreso')
      .reduce((a, m) => a + Number(m.monto_bs || 0), 0)

    const egresosUsd = pagados
      .filter((m) => m.tipo === 'egreso')
      .reduce((a, m) => a + Number(m.monto_usd || 0), 0)

    const egresosBs = pagados
      .filter((m) => m.tipo === 'egreso')
      .reduce((a, m) => a + Number(m.monto_bs || 0), 0)

    const comisionesPendientesUsd = comisiones.reduce(
      (a, c) => a + Number(c.total_profesional_usd || 0),
      0
    )

    const comisionesPendientesBs = comisiones.reduce(
      (a, c) => a + Number(c.total_profesional_bs || 0),
      0
    )

    return {
      ingresosUsd,
      ingresosBs,
      egresosUsd,
      egresosBs,
      utilidadUsd: ingresosUsd - egresosUsd,
      utilidadBs: ingresosBs - egresosBs,
      comisionesPendientesUsd,
      comisionesPendientesBs,
      flujoCajaUsd: ingresosUsd - egresosUsd - comisionesPendientesUsd,
      flujoCajaBs: ingresosBs - egresosBs - comisionesPendientesBs,
    }
  }, [movimientosFiltrados, comisiones])

  const flujoPorDia = useMemo(() => {
    const byDate = new Map<string, { ingresos: number; egresos: number; saldo: number }>()

    movimientosFiltrados
      .filter((m) => m.estado === 'pagado')
      .forEach((m) => {
        const valor = monedaVista === 'USD' ? m.monto_usd : m.monto_bs
        const existing = byDate.get(m.fecha) || { ingresos: 0, egresos: 0, saldo: 0 }

        if (m.tipo === 'ingreso') {
          existing.ingresos += valor
        } else {
          existing.egresos += valor
        }

        existing.saldo = existing.ingresos - existing.egresos
        byDate.set(m.fecha, existing)
      })

    return Array.from(byDate.entries())
      .map(([fecha, data]) => ({
        label: shortDate(fecha),
        fecha,
        ingresos: Math.round(data.ingresos * 100) / 100,
        egresos: Math.round(data.egresos * 100) / 100,
        saldo: Math.round(data.saldo * 100) / 100,
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
  }, [movimientosFiltrados, monedaVista])

  const acumuladoPorDia = useMemo(() => {
    let acumulado = 0
    return flujoPorDia.map((d) => {
      acumulado += d.saldo
      return {
        ...d,
        acumulado: Math.round(acumulado * 100) / 100,
      }
    })
  }, [flujoPorDia])

  const categoriasChart = useMemo(() => {
    const byCategoria = new Map<string, number>()

    movimientosFiltrados
      .filter((m) => m.estado === 'pagado')
      .forEach((m) => {
        const valor = monedaVista === 'USD' ? m.monto_usd : m.monto_bs
        const existing = byCategoria.get(m.categoria) || 0
        byCategoria.set(m.categoria, existing + valor)
      })

    return Array.from(byCategoria.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [movimientosFiltrados, monedaVista])

  const porCategoria = useMemo(() => {
    const byCategoria = new Map<string, { categoria: string; ingresos: number; egresos: number }>()

    movimientosFiltrados
      .filter((m) => m.estado === 'pagado')
      .forEach((m) => {
        const valor = monedaVista === 'USD' ? m.monto_usd : m.monto_bs
        const existing = byCategoria.get(m.categoria) || {
          categoria: m.categoria,
          ingresos: 0,
          egresos: 0,
        }

        if (m.tipo === 'ingreso') {
          existing.ingresos += valor
        } else {
          existing.egresos += valor
        }

        byCategoria.set(m.categoria, existing)
      })

    return Array.from(byCategoria.values()).map((r) => ({
      ...r,
      ingresos: Math.round(r.ingresos * 100) / 100,
      egresos: Math.round(r.egresos * 100) / 100,
    }))
  }, [movimientosFiltrados, monedaVista])

  const egresosNomina = useMemo(() => {
    return egresos
      .filter((e) => e.categoria === 'nomina' && e.estado === 'pagado')
      .filter((e) => {
        const monedaMetodo = normalizeMoneda(
          e.metodo_pago_v2?.moneda || e.metodo_pago_v2?.cartera?.moneda || e.moneda || 'USD'
        )

        const carteraCodigo = e.metodo_pago_v2?.cartera?.codigo || ''

        if (monedaFiltro !== 'todas') {
          const filtroNormalizado = normalizeMoneda(monedaFiltro)
          if (monedaMetodo !== filtroNormalizado) return false
        }

        if (carteraFiltro !== 'todas' && carteraCodigo !== carteraFiltro) return false

        return true
      })
      .map((e) => ({
        id: e.id,
        fecha: e.fecha,
        profesional: e.empleados?.nombre || e.proveedor || '—',
        concepto: e.concepto,
        moneda: e.moneda || 'USD',
        monto: e.monto,
        equivalente_usd: Number(e.monto_equivalente_usd || 0),
        equivalente_bs: Number(e.monto_equivalente_bs || 0),
        cartera: e.metodo_pago_v2?.cartera?.nombre || 'Sin cartera',
        metodo: e.metodo_pago_v2?.nombre || '—',
      }))
  }, [egresos, monedaFiltro, carteraFiltro])

  const categoriasUnicas = useMemo(() => {
    const cats = new Set<string>()
    movimientos.forEach((m) => cats.add(m.categoria))
    return Array.from(cats).sort()
  }, [movimientos])

  const carterasDisponibles = useMemo(() => {
    const map = new Map<string, { codigo: string; nombre: string; moneda: string }>()

    movimientos.forEach((m) => {
      if (!m.cartera_codigo) return

      const monedaNormalizada = normalizeMoneda(m.moneda_metodo)

      if (monedaFiltro !== 'todas') {
        const filtroNormalizado = normalizeMoneda(monedaFiltro)
        if (monedaNormalizada !== filtroNormalizado) return
      }

      if (!map.has(m.cartera_codigo)) {
        map.set(m.cartera_codigo, {
          codigo: m.cartera_codigo,
          nombre: m.cartera,
          moneda: monedaNormalizada,
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [movimientos, monedaFiltro])

  const subcarterasVisibles = useMemo(() => {
    const target = monedaVista === 'USD' ? 'USD' : 'VES'
    return subcarteras.filter((item) => normalizeMoneda(item.moneda) === target)
  }, [subcarteras, monedaVista])

  const saldoTotalSubcarteras = useMemo(() => {
    return subcarterasVisibles.reduce((acc, item) => acc + Number(item.saldo_actual || 0), 0)
  }, [subcarterasVisibles])

  function movimientosDeSubcartera(item: MetodoSubcartera) {
    const monedaItem = normalizeMoneda(item.moneda)
    const codigoMetodo = normalizeText(item.metodo_codigo)
    const nombreMetodo = normalizeText(item.metodo_nombre)

    return movimientos
      .filter((m) => {
        if (normalizeMoneda(m.moneda_metodo) !== monedaItem) return false
        if (item.cartera_codigo && m.cartera_codigo !== item.cartera_codigo) return false

        const metodoMov = normalizeText(m.metodo)
        const carteraMov = normalizeText(m.cartera)

        return (
          metodoMov === nombreMetodo ||
          metodoMov === codigoMetodo ||
          metodoMov.includes(nombreMetodo) ||
          nombreMetodo.includes(metodoMov) ||
          carteraMov === normalizeText(item.cartera_nombre)
        )
      })
  }

  function setPaginaSubcartera(id: string, page: number) {
    setSubcarteraPaginas((prev) => ({ ...prev, [id]: Math.max(1, page) }))
  }

  const styles = getCurrencyStyles(monedaVista)

  if (error) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <p className="text-sm text-rose-400">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="space-y-5 border-b border-white/10 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm text-white/55">Finanzas</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
              Resumen Financiero
            </h1>
            <p className="mt-2 text-sm text-white/55">
              Vista general del período {fechaInicio} al {fechaFin}
            </p>
          </div>
        </div>

        <div className="max-w-sm rounded-[24px] border border-white/10 bg-[#080b17] p-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setMonedaVista('USD')}
              className={`flex min-h-[76px] items-center justify-center gap-3 rounded-[18px] border text-2xl font-semibold transition ${
                monedaVista === 'USD'
                  ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.15)]'
                  : 'border-transparent bg-transparent text-white/70 hover:bg-white/[0.03]'
              }`}
            >
              <span className="text-2xl">💵</span>
              <span>USD</span>
            </button>

            <button
              type="button"
              onClick={() => setMonedaVista('BS')}
              className={`flex min-h-[76px] items-center justify-center gap-3 rounded-[18px] border text-2xl font-semibold transition ${
                monedaVista === 'BS'
                  ? 'border-amber-400/40 bg-amber-500/20 text-amber-300 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.15)]'
                  : 'border-transparent bg-transparent text-white/70 hover:bg-white/[0.03]'
              }`}
            >
              <span className="text-2xl">💰</span>
              <span>BS</span>
            </button>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-white/80">
                Subcarteras {monedaVista === 'USD' ? 'USD' : 'BS'}
              </p>
              <p className="text-xs text-white/45">Métodos disponibles con su saldo actual.</p>
            </div>

            <div className={`rounded-2xl border px-4 py-3 ${styles.soft}`}>
              <p className="text-xs text-white/45">Saldo total</p>
              <p className={`mt-1 text-lg font-bold ${styles.amount}`}>
                {money(saldoTotalSubcarteras, monedaVista === 'USD' ? 'USD' : 'VES')}
              </p>
            </div>
          </div>

          {subcarterasVisibles.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-sm text-white/55">
              No hay subcarteras activas para esta moneda.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {subcarterasVisibles.map((item) => {
                const abierta = subcarteraAbiertaId === item.id
                const movs = movimientosDeSubcartera(item)
                const paginaActual = subcarteraPaginas[item.id] || 1
                const totalPaginas = Math.max(1, Math.ceil(movs.length / MOVIMIENTOS_POR_SUBCARTERA))
                const paginaSegura = Math.min(paginaActual, totalPaginas)
                const desdeMov = (paginaSegura - 1) * MOVIMIENTOS_POR_SUBCARTERA
                const hastaMov = desdeMov + MOVIMIENTOS_POR_SUBCARTERA
                const movsPagina = movs.slice(desdeMov, hastaMov)

                return (
                  <div
                    key={item.id}
                    className={`overflow-hidden rounded-[22px] border bg-[#090d1b] transition ${
                      abierta
                        ? `${styles.active} shadow-[0_0_0_1px_rgba(255,255,255,0.04)]`
                        : 'border-white/10 hover:border-white/20 hover:bg-[#0c1120]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSubcarteraAbiertaId(abierta ? null : item.id)
                        setPaginaSubcartera(item.id, 1)
                      }}
                      className="w-full p-3 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 text-base"
                            style={{
                              backgroundColor: item.cartera_color
                                ? `${item.cartera_color}22`
                                : 'rgba(255,255,255,0.04)',
                            }}
                          >
                            {getMetodoEmoji(item.metodo_codigo, item.moneda)}
                          </div>

                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-sm font-semibold text-white">
                                {item.metodo_nombre}
                              </p>
                              {abierta ? (
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-[10px] ${styles.badge}`}
                                >
                                  activo
                                </span>
                              ) : null}
                            </div>
                            <p className="truncate text-[10px] leading-tight text-white/45">{item.cartera_nombre}</p>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium ${styles.badge}`}
                        >
                          {item.moneda === 'USD' ? 'USD' : 'BS'}
                        </span>
                      </div>

                      <div className="mt-2.5 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-white/35">
                            Saldo actual
                          </p>
                          <p className={`mt-0.5 text-lg font-bold ${styles.amount}`}>
                            {money(
                              Number(item.saldo_actual || 0),
                              monedaVista === 'USD' ? 'USD' : 'VES'
                            )}
                          </p>
                        </div>

                        <div className="text-right text-[11px] text-white/40">
                          <p>{item.tipo || 'otro'}</p>
                          <p className="uppercase">{item.metodo_codigo}</p>
                        </div>
                      </div>
                    </button>

                    {abierta ? (
                      <div className="border-t border-white/10 bg-black/10 px-3 pb-3 pt-2.5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-[11px] font-medium text-white/65">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                monedaVista === 'USD' ? 'bg-emerald-400' : 'bg-amber-300'
                              }`}
                            />
                            Movimientos del período
                          </div>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/50">
                            {movs.length === 0
                              ? '0 mov.'
                              : `${desdeMov + 1}-${Math.min(hastaMov, movs.length)} de ${movs.length}`}
                          </span>
                        </div>

                        {movs.length === 0 ? (
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/45">
                            Sin movimientos entre {fechaInicio} y {fechaFin}.
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {movsPagina.map((m) => {
                              const valor = monedaVista === 'USD' ? m.monto_usd : m.monto_bs

                              return (
                                <div
                                  key={`${m.tipo}-${m.id}`}
                                  className="rounded-xl border border-white/10 bg-white/[0.025] px-2.5 py-1.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span
                                          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${tipoBadge(
                                            m.tipo
                                          )}`}
                                        >
                                          {m.tipo}
                                        </span>
                                        <span
                                          className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${estadoBadge(
                                            m.estado
                                          )}`}
                                        >
                                          {m.estado}
                                        </span>
                                        <span className="text-[10px] text-white/40">{shortDate(m.fecha)}</span>
                                      </div>
                                      <p className="mt-0.5 truncate text-[11px] font-semibold leading-tight text-white">
                                        {m.concepto || m.categoria}
                                      </p>
                                      <p className="truncate text-[10px] leading-tight text-white/45">
                                        {m.tercero} · {m.categoria}
                                      </p>
                                    </div>

                                    <p
                                      className={`shrink-0 text-right text-[11px] font-bold ${
                                        m.tipo === 'ingreso' ? styles.amount : 'text-rose-300'
                                      }`}
                                    >
                                      {m.tipo === 'egreso' ? '-' : '+'}
                                      {money(Math.abs(valor), monedaVista === 'USD' ? 'USD' : 'VES')}
                                    </p>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {movs.length > MOVIMIENTOS_POR_SUBCARTERA ? (
                          <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
                            <button
                              type="button"
                              disabled={paginaSegura <= 1}
                              onClick={(e) => {
                                e.stopPropagation()
                                setPaginaSubcartera(item.id, paginaSegura - 1)
                              }}
                              className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-white/65 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              ← Anterior
                            </button>
                            <span className="text-[10px] text-white/45">
                              Página {paginaSegura} / {totalPaginas}
                            </span>
                            <button
                              type="button"
                              disabled={paginaSegura >= totalPaginas}
                              onClick={(e) => {
                                e.stopPropagation()
                                setPaginaSubcartera(item.id, paginaSegura + 1)
                              }}
                              className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-white/65 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              Siguiente →
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-4">
        <Link
          href="/admin/cobranzas"
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10 active:scale-95"
        >
          <span>📊</span> Cobranzas
        </Link>

        <Link
          href="/admin/finanzas/inventario"
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10 active:scale-95"
        >
          <span>📦</span> Inventario
        </Link>

        <Link
          href="/admin/finanzas/ingresos"
          className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-6 py-3 text-sm font-medium text-emerald-400 transition hover:bg-emerald-400/10 active:scale-95"
        >
          <span>➕</span> Nuevo Ingreso
        </Link>

        <Link
          href="/admin/finanzas/egresos"
          className="flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/5 px-6 py-3 text-sm font-medium text-rose-400 transition hover:bg-rose-400/10 active:scale-95"
        >
          <span>➖</span> Nuevo Egreso
        </Link>
      </div>

      <SectionCard title="Filtros">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Desde">
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Hasta">
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Buscar">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Concepto, cliente, cartera..."
              className={inputCls}
            />
          </Field>

          <Field label="Tipo">
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value as 'todos' | 'ingreso' | 'egreso')}
              className={inputCls}
            >
              <option value="todos" className="bg-[#11131a]">
                Todos
              </option>
              <option value="ingreso" className="bg-[#11131a]">
                Ingresos
              </option>
              <option value="egreso" className="bg-[#11131a]">
                Egresos
              </option>
            </select>
          </Field>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Estado">
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className={inputCls}
            >
              <option value="todos" className="bg-[#11131a]">
                Todos
              </option>
              <option value="pagado" className="bg-[#11131a]">
                Pagado
              </option>
              <option value="pendiente" className="bg-[#11131a]">
                Pendiente
              </option>
              <option value="anulado" className="bg-[#11131a]">
                Anulado
              </option>
            </select>
          </Field>

          <Field label="Categoría">
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className={inputCls}
            >
              <option value="todos" className="bg-[#11131a]">
                Todas
              </option>
              {categoriasUnicas.map((cat) => (
                <option key={cat} value={cat} className="bg-[#11131a]">
                  {cat}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Moneda">
            <select
              value={monedaFiltro}
              onChange={(e) => {
                setMonedaFiltro(e.target.value as 'todas' | 'USD' | 'VES' | 'BS')
                setCarteraFiltro('todas')
              }}
              className={inputCls}
            >
              <option value="todas" className="bg-[#11131a]">
                Todas
              </option>
              <option value="USD" className="bg-[#11131a]">
                USD
              </option>
              <option value="VES" className="bg-[#11131a]">
                VES / BS
              </option>
            </select>
          </Field>

          <Field label="Cartera">
            <select
              value={carteraFiltro}
              onChange={(e) => setCarteraFiltro(e.target.value)}
              className={inputCls}
            >
              <option value="todas" className="bg-[#11131a]">
                Todas
              </option>
              {carterasDisponibles.map((c) => (
                <option key={c.codigo} value={c.codigo} className="bg-[#11131a]">
                  {c.nombre} · {c.moneda}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={`Ingresos ${monedaVista}`}
          value={money(
            monedaVista === 'USD' ? totales.ingresosUsd : totales.ingresosBs,
            monedaVista === 'USD' ? 'USD' : 'VES'
          )}
          color="text-emerald-400"
        />

        <StatCard
          title={`Egresos ${monedaVista}`}
          value={money(
            monedaVista === 'USD' ? totales.egresosUsd : totales.egresosBs,
            monedaVista === 'USD' ? 'USD' : 'VES'
          )}
          color="text-rose-400"
        />

        <StatCard
          title={`Utilidad ${monedaVista}`}
          value={money(
            monedaVista === 'USD' ? totales.utilidadUsd : totales.utilidadBs,
            monedaVista === 'USD' ? 'USD' : 'VES'
          )}
          color={
            (monedaVista === 'USD' ? totales.utilidadUsd : totales.utilidadBs) >= 0
              ? 'text-emerald-400'
              : 'text-rose-400'
          }
        />

        <StatCard
          title={`Flujo de caja ${monedaVista}`}
          value={money(
            monedaVista === 'USD' ? totales.flujoCajaUsd : totales.flujoCajaBs,
            monedaVista === 'USD' ? 'USD' : 'VES'
          )}
          color={
            (monedaVista === 'USD' ? totales.flujoCajaUsd : totales.flujoCajaBs) >= 0
              ? 'text-violet-400'
              : 'text-amber-400'
          }
        />
      </div>

      {comisiones.length > 0 && (
        <SectionCard
          title="Comisiones pendientes"
          description="Compromiso con profesionales que afecta el flujo de caja"
        >
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {comisiones.map((c) => (
              <div
                key={c.empleado_id}
                className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-white">{c.nombre}</p>
                  <span className="text-xs text-white/45">{c.cantidad} reg.</span>
                </div>

                <div className="mt-2 space-y-0.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/55">Base USD:</span>
                    <span className="text-white">{money(c.total_base_usd)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/55">Base Bs:</span>
                    <span className="text-white">{money(c.total_base_bs, 'VES')}</span>
                  </div>
                </div>

                <div className="mt-2 border-t border-white/10 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-400">Profesional USD:</span>
                    <span className="font-semibold text-emerald-400">
                      {money(c.total_profesional_usd)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-amber-300">Profesional Bs:</span>
                    <span className="font-semibold text-amber-300">
                      {money(c.total_profesional_bs, 'VES')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {egresosNomina.length > 0 && (
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
          <div className="border-b border-white/10 p-6">
            <h2 className="text-lg font-semibold text-white">Egresos por nómina</h2>
            <p className="mt-1 text-sm text-white/55">Pagos realizados al personal</p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03]">
                <tr className="text-left text-white/55">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Profesional</th>
                  <th className="px-4 py-3 font-medium">Concepto</th>
                  <th className="px-4 py-3 font-medium">Método</th>
                  <th className="px-4 py-3 font-medium">Cartera</th>
                  <th className="px-4 py-3 font-medium">Moneda</th>
                  <th className="px-4 py-3 font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">USD</th>
                  <th className="px-4 py-3 font-medium">Bs</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {egresosNomina.map((e) => (
                  <tr key={e.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-white/75">{e.fecha}</td>
                    <td className="px-4 py-3 text-white">{e.profesional}</td>
                    <td className="px-4 py-3 text-white/75">{e.concepto}</td>
                    <td className="px-4 py-3 text-white/75">{e.metodo}</td>
                    <td className="px-4 py-3 text-white/75">{e.cartera}</td>
                    <td className="px-4 py-3 text-white/75">{e.moneda}</td>
                    <td className="px-4 py-3 text-white/75">
                      {money(e.monto, e.moneda === 'VES' || e.moneda === 'BS' ? 'VES' : 'USD')}
                    </td>
                    <td className="px-4 py-3 text-white/75">{money(e.equivalente_usd)}</td>
                    <td className="px-4 py-3 text-white/75">{money(e.equivalente_bs, 'VES')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title={`Flujo de caja acumulado (${monedaVista})`}
          description="Evolución del saldo día a día en el período"
        >
          <div className="h-80">
            {acumuladoPorDia.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-white/55">Sin datos</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={acumuladoPorDia}>
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
            )}
          </div>
        </SectionCard>

        <SectionCard
          title={`Ingresos vs Egresos (${monedaVista})`}
          description="Comparación diaria en el período"
        >
          <div className="h-80">
            {flujoPorDia.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-white/55">Sin datos</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flujoPorDia}>
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
                  <Legend />
                  <Bar dataKey="ingresos" fill="#34d399" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="egresos" fill="#f87171" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title={`Distribución por categoría (${monedaVista})`}
          description="Top 6 categorías con mayor volumen"
        >
          <div className="h-80">
            {categoriasChart.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-white/55">Sin datos</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoriasChart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                  >
                    {categoriasChart.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => money(Number(v), monedaVista === 'USD' ? 'USD' : 'VES')}
                    contentStyle={{
                      background: '#11131a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 16,
                      color: '#fff',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title={`Detalle por categoría (${monedaVista})`}
          description="Balance de ingresos y egresos"
        >
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {porCategoria.length === 0 ? (
              <p className="text-sm text-white/55">Sin datos</p>
            ) : (
              porCategoria.map((r) => (
                <div
                  key={r.categoria}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-3"
                >
                  <p className="font-medium text-white">{r.categoria}</p>

                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-emerald-400">Ingresos</span>
                    <span className="text-white">
                      {money(r.ingresos, monedaVista === 'USD' ? 'USD' : 'VES')}
                    </span>
                  </div>

                  <div className="mt-1 flex justify-between text-sm">
                    <span className="text-rose-400">Egresos</span>
                    <span className="text-white">
                      {money(r.egresos, monedaVista === 'USD' ? 'USD' : 'VES')}
                    </span>
                  </div>

                  <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-sm font-semibold">
                    <span className="text-white/75">Balance</span>
                    <span
                      className={r.ingresos - r.egresos >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                    >
                      {money(r.ingresos - r.egresos, monedaVista === 'USD' ? 'USD' : 'VES')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <div className="border-b border-white/10 p-6">
          <h2 className="text-lg font-semibold text-white">Movimientos</h2>
          <p className="mt-1 text-sm text-white/55">
            Listado del período ({movimientosFiltrados.length} registros)
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr className="text-left text-white/55">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium">Tercero</th>
                <th className="px-4 py-3 font-medium">Método</th>
                <th className="px-4 py-3 font-medium">Cartera</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">USD</th>
                <th className="px-4 py-3 font-medium">Bs</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-white/55">
                    Cargando...
                  </td>
                </tr>
              ) : movimientosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-white/55">
                    Sin movimientos para los filtros seleccionados
                  </td>
                </tr>
              ) : (
                movimientosFiltrados.map((r) => (
                  <tr key={`${r.tipo}-${r.id}`} className="transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-white/75">{r.fecha}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tipoBadge(
                          r.tipo
                        )}`}
                      >
                        {r.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-white">{r.concepto}</td>
                    <td className="px-4 py-3 text-white/75">{r.categoria}</td>
                    <td className="px-4 py-3 text-white/75">{r.tercero}</td>
                    <td className="px-4 py-3 text-white/75">{r.metodo}</td>
                    <td className="px-4 py-3 text-white/75">{r.cartera}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(
                          r.estado
                        )}`}
                      >
                        {r.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          r.tipo === 'ingreso' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {r.tipo === 'ingreso' ? '+' : '-'}
                        {money(r.monto_usd)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white/75">{money(r.monto_bs, 'VES')}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}