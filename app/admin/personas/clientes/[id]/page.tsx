'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  ChevronDown, ChevronRight, Calendar, CreditCard,
  ClipboardList, Activity, Clock, AlertCircle,
  CheckCircle2, XCircle, MinusCircle, RotateCcw,
  Pencil, ArrowLeft, ExternalLink,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type AuditorRef = { id: string; nombre: string | null } | null

type Cliente = {
  id: string; nombre: string; telefono: string | null; email: string | null
  estado: string; created_at: string; updated_at: string | null
  created_by: string | null; updated_by: string | null
  creado_por: AuditorRef; editado_por: AuditorRef
}

type Plan = {
  id: string; nombre: string; sesiones_totales: number
  vigencia_valor: number; vigencia_tipo: string
  precio: number; estado: string; descripcion: string | null
}

type ClientePlan = {
  id: string; cliente_id: string; plan_id: string
  sesiones_totales: number; sesiones_usadas: number
  fecha_inicio: string | null; fecha_fin: string | null
  estado: string; created_at: string; planes: Plan | null
}

type Pago = {
  id: string; fecha: string; concepto: string; categoria: string
  monto: number; monto_pago: number | null
  monto_equivalente_usd: number | null; monto_equivalente_bs: number | null
  moneda_pago: string | null; estado: string; tipo_origen: string
  notas: string | null; metodos_pago: { nombre: string } | null
}

type Cita = {
  id: string; fecha: string; hora_inicio: string; hora_fin: string
  estado: string; notas: string | null
  empleados: { nombre: string } | null; servicios: { nombre: string } | null
}

type EventoPlan = {
  id: string; cliente_plan_id: string; cliente_id: string
  tipo: string; detalle: string | null; created_at: string
}

type SesionPlan = {
  id: string; cliente_plan_id: string | null; cliente_id: string | null
  empleado_id: string | null; fecha: string | null
  hora_inicio: string | null; hora_fin: string | null
  estado: string | null; asistencia_estado: string | null
  aviso_previo: boolean | null; consume_sesion: boolean | null
  reprogramable: boolean | null; motivo_asistencia: string | null
  fecha_asistencia: string | null; reprogramado_de_entrenamiento_id: string | null
  empleados?: { nombre: string; rol?: string | null } | null
  clientes_planes?: {
    id: string; fecha_fin?: string | null; estado?: string | null
    planes?: { nombre?: string | null } | null
  } | null
}

type EstadoCuentaCliente = {
  cliente_id: string; total_facturado_usd?: number | null
  total_pagado_usd?: number | null; total_pendiente_usd?: number | null
  credito_disponible_usd?: number | null; saldo_pendiente_neto_usd?: number | null
  saldo_favor_neto_usd?: number | null
}

type AsistenciaEstado = 'pendiente' | 'asistio' | 'no_asistio_aviso' | 'no_asistio_sin_aviso'

type ReagendarForm = { fecha: string; hora_inicio: string; hora_fin: string; motivo: string }

type SesionesGrupoPlan = {
  plan: ClientePlan | null; planId: string; nombre: string; estado: string
  fechaInicio: string | null; fechaFin: string | null; operativo: boolean
  sesiones: SesionPlan[]
  resumen: { asistio: number; aviso: number; sinAviso: number; pendientes: number; reprogramables: number }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstOrNull<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : v ?? null
}

function money(value: number | string | null | undefined, moneda: string | null | undefined = 'USD') {
  const amount = Number(value || 0)
  if ((moneda || 'USD').toUpperCase() === 'BS')
    return `Bs ${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(amount)
}

function formatDate(v: string | null | undefined) {
  if (!v) return '—'
  try { return new Date(`${v}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return v }
}

function formatDateTime(v: string | null | undefined) {
  if (!v) return '—'
  try { return new Date(v).toLocaleString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return v }
}

function onlyHour(v: string | null | undefined) { return (v || '').slice(0, 5) }
function getTodayKey() { return new Date().toISOString().slice(0, 10) }
function normalizeTimeForDb(v: string) { const c = v.trim(); return c.length === 5 ? `${c}:00` : c || null }
function dateTimeMs(f: string, h: string) { return new Date(`${f}T${h || '00:00'}`).getTime() }
function getDurationMinutes(ini: string | null | undefined, fin: string | null | undefined) {
  const hi = onlyHour(ini); const hf = onlyHour(fin)
  if (!hi || !hf) return 60
  const d = dateTimeMs('2000-01-01', hf) - dateTimeMs('2000-01-01', hi)
  const m = Math.round(d / 60000); return m > 0 ? m : 60
}
function addMinutesToHour(h: string, m: number) {
  const base = new Date(`2000-01-01T${h || '00:00'}`)
  base.setMinutes(base.getMinutes() + m)
  return `${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`
}
function formatVigencia(v: number | null | undefined, t: string | null | undefined) {
  const n = Number(v || 0); const tipo = (t || '').toLowerCase()
  if (!n) return '—'
  if (tipo === 'dias') return `${n} día${n !== 1 ? 's' : ''}`
  if (tipo === 'semanas') return `${n} semana${n !== 1 ? 's' : ''}`
  if (tipo === 'meses') return `${n} me${n !== 1 ? 'ses' : 's'}`
  return `${n} ${t || ''}`.trim()
}

function getEstadoPlanEfectivo(
  estado: string | null | undefined, fechaFin: string | null | undefined,
  hoy = getTodayKey(), total?: number | null, usadas?: number | null
) {
  const e = (estado || '').toLowerCase()
  const t = Number(total || 0); const u = Number(usadas || 0)
  if (e === 'cancelado' || e === 'renovado') return e
  if (e === 'vencido' || (fechaFin && fechaFin < hoy)) return 'vencido'
  if (e === 'agotado' || (t > 0 && u >= t)) return 'agotado'
  if (e === 'activo') return 'activo'
  return e || 'sin_estado'
}

function isPlanOperativo(plan: ClientePlan | null | undefined, hoy = getTodayKey()) {
  if (!plan) return false
  return getEstadoPlanEfectivo(plan.estado, plan.fecha_fin, hoy, plan.sesiones_totales, plan.sesiones_usadas) === 'activo'
}

function isSesionDePlanOperativo(sesion: SesionPlan, activePlanIds: Set<string>) {
  if (!sesion.cliente_plan_id || !activePlanIds.has(sesion.cliente_plan_id)) return false
  const e = (sesion.clientes_planes?.estado || '').toLowerCase()
  if (e && e !== 'activo') return false
  const ff = sesion.clientes_planes?.fecha_fin || null
  return !(ff && ff < getTodayKey())
}

function canReagendarSesion(s: SesionPlan) {
  const a = (s.asistencia_estado || 'pendiente') as AsistenciaEstado
  return (a === 'pendiente' || (a === 'no_asistio_aviso' && s.reprogramable === true))
    && (s.estado || '').toLowerCase() !== 'completado'
}

function asistenciaToUpdate(nuevoEstado: AsistenciaEstado) {
  const consume = nuevoEstado === 'asistio' || nuevoEstado === 'no_asistio_sin_aviso'
  return {
    asistencia_estado: nuevoEstado,
    fecha_asistencia: nuevoEstado === 'pendiente' ? null : new Date().toISOString(),
    aviso_previo: nuevoEstado === 'no_asistio_aviso',
    consume_sesion: consume,
    reprogramable: nuevoEstado === 'no_asistio_aviso',
    estado: nuevoEstado === 'asistio' ? 'completado' : nuevoEstado === 'pendiente' ? 'programado' : 'no_asistio',
  }
}

function calcularResumenSesiones(lista: SesionPlan[]) {
  return {
    asistio: lista.filter((s) => s.asistencia_estado === 'asistio').length,
    aviso: lista.filter((s) => s.asistencia_estado === 'no_asistio_aviso').length,
    sinAviso: lista.filter((s) => s.asistencia_estado === 'no_asistio_sin_aviso').length,
    pendientes: lista.filter((s) => (s.asistencia_estado || 'pendiente') === 'pendiente').length,
    reprogramables: lista.filter((s) => s.reprogramable === true).length,
  }
}

// ─── Micro-componentes ────────────────────────────────────────────────────────

function Pill({ children, color = 'default' }: { children: React.ReactNode; color?: 'default' | 'green' | 'amber' | 'rose' | 'violet' | 'sky' | 'dim' }) {
  const map = {
    default: 'border-white/10 bg-white/[0.05] text-white/60',
    green:   'border-emerald-400/25 bg-emerald-400/10 text-emerald-300',
    amber:   'border-amber-400/25 bg-amber-400/10 text-amber-300',
    rose:    'border-rose-400/25 bg-rose-400/10 text-rose-300',
    violet:  'border-violet-400/25 bg-violet-400/10 text-violet-300',
    sky:     'border-sky-400/25 bg-sky-400/10 text-sky-300',
    dim:     'border-white/[0.06] bg-white/[0.03] text-white/35',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[color]}`}>
      {children}
    </span>
  )
}

function planEstadoPill(estado: string) {
  const e = (estado || '').toLowerCase()
  if (e === 'activo') return <Pill color="green">Activo</Pill>
  if (e === 'agotado') return <Pill color="amber">Agotado</Pill>
  if (e === 'vencido') return <Pill color="dim">Vencido</Pill>
  if (e === 'renovado') return <Pill color="violet">Renovado</Pill>
  if (e === 'cancelado') return <Pill color="rose">Cancelado</Pill>
  return <Pill>{estado || '—'}</Pill>
}

function asistenciaPill(estado: string | null | undefined) {
  const e = (estado || 'pendiente').toLowerCase()
  if (e === 'asistio') return <Pill color="green">Asistió</Pill>
  if (e === 'no_asistio_aviso') return <Pill color="amber">Avisó</Pill>
  if (e === 'no_asistio_sin_aviso') return <Pill color="rose">Sin aviso</Pill>
  return <Pill color="dim">Pendiente</Pill>
}

function SectionBlock({ title, icon: Icon, children, defaultOpen = true, badge }: {
  title: string; icon?: any; children: React.ReactNode; defaultOpen?: boolean; badge?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.015]">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-white/[0.025]"
      >
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-white/30" />}
          <span className="text-sm font-semibold text-white">{title}</span>
          {badge}
        </div>
        <ChevronDown className={`h-4 w-4 text-white/25 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-white/[0.05]">{children}</div>}
    </div>
  )
}

function InfoRow({ label, value, valueClass = '' }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="shrink-0 text-[11px] text-white/35 pt-0.5">{label}</span>
      <span className={`text-right text-[13px] font-medium text-white/80 ${valueClass}`}>{value}</span>
    </div>
  )
}

function Divider() { return <div className="h-px bg-white/[0.05]" /> }

function StatTile({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums tracking-tight ${accent || 'text-white'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-white/30">{sub}</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClienteDetallePage() {
  const params = useParams()
  const clienteId = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [loading, setLoading] = useState(true)
  const [loadingExtras, setLoadingExtras] = useState(true)
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [historialPlanes, setHistorialPlanes] = useState<ClientePlan[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [citas, setCitas] = useState<Cita[]>([])
  const [eventosPlan, setEventosPlan] = useState<EventoPlan[]>([])
  const [sesionesPlan, setSesionesPlan] = useState<SesionPlan[]>([])
  const [estadoCuenta, setEstadoCuenta] = useState<EstadoCuentaCliente | null>(null)

  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'warn' } | null>(null)

  const [sesionesPlanesAbiertos, setSesionesPlanesAbiertos] = useState<Record<string, boolean>>({})
  const [sesionReagendar, setSesionReagendar] = useState<SesionPlan | null>(null)
  const [reagendarForm, setReagendarForm] = useState<ReagendarForm>({ fecha: '', hora_inicio: '', hora_fin: '', motivo: '' })
  const [guardandoReagenda, setGuardandoReagenda] = useState(false)
  const [errorReagenda, setErrorReagenda] = useState('')
  const [actualizandoAsistenciaId, setActualizandoAsistenciaId] = useState<string | null>(null)

  useEffect(() => { if (clienteId) void loadClienteBase(clienteId) }, [clienteId])

  function showToast(msg: string, type: 'ok' | 'warn' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  async function sincronizarPlanesVencidos() {
    try { await supabase.rpc('actualizar_planes_vencidos') } catch { /* silent */ }
  }

  async function loadClienteBase(id: string) {
    setLoading(true); setLoadingExtras(true); setError(''); setWarning('')
    setCliente(null); setHistorialPlanes([]); setPagos([]); setCitas([])
    setEventosPlan([]); setSesionesPlan([]); setSesionesPlanesAbiertos({}); setEstadoCuenta(null)
    try {
      await sincronizarPlanesVencidos()
      const res = await supabase.from('clientes').select(`
        id, nombre, telefono, email, estado, created_at, updated_at, created_by, updated_by,
        creado_por:created_by (id, nombre), editado_por:updated_by (id, nombre)
      `).eq('id', id).single()
      if (res.error) throw new Error(res.error.message)
      setCliente(res.data as unknown as Cliente)
      setLoading(false)
      void loadClienteExtras(id)
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar el cliente.')
      setLoading(false); setLoadingExtras(false)
    }
  }

  async function loadClienteExtras(id: string) {
    const hoy = getTodayKey()
    const warns: string[] = []

    const runQuery = async (fn: () => Promise<void>, label: string) => {
      try { await fn() } catch { warns.push(label) }
    }

    await runQuery(async () => {
      const r = await supabase.from('clientes_planes').select(`
        id, cliente_id, plan_id, sesiones_totales, sesiones_usadas,
        fecha_inicio, fecha_fin, estado, created_at,
        planes:plan_id (id, nombre, sesiones_totales, vigencia_valor, vigencia_tipo, precio, estado, descripcion)
      `).eq('cliente_id', id).order('created_at', { ascending: false })
      if (r.error) throw r.error
      setHistorialPlanes((r.data || []) as unknown as ClientePlan[])
    }, 'Planes')

    await runQuery(async () => {
      const r = await supabase.from('pagos').select(`
        id, fecha, concepto, categoria, monto, monto_pago,
        monto_equivalente_usd, monto_equivalente_bs, moneda_pago, estado, tipo_origen, notas,
        metodos_pago:metodo_pago_id (nombre)
      `).eq('cliente_id', id).order('created_at', { ascending: false }).limit(20)
      if (r.error) throw r.error
      setPagos((r.data || []) as unknown as Pago[])
    }, 'Pagos')

    await runQuery(async () => {
      const r = await supabase.from('citas').select(`
        id, fecha, hora_inicio, hora_fin, estado, notas,
        empleados:terapeuta_id (nombre), servicios:servicio_id (nombre)
      `).eq('cliente_id', id).gte('fecha', hoy).order('fecha', { ascending: true }).order('hora_inicio', { ascending: true }).limit(10)
      if (r.error) throw r.error
      setCitas((r.data || []) as unknown as Cita[])
    }, 'Citas')

    await runQuery(async () => {
      const r = await supabase.from('clientes_planes_eventos').select('id, cliente_plan_id, cliente_id, tipo, detalle, created_at')
        .eq('cliente_id', id).order('created_at', { ascending: false }).limit(20)
      if (r.error) throw r.error
      setEventosPlan((r.data || []) as EventoPlan[])
    }, 'Eventos')

    await runQuery(async () => {
      const r = await supabase.from('entrenamientos').select(`
        id, cliente_plan_id, cliente_id, empleado_id, fecha, hora_inicio, hora_fin,
        estado, asistencia_estado, aviso_previo, consume_sesion, reprogramable,
        motivo_asistencia, fecha_asistencia, reprogramado_de_entrenamiento_id,
        empleados:empleado_id (nombre, rol),
        clientes_planes:cliente_plan_id (id, fecha_fin, estado, planes:plan_id (nombre))
      `).eq('cliente_id', id).not('cliente_plan_id', 'is', null).neq('estado', 'cancelado')
        .order('fecha', { ascending: false }).order('hora_inicio', { ascending: false }).limit(50)
      if (r.error) throw r.error
      const norm = ((r.data || []) as any[]).map((row) => ({
        ...row,
        empleados: firstOrNull(row?.empleados),
        clientes_planes: firstOrNull(row?.clientes_planes)
          ? { ...firstOrNull(row?.clientes_planes), planes: firstOrNull(firstOrNull(row?.clientes_planes)?.planes) }
          : null,
      })).filter((row) => (row.clientes_planes?.estado || '').toLowerCase() !== 'cancelado')
      setSesionesPlan(norm as SesionPlan[])
    }, 'Sesiones')

    await runQuery(async () => {
      const r = await supabase.from('v_clientes_estado_cuenta').select(
        'cliente_id, total_facturado_usd, total_pagado_usd, total_pendiente_usd, credito_disponible_usd, saldo_pendiente_neto_usd, saldo_favor_neto_usd'
      ).eq('cliente_id', id).maybeSingle()
      if (r.error) throw r.error
      setEstadoCuenta((r.data || null) as EstadoCuentaCliente | null)
    }, 'Estado de cuenta')

    if (warns.length > 0) setWarning(warns.join(', ') + ': no cargaron completamente')
    setLoadingExtras(false)
  }

  function ajustarUsoPlanLocal(clientePlanId: string | null | undefined, delta: number) {
    if (!clientePlanId || delta === 0) return
    setHistorialPlanes((prev) => prev.map((p) => {
      if (p.id !== clientePlanId) return p
      const t = Number(p.sesiones_totales || 0)
      const u = Math.min(t, Math.max(0, Number(p.sesiones_usadas || 0) + delta))
      return { ...p, sesiones_usadas: u }
    }))
  }

  async function actualizarAsistenciaSesion(sesionId: string, nuevoEstado: AsistenciaEstado) {
    setActualizandoAsistenciaId(sesionId)
    const hoy = getTodayKey()
    const activePlanIds = new Set(historialPlanes.filter((p) => isPlanOperativo(p, hoy)).map((p) => p.id))
    const sesionActual = sesionesPlan.find((s) => s.id === sesionId) || null
    if (!sesionActual || !isSesionDePlanOperativo(sesionActual, activePlanIds)) {
      showToast('Sesión bloqueada: pertenece a un plan no vigente.', 'warn')
      setActualizandoAsistenciaId(null); return
    }
    const update = asistenciaToUpdate(nuevoEstado)
    const delta = update.consume_sesion === sesionActual.consume_sesion ? 0 : update.consume_sesion ? 1 : -1
    try {
      const { error } = await supabase.rpc('marcar_asistencia_entrenamiento', {
        p_entrenamiento_id: sesionId, p_asistencia_estado: nuevoEstado, p_motivo: null, p_marcado_por: null,
      })
      if (error) throw new Error(error.message)
      setSesionesPlan((prev) => prev.map((s) => s.id === sesionId ? { ...s, ...update } : s))
      ajustarUsoPlanLocal(sesionActual.cliente_plan_id, delta)
      showToast(nuevoEstado === 'asistio' ? 'Asistencia marcada ✓' : nuevoEstado === 'no_asistio_aviso' ? 'Sesión congelada — disponible para reagendar' : 'Estado actualizado')
    } catch (err: any) {
      showToast(err?.message || 'No se pudo actualizar.', 'warn')
    } finally { setActualizandoAsistenciaId(null) }
  }

  function abrirReagendarSesion(sesion: SesionPlan) {
    const inicio = onlyHour(sesion.hora_inicio) || '08:00'
    const dur = getDurationMinutes(sesion.hora_inicio, sesion.hora_fin)
    const fin = onlyHour(sesion.hora_fin) || addMinutesToHour(inicio, dur)
    setErrorReagenda(''); setSesionReagendar(sesion)
    setReagendarForm({ fecha: sesion.fecha || getTodayKey(), hora_inicio: inicio, hora_fin: fin, motivo: '' })
  }

  async function guardarReagendaSesion() {
    if (!sesionReagendar) return
    const { fecha, hora_inicio, hora_fin, motivo } = reagendarForm
    if (!fecha) { setErrorReagenda('Selecciona la nueva fecha.'); return }
    if (!hora_inicio || !hora_fin) { setErrorReagenda('Completa las horas.'); return }
    if (dateTimeMs(fecha, hora_fin) <= dateTimeMs(fecha, hora_inicio)) { setErrorReagenda('La hora fin debe ser mayor al inicio.'); return }
    const asistenciaActual = (sesionReagendar.asistencia_estado || 'pendiente').toLowerCase()
    const ff = sesionReagendar.clientes_planes?.fecha_fin || null
    if (ff && fecha > ff && asistenciaActual !== 'no_asistio_aviso') {
      setErrorReagenda(`Solo sesiones en "Avisó" pueden reagendarse después del vencimiento (${ff}).`); return
    }
    setGuardandoReagenda(true); setErrorReagenda('')
    const nota = `Reagendada desde ${sesionReagendar.fecha} ${onlyHour(sesionReagendar.hora_inicio)}-${onlyHour(sesionReagendar.hora_fin)} → ${fecha} ${hora_inicio}-${hora_fin}${motivo ? `. ${motivo}` : ''}`
    try {
      const rpc = await supabase.rpc('reprogramar_entrenamiento_plan_seguro', {
        p_entrenamiento_id: sesionReagendar.id, p_nueva_fecha: fecha,
        p_nueva_hora_inicio: normalizeTimeForDb(hora_inicio), p_nueva_hora_fin: normalizeTimeForDb(hora_fin),
        p_motivo: nota, p_marcado_por: null,
      })
      if (rpc.error) throw new Error(rpc.error.message)
      const rpcData = rpc.data as { ok?: boolean; error?: string; extendio_plan?: boolean } | null
      if (rpcData?.ok === false) throw new Error(rpcData.error || 'No se pudo reagendar.')

      const upd = await supabase.from('entrenamientos').select(`
        id, cliente_plan_id, cliente_id, empleado_id, fecha, hora_inicio, hora_fin,
        estado, asistencia_estado, aviso_previo, consume_sesion, reprogramable,
        motivo_asistencia, fecha_asistencia, reprogramado_de_entrenamiento_id,
        empleados:empleado_id (nombre, rol),
        clientes_planes:cliente_plan_id (id, fecha_fin, estado, planes:plan_id (nombre))
      `).eq('id', sesionReagendar.id).single()
      if (upd.error) throw new Error(upd.error.message)

      if (sesionReagendar.consume_sesion) ajustarUsoPlanLocal(sesionReagendar.cliente_plan_id, -1)
      const row: any = upd.data
      const norm: SesionPlan = {
        ...row, empleados: firstOrNull(row?.empleados),
        clientes_planes: firstOrNull(row?.clientes_planes)
          ? { ...firstOrNull(row?.clientes_planes), planes: firstOrNull(firstOrNull(row?.clientes_planes)?.planes) } : null,
      }
      setSesionesPlan((prev) => prev.map((s) => s.id === norm.id ? norm : s))
      showToast(rpcData?.extendio_plan ? 'Reagendado y plan extendido ✓' : 'Sesión reagendada ✓')
      setSesionReagendar(null)
    } catch (err: any) {
      setErrorReagenda(err?.message || 'No se pudo reagendar.')
    } finally { setGuardandoReagenda(false) }
  }

  // ── Memos ──

  const hoyKey = useMemo(() => getTodayKey(), [])

  const planesActivosOperativos = useMemo(
    () => historialPlanes.filter((p) => isPlanOperativo(p, hoyKey)), [historialPlanes, hoyKey]
  )
  const activePlanIds = useMemo(
    () => new Set(planesActivosOperativos.map((p) => p.id)), [planesActivosOperativos]
  )
  const planActivo = useMemo(() => {
    if (!planesActivosOperativos.length) return null
    return [...planesActivosOperativos].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null
  }, [planesActivosOperativos])

  const sesionesActivasPlan = useMemo(
    () => sesionesPlan.filter((s) => isSesionDePlanOperativo(s, activePlanIds)), [sesionesPlan, activePlanIds]
  )
  const resumenAsistencia = useMemo(() => calcularResumenSesiones(sesionesActivasPlan), [sesionesActivasPlan])

  const sesionesAgrupadas = useMemo<SesionesGrupoPlan[]>(() => {
    const planesMap = new Map(historialPlanes.map((p) => [p.id, p]))
    const grupos = new Map<string, SesionesGrupoPlan>()
    sesionesPlan.forEach((sesion) => {
      const planId = sesion.cliente_plan_id || 'sin-plan'
      const plan = planesMap.get(planId) || null
      const ff = plan?.fecha_fin || sesion.clientes_planes?.fecha_fin || null
      const estado = getEstadoPlanEfectivo(plan?.estado || sesion.clientes_planes?.estado, ff, hoyKey, plan?.sesiones_totales, plan?.sesiones_usadas)
      const nombre = plan?.planes?.nombre || sesion.clientes_planes?.planes?.nombre || 'Sin plan asociado'
      const operativo = !!plan && isPlanOperativo(plan, hoyKey)
      if (!grupos.has(planId)) grupos.set(planId, { plan, planId, nombre, estado, fechaInicio: plan?.fecha_inicio || null, fechaFin: ff, operativo, sesiones: [], resumen: calcularResumenSesiones([]) })
      grupos.get(planId)!.sesiones.push(sesion)
    })
    return Array.from(grupos.values()).map((g) => {
      const sorted = [...g.sesiones].sort((a, b) => `${b.fecha} ${b.hora_inicio}`.localeCompare(`${a.fecha} ${a.hora_inicio}`))
      return { ...g, sesiones: sorted, resumen: calcularResumenSesiones(sorted) }
    }).sort((a, b) => { if (a.operativo !== b.operativo) return a.operativo ? -1 : 1; return (b.plan?.created_at || '').localeCompare(a.plan?.created_at || '') })
  }, [sesionesPlan, historialPlanes, hoyKey])

  const resumenPagos = useMemo(() => {
    const pagados = pagos.filter((p) => p.estado?.toLowerCase() === 'pagado')
    const bs = pagados.every((p) => (p.moneda_pago || '').toUpperCase() === 'BS')
    return {
      total: pagados.reduce((acc, p) => acc + Number(bs ? (p.monto_equivalente_bs || 0) : (p.monto_equivalente_usd || 0)), 0),
      moneda: bs ? 'BS' : 'USD' as 'BS' | 'USD',
      cantidad: pagados.length,
    }
  }, [pagos])

  const pendiente = Number(estadoCuenta?.saldo_pendiente_neto_usd || 0)
  const credito   = Number(estadoCuenta?.saldo_favor_neto_usd    || 0)

  // ── Loading / Error ──

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-violet-400" />
          <p className="text-sm text-white/40">Cargando cliente…</p>
        </div>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-rose-400">{error || 'Cliente no encontrado.'}</p>
        <Link href="/admin/personas/clientes" className="mt-4 inline-flex items-center gap-2 text-sm text-white/40 underline">
          <ArrowLeft className="h-4 w-4" /> Volver a clientes
        </Link>
      </div>
    )
  }

  // ── Render ──

  return (
    <div className="min-h-screen space-y-0 pb-20">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed right-4 top-4 z-50 max-w-xs rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-sm ${
          toast.type === 'ok'
            ? 'border-emerald-400/25 bg-emerald-950/80 text-emerald-300'
            : 'border-amber-400/25 bg-amber-950/80 text-amber-300'
        }`}>
          <p className="text-sm font-medium">{toast.msg}</p>
        </div>
      )}

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden border-b border-white/[0.06] bg-white/[0.01] px-4 pb-6 pt-6 md:px-8">
        {/* fondo decorativo */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-violet-500/[0.06] blur-3xl" />
          <div className="absolute -left-16 bottom-0 h-48 w-64 rounded-full bg-fuchsia-500/[0.04] blur-3xl" />
        </div>

        <div className="relative">
          {/* breadcrumb */}
          <div className="mb-4 flex items-center gap-2 text-[11px] text-white/30">
            <Link href="/admin/personas/clientes" className="hover:text-white/60 transition">Clientes</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-white/50">{cliente.nombre}</span>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              {/* dot + nombre */}
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${planActivo ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-white/20'}`} />
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{cliente.nombre}</h1>
              </div>
              {/* meta row */}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-5">
                {cliente.email    && <span className="text-sm text-white/40">{cliente.email}</span>}
                {cliente.telefono && <span className="text-sm text-white/40">{cliente.telefono}</span>}
                <span className={`text-sm ${planActivo ? 'text-emerald-400/80' : 'text-white/30'}`}>
                  {planActivo ? `Plan activo · ${Math.max(0, planActivo.sesiones_totales - planActivo.sesiones_usadas)} sesiones restantes` : 'Sin plan activo'}
                </span>
              </div>
            </div>

            {/* acciones rápidas */}
            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/personas/clientes/${cliente.id}/editar`}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.06]">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Link>
              <Link href={`/admin/personas/clientes/${cliente.id}/plan`}
                className="flex items-center gap-1.5 rounded-xl border border-violet-400/25 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-400/15">
                <ClipboardList className="h-3.5 w-3.5" /> Gestionar plan
              </Link>
              <Link href={`/admin/finanzas/ingresos?cliente=${cliente.id}`}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.06]">
                <CreditCard className="h-3.5 w-3.5" /> Ingresos
              </Link>
            </div>
          </div>

          {/* Alertas */}
          {warning && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
              <p className="text-[11px] text-amber-200/70">{warning}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex flex-col gap-4 px-4 pt-5 md:px-8 xl:flex-row xl:items-start xl:gap-6">

        {/* ════ LEFT — contenido principal ════ */}
        <div className="min-w-0 flex-1 space-y-4">

          {/* Tiles de métricas */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            <StatTile
              label="Plan activo"
              value={planActivo ? (planActivo.planes?.nombre?.slice(0, 16) || 'Plan') : '—'}
              sub={planActivo ? getEstadoPlanEfectivo(planActivo.estado, planActivo.fecha_fin, hoyKey, planActivo.sesiones_totales, planActivo.sesiones_usadas).toUpperCase() : 'SIN PLAN'}
              accent={planActivo ? 'text-violet-300' : 'text-white/30'}
            />
            <StatTile label="Sesiones restantes" value={planActivo ? Math.max(0, planActivo.sesiones_totales - planActivo.sesiones_usadas) : '—'} accent="text-white" />
            <StatTile label="Asistió" value={resumenAsistencia.asistio} accent="text-emerald-400" />
            <StatTile label="Pendientes" value={resumenAsistencia.pendientes} accent={resumenAsistencia.pendientes > 0 ? 'text-amber-400' : 'text-white/40'} />
            <StatTile label="Próx. citas" value={citas.length} />
          </div>

          {/* ── Sesiones y asistencia ── */}
          <SectionBlock
            title="Sesiones y asistencia"
            icon={Activity}
            badge={
              resumenAsistencia.pendientes > 0
                ? <span className="ml-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">{resumenAsistencia.pendientes} pendientes</span>
                : undefined
            }
          >
            {loadingExtras ? (
              <p className="px-5 py-4 text-sm text-white/35">Cargando…</p>
            ) : sesionesAgrupadas.length === 0 ? (
              <p className="px-5 py-4 text-sm text-white/35">No hay sesiones registradas.</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {sesionesAgrupadas.map((grupo) => {
                  const abierto = sesionesPlanesAbiertos[grupo.planId] ?? grupo.operativo
                  return (
                    <div key={grupo.planId}>
                      {/* header grupo */}
                      <button
                        type="button"
                        onClick={() => setSesionesPlanesAbiertos((p) => ({ ...p, [grupo.planId]: !abierto }))}
                        className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-white/[0.02]"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${grupo.operativo ? 'bg-emerald-400' : 'bg-white/15'}`} />
                          <span className="truncate text-[13px] font-semibold text-white">{grupo.nombre}</span>
                          {planEstadoPill(grupo.estado)}
                          {!grupo.operativo && <Pill color="dim">Historial</Pill>}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="hidden text-[11px] text-white/30 sm:block">
                            {grupo.resumen.asistio}✓ · {grupo.resumen.pendientes} pend. · vence {formatDate(grupo.fechaFin)}
                          </span>
                          <ChevronDown className={`h-3.5 w-3.5 text-white/25 transition-transform ${abierto ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {/* sesiones del grupo */}
                      {abierto && (
                        <div className="divide-y divide-white/[0.04] bg-black/10">
                          {grupo.sesiones.map((sesion) => {
                            const asistenciaActual = (sesion.asistencia_estado || 'pendiente') as AsistenciaEstado
                            const operativa = grupo.operativo && isSesionDePlanOperativo(sesion, activePlanIds)
                            const puedeReagendar = operativa && canReagendarSesion(sesion)
                            const actualizando = actualizandoAsistenciaId === sesion.id

                            return (
                              <div key={sesion.id} className="flex items-start gap-3 px-5 py-3">
                                {/* dot asistencia */}
                                <div className="mt-1 flex flex-col items-center gap-1">
                                  <span className={`h-1.5 w-1.5 rounded-full ${
                                    asistenciaActual === 'asistio' ? 'bg-emerald-400'
                                    : asistenciaActual === 'no_asistio_aviso' ? 'bg-amber-400'
                                    : asistenciaActual === 'no_asistio_sin_aviso' ? 'bg-rose-400'
                                    : 'bg-white/20'
                                  }`} />
                                </div>

                                <div className="min-w-0 flex-1">
                                  {/* fecha + hora */}
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[13px] font-medium text-white/80">{formatDate(sesion.fecha)}</span>
                                    <span className="text-[11px] text-white/35">{onlyHour(sesion.hora_inicio)}–{onlyHour(sesion.hora_fin)}</span>
                                    {asistenciaPill(asistenciaActual)}
                                    {sesion.reprogramable && <Pill color="violet">Reprog.</Pill>}
                                  </div>

                                  {/* sub-info */}
                                  <p className="mt-0.5 text-[11px] text-white/30">
                                    {sesion.empleados?.nombre || 'Sin terapeuta'}
                                    {sesion.consume_sesion ? ' · consume sesión' : ''}
                                  </p>

                                  {/* botones asistencia — solo si operativa */}
                                  {operativa && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      {([
                                        ['asistio',             'Asistió',   'border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15'],
                                        ['no_asistio_aviso',    'Avisó',     'border-amber-400/20 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15'],
                                        ['no_asistio_sin_aviso','Sin aviso', 'border-rose-400/20 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15'],
                                        ['pendiente',           'Pendiente', 'border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]'],
                                      ] as [AsistenciaEstado, string, string][]).map(([estado, label, cls]) => (
                                        <button key={estado} type="button"
                                          disabled={actualizando || asistenciaActual === estado}
                                          onClick={() => actualizarAsistenciaSesion(sesion.id, estado)}
                                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${cls} ${asistenciaActual === estado ? 'ring-1 ring-white/20' : ''}`}>
                                          {label}
                                        </button>
                                      ))}
                                      {puedeReagendar && (
                                        <button type="button" onClick={() => abrirReagendarSesion(sesion)}
                                          className="rounded-lg border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[11px] font-semibold text-violet-300 transition hover:bg-violet-400/15">
                                          Reagendar
                                        </button>
                                      )}
                                    </div>
                                  )}
                                  {!operativa && (
                                    <p className="mt-1 text-[11px] text-white/25">Bloqueada — plan no vigente</p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </SectionBlock>

          {/* ── Historial de planes ── */}
          <SectionBlock title="Historial de planes" icon={ClipboardList} defaultOpen={false}
            badge={historialPlanes.length > 0 ? <Pill color="dim">{historialPlanes.length}</Pill> : undefined}>
            {loadingExtras ? (
              <p className="px-5 py-4 text-sm text-white/35">Cargando…</p>
            ) : historialPlanes.length === 0 ? (
              <p className="px-5 py-4 text-sm text-white/35">Sin planes registrados.</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {historialPlanes.map((item) => {
                  const estadoEfectivo = getEstadoPlanEfectivo(item.estado, item.fecha_fin, hoyKey, item.sesiones_totales, item.sesiones_usadas)
                  const restantes = Math.max(0, Number(item.sesiones_totales || 0) - Number(item.sesiones_usadas || 0))
                  const pct = item.sesiones_totales > 0 ? Math.min(100, (item.sesiones_usadas / item.sesiones_totales) * 100) : 0
                  return (
                    <div key={item.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white">{item.planes?.nombre || 'Plan'}</p>
                          <p className="mt-0.5 text-[11px] text-white/35">
                            {formatDate(item.fecha_inicio)} → {formatDate(item.fecha_fin)} · {formatVigencia(item.planes?.vigencia_valor, item.planes?.vigencia_tipo)} · {money(item.planes?.precio, 'USD')}
                          </p>
                        </div>
                        {planEstadoPill(estadoEfectivo)}
                      </div>
                      {/* barra progreso */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[10px] text-white/35">
                          <span>{item.sesiones_usadas}/{item.sesiones_totales} sesiones usadas</span>
                          <span>{restantes} restantes</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <div className={`h-full rounded-full ${estadoEfectivo === 'agotado' ? 'bg-amber-400/70' : 'bg-violet-400/60'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionBlock>

          {/* ── Pagos ── */}
          <SectionBlock title="Pagos" icon={CreditCard} defaultOpen={false}
            badge={pagos.length > 0 ? <Pill color="dim">{pagos.length}</Pill> : undefined}>
            {loadingExtras ? (
              <p className="px-5 py-4 text-sm text-white/35">Cargando…</p>
            ) : pagos.length === 0 ? (
              <p className="px-5 py-4 text-sm text-white/35">Sin pagos registrados.</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {pagos.map((pago) => {
                  const esBS = (pago.moneda_pago || '').toUpperCase() === 'BS'
                  const monto = money(esBS ? pago.monto_equivalente_bs : pago.monto_equivalente_usd, pago.moneda_pago || 'USD')
                  return (
                    <div key={pago.id} className="flex items-start gap-4 px-5 py-3.5">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
                        {pago.estado === 'pagado'
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/70" />
                          : pago.estado === 'anulado'
                          ? <XCircle className="h-3.5 w-3.5 text-rose-400/70" />
                          : <Clock className="h-3.5 w-3.5 text-amber-400/70" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-white/85">{pago.concepto || 'Sin concepto'}</p>
                        <p className="mt-0.5 text-[11px] text-white/35">{pago.fecha} · {pago.metodos_pago?.nombre || '—'} · {pago.categoria}</p>
                        {pago.notas && <p className="mt-1 text-[11px] text-white/30 line-clamp-1">{pago.notas}</p>}
                      </div>
                      <p className={`shrink-0 text-sm font-semibold ${pago.estado === 'pagado' ? 'text-emerald-400' : 'text-white/40'}`}>{monto}</p>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="px-5 py-3 border-t border-white/[0.05]">
              <Link href={`/admin/finanzas/ingresos?cliente=${cliente.id}`}
                className="flex items-center gap-1.5 text-[11px] text-white/35 transition hover:text-white/60">
                <ExternalLink className="h-3 w-3" /> Ver todos los ingresos
              </Link>
            </div>
          </SectionBlock>

          {/* ── Citas próximas ── */}
          {citas.length > 0 && (
            <SectionBlock title="Próximas citas" icon={Calendar}
              badge={<Pill color="sky">{citas.length}</Pill>}>
              <div className="divide-y divide-white/[0.05]">
                {citas.map((cita) => (
                  <div key={cita.id} className="flex items-start gap-4 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium text-white/85">{cita.servicios?.nombre || 'Servicio'}</span>
                        {cita.estado === 'confirmada' ? <Pill color="sky">Confirmada</Pill>
                          : cita.estado === 'completada' ? <Pill color="green">Completada</Pill>
                          : cita.estado === 'cancelada' ? <Pill color="rose">Cancelada</Pill>
                          : <Pill>{cita.estado}</Pill>}
                      </div>
                      <p className="mt-0.5 text-[11px] text-white/35">
                        {formatDate(cita.fecha)} · {onlyHour(cita.hora_inicio)}–{onlyHour(cita.hora_fin)} · {cita.empleados?.nombre || 'Sin terapeuta'}
                      </p>
                      {cita.notas && <p className="mt-1 text-[11px] text-white/30 line-clamp-1">{cita.notas}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </SectionBlock>
          )}

          {/* ── Eventos del plan ── */}
          {eventosPlan.length > 0 && (
            <SectionBlock title="Eventos del plan" icon={RotateCcw} defaultOpen={false}
              badge={<Pill color="dim">{eventosPlan.length}</Pill>}>
              <div className="divide-y divide-white/[0.05]">
                {eventosPlan.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {ev.tipo === 'asignado' ? <Pill color="sky">Asignado</Pill>
                          : ev.tipo === 'renovado' ? <Pill color="violet">Renovado</Pill>
                          : ev.tipo === 'cancelado' ? <Pill color="rose">Cancelado</Pill>
                          : ev.tipo === 'agotado' ? <Pill color="amber">Agotado</Pill>
                          : <Pill color="dim">{ev.tipo}</Pill>}
                        <span className="text-[11px] text-white/30">{formatDateTime(ev.created_at)}</span>
                      </div>
                      {ev.detalle && <p className="mt-1 text-[11px] text-white/50">{ev.detalle}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </SectionBlock>
          )}

        </div>

        {/* ════ RIGHT — sidebar fijo ════ */}
        <div className="w-full shrink-0 space-y-4 xl:w-72">

          {/* ── Resumen financiero ── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
              <p className="text-sm font-semibold text-white">Estado financiero</p>
              {pendiente > 0.01
                ? <Pill color="rose">Debe {money(pendiente)}</Pill>
                : credito > 0.01
                ? <Pill color="green">A favor</Pill>
                : <Pill color="dim">Al día</Pill>}
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-rose-400/10 bg-rose-400/[0.04] p-3">
                  <p className="text-[10px] text-white/35 uppercase tracking-wide">Pendiente</p>
                  <p className="mt-1 text-sm font-bold text-rose-300">{money(pendiente)}</p>
                </div>
                <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] p-3">
                  <p className="text-[10px] text-white/35 uppercase tracking-wide">A favor</p>
                  <p className="mt-1 text-sm font-bold text-emerald-300">{money(credito)}</p>
                </div>
              </div>
              <Divider />
              <InfoRow label="Total pagado" value={money(resumenPagos.total, resumenPagos.moneda)} valueClass="text-emerald-400/80" />
              <InfoRow label="Pagos registrados" value={resumenPagos.cantidad} />
              <Divider />
              <div className="flex flex-col gap-2">
                <Link href={`/admin/finanzas/ingresos?cliente=${cliente.id}`}
                  className="block w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 text-center text-[12px] font-medium text-white/70 transition hover:bg-white/[0.06]">
                  Ver ingresos
                </Link>
                <Link href={`/admin/finanzas/ingresos?cliente=${cliente.id}&tipoIngreso=saldo`}
                  className="block w-full rounded-xl border border-violet-400/20 bg-violet-400/[0.07] py-2 text-center text-[12px] font-semibold text-violet-300 transition hover:bg-violet-400/10">
                  + Agregar saldo
                </Link>
              </div>
            </div>
          </div>

          {/* ── Plan activo ── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05]">
              <p className="text-sm font-semibold text-white">Plan activo</p>
              {planActivo ? planEstadoPill(getEstadoPlanEfectivo(planActivo.estado, planActivo.fecha_fin, hoyKey, planActivo.sesiones_totales, planActivo.sesiones_usadas)) : <Pill color="dim">Sin plan</Pill>}
            </div>
            <div className="p-4">
              {!planActivo ? (
                <div className="space-y-3">
                  <p className="text-[12px] text-white/35">No tiene plan activo vigente.</p>
                  <Link href={`/admin/personas/clientes/${cliente.id}/plan`}
                    className="block w-full rounded-xl border border-violet-400/20 bg-violet-400/[0.07] py-2 text-center text-[12px] font-semibold text-violet-300 transition hover:bg-violet-400/10">
                    Asignar plan
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-white">{planActivo.planes?.nombre}</p>
                  <div className="space-y-2">
                    <InfoRow label="Precio" value={money(planActivo.planes?.precio, 'USD')} />
                    <InfoRow label="Vigencia" value={formatVigencia(planActivo.planes?.vigencia_valor, planActivo.planes?.vigencia_tipo)} />
                    <InfoRow label="Vence" value={formatDate(planActivo.fecha_fin)} />
                  </div>
                  {/* barra sesiones */}
                  <div>
                    <div className="mb-1.5 flex justify-between text-[10px] text-white/35">
                      <span>Sesiones usadas</span>
                      <span className="font-semibold text-white/60">{planActivo.sesiones_usadas}/{planActivo.sesiones_totales}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-violet-400/60 transition-all"
                        style={{ width: `${Math.min(100, (planActivo.sesiones_usadas / Math.max(1, planActivo.sesiones_totales)) * 100)}%` }} />
                    </div>
                    <p className="mt-1 text-right text-[10px] text-white/35">
                      {Math.max(0, planActivo.sesiones_totales - planActivo.sesiones_usadas)} restantes
                    </p>
                  </div>
                  {/* asistencia del plan activo */}
                  <Divider />
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    {[
                      { label: 'Asistió', val: resumenAsistencia.asistio, cls: 'text-emerald-400' },
                      { label: 'Avisó', val: resumenAsistencia.aviso, cls: 'text-amber-400' },
                      { label: 'S/aviso', val: resumenAsistencia.sinAviso, cls: 'text-rose-400' },
                    ].map(({ label, val, cls }) => (
                      <div key={label} className="rounded-lg border border-white/[0.05] bg-white/[0.02] py-2">
                        <p className={`text-sm font-bold ${cls}`}>{val}</p>
                        <p className="text-[9px] text-white/30 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  <Link href={`/admin/personas/clientes/${cliente.id}/plan`}
                    className="block w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 text-center text-[12px] font-medium text-white/70 transition hover:bg-white/[0.06]">
                    Gestionar plan
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* ── Info del cliente ── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.015] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/[0.05]">
              <p className="text-sm font-semibold text-white">Datos del cliente</p>
            </div>
            <div className="divide-y divide-white/[0.05] px-4">
              <InfoRow label="Estado" value={
                <span className={cliente.estado === 'activo' ? 'text-emerald-300' : 'text-white/50'}>
                  {cliente.estado}
                </span>
              } />
              {cliente.email    && <InfoRow label="Correo"    value={<span className="truncate">{cliente.email}</span>} />}
              {cliente.telefono && <InfoRow label="Teléfono"  value={cliente.telefono} />}
              <InfoRow label="Registrado" value={<span className="text-[11px]">{formatDateTime(cliente.created_at)}</span>} />
              {cliente.creado_por?.nombre && <InfoRow label="Creado por" value={<span className="text-[11px]">{cliente.creado_por.nombre}</span>} />}
              {cliente.updated_at && cliente.editado_por?.nombre && (
                <InfoRow label="Editado por" value={<span className="text-[11px]">{cliente.editado_por.nombre}</span>} />
              )}
            </div>
            <div className="p-4">
              <Link href={`/admin/personas/clientes/${cliente.id}/editar`}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] py-2 text-[12px] font-medium text-white/60 transition hover:bg-white/[0.06]">
                <Pencil className="h-3 w-3" /> Editar cliente
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* ── Modal Reagendar ── */}
      {sesionReagendar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0f1117] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-white">Reagendar sesión</p>
                <p className="mt-0.5 text-sm text-white/45">
                  {sesionReagendar.clientes_planes?.planes?.nombre || 'Sesión del plan'} · {sesionReagendar.empleados?.nombre || '—'}
                </p>
              </div>
              <button type="button" onClick={() => { if (!guardandoReagenda) setSesionReagendar(null) }}
                className="rounded-full border border-white/10 p-1.5 text-white/40 transition hover:bg-white/[0.06]">
                <XCircle className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[12px] text-white/55 space-y-1">
              <p>Actual: {formatDate(sesionReagendar.fecha)} · {onlyHour(sesionReagendar.hora_inicio)}–{onlyHour(sesionReagendar.hora_fin)}</p>
              {sesionReagendar.clientes_planes?.fecha_fin && (
                <p className="text-white/35">Vencimiento del plan: {formatDate(sesionReagendar.clientes_planes.fecha_fin)}</p>
              )}
              {(sesionReagendar.asistencia_estado || '').toLowerCase() === 'no_asistio_aviso' && (
                <p className="text-violet-300/80">Si eliges una fecha mayor al vencimiento, el plan se extenderá automáticamente.</p>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-white/35">Nueva fecha</span>
                <input type="date" value={reagendarForm.fecha}
                  onChange={(e) => setReagendarForm((p) => ({ ...p, fecha: e.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-400/40" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-white/35">Hora inicio</span>
                  <input type="time" value={reagendarForm.hora_inicio}
                    onChange={(e) => {
                      const ni = e.target.value
                      const dur = getDurationMinutes(sesionReagendar.hora_inicio, sesionReagendar.hora_fin)
                      setReagendarForm((p) => ({ ...p, hora_inicio: ni, hora_fin: addMinutesToHour(ni, dur) }))
                    }}
                    className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-400/40" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-white/35">Hora fin</span>
                  <input type="time" value={reagendarForm.hora_fin}
                    onChange={(e) => setReagendarForm((p) => ({ ...p, hora_fin: e.target.value }))}
                    className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-violet-400/40" />
                </label>
              </div>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-white/35">Motivo (opcional)</span>
                <textarea value={reagendarForm.motivo}
                  onChange={(e) => setReagendarForm((p) => ({ ...p, motivo: e.target.value }))}
                  rows={2} placeholder="Ej: cliente pidió cambiar la fecha"
                  className="mt-1.5 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-violet-400/40" />
              </label>
            </div>

            {errorReagenda && (
              <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2">
                <p className="text-[12px] text-rose-300">{errorReagenda}</p>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setSesionReagendar(null)} disabled={guardandoReagenda}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/60 transition hover:bg-white/[0.06] disabled:opacity-40">
                Cancelar
              </button>
              <button type="button" onClick={guardarReagendaSesion} disabled={guardandoReagenda}
                className="rounded-2xl border border-violet-400/20 bg-violet-400/15 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/20 disabled:opacity-40">
                {guardandoReagenda ? 'Guardando…' : 'Guardar cambio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}