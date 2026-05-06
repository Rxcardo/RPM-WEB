'use client'

export const dynamic = 'force-dynamic'

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'
import PagoConDeudaSelector, {
  pagoConDeudaInitial,
  validarPagoConDeuda,
  buildCuentaPorCobrarPayload,
  buildPagosRpcPayload,
  getTasaReferenciaFromState,
  type PagoConDeudaState,
} from '@/components/pagos/PagoConDeudaSelector'

// ─── Types ────────────────────────────────────────────────────────────────────

type Cliente = { id: string; nombre: string; estado: string }
type VigenciaTipo = 'dias' | 'semanas' | 'meses'

type Plan = {
  id: string; nombre: string; sesiones_totales: number
  vigencia_valor: number; vigencia_tipo: VigenciaTipo
  precio: number; estado: string; descripcion: string | null
  comision_base?: number | null; comision_rpm?: number | null; comision_entrenador?: number | null
}

type ClientePlan = {
  id: string; cliente_id: string; plan_id: string
  sesiones_totales: number; sesiones_usadas: number
  fecha_inicio: string | null; fecha_fin: string | null
  estado: string; created_at: string
  planes: Plan | null; origen: string
  porcentaje_rpm: number; monto_base_comision: number | null
}

type Empleado = {
  id: string; nombre: string; rol: string | null
  especialidad: string | null; comision_plan_porcentaje: number; comision_cita_porcentaje: number
}

function esRolTerapeuta(rol: string | null | undefined) {
  const r = (rol || '').trim().toLowerCase()
  return r === 'terapeuta' || r === 'fisioterapeuta'
}

type Recurso = { id: string; nombre: string; tipo: string | null }

type MetodoPago = {
  id: string; nombre: string; tipo: string | null
  moneda?: string | null; cartera?: { nombre: string; codigo: string } | null
}

type EntrenamientoExistente = {
  id: string; hora_inicio: string; hora_fin: string
  fecha: string; estado: string; clientes: { nombre: string } | null
}

type PlanificacionSesiones = {
  fechas: string[]; fechaFinPlan: string; sesionesPosibles: number
  sesionesSolicitadas: number; alcanzaVigencia: boolean
}

type Modo = 'asignar' | 'renovar' | 'cancelar' | null
type OpcionArrastreSesiones = 'si' | 'no'
type TipoRenovacion = 'mismo_plan' | 'otro_plan'

// ─── Constantes ───────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeMetodoPago(row: any): MetodoPago {
  const cartera = firstOrNull(row?.cartera)
  return {
    id: String(row?.id ?? ''), nombre: String(row?.nombre ?? ''),
    tipo: row?.tipo ?? null, moneda: row?.moneda ?? null,
    cartera: cartera ? { nombre: String(cartera?.nombre ?? ''), codigo: String(cartera?.codigo ?? '') } : null,
  }
}

function normalizeEntrenamientoExistente(row: any): EntrenamientoExistente {
  const cliente = firstOrNull(row?.clientes)
  return {
    id: String(row?.id ?? ''), hora_inicio: String(row?.hora_inicio ?? ''),
    hora_fin: String(row?.hora_fin ?? ''), fecha: String(row?.fecha ?? ''),
    estado: String(row?.estado ?? ''),
    clientes: cliente ? { nombre: String(cliente?.nombre ?? '') } : null,
  }
}

function getTodayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function addDaysToDate(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getVigenciaDias(vigenciaValor: number, vigenciaTipo: VigenciaTipo) {
  const valor = Math.max(Number(vigenciaValor || 0), 0)
  if (vigenciaTipo === 'semanas') return valor * 7
  if (vigenciaTipo === 'meses') return valor * 30
  return valor
}

function getFechaFinByVigencia(fechaInicio: string, vigenciaValor: number, vigenciaTipo: VigenciaTipo) {
  return addDaysToDate(fechaInicio, Math.max(getVigenciaDias(vigenciaValor, vigenciaTipo) - 1, 0))
}

function formatVigencia(valor: number | null | undefined, tipo: VigenciaTipo | string | null | undefined) {
  const n = Number(valor || 0); const t = String(tipo || '').toLowerCase()
  if (!n) return '—'
  if (t === 'dias') return `${n} ${n === 1 ? 'día' : 'días'}`
  if (t === 'semanas') return `${n} ${n === 1 ? 'semana' : 'semanas'}`
  if (t === 'meses') return `${n} ${n === 1 ? 'mes' : 'meses'}`
  return `${n}`
}

function formatDate(v: string | null) {
  if (!v) return '—'
  try { return new Date(`${v}T00:00:00`).toLocaleDateString('es') } catch { return v }
}

function formatMoney(v: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v || 0))
}

function formatBs(v: number | null | undefined) {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES', maximumFractionDigits: 2 }).format(Number(v || 0))
}

function getMontoDiferenciaLabel(delta: number) {
  if (delta > 0.009) return 'Debe pagar diferencia'
  if (delta < -0.009) return 'Queda saldo a favor'
  return 'Sin diferencia'
}

function timeToMinutes(t: string) { const [h, m] = t.slice(0, 5).split(':').map(Number); return h * 60 + m }
function minutesToTime(m: number) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
function sumarMinutos(hora: string, minutos: number) { return `${minutesToTime(timeToMinutes(hora) + minutos)}:00` }

function r2(v: number) { return Math.round(v * 100) / 100 }
function clamp(v: number, min: number, max: number) { return Math.min(Math.max(v, min), max) }

function calcularPlanificacionSesiones(
  fechaInicio: string, diasSemana: number[], totalSesiones: number,
  vigenciaValor: number, vigenciaTipo: VigenciaTipo
): PlanificacionSesiones {
  const vigenciaDias = getVigenciaDias(vigenciaValor, vigenciaTipo)
  if (!fechaInicio || !diasSemana.length || !totalSesiones || !vigenciaDias)
    return { fechas: [], fechaFinPlan: fechaInicio || '', sesionesPosibles: 0, sesionesSolicitadas: totalSesiones || 0, alcanzaVigencia: false }
  const fechaFinPlan = getFechaFinByVigencia(fechaInicio, vigenciaValor, vigenciaTipo)
  const current = new Date(`${fechaInicio}T00:00:00`)
  const limite  = new Date(`${fechaFinPlan}T23:59:59`)
  const fechas: string[] = []
  let sesionesPosibles = 0; let guard = 0
  while (current <= limite && guard < 5000) {
    if (diasSemana.includes(current.getDay())) {
      sesionesPosibles++
      if (fechas.length < totalSesiones) fechas.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`)
    }
    current.setDate(current.getDate() + 1); guard++
  }
  return { fechas, fechaFinPlan, sesionesPosibles, sesionesSolicitadas: totalSesiones, alcanzaVigencia: sesionesPosibles >= totalSesiones }
}

function getRolLabel(rol: string | null | undefined) {
  const v = (rol || '').trim().toLowerCase()
  if (v === 'terapeuta' || v === 'fisioterapeuta') return 'Fisioterapeuta'
  if (v === 'entrenador') return 'Entrenador'
  if (!v) return 'Sin rol'
  return v.charAt(0).toUpperCase() + v.slice(1)
}

// ─── UI ───────────────────────────────────────────────────────────────────────

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

// ─── Calendario disponibilidad ────────────────────────────────────────────────

function CalendarioDisponibilidad({
  fechaVista, horaInicio, horaFin, entrenamientosExistentes, onSelectHora,
}: {
  fechaVista: string; horaInicio: string; horaFin: string
  entrenamientosExistentes: EntrenamientoExistente[]
  onSelectHora: (hora: string) => void
}) {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i)
  function getTop(m: number) { return (m / 60) * HOUR_HEIGHT }
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const relY = Math.max(0, Math.min(e.clientY - rect.top, HOUR_HEIGHT * TOTAL_HOURS))
    const raw = (relY / (HOUR_HEIGHT * TOTAL_HOURS)) * TOTAL_HOURS * 60
    onSelectHora(minutesToTime(Math.round(raw / 30) * 30))
  }
  const inicioPx = horaInicio ? getTop(timeToMinutes(horaInicio)) : null
  const finPx    = horaFin    ? getTop(timeToMinutes(horaFin))    : null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-white/40">
        <span>{fechaVista ? new Date(`${fechaVista}T00:00:00`).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'}</span>
        <div className="flex gap-3">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-rose-500/70" />Ocupado</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-violet-500/70" />Nueva sesión</span>
        </div>
      </div>
      <div className="relative cursor-pointer overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02]" style={{ height: 380 }}>
        <div className="relative select-none" style={{ height: HOUR_HEIGHT * TOTAL_HOURS }} onClick={handleClick}>
          {hours.map((h) => (
            <div key={h} className="pointer-events-none absolute left-0 right-0 flex items-start" style={{ top: h * HOUR_HEIGHT }}>
              <span className="w-12 shrink-0 -translate-y-2 pr-2 text-right text-xs text-white/25">{h < 24 ? `${String(h).padStart(2, '0')}:00` : ''}</span>
              <div className="flex-1 border-t border-white/[0.06]" />
            </div>
          ))}
          {Array.from({ length: TOTAL_HOURS }, (_, h) => (
            <div key={`hh-${h}`} className="pointer-events-none absolute left-12 right-0 border-t border-white/[0.03]" style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
          ))}
          {entrenamientosExistentes.map((e) => {
            const top = getTop(timeToMinutes(e.hora_inicio))
            const height = Math.max(20, getTop(timeToMinutes(e.hora_fin)) - top)
            return (
              <div key={e.id} className="pointer-events-none absolute left-12 right-2 overflow-hidden rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1" style={{ top, height }}>
                <p className="truncate text-xs font-medium text-rose-300">{e.clientes?.nombre || 'Cliente'}</p>
                <p className="text-xs text-rose-400/70">{e.hora_inicio.slice(0, 5)} – {e.hora_fin.slice(0, 5)}</p>
              </div>
            )
          })}
          {inicioPx !== null && finPx !== null && (
            <div className="pointer-events-none absolute left-12 right-2 overflow-hidden rounded-lg border border-violet-400/30 bg-violet-500/15 px-2 py-1" style={{ top: inicioPx, height: Math.max(20, finPx - inicioPx) }}>
              <p className="text-xs font-semibold text-violet-300">Nueva sesión</p>
              <p className="text-xs text-violet-400/70">{horaInicio} – {horaFin?.slice(0, 5)}</p>
            </div>
          )}
          {fechaVista === getTodayLocal() && (
            <div className="pointer-events-none absolute left-0 right-0" style={{ top: getTop(new Date().getHours() * 60 + new Date().getMinutes()) }}>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientePlanPage() {
  const params = useParams()
  const router = useRouter()
  const id     = params?.id as string

  const assigningRef  = useRef(false)
  const renewingRef   = useRef(false)
  const cancellingRef = useRef(false)

  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [modo, setModo]         = useState<Modo>(null)

  const [cliente, setCliente]         = useState<Cliente | null>(null)
  const [planes, setPlanes]           = useState<Plan[]>([])
  const [planActivo, setPlanActivo]   = useState<ClientePlan | null>(null)
  const [empleados, setEmpleados]     = useState<Empleado[]>([])
  const [recursos, setRecursos]       = useState<Recurso[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])
  const [entrenamientosEmpleado, setEntrenamientosEmpleado] = useState<EntrenamientoExistente[]>([])

  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [fechaInicio, setFechaInicio]       = useState(getTodayLocal())
  const [empleadoId, setEmpleadoId]         = useState('')
  const [recursoId, setRecursoId]           = useState('')
  const [diasSemana, setDiasSemana]         = useState<number[]>([])
  const [horaInicio, setHoraInicio]         = useState('')
  const [duracionMin, setDuracionMin]       = useState(60)
  const [fechaVistaCal, setFechaVistaCal]   = useState(getTodayLocal())

  // Pago
  const [registrarPago, setRegistrarPago]   = useState(true)
  const [usarPrecioPlan, setUsarPrecioPlan] = useState(true)
  const [montoPersonalizado, setMontoPersonalizado] = useState('')
  const [notasPagoGenerales, setNotasPagoGenerales] = useState('')
  const [fechaPago, setFechaPago]         = useState(getTodayLocal())
  const [pagoState, setPagoState]           = useState<PagoConDeudaState>(pagoConDeudaInitial())

  // Cancelar
  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const [pagoAlCancelar, setPagoAlCancelar]       = useState<'si' | 'no' | null>(null)

  // Renovar
  const [renovarConPendientes, setRenovarConPendientes] = useState<OpcionArrastreSesiones>('si')
  const [tipoRenovacion, setTipoRenovacion]             = useState<TipoRenovacion>('mismo_plan')
  const [registrarAjustePlan, setRegistrarAjustePlan]   = useState(true)

  // Comisión
  const [porcentajeRpmEditable, setPorcentajeRpmEditable]               = useState(50)
  const [porcentajeEntrenadorEditable, setPorcentajeEntrenadorEditable] = useState(50)

  // Crear plan inline
  const [mostrarCrearPlan, setMostrarCrearPlan]           = useState(false)
  const [nuevoPlanNombre, setNuevoPlanNombre]             = useState('')
  const [nuevoPlanSesiones, setNuevoPlanSesiones]         = useState(12)
  const [nuevoPlanVigencia, setNuevoPlanVigencia]         = useState(30)
  const [nuevoPlanVigenciaTipo, setNuevoPlanVigenciaTipo] = useState<VigenciaTipo>('dias')
  const [nuevoPlanPrecio, setNuevoPlanPrecio]             = useState('')
  const [creandoPlan, setCreandoPlan]                     = useState(false)

  // ─── Effects ────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [clienteRes, planesRes, planActivoRes, empleadosRes, recursosRes, metodosRes] = await Promise.all([
      supabase.from('clientes').select('id, nombre, estado').eq('id', id).single(),
      supabase.from('planes').select('id, nombre, sesiones_totales, vigencia_valor, vigencia_tipo, precio, estado, descripcion, comision_base, comision_rpm, comision_entrenador').eq('estado', 'activo').order('nombre'),
      supabase.from('clientes_planes').select(`id, cliente_id, plan_id, sesiones_totales, sesiones_usadas, fecha_inicio, fecha_fin, estado, created_at, origen, porcentaje_rpm, monto_base_comision, planes:plan_id (id, nombre, sesiones_totales, vigencia_valor, vigencia_tipo, precio, estado, descripcion, comision_base, comision_rpm, comision_entrenador)`).eq('cliente_id', id).eq('estado', 'activo').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('empleados').select('id, nombre, rol, especialidad, comision_plan_porcentaje, comision_cita_porcentaje').eq('estado', 'activo').in('rol', ['terapeuta', 'fisioterapeuta']).order('nombre'),
      supabase.from('recursos').select('id, nombre, tipo').order('nombre'),
      supabase.from('metodos_pago_v2').select(`id, nombre, tipo, moneda, cartera:carteras(nombre, codigo)`).eq('activo', true).eq('permite_recibir', true).order('orden', { ascending: true }).order('nombre', { ascending: true }),
    ])
    if (clienteRes.error || !clienteRes.data) { setErrorMsg('No se pudo cargar el cliente.'); setLoading(false); return }
    setCliente(clienteRes.data as Cliente)
    setPlanes((planesRes.data || []) as Plan[])
    setPlanActivo((planActivoRes.data as ClientePlan | null) || null)
    setEmpleados(((empleadosRes.data || []) as Empleado[]).filter((e) => esRolTerapeuta(e.rol)))
    setRecursos((recursosRes.data || []) as Recurso[])
    setMetodosPago(((metodosRes.data || []) as any[]).map(normalizeMetodoPago))
    setLoading(false)
  }, [id])

  useEffect(() => { void fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!empleadoId || !fechaVistaCal) { setEntrenamientosEmpleado([]); return }
    void supabase.from('entrenamientos').select('id, hora_inicio, hora_fin, fecha, estado, clientes:cliente_id ( nombre )').eq('empleado_id', empleadoId).eq('fecha', fechaVistaCal).neq('estado', 'cancelado').order('hora_inicio')
      .then(({ data }) => setEntrenamientosEmpleado(((data || []) as any[]).map(normalizeEntrenamientoExistente)))
  }, [empleadoId, fechaVistaCal])

  // Reset pagoState cuando cambia plan o precio
  useEffect(() => { setPagoState(pagoConDeudaInitial()) }, [selectedPlanId, usarPrecioPlan])

  useEffect(() => {
    if (modo !== 'renovar' || !planActivo) return

    if (tipoRenovacion === 'mismo_plan') {
      setSelectedPlanId(planActivo.plan_id || '')
      setUsarPrecioPlan(true)
      setMontoPersonalizado('')
    } else if (tipoRenovacion === 'otro_plan' && selectedPlanId === planActivo.plan_id) {
      setSelectedPlanId('')
      setUsarPrecioPlan(true)
      setMontoPersonalizado('')
    }
  }, [modo, tipoRenovacion, planActivo?.id])

  // ─── Derived ────────────────────────────────────────────────────────

  const selectedPlan = useMemo(() => planes.find((p) => p.id === selectedPlanId) || null, [planes, selectedPlanId])
  const horaFin = useMemo(() => horaInicio ? sumarMinutos(horaInicio, duracionMin) : '', [horaInicio, duracionMin])

  const montoBase = useMemo(
    () => usarPrecioPlan ? selectedPlan?.precio || 0 : Number(montoPersonalizado || 0),
    [usarPrecioPlan, selectedPlan, montoPersonalizado]
  )

  const montoBaseComisionPlan = useMemo(() => Number(selectedPlan?.comision_base ?? selectedPlan?.precio ?? 0), [selectedPlan])
  const montoRpmPlan          = useMemo(() => Number(selectedPlan?.comision_rpm ?? 0), [selectedPlan])
  const montoEntrenadorPlan   = useMemo(() => Number(selectedPlan?.comision_entrenador ?? 0), [selectedPlan])
  const porcentajeRpmPlan     = useMemo(() => !montoBaseComisionPlan ? 0 : r2((montoRpmPlan / montoBaseComisionPlan) * 100), [montoBaseComisionPlan, montoRpmPlan])

  useEffect(() => {
    if (!selectedPlan) { setPorcentajeRpmEditable(50); setPorcentajeEntrenadorEditable(50); return }
    const rpmPct = clamp(r2(porcentajeRpmPlan > 0 ? porcentajeRpmPlan : montoBaseComisionPlan > 0 ? (montoRpmPlan / montoBaseComisionPlan) * 100 : 50), 0, 100)
    setPorcentajeRpmEditable(rpmPct); setPorcentajeEntrenadorEditable(r2(100 - rpmPct))
  }, [selectedPlan?.id])

  const baseComisionAplicada     = useMemo(() => r2(Math.max(Number(montoBase || 0), 0)), [montoBase])
  const porcentajeRpmAplicado    = useMemo(() => clamp(r2(porcentajeRpmEditable), 0, 100), [porcentajeRpmEditable])
  const porcentajeEntrenadorAplicado = useMemo(() => clamp(r2(100 - porcentajeRpmAplicado), 0, 100), [porcentajeRpmAplicado])
  const montoRpmAplicado         = useMemo(() => r2((baseComisionAplicada * porcentajeRpmAplicado) / 100), [baseComisionAplicada, porcentajeRpmAplicado])
  const montoEntrenadorAplicado  = useMemo(() => r2(baseComisionAplicada - montoRpmAplicado), [baseComisionAplicada, montoRpmAplicado])
  const comisionBalanceOk        = useMemo(() => Math.abs(r2(montoRpmAplicado + montoEntrenadorAplicado) - baseComisionAplicada) < 0.01, [montoRpmAplicado, montoEntrenadorAplicado, baseComisionAplicada])

  const tasaReferenciaComision = useMemo(() => getTasaReferenciaFromState(pagoState), [pagoState])

  const comisionEquivalentes = useMemo(() => {
    if (!tasaReferenciaComision || tasaReferenciaComision <= 0)
      return { monto_base_usd: baseComisionAplicada, monto_base_bs: null, monto_rpm_usd: montoRpmAplicado, monto_rpm_bs: null, monto_profesional_usd: montoEntrenadorAplicado, monto_profesional_bs: null }
    return {
      monto_base_usd: baseComisionAplicada, monto_base_bs: r2(baseComisionAplicada * tasaReferenciaComision),
      monto_rpm_usd: montoRpmAplicado,      monto_rpm_bs:  r2(montoRpmAplicado * tasaReferenciaComision),
      monto_profesional_usd: montoEntrenadorAplicado, monto_profesional_bs: r2(montoEntrenadorAplicado * tasaReferenciaComision),
    }
  }, [baseComisionAplicada, montoRpmAplicado, montoEntrenadorAplicado, tasaReferenciaComision])

  const sesionesRestantes = planActivo ? Math.max(Number(planActivo.sesiones_totales) - Number(planActivo.sesiones_usadas), 0) : 0
  const progresoUso       = planActivo ? Math.min(Math.round((Number(planActivo.sesiones_usadas) / Math.max(Number(planActivo.sesiones_totales), 1)) * 100), 100) : 0

  const totalPreviewSesiones = useMemo(() => {
    if (!selectedPlan) return 0
    return modo === 'renovar' ? (renovarConPendientes === 'si' ? selectedPlan.sesiones_totales + sesionesRestantes : selectedPlan.sesiones_totales) : selectedPlan.sesiones_totales
  }, [selectedPlan, modo, renovarConPendientes, sesionesRestantes])

  const precioPlanActual = Number(planActivo?.planes?.precio || 0)
  const precioPlanNuevo  = Number(selectedPlan?.precio || 0)

  const ajusteFinancieroPlan = useMemo(() => {
    if (modo !== 'asignar' || !planActivo || !selectedPlan) return 0
    return r2(precioPlanNuevo - precioPlanActual)
  }, [modo, planActivo, selectedPlan, precioPlanActual, precioPlanNuevo])

  const montoObjetivoPago = useMemo(() => {
    if (modo === 'asignar' && planActivo && selectedPlan) return r2(Math.max(ajusteFinancieroPlan, 0))
    return r2(montoBase)
  }, [modo, planActivo, selectedPlan, ajusteFinancieroPlan, montoBase])

  const planificacionPreview = useMemo(() => {
    if (!selectedPlan || !fechaInicio || !diasSemana.length || !totalPreviewSesiones) return null
    return calcularPlanificacionSesiones(fechaInicio, diasSemana, totalPreviewSesiones, selectedPlan.vigencia_valor, selectedPlan.vigencia_tipo)
  }, [selectedPlan, fechaInicio, diasSemana, totalPreviewSesiones])

  const fechaFinPreview   = useMemo(() => planificacionPreview?.fechaFinPlan || null, [planificacionPreview])
  const fechasPreview     = useMemo(() => planificacionPreview?.fechas || [], [planificacionPreview])
  const faltanSesionesPreview = useMemo(() => {
    if (!planificacionPreview) return 0
    return Math.max(planificacionPreview.sesionesSolicitadas - planificacionPreview.fechas.length, 0)
  }, [planificacionPreview])

  // ─── Handlers comisión ───────────────────────────────────────────────

  function handleChangeMontoRpm(v: string) { const m = clamp(Number(v || 0), 0, baseComisionAplicada); const p = baseComisionAplicada > 0 ? r2((m / baseComisionAplicada) * 100) : 0; setPorcentajeRpmEditable(p); setPorcentajeEntrenadorEditable(r2(100 - p)) }
  function handleChangeMontoEntrenador(v: string) { const m = clamp(Number(v || 0), 0, baseComisionAplicada); const p = baseComisionAplicada > 0 ? r2((m / baseComisionAplicada) * 100) : 0; setPorcentajeEntrenadorEditable(p); setPorcentajeRpmEditable(r2(100 - p)) }
  function handleChangePorcentajeRpm(v: string) { const p = clamp(Number(v || 0), 0, 100); setPorcentajeRpmEditable(r2(p)); setPorcentajeEntrenadorEditable(r2(100 - p)) }
  function handleChangePorcentajeEntrenador(v: string) { const p = clamp(Number(v || 0), 0, 100); setPorcentajeEntrenadorEditable(r2(p)); setPorcentajeRpmEditable(r2(100 - p)) }
  function resetearComisionAlPlan() { const p = clamp(porcentajeRpmPlan > 0 ? porcentajeRpmPlan : 50, 0, 100); setPorcentajeRpmEditable(r2(p)); setPorcentajeEntrenadorEditable(r2(100 - p)) }
  function toggleDia(dia: number) { setDiasSemana((prev) => prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]) }

  function resetForm() {
    setSelectedPlanId(''); setFechaInicio(getTodayLocal()); setEmpleadoId(''); setRecursoId('')
    setDiasSemana([]); setHoraInicio(''); setDuracionMin(60); setRegistrarPago(true)
    setUsarPrecioPlan(true); setMontoPersonalizado(''); setNotasPagoGenerales(''); setFechaPago(getTodayLocal())
    setPagoState(pagoConDeudaInitial())
    setMotivoCancelacion(''); setPagoAlCancelar(null); setFechaVistaCal(getTodayLocal())
    setErrorMsg(''); setSuccessMsg(''); setRenovarConPendientes('si'); setTipoRenovacion('mismo_plan'); setRegistrarAjustePlan(true)
    setPorcentajeRpmEditable(50); setPorcentajeEntrenadorEditable(50)
    setMostrarCrearPlan(false); setNuevoPlanNombre(''); setNuevoPlanSesiones(12)
    setNuevoPlanVigencia(30); setNuevoPlanVigenciaTipo('dias'); setNuevoPlanPrecio('')
  }

  // ─── Crear plan inline ────────────────────────────────────────────────

  async function crearPlanInline() {
    if (!nuevoPlanNombre.trim()) { alert('Ingresa el nombre del plan.'); return }
    if (!nuevoPlanPrecio || Number(nuevoPlanPrecio) <= 0) { alert('Ingresa un precio válido.'); return }
    setCreandoPlan(true)
    try {
      const { data: plan, error } = await supabase.from('planes').insert({
        nombre: nuevoPlanNombre.trim(), sesiones_totales: nuevoPlanSesiones, vigencia_valor: nuevoPlanVigencia,
        vigencia_tipo: nuevoPlanVigenciaTipo, precio: Number(nuevoPlanPrecio),
        comision_base: Number(nuevoPlanPrecio), comision_rpm: r2(Number(nuevoPlanPrecio) * 0.5),
        comision_entrenador: r2(Number(nuevoPlanPrecio) * 0.5), estado: 'activo',
      }).select('id, nombre, sesiones_totales, vigencia_valor, vigencia_tipo, precio, estado, descripcion, comision_base, comision_rpm, comision_entrenador').single()
      if (error) throw new Error(error.message)
      setPlanes((prev) => [...prev, plan as Plan].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setSelectedPlanId(plan.id); setMostrarCrearPlan(false)
      setNuevoPlanNombre(''); setNuevoPlanSesiones(12); setNuevoPlanVigencia(30); setNuevoPlanVigenciaTipo('dias'); setNuevoPlanPrecio('')
    } catch (err: any) { alert(err?.message || 'Error al crear el plan.') }
    finally { setCreandoPlan(false) }
  }

  // ─── Registrar comisión ───────────────────────────────────────────────

  async function registrarComision(clientePlanId: string, empId: string, clienteIdValue: string, base: number, fecha: string, rpm: number, profesional: number) {
    try {
      const { data: existente } = await supabase.from('comisiones_detalle').select('id').eq('cliente_plan_id', clientePlanId).eq('empleado_id', empId).eq('tipo', 'plan').limit(1).maybeSingle()
      if (existente?.id) return
      const { error } = await supabase.from('comisiones_detalle').insert({
        empleado_id: empId, cliente_id: clienteIdValue, cliente_plan_id: clientePlanId,
        fecha, base, profesional, rpm, tipo: 'plan', estado: 'pendiente',
        porcentaje_rpm: porcentajeRpmAplicado, moneda: tasaReferenciaComision ? 'BS' : 'USD', tasa_bcv: tasaReferenciaComision,
        monto_base_usd: comisionEquivalentes.monto_base_usd, monto_base_bs: comisionEquivalentes.monto_base_bs,
        monto_rpm_usd: comisionEquivalentes.monto_rpm_usd,   monto_rpm_bs: comisionEquivalentes.monto_rpm_bs,
        monto_profesional_usd: comisionEquivalentes.monto_profesional_usd, monto_profesional_bs: comisionEquivalentes.monto_profesional_bs,
      })
      if (error) console.error('❌ Error comisión:', error.message)
    } catch (err) { console.error('❌', err) }
  }

  // ─── Helpers de plan ─────────────────────────────────────────────────

  async function cancelarPlanAnterior(planId: string, detalle: string) {
    await supabase.from('clientes_planes').update({ estado: 'cancelado' }).eq('id', planId)
    await supabase.from('entrenamientos').update({ estado: 'cancelado' }).eq('cliente_plan_id', planId).eq('estado', 'programado')
    const { data: eventoExistente } = await supabase.from('clientes_planes_eventos').select('id').eq('cliente_plan_id', planId).eq('cliente_id', id).eq('tipo', 'cancelado').eq('detalle', detalle).limit(1).maybeSingle()
    if (!eventoExistente?.id) await supabase.from('clientes_planes_eventos').insert({ cliente_plan_id: planId, cliente_id: id, tipo: 'cancelado', detalle })
  }

  function buildEntrenamientoKey(fecha: string, hi: string, hf: string, empId: string) { return `${fecha}__${hi}__${hf}__${empId}` }

  async function ensureEntrenamientos(clientePlanId: string, fechas: string[], empId: string, hiN: string, hfN: string, recId: string) {
    const { data: existentes, error: exErr } = await supabase.from('entrenamientos').select('id, fecha, hora_inicio, hora_fin, empleado_id').eq('cliente_plan_id', clientePlanId)
    if (exErr) throw new Error(`Entrenamientos: ${exErr.message}`)
    const existentesSet = new Set(((existentes || []) as any[]).map((row) => buildEntrenamientoKey(String(row.fecha || ''), String(row.hora_inicio || ''), String(row.hora_fin || ''), String(row.empleado_id || ''))))
    const payload = fechas.map((f) => ({
      cliente_plan_id: clientePlanId, cliente_id: id, empleado_id: empId, recurso_id: recId || null,
      fecha: f, hora_inicio: hiN, hora_fin: hfN, estado: 'programado', asistencia_estado: 'pendiente',
      aviso_previo: false, consume_sesion: false, reprogramable: false, motivo_asistencia: null, reprogramado_de_entrenamiento_id: null,
    })).filter((item) => !existentesSet.has(buildEntrenamientoKey(item.fecha, item.hora_inicio, item.hora_fin, item.empleado_id)))
    if (!payload.length) return
    const { error } = await supabase.from('entrenamientos').insert(payload)
    if (error) throw new Error(`Entrenamientos: ${error.message}`)
  }

  async function registrarCuentaPorCobrarAjustePlan(montoUsd: number, concepto: string, fecha: string) {
    if (montoUsd <= 0.009) return
    const { error } = await supabase.from('cuentas_por_cobrar').insert({
      cliente_id: id, cliente_nombre: cliente?.nombre || 'Cliente', concepto, tipo_origen: 'otro',
      monto_total_usd: montoUsd, monto_pagado_usd: 0, saldo_usd: montoUsd,
      fecha_venta: fecha, estado: 'pendiente', notas: 'Generado automáticamente por cambio de plan.', registrado_por: null,
    })
    if (error) throw new Error(`Ajuste financiero: ${error.message}`)
  }

  async function registrarCreditoClienteCambioPlan(montoUsd: number, descripcion: string, fecha: string) {
    if (montoUsd <= 0.009) return
    const { error } = await supabase.from('clientes_credito').insert({
      cliente_id: id, origen_tipo: 'ajuste_plan', origen_id: planActivo?.id || null,
      moneda: 'USD', monto_original: montoUsd, monto_disponible: montoUsd,
      tasa_bcv: null, monto_original_bs: null, monto_disponible_bs: null,
      descripcion, fecha, estado: 'activo', registrado_por: null,
    })
    if (error) throw new Error(`Crédito: ${error.message}`)
  }

  // ─── Registrar pago + deuda ───────────────────────────────────────────

  async function registrarPagoPlan(clientePlanId: string, concepto: string) {
    if (!registrarPago || montoObjetivoPago <= 0.009) return

    if (pagoState.tipoCobro !== 'sin_pago') {
      const pagosPayload = buildPagosRpcPayload(pagoState, montoObjetivoPago)
      if (pagosPayload) {
        const { error } = await supabase.rpc('registrar_pagos_mixtos', {
          p_fecha: fechaPago, p_tipo_origen: 'plan', p_categoria: 'plan', p_concepto: concepto,
          p_cliente_id: id, p_cita_id: null, p_cliente_plan_id: clientePlanId,
          p_cuenta_cobrar_id: null, p_inventario_id: null, p_registrado_por: null,
          p_notas_generales: notasPagoGenerales || null, p_pagos: pagosPayload,
        })
        if (error) throw new Error(`Pago: ${error.message}`)
      }
    }

    // Crear cuenta por cobrar si hay deuda
    const cxcPayload = buildCuentaPorCobrarPayload({
      state: pagoState, montoTotal: montoObjetivoPago, clienteId: id,
      clienteNombre: cliente?.nombre || 'Cliente', concepto, fecha: fechaPago, registradoPor: null,
    })
    if (cxcPayload) {
      const { error: cxcErr } = await supabase.from('cuentas_por_cobrar').insert(cxcPayload)
      if (cxcErr) console.warn('No se pudo crear cuenta por cobrar:', cxcErr.message)
    }
  }

  // ─── Asignar ─────────────────────────────────────────────────────────

  async function handleAsignar(e: React.FormEvent) {
    e.preventDefault()
    if (assigningRef.current || saving) return
    setErrorMsg(''); setSuccessMsg('')
    if (!selectedPlanId) { setErrorMsg('Selecciona un plan.'); return }
    if (!fechaInicio)    { setErrorMsg('Selecciona fecha de inicio.'); return }
    if (!empleadoId)     { setErrorMsg('Selecciona un fisioterapeuta.'); return }
    if (!diasSemana.length) { setErrorMsg('Selecciona al menos un día.'); return }
    if (!horaInicio)     { setErrorMsg('Selecciona la hora.'); return }

    if (registrarPago && montoObjetivoPago > 0.009) {
      if (!comisionBalanceOk) { setErrorMsg('La distribución de comisión no cuadra correctamente.'); return }
      const errorPago = validarPagoConDeuda(pagoState, montoObjetivoPago)
      if (errorPago) { setErrorMsg(errorPago); return }
    }

    const plan = selectedPlan!
    const planificacion = calcularPlanificacionSesiones(fechaInicio, diasSemana, plan.sesiones_totales, plan.vigencia_valor, plan.vigencia_tipo)
    if (!planificacion.alcanzaVigencia) { setErrorMsg(`No caben ${plan.sesiones_totales} sesiones dentro de la vigencia. Solo caben ${planificacion.sesionesPosibles} entre ${formatDate(fechaInicio)} y ${formatDate(planificacion.fechaFinPlan)}.`); return }

    assigningRef.current = true; setSaving(true)
    try {
      if (planActivo) await cancelarPlanAnterior(planActivo.id, 'Reemplazado manualmente por asignación de un nuevo plan')
      const { data: np, error: cpE } = await supabase.from('clientes_planes').insert({
        cliente_id: id, plan_id: plan.id, sesiones_totales: plan.sesiones_totales, sesiones_usadas: 0,
        fecha_inicio: fechaInicio, fecha_fin: planificacion.fechaFinPlan, estado: 'activo',
      }).select('id').single()
      if (cpE) throw new Error(cpE.message)
      const hiN = horaInicio.length === 5 ? `${horaInicio}:00` : horaInicio
      const hfN = horaFin.length    === 5 ? `${horaFin}:00`    : horaFin
      await ensureEntrenamientos(np.id, planificacion.fechas, empleadoId, hiN, hfN, recursoId)
      const concepto = `Plan: ${plan.nombre} — ${cliente?.nombre || 'Cliente'}`
      await registrarPagoPlan(np.id, concepto)
      if (baseComisionAplicada > 0) await registrarComision(np.id, empleadoId, id, baseComisionAplicada, fechaPago, montoRpmAplicado, montoEntrenadorAplicado)
      await supabase.from('clientes_planes').update({ origen: 'manual', porcentaje_rpm: porcentajeRpmAplicado, monto_base_comision: baseComisionAplicada }).eq('id', np.id)
      if (registrarAjustePlan && ajusteFinancieroPlan > 0.009 && planActivo) await registrarCuentaPorCobrarAjustePlan(ajusteFinancieroPlan, `Ajuste por cambio de plan: ${planActivo.planes?.nombre || 'Plan actual'} → ${plan.nombre}`, fechaInicio)
      if (ajusteFinancieroPlan < -0.009 && planActivo) await registrarCreditoClienteCambioPlan(Math.abs(ajusteFinancieroPlan), `Saldo a favor por cambio de plan: ${planActivo.planes?.nombre || 'Plan actual'} → ${plan.nombre}`, fechaInicio)

      const mensajeAjuste = ajusteFinancieroPlan > 0.009 ? (registrarAjustePlan ? ` Se generó cuenta por cobrar por ${formatMoney(ajusteFinancieroPlan)}.` : ` Diferencia por cobrar: ${formatMoney(ajusteFinancieroPlan)}.`) : ajusteFinancieroPlan < -0.009 ? ` Saldo a favor registrado: ${formatMoney(Math.abs(ajusteFinancieroPlan))}.` : planActivo && selectedPlan ? ' Sin cobro adicional.' : ''
      setSuccessMsg(`Plan "${plan.nombre}" asignado. ${planificacion.fechas.length} entrenamientos generados.${mensajeAjuste}`)
      resetForm(); setModo(null); await fetchAll()
    } catch (err: any) { setErrorMsg(err?.message || 'Error al asignar el plan.') }
    finally { setSaving(false); assigningRef.current = false }
  }

  // ─── Renovar ─────────────────────────────────────────────────────────

  async function handleRenovar(e: React.FormEvent) {
    e.preventDefault()
    if (renewingRef.current || saving) return
    setErrorMsg(''); setSuccessMsg('')
    if (!selectedPlanId) { setErrorMsg('Selecciona un plan.'); return }
    if (!fechaInicio)    { setErrorMsg('Selecciona fecha de inicio.'); return }
    if (!empleadoId)     { setErrorMsg('Selecciona un fisioterapeuta.'); return }
    if (!diasSemana.length) { setErrorMsg('Selecciona al menos un día.'); return }
    if (!horaInicio)     { setErrorMsg('Selecciona la hora.'); return }

    if (registrarPago) {
      if (montoBase <= 0) { setErrorMsg('El monto del plan debe ser mayor a 0.'); return }
      if (!comisionBalanceOk) { setErrorMsg('La distribución de comisión no cuadra correctamente.'); return }
      const errorPago = validarPagoConDeuda(pagoState, montoBase)
      if (errorPago) { setErrorMsg(errorPago); return }
    }

    const plan = selectedPlan!
    const sesN = renovarConPendientes === 'si' ? plan.sesiones_totales + sesionesRestantes : plan.sesiones_totales
    const planificacion = calcularPlanificacionSesiones(fechaInicio, diasSemana, sesN, plan.vigencia_valor, plan.vigencia_tipo)
    if (!planificacion.alcanzaVigencia) { setErrorMsg(`No caben ${sesN} sesiones dentro de la vigencia.`); return }

    renewingRef.current = true; setSaving(true)
    try {
      if (planActivo) await cancelarPlanAnterior(planActivo.id, renovarConPendientes === 'si' ? `Renovado arrastrando ${sesionesRestantes} sesiones pendientes` : 'Renovado sin arrastrar sesiones pendientes')
      const { data: np, error: cpE } = await supabase.from('clientes_planes').insert({
        cliente_id: id, plan_id: plan.id, sesiones_totales: sesN, sesiones_usadas: 0,
        fecha_inicio: fechaInicio, fecha_fin: planificacion.fechaFinPlan, estado: 'activo',
      }).select('id').single()
      if (cpE) throw new Error(cpE.message)
      const hiN = horaInicio.length === 5 ? `${horaInicio}:00` : horaInicio
      const hfN = horaFin.length    === 5 ? `${horaFin}:00`    : horaFin
      await ensureEntrenamientos(np.id, planificacion.fechas, empleadoId, hiN, hfN, recursoId)
      const concepto = renovarConPendientes === 'si' ? `Renovación: ${plan.nombre} — ${cliente?.nombre || 'Cliente'} (+${sesionesRestantes} pendientes)` : `Renovación: ${plan.nombre} — ${cliente?.nombre || 'Cliente'} (sin pendientes)`
      await registrarPagoPlan(np.id, concepto)
      if (baseComisionAplicada > 0) await registrarComision(np.id, empleadoId, id, baseComisionAplicada, fechaPago, montoRpmAplicado, montoEntrenadorAplicado)
      await supabase.from('clientes_planes').update({ origen: 'manual', porcentaje_rpm: porcentajeRpmAplicado, monto_base_comision: baseComisionAplicada }).eq('id', np.id)
      setSuccessMsg(renovarConPendientes === 'si' ? `Plan renovado. Se conservaron ${sesionesRestantes} sesiones pendientes. Total: ${sesN} sesiones.` : `Plan renovado. Total: ${sesN} sesiones.`)
      resetForm(); setModo(null); await fetchAll()
    } catch (err: any) { setErrorMsg(err?.message || 'Error al renovar.') }
    finally { setSaving(false); renewingRef.current = false }
  }

  // ─── Cancelar / limpiar efecto económico ────────────────────────────────

  async function getCuentasPorCobrarPlan(clientePlanId: string) {
    const clienteNombre = cliente?.nombre || ''
    const planNombre = planActivo?.planes?.nombre || ''

    const filtros = [
      `origen_id.eq.${clientePlanId}`,
      `concepto.ilike.%${planNombre}%`,
      `concepto.ilike.%${clienteNombre}%`,
    ].filter(Boolean).join(',')

    const { data, error } = await supabase
      .from('cuentas_por_cobrar')
      .select('id, concepto, estado, saldo_usd, monto_total_usd')
      .eq('cliente_id', id)
      .or(filtros)

    if (error) throw new Error(`Buscar deuda del plan: ${error.message}`)
    return (data || []) as Array<{ id: string; concepto: string | null; estado: string | null; saldo_usd: number | null; monto_total_usd: number | null }>
  }

  async function getPagosPlan(clientePlanId: string) {
    const { data, error } = await supabase
      .from('pagos')
      .select('id, concepto, estado, monto, monto_usd, monto_bs')
      .eq('cliente_id', id)
      .eq('cliente_plan_id', clientePlanId)

    if (error) throw new Error(`Buscar pagos del plan: ${error.message}`)
    return (data || []) as Array<{ id: string; concepto: string | null; estado: string | null; monto?: number | null; monto_usd?: number | null; monto_bs?: number | null }>
  }

  async function eliminarEfectoEconomicoPlan(clientePlanId: string) {
    const cuentas = await getCuentasPorCobrarPlan(clientePlanId)
    const pagos = await getPagosPlan(clientePlanId)

    const cuentaIds = cuentas.map((c) => c.id).filter(Boolean)
    const pagoIds = pagos.map((p) => p.id).filter(Boolean)

    // 1) Primero se eliminan movimientos dependientes para que no bloqueen los DELETE.
    // Si la tabla no existe o alguna columna no existe, no se detiene la cancelación.
    if (cuentaIds.length) {
      const { error } = await supabase
        .from('movimientos_inventario')
        .delete()
        .in('cuenta_cobrar_id', cuentaIds)
      if (error) console.warn('No se pudieron eliminar movimientos por cuenta por cobrar:', error.message)
    }

    if (pagoIds.length) {
      const { error } = await supabase
        .from('movimientos_inventario')
        .delete()
        .in('pago_id', pagoIds)
      if (error) console.warn('No se pudieron eliminar movimientos por pago:', error.message)
    }

    // 2) Eliminar pagos reales o parciales del plan.
    // Esto cubre: no pagó, pagó mitad, pago mixto, pago viejo cargado por error.
    if (pagoIds.length) {
      const { error } = await supabase
        .from('pagos')
        .delete()
        .in('id', pagoIds)
      if (error) throw new Error(`Eliminar pagos del plan: ${error.message}`)
    }

    // 3) Eliminar deuda/cuenta por cobrar del plan.
    // No usamos estado='anulado' porque tu check constraint no lo permite.
    if (cuentaIds.length) {
      const { error } = await supabase
        .from('cuentas_por_cobrar')
        .delete()
        .in('id', cuentaIds)
      if (error) throw new Error(`Eliminar deuda del plan: ${error.message}`)
    }

    // 4) Eliminar comisiones pendientes del plan.
    // Si ya estuvieran liquidadas/pagadas, no se borran para no romper liquidaciones históricas.
    const { error: comisionError } = await supabase
      .from('comisiones_detalle')
      .delete()
      .eq('cliente_plan_id', clientePlanId)
      .eq('tipo', 'plan')
      .eq('estado', 'pendiente')

    if (comisionError) throw new Error(`Eliminar comisiones del plan: ${comisionError.message}`)

    return {
      cuentasEliminadas: cuentaIds.length,
      pagosEliminados: pagoIds.length,
    }
  }

  async function handleCancelar(e: React.FormEvent) {
    e.preventDefault()
    if (cancellingRef.current || saving) return
    setErrorMsg('')
    setSuccessMsg('')
    if (!motivoCancelacion) { setErrorMsg('Selecciona el motivo.'); return }
    if (pagoAlCancelar === null) { setErrorMsg('Indica si el cliente realizó el pago.'); return }
    if (!planActivo) { setErrorMsg('No hay plan activo.'); return }

    cancellingRef.current = true
    setSaving(true)

    try {
      await supabase
        .from('clientes_planes')
        .update({ estado: 'cancelado' })
        .eq('id', planActivo.id)

      await supabase
        .from('entrenamientos')
        .update({ estado: 'cancelado' })
        .eq('cliente_plan_id', planActivo.id)
        .eq('estado', 'programado')

      const detalle = `${motivoCancelacion} | pago:${pagoAlCancelar}`
      const { data: eventoExistente } = await supabase
        .from('clientes_planes_eventos')
        .select('id')
        .eq('cliente_plan_id', planActivo.id)
        .eq('cliente_id', id)
        .eq('tipo', 'cancelado')
        .eq('detalle', detalle)
        .limit(1)
        .maybeSingle()

      if (!eventoExistente?.id) {
        await supabase.from('clientes_planes_eventos').insert({
          cliente_plan_id: planActivo.id,
          cliente_id: id,
          tipo: 'cancelado',
          detalle,
        })
      }

      let resumenLimpieza = { cuentasEliminadas: 0, pagosEliminados: 0 }

      // Caso importante:
      // Si se creó mal el plan y marcas que NO pagó, se borra TODO el efecto económico.
      // Esto también cubre el caso de pago parcial: se elimina el pago parcial y la deuda restante.
      if (pagoAlCancelar === 'no') {
        resumenLimpieza = await eliminarEfectoEconomicoPlan(planActivo.id)
      }

      setSuccessMsg(
        pagoAlCancelar === 'no'
          ? `Plan cancelado sin efecto económico. Se eliminaron ${resumenLimpieza.pagosEliminados} pago(s), ${resumenLimpieza.cuentasEliminadas} deuda(s) y comisiones pendientes del plan.`
          : 'Plan cancelado. El pago, la deuda y las comisiones se mantienen porque marcaste que sí pagó.'
      )
      resetForm()
      setModo(null)
      await fetchAll()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al cancelar.')
    } finally {
      setSaving(false)
      cancellingRef.current = false
    }
  }

  // ─── Render formulario de plan ────────────────────────────────────────

  function renderPlanForm(submitLabel: string, onSubmit: (e: React.FormEvent) => Promise<void>) {
    const isModoRenovar = modo === 'renovar'
    const esMismoPlanRenovacion = isModoRenovar && tipoRenovacion === 'mismo_plan'

    return (
      <form onSubmit={onSubmit} className="space-y-6">
        {isModoRenovar && planActivo && (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <p className="text-sm font-medium text-white/80">¿Cómo quieres renovar?</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setTipoRenovacion('mismo_plan')}
                className={`rounded-2xl border p-4 text-left transition ${tipoRenovacion === 'mismo_plan' ? 'border-violet-400/30 bg-violet-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
              >
                <p className="text-sm font-semibold text-white">Mismo plan</p>
                <p className="mt-1 text-xs text-white/45">Se toma automáticamente el plan activo actual.</p>
              </button>
              <button
                type="button"
                onClick={() => setTipoRenovacion('otro_plan')}
                className={`rounded-2xl border p-4 text-left transition ${tipoRenovacion === 'otro_plan' ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
              >
                <p className="text-sm font-semibold text-white">Otro plan</p>
                <p className="mt-1 text-xs text-white/45">Seleccionas manualmente un plan distinto.</p>
              </button>
            </div>
          </div>
        )}

        {/* Selector plan */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan">
            {esMismoPlanRenovacion && planActivo?.planes ? (
              <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3">
                <p className="text-sm font-semibold text-violet-200">{planActivo.planes.nombre}</p>
                <p className="mt-1 text-xs text-white/55">
                  {planActivo.planes.sesiones_totales} ses. · {formatVigencia(planActivo.planes.vigencia_valor, planActivo.planes.vigencia_tipo)} · {formatMoney(planActivo.planes.precio)}
                </p>
                <p className="mt-2 text-[11px] text-violet-300/80">Renovación automática con el mismo plan.</p>
              </div>
            ) : (
              <div className="flex gap-2">
                <select value={selectedPlanId} onChange={(e) => setSelectedPlanId(e.target.value)} className={inputCls}>
                  <option value="" className="bg-[#11131a]">Seleccionar plan</option>
                  {planes.map((p) => (
                    <option key={p.id} value={p.id} className="bg-[#11131a]">
                      {p.nombre} · {p.sesiones_totales} ses. · {formatVigencia(p.vigencia_valor, p.vigencia_tipo)} · {formatMoney(p.precio)}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => setMostrarCrearPlan((v) => !v)}
                  className="shrink-0 rounded-2xl border border-violet-400/20 bg-violet-400/10 px-3 text-xs font-medium text-violet-300 transition hover:bg-violet-400/20">
                  + Plan
                </button>
              </div>
            )}
            {mostrarCrearPlan && !esMismoPlanRenovacion && (
              <div className="mt-3 space-y-3 rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4">
                <p className="text-xs font-medium text-violet-300">Crear nuevo plan</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="mb-1 block text-xs text-white/55">Nombre</label><input value={nuevoPlanNombre} onChange={(e) => setNuevoPlanNombre(e.target.value)} placeholder="Ej: Plan Básico" className={inputCls} /></div>
                  <div><label className="mb-1 block text-xs text-white/55">Precio ($)</label><input type="number" min={0} step="0.01" value={nuevoPlanPrecio} onChange={(e) => setNuevoPlanPrecio(e.target.value)} placeholder="0.00" className={inputCls} /></div>
                  <div><label className="mb-1 block text-xs text-white/55">Sesiones</label><input type="number" min={1} value={nuevoPlanSesiones} onChange={(e) => setNuevoPlanSesiones(Number(e.target.value))} className={inputCls} /></div>
                  <div><label className="mb-1 block text-xs text-white/55">Vigencia</label><input type="number" min={1} value={nuevoPlanVigencia} onChange={(e) => setNuevoPlanVigencia(Number(e.target.value))} className={inputCls} /></div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs text-white/55">Tipo de vigencia</label>
                    <select value={nuevoPlanVigenciaTipo} onChange={(e) => setNuevoPlanVigenciaTipo(e.target.value as VigenciaTipo)} className={inputCls}>
                      <option value="dias" className="bg-[#11131a]">Días</option>
                      <option value="semanas" className="bg-[#11131a]">Semanas</option>
                      <option value="meses" className="bg-[#11131a]">Meses</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={crearPlanInline} disabled={creandoPlan}
                    className="rounded-2xl border border-violet-400/20 bg-violet-400/15 px-4 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-400/25 disabled:opacity-60">
                    {creandoPlan ? 'Creando...' : 'Crear y seleccionar'}
                  </button>
                  <button type="button" onClick={() => setMostrarCrearPlan(false)} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/60 hover:bg-white/[0.06]">Cancelar</button>
                </div>
              </div>
            )}
          </Field>
          <Field label="Fecha de inicio">
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={inputCls} />
          </Field>
        </div>

        {/* Info plan seleccionado */}
        {selectedPlan && (
          <Card className="border-white/10 bg-white/[0.02] p-4">
            <p className="font-medium text-white">{selectedPlan.nombre}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><p className="text-xs text-white/45">Sesiones base</p><p className="font-medium text-white">{selectedPlan.sesiones_totales}</p></div>
              {modo === 'renovar' && sesionesRestantes > 0 && renovarConPendientes === 'si' && <div><p className="text-xs text-white/45">+ Pendientes</p><p className="font-medium text-emerald-400">+{sesionesRestantes}</p></div>}
              <div><p className="text-xs text-white/45">Total</p><p className="font-medium text-white">{totalPreviewSesiones}</p></div>
              <div><p className="text-xs text-white/45">Vence</p><p className="font-medium text-white">{formatDate(getFechaFinByVigencia(fechaInicio, selectedPlan.vigencia_valor, selectedPlan.vigencia_tipo))}</p></div>
            </div>
            {faltanSesionesPreview > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
                <p className="text-sm text-amber-300">Con esta combinación de días y vigencia no caben todas las sesiones. Faltan {faltanSesionesPreview}.</p>
              </div>
            )}
          </Card>
        )}

        {/* Impacto financiero (solo asignar con plan activo) */}
        {modo === 'asignar' && planActivo && selectedPlan && (
          <Card className="border-white/10 bg-white/[0.02] p-4">
            <p className="text-sm font-medium text-white/80">Impacto financiero del cambio</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
              <div><p className="text-xs text-white/45">Plan actual</p><p className="font-medium text-white">{planActivo.planes?.nombre || 'Plan actual'}</p><p className="text-white/65">{formatMoney(precioPlanActual)}</p></div>
              <div><p className="text-xs text-white/45">Nuevo plan</p><p className="font-medium text-white">{selectedPlan.nombre}</p><p className="text-white/65">{formatMoney(precioPlanNuevo)}</p></div>
              <div>
                <p className="text-xs text-white/45">{getMontoDiferenciaLabel(ajusteFinancieroPlan)}</p>
                <p className={`font-semibold ${ajusteFinancieroPlan > 0.009 ? 'text-amber-300' : ajusteFinancieroPlan < -0.009 ? 'text-emerald-300' : 'text-white'}`}>
                  {ajusteFinancieroPlan === 0 ? formatMoney(0) : formatMoney(Math.abs(ajusteFinancieroPlan))}
                </p>
              </div>
            </div>
            {ajusteFinancieroPlan > 0.009 && (
              <div className="mt-4 space-y-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
                <p className="text-sm text-amber-300">Solo se cobra la diferencia: {formatMoney(ajusteFinancieroPlan)}.</p>
                <label className="flex items-center gap-3 text-sm text-amber-300">
                  <input type="checkbox" checked={registrarAjustePlan} onChange={(e) => setRegistrarAjustePlan(e.target.checked)} className="h-4 w-4 accent-amber-400" />
                  Crear automáticamente cuenta por cobrar por la diferencia
                </label>
              </div>
            )}
            {ajusteFinancieroPlan < -0.009 && (
              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3">
                <p className="text-sm text-emerald-300">Se registrará un saldo a favor de {formatMoney(Math.abs(ajusteFinancieroPlan))}.</p>
              </div>
            )}
          </Card>
        )}

        {/* Sesiones pendientes (renovar) */}
        {modo === 'renovar' && planActivo && (
          <div className="space-y-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
            <p className="text-sm font-medium text-emerald-300">Sesiones pendientes del plan actual</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setRenovarConPendientes('si')}
                className={`rounded-2xl border p-4 text-left transition ${renovarConPendientes === 'si' ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                <p className="text-sm font-semibold text-white">Sí, conservar pendientes</p>
                <p className="mt-1 text-xs text-white/45">Se suman {sesionesRestantes} sesiones pendientes al nuevo plan.</p>
              </button>
              <button type="button" onClick={() => setRenovarConPendientes('no')}
                className={`rounded-2xl border p-4 text-left transition ${renovarConPendientes === 'no' ? 'border-rose-400/30 bg-rose-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                <p className="text-sm font-semibold text-white">No, empezar limpio</p>
                <p className="mt-1 text-xs text-white/45">No se suman pendientes.</p>
              </button>
            </div>
          </div>
        )}

        {/* Fisioterapeuta + recurso */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fisioterapeuta">
            <select value={empleadoId} onChange={(e) => { setEmpleadoId(e.target.value); setFechaVistaCal(fechaInicio) }} className={inputCls}>
              <option value="" className="bg-[#11131a]">Seleccionar fisioterapeuta</option>
              {empleados.map((e) => <option key={e.id} value={e.id} className="bg-[#11131a]">{e.nombre}{e.rol ? ` · ${getRolLabel(e.rol)}` : ''}{e.especialidad ? ` · ${e.especialidad}` : ''}</option>)}
            </select>
          </Field>
          <Field label="Recurso / Espacio">
            <select value={recursoId} onChange={(e) => setRecursoId(e.target.value)} className={inputCls}>
              <option value="" className="bg-[#11131a]">Sin recurso</option>
              {recursos.map((r) => <option key={r.id} value={r.id} className="bg-[#11131a]">{r.nombre}</option>)}
            </select>
          </Field>
        </div>

        {/* Días */}
        <Field label="Días de entrenamiento">
          <div className="mt-1 flex flex-wrap gap-2">
            {DIAS_SEMANA.map((dia) => (
              <button key={dia.key} type="button" onClick={() => toggleDia(dia.key)}
                className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-semibold transition ${diasSemana.includes(dia.key) ? 'border-violet-400/40 bg-violet-500/20 text-violet-300' : 'border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06]'}`}>
                {dia.label}
              </button>
            ))}
          </div>
          {diasSemana.length > 0 && <p className="mt-2 text-xs text-white/45">{diasSemana.map((d) => DIAS_SEMANA.find((x) => x.key === d)?.nombre).join(', ')}</p>}
        </Field>

        {/* Hora + duración */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hora de inicio" helper="O haz clic en el calendario →">
            <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Duración (minutos)">
            <select value={duracionMin} onChange={(e) => setDuracionMin(Number(e.target.value))} className={inputCls}>
              {[30, 45, 60, 75, 90, 120].map((m) => <option key={m} value={m} className="bg-[#11131a]">{m} minutos</option>)}
            </select>
          </Field>
        </div>

        {/* Calendario */}
        {empleadoId && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white/75">Disponibilidad del fisioterapeuta</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { const d = new Date(`${fechaVistaCal}T00:00:00`); d.setDate(d.getDate() - 1); setFechaVistaCal(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`) }} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.06]">←</button>
                <input type="date" value={fechaVistaCal} onChange={(e) => setFechaVistaCal(e.target.value)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white outline-none" />
                <button type="button" onClick={() => { const d = new Date(`${fechaVistaCal}T00:00:00`); d.setDate(d.getDate() + 1); setFechaVistaCal(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`) }} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.06]">→</button>
              </div>
            </div>
            <CalendarioDisponibilidad fechaVista={fechaVistaCal} horaInicio={horaInicio} horaFin={horaFin} entrenamientosExistentes={entrenamientosEmpleado} onSelectHora={(hora) => setHoraInicio(hora)} />
          </div>
        )}

        {/* Fechas preview */}
        {fechasPreview.length > 0 && (
          <Card className="border-violet-400/20 bg-violet-400/5 p-4">
            <p className="text-sm font-medium text-violet-300">Se generarán {fechasPreview.length} entrenamientos</p>
            {fechaFinPreview && <p className="mt-1 text-xs text-white/45">Vigencia: {formatDate(fechaInicio)} → {formatDate(fechaFinPreview)}</p>}
            <div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              {fechasPreview.slice(0, 30).map((f, i) => (
                <span key={i} className="rounded-lg bg-violet-500/10 px-2 py-0.5 text-xs text-violet-400">
                  {new Date(`${f}T00:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                </span>
              ))}
              {fechasPreview.length > 30 && <span className="text-xs text-violet-400/60">+{fechasPreview.length - 30} más</span>}
            </div>
            {faltanSesionesPreview > 0 && <p className="mt-3 text-xs text-amber-300">Faltan {faltanSesionesPreview} sesiones por ubicar antes del vencimiento.</p>}
          </Card>
        )}

        {/* Comisión */}
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <p className="text-sm font-medium text-white/75">Configuración de comisión</p>
            <button type="button" onClick={resetearComisionAlPlan} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60 transition hover:bg-white/[0.06]">Restaurar comisión del plan</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Precio (USD)" helper={esMismoPlanRenovacion ? 'Precio automático del mismo plan.' : usarPrecioPlan ? 'Tomando el precio del plan.' : 'Precio editable.'}>
              <div className="flex gap-2">
                <input type="number" min={0} step="0.01" value={usarPrecioPlan ? String(selectedPlan?.precio ?? '') : montoPersonalizado} readOnly={usarPrecioPlan || esMismoPlanRenovacion} onChange={(e) => setMontoPersonalizado(e.target.value)} className={`${inputCls} ${usarPrecioPlan || esMismoPlanRenovacion ? 'cursor-not-allowed opacity-70' : ''}`} placeholder="0.00" />
                <button type="button" onClick={() => { if (!esMismoPlanRenovacion) setUsarPrecioPlan((p) => !p) }} disabled={esMismoPlanRenovacion} className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white/60 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50">{esMismoPlanRenovacion ? 'Auto' : usarPrecioPlan ? 'Editar' : 'Plan'}</button>
              </div>
            </Field>
            <Field label="Base comisión"><input type="number" value={String(baseComisionAplicada)} readOnly className={`${inputCls} cursor-not-allowed opacity-80`} /></Field>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"><p className="text-xs text-white/45">Regla</p><p className="mt-2 text-sm text-white/75">Cambiar uno ajusta el otro automáticamente.</p></div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-violet-400/15 bg-white/[0.03] p-4">
              <p className="mb-3 text-sm font-semibold text-violet-300">RPM</p>
              <Field label="RPM porcentaje"><input type="number" min={0} max={100} step="0.01" value={porcentajeRpmAplicado} onChange={(e) => handleChangePorcentajeRpm(e.target.value)} className={inputCls} /></Field>
              <div className="mt-4"><Field label="RPM monto"><input type="number" min={0} max={baseComisionAplicada} step="0.01" value={montoRpmAplicado} onChange={(e) => handleChangeMontoRpm(e.target.value)} className={inputCls} /></Field></div>
            </div>
            <div className="rounded-2xl border border-emerald-400/15 bg-white/[0.03] p-4">
              <p className="mb-3 text-sm font-semibold text-emerald-300">Entrenador</p>
              <Field label="Entrenador porcentaje"><input type="number" min={0} max={100} step="0.01" value={porcentajeEntrenadorAplicado} onChange={(e) => handleChangePorcentajeEntrenador(e.target.value)} className={inputCls} /></Field>
              <div className="mt-4"><Field label="Entrenador monto"><input type="number" min={0} max={baseComisionAplicada} step="0.01" value={montoEntrenadorAplicado} onChange={(e) => handleChangeMontoEntrenador(e.target.value)} className={inputCls} /></Field></div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4"><p className="text-xs text-white/45">Base</p><p className="mt-1 text-lg font-semibold text-white">{formatMoney(baseComisionAplicada)}</p></Card>
            <Card className="border-violet-400/20 bg-violet-400/5 p-4"><p className="text-xs text-white/45">RPM recibe</p><p className="mt-1 text-lg font-semibold text-violet-400">{formatMoney(montoRpmAplicado)}</p><p className="text-xs text-white/25">{porcentajeRpmAplicado}%</p></Card>
            <Card className="border-emerald-400/20 bg-emerald-400/5 p-4"><p className="text-xs text-white/45">Entrenador recibe</p><p className="mt-1 text-lg font-semibold text-emerald-400">{formatMoney(montoEntrenadorAplicado)}</p><p className="text-xs text-white/25">{porcentajeEntrenadorAplicado}%</p></Card>
          </div>
          {comisionEquivalentes.monto_base_bs && (
            <div className="grid gap-2 border-t border-white/10 pt-4 text-sm md:grid-cols-3">
              <div><span className="text-white/55">Base en Bs: </span><span className="text-white/75">{formatBs(comisionEquivalentes.monto_base_bs)}</span></div>
              <div><span className="text-white/55">RPM en Bs: </span><span className="text-white/75">{formatBs(comisionEquivalentes.monto_rpm_bs || 0)}</span></div>
              <div><span className="text-white/55">Entrenador en Bs: </span><span className="text-white/75">{formatBs(comisionEquivalentes.monto_profesional_bs || 0)}</span></div>
            </div>
          )}
        </div>

        {/* Pago */}
        {modo === 'asignar' && planActivo && selectedPlan && montoObjetivoPago <= 0.009 ? (
          <Card className="border-emerald-400/20 bg-emerald-400/5 p-4">
            <p className="text-sm text-emerald-300">
              No hace falta registrar pago para este cambio. {ajusteFinancieroPlan < -0.009 ? `El cliente queda con un saldo a favor de ${formatMoney(Math.abs(ajusteFinancieroPlan))}.` : 'El precio del nuevo plan queda cubierto.'}
            </p>
          </Card>
        ) : (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setRegistrarPago((p) => !p)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${registrarPago ? 'bg-emerald-500' : 'bg-white/10'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${registrarPago ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <span className="text-sm text-white/75">Registrar pago en finanzas</span>
            </div>

            {registrarPago && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/45">Total a cobrar</p>
                  <p className="text-sm font-semibold text-white">{formatMoney(montoObjetivoPago)}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Fecha del pago" helper="Para registrar pagos viejos sin cambiar la vigencia del plan.">
                    <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Notas generales del pago (opcional)">
                    <textarea value={notasPagoGenerales} onChange={(e) => setNotasPagoGenerales(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="Notas generales..." />
                  </Field>
                </div>
                <PagoConDeudaSelector
                  key={`plan-pago-${selectedPlanId}-${montoObjetivoPago}-${fechaPago}-${usarPrecioPlan ? 'auto' : 'manual'}`}
                  montoTotal={montoObjetivoPago}
                  fecha={fechaPago}
                  metodosPago={metodosPago}
                  value={pagoState}
                  onChange={setPagoState}
                  concepto={`Plan: ${selectedPlan?.nombre || ''}`}
                  clienteNombre={cliente?.nombre || ''}
                  mostrarMontoTotal={false}
                />
              </>
            )}
          </div>
        )}

        {errorMsg  && <Card className="p-4"><p className="text-sm text-rose-400">{errorMsg}</p></Card>}
        {successMsg && <Card className="p-4"><p className="text-sm text-emerald-400">{successMsg}</p></Card>}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving || faltanSesionesPreview > 0}
            className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-60">
            {saving ? 'Guardando...' : submitLabel}
          </button>
          <button type="button" onClick={() => { setModo(null); resetForm() }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]">
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/55">Clientes / Plan</p>
        <h1 className="text-2xl font-semibold text-white">Plan del cliente</h1>
        <Card className="p-6"><p className="text-sm text-white/55">Cargando...</p></Card>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/55">Clientes / Plan</p>
        <h1 className="text-2xl font-semibold text-white">Plan del cliente</h1>
        <Card className="p-6"><p className="text-sm text-rose-400">{errorMsg || 'No encontrado.'}</p></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Clientes / Plan</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Plan del cliente</h1>
          <p className="mt-1 text-xs text-white/45">{cliente.nombre}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard title="Volver al cliente" description="Ver ficha completa." href={`/admin/personas/clientes/${id}`} />
          <ActionCard title="Nueva cita" description="Agendar cita." href={`/admin/operaciones/agenda/nueva?cliente=${id}`} />
        </div>
      </div>

      {successMsg && !modo && <Card className="p-4"><p className="text-sm text-emerald-400">{successMsg}</p></Card>}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {!modo && (
            <Section title="Gestión del plan" description="Acciones disponibles.">
              <div className="grid gap-3 sm:grid-cols-3">
                <button type="button" onClick={() => { setModo('asignar'); resetForm() }}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-left transition hover:bg-white/[0.08]">
                  <p className="font-semibold text-white">Asignar plan</p>
                  <p className="mt-1 text-xs text-white/45">{planActivo ? 'Reemplazar plan actual' : 'Asignar primer plan'}</p>
                </button>
                <button type="button" disabled={!planActivo} onClick={() => { setModo('renovar'); resetForm() }}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-left transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40">
                  <p className="font-semibold text-white">Renovar plan</p>
                  <p className="mt-1 text-xs text-white/45">{planActivo ? `${sesionesRestantes} ses. pendientes` : 'Sin plan activo'}</p>
                </button>
                <button type="button" disabled={!planActivo} onClick={() => { setModo('cancelar'); resetForm() }}
                  className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4 text-left transition hover:bg-rose-400/10 disabled:cursor-not-allowed disabled:opacity-40">
                  <p className="font-semibold text-rose-300">Cancelar plan</p>
                  <p className="mt-1 text-xs text-rose-400/60">{planActivo ? 'Cancela plan y entrenamientos futuros' : 'Sin plan activo'}</p>
                </button>
              </div>
            </Section>
          )}

          {modo === 'asignar' && (
            <Section title="Asignar plan" description="Asigna un plan y genera entrenamientos.">
              {planActivo && <Card className="mb-4 border-amber-400/20 bg-amber-400/5 p-4"><p className="text-sm text-amber-300">⚠️ El plan actual "{planActivo.planes?.nombre}" será reemplazado.</p></Card>}
              {renderPlanForm('Asignar plan', handleAsignar)}
            </Section>
          )}

          {modo === 'renovar' && (
            <Section title="Renovar plan" description="Renueva el plan y decide si arrastra pendientes.">
              {sesionesRestantes > 0
                ? <Card className="mb-4 border-emerald-400/20 bg-emerald-400/5 p-4"><p className="text-sm text-emerald-300">El cliente tiene {sesionesRestantes} sesiones pendientes. Puedes decidir si se suman o no.</p></Card>
                : <Card className="mb-4 border-white/10 bg-white/[0.03] p-4"><p className="text-sm text-white/65">Este plan no tiene sesiones pendientes para arrastrar.</p></Card>}
              {renderPlanForm('Renovar plan', handleRenovar)}
            </Section>
          )}

          {modo === 'cancelar' && (
            <Section title="Cancelar plan" description="Selecciona el motivo.">
              <form onSubmit={handleCancelar} className="space-y-5">
                <Field label="Motivo">
                  <div className="space-y-2">
                    {[
                      { value: 'error_creacion',     label: 'Error al crear el plan',  desc: 'Se creó por equivocación' },
                      { value: 'cliente_no_continua', label: 'Cliente no continuó',     desc: 'No siguió asistiendo' },
                      { value: 'plan_vencido',        label: 'Plan vencido',            desc: 'Llegó la fecha de vencimiento' },
                      { value: 'sesiones_agotadas',   label: 'Sesiones agotadas',       desc: 'Se completaron todas las sesiones' },
                    ].map((op) => (
                      <label key={op.value} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${motivoCancelacion === op.value ? 'border-rose-400/30 bg-rose-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                        <input type="radio" name="motivo" value={op.value} checked={motivoCancelacion === op.value} onChange={(e) => setMotivoCancelacion(e.target.value)} className="mt-0.5 accent-rose-400" />
                        <div><p className="text-sm font-medium text-white">{op.label}</p><p className="text-xs text-white/45">{op.desc}</p></div>
                      </label>
                    ))}
                  </div>
                </Field>
                <Field label="¿El cliente realizó el pago?">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => setPagoAlCancelar('si')} className={`rounded-2xl border p-3 text-left transition ${pagoAlCancelar === 'si' ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                      <p className="text-sm font-medium text-white">✓ Sí pagó</p>
                      <p className="mt-1 text-xs text-white/45">Se cancela el plan, pero el pago y la comisión se mantienen.</p>
                    </button>
                    <button type="button" onClick={() => setPagoAlCancelar('no')} className={`rounded-2xl border p-3 text-left transition ${pagoAlCancelar === 'no' ? 'border-rose-400/30 bg-rose-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}>
                      <p className="text-sm font-medium text-white">✗ No pagó</p>
                      <p className="mt-1 text-xs text-white/45">El plan queda sin efecto económico, como si nunca se hubiera acreditado.</p>
                    </button>
                  </div>
                </Field>
                {errorMsg && <Card className="p-4"><p className="text-sm text-rose-400">{errorMsg}</p></Card>}
                <div className="flex gap-3">
                  <button type="submit" disabled={saving} className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-400/15 disabled:opacity-60">
                    {saving ? 'Cancelando...' : 'Confirmar cancelación'}
                  </button>
                  <button type="button" onClick={() => { setModo(null); resetForm() }} className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]">Volver</button>
                </div>
              </form>
            </Section>
          )}
        </div>

        {/* Panel lateral — plan activo */}
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
                  <div><p className="text-xs text-white/45">Total</p><p className="font-medium text-white">{planActivo.sesiones_totales}</p></div>
                  <div><p className="text-xs text-white/45">Usadas</p><p className="font-medium text-white">{planActivo.sesiones_usadas}</p></div>
                  <div><p className="text-xs text-white/45">Restantes</p><p className="font-medium text-emerald-400">{sesionesRestantes}</p></div>
                  <div><p className="text-xs text-white/45">Estado</p><p className="font-medium capitalize text-white">{planActivo.estado}</p></div>
                  <div><p className="text-xs text-white/45">Vigencia</p><p className="font-medium text-white">{formatVigencia(planActivo.planes?.vigencia_valor, planActivo.planes?.vigencia_tipo)}</p></div>
                  <div><p className="text-xs text-white/45">Vence</p><p className="font-medium text-white">{formatDate(planActivo.fecha_fin)}</p></div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-white/45">
                    <span>Progreso</span><span>{progresoUso}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-violet-500/70 transition-all" style={{ width: `${progresoUso}%` }} />
                  </div>
                </div>
                {(planActivo.porcentaje_rpm || planActivo.monto_base_comision) && (
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-xs font-medium text-white/55">Comisión registrada</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><p className="text-xs text-white/35">Base</p><p className="font-medium text-white">{formatMoney(planActivo.monto_base_comision)}</p></div>
                      <div><p className="text-xs text-white/35">% RPM</p><p className="font-medium text-white">{planActivo.porcentaje_rpm ?? 0}%</p></div>
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
