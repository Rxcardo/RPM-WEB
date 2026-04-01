'use client'

export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

type Cliente = { id: string; nombre: string; estado: string }
type Plan = {
  id: string
  nombre: string
  sesiones_totales: number
  vigencia_dias: number
  precio: number
  estado: string
  descripcion: string | null
}
type ClientePlan = {
  id: string
  cliente_id: string
  plan_id: string
  sesiones_totales: number
  sesiones_usadas: number
  fecha_inicio: string | null
  fecha_fin: string | null
  estado: string
  created_at: string
  planes: Plan | null
  origen: string
  porcentaje_rpm: number
  monto_base_comision: number | null
}
type Empleado = {
  id: string
  nombre: string
  especialidad: string | null
  comision_plan_porcentaje: number
  comision_cita_porcentaje: number
}
type Recurso = { id: string; nombre: string; tipo: string | null }
type MetodoPago = { id: string; nombre: string; tipo: string | null }
type EntrenamientoExistente = {
  id: string
  hora_inicio: string
  hora_fin: string
  fecha: string
  estado: string
  clientes: { nombre: string } | null
}

const DIAS_SEMANA = [
  { key: 1, label: 'L', nombre: 'Lunes' },
  { key: 2, label: 'M', nombre: 'Martes' },
  { key: 3, label: 'X', nombre: 'Miércoles' },
  { key: 4, label: 'J', nombre: 'Jueves' },
  { key: 5, label: 'V', nombre: 'Viernes' },
  { key: 6, label: 'S', nombre: 'Sábado' },
  { key: 0, label: 'D', nombre: 'Domingo' },
]

const HOUR_HEIGHT = 40
const TOTAL_HOURS = 24

function getTodayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function addDaysToDate(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(v: string | null) {
  if (!v) return '—'
  try {
    return new Date(`${v}T00:00:00`).toLocaleDateString('es')
  } catch {
    return v
  }
}

function formatMoney(v: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v || 0))
}

function formatBs(v: number) {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    maximumFractionDigits: 2,
  }).format(v)
}

function timeToMinutes(t: string) {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function sumarMinutos(hora: string, minutos: number) {
  return `${minutesToTime(timeToMinutes(hora) + minutos)}:00`
}

function generarFechasSesiones(fechaInicio: string, diasSemana: number[], totalSesiones: number): string[] {
  if (!diasSemana.length || !totalSesiones) return []
  const fechas: string[] = []
  const current = new Date(`${fechaInicio}T00:00:00`)
  let guard = 0

  while (fechas.length < totalSesiones && guard < 1000) {
    if (diasSemana.includes(current.getDay())) {
      fechas.push(
        `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
      )
    }
    current.setDate(current.getDate() + 1)
    guard++
  }

  return fechas
}

function Field({ label, children, helper }: { label: string; children: ReactNode; helper?: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/75">{label}</label>
      {children}
      {helper ? <p className="mt-2 text-xs text-white/45">{helper}</p> : null}
    </div>
  )
}

const inputCls = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]
`

function CalendarioDisponibilidad({
  empleadoId,
  fechaVista,
  horaInicio,
  horaFin,
  entrenamientosExistentes,
  onSelectHora,
}: {
  empleadoId: string
  fechaVista: string
  horaInicio: string
  horaFin: string
  entrenamientosExistentes: EntrenamientoExistente[]
  onSelectHora: (hora: string) => void
}) {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i)

  function getTop(m: number) {
    return (m / 60) * HOUR_HEIGHT
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const relY = Math.max(0, Math.min(e.clientY - rect.top, HOUR_HEIGHT * TOTAL_HOURS))
    const raw = (relY / (HOUR_HEIGHT * TOTAL_HOURS)) * TOTAL_HOURS * 60
    onSelectHora(minutesToTime(Math.round(raw / 30) * 30))
  }

  const inicioPx = horaInicio ? getTop(timeToMinutes(horaInicio)) : null
  const finPx = horaFin ? getTop(timeToMinutes(horaFin)) : null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-white/40">
        <span>
          {fechaVista
            ? new Date(`${fechaVista}T00:00:00`).toLocaleDateString('es', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })
            : '—'}
        </span>

        <div className="flex gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-500/70" />
            Ocupado
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-violet-500/70" />
            Nueva sesión
          </span>
        </div>
      </div>

      <div
        className="relative cursor-pointer overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02]"
        style={{ height: 380 }}
      >
        <div
          className="relative select-none"
          style={{ height: HOUR_HEIGHT * TOTAL_HOURS }}
          onClick={handleClick}
        >
          {hours.map((h) => (
            <div
              key={h}
              className="pointer-events-none absolute left-0 right-0 flex items-start"
              style={{ top: h * HOUR_HEIGHT }}
            >
              <span className="w-12 shrink-0 -translate-y-2 pr-2 text-right text-xs text-white/25">
                {h < 24 ? `${String(h).padStart(2, '0')}:00` : ''}
              </span>
              <div className="flex-1 border-t border-white/[0.06]" />
            </div>
          ))}

          {Array.from({ length: TOTAL_HOURS }, (_, h) => (
            <div
              key={`hh-${h}`}
              className="pointer-events-none absolute left-12 right-0 border-t border-white/[0.03]"
              style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
            />
          ))}

          {entrenamientosExistentes.map((e) => {
            const top = getTop(timeToMinutes(e.hora_inicio))
            const height = Math.max(20, getTop(timeToMinutes(e.hora_fin)) - top)

            return (
              <div
                key={e.id}
                className="pointer-events-none absolute left-12 right-2 overflow-hidden rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1"
                style={{ top, height }}
              >
                <p className="truncate text-xs font-medium text-rose-300">{e.clientes?.nombre || 'Cliente'}</p>
                <p className="text-xs text-rose-400/70">
                  {e.hora_inicio.slice(0, 5)} – {e.hora_fin.slice(0, 5)}
                </p>
              </div>
            )
          })}

          {inicioPx !== null && finPx !== null && (
            <div
              className="pointer-events-none absolute left-12 right-2 overflow-hidden rounded-lg border border-violet-400/30 bg-violet-500/15 px-2 py-1"
              style={{ top: inicioPx, height: Math.max(20, finPx - inicioPx) }}
            >
              <p className="text-xs font-semibold text-violet-300">Nueva sesión</p>
              <p className="text-xs text-violet-400/70">
                {horaInicio} – {horaFin?.slice(0, 5)}
              </p>
            </div>
          )}

          {fechaVista === getTodayLocal() && (
            <div
              className="pointer-events-none absolute left-0 right-0"
              style={{ top: getTop(new Date().getHours() * 60 + new Date().getMinutes()) }}
            >
              <div className="ml-12 flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <div className="flex-1 border-t border-emerald-400/60" />
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-white/30">Haz clic para seleccionar la hora de inicio</p>
    </div>
  )
}

type Modo = 'asignar' | 'renovar' | 'cancelar' | null
type OpcionArrastreSesiones = 'si' | 'no'

export default function ClientePlanPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [modo, setModo] = useState<Modo>(null)

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [planes, setPlanes] = useState<Plan[]>([])
  const [planActivo, setPlanActivo] = useState<ClientePlan | null>(null)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])
  const [entrenamientosEmpleado, setEntrenamientosEmpleado] = useState<EntrenamientoExistente[]>([])

  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [fechaInicio, setFechaInicio] = useState(getTodayLocal())
  const [empleadoId, setEmpleadoId] = useState('')
  const [recursoId, setRecursoId] = useState('')
  const [diasSemana, setDiasSemana] = useState<number[]>([])
  const [horaInicio, setHoraInicio] = useState('')
  const [duracionMin, setDuracionMin] = useState(60)

  const [metodoPagoId, setMetodoPagoId] = useState('')
  const [usarPrecioPlan, setUsarPrecioPlan] = useState(true)
  const [montoPersonalizado, setMontoPersonalizado] = useState('')
  const [registrarPago, setRegistrarPago] = useState(true)
  const [esBs, setEsBs] = useState(false)
  const [referenciaTasa, setReferenciaTasa] = useState<'USD' | 'EUR'>('USD')
  const [tasaBCV, setTasaBCV] = useState('')
  const [notasPago, setNotasPago] = useState('')

  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const [pagoAlCancelar, setPagoAlCancelar] = useState<'si' | 'no' | null>(null)

  const [fechaVistaCal, setFechaVistaCal] = useState(getTodayLocal())

  const [mostrarCrearPlan, setMostrarCrearPlan] = useState(false)
  const [nuevoPlanNombre, setNuevoPlanNombre] = useState('')
  const [nuevoPlanSesiones, setNuevoPlanSesiones] = useState(12)
  const [nuevoPlanVigencia, setNuevoPlanVigencia] = useState(30)
  const [nuevoPlanPrecio, setNuevoPlanPrecio] = useState('')
  const [creandoPlan, setCreandoPlan] = useState(false)

  const [montoBaseComision, setMontoBaseComision] = useState('')
  const [montoRpm, setMontoRpm] = useState('')
  const [montoEntrenador, setMontoEntrenador] = useState('')

  // NUEVO: elegir si arrastra pendientes en renovación
  const [renovarConPendientes, setRenovarConPendientes] = useState<OpcionArrastreSesiones>('si')

  const fetchAll = useCallback(async () => {
    if (!id) return

    setLoading(true)

    const [clienteRes, planesRes, planActivoRes, empleadosRes, recursosRes, metodosRes] = await Promise.all([
      supabase.from('clientes').select('id, nombre, estado').eq('id', id).single(),
      supabase
        .from('planes')
        .select('id, nombre, sesiones_totales, vigencia_dias, precio, estado, descripcion')
        .eq('estado', 'activo')
        .order('nombre'),
      supabase
        .from('clientes_planes')
        .select(`
          id,
          cliente_id,
          plan_id,
          sesiones_totales,
          sesiones_usadas,
          fecha_inicio,
          fecha_fin,
          estado,
          created_at,
          origen,
          porcentaje_rpm,
          monto_base_comision,
          planes:plan_id (
            id,
            nombre,
            sesiones_totales,
            vigencia_dias,
            precio,
            estado,
            descripcion
          )
        `)
        .eq('cliente_id', id)
        .eq('estado', 'activo')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('empleados')
        .select('id, nombre, especialidad, comision_plan_porcentaje, comision_cita_porcentaje')
        .eq('rol', 'terapeuta')
        .eq('estado', 'activo')
        .order('nombre'),
      supabase.from('recursos').select('id, nombre, tipo').order('nombre'),
      supabase.from('metodos_pago').select('id, nombre, tipo').eq('estado', 'activo').order('nombre'),
    ])

    if (clienteRes.error || !clienteRes.data) {
      setErrorMsg('No se pudo cargar el cliente.')
      setLoading(false)
      return
    }

    setCliente(clienteRes.data as Cliente)
    setPlanes((planesRes.data || []) as Plan[])
    setPlanActivo((planActivoRes.data as ClientePlan | null) || null)
    setEmpleados((empleadosRes.data || []) as Empleado[])
    setRecursos((recursosRes.data || []) as Recurso[])
    setMetodosPago((metodosRes.data || []) as MetodoPago[])

    setLoading(false)
  }, [id])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!empleadoId || !fechaVistaCal) {
      setEntrenamientosEmpleado([])
      return
    }

    void supabase
      .from('entrenamientos')
      .select('id, hora_inicio, hora_fin, fecha, estado, clientes:cliente_id ( nombre )')
      .eq('empleado_id', empleadoId)
      .eq('fecha', fechaVistaCal)
      .neq('estado', 'cancelado')
      .order('hora_inicio')
      .then(({ data }) => setEntrenamientosEmpleado((data || []) as unknown as EntrenamientoExistente[]))
  }, [empleadoId, fechaVistaCal])

  useEffect(() => {
    const m = metodosPago.find((x) => x.id === metodoPagoId)
    const n = (m?.nombre || '').toLowerCase()
    setEsBs(n.includes('bs') || n.includes('bolívar') || n.includes('bolivar') || n.includes('pago móvil'))
  }, [metodoPagoId, metodosPago])

  const selectedPlan = useMemo(
    () => planes.find((p) => p.id === selectedPlanId) || null,
    [planes, selectedPlanId]
  )

  const horaFin = useMemo(() => (horaInicio ? sumarMinutos(horaInicio, duracionMin) : ''), [horaInicio, duracionMin])

  const montoBase = usarPrecioPlan ? selectedPlan?.precio || 0 : Number(montoPersonalizado || 0)
  const tasaBCVNum = Number(tasaBCV || 0)
  const montoCalculadoBs = esBs && montoBase > 0 && tasaBCVNum > 0 ? montoBase * tasaBCVNum : 0

  const sesionesRestantes = planActivo
    ? Math.max(Number(planActivo.sesiones_totales) - Number(planActivo.sesiones_usadas), 0)
    : 0

  const sesionesARenovar = useMemo(() => {
    if (!selectedPlan) return 0
    return renovarConPendientes === 'si'
      ? selectedPlan.sesiones_totales + sesionesRestantes
      : selectedPlan.sesiones_totales
  }, [selectedPlan, renovarConPendientes, sesionesRestantes])

  const progresoUso = planActivo
    ? Math.min(
        Math.round((Number(planActivo.sesiones_usadas) / Math.max(Number(planActivo.sesiones_totales), 1)) * 100),
        100
      )
    : 0

  const fechasPreview = useMemo(() => {
    if (!fechaInicio || !diasSemana.length || !selectedPlan) return []

    const total =
      modo === 'renovar'
        ? renovarConPendientes === 'si'
          ? selectedPlan.sesiones_totales + sesionesRestantes
          : selectedPlan.sesiones_totales
        : selectedPlan.sesiones_totales

    return generarFechasSesiones(fechaInicio, diasSemana, total)
  }, [fechaInicio, diasSemana, selectedPlan, modo, sesionesRestantes, renovarConPendientes])

  function toggleDia(dia: number) {
    setDiasSemana((prev) => (prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]))
  }

  function r2(v: number) {
    return Math.round(v * 100) / 100
  }

  function nn(v: string) {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }

  function handleBaseComisionChange(value: string) {
    setMontoBaseComision(value)

    const base = r2(nn(value))
    if (!base) {
      setMontoRpm('')
      setMontoEntrenador('')
      return
    }

    const rpm = Math.min(r2(nn(montoRpm)), base)
    setMontoRpm(String(rpm))
    setMontoEntrenador(String(r2(base - rpm)))
  }

  function handleMontoRpmChange(value: string) {
    setMontoRpm(value)

    const base = r2(nn(montoBaseComision || String(selectedPlan?.precio || 0)))
    const rpm = Math.min(r2(nn(value)), base)
    setMontoEntrenador(String(r2(Math.max(base - rpm, 0))))
  }

  function handleMontoEntrenadorChange(value: string) {
    setMontoEntrenador(value)

    const base = r2(nn(montoBaseComision || String(selectedPlan?.precio || 0)))
    const ent = Math.min(r2(nn(value)), base)
    setMontoRpm(String(r2(Math.max(base - ent, 0))))
  }

  function resetForm() {
    setSelectedPlanId('')
    setFechaInicio(getTodayLocal())
    setEmpleadoId('')
    setRecursoId('')
    setDiasSemana([])
    setHoraInicio('')
    setDuracionMin(60)
    setMetodoPagoId('')
    setUsarPrecioPlan(true)
    setMontoPersonalizado('')
    setRegistrarPago(true)
    setEsBs(false)
    setTasaBCV('')
    setNotasPago('')
    setMotivoCancelacion('')
    setPagoAlCancelar(null)
    setFechaVistaCal(getTodayLocal())
    setErrorMsg('')
    setSuccessMsg('')
    setMontoBaseComision('')
    setMontoRpm('')
    setMontoEntrenador('')
    setRenovarConPendientes('si')
  }

  async function crearPlanInline() {
    if (!nuevoPlanNombre.trim()) {
      alert('Ingresa el nombre del plan.')
      return
    }

    if (!nuevoPlanPrecio || Number(nuevoPlanPrecio) <= 0) {
      alert('Ingresa un precio válido.')
      return
    }

    setCreandoPlan(true)

    try {
      const { data: plan, error } = await supabase
        .from('planes')
        .insert({
          nombre: nuevoPlanNombre.trim(),
          sesiones_totales: nuevoPlanSesiones,
          vigencia_dias: nuevoPlanVigencia,
          precio: Number(nuevoPlanPrecio),
          estado: 'activo',
        })
        .select('id, nombre, sesiones_totales, vigencia_dias, precio, estado, descripcion')
        .single()

      if (error) throw new Error(error.message)

      setPlanes((prev) => [...prev, plan as Plan].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setSelectedPlanId(plan.id)

      const base = r2(Number(plan.precio))
      const rpmI = r2(base * 0.35)
      setMontoBaseComision(String(base))
      setMontoRpm(String(rpmI))
      setMontoEntrenador(String(r2(base - rpmI)))

      setMostrarCrearPlan(false)
      setNuevoPlanNombre('')
      setNuevoPlanSesiones(12)
      setNuevoPlanVigencia(30)
      setNuevoPlanPrecio('')
    } catch (err: any) {
      alert(err?.message || 'Error al crear el plan.')
    } finally {
      setCreandoPlan(false)
    }
  }

  async function registrarComision(
    clientePlanId: string,
    empId: string,
    clienteId: string,
    base: number,
    fecha: string,
    rpm: number,
    profesional: number
  ) {
    try {
      const { error } = await supabase.from('comisiones_detalle').insert({
        empleado_id: empId,
        cliente_id: clienteId,
        cliente_plan_id: clientePlanId,
        fecha,
        base,
        profesional,
        rpm,
        tipo: 'plan',
        estado: 'pendiente',
      })

      if (error) console.error('❌ Error comisión:', error.message)
    } catch (err) {
      console.error('❌', err)
    }
  }

  async function cancelarPlanAnterior(planId: string, detalle: string) {
    await supabase.from('clientes_planes').update({ estado: 'cancelado' }).eq('id', planId)

    await supabase
      .from('entrenamientos')
      .update({ estado: 'cancelado' })
      .eq('cliente_plan_id', planId)
      .eq('estado', 'programado')

    await supabase.from('clientes_planes_eventos').insert({
      cliente_plan_id: planId,
      cliente_id: id,
      tipo: 'cancelado',
      detalle,
    })
  }

  async function handleAsignar(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!selectedPlanId) {
      setErrorMsg('Selecciona un plan.')
      return
    }
    if (!fechaInicio) {
      setErrorMsg('Selecciona fecha de inicio.')
      return
    }
    if (!empleadoId) {
      setErrorMsg('Selecciona un entrenador.')
      return
    }
    if (!diasSemana.length) {
      setErrorMsg('Selecciona al menos un día.')
      return
    }
    if (!horaInicio) {
      setErrorMsg('Selecciona la hora.')
      return
    }
    if (registrarPago && !metodoPagoId) {
      setErrorMsg('Selecciona método de pago.')
      return
    }
    if (registrarPago && esBs && (!tasaBCV || tasaBCVNum <= 0)) {
      setErrorMsg('Ingresa la tasa BCV.')
      return
    }

    const plan = selectedPlan!

    const baseC = r2(nn(montoBaseComision || String(plan.precio || 0)))
    const rpmV = r2(nn(montoRpm))
    const entV = r2(nn(montoEntrenador))

    if (baseC > 0 && r2(rpmV + entV) !== baseC) {
      setErrorMsg(
        `La suma RPM (${formatMoney(rpmV)}) + Entrenador (${formatMoney(entV)}) debe ser igual a la base (${formatMoney(baseC)}). Ajusta los valores.`
      )
      return
    }

    setSaving(true)

    try {
      if (planActivo) {
        await cancelarPlanAnterior(
          planActivo.id,
          'Reemplazado manualmente por asignación de un nuevo plan'
        )
      }

      const fechaFin = addDaysToDate(fechaInicio, plan.vigencia_dias)

      const { data: np, error: cpE } = await supabase
        .from('clientes_planes')
        .insert({
          cliente_id: id,
          plan_id: plan.id,
          sesiones_totales: plan.sesiones_totales,
          sesiones_usadas: 0,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          estado: 'activo',
        })
        .select('id')
        .single()

      if (cpE) throw new Error(cpE.message)

      const fechas = generarFechasSesiones(fechaInicio, diasSemana, plan.sesiones_totales)
      const hiN = horaInicio.length === 5 ? `${horaInicio}:00` : horaInicio
      const hfN = horaFin.length === 5 ? `${horaFin}:00` : horaFin

      const { error: eE } = await supabase.from('entrenamientos').insert(
        fechas.map((f) => ({
          cliente_plan_id: np.id,
          cliente_id: id,
          empleado_id: empleadoId,
          recurso_id: recursoId || null,
          fecha: f,
          hora_inicio: hiN,
          hora_fin: hfN,
          estado: 'programado',
        }))
      )

      if (eE) throw new Error(`Entrenamientos: ${eE.message}`)

      if (registrarPago && montoBase > 0) {
        const mF = esBs ? montoCalculadoBs : montoBase

        const concepto = esBs
          ? `Plan: ${plan.nombre} — ${cliente?.nombre} (${formatMoney(montoBase)} × ${tasaBCV} = ${formatBs(
              montoCalculadoBs
            )})`
          : `Plan: ${plan.nombre} — ${cliente?.nombre}`

        const { error: pE } = await supabase.from('pagos').insert({
          fecha: fechaInicio,
          tipo_origen: 'plan',
          cliente_id: id,
          cliente_plan_id: np.id,
          concepto,
          categoria: 'plan',
          monto: mF,
          metodo_pago_id: metodoPagoId,
          estado: 'pagado',
          notas: notasPago || null,
        })

        if (pE) throw new Error(`Pago: ${pE.message}`)
      }

      if (baseC > 0) {
        await registrarComision(np.id, empleadoId, id, baseC, fechaInicio, rpmV, entV)
      }

      const porcRpm = baseC > 0 ? r2((rpmV / baseC) * 100) : 0
      await supabase
        .from('clientes_planes')
        .update({
          origen: 'manual',
          porcentaje_rpm: porcRpm,
          monto_base_comision: baseC,
        })
        .eq('id', np.id)

      setSuccessMsg(`Plan "${plan.nombre}" asignado. ${fechas.length} entrenamientos generados.`)
      resetForm()
      setModo(null)
      await fetchAll()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al asignar el plan.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRenovar(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!selectedPlanId) {
      setErrorMsg('Selecciona un plan.')
      return
    }
    if (!fechaInicio) {
      setErrorMsg('Selecciona fecha de inicio.')
      return
    }
    if (!empleadoId) {
      setErrorMsg('Selecciona un entrenador.')
      return
    }
    if (!diasSemana.length) {
      setErrorMsg('Selecciona al menos un día.')
      return
    }
    if (!horaInicio) {
      setErrorMsg('Selecciona la hora.')
      return
    }
    if (registrarPago && !metodoPagoId) {
      setErrorMsg('Selecciona método de pago.')
      return
    }
    if (registrarPago && esBs && (!tasaBCV || tasaBCVNum <= 0)) {
      setErrorMsg('Ingresa la tasa BCV.')
      return
    }

    const plan = selectedPlan!
    const sesN = renovarConPendientes === 'si'
      ? plan.sesiones_totales + sesionesRestantes
      : plan.sesiones_totales

    const baseC = r2(nn(montoBaseComision || String(plan.precio || 0)))
    const rpmV = r2(nn(montoRpm))
    const entV = r2(nn(montoEntrenador))

    if (baseC > 0 && r2(rpmV + entV) !== baseC) {
      setErrorMsg(
        `La suma RPM (${formatMoney(rpmV)}) + Entrenador (${formatMoney(entV)}) debe ser igual a la base (${formatMoney(baseC)}).`
      )
      return
    }

    setSaving(true)

    try {
      if (planActivo) {
        const detalleRenovacion =
          renovarConPendientes === 'si'
            ? `Renovado arrastrando ${sesionesRestantes} sesiones pendientes`
            : 'Renovado sin arrastrar sesiones pendientes'

        await cancelarPlanAnterior(planActivo.id, detalleRenovacion)
      }

      const fechaFin = addDaysToDate(fechaInicio, plan.vigencia_dias)

      const { data: np, error: cpE } = await supabase
        .from('clientes_planes')
        .insert({
          cliente_id: id,
          plan_id: plan.id,
          sesiones_totales: sesN,
          sesiones_usadas: 0,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          estado: 'activo',
        })
        .select('id')
        .single()

      if (cpE) throw new Error(cpE.message)

      const fechas = generarFechasSesiones(fechaInicio, diasSemana, sesN)
      const hiN = horaInicio.length === 5 ? `${horaInicio}:00` : horaInicio
      const hfN = horaFin.length === 5 ? `${horaFin}:00` : horaFin

      const { error: eE } = await supabase.from('entrenamientos').insert(
        fechas.map((f) => ({
          cliente_plan_id: np.id,
          cliente_id: id,
          empleado_id: empleadoId,
          recurso_id: recursoId || null,
          fecha: f,
          hora_inicio: hiN,
          hora_fin: hfN,
          estado: 'programado',
        }))
      )

      if (eE) throw new Error(`Entrenamientos: ${eE.message}`)

      if (registrarPago && montoBase > 0) {
        const mF = esBs ? montoCalculadoBs : montoBase
        const sesionesTxt =
          renovarConPendientes === 'si'
            ? `Renovación: ${plan.nombre} — ${cliente?.nombre} (+${sesionesRestantes} pendientes)`
            : `Renovación: ${plan.nombre} — ${cliente?.nombre} (sin pendientes)`

        const concepto = esBs
          ? `${sesionesTxt} (${formatMoney(montoBase)} × ${tasaBCV} = ${formatBs(montoCalculadoBs)})`
          : sesionesTxt

        const { error: pE } = await supabase.from('pagos').insert({
          fecha: fechaInicio,
          tipo_origen: 'plan',
          cliente_id: id,
          cliente_plan_id: np.id,
          concepto,
          categoria: 'plan',
          monto: mF,
          metodo_pago_id: metodoPagoId,
          estado: 'pagado',
          notas: notasPago || null,
        })

        if (pE) throw new Error(`Pago: ${pE.message}`)
      }

      if (baseC > 0) {
        await registrarComision(np.id, empleadoId, id, baseC, fechaInicio, rpmV, entV)
      }

      const porcRpm = baseC > 0 ? r2((rpmV / baseC) * 100) : 0
      await supabase
        .from('clientes_planes')
        .update({
          origen: 'manual',
          porcentaje_rpm: porcRpm,
          monto_base_comision: baseC,
        })
        .eq('id', np.id)

      setSuccessMsg(
        renovarConPendientes === 'si'
          ? `Plan renovado. Se conservaron ${sesionesRestantes} sesiones pendientes. Total nuevo: ${sesN} sesiones.`
          : `Plan renovado sin arrastrar sesiones pendientes. Total nuevo: ${sesN} sesiones.`
      )

      resetForm()
      setModo(null)
      await fetchAll()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al renovar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancelar(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!motivoCancelacion) {
      setErrorMsg('Selecciona el motivo.')
      return
    }
    if (pagoAlCancelar === null) {
      setErrorMsg('Indica si el cliente realizó el pago.')
      return
    }
    if (!planActivo) {
      setErrorMsg('No hay plan activo.')
      return
    }

    setSaving(true)

    try {
      await supabase.from('clientes_planes').update({ estado: 'cancelado' }).eq('id', planActivo.id)

      await supabase
        .from('entrenamientos')
        .update({ estado: 'cancelado' })
        .eq('cliente_plan_id', planActivo.id)
        .eq('estado', 'programado')

      await supabase.from('clientes_planes_eventos').insert({
        cliente_plan_id: planActivo.id,
        cliente_id: id,
        tipo: 'cancelado',
        detalle: `${motivoCancelacion} | pago:${pagoAlCancelar}`,
      })

      // Si NO pagó: se revierte todo lo económico para que quede
      // como si nunca se hubiera acreditado ese plan.
      if (pagoAlCancelar === 'no') {
        await supabase
          .from('pagos')
          .update({
            estado: 'anulado',
            notas: 'Anulado por cancelación de plan sin pago confirmado',
          })
          .eq('cliente_plan_id', planActivo.id)
          .eq('estado', 'pagado')

        await supabase
          .from('comisiones_detalle')
          .delete()
          .eq('cliente_plan_id', planActivo.id)
          .eq('estado', 'pendiente')
      }

      setSuccessMsg(
        pagoAlCancelar === 'no'
          ? 'Plan cancelado. No se arrastrará a futuras renovaciones y quedó sin efecto económico.'
          : 'Plan cancelado. No se arrastrará a futuras renovaciones y el pago/comisión se mantienen.'
      )

      resetForm()
      setModo(null)
      await fetchAll()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al cancelar.')
    } finally {
      setSaving(false)
    }
  }

  function renderPlanForm(submitLabel: string, onSubmit: (e: React.FormEvent) => Promise<void>) {
    const baseV = r2(nn(montoBaseComision || String(selectedPlan?.precio || 0)))
    const rpmV = r2(nn(montoRpm))
    const entV = r2(nn(montoEntrenador))
    const sumaV = r2(rpmV + entV)
    const desbal = baseV > 0 && sumaV !== baseV

    return (
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan">
            <div className="flex gap-2">
              <select
                value={selectedPlanId}
                onChange={(e) => {
                  setSelectedPlanId(e.target.value)
                  const p = planes.find((x) => x.id === e.target.value)
                  if (p) {
                    const base = r2(Number(p.precio || 0))
                    const rpmI = r2(base * 0.35)
                    setMontoBaseComision(String(base))
                    setMontoRpm(String(rpmI))
                    setMontoEntrenador(String(r2(base - rpmI)))
                  }
                }}
                className={inputCls}
              >
                <option value="" className="bg-[#11131a]">
                  Seleccionar plan
                </option>
                {planes.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#11131a]">
                    {p.nombre} · {p.sesiones_totales} ses. · {formatMoney(p.precio)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setMostrarCrearPlan((v) => !v)}
                className="shrink-0 rounded-2xl border border-violet-400/20 bg-violet-400/10 px-3 text-xs font-medium text-violet-300 transition hover:bg-violet-400/20"
              >
                + Plan
              </button>
            </div>

            {mostrarCrearPlan && (
              <div className="mt-3 space-y-3 rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4">
                <p className="text-xs font-medium text-violet-300">Crear nuevo plan</p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs text-white/55">Nombre</label>
                    <input
                      value={nuevoPlanNombre}
                      onChange={(e) => setNuevoPlanNombre(e.target.value)}
                      placeholder="Ej: Plan Básico"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-white/55">Precio ($)</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={nuevoPlanPrecio}
                      onChange={(e) => setNuevoPlanPrecio(e.target.value)}
                      placeholder="0.00"
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-white/55">Sesiones</label>
                    <input
                      type="number"
                      min={1}
                      value={nuevoPlanSesiones}
                      onChange={(e) => setNuevoPlanSesiones(Number(e.target.value))}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-white/55">Vigencia (días)</label>
                    <input
                      type="number"
                      min={1}
                      value={nuevoPlanVigencia}
                      onChange={(e) => setNuevoPlanVigencia(Number(e.target.value))}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={crearPlanInline}
                    disabled={creandoPlan}
                    className="rounded-2xl border border-violet-400/20 bg-violet-400/15 px-4 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-400/25 disabled:opacity-60"
                  >
                    {creandoPlan ? 'Creando...' : 'Crear y seleccionar'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMostrarCrearPlan(false)}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/60 hover:bg-white/[0.06]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </Field>

          <Field label="Fecha de inicio">
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        {selectedPlan && (
          <Card className="border-white/10 bg-white/[0.02] p-4">
            <p className="font-medium text-white">{selectedPlan.nombre}</p>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <p className="text-xs text-white/45">Sesiones base</p>
                <p className="font-medium text-white">{selectedPlan.sesiones_totales}</p>
              </div>

              {modo === 'renovar' && sesionesRestantes > 0 && renovarConPendientes === 'si' && (
                <div>
                  <p className="text-xs text-white/45">+ Pendientes</p>
                  <p className="font-medium text-emerald-400">+{sesionesRestantes}</p>
                </div>
              )}

              <div>
                <p className="text-xs text-white/45">Total</p>
                <p className="font-medium text-white">
                  {modo === 'renovar' ? sesionesARenovar : selectedPlan.sesiones_totales}
                </p>
              </div>

              <div>
                <p className="text-xs text-white/45">Vence</p>
                <p className="font-medium text-white">
                  {formatDate(addDaysToDate(fechaInicio, selectedPlan.vigencia_dias))}
                </p>
              </div>
            </div>
          </Card>
        )}

        {modo === 'renovar' && planActivo && (
          <div className="space-y-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
            <p className="text-sm font-medium text-emerald-300">Sesiones pendientes del plan actual</p>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setRenovarConPendientes('si')}
                className={`rounded-2xl border p-4 text-left transition ${
                  renovarConPendientes === 'si'
                    ? 'border-emerald-400/30 bg-emerald-400/10'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <p className="text-sm font-semibold text-white">Sí, conservar pendientes</p>
                <p className="mt-1 text-xs text-white/45">
                  Se suman {sesionesRestantes} sesiones pendientes al nuevo plan.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRenovarConPendientes('no')}
                className={`rounded-2xl border p-4 text-left transition ${
                  renovarConPendientes === 'no'
                    ? 'border-rose-400/30 bg-rose-400/10'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}
              >
                <p className="text-sm font-semibold text-white">No, empezar limpio</p>
                <p className="mt-1 text-xs text-white/45">
                  No se suman pendientes. El nuevo plan empieza solo con sus sesiones propias.
                </p>
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Entrenador">
            <select
              value={empleadoId}
              onChange={(e) => {
                setEmpleadoId(e.target.value)
                setFechaVistaCal(fechaInicio)
              }}
              className={inputCls}
            >
              <option value="" className="bg-[#11131a]">
                Seleccionar entrenador
              </option>
              {empleados.map((e) => (
                <option key={e.id} value={e.id} className="bg-[#11131a]">
                  {e.nombre}
                  {e.especialidad ? ` · ${e.especialidad}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Recurso / Espacio">
            <select value={recursoId} onChange={(e) => setRecursoId(e.target.value)} className={inputCls}>
              <option value="" className="bg-[#11131a]">
                Sin recurso
              </option>
              {recursos.map((r) => (
                <option key={r.id} value={r.id} className="bg-[#11131a]">
                  {r.nombre}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Días de entrenamiento">
          <div className="mt-1 flex flex-wrap gap-2">
            {DIAS_SEMANA.map((dia) => (
              <button
                key={dia.key}
                type="button"
                onClick={() => toggleDia(dia.key)}
                className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-semibold transition ${
                  diasSemana.includes(dia.key)
                    ? 'border-violet-400/40 bg-violet-500/20 text-violet-300'
                    : 'border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06]'
                }`}
              >
                {dia.label}
              </button>
            ))}
          </div>

          {diasSemana.length > 0 && (
            <p className="mt-2 text-xs text-white/45">
              {diasSemana.map((d) => DIAS_SEMANA.find((x) => x.key === d)?.nombre).join(', ')}
            </p>
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hora de inicio" helper="O haz clic en el calendario →">
            <input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className={inputCls}
            />
          </Field>

          <Field label="Duración (minutos)">
            <select
              value={duracionMin}
              onChange={(e) => setDuracionMin(Number(e.target.value))}
              className={inputCls}
            >
              {[30, 45, 60, 75, 90, 120].map((m) => (
                <option key={m} value={m} className="bg-[#11131a]">
                  {m} minutos
                </option>
              ))}
            </select>
          </Field>
        </div>

        {empleadoId && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white/75">Disponibilidad del entrenador</p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(`${fechaVistaCal}T00:00:00`)
                    d.setDate(d.getDate() - 1)
                    setFechaVistaCal(
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
                        d.getDate()
                      ).padStart(2, '0')}`
                    )
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.06]"
                >
                  ←
                </button>

                <input
                  type="date"
                  value={fechaVistaCal}
                  onChange={(e) => setFechaVistaCal(e.target.value)}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white outline-none"
                />

                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(`${fechaVistaCal}T00:00:00`)
                    d.setDate(d.getDate() + 1)
                    setFechaVistaCal(
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
                        d.getDate()
                      ).padStart(2, '0')}`
                    )
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.06]"
                >
                  →
                </button>
              </div>
            </div>

            <CalendarioDisponibilidad
              empleadoId={empleadoId}
              fechaVista={fechaVistaCal}
              horaInicio={horaInicio}
              horaFin={horaFin}
              entrenamientosExistentes={entrenamientosEmpleado}
              onSelectHora={(hora) => setHoraInicio(hora)}
            />
          </div>
        )}

        {fechasPreview.length > 0 && (
          <Card className="border-violet-400/20 bg-violet-400/5 p-4">
            <p className="text-sm font-medium text-violet-300">
              Se generarán {fechasPreview.length} entrenamientos
            </p>

            <div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              {fechasPreview.slice(0, 30).map((f, i) => (
                <span
                  key={i}
                  className="rounded-lg bg-violet-500/10 px-2 py-0.5 text-xs text-violet-400"
                >
                  {new Date(`${f}T00:00:00`).toLocaleDateString('es', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              ))}

              {fechasPreview.length > 30 && (
                <span className="text-xs text-violet-400/60">+{fechasPreview.length - 30} más</span>
              )}
            </div>
          </Card>
        )}

        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-sm font-medium text-white/75">Configuración de comisión</p>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Base comisión"
              helper={selectedPlan ? `Precio del plan: ${formatMoney(selectedPlan.precio)}` : 'Monto base a repartir'}
            >
              <input
                type="number"
                min={0}
                step="0.01"
                value={montoBaseComision || (selectedPlan?.precio ?? '')}
                onChange={(e) => handleBaseComisionChange(e.target.value)}
                className={inputCls}
                placeholder="0.00"
              />
            </Field>

            <Field label="RPM recibe" helper="Al editar, ajusta el del entrenador">
              <input
                type="number"
                min={0}
                step="0.01"
                value={montoRpm}
                onChange={(e) => handleMontoRpmChange(e.target.value)}
                className={inputCls}
                placeholder="0.00"
              />
            </Field>

            <Field label="Entrenador recibe" helper="Al editar, ajusta el de RPM">
              <input
                type="number"
                min={0}
                step="0.01"
                value={montoEntrenador}
                onChange={(e) => handleMontoEntrenadorChange(e.target.value)}
                className={inputCls}
                placeholder="0.00"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-white/45">Base</p>
              <p className="mt-1 text-lg font-semibold text-white">{formatMoney(baseV)}</p>
            </Card>

            <Card className="border-violet-400/20 bg-violet-400/5 p-4">
              <p className="text-xs text-white/45">RPM recibe</p>
              <p className="mt-1 text-lg font-semibold text-violet-400">{formatMoney(rpmV)}</p>
              <p className="text-xs text-white/25">{baseV > 0 ? r2((rpmV / baseV) * 100) : 0}%</p>
            </Card>

            <Card className="border-emerald-400/20 bg-emerald-400/5 p-4">
              <p className="text-xs text-white/45">Entrenador recibe</p>
              <p className="mt-1 text-lg font-semibold text-emerald-400">{formatMoney(entV)}</p>
              <p className="text-xs text-white/25">{baseV > 0 ? r2((entV / baseV) * 100) : 0}%</p>
            </Card>
          </div>

          {baseV > 0 && !desbal && (
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="bg-violet-500/70 transition-all" style={{ width: `${(rpmV / baseV) * 100}%` }} />
              <div className="flex-1 bg-emerald-500/70" />
            </div>
          )}

          {desbal && (
            <Card className="border-amber-400/20 bg-amber-400/5 p-4">
              <p className="text-sm text-amber-300">
                ⚠️ RPM ({formatMoney(rpmV)}) + Entrenador ({formatMoney(entV)}) = {formatMoney(sumaV)},
                pero la base es {formatMoney(baseV)}. Ajusta los valores.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRegistrarPago((p) => !p)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                registrarPago ? 'bg-emerald-500' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                  registrarPago ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-sm text-white/75">Registrar pago en finanzas</span>
          </div>

          {registrarPago && (
            <div className="mt-4 space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Método de pago">
                  <select
                    value={metodoPagoId}
                    onChange={(e) => setMetodoPagoId(e.target.value)}
                    className={inputCls}
                  >
                    <option value="" className="bg-[#11131a]">
                      Seleccionar
                    </option>
                    {metodosPago.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#11131a]">
                        {m.nombre}
                        {m.tipo ? ` · ${m.tipo}` : ''}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Monto">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={usarPrecioPlan ? selectedPlan?.precio ?? '' : montoPersonalizado}
                      readOnly={usarPrecioPlan}
                      onChange={(e) => setMontoPersonalizado(e.target.value)}
                      className={`${inputCls} ${usarPrecioPlan ? 'cursor-not-allowed opacity-60' : ''}`}
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      onClick={() => setUsarPrecioPlan((p) => !p)}
                      className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white/60 hover:bg-white/[0.06]"
                    >
                      {usarPrecioPlan ? 'Editar' : 'Plan'}
                    </button>
                  </div>
                </Field>
              </div>

              {esBs && (
                <div className="space-y-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
                  <p className="text-sm font-medium text-amber-300">Pago en bolívares</p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Tasa de referencia">
                      <select
                        value={referenciaTasa}
                        onChange={(e) => setReferenciaTasa(e.target.value as 'USD' | 'EUR')}
                        className={inputCls}
                      >
                        <option value="USD" className="bg-[#11131a]">
                          Dólar (USD)
                        </option>
                        <option value="EUR" className="bg-[#11131a]">
                          Euro (EUR)
                        </option>
                      </select>
                    </Field>

                    <Field label={`Tasa BCV ${referenciaTasa}`}>
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={tasaBCV}
                        onChange={(e) => setTasaBCV(e.target.value)}
                        placeholder="Ej: 36.52"
                        className={inputCls}
                      />
                    </Field>

                    <Field label="Total en Bs">
                      <input
                        readOnly
                        value={montoCalculadoBs > 0 ? formatBs(montoCalculadoBs) : '—'}
                        className={`${inputCls} cursor-not-allowed opacity-60`}
                      />
                    </Field>
                  </div>
                </div>
              )}

              <Field label="Notas del pago">
                <textarea
                  value={notasPago}
                  onChange={(e) => setNotasPago(e.target.value)}
                  rows={2}
                  className={`${inputCls} resize-none`}
                  placeholder="Notas opcionales..."
                />
              </Field>
            </div>
          )}
        </div>

        {errorMsg && (
          <Card className="p-4">
            <p className="text-sm text-rose-400">{errorMsg}</p>
          </Card>
        )}

        {successMsg && (
          <Card className="p-4">
            <p className="text-sm text-emerald-400">{successMsg}</p>
          </Card>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-60"
          >
            {saving ? 'Guardando...' : submitLabel}
          </button>

          <button
            type="button"
            onClick={() => {
              setModo(null)
              resetForm()
            }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
          >
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/55">Clientes / Plan</p>
        <h1 className="text-2xl font-semibold text-white">Plan del cliente</h1>
        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando...</p>
        </Card>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/55">Clientes / Plan</p>
        <h1 className="text-2xl font-semibold text-white">Plan del cliente</h1>
        <Card className="p-6">
          <p className="text-sm text-rose-400">{errorMsg || 'No encontrado.'}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Clientes / Plan</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Plan del cliente</h1>
          <p className="mt-2 text-sm text-white/55">{cliente.nombre}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard title="Volver al cliente" description="Ver ficha completa." href={`/admin/personas/clientes/${id}`} />
          <ActionCard title="Nueva cita" description="Agendar cita." href={`/admin/operaciones/agenda/nueva?cliente=${id}`} />
        </div>
      </div>

      {successMsg && !modo && (
        <Card className="p-4">
          <p className="text-sm text-emerald-400">{successMsg}</p>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {!modo && (
            <Section title="Gestión del plan" description="Acciones disponibles.">
              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setModo('asignar')
                    resetForm()
                  }}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-left transition hover:bg-white/[0.08]"
                >
                  <p className="font-semibold text-white">Asignar plan</p>
                  <p className="mt-1 text-xs text-white/45">
                    {planActivo ? 'Reemplazar plan actual' : 'Asignar primer plan'}
                  </p>
                </button>

                <button
                  type="button"
                  disabled={!planActivo}
                  onClick={() => {
                    setModo('renovar')
                    resetForm()
                  }}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-left transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <p className="font-semibold text-white">Renovar plan</p>
                  <p className="mt-1 text-xs text-white/45">
                    {planActivo ? `${sesionesRestantes} ses. pendientes disponibles` : 'Sin plan activo'}
                  </p>
                </button>

                <button
                  type="button"
                  disabled={!planActivo}
                  onClick={() => {
                    setModo('cancelar')
                    resetForm()
                  }}
                  className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4 text-left transition hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <p className="font-semibold text-rose-300">Cancelar plan</p>
                  <p className="mt-1 text-xs text-rose-400/60">
                    {planActivo ? 'Cancela plan y entrenamientos futuros' : 'Sin plan activo'}
                  </p>
                </button>
              </div>
            </Section>
          )}

          {modo === 'asignar' && (
            <Section title="Asignar plan" description="Asigna un plan y genera entrenamientos.">
              {planActivo && (
                <Card className="mb-4 border-amber-400/20 bg-amber-400/5 p-4">
                  <p className="text-sm text-amber-300">
                    ⚠️ El plan actual "{planActivo.planes?.nombre}" será reemplazado.
                  </p>
                </Card>
              )}
              {renderPlanForm('Asignar plan', handleAsignar)}
            </Section>
          )}

          {modo === 'renovar' && (
            <Section title="Renovar plan" description="Renueva el plan y decide si arrastra pendientes.">
              {sesionesRestantes > 0 ? (
                <Card className="mb-4 border-emerald-400/20 bg-emerald-400/5 p-4">
                  <p className="text-sm text-emerald-300">
                    El cliente tiene {sesionesRestantes} sesiones pendientes. Puedes decidir si se suman o no.
                  </p>
                </Card>
              ) : (
                <Card className="mb-4 border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm text-white/65">Este plan no tiene sesiones pendientes para arrastrar.</p>
                </Card>
              )}
              {renderPlanForm('Renovar plan', handleRenovar)}
            </Section>
          )}

          {modo === 'cancelar' && (
            <Section title="Cancelar plan" description="Selecciona el motivo.">
              <form onSubmit={handleCancelar} className="space-y-5">
                <Field label="Motivo">
                  <div className="space-y-2">
                    {[
                      { value: 'error_creacion', label: 'Error al crear el plan', desc: 'Se creó por equivocación' },
                      { value: 'cliente_no_continua', label: 'Cliente no continuó', desc: 'No siguió asistiendo' },
                      { value: 'plan_vencido', label: 'Plan vencido', desc: 'Llegó la fecha de vencimiento' },
                      { value: 'sesiones_agotadas', label: 'Sesiones agotadas', desc: 'Se completaron todas las sesiones' },
                    ].map((op) => (
                      <label
                        key={op.value}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                          motivoCancelacion === op.value
                            ? 'border-rose-400/30 bg-rose-400/10'
                            : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="motivo"
                          value={op.value}
                          checked={motivoCancelacion === op.value}
                          onChange={(e) => setMotivoCancelacion(e.target.value)}
                          className="mt-0.5 accent-rose-400"
                        />
                        <div>
                          <p className="text-sm font-medium text-white">{op.label}</p>
                          <p className="text-xs text-white/45">{op.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="¿El cliente realizó el pago?">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setPagoAlCancelar('si')}
                      className={`rounded-2xl border p-3 text-left transition ${
                        pagoAlCancelar === 'si'
                          ? 'border-emerald-400/30 bg-emerald-400/10'
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                      }`}
                    >
                      <p className="text-sm font-medium text-white">✓ Sí pagó</p>
                      <p className="mt-1 text-xs text-white/45">
                        Se cancela el plan, pero el pago y la comisión se mantienen.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPagoAlCancelar('no')}
                      className={`rounded-2xl border p-3 text-left transition ${
                        pagoAlCancelar === 'no'
                          ? 'border-rose-400/30 bg-rose-400/10'
                          : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                      }`}
                    >
                      <p className="text-sm font-medium text-white">✗ No pagó</p>
                      <p className="mt-1 text-xs text-white/45">
                        El plan queda cancelado sin efecto económico, como si nunca se hubiera acreditado.
                      </p>
                    </button>
                  </div>
                </Field>

                {errorMsg && (
                  <Card className="p-4">
                    <p className="text-sm text-rose-400">{errorMsg}</p>
                  </Card>
                )}

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-400/15 disabled:opacity-60"
                  >
                    {saving ? 'Cancelando...' : 'Confirmar cancelación'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModo(null)
                      resetForm()
                    }}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
                  >
                    Volver
                  </button>
                </div>
              </form>
            </Section>
          )}
        </div>

        <div className="space-y-4">
          <Section title="Plan activo" description="Estado actual.">
            {!planActivo ? (
              <p className="text-sm text-white/55">Sin plan activo.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-white/45">Plan</p>
                  <p className="mt-1 font-medium text-white">{planActivo.planes?.nombre}</p>
                  <p className="text-sm text-emerald-400">{formatMoney(planActivo.planes?.precio)}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-white/45">Total</p>
                    <p className="font-medium text-white">{planActivo.sesiones_totales}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/45">Usadas</p>
                    <p className="font-medium text-white">{planActivo.sesiones_usadas}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/45">Restantes</p>
                    <p className="font-medium text-emerald-400">{sesionesRestantes}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/45">Estado</p>
                    <p className="font-medium capitalize text-white">{planActivo.estado}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/45">Inicio</p>
                    <p className="font-medium text-white">{formatDate(planActivo.fecha_inicio)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/45">Vence</p>
                    <p className="font-medium text-white">{formatDate(planActivo.fecha_fin)}</p>
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-xs text-white/45">
                    <span>Progreso</span>
                    <span>{progresoUso}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-violet-500/70 transition-all"
                      style={{ width: `${progresoUso}%` }}
                    />
                  </div>
                </div>

                {(planActivo.porcentaje_rpm || planActivo.monto_base_comision) && (
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-xs font-medium text-white/55">Comisión registrada</p>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-white/35">Base</p>
                        <p className="font-medium text-white">{formatMoney(planActivo.monto_base_comision)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/35">% RPM</p>
                        <p className="font-medium text-white">{planActivo.porcentaje_rpm ?? 0}%</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}