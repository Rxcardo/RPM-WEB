'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
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
} from 'recharts'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'

type Pago = {
  id: string
  fecha: string
  concepto: string
  categoria: string
  monto: number
  estado: string
  tipo_origen: string
  created_at?: string
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
  metodos_pago: { nombre: string } | null
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
  monto: number
  created_at?: string
}

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

const PIE_COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#94a3b8']

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/75">{label}</label>
      {children}
    </div>
  )
}

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

function estadoBadge(estado: string) {
  if (estado === 'pagado') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
  if (estado === 'anulado') return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
  if (estado === 'pendiente') return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
  return 'border-white/10 bg-white/[0.05] text-white/70'
}

function tipoBadge(tipo: 'ingreso' | 'egreso') {
  if (tipo === 'ingreso') return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
  return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
}

function shortDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
  } catch {
    return value
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

  const [pagos, setPagos] = useState<Pago[]>([])
  const [egresos, setEgresos] = useState<Egreso[]>([])

  useEffect(() => {
    void loadFinanzas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadFinanzas() {
    try {
      setLoading(true)
      setError('')

      const [pagosRes, egresosRes] = await Promise.all([
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
            metodos_pago:metodo_pago_id ( nombre )
          `)
          .gte('fecha', fechaInicio)
          .lte('fecha', fechaFin)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false }),
      ])

      if (pagosRes.error) throw pagosRes.error
      if (egresosRes.error) throw egresosRes.error

      setPagos((pagosRes.data || []) as unknown as Pago[])
      setEgresos((egresosRes.data || []) as unknown as Egreso[])
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'No se pudo cargar finanzas.')
      setPagos([])
      setEgresos([])
    } finally {
      setLoading(false)
    }
  }

  const movimientos = useMemo<Movimiento[]>(() => {
    const ingresos: Movimiento[] = pagos.map((row) => ({
      id: row.id,
      fecha: row.fecha,
      tipo: 'ingreso',
      concepto: row.concepto,
      categoria: row.categoria || 'general',
      tercero: row.clientes?.nombre || 'Sin cliente',
      metodo: row.metodos_pago?.nombre || 'Sin método',
      estado: row.estado,
      monto: Number(row.monto || 0),
      created_at: row.created_at,
    }))

    const salidas: Movimiento[] = egresos.map((row) => ({
      id: row.id,
      fecha: row.fecha,
      tipo: 'egreso',
      concepto: row.concepto,
      categoria: row.categoria || 'operativo',
      tercero: row.proveedor || 'Sin proveedor',
      metodo: row.metodos_pago?.nombre || 'Sin método',
      estado: row.estado,
      monto: Number(row.monto || 0),
      created_at: row.created_at,
    }))

    return [...ingresos, ...salidas].sort((a, b) => {
      const dateA = `${a.fecha} ${a.created_at || ''}`
      const dateB = `${b.fecha} ${b.created_at || ''}`
      return dateA < dateB ? 1 : -1
    })
  }, [pagos, egresos])

  const categoriasDisponibles = useMemo(() => {
    const set = new Set<string>()
    for (const row of movimientos) {
      if (row.categoria?.trim()) set.add(row.categoria.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [movimientos])

  const movimientosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()

    return movimientos.filter((row) => {
      const matchSearch =
        !q ||
        row.concepto.toLowerCase().includes(q) ||
        row.categoria.toLowerCase().includes(q) ||
        row.tercero.toLowerCase().includes(q) ||
        row.metodo.toLowerCase().includes(q) ||
        row.tipo.toLowerCase().includes(q) ||
        row.estado.toLowerCase().includes(q)

      const matchTipo = tipoFiltro === 'todos' ? true : row.tipo === tipoFiltro
      const matchEstado = estadoFiltro === 'todos' ? true : row.estado === estadoFiltro
      const matchCategoria = categoriaFiltro === 'todos' ? true : row.categoria === categoriaFiltro

      return matchSearch && matchTipo && matchEstado && matchCategoria
    })
  }, [movimientos, search, tipoFiltro, estadoFiltro, categoriaFiltro])

  const resumen = useMemo(() => {
    const ingresosPagados = pagos
      .filter((x) => x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const egresosPagados = egresos
      .filter((x) => x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const ingresosPendientes = pagos
      .filter((x) => x.estado === 'pendiente')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const egresosPendientes = egresos
      .filter((x) => x.estado === 'pendiente')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const ingresosAnulados = pagos
      .filter((x) => x.estado === 'anulado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const egresosAnulados = egresos
      .filter((x) => x.estado === 'anulado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    return {
      ingresos: ingresosPagados,
      egresos: egresosPagados,
      balance: ingresosPagados - egresosPagados,
      ingresosCount: pagos.filter((x) => x.estado === 'pagado').length,
      egresosCount: egresos.filter((x) => x.estado === 'pagado').length,
      ingresosPendientes,
      egresosPendientes,
      ingresosAnulados,
      egresosAnulados,
    }
  }, [pagos, egresos])

  const cajaDia = useMemo(() => {
    const hoy = todayISO()

    const ingresosHoy = pagos
      .filter((x) => x.fecha === hoy && x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const egresosHoy = egresos
      .filter((x) => x.fecha === hoy && x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    return {
      ingresosHoy,
      egresosHoy,
      balanceHoy: ingresosHoy - egresosHoy,
    }
  }, [pagos, egresos])

  const porCategoria = useMemo(() => {
    const map = new Map<string, { categoria: string; ingresos: number; egresos: number }>()

    for (const row of pagos.filter((x) => x.estado === 'pagado')) {
      const key = row.categoria || 'general'
      const prev = map.get(key) || { categoria: key, ingresos: 0, egresos: 0 }
      prev.ingresos += Number(row.monto || 0)
      map.set(key, prev)
    }

    for (const row of egresos.filter((x) => x.estado === 'pagado')) {
      const key = row.categoria || 'operativo'
      const prev = map.get(key) || { categoria: key, ingresos: 0, egresos: 0 }
      prev.egresos += Number(row.monto || 0)
      map.set(key, prev)
    }

    return Array.from(map.values()).sort((a, b) => {
      const totalA = a.ingresos + a.egresos
      const totalB = b.ingresos + b.egresos
      return totalB - totalA
    })
  }, [pagos, egresos])

  const flujoPorDia = useMemo(() => {
    const map = new Map<string, { fecha: string; ingresos: number; egresos: number }>()

    for (const pago of pagos.filter((x) => x.estado === 'pagado')) {
      const key = pago.fecha
      const prev = map.get(key) || { fecha: key, ingresos: 0, egresos: 0 }
      prev.ingresos += Number(pago.monto || 0)
      map.set(key, prev)
    }

    for (const egreso of egresos.filter((x) => x.estado === 'pagado')) {
      const key = egreso.fecha
      const prev = map.get(key) || { fecha: key, ingresos: 0, egresos: 0 }
      prev.egresos += Number(egreso.monto || 0)
      map.set(key, prev)
    }

    return Array.from(map.values())
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((row) => ({
        ...row,
        label: shortDate(row.fecha),
      }))
  }, [pagos, egresos])

  const categoriasChart = useMemo(() => {
    return porCategoria
      .slice(0, 6)
      .map((row) => ({
        name: row.categoria,
        value: row.ingresos + row.egresos,
      }))
      .filter((row) => row.value > 0)
  }, [porCategoria])

  const ratioCobro = useMemo(() => {
    const totalPagos = pagos.reduce((acc, row) => acc + Number(row.monto || 0), 0)
    if (totalPagos <= 0) return 0
    return Math.round((resumen.ingresos / totalPagos) * 100)
  }, [pagos, resumen.ingresos])

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Finanzas</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Resumen financiero
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Control de ingresos, egresos, caja, balance y movimientos del período.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ActionCard
            title="Ingresos"
            description="Administrar pagos y cobros."
            href="/admin/finanzas/ingresos"
          />
          <ActionCard
            title="Egresos"
            description="Ver gastos y salidas."
            href="/admin/finanzas/egresos"
          />
          <ActionCard
            title="Comisiones"
            description="Revisar comisiones del equipo."
            href="/admin/finanzas/comisiones"
          />
          <ActionCard
            title="Cuentas por cobrar"
            description="Seguimiento de pendientes."
            href="/admin/finanzas/cuentas-por-cobrar"
          />
        </div>
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      <Section
        title="Filtros"
        description="Ajusta el período, tipo, estado y categoría."
      >
        <div className="grid gap-3 md:grid-cols-6">
          <Field label="Desde">
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className={inputClassName}
            />
          </Field>

          <Field label="Hasta">
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className={inputClassName}
            />
          </Field>

          <Field label="Tipo">
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value as 'todos' | 'ingreso' | 'egreso')}
              className={inputClassName}
            >
              <option value="todos" className="bg-[#11131a] text-white">
                Todos
              </option>
              <option value="ingreso" className="bg-[#11131a] text-white">
                Ingresos
              </option>
              <option value="egreso" className="bg-[#11131a] text-white">
                Egresos
              </option>
            </select>
          </Field>

          <Field label="Estado">
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className={inputClassName}
            >
              <option value="todos" className="bg-[#11131a] text-white">
                Todos
              </option>
              <option value="pagado" className="bg-[#11131a] text-white">
                Pagado
              </option>
              <option value="pendiente" className="bg-[#11131a] text-white">
                Pendiente
              </option>
              <option value="anulado" className="bg-[#11131a] text-white">
                Anulado
              </option>
            </select>
          </Field>

          <Field label="Categoría">
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className={inputClassName}
            >
              <option value="todos" className="bg-[#11131a] text-white">
                Todas
              </option>
              {categoriasDisponibles.map((cat) => (
                <option key={cat} value={cat} className="bg-[#11131a] text-white">
                  {cat}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Buscar">
            <input
              type="text"
              placeholder="Concepto, categoría, cliente, proveedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputClassName}
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={loadFinanzas}
            className="
              rounded-2xl border border-white/10 bg-white/[0.08]
              px-4 py-3 text-sm font-semibold text-white transition
              hover:bg-white/[0.12]
            "
          >
            Actualizar
          </button>

          <button
            onClick={() => {
              setFechaInicio(firstDayOfMonthISO())
              setFechaFin(todayISO())
              setSearch('')
              setTipoFiltro('todos')
              setEstadoFiltro('todos')
              setCategoriaFiltro('todos')
            }}
            className="
              rounded-2xl border border-white/10 bg-white/[0.03]
              px-4 py-3 text-sm font-semibold text-white/80 transition
              hover:bg-white/[0.06]
            "
          >
            Limpiar filtros
          </button>
        </div>
      </Section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          title="Ingresos del período"
          value={loading ? '...' : money(resumen.ingresos)}
          subtitle={`${resumen.ingresosCount} movimiento(s)`}
          color="text-emerald-400"
        />
        <StatCard
          title="Egresos del período"
          value={loading ? '...' : money(resumen.egresos)}
          subtitle={`${resumen.egresosCount} movimiento(s)`}
          color="text-rose-400"
        />
        <StatCard
          title="Balance"
          value={loading ? '...' : money(resumen.balance)}
          subtitle="Ingresos - egresos"
          color={resumen.balance >= 0 ? 'text-white' : 'text-rose-400'}
        />
        <StatCard
          title="Pendiente por cobrar"
          value={loading ? '...' : money(resumen.ingresosPendientes)}
          subtitle="Pagos pendientes"
          color="text-amber-300"
        />
        <StatCard
          title="Pendiente por pagar"
          value={loading ? '...' : money(resumen.egresosPendientes)}
          subtitle="Egresos pendientes"
          color="text-amber-300"
        />
        <StatCard
          title="Movimientos anulados"
          value={loading ? '...' : money(resumen.ingresosAnulados + resumen.egresosAnulados)}
          subtitle={`Ing. ${money(resumen.ingresosAnulados)} · Egr. ${money(resumen.egresosAnulados)}`}
          color="text-white"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Ingresos de hoy"
          value={loading ? '...' : money(cajaDia.ingresosHoy)}
          color="text-emerald-400"
        />
        <StatCard
          title="Egresos de hoy"
          value={loading ? '...' : money(cajaDia.egresosHoy)}
          color="text-rose-400"
        />
        <StatCard
          title="Caja de hoy"
          value={loading ? '...' : money(cajaDia.balanceHoy)}
          color={cajaDia.balanceHoy >= 0 ? 'text-white' : 'text-rose-400'}
        />
        <StatCard
          title="Ratio de cobro"
          value={`${ratioCobro}%`}
          subtitle="Pagado sobre total facturado"
          color="text-sky-400"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section
          title="Flujo por día"
          description="Comparativa diaria entre ingresos y egresos pagados."
        >
          <div className="h-80">
            {flujoPorDia.length === 0 ? (
              <Card className="flex h-full items-center justify-center p-4">
                <p className="text-sm text-white/55">No hay datos para el período seleccionado.</p>
              </Card>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flujoPorDia}>
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
                  <Bar dataKey="ingresos" fill="#34d399" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="egresos" fill="#f87171" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>

        <Section
          title="Peso por categoría"
          description="Categorías con mayor volumen financiero."
        >
          <div className="h-80">
            {categoriasChart.length === 0 ? (
              <Card className="flex h-full items-center justify-center p-4">
                <p className="text-sm text-white/55">No hay datos para el período seleccionado.</p>
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
                  >
                    {categoriasChart.map((entry, index) => (
                      <Cell
                        key={`${entry.name}-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
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
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Section
          title="Resumen por categoría"
          description="Detalle de entradas y salidas por rubro."
        >
          <div className="space-y-3">
            {porCategoria.length === 0 ? (
              <p className="text-sm text-white/55">No hay datos para el período seleccionado.</p>
            ) : (
              porCategoria.map((row) => (
                <Card key={row.categoria} className="p-3">
                  <p className="font-medium text-white">{row.categoria}</p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-emerald-400">Ingresos</span>
                    <span className="font-medium text-white">{money(row.ingresos)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-rose-400">Egresos</span>
                    <span className="font-medium text-white">{money(row.egresos)}</span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </Section>

        <div className="xl:col-span-2">
          <Section
            title="Movimientos"
            description="Listado de ingresos y egresos del período."
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
                    <th className="px-4 py-3 font-medium">Cliente / Proveedor</th>
                    <th className="px-4 py-3 font-medium">Método</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Monto</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-white/55">
                        Cargando movimientos...
                      </td>
                    </tr>
                  ) : movimientosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-white/55">
                        No hay movimientos para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    movimientosFiltrados.map((row) => (
                      <tr key={`${row.tipo}-${row.id}`} className="transition hover:bg-white/[0.03]">
                        <td className="px-4 py-3 text-white/75">{row.fecha}</td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tipoBadge(
                              row.tipo
                            )}`}
                          >
                            {row.tipo}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{row.concepto}</p>
                        </td>

                        <td className="px-4 py-3 text-white/75">{row.categoria}</td>

                        <td className="px-4 py-3 text-white/75">{row.tercero}</td>

                        <td className="px-4 py-3 text-white/75">{row.metodo}</td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(
                              row.estado
                            )}`}
                          >
                            {row.estado}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`font-semibold ${
                              row.tipo === 'ingreso' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {row.tipo === 'ingreso' ? '+' : '-'}
                            {money(row.monto)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}