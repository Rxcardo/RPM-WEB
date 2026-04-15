'use client'

export const dynamic = 'force-dynamic'

import {
  memo,
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
type TipoPago = 'unico' | 'mixto'

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

function formatBs(v: number | null | undefined) {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    maximumFractionDigits: 2,
  }).format(Number(v || 0))
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

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
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
  w-full rounded-xl border border-white/10 bg-white/[0.02]
  px-3 py-2 text-sm text-white outline-none transition
  placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.04]
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
  const [tipoPago, setTipoPago] = useState<TipoPago>('unico')

  const [monedaPagoUnico, setMonedaPagoUnico] = useState<'USD' | 'BS'>('USD')
  const [metodoPagoUnicoId, setMetodoPagoUnicoId] = useState('')
  const [referenciaPagoUnico, setReferenciaPagoUnico] = useState('')
  const [notasPagoUnico, setNotasPagoUnico] = useState('')
  const [tasaPagoUnico, setTasaPagoUnico] = useState<number | null>(null)
  const [montoPagoUnicoBs, setMontoPagoUnicoBs] = useState<number | null>(null)

  const pagoMixtoVacio = (): PagoMixtoItem => ({
    moneda: 'USD',
    metodoId: '',
    monto: '',
    referencia: '',
    notas: '',
    tasaBcv: null,
    montoBs: null,
  })

  const [pagoMixto1, setPagoMixto1] = useState<PagoMixtoItem>(pagoMixtoVacio())
  const [pagoMixto2, setPagoMixto2] = useState<PagoMixtoItem>({ ...pagoMixtoVacio(), moneda: 'BS' })

  const [mostrarCrearPlan, setMostrarCrearPlan] = useState(false)
  const [nuevoPlanNombre, setNuevoPlanNombre] = useState('')
  const [nuevoPlanSesiones, setNuevoPlanSesiones] = useState(12)
  const [nuevoPlanVigencia, setNuevoPlanVigencia] = useState(30)
  const [nuevoPlanVigenciaTipo, setNuevoPlanVigenciaTipo] = useState<VigenciaTipo>('dias')
  const [nuevoPlanPrecio, setNuevoPlanPrecio] = useState('')
  const [creandoPlan, setCreandoPlan] = useState(false)

  const [porcentajeRpmEditable, setPorcentajeRpmEditable] = useState(50)
  const [porcentajeEntrenadorEditable, setPorcentajeEntrenadorEditable] = useState(50)

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

  useEffect(() => {
    if (!planSeleccionado) {
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
  }, [planSeleccionado?.id, porcentajeRpmPlan, montoBaseComisionPlan, montoRpmPlan])

  const horaFin = useMemo(() => {
    if (!horaInicio) return ''
    return sumarMinutos(horaInicio, duracionMin)
  }, [horaInicio, duracionMin])

  const montoBase = useMemo(
    () => (usarPrecioPlan ? Number(planSeleccionado?.precio || 0) : Number(montoPersonalizado || 0)),
    [usarPrecioPlan, planSeleccionado, montoPersonalizado]
  )

  const baseComisionAplicada = useMemo(() => {
    return r2(Math.max(Number(montoBase || 0), 0))
  }, [montoBase])

  const porcentajeRpmAplicado = useMemo(() => clamp(r2(porcentajeRpmEditable), 0, 100), [porcentajeRpmEditable])
  const porcentajeEntrenadorAplicado = useMemo(
    () => clamp(r2(100 - porcentajeRpmAplicado), 0, 100),
    [porcentajeRpmAplicado]
  )

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

  const totalPagoUnicoUsd = useMemo(() => r2(montoBase), [montoBase])

  const totalPagoUnicoBs = useMemo(() => {
    if (monedaPagoUnico !== 'BS' || !tasaPagoUnico || tasaPagoUnico <= 0) return 0
    return r2(montoBase * tasaPagoUnico)
  }, [monedaPagoUnico, tasaPagoUnico, montoBase])

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

  const resumenPagosMixto = useMemo(() => {
    const usd1 = pagoToUsd(pagoMixto1)
    const usd2 = pagoToUsd(pagoMixto2)
    const totalUsd = r2(usd1 + usd2)
    const totalBs = r2(pagoMontoEnBs(pagoMixto1) + pagoMontoEnBs(pagoMixto2))
    const diferenciaUsd = r2(montoBase - totalUsd)
    const faltanteUsd = r2(Math.max(diferenciaUsd, 0))
    const excedenteUsd = r2(Math.max(-diferenciaUsd, 0))
    const cuadra = Math.abs(diferenciaUsd) < 0.01 && montoBase > 0

    const pct1 = montoBase > 0 ? Math.round((usd1 / montoBase) * 100) : 0
    const pct2 = montoBase > 0 ? Math.round((usd2 / montoBase) * 100) : 0

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
  }, [pagoMixto1, pagoMixto2, montoBase])

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

  useEffect(() => {
    setMetodoPagoUnicoId('')
  }, [monedaPagoUnico])

  useEffect(() => {
    setMontoPagoUnicoBs(monedaPagoUnico === 'BS' ? r2(montoBase) : null)
  }, [monedaPagoUnico, montoBase])

  useEffect(() => {
    if (tipoPago === 'mixto') {
      setPagoMixto1(pagoMixtoVacio())
      setPagoMixto2({ ...pagoMixtoVacio(), moneda: 'BS' })
    }
  }, [tipoPago])

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

      if (baseComisionAplicada <= 0) {
        setErrorMsg('La base de comisión debe ser mayor a 0.')
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
          setErrorMsg('Selecciona una tasa válida para el pago único en bolívares.')
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
            `La suma de pagos no cuadra. Objetivo: ${formatMoney(montoBase)} | Registrado: ${formatMoney(
              resumenPagosMixto.totalUsd
            )} | Faltante: ${formatMoney(resumenPagosMixto.faltanteUsd)}`
          )
          return
        }
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

        const pagosRpcPayload =
          tipoPago === 'unico'
            ? [
                {
                  metodo_pago_v2_id: metodoPagoUnicoId,
                  moneda_pago: monedaPagoUnico,
                  monto: monedaPagoUnico === 'BS' ? r2(Number(totalPagoUnicoBs || 0)) : r2(montoBase),
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
            porcentajeRpmAplicado
          )

          await supabase
            .from('clientes_planes')
            .update({
              porcentaje_rpm: porcentajeRpmAplicado,
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
                              <p className="mt-1 text-lg font-semibold text-white">
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

                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
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
                          <p className="mt-2 text-sm text-white/50">{r2(100 - porcentajeRpmPlan)}%</p>
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
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <p className="text-sm font-semibold uppercase tracking-wider text-white/40">
                      Configuración de comisión
                    </p>

                    <button
                      type="button"
                      onClick={resetearComisionAlPlan}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60 transition hover:bg-white/[0.06]"
                    >
                      Restaurar comisión del plan
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

                    <Field label="Base comisión" helper="Se recalcula con el monto actual.">
                      <input
                        type="number"
                        value={String(baseComisionAplicada)}
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

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
                            max={baseComisionAplicada}
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
                            max={baseComisionAplicada}
                            step="0.01"
                            value={montoEntrenadorAplicado}
                            onChange={(e) => handleChangeMontoComisionDesdeEntrenadorMonto(e.target.value)}
                            className={inputCls}
                          />
                        </Field>
                      </div>
                    </div>
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
                      <p className="mt-2 text-sm text-white/50">{porcentajeRpmAplicado}%</p>
                    </div>

                    <div className="rounded-[28px] border border-emerald-400/15 bg-white/[0.05] p-5">
                      <p className="text-sm text-white/60">Entrenador recibe</p>
                      <p className="mt-2 text-3xl font-bold text-emerald-400">{formatMoney(montoEntrenadorAplicado)}</p>
                      <p className="mt-2 text-sm text-white/50">{porcentajeEntrenadorAplicado}%</p>
                    </div>
                  </div>

                  {comisionEquivalentes.monto_base_bs ? (
                    <div className="mt-4 grid gap-2 border-t border-white/10 pt-4 text-sm md:grid-cols-3">
                      <div><span className="text-white/55">Base en Bs: </span><span className="text-white/75">{formatBs(comisionEquivalentes.monto_base_bs)}</span></div>
                      <div><span className="text-white/55">RPM en Bs: </span><span className="text-white/75">{formatBs(comisionEquivalentes.monto_rpm_bs || 0)}</span></div>
                      <div><span className="text-white/55">Entrenador en Bs: </span><span className="text-white/75">{formatBs(comisionEquivalentes.monto_profesional_bs || 0)}</span></div>
                    </div>
                  ) : null}
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

                    <Field label="Tipo de pago" helper="Elige si todo entra por un solo método o si el pago se divide en dos.">
                      <div className="grid grid-cols-2 gap-3">
                        {(['unico', 'mixto'] as TipoPago[]).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTipoPago(t)}
                            className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                              tipoPago === t
                                ? 'border-violet-400/40 bg-violet-500/20 text-violet-300'
                                : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]'
                            }`}
                          >
                            {t === 'unico' ? 'Pago único' : 'Pago mixto'}
                          </button>
                        ))}
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
                    <div className="mt-6">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <div className="grid gap-4 md:grid-cols-3">
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
                              {(monedaPagoUnico === 'USD'
                                ? metodosPago.filter((m) => detectarMetodoUsd(m))
                                : metodosPago.filter((m) => detectarMetodoBs(m))
                              ).map((m) => (
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
                                montoUsd={montoBase}
                                montoBs={montoPagoUnicoBs}
                                onChangeTasa={(tasa) => setTasaPagoUnico(tasa)}
                                onChangeMontoBs={(monto) => setMontoPagoUnicoBs(monto)}
                              />
                            </div>
                          )}

                          <Field label="Referencia">
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
                    <div className="mt-6 space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <div className="mb-3 flex items-baseline justify-between">
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-semibold text-white">{formatMoney(montoBase)}</span>
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
                          <path d="M7 2v10M3 8l4 4 4-4"/>
                        </svg>
                        <span className="text-xs">+</span>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M7 2v10M3 8l4 4 4-4"/>
                        </svg>
                      </div>

                      <PagoMixtoCard
                        numero={2}
                        pago={pagoMixto2}
                        metodosPago={metodosPago}
                        fecha={fechaInicio}
                        onChange={(patch) => setPagoMixto2((prev) => ({ ...prev, ...patch }))}
                      />

                      <div className={`rounded-2xl border p-4 ${resumenPagosMixto.cuadra ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-amber-400/20 bg-amber-400/5'}`}>
                        <p className={`text-sm font-medium ${resumenPagosMixto.cuadra ? 'text-emerald-300' : 'text-amber-300'}`}>
                          {resumenPagosMixto.cuadra
                            ? '✓ La suma de pagos cuadra correctamente.'
                            : resumenPagosMixto.faltanteUsd > 0
                              ? `Faltan ${formatMoney(resumenPagosMixto.faltanteUsd)} para completar el total.`
                              : `Excedente de ${formatMoney(resumenPagosMixto.excedenteUsd)} sobre el total.`}
                        </p>

                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-white/50">
                          <div>Objetivo: <span className="text-white/80">{formatMoney(montoBase)}</span></div>
                          <div>Registrado: <span className="text-white/80">{formatMoney(resumenPagosMixto.totalUsd)}</span></div>
                          {resumenPagosMixto.totalBs > 0 && (
                            <div>Bs total: <span className="text-white/80">{formatBs(resumenPagosMixto.totalBs)}</span></div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

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
                          {formatMoney(montoRpmAplicado)} · {porcentajeRpmAplicado}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-white/45">Entrenador</p>
                        <p className="text-emerald-300">
                          {formatMoney(montoEntrenadorAplicado)} · {porcentajeEntrenadorAplicado}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-white/45">Total USD</p>
                        <p className="text-white">
                          {tipoPago === 'unico' ? formatMoney(totalPagoUnicoUsd) : formatMoney(resumenPagosMixto.totalUsd)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-white/45">Total Bs</p>
                        <p className="text-white">
                          {tipoPago === 'unico' ? formatBs(totalPagoUnicoBs) : formatBs(resumenPagosMixto.totalBs)}
                        </p>
                      </div>
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