'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
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
  LineChart,
  Line,
  Area,
  AreaChart,
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
  metodos_pago: { nombre: string } | null
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
  metodos_pago: { nombre: string } | null
  empleados?: { nombre: string } | null
}

type ComisionDetalle = {
  empleado_id: string
  monto_base_usd: number | null
  monto_base_bs: number | null
  monto_profesional_usd: number | null
  monto_profesional_bs: number | null
  monto_rpm_usd: number | null
  monto_rpm_bs: number | null
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
  estado: string
  moneda_origen: string
  monto_usd: number
  monto_bs: number
  created_at?: string
}

const PIE_COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#94a3b8']

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
  const [pagos, setPagos] = useState<Pago[]>([])
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [comisiones, setComisiones] = useState<ComisionResumen[]>([])

  useEffect(() => {
    void loadFinanzas()
  }, [fechaInicio, fechaFin])

  async function loadFinanzas() {
    try {
      setLoading(true)
      setError('')

      const [pagosRes, egresosRes, comisionesRes] = await Promise.all([
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
            metodos_pago:metodo_pago_id ( nombre )
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
            metodos_pago:metodo_pago_id ( nombre ),
            empleados:empleado_id ( nombre )
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
      ])

      if (pagosRes.error) throw pagosRes.error
      if (egresosRes.error) throw egresosRes.error
      if (comisionesRes.error) throw comisionesRes.error

      setPagos((pagosRes.data || []) as Pago[])
      setEgresos((egresosRes.data || []) as Egreso[])

      const comisionesRaw = (comisionesRes.data || []) as any[]
      const grouped = new Map<string, ComisionResumen>()

      comisionesRaw.forEach((c: any) => {
        const nombre = c.empleados?.nombre || 'Sin nombre'
        const existing = grouped.get(c.empleado_id)

        if (existing) {
          existing.total_base_usd += Number(c.monto_base_usd || 0)
          existing.total_base_bs += Number(c.monto_base_bs || 0)
          existing.total_profesional_usd += Number(c.monto_profesional_usd || 0)
          existing.total_profesional_bs += Number(c.monto_profesional_bs || 0)
          existing.total_rpm_usd += Number(c.monto_rpm_usd || 0)
          existing.total_rpm_bs += Number(c.monto_rpm_bs || 0)
          existing.cantidad += 1
        } else {
          grouped.set(c.empleado_id, {
            empleado_id: c.empleado_id,
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

  const totales = useMemo(() => {
    const ingresosUsd = pagos
      .filter((p) => p.estado === 'pagado')
      .reduce((a, p) => a + Number(p.monto_equivalente_usd || 0), 0)

    const ingresosBs = pagos
      .filter((p) => p.estado === 'pagado')
      .reduce((a, p) => a + Number(p.monto_equivalente_bs || 0), 0)

    const egresosUsd = egresos
      .filter((e) => e.estado === 'pagado')
      .reduce((a, e) => a + Number(e.monto_equivalente_usd || 0), 0)

    const egresosBs = egresos
      .filter((e) => e.estado === 'pagado')
      .reduce((a, e) => a + Number(e.monto_equivalente_bs || 0), 0)

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
  }, [pagos, egresos, comisiones])

  const movimientos = useMemo(() => {
    const ingresos: Movimiento[] = pagos.map((p) => ({
      id: p.id,
      fecha: p.fecha,
      tipo: 'ingreso' as const,
      concepto: p.concepto,
      categoria: p.categoria,
      tercero: p.clientes?.nombre || '—',
      metodo: p.metodos_pago?.nombre || '—',
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
      metodo: e.metodos_pago?.nombre || '—',
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

      if (search) {
        const s = search.toLowerCase()
        return (
          m.concepto.toLowerCase().includes(s) ||
          m.tercero.toLowerCase().includes(s) ||
          m.categoria.toLowerCase().includes(s)
        )
      }

      return true
    })
  }, [movimientos, tipoFiltro, estadoFiltro, categoriaFiltro, search])

  const flujoPorDia = useMemo(() => {
    const byDate = new Map<string, { ingresos: number; egresos: number; saldo: number }>()

    movimientos
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
  }, [movimientos, monedaVista])

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

    movimientos
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
  }, [movimientos, monedaVista])

  const porCategoria = useMemo(() => {
  const byCategoria = new Map<
    string,
    { categoria: string; ingresos: number; egresos: number }
  >()

  movimientos
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
}, [movimientos, monedaVista])
  

  const egresosNomina = useMemo(() => {
    return egresos
      .filter((e) => e.categoria === 'nomina' && e.estado === 'pagado')
      .map((e) => ({
        id: e.id,
        fecha: e.fecha,
        profesional: e.empleados?.nombre || e.proveedor || '—',
        concepto: e.concepto,
        moneda: e.moneda || 'USD',
        monto: e.monto,
        equivalente_usd: Number(e.monto_equivalente_usd || 0),
        equivalente_bs: Number(e.monto_equivalente_bs || 0),
      }))
  }, [egresos])

  const categoriasUnicas = useMemo(() => {
    const cats = new Set<string>()
    movimientos.forEach((m) => cats.add(m.categoria))
    return Array.from(cats).sort()
  }, [movimientos])

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-white/55">Finanzas</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Resumen</h1>
        </div>
        <Card className="p-6">
          <p className="text-sm text-rose-400">{error}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Finanzas</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Resumen Financiero
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Vista general del período {fechaInicio} al {fechaFin}
          </p>
        </div>

        {/* Toggle de moneda */}
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
            💵 Cartera USD
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
            💰 Cartera BS
          </button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-6">
        <div className="grid gap-4 md:grid-cols-4">
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
              placeholder="Concepto, cliente, proveedor..."
              className={inputCls}
            />
          </Field>

          <Field label="Tipo">
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value as any)}
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

        <div className="mt-4 grid gap-4 md:grid-cols-2">
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
        </div>
      </Card>

      {/* Stats principales */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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

      {/* Comisiones pendientes */}
      {comisiones.length > 0 && (
        <Section
          title="Comisiones pendientes por pagar"
          description="Compromiso con profesionales que afecta el flujo de caja."
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {comisiones.map((c) => (
              <Card key={c.empleado_id} className="p-4 border-amber-400/20 bg-amber-400/5">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-white">{c.nombre}</p>
                  <span className="text-xs text-white/45">{c.cantidad} reg.</span>
                </div>

                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/55">Base USD:</span>
                    <span className="text-white">{money(c.total_base_usd)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-white/55">Base Bs:</span>
                    <span className="text-white">{money(c.total_base_bs, 'VES')}</span>
                  </div>
                </div>

                <div className="mt-3 border-t border-white/10 pt-3">
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

                {c.total_base_usd > 0 && (
                  <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-emerald-500/70"
                      style={{
                        width: `${(c.total_profesional_usd / c.total_base_usd) * 100}%`,
                      }}
                    />
                    <div className="flex-1 bg-violet-500/70" />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </Section>
      )}

      {/* Nómina */}
      {egresosNomina.length > 0 && (
        <Section
          title="Egresos por nómina / Quincenas"
          description="Pagos realizados al personal."
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03]">
                <tr className="text-left text-white/55">
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium">Profesional</th>
                  <th className="px-4 py-3 font-medium">Concepto</th>
                  <th className="px-4 py-3 font-medium">Moneda</th>
                  <th className="px-4 py-3 font-medium">Monto</th>
                  <th className="px-4 py-3 font-medium">Equivalente USD</th>
                  <th className="px-4 py-3 font-medium">Equivalente Bs</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {egresosNomina.map((e) => (
                  <tr key={e.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-white/75">{e.fecha}</td>
                    <td className="px-4 py-3 text-white">{e.profesional}</td>
                    <td className="px-4 py-3 text-white/75">{e.concepto}</td>
                    <td className="px-4 py-3 text-white/75">{e.moneda}</td>
                    <td className="px-4 py-3 text-white/75">
                      {money(e.monto, e.moneda === 'VES' ? 'VES' : 'USD')}
                    </td>
                    <td className="px-4 py-3 text-white/75">{money(e.equivalente_usd)}</td>
                    <td className="px-4 py-3 text-white/75">
                      {money(e.equivalente_bs, 'VES')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Gráficas mejoradas */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Flujo acumulado */}
        <Section
          title={`Flujo de caja acumulado (${monedaVista})`}
          description="Evolución del saldo día a día en el período."
        >
          <div className="h-80">
            {acumuladoPorDia.length === 0 ? (
              <Card className="flex h-full items-center justify-center p-4">
                <p className="text-sm text-white/55">Sin datos.</p>
              </Card>
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
        </Section>

        {/* Ingresos vs Egresos */}
        <Section
          title={`Ingresos vs Egresos (${monedaVista})`}
          description="Comparación diaria en el período."
        >
          <div className="h-80">
            {flujoPorDia.length === 0 ? (
              <Card className="flex h-full items-center justify-center p-4">
                <p className="text-sm text-white/55">Sin datos.</p>
              </Card>
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
        </Section>
      </div>

      {/* Categorías y balance */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Distribución por categoría */}
        <Section
          title={`Distribución por categoría (${monedaVista})`}
          description="Top 6 categorías con mayor volumen."
        >
          <div className="h-80">
            {categoriasChart.length === 0 ? (
              <Card className="flex h-full items-center justify-center p-4">
                <p className="text-sm text-white/55">Sin datos.</p>
              </Card>
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
                    label={(entry) =>
                      `${entry.name}: ${money(entry.value, monedaVista === 'USD' ? 'USD' : 'VES')}`
                    }
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
        </Section>

        {/* Detalle por categoría */}
        <Section
          title={`Detalle por categoría (${monedaVista})`}
          description="Balance de ingresos y egresos."
        >
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {porCategoria.length === 0 ? (
              <p className="text-sm text-white/55">Sin datos.</p>
            ) : (
              porCategoria.map((r) => (
                <Card key={r.categoria} className="p-3">
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
                      className={
                        r.ingresos - r.egresos >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }
                    >
                      {money(r.ingresos - r.egresos, monedaVista === 'USD' ? 'USD' : 'VES')}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </Section>
      </div>

      {/* Tabla de movimientos */}
      <Section
        title="Movimientos"
        description={`Listado del período (${movimientosFiltrados.length} registros).`}
        className="p-0"
        contentClassName="overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr className="text-left text-white/55">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium">Cliente/Proveedor</th>
                <th className="px-4 py-3 font-medium">Método</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Monto USD</th>
                <th className="px-4 py-3 font-medium">Monto Bs</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-white/55">
                    Cargando...
                  </td>
                </tr>
              ) : movimientosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-white/55">
                    Sin movimientos para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                movimientosFiltrados.map((r) => (
                  <tr key={`${r.tipo}-${r.id}`} className="transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-white/75">{r.fecha}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tipoBadge(r.tipo)}`}
                      >
                        {r.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-white">{r.concepto}</td>
                    <td className="px-4 py-3 text-white/75">{r.categoria}</td>
                    <td className="px-4 py-3 text-white/75">{r.tercero}</td>
                    <td className="px-4 py-3 text-white/75">{r.metodo}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(r.estado)}`}
                      >
                        {r.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${r.tipo === 'ingreso' ? 'text-emerald-400' : 'text-rose-400'}`}
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
      </Section>
    </div>
  )
}