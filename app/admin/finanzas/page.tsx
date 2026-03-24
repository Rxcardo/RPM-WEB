'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts'

type Pago = { id: string; fecha: string; concepto: string; categoria: string; monto: number; estado: string; tipo_origen: string; created_at?: string; clientes: { nombre: string } | null; metodos_pago: { nombre: string } | null }
type Egreso = { id: string; fecha: string; concepto: string; categoria: string; monto: number; estado: string; proveedor: string | null; created_at?: string; metodos_pago: { nombre: string } | null }
type ComisionResumen = { empleado_id: string; nombre: string; total_base: number; total_profesional: number; total_rpm: number; cantidad: number }

const PIE_COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#94a3b8']

const inputCls = `w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]`

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/75">{label}</label>
      {children}
    </div>
  )
}

function money(v: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(v || 0))
}

function todayISO() { return new Date().toISOString().slice(0, 10) }
function firstDayOfMonthISO() { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10) }

function shortDate(v: string) {
  try { return new Date(v).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) } catch { return v }
}

function estadoBadge(e: string) {
  if (e === 'pagado') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
  if (e === 'anulado') return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
  if (e === 'pendiente') return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
  return 'border-white/10 bg-white/[0.05] text-white/70'
}

function tipoBadge(t: 'ingreso' | 'egreso') {
  return t === 'ingreso' ? 'border-sky-400/20 bg-sky-400/10 text-sky-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-300'
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
  const [comisiones, setComisiones] = useState<ComisionResumen[]>([])

  useEffect(() => { void loadFinanzas() }, [])

  async function loadFinanzas() {
    try {
      setLoading(true)
      setError('')

      const [pagosRes, egresosRes, comisionesRes] = await Promise.all([
        supabase.from('pagos').select(`id, fecha, concepto, categoria, monto, estado, tipo_origen, created_at, clientes:cliente_id ( nombre ), metodos_pago:metodo_pago_id ( nombre )`)
          .gte('fecha', fechaInicio).lte('fecha', fechaFin).order('fecha', { ascending: false }).order('created_at', { ascending: false }),

        supabase.from('egresos').select(`id, fecha, concepto, categoria, monto, estado, proveedor, created_at, metodos_pago:metodo_pago_id ( nombre )`)
          .gte('fecha', fechaInicio).lte('fecha', fechaFin).order('fecha', { ascending: false }),

        // ✅ Comisiones pendientes del período - agrupadas por empleado
        supabase.from('comisiones_detalle')
          .select(`empleado_id, base, profesional, rpm, empleados:empleado_id ( nombre )`)
          .gte('fecha', fechaInicio).lte('fecha', fechaFin).eq('estado', 'pendiente'),
      ])

      if (pagosRes.error) throw pagosRes.error
      if (egresosRes.error) throw egresosRes.error

      setPagos((pagosRes.data || []) as unknown as Pago[])
      setEgresos((egresosRes.data || []) as unknown as Egreso[])

      // Agrupar comisiones por empleado
      const comisionesData = comisionesRes.data || []
      const mapa = new Map<string, ComisionResumen>()
      for (const c of comisionesData as any[]) {
        const empId = c.empleado_id
        const nombre = c.empleados?.nombre || 'Sin nombre'
        const prev = mapa.get(empId) || { empleado_id: empId, nombre, total_base: 0, total_profesional: 0, total_rpm: 0, cantidad: 0 }
        prev.total_base += Number(c.base || 0)
        prev.total_profesional += Number(c.profesional || 0)
        prev.total_rpm += Number(c.rpm || 0)
        prev.cantidad += 1
        mapa.set(empId, prev)
      }
      setComisiones(Array.from(mapa.values()))
    } catch (err: any) {
      setError(err.message || 'Error cargando finanzas.')
    } finally {
      setLoading(false)
    }
  }

  const movimientos = useMemo(() => {
    const ingresos = pagos.map((r) => ({ id: r.id, fecha: r.fecha, tipo: 'ingreso' as const, concepto: r.concepto, categoria: r.categoria || 'general', tercero: r.clientes?.nombre || 'Sin cliente', metodo: r.metodos_pago?.nombre || '—', estado: r.estado, monto: Number(r.monto || 0), created_at: r.created_at }))
    const salidas = egresos.map((r) => ({ id: r.id, fecha: r.fecha, tipo: 'egreso' as const, concepto: r.concepto, categoria: r.categoria || 'operativo', tercero: r.proveedor || 'Sin proveedor', metodo: r.metodos_pago?.nombre || '—', estado: r.estado, monto: Number(r.monto || 0), created_at: r.created_at }))
    return [...ingresos, ...salidas].sort((a, b) => `${a.fecha} ${a.created_at || ''}` < `${b.fecha} ${b.created_at || ''}` ? 1 : -1)
  }, [pagos, egresos])

  const categoriasDisponibles = useMemo(() => {
    const set = new Set(movimientos.map((r) => r.categoria).filter(Boolean))
    return Array.from(set).sort()
  }, [movimientos])

  const movimientosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    return movimientos.filter((r) => {
      const matchSearch = !q || r.concepto.toLowerCase().includes(q) || r.categoria.toLowerCase().includes(q) || r.tercero.toLowerCase().includes(q) || r.metodo.toLowerCase().includes(q)
      const matchTipo = tipoFiltro === 'todos' || r.tipo === tipoFiltro
      const matchEstado = estadoFiltro === 'todos' || r.estado === estadoFiltro
      const matchCat = categoriaFiltro === 'todos' || r.categoria === categoriaFiltro
      return matchSearch && matchTipo && matchEstado && matchCat
    })
  }, [movimientos, search, tipoFiltro, estadoFiltro, categoriaFiltro])

  const resumen = useMemo(() => {
    const ingresosPagados = pagos.filter((x) => x.estado === 'pagado').reduce((a, x) => a + Number(x.monto || 0), 0)
    const egresosPagados = egresos.filter((x) => x.estado === 'pagado').reduce((a, x) => a + Number(x.monto || 0), 0)
    const ingresosPendientes = pagos.filter((x) => x.estado === 'pendiente').reduce((a, x) => a + Number(x.monto || 0), 0)
    const totalComisionesProfesional = comisiones.reduce((a, c) => a + c.total_profesional, 0)
    const totalComisionesRpm = comisiones.reduce((a, c) => a + c.total_rpm, 0)
    return { ingresos: ingresosPagados, egresos: egresosPagados, balance: ingresosPagados - egresosPagados, ingresosPendientes, totalComisionesProfesional, totalComisionesRpm }
  }, [pagos, egresos, comisiones])

  const cajaDia = useMemo(() => {
    const hoy = todayISO()
    const ingresosHoy = pagos.filter((x) => x.fecha === hoy && x.estado === 'pagado').reduce((a, x) => a + Number(x.monto || 0), 0)
    const egresosHoy = egresos.filter((x) => x.fecha === hoy && x.estado === 'pagado').reduce((a, x) => a + Number(x.monto || 0), 0)
    return { ingresosHoy, egresosHoy, balanceHoy: ingresosHoy - egresosHoy }
  }, [pagos, egresos])

  const flujoPorDia = useMemo(() => {
    const map = new Map<string, { fecha: string; ingresos: number; egresos: number }>()
    for (const p of pagos.filter((x) => x.estado === 'pagado')) { const k = p.fecha; const v = map.get(k) || { fecha: k, ingresos: 0, egresos: 0 }; v.ingresos += Number(p.monto || 0); map.set(k, v) }
    for (const e of egresos.filter((x) => x.estado === 'pagado')) { const k = e.fecha; const v = map.get(k) || { fecha: k, ingresos: 0, egresos: 0 }; v.egresos += Number(e.monto || 0); map.set(k, v) }
    return Array.from(map.values()).sort((a, b) => a.fecha.localeCompare(b.fecha)).map((r) => ({ ...r, label: shortDate(r.fecha) }))
  }, [pagos, egresos])

  const porCategoria = useMemo(() => {
    const map = new Map<string, { categoria: string; ingresos: number; egresos: number }>()
    for (const p of pagos.filter((x) => x.estado === 'pagado')) { const k = p.categoria || 'general'; const v = map.get(k) || { categoria: k, ingresos: 0, egresos: 0 }; v.ingresos += Number(p.monto || 0); map.set(k, v) }
    for (const e of egresos.filter((x) => x.estado === 'pagado')) { const k = e.categoria || 'operativo'; const v = map.get(k) || { categoria: k, ingresos: 0, egresos: 0 }; v.egresos += Number(e.monto || 0); map.set(k, v) }
    return Array.from(map.values()).sort((a, b) => (b.ingresos + b.egresos) - (a.ingresos + a.egresos))
  }, [pagos, egresos])

  const categoriasChart = useMemo(() => porCategoria.slice(0, 6).map((r) => ({ name: r.categoria, value: r.ingresos + r.egresos })).filter((r) => r.value > 0), [porCategoria])

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Finanzas</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Resumen financiero</h1>
          <p className="mt-2 text-sm text-white/55">Control de ingresos, egresos, comisiones y balance del período.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ActionCard title="Ingresos" description="Pagos y cobros." href="/admin/finanzas/ingresos" />
          <ActionCard title="Egresos" description="Gastos y salidas." href="/admin/finanzas/egresos" />
          <ActionCard title="Comisiones" description="Comisiones del equipo." href="/admin/finanzas/comisiones" />
          <ActionCard title="Por cobrar" description="Pendientes." href="/admin/finanzas/cuentas-por-cobrar" />
        </div>
      </div>

      {error && <Card className="p-4"><p className="text-sm font-medium text-rose-400">Error</p><p className="mt-1 text-sm text-white/55">{error}</p></Card>}

      {/* Filtros */}
      <Section title="Filtros" description="Ajusta el período, tipo, estado y categoría.">
        <div className="grid gap-3 md:grid-cols-6">
          <Field label="Desde"><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={inputCls} /></Field>
          <Field label="Hasta"><input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className={inputCls} /></Field>
          <Field label="Tipo">
            <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as any)} className={inputCls}>
              <option value="todos" className="bg-[#11131a]">Todos</option>
              <option value="ingreso" className="bg-[#11131a]">Ingresos</option>
              <option value="egreso" className="bg-[#11131a]">Egresos</option>
            </select>
          </Field>
          <Field label="Estado">
            <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className={inputCls}>
              <option value="todos" className="bg-[#11131a]">Todos</option>
              <option value="pagado" className="bg-[#11131a]">Pagado</option>
              <option value="pendiente" className="bg-[#11131a]">Pendiente</option>
              <option value="anulado" className="bg-[#11131a]">Anulado</option>
            </select>
          </Field>
          <Field label="Categoría">
            <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className={inputCls}>
              <option value="todos" className="bg-[#11131a]">Todas</option>
              {categoriasDisponibles.map((c) => <option key={c} value={c} className="bg-[#11131a]">{c}</option>)}
            </select>
          </Field>
          <Field label="Buscar"><input type="text" placeholder="Concepto, cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls} /></Field>
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={loadFinanzas} className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12]">Actualizar</button>
          <button onClick={() => { setFechaInicio(firstDayOfMonthISO()); setFechaFin(todayISO()); setSearch(''); setTipoFiltro('todos'); setEstadoFiltro('todos'); setCategoriaFiltro('todos') }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]">Limpiar</button>
        </div>
      </Section>

      {/* Stats principales */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Ingresos" value={loading ? '...' : money(resumen.ingresos)} color="text-emerald-400" />
        <StatCard title="Egresos" value={loading ? '...' : money(resumen.egresos)} color="text-rose-400" />
        <StatCard title="Balance" value={loading ? '...' : money(resumen.balance)} color={resumen.balance >= 0 ? 'text-white' : 'text-rose-400'} />
        <StatCard title="Por cobrar" value={loading ? '...' : money(resumen.ingresosPendientes)} color="text-amber-300" />
        <StatCard title="Comisiones prof." value={loading ? '...' : money(resumen.totalComisionesProfesional)} color="text-violet-400" subtitle="Pendiente de pagar" />
        <StatCard title="Comisiones RPM" value={loading ? '...' : money(resumen.totalComisionesRpm)} color="text-sky-400" subtitle="Porción RPM" />
      </div>

      {/* Caja del día */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Ingresos hoy" value={money(cajaDia.ingresosHoy)} color="text-emerald-400" />
        <StatCard title="Egresos hoy" value={money(cajaDia.egresosHoy)} color="text-rose-400" />
        <StatCard title="Caja hoy" value={money(cajaDia.balanceHoy)} color={cajaDia.balanceHoy >= 0 ? 'text-white' : 'text-rose-400'} />
      </div>

      {/* ✅ Comisiones por entrenador */}
      {comisiones.length > 0 && (
        <Section title="Comisiones pendientes por entrenador" description="Comisiones del período aún sin facturar.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {comisiones.map((c) => (
              <Card key={c.empleado_id} className="p-4">
                <p className="font-medium text-white">{c.nombre}</p>
                <p className="mt-1 text-xs text-white/45">{c.cantidad} registro(s)</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <div><p className="text-xs text-white/35">Base</p><p className="text-white">{money(c.total_base)}</p></div>
                  <div><p className="text-xs text-white/35">Profesional</p><p className="text-emerald-400 font-medium">{money(c.total_profesional)}</p></div>
                  <div><p className="text-xs text-white/35">RPM</p><p className="text-violet-400">{money(c.total_rpm)}</p></div>
                </div>
                {/* Barra */}
                {c.total_base > 0 && (
                  <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full">
                    <div className="bg-emerald-500/70" style={{ width: `${(c.total_profesional / c.total_base) * 100}%` }} />
                    <div className="flex-1 bg-violet-500/70" />
                  </div>
                )}
              </Card>
            ))}
          </div>
        </Section>
      )}

      {/* Gráficos */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="Flujo por día" description="Ingresos vs egresos diarios.">
          <div className="h-80">
            {flujoPorDia.length === 0 ? (
              <Card className="flex h-full items-center justify-center p-4"><p className="text-sm text-white/55">Sin datos.</p></Card>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flujoPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.45)" />
                  <YAxis stroke="rgba(255,255,255,0.45)" />
                  <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ background: '#11131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="ingresos" fill="#34d399" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="egresos" fill="#f87171" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>

        <Section title="Por categoría" description="Volumen por rubro.">
          <div className="h-80">
            {categoriasChart.length === 0 ? (
              <Card className="flex h-full items-center justify-center p-4"><p className="text-sm text-white/55">Sin datos.</p></Card>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoriasChart} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}>
                    {categoriasChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => money(Number(v))} contentStyle={{ background: '#11131a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, color: '#fff' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>
      </div>

      {/* Movimientos */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Section title="Por categoría" description="Detalle por rubro.">
          <div className="space-y-3">
            {porCategoria.length === 0 ? <p className="text-sm text-white/55">Sin datos.</p> : porCategoria.map((r) => (
              <Card key={r.categoria} className="p-3">
                <p className="font-medium text-white">{r.categoria}</p>
                <div className="mt-2 flex justify-between text-sm"><span className="text-emerald-400">Ingresos</span><span className="text-white">{money(r.ingresos)}</span></div>
                <div className="mt-1 flex justify-between text-sm"><span className="text-rose-400">Egresos</span><span className="text-white">{money(r.egresos)}</span></div>
              </Card>
            ))}
          </div>
        </Section>

        <div className="xl:col-span-2">
          <Section title="Movimientos" description="Listado del período." className="p-0" contentClassName="overflow-hidden">
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
                    <th className="px-4 py-3 font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr><td colSpan={8} className="px-4 py-6 text-white/55">Cargando...</td></tr>
                  ) : movimientosFiltrados.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-6 text-white/55">Sin movimientos para los filtros seleccionados.</td></tr>
                  ) : movimientosFiltrados.map((r) => (
                    <tr key={`${r.tipo}-${r.id}`} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white/75">{r.fecha}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tipoBadge(r.tipo)}`}>{r.tipo}</span></td>
                      <td className="px-4 py-3 font-medium text-white">{r.concepto}</td>
                      <td className="px-4 py-3 text-white/75">{r.categoria}</td>
                      <td className="px-4 py-3 text-white/75">{r.tercero}</td>
                      <td className="px-4 py-3 text-white/75">{r.metodo}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(r.estado)}`}>{r.estado}</span></td>
                      <td className="px-4 py-3"><span className={`font-semibold ${r.tipo === 'ingreso' ? 'text-emerald-400' : 'text-rose-400'}`}>{r.tipo === 'ingreso' ? '+' : '-'}{money(r.monto)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
