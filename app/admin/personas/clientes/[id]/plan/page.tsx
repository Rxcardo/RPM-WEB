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
import SelectorTasaBCV from '@/components/finanzas/SelectorTasaBCV'

type Cliente = { id: string; nombre: string; estado: string }

type VigenciaTipo = 'dias' | 'semanas' | 'meses'

type Plan = {
  id: string
  nombre: string
  sesiones_totales: number
  vigencia_valor: number
  vigencia_tipo: VigenciaTipo
  precio: number
  estado: string
  descripcion: string | null
  comision_base?: number | null
  comision_rpm?: number | null
  comision_entrenador?: number | null
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
  rol: string | null
  especialidad: string | null
  comision_plan_porcentaje: number
  comision_cita_porcentaje: number
}

type Recurso = { id: string; nombre: string; tipo: string | null }

type MetodoPago = {
  id: string
  nombre: string
  tipo: string | null
  moneda?: string | null
  color?: string | null
  icono?: string | null
  cartera?: {
    nombre: string
    codigo: string
  } | null
}

type EntrenamientoExistente = {
  id: string
  hora_inicio: string
  hora_fin: string
  fecha: string
  estado: string
  clientes: { nombre: string } | null
}

type PlanificacionSesiones = {
  fechas: string[]
  fechaFinPlan: string
  sesionesPosibles: number
  sesionesSolicitadas: number
  alcanzaVigencia: boolean
}

type PagoMixtoItem = {
  id_local: string
  moneda_pago: 'USD' | 'BS'
  metodo_pago_v2_id: string
  monto_usd: string
  monto_bs: number | null
  tasa_bcv: number | null
  referencia: string
  notas: string
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

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeMetodoPago(row: any): MetodoPago {
  const cartera = firstOrNull(row?.cartera)
  return {
    id: String(row?.id ?? ''),
    nombre: String(row?.nombre ?? ''),
    tipo: row?.tipo ?? null,
    moneda: row?.moneda ?? null,
    color: row?.color ?? null,
    icono: row?.icono ?? null,
    cartera: cartera
      ? { nombre: String(cartera?.nombre ?? ''), codigo: String(cartera?.codigo ?? '') }
      : null,
  }
}

function normalizeEntrenamientoExistente(row: any): EntrenamientoExistente {
  const cliente = firstOrNull(row?.clientes)
  return {
    id: String(row?.id ?? ''),
    hora_inicio: String(row?.hora_inicio ?? ''),
    hora_fin: String(row?.hora_fin ?? ''),
    fecha: String(row?.fecha ?? ''),
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

function getFechaFinByVigencia(
  fechaInicio: string,
  vigenciaValor: number,
  vigenciaTipo: VigenciaTipo
) {
  const vigenciaDias = getVigenciaDias(vigenciaValor, vigenciaTipo)
  return addDaysToDate(fechaInicio, Math.max(vigenciaDias - 1, 0))
}

function formatVigencia(valor: number | null | undefined, tipo: VigenciaTipo | string | null | undefined) {
  const n = Number(valor || 0)
  const t = String(tipo || '').toLowerCase()
  if (!n) return '—'
  if (t === 'dias') return `${n} ${n === 1 ? 'día' : 'días'}`
  if (t === 'semanas') return `${n} ${n === 1 ? 'semana' : 'semanas'}`
  if (t === 'meses') return `${n} ${n === 1 ? 'mes' : 'meses'}`
  return `${n}`
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

function r2(v: number) {
  return Math.round(v * 100) / 100
}

function nn(v: string) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function calcularPlanificacionSesiones(
  fechaInicio: string,
  diasSemana: number[],
  totalSesiones: number,
  vigenciaValor: number,
  vigenciaTipo: VigenciaTipo
): PlanificacionSesiones {
  const vigenciaDias = getVigenciaDias(vigenciaValor, vigenciaTipo)

  if (!fechaInicio || !diasSemana.length || !totalSesiones || !vigenciaDias) {
    return {
      fechas: [],
      fechaFinPlan: fechaInicio || '',
      sesionesPosibles: 0,
      sesionesSolicitadas: totalSesiones || 0,
      alcanzaVigencia: false,
    }
  }

  const fechaFinPlan = getFechaFinByVigencia(fechaInicio, vigenciaValor, vigenciaTipo)
  const current = new Date(`${fechaInicio}T00:00:00`)
  const limite = new Date(`${fechaFinPlan}T23:59:59`)
  const fechas: string[] = []
  let sesionesPosibles = 0
  let guard = 0

  while (current <= limite && guard < 5000) {
    if (diasSemana.includes(current.getDay())) {
      sesionesPosibles++
      if (fechas.length < totalSesiones) {
        fechas.push(
          `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
        )
      }
    }
    current.setDate(current.getDate() + 1)
    guard++
  }

  return {
    fechas,
    fechaFinPlan,
    sesionesPosibles,
    sesionesSolicitadas: totalSesiones,
    alcanzaVigencia: sesionesPosibles >= totalSesiones,
  }
}

function getRolLabel(rol: string | null | undefined) {
  const value = (rol || '').trim().toLowerCase()
  if (value === 'terapeuta' || value === 'fisioterapeuta') return 'Fisioterapeuta'
  if (value === 'entrenador') return 'Entrenador'
  if (!value) return 'Sin rol'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function detectarMetodoBs(metodo: MetodoPago | null) {
  if (!metodo) return false
  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const tipo = (metodo.tipo || '').toLowerCase()
  const carteraCodigo = (metodo.cartera?.codigo || '').toLowerCase()

  return (
    moneda === 'BS' ||
    moneda === 'VES' ||
    nombre.includes('bs') ||
    nombre.includes('bolívar') ||
    nombre.includes('bolivar') ||
    nombre.includes('pago movil') ||
    nombre.includes('pago móvil') ||
    nombre.includes('movil') ||
    nombre.includes('móvil') ||
    tipo.includes('bs') ||
    tipo.includes('bolívar') ||
    tipo.includes('bolivar') ||
    tipo.includes('pago_movil') ||
    carteraCodigo.includes('bs') ||
    carteraCodigo.includes('ves')
  )
}

function detectarMetodoUsd(metodo: MetodoPago | null) {
  if (!metodo) return false
  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const carteraCodigo = (metodo.cartera?.codigo || '').toLowerCase()

  return (
    moneda === 'USD' ||
    nombre.includes('usd') ||
    nombre.includes('zelle') ||
    nombre.includes('efectivo $') ||
    nombre.includes('efectivo usd') ||
    carteraCodigo.includes('usd')
  )
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
  fechaVista,
  horaInicio,
  horaFin,
  entrenamientosExistentes,
  onSelectHora,
}: {
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

function makePagoItem(moneda: 'USD' | 'BS' = 'USD'): PagoMixtoItem {
  return {
    id_local: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    moneda_pago: moneda,
    metodo_pago_v2_id: '',
    monto_usd: '',
    monto_bs: null,
    tasa_bcv: null,
    referencia: '',
    notas: '',
  }
}

const PagoBsSelector = memo(function PagoBsSelector({
  fecha,
  montoUsd,
  montoBs,
  onChangeTasa,
  onChangeMontoBs,
}: {
  fecha: string
  montoUsd: number
  montoBs: number | null
  onChangeTasa: (tasa: number | null) => void
  onChangeMontoBs: (monto: number) => void
}) {
  return (
    <SelectorTasaBCV
      fecha={fecha}
      monedaPago="BS"
      monedaReferencia="EUR"
      montoUSD={montoUsd}
      montoBs={montoBs || undefined}
      onTasaChange={onChangeTasa}
      onMontoBsChange={onChangeMontoBs}
    />
  )
})

export default function ClientePlanPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const assigningRef = useRef(false)
  const renewingRef = useRef(false)
  const cancellingRef = useRef(false)

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

  const [registrarPago, setRegistrarPago] = useState(true)
  const [usarPrecioPlan, setUsarPrecioPlan] = useState(true)
  const [montoPersonalizado, setMontoPersonalizado] = useState('')
  const [notasPagoGenerales, setNotasPagoGenerales] = useState('')
  const [pagosMixtos, setPagosMixtos] = useState<PagoMixtoItem[]>([makePagoItem('USD')])

  const [motivoCancelacion, setMotivoCancelacion] = useState('')
  const [pagoAlCancelar, setPagoAlCancelar] = useState<'si' | 'no' | null>(null)

  const [fechaVistaCal, setFechaVistaCal] = useState(getTodayLocal())

  const [mostrarCrearPlan, setMostrarCrearPlan] = useState(false)
  const [nuevoPlanNombre, setNuevoPlanNombre] = useState('')
  const [nuevoPlanSesiones, setNuevoPlanSesiones] = useState(12)
  const [nuevoPlanVigencia, setNuevoPlanVigencia] = useState(30)
  const [nuevoPlanVigenciaTipo, setNuevoPlanVigenciaTipo] = useState<VigenciaTipo>('dias')
  const [nuevoPlanPrecio, setNuevoPlanPrecio] = useState('')
  const [creandoPlan, setCreandoPlan] = useState(false)

  const [renovarConPendientes, setRenovarConPendientes] = useState<OpcionArrastreSesiones>('si')

  const fetchAll = useCallback(async () => {
    if (!id) return
    setLoading(true)

    const [clienteRes, planesRes, planActivoRes, empleadosRes, recursosRes, metodosRes] = await Promise.all([
      supabase.from('clientes').select('id, nombre, estado').eq('id', id).single(),
      supabase
        .from('planes')
        .select('id, nombre, sesiones_totales, vigencia_valor, vigencia_tipo, precio, estado, descripcion, comision_base, comision_rpm, comision_entrenador')
        .eq('estado', 'activo')
        .order('nombre'),
      supabase
        .from('clientes_planes')
        .select(`
          id, cliente_id, plan_id, sesiones_totales, sesiones_usadas,
          fecha_inicio, fecha_fin, estado, created_at, origen,
          porcentaje_rpm, monto_base_comision,
          planes:plan_id (
            id, nombre, sesiones_totales, vigencia_valor, vigencia_tipo, precio, estado, descripcion, comision_base, comision_rpm, comision_entrenador
          )
        `)
        .eq('cliente_id', id)
        .eq('estado', 'activo')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('empleados')
        .select('id, nombre, rol, especialidad, comision_plan_porcentaje, comision_cita_porcentaje')
        .eq('estado', 'activo')
        .neq('rol', 'admin')
        .order('nombre'),
      supabase.from('recursos').select('id, nombre, tipo').order('nombre'),
      supabase
        .from('metodos_pago_v2')
        .select(`id, nombre, tipo, moneda, color, icono, cartera:carteras(nombre, codigo)`)
        .eq('activo', true)
        .eq('permite_recibir', true)
        .order('orden', { ascending: true })
        .order('nombre', { ascending: true }),
    ])

    if (clienteRes.error || !clienteRes.data) {
      setErrorMsg('No se pudo cargar el cliente.')
      setLoading(false)
      return
    }

    setCliente(clienteRes.data as Cliente)
    setPlanes((planesRes.data || []) as Plan[])
    setPlanActivo((planActivoRes.data as ClientePlan | null) || null)
    setEmpleados(
      ((empleadosRes.data || []) as Empleado[]).filter(
        (emp) => (emp.rol || '').trim().toLowerCase() !== 'admin'
      )
    )
    setRecursos((recursosRes.data || []) as Recurso[])
    setMetodosPago(((metodosRes.data || []) as any[]).map(normalizeMetodoPago))
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
      .then(({ data }) => setEntrenamientosEmpleado(((data || []) as any[]).map(normalizeEntrenamientoExistente)))
  }, [empleadoId, fechaVistaCal])

  const selectedPlan = useMemo(
    () => planes.find((p) => p.id === selectedPlanId) || null,
    [planes, selectedPlanId]
  )

  const horaFin = useMemo(
    () => (horaInicio ? sumarMinutos(horaInicio, duracionMin) : ''),
    [horaInicio, duracionMin]
  )

  const montoBase = useMemo(
    () => (usarPrecioPlan ? selectedPlan?.precio || 0 : Number(montoPersonalizado || 0)),
    [usarPrecioPlan, selectedPlan, montoPersonalizado]
  )

  const porcentajeRpmPlan = useMemo(() => {
    const base = Number(selectedPlan?.comision_base ?? selectedPlan?.precio ?? 0)
    const rpm = Number(selectedPlan?.comision_rpm ?? 0)
    if (!base) return 0
    return r2((rpm / base) * 100)
  }, [selectedPlan])

  const porcentajeEntrenadorPlan = useMemo(() => {
    const base = Number(selectedPlan?.comision_base ?? selectedPlan?.precio ?? 0)
    const entrenador = Number(selectedPlan?.comision_entrenador ?? 0)
    if (!base) return 0
    return r2((entrenador / base) * 100)
  }, [selectedPlan])

  const baseComisionAplicada = useMemo(() => {
    return usarPrecioPlan ? Number(selectedPlan?.comision_base ?? selectedPlan?.precio ?? 0) : montoBase
  }, [usarPrecioPlan, selectedPlan, montoBase])

  const montoRpmAplicado = useMemo(() => {
    return r2((baseComisionAplicada * porcentajeRpmPlan) / 100)
  }, [baseComisionAplicada, porcentajeRpmPlan])

  const montoEntrenadorAplicado = useMemo(() => {
    return r2((baseComisionAplicada * porcentajeEntrenadorPlan) / 100)
  }, [baseComisionAplicada, porcentajeEntrenadorPlan])


  const sesionesRestantes = planActivo
    ? Math.max(Number(planActivo.sesiones_totales) - Number(planActivo.sesiones_usadas), 0)
    : 0

  const progresoUso = planActivo
    ? Math.min(
        Math.round((Number(planActivo.sesiones_usadas) / Math.max(Number(planActivo.sesiones_totales), 1)) * 100),
        100
      )
    : 0

  const totalPreviewSesiones = useMemo(() => {
    if (!selectedPlan) return 0
    return modo === 'renovar'
      ? renovarConPendientes === 'si'
        ? selectedPlan.sesiones_totales + sesionesRestantes
        : selectedPlan.sesiones_totales
      : selectedPlan.sesiones_totales
  }, [selectedPlan, modo, renovarConPendientes, sesionesRestantes])

  const planificacionPreview = useMemo(() => {
    if (!selectedPlan || !fechaInicio || !diasSemana.length || !totalPreviewSesiones) return null
    return calcularPlanificacionSesiones(fechaInicio, diasSemana, totalPreviewSesiones, selectedPlan.vigencia_valor, selectedPlan.vigencia_tipo)
  }, [selectedPlan, fechaInicio, diasSemana, totalPreviewSesiones])

  const fechaFinPreview = useMemo(() => planificacionPreview?.fechaFinPlan || null, [planificacionPreview])
  const fechasPreview = useMemo(() => planificacionPreview?.fechas || [], [planificacionPreview])

  const faltanSesionesPreview = useMemo(() => {
    if (!planificacionPreview) return 0
    return Math.max(planificacionPreview.sesionesSolicitadas - planificacionPreview.fechas.length, 0)
  }, [planificacionPreview])

  function toggleDia(dia: number) {
    setDiasSemana((prev) => (prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]))
  }

  function resetForm() {
    setSelectedPlanId('')
    setFechaInicio(getTodayLocal())
    setEmpleadoId('')
    setRecursoId('')
    setDiasSemana([])
    setHoraInicio('')
    setDuracionMin(60)
    setRegistrarPago(true)
    setUsarPrecioPlan(true)
    setMontoPersonalizado('')
    setNotasPagoGenerales('')
    setPagosMixtos([makePagoItem('USD')])
    setMotivoCancelacion('')
    setPagoAlCancelar(null)
    setFechaVistaCal(getTodayLocal())
    setErrorMsg('')
    setSuccessMsg('')
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
          vigencia_valor: nuevoPlanVigencia,
          vigencia_tipo: nuevoPlanVigenciaTipo,
          precio: Number(nuevoPlanPrecio),
          comision_base: Number(nuevoPlanPrecio),
          comision_rpm: r2(Number(nuevoPlanPrecio) * 0.35),
          comision_entrenador: r2(Number(nuevoPlanPrecio) * 0.65),
          estado: 'activo',
        })
        .select('id, nombre, sesiones_totales, vigencia_valor, vigencia_tipo, precio, estado, descripcion, comision_base, comision_rpm, comision_entrenador')
        .single()

      if (error) throw new Error(error.message)

      setPlanes((prev) => [...prev, plan as Plan].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setSelectedPlanId(plan.id)

      setMostrarCrearPlan(false)
      setNuevoPlanNombre('')
      setNuevoPlanSesiones(12)
      setNuevoPlanVigencia(30)
      setNuevoPlanVigenciaTipo('dias')
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
    clienteIdValue: string,
    base: number,
    fecha: string,
    rpm: number,
    profesional: number
  ) {
    try {
      const { data: existente } = await supabase
        .from('comisiones_detalle')
        .select('id')
        .eq('cliente_plan_id', clientePlanId)
        .eq('empleado_id', empId)
        .eq('tipo', 'plan')
        .limit(1)
        .maybeSingle()

      if (existente?.id) return

      const { error } = await supabase.from('comisiones_detalle').insert({
        empleado_id: empId,
        cliente_id: clienteIdValue,
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

    await supabase.from('entrenamientos').update({ estado: 'cancelado' })
      .eq('cliente_plan_id', planId)
      .eq('estado', 'programado')

    const { data: eventoExistente } = await supabase
      .from('clientes_planes_eventos')
      .select('id')
      .eq('cliente_plan_id', planId)
      .eq('cliente_id', id)
      .eq('tipo', 'cancelado')
      .eq('detalle', detalle)
      .limit(1)
      .maybeSingle()

    if (!eventoExistente?.id) {
      await supabase.from('clientes_planes_eventos').insert({
        cliente_plan_id: planId,
        cliente_id: id,
        tipo: 'cancelado',
        detalle,
      })
    }
  }

  function buildEntrenamientosPayload(
    fechas: string[],
    clientePlanId: string,
    empleadoIdValue: string,
    horaInicioValue: string,
    horaFinValue: string,
    recursoIdValue: string
  ) {
    return fechas.map((f) => ({
      cliente_plan_id: clientePlanId,
      cliente_id: id,
      empleado_id: empleadoIdValue,
      recurso_id: recursoIdValue || null,
      fecha: f,
      hora_inicio: horaInicioValue,
      hora_fin: horaFinValue,
      estado: 'programado',
      asistencia_estado: 'pendiente',
      aviso_previo: false,
      consume_sesion: false,
      reprogramable: false,
      motivo_asistencia: null,
      reprogramado_de_entrenamiento_id: null,
    }))
  }

  function buildEntrenamientoKey(fecha: string, hi: string, hf: string, empId: string) {
    return `${fecha}__${hi}__${hf}__${empId}`
  }

  async function ensureEntrenamientos(
    clientePlanId: string,
    fechas: string[],
    empleadoIdValue: string,
    horaInicioValue: string,
    horaFinValue: string,
    recursoIdValue: string
  ) {
    const { data: existentes, error: existentesError } = await supabase
      .from('entrenamientos')
      .select('id, fecha, hora_inicio, hora_fin, empleado_id')
      .eq('cliente_plan_id', clientePlanId)

    if (existentesError) throw new Error(`Entrenamientos: ${existentesError.message}`)

    const existentesSet = new Set(
      ((existentes || []) as any[]).map((row) =>
        buildEntrenamientoKey(
          String(row.fecha || ''),
          String(row.hora_inicio || ''),
          String(row.hora_fin || ''),
          String(row.empleado_id || '')
        )
      )
    )

    const payload = buildEntrenamientosPayload(
      fechas,
      clientePlanId,
      empleadoIdValue,
      horaInicioValue,
      horaFinValue,
      recursoIdValue
    ).filter((item) => !existentesSet.has(buildEntrenamientoKey(item.fecha, item.hora_inicio, item.hora_fin, item.empleado_id)))

    if (!payload.length) return

    const { error } = await supabase.from('entrenamientos').insert(payload)
    if (error) throw new Error(`Entrenamientos: ${error.message}`)
  }

  function getMetodosForMoneda(moneda: 'USD' | 'BS') {
    return moneda === 'USD'
      ? metodosPago.filter((m) => detectarMetodoUsd(m))
      : metodosPago.filter((m) => detectarMetodoBs(m))
  }

  function updatePagoItem(idLocal: string, patch: Partial<PagoMixtoItem>) {
    setPagosMixtos((prev) =>
      prev.map((item) => (item.id_local === idLocal ? { ...item, ...patch } : item))
    )
  }

  function addPagoItem(moneda: 'USD' | 'BS' = 'USD') {
    setPagosMixtos((prev) => [...prev, makePagoItem(moneda)])
  }

  function removePagoItem(idLocal: string) {
    setPagosMixtos((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((item) => item.id_local !== idLocal)
    })
  }

  const handlePagoBsTasaChange = useCallback((idLocal: string, tasa: number | null) => {
    setPagosMixtos((prev) =>
      prev.map((item) =>
        item.id_local === idLocal
          ? { ...item, tasa_bcv: tasa }
          : item
      )
    )
  }, [])

  const handlePagoBsMontoChange = useCallback((idLocal: string, monto: number) => {
    setPagosMixtos((prev) =>
      prev.map((item) =>
        item.id_local === idLocal
          ? { ...item, monto_bs: monto }
          : item
      )
    )
  }, [])

  const resumenPagos = useMemo(() => {
    const items = pagosMixtos.map((item) => {
      const montoUsdEq =
        item.moneda_pago === 'USD'
          ? r2(Number(item.monto_usd || 0))
          : Number(item.monto_bs || 0) > 0 && Number(item.tasa_bcv || 0) > 0
            ? r2(Number(item.monto_bs || 0) / Number(item.tasa_bcv || 0))
            : 0

      const montoBs =
        item.moneda_pago === 'BS'
          ? r2(Number(item.monto_bs || 0))
          : Number(item.tasa_bcv || 0) > 0 && Number(item.monto_usd || 0) > 0
            ? r2(Number(item.monto_usd || 0) * Number(item.tasa_bcv || 0))
            : 0

      return {
        ...item,
        monto_equivalente_usd: montoUsdEq,
        monto_equivalente_bs: montoBs > 0 ? montoBs : null,
        monto_insertar:
          item.moneda_pago === 'BS'
            ? r2(Number(item.monto_bs || 0))
            : r2(Number(item.monto_usd || 0)),
        valido:
          !!item.metodo_pago_v2_id &&
          (
            item.moneda_pago === 'USD'
              ? Number(item.monto_usd || 0) > 0
              : Number(item.monto_bs || 0) > 0 && Number(item.tasa_bcv || 0) > 0
          ),
      }
    })

    const totalUsd = r2(
      items.reduce((acc, item) => acc + Number(item.monto_equivalente_usd || 0), 0)
    )
    const totalBs = r2(
      items.reduce((acc, item) => acc + Number(item.monto_equivalente_bs || 0), 0)
    )
    const faltanteUsd = r2(Math.max(montoBase - totalUsd, 0))
    const excedenteUsd = r2(Math.max(totalUsd - montoBase, 0))
    const diferenciaUsd = r2(montoBase - totalUsd)

    return {
      items,
      totalUsd,
      totalBs,
      faltanteUsd,
      excedenteUsd,
      diferenciaUsd,
      cuadra: Math.abs(diferenciaUsd) < 0.01 && montoBase > 0,
      todosValidos: items.every((item) => item.valido),
    }
  }, [pagosMixtos, montoBase])

  async function registrarPagoMixtoPlan(params: {
    fecha: string
    clientePlanId: string
    concepto: string
    notasGenerales: string
  }) {
    const { fecha, clientePlanId, concepto, notasGenerales } = params

    const pagosRpcPayload = resumenPagos.items.map((item) => ({
      metodo_pago_v2_id: item.metodo_pago_v2_id,
      moneda_pago: item.moneda_pago,
      monto: item.monto_insertar,
      tasa_bcv: item.moneda_pago === 'BS' ? item.tasa_bcv : item.tasa_bcv || null,
      referencia: item.referencia || null,
      notas: item.notas || null,
    }))

    const { error } = await supabase.rpc('registrar_pagos_mixtos', {
      p_fecha: fecha,
      p_tipo_origen: 'plan',
      p_categoria: 'plan',
      p_concepto: concepto,
      p_cliente_id: id,
      p_cita_id: null,
      p_cliente_plan_id: clientePlanId,
      p_cuenta_cobrar_id: null,
      p_inventario_id: null,
      p_registrado_por: null,
      p_notas_generales: notasGenerales || null,
      p_pagos: pagosRpcPayload,
    })

    if (error) throw new Error(`Pago: ${error.message}`)
  }

  async function handleAsignar(e: React.FormEvent) {
    e.preventDefault()
    if (assigningRef.current || saving) return

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
      setErrorMsg('Selecciona un fisioterapeuta.')
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

    if (registrarPago) {
      if (montoBase <= 0) {
        setErrorMsg('El monto del plan debe ser mayor a 0.')
        return
      }
      if (!resumenPagos.todosValidos) {
        setErrorMsg('Completa correctamente todos los fragmentos del pago mixto.')
        return
      }
      if (!resumenPagos.cuadra) {
        setErrorMsg(
          `La suma de pagos no cuadra. Objetivo: ${formatMoney(montoBase)} | Registrado: ${formatMoney(
            resumenPagos.totalUsd
          )} | Faltante: ${formatMoney(resumenPagos.faltanteUsd)}`
        )
        return
      }
    }

    const plan = selectedPlan!
    const baseC = baseComisionAplicada
    const rpmV = montoRpmAplicado
    const entV = montoEntrenadorAplicado

    const planificacion = calcularPlanificacionSesiones(
      fechaInicio,
      diasSemana,
      plan.sesiones_totales,
      plan.vigencia_valor,
      plan.vigencia_tipo
    )
    if (!planificacion.alcanzaVigencia) {
      setErrorMsg(`No caben ${plan.sesiones_totales} sesiones dentro de la vigencia del plan. Solo se pudieron ubicar ${planificacion.sesionesPosibles} entre ${formatDate(fechaInicio)} y ${formatDate(planificacion.fechaFinPlan)}.`)
      return
    }

    assigningRef.current = true
    setSaving(true)

    try {
      if (planActivo) {
        await cancelarPlanAnterior(planActivo.id, 'Reemplazado manualmente por asignación de un nuevo plan')
      }

      const { data: np, error: cpE } = await supabase.from('clientes_planes').insert({
        cliente_id: id,
        plan_id: plan.id,
        sesiones_totales: plan.sesiones_totales,
        sesiones_usadas: 0,
        fecha_inicio: fechaInicio,
        fecha_fin: planificacion.fechaFinPlan,
        estado: 'activo',
      }).select('id').single()

      if (cpE) throw new Error(cpE.message)

      const hiN = horaInicio.length === 5 ? `${horaInicio}:00` : horaInicio
      const hfN = horaFin.length === 5 ? `${horaFin}:00` : horaFin

      await ensureEntrenamientos(np.id, planificacion.fechas, empleadoId, hiN, hfN, recursoId)

      if (registrarPago && montoBase > 0) {
        const concepto = `Plan: ${plan.nombre} — ${cliente?.nombre || 'Cliente'}`
        await registrarPagoMixtoPlan({
          fecha: fechaInicio,
          clientePlanId: np.id,
          concepto,
          notasGenerales: notasPagoGenerales,
        })
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

      setSuccessMsg(`Plan "${plan.nombre}" asignado. ${planificacion.fechas.length} entrenamientos generados.`)
      resetForm()
      setModo(null)
      await fetchAll()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al asignar el plan.')
    } finally {
      setSaving(false)
      assigningRef.current = false
    }
  }

  async function handleRenovar(e: React.FormEvent) {
    e.preventDefault()
    if (renewingRef.current || saving) return

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
      setErrorMsg('Selecciona un fisioterapeuta.')
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

    if (registrarPago) {
      if (montoBase <= 0) {
        setErrorMsg('El monto del plan debe ser mayor a 0.')
        return
      }
      if (!resumenPagos.todosValidos) {
        setErrorMsg('Completa correctamente todos los fragmentos del pago mixto.')
        return
      }
      if (!resumenPagos.cuadra) {
        setErrorMsg(
          `La suma de pagos no cuadra. Objetivo: ${formatMoney(montoBase)} | Registrado: ${formatMoney(
            resumenPagos.totalUsd
          )} | Faltante: ${formatMoney(resumenPagos.faltanteUsd)}`
        )
        return
      }
    }

    const plan = selectedPlan!
    const sesN = renovarConPendientes === 'si' ? plan.sesiones_totales + sesionesRestantes : plan.sesiones_totales
    const baseC = baseComisionAplicada
    const rpmV = montoRpmAplicado
    const entV = montoEntrenadorAplicado

    const planificacion = calcularPlanificacionSesiones(
      fechaInicio,
      diasSemana,
      sesN,
      plan.vigencia_valor,
      plan.vigencia_tipo
    )
    if (!planificacion.alcanzaVigencia) {
      setErrorMsg(`No caben ${sesN} sesiones dentro de la vigencia del plan. Solo se pudieron ubicar ${planificacion.sesionesPosibles} entre ${formatDate(fechaInicio)} y ${formatDate(planificacion.fechaFinPlan)}.`)
      return
    }

    renewingRef.current = true
    setSaving(true)

    try {
      if (planActivo) {
        const detalleRenovacion = renovarConPendientes === 'si'
          ? `Renovado arrastrando ${sesionesRestantes} sesiones pendientes`
          : 'Renovado sin arrastrar sesiones pendientes'
        await cancelarPlanAnterior(planActivo.id, detalleRenovacion)
      }

      const { data: np, error: cpE } = await supabase.from('clientes_planes').insert({
        cliente_id: id,
        plan_id: plan.id,
        sesiones_totales: sesN,
        sesiones_usadas: 0,
        fecha_inicio: fechaInicio,
        fecha_fin: planificacion.fechaFinPlan,
        estado: 'activo',
      }).select('id').single()

      if (cpE) throw new Error(cpE.message)

      const hiN = horaInicio.length === 5 ? `${horaInicio}:00` : horaInicio
      const hfN = horaFin.length === 5 ? `${horaFin}:00` : horaFin

      await ensureEntrenamientos(np.id, planificacion.fechas, empleadoId, hiN, hfN, recursoId)

      if (registrarPago && montoBase > 0) {
        const concepto =
          renovarConPendientes === 'si'
            ? `Renovación: ${plan.nombre} — ${cliente?.nombre || 'Cliente'} (+${sesionesRestantes} pendientes)`
            : `Renovación: ${plan.nombre} — ${cliente?.nombre || 'Cliente'} (sin pendientes)`

        await registrarPagoMixtoPlan({
          fecha: fechaInicio,
          clientePlanId: np.id,
          concepto,
          notasGenerales: notasPagoGenerales,
        })
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
      renewingRef.current = false
    }
  }

  async function handleCancelar(e: React.FormEvent) {
    e.preventDefault()
    if (cancellingRef.current || saving) return

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

    cancellingRef.current = true
    setSaving(true)

    try {
      await supabase.from('clientes_planes').update({ estado: 'cancelado' }).eq('id', planActivo.id)

      await supabase.from('entrenamientos').update({ estado: 'cancelado' })
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

      if (pagoAlCancelar === 'no') {
        await supabase
          .from('pagos')
          .update({ estado: 'anulado', notas: 'Anulado por cancelación de plan sin pago confirmado' })
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
      cancellingRef.current = false
    }
  }

  function renderPagoMixtoSection() {
    return (
      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setRegistrarPago((p) => !p)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${registrarPago ? 'bg-emerald-500' : 'bg-white/10'}`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${registrarPago ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
          <span className="text-sm text-white/75">Registrar pago en finanzas</span>
        </div>

        {registrarPago && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Monto objetivo USD" helper={usarPrecioPlan ? 'Precio del plan' : 'Monto personalizado'}>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={usarPrecioPlan ? (selectedPlan?.precio ?? '') : montoPersonalizado}
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

              <Field label="Total registrado USD">
                <input
                  type="text"
                  value={formatMoney(resumenPagos.totalUsd)}
                  readOnly
                  className={`${inputCls} cursor-not-allowed opacity-70`}
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Notas generales del pago (opcional)">
                  <textarea
                    value={notasPagoGenerales}
                    onChange={(e) => setNotasPagoGenerales(e.target.value)}
                    rows={3}
                    className={`${inputCls} resize-none`}
                    placeholder="Notas generales que aplican a toda la operación..."
                  />
                </Field>
              </div>
            </div>

            <div className="space-y-4">
              {pagosMixtos.map((item, index) => {
                const metodosDisponibles = getMetodosForMoneda(item.moneda_pago)
                const montoUsdEq =
                  item.moneda_pago === 'USD'
                    ? r2(Number(item.monto_usd || 0))
                    : Number(item.monto_bs || 0) > 0 && Number(item.tasa_bcv || 0) > 0
                      ? r2(Number(item.monto_bs || 0) / Number(item.tasa_bcv || 0))
                      : 0

                return (
                  <div
                    key={item.id_local}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">Fragmento #{index + 1}</p>
                        <p className="text-xs text-white/45">
                          {item.moneda_pago === 'BS'
                            ? `Equivalente USD calculado: ${formatMoney(montoUsdEq)}`
                            : `Monto del fragmento: ${formatMoney(montoUsdEq)}`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removePagoItem(item.id_local)}
                        disabled={pagosMixtos.length <= 1}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70 hover:bg-white/[0.06] disabled:opacity-40"
                      >
                        Quitar
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Moneda">
                        <select
                          value={item.moneda_pago}
                          onChange={(e) =>
                            updatePagoItem(item.id_local, {
                              moneda_pago: e.target.value as 'USD' | 'BS',
                              metodo_pago_v2_id: '',
                              monto_usd: '',
                              monto_bs: null,
                              tasa_bcv: null,
                            })
                          }
                          className={inputCls}
                        >
                          <option value="USD" className="bg-[#11131a]">USD</option>
                          <option value="BS" className="bg-[#11131a]">Bs</option>
                        </select>
                      </Field>

                      <Field label={item.moneda_pago === 'USD' ? 'Método USD' : 'Método Bs'}>
                        <select
                          value={item.metodo_pago_v2_id}
                          onChange={(e) =>
                            updatePagoItem(item.id_local, {
                              metodo_pago_v2_id: e.target.value,
                            })
                          }
                          className={inputCls}
                        >
                          <option value="" className="bg-[#11131a]">Seleccionar</option>
                          {metodosDisponibles.map((m) => (
                            <option key={m.id} value={m.id} className="bg-[#11131a]">
                              {m.nombre}
                              {m.moneda ? ` · ${m.moneda}` : ''}
                              {m.tipo ? ` · ${m.tipo}` : ''}
                            </option>
                          ))}
                        </select>
                      </Field>

                      {item.moneda_pago === 'USD' ? (
                        <Field label="Monto USD">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.monto_usd}
                            onChange={(e) =>
                              updatePagoItem(item.id_local, {
                                monto_usd: e.target.value,
                              })
                            }
                            className={inputCls}
                            placeholder="0.00"
                          />
                        </Field>
                      ) : (
                        <Field label="Monto Bs">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.monto_bs ?? ''}
                            onChange={(e) =>
                              updatePagoItem(item.id_local, {
                                monto_bs: e.target.value ? Number(e.target.value) : null,
                              })
                            }
                            className={inputCls}
                            placeholder="0.00"
                          />
                        </Field>
                      )}

                      {item.moneda_pago === 'BS' && (
                        <div className="md:col-span-3">
                          <PagoBsSelector
                            fecha={fechaInicio}
                            montoUsd={
                              Number(item.monto_bs || 0) > 0 && Number(item.tasa_bcv || 0) > 0
                                ? r2(Number(item.monto_bs || 0) / Number(item.tasa_bcv || 0))
                                : 0
                            }
                            montoBs={item.monto_bs}
                            onChangeTasa={(tasa) => handlePagoBsTasaChange(item.id_local, tasa)}
                            onChangeMontoBs={(monto) => handlePagoBsMontoChange(item.id_local, monto)}
                          />
                        </div>
                      )}

                      {item.moneda_pago === 'BS' && (
                        <div className="md:col-span-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-white/55">Equivalente USD calculado:</span>
                            <span className="text-white">
                              {formatMoney(
                                Number(item.monto_bs || 0) > 0 && Number(item.tasa_bcv || 0) > 0
                                  ? r2(Number(item.monto_bs || 0) / Number(item.tasa_bcv || 0))
                                  : 0
                              )}
                            </span>
                          </div>
                        </div>
                      )}

                      <Field label="Referencia">
                        <input
                          value={item.referencia}
                          onChange={(e) =>
                            updatePagoItem(item.id_local, {
                              referencia: e.target.value,
                            })
                          }
                          className={inputCls}
                          placeholder="Referencia o comprobante"
                        />
                      </Field>

                      <div className="md:col-span-2">
                        <Field label="Notas del fragmento">
                          <input
                            value={item.notas}
                            onChange={(e) =>
                              updatePagoItem(item.id_local, {
                                notas: e.target.value,
                              })
                            }
                            className={inputCls}
                            placeholder="Notas opcionales..."
                          />
                        </Field>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => addPagoItem('USD')}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
              >
                + Agregar pago USD
              </button>

              <button
                type="button"
                onClick={() => addPagoItem('BS')}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
              >
                + Agregar pago Bs
              </button>
            </div>

            <Card className="border-emerald-400/20 bg-emerald-400/5 p-4">
              <p className="text-sm font-medium text-emerald-300">Resumen del pago</p>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-white/45">Objetivo</p>
                  <p className="font-semibold text-emerald-400">{formatMoney(montoBase)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/45">Total USD</p>
                  <p className="text-white">{formatMoney(resumenPagos.totalUsd)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/45">Total Bs</p>
                  <p className="text-white">{formatBs(resumenPagos.totalBs)}</p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                {!resumenPagos.cuadra ? (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/55">Faltante USD:</span>
                      <span className="font-semibold text-amber-300">
                        {formatMoney(resumenPagos.faltanteUsd)}
                      </span>
                    </div>

                    {resumenPagos.excedenteUsd > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-white/55">Excedente USD:</span>
                        <span className="font-semibold text-rose-300">
                          {formatMoney(resumenPagos.excedenteUsd)}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/55">Estado:</span>
                    <span className="font-semibold text-emerald-300">Pago completo</span>
                  </div>
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    )
  }

  function renderPlanForm(submitLabel: string, onSubmit: (e: React.FormEvent) => Promise<void>) {
    const baseV = baseComisionAplicada
    const rpmV = montoRpmAplicado
    const entV = montoEntrenadorAplicado

    return (
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan">
            <div className="flex gap-2">
              <select
                value={selectedPlanId}
                onChange={(e) => {
                  setSelectedPlanId(e.target.value)
                }}
                className={inputCls}
              >
                <option value="" className="bg-[#11131a]">Seleccionar plan</option>
                {planes.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#11131a]">
                    {p.nombre} · {p.sesiones_totales} ses. · {formatVigencia(p.vigencia_valor, p.vigencia_tipo)} · {formatMoney(p.precio)}
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
                    <label className="mb-1 block text-xs text-white/55">Vigencia</label>
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
                  {modo === 'renovar'
                    ? (renovarConPendientes === 'si'
                        ? selectedPlan.sesiones_totales + sesionesRestantes
                        : selectedPlan.sesiones_totales)
                    : selectedPlan.sesiones_totales}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/45">Vence</p>
                <p className="font-medium text-white">
                  {formatDate(getFechaFinByVigencia(fechaInicio, selectedPlan.vigencia_valor, selectedPlan.vigencia_tipo))}
                </p>
              </div>
            </div>

            {faltanSesionesPreview > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
                <p className="text-sm text-amber-300">
                  Con esta combinación de días y vigencia no caben todas las sesiones. Faltan {faltanSesionesPreview} por ubicar antes del vencimiento.
                </p>
              </div>
            )}
          </Card>
        )}

        {modo === 'renovar' && planActivo && (
          <div className="space-y-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-4">
            <p className="text-sm font-medium text-emerald-300">Sesiones pendientes del plan actual</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setRenovarConPendientes('si')}
                className={`rounded-2xl border p-4 text-left transition ${renovarConPendientes === 'si' ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
              >
                <p className="text-sm font-semibold text-white">Sí, conservar pendientes</p>
                <p className="mt-1 text-xs text-white/45">Se suman {sesionesRestantes} sesiones pendientes al nuevo plan.</p>
              </button>
              <button
                type="button"
                onClick={() => setRenovarConPendientes('no')}
                className={`rounded-2xl border p-4 text-left transition ${renovarConPendientes === 'no' ? 'border-rose-400/30 bg-rose-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
              >
                <p className="text-sm font-semibold text-white">No, empezar limpio</p>
                <p className="mt-1 text-xs text-white/45">No se suman pendientes. El nuevo plan empieza solo con sus sesiones propias.</p>
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fisioterapeuta">
            <select
              value={empleadoId}
              onChange={(e) => {
                setEmpleadoId(e.target.value)
                setFechaVistaCal(fechaInicio)
              }}
              className={inputCls}
            >
              <option value="" className="bg-[#11131a]">Seleccionar fisioterapeuta</option>
              {empleados.map((e) => (
                <option key={e.id} value={e.id} className="bg-[#11131a]">
                  {e.nombre}
                  {e.rol ? ` · ${getRolLabel(e.rol)}` : ''}
                  {e.especialidad ? ` · ${e.especialidad}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Recurso / Espacio">
            <select value={recursoId} onChange={(e) => setRecursoId(e.target.value)} className={inputCls}>
              <option value="" className="bg-[#11131a]">Sin recurso</option>
              {recursos.map((r) => (
                <option key={r.id} value={r.id} className="bg-[#11131a]">{r.nombre}</option>
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
            <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Duración (minutos)">
            <select value={duracionMin} onChange={(e) => setDuracionMin(Number(e.target.value))} className={inputCls}>
              {[30, 45, 60, 75, 90, 120].map((m) => (
                <option key={m} value={m} className="bg-[#11131a]">{m} minutos</option>
              ))}
            </select>
          </Field>
        </div>

        {empleadoId && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white/75">Disponibilidad del fisioterapeuta</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(`${fechaVistaCal}T00:00:00`)
                    d.setDate(d.getDate() - 1)
                    setFechaVistaCal(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
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
                    setFechaVistaCal(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.06]"
                >
                  →
                </button>
              </div>
            </div>
            <CalendarioDisponibilidad
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
            <p className="text-sm font-medium text-violet-300">Se generarán {fechasPreview.length} entrenamientos</p>
            {fechaFinPreview && (
              <p className="mt-1 text-xs text-white/45">Vigencia: {formatDate(fechaInicio)} → {formatDate(fechaFinPreview)}</p>
            )}
            <div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              {fechasPreview.slice(0, 30).map((f, i) => (
                <span key={i} className="rounded-lg bg-violet-500/10 px-2 py-0.5 text-xs text-violet-400">
                  {new Date(`${f}T00:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                </span>
              ))}
              {fechasPreview.length > 30 && <span className="text-xs text-violet-400/60">+{fechasPreview.length - 30} más</span>}
            </div>
            {faltanSesionesPreview > 0 && (
              <p className="mt-3 text-xs text-amber-300">Faltan {faltanSesionesPreview} sesiones por ubicar antes de la fecha de vencimiento.</p>
            )}
          </Card>
        )}

        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-sm font-medium text-white/75">Configuración de comisión</p>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Precio (USD)" helper={usarPrecioPlan ? 'Tomando el precio del plan.' : 'Precio editable para este plan.'}>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={usarPrecioPlan ? String(selectedPlan?.precio ?? '') : montoPersonalizado}
                  readOnly={usarPrecioPlan}
                  onChange={(e) => setMontoPersonalizado(e.target.value)}
                  className={`${inputCls} ${usarPrecioPlan ? 'cursor-not-allowed opacity-70' : ''}`}
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

            <Field label="Base comisión">
              <input
                type="number"
                value={String(baseV)}
                readOnly
                className={`${inputCls} cursor-not-allowed opacity-80`}
              />
            </Field>

            <Field label="RPM recibe">
              <input
                type="text"
                value={`${formatMoney(rpmV)} · ${porcentajeRpmPlan}%`}
                readOnly
                className={`${inputCls} cursor-not-allowed opacity-80`}
              />
            </Field>

            <Field label="Entrenador recibe">
              <input
                type="text"
                value={`${formatMoney(entV)} · ${porcentajeEntrenadorPlan}%`}
                readOnly
                className={`${inputCls} cursor-not-allowed opacity-80`}
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
              <p className="text-xs text-white/25">{porcentajeRpmPlan}%</p>
            </Card>
            <Card className="border-emerald-400/20 bg-emerald-400/5 p-4">
              <p className="text-xs text-white/45">Entrenador recibe</p>
              <p className="mt-1 text-lg font-semibold text-emerald-400">{formatMoney(entV)}</p>
              <p className="text-xs text-white/25">{porcentajeEntrenadorPlan}%</p>
            </Card>
          </div>
        </div>

        {renderPagoMixtoSection()}

        {errorMsg && <Card className="p-4"><p className="text-sm text-rose-400">{errorMsg}</p></Card>}
        {successMsg && <Card className="p-4"><p className="text-sm text-emerald-400">{successMsg}</p></Card>}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving || faltanSesionesPreview > 0}
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
          <p className="mt-2 text-sm text-white/55">{cliente.nombre}</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard title="Volver al cliente" description="Ver ficha completa." href={`/admin/personas/clientes/${id}`} />
          <ActionCard title="Nueva cita" description="Agendar cita." href={`/admin/operaciones/agenda/nueva?cliente=${id}`} />
        </div>
      </div>

      {successMsg && !modo && (
        <Card className="p-4"><p className="text-sm text-emerald-400">{successMsg}</p></Card>
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
                  <p className="mt-1 text-xs text-white/45">{planActivo ? 'Reemplazar plan actual' : 'Asignar primer plan'}</p>
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
                  <p className="mt-1 text-xs text-white/45">{planActivo ? `${sesionesRestantes} ses. pendientes disponibles` : 'Sin plan activo'}</p>
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
                  <p className="mt-1 text-xs text-rose-400/60">{planActivo ? 'Cancela plan y entrenamientos futuros' : 'Sin plan activo'}</p>
                </button>
              </div>
            </Section>
          )}

          {modo === 'asignar' && (
            <Section title="Asignar plan" description="Asigna un plan y genera entrenamientos.">
              {planActivo && (
                <Card className="mb-4 border-amber-400/20 bg-amber-400/5 p-4">
                  <p className="text-sm text-amber-300">⚠️ El plan actual "{planActivo.planes?.nombre}" será reemplazado.</p>
                </Card>
              )}
              {renderPlanForm('Asignar plan', handleAsignar)}
            </Section>
          )}

          {modo === 'renovar' && (
            <Section title="Renovar plan" description="Renueva el plan y decide si arrastra pendientes.">
              {sesionesRestantes > 0 ? (
                <Card className="mb-4 border-emerald-400/20 bg-emerald-400/5 p-4">
                  <p className="text-sm text-emerald-300">El cliente tiene {sesionesRestantes} sesiones pendientes. Puedes decidir si se suman o no.</p>
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
                          motivoCancelacion === op.value ? 'border-rose-400/30 bg-rose-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
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
                      className={`rounded-2xl border p-3 text-left transition ${pagoAlCancelar === 'si' ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
                    >
                      <p className="text-sm font-medium text-white">✓ Sí pagó</p>
                      <p className="mt-1 text-xs text-white/45">Se cancela el plan, pero el pago y la comisión se mantienen.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPagoAlCancelar('no')}
                      className={`rounded-2xl border p-3 text-left transition ${pagoAlCancelar === 'no' ? 'border-rose-400/30 bg-rose-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'}`}
                    >
                      <p className="text-sm font-medium text-white">✗ No pagó</p>
                      <p className="mt-1 text-xs text-white/45">El plan queda cancelado sin efecto económico, como si nunca se hubiera acreditado.</p>
                    </button>
                  </div>
                </Field>

                {errorMsg && <Card className="p-4"><p className="text-sm text-rose-400">{errorMsg}</p></Card>}

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