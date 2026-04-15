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
  moneda: 'USD' | 'BS'
  metodoId: string
  monto: string
  referencia: string
  notas: string
  tasaBcv: number | null
  montoBs: number | null
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

function formatBs(v: number | null | undefined) {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    maximumFractionDigits: 2,
  }).format(Number(v || 0))
}

function getMontoDiferenciaLabel(delta: number) {
  if (delta > 0.009) return 'Debe pagar diferencia'
  if (delta < -0.009) return 'Queda saldo a favor'
  return 'Sin diferencia'
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

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
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
    moneda === 'BOLIVARES' ||
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
    (tipo.includes('transferencia') && moneda === 'VES') ||
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

function pagoToUsd(pago: PagoMixtoItem): number {
  const monto = parseFloat(pago.monto) || 0
  if (pago.moneda === 'USD') return r2(monto)
  if (!pago.tasaBcv || pago.tasaBcv <= 0) return 0
  return r2(monto / pago.tasaBcv)
}

function pagoMontoEnBs(pago: PagoMixtoItem): number {
  if (pago.moneda !== 'BS') return 0
  return parseFloat(pago.monto) || 0
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

function pagoMixtoVacio(moneda: 'USD' | 'BS' = 'USD'): PagoMixtoItem {
  return {
    moneda,
    metodoId: '',
    monto: '',
    referencia: '',
    notas: '',
    tasaBcv: null,
    montoBs: null,
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

function PagoMixtoCard({
  numero,
  pago,
  metodosPago,
  fecha,
  onChange,
}: {
  numero: 1 | 2
  pago: PagoMixtoItem
  metodosPago: MetodoPago[]
  fecha: string
  onChange: (patch: Partial<PagoMixtoItem>) => void
}) {
  const isUsd = pago.moneda === 'USD'
  const equivalenteUsd = pagoToUsd(pago)
  const montoBsDisplay = pagoMontoEnBs(pago)

  const metodosDisponibles = useMemo(
    () =>
      isUsd
        ? metodosPago.filter((m) => detectarMetodoUsd(m))
        : metodosPago.filter((m) => detectarMetodoBs(m)),
    [metodosPago, isUsd]
  )

  const colors =
    numero === 1
      ? { border: 'border-blue-400/20', badge: 'bg-blue-500/15 text-blue-300', equiv: 'text-blue-300' }
      : { border: 'border-violet-400/20', badge: 'bg-violet-500/15 text-violet-300', equiv: 'text-violet-300' }

  function handleMonedaChange(moneda: 'USD' | 'BS') {
    onChange({ moneda, metodoId: '', monto: '', tasaBcv: null, montoBs: null })
  }

  return (
    <div className={`rounded-2xl border ${colors.border} bg-white/[0.02] p-5`}>
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${colors.badge}`}>
            {numero}
          </span>
          <div>
            <p className="text-sm font-medium text-white">Pago {numero}</p>
            <p className="text-xs text-white/40">{numero === 1 ? 'Método principal' : 'Método secundario'}</p>
          </div>
        </div>

        {(parseFloat(pago.monto) || 0) > 0 && (
          <div className="text-right">
            <p className={`text-lg font-semibold ${colors.equiv}`}>
              {isUsd ? formatMoney(equivalenteUsd) : formatBs(montoBsDisplay)}
            </p>
            {!isUsd && equivalenteUsd > 0 && (
              <p className="text-xs text-white/40">≈ {formatMoney(equivalenteUsd)}</p>
            )}
          </div>
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <Field label="Moneda">
          <select
            value={pago.moneda}
            onChange={(e) => handleMonedaChange(e.target.value as 'USD' | 'BS')}
            className={inputCls}
          >
            <option value="USD" className="bg-[#11131a]">USD</option>
            <option value="BS" className="bg-[#11131a]">Bolívares</option>
          </select>
        </Field>

        <Field label={isUsd ? 'Método USD' : 'Método Bs'}>
          <select
            value={pago.metodoId}
            onChange={(e) => onChange({ metodoId: e.target.value })}
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
      </div>

      <div className="mb-3">
        <Field label={isUsd ? 'Monto USD' : 'Monto Bs'}>
          <input
            type="number"
            min={0}
            step="0.01"
            value={pago.monto}
            onChange={(e) => onChange({ monto: e.target.value })}
            className={inputCls}
            placeholder="0.00"
          />
        </Field>
      </div>

      {!isUsd && (
        <div className="mb-3">
          <PagoBsSelector
            fecha={fecha}
            montoUsd={equivalenteUsd}
            montoBs={parseFloat(pago.monto) || null}
            onChangeTasa={(tasa) => onChange({ tasaBcv: tasa })}
            onChangeMontoBs={(monto) => onChange({ monto: String(monto), montoBs: monto })}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Referencia">
          <input
            type="text"
            value={pago.referencia}
            onChange={(e) => onChange({ referencia: e.target.value })}
            className={inputCls}
            placeholder="Comprobante..."
          />
        </Field>

        <Field label="Notas">
          <input
            type="text"
            value={pago.notas}
            onChange={(e) => onChange({ notas: e.target.value })}
            className={inputCls}
            placeholder="Opcional..."
          />
        </Field>
      </div>
    </div>
  )
}

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
  const [tipoPago, setTipoPago] = useState<'unico' | 'mixto'>('unico')
  const [monedaPagoUnico, setMonedaPagoUnico] = useState<'USD' | 'BS'>('USD')
  const [metodoPagoUnicoId, setMetodoPagoUnicoId] = useState('')
  const [referenciaPagoUnico, setReferenciaPagoUnico] = useState('')
  const [notasPagoUnico, setNotasPagoUnico] = useState('')
  const [tasaPagoUnico, setTasaPagoUnico] = useState<number | null>(null)
  const [montoPagoUnicoBs, setMontoPagoUnicoBs] = useState<number | null>(null)
  const [usarPrecioPlan, setUsarPrecioPlan] = useState(true)
  const [montoPersonalizado, setMontoPersonalizado] = useState('')
  const [notasPagoGenerales, setNotasPagoGenerales] = useState('')
  const [pagoMixto1, setPagoMixto1] = useState<PagoMixtoItem>(pagoMixtoVacio('USD'))
  const [pagoMixto2, setPagoMixto2] = useState<PagoMixtoItem>(pagoMixtoVacio('BS'))

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
  const [registrarAjustePlan, setRegistrarAjustePlan] = useState(true)
  const [porcentajeRpmEditable, setPorcentajeRpmEditable] = useState(50)
  const [porcentajeEntrenadorEditable, setPorcentajeEntrenadorEditable] = useState(50)

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

  const montoBaseComisionPlan = useMemo(() => {
    return Number(selectedPlan?.comision_base ?? selectedPlan?.precio ?? 0)
  }, [selectedPlan])

  const montoRpmPlan = useMemo(() => {
    return Number(selectedPlan?.comision_rpm ?? 0)
  }, [selectedPlan])

  const montoEntrenadorPlan = useMemo(() => {
    return Number(selectedPlan?.comision_entrenador ?? 0)
  }, [selectedPlan])

  const porcentajeRpmPlan = useMemo(() => {
    if (!montoBaseComisionPlan) return 0
    return r2((montoRpmPlan / montoBaseComisionPlan) * 100)
  }, [montoBaseComisionPlan, montoRpmPlan])

  useEffect(() => {
    if (!selectedPlan) {
      setPorcentajeRpmEditable(50)
      setPorcentajeEntrenadorEditable(50)
      return
    }

    const rpmPct = clamp(
      r2(
        porcentajeRpmPlan > 0
          ? porcentajeRpmPlan
          : montoBaseComisionPlan > 0
            ? (montoRpmPlan / montoBaseComisionPlan) * 100
            : 50
      ),
      0,
      100
    )

    setPorcentajeRpmEditable(rpmPct)
    setPorcentajeEntrenadorEditable(r2(100 - rpmPct))
  }, [selectedPlan?.id, porcentajeRpmPlan, montoBaseComisionPlan, montoRpmPlan])

  const baseComisionAplicada = useMemo(() => {
    return r2(Math.max(Number(montoBase || 0), 0))
  }, [montoBase])

  const porcentajeRpmAplicado = useMemo(() => clamp(r2(porcentajeRpmEditable), 0, 100), [porcentajeRpmEditable])
  const porcentajeEntrenadorAplicado = useMemo(() => clamp(r2(100 - porcentajeRpmAplicado), 0, 100), [porcentajeRpmAplicado])

  const montoRpmAplicado = useMemo(() => {
    return r2((baseComisionAplicada * porcentajeRpmAplicado) / 100)
  }, [baseComisionAplicada, porcentajeRpmAplicado])

  const montoEntrenadorAplicado = useMemo(() => {
    return r2(baseComisionAplicada - montoRpmAplicado)
  }, [baseComisionAplicada, montoRpmAplicado])

  const comisionBalanceOk = useMemo(
    () => Math.abs(r2(montoRpmAplicado + montoEntrenadorAplicado) - baseComisionAplicada) < 0.01,
    [montoRpmAplicado, montoEntrenadorAplicado, baseComisionAplicada]
  )

  function handleChangeMontoComisionDesdeRpmMonto(value: string) {
    const rpmMonto = clamp(Number(value || 0), 0, baseComisionAplicada)
    const nuevoPct = baseComisionAplicada > 0 ? r2((rpmMonto / baseComisionAplicada) * 100) : 0
    setPorcentajeRpmEditable(nuevoPct)
    setPorcentajeEntrenadorEditable(r2(100 - nuevoPct))
  }

  function handleChangeMontoComisionDesdeEntrenadorMonto(value: string) {
    const entrenadorMonto = clamp(Number(value || 0), 0, baseComisionAplicada)
    const nuevoPct = baseComisionAplicada > 0 ? r2((entrenadorMonto / baseComisionAplicada) * 100) : 0
    const rpmPct = r2(100 - nuevoPct)
    setPorcentajeRpmEditable(rpmPct)
    setPorcentajeEntrenadorEditable(nuevoPct)
  }

  function handleChangePorcentajeRpm(value: string) {
    const nuevoPct = clamp(Number(value || 0), 0, 100)
    setPorcentajeRpmEditable(r2(nuevoPct))
    setPorcentajeEntrenadorEditable(r2(100 - nuevoPct))
  }

  function handleChangePorcentajeEntrenador(value: string) {
    const nuevoPct = clamp(Number(value || 0), 0, 100)
    const rpmPct = r2(100 - nuevoPct)
    setPorcentajeRpmEditable(rpmPct)
    setPorcentajeEntrenadorEditable(r2(nuevoPct))
  }

  function resetearComisionAlPlan() {
    const rpmPct = clamp(porcentajeRpmPlan > 0 ? porcentajeRpmPlan : 50, 0, 100)
    setPorcentajeRpmEditable(r2(rpmPct))
    setPorcentajeEntrenadorEditable(r2(100 - rpmPct))
  }

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

  const precioPlanActual = Number(planActivo?.planes?.precio || 0)
  const precioPlanNuevo = Number(selectedPlan?.precio || 0)

  const ajusteFinancieroPlan = useMemo(() => {
    if (modo !== 'asignar' || !planActivo || !selectedPlan) return 0
    return r2(precioPlanNuevo - precioPlanActual)
  }, [modo, planActivo, selectedPlan, precioPlanActual, precioPlanNuevo])

  const montoObjetivoPago = useMemo(() => {
    if (modo === 'asignar' && planActivo && selectedPlan) {
      return r2(Math.max(ajusteFinancieroPlan, 0))
    }
    return r2(montoBase)
  }, [modo, planActivo, selectedPlan, ajusteFinancieroPlan, montoBase])

  const totalPagoUnicoUsd = useMemo(() => r2(montoObjetivoPago), [montoObjetivoPago])

  const totalPagoUnicoBs = useMemo(() => {
    if (monedaPagoUnico !== 'BS' || !tasaPagoUnico || tasaPagoUnico <= 0) return 0
    return r2(montoObjetivoPago * tasaPagoUnico)
  }, [monedaPagoUnico, tasaPagoUnico, montoObjetivoPago])

  const tasaReferenciaComision = useMemo(() => {
    if (tipoPago === 'unico' && monedaPagoUnico === 'BS' && tasaPagoUnico && tasaPagoUnico > 0) {
      return tasaPagoUnico
    }

    if (tipoPago === 'mixto') {
      const t1 = pagoMixto1.moneda === 'BS' ? pagoMixto1.tasaBcv : null
      const t2 = pagoMixto2.moneda === 'BS' ? pagoMixto2.tasaBcv : null
      return t1 || t2 || null
    }

    return null
  }, [tipoPago, monedaPagoUnico, tasaPagoUnico, pagoMixto1, pagoMixto2])

  const comisionEquivalentes = useMemo(() => {
    if (!tasaReferenciaComision || tasaReferenciaComision <= 0) {
      return {
        monto_base_usd: baseComisionAplicada,
        monto_base_bs: null,
        monto_rpm_usd: montoRpmAplicado,
        monto_rpm_bs: null,
        monto_profesional_usd: montoEntrenadorAplicado,
        monto_profesional_bs: null,
      }
    }

    return {
      monto_base_usd: baseComisionAplicada,
      monto_base_bs: r2(baseComisionAplicada * tasaReferenciaComision),
      monto_rpm_usd: montoRpmAplicado,
      monto_rpm_bs: r2(montoRpmAplicado * tasaReferenciaComision),
      monto_profesional_usd: montoEntrenadorAplicado,
      monto_profesional_bs: r2(montoEntrenadorAplicado * tasaReferenciaComision),
    }
  }, [baseComisionAplicada, montoRpmAplicado, montoEntrenadorAplicado, tasaReferenciaComision])

  useEffect(() => {
    if (selectedPlan) {
      setUsarPrecioPlan(true)
      setMontoPersonalizado(String(selectedPlan.precio ?? ''))
    } else {
      setMontoPersonalizado('')
    }
  }, [selectedPlan?.id])

  useEffect(() => {
    if (modo === 'asignar' && planActivo && selectedPlan) {
      setRegistrarPago(montoObjetivoPago > 0.009)
    }
  }, [modo, planActivo, selectedPlan, montoObjetivoPago])

  useEffect(() => {
    setMetodoPagoUnicoId('')
  }, [monedaPagoUnico])

  useEffect(() => {
    setMontoPagoUnicoBs(monedaPagoUnico === 'BS' ? r2(montoObjetivoPago) : null)
  }, [monedaPagoUnico, montoObjetivoPago])

  useEffect(() => {
    if (tipoPago === 'mixto') {
      setPagoMixto1(pagoMixtoVacio('USD'))
      setPagoMixto2(pagoMixtoVacio('BS'))
    }
  }, [tipoPago])

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

  const resumenPagosMixto = useMemo(() => {
    const usd1 = pagoToUsd(pagoMixto1)
    const usd2 = pagoToUsd(pagoMixto2)
    const totalUsd = r2(usd1 + usd2)
    const totalBs = r2(pagoMontoEnBs(pagoMixto1) + pagoMontoEnBs(pagoMixto2))
    const diferenciaUsd = r2(montoObjetivoPago - totalUsd)
    const faltanteUsd = r2(Math.max(diferenciaUsd, 0))
    const excedenteUsd = r2(Math.max(-diferenciaUsd, 0))
    const cuadra = Math.abs(diferenciaUsd) < 0.01 && montoObjetivoPago >= 0

    const pct1 = montoObjetivoPago > 0 ? Math.round((usd1 / montoObjetivoPago) * 100) : 0
    const pct2 = montoObjetivoPago > 0 ? Math.round((usd2 / montoObjetivoPago) * 100) : 0

    const p1Valido =
      !!pagoMixto1.metodoId &&
      (pagoMixto1.moneda === 'USD'
        ? (parseFloat(pagoMixto1.monto) || 0) > 0
        : (parseFloat(pagoMixto1.monto) || 0) > 0 && (pagoMixto1.tasaBcv || 0) > 0)

    const p2Valido =
      !!pagoMixto2.metodoId &&
      (pagoMixto2.moneda === 'USD'
        ? (parseFloat(pagoMixto2.monto) || 0) > 0
        : (parseFloat(pagoMixto2.monto) || 0) > 0 && (pagoMixto2.tasaBcv || 0) > 0)

    return {
      usd1,
      usd2,
      totalUsd,
      totalBs,
      diferenciaUsd,
      faltanteUsd,
      excedenteUsd,
      cuadra,
      pct1,
      pct2,
      p1Valido,
      p2Valido,
      todosValidos: p1Valido && p2Valido,
    }
  }, [pagoMixto1, pagoMixto2, montoObjetivoPago])

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
    setTipoPago('unico')
    setMonedaPagoUnico('USD')
    setMetodoPagoUnicoId('')
    setReferenciaPagoUnico('')
    setNotasPagoUnico('')
    setTasaPagoUnico(null)
    setMontoPagoUnicoBs(null)
    setUsarPrecioPlan(true)
    setMontoPersonalizado('')
    setNotasPagoGenerales('')
    setPagoMixto1(pagoMixtoVacio('USD'))
    setPagoMixto2(pagoMixtoVacio('BS'))
    setMotivoCancelacion('')
    setPagoAlCancelar(null)
    setFechaVistaCal(getTodayLocal())
    setErrorMsg('')
    setSuccessMsg('')
    setRenovarConPendientes('si')
    setRegistrarAjustePlan(true)
    setPorcentajeRpmEditable(50)
    setPorcentajeEntrenadorEditable(50)
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
          comision_rpm: r2(Number(nuevoPlanPrecio) * 0.5),
          comision_entrenador: r2(Number(nuevoPlanPrecio) * 0.5),
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
        porcentaje_rpm: porcentajeRpmAplicado,
        moneda: tasaReferenciaComision ? 'BS' : 'USD',
        tasa_bcv: tasaReferenciaComision,
        monto_base_usd: comisionEquivalentes.monto_base_usd,
        monto_base_bs: comisionEquivalentes.monto_base_bs,
        monto_rpm_usd: comisionEquivalentes.monto_rpm_usd,
        monto_rpm_bs: comisionEquivalentes.monto_rpm_bs,
        monto_profesional_usd: comisionEquivalentes.monto_profesional_usd,
        monto_profesional_bs: comisionEquivalentes.monto_profesional_bs,
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

  async function registrarPagoMixtoPlan(params: {
    fecha: string
    clientePlanId: string
    concepto: string
    notasGenerales: string
  }) {
    const { fecha, clientePlanId, concepto, notasGenerales } = params

    const pagosRpcPayload =
      tipoPago === 'unico'
        ? [
            {
              metodo_pago_v2_id: metodoPagoUnicoId,
              moneda_pago: monedaPagoUnico,
              monto: monedaPagoUnico === 'BS' ? r2(Number(totalPagoUnicoBs || 0)) : r2(montoObjetivoPago),
              tasa_bcv: monedaPagoUnico === 'BS' ? tasaPagoUnico : null,
              referencia: referenciaPagoUnico || null,
              notas: notasPagoUnico || null,
            },
          ]
        : [pagoMixto1, pagoMixto2].map((p) => ({
            metodo_pago_v2_id: p.metodoId,
            moneda_pago: p.moneda,
            monto: parseFloat(p.monto) || 0,
            tasa_bcv: p.moneda === 'BS' ? p.tasaBcv : null,
            referencia: p.referencia || null,
            notas: p.notas || null,
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

  async function registrarCuentaPorCobrarAjustePlan(params: {
    montoUsd: number
    concepto: string
    fecha: string
    notas?: string | null
  }) {
    if (params.montoUsd <= 0.009) return

    const { error } = await supabase.from('cuentas_por_cobrar').insert({
      cliente_id: id,
      cliente_nombre: cliente?.nombre || 'Cliente',
      concepto: params.concepto,
      tipo_origen: 'otro',
      monto_total_usd: params.montoUsd,
      monto_pagado_usd: 0,
      saldo_usd: params.montoUsd,
      fecha_venta: params.fecha,
      estado: 'pendiente',
      notas: params.notas || null,
      registrado_por: null,
    })

    if (error) throw new Error(`Ajuste financiero: ${error.message}`)
  }

  async function registrarCreditoClienteCambioPlan(params: {
    montoUsd: number
    descripcion: string
    fecha: string
  }) {
    if (params.montoUsd <= 0.009) return

    const { error } = await supabase.from('clientes_credito').insert({
      cliente_id: id,
      origen_tipo: 'ajuste_plan',
      origen_id: planActivo?.id || null,
      moneda: 'USD',
      monto_original: params.montoUsd,
      monto_disponible: params.montoUsd,
      tasa_bcv: null,
      monto_original_bs: null,
      monto_disponible_bs: null,
      descripcion: params.descripcion,
      fecha: params.fecha,
      estado: 'activo',
      registrado_por: null,
    })

    if (error) throw new Error(`Crédito: ${error.message}`)
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

    if (registrarPago && montoObjetivoPago <= 0.009) {
      setRegistrarPago(false)
    }

    if (registrarPago) {
      if (montoObjetivoPago <= 0) {
        setErrorMsg('El monto del plan debe ser mayor a 0.')
        return
      }
      if (!comisionBalanceOk) {
        setErrorMsg('La distribución de comisión no cuadra correctamente.')
        return
      }

      if (tipoPago === 'unico') {
        if (!metodoPagoUnicoId) {
          setErrorMsg('Selecciona el método del pago único.')
          return
        }
        if (monedaPagoUnico === 'BS' && (!tasaPagoUnico || tasaPagoUnico <= 0)) {
          setErrorMsg('Selecciona una tasa válida para el pago en bolívares.')
          return
        }
      } else {
        if (!resumenPagosMixto.p1Valido) {
          setErrorMsg('Completa el Pago 1: método y monto requeridos.')
          return
        }
        if (!resumenPagosMixto.p2Valido) {
          setErrorMsg('Completa el Pago 2: método y monto requeridos.')
          return
        }
        if (!resumenPagosMixto.cuadra) {
          setErrorMsg(
            `La suma de pagos no cuadra. Objetivo: ${formatMoney(montoObjetivoPago)} | Registrado: ${formatMoney(
              resumenPagosMixto.totalUsd
            )} | Faltante: ${formatMoney(resumenPagosMixto.faltanteUsd)}`
          )
          return
        }
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

      if (registrarPago && montoObjetivoPago > 0.009) {
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

      const porcRpm = porcentajeRpmAplicado

      await supabase
        .from('clientes_planes')
        .update({
          origen: 'manual',
          porcentaje_rpm: porcRpm,
          monto_base_comision: baseC,
        })
        .eq('id', np.id)

      if (registrarAjustePlan && ajusteFinancieroPlan > 0.009 && planActivo) {
        await registrarCuentaPorCobrarAjustePlan({
          montoUsd: ajusteFinancieroPlan,
          concepto: `Ajuste por cambio de plan: ${planActivo.planes?.nombre || 'Plan actual'} → ${plan.nombre}`,
          fecha: fechaInicio,
          notas: 'Generado automáticamente por cambio de plan desde clientes/id/plan',
        })
      }

      if (ajusteFinancieroPlan < -0.009 && planActivo) {
        await registrarCreditoClienteCambioPlan({
          montoUsd: Math.abs(ajusteFinancieroPlan),
          descripcion: `Saldo a favor por cambio de plan: ${planActivo.planes?.nombre || 'Plan actual'} → ${plan.nombre}`,
          fecha: fechaInicio,
        })
      }

      const mensajeAjuste =
        ajusteFinancieroPlan > 0.009
          ? registrarAjustePlan
            ? ` Se generó una cuenta por cobrar por ${formatMoney(ajusteFinancieroPlan)}.`
            : ` Queda una diferencia por cobrar de ${formatMoney(ajusteFinancieroPlan)}.`
          : ajusteFinancieroPlan < -0.009
            ? ` Se registró un saldo a favor de ${formatMoney(Math.abs(ajusteFinancieroPlan))}.`
            : planActivo && selectedPlan
              ? ' El cambio no genera cobro adicional.'
              : ''

      setSuccessMsg(`Plan "${plan.nombre}" asignado. ${planificacion.fechas.length} entrenamientos generados.${mensajeAjuste}`)
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
      if (!comisionBalanceOk) {
        setErrorMsg('La distribución de comisión no cuadra correctamente.')
        return
      }

      if (tipoPago === 'unico') {
        if (!metodoPagoUnicoId) {
          setErrorMsg('Selecciona el método del pago único.')
          return
        }
        if (monedaPagoUnico === 'BS' && (!tasaPagoUnico || tasaPagoUnico <= 0)) {
          setErrorMsg('Selecciona una tasa válida para el pago en bolívares.')
          return
        }
      } else {
        if (!resumenPagosMixto.p1Valido) {
          setErrorMsg('Completa el Pago 1: método y monto requeridos.')
          return
        }
        if (!resumenPagosMixto.p2Valido) {
          setErrorMsg('Completa el Pago 2: método y monto requeridos.')
          return
        }
        if (!resumenPagosMixto.cuadra) {
          setErrorMsg(
            `La suma de pagos no cuadra. Objetivo: ${formatMoney(montoObjetivoPago)} | Registrado: ${formatMoney(
              resumenPagosMixto.totalUsd
            )} | Faltante: ${formatMoney(resumenPagosMixto.faltanteUsd)}`
          )
          return
        }
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

      const porcRpm = porcentajeRpmAplicado

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
            <div className="grid gap-3 md:grid-cols-2">
              <Field
                label={modo === 'asignar' && planActivo && selectedPlan ? 'Monto a cobrar por diferencia' : 'Monto objetivo USD'}
                helper={
                  modo === 'asignar' && planActivo && selectedPlan
                    ? ajusteFinancieroPlan > 0.009
                      ? 'Se cobra solo la diferencia restante del nuevo plan.'
                      : ajusteFinancieroPlan < -0.009
                        ? 'No se cobra nada. El cambio deja saldo a favor.'
                        : 'No hay diferencia por cobrar.'
                    : usarPrecioPlan
                      ? 'Precio del plan'
                      : 'Monto personalizado'
                }
              >
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={
                      usarPrecioPlan
                        ? modo === 'asignar' && planActivo && selectedPlan
                          ? String(montoObjetivoPago)
                          : String(selectedPlan?.precio ?? '')
                        : montoPersonalizado
                    }
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

              <Field label="Tipo de pago" helper="Elige si todo entra por un solo método o si el pago se divide en dos.">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipoPago('unico')}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      tipoPago === 'unico'
                        ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-300'
                        : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]'
                    }`}
                  >
                    Pago único
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoPago('mixto')}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                      tipoPago === 'mixto'
                        ? 'border-violet-400/40 bg-violet-500/20 text-violet-300'
                        : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]'
                    }`}
                  >
                    Pago mixto
                  </button>
                </div>
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

            {tipoPago === 'unico' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Moneda">
                      <select
                        value={monedaPagoUnico}
                        onChange={(e) => setMonedaPagoUnico(e.target.value as 'USD' | 'BS')}
                        className={inputCls}
                      >
                        <option value="USD" className="bg-[#11131a]">USD</option>
                        <option value="BS" className="bg-[#11131a]">Bs</option>
                      </select>
                    </Field>

                    <Field label={monedaPagoUnico === 'USD' ? 'Método USD' : 'Método Bs'}>
                      <select
                        value={metodoPagoUnicoId}
                        onChange={(e) => setMetodoPagoUnicoId(e.target.value)}
                        className={inputCls}
                      >
                        <option value="" className="bg-[#11131a]">Seleccionar</option>
                        {getMetodosForMoneda(monedaPagoUnico).map((m) => (
                          <option key={m.id} value={m.id} className="bg-[#11131a]">
                            {m.nombre}
                            {m.moneda ? ` · ${m.moneda}` : ''}
                            {m.tipo ? ` · ${m.tipo}` : ''}
                          </option>
                        ))}
                      </select>
                    </Field>

                    {monedaPagoUnico === 'USD' ? (
                      <Field label="Monto USD">
                        <input
                          type="text"
                          value={formatMoney(totalPagoUnicoUsd)}
                          readOnly
                          className={`${inputCls} cursor-not-allowed opacity-80`}
                        />
                      </Field>
                    ) : (
                      <Field label="Monto Bs">
                        <input
                          type="text"
                          value={formatBs(totalPagoUnicoBs)}
                          readOnly
                          className={`${inputCls} cursor-not-allowed opacity-80`}
                        />
                      </Field>
                    )}

                    {monedaPagoUnico === 'BS' && (
                      <div className="md:col-span-3">
                        <PagoBsSelector
                          fecha={fechaInicio}
                          montoUsd={montoObjetivoPago}
                          montoBs={montoPagoUnicoBs}
                          onChangeTasa={(tasa) => setTasaPagoUnico(tasa)}
                          onChangeMontoBs={(monto) => setMontoPagoUnicoBs(monto)}
                        />
                      </div>
                    )}

                    <Field label="Referencia del pago">
                      <input
                        value={referenciaPagoUnico}
                        onChange={(e) => setReferenciaPagoUnico(e.target.value)}
                        className={inputCls}
                        placeholder="Referencia o comprobante"
                      />
                    </Field>

                    <div className="md:col-span-2">
                      <Field label="Notas del pago">
                        <input
                          value={notasPagoUnico}
                          onChange={(e) => setNotasPagoUnico(e.target.value)}
                          className={inputCls}
                          placeholder="Notas opcionales..."
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tipoPago === 'mixto' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="mb-3 flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-semibold text-white">{formatMoney(montoObjetivoPago)}</span>
                      <span className="text-sm text-white/45">total a cobrar</span>
                    </div>

                    {resumenPagosMixto.totalUsd > 0 && (
                      <span className={`text-sm font-medium ${resumenPagosMixto.cuadra ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {resumenPagosMixto.cuadra ? '✓ Cuadra' : `Faltan ${formatMoney(resumenPagosMixto.faltanteUsd)}`}
                      </span>
                    )}
                  </div>

                  <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="bg-blue-500 transition-all duration-300"
                      style={{ width: `${Math.min(resumenPagosMixto.pct1, 100)}%` }}
                    />
                    <div
                      className="bg-violet-500 transition-all duration-300"
                      style={{ width: `${Math.min(resumenPagosMixto.pct2, 100 - resumenPagosMixto.pct1)}%` }}
                    />
                  </div>

                  {resumenPagosMixto.totalUsd > 0 && (
                    <div className="mt-2 flex gap-4">
                      <span className="text-xs text-blue-400">
                        ■ Pago 1: {formatMoney(resumenPagosMixto.usd1)} ({resumenPagosMixto.pct1}%)
                      </span>
                      <span className="text-xs text-violet-400">
                        ■ Pago 2: {formatMoney(resumenPagosMixto.usd2)} ({resumenPagosMixto.pct2}%)
                      </span>
                    </div>
                  )}
                </div>

                <PagoMixtoCard
                  numero={1}
                  pago={pagoMixto1}
                  metodosPago={metodosPago}
                  fecha={fechaInicio}
                  onChange={(patch) => setPagoMixto1((prev) => ({ ...prev, ...patch }))}
                />

                <div className="flex items-center justify-center gap-2 py-1 text-white/30">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M7 2v10M3 8l4 4 4-4" />
                  </svg>
                  <span className="text-xs">+</span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M7 2v10M3 8l4 4 4-4" />
                  </svg>
                </div>

                <PagoMixtoCard
                  numero={2}
                  pago={pagoMixto2}
                  metodosPago={metodosPago}
                  fecha={fechaInicio}
                  onChange={(patch) => setPagoMixto2((prev) => ({ ...prev, ...patch }))}
                />

                <Card className="border-emerald-400/20 bg-emerald-400/5 p-4">
                  <p className="text-sm font-medium text-emerald-300">Resumen del pago</p>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-white/45">Objetivo</p>
                      <p className="font-semibold text-emerald-400">{formatMoney(montoObjetivoPago)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/45">Total USD</p>
                      <p className="text-white">{formatMoney(resumenPagosMixto.totalUsd)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/45">Total Bs</p>
                      <p className="text-white">{formatBs(resumenPagosMixto.totalBs)}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    {!resumenPagosMixto.cuadra ? (
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-white/55">Faltante USD:</span>
                          <span className="font-semibold text-amber-300">
                            {formatMoney(resumenPagosMixto.faltanteUsd)}
                          </span>
                        </div>

                        {resumenPagosMixto.excedenteUsd > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-white/55">Excedente USD:</span>
                            <span className="font-semibold text-rose-300">
                              {formatMoney(resumenPagosMixto.excedenteUsd)}
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
              </div>
            )}
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

        {modo === 'asignar' && planActivo && selectedPlan && (
          <Card className="border-white/10 bg-white/[0.02] p-4">
            <p className="text-sm font-medium text-white/80">Impacto financiero del cambio</p>

            <div className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
              <div>
                <p className="text-xs text-white/45">Plan actual</p>
                <p className="font-medium text-white">{planActivo.planes?.nombre || 'Plan actual'}</p>
                <p className="text-white/65">{formatMoney(precioPlanActual)}</p>
              </div>

              <div>
                <p className="text-xs text-white/45">Nuevo plan</p>
                <p className="font-medium text-white">{selectedPlan.nombre}</p>
                <p className="text-white/65">{formatMoney(precioPlanNuevo)}</p>
              </div>

              <div>
                <p className="text-xs text-white/45">{getMontoDiferenciaLabel(ajusteFinancieroPlan)}</p>
                <p
                  className={`font-semibold ${
                    ajusteFinancieroPlan > 0.009
                      ? 'text-amber-300'
                      : ajusteFinancieroPlan < -0.009
                        ? 'text-emerald-300'
                        : 'text-white'
                  }`}
                >
                  {ajusteFinancieroPlan === 0
                    ? formatMoney(0)
                    : formatMoney(Math.abs(ajusteFinancieroPlan))}
                </p>
              </div>
            </div>

            {ajusteFinancieroPlan > 0.009 ? (
              <div className="mt-4 space-y-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
                <p className="text-sm text-amber-300">
                  El cliente no vuelve a pagar el plan completo. Solo debe pagar la diferencia restante: {formatMoney(ajusteFinancieroPlan)}.
                </p>
                <label className="flex items-center gap-3 text-sm text-amber-300">
                  <input
                    type="checkbox"
                    checked={registrarAjustePlan}
                    onChange={(e) => setRegistrarAjustePlan(e.target.checked)}
                    className="h-4 w-4 accent-amber-400"
                  />
                  Crear automáticamente cuenta por cobrar por la diferencia
                </label>
              </div>
            ) : null}

            {ajusteFinancieroPlan < -0.009 ? (
              <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3">
                <p className="text-sm text-emerald-300">
                  Este cambio registrará automáticamente un saldo a favor de {formatMoney(Math.abs(ajusteFinancieroPlan))} en la cuenta del cliente.
                </p>
              </div>
            ) : null}
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
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <p className="text-sm font-medium text-white/75">Configuración de comisión</p>
            <button
              type="button"
              onClick={resetearComisionAlPlan}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60 transition hover:bg-white/[0.06]"
            >
              Restaurar comisión del plan
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
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

            <Field label="Base comisión" helper="Se recalcula con el monto actual.">
              <input
                type="number"
                value={String(baseV)}
                readOnly
                className={`${inputCls} cursor-not-allowed opacity-80`}
              />
            </Field>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-xs text-white/45">Regla aplicada</p>
              <p className="mt-2 text-sm text-white/75">
                Si cambias el monto, se mantiene la proporción actual. Si cambias una comisión o porcentaje, la otra se ajusta sola.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-violet-400/15 bg-white/[0.03] p-4">
              <p className="mb-3 text-sm font-semibold text-violet-300">RPM</p>

              <Field label="RPM porcentaje">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={porcentajeRpmAplicado}
                  onChange={(e) => handleChangePorcentajeRpm(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <div className="mt-4">
                <Field label="RPM monto">
                  <input
                    type="number"
                    min={0}
                    max={baseV}
                    step="0.01"
                    value={montoRpmAplicado}
                    onChange={(e) => handleChangeMontoComisionDesdeRpmMonto(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-400/15 bg-white/[0.03] p-4">
              <p className="mb-3 text-sm font-semibold text-emerald-300">Entrenador</p>

              <Field label="Entrenador porcentaje">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={porcentajeEntrenadorAplicado}
                  onChange={(e) => handleChangePorcentajeEntrenador(e.target.value)}
                  className={inputCls}
                />
              </Field>

              <div className="mt-4">
                <Field label="Entrenador monto">
                  <input
                    type="number"
                    min={0}
                    max={baseV}
                    step="0.01"
                    value={montoEntrenadorAplicado}
                    onChange={(e) => handleChangeMontoComisionDesdeEntrenadorMonto(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-white/45">Base</p>
              <p className="mt-1 text-lg font-semibold text-white">{formatMoney(baseV)}</p>
            </Card>
            <Card className="border-violet-400/20 bg-violet-400/5 p-4">
              <p className="text-xs text-white/45">RPM recibe</p>
              <p className="mt-1 text-lg font-semibold text-violet-400">{formatMoney(rpmV)}</p>
              <p className="text-xs text-white/25">{porcentajeRpmAplicado}%</p>
            </Card>
            <Card className="border-emerald-400/20 bg-emerald-400/5 p-4">
              <p className="text-xs text-white/45">Entrenador recibe</p>
              <p className="mt-1 text-lg font-semibold text-emerald-400">{formatMoney(entV)}</p>
              <p className="text-xs text-white/25">{porcentajeEntrenadorAplicado}%</p>
            </Card>
          </div>

          {comisionEquivalentes.monto_base_bs ? (
            <div className="grid gap-2 border-t border-white/10 pt-4 text-sm md:grid-cols-3">
              <div><span className="text-white/55">Base en Bs: </span><span className="text-white/75">{formatBs(comisionEquivalentes.monto_base_bs)}</span></div>
              <div><span className="text-white/55">RPM en Bs: </span><span className="text-white/75">{formatBs(comisionEquivalentes.monto_rpm_bs || 0)}</span></div>
              <div><span className="text-white/55">Entrenador en Bs: </span><span className="text-white/75">{formatBs(comisionEquivalentes.monto_profesional_bs || 0)}</span></div>
            </div>
          ) : null}
        </div>

        {modo === 'asignar' && planActivo && selectedPlan && montoObjetivoPago <= 0.009 ? (
          <Card className="border-emerald-400/20 bg-emerald-400/5 p-4">
            <p className="text-sm text-emerald-300">
              No hace falta registrar pago para este cambio. {ajusteFinancieroPlan < -0.009
                ? `El cliente queda con un saldo a favor registrado de ${formatMoney(Math.abs(ajusteFinancieroPlan))}.`
                : 'El precio del nuevo plan queda cubierto con lo ya pagado.'}
            </p>
          </Card>
        ) : (
          renderPagoMixtoSection()
        )}

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
          <p className="mt-1 text-xs text-white/45">{cliente.nombre}</p>
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