'use client'

export const dynamic = 'force-dynamic'

import {
  memo,
  useCallback,
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
import SelectorTasaBCV from '@/components/finanzas/SelectorTasaBCV'

type VigenciaTipo = 'dias' | 'semanas' | 'meses'

type EmpleadoAsignable = {
  id: string
  nombre: string
  rol: string | null
  especialidad: string | null
  comision_plan_porcentaje: number
  comision_cita_porcentaje: number
}

type Plan = {
  id: string
  nombre: string
  sesiones_totales: number
  vigencia_valor: number
  vigencia_tipo: VigenciaTipo
  precio: number
  descripcion: string | null
  comision_base?: number | null
  comision_rpm?: number | null
  comision_entrenador?: number | null
}

type Recurso = {
  id: string
  nombre: string
  tipo: string | null
}

type MetodoPago = {
  id: string
  nombre: string
  tipo: string | null
  moneda: 'USD' | 'VES' | 'BS' | string | null
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
  clientes: { nombre: string } | null
}

type PlanificacionSesiones = {
  fechas: string[]
  fechaFinPlan: string
  sesionesPosibles: number
  sesionesSolicitadas: number
  alcanzaVigencia: boolean
  semanasBase: number
  diasSeleccionados: number
  ultimaFechaPosible: string | null
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
      ? {
          nombre: String(cartera?.nombre ?? ''),
          codigo: String(cartera?.codigo ?? ''),
        }
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
    clientes: cliente
      ? {
          nombre: String(cliente?.nombre ?? ''),
        }
      : null,
  }
}

function getTodayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`
}

function addDaysToDate(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

function getVigenciaDias(vigenciaValor: number, vigenciaTipo: VigenciaTipo) {
  const valor = Math.max(Number(vigenciaValor || 0), 0)

  if (vigenciaTipo === 'semanas') return valor * 7
  if (vigenciaTipo === 'meses') return valor * 30
  return valor
}

function getFechaFinByVigencia(fechaInicio: string, vigenciaValor: number, vigenciaTipo: VigenciaTipo) {
  const vigenciaDias = getVigenciaDias(vigenciaValor, vigenciaTipo)
  const diasReales = Math.max(vigenciaDias - 1, 0)
  return addDaysToDate(fechaInicio, diasReales)
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
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(v || 0))
}

function formatBs(v: number) {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    maximumFractionDigits: 2,
  }).format(v)
}

function formatVigencia(valor: number, tipo: VigenciaTipo) {
  if (!valor) return '—'

  if (valor === 1) {
    if (tipo === 'dias') return '1 día'
    if (tipo === 'semanas') return '1 semana'
    return '1 mes'
  }

  if (tipo === 'dias') return `${valor} días`
  if (tipo === 'semanas') return `${valor} semanas`
  return `${valor} meses`
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

function getRolLabel(rol: string | null | undefined) {
  const value = (rol || '').trim().toLowerCase()

  if (value === 'terapeuta' || value === 'fisioterapeuta') return 'Fisioterapeuta'
  if (value === 'entrenador') return 'Entrenador'
  if (!value) return 'Sin rol'

  return value.charAt(0).toUpperCase() + value.slice(1)
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
      semanasBase: 0,
      diasSeleccionados: diasSemana.length,
      ultimaFechaPosible: null,
    }
  }

  const diasOrdenados = [...diasSemana].sort((a, b) => a - b)
  const fechaFinPlan = getFechaFinByVigencia(fechaInicio, vigenciaValor, vigenciaTipo)
  const inicio = new Date(`${fechaInicio}T00:00:00`)
  const fin = new Date(`${fechaFinPlan}T23:59:59`)
  const current = new Date(`${fechaInicio}T00:00:00`)

  const fechas: string[] = []
  let guard = 0

  while (current <= fin && guard < 5000) {
    if (diasOrdenados.includes(current.getDay())) {
      fechas.push(
        `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(
          current.getDate()
        ).padStart(2, '0')}`
      )
      if (fechas.length >= totalSesiones) break
    }

    current.setDate(current.getDate() + 1)
    guard++
  }

  let sesionesPosibles = 0
  const scan = new Date(`${fechaInicio}T00:00:00`)
  guard = 0

  while (scan <= fin && guard < 5000) {
    if (diasOrdenados.includes(scan.getDay())) {
      sesionesPosibles++
    }
    scan.setDate(scan.getDate() + 1)
    guard++
  }

  const diasPorSemana = Math.max(diasSemana.length, 1)
  const semanasBase = Math.ceil(totalSesiones / diasPorSemana)

  const diasEntre = Math.max(
    1,
    Math.floor(
      (new Date(`${fechaFinPlan}T00:00:00`).getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)
    ) + 1
  )

  return {
    fechas,
    fechaFinPlan,
    sesionesPosibles,
    sesionesSolicitadas: totalSesiones,
    alcanzaVigencia: sesionesPosibles >= totalSesiones,
    semanasBase,
    diasSeleccionados: diasSemana.length,
    ultimaFechaPosible: diasEntre > 0 ? fechaFinPlan : null,
  }
}

function buildEntrenamientoKey(fecha: string, horaInicio: string, horaFin: string, empleadoId: string) {
  return `${fecha}__${horaInicio}__${horaFin}__${empleadoId}`
}

function Field({
  label,
  children,
  helper,
}: {
  label: string
  children: ReactNode
  helper?: string
}) {
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

function PasoIndicator({ actual }: { paso?: number; actual: number }) {
  const pasos = [
    { n: 1, label: 'Datos del cliente' },
    { n: 2, label: 'Plan y entrenamientos' },
    { n: 3, label: 'Pago' },
  ]

  return (
    <div className="flex items-center gap-2">
      {pasos.map((p, i) => (
        <div key={p.n} className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition ${
              p.n < actual
                ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-400'
                : p.n === actual
                  ? 'border-violet-400/40 bg-violet-500/20 text-violet-300'
                  : 'border-white/10 bg-white/[0.03] text-white/30'
            }`}
          >
            {p.n < actual ? '✓' : p.n}
          </div>

          <span className={`hidden text-sm sm:block ${p.n === actual ? 'text-white' : 'text-white/35'}`}>
            {p.label}
          </span>

          {i < pasos.length - 1 && (
            <div className={`h-px w-8 ${p.n < actual ? 'bg-emerald-400/30' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

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

  function getTop(minutes: number) {
    return (minutes / 60) * HOUR_HEIGHT
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
              <span className="w-12 shrink-0 pr-2 text-right text-xs text-white/25 -translate-y-2">
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

          {entrenamientosExistentes.map((ent) => {
            const top = getTop(timeToMinutes(ent.hora_inicio))
            const height = Math.max(20, getTop(timeToMinutes(ent.hora_fin)) - top)

            return (
              <div
                key={ent.id}
                className="pointer-events-none absolute left-12 right-2 overflow-hidden rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1"
                style={{ top, height }}
              >
                <p className="truncate text-xs font-medium text-rose-300">
                  {ent.clientes?.nombre || 'Cliente'}
                </p>
                <p className="text-xs text-rose-400/70">
                  {ent.hora_inicio.slice(0, 5)} – {ent.hora_fin.slice(0, 5)}
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

export default function NuevoClientePage() {
  const router = useRouter()

  const creatingClientRef = useRef(false)
  const creatingPlanRef = useRef(false)
  const creatingPagoRef = useRef(false)

  const [paso, setPaso] = useState(1)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [empleadoActualId, setEmpleadoActualId] = useState('')

  const [empleadosAsignables, setEmpleadosAsignables] = useState<EmpleadoAsignable[]>([])
  const [planes, setPlanes] = useState<Plan[]>([])
  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [entrenamientosEmpleado, setEntrenamientosEmpleado] = useState<EntrenamientoExistente[]>([])

  const [clienteId, setClienteId] = useState<string | null>(null)
  const [clientePlanId, setClientePlanId] = useState<string | null>(null)

  const [formCliente, setFormCliente] = useState({
    nombre: '',
    cedula: '',
    telefono: '',
    email: '',
    fecha_nacimiento: '',
    genero: '',
    direccion: '',
    terapeuta_id: '',
    estado: 'activo' as 'activo' | 'inactivo' | 'pausado',
    notas: '',
  })

  const [saltarPlan, setSaltarPlan] = useState(false)
  const [planId, setPlanId] = useState('')
  const [fechaInicio, setFechaInicio] = useState(getTodayLocal())
  const [empleadoId, setEmpleadoId] = useState('')
  const [recursoId, setRecursoId] = useState('')
  const [diasSemana, setDiasSemana] = useState<number[]>([])
  const [horaInicio, setHoraInicio] = useState('')
  const [duracionMin, setDuracionMin] = useState(60)
  const [fechaVistaCal, setFechaVistaCal] = useState(getTodayLocal())

  const [saltarPago, setSaltarPago] = useState(false)
  const [usarPrecioPlan, setUsarPrecioPlan] = useState(true)
  const [montoPersonalizado, setMontoPersonalizado] = useState('')
  const [notasPagoGenerales, setNotasPagoGenerales] = useState('')
  const [mostrarCrearPlan, setMostrarCrearPlan] = useState(false)
  const [nuevoPlanNombre, setNuevoPlanNombre] = useState('')
  const [nuevoPlanSesiones, setNuevoPlanSesiones] = useState(12)
  const [nuevoPlanVigencia, setNuevoPlanVigencia] = useState(30)
  const [nuevoPlanVigenciaTipo, setNuevoPlanVigenciaTipo] = useState<VigenciaTipo>('dias')
  const [nuevoPlanPrecio, setNuevoPlanPrecio] = useState('')
  const [creandoPlan, setCreandoPlan] = useState(false)
  const [pagosMixtos, setPagosMixtos] = useState<PagoMixtoItem[]>([makePagoItem('USD')])

  useEffect(() => {
    void loadData()
    void loadEmpleadoActual()
  }, [])

  async function resolveEmpleadoActualId(): Promise<string> {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) return ''

      const authUserId = authData.user?.id
      if (!authUserId) return ''

      const { data: empleadoPorAuth, error: errorPorAuth } = await supabase
        .from('empleados')
        .select('id, nombre, auth_user_id')
        .eq('auth_user_id', authUserId)
        .maybeSingle()

      if (!errorPorAuth && empleadoPorAuth?.id) {
        return String(empleadoPorAuth.id)
      }

      const { data: empleadoPorId, error: errorPorId } = await supabase
        .from('empleados')
        .select('id, nombre')
        .eq('id', authUserId)
        .maybeSingle()

      if (!errorPorId && empleadoPorId?.id) {
        return String(empleadoPorId.id)
      }

      return ''
    } catch {
      return ''
    }
  }

  async function loadEmpleadoActual() {
    const empleadoId = await resolveEmpleadoActualId()
    setEmpleadoActualId(empleadoId)
  }

  async function loadData() {
    setLoadingData(true)
    setErrorMsg('')

    try {
      const [tRes, pRes, rRes, mRes] = await Promise.all([
        supabase
          .from('empleados')
          .select('id, nombre, rol, especialidad, comision_plan_porcentaje, comision_cita_porcentaje')
          .eq('estado', 'activo')
          .neq('rol', 'admin')
          .order('nombre'),

        supabase
          .from('planes')
          .select(`
            id,
            nombre,
            sesiones_totales,
            vigencia_valor,
            vigencia_tipo,
            precio,
            descripcion,
            comision_base,
            comision_rpm,
            comision_entrenador
          `)
          .eq('estado', 'activo')
          .order('nombre'),

        supabase.from('recursos').select('id, nombre, tipo').order('nombre'),

        supabase
          .from('metodos_pago_v2')
          .select(`
            id,
            nombre,
            tipo,
            moneda,
            color,
            icono,
            cartera:carteras(nombre, codigo)
          `)
          .eq('activo', true)
          .eq('permite_recibir', true)
          .order('orden', { ascending: true })
          .order('nombre', { ascending: true }),
      ])

      if (tRes.error) throw new Error(`Empleados: ${tRes.error.message}`)
      if (pRes.error) throw new Error(`Planes: ${pRes.error.message}`)
      if (rRes.error) throw new Error(`Recursos: ${rRes.error.message}`)
      if (mRes.error) throw new Error(`Métodos de pago: ${mRes.error.message}`)

      setEmpleadosAsignables(
        ((tRes.data || []) as EmpleadoAsignable[]).filter(
          (emp) => (emp.rol || '').trim().toLowerCase() !== 'admin'
        )
      )
      setPlanes((pRes.data || []) as Plan[])
      setRecursos((rRes.data || []) as Recurso[])
      setMetodosPago(((mRes.data || []) as any[]).map(normalizeMetodoPago))
    } catch (err: any) {
      console.error('Error cargando cliente nuevo:', err)
      setErrorMsg(err?.message || 'No se pudieron cargar los datos.')
      setEmpleadosAsignables([])
      setPlanes([])
      setRecursos([])
      setMetodosPago([])
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    if (!empleadoId || !fechaVistaCal) {
      setEntrenamientosEmpleado([])
      return
    }

    void supabase
      .from('entrenamientos')
      .select('id, hora_inicio, hora_fin, fecha, clientes:cliente_id ( nombre )')
      .eq('empleado_id', empleadoId)
      .eq('fecha', fechaVistaCal)
      .neq('estado', 'cancelado')
      .order('hora_inicio')
      .then(({ data, error }) => {
        if (error) {
          console.error('Error cargando entrenamientos:', error.message)
          setEntrenamientosEmpleado([])
          return
        }

        setEntrenamientosEmpleado(((data || []) as any[]).map(normalizeEntrenamientoExistente))
      })
  }, [empleadoId, fechaVistaCal])

  const planSeleccionado = useMemo(
    () => planes.find((p) => p.id === planId) || null,
    [planes, planId]
  )

  const montoBaseComisionPlan = useMemo(() => {
    if (!planSeleccionado) return 0
    return Number(planSeleccionado.comision_base ?? planSeleccionado.precio ?? 0)
  }, [planSeleccionado])

  const montoRpmPlan = useMemo(() => {
    if (!planSeleccionado) return 0
    return Number(planSeleccionado.comision_rpm ?? 0)
  }, [planSeleccionado])

  const montoEntrenadorPlan = useMemo(() => {
    if (!planSeleccionado) return 0
    return Number(planSeleccionado.comision_entrenador ?? 0)
  }, [planSeleccionado])

  const porcentajeRpmPlan = useMemo(() => {
    if (!montoBaseComisionPlan) return 0
    return r2((montoRpmPlan / montoBaseComisionPlan) * 100)
  }, [montoBaseComisionPlan, montoRpmPlan])

  const porcentajeEntrenadorPlan = useMemo(() => {
    if (!montoBaseComisionPlan) return 0
    return r2((montoEntrenadorPlan / montoBaseComisionPlan) * 100)
  }, [montoBaseComisionPlan, montoEntrenadorPlan])

  const horaFin = useMemo(() => {
    if (!horaInicio) return ''
    return sumarMinutos(horaInicio, duracionMin)
  }, [horaInicio, duracionMin])

  const montoBase = useMemo(
    () => (usarPrecioPlan ? planSeleccionado?.precio || 0 : Number(montoPersonalizado || 0)),
    [usarPrecioPlan, planSeleccionado, montoPersonalizado]
  )

  const baseComisionAplicada = useMemo(() => {
    return usarPrecioPlan ? montoBaseComisionPlan : montoBase
  }, [usarPrecioPlan, montoBaseComisionPlan, montoBase])

  const montoRpmAplicado = useMemo(() => {
    return r2((baseComisionAplicada * porcentajeRpmPlan) / 100)
  }, [baseComisionAplicada, porcentajeRpmPlan])

  const montoEntrenadorAplicado = useMemo(() => {
    return r2((baseComisionAplicada * porcentajeEntrenadorPlan) / 100)
  }, [baseComisionAplicada, porcentajeEntrenadorPlan])

  const planificacion = useMemo(() => {
    if (!fechaInicio || !diasSemana.length || !planSeleccionado) return null
    return calcularPlanificacionSesiones(
      fechaInicio,
      diasSemana,
      planSeleccionado.sesiones_totales,
      planSeleccionado.vigencia_valor,
      planSeleccionado.vigencia_tipo
    )
  }, [fechaInicio, diasSemana, planSeleccionado])

  const fechasPreview = useMemo(() => {
    return planificacion?.fechas || []
  }, [planificacion])

  function toggleDia(dia: number) {
    setDiasSemana((prev) => (prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]))
  }

  function handleClienteChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setFormCliente((prev) => ({ ...prev, [name]: value }))
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

    if (Number(nuevoPlanSesiones) <= 0) {
      alert('Ingresa una cantidad válida de sesiones.')
      return
    }

    if (Number(nuevoPlanVigencia) <= 0) {
      alert('Ingresa una vigencia válida.')
      return
    }

    setCreandoPlan(true)

    try {
      const precio = Number(nuevoPlanPrecio)
      const comisionBase = precio
      const comisionRpm = r2(precio * 0.5)
      const comisionEntrenador = r2(precio * 0.5)

      const { data: plan, error } = await supabase
        .from('planes')
        .insert({
          nombre: nuevoPlanNombre.trim(),
          sesiones_totales: nuevoPlanSesiones,
          vigencia_valor: nuevoPlanVigencia,
          vigencia_tipo: nuevoPlanVigenciaTipo,
          precio,
          comision_base: comisionBase,
          comision_rpm: comisionRpm,
          comision_entrenador: comisionEntrenador,
          estado: 'activo',
        })
        .select(`
          id,
          nombre,
          sesiones_totales,
          vigencia_valor,
          vigencia_tipo,
          precio,
          descripcion,
          comision_base,
          comision_rpm,
          comision_entrenador
        `)
        .single()

      if (error) throw new Error(error.message)

      setPlanes((prev) => [...prev, plan as Plan].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setPlanId(plan.id)
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
    clientePlanIdValue: string,
    empId: string,
    clienteIdValue: string,
    montoBaseComision: number,
    fecha: string,
    porcRpm: number
  ) {
    try {
      const rpm = r2((montoBaseComision * porcRpm) / 100)
      const profesional = r2(montoBaseComision - rpm)

      const { data: existente } = await supabase
        .from('comisiones_detalle')
        .select('id')
        .eq('empleado_id', empId)
        .eq('cliente_id', clienteIdValue)
        .eq('cliente_plan_id', clientePlanIdValue)
        .eq('tipo', 'plan')
        .limit(1)
        .maybeSingle()

      if (existente?.id) return

      const { error } = await supabase.from('comisiones_detalle').insert({
        empleado_id: empId,
        cliente_id: clienteIdValue,
        cliente_plan_id: clientePlanIdValue,
        fecha,
        base: montoBaseComision,
        profesional,
        rpm,
        tipo: 'plan',
        estado: 'pendiente',
        porcentaje_rpm: porcRpm,
      })

      if (error) console.error('❌ Error comisión:', error.message)
    } catch (err) {
      console.error('❌ Error registrando comisión:', err)
    }
  }

  async function handleGuardarCliente(e: React.FormEvent) {
    e.preventDefault()

    if (creatingClientRef.current || saving) return

    setErrorMsg('')

    if (!formCliente.nombre.trim()) {
      setErrorMsg('El nombre es obligatorio.')
      return
    }

    if (formCliente.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formCliente.email)) {
      setErrorMsg('El correo no tiene formato válido.')
      return
    }

    creatingClientRef.current = true
    setSaving(true)

    try {
      if (clienteId) {
        setPaso(2)
        return
      }

      let auditorId = empleadoActualId || ''

      if (!auditorId) {
        auditorId = await resolveEmpleadoActualId()
        setEmpleadoActualId(auditorId)
      }

      const { data, error } = await supabase
        .from('clientes')
        .insert({
          nombre: formCliente.nombre.trim(),
          cedula: formCliente.cedula.trim() || null,
          telefono: formCliente.telefono.trim() || null,
          email: formCliente.email.trim() || null,
          fecha_nacimiento: formCliente.fecha_nacimiento || null,
          genero: formCliente.genero || null,
          direccion: formCliente.direccion.trim() || null,
          terapeuta_id: formCliente.terapeuta_id || null,
          estado: formCliente.estado,
          notas: formCliente.notas.trim() || null,
          created_by: auditorId || null,
          updated_by: auditorId || null,
        })
        .select('id')
        .single()

      if (error || !data) {
        throw new Error(error?.message || 'No se pudo guardar el cliente.')
      }

      setClienteId(data.id)

      if (formCliente.terapeuta_id) {
        setEmpleadoId(formCliente.terapeuta_id)
        setFechaVistaCal(fechaInicio)
      }

      setPaso(2)
      setErrorMsg('')
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo guardar el cliente.')
    } finally {
      setSaving(false)
      creatingClientRef.current = false
    }
  }

  async function handleGuardarPlan(e: React.FormEvent) {
    e.preventDefault()

    if (creatingPlanRef.current || saving) return

    setErrorMsg('')

    if (saltarPlan) {
      setPaso(3)
      return
    }

    if (!planId) {
      setErrorMsg('Selecciona un plan.')
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
      setErrorMsg('Selecciona la hora de entrenamiento.')
      return
    }

    if (!clienteId) {
      setErrorMsg('Error: cliente no encontrado.')
      return
    }

    if (!planSeleccionado) {
      setErrorMsg('No se encontró el plan seleccionado.')
      return
    }

    if (!planificacion) {
      setErrorMsg('No se pudo calcular la planificación del plan.')
      return
    }

    if (!planificacion.alcanzaVigencia) {
      setErrorMsg(
        `La vigencia no alcanza. Con los días seleccionados solo caben ${planificacion.sesionesPosibles} de ${planificacion.sesionesSolicitadas} sesiones antes del ${formatDate(planificacion.fechaFinPlan)}.`
      )
      return
    }

    creatingPlanRef.current = true
    setSaving(true)

    try {
      const plan = planSeleccionado
      const fechaFin = planificacion.fechaFinPlan
      const horaInicioNorm = horaInicio.length === 5 ? `${horaInicio}:00` : horaInicio
      const horaFinNorm = horaFin.length === 5 ? `${horaFin}:00` : horaFin

      let planIdActual = clientePlanId

      if (!planIdActual) {
        const { data: nuevoPlan, error: cpError } = await supabase
          .from('clientes_planes')
          .insert({
            cliente_id: clienteId,
            plan_id: plan.id,
            sesiones_totales: plan.sesiones_totales,
            sesiones_usadas: 0,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            estado: 'activo',
            porcentaje_rpm: porcentajeRpmPlan,
            monto_base_comision: montoBaseComisionPlan,
          })
          .select('id')
          .single()

        if (cpError) throw new Error(cpError.message)

        planIdActual = nuevoPlan.id
        setClientePlanId(nuevoPlan.id)
      } else {
        const { error: updatePlanError } = await supabase
          .from('clientes_planes')
          .update({
            plan_id: plan.id,
            sesiones_totales: plan.sesiones_totales,
            fecha_inicio: fechaInicio,
            fecha_fin: fechaFin,
            estado: 'activo',
            porcentaje_rpm: porcentajeRpmPlan,
            monto_base_comision: montoBaseComisionPlan,
          })
          .eq('id', planIdActual)

        if (updatePlanError) throw new Error(updatePlanError.message)
      }

      const fechas = planificacion.fechas

      if (fechas.length > 0 && planIdActual) {
        const { data: existentes, error: existentesError } = await supabase
          .from('entrenamientos')
          .select('id, fecha, hora_inicio, hora_fin, empleado_id')
          .eq('cliente_plan_id', planIdActual)

        if (existentesError) throw new Error(existentesError.message)

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

        const entrenamientosNuevos = fechas
          .map((fecha) => ({
            cliente_plan_id: planIdActual,
            cliente_id: clienteId,
            empleado_id: empleadoId,
            recurso_id: recursoId || null,
            fecha,
            hora_inicio: horaInicioNorm,
            hora_fin: horaFinNorm,
            estado: 'programado',
          }))
          .filter((item) => {
            const key = buildEntrenamientoKey(
              item.fecha,
              item.hora_inicio,
              item.hora_fin,
              item.empleado_id
            )
            return !existentesSet.has(key)
          })

        if (entrenamientosNuevos.length > 0) {
          const { error: entError } = await supabase.from('entrenamientos').insert(entrenamientosNuevos)
          if (entError) {
            throw new Error(`Plan creado pero error en entrenamientos: ${entError.message}`)
          }
        }
      }

      setPaso(3)
      setErrorMsg('')
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar el plan.')
    } finally {
      setSaving(false)
      creatingPlanRef.current = false
    }
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
          ? {
              ...item,
              tasa_bcv: tasa,
            }
          : item
      )
    )
  }, [])

  const handlePagoBsMontoChange = useCallback((idLocal: string, monto: number) => {
    setPagosMixtos((prev) =>
      prev.map((item) =>
        item.id_local === idLocal
          ? {
              ...item,
              monto_bs: monto,
            }
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

  async function handleGuardarPago(e: React.FormEvent) {
    e.preventDefault()

    if (creatingPagoRef.current || saving) return

    setErrorMsg('')

    if (!clienteId) {
      setErrorMsg('No se encontró el cliente.')
      return
    }

    if (!saltarPago) {
      if (!planSeleccionado) {
        setErrorMsg('No se encontró el plan.')
        return
      }

      if (!saltarPlan && !clientePlanId) {
        setErrorMsg('Error: No se encontró el plan del cliente para registrar el pago.')
        return
      }

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

      creatingPagoRef.current = true
      setSaving(true)

      try {
        let auditorId = empleadoActualId || ''

        if (!auditorId) {
          auditorId = await resolveEmpleadoActualId()
          setEmpleadoActualId(auditorId)
        }

        const concepto = `Plan: ${planSeleccionado.nombre} — ${formCliente.nombre}`

        const pagosRpcPayload = resumenPagos.items.map((item) => ({
          metodo_pago_v2_id: item.metodo_pago_v2_id,
          moneda_pago: item.moneda_pago,
          monto: item.monto_insertar,
          tasa_bcv: item.moneda_pago === 'BS' ? item.tasa_bcv : item.tasa_bcv || null,
          referencia: item.referencia || null,
          notas: item.notas || null,
        }))

        const { error: pagosMixtosError } = await supabase.rpc('registrar_pagos_mixtos', {
          p_fecha: fechaInicio,
          p_tipo_origen: 'plan',
          p_categoria: 'plan',
          p_concepto: concepto,
          p_cliente_id: clienteId,
          p_cita_id: null,
          p_cliente_plan_id: clientePlanId,
          p_cuenta_cobrar_id: null,
          p_inventario_id: null,
          p_registrado_por: auditorId || null,
          p_notas_generales: notasPagoGenerales || null,
          p_pagos: pagosRpcPayload,
        })

        if (pagosMixtosError) {
          throw new Error(pagosMixtosError.message)
        }

        if (empleadoId && clientePlanId) {
          await registrarComision(
            clientePlanId,
            empleadoId,
            clienteId,
            baseComisionAplicada,
            fechaInicio,
            porcentajeRpmPlan
          )

          await supabase
            .from('clientes_planes')
            .update({
              porcentaje_rpm: porcentajeRpmPlan,
              monto_base_comision: baseComisionAplicada,
            })
            .eq('id', clientePlanId)
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Error registrando el pago.')
        setSaving(false)
        creatingPagoRef.current = false
        return
      } finally {
        setSaving(false)
        creatingPagoRef.current = false
      }
    }

    router.push(`/admin/personas/clientes/${clienteId}`)
  }

  if (loadingData) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/55">Clientes</p>
        <h1 className="text-2xl font-semibold text-white">Nuevo cliente</h1>
        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando...</p>
        </Card>
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

      <Card className="p-4">
        <PasoIndicator actual={paso} />
      </Card>

      {paso === 1 && (
        <Section title="Datos del cliente" description="Completa la información básica del cliente.">
          <form onSubmit={handleGuardarCliente} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Nombre completo *">
                  <input
                    name="nombre"
                    value={formCliente.nombre}
                    onChange={handleClienteChange}
                    placeholder="Ej: Juan Pérez"
                    className={inputCls}
                    required
                  />
                </Field>
              </div>

              <Field label="Cédula">
                <input
                  name="cedula"
                  value={formCliente.cedula}
                  onChange={handleClienteChange}
                  placeholder="Ej: V-12345678"
                  className={inputCls}
                />
              </Field>

              <Field label="Teléfono">
                <input
                  name="telefono"
                  value={formCliente.telefono}
                  onChange={handleClienteChange}
                  placeholder="+58 412 000 0000"
                  className={inputCls}
                />
              </Field>

              <Field label="Correo">
                <input
                  type="email"
                  name="email"
                  value={formCliente.email}
                  onChange={handleClienteChange}
                  placeholder="ejemplo@correo.com"
                  className={inputCls}
                />
              </Field>

              <Field label="Fecha de nacimiento">
                <input
                  type="date"
                  name="fecha_nacimiento"
                  value={formCliente.fecha_nacimiento}
                  onChange={handleClienteChange}
                  className={inputCls}
                />
              </Field>

              <Field label="Género">
                <select
                  name="genero"
                  value={formCliente.genero}
                  onChange={handleClienteChange}
                  className={inputCls}
                >
                  <option value="" className="bg-[#11131a]">Seleccionar</option>
                  <option value="masculino" className="bg-[#11131a]">Masculino</option>
                  <option value="femenino" className="bg-[#11131a]">Femenino</option>
                  <option value="otro" className="bg-[#11131a]">Otro</option>
                  <option value="prefiero_no_decir" className="bg-[#11131a]">Prefiero no decir</option>
                </select>
              </Field>

              <div className="md:col-span-2">
                <Field label="Dirección">
                  <input
                    name="direccion"
                    value={formCliente.direccion}
                    onChange={handleClienteChange}
                    placeholder="Dirección del cliente"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Fisioterapeuta principal" helper="Se pre-seleccionará en el paso de entrenamientos">
                <select
                  name="terapeuta_id"
                  value={formCliente.terapeuta_id}
                  onChange={handleClienteChange}
                  className={inputCls}
                >
                  <option value="" className="bg-[#11131a]">Sin asignar</option>
                  {empleadosAsignables.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#11131a]">
                      {t.nombre}
                      {t.rol ? ` · ${getRolLabel(t.rol)}` : ''}
                      {t.especialidad ? ` · ${t.especialidad}` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Estado">
                <select
                  name="estado"
                  value={formCliente.estado}
                  onChange={handleClienteChange}
                  className={inputCls}
                >
                  <option value="activo" className="bg-[#11131a]">Activo</option>
                  <option value="pausado" className="bg-[#11131a]">Pausado</option>
                  <option value="inactivo" className="bg-[#11131a]">Inactivo</option>
                </select>
              </Field>

              <div className="md:col-span-2">
                <Field label="Notas">
                  <textarea
                    name="notas"
                    value={formCliente.notas}
                    onChange={handleClienteChange}
                    rows={3}
                    placeholder="Notas internas..."
                    className={`${inputCls} resize-none`}
                  />
                </Field>
              </div>
            </div>

            {errorMsg && (
              <Card className="p-4">
                <p className="text-sm text-rose-400">{errorMsg}</p>
              </Card>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-60"
              >
                {saving ? 'Guardando...' : 'Guardar y continuar →'}
              </button>
            </div>
          </form>
        </Section>
      )}

      {paso === 2 && (
        <Section title="Plan y entrenamientos" description="Asigna un plan y configura los días de entrenamiento.">
          <form onSubmit={handleGuardarPlan} className="space-y-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSaltarPlan((p) => !p)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  saltarPlan ? 'bg-white/20' : 'bg-violet-500'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    saltarPlan ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-sm text-white/75">
                {saltarPlan ? 'Saltar este paso (asignar plan después)' : 'Asignar plan ahora'}
              </span>
            </div>

            {!saltarPlan && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Plan">
                    <div className="flex gap-2">
                      <select
                        value={planId}
                        onChange={(e) => setPlanId(e.target.value)}
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

                          <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs text-white/55">Tipo de vigencia</label>
                            <select
                              value={nuevoPlanVigenciaTipo}
                              onChange={(e) => setNuevoPlanVigenciaTipo(e.target.value as VigenciaTipo)}
                              className={inputCls}
                            >
                              <option value="dias" className="bg-[#11131a]">Días</option>
                              <option value="semanas" className="bg-[#11131a]">Semanas</option>
                              <option value="meses" className="bg-[#11131a]">Meses</option>
                            </select>
                          </div>
                        </div>

                        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4">
                              <p className="text-sm text-white/60">Base</p>
                              <p className="mt-2 text-2xl font-bold text-white">
                                {formatMoney(Number(nuevoPlanPrecio || 0))}
                              </p>
                            </div>

                            <div className="rounded-[24px] border border-violet-400/15 bg-white/[0.05] p-4">
                              <p className="text-sm text-white/60">RPM recibe</p>
                              <p className="mt-2 text-2xl font-bold text-violet-400">
                                {formatMoney(r2(Number(nuevoPlanPrecio || 0) * 0.5))}
                              </p>
                              <p className="mt-2 text-sm text-white/50">50%</p>
                            </div>

                            <div className="rounded-[24px] border border-emerald-400/15 bg-white/[0.05] p-4">
                              <p className="text-sm text-white/60">Entrenador recibe</p>
                              <p className="mt-2 text-2xl font-bold text-emerald-400">
                                {formatMoney(r2(Number(nuevoPlanPrecio || 0) * 0.5))}
                              </p>
                              <p className="mt-2 text-sm text-white/50">50%</p>
                            </div>
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

                {planSeleccionado && (
                  <div className="space-y-4">
                    <Card className="border-white/10 bg-white/[0.02] p-4">
                      <p className="font-medium text-white">{planSeleccionado.nombre}</p>
                      {planSeleccionado.descripcion && (
                        <p className="mt-1 text-sm text-white/55">{planSeleccionado.descripcion}</p>
                      )}
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                        <div>
                          <p className="text-xs text-white/45">Sesiones</p>
                          <p className="font-medium text-white">{planSeleccionado.sesiones_totales}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/45">Vigencia</p>
                          <p className="font-medium text-white">
                            {formatVigencia(planSeleccionado.vigencia_valor, planSeleccionado.vigencia_tipo)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-white/45">Vence</p>
                          <p className="font-medium text-white">
                            {formatDate(
                              getFechaFinByVigencia(
                                fechaInicio,
                                planSeleccionado.vigencia_valor,
                                planSeleccionado.vigencia_tipo
                              )
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-white/45">Precio</p>
                          <p className="font-medium text-white">{formatMoney(planSeleccionado.precio)}</p>
                        </div>
                      </div>
                    </Card>

                    <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 md:p-6">
                      <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/40">
                        Configuración de comisión del plan
                      </p>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5">
                          <p className="text-sm text-white/60">Base</p>
                          <p className="mt-2 text-3xl font-bold text-white">
                            {formatMoney(montoBaseComisionPlan)}
                          </p>
                        </div>

                        <div className="rounded-[28px] border border-violet-400/15 bg-white/[0.05] p-5">
                          <p className="text-sm text-white/60">RPM recibe</p>
                          <p className="mt-2 text-3xl font-bold text-violet-400">
                            {formatMoney(montoRpmPlan)}
                          </p>
                          <p className="mt-2 text-sm text-white/50">{porcentajeRpmPlan}%</p>
                        </div>

                        <div className="rounded-[28px] border border-emerald-400/15 bg-white/[0.05] p-5">
                          <p className="text-sm text-white/60">Entrenador recibe</p>
                          <p className="mt-2 text-3xl font-bold text-emerald-400">
                            {formatMoney(montoEntrenadorPlan)}
                          </p>
                          <p className="mt-2 text-sm text-white/50">{porcentajeEntrenadorPlan}%</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Fisioterapeuta" helper="Pre-seleccionado del paso anterior, puedes cambiarlo">
                    <select
                      value={empleadoId}
                      onChange={(e) => {
                        setEmpleadoId(e.target.value)
                        setFechaVistaCal(fechaInicio)
                      }}
                      className={inputCls}
                    >
                      <option value="" className="bg-[#11131a]">Seleccionar fisioterapeuta</option>
                      {empleadosAsignables.map((t) => (
                        <option key={t.id} value={t.id} className="bg-[#11131a]">
                          {t.nombre}
                          {t.rol ? ` · ${getRolLabel(t.rol)}` : ''}
                          {t.especialidad ? ` · ${t.especialidad}` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Recurso / Espacio">
                    <select value={recursoId} onChange={(e) => setRecursoId(e.target.value)} className={inputCls}>
                      <option value="" className="bg-[#11131a]">Sin recurso</option>
                      {recursos.map((r) => (
                        <option key={r.id} value={r.id} className="bg-[#11131a]">
                          {r.nombre}
                          {r.tipo ? ` · ${r.tipo}` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Field label="Días de entrenamiento" helper="Selecciona los días de la semana">
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

                  <Field label="Duración">
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
                      <p className="text-sm font-medium text-white/75">Disponibilidad del fisioterapeuta</p>

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
                      fechaVista={fechaVistaCal}
                      horaInicio={horaInicio}
                      horaFin={horaFin}
                      entrenamientosExistentes={entrenamientosEmpleado}
                      onSelectHora={(hora) => setHoraInicio(hora)}
                    />
                  </div>
                )}

                {planificacion && (
                  <Card
                    className={`p-4 ${
                      planificacion.alcanzaVigencia
                        ? 'border-violet-400/20 bg-violet-400/5'
                        : 'border-rose-400/20 bg-rose-400/5'
                    }`}
                  >
                    <p
                      className={`text-sm font-medium ${
                        planificacion.alcanzaVigencia ? 'text-violet-300' : 'text-rose-300'
                      }`}
                    >
                      {planificacion.alcanzaVigencia
                        ? `Se generarán ${fechasPreview.length} entrenamientos dentro de la vigencia`
                        : `La vigencia no alcanza: solo caben ${planificacion.sesionesPosibles} de ${planificacion.sesionesSolicitadas} sesiones`}
                    </p>

                    <div className="mt-3 grid gap-3 sm:grid-cols-4 text-sm">
                      <div>
                        <p className="text-xs text-white/45">Días por semana</p>
                        <p className="font-medium text-white">{planificacion.diasSeleccionados}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/45">Semanas base aprox.</p>
                        <p className="font-medium text-white">{planificacion.semanasBase}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/45">Vence</p>
                        <p className="font-medium text-white">{formatDate(planificacion.fechaFinPlan)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/45">Sesiones posibles</p>
                        <p className="font-medium text-white">{planificacion.sesionesPosibles}</p>
                      </div>
                    </div>

                    {fechasPreview.length > 0 && (
                      <div className="mt-3 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                        {fechasPreview.slice(0, 24).map((f, i) => (
                          <span
                            key={i}
                            className={`rounded-lg px-2 py-0.5 text-xs ${
                              planificacion.alcanzaVigencia
                                ? 'bg-violet-500/10 text-violet-400'
                                : 'bg-rose-500/10 text-rose-300'
                            }`}
                          >
                            {new Date(`${f}T00:00:00`).toLocaleDateString('es', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        ))}
                        {fechasPreview.length > 24 && (
                          <span className="text-xs text-white/50">+{fechasPreview.length - 24} más</span>
                        )}
                      </div>
                    )}
                  </Card>
                )}
              </>
            )}

            {errorMsg && (
              <Card className="p-4">
                <p className="text-sm text-rose-400">{errorMsg}</p>
              </Card>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPaso(1)}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
              >
                ← Atrás
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-60"
              >
                {saving ? 'Guardando...' : saltarPlan ? 'Saltar →' : 'Guardar y continuar →'}
              </button>
            </div>
          </form>
        </Section>
      )}

      {paso === 3 && (
        <Section title="Pago" description="Registra el pago del plan en finanzas.">
          <form onSubmit={handleGuardarPago} className="space-y-5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSaltarPago((p) => !p)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  saltarPago ? 'bg-white/20' : 'bg-emerald-500'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                    saltarPago ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>

              <span className="text-sm text-white/75">
                {saltarPago ? 'Saltar pago (registrar después)' : 'Registrar pago ahora'}
              </span>
            </div>

            {!saltarPago && planSeleccionado && (
              <div className="space-y-4">
                <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 md:p-6">
                  <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/40">
                    Configuración de comisión
                  </p>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <Field
                      label="Precio (USD)"
                      helper={usarPrecioPlan ? 'Tomando el precio del plan.' : 'Precio editable solo para este cobro.'}
                    >
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={usarPrecioPlan ? String(planSeleccionado.precio ?? '') : montoPersonalizado}
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
                        value={String(baseComisionAplicada)}
                        readOnly
                        className={`${inputCls} cursor-not-allowed opacity-80`}
                      />
                    </Field>

                    <Field label="RPM recibe">
                      <input
                        type="text"
                        value={`${formatMoney(montoRpmAplicado)} · ${porcentajeRpmPlan}%`}
                        readOnly
                        className={`${inputCls} cursor-not-allowed opacity-80`}
                      />
                    </Field>

                    <Field label="Entrenador recibe">
                      <input
                        type="text"
                        value={`${formatMoney(montoEntrenadorAplicado)} · ${porcentajeEntrenadorPlan}%`}
                        readOnly
                        className={`${inputCls} cursor-not-allowed opacity-80`}
                      />
                    </Field>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5">
                      <p className="text-sm text-white/60">Base</p>
                      <p className="mt-2 text-3xl font-bold text-white">{formatMoney(baseComisionAplicada)}</p>
                      <p className="mt-2 text-xs text-white/40">
                        Precio cobrado: {formatMoney(montoBase)}
                      </p>
                    </div>

                    <div className="rounded-[28px] border border-violet-400/15 bg-white/[0.05] p-5">
                      <p className="text-sm text-white/60">RPM recibe</p>
                      <p className="mt-2 text-3xl font-bold text-violet-400">{formatMoney(montoRpmAplicado)}</p>
                      <p className="mt-2 text-sm text-white/50">{porcentajeRpmPlan}%</p>
                    </div>

                    <div className="rounded-[28px] border border-emerald-400/15 bg-white/[0.05] p-5">
                      <p className="text-sm text-white/60">Entrenador recibe</p>
                      <p className="mt-2 text-3xl font-bold text-emerald-400">{formatMoney(montoEntrenadorAplicado)}</p>
                      <p className="mt-2 text-sm text-white/50">{porcentajeEntrenadorPlan}%</p>
                    </div>
                  </div>
                </div>

                <Card className="p-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Monto objetivo USD" helper={usarPrecioPlan ? 'Precio del plan' : 'Monto personalizado'}>
                      <input
                        type="text"
                        value={formatMoney(montoBase)}
                        readOnly
                        className={`${inputCls} cursor-not-allowed opacity-70`}
                      />
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

                  <div className="mt-6 space-y-4">
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
                              <p className="text-sm font-semibold text-white">
                                Fragmento #{index + 1}
                              </p>
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
                                <option value="USD" className="bg-[#11131a]">
                                  USD
                                </option>
                                <option value="BS" className="bg-[#11131a]">
                                  Bs
                                </option>
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
                                <option value="" className="bg-[#11131a]">
                                  Seleccionar
                                </option>
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

                  <div className="mt-4 flex flex-wrap gap-3">
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

                  <Card className="mt-4 border-emerald-400/20 bg-emerald-400/5 p-4">
                    <p className="text-sm font-medium text-emerald-300">Resumen del registro</p>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-white/45">Cliente</p>
                        <p className="text-white">{formCliente.nombre}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/45">Plan</p>
                        <p className="text-white">{planSeleccionado.nombre}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/45">Sesiones</p>
                        <p className="text-white">{planSeleccionado.sesiones_totales}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/45">Objetivo</p>
                        <p className="font-semibold text-emerald-400">{formatMoney(montoBase)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/45">Base comisión</p>
                        <p className="text-white">{formatMoney(baseComisionAplicada)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/45">RPM</p>
                        <p className="text-violet-300">
                          {formatMoney(montoRpmAplicado)} · {porcentajeRpmPlan}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-white/45">Entrenador</p>
                        <p className="text-emerald-300">
                          {formatMoney(montoEntrenadorAplicado)} · {porcentajeEntrenadorPlan}%
                        </p>
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
                          <span className="font-semibold text-emerald-300">
                            Pago completo
                          </span>
                        </div>
                      )}
                    </div>
                  </Card>
                </Card>
              </div>
            )}

            {!planSeleccionado && !saltarPlan && (
              <Card className="border-white/10 p-4">
                <p className="text-sm text-white/55">No se asignó plan, no hay pago que registrar.</p>
              </Card>
            )}

            {errorMsg && (
              <Card className="p-4">
                <p className="text-sm text-rose-400">{errorMsg}</p>
              </Card>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPaso(2)}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
              >
                ← Atrás
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-60"
              >
                {saving ? 'Finalizando...' : 'Finalizar registro →'}
              </button>
            </div>
          </form>
        </Section>
      )}
    </div>
  )
}