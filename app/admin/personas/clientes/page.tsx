'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  Trash2, X, AlertTriangle, ShieldAlert, Search, SlidersHorizontal,
  Users, UserCheck, BookOpen, BookX, Clock, TrendingDown,
  ChevronRight, LayoutGrid, List, Rows3,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type EmpleadoRef = { id: string; nombre: string; rol: string | null } | null
type AuditorRef  = { id: string; nombre: string | null } | null

type Cliente = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  estado: string
  created_at: string
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
  terapeuta_id: string | null
  empleado_id: string | null
  terapeuta: EmpleadoRef
  empleado: EmpleadoRef
  creado_por: AuditorRef
  editado_por: AuditorRef
}

type ClientePlan = {
  id: string
  cliente_id: string
  sesiones_totales: number | null
  sesiones_usadas: number | null
  estado: string
  fecha_fin: string | null
  created_at?: string | null
  creado_por_nombre?: string | null
  creado_por_email?: string | null
  creado_en?: string | null
  planes: {
    nombre: string
    precio: number | null
    vigencia_valor?: number | null
    vigencia_tipo?: string | null
  } | null
}

type Pago = {
  id: string
  cliente_id: string | null
  cliente_plan_id?: string | null
  fecha: string
  monto: number | null
  moneda_pago: string | null
  estado: string
  created_at?: string | null
  monto_equivalente_usd?: number | null
  monto_equivalente_bs?: number | null
}

type CitaRef = { cliente_id: string | null }

type ClienteRow = {
  cliente: Cliente
  planActivo: ClientePlan | null
  ultimoPago: Pago | null
  sesionesRestantes: number
  empleadoNombre: string
  estadoReal: 'activo' | 'inactivo'
  tieneCitas: boolean
}

type PlanEstadoFiltro = 'todos' | 'activos' | 'con_plan' | 'sin_plan' | 'por_vencer' | 'planes_vencidos'
type OrdenKey       = 'nombre_asc' | 'nombre_desc' | 'empleado_asc' | 'fecha_reciente' | 'sesiones_mayor' | 'sesiones_menor'
type ViewMode       = 'grid3' | 'grid4' | 'list'

const MOTIVOS = ['Solicitud del cliente', 'Registro duplicado', 'Error de registro', 'Cliente inactivo prolongado', 'Otro'] as const

// ─── Modal Eliminar ───────────────────────────────────────────────────────────

function ModalEliminar({ cliente, onCancel, onConfirm }: { cliente: Cliente; onCancel: () => void; onConfirm: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [motivoDetalle, setMotivoDetalle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [usuarioAuth, setUsuarioAuth] = useState<{ authId: string; email: string; nombre: string } | null>(null)
  const [loadingUsuario, setLoadingUsuario] = useState(true)

  useEffect(() => {
    async function cargarUsuario() {
      setLoadingUsuario(true)
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) { setError('No hay sesión activa.'); setLoadingUsuario(false); return }
        let nombre = user.email || 'Usuario desconocido'
        const { data: empAny } = await supabase.from('empleados').select('nombre, rol').eq('auth_user_id', user.id).maybeSingle()
        if (empAny?.nombre) nombre = empAny.nombre
        setUsuarioAuth({ authId: user.id, email: user.email || '', nombre })
      } catch { setError('Error al verificar la sesión.') }
      finally { setLoadingUsuario(false) }
    }
    void cargarUsuario()
  }, [])

  async function handleConfirmar() {
    if (!motivo) { setError('Selecciona un motivo.'); return }
    if (motivo === 'Otro' && !motivoDetalle.trim()) { setError('Describe el motivo.'); return }
    if (!usuarioAuth) { setError('No se pudo verificar tu identidad.'); return }
    setSaving(true); setError('')
    try {
      const { error: logErr } = await supabase.from('clientes_eliminaciones').insert({
        cliente_id: cliente.id, cliente_nombre: cliente.nombre, motivo,
        motivo_detalle: motivoDetalle.trim() || null,
        eliminado_por_auth_id: usuarioAuth.authId,
        eliminado_por_nombre: usuarioAuth.nombre,
        eliminado_por_email: usuarioAuth.email,
      })
      if (logErr) throw logErr
      const { error: delErr } = await supabase.from('clientes').update({ estado: 'eliminado', updated_at: new Date().toISOString() }).eq('id', cliente.id)
      if (delErr) throw delErr
      onConfirm()
    } catch (err: any) { setError(err?.message || 'No se pudo eliminar el cliente.') }
    finally { setSaving(false) }
  }

  const inp = 'w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#13151e] p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10">
              <ShieldAlert className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Eliminar cliente</h2>
              <p className="text-xs text-white/45">Esta acción queda registrada permanentemente.</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="rounded-full border border-white/10 bg-white/[0.03] p-1.5 text-white/50 transition hover:bg-white/[0.06] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-xs text-white/45">Cliente a eliminar</p>
          <p className="mt-1 font-semibold text-white">{cliente.nombre}</p>
          {cliente.email && <p className="mt-0.5 text-xs text-white/45">{cliente.email}</p>}
        </div>

        <div className="mb-5 rounded-2xl border border-violet-400/20 bg-violet-500/[0.06] px-4 py-3">
          <p className="text-xs text-white/45">Registrado como eliminado por</p>
          {loadingUsuario
            ? <p className="mt-1 text-sm text-white/50 animate-pulse">Verificando…</p>
            : usuarioAuth
              ? <><p className="mt-1 font-semibold text-white">{usuarioAuth.nombre}</p><p className="text-xs text-white/45">{usuarioAuth.email}</p></>
              : <p className="mt-1 text-sm text-rose-400">No se pudo verificar la sesión</p>}
        </div>

        <div className="mb-4 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/75">Motivo *</label>
            <select value={motivo} onChange={(e) => { setMotivo(e.target.value); setError('') }} className={inp}>
              <option value="" className="bg-[#11131a]">Selecciona un motivo...</option>
              {MOTIVOS.map((m) => <option key={m} value={m} className="bg-[#11131a]">{m}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-white/75">Detalle {motivo === 'Otro' ? '*' : '(opcional)'}</label>
            <textarea value={motivoDetalle} onChange={(e) => { setMotivoDetalle(e.target.value); setError('') }} rows={3}
              placeholder={motivo === 'Otro' ? 'Describe el motivo...' : 'Información adicional opcional...'}
              className={`${inp} resize-none`} />
          </div>
        </div>

        <div className="mb-5 flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-xs text-amber-200/80">El cliente pasará a estado <span className="font-semibold text-amber-200">eliminado</span>. Se guardará un registro permanente.</p>
        </div>

        {error && <p className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-300">{error}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]">Cancelar</button>
          <button type="button" onClick={handleConfirmar} disabled={saving || loadingUsuario || !usuarioAuth || !motivo}
            className="flex-1 rounded-2xl border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? 'Eliminando...' : 'Confirmar eliminación'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(value: number | string | null | undefined, moneda = 'USD') {
  const amount = Number(value || 0)
  if ((moneda || '').toUpperCase() === 'BS') return `Bs ${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(amount)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try { return new Date(`${value}T00:00:00`).toLocaleDateString('es-ES') } catch { return value }
}

function getTodayKey() { return new Date().toISOString().slice(0, 10) }

function getDiasHastaFin(fechaFin: string | null | undefined) {
  if (!fechaFin) return Number.POSITIVE_INFINITY
  const fin = new Date(`${fechaFin}T00:00:00`)
  const hoy = new Date(`${getTodayKey()}T00:00:00`)
  return Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

function getPlanEstadoReal(plan: ClientePlan | null | undefined) {
  if (!plan) return 'sin_plan'
  const estadoDb = (plan.estado || '').toLowerCase()
  const hoy = getTodayKey()
  const total = Number(plan.sesiones_totales || 0)
  const usadas = Number(plan.sesiones_usadas || 0)
  if (estadoDb === 'cancelado' || estadoDb === 'renovado') return estadoDb
  if (estadoDb === 'vencido' || (!!plan.fecha_fin && plan.fecha_fin < hoy)) return 'vencido'
  if (estadoDb === 'agotado' || (total > 0 && usadas >= total)) return 'agotado'
  if (estadoDb === 'activo') return 'activo'
  return estadoDb || 'sin_estado'
}

function isPlanActivoReal(plan: ClientePlan | null | undefined) { return getPlanEstadoReal(plan) === 'activo' }
function isPlanVencidoOAgotadoReal(plan: ClientePlan | null | undefined) {
  const e = getPlanEstadoReal(plan); return e === 'vencido' || e === 'agotado'
}
function getRestantes(plan: ClientePlan | null) {
  if (!plan) return 0
  return Math.max(0, Number(plan.sesiones_totales || 0) - Number(plan.sesiones_usadas || 0))
}
function isPlanPorVencer(plan: ClientePlan | null) {
  if (!plan || !isPlanActivoReal(plan)) return false
  const restantes = getRestantes(plan)
  const total = Number(plan.sesiones_totales || 0)
  const porSesiones = total > 0 && restantes > 0 && restantes <= 2
  if (!plan.fecha_fin) return porSesiones
  const dias = getDiasHastaFin(plan.fecha_fin)
  return (dias >= 0 && dias <= 7) || porSesiones
}

function getDateTimestamp(v: string | null | undefined) {
  if (!v) return 0; const t = new Date(v).getTime(); return Number.isNaN(t) ? 0 : t
}

function formatEmpleadoLabel(ref: EmpleadoRef) {
  if (!ref?.nombre?.trim()) return ''
  const n = ref.nombre.trim(); const r = (ref.rol || '').toLowerCase()
  if (r === 'terapeuta' || r === 'fisioterapeuta') return `${n} (Fisioterapeuta)`
  if (r === 'entrenador') return `${n} (Entrenador)`
  if (r) return `${n} (${r})`
  return n
}

function resolveEmpleadoNombre(c: Cliente) {
  const f = formatEmpleadoLabel(c.terapeuta); const e = formatEmpleadoLabel(c.empleado)
  if (f && e) { if (f.toLowerCase() === e.toLowerCase()) return f; return `${f} / ${e}` }
  return f || e || 'Sin asignar'
}

function normalizeSearch(v: string) {
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ icon: Icon, label, value, color, active, onClick }: {
  icon: any; label: string; value: number; color?: string; active?: boolean; onClick?: () => void
}) {
  return (
    <button type="button" onClick={onClick}
      className={`group flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all duration-200 ${
        active
          ? 'border-violet-400/30 bg-violet-400/[0.08]'
          : 'border-white/[0.06] bg-white/[0.025] hover:border-white/10 hover:bg-white/[0.04]'
      }`}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${active ? 'border-violet-400/30 bg-violet-400/15' : 'border-white/10 bg-white/[0.04]'}`}>
        <Icon className={`h-4 w-4 ${color || 'text-white/50'}`} />
      </div>
      <div>
        <p className={`text-2xl font-bold tabular-nums tracking-tight ${color || 'text-white'}`}>{value}</p>
        <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-white/35">{label}</p>
      </div>
    </button>
  )
}

// ─── PlanPill ─────────────────────────────────────────────────────────────────

function PlanPill({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    activo:   'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    agotado:  'border-amber-400/20 bg-amber-400/10 text-amber-300',
    vencido:  'border-white/10 bg-white/[0.05] text-white/55',
    renovado: 'border-violet-400/20 bg-violet-400/10 text-violet-300',
    cancelado:'border-rose-400/20 bg-rose-400/10 text-rose-300',
  }
  const labels: Record<string, string> = {
    activo: 'Activo', agotado: 'Agotado', vencido: 'Vencido', renovado: 'Renovado', cancelado: 'Cancelado',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[estado] || 'border-white/10 bg-white/[0.05] text-white/45'}`}>
      {labels[estado] || estado}
    </span>
  )
}

// ─── ClienteCard — colapsable ─────────────────────────────────────────────────

function ClienteCard({
  row, onEliminar, expanded, onToggle, viewMode,
}: {
  row: ClienteRow
  onEliminar: (c: Cliente) => void
  expanded: boolean
  onToggle: () => void
  viewMode: ViewMode
}) {
  const { cliente, planActivo, ultimoPago, sesionesRestantes, empleadoNombre, estadoReal } = row
  const planEstado = getPlanEstadoReal(planActivo)
  const porVencer  = isPlanPorVencer(planActivo)
  const isList     = viewMode === 'list'

  return (
    <div className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
      expanded
        ? 'border-violet-400/15 bg-violet-400/[0.02]'
        : porVencer
          ? 'border-amber-400/15 bg-amber-400/[0.025] hover:border-amber-400/25'
          : 'border-white/[0.06] bg-white/[0.015] hover:border-white/10'
    } ${estadoReal === 'inactivo' ? 'opacity-60' : ''}`}>

      {/* franja top — solo en grid */}
      {!isList && (
        <div className={`h-0.5 w-full ${estadoReal === 'activo'
          ? 'bg-gradient-to-r from-emerald-400/50 via-violet-400/30 to-transparent'
          : 'bg-white/[0.06]'}`}
        />
      )}

      {/* ── ROW siempre visible ── */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.025]"
      >
        {/* dot de estado */}
        <span className={`h-2 w-2 shrink-0 rounded-full ${
          estadoReal === 'activo' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]' : 'bg-white/15'
        }`} />

        {/* nombre */}
        <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${estadoReal === 'activo' ? 'text-white' : 'text-white/50'}`}>
          {cliente.nombre}
        </span>

        {/* plan pill + sesiones — centro */}
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {planActivo ? (
            <>
              <span className="max-w-[120px] truncate text-[11px] text-white/35">{planActivo.planes?.nombre}</span>
              <PlanPill estado={planEstado} />
              {porVencer && (
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">⚠</span>
              )}
            </>
          ) : (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/30">Sin plan</span>
          )}
        </div>

        {/* sesiones restantes */}
        {planActivo ? (
          <div className="shrink-0 text-right">
            <span className="font-mono text-sm font-bold tabular-nums text-white">{sesionesRestantes}</span>
            <span className="text-[10px] text-white/30">/{planActivo.sesiones_totales || 0}</span>
          </div>
        ) : (
          <span className="shrink-0 font-mono text-sm text-white/20">—</span>
        )}

        {/* chevron */}
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-white/20 transition-transform duration-200 ${expanded ? 'rotate-90 text-violet-400/60' : ''}`} />
      </button>

      {/* ── DETALLE expandido ── */}
      {expanded && (
        <div className="border-t border-white/[0.05] px-4 pb-4 pt-3">
          <div className="space-y-2.5">

            {/* Contacto */}
            {(cliente.email || cliente.telefono) && (
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {cliente.email    && <span className="text-[11px] text-white/40">{cliente.email}</span>}
                {cliente.telefono && <span className="text-[11px] text-white/40">{cliente.telefono}</span>}
              </div>
            )}

            {/* Fisioterapeuta */}
            {empleadoNombre !== 'Sin asignar' && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/30">Fisioterapeuta</span>
                <span className="text-[11px] text-white/60">{empleadoNombre}</span>
              </div>
            )}

            <div className="h-px bg-white/[0.05]" />

            {/* Plan completo */}
            {planActivo ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white/80">{planActivo.planes?.nombre || 'Plan'}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <PlanPill estado={planEstado} />
                      {planActivo.fecha_fin && (
                        <span className={`text-[10px] ${porVencer ? 'text-amber-400/80' : 'text-white/30'}`}>
                          vence {formatDate(planActivo.fecha_fin)}
                          {porVencer && ` · ${getDiasHastaFin(planActivo.fecha_fin)} días`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-base font-bold tabular-nums text-white">{sesionesRestantes}</p>
                    <p className="text-[10px] text-white/30">de {planActivo.sesiones_totales || 0}</p>
                  </div>
                </div>

                {/* Barra de progreso */}
                {Number(planActivo.sesiones_totales || 0) > 0 && (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        planEstado === 'agotado' ? 'bg-amber-400/70'
                          : porVencer ? 'bg-amber-400'
                          : 'bg-violet-400/70'
                      }`}
                      style={{ width: `${Math.min(100, (Number(planActivo.sesiones_usadas || 0) / Number(planActivo.sesiones_totales)) * 100)}%` }}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/30">Plan</span>
                <span className="text-[11px] text-white/30">
                  {row.tieneCitas ? 'Sin plan · activo por citas' : 'Sin plan activo'}
                </span>
              </div>
            )}

            {/* Último pago */}
            {ultimoPago && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/30">Último pago</span>
                <span className="text-[11px] font-medium text-emerald-400/80">
                  {money(
                    ultimoPago.moneda_pago === 'BS'
                      ? Number(ultimoPago.monto_equivalente_bs || 0)
                      : Number(ultimoPago.monto_equivalente_usd || 0),
                    ultimoPago.moneda_pago || 'USD'
                  )} · {formatDate(ultimoPago.fecha)}
                </span>
              </div>
            )}

            <div className="h-px bg-white/[0.05]" />

            {/* Acciones */}
            <div className="flex items-center justify-between pt-0.5">
              <div className="flex gap-1.5">
                <Link href={`/admin/personas/clientes/${cliente.id}`}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/65 transition hover:bg-white/[0.06] hover:text-white">Ver</Link>
                <Link href={`/admin/personas/clientes/${cliente.id}/plan`}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/65 transition hover:bg-white/[0.06] hover:text-white">Plan</Link>
                <Link href={`/admin/personas/clientes/${cliente.id}/editar`}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/65 transition hover:bg-white/[0.06] hover:text-white">Editar</Link>
              </div>
              <button type="button" onClick={() => onEliminar(cliente)}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-400/15 bg-rose-400/[0.06] px-2.5 py-1 text-[11px] font-medium text-rose-400/65 transition hover:bg-rose-400/15 hover:text-rose-300">
                <Trash2 className="h-3 w-3" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 24

export default function ClientesPage() {
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [planesActivos, setPlanesActivos] = useState<ClientePlan[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [citasClienteIds, setCitasClienteIds] = useState<Set<string>>(new Set())

  const [search, setSearch] = useState('')
  const [filtroActivo, setFiltroActivo] = useState<PlanEstadoFiltro>('todos')
  const [empleadoFiltro, setEmpleadoFiltro] = useState('todos')
  const [planNombreFiltro, setPlanNombreFiltro] = useState('todos')
  const [ordenPor, setOrdenPor] = useState<OrdenKey>('nombre_asc')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [clienteAEliminar, setClienteAEliminar] = useState<Cliente | null>(null)

  // ── Estados de UI para cards colapsables ──
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('grid3')

  useEffect(() => { void loadData() }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const pf = params.get('planEstado')
    if (pf === 'activo' || pf === 'con_plan')    setFiltroActivo('con_plan')
    else if (pf === 'sin_plan')                  setFiltroActivo('sin_plan')
    else if (pf === 'por_vencer')                setFiltroActivo('por_vencer')
    else if (pf === 'planes_vencidos' || pf === 'vencidos' || pf === 'vencido') setFiltroActivo('planes_vencidos')
    else if (pf === 'activos')                   setFiltroActivo('activos')
  }, [])

  async function sincronizarPlanesVencidos() {
    try {
      const { error } = await supabase.rpc('actualizar_planes_vencidos')
      if (error) console.warn('No se pudieron sincronizar planes vencidos:', error.message)
    } catch (err) {
      console.warn('No se pudieron sincronizar planes vencidos:', err)
    }
  }

  async function loadData() {
    setLoading(true); setError('')
    try {
      await sincronizarPlanesVencidos()

      const [clientesRes, planesRes, pagosRes, citasRes] = await Promise.all([
        supabase.from('clientes').select(`
          id, nombre, telefono, email, estado, created_at, updated_at,
          created_by, updated_by, terapeuta_id, empleado_id,
          terapeuta:terapeuta_id (id, nombre, rol),
          empleado:empleado_id (id, nombre, rol),
          creado_por:created_by (id, nombre),
          editado_por:updated_by (id, nombre)
        `).order('created_at', { ascending: false }),

        supabase.from('clientes_planes').select(`
          id, cliente_id, sesiones_totales, sesiones_usadas, estado, fecha_fin, created_at,
          creado_por_nombre, creado_por_email, creado_en,
          planes:plan_id (nombre, precio, vigencia_valor, vigencia_tipo)
        `).order('created_at', { ascending: false }),

        supabase.from('pagos').select(
          'id, cliente_id, cliente_plan_id, fecha, monto, moneda_pago, estado, created_at, monto_equivalente_usd, monto_equivalente_bs'
        ).eq('estado', 'pagado').order('created_at', { ascending: false }),

        supabase.from('citas').select('cliente_id').not('cliente_id', 'is', null),
      ])

      if (clientesRes.error) throw new Error(clientesRes.error.message)

      const todos = ((clientesRes.data || []) as unknown as Cliente[]).filter((c) => c.estado !== 'eliminado')
      setClientes(todos)
      setPlanesActivos((planesRes.data || []) as unknown as ClientePlan[])
      setPagos((pagosRes.data || []) as Pago[])

      const idsConCitas = new Set<string>()
      for (const cita of (citasRes.data || []) as CitaRef[]) {
        if (cita.cliente_id) idsConCitas.add(cita.cliente_id)
      }
      setCitasClienteIds(idsConCitas)
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar los clientes.')
      setClientes([]); setPlanesActivos([]); setPagos([])
    } finally {
      setLoading(false)
    }
  }

  const planMap = useMemo(() => {
    const map = new Map<string, ClientePlan>()
    for (const plan of planesActivos) {
      if (!plan?.cliente_id) continue
      const current = map.get(plan.cliente_id)
      if (!current) { map.set(plan.cliente_id, plan); continue }
      const ca = isPlanActivoReal(current); const na = isPlanActivoReal(plan)
      if (na && !ca) { map.set(plan.cliente_id, plan); continue }
      if (na === ca) {
        const a = current.created_at ? new Date(current.created_at).getTime() : 0
        const b = plan.created_at   ? new Date(plan.created_at).getTime()    : 0
        if (b >= a) map.set(plan.cliente_id, plan)
      }
    }
    return map
  }, [planesActivos])

  const planIdToClienteIdMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const plan of planesActivos) { if (plan?.id && plan?.cliente_id) map.set(plan.id, plan.cliente_id) }
    return map
  }, [planesActivos])

  const pagoMap = useMemo(() => {
    const map = new Map<string, Pago>()
    for (const pago of pagos) {
      const cid = pago.cliente_id || (pago.cliente_plan_id ? planIdToClienteIdMap.get(pago.cliente_plan_id) || null : null)
      if (!cid) continue
      const current = map.get(cid)
      const ts = (p: Pago) => new Date(p.created_at || p.fecha).getTime()
      if (!current || ts(pago) >= ts(current)) map.set(cid, pago)
    }
    return map
  }, [pagos, planIdToClienteIdMap])

  const rows = useMemo<ClienteRow[]>(() => clientes.map((cliente) => {
    const planActivo = planMap.get(cliente.id) || null
    const tieneCitas = citasClienteIds.has(cliente.id)
    const estadoReal: 'activo' | 'inactivo' = (isPlanActivoReal(planActivo) || tieneCitas) ? 'activo' : 'inactivo'
    return {
      cliente, planActivo,
      ultimoPago: pagoMap.get(cliente.id) || null,
      sesionesRestantes: getRestantes(planActivo),
      empleadoNombre: resolveEmpleadoNombre(cliente),
      estadoReal, tieneCitas,
    }
  }), [clientes, planMap, pagoMap, citasClienteIds])

  const empleadosOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) { if (row.empleadoNombre !== 'Sin asignar') set.add(row.empleadoNombre) }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [rows])

  const planOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) { const n = row.planActivo?.planes?.nombre?.trim(); if (n) set.add(n) }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [rows])

  const stats = useMemo(() => ({
    total:         rows.length,
    activos:       rows.filter((r) => r.estadoReal === 'activo').length,
    conPlan:       rows.filter((r) => isPlanActivoReal(r.planActivo)).length,
    sinPlan:       rows.filter((r) => !isPlanActivoReal(r.planActivo)).length,
    porVencer:     rows.filter((r) => isPlanPorVencer(r.planActivo)).length,
    planesVencidos:rows.filter((r) => isPlanVencidoOAgotadoReal(r.planActivo)).length,
  }), [rows])

  const clientesFiltrados = useMemo(() => {
    const q = normalizeSearch(search)
    const filtered = rows.filter(({ cliente, planActivo, empleadoNombre, estadoReal }) => {
      const matchSearch = !q
        || normalizeSearch(cliente.nombre).includes(q)
        || normalizeSearch(cliente.email || '').includes(q)
        || normalizeSearch(cliente.telefono || '').includes(q)
        || normalizeSearch(planActivo?.planes?.nombre || '').includes(q)
        || normalizeSearch(empleadoNombre).includes(q)

      const matchFiltro =
        filtroActivo === 'todos'          ? true :
        filtroActivo === 'activos'        ? estadoReal === 'activo' :
        filtroActivo === 'con_plan'       ? isPlanActivoReal(planActivo) :
        filtroActivo === 'sin_plan'       ? !isPlanActivoReal(planActivo) :
        filtroActivo === 'por_vencer'     ? isPlanPorVencer(planActivo) :
        filtroActivo === 'planes_vencidos'? isPlanVencidoOAgotadoReal(planActivo) : true

      const matchEmpleado   = empleadoFiltro    === 'todos' || normalizeSearch(empleadoNombre) === normalizeSearch(empleadoFiltro)
      const matchPlanNombre = planNombreFiltro  === 'todos' || normalizeSearch(planActivo?.planes?.nombre || '') === normalizeSearch(planNombreFiltro)

      return matchSearch && matchFiltro && matchEmpleado && matchPlanNombre
    })

    filtered.sort((a, b) => {
      switch (ordenPor) {
        case 'nombre_asc':    return a.cliente.nombre.localeCompare(b.cliente.nombre, 'es')
        case 'nombre_desc':   return b.cliente.nombre.localeCompare(a.cliente.nombre, 'es')
        case 'empleado_asc':  return a.empleadoNombre.localeCompare(b.empleadoNombre, 'es')
        case 'fecha_reciente':return getDateTimestamp(b.cliente.created_at) - getDateTimestamp(a.cliente.created_at)
        case 'sesiones_mayor':return b.sesionesRestantes - a.sesionesRestantes
        case 'sesiones_menor':return a.sesionesRestantes - b.sesionesRestantes
        default: return 0
      }
    })
    return filtered
  }, [rows, search, filtroActivo, empleadoFiltro, planNombreFiltro, ordenPor])

  const totalPages    = Math.max(1, Math.ceil(clientesFiltrados.length / PAGE_SIZE))
  const clientesPagina = useMemo(
    () => clientesFiltrados.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [clientesFiltrados, page]
  )

  // IDs de la página actual (para expandir todo sólo la página visible)
  const idsEnPagina = useMemo(() => clientesPagina.map((r) => r.cliente.id), [clientesPagina])
  const allExpanded = idsEnPagina.length > 0 && idsEnPagina.every((id) => expandedIds.has(id))

  function toggleCard(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleExpandAll() {
    if (allExpanded) {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        idsEnPagina.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setExpandedIds((prev) => new Set([...prev, ...idsEnPagina]))
    }
  }

  function setFiltro(f: PlanEstadoFiltro) {
    setFiltroActivo(f); setPage(1); setExpandedIds(new Set())
  }

  function limpiarFiltros() {
    setSearch(''); setFiltroActivo('todos'); setEmpleadoFiltro('todos')
    setPlanNombreFiltro('todos'); setOrdenPor('nombre_asc'); setPage(1); setExpandedIds(new Set())
  }

  const hayFiltrosActivos = search || filtroActivo !== 'todos' || empleadoFiltro !== 'todos' || planNombreFiltro !== 'todos' || ordenPor !== 'nombre_asc'

  const gridClass = {
    grid3: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3',
    grid4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
    list:  'grid-cols-1',
  }[viewMode]

  const inp = 'w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05]'

  return (
    <div className="min-h-screen space-y-6 px-4 pb-12 md:px-6">

      {clienteAEliminar && (
        <ModalEliminar
          cliente={clienteAEliminar}
          onCancel={() => setClienteAEliminar(null)}
          onConfirm={() => { setClienteAEliminar(null); void loadData() }}
        />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-white/30">Administración · Personas</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-3xl">Clientes</h1>
          <p className="mt-1 text-sm text-white/35">
            {loading ? 'Cargando…' : `${rows.length} clientes registrados · ${stats.activos} activos`}
          </p>
        </div>
        <Link
          href="/admin/personas/clientes/nuevo"
          className="inline-flex items-center gap-2 rounded-2xl border border-violet-400/25 bg-violet-400/10 px-5 py-2.5 text-sm font-semibold text-violet-200 transition hover:bg-violet-400/15"
        >
          + Nuevo cliente
        </Link>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 px-4 py-3">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard icon={Users}       label="Total"       value={stats.total}          active={filtroActivo === 'todos'}          onClick={() => setFiltro('todos')} />
        <MetricCard icon={UserCheck}   label="Activos"     value={stats.activos}        color="text-emerald-400" active={filtroActivo === 'activos'}    onClick={() => setFiltro('activos')} />
        <MetricCard icon={BookOpen}    label="Con plan"    value={stats.conPlan}        color="text-violet-400"  active={filtroActivo === 'con_plan'}   onClick={() => setFiltro('con_plan')} />
        <MetricCard icon={BookX}       label="Sin plan"    value={stats.sinPlan}        color="text-white/60"    active={filtroActivo === 'sin_plan'}   onClick={() => setFiltro('sin_plan')} />
        <MetricCard icon={Clock}       label="Por vencer"  value={stats.porVencer}      color="text-amber-400"   active={filtroActivo === 'por_vencer'} onClick={() => setFiltro('por_vencer')} />
        <MetricCard icon={TrendingDown} label="Vencidos"   value={stats.planesVencidos} color="text-rose-400"    active={filtroActivo === 'planes_vencidos'} onClick={() => setFiltro('planes_vencidos')} />
      </div>

      {/* ── Búsqueda + filtros ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Buscar por nombre, correo, teléfono, plan…"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05]"
            />
          </div>
          <button type="button" onClick={() => setFiltersOpen((v) => !v)}
            className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
              filtersOpen || empleadoFiltro !== 'todos' || planNombreFiltro !== 'todos' || ordenPor !== 'nombre_asc'
                ? 'border-violet-400/25 bg-violet-400/10 text-violet-300'
                : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.05] hover:text-white/80'
            }`}>
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
          </button>
          {hayFiltrosActivos && (
            <button type="button" onClick={limpiarFiltros}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/50 transition hover:text-white/80">
              Limpiar
            </button>
          )}
        </div>

        {filtersOpen && (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/35">Fisioterapeuta</label>
                <select value={empleadoFiltro} onChange={(e) => { setEmpleadoFiltro(e.target.value); setPage(1) }} className={inp}>
                  <option value="todos" className="bg-[#11131a]">Todos</option>
                  {empleadosOptions.map((e) => <option key={e} value={e} className="bg-[#11131a]">{e}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/35">Tipo de plan</label>
                <select value={planNombreFiltro} onChange={(e) => { setPlanNombreFiltro(e.target.value); setPage(1) }} className={inp}>
                  <option value="todos" className="bg-[#11131a]">Todos</option>
                  {planOptions.map((p) => <option key={p} value={p} className="bg-[#11131a]">{p}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/35">Ordenar por</label>
                <select value={ordenPor} onChange={(e) => setOrdenPor(e.target.value as OrdenKey)} className={inp}>
                  <option value="nombre_asc"    className="bg-[#11131a]">Nombre A-Z</option>
                  <option value="nombre_desc"   className="bg-[#11131a]">Nombre Z-A</option>
                  <option value="empleado_asc"  className="bg-[#11131a]">Fisioterapeuta A-Z</option>
                  <option value="fecha_reciente"className="bg-[#11131a]">Más recientes</option>
                  <option value="sesiones_mayor"className="bg-[#11131a]">Más sesiones restantes</option>
                  <option value="sesiones_menor"className="bg-[#11131a]">Menos sesiones restantes</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Contador + controles de vista */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-white/30">
            {clientesFiltrados.length === rows.length
              ? `${rows.length} clientes`
              : `${clientesFiltrados.length} de ${rows.length} clientes`}
            {filtroActivo !== 'todos' && <span className="ml-1 text-violet-400/70">· filtrado</span>}
          </p>
          <div className="flex items-center gap-2">
            {/* Expandir / colapsar todo */}
            {clientesPagina.length > 0 && (
              <button type="button" onClick={toggleExpandAll}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/50 transition hover:bg-white/[0.06] hover:text-white/80">
                <Rows3 className="h-3.5 w-3.5" />
                {allExpanded ? 'Colapsar todo' : 'Expandir todo'}
              </button>
            )}
            {/* View toggle */}
            <div className="flex gap-1">
              {([
                { mode: 'grid3' as ViewMode, icon: LayoutGrid,  title: '3 columnas' },
                { mode: 'grid4' as ViewMode, icon: LayoutGrid,  title: '4 columnas' },
                { mode: 'list'  as ViewMode, icon: List,        title: 'Lista' },
              ]).map(({ mode, icon: Icon, title }) => (
                <button key={mode} type="button" title={title} onClick={() => setViewMode(mode)}
                  className={`rounded-xl border p-1.5 transition ${
                    viewMode === mode
                      ? 'border-violet-400/25 bg-violet-400/10 text-violet-300'
                      : 'border-white/10 bg-white/[0.03] text-white/35 hover:text-white/70'
                  }`}>
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Grid / Lista de cards ── */}
      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
            <p className="text-sm text-white/30">Cargando clientes…</p>
          </div>
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="flex min-h-[20vh] items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.01]">
          <div className="text-center">
            <p className="text-sm font-medium text-white/40">Sin resultados</p>
            <p className="mt-1 text-xs text-white/25">Intenta con otros filtros o busca por nombre</p>
            {hayFiltrosActivos && (
              <button type="button" onClick={limpiarFiltros}
                className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/60 transition hover:bg-white/[0.06]">
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className={`grid gap-2 ${gridClass}`}>
          {clientesPagina.map((row) => (
            <ClienteCard
              key={row.cliente.id}
              row={row}
              onEliminar={setClienteAEliminar}
              expanded={expandedIds.has(row.cliente.id)}
              onToggle={() => toggleCard(row.cliente.id)}
              viewMode={viewMode}
            />
          ))}
        </div>
      )}

      {/* ── Paginación ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-white/30">{clientesFiltrados.length} clientes · página {page}/{totalPages}</p>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/[0.06] disabled:opacity-30">←</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4))
              const n = start + i
              return n <= totalPages ? (
                <button key={n} type="button" onClick={() => setPage(n)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                    n === page
                      ? 'border-violet-400/25 bg-violet-400/10 text-violet-300'
                      : 'border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]'
                  }`}>{n}</button>
              ) : null
            })}
            <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/[0.06] disabled:opacity-30">→</button>
          </div>
        </div>
      )}
    </div>
  )
}