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

type Empleado = {
  id: string
  nombre: string
  rol: string
  estado: string
}

type ResumenTerapeuta = {
  empleado_id: string
  empleado_nombre: string
  citas: number
  servicios_citas: number
  planes_citas: number
  base_total: number
  base_servicios: number
  base_planes: number
  rpm_total: number
  rpm_servicios: number
  rpm_planes: number
  profesional_total: number
  profesional_servicios: number
  profesional_planes: number
}

type Liquidacion = {
  id: string
  empleado_id: string
  fecha_inicio: string
  fecha_fin: string
  total_base: number
  total_rpm: number
  total_profesional: number
  porcentaje_rpm: number
  porcentaje_profesional: number
  cantidad_citas: number
  estado: 'pendiente' | 'pagado'
  notas: string | null
  created_at: string
  pagado_at: string | null
  egreso_id: string | null
  empleados: { nombre: string } | null
}

type CitaComision = {
  id: string
  fecha: string
  estado: string
  terapeuta_id: string | null
  cliente_id: string | null
  servicio_id: string | null
  empleados: { nombre: string } | null
  clientes: { nombre: string } | null
  servicios: { nombre: string; precio: number | null } | null
}

type ClientePlan = {
  id: string
  cliente_id: string
  plan_id: string
  fecha_inicio: string | null
  fecha_fin: string | null
  sesiones_totales: number | null
  sesiones_usadas: number | null
  estado: string
  planes: {
    nombre: string | null
    precio: number | null
    sesiones_totales: number | null
  } | null
}

type CitaDetalle = {
  cita_id: string
  fecha: string
  terapeuta: string
  cliente: string
  origen: 'servicio' | 'plan'
  referencia: string
  valor_base: number
  rpm: number
  profesional: number
}

const PIE_COLORS = ['#38bdf8', '#a78bfa', '#34d399', '#f59e0b', '#f87171', '#94a3b8']

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

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

function money(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function firstDayOfMonthISO() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function lastDayOfMonthISO() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
}

function getCurrentFortnight() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const day = now.getDate()

  if (day <= 15) {
    return {
      label: '1ra quincena',
      start: new Date(year, month, 1).toISOString().slice(0, 10),
      end: new Date(year, month, 15).toISOString().slice(0, 10),
    }
  }

  return {
    label: '2da quincena',
    start: new Date(year, month, 16).toISOString().slice(0, 10),
    end: new Date(year, month + 1, 0).toISOString().slice(0, 10),
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString()
  } catch {
    return value
  }
}

function estadoBadge(estado: string) {
  if (estado === 'pagado') {
    return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
  }
  return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
}

function origenBadge(origen: 'servicio' | 'plan') {
  return origen === 'plan'
    ? 'border-violet-400/20 bg-violet-400/10 text-violet-300'
    : 'border-sky-400/20 bg-sky-400/10 text-sky-300'
}

function isDateBetween(target: string, start?: string | null, end?: string | null) {
  if (!target || !start || !end) return false
  return target >= start && target <= end
}

function getPlanValuePerSession(plan: ClientePlan | null) {
  if (!plan) return 0

  const price = Number(plan.planes?.precio || 0)
  const total =
    Number(plan.sesiones_totales || 0) ||
    Number(plan.planes?.sesiones_totales || 0)

  if (price <= 0 || total <= 0) return 0
  return price / total
}

export default function ComisionesPage() {
  const [mounted, setMounted] = useState(false)

  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [citas, setCitas] = useState<CitaComision[]>([])
  const [clientePlanes, setClientePlanes] = useState<ClientePlan[]>([])
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([])

  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [empleadoId, setEmpleadoId] = useState('')
  const [porcentajeRpm, setPorcentajeRpm] = useState('40')
  const [porcentajeProfesional, setPorcentajeProfesional] = useState('60')
  const [notas, setNotas] = useState('')

  useEffect(() => {
    setMounted(true)

    const current = getCurrentFortnight()
    setFechaInicio(current.start)
    setFechaFin(current.end)
  }, [])

  useEffect(() => {
    if (!mounted || !fechaInicio || !fechaFin) return
    void loadData()
  }, [mounted, fechaInicio, fechaFin])

  async function loadData() {
    try {
      setLoading(true)
      setErrorMsg('')
      setSuccessMsg('')

      const [empleadosRes, citasRes, planesRes, liquidacionesRes] = await Promise.all([
        supabase
          .from('empleados')
          .select('id, nombre, rol, estado')
          .eq('estado', 'activo')
          .in('rol', ['terapeuta', 'fisioterapeuta', 'coach', 'entrenador'])
          .order('nombre', { ascending: true }),

        supabase
          .from('citas')
          .select(`
            id,
            fecha,
            estado,
            terapeuta_id,
            cliente_id,
            servicio_id,
            empleados:terapeuta_id ( nombre ),
            clientes:cliente_id ( nombre ),
            servicios:servicio_id ( nombre, precio )
          `)
          .in('estado', ['completada', 'confirmada'])
          .order('fecha', { ascending: false }),

        supabase
          .from('clientes_planes')
          .select(`
            id,
            cliente_id,
            plan_id,
            fecha_inicio,
            fecha_fin,
            sesiones_totales,
            sesiones_usadas,
            estado,
            planes:plan_id (
              nombre,
              precio,
              sesiones_totales
            )
          `)
          .in('estado', ['activo', 'agotado', 'vencido', 'renovado', 'cancelado'])
          .order('fecha_inicio', { ascending: false }),

        supabase
          .from('comisiones_liquidaciones')
          .select(`
            id,
            empleado_id,
            fecha_inicio,
            fecha_fin,
            total_base,
            total_rpm,
            total_profesional,
            porcentaje_rpm,
            porcentaje_profesional,
            cantidad_citas,
            estado,
            notas,
            created_at,
            pagado_at,
            egreso_id,
            empleados:empleado_id ( nombre )
          `)
          .order('created_at', { ascending: false }),
      ])

      if (empleadosRes.error) throw empleadosRes.error
      if (citasRes.error) throw citasRes.error
      if (planesRes.error) throw planesRes.error
      if (liquidacionesRes.error) throw liquidacionesRes.error

      setEmpleados((empleadosRes.data || []) as Empleado[])
      setCitas((citasRes.data || []) as unknown as CitaComision[])
      setClientePlanes((planesRes.data || []) as unknown as ClientePlan[])
      setLiquidaciones((liquidacionesRes.data || []) as unknown as Liquidacion[])
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudieron cargar las comisiones.')
      setEmpleados([])
      setCitas([])
      setClientePlanes([])
      setLiquidaciones([])
    } finally {
      setLoading(false)
    }
  }

  const currentFortnight = useMemo(() => {
    if (!mounted) {
      return {
        label: 'Quincena',
        start: '',
        end: '',
      }
    }
    return getCurrentFortnight()
  }, [mounted])

  const citasFiltradas = useMemo(() => {
    if (!fechaInicio || !fechaFin) return []
    return citas.filter((c) => {
      const matchEmpleado = !empleadoId || c.terapeuta_id === empleadoId
      const matchFecha = c.fecha >= fechaInicio && c.fecha <= fechaFin
      return matchEmpleado && matchFecha
    })
  }, [citas, empleadoId, fechaInicio, fechaFin])

  const detalleCitas = useMemo<CitaDetalle[]>(() => {
    const rpmPct = Number(porcentajeRpm || 0)
    const profPct = Number(porcentajeProfesional || 0)

    return citasFiltradas.map((row) => {
      const planAplicado =
        clientePlanes.find(
          (plan) =>
            plan.cliente_id === row.cliente_id &&
            isDateBetween(row.fecha, plan.fecha_inicio, plan.fecha_fin)
        ) || null

      const valorPlan = getPlanValuePerSession(planAplicado)
      const valorServicio = Number(row.servicios?.precio || 0)

      const origen: 'servicio' | 'plan' = planAplicado ? 'plan' : 'servicio'
      const valorBase = origen === 'plan' ? valorPlan : valorServicio

      return {
        cita_id: row.id,
        fecha: row.fecha,
        terapeuta: row.empleados?.nombre || 'Sin terapeuta',
        cliente: row.clientes?.nombre || 'Sin cliente',
        origen,
        referencia:
          origen === 'plan'
            ? planAplicado?.planes?.nombre || 'Plan'
            : row.servicios?.nombre || 'Servicio',
        valor_base: valorBase,
        rpm: (valorBase * rpmPct) / 100,
        profesional: (valorBase * profPct) / 100,
      }
    })
  }, [citasFiltradas, clientePlanes, porcentajeRpm, porcentajeProfesional])

  const resumenTerapeutas = useMemo<ResumenTerapeuta[]>(() => {
    const map = new Map<string, ResumenTerapeuta>()

    for (const row of detalleCitas) {
      const citaOriginal = citasFiltradas.find((c) => c.id === row.cita_id)
      const terapeutaId = citaOriginal?.terapeuta_id
      if (!terapeutaId) continue

      const prev = map.get(terapeutaId) || {
        empleado_id: terapeutaId,
        empleado_nombre: row.terapeuta,
        citas: 0,
        servicios_citas: 0,
        planes_citas: 0,
        base_total: 0,
        base_servicios: 0,
        base_planes: 0,
        rpm_total: 0,
        rpm_servicios: 0,
        rpm_planes: 0,
        profesional_total: 0,
        profesional_servicios: 0,
        profesional_planes: 0,
      }

      prev.citas += 1
      prev.base_total += row.valor_base
      prev.rpm_total += row.rpm
      prev.profesional_total += row.profesional

      if (row.origen === 'plan') {
        prev.planes_citas += 1
        prev.base_planes += row.valor_base
        prev.rpm_planes += row.rpm
        prev.profesional_planes += row.profesional
      } else {
        prev.servicios_citas += 1
        prev.base_servicios += row.valor_base
        prev.rpm_servicios += row.rpm
        prev.profesional_servicios += row.profesional
      }

      map.set(terapeutaId, prev)
    }

    return Array.from(map.values()).sort((a, b) =>
      a.empleado_nombre.localeCompare(b.empleado_nombre)
    )
  }, [detalleCitas, citasFiltradas])

  const resumenGeneral = useMemo(() => {
    const pendientes = liquidaciones
      .filter((x) => x.estado === 'pendiente')
      .reduce((acc, x) => acc + Number(x.total_profesional || 0), 0)

    const pagadas = liquidaciones
      .filter((x) => x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.total_profesional || 0), 0)

    const basePeriodo = resumenTerapeutas.reduce((acc, x) => acc + x.base_total, 0)
    const baseServicios = resumenTerapeutas.reduce((acc, x) => acc + x.base_servicios, 0)
    const basePlanes = resumenTerapeutas.reduce((acc, x) => acc + x.base_planes, 0)
    const rpmPeriodo = resumenTerapeutas.reduce((acc, x) => acc + x.rpm_total, 0)
    const profesionalPeriodo = resumenTerapeutas.reduce((acc, x) => acc + x.profesional_total, 0)
    const citasPeriodo = resumenTerapeutas.reduce((acc, x) => acc + x.citas, 0)
    const citasServicios = resumenTerapeutas.reduce((acc, x) => acc + x.servicios_citas, 0)
    const citasPlanes = resumenTerapeutas.reduce((acc, x) => acc + x.planes_citas, 0)

    return {
      pendientes,
      pagadas,
      basePeriodo,
      baseServicios,
      basePlanes,
      rpmPeriodo,
      profesionalPeriodo,
      citasPeriodo,
      citasServicios,
      citasPlanes,
    }
  }, [liquidaciones, resumenTerapeutas])

  const chartOrigen = useMemo(() => {
    return [
      { name: 'Servicios', value: resumenGeneral.baseServicios },
      { name: 'Planes', value: resumenGeneral.basePlanes },
    ].filter((item) => item.value > 0)
  }, [resumenGeneral])

  const chartTerapeutas = useMemo(() => {
    return resumenTerapeutas.slice(0, 8).map((row) => ({
      nombre: row.empleado_nombre,
      servicios: Number(row.profesional_servicios.toFixed(2)),
      planes: Number(row.profesional_planes.toFixed(2)),
    }))
  }, [resumenTerapeutas])

  async function handleGenerarLiquidacion(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!empleadoId) {
      setErrorMsg('Debes seleccionar un terapeuta.')
      return
    }

    const rpm = Number(porcentajeRpm || 0)
    const profesional = Number(porcentajeProfesional || 0)

    if (rpm < 0 || profesional < 0) {
      setErrorMsg('Los porcentajes no pueden ser negativos.')
      return
    }

    if (Number((rpm + profesional).toFixed(2)) !== 100) {
      setErrorMsg('La suma de porcentajes debe ser 100.')
      return
    }

    try {
      setGenerating(true)

      const { data, error } = await supabase.rpc('generar_liquidacion_comision', {
        p_empleado_id: empleadoId,
        p_fecha_inicio: fechaInicio,
        p_fecha_fin: fechaFin,
        p_porcentaje_rpm: rpm,
        p_porcentaje_profesional: profesional,
        p_notas: notas.trim() || null,
      })

      if (error) throw error

      await loadData()
      setSuccessMsg(
        `Liquidación creada. ${data?.cantidad_citas || 0} citas incluidas, total profesional ${money(
          data?.total_profesional || 0
        )}.`
      )
      setNotas('')
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo generar la liquidación.')
    } finally {
      setGenerating(false)
    }
  }

  async function marcarPagada(liquidacionId: string) {
    try {
      setPayingId(liquidacionId)
      setErrorMsg('')
      setSuccessMsg('')

      const { data, error } = await supabase.rpc('marcar_liquidacion_comision_pagada', {
        p_liquidacion_id: liquidacionId,
        p_metodo_pago_id: null,
        p_notas: null,
      })

      if (error) throw error

      await loadData()
      setSuccessMsg(
        data?.already_paid
          ? 'La liquidación ya estaba pagada.'
          : 'Liquidación marcada como pagada y egreso creado correctamente.'
      )
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo marcar como pagada.')
    } finally {
      setPayingId(null)
    }
  }

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Finanzas</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Comisiones Pro
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Liquidaciones por quincena, separando servicios individuales y sesiones por plan.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            href="/admin/finanzas"
            className="
              rounded-3xl border border-white/10 bg-white/[0.03]
              p-5 transition hover:bg-white/[0.06]
            "
          >
            <p className="font-medium text-white">Volver a resumen</p>
            <p className="mt-1 text-sm text-white/55">Regresar al tablero financiero.</p>
          </Link>

          <Link
            href="/admin/finanzas/cuentas-por-cobrar"
            className="
              rounded-3xl border border-white/10 bg-white/[0.03]
              p-5 transition hover:bg-white/[0.06]
            "
          >
            <p className="font-medium text-white">Cuentas por cobrar</p>
            <p className="mt-1 text-sm text-white/55">Revisar pendientes del negocio.</p>
          </Link>
        </div>
      </div>

      {errorMsg ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{errorMsg}</p>
        </Card>
      ) : null}

      {successMsg ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-emerald-400">Listo</p>
          <p className="mt-1 text-sm text-white/55">{successMsg}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Base período" value={money(resumenGeneral.basePeriodo)} color="text-white" />
        <StatCard title="Base servicios" value={money(resumenGeneral.baseServicios)} color="text-sky-400" />
        <StatCard title="Base planes" value={money(resumenGeneral.basePlanes)} color="text-violet-400" />
        <StatCard title="RPM período" value={money(resumenGeneral.rpmPeriodo)} color="text-cyan-400" />
        <StatCard
          title="Profesional período"
          value={money(resumenGeneral.profesionalPeriodo)}
          color="text-emerald-400"
        />
        <StatCard
          title="Pendiente pagar"
          value={money(resumenGeneral.pendientes)}
          color="text-amber-300"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Citas período"
          value={resumenGeneral.citasPeriodo}
          subtitle={`Servicios: ${resumenGeneral.citasServicios} · Planes: ${resumenGeneral.citasPlanes}`}
          color="text-white"
        />
        <StatCard
          title="Liquidado pagado"
          value={money(resumenGeneral.pagadas)}
          color="text-emerald-400"
        />
        <StatCard
          title="Quincena actual"
          value={currentFortnight.label}
          subtitle={
            currentFortnight.start && currentFortnight.end
              ? `${currentFortnight.start} → ${currentFortnight.end}`
              : 'Cargando...'
          }
          color="text-amber-300"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <form onSubmit={handleGenerarLiquidacion} className="xl:col-span-1">
          <Section
            title="Generar liquidación"
            description="Usa quincena o rango personalizado para el terapeuta."
          >
            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    const current = getCurrentFortnight()
                    setFechaInicio(current.start)
                    setFechaFin(current.end)
                  }}
                  className="
                    rounded-2xl border border-white/10 bg-white/[0.03]
                    px-4 py-3 text-sm font-semibold text-white/80 transition
                    hover:bg-white/[0.06]
                  "
                >
                  Quincena actual
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFechaInicio(firstDayOfMonthISO())
                    setFechaFin(lastDayOfMonthISO())
                  }}
                  className="
                    rounded-2xl border border-white/10 bg-white/[0.03]
                    px-4 py-3 text-sm font-semibold text-white/80 transition
                    hover:bg-white/[0.06]
                  "
                >
                  Mes completo
                </button>
              </div>

              <Field label="Terapeuta">
                <select
                  value={empleadoId}
                  onChange={(e) => setEmpleadoId(e.target.value)}
                  className={inputClassName}
                >
                  <option value="" className="bg-[#11131a] text-white">
                    Seleccionar
                  </option>
                  {empleados.map((emp) => (
                    <option key={emp.id} value={emp.id} className="bg-[#11131a] text-white">
                      {emp.nombre} · {emp.rol}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Fecha inicio">
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Fecha fin">
                <input
                  type="date"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className={inputClassName}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="% RPM">
                  <input
                    type="number"
                    step="0.01"
                    value={porcentajeRpm}
                    onChange={(e) => setPorcentajeRpm(e.target.value)}
                    className={inputClassName}
                  />
                </Field>

                <Field label="% Profesional">
                  <input
                    type="number"
                    step="0.01"
                    value={porcentajeProfesional}
                    onChange={(e) => setPorcentajeProfesional(e.target.value)}
                    className={inputClassName}
                  />
                </Field>
              </div>

              <Field label="Notas">
                <textarea
                  rows={3}
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Observación opcional de la liquidación..."
                  className={`${inputClassName} resize-none`}
                />
              </Field>

              <button
                type="submit"
                disabled={generating}
                className="
                  w-full rounded-2xl border border-white/10 bg-white/[0.08]
                  px-4 py-3 text-sm font-semibold text-white transition
                  hover:bg-white/[0.12] disabled:opacity-60
                "
              >
                {generating ? 'Generando...' : 'Generar liquidación'}
              </button>
            </div>
          </Section>
        </form>

        <div className="xl:col-span-2 space-y-6">
          <Section
            title="Distribución base"
            description="Separación entre servicios individuales y sesiones provenientes de planes."
          >
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="h-72">
                {chartOrigen.length === 0 ? (
                  <Card className="flex h-full items-center justify-center p-4">
                    <p className="text-sm text-white/55">No hay datos para el filtro actual.</p>
                  </Card>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartOrigen}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={4}
                      >
                        {chartOrigen.map((entry, index) => (
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

              <div className="space-y-3">
                <Card className="p-4">
                  <p className="text-sm text-white/55">Servicios</p>
                  <p className="mt-2 text-2xl font-semibold text-sky-400">
                    {money(resumenGeneral.baseServicios)}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {resumenGeneral.citasServicios} cita(s) individuales
                  </p>
                </Card>

                <Card className="p-4">
                  <p className="text-sm text-white/55">Planes</p>
                  <p className="mt-2 text-2xl font-semibold text-violet-400">
                    {money(resumenGeneral.basePlanes)}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {resumenGeneral.citasPlanes} cita(s) imputadas a planes
                  </p>
                </Card>
              </div>
            </div>
          </Section>

          <Section
            title="Resumen estimado del período"
            description="Separado por terapeuta, servicios y planes."
            className="p-0"
            contentClassName="overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03]">
                  <tr className="text-left text-white/55">
                    <th className="px-4 py-3 font-medium">Terapeuta</th>
                    <th className="px-4 py-3 font-medium">Citas</th>
                    <th className="px-4 py-3 font-medium">Base serv.</th>
                    <th className="px-4 py-3 font-medium">Base plan</th>
                    <th className="px-4 py-3 font-medium">RPM</th>
                    <th className="px-4 py-3 font-medium">Profesional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-white/55">
                        Cargando resumen...
                      </td>
                    </tr>
                  ) : resumenTerapeutas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-white/55">
                        No hay citas para el filtro actual.
                      </td>
                    </tr>
                  ) : (
                    resumenTerapeutas.map((row) => (
                      <tr key={row.empleado_id} className="transition hover:bg-white/[0.03]">
                        <td className="px-4 py-3 font-medium text-white">{row.empleado_nombre}</td>
                        <td className="px-4 py-3 text-white/75">
                          {row.citas}
                          <div className="mt-1 text-xs text-white/45">
                            Serv. {row.servicios_citas} · Plan {row.planes_citas}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-sky-400">
                          {money(row.base_servicios)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-violet-400">
                          {money(row.base_planes)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-cyan-400">
                          {money(row.rpm_total)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-400">
                          {money(row.profesional_total)}
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

      <Section
        title="Profesional por terapeuta"
        description="Comparativa visual entre comisiones provenientes de servicios y de planes."
      >
        <div className="h-80">
          {chartTerapeutas.length === 0 ? (
            <Card className="flex h-full items-center justify-center p-4">
              <p className="text-sm text-white/55">No hay datos para el filtro actual.</p>
            </Card>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartTerapeutas}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="nombre" stroke="rgba(255,255,255,0.45)" />
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
                <Bar dataKey="servicios" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                <Bar dataKey="planes" fill="#a78bfa" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Section>

      <Section
        title="Detalle de citas para comisión"
        description="Aquí se ve claramente qué viene de servicio y qué viene de plan."
        className="p-0"
        contentClassName="overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr className="text-left text-white/55">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Terapeuta</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Origen</th>
                <th className="px-4 py-3 font-medium">Referencia</th>
                <th className="px-4 py-3 font-medium">Base</th>
                <th className="px-4 py-3 font-medium">RPM</th>
                <th className="px-4 py-3 font-medium">Profesional</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-white/55">
                    Cargando detalle...
                  </td>
                </tr>
              ) : detalleCitas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-white/55">
                    No hay citas para el rango seleccionado.
                  </td>
                </tr>
              ) : (
                detalleCitas.map((row) => (
                  <tr key={row.cita_id} className="transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-white/75">{formatDate(row.fecha)}</td>
                    <td className="px-4 py-3 text-white">{row.terapeuta}</td>
                    <td className="px-4 py-3 text-white/75">{row.cliente}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${origenBadge(
                          row.origen
                        )}`}
                      >
                        {row.origen}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/75">{row.referencia}</td>
                    <td className="px-4 py-3 font-semibold text-white">{money(row.valor_base)}</td>
                    <td className="px-4 py-3 font-semibold text-cyan-400">{money(row.rpm)}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">
                      {money(row.profesional)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        title="Liquidaciones generadas"
        description="Historial de quincenas o períodos liquidados."
        className="p-0"
        contentClassName="overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr className="text-left text-white/55">
                <th className="px-4 py-3 font-medium">Terapeuta</th>
                <th className="px-4 py-3 font-medium">Período</th>
                <th className="px-4 py-3 font-medium">Citas</th>
                <th className="px-4 py-3 font-medium">Base</th>
                <th className="px-4 py-3 font-medium">RPM</th>
                <th className="px-4 py-3 font-medium">Profesional</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Egreso</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-white/55">
                    Cargando liquidaciones...
                  </td>
                </tr>
              ) : liquidaciones.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-white/55">
                    No hay liquidaciones todavía.
                  </td>
                </tr>
              ) : (
                liquidaciones.map((row) => (
                  <tr key={row.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-medium text-white">
                      {row.empleados?.nombre || 'Sin terapeuta'}
                    </td>
                    <td className="px-4 py-3 text-white/75">
                      {row.fecha_inicio} → {row.fecha_fin}
                    </td>
                    <td className="px-4 py-3 text-white/75">{row.cantidad_citas}</td>
                    <td className="px-4 py-3 text-white">{money(row.total_base)}</td>
                    <td className="px-4 py-3 font-semibold text-cyan-400">
                      {money(row.total_rpm)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">
                      {money(row.total_profesional)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(
                          row.estado
                        )}`}
                      >
                        {row.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/75">{row.egreso_id ? 'Generado' : '—'}</td>
                    <td className="px-4 py-3">
                      {row.estado === 'pendiente' ? (
                        <button
                          onClick={() => marcarPagada(row.id)}
                          disabled={payingId === row.id}
                          className="
                            rounded-xl border border-emerald-400/20 bg-emerald-400/10
                            px-3 py-1.5 text-xs font-semibold text-emerald-300
                            transition hover:bg-emerald-400/15 disabled:opacity-60
                          "
                        >
                          {payingId === row.id ? 'Guardando...' : 'Marcar pagada'}
                        </button>
                      ) : (
                        <span className="text-xs text-white/45">
                          {row.pagado_at
                            ? `Pagada ${new Date(row.pagado_at).toLocaleDateString()}`
                            : 'Pagada'}
                        </span>
                      )}
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