'use client'

export const dynamic = 'force-dynamic'

import {
  Suspense,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'
import SelectorTasaBCV from '@/components/finanzas/SelectorTasaBCV'
import DisponibilidadTerapeuta from '@/components/agenda/DisponibilidadTerapeuta'

// ─── Types ────────────────────────────────────────────────────────────────────

type TipoPago = 'unico' | 'mixto'

type Cliente = { id: string; nombre: string }

type Terapeuta = {
  id: string
  nombre: string
  comision_cita_porcentaje: number
}

type ServicioRaw = {
  id: string
  nombre: string
  estado?: string | null
  precio?: number | null
  duracion_minutos?: number | null
  categoria?: string | null
  descripcion?: string | null
  color?: string | null
  comision_base?: number | null
  comision_rpm?: number | null
  comision_entrenador?: number | null
  [key: string]: any
}

type Servicio = {
  id: string
  nombre: string
  precio: number | null
  duracion_min: number | null
  estado?: string | null
  color?: string | null
  comision_base: number | null
  comision_rpm: number | null
  comision_entrenador: number | null
}

type Recurso = {
  id: string
  nombre: string
  estado: string | null
  capacidad: number | null
  hora_inicio: string | null
  hora_fin: string | null
}

type MetodoPago = {
  id: string
  nombre: string
  tipo?: string | null
  moneda?: string | null
  color?: string | null
  icono?: string | null
  cartera?: { nombre: string; codigo: string } | null
}

type ClientePlan = {
  id: string
  cliente_id: string
  plan_id: string
  sesiones_totales: number
  sesiones_usadas: number
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
  planes?: { nombre: string } | null
}

type ValidacionCita = {
  disponible: boolean
  motivo: string
  conflicto_terapeuta?: boolean
  conflicto_cliente?: boolean
  conflictos_recurso?: number
  capacidad_recurso?: number
  recurso_estado?: string | null
  recurso_hora_inicio?: string | null
  recurso_hora_fin?: string | null
  detalle?: {
    tipo?: string
    motivo?: string
    detalle?: string
    hora_inicio?: string | null
    hora_fin?: string | null
  } | null
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function normalizeClientePlan(row: any): ClientePlan {
  const plan = firstOrNull(row?.planes)
  return {
    id: String(row?.id ?? ''),
    cliente_id: String(row?.cliente_id ?? ''),
    plan_id: String(row?.plan_id ?? ''),
    sesiones_totales: Number(row?.sesiones_totales || 0),
    sesiones_usadas: Number(row?.sesiones_usadas || 0),
    estado: String(row?.estado ?? ''),
    fecha_inicio: row?.fecha_inicio ?? null,
    fecha_fin: row?.fecha_fin ?? null,
    planes: plan ? { nombre: String(plan?.nombre ?? '') } : null,
  }
}

function sumarMinutos(hora: string, minutos: number) {
  if (!hora) return ''
  const limpia = hora.slice(0, 5)
  const [h, m] = limpia.split(':').map(Number)
  const total = h * 60 + m + minutos
  const hh = Math.floor(total / 60).toString().padStart(2, '0')
  const mm = (total % 60).toString().padStart(2, '0')
  return `${hh}:${mm}:00`
}

function getServicioDuracion(servicio: ServicioRaw) {
  const n = Number(servicio.duracion_minutos)
  if (!Number.isNaN(n) && n > 0) return n
  return null
}

function toMinutes(hora: string | null | undefined) {
  if (!hora) return null
  const limpia = hora.slice(0, 5)
  const [h, m] = limpia.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

function formatHoraCorta(hora: string | null | undefined) {
  if (!hora) return '—'
  return hora.slice(0, 5)
}

function buildErrorFromValidacion(validacion: ValidacionCita | null | undefined) {
  if (!validacion) return 'No se pudo validar la disponibilidad.'
  switch (validacion.motivo) {
    case 'ok': return ''
    case 'empleado_bloqueado':
      return validacion.detalle?.detalle || validacion.detalle?.motivo || 'El fisioterapeuta no está disponible en ese horario.'
    case 'conflicto_terapeuta': return 'Ese fisioterapeuta ya tiene una cita en ese horario.'
    case 'conflicto_cliente': return 'Ese cliente ya tiene una cita en ese horario.'
    case 'conflicto_recurso':
      return validacion.capacidad_recurso && validacion.capacidad_recurso > 1
        ? `Ese recurso ya alcanzó su capacidad máxima (${validacion.capacidad_recurso}) en ese horario.`
        : 'Ese recurso ya está ocupado en ese horario.'
    case 'recurso_inactivo': return 'Ese recurso está inactivo.'
    case 'recurso_mantenimiento': return 'Ese recurso está en mantenimiento.'
    case 'fuera_horario_recurso_inicio':
      return `Ese recurso solo está disponible desde las ${formatHoraCorta(validacion.recurso_hora_inicio)}.`
    case 'fuera_horario_recurso_fin':
      return `Ese recurso solo está disponible hasta las ${formatHoraCorta(validacion.recurso_hora_fin)}.`
    case 'recurso_no_existe': return 'El recurso seleccionado no existe.'
    case 'hora_fin_invalida': return 'La hora final debe ser mayor que la hora inicial.'
    default: return `No se puede guardar la cita (${validacion.motivo}).`
  }
}

const r2 = (v: number | null | undefined) => Math.round(Number(v || 0) * 100) / 100

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max)
}

function formatMoney(v: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v || 0))
}

function formatBs(v: number | null | undefined) {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES', maximumFractionDigits: 2 }).format(Number(v || 0))
}

function detectarMetodoBs(metodo: MetodoPago | null) {
  if (!metodo) return false
  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const tipo = (metodo.tipo || '').toLowerCase()
  const carteraCodigo = (metodo.cartera?.codigo || '').toLowerCase()
  return (
    moneda === 'BS' || moneda === 'VES' || moneda === 'BOLIVARES' ||
    nombre.includes('bs') || nombre.includes('bolívar') || nombre.includes('bolivar') ||
    nombre.includes('pago movil') || nombre.includes('pago móvil') ||
    nombre.includes('movil') || nombre.includes('móvil') ||
    tipo.includes('pago_movil') ||
    (tipo.includes('transferencia') && moneda === 'VES') ||
    carteraCodigo.includes('bs') || carteraCodigo.includes('ves')
  )
}

function detectarMetodoUsd(metodo: MetodoPago | null) {
  if (!metodo) return false
  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const carteraCodigo = (metodo.cartera?.codigo || '').toLowerCase()
  return (
    moneda === 'USD' ||
    nombre.includes('usd') || nombre.includes('zelle') ||
    nombre.includes('efectivo $') || nombre.includes('efectivo usd') ||
    carteraCodigo.includes('usd')
  )
}

function getPlanDisponible(plan: ClientePlan) {
  return Math.max(Number(plan.sesiones_totales || 0) - Number(plan.sesiones_usadas || 0), 0)
}

function getPlanLabel(plan: ClientePlan) {
  const nombre = plan.planes?.nombre || 'Plan'
  const disponibles = getPlanDisponible(plan)
  return `${nombre} · ${disponibles}/${plan.sesiones_totales} disponibles`
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

// ─── UI Primitives ────────────────────────────────────────────────────────────

function Field({ label, children, helper }: { label: string; children: ReactNode; helper?: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/75">{label}</label>
      {children}
      {helper ? <p className="mt-2 text-xs text-white/45">{helper}</p> : null}
    </div>
  )
}

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

// ─── ClienteSearch ────────────────────────────────────────────────────────────

function ClienteSearch({
  clientes,
  value,
  onChange,
}: {
  clientes: Cliente[]
  value: string
  onChange: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const clienteSeleccionado = useMemo(
    () => clientes.find((c) => c.id === value) || null,
    [clientes, value]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clientes.slice(0, 50)
    return clientes.filter((c) => c.nombre.toLowerCase().includes(q)).slice(0, 50)
  }, [clientes, query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => { setHighlighted(0) }, [filtered])

  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[highlighted] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  function handleSelect(id: string) {
    onChange(id)
    setQuery('')
    setOpen(false)
  }

  function handleClear() {
    onChange('')
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) { if (e.key !== 'Tab') setOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlighted]) handleSelect(filtered[highlighted].id) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {clienteSeleccionado && !open ? (
        <div className="flex w-full items-center gap-2 rounded-2xl border border-violet-400/30 bg-violet-500/10 px-4 py-3">
          <span className="flex-1 truncate text-sm font-medium text-white">{clienteSeleccionado.nombre}</span>
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 rounded-full p-0.5 text-white/40 transition hover:text-white/80"
            aria-label="Quitar cliente"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar paciente por nombre..."
            className={inputClassName}
            autoComplete="off"
          />
          <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/30" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      )}
      {open && (
        <ul ref={listRef} className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#16181f] py-1 shadow-xl">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-white/40">Sin resultados para "{query}"</li>
          ) : (
            filtered.map((c, i) => (
              <li
                key={c.id}
                onMouseDown={() => handleSelect(c.id)}
                onMouseEnter={() => setHighlighted(i)}
                className={`cursor-pointer px-4 py-2.5 text-sm transition ${
                  i === highlighted ? 'bg-violet-500/20 text-violet-200' : 'text-white/80 hover:bg-white/[0.05]'
                }`}
              >
                {c.nombre}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

// ─── PagoBsSelector ───────────────────────────────────────────────────────────

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

// ─── PagoMixtoCard ────────────────────────────────────────────────────────────

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
    () => isUsd
      ? metodosPago.filter((m) => detectarMetodoUsd(m))
      : metodosPago.filter((m) => detectarMetodoBs(m)),
    [metodosPago, isUsd]
  )

  const colors = numero === 1
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
            className={inputClassName}
          >
            <option value="USD" className="bg-[#11131a]">USD</option>
            <option value="BS" className="bg-[#11131a]">Bolívares</option>
          </select>
        </Field>

        <Field label={isUsd ? 'Método USD' : 'Método Bs'}>
          <select
            value={pago.metodoId}
            onChange={(e) => onChange({ metodoId: e.target.value })}
            className={inputClassName}
          >
            <option value="" className="bg-[#11131a]">Seleccionar</option>
            {metodosDisponibles.map((m) => (
              <option key={m.id} value={m.id} className="bg-[#11131a]">
                {m.nombre}{m.moneda ? ` · ${m.moneda}` : ''}{m.tipo ? ` · ${m.tipo}` : ''}
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
            className={inputClassName}
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
            className={inputClassName}
            placeholder="Comprobante..."
          />
        </Field>
        <Field label="Notas">
          <input
            type="text"
            value={pago.notas}
            onChange={(e) => onChange({ notas: e.target.value })}
            className={inputClassName}
            placeholder="Opcional..."
          />
        </Field>
      </div>
    </div>
  )
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

function NuevaCitaPageFallback() {
  return (
    <div className="space-y-6">
      <Section title="Formulario de cita" description="Cargando vista...">
        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando formulario...</p>
        </Card>
      </Section>
    </div>
  )
}

// ─── Main Content ─────────────────────────────────────────────────────────────

function NuevaCitaPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clienteInicial = searchParams.get('cliente') || ''

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [loadingPlanes, setLoadingPlanes] = useState(false)
  const [error, setError] = useState('')
  const [empleadoActualId, setEmpleadoActualId] = useState<string>('')

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])
  const [planesCliente, setPlanesCliente] = useState<ClientePlan[]>([])

  const [form, setForm] = useState({
    cliente_id: clienteInicial,
    terapeuta_id: '',
    servicio_id: '',
    recurso_id: '',
    fecha: new Date().toISOString().slice(0, 10),
    hora_inicio: '',
    hora_fin: '',
    estado: 'programada',
    notas: '',
    tipo_cita: 'recovery',
    cliente_plan_id: '',
  })

  const [saltarPago, setSaltarPago] = useState(false)
  const [usarPrecioServicio, setUsarPrecioServicio] = useState(true)
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

  const [porcentajeRpmEditable, setPorcentajeRpmEditable] = useState(50)
  const [porcentajeEntrenadorEditable, setPorcentajeEntrenadorEditable] = useState(50)

  useEffect(() => { void loadData(); void loadEmpleadoActual() }, [])

  useEffect(() => {
    setForm((prev) => {
      if (prev.cliente_id || !clienteInicial) return prev
      return { ...prev, cliente_id: clienteInicial }
    })
  }, [clienteInicial])

  useEffect(() => {
    if (form.cliente_id) {
      void loadPlanesCliente(form.cliente_id)
    } else {
      setPlanesCliente([])
      setForm((prev) => ({
        ...prev,
        cliente_plan_id: '',
        tipo_cita: prev.tipo_cita === 'plan' ? 'independiente' : prev.tipo_cita,
      }))
    }
  }, [form.cliente_id])

  useEffect(() => {
    if (!form.hora_inicio || !servicioSeleccionado?.duracion_min) return
    setForm((prev) => ({
      ...prev,
      hora_fin: sumarMinutos(prev.hora_inicio, servicioSeleccionado.duracion_min || 0),
    }))
  }, [form.hora_inicio, form.servicio_id])

  useEffect(() => {
    if (form.tipo_cita !== 'plan' && form.cliente_plan_id) {
      setForm((prev) => ({ ...prev, cliente_plan_id: '' }))
    }
  }, [form.tipo_cita])

  useEffect(() => { setMetodoPagoUnicoId('') }, [monedaPagoUnico])

  useEffect(() => {
    setMontoPagoUnicoBs(monedaPagoUnico === 'BS' ? r2(montoBase) : null)
  }, [monedaPagoUnico])

  useEffect(() => {
    if (tipoPago === 'mixto') {
      setPagoMixto1(pagoMixtoVacio())
      setPagoMixto2({ ...pagoMixtoVacio(), moneda: 'BS' })
    }
  }, [tipoPago])

  useEffect(() => {
    if (!servicioSeleccionado) {
      setPorcentajeRpmEditable(50)
      setPorcentajeEntrenadorEditable(50)
      return
    }
    const base = Number(servicioSeleccionado.comision_base ?? servicioSeleccionado.precio ?? 0)
    const rpm = Number(servicioSeleccionado.comision_rpm ?? 0)
    const rpmPct = base > 0 ? clamp(r2((rpm / base) * 100), 0, 100) : 50
    setPorcentajeRpmEditable(rpmPct)
    setPorcentajeEntrenadorEditable(r2(100 - rpmPct))
  }, [form.servicio_id])

  const servicioSeleccionado = useMemo(
    () => servicios.find((s) => s.id === form.servicio_id) || null,
    [servicios, form.servicio_id]
  )

  const planSeleccionado = useMemo(
    () => planesCliente.find((p) => p.id === form.cliente_plan_id) || null,
    [planesCliente, form.cliente_plan_id]
  )

  const recursoSeleccionado = useMemo(
    () => recursos.find((r) => r.id === form.recurso_id) || null,
    [recursos, form.recurso_id]
  )

  const montoBase = useMemo(() => {
    return usarPrecioServicio
      ? r2(servicioSeleccionado?.precio || 0)
      : r2(Number(montoPersonalizado || 0))
  }, [usarPrecioServicio, servicioSeleccionado, montoPersonalizado])

  const baseComisionOriginal = useMemo(
    () => r2(servicioSeleccionado?.comision_base ?? servicioSeleccionado?.precio ?? 0),
    [servicioSeleccionado]
  )

  const baseComisionAplicada = useMemo(
    () => usarPrecioServicio ? baseComisionOriginal : montoBase,
    [usarPrecioServicio, baseComisionOriginal, montoBase]
  )

  const porcentajeRpmOriginal = useMemo(() => {
    const base = Number(servicioSeleccionado?.comision_base ?? servicioSeleccionado?.precio ?? 0)
    const rpm = Number(servicioSeleccionado?.comision_rpm ?? 0)
    if (!base) return 50
    return clamp(r2((rpm / base) * 100), 0, 100)
  }, [servicioSeleccionado])

  const porcentajeRpmAplicado = useMemo(() => clamp(r2(porcentajeRpmEditable), 0, 100), [porcentajeRpmEditable])
  const porcentajeEntrenadorAplicado = useMemo(() => clamp(r2(100 - porcentajeRpmAplicado), 0, 100), [porcentajeRpmAplicado])

  const rpmMonto = useMemo(() => r2((baseComisionAplicada * porcentajeRpmAplicado) / 100), [baseComisionAplicada, porcentajeRpmAplicado])
  const terapeutaMonto = useMemo(() => r2(baseComisionAplicada - rpmMonto), [baseComisionAplicada, rpmMonto])

  const comisionBalanceOk = useMemo(
    () => Math.abs(r2(rpmMonto + terapeutaMonto) - baseComisionAplicada) < 0.01,
    [rpmMonto, terapeutaMonto, baseComisionAplicada]
  )

  const tasaReferenciaComision = useMemo(() => {
    if (tipoPago === 'unico' && monedaPagoUnico === 'BS' && tasaPagoUnico && tasaPagoUnico > 0) return tasaPagoUnico
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
        monto_base_usd: baseComisionAplicada, monto_base_bs: null,
        monto_rpm_usd: rpmMonto, monto_rpm_bs: null,
        monto_profesional_usd: terapeutaMonto, monto_profesional_bs: null,
      }
    }
    return {
      monto_base_usd: baseComisionAplicada,
      monto_base_bs: r2(baseComisionAplicada * tasaReferenciaComision),
      monto_rpm_usd: rpmMonto,
      monto_rpm_bs: r2(rpmMonto * tasaReferenciaComision),
      monto_profesional_usd: terapeutaMonto,
      monto_profesional_bs: r2(terapeutaMonto * tasaReferenciaComision),
    }
  }, [baseComisionAplicada, rpmMonto, terapeutaMonto, tasaReferenciaComision])

  const totalPagoUnicoUsd = useMemo(() => r2(montoBase), [montoBase])

  const totalPagoUnicoBs = useMemo(() => {
    if (monedaPagoUnico !== 'BS' || !tasaPagoUnico || tasaPagoUnico <= 0) return 0
    return r2(montoBase * tasaPagoUnico)
  }, [monedaPagoUnico, tasaPagoUnico, montoBase])

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
      usd1, usd2, totalUsd, totalBs,
      diferenciaUsd, faltanteUsd, excedenteUsd,
      cuadra, pct1, pct2,
      p1Valido, p2Valido,
      todosValidos: p1Valido && p2Valido,
    }
  }, [pagoMixto1, pagoMixto2, montoBase])

  const buildPagosPayload = useCallback(() => {
    if (tipoPago === 'unico') {
      return [{
        metodo_pago_v2_id: metodoPagoUnicoId,
        moneda_pago: monedaPagoUnico,
        monto: monedaPagoUnico === 'BS' ? r2(totalPagoUnicoBs) : r2(montoBase),
        tasa_bcv: monedaPagoUnico === 'BS' ? tasaPagoUnico : null,
        referencia: referenciaPagoUnico || null,
        notas: notasPagoUnico || null,
      }]
    }
    return [pagoMixto1, pagoMixto2].map((p) => {
      const montoNum = parseFloat(p.monto) || 0
      return {
        metodo_pago_v2_id: p.metodoId,
        moneda_pago: p.moneda,
        monto: montoNum,
        tasa_bcv: p.moneda === 'BS' ? p.tasaBcv : null,
        referencia: p.referencia || null,
        notas: p.notas || null,
      }
    })
  }, [
    tipoPago, metodoPagoUnicoId, monedaPagoUnico, montoBase,
    totalPagoUnicoBs, tasaPagoUnico, referenciaPagoUnico, notasPagoUnico,
    pagoMixto1, pagoMixto2,
  ])

  function handleChangePorcentajeRpm(value: string) {
    const pct = clamp(Number(value || 0), 0, 100)
    setPorcentajeRpmEditable(r2(pct))
    setPorcentajeEntrenadorEditable(r2(100 - pct))
  }

  function handleChangePorcentajeEntrenador(value: string) {
    const pct = clamp(Number(value || 0), 0, 100)
    setPorcentajeEntrenadorEditable(r2(pct))
    setPorcentajeRpmEditable(r2(100 - pct))
  }

  function handleChangeMontoRpm(value: string) {
    const monto = clamp(Number(value || 0), 0, baseComisionAplicada)
    const pct = baseComisionAplicada > 0 ? r2((monto / baseComisionAplicada) * 100) : 0
    setPorcentajeRpmEditable(pct)
    setPorcentajeEntrenadorEditable(r2(100 - pct))
  }

  function handleChangeMontoEntrenador(value: string) {
    const monto = clamp(Number(value || 0), 0, baseComisionAplicada)
    const pct = baseComisionAplicada > 0 ? r2((monto / baseComisionAplicada) * 100) : 0
    setPorcentajeEntrenadorEditable(pct)
    setPorcentajeRpmEditable(r2(100 - pct))
  }

  function resetearComisionAlServicio() {
    const rpmPct = clamp(porcentajeRpmOriginal, 0, 100)
    setPorcentajeRpmEditable(r2(rpmPct))
    setPorcentajeEntrenadorEditable(r2(100 - rpmPct))
  }

  async function resolveEmpleadoActualId(): Promise<string> {
    try {
      const { data, error } = await supabase.auth.getUser()
      if (error) return ''
      const authUserId = data.user?.id
      if (!authUserId) return ''
      const { data: empleadoPorAuth, error: errorPorAuth } = await supabase
        .from('empleados').select('id, nombre, auth_user_id')
        .eq('auth_user_id', authUserId).maybeSingle()
      if (!errorPorAuth && empleadoPorAuth?.id) return String(empleadoPorAuth.id)
      const { data: empleadoPorId, error: errorPorId } = await supabase
        .from('empleados').select('id, nombre')
        .eq('id', authUserId).maybeSingle()
      if (!errorPorId && empleadoPorId?.id) return String(empleadoPorId.id)
      return ''
    } catch { return '' }
  }

  async function loadEmpleadoActual() {
    const id = await resolveEmpleadoActualId()
    setEmpleadoActualId(id)
  }

  async function loadData() {
    setLoadingData(true)
    setError('')
    try {
      const [clientesRes, terapeutasRes, serviciosRes, recursosRes, metodosPagoRes] = await Promise.all([
        supabase.from('clientes').select('id, nombre').order('nombre', { ascending: true }),
        supabase.from('empleados').select('id, nombre, comision_cita_porcentaje')
          .in('rol', ['terapeuta', 'fisioterapeuta']).eq('estado', 'activo').order('nombre', { ascending: true }),
        supabase.from('servicios').select('*').eq('estado', 'activo').order('nombre', { ascending: true }),
        supabase.from('recursos').select('id, nombre, estado, capacidad, hora_inicio, hora_fin').order('nombre', { ascending: true }),
        supabase.from('metodos_pago_v2').select(`id, nombre, tipo, moneda, color, icono, cartera:carteras(nombre, codigo)`)
          .eq('activo', true).eq('permite_recibir', true)
          .order('orden', { ascending: true }).order('nombre', { ascending: true }),
      ])
      if (clientesRes.error) throw new Error(`Clientes: ${clientesRes.error.message}`)
      if (terapeutasRes.error) throw new Error(`Terapeutas: ${terapeutasRes.error.message}`)
      if (serviciosRes.error) throw new Error(`Servicios: ${serviciosRes.error.message}`)
      if (recursosRes.error) throw new Error(`Recursos: ${recursosRes.error.message}`)
      if (metodosPagoRes.error) throw new Error(`Métodos de pago: ${metodosPagoRes.error.message}`)

      const serviciosRaw = (serviciosRes.data || []) as ServicioRaw[]
      const serviciosData: Servicio[] = serviciosRaw
        .filter((s) => s.estado !== 'inactivo')
        .map((s) => ({
          id: s.id, nombre: s.nombre, precio: s.precio ?? null,
          estado: s.estado ?? null, color: s.color ?? null,
          duracion_min: getServicioDuracion(s),
          comision_base: s.comision_base ?? s.precio ?? 0,
          comision_rpm: s.comision_rpm ?? 0,
          comision_entrenador: s.comision_entrenador ?? 0,
        }))

      setClientes((clientesRes.data || []) as Cliente[])
      setTerapeutas((terapeutasRes.data || []) as Terapeuta[])
      setServicios(serviciosData)
      setRecursos(((recursosRes.data || []) as Recurso[]).filter((r) => r.estado !== 'inactivo'))
      setMetodosPago(((metodosPagoRes.data || []) as any[]).map(normalizeMetodoPago))
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar el formulario.')
    } finally {
      setLoadingData(false)
    }
  }

  async function loadPlanesCliente(clienteId: string) {
    setLoadingPlanes(true)
    try {
      const { data, error } = await supabase
        .from('clientes_planes')
        .select(`id, cliente_id, plan_id, sesiones_totales, sesiones_usadas, estado, fecha_inicio, fecha_fin, planes(nombre)`)
        .eq('cliente_id', clienteId).in('estado', ['activo', 'agotado'])
        .order('created_at', { ascending: false })
      if (error) throw error
      const planes = ((data || []) as any[]).map(normalizeClientePlan)
      const conDisponibles = planes.filter((p) => getPlanDisponible(p) > 0)
      setPlanesCliente(conDisponibles)
      setForm((prev) => {
        const planExiste = conDisponibles.some((p) => p.id === prev.cliente_plan_id)
        return {
          ...prev,
          cliente_plan_id: planExiste ? prev.cliente_plan_id : '',
          tipo_cita: prev.tipo_cita === 'plan' && conDisponibles.length === 0 ? 'independiente' : prev.tipo_cita,
        }
      })
    } catch {
      setPlanesCliente([])
      setForm((prev) => ({ ...prev, cliente_plan_id: '', tipo_cita: prev.tipo_cita === 'plan' ? 'independiente' : prev.tipo_cita }))
    } finally {
      setLoadingPlanes(false)
    }
  }

  async function guardar() {
    if (!form.cliente_id || !form.terapeuta_id || !form.servicio_id || !form.fecha || !form.hora_inicio) {
      alert('Completa cliente, fisioterapeuta, servicio, fecha y selecciona una hora en el calendario.')
      return
    }
    if (!form.hora_fin) { alert('No se pudo calcular la hora final.'); return }
    if ((toMinutes(form.hora_fin) || 0) <= (toMinutes(form.hora_inicio) || 0)) {
      alert('La hora final debe ser mayor que la hora inicial.'); return
    }
    if (form.tipo_cita === 'plan' && !form.cliente_plan_id) {
      alert('Debes seleccionar el plan del cliente.'); return
    }
    if (form.tipo_cita === 'plan' && planSeleccionado && getPlanDisponible(planSeleccionado) <= 0) {
      alert('Ese plan ya no tiene sesiones disponibles.'); return
    }
    if (form.estado === 'cancelada') { alert('No se puede cobrar una cita cancelada.'); return }

    if (!saltarPago) {
      if (montoBase <= 0) { alert('El monto de la cita debe ser mayor a 0.'); return }
      if (baseComisionAplicada <= 0) { alert('La base de comisión debe ser mayor a 0.'); return }
      if (!comisionBalanceOk) { alert('La distribución de comisión no cuadra correctamente.'); return }

      if (tipoPago === 'unico') {
        if (!metodoPagoUnicoId) { alert('Selecciona el método del pago único.'); return }
        if (monedaPagoUnico === 'BS' && (!tasaPagoUnico || tasaPagoUnico <= 0)) {
          alert('Selecciona una tasa válida para el pago en bolívares.'); return
        }
      } else {
        if (!resumenPagosMixto.p1Valido) { alert('Completa el Pago 1: método y monto requeridos.'); return }
        if (!resumenPagosMixto.p2Valido) { alert('Completa el Pago 2: método y monto requeridos.'); return }
        if (!resumenPagosMixto.cuadra) {
          alert(`La suma de pagos no cuadra.\nObjetivo: ${formatMoney(montoBase)}\nRegistrado: ${formatMoney(resumenPagosMixto.totalUsd)}\nFaltante: ${formatMoney(resumenPagosMixto.faltanteUsd)}`)
          return
        }
      }
    }

    setLoading(true)
    try {
      const horaInicioNorm = form.hora_inicio.length === 5 ? `${form.hora_inicio}:00` : form.hora_inicio
      const horaFinNorm = form.hora_fin.length === 5 ? `${form.hora_fin}:00` : form.hora_fin

      const { data: validacion, error: validacionError } = await supabase.rpc('validar_disponibilidad_cita', {
        p_cliente_id: form.cliente_id, p_terapeuta_id: form.terapeuta_id,
        p_recurso_id: form.recurso_id || null, p_fecha: form.fecha,
        p_hora_inicio: horaInicioNorm, p_hora_fin: horaFinNorm,
      })
      if (validacionError) throw new Error(`Error validando disponibilidad: ${validacionError.message}`)
      const validacionParsed = validacion as ValidacionCita
      if (!validacionParsed?.disponible) { alert(buildErrorFromValidacion(validacionParsed)); setLoading(false); return }

      let auditorId = empleadoActualId || ''
      if (!auditorId) { auditorId = await resolveEmpleadoActualId(); setEmpleadoActualId(auditorId) }

      const { data: citaData, error: citaError } = await supabase
        .from('citas')
        .insert({
          cliente_id: form.cliente_id, terapeuta_id: form.terapeuta_id,
          servicio_id: form.servicio_id, recurso_id: form.recurso_id || null,
          fecha: form.fecha, hora_inicio: horaInicioNorm, hora_fin: horaFinNorm,
          estado: form.estado, notas: form.notas || null,
          cliente_plan_id: form.tipo_cita === 'plan' ? form.cliente_plan_id : null,
          created_by: auditorId || null, updated_by: auditorId || null,
        })
        .select('id').single()
      if (citaError) throw new Error(citaError.message || 'No se pudo crear la cita.')

      const citaId = citaData.id

      if (!saltarPago) {
        const cliente = clientes.find((c) => c.id === form.cliente_id)
        const conceptoBase = `${servicioSeleccionado?.nombre || 'Servicio'} - ${cliente?.nombre || 'Cliente'}`
        const conceptoTipo =
          form.tipo_cita === 'plan' ? `${conceptoBase} [Plan]`
          : form.tipo_cita === 'recovery' ? `${conceptoBase} [Recovery]`
          : `${conceptoBase} [Independiente]`

        const { error: pagosMixtosError } = await supabase.rpc('registrar_pagos_mixtos', {
          p_fecha: form.fecha, p_tipo_origen: 'cita', p_categoria: 'cita',
          p_concepto: conceptoTipo, p_cliente_id: form.cliente_id,
          p_cita_id: citaId,
          p_cliente_plan_id: form.tipo_cita === 'plan' ? form.cliente_plan_id : null,
          p_cuenta_cobrar_id: null, p_inventario_id: null,
          p_registrado_por: auditorId || null,
          p_notas_generales: notasPagoGenerales || null,
          p_pagos: buildPagosPayload(),
        })
        if (pagosMixtosError) throw new Error(`Error creando pagos: ${pagosMixtosError.message}`)

        const { error: comisionError } = await supabase.from('comisiones_detalle').insert({
          empleado_id: form.terapeuta_id, cliente_id: form.cliente_id,
          cita_id: citaId, servicio_id: form.servicio_id, fecha: form.fecha,
          tipo: 'cita', estado: 'pendiente', pagado: false,
          base: baseComisionAplicada, rpm: rpmMonto, profesional: terapeutaMonto,
          moneda: tasaReferenciaComision ? 'BS' : 'USD',
          tasa_bcv: tasaReferenciaComision,
          porcentaje_rpm: porcentajeRpmAplicado,
          monto_base_usd: comisionEquivalentes.monto_base_usd,
          monto_base_bs: comisionEquivalentes.monto_base_bs,
          monto_rpm_usd: comisionEquivalentes.monto_rpm_usd,
          monto_rpm_bs: comisionEquivalentes.monto_rpm_bs,
          monto_profesional_usd: comisionEquivalentes.monto_profesional_usd,
          monto_profesional_bs: comisionEquivalentes.monto_profesional_bs,
        })
        if (comisionError) throw new Error(`Error creando comisión: ${comisionError.message}`)
      }

      router.push('/admin/operaciones/agenda')
    } catch (err: any) {
      alert(err?.message || 'No se pudo crear la cita.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Agenda</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Nueva cita</h1>
          <p className="mt-2 text-sm text-white/55">Crear una cita y registrar el pago/comisión en el mismo flujo.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard title="Ver agenda" description="Volver al listado general de citas." href="/admin/operaciones/agenda" />
          <ActionCard title="Cancelar" description="Salir sin guardar cambios." href="/admin/operaciones/agenda" />
        </div>
      </div>

      {error && (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      )}

      <Section title="Formulario de cita" description="Selecciona cliente, fisioterapeuta, servicio, horario, tipo y notas.">
        {loadingData ? (
          <Card className="p-6"><p className="text-sm text-white/55">Cargando formulario...</p></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Cliente">
              <ClienteSearch
                clientes={clientes}
                value={form.cliente_id}
                onChange={(id) =>
                  setForm((prev) => ({ ...prev, cliente_id: id, cliente_plan_id: '', hora_inicio: '', hora_fin: '' }))
                }
              />
            </Field>

            {form.tipo_cita === 'plan' && (
              <Field
                label="Plan del cliente"
                helper={
                  loadingPlanes ? 'Cargando planes...'
                  : planesCliente.length === 0 ? 'Este cliente no tiene planes activos con sesiones disponibles.'
                  : 'Selecciona el plan exacto que debe consumir la sesión.'
                }
              >
                <select
                  value={form.cliente_plan_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, cliente_plan_id: e.target.value }))}
                  className={inputClassName}
                >
                  <option value="" className="bg-[#11131a] text-white">Seleccionar plan</option>
                  {planesCliente.map((plan) => (
                    <option key={plan.id} value={plan.id} className="bg-[#11131a] text-white">{getPlanLabel(plan)}</option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Fisioterapeuta">
              <select
                value={form.terapeuta_id}
                onChange={(e) => setForm({ ...form, terapeuta_id: e.target.value, hora_inicio: '', hora_fin: '' })}
                className={inputClassName}
              >
                <option value="" className="bg-[#11131a] text-white">Seleccionar fisioterapeuta</option>
                {terapeutas.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#11131a] text-white">{t.nombre}</option>
                ))}
              </select>
            </Field>

            <Field label="Servicio" helper={servicios.length === 0 ? 'No se encontraron servicios activos.' : `${servicios.length} servicio(s) disponible(s).`}>
              <select
                value={form.servicio_id}
                onChange={(e) => {
                  const srv = servicios.find((s) => s.id === e.target.value) || null
                  setForm((prev) => ({ ...prev, servicio_id: e.target.value, hora_inicio: '', hora_fin: '' }))
                  if (srv?.precio && usarPrecioServicio) setMontoPersonalizado(String(srv.precio))
                }}
                className={inputClassName}
              >
                <option value="" className="bg-[#11131a] text-white">Seleccionar servicio</option>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#11131a] text-white">
                    {s.nombre}{s.duracion_min ? ` · ${s.duracion_min} min` : ''}{s.precio ? ` · $${s.precio}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Recurso"
              helper={
                recursoSeleccionado
                  ? `Capacidad: ${Number(recursoSeleccionado.capacidad || 1)} · Horario: ${formatHoraCorta(recursoSeleccionado.hora_inicio)} - ${formatHoraCorta(recursoSeleccionado.hora_fin)}`
                  : 'Selecciona un recurso si la cita debe reservar cubículo/equipo.'
              }
            >
              <select
                value={form.recurso_id}
                onChange={(e) => setForm((prev) => ({ ...prev, recurso_id: e.target.value, hora_inicio: '', hora_fin: '' }))}
                className={inputClassName}
              >
                <option value="" className="bg-[#11131a] text-white">Sin recurso</option>
                {recursos.map((r) => (
                  <option key={r.id} value={r.id} className="bg-[#11131a] text-white">
                    {r.nombre}{r.estado ? ` · ${r.estado}` : ''}{r.capacidad ? ` · cap. ${r.capacidad}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Fecha">
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm((prev) => ({ ...prev, fecha: e.target.value, hora_inicio: '', hora_fin: '' }))}
                className={inputClassName}
              />
            </Field>

            <Field label="Estado" helper="Solo la cita completada debe consumir sesión si está ligada a un plan.">
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className={inputClassName}>
                <option value="programada" className="bg-[#11131a] text-white">Programada</option>
                <option value="confirmada" className="bg-[#11131a] text-white">Confirmada</option>
                <option value="reprogramada" className="bg-[#11131a] text-white">Reprogramada</option>
                <option value="completada" className="bg-[#11131a] text-white">Completada</option>
                <option value="cancelada" className="bg-[#11131a] text-white">Cancelada</option>
              </select>
            </Field>

            <div className="md:col-span-2">
              <DisponibilidadTerapeuta
                terapeutaId={form.terapeuta_id}
                clienteId={form.cliente_id}
                recursoId={form.recurso_id}
                fecha={form.fecha}
                duracion={servicioSeleccionado?.duracion_min || null}
                horaSeleccionada={form.hora_inicio}
                onSelect={(inicio, fin) => setForm((prev) => ({ ...prev, hora_inicio: inicio, hora_fin: fin }))}
              />
            </div>

            <Field label="Hora inicio">
              <input type="text" value={form.hora_inicio ? form.hora_inicio.slice(0, 5) : ''} readOnly
                className={`${inputClassName} cursor-not-allowed opacity-70`} placeholder="Selecciona en el calendario" />
            </Field>

            <Field
              label="Hora fin"
              helper={servicioSeleccionado?.duracion_min ? `Se calcula en base a ${servicioSeleccionado.duracion_min} min.` : 'Selecciona un servicio para calcular la duración.'}
            >
              <input type="text" value={form.hora_fin ? form.hora_fin.slice(0, 5) : ''} readOnly
                className={`${inputClassName} cursor-not-allowed opacity-70`} placeholder="Automático" />
            </Field>

            <div className="md:col-span-2">
              <Field label="Notas">
                <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={4} className={`${inputClassName} resize-none`} placeholder="Notas opcionales..." />
              </Field>
            </div>
          </div>
        )}
      </Section>

      <Section title="Pago" description="Registra el pago de la cita en finanzas.">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSaltarPago((p) => !p)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${saltarPago ? 'bg-white/20' : 'bg-emerald-500'}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${saltarPago ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className="text-sm text-white/75">
              {saltarPago ? 'Saltar pago (registrar después)' : 'Registrar pago ahora'}
            </span>
          </div>

          {!saltarPago && (
            <Card className="p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Monto objetivo USD" helper={usarPrecioServicio ? 'Usando precio del servicio.' : 'Monto personalizado.'}>
                  <div className="flex gap-2">
                    <input
                      type="number" min={0} step="0.01"
                      value={usarPrecioServicio ? (servicioSeleccionado?.precio ?? '') : montoPersonalizado}
                      readOnly={usarPrecioServicio}
                      onChange={(e) => setMontoPersonalizado(e.target.value)}
                      className={`${inputClassName} ${usarPrecioServicio ? 'cursor-not-allowed opacity-60' : ''}`}
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      onClick={() => setUsarPrecioServicio((p) => !p)}
                      className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white/60 hover:bg-white/[0.06]"
                    >
                      {usarPrecioServicio ? 'Editar' : 'Servicio'}
                    </button>
                  </div>
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
                      rows={3} className={`${inputClassName} resize-none`}
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
                        <select value={monedaPagoUnico} onChange={(e) => setMonedaPagoUnico(e.target.value as 'USD' | 'BS')} className={inputClassName}>
                          <option value="USD" className="bg-[#11131a]">USD</option>
                          <option value="BS" className="bg-[#11131a]">Bs</option>
                        </select>
                      </Field>

                      <Field label={monedaPagoUnico === 'USD' ? 'Método USD' : 'Método Bs'}>
                        <select value={metodoPagoUnicoId} onChange={(e) => setMetodoPagoUnicoId(e.target.value)} className={inputClassName}>
                          <option value="" className="bg-[#11131a]">Seleccionar</option>
                          {(monedaPagoUnico === 'USD'
                            ? metodosPago.filter((m) => detectarMetodoUsd(m))
                            : metodosPago.filter((m) => detectarMetodoBs(m))
                          ).map((m) => (
                            <option key={m.id} value={m.id} className="bg-[#11131a]">
                              {m.nombre}{m.moneda ? ` · ${m.moneda}` : ''}{m.tipo ? ` · ${m.tipo}` : ''}
                            </option>
                          ))}
                        </select>
                      </Field>

                      {monedaPagoUnico === 'USD' ? (
                        <Field label="Monto USD">
                          <input type="text" value={formatMoney(totalPagoUnicoUsd)} readOnly className={`${inputClassName} cursor-not-allowed opacity-80`} />
                        </Field>
                      ) : (
                        <Field label="Monto Bs">
                          <input type="text" value={formatBs(totalPagoUnicoBs)} readOnly className={`${inputClassName} cursor-not-allowed opacity-80`} />
                        </Field>
                      )}

                      {monedaPagoUnico === 'BS' && (
                        <div className="md:col-span-3">
                          <PagoBsSelector
                            fecha={form.fecha} montoUsd={montoBase} montoBs={montoPagoUnicoBs}
                            onChangeTasa={(tasa) => setTasaPagoUnico(tasa)}
                            onChangeMontoBs={(monto) => setMontoPagoUnicoBs(monto)}
                          />
                        </div>
                      )}

                      <Field label="Referencia">
                        <input value={referenciaPagoUnico} onChange={(e) => setReferenciaPagoUnico(e.target.value)}
                          className={inputClassName} placeholder="Referencia o comprobante" />
                      </Field>

                      <div className="md:col-span-2">
                        <Field label="Notas del pago">
                          <input value={notasPagoUnico} onChange={(e) => setNotasPagoUnico(e.target.value)}
                            className={inputClassName} placeholder="Notas opcionales..." />
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
                    fecha={form.fecha}
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
                    fecha={form.fecha}
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
            </Card>
          )}
        </div>
      </Section>

      <Section
        title="Configuración de comisión"
        description="Los porcentajes vienen del servicio pero pueden editarse para esta cita. La otra parte se ajusta automáticamente."
      >
        <Card className="p-6">
          <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <p className="text-sm font-semibold uppercase tracking-wider text-white/40">Distribución de comisión</p>
              <button
                type="button"
                onClick={resetearComisionAlServicio}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60 transition hover:bg-white/[0.06]"
              >
                Restaurar comisión del servicio
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Precio (USD)" helper={usarPrecioServicio ? 'Tomando el precio del servicio.' : 'Precio editable solo para esta cita.'}>
                <div className="flex gap-2">
                  <input
                    type="number" min={0} step="0.01"
                    value={usarPrecioServicio ? String(servicioSeleccionado?.precio ?? '') : montoPersonalizado}
                    readOnly={usarPrecioServicio}
                    onChange={(e) => setMontoPersonalizado(e.target.value)}
                    className={`${inputClassName} ${usarPrecioServicio ? 'cursor-not-allowed opacity-70' : ''}`}
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    onClick={() => setUsarPrecioServicio((p) => !p)}
                    className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white/60 hover:bg-white/[0.06]"
                  >
                    {usarPrecioServicio ? 'Editar' : 'Servicio'}
                  </button>
                </div>
              </Field>

              <Field label="Base comisión" helper="Igual al monto cobrado.">
                <input type="number" value={String(baseComisionAplicada)} readOnly className={`${inputClassName} cursor-not-allowed opacity-80`} />
              </Field>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-xs text-white/45">Regla</p>
                <p className="mt-2 text-sm text-white/75">Si cambias un porcentaje o monto, el otro se ajusta automáticamente.</p>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-violet-400/15 bg-white/[0.03] p-4">
                <p className="mb-3 text-sm font-semibold text-violet-300">RPM</p>
                <Field label="Porcentaje RPM">
                  <input type="number" min={0} max={100} step="0.01" value={porcentajeRpmAplicado}
                    onChange={(e) => handleChangePorcentajeRpm(e.target.value)} className={inputClassName} />
                </Field>
                <div className="mt-4">
                  <Field label="Monto RPM">
                    <input type="number" min={0} max={baseComisionAplicada} step="0.01" value={rpmMonto}
                      onChange={(e) => handleChangeMontoRpm(e.target.value)} className={inputClassName} />
                  </Field>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-400/15 bg-white/[0.03] p-4">
                <p className="mb-3 text-sm font-semibold text-emerald-300">Fisioterapeuta</p>
                <Field label="Porcentaje fisioterapeuta">
                  <input type="number" min={0} max={100} step="0.01" value={porcentajeEntrenadorAplicado}
                    onChange={(e) => handleChangePorcentajeEntrenador(e.target.value)} className={inputClassName} />
                </Field>
                <div className="mt-4">
                  <Field label="Monto fisioterapeuta">
                    <input type="number" min={0} max={baseComisionAplicada} step="0.01" value={terapeutaMonto}
                      onChange={(e) => handleChangeMontoEntrenador(e.target.value)} className={inputClassName} />
                  </Field>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5">
                <p className="text-sm text-white/60">Base</p>
                <p className="mt-2 text-3xl font-bold text-white">{formatMoney(baseComisionAplicada)}</p>
                <p className="mt-2 text-xs text-white/40">Precio cobrado: {formatMoney(montoBase)}</p>
              </div>
              <div className="rounded-[28px] border border-violet-400/15 bg-white/[0.05] p-5">
                <p className="text-sm text-white/60">RPM recibe</p>
                <p className="mt-2 text-3xl font-bold text-violet-400">{formatMoney(rpmMonto)}</p>
                <p className="mt-2 text-sm text-white/50">{porcentajeRpmAplicado}%</p>
              </div>
              <div className="rounded-[28px] border border-emerald-400/15 bg-white/[0.05] p-5">
                <p className="text-sm text-white/60">Fisioterapeuta recibe</p>
                <p className="mt-2 text-3xl font-bold text-emerald-400">{formatMoney(terapeutaMonto)}</p>
                <p className="mt-2 text-sm text-white/50">{porcentajeEntrenadorAplicado}%</p>
              </div>
            </div>

            {!comisionBalanceOk && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                <p className="text-sm text-rose-400">La suma de la comisión no coincide con la base.</p>
              </div>
            )}

            {comisionEquivalentes.monto_base_bs ? (
              <div className="grid gap-2 border-t border-white/10 pt-4 text-sm md:grid-cols-3">
                <div><span className="text-white/55">Base en Bs: </span><span className="text-white/75">{formatBs(comisionEquivalentes.monto_base_bs)}</span></div>
                <div><span className="text-white/55">RPM en Bs: </span><span className="text-white/75">{formatBs(comisionEquivalentes.monto_rpm_bs || 0)}</span></div>
                <div><span className="text-white/55">Fisioterapeuta en Bs: </span><span className="text-white/75">{formatBs(comisionEquivalentes.monto_profesional_bs || 0)}</span></div>
              </div>
            ) : null}
          </div>
        </Card>
      </Section>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={guardar}
          disabled={
            loading || servicios.length === 0 || !form.hora_inicio ||
            (form.tipo_cita === 'plan' && !form.cliente_plan_id) ||
            (!saltarPago && (!comisionBalanceOk || baseComisionAplicada <= 0))
          }
          className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-60"
        >
          {loading ? 'Guardando...' : 'Guardar cita'}
        </button>

        <button
          type="button"
          onClick={() => router.push('/admin/operaciones/agenda')}
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

export default function NuevaCitaPage() {
  return (
    <Suspense fallback={<NuevaCitaPageFallback />}>
      <NuevaCitaPageContent />
    </Suspense>
  )
}