'use client'

export const dynamic = 'force-dynamic'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
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

type VigenciaTipo = 'dias' | 'semanas' | 'meses'
type TipoAsignacion = 'plan' | 'cita' | 'ninguno'

type EmpleadoAsignable = {
  id: string; nombre: string; rol: string | null
  especialidad: string | null; comision_plan_porcentaje: number; comision_cita_porcentaje: number
}

type Plan = {
  id: string; nombre: string; sesiones_totales: number
  vigencia_valor: number; vigencia_tipo: VigenciaTipo
  precio: number; descripcion: string | null
  comision_base?: number | null; comision_rpm?: number | null; comision_entrenador?: number | null
}

type ServicioRaw = {
  id: string; nombre: string; estado?: string | null; precio?: number | null
  duracion_minutos?: number | null; color?: string | null
  comision_base?: number | null; comision_rpm?: number | null; comision_entrenador?: number | null
  [key: string]: any
}

type Servicio = {
  id: string; nombre: string; precio: number | null; duracion_min: number | null
  estado?: string | null; comision_base: number | null; comision_rpm: number | null; comision_entrenador: number | null
}

type Recurso = { id: string; nombre: string; tipo: string | null; estado?: string | null; capacidad?: number | null; hora_inicio?: string | null; hora_fin?: string | null }

type MetodoPago = {
  id: string; nombre: string; tipo: string | null; moneda?: string | null
  cartera?: { nombre: string; codigo: string } | null
}

type EntrenamientoExistente = {
  id: string; hora_inicio: string; hora_fin: string; fecha: string
  clientes: { nombre: string } | null
}

type PlanificacionSesiones = {
  fechas: string[]; fechaFinPlan: string; sesionesPosibles: number
  sesionesSolicitadas: number; alcanzaVigencia: boolean
  semanasBase: number; diasSeleccionados: number; ultimaFechaPosible: string | null
}

type ValidacionCita = {
  disponible: boolean; motivo: string
  conflicto_terapeuta?: boolean; conflicto_cliente?: boolean
  conflictos_recurso?: number; capacidad_recurso?: number
  recurso_hora_inicio?: string | null; recurso_hora_fin?: string | null
  detalle?: { tipo?: string; motivo?: string; detalle?: string } | null
}

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

function firstOrNull<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

function normalizeMetodoPago(row: any): MetodoPago {
  const cartera = firstOrNull(row?.cartera)
  return {
    id: String(row?.id ?? ''), nombre: String(row?.nombre ?? ''),
    tipo: row?.tipo ?? null, moneda: row?.moneda ?? null,
    cartera: cartera ? { nombre: String(cartera?.nombre ?? ''), codigo: String(cartera?.codigo ?? '') } : null,
  }
}

function normalizeEntrenamiento(row: any): EntrenamientoExistente {
  const cliente = firstOrNull(row?.clientes)
  return {
    id: String(row?.id ?? ''), hora_inicio: String(row?.hora_inicio ?? ''),
    hora_fin: String(row?.hora_fin ?? ''), fecha: String(row?.fecha ?? ''),
    clientes: cliente ? { nombre: String(cliente?.nombre ?? '') } : null,
  }
}

function getTodayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getVigenciaDias(val: number, tipo: VigenciaTipo) {
  const v = Math.max(Number(val || 0), 0)
  if (tipo === 'semanas') return v * 7
  if (tipo === 'meses') return v * 30
  return v
}

function getFechaFin(fechaInicio: string, val: number, tipo: VigenciaTipo) {
  return addDays(fechaInicio, Math.max(getVigenciaDias(val, tipo) - 1, 0))
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

function formatVigencia(valor: number, tipo: VigenciaTipo) {
  if (!valor) return '—'
  if (valor === 1) { if (tipo === 'dias') return '1 día'; if (tipo === 'semanas') return '1 semana'; return '1 mes' }
  if (tipo === 'dias') return `${valor} días`
  if (tipo === 'semanas') return `${valor} semanas`
  return `${valor} meses`
}

function timeToMin(t: string) { const [h, m] = t.slice(0, 5).split(':').map(Number); return h * 60 + m }
function minToTime(m: number) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
function sumarMinutos(hora: string, min: number) { return `${minToTime(timeToMin(hora) + min)}:00` }
function toMinutes(hora: string | null | undefined) {
  if (!hora) return null
  const [h, m] = hora.slice(0, 5).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

function r2(v: number) { return Math.round(v * 100) / 100 }
function clamp(v: number, min: number, max: number) { return Math.min(Math.max(v, min), max) }

function calcularPlanificacion(
  fechaInicio: string, diasSemana: number[], totalSesiones: number,
  vigenciaValor: number, vigenciaTipo: VigenciaTipo
): PlanificacionSesiones {
  const vigenciaDias = getVigenciaDias(vigenciaValor, vigenciaTipo)
  if (!fechaInicio || !diasSemana.length || !totalSesiones || !vigenciaDias)
    return { fechas: [], fechaFinPlan: fechaInicio || '', sesionesPosibles: 0, sesionesSolicitadas: totalSesiones || 0, alcanzaVigencia: false, semanasBase: 0, diasSeleccionados: diasSemana.length, ultimaFechaPosible: null }
  const diasOrd = [...diasSemana].sort((a, b) => a - b)
  const fechaFinPlan = getFechaFin(fechaInicio, vigenciaValor, vigenciaTipo)
  const fin = new Date(`${fechaFinPlan}T23:59:59`)
  const cur = new Date(`${fechaInicio}T00:00:00`)
  const fechas: string[] = []
  let guard = 0
  while (cur <= fin && guard < 5000) {
    if (diasOrd.includes(cur.getDay())) {
      fechas.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`)
      if (fechas.length >= totalSesiones) break
    }
    cur.setDate(cur.getDate() + 1); guard++
  }
  let sesionesPosibles = 0
  const scan = new Date(`${fechaInicio}T00:00:00`); guard = 0
  while (scan <= fin && guard < 5000) {
    if (diasOrd.includes(scan.getDay())) sesionesPosibles++
    scan.setDate(scan.getDate() + 1); guard++
  }
  return { fechas, fechaFinPlan, sesionesPosibles, sesionesSolicitadas: totalSesiones, alcanzaVigencia: sesionesPosibles >= totalSesiones, semanasBase: Math.ceil(totalSesiones / Math.max(diasSemana.length, 1)), diasSeleccionados: diasSemana.length, ultimaFechaPosible: fechaFinPlan }
}

function buildKey(fecha: string, hi: string, hf: string, empId: string) { return `${fecha}__${hi}__${hf}__${empId}` }
function getRolLabel(rol: string | null | undefined) {
  const v = (rol || '').trim().toLowerCase()
  if (v === 'terapeuta' || v === 'fisioterapeuta') return 'Fisioterapeuta'
  if (v === 'entrenador') return 'Entrenador'
  if (!v) return 'Sin rol'
  return v.charAt(0).toUpperCase() + v.slice(1)
}

function getServicioDuracion(s: ServicioRaw) { const n = Number(s.duracion_minutos); return !Number.isNaN(n) && n > 0 ? n : null }

function buildErrorFromValidacion(v: ValidacionCita | null | undefined) {
  if (!v) return 'No se pudo validar la disponibilidad.'
  switch (v.motivo) {
    case 'ok': return ''
    case 'empleado_bloqueado': return v.detalle?.detalle || v.detalle?.motivo || 'El fisioterapeuta no está disponible en ese horario.'
    case 'conflicto_terapeuta': return 'Ese fisioterapeuta ya tiene una cita en ese horario.'
    case 'conflicto_cliente':   return 'Ese cliente ya tiene una cita en ese horario.'
    case 'conflicto_recurso':   return v.capacidad_recurso && v.capacidad_recurso > 1 ? `Ese recurso ya alcanzó su capacidad máxima (${v.capacidad_recurso}).` : 'Ese recurso ya está ocupado en ese horario.'
    case 'recurso_inactivo':    return 'Ese recurso está inactivo.'
    case 'hora_fin_invalida':   return 'La hora final debe ser mayor que la hora inicial.'
    default: return `No se puede guardar la cita (${v.motivo}).`
  }
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
  w-full rounded-xl border border-white/10 bg-white/[0.02]
  px-3 py-2 text-sm text-white outline-none transition
  placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.04]
`

function PasoIndicator({ actual }: { actual: number }) {
  const pasos = [{ n: 1, label: 'Datos del cliente' }, { n: 2, label: 'Plan o cita' }, { n: 3, label: 'Pago' }]
  return (
    <div className="flex items-center gap-2">
      {pasos.map((p, i) => (
        <div key={p.n} className="flex items-center gap-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition ${p.n < actual ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-400' : p.n === actual ? 'border-violet-400/40 bg-violet-500/20 text-violet-300' : 'border-white/10 bg-white/[0.03] text-white/30'}`}>
            {p.n < actual ? '✓' : p.n}
          </div>
          <span className={`hidden text-sm sm:block ${p.n === actual ? 'text-white' : 'text-white/35'}`}>{p.label}</span>
          {i < pasos.length - 1 && <div className={`h-px w-8 ${p.n < actual ? 'bg-emerald-400/30' : 'bg-white/10'}`} />}
        </div>
      ))}
    </div>
  )
}

function CalendarioDisponibilidad({ fechaVista, horaInicio, horaFin, entrenamientosExistentes, onSelectHora }: {
  fechaVista: string; horaInicio: string; horaFin: string
  entrenamientosExistentes: EntrenamientoExistente[]; onSelectHora: (hora: string) => void
}) {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i)
  function getTop(m: number) { return (m / 60) * HOUR_HEIGHT }
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const relY = Math.max(0, Math.min(e.clientY - rect.top, HOUR_HEIGHT * TOTAL_HOURS))
    onSelectHora(minToTime(Math.round((relY / (HOUR_HEIGHT * TOTAL_HOURS)) * TOTAL_HOURS * 60 / 30) * 30))
  }
  const inicioPx = horaInicio ? getTop(timeToMin(horaInicio)) : null
  const finPx    = horaFin    ? getTop(timeToMin(horaFin))    : null

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
          {entrenamientosExistentes.map((ent) => {
            const top = getTop(timeToMin(ent.hora_inicio)); const height = Math.max(20, getTop(timeToMin(ent.hora_fin)) - top)
            return (
              <div key={ent.id} className="pointer-events-none absolute left-12 right-2 overflow-hidden rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1" style={{ top, height }}>
                <p className="truncate text-xs font-medium text-rose-300">{ent.clientes?.nombre || 'Cliente'}</p>
                <p className="text-xs text-rose-400/70">{ent.hora_inicio.slice(0, 5)} – {ent.hora_fin.slice(0, 5)}</p>
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
              <div className="ml-12 flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-emerald-400" /><div className="flex-1 border-t border-emerald-400/60" /></div>
            </div>
          )}
        </div>
      </div>
      <p className="text-center text-xs text-white/30">Haz clic para seleccionar la hora de inicio</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NuevoClientePage() {
  const router = useRouter()

  const creatingClientRef = useRef(false)
  const creatingPaso2Ref  = useRef(false)
  const creatingPagoRef   = useRef(false)

  const [paso, setPaso]         = useState(1)
  const [saving, setSaving]     = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [empleadoActualId, setEmpleadoActualId] = useState('')

  const [empleados, setEmpleados]     = useState<EmpleadoAsignable[]>([])
  const [planes, setPlanes]           = useState<Plan[]>([])
  const [servicios, setServicios]     = useState<Servicio[]>([])
  const [recursos, setRecursos]       = useState<Recurso[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [entrenamientosEmpleado, setEntrenamientosEmpleado] = useState<EntrenamientoExistente[]>([])

  const [clienteId, setClienteId]         = useState<string | null>(null)
  const [clientePlanId, setClientePlanId] = useState<string | null>(null)
  const [citaId, setCitaId]               = useState<string | null>(null)

  // Paso 1
  const [formCliente, setFormCliente] = useState({
    nombre: '', cedula: '', telefono: '', email: '',
    fecha_nacimiento: '', genero: '', direccion: '',
    terapeuta_id: '', estado: 'activo' as 'activo' | 'inactivo' | 'pausado', notas: '',
  })

  const [tipoAsignacion, setTipoAsignacion] = useState<TipoAsignacion>('plan')

  // Plan
  const [planId, setPlanId]           = useState('')
  const [fechaInicio, setFechaInicio] = useState(getTodayLocal())
  const [empleadoId, setEmpleadoId]   = useState('')
  const [recursoId, setRecursoId]     = useState('')
  const [diasSemana, setDiasSemana]   = useState<number[]>([])
  const [horaInicio, setHoraInicio]   = useState('')
  const [duracionMin, setDuracionMin] = useState(60)
  const [fechaVistaCal, setFechaVistaCal] = useState(getTodayLocal())
  const [mostrarCrearPlan, setMostrarCrearPlan]           = useState(false)
  const [nuevoPlanNombre, setNuevoPlanNombre]             = useState('')
  const [nuevoPlanSesiones, setNuevoPlanSesiones]         = useState(12)
  const [nuevoPlanVigencia, setNuevoPlanVigencia]         = useState(30)
  const [nuevoPlanVigenciaTipo, setNuevoPlanVigenciaTipo] = useState<VigenciaTipo>('dias')
  const [nuevoPlanPrecio, setNuevoPlanPrecio]             = useState('')
  const [creandoPlan, setCreandoPlan]                     = useState(false)

  // Cita
  const [citaServicioId, setCitaServicioId]   = useState('')
  const [citaTerapeutaId, setCitaTerapeutaId] = useState('')
  const [citaRecursoId, setCitaRecursoId]     = useState('')
  const [citaFecha, setCitaFecha]             = useState(getTodayLocal())
  const [citaHoraInicio, setCitaHoraInicio]   = useState('')
  const [citaHoraFin, setCitaHoraFin]         = useState('')
  const [citaEstado, setCitaEstado]           = useState('programada')
  const [citaNotas, setCitaNotas]             = useState('')
  const [citaFechaVistaCal, setCitaFechaVistaCal] = useState(getTodayLocal())
  const [citaEntrenamientos, setCitaEntrenamientos] = useState<EntrenamientoExistente[]>([])

  // Pago
  const [saltarPago, setSaltarPago]                 = useState(false)
  const [usarPrecioBase, setUsarPrecioBase]         = useState(true)
  const [montoPersonalizado, setMontoPersonalizado] = useState('')
  const [pagoState, setPagoState]                   = useState<PagoConDeudaState>(pagoConDeudaInitial())
  const [porcentajeRpmEditable, setPorcentajeRpmEditable]               = useState(50)
  const [porcentajeEntrenadorEditable, setPorcentajeEntrenadorEditable] = useState(50)

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => { void loadData(); void loadEmpleadoActual() }, [])

  useEffect(() => {
    if (!empleadoId || !fechaVistaCal) { setEntrenamientosEmpleado([]); return }
    void supabase.from('entrenamientos').select('id, hora_inicio, hora_fin, fecha, clientes:cliente_id(nombre)').eq('empleado_id', empleadoId).eq('fecha', fechaVistaCal).neq('estado', 'cancelado').order('hora_inicio')
      .then(({ data }) => setEntrenamientosEmpleado(((data || []) as any[]).map(normalizeEntrenamiento)))
  }, [empleadoId, fechaVistaCal])

  useEffect(() => {
    if (!citaTerapeutaId || !citaFechaVistaCal) { setCitaEntrenamientos([]); return }
    void supabase.from('citas').select('id, hora_inicio, hora_fin, fecha, clientes:cliente_id(nombre)').eq('terapeuta_id', citaTerapeutaId).eq('fecha', citaFechaVistaCal).neq('estado', 'cancelada').order('hora_inicio')
      .then(({ data }) => setCitaEntrenamientos(((data || []) as any[]).map(normalizeEntrenamiento)))
  }, [citaTerapeutaId, citaFechaVistaCal])

  useEffect(() => {
    const srv = servicios.find((s) => s.id === citaServicioId)
    if (!citaHoraInicio || !srv?.duracion_min) return
    setCitaHoraFin(sumarMinutos(citaHoraInicio, srv.duracion_min))
  }, [citaHoraInicio, citaServicioId])

  useEffect(() => { setPagoState(pagoConDeudaInitial()) }, [planId, citaServicioId, usarPrecioBase, tipoAsignacion])

  // ── Comisión inicial cuando cambia plan ──
  useEffect(() => {
    const plan = planes.find((p) => p.id === planId)
    if (!plan) { setPorcentajeRpmEditable(50); setPorcentajeEntrenadorEditable(50); return }
    const base = Number(plan.comision_base ?? plan.precio ?? 0)
    const rpm  = Number(plan.comision_rpm ?? 0)
    const pct  = base > 0 ? clamp(r2((rpm / base) * 100), 0, 100) : 50
    setPorcentajeRpmEditable(pct); setPorcentajeEntrenadorEditable(r2(100 - pct))
  }, [planId, planes])

  // ── Comisión inicial cuando cambia servicio ──
  useEffect(() => {
    const srv = servicios.find((s) => s.id === citaServicioId)
    if (!srv) { setPorcentajeRpmEditable(50); setPorcentajeEntrenadorEditable(50); return }
    const base = Number(srv.comision_base ?? srv.precio ?? 0)
    const rpm  = Number(srv.comision_rpm ?? 0)
    const pct  = base > 0 ? clamp(r2((rpm / base) * 100), 0, 100) : 50
    setPorcentajeRpmEditable(pct); setPorcentajeEntrenadorEditable(r2(100 - pct))
  }, [citaServicioId, servicios])

  // ─── Derived — ORDEN CRÍTICO: no reordenar ───────────────────────────────

  const planSeleccionado     = useMemo(() => planes.find((p) => p.id === planId) || null, [planes, planId])
  const servicioSeleccionado = useMemo(() => servicios.find((s) => s.id === citaServicioId) || null, [servicios, citaServicioId])
  const horaFinPlan          = useMemo(() => horaInicio ? sumarMinutos(horaInicio, duracionMin) : '', [horaInicio, duracionMin])

  const precioBase = useMemo(() => {
    if (tipoAsignacion === 'plan') return Number(planSeleccionado?.precio || 0)
    if (tipoAsignacion === 'cita') return Number(servicioSeleccionado?.precio || 0)
    return 0
  }, [tipoAsignacion, planSeleccionado, servicioSeleccionado])

  const montoBase = useMemo(
    () => usarPrecioBase ? r2(precioBase) : r2(Number(montoPersonalizado || 0)),
    [usarPrecioBase, precioBase, montoPersonalizado]
  )

  // comisionBaseOriginal: lo que el plan/servicio define como base de comisión
  const comisionBaseOriginal = useMemo(() => {
    if (tipoAsignacion === 'plan') return r2(Number(planSeleccionado?.comision_base ?? planSeleccionado?.precio ?? 0))
    if (tipoAsignacion === 'cita') return r2(Number(servicioSeleccionado?.comision_base ?? servicioSeleccionado?.precio ?? 0))
    return 0
  }, [tipoAsignacion, planSeleccionado, servicioSeleccionado])

  // baseComisionAplicada: usa comisionBaseOriginal si el precio es el del plan/servicio,
  // o montoBase si el usuario editó el precio manualmente
  const baseComisionAplicada = useMemo(
    () => r2(Math.max(usarPrecioBase ? comisionBaseOriginal : montoBase, 0)),
    [usarPrecioBase, comisionBaseOriginal, montoBase]
  )

  const porcentajeRpmAplicado = useMemo(() => clamp(r2(porcentajeRpmEditable), 0, 100), [porcentajeRpmEditable])
  const porcentajeEntAplicado = useMemo(() => clamp(r2(100 - porcentajeRpmAplicado), 0, 100), [porcentajeRpmAplicado])
  const montoRpmAplicado      = useMemo(() => r2((baseComisionAplicada * porcentajeRpmAplicado) / 100), [baseComisionAplicada, porcentajeRpmAplicado])
  const montoEntAplicado      = useMemo(() => r2(baseComisionAplicada - montoRpmAplicado), [baseComisionAplicada, montoRpmAplicado])
  const comisionBalanceOk     = useMemo(() => Math.abs(r2(montoRpmAplicado + montoEntAplicado) - baseComisionAplicada) < 0.01, [montoRpmAplicado, montoEntAplicado, baseComisionAplicada])

  const tasaRef = useMemo(() => getTasaReferenciaFromState(pagoState), [pagoState])

  const comisionEq = useMemo(() => {
    if (!tasaRef || tasaRef <= 0)
      return { monto_base_usd: baseComisionAplicada, monto_base_bs: null, monto_rpm_usd: montoRpmAplicado, monto_rpm_bs: null, monto_profesional_usd: montoEntAplicado, monto_profesional_bs: null }
    return {
      monto_base_usd: baseComisionAplicada, monto_base_bs: r2(baseComisionAplicada * tasaRef),
      monto_rpm_usd: montoRpmAplicado,      monto_rpm_bs:  r2(montoRpmAplicado * tasaRef),
      monto_profesional_usd: montoEntAplicado, monto_profesional_bs: r2(montoEntAplicado * tasaRef),
    }
  }, [baseComisionAplicada, montoRpmAplicado, montoEntAplicado, tasaRef])

  const planificacion  = useMemo(() => {
    if (!fechaInicio || !diasSemana.length || !planSeleccionado) return null
    return calcularPlanificacion(fechaInicio, diasSemana, planSeleccionado.sesiones_totales, planSeleccionado.vigencia_valor, planSeleccionado.vigencia_tipo)
  }, [fechaInicio, diasSemana, planSeleccionado])

  const fechasPreview      = useMemo(() => planificacion?.fechas || [], [planificacion])
  const empleadoComisionId = tipoAsignacion === 'plan' ? empleadoId : citaTerapeutaId

  // ─── Loaders ──────────────────────────────────────────────────────────────

  async function resolveEmpleadoActualId(): Promise<string> {
    try {
      const { data } = await supabase.auth.getUser(); const uid = data.user?.id; if (!uid) return ''
      const { data: e1 } = await supabase.from('empleados').select('id').eq('auth_user_id', uid).maybeSingle()
      if (e1?.id) return String(e1.id)
      const { data: e2 } = await supabase.from('empleados').select('id').eq('id', uid).maybeSingle()
      if (e2?.id) return String(e2.id)
      return ''
    } catch { return '' }
  }

  async function loadEmpleadoActual() { setEmpleadoActualId(await resolveEmpleadoActualId()) }

  async function loadData() {
    setLoadingData(true); setErrorMsg('')
    try {
      const [tRes, pRes, sRes, rRes, mRes] = await Promise.all([
        supabase.from('empleados').select('id, nombre, rol, especialidad, comision_plan_porcentaje, comision_cita_porcentaje').eq('estado', 'activo').neq('rol', 'admin').order('nombre'),
        supabase.from('planes').select('id, nombre, sesiones_totales, vigencia_valor, vigencia_tipo, precio, descripcion, comision_base, comision_rpm, comision_entrenador').eq('estado', 'activo').order('nombre'),
        supabase.from('servicios').select('*').eq('estado', 'activo').order('nombre'),
        supabase.from('recursos').select('id, nombre, tipo, estado, capacidad, hora_inicio, hora_fin').order('nombre'),
        supabase.from('metodos_pago_v2').select(`id, nombre, tipo, moneda, cartera:carteras(nombre, codigo)`).eq('activo', true).eq('permite_recibir', true).order('orden', { ascending: true }).order('nombre', { ascending: true }),
      ])
      if (tRes.error) throw new Error(`Empleados: ${tRes.error.message}`)
      if (pRes.error) throw new Error(`Planes: ${pRes.error.message}`)
      if (sRes.error) throw new Error(`Servicios: ${sRes.error.message}`)
      if (rRes.error) throw new Error(`Recursos: ${rRes.error.message}`)
      if (mRes.error) throw new Error(`Métodos de pago: ${mRes.error.message}`)
      setEmpleados(((tRes.data || []) as EmpleadoAsignable[]).filter((e) => (e.rol || '').trim().toLowerCase() !== 'admin'))
      setPlanes((pRes.data || []) as Plan[])
      setServicios(((sRes.data || []) as ServicioRaw[]).filter((s) => s.estado !== 'inactivo').map((s) => ({
        id: s.id, nombre: s.nombre, precio: s.precio ?? null, estado: s.estado ?? null,
        duracion_min: getServicioDuracion(s), comision_base: s.comision_base ?? s.precio ?? 0,
        comision_rpm: s.comision_rpm ?? 0, comision_entrenador: s.comision_entrenador ?? 0,
      })))
      setRecursos((rRes.data || []) as Recurso[])
      setMetodosPago(((mRes.data || []) as any[]).map(normalizeMetodoPago))
    } catch (err: any) { setErrorMsg(err?.message || 'No se pudieron cargar los datos.') }
    finally { setLoadingData(false) }
  }

  // ─── Handlers comisión ────────────────────────────────────────────────────

  function handleChangePctRpm(v: string) { const p = clamp(Number(v || 0), 0, 100); setPorcentajeRpmEditable(r2(p)); setPorcentajeEntrenadorEditable(r2(100 - p)) }
  function handleChangePctEnt(v: string) { const p = clamp(Number(v || 0), 0, 100); setPorcentajeEntrenadorEditable(r2(p)); setPorcentajeRpmEditable(r2(100 - p)) }
  function handleChangeMontoRpm(v: string) { const m = clamp(Number(v || 0), 0, baseComisionAplicada); const p = baseComisionAplicada > 0 ? r2((m / baseComisionAplicada) * 100) : 0; setPorcentajeRpmEditable(p); setPorcentajeEntrenadorEditable(r2(100 - p)) }
  function handleChangeMontoEnt(v: string) { const m = clamp(Number(v || 0), 0, baseComisionAplicada); const p = baseComisionAplicada > 0 ? r2((m / baseComisionAplicada) * 100) : 0; setPorcentajeEntrenadorEditable(p); setPorcentajeRpmEditable(r2(100 - p)) }

  function resetearComision() {
    const base = tipoAsignacion === 'plan'
      ? r2(Number(planSeleccionado?.comision_base ?? planSeleccionado?.precio ?? 0))
      : r2(Number(servicioSeleccionado?.comision_base ?? servicioSeleccionado?.precio ?? 0))
    const rpm = tipoAsignacion === 'plan'
      ? Number(planSeleccionado?.comision_rpm ?? 0)
      : Number(servicioSeleccionado?.comision_rpm ?? 0)
    const pct = base > 0 ? clamp(r2((rpm / base) * 100), 0, 100) : 50
    setPorcentajeRpmEditable(r2(pct)); setPorcentajeEntrenadorEditable(r2(100 - pct))
  }

  function toggleDia(dia: number) { setDiasSemana((prev) => prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]) }
  function handleClienteChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target; setFormCliente((prev) => ({ ...prev, [name]: value }))
  }

  // ─── Crear plan inline ────────────────────────────────────────────────────

  async function crearPlanInline() {
    if (!nuevoPlanNombre.trim()) { alert('Ingresa el nombre del plan.'); return }
    if (!nuevoPlanPrecio || Number(nuevoPlanPrecio) <= 0) { alert('Ingresa un precio válido.'); return }
    setCreandoPlan(true)
    try {
      const precio = Number(nuevoPlanPrecio)
      const { data: plan, error } = await supabase.from('planes').insert({
        nombre: nuevoPlanNombre.trim(), sesiones_totales: nuevoPlanSesiones, vigencia_valor: nuevoPlanVigencia,
        vigencia_tipo: nuevoPlanVigenciaTipo, precio, comision_base: precio,
        comision_rpm: r2(precio * 0.5), comision_entrenador: r2(precio * 0.5), estado: 'activo',
      }).select('id, nombre, sesiones_totales, vigencia_valor, vigencia_tipo, precio, descripcion, comision_base, comision_rpm, comision_entrenador').single()
      if (error) throw new Error(error.message)
      setPlanes((prev) => [...prev, plan as Plan].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setPlanId(plan.id); setMostrarCrearPlan(false)
      setNuevoPlanNombre(''); setNuevoPlanSesiones(12); setNuevoPlanVigencia(30); setNuevoPlanVigenciaTipo('dias'); setNuevoPlanPrecio('')
    } catch (err: any) { alert(err?.message || 'Error al crear el plan.') }
    finally { setCreandoPlan(false) }
  }

  // ─── Comisión ─────────────────────────────────────────────────────────────

  async function registrarComision(planIdVal: string | null, citaIdVal: string | null, empId: string, clienteIdVal: string, base: number, fecha: string, porcRpm: number) {
    try {
      const rpm = r2((base * porcRpm) / 100); const profesional = r2(base - rpm)
      const tipo = planIdVal ? 'plan' : 'cita'
      const { data: existente } = await supabase.from('comisiones_detalle').select('id')
        .eq('empleado_id', empId).eq('cliente_id', clienteIdVal)
        .eq(planIdVal ? 'cliente_plan_id' : 'cita_id', planIdVal || citaIdVal).eq('tipo', tipo).limit(1).maybeSingle()
      if (existente?.id) return
      await supabase.from('comisiones_detalle').insert({
        empleado_id: empId, cliente_id: clienteIdVal,
        ...(planIdVal ? { cliente_plan_id: planIdVal } : {}),
        ...(citaIdVal ? { cita_id: citaIdVal } : {}),
        ...(citaServicioId ? { servicio_id: citaServicioId } : {}),
        fecha, base, profesional, rpm, tipo, estado: 'pendiente', pagado: false,
        porcentaje_rpm: porcRpm, moneda: tasaRef ? 'BS' : 'USD', tasa_bcv: tasaRef,
        monto_base_usd: comisionEq.monto_base_usd, monto_base_bs: comisionEq.monto_base_bs,
        monto_rpm_usd: comisionEq.monto_rpm_usd,   monto_rpm_bs: comisionEq.monto_rpm_bs,
        monto_profesional_usd: comisionEq.monto_profesional_usd, monto_profesional_bs: comisionEq.monto_profesional_bs,
      })
    } catch (err) { console.error('❌ Error registrando comisión:', err) }
  }

  // ─── Paso 1 ───────────────────────────────────────────────────────────────

  async function handleGuardarCliente(e: React.FormEvent) {
    e.preventDefault()
    if (creatingClientRef.current || saving) return
    setErrorMsg('')
    if (!formCliente.nombre.trim()) { setErrorMsg('El nombre es obligatorio.'); return }
    if (formCliente.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formCliente.email)) { setErrorMsg('El correo no tiene formato válido.'); return }
    creatingClientRef.current = true; setSaving(true)
    try {
      if (clienteId) { setPaso(2); return }
      let auditorId = empleadoActualId || ''
      if (!auditorId) { auditorId = await resolveEmpleadoActualId(); setEmpleadoActualId(auditorId) }
      const { data, error } = await supabase.from('clientes').insert({
        nombre: formCliente.nombre.trim(), cedula: formCliente.cedula.trim() || null,
        telefono: formCliente.telefono.trim() || null, email: formCliente.email.trim() || null,
        fecha_nacimiento: formCliente.fecha_nacimiento || null, genero: formCliente.genero || null,
        direccion: formCliente.direccion.trim() || null, terapeuta_id: formCliente.terapeuta_id || null,
        estado: formCliente.estado, notas: formCliente.notas.trim() || null,
        created_by: auditorId || null, updated_by: auditorId || null,
      }).select('id').single()
      if (error || !data) throw new Error(error?.message || 'No se pudo guardar el cliente.')
      setClienteId(data.id)
      if (formCliente.terapeuta_id) {
        setEmpleadoId(formCliente.terapeuta_id); setCitaTerapeutaId(formCliente.terapeuta_id)
        setFechaVistaCal(fechaInicio); setCitaFechaVistaCal(citaFecha)
      }
      setPaso(2); setErrorMsg('')
    } catch (err: any) { setErrorMsg(err?.message || 'No se pudo guardar el cliente.') }
    finally { setSaving(false); creatingClientRef.current = false }
  }

  // ─── Paso 2 ───────────────────────────────────────────────────────────────

  async function handleGuardarPaso2(e: React.FormEvent) {
    e.preventDefault()
    if (creatingPaso2Ref.current || saving) return
    setErrorMsg('')
    if (tipoAsignacion === 'ninguno') { setSaltarPago(true); setPaso(3); return }
    if (!clienteId) { setErrorMsg('Error: cliente no encontrado.'); return }

    if (tipoAsignacion === 'plan') {
      if (!planId) { setErrorMsg('Selecciona un plan.'); return }
      if (!empleadoId) { setErrorMsg('Selecciona un fisioterapeuta.'); return }
      if (!diasSemana.length) { setErrorMsg('Selecciona al menos un día.'); return }
      if (!horaInicio) { setErrorMsg('Selecciona la hora de entrenamiento.'); return }
      if (!planSeleccionado) { setErrorMsg('No se encontró el plan seleccionado.'); return }
      if (!planificacion) { setErrorMsg('No se pudo calcular la planificación.'); return }
      if (!planificacion.alcanzaVigencia) {
        setErrorMsg(`La vigencia no alcanza. Solo caben ${planificacion.sesionesPosibles} de ${planificacion.sesionesSolicitadas} sesiones antes del ${formatDate(planificacion.fechaFinPlan)}.`); return
      }
    }

    if (tipoAsignacion === 'cita') {
      if (!citaServicioId) { setErrorMsg('Selecciona el servicio.'); return }
      if (!citaTerapeutaId) { setErrorMsg('Selecciona el fisioterapeuta.'); return }
      if (!citaFecha) { setErrorMsg('Selecciona la fecha.'); return }
      if (!citaHoraInicio) { setErrorMsg('Selecciona la hora de inicio en el calendario.'); return }
      if (!citaHoraFin) { setErrorMsg('No se pudo calcular la hora final.'); return }
      if ((toMinutes(citaHoraFin) || 0) <= (toMinutes(citaHoraInicio) || 0)) { setErrorMsg('La hora final debe ser mayor que la hora inicial.'); return }
    }

    creatingPaso2Ref.current = true; setSaving(true)
    try {
      let auditorId = empleadoActualId || ''
      if (!auditorId) { auditorId = await resolveEmpleadoActualId(); setEmpleadoActualId(auditorId) }

      if (tipoAsignacion === 'plan') {
        const plan = planSeleccionado!
        const hiN = horaInicio.length === 5 ? `${horaInicio}:00` : horaInicio
        const hfN = horaFinPlan.length === 5 ? `${horaFinPlan}:00` : horaFinPlan
        let planIdActual = clientePlanId
        if (!planIdActual) {
          const { data: np, error: cpErr } = await supabase.from('clientes_planes').insert({
            cliente_id: clienteId, plan_id: plan.id, sesiones_totales: plan.sesiones_totales, sesiones_usadas: 0,
            fecha_inicio: fechaInicio, fecha_fin: planificacion!.fechaFinPlan, estado: 'activo',
            porcentaje_rpm: porcentajeRpmAplicado, monto_base_comision: baseComisionAplicada,
          }).select('id').single()
          if (cpErr) throw new Error(cpErr.message)
          planIdActual = np.id; setClientePlanId(np.id)
        }
        if (fechasPreview.length > 0 && planIdActual) {
          const { data: existentes } = await supabase.from('entrenamientos').select('id, fecha, hora_inicio, hora_fin, empleado_id').eq('cliente_plan_id', planIdActual)
          const existentesSet = new Set(((existentes || []) as any[]).map((row) => buildKey(String(row.fecha || ''), String(row.hora_inicio || ''), String(row.hora_fin || ''), String(row.empleado_id || ''))))
          const nuevos = fechasPreview.map((fecha) => ({ cliente_plan_id: planIdActual, cliente_id: clienteId, empleado_id: empleadoId, recurso_id: recursoId || null, fecha, hora_inicio: hiN, hora_fin: hfN, estado: 'programado' })).filter((item) => !existentesSet.has(buildKey(item.fecha, item.hora_inicio, item.hora_fin, item.empleado_id)))
          if (nuevos.length > 0) { const { error: entErr } = await supabase.from('entrenamientos').insert(nuevos); if (entErr) throw new Error(`Plan creado, error en entrenamientos: ${entErr.message}`) }
        }
      }

      if (tipoAsignacion === 'cita') {
        const hiN = citaHoraInicio.length === 5 ? `${citaHoraInicio}:00` : citaHoraInicio
        const hfN = citaHoraFin.length    === 5 ? `${citaHoraFin}:00`    : citaHoraFin
        const { data: validacion, error: valErr } = await supabase.rpc('validar_disponibilidad_cita', {
          p_cliente_id: clienteId, p_terapeuta_id: citaTerapeutaId,
          p_recurso_id: citaRecursoId || null, p_fecha: citaFecha,
          p_hora_inicio: hiN, p_hora_fin: hfN,
        })
        if (valErr) throw new Error(`Error validando disponibilidad: ${valErr.message}`)
        if (!(validacion as ValidacionCita)?.disponible) { setErrorMsg(buildErrorFromValidacion(validacion as ValidacionCita)); setSaving(false); creatingPaso2Ref.current = false; return }
        if (!citaId) {
          const { data: cita, error: citaErr } = await supabase.from('citas').insert({
            cliente_id: clienteId, terapeuta_id: citaTerapeutaId,
            servicio_id: citaServicioId, recurso_id: citaRecursoId || null,
            fecha: citaFecha, hora_inicio: hiN, hora_fin: hfN,
            estado: citaEstado, notas: citaNotas || null,
            created_by: auditorId || null, updated_by: auditorId || null,
          }).select('id').single()
          if (citaErr || !cita) throw new Error(citaErr?.message || 'No se pudo crear la cita.')
          setCitaId(cita.id)
        }
      }

      setPaso(3); setErrorMsg('')
    } catch (err: any) { setErrorMsg(err?.message || 'Error al guardar.') }
    finally { setSaving(false); creatingPaso2Ref.current = false }
  }

  // ─── Paso 3 ───────────────────────────────────────────────────────────────

  async function handleGuardarPago(e: React.FormEvent) {
    e.preventDefault()
    if (creatingPagoRef.current || saving) return
    setErrorMsg('')
    if (!clienteId) { setErrorMsg('No se encontró el cliente.'); return }

    if (!saltarPago && tipoAsignacion !== 'ninguno') {
      if (montoBase <= 0) { setErrorMsg('El monto debe ser mayor a 0.'); return }
      if (baseComisionAplicada <= 0) { setErrorMsg('La base de comisión debe ser mayor a 0.'); return }
      if (!comisionBalanceOk) { setErrorMsg('La distribución de comisión no cuadra correctamente.'); return }
      const errorPago = validarPagoConDeuda(pagoState, montoBase)
      if (errorPago) { setErrorMsg(errorPago); return }
    }

    creatingPagoRef.current = true; setSaving(true)
    try {
      let auditorId = empleadoActualId || ''
      if (!auditorId) { auditorId = await resolveEmpleadoActualId(); setEmpleadoActualId(auditorId) }

      if (!saltarPago && tipoAsignacion !== 'ninguno') {
        const concepto = tipoAsignacion === 'plan'
          ? `Plan: ${planSeleccionado?.nombre} — ${formCliente.nombre}`
          : `${servicioSeleccionado?.nombre || 'Servicio'} - ${formCliente.nombre}`

        if (pagoState.tipoCobro !== 'sin_pago') {
          const pagosPayload = buildPagosRpcPayload(pagoState, montoBase)
          if (pagosPayload) {
            const { error: pagoErr } = await supabase.rpc('registrar_pagos_mixtos', {
              p_fecha: tipoAsignacion === 'plan' ? fechaInicio : citaFecha,
              p_tipo_origen: tipoAsignacion === 'plan' ? 'plan' : 'cita',
              p_categoria: tipoAsignacion === 'plan' ? 'plan' : 'cita',
              p_concepto: concepto, p_cliente_id: clienteId,
              p_cita_id: tipoAsignacion === 'cita' ? citaId : null,
              p_cliente_plan_id: tipoAsignacion === 'plan' ? clientePlanId : null,
              p_cuenta_cobrar_id: null, p_inventario_id: null,
              p_registrado_por: auditorId || null, p_notas_generales: null,
              p_pagos: pagosPayload,
            })
            if (pagoErr) throw new Error(pagoErr.message)
          }
        }

        const cxcPayload = buildCuentaPorCobrarPayload({
          state: pagoState, montoTotal: montoBase, clienteId, clienteNombre: formCliente.nombre,
          concepto, fecha: tipoAsignacion === 'plan' ? fechaInicio : citaFecha,
          registradoPor: auditorId || null,
        })
        if (cxcPayload) {
          const { error: cxcErr } = await supabase.from('cuentas_por_cobrar').insert(cxcPayload)
          if (cxcErr) console.warn('No se pudo crear cuenta por cobrar:', cxcErr.message)
        }

        if (empleadoComisionId) {
          await registrarComision(
            tipoAsignacion === 'plan' ? clientePlanId : null,
            tipoAsignacion === 'cita' ? citaId : null,
            empleadoComisionId, clienteId, baseComisionAplicada,
            tipoAsignacion === 'plan' ? fechaInicio : citaFecha,
            porcentajeRpmAplicado
          )
          if (tipoAsignacion === 'plan' && clientePlanId) {
            await supabase.from('clientes_planes').update({ porcentaje_rpm: porcentajeRpmAplicado, monto_base_comision: baseComisionAplicada }).eq('id', clientePlanId)
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error registrando el pago.')
      setSaving(false); creatingPagoRef.current = false; return
    } finally { setSaving(false); creatingPagoRef.current = false }

    router.push(`/admin/personas/clientes/${clienteId}`)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loadingData) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/55">Clientes</p>
        <h1 className="text-2xl font-semibold text-white">Nuevo cliente</h1>
        <Card className="p-6"><p className="text-sm text-white/55">Cargando...</p></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Clientes</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Nuevo cliente</h1>
          <p className="mt-2 text-sm text-white/55">Registro completo en un solo flujo.</p>
        </div>
        <ActionCard title="Volver" description="Regresar al listado." href="/admin/personas/clientes" />
      </div>

      <Card className="p-4"><PasoIndicator actual={paso} /></Card>

      {/* ══════════ PASO 1 ══════════ */}
      {paso === 1 && (
        <Section title="Datos del cliente" description="Completa la información básica del cliente.">
          <form onSubmit={handleGuardarCliente} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Nombre completo *">
                  <input name="nombre" value={formCliente.nombre} onChange={handleClienteChange} placeholder="Ej: Juan Pérez" className={inputCls} required />
                </Field>
              </div>
              <Field label="Cédula"><input name="cedula" value={formCliente.cedula} onChange={handleClienteChange} placeholder="Ej: V-12345678" className={inputCls} /></Field>
              <Field label="Teléfono"><input name="telefono" value={formCliente.telefono} onChange={handleClienteChange} placeholder="+58 412 000 0000" className={inputCls} /></Field>
              <Field label="Correo"><input type="email" name="email" value={formCliente.email} onChange={handleClienteChange} placeholder="ejemplo@correo.com" className={inputCls} /></Field>
              <Field label="Fecha de nacimiento"><input type="date" name="fecha_nacimiento" value={formCliente.fecha_nacimiento} onChange={handleClienteChange} className={inputCls} /></Field>
              <Field label="Género">
                <select name="genero" value={formCliente.genero} onChange={handleClienteChange} className={inputCls}>
                  <option value="" className="bg-[#11131a]">Seleccionar</option>
                  <option value="masculino" className="bg-[#11131a]">Masculino</option>
                  <option value="femenino" className="bg-[#11131a]">Femenino</option>
                  <option value="otro" className="bg-[#11131a]">Otro</option>
                  <option value="prefiero_no_decir" className="bg-[#11131a]">Prefiero no decir</option>
                </select>
              </Field>
              <div className="md:col-span-2"><Field label="Dirección"><input name="direccion" value={formCliente.direccion} onChange={handleClienteChange} placeholder="Dirección del cliente" className={inputCls} /></Field></div>
              <Field label="Fisioterapeuta principal" helper="Se pre-seleccionará en el siguiente paso">
                <select name="terapeuta_id" value={formCliente.terapeuta_id} onChange={handleClienteChange} className={inputCls}>
                  <option value="" className="bg-[#11131a]">Sin asignar</option>
                  {empleados.map((t) => <option key={t.id} value={t.id} className="bg-[#11131a]">{t.nombre}{t.rol ? ` · ${getRolLabel(t.rol)}` : ''}{t.especialidad ? ` · ${t.especialidad}` : ''}</option>)}
                </select>
              </Field>
              <Field label="Estado">
                <select name="estado" value={formCliente.estado} onChange={handleClienteChange} className={inputCls}>
                  <option value="activo" className="bg-[#11131a]">Activo</option>
                  <option value="pausado" className="bg-[#11131a]">Pausado</option>
                  <option value="inactivo" className="bg-[#11131a]">Inactivo</option>
                </select>
              </Field>
              <div className="md:col-span-2"><Field label="Notas"><textarea name="notas" value={formCliente.notas} onChange={handleClienteChange} rows={3} placeholder="Notas internas..." className={`${inputCls} resize-none`} /></Field></div>
            </div>
            {errorMsg && <Card className="p-4"><p className="text-sm text-rose-400">{errorMsg}</p></Card>}
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-60">
                {saving ? 'Guardando...' : 'Guardar y continuar →'}
              </button>
            </div>
          </form>
        </Section>
      )}

      {/* ══════════ PASO 2 ══════════ */}
      {paso === 2 && (
        <Section title="Plan o cita" description="Elige qué quieres asignarle al cliente en este momento.">
          <form onSubmit={handleGuardarPaso2} className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: 'plan',    label: 'Plan de entrenamiento', desc: 'Sesiones recurrentes con calendario automático', icon: '📋' },
                { key: 'cita',    label: 'Cita / Sesión única',   desc: 'Agrega una cita directa en la agenda',           icon: '📅' },
                { key: 'ninguno', label: 'Solo registrar',        desc: 'Crear el cliente sin asignar nada por ahora',    icon: '👤' },
              ] as const).map((op) => (
                <button key={op.key} type="button" onClick={() => setTipoAsignacion(op.key)}
                  className={`rounded-2xl border p-4 text-left transition ${tipoAsignacion === op.key ? 'border-violet-400/40 bg-violet-500/15 text-violet-200' : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'}`}>
                  <p className="text-lg">{op.icon}</p>
                  <p className="mt-2 text-sm font-semibold">{op.label}</p>
                  <p className="mt-0.5 text-xs opacity-60">{op.desc}</p>
                </button>
              ))}
            </div>

            {/* ══ PLAN ══ */}
            {tipoAsignacion === 'plan' && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Plan">
                    <div className="flex gap-2">
                      <select value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputCls}>
                        <option value="" className="bg-[#11131a]">Seleccionar plan</option>
                        {planes.map((p) => <option key={p.id} value={p.id} className="bg-[#11131a]">{p.nombre} · {p.sesiones_totales} ses. · {formatVigencia(p.vigencia_valor, p.vigencia_tipo)} · {formatMoney(p.precio)}</option>)}
                      </select>
                      <button type="button" onClick={() => setMostrarCrearPlan((v) => !v)} className="shrink-0 rounded-2xl border border-violet-400/20 bg-violet-400/10 px-3 text-xs font-medium text-violet-300 transition hover:bg-violet-400/20">+ Plan</button>
                    </div>
                    {mostrarCrearPlan && (
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
                          <button type="button" onClick={crearPlanInline} disabled={creandoPlan} className="rounded-2xl border border-violet-400/20 bg-violet-400/15 px-4 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-400/25 disabled:opacity-60">{creandoPlan ? 'Creando...' : 'Crear y seleccionar'}</button>
                          <button type="button" onClick={() => setMostrarCrearPlan(false)} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/60 hover:bg-white/[0.06]">Cancelar</button>
                        </div>
                      </div>
                    )}
                  </Field>
                  <Field label="Fecha de inicio"><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={inputCls} /></Field>
                </div>

                {planSeleccionado && (
                  <Card className="border-white/10 bg-white/[0.02] p-4">
                    <p className="font-medium text-white">{planSeleccionado.nombre}</p>
                    {planSeleccionado.descripcion && <p className="mt-1 text-sm text-white/55">{planSeleccionado.descripcion}</p>}
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                      <div><p className="text-xs text-white/45">Sesiones</p><p className="font-medium text-white">{planSeleccionado.sesiones_totales}</p></div>
                      <div><p className="text-xs text-white/45">Vigencia</p><p className="font-medium text-white">{formatVigencia(planSeleccionado.vigencia_valor, planSeleccionado.vigencia_tipo)}</p></div>
                      <div><p className="text-xs text-white/45">Vence</p><p className="font-medium text-white">{formatDate(getFechaFin(fechaInicio, planSeleccionado.vigencia_valor, planSeleccionado.vigencia_tipo))}</p></div>
                      <div><p className="text-xs text-white/45">Precio</p><p className="font-medium text-white">{formatMoney(planSeleccionado.precio)}</p></div>
                    </div>
                  </Card>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Fisioterapeuta" helper="Pre-seleccionado del paso anterior">
                    <select value={empleadoId} onChange={(e) => { setEmpleadoId(e.target.value); setFechaVistaCal(fechaInicio) }} className={inputCls}>
                      <option value="" className="bg-[#11131a]">Seleccionar fisioterapeuta</option>
                      {empleados.map((t) => <option key={t.id} value={t.id} className="bg-[#11131a]">{t.nombre}{t.rol ? ` · ${getRolLabel(t.rol)}` : ''}</option>)}
                    </select>
                  </Field>
                  <Field label="Recurso / Espacio">
                    <select value={recursoId} onChange={(e) => setRecursoId(e.target.value)} className={inputCls}>
                      <option value="" className="bg-[#11131a]">Sin recurso</option>
                      {recursos.map((r) => <option key={r.id} value={r.id} className="bg-[#11131a]">{r.nombre}{r.tipo ? ` · ${r.tipo}` : ''}</option>)}
                    </select>
                  </Field>
                </div>

                <Field label="Días de entrenamiento" helper="Selecciona los días de la semana">
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Hora de inicio" helper="O haz clic en el calendario →"><input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className={inputCls} /></Field>
                  <Field label="Duración">
                    <select value={duracionMin} onChange={(e) => setDuracionMin(Number(e.target.value))} className={inputCls}>
                      {[30, 45, 60, 75, 90, 120].map((m) => <option key={m} value={m} className="bg-[#11131a]">{m} minutos</option>)}
                    </select>
                  </Field>
                </div>

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
                    <CalendarioDisponibilidad fechaVista={fechaVistaCal} horaInicio={horaInicio} horaFin={horaFinPlan} entrenamientosExistentes={entrenamientosEmpleado} onSelectHora={(hora) => setHoraInicio(hora)} />
                  </div>
                )}

                {planificacion && (
                  <Card className={`p-4 ${planificacion.alcanzaVigencia ? 'border-violet-400/20 bg-violet-400/5' : 'border-rose-400/20 bg-rose-400/5'}`}>
                    <p className={`text-sm font-medium ${planificacion.alcanzaVigencia ? 'text-violet-300' : 'text-rose-300'}`}>
                      {planificacion.alcanzaVigencia ? `Se generarán ${fechasPreview.length} entrenamientos dentro de la vigencia` : `La vigencia no alcanza: solo caben ${planificacion.sesionesPosibles} de ${planificacion.sesionesSolicitadas} sesiones`}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-4 text-sm">
                      <div><p className="text-xs text-white/45">Días/semana</p><p className="font-medium text-white">{planificacion.diasSeleccionados}</p></div>
                      <div><p className="text-xs text-white/45">Semanas base</p><p className="font-medium text-white">{planificacion.semanasBase}</p></div>
                      <div><p className="text-xs text-white/45">Vence</p><p className="font-medium text-white">{formatDate(planificacion.fechaFinPlan)}</p></div>
                      <div><p className="text-xs text-white/45">Sesiones posibles</p><p className="font-medium text-white">{planificacion.sesionesPosibles}</p></div>
                    </div>
                    {fechasPreview.length > 0 && (
                      <div className="mt-3 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                        {fechasPreview.slice(0, 24).map((f, i) => (
                          <span key={i} className={`rounded-lg px-2 py-0.5 text-xs ${planificacion.alcanzaVigencia ? 'bg-violet-500/10 text-violet-400' : 'bg-rose-500/10 text-rose-300'}`}>
                            {new Date(`${f}T00:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                          </span>
                        ))}
                        {fechasPreview.length > 24 && <span className="text-xs text-white/50">+{fechasPreview.length - 24} más</span>}
                      </div>
                    )}
                  </Card>
                )}
              </div>
            )}

            {/* ══ CITA ══ */}
            {tipoAsignacion === 'cita' && (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Fisioterapeuta">
                    <select value={citaTerapeutaId} onChange={(e) => { setCitaTerapeutaId(e.target.value); setCitaFechaVistaCal(citaFecha) }} className={inputCls}>
                      <option value="" className="bg-[#11131a]">Seleccionar fisioterapeuta</option>
                      {empleados.map((t) => <option key={t.id} value={t.id} className="bg-[#11131a]">{t.nombre}{t.rol ? ` · ${getRolLabel(t.rol)}` : ''}</option>)}
                    </select>
                  </Field>

                  <Field label="Servicio" helper={servicios.length === 0 ? 'No hay servicios activos.' : `${servicios.length} servicios disponibles.`}>
                    <select value={citaServicioId} onChange={(e) => setCitaServicioId(e.target.value)} className={inputCls}>
                      <option value="" className="bg-[#11131a]">Seleccionar servicio</option>
                      {servicios.map((s) => <option key={s.id} value={s.id} className="bg-[#11131a]">{s.nombre}{s.duracion_min ? ` · ${s.duracion_min} min` : ''}{s.precio ? ` · $${s.precio}` : ''}</option>)}
                    </select>
                  </Field>

                  <Field label="Recurso">
                    <select value={citaRecursoId} onChange={(e) => setCitaRecursoId(e.target.value)} className={inputCls}>
                      <option value="" className="bg-[#11131a]">Sin recurso</option>
                      {recursos.filter((r) => r.estado !== 'inactivo').map((r) => <option key={r.id} value={r.id} className="bg-[#11131a]">{r.nombre}{r.estado ? ` · ${r.estado}` : ''}</option>)}
                    </select>
                  </Field>

                  <Field label="Fecha">
                    <input type="date" value={citaFecha} onChange={(e) => { setCitaFecha(e.target.value); setCitaFechaVistaCal(e.target.value); setCitaHoraInicio(''); setCitaHoraFin('') }} className={inputCls} />
                  </Field>

                  <Field label="Estado">
                    <select value={citaEstado} onChange={(e) => setCitaEstado(e.target.value)} className={inputCls}>
                      <option value="programada"   className="bg-[#11131a]">Programada</option>
                      <option value="confirmada"   className="bg-[#11131a]">Confirmada</option>
                      <option value="reprogramada" className="bg-[#11131a]">Reprogramada</option>
                      <option value="completada"   className="bg-[#11131a]">Completada</option>
                    </select>
                  </Field>

                  <Field label="Hora inicio">
                    <input type="text" value={citaHoraInicio ? citaHoraInicio.slice(0, 5) : ''} readOnly className={`${inputCls} cursor-not-allowed opacity-70`} placeholder="Selecciona en el calendario" />
                  </Field>

                  <Field label="Hora fin" helper={servicioSeleccionado?.duracion_min ? `Se calcula en base a ${servicioSeleccionado.duracion_min} min.` : 'Selecciona un servicio.'}>
                    <input type="text" value={citaHoraFin ? citaHoraFin.slice(0, 5) : ''} readOnly className={`${inputCls} cursor-not-allowed opacity-70`} placeholder="Automático" />
                  </Field>
                </div>

                {citaTerapeutaId && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white/75">Disponibilidad del fisioterapeuta</p>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => { const d = new Date(`${citaFechaVistaCal}T00:00:00`); d.setDate(d.getDate() - 1); setCitaFechaVistaCal(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`) }} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.06]">←</button>
                        <input type="date" value={citaFechaVistaCal} onChange={(e) => setCitaFechaVistaCal(e.target.value)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white outline-none" />
                        <button type="button" onClick={() => { const d = new Date(`${citaFechaVistaCal}T00:00:00`); d.setDate(d.getDate() + 1); setCitaFechaVistaCal(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`) }} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.06]">→</button>
                      </div>
                    </div>
                    <CalendarioDisponibilidad fechaVista={citaFechaVistaCal} horaInicio={citaHoraInicio} horaFin={citaHoraFin} entrenamientosExistentes={citaEntrenamientos} onSelectHora={(hora) => { setCitaHoraInicio(hora); if (servicioSeleccionado?.duracion_min) setCitaHoraFin(sumarMinutos(hora, servicioSeleccionado.duracion_min)) }} />
                  </div>
                )}

                <Field label="Notas de la cita">
                  <textarea value={citaNotas} onChange={(e) => setCitaNotas(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="Notas opcionales..." />
                </Field>
              </div>
            )}

            {/* ══ NINGUNO ══ */}
            {tipoAsignacion === 'ninguno' && (
              <Card className="border-white/10 bg-white/[0.02] p-4">
                <p className="text-sm text-white/55">El cliente quedará registrado sin plan ni cita asignada. Podrás agregarlos desde su ficha después.</p>
              </Card>
            )}

            {errorMsg && <Card className="p-4"><p className="text-sm text-rose-400">{errorMsg}</p></Card>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setPaso(1)} className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]">← Atrás</button>
              <button type="submit" disabled={saving} className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-60">
                {saving ? 'Guardando...' : tipoAsignacion === 'ninguno' ? 'Continuar →' : 'Guardar y continuar →'}
              </button>
            </div>
          </form>
        </Section>
      )}

      {/* ══════════ PASO 3 ══════════ */}
      {paso === 3 && (
        <Section title="Pago" description="Registra el pago. Completo, abono parcial, o deja en deuda para cobranzas.">
          <form onSubmit={handleGuardarPago} className="space-y-5">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSaltarPago((p) => !p)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${saltarPago ? 'bg-white/20' : 'bg-emerald-500'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${saltarPago ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <span className="text-sm text-white/75">{saltarPago ? 'Saltar pago (registrar después)' : 'Registrar pago ahora'}</span>
            </div>

            {!saltarPago && tipoAsignacion !== 'ninguno' && (planSeleccionado || servicioSeleccionado) && (
              <div className="space-y-4">
                {/* Comisión */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <p className="text-sm font-semibold uppercase tracking-wider text-white/40">Configuración de comisión</p>
                    <button type="button" onClick={resetearComision} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60 transition hover:bg-white/[0.06]">
                      Restaurar comisión del {tipoAsignacion === 'plan' ? 'plan' : 'servicio'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Field label="Precio (USD)" helper={usarPrecioBase ? `Tomando el precio del ${tipoAsignacion === 'plan' ? 'plan' : 'servicio'}.` : 'Precio editable.'}>
                      <div className="flex gap-2">
                        <input type="number" min={0} step="0.01" value={usarPrecioBase ? String(precioBase) : montoPersonalizado} readOnly={usarPrecioBase} onChange={(e) => setMontoPersonalizado(e.target.value)} className={`${inputCls} ${usarPrecioBase ? 'cursor-not-allowed opacity-70' : ''}`} placeholder="0.00" />
                        <button type="button" onClick={() => setUsarPrecioBase((p) => !p)} className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white/60 hover:bg-white/[0.06]">{usarPrecioBase ? 'Editar' : tipoAsignacion === 'plan' ? 'Plan' : 'Servicio'}</button>
                      </div>
                    </Field>
                    <Field label="Base comisión"><input type="number" value={String(baseComisionAplicada)} readOnly className={`${inputCls} cursor-not-allowed opacity-80`} /></Field>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"><p className="text-xs text-white/45">Regla</p><p className="mt-2 text-sm text-white/75">Cambia un valor y el otro se ajusta automáticamente.</p></div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-violet-400/15 bg-white/[0.03] p-4">
                      <p className="mb-3 text-sm font-semibold text-violet-300">RPM</p>
                      <Field label="RPM porcentaje"><input type="number" min={0} max={100} step="0.01" value={porcentajeRpmAplicado} onChange={(e) => handleChangePctRpm(e.target.value)} className={inputCls} /></Field>
                      <div className="mt-4"><Field label="RPM monto"><input type="number" min={0} max={baseComisionAplicada} step="0.01" value={montoRpmAplicado} onChange={(e) => handleChangeMontoRpm(e.target.value)} className={inputCls} /></Field></div>
                    </div>
                    <div className="rounded-2xl border border-emerald-400/15 bg-white/[0.03] p-4">
                      <p className="mb-3 text-sm font-semibold text-emerald-300">{tipoAsignacion === 'plan' ? 'Entrenador' : 'Fisioterapeuta'}</p>
                      <Field label="Porcentaje"><input type="number" min={0} max={100} step="0.01" value={porcentajeEntAplicado} onChange={(e) => handleChangePctEnt(e.target.value)} className={inputCls} /></Field>
                      <div className="mt-4"><Field label="Monto"><input type="number" min={0} max={baseComisionAplicada} step="0.01" value={montoEntAplicado} onChange={(e) => handleChangeMontoEnt(e.target.value)} className={inputCls} /></Field></div>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5">
                      <p className="text-sm text-white/60">Base</p>
                      <p className="mt-2 text-3xl font-bold text-white">{formatMoney(baseComisionAplicada)}</p>
                      <p className="mt-2 text-xs text-white/40">Precio cobrado: {formatMoney(montoBase)}</p>
                    </div>
                    <div className="rounded-[28px] border border-violet-400/15 bg-white/[0.05] p-5">
                      <p className="text-sm text-white/60">RPM recibe</p>
                      <p className="mt-2 text-3xl font-bold text-violet-400">{formatMoney(montoRpmAplicado)}</p>
                      <p className="mt-2 text-sm text-white/50">{porcentajeRpmAplicado}%</p>
                    </div>
                    <div className="rounded-[28px] border border-emerald-400/15 bg-white/[0.05] p-5">
                      <p className="text-sm text-white/60">{tipoAsignacion === 'plan' ? 'Entrenador' : 'Fisioterapeuta'} recibe</p>
                      <p className="mt-2 text-3xl font-bold text-emerald-400">{formatMoney(montoEntAplicado)}</p>
                      <p className="mt-2 text-sm text-white/50">{porcentajeEntAplicado}%</p>
                    </div>
                  </div>
                  {comisionEq.monto_base_bs && (
                    <div className="mt-4 grid gap-2 border-t border-white/10 pt-4 text-sm md:grid-cols-3">
                      <div><span className="text-white/55">Base en Bs: </span><span className="text-white/75">{formatBs(comisionEq.monto_base_bs)}</span></div>
                      <div><span className="text-white/55">RPM en Bs: </span><span className="text-white/75">{formatBs(comisionEq.monto_rpm_bs || 0)}</span></div>
                      <div><span className="text-white/55">{tipoAsignacion === 'plan' ? 'Entrenador' : 'Fisio'} en Bs: </span><span className="text-white/75">{formatBs(comisionEq.monto_profesional_bs || 0)}</span></div>
                    </div>
                  )}
                </div>

                {/* Pago */}
                <Card className="p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white/75">Método de pago</p>
                    <div className="flex items-center rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <p className="text-xs text-white/45 mr-2">Total:</p>
                      <p className="text-sm font-semibold text-white">{formatMoney(montoBase)}</p>
                    </div>
                  </div>
                  <PagoConDeudaSelector
                    montoTotal={montoBase}
                    fecha={tipoAsignacion === 'plan' ? fechaInicio : citaFecha}
                    metodosPago={metodosPago}
                    value={pagoState}
                    onChange={setPagoState}
                    concepto={tipoAsignacion === 'plan' ? `Plan: ${planSeleccionado?.nombre}` : servicioSeleccionado?.nombre || 'Servicio'}
                    clienteNombre={formCliente.nombre}
                    mostrarMontoTotal={false}
                  />
                </Card>
              </div>
            )}

            {tipoAsignacion === 'ninguno' && (
              <Card className="border-white/10 p-4"><p className="text-sm text-white/55">No se registró plan ni cita, no hay pago que hacer.</p></Card>
            )}
            {!saltarPago && tipoAsignacion !== 'ninguno' && !planSeleccionado && !servicioSeleccionado && (
              <Card className="border-white/10 p-4"><p className="text-sm text-white/55">No se asignó plan ni servicio, no hay pago que registrar.</p></Card>
            )}

            {errorMsg && <Card className="p-4"><p className="text-sm text-rose-400">{errorMsg}</p></Card>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setPaso(2)} className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]">← Atrás</button>
              <button type="submit" disabled={saving} className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-60">
                {saving ? 'Finalizando...' : 'Finalizar registro →'}
              </button>
            </div>
          </form>
        </Section>
      )}
    </div>
  )
}