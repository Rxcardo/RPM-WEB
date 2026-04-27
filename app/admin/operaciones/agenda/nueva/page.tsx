'use client'

export const dynamic = 'force-dynamic'

import {
  Suspense,
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
import DisponibilidadTerapeuta from '@/components/agenda/DisponibilidadTerapeuta'
import PagoConDeudaSelector, {
  pagoConDeudaInitial,
  validarPagoConDeuda,
  buildCuentaPorCobrarPayload,
  buildPagosRpcPayload,
  getTasaReferenciaFromState,
  type PagoConDeudaState,
} from '@/components/pagos/PagoConDeudaSelector'

// ─── Types ────────────────────────────────────────────────────────────────────

type Cliente = { id: string; nombre: string }
type Terapeuta = { id: string; nombre: string; rol?: string | null; comision_cita_porcentaje: number }
type ServicioRaw = {
  id: string; nombre: string; estado?: string | null; precio?: number | null
  duracion_minutos?: number | null; color?: string | null
  comision_base?: number | null; comision_rpm?: number | null; comision_entrenador?: number | null
  [key: string]: any
}
type Servicio = {
  id: string; nombre: string; precio: number | null; duracion_min: number | null
  estado?: string | null; color?: string | null
  comision_base: number | null; comision_rpm: number | null; comision_entrenador: number | null
}
type Recurso = {
  id: string; nombre: string; estado: string | null; capacidad: number | null
  hora_inicio: string | null; hora_fin: string | null
}
type MetodoPago = {
  id: string; nombre: string; tipo?: string | null; moneda?: string | null
  color?: string | null; icono?: string | null
  cartera?: { nombre: string; codigo: string } | null
}
type ClientePlan = {
  id: string; cliente_id: string; plan_id: string
  sesiones_totales: number; sesiones_usadas: number
  estado: string; fecha_inicio: string | null; fecha_fin: string | null
  planes?: { nombre: string } | null
}
type ValidacionCita = {
  disponible: boolean; motivo: string
  conflicto_terapeuta?: boolean; conflicto_cliente?: boolean
  conflictos_recurso?: number; capacidad_recurso?: number
  recurso_estado?: string | null; recurso_hora_inicio?: string | null; recurso_hora_fin?: string | null
  detalle?: { tipo?: string; motivo?: string; detalle?: string; hora_inicio?: string | null; hora_fin?: string | null } | null
}

// ── SlotHora ahora incluye fecha propia ───────────────────────────────────────
type SlotHora = { fecha: string; hora_inicio: string; hora_fin: string }

function esRolTerapeuta(rol: string | null | undefined) {
  const r = (rol || '').trim().toLowerCase()
  return r === 'terapeuta' || r === 'fisioterapeuta'
}

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
    color: row?.color ?? null, icono: row?.icono ?? null,
    cartera: cartera ? { nombre: String(cartera?.nombre ?? ''), codigo: String(cartera?.codigo ?? '') } : null,
  }
}

function normalizeClientePlan(row: any): ClientePlan {
  const plan = firstOrNull(row?.planes)
  return {
    id: String(row?.id ?? ''), cliente_id: String(row?.cliente_id ?? ''), plan_id: String(row?.plan_id ?? ''),
    sesiones_totales: Number(row?.sesiones_totales || 0), sesiones_usadas: Number(row?.sesiones_usadas || 0),
    estado: String(row?.estado ?? ''), fecha_inicio: row?.fecha_inicio ?? null, fecha_fin: row?.fecha_fin ?? null,
    planes: plan ? { nombre: String(plan?.nombre ?? '') } : null,
  }
}

function sumarMinutos(hora: string, minutos: number) {
  if (!hora) return ''
  const [h, m] = hora.slice(0, 5).split(':').map(Number)
  const total = h * 60 + m + minutos
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}:00`
}

function getServicioDuracion(s: ServicioRaw) {
  const n = Number(s.duracion_minutos)
  return !Number.isNaN(n) && n > 0 ? n : null
}

function toMinutes(hora: string | null | undefined) {
  if (!hora) return null
  const [h, m] = hora.slice(0, 5).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

function formatHoraCorta(hora: string | null | undefined) { return hora ? hora.slice(0, 5) : '—' }

function normHora(hora: string) {
  return hora ? hora.slice(0, 5) : ''
}

function normHoraConSegundos(hora: string) {
  if (!hora) return ''
  if (hora.length === 5) return `${hora}:00`
  return hora
}

function buildErrorFromValidacion(v: ValidacionCita | null | undefined) {
  if (!v) return 'No se pudo validar la disponibilidad.'
  switch (v.motivo) {
    case 'ok': return ''
    case 'empleado_bloqueado': return v.detalle?.detalle || v.detalle?.motivo || 'El fisioterapeuta no está disponible en ese horario.'
    case 'conflicto_terapeuta': return 'Ese fisioterapeuta ya tiene una cita en ese horario.'
    case 'conflicto_cliente': return 'Ese cliente ya tiene una cita en ese horario.'
    case 'conflicto_recurso': return v.capacidad_recurso && v.capacidad_recurso > 1 ? `Ese recurso ya alcanzó su capacidad máxima (${v.capacidad_recurso}).` : 'Ese recurso ya está ocupado en ese horario.'
    case 'recurso_inactivo': return 'Ese recurso está inactivo.'
    case 'recurso_mantenimiento': return 'Ese recurso está en mantenimiento.'
    case 'fuera_horario_recurso_inicio': return `Ese recurso solo está disponible desde las ${formatHoraCorta(v.recurso_hora_inicio)}.`
    case 'fuera_horario_recurso_fin': return `Ese recurso solo está disponible hasta las ${formatHoraCorta(v.recurso_hora_fin)}.`
    case 'recurso_no_existe': return 'El recurso seleccionado no existe.'
    case 'hora_fin_invalida': return 'La hora final debe ser mayor que la hora inicial.'
    default: return `No se puede guardar la cita (${v.motivo}).`
  }
}

const r2 = (v: number | null | undefined) => Math.round(Number(v || 0) * 100) / 100
function clamp(v: number, min: number, max: number) { return Math.min(Math.max(v, min), max) }
function formatMoney(v: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v || 0))
}
function formatBs(v: number | null | undefined) {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES', maximumFractionDigits: 2 }).format(Number(v || 0))
}
function getPlanDisponible(p: ClientePlan) { return Math.max(Number(p.sesiones_totales || 0) - Number(p.sesiones_usadas || 0), 0) }
function getPlanLabel(p: ClientePlan) { return `${p.planes?.nombre || 'Plan'} · ${getPlanDisponible(p)}/${p.sesiones_totales} disponibles` }

// ─── UI primitivos ────────────────────────────────────────────────────────────

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

// ─── ClienteSearch ────────────────────────────────────────────────────────────

function ClienteSearch({ clientes, value, onChange }: { clientes: Cliente[]; value: string; onChange: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const clienteSel = useMemo(() => clientes.find((c) => c.id === value) || null, [clientes, value])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? clientes.filter((c) => c.nombre.toLowerCase().includes(q)).slice(0, 50) : clientes.slice(0, 50)
  }, [clientes, query])

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn); return () => document.removeEventListener('mousedown', fn)
  }, [])
  useEffect(() => { setHighlighted(0) }, [filtered])
  useEffect(() => { (listRef.current?.children[highlighted] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' }) }, [highlighted])

  function handleSelect(id: string) { onChange(id); setQuery(''); setOpen(false) }
  function handleClear() { onChange(''); setQuery(''); setTimeout(() => inputRef.current?.focus(), 0) }
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) { if (e.key !== 'Tab') setOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlighted]) handleSelect(filtered[highlighted].id) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {clienteSel && !open ? (
        <div className="flex w-full items-center gap-2 rounded-2xl border border-violet-400/30 bg-violet-500/10 px-4 py-3">
          <span className="flex-1 truncate text-sm font-medium text-white">{clienteSel.nombre}</span>
          <button type="button" onClick={handleClear} className="shrink-0 rounded-full p-0.5 text-white/40 hover:text-white/80">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>
      ) : (
        <div className="relative">
          <input ref={inputRef} type="text" value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} onKeyDown={handleKeyDown} placeholder="Buscar paciente por nombre..." className={inputCls} autoComplete="off" />
          <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/30" width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/><path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
      )}
      {open && (
        <ul ref={listRef} className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#16181f] py-1 shadow-xl">
          {filtered.length === 0
            ? <li className="px-4 py-3 text-sm text-white/40">Sin resultados para "{query}"</li>
            : filtered.map((c, i) => (
              <li key={c.id} onMouseDown={() => handleSelect(c.id)} onMouseEnter={() => setHighlighted(i)}
                className={`cursor-pointer px-4 py-2.5 text-sm transition ${i === highlighted ? 'bg-violet-500/20 text-violet-200' : 'text-white/80 hover:bg-white/[0.05]'}`}>
                {c.nombre}
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

function NuevaCitaPageFallback() {
  return (
    <div className="space-y-6">
      <Section title="Formulario de cita" description="Cargando vista...">
        <Card className="p-6"><p className="text-sm text-white/55">Cargando formulario...</p></Card>
      </Section>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function NuevaCitaPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clienteInicial = searchParams.get('cliente') || ''

  const [loading, setLoading]         = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [loadingPlanes, setLoadingPlanes] = useState(false)
  const [error, setError]             = useState('')
  const [empleadoActualId, setEmpleadoActualId] = useState('')

  const [clientes, setClientes]       = useState<Cliente[]>([])
  const [terapeutas, setTerapeutas]   = useState<Terapeuta[]>([])
  const [servicios, setServicios]     = useState<Servicio[]>([])
  const [recursos, setRecursos]       = useState<Recurso[]>([])
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

  // Lista de slots ya confirmados para el lote — cada uno con su propia fecha
  const [slots, setSlots] = useState<SlotHora[]>([])

  const [usarPrecioServicio, setUsarPrecioServicio] = useState(true)
  const [montoPersonalizado, setMontoPersonalizado] = useState('')
  const [pagoState, setPagoState] = useState<PagoConDeudaState>(pagoConDeudaInitial())
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10))

  const [porcentajeRpmEditable, setPorcentajeRpmEditable]           = useState(50)
  const [porcentajeEntrenadorEditable, setPorcentajeEntrenadorEditable] = useState(50)

  // ─── Effects ──────────────────────────────────────────────────────────

  // BLOQUEO_RECOVERY_INTERNO: siempre Recovery y sin plan asociado.
  useEffect(() => {
    setForm((prev) => (prev.tipo_cita === 'recovery' && !prev.cliente_plan_id
      ? prev
      : { ...prev, tipo_cita: 'recovery', cliente_plan_id: '' }))
  }, [form.tipo_cita, form.cliente_plan_id])

  useEffect(() => { void loadData(); void loadEmpleadoActual() }, [])

  useEffect(() => {
    setForm((prev) => (!prev.cliente_id && clienteInicial ? { ...prev, cliente_id: clienteInicial } : prev))
  }, [clienteInicial])

  useEffect(() => {
    if (form.cliente_id) void loadPlanesCliente(form.cliente_id)
    else { setPlanesCliente([]); setForm((prev) => ({ ...prev, cliente_plan_id: '', tipo_cita: 'recovery' })) }
  }, [form.cliente_id])

  const servicioSeleccionado = useMemo(() => servicios.find((s) => s.id === form.servicio_id) || null, [servicios, form.servicio_id])
  const planSeleccionado     = useMemo(() => planesCliente.find((p) => p.id === form.cliente_plan_id) || null, [planesCliente, form.cliente_plan_id])
  const recursoSeleccionado  = useMemo(() => recursos.find((r) => r.id === form.recurso_id) || null, [recursos, form.recurso_id])

  // Auto-calcula hora_fin al seleccionar hora_inicio en el calendario
  useEffect(() => {
    if (!form.hora_inicio || !servicioSeleccionado?.duracion_min) return
    setForm((prev) => ({ ...prev, hora_fin: sumarMinutos(prev.hora_inicio, servicioSeleccionado.duracion_min || 0) }))
  }, [form.hora_inicio, servicioSeleccionado?.duracion_min])

  useEffect(() => {
    if (form.tipo_cita !== 'plan' && form.cliente_plan_id) setForm((prev) => ({ ...prev, cliente_plan_id: '' }))
  }, [form.tipo_cita])

  useEffect(() => {
    if (!servicioSeleccionado) { setPorcentajeRpmEditable(50); setPorcentajeEntrenadorEditable(50); return }
    const base = Number(servicioSeleccionado.comision_base ?? servicioSeleccionado.precio ?? 0)
    const rpm  = Number(servicioSeleccionado.comision_rpm ?? 0)
    const pct  = base > 0 ? clamp(r2((rpm / base) * 100), 0, 100) : 50
    setPorcentajeRpmEditable(pct); setPorcentajeEntrenadorEditable(r2(100 - pct))
  }, [servicioSeleccionado])

  useEffect(() => {
  setPagoState(pagoConDeudaInitial())
}, [
  form.servicio_id,
  usarPrecioServicio,
  montoPersonalizado,
  slots.length,
  form.hora_inicio,
  form.fecha,
])

  // ─── Derived ──────────────────────────────────────────────────────────

  const montoBase = useMemo(
    () => usarPrecioServicio ? r2(servicioSeleccionado?.precio || 0) : r2(Number(montoPersonalizado || 0)),
    [usarPrecioServicio, servicioSeleccionado, montoPersonalizado]
  )

  const baseComisionOriginal  = useMemo(() => r2(servicioSeleccionado?.comision_base ?? servicioSeleccionado?.precio ?? 0), [servicioSeleccionado])

  const porcentajeRpmOriginal = useMemo(() => {
    const base = Number(servicioSeleccionado?.comision_base ?? servicioSeleccionado?.precio ?? 0)
    const rpm  = Number(servicioSeleccionado?.comision_rpm ?? 0)
    if (!base) return 50
    return clamp(r2((rpm / base) * 100), 0, 100)
  }, [servicioSeleccionado])

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
    setLoadingData(true); setError('')
    try {
      const [clientesRes, terapeutasRes, serviciosRes, recursosRes, metodosRes] = await Promise.all([
        supabase.from('clientes').select('id, nombre').order('nombre', { ascending: true }),
        supabase.from('empleados').select('id, nombre, rol, comision_cita_porcentaje').in('rol', ['terapeuta', 'fisioterapeuta']).eq('estado', 'activo').order('nombre', { ascending: true }),
        supabase.from('servicios').select('*').eq('estado', 'activo').order('nombre', { ascending: true }),
        supabase.from('recursos').select('id, nombre, estado, capacidad, hora_inicio, hora_fin').order('nombre', { ascending: true }),
        supabase.from('metodos_pago_v2').select(`id, nombre, tipo, moneda, color, icono, cartera:carteras(nombre, codigo)`).eq('activo', true).eq('permite_recibir', true).order('orden', { ascending: true }).order('nombre', { ascending: true }),
      ])
      if (clientesRes.error)   throw new Error(`Clientes: ${clientesRes.error.message}`)
      if (terapeutasRes.error) throw new Error(`Terapeutas: ${terapeutasRes.error.message}`)
      if (serviciosRes.error)  throw new Error(`Servicios: ${serviciosRes.error.message}`)
      if (recursosRes.error)   throw new Error(`Recursos: ${recursosRes.error.message}`)
      if (metodosRes.error)    throw new Error(`Métodos de pago: ${metodosRes.error.message}`)
      setClientes((clientesRes.data || []) as Cliente[])
      setTerapeutas(((terapeutasRes.data || []) as any[]).filter((t) => esRolTerapeuta((t as any).rol)) as Terapeuta[])
      setServicios(((serviciosRes.data || []) as ServicioRaw[]).filter((s) => s.estado !== 'inactivo').map((s) => ({
        id: s.id, nombre: s.nombre, precio: s.precio ?? null, estado: s.estado ?? null, color: s.color ?? null,
        duracion_min: getServicioDuracion(s), comision_base: s.comision_base ?? s.precio ?? 0,
        comision_rpm: s.comision_rpm ?? 0, comision_entrenador: s.comision_entrenador ?? 0,
      })))
      setRecursos(((recursosRes.data || []) as Recurso[]).filter((r) => r.estado !== 'inactivo'))
      setMetodosPago(((metodosRes.data || []) as any[]).map(normalizeMetodoPago))
    } catch (err: any) { setError(err?.message || 'No se pudo cargar el formulario.') }
    finally { setLoadingData(false) }
  }

  async function loadPlanesCliente(clienteId: string) {
    setLoadingPlanes(true)
    try {
      const { data, error } = await supabase.from('clientes_planes').select(`id, cliente_id, plan_id, sesiones_totales, sesiones_usadas, estado, fecha_inicio, fecha_fin, planes(nombre)`).eq('cliente_id', clienteId).in('estado', ['activo', 'agotado']).order('created_at', { ascending: false })
      if (error) throw error
      const planes = ((data || []) as any[]).map(normalizeClientePlan).filter((p) => getPlanDisponible(p) > 0)
      setPlanesCliente(planes)
      setForm((prev) => ({
        ...prev,
        cliente_plan_id: planes.some((p) => p.id === prev.cliente_plan_id) ? prev.cliente_plan_id : '',
        tipo_cita: 'recovery',
      }))
    } catch {
      setPlanesCliente([])
      setForm((prev) => ({ ...prev, cliente_plan_id: '', tipo_cita: 'recovery' }))
    } finally { setLoadingPlanes(false) }
  }

  // ─── Handlers comisión ────────────────────────────────────────────────

  function handleChangePctRpm(v: string) { const p = clamp(Number(v || 0), 0, 100); setPorcentajeRpmEditable(r2(p)); setPorcentajeEntrenadorEditable(r2(100 - p)) }
  function handleChangePctEnt(v: string) { const p = clamp(Number(v || 0), 0, 100); setPorcentajeEntrenadorEditable(r2(p)); setPorcentajeRpmEditable(r2(100 - p)) }
  function handleChangeMontoRpm(v: string) { const m = clamp(Number(v || 0), 0, baseComisionAplicada); const p = baseComisionAplicada > 0 ? r2((m / baseComisionAplicada) * 100) : 0; setPorcentajeRpmEditable(p); setPorcentajeEntrenadorEditable(r2(100 - p)) }
  function handleChangeMontoEnt(v: string) { const m = clamp(Number(v || 0), 0, baseComisionAplicada); const p = baseComisionAplicada > 0 ? r2((m / baseComisionAplicada) * 100) : 0; setPorcentajeEntrenadorEditable(p); setPorcentajeRpmEditable(r2(100 - p)) }
  function resetearComision() { const p = clamp(porcentajeRpmOriginal, 0, 100); setPorcentajeRpmEditable(r2(p)); setPorcentajeEntrenadorEditable(r2(100 - p)) }

  // ─── Manejo de slots acumulados ───────────────────────────────────────

  function agregarSlot() {
    const hi = normHora(form.hora_inicio)
    const hf = normHora(form.hora_fin)
    const fecha = form.fecha
    if (!hi || !hf) { alert('Selecciona una hora en el calendario antes de agregar.'); return }
    if (!fecha) { alert('Selecciona una fecha antes de agregar.'); return }
    // Duplicado: misma fecha + misma hora_inicio
    if (slots.some((s) => s.fecha === fecha && normHora(s.hora_inicio) === hi)) {
      alert(`La hora ${hi} del ${fecha} ya está en el lote.`); return
    }
    setSlots((prev) =>
      [...prev, { fecha, hora_inicio: hi, hora_fin: hf }].sort((a, b) =>
        a.fecha.localeCompare(b.fecha) || (toMinutes(a.hora_inicio) || 0) - (toMinutes(b.hora_inicio) || 0)
      )
    )
    // Limpia solo la selección de hora, NO la fecha — para poder seguir agregando en la misma fecha
    setForm((prev) => ({ ...prev, hora_inicio: '', hora_fin: '' }))
  }

  function quitarSlot(fecha: string, hi: string) {
    setSlots((prev) => prev.filter((s) => !(s.fecha === fecha && normHora(s.hora_inicio) === normHora(hi))))
  }

  function limpiarSlots() {
    setSlots([])
    setForm((prev) => ({ ...prev, hora_inicio: '', hora_fin: '' }))
  }

  // ─── Guardar ──────────────────────────────────────────────────────────

  async function guardar() {
    // Construir lista final: slots confirmados + el que está seleccionado ahora si no está en la lista
    const horaActual = normHora(form.hora_inicio)
    const finActual  = normHora(form.hora_fin)
    const fechaActual = form.fecha
    let slotsFinal   = [...slots]
    if (
      horaActual && finActual && fechaActual &&
      !slotsFinal.some((s) => s.fecha === fechaActual && normHora(s.hora_inicio) === horaActual)
    ) {
      slotsFinal = [...slotsFinal, { fecha: fechaActual, hora_inicio: horaActual, hora_fin: finActual }]
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || (toMinutes(a.hora_inicio) || 0) - (toMinutes(b.hora_inicio) || 0))
    }

    if (!form.cliente_id || !form.terapeuta_id || !form.servicio_id || slotsFinal.length === 0) {
      alert('Completa cliente, fisioterapeuta, servicio y agrega al menos una hora al lote.')
      return
    }
    // Tipo de cita fijo: Recovery. No consume plan ni permite independiente.
    if (form.estado === 'cancelada') { alert('No se puede cobrar una cita cancelada.'); return }
    if (montoBase <= 0) { alert('El monto de la cita debe ser mayor a 0.'); return }
    if (baseComisionAplicada <= 0) { alert('La base de comisión debe ser mayor a 0.'); return }
    if (!comisionBalanceOk) { alert('La distribución de comisión no cuadra correctamente.'); return }
    const errorPago = validarPagoConDeuda(pagoState, montoTotalLote)
    if (errorPago) { alert(errorPago); return }

    setLoading(true)
    try {
      let auditorId = empleadoActualId || ''
      if (!auditorId) { auditorId = await resolveEmpleadoActualId(); setEmpleadoActualId(auditorId) }

      const clienteNombre     = clientes.find((c) => c.id === form.cliente_id)?.nombre || 'Cliente'
      const nombreServicio    = servicioSeleccionado?.nombre || 'Servicio'

      for (const slot of slotsFinal) {
        const hiN = normHoraConSegundos(slot.hora_inicio)
        const hfN = normHoraConSegundos(slot.hora_fin)

        if ((toMinutes(slot.hora_fin) || 0) <= (toMinutes(slot.hora_inicio) || 0)) {
          throw new Error(`La hora fin de ${slot.hora_inicio} debe ser mayor que la hora inicio.`)
        }

        // Validar disponibilidad — usa la fecha propia del slot
        const { data: validacion, error: valErr } = await supabase.rpc('validar_disponibilidad_cita', {
          p_cliente_id: form.cliente_id, p_terapeuta_id: form.terapeuta_id,
          p_recurso_id: form.recurso_id || null,
          p_fecha: slot.fecha,   // ← fecha propia del slot
          p_hora_inicio: hiN, p_hora_fin: hfN,
        })
        if (valErr) throw new Error(`Error validando (${slot.fecha} ${slot.hora_inicio}): ${valErr.message}`)
        if (!(validacion as ValidacionCita)?.disponible) {
          throw new Error(`${slot.fecha} ${slot.hora_inicio}: ${buildErrorFromValidacion(validacion as ValidacionCita)}`)
        }

        // Crear cita — usa la fecha propia del slot
        const { data: citaData, error: citaErr } = await supabase.from('citas').insert({
          cliente_id: form.cliente_id, terapeuta_id: form.terapeuta_id,
          servicio_id: form.servicio_id, recurso_id: form.recurso_id || null,
          fecha: slot.fecha,   // ← fecha propia del slot
          hora_inicio: hiN, hora_fin: hfN,
          estado: form.estado, notas: form.notas || null,
          cliente_plan_id: null,
          created_by: auditorId || null, updated_by: auditorId || null,
        }).select('id').single()
        if (citaErr) throw new Error(`${slot.fecha} ${slot.hora_inicio}: ${citaErr.message}`)
        const citaId = citaData.id

        const conceptoBase = `${nombreServicio} - ${clienteNombre} - ${slot.fecha} ${slot.hora_inicio}`
        const concepto = `${conceptoBase} [Recovery]`

        // Registrar pago
        if (pagoState.tipoCobro !== 'sin_pago') {
          const pagosPayload = buildPagosRpcPayload(pagoState, montoBase)
          if (pagosPayload) {
            const { error: pagoErr } = await supabase.rpc('registrar_pagos_mixtos', {
              p_fecha: fechaPago, p_tipo_origen: 'cita', p_categoria: 'cita', p_concepto: concepto,
              p_cliente_id: form.cliente_id, p_cita_id: citaId,
              p_cliente_plan_id: null,
              p_cuenta_cobrar_id: null, p_inventario_id: null,
              p_registrado_por: auditorId || null, p_notas_generales: null,
              p_pagos: pagosPayload,
            })
            if (pagoErr) throw new Error(`Error pago (${slot.fecha} ${slot.hora_inicio}): ${pagoErr.message}`)
          }
        }

        // Cuenta por cobrar si hay deuda
        const cxcPayload = buildCuentaPorCobrarPayload({
          state: pagoState, montoTotal: montoBase, clienteId: form.cliente_id,
          clienteNombre, concepto, fecha: fechaPago, registradoPor: auditorId || null,
        })
        if (cxcPayload) {
          const { error: cxcErr } = await supabase.from('cuentas_por_cobrar').insert(cxcPayload)
          if (cxcErr) console.warn('No se pudo crear cuenta por cobrar:', cxcErr.message)
        }

        // Comisión
        const { error: comisionErr } = await supabase.from('comisiones_detalle').insert({
          empleado_id: form.terapeuta_id, cliente_id: form.cliente_id,
          cita_id: citaId, servicio_id: form.servicio_id, fecha: fechaPago,
          tipo: 'cita', estado: 'pendiente', pagado: false,
          base: baseComisionAplicada, rpm: rpmMonto, profesional: terapeutaMonto,
          moneda: tasaReferenciaComision ? 'BS' : 'USD', tasa_bcv: tasaReferenciaComision,
          porcentaje_rpm: porcentajeRpmAplicado,
          monto_base_usd: comisionEq.monto_base_usd, monto_base_bs: comisionEq.monto_base_bs,
          monto_rpm_usd: comisionEq.monto_rpm_usd,   monto_rpm_bs: comisionEq.monto_rpm_bs,
          monto_profesional_usd: comisionEq.monto_profesional_usd, monto_profesional_bs: comisionEq.monto_profesional_bs,
        })
        if (comisionErr) throw new Error(`Error comisión (${slot.fecha} ${slot.hora_inicio}): ${comisionErr.message}`)
      }

      router.push('/admin/operaciones/agenda')
    } catch (err: any) {
      alert(err?.message || 'No se pudieron crear las citas.')
    } finally { setLoading(false) }
  }

  // ─── JSX ──────────────────────────────────────────────────────────────

  const horaActualPendiente = !!(
    normHora(form.hora_inicio) &&
    form.fecha &&
    !slots.some((s) => s.fecha === form.fecha && normHora(s.hora_inicio) === normHora(form.hora_inicio))
  )
  const totalCitas = slots.length + (horaActualPendiente ? 1 : 0)
  const montoTotalLote = useMemo(() => r2(montoBase * Math.max(totalCitas, 1)), [montoBase, totalCitas])
  const baseComisionAplicada  = useMemo(() => usarPrecioServicio ? r2(baseComisionOriginal * Math.max(totalCitas, 1)) : montoTotalLote, [usarPrecioServicio, baseComisionOriginal, totalCitas, montoTotalLote])
  const porcentajeRpmAplicado    = useMemo(() => clamp(r2(porcentajeRpmEditable), 0, 100), [porcentajeRpmEditable])
  const porcentajeEntAplicado    = useMemo(() => clamp(r2(100 - porcentajeRpmAplicado), 0, 100), [porcentajeRpmAplicado])
  const rpmMonto                 = useMemo(() => r2((baseComisionAplicada * porcentajeRpmAplicado) / 100), [baseComisionAplicada, porcentajeRpmAplicado])
  const terapeutaMonto           = useMemo(() => r2(baseComisionAplicada - rpmMonto), [baseComisionAplicada, rpmMonto])
  const comisionBalanceOk        = useMemo(() => Math.abs(r2(rpmMonto + terapeutaMonto) - baseComisionAplicada) < 0.01, [rpmMonto, terapeutaMonto, baseComisionAplicada])
  const tasaReferenciaComision   = useMemo(() => getTasaReferenciaFromState(pagoState), [pagoState])

  const comisionEq = useMemo(() => {
    if (!tasaReferenciaComision || tasaReferenciaComision <= 0)
      return { monto_base_usd: baseComisionAplicada, monto_base_bs: null, monto_rpm_usd: rpmMonto, monto_rpm_bs: null, monto_profesional_usd: terapeutaMonto, monto_profesional_bs: null }
    return {
      monto_base_usd: baseComisionAplicada, monto_base_bs: r2(baseComisionAplicada * tasaReferenciaComision),
      monto_rpm_usd: rpmMonto,             monto_rpm_bs:  r2(rpmMonto * tasaReferenciaComision),
      monto_profesional_usd: terapeutaMonto, monto_profesional_bs: r2(terapeutaMonto * tasaReferenciaComision),
    }
  }, [baseComisionAplicada, rpmMonto, terapeutaMonto, tasaReferenciaComision])

  // Agrupa slots por fecha para mostrar en la UI
  const slotsPorFecha = useMemo(() => {
    const map: Record<string, SlotHora[]> = {}
    for (const s of slots) {
      if (!map[s.fecha]) map[s.fecha] = []
      map[s.fecha].push(s)
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
  }, [slots])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Agenda</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Nueva cita</h1>
          <p className="mt-2 text-sm text-white/55">
            Crea una o varias citas de golpe — el pago y la comisión se aplican a cada una.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard title="Ver agenda"  description="Volver al listado general de citas." href="/admin/operaciones/agenda" />
          <ActionCard title="Cancelar"    description="Salir sin guardar cambios."          href="/admin/operaciones/agenda" />
        </div>
      </div>

      {error && (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      )}

      {/* ── Datos de la cita ── */}
      <Section title="Formulario de cita" description="Selecciona cliente, fisioterapeuta, servicio, horario, tipo y notas.">
        {loadingData ? (
          <Card className="p-6"><p className="text-sm text-white/55">Cargando formulario...</p></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">

            <Field label="Cliente">
              <ClienteSearch clientes={clientes} value={form.cliente_id}
                onChange={(id) => { setSlots([]); setForm((prev) => ({ ...prev, cliente_id: id, cliente_plan_id: '', hora_inicio: '', hora_fin: '' })) }} />
            </Field>

            <Field label="Fisioterapeuta">
              <select value={form.terapeuta_id}
                onChange={(e) => { setSlots([]); setForm({ ...form, terapeuta_id: e.target.value, hora_inicio: '', hora_fin: '' }) }}
                className={inputCls}>
                <option value="" className="bg-[#11131a] text-white">Seleccionar fisioterapeuta</option>
                {terapeutas.map((t) => <option key={t.id} value={t.id} className="bg-[#11131a] text-white">{t.nombre}</option>)}
              </select>
            </Field>

            <Field label="Servicio" helper={servicios.length === 0 ? 'No se encontraron servicios activos.' : `${servicios.length} servicio(s) disponible(s).`}>
              <select value={form.servicio_id}
                onChange={(e) => {
                  const srv = servicios.find((s) => s.id === e.target.value) || null
                  setSlots([])
                  setForm((prev) => ({ ...prev, servicio_id: e.target.value, hora_inicio: '', hora_fin: '' }))
                  if (srv?.precio && usarPrecioServicio) setMontoPersonalizado(String(srv.precio))
                }}
                className={inputCls}>
                <option value="" className="bg-[#11131a] text-white">Seleccionar servicio</option>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#11131a] text-white">
                    {s.nombre}{s.duracion_min ? ` · ${s.duracion_min} min` : ''}{s.precio ? ` · $${s.precio}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Recurso"
              helper={recursoSeleccionado
                ? `Capacidad: ${Number(recursoSeleccionado.capacidad || 1)} · Horario: ${formatHoraCorta(recursoSeleccionado.hora_inicio)} - ${formatHoraCorta(recursoSeleccionado.hora_fin)}`
                : 'Selecciona un recurso si la cita debe reservar cubículo/equipo.'}>
              <select value={form.recurso_id}
                onChange={(e) => { setSlots([]); setForm((prev) => ({ ...prev, recurso_id: e.target.value, hora_inicio: '', hora_fin: '' })) }}
                className={inputCls}>
                <option value="" className="bg-[#11131a] text-white">Sin recurso</option>
                {recursos.map((r) => <option key={r.id} value={r.id} className="bg-[#11131a] text-white">{r.nombre}{r.estado ? ` · ${r.estado}` : ''}{r.capacidad ? ` · cap. ${r.capacidad}` : ''}</option>)}
              </select>
            </Field>

            {/* Fecha — NO limpia los slots al cambiar */}
            <Field label="Fecha" helper="Cambia la fecha para agregar citas en días distintos. Los slots de otras fechas se conservan.">
              <input type="date" value={form.fecha}
                onChange={(e) => setForm((prev) => ({ ...prev, fecha: e.target.value, hora_inicio: '', hora_fin: '' }))}
                className={inputCls} />
            </Field>

            {/* Tipo de cita bloqueado internamente: siempre Recovery. No se muestra en UI. */}
            <input type="hidden" name="tipo_cita" value="recovery" readOnly />

            <Field label="Estado" helper="Solo la cita completada debe consumir sesión si está ligada a un plan.">
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className={inputCls}>
                <option value="programada"   className="bg-[#11131a] text-white">Programada</option>
                <option value="confirmada"   className="bg-[#11131a] text-white">Confirmada</option>
                <option value="reprogramada" className="bg-[#11131a] text-white">Reprogramada</option>
                <option value="completada"   className="bg-[#11131a] text-white">Completada</option>
                <option value="cancelada"    className="bg-[#11131a] text-white">Cancelada</option>
              </select>
            </Field>

            {/* Calendario — muestra disponibilidad para form.fecha */}
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

            {/* Panel de selección + acumulación */}
            <div className="md:col-span-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Horas seleccionadas para este lote</p>
                    <p className="mt-1 text-xs text-white/45">
                      Elige una hora en el calendario, presiona <strong className="text-white/70">Agregar al lote</strong>.
                      Cambia la fecha para agregar citas en otros días — el lote se conserva.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {form.hora_inicio && (
                      <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                        <span>Seleccionada: <strong>{form.fecha} {normHora(form.hora_inicio)}</strong></span>
                      </div>
                    )}
                    <button type="button" onClick={agregarSlot} disabled={!form.hora_inicio}
                      className="rounded-2xl border border-violet-400/30 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40">
                      + Agregar al lote
                    </button>
                    {slots.length > 0 && (
                      <button type="button" onClick={limpiarSlots}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/60 hover:bg-white/[0.06]">
                        Limpiar lote
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-white/40">Fecha activa</p>
                    <p className="mt-1 text-sm font-semibold text-white">{form.fecha || '—'}</p>
                  </div>
                  <div className={`rounded-2xl border p-3 transition ${slots.length > 0 ? 'border-violet-400/20 bg-violet-400/5' : 'border-white/10 bg-white/[0.03]'}`}>
                    <p className="text-[11px] uppercase tracking-wide text-white/40">Citas en lote</p>
                    <p className={`mt-1 text-sm font-semibold ${slots.length > 0 ? 'text-violet-300' : 'text-white'}`}>{slots.length}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[11px] uppercase tracking-wide text-white/40">Total estimado</p>
                    <p className="mt-1 text-sm font-semibold text-white">{formatMoney(r2(montoBase * (slots.length || 1)))}</p>
                  </div>
                </div>

                {/* Lista de slots confirmados agrupados por fecha */}
                {slots.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-white/35">
                    Sin horas en el lote todavía. Selecciona una en el calendario y presiona "Agregar al lote".
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {slotsPorFecha.map(([fecha, fechaSlots]) => (
                      <div key={fecha}>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-white/40">{fecha}</p>
                        <div className="flex flex-wrap gap-2">
                          {fechaSlots.map((slot) => (
                            <div key={`${slot.fecha}-${slot.hora_inicio}`} className="flex items-center gap-2 rounded-2xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-sm text-violet-100">
                              <span className="font-mono">{normHora(slot.hora_inicio)} – {normHora(slot.hora_fin)}</span>
                              <button type="button" onClick={() => quitarSlot(slot.fecha, slot.hora_inicio)} className="ml-1 text-violet-300/70 transition hover:text-white" title="Quitar">×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {slots.length > 0 && (
                  <p className="mt-3 text-xs text-white/35">
                    El pago, la deuda y la comisión se aplicarán a <strong className="text-white/60">cada cita</strong> del lote por separado.
                  </p>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <Field label="Notas">
                <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={4} className={`${inputCls} resize-none`} placeholder="Notas opcionales..." />
              </Field>
            </div>
          </div>
        )}
      </Section>

      {/* ── Pago ── */}
      <Section title="Pago" description="Registra el pago. Se aplica a cada cita del lote por separado.">
        <Card className="p-6">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Monto por cita (USD)" helper={usarPrecioServicio ? 'Usando precio del servicio.' : 'Monto personalizado.'}>
                <div className="flex gap-2">
                  <input type="number" min={0} step="0.01"
                    value={usarPrecioServicio ? (servicioSeleccionado?.precio ?? '') : montoPersonalizado}
                    readOnly={usarPrecioServicio}
                    onChange={(e) => setMontoPersonalizado(e.target.value)}
                    className={`${inputCls} ${usarPrecioServicio ? 'cursor-not-allowed opacity-60' : ''}`}
                    placeholder="0.00" />
                  <button type="button" onClick={() => setUsarPrecioServicio((p) => !p)}
                    className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white/60 hover:bg-white/[0.06]">
                    {usarPrecioServicio ? 'Editar' : 'Servicio'}
                  </button>
                </div>
              </Field>
              <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-xs text-white/45">Por cita: {formatMoney(montoBase)}</p>
                <p className="mt-1 text-base font-semibold text-white">
                  Lote total: {formatMoney(r2(montoBase * Math.max(totalCitas, 1)))}
                  {totalCitas > 1 && <span className="ml-2 text-xs font-normal text-white/45">({totalCitas} citas)</span>}
                </p>
              </div>
            </div>
            {montoBase > 0 ? (
              <>
                <div className="mb-4">
                  <Field label="Fecha del pago" helper="Para registrar pagos viejos sin cambiar la fecha de la cita.">
                    <input type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} className={inputCls} />
                  </Field>
                </div>
                <PagoConDeudaSelector
                  key={`nueva-cita-pago-${form.servicio_id}-${montoBase}-${montoTotalLote}-${totalCitas}-${fechaPago}-${usarPrecioServicio ? 'auto' : 'manual'}-${form.hora_inicio || 'sin-hora'}-${slots.length}`}
                  montoTotal={montoTotalLote}
                  fecha={fechaPago}
                  metodosPago={metodosPago}
                  value={pagoState}
                  onChange={setPagoState}
                  concepto={servicioSeleccionado?.nombre || 'Servicio'}
                  clienteNombre={clientes.find((c) => c.id === form.cliente_id)?.nombre || ''}
                  mostrarMontoTotal={false}
                />
              </>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm text-white/45">Selecciona un servicio para ver las opciones de pago.</p>
              </div>
            )}
          </div>
        </Card>
      </Section>

      {/* ── Comisión ── */}
      <Section title="Configuración de comisión" description="Los porcentajes vienen del servicio pero pueden editarse para esta cita.">
        <Card className="p-6">
          <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <p className="text-sm font-semibold uppercase tracking-wider text-white/40">Distribución de comisión</p>
              <button type="button" onClick={resetearComision} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/60 hover:bg-white/[0.06]">Restaurar comisión del servicio</button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field label="Precio (USD)" helper={usarPrecioServicio ? 'Tomando el precio del servicio.' : 'Precio editable solo para esta cita.'}>
                <div className="flex gap-2">
                  <input type="number" min={0} step="0.01"
                    value={usarPrecioServicio ? String(servicioSeleccionado?.precio ?? '') : montoPersonalizado}
                    readOnly={usarPrecioServicio} onChange={(e) => setMontoPersonalizado(e.target.value)}
                    className={`${inputCls} ${usarPrecioServicio ? 'cursor-not-allowed opacity-70' : ''}`} placeholder="0.00" />
                  <button type="button" onClick={() => setUsarPrecioServicio((p) => !p)} className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white/60 hover:bg-white/[0.06]">{usarPrecioServicio ? 'Editar' : 'Servicio'}</button>
                </div>
              </Field>
              <Field label="Base comisión" helper="Igual al monto cobrado.">
                <input type="number" value={String(baseComisionAplicada)} readOnly className={`${inputCls} cursor-not-allowed opacity-80`} />
              </Field>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-xs text-white/45">Regla</p>
                <p className="mt-2 text-sm text-white/75">Si cambias un porcentaje o monto, el otro se ajusta automáticamente.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-violet-400/15 bg-white/[0.03] p-4">
                <p className="mb-3 text-sm font-semibold text-violet-300">RPM</p>
                <Field label="Porcentaje RPM"><input type="number" min={0} max={100} step="0.01" value={porcentajeRpmAplicado} onChange={(e) => handleChangePctRpm(e.target.value)} className={inputCls} /></Field>
                <div className="mt-4"><Field label="Monto RPM"><input type="number" min={0} max={baseComisionAplicada} step="0.01" value={rpmMonto} onChange={(e) => handleChangeMontoRpm(e.target.value)} className={inputCls} /></Field></div>
              </div>
              <div className="rounded-2xl border border-emerald-400/15 bg-white/[0.03] p-4">
                <p className="mb-3 text-sm font-semibold text-emerald-300">Fisioterapeuta</p>
                <Field label="Porcentaje fisioterapeuta"><input type="number" min={0} max={100} step="0.01" value={porcentajeEntAplicado} onChange={(e) => handleChangePctEnt(e.target.value)} className={inputCls} /></Field>
                <div className="mt-4"><Field label="Monto fisioterapeuta"><input type="number" min={0} max={baseComisionAplicada} step="0.01" value={terapeutaMonto} onChange={(e) => handleChangeMontoEnt(e.target.value)} className={inputCls} /></Field></div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5">
                <p className="text-sm text-white/60">Base</p>
                <p className="mt-2 text-3xl font-bold text-white">{formatMoney(baseComisionAplicada)}</p>
                <p className="mt-2 text-xs text-white/40">Precio cobrado: {formatMoney(montoTotalLote)}</p>
              </div>
              <div className="rounded-[28px] border border-violet-400/15 bg-white/[0.05] p-5">
                <p className="text-sm text-white/60">RPM recibe</p>
                <p className="mt-2 text-3xl font-bold text-violet-400">{formatMoney(rpmMonto)}</p>
                <p className="mt-2 text-sm text-white/50">{porcentajeRpmAplicado}%</p>
              </div>
              <div className="rounded-[28px] border border-emerald-400/15 bg-white/[0.05] p-5">
                <p className="text-sm text-white/60">Fisioterapeuta recibe</p>
                <p className="mt-2 text-3xl font-bold text-emerald-400">{formatMoney(terapeutaMonto)}</p>
                <p className="mt-2 text-sm text-white/50">{porcentajeEntAplicado}%</p>
              </div>
            </div>
            {!comisionBalanceOk && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                <p className="text-sm text-rose-400">La suma de la comisión no coincide con la base.</p>
              </div>
            )}
            {comisionEq.monto_base_bs ? (
              <div className="grid gap-2 border-t border-white/10 pt-4 text-sm md:grid-cols-3">
                <div><span className="text-white/55">Base en Bs: </span><span className="text-white/75">{formatBs(comisionEq.monto_base_bs)}</span></div>
                <div><span className="text-white/55">RPM en Bs: </span><span className="text-white/75">{formatBs(comisionEq.monto_rpm_bs || 0)}</span></div>
                <div><span className="text-white/55">Fisioterapeuta en Bs: </span><span className="text-white/75">{formatBs(comisionEq.monto_profesional_bs || 0)}</span></div>
              </div>
            ) : null}
          </div>
        </Card>
      </Section>

      {/* ── Botones ── */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button type="button" onClick={guardar}
          disabled={
            loading || servicios.length === 0 ||
            (slots.length === 0 && !form.hora_inicio) ||
            !comisionBalanceOk || baseComisionAplicada <= 0
          }
          className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-60">
          {loading
            ? 'Guardando...'
            : totalCitas > 1
              ? `Guardar ${totalCitas} citas`
              : 'Guardar cita'}
        </button>
        <button type="button" onClick={() => router.push('/admin/operaciones/agenda')}
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]">
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