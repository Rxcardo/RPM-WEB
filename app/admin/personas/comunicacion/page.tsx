'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Search, SlidersHorizontal, MessageCircle, CheckCircle2,
  FileEdit, AlertCircle, CreditCard, CalendarClock,
  ChevronRight, X, Zap,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

/* ─────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────── */
type Cliente = {
  id: string; nombre: string; telefono: string | null
  email: string | null; estado: string; terapeuta_id?: string | null
}
type AuditorRef = { id: string; nombre: string | null } | null
type Comunicacion = {
  id: string; titulo: string; asunto: string | null; mensaje: string
  tipo: string; canal: 'whatsapp'; estado: string; destino: string | null
  cliente_id: string | null; created_at: string; updated_at: string | null
  enviado_at: string | null; created_by: string | null; updated_by: string | null
  sent_by: string | null; creado_por: AuditorRef; editado_por: AuditorRef; enviado_por: AuditorRef
}
type PlantillaWhatsApp = 'pago_deuda' | 'bienvenida_cliente' | 'plan_por_vencer'
type FormState = {
  titulo: string; mensaje: string; tipo: string; cliente_id: string
  destino_manual: string; plantilla: PlantillaWhatsApp | ''
}
type DatosPlantilla = {
  nombre: string; telefono?: string; terapeuta?: string
  saldo?: string; concepto?: string; plan?: string; fecha?: string; sesiones?: number
}
type EmpleadoRow = { id: string; nombre: string }
type DeudaReal = {
  id: string; cliente_id: string | null; cliente_nombre: string | null
  concepto: string | null; saldo_usd: number | string | null; saldo_bs: number | string | null
  moneda: string | null; estado: string | null; fecha_vencimiento: string | null
  clientes: Cliente | Cliente[] | null
}
type PlanReal = {
  id: string; cliente_id: string | null; fecha_inicio: string | null; fecha_fin: string | null
  sesiones_totales: number | null; sesiones_usadas: number | null; estado: string | null
  clientes: Cliente | Cliente[] | null
  plan: { id: string; nombre?: string | null } | { id: string; nombre?: string | null }[] | null
}
type AlertVariant = 'error' | 'success' | 'info' | 'warning'
type AlertState  = { type: AlertVariant; title: string; message: string } | null
type FiltroCliente = { clienteId: string; nombre: string } | null
type EstadoFiltro = 'todos' | 'enviado' | 'borrador' | 'cancelado'
type DrawerPanel  = 'deudas' | 'planes' | null

/* ─────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────── */
const INITIAL_FORM: FormState = {
  titulo: '', mensaje: '', tipo: 'recordatorio', cliente_id: '', destino_manual: '', plantilla: '',
}
const PLANTILLA_LABELS: Record<PlantillaWhatsApp, string> = {
  pago_deuda: 'Pago deuda', bienvenida_cliente: 'Bienvenida', plan_por_vencer: 'Plan por vencer',
}
const PLANTILLAS: Record<PlantillaWhatsApp, (d: DatosPlantilla) => string> = {
  pago_deuda: d =>
    `Hola *${d.nombre}*, te escribimos de Recovery RPM para recordarte que tienes una deuda pendiente.\n\n💰 Saldo: *${d.saldo || 'Pendiente'}*\n📝 Concepto: ${d.concepto || 'Cuenta por cobrar'}\n\nPuedes confirmar tu pago por este medio. Gracias.`,
  bienvenida_cliente: d =>
    `¡Bienvenido/a a Recovery RPM, *${d.nombre}*! 🎉\n\nEstamos felices de acompañarte en tu proceso de recuperación y bienestar.\n\n👨‍⚕️ Terapeuta asignado: *${d.terapeuta || 'Recovery RPM'}*\n\nCualquier duda, estamos a tu disposición.`,
  plan_por_vencer: d =>
    `Hola *${d.nombre}*, tu plan *${d.plan || 'activo'}* está próximo a vencer${d.fecha ? ` el *${d.fecha}*` : ''}.\n\n📊 Sesiones restantes: *${d.sesiones ?? 0}*\n\n¿Deseas renovar o coordinar tus próximas sesiones?`,
}

/* ─────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────── */
function asSingle<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null; return Array.isArray(v) ? (v[0] ?? null) : v
}
function formatWhatsAppPhone(v: string) {
  const l = v.replace(/\D/g, ''); if (!l) return ''
  if (l.startsWith('58')) return l; if (l.startsWith('0')) return `58${l.slice(1)}`
  if (l.length === 10) return `58${l}`; return l
}
function formatFechaLarga(f: string | null | undefined) {
  if (!f) return ''; return new Date(`${f}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}
function formatFechaCorta(f: string | null | undefined) {
  if (!f) return '—'; return new Date(`${f}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
function formatUsd(v: number | string | null | undefined) {
  const n = Number(v || 0); return Number.isFinite(n) ? `$${n.toFixed(2)}` : '$0.00'
}
function getTipoFromPlantilla(p: PlantillaWhatsApp) { return p === 'bienvenida_cliente' ? 'aviso' : 'recordatorio' }
function formatDateTime(v: string | null | undefined) {
  if (!v) return '—'
  try { return new Date(v).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }
  catch { return v }
}
function getAuditLines(item: Comunicacion) {
  const lines = [`Creó: ${item.creado_por?.nombre || '–'} · ${formatDateTime(item.created_at)}`]
  if (item.updated_at && item.updated_at !== item.created_at && item.updated_by)
    lines.push(`Editó: ${item.editado_por?.nombre || '–'} · ${formatDateTime(item.updated_at)}`)
  if (item.estado === 'enviado' || item.enviado_at || item.sent_by)
    lines.push(`Envió: ${item.enviado_por?.nombre || '–'} · ${formatDateTime(item.enviado_at)}`)
  return lines
}
function normalizeSearch(v: string) {
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/* ─────────────────────────────────────────────────────
   SHARED STYLES
───────────────────────────────────────────────────── */
const inp = 'w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05]'

/* ─────────────────────────────────────────────────────
   MetricCard
───────────────────────────────────────────────────── */
function MetricCard({ icon: Icon, label, value, color, active, onClick }: {
  icon: any; label: string; value: number; color?: string; active?: boolean; onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col gap-2 rounded-2xl border p-4 text-left transition-all duration-200 ${
        active
          ? 'border-violet-400/30 bg-violet-400/[0.08]'
          : 'border-white/[0.06] bg-white/[0.025] hover:border-white/10 hover:bg-white/[0.04]'
      }`}
    >
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

/* ─────────────────────────────────────────────────────
   StatePill
───────────────────────────────────────────────────── */
function StatePill({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    enviado:  'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    borrador: 'border-amber-400/20 bg-amber-400/10 text-amber-300',
    cancelado:'border-rose-400/20 bg-rose-400/10 text-rose-300',
  }
  const labels: Record<string, string> = {
    enviado: 'Enviado', borrador: 'Borrador', cancelado: 'Cancelado',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[estado] || 'border-white/10 bg-white/[0.05] text-white/45'}`}>
      {labels[estado] || estado}
    </span>
  )
}

/* ─────────────────────────────────────────────────────
   AlertBanner
───────────────────────────────────────────────────── */
function AlertBanner({ alert, contexto, onClose }: { alert: AlertState; contexto?: string; onClose: () => void }) {
  if (!alert) return null
  const bar:  Record<string, string> = { success: 'bg-emerald-400', error: 'bg-rose-400', warning: 'bg-amber-400', info: 'bg-sky-400' }
  const text: Record<string, string> = { success: 'text-emerald-300', error: 'text-rose-300', warning: 'text-amber-300', info: 'text-sky-300' }
  return (
    <div className="flex items-stretch overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025]">
      <div className={`w-1 shrink-0 ${bar[alert.type]}`} />
      <div className="flex flex-1 items-start justify-between gap-4 px-4 py-3">
        <div>
          <p className={`text-sm font-semibold ${text[alert.type]}`}>{alert.title}</p>
          <p className="mt-0.5 text-sm text-white/55">{alert.message}</p>
          {contexto && <p className="mt-1 text-[11px] text-white/35">{contexto}</p>}
        </div>
        <button onClick={onClose} className="mt-0.5 shrink-0 text-white/30 hover:text-white transition">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   ComunicacionCard — colapsable
───────────────────────────────────────────────────── */
function ComunicacionCard({ item, expanded, onToggle, onReenviar, sending }: {
  item: Comunicacion; expanded: boolean; onToggle: () => void
  onReenviar: () => void; sending: boolean
}) {
  const isEnviado  = item.estado === 'enviado'
  const isBorrador = item.estado === 'borrador'

  return (
    <div className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
      expanded
        ? 'border-violet-400/15 bg-violet-400/[0.02]'
        : isBorrador
          ? 'border-amber-400/10 bg-amber-400/[0.02] hover:border-amber-400/20'
          : 'border-white/[0.06] bg-white/[0.015] hover:border-white/10'
    }`}>
      {/* franja top */}
      <div className={`h-0.5 w-full ${
        isEnviado  ? 'bg-gradient-to-r from-emerald-400/50 via-violet-400/30 to-transparent'
        : isBorrador ? 'bg-gradient-to-r from-amber-400/40 to-transparent'
        : 'bg-white/[0.06]'
      }`} />

      {/* fila visible */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.025]"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${
          isEnviado  ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
          : isBorrador ? 'bg-amber-400/80'
          : 'bg-white/15'
        }`} />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white/90">{item.titulo}</span>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <StatePill estado={item.estado} />
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
            item.tipo === 'recordatorio'
              ? 'border-sky-400/20 bg-sky-400/10 text-sky-300'
              : 'border-white/10 bg-white/[0.05] text-white/45'
          }`}>{item.tipo}</span>
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-white/30">{formatDateTime(item.created_at)}</span>
        <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-white/20 transition-transform duration-200 ${expanded ? 'rotate-90 text-violet-400/60' : ''}`} />
      </button>

      {/* detalle */}
      {expanded && (
        <div className="border-t border-white/[0.05] px-4 pb-4 pt-3">
          <div className="space-y-2.5">
            {item.destino && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-white/30">Destino</span>
                <span className="font-mono text-[11px] text-white/60">{item.destino}</span>
              </div>
            )}
            <div className="h-px bg-white/[0.05]" />
            <div>
              <p className="mb-1.5 text-[11px] text-white/30">Mensaje</p>
              <p className="whitespace-pre-wrap rounded-xl border border-white/[0.05] bg-white/[0.025] px-3 py-2.5 text-[12px] leading-relaxed text-white/65">
                {item.mensaje}
              </p>
            </div>
            <div className="h-px bg-white/[0.05]" />
            <div className="space-y-0.5">
              {getAuditLines(item).map((line, i) => (
                <p key={i} className="text-[10px] text-white/30 leading-4">{line}</p>
              ))}
            </div>
            <div className="h-px bg-white/[0.05]" />
            <div className="flex items-center justify-end pt-0.5">
              <button
                type="button"
                onClick={onReenviar}
                disabled={sending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[11px] font-medium text-emerald-400/70 transition hover:bg-emerald-400/15 hover:text-emerald-300 disabled:opacity-40"
              >
                <Zap className="h-3 w-3" />
                {sending ? 'Reenviando...' : 'Reenviar por WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   DRAWER — panel lateral para deudas / planes
───────────────────────────────────────────────────── */
function Drawer({
  panel, deudas, planes, loading, filtroCliente,
  onToggleFiltro, onUsar, onClose,
}: {
  panel: DrawerPanel
  deudas: DeudaReal[]
  planes: PlanReal[]
  loading: boolean
  filtroCliente: FiltroCliente
  onToggleFiltro: (clienteId: string, nombre: string) => void
  onUsar: (plantilla: PlantillaWhatsApp, cli: Cliente) => void
  onClose: () => void
}) {
  if (!panel) return null

  const isDeudas = panel === 'deudas'
  const title    = isDeudas ? 'Deudas pendientes' : 'Planes por vencer'
  const accent   = isDeudas ? 'text-rose-300' : 'text-sky-300'
  const countCls = isDeudas
    ? 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    : 'border-sky-400/20 bg-sky-400/10 text-sky-300'
  const count    = isDeudas ? deudas.length : planes.length

  return (
    <>
      {/* overlay */}
      <div
        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* panel */}
      <div className="fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col border-l border-white/[0.07] bg-[#0f1018] shadow-2xl">

        {/* header del drawer */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={`h-4 w-0.5 rounded-full ${isDeudas ? 'bg-rose-400' : 'bg-sky-400'}`} />
            <div>
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="text-[11px] text-white/35">
                {isDeudas ? 'saldo_usd › 0 en cuentas_por_cobrar' : 'Vencen en los próximos 7 días'}
              </p>
            </div>
            <span className={`ml-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${countCls}`}>
              {count}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/[0.03] p-1.5 text-white/50 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* cuerpo del drawer */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-xs text-white/30">Cargando…</p>
          ) : count === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-white/30">
                {isDeudas ? 'Sin deudas pendientes' : 'Sin planes próximos a vencer'}
              </p>
            </div>
          ) : isDeudas ? (
            <div className="space-y-2">
              {deudas.map(d => {
                const cli    = asSingle(d.clientes)
                const cliId  = cli?.id || d.cliente_id || ''
                const nombre = cli?.nombre || d.cliente_nombre || 'Sin nombre'
                const active = filtroCliente?.clienteId === cliId

                return (
                  <div
                    key={d.id}
                    className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
                      active
                        ? 'border-rose-400/25 bg-rose-400/[0.04]'
                        : 'border-white/[0.06] bg-white/[0.015] hover:border-white/10'
                    }`}
                  >
                    <div className={`h-0.5 w-full ${active ? 'bg-rose-400/60' : 'bg-gradient-to-r from-rose-400/25 to-transparent'}`} />
                    <div className="flex items-start gap-3 px-4 py-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-400/60" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug text-white/90">{nombre}</p>
                        <p className="mt-0.5 text-[11px] leading-snug text-white/40">{d.concepto || 'Cuenta por cobrar'}</p>
                        <p className="mt-1.5 font-mono text-sm font-bold tabular-nums text-rose-300">{formatUsd(d.saldo_usd)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => cliId && onToggleFiltro(cliId, nombre)}
                          className={`rounded-lg border px-2.5 py-1 text-[10px] font-medium transition ${
                            active
                              ? 'border-rose-400/30 bg-rose-400/15 text-rose-300'
                              : 'border-white/10 bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/70'
                          }`}
                        >
                          {active ? 'Quitar filtro' : 'Filtrar historial'}
                        </button>
                        {cli && (
                          <button
                            type="button"
                            onClick={() => onUsar('pago_deuda', cli)}
                            className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[10px] font-medium text-emerald-400/70 transition hover:bg-emerald-400/15 hover:text-emerald-300"
                          >
                            Usar plantilla
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {planes.map(p => {
                const cli    = asSingle(p.clientes)
                const pr     = asSingle(p.plan)
                const cliId  = cli?.id || p.cliente_id || ''
                const nombre = cli?.nombre || 'Sin nombre'
                const rest   = Math.max(0, Number(p.sesiones_totales || 0) - Number(p.sesiones_usadas || 0))
                const total  = Number(p.sesiones_totales || 0)
                const pct    = total > 0 ? Math.min(100, ((total - rest) / total) * 100) : 0
                const active = filtroCliente?.clienteId === cliId

                return (
                  <div
                    key={p.id}
                    className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
                      active
                        ? 'border-sky-400/25 bg-sky-400/[0.04]'
                        : 'border-white/[0.06] bg-white/[0.015] hover:border-white/10'
                    }`}
                  >
                    <div className={`h-0.5 w-full ${active ? 'bg-sky-400/60' : 'bg-gradient-to-r from-sky-400/25 to-transparent'}`} />
                    <div className="px-4 pt-3 pb-2">
                      <div className="flex items-start gap-3">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400/60" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-snug text-white/90">{nombre}</p>
                          <p className="mt-0.5 text-[11px] leading-snug text-white/40">
                            {pr?.nombre || 'Plan activo'} · vence {formatFechaCorta(p.fecha_fin)}
                          </p>
                          <p className="mt-1.5 font-mono text-sm font-bold tabular-nums text-sky-300">
                            {rest} <span className="text-[10px] text-white/30">/ {total} ses.</span>
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => cliId && onToggleFiltro(cliId, nombre)}
                            className={`rounded-lg border px-2.5 py-1 text-[10px] font-medium transition ${
                              active
                                ? 'border-sky-400/30 bg-sky-400/15 text-sky-300'
                                : 'border-white/10 bg-white/[0.03] text-white/40 hover:bg-white/[0.06] hover:text-white/70'
                            }`}
                          >
                            {active ? 'Quitar filtro' : 'Filtrar historial'}
                          </button>
                          {cli && (
                            <button
                              type="button"
                              onClick={() => onUsar('plan_por_vencer', cli)}
                              className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[10px] font-medium text-emerald-400/70 transition hover:bg-emerald-400/15 hover:text-emerald-300"
                            >
                              Usar plantilla
                            </button>
                          )}
                        </div>
                      </div>
                      {/* barra progreso */}
                      {total > 0 && (
                        <div className="ml-5 mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <div className="h-full rounded-full bg-sky-400/60 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* footer del drawer */}
        <div className="border-t border-white/[0.06] px-5 py-3">
          <p className="text-[11px] text-white/30">
            {filtroCliente
              ? `Historial filtrado por: ${filtroCliente.nombre}`
              : 'Haz clic en "Filtrar historial" para ver los mensajes de un cliente'}
          </p>
        </div>
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────── */
const PAGE_SIZE = 20

export default function ComunicacionPage() {
  const [clientes,       setClientes]       = useState<Cliente[]>([])
  const [comunicaciones, setComunicaciones] = useState<Comunicacion[]>([])
  const [deudas,         setDeudas]         = useState<DeudaReal[]>([])
  const [planes,         setPlanes]         = useState<PlanReal[]>([])
  const [form,           setForm]           = useState<FormState>(INITIAL_FORM)

  const [loading,          setLoading]          = useState(true)
  const [saving,           setSaving]           = useState(false)
  const [sending,          setSending]          = useState(false)
  const [reSendingId,      setReSendingId]      = useState<string | null>(null)
  const [plantillaLoading, setPlantillaLoading] = useState(false)
  const [empleadoActualId, setEmpleadoActualId] = useState('')
  const [alert,            setAlert]            = useState<AlertState>(null)
  const [ultimoContexto,   setUltimoContexto]   = useState('')

  const [search,       setSearch]       = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos')
  const [filtersOpen,  setFiltersOpen]  = useState(false)
  const [page,         setPage]         = useState(1)
  const [expandedIds,  setExpandedIds]  = useState<Set<string>>(new Set())

  // Drawer lateral (deudas o planes)
  const [drawerPanel,   setDrawerPanel]   = useState<DrawerPanel>(null)
  // Filtro de historial por cliente (desde el drawer)
  const [filtroCliente, setFiltroCliente] = useState<FiltroCliente>(null)

  // Formulario
  const [clienteSearch, setClienteSearch] = useState('')
  const [showDropdown,  setShowDropdown]  = useState(false)

  function showAlert(type: AlertVariant, title: string, message: string) { setAlert({ type, title, message }) }
  function clearAlert() { setAlert(null) }

  useEffect(() => { void loadData(); void loadEmpleadoActual() }, [])

  /* ── resolve employee ── */
  async function resolveEmpleadoActualId(): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) return ''
      const { data: e1 } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).maybeSingle()
      if (e1?.id) return String(e1.id)
      const { data: e2 } = await supabase.from('empleados').select('id').eq('id', user.id).maybeSingle()
      return e2?.id ? String(e2.id) : ''
    } catch { return '' }
  }
  async function loadEmpleadoActual() { setEmpleadoActualId(await resolveEmpleadoActualId()) }

  /* ── load data ── */
  async function loadData() {
    try {
      setLoading(true); clearAlert()
      const hoy    = new Date().toISOString().slice(0, 10)
      const limite = new Date(); limite.setDate(limite.getDate() + 7)

      const [cliRes, comRes, deudasRes, planesRes] = await Promise.all([
        supabase.from('clientes').select('id,nombre,telefono,email,estado,terapeuta_id').eq('estado', 'activo').order('nombre', { ascending: true }),
        supabase.from('comunicaciones').select(`id,titulo,asunto,mensaje,tipo,canal,estado,destino,cliente_id,created_at,updated_at,enviado_at,created_by,updated_by,sent_by,creado_por:created_by(id,nombre),editado_por:updated_by(id,nombre),enviado_por:sent_by(id,nombre)`).eq('canal', 'whatsapp').order('created_at', { ascending: false }),
        supabase.from('cuentas_por_cobrar').select(`id,cliente_id,cliente_nombre,concepto,saldo_usd,saldo_bs,moneda,estado,fecha_vencimiento,clientes(id,nombre,telefono,email,estado,terapeuta_id)`).gt('saldo_usd', 0).neq('estado', 'pagado').order('fecha_vencimiento', { ascending: true, nullsFirst: false }),
        supabase.from('clientes_planes').select(`id,cliente_id,fecha_inicio,fecha_fin,sesiones_totales,sesiones_usadas,estado,clientes(id,nombre,telefono,email,estado,terapeuta_id),plan:planes(id,nombre)`).in('estado', ['activo', 'vigente', 'por_vencer']).gte('fecha_fin', hoy).lte('fecha_fin', limite.toISOString().slice(0, 10)).order('fecha_fin', { ascending: true }),
      ])

      if (cliRes.error)    throw cliRes.error
      if (comRes.error)    throw comRes.error
      if (deudasRes.error) throw deudasRes.error
      if (planesRes.error) throw planesRes.error

      setClientes((cliRes.data    || []) as Cliente[])
      setComunicaciones((comRes.data   || []) as unknown as Comunicacion[])
      setDeudas((deudasRes.data  || []) as unknown as DeudaReal[])
      setPlanes((planesRes.data  || []) as unknown as PlanReal[])
    } catch (err: any) {
      showAlert('error', 'Error de carga', err?.message || 'No se pudo cargar la información.')
    } finally { setLoading(false) }
  }

  /* ── computed ── */
  const clienteSeleccionado = useMemo(
    () => clientes.find(c => c.id === form.cliente_id) || null,
    [form.cliente_id, clientes],
  )
  const destinoFinal = useMemo(
    () => form.destino_manual.trim() || clienteSeleccionado?.telefono || '',
    [form.destino_manual, clienteSeleccionado],
  )
  const clientesFiltrados = useMemo(() => {
    const q = normalizeSearch(clienteSearch)
    if (!q) return []
    return clientes.filter(c =>
      normalizeSearch(`${c.nombre} ${c.telefono || ''} ${c.email || ''}`).includes(q)
    ).slice(0, 12)
  }, [clientes, clienteSearch])

  const comunicacionesFiltradas = useMemo(() => {
    let list = comunicaciones
    if (filtroCliente) list = list.filter(c => c.cliente_id === filtroCliente.clienteId)
    if (estadoFiltro !== 'todos') list = list.filter(c => c.estado === estadoFiltro)
    const q = normalizeSearch(search)
    if (q) {
      list = list.filter(c =>
        [c.titulo, c.mensaje, c.tipo, c.estado, c.destino, c.creado_por?.nombre, c.enviado_por?.nombre]
          .some(v => normalizeSearch(v || '').includes(q))
      )
    }
    return list
  }, [comunicaciones, search, estadoFiltro, filtroCliente])

  const stats = useMemo(() => ({
    total:      comunicaciones.length,
    enviadas:   comunicaciones.filter(x => x.estado === 'enviado').length,
    borradores: comunicaciones.filter(x => x.estado === 'borrador').length,
    deudas:     deudas.length,
    planes:     planes.length,
  }), [comunicaciones, deudas, planes])

  const totalPages     = Math.max(1, Math.ceil(comunicacionesFiltradas.length / PAGE_SIZE))
  const comunicsPagina = useMemo(
    () => comunicacionesFiltradas.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [comunicacionesFiltradas, page],
  )
  const hayFiltros = search || estadoFiltro !== 'todos' || !!filtroCliente

  function toggleCard(id: string) {
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  /* ── toggle filtro desde drawer ── */
  function handleToggleFiltro(clienteId: string, nombre: string) {
    setFiltroCliente(prev => prev?.clienteId === clienteId ? null : { clienteId, nombre })
    setPage(1)
  }

  /* ── abrir drawer ── */
  function openDrawer(panel: DrawerPanel) {
    // si ya está abierto el mismo, lo cierra
    setDrawerPanel(prev => prev === panel ? null : panel)
  }

  /* ── form ── */
  function seleccionarCliente(c: Cliente) {
    setForm(p => ({ ...p, cliente_id: c.id, destino_manual: '', plantilla: '' }))
    setClienteSearch(c.nombre); setShowDropdown(false); setUltimoContexto(''); clearAlert()
  }
  function resetForm() {
    setForm(INITIAL_FORM); setClienteSearch(''); setShowDropdown(false); setUltimoContexto(''); clearAlert()
  }
  function validateForm() {
    if (!form.titulo.trim())                           return 'Título requerido.'
    if (!form.mensaje.trim())                          return 'Mensaje requerido.'
    if (!destinoFinal)                                 return 'Destino requerido.'
    if (formatWhatsAppPhone(destinoFinal).length < 10) return 'Número inválido.'
    return ''
  }

  async function getTerapeutaCliente(c: Cliente) {
    if (!c.terapeuta_id) return null
    const { data, error } = await supabase.from('empleados').select('id,nombre').eq('id', c.terapeuta_id).maybeSingle()
    if (error) throw error; return data as EmpleadoRow | null
  }
  async function getDeudaPendiente(clienteId: string) {
    const { data, error } = await supabase.from('cuentas_por_cobrar')
      .select(`id,cliente_id,cliente_nombre,concepto,saldo_usd,saldo_bs,moneda,estado,fecha_vencimiento,clientes(id,nombre,telefono,email,estado,terapeuta_id)`)
      .eq('cliente_id', clienteId).gt('saldo_usd', 0).neq('estado', 'pagado')
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false }).limit(1).maybeSingle()
    if (error) throw error; return (data || null) as unknown as DeudaReal | null
  }
  async function getPlanPorVencer(clienteId: string) {
    const hoy = new Date().toISOString().slice(0, 10)
    const lim = new Date(); lim.setDate(lim.getDate() + 7)
    const { data, error } = await supabase.from('clientes_planes')
      .select(`id,cliente_id,fecha_inicio,fecha_fin,sesiones_totales,sesiones_usadas,estado,clientes(id,nombre,telefono,email,estado,terapeuta_id),plan:planes(id,nombre)`)
      .eq('cliente_id', clienteId).in('estado', ['activo', 'vigente', 'por_vencer'])
      .gte('fecha_fin', hoy).lte('fecha_fin', lim.toISOString().slice(0, 10))
      .order('fecha_fin', { ascending: true }).limit(1).maybeSingle()
    if (error) throw error; return (data || null) as unknown as PlanReal | null
  }

  async function construirDatos(cliente: Cliente, plantilla: PlantillaWhatsApp): Promise<{ datos: DatosPlantilla; contexto: string }> {
    const base: DatosPlantilla = { nombre: cliente.nombre, telefono: cliente.telefono || '' }
    switch (plantilla) {
      case 'bienvenida_cliente': {
        const t = await getTerapeutaCliente(cliente)
        return { datos: { ...base, terapeuta: t?.nombre || 'Recovery RPM' }, contexto: t ? `Terapeuta: ${t.nombre}` : 'Sin terapeuta — usando Recovery RPM.' }
      }
      case 'pago_deuda': {
        const d = await getDeudaPendiente(cliente.id)
        if (!d) throw new Error('Sin deuda pendiente.')
        return { datos: { ...base, saldo: formatUsd(d.saldo_usd), concepto: d.concepto || 'Cuenta por cobrar' }, contexto: `Deuda: ${formatUsd(d.saldo_usd)}` }
      }
      case 'plan_por_vencer': {
        const p = await getPlanPorVencer(cliente.id)
        if (!p) throw new Error('Sin plan que venza en los próximos 7 días.')
        const pr   = asSingle(p.plan)
        const rest = Math.max(0, Number(p.sesiones_totales || 0) - Number(p.sesiones_usadas || 0))
        return { datos: { ...base, fecha: p.fecha_fin ? formatFechaLarga(p.fecha_fin) : 'próximamente', plan: pr?.nombre || 'Plan activo', sesiones: rest }, contexto: `Plan: ${pr?.nombre || '—'} · vence ${p.fecha_fin || '—'}` }
      }
      default: return { datos: base, contexto: '' }
    }
  }

  async function aplicarPlantilla(plantilla: PlantillaWhatsApp, clienteOverride?: Cliente) {
    clearAlert(); setUltimoContexto('')
    const cli = clienteOverride || clienteSeleccionado
    if (!cli) { showAlert('warning', 'Atención', 'Selecciona un cliente primero.'); return }
    if (clienteOverride) seleccionarCliente(clienteOverride)
    try {
      setPlantillaLoading(true)
      const { datos, contexto } = await construirDatos(cli, plantilla)
      setForm(prev => ({ ...prev, plantilla, titulo: PLANTILLA_LABELS[plantilla], tipo: getTipoFromPlantilla(plantilla), mensaje: PLANTILLAS[plantilla](datos) }))
      setUltimoContexto(contexto)
      showAlert('success', 'Plantilla cargada', 'Con datos reales del cliente.')
      // cerrar drawer al usar plantilla
      setDrawerPanel(null)
    } catch (err: any) {
      showAlert('warning', 'No disponible', err?.message || 'No se pudo cargar la plantilla.')
    } finally { setPlantillaLoading(false) }
  }

  async function guardarHistorial(estado: 'borrador' | 'enviado', destinoOverride?: string) {
    let auditorId = empleadoActualId || await resolveEmpleadoActualId()
    setEmpleadoActualId(auditorId)
    const payload: Record<string, any> = {
      titulo: form.titulo.trim(), asunto: null, mensaje: form.mensaje.trim(),
      tipo: form.tipo, canal: 'whatsapp', estado,
      destino: destinoOverride || destinoFinal || null,
      cliente_id: form.cliente_id || null,
      created_by: auditorId || null, updated_by: auditorId || null,
    }
    if (estado === 'enviado') { payload.enviado_at = new Date().toISOString(); payload.sent_by = auditorId || null }
    const { error } = await supabase.from('comunicaciones').insert(payload)
    if (error) throw new Error(error.message)
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault(); clearAlert()
    const err = validateForm(); if (err) { showAlert('warning', 'Incompleto', err); return }
    try { setSaving(true); await guardarHistorial('borrador'); showAlert('success', 'Guardado', 'Guardado como borrador.'); resetForm(); await loadData() }
    catch (err: any) { showAlert('error', 'Error', err?.message || 'No se pudo guardar.') }
    finally { setSaving(false) }
  }

  function abrirWhatsApp(destino: string, mensaje: string) {
    const t = formatWhatsAppPhone(destino); if (!t) throw new Error('Número inválido.')
    window.open(`https://wa.me/${t}?text=${encodeURIComponent(mensaje)}`, '_blank')
  }

  async function handleEnviar() {
    clearAlert(); const err = validateForm(); if (err) { showAlert('warning', 'Incompleto', err); return }
    try { setSending(true); abrirWhatsApp(destinoFinal, form.mensaje); await guardarHistorial('enviado', destinoFinal); showAlert('success', 'Enviado', 'Abierto en WhatsApp y registrado.'); resetForm(); await loadData() }
    catch (err: any) { showAlert('error', 'Error', err?.message || 'No se pudo enviar.') }
    finally { setSending(false) }
  }

  async function reenviar(item: Comunicacion) {
    try {
      setReSendingId(item.id); clearAlert()
      if (!item.destino) { showAlert('warning', 'Sin destino', 'Esta comunicación no tiene número.'); return }
      abrirWhatsApp(item.destino, item.mensaje)
      showAlert('success', 'Reenviado', 'Mensaje abierto en WhatsApp.')
    } catch (err: any) { showAlert('error', 'Error', err?.message || 'No se pudo reenviar.') }
    finally { setReSendingId(null) }
  }

  function limpiarFiltros() { setSearch(''); setEstadoFiltro('todos'); setFiltroCliente(null); setPage(1) }

  /* ──────────────────────────────────────────────────
     RENDER
  ────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen space-y-6 px-4 pb-12 md:px-6">

      {/* Drawer lateral */}
      <Drawer
        panel={drawerPanel}
        deudas={deudas}
        planes={planes}
        loading={loading}
        filtroCliente={filtroCliente}
        onToggleFiltro={handleToggleFiltro}
        onUsar={(plantilla, cli) => void aplicarPlantilla(plantilla, cli)}
        onClose={() => setDrawerPanel(null)}
      />

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-white/30">Administración</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-3xl">Comunicación</h1>
          <p className="mt-1 text-sm text-white/35">
            {loading ? 'Cargando…' : `${stats.total} mensajes registrados · ${stats.enviadas} enviados`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
        >
          <span className={loading ? 'inline-block animate-spin' : ''}>↻</span>
          Actualizar
        </button>
      </div>

      {/* ── Alert ── */}
      {alert && <AlertBanner alert={alert} contexto={ultimoContexto} onClose={clearAlert} />}

      {/* ── Metric cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          icon={MessageCircle} label="Total" value={stats.total}
          active={estadoFiltro === 'todos' && !filtroCliente}
          onClick={() => { setEstadoFiltro('todos'); setFiltroCliente(null); setPage(1) }}
        />
        <MetricCard
          icon={CheckCircle2} label="Enviados" value={stats.enviadas}
          color="text-emerald-400" active={estadoFiltro === 'enviado'}
          onClick={() => { setEstadoFiltro('enviado'); setPage(1) }}
        />
        <MetricCard
          icon={FileEdit} label="Borradores" value={stats.borradores}
          color="text-amber-300" active={estadoFiltro === 'borrador'}
          onClick={() => { setEstadoFiltro('borrador'); setPage(1) }}
        />
        {/* Deudas — abre drawer */}
        <MetricCard
          icon={CreditCard} label="Deudas" value={stats.deudas}
          color="text-rose-300" active={drawerPanel === 'deudas'}
          onClick={() => openDrawer('deudas')}
        />
        {/* Por vencer — abre drawer */}
        <MetricCard
          icon={CalendarClock} label="Por vencer" value={stats.planes}
          color="text-sky-400" active={drawerPanel === 'planes'}
          onClick={() => openDrawer('planes')}
        />
      </div>

      {/* indicador de filtro activo por cliente */}
      {filtroCliente && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/40">Historial filtrado por:</span>
          <button
            type="button"
            onClick={() => { setFiltroCliente(null); setPage(1) }}
            className="flex items-center gap-1.5 rounded-xl border border-violet-400/20 bg-violet-400/[0.06] px-3 py-1 text-[11px] font-medium text-violet-300 transition hover:bg-violet-400/10"
          >
            {filtroCliente.nombre}
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ── Layout: formulario izq | historial der ── */}
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">

        {/* ════ FORMULARIO ════ */}
        <div className="space-y-0">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <p className="mb-1 text-sm font-semibold text-white">Nuevo mensaje</p>
            <p className="mb-4 text-xs text-white/35">Busca cliente → aplica plantilla → envía</p>

            <div className="space-y-3.5">

              {/* Buscar cliente */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-white/35">Cliente</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" />
                  <input
                    value={clienteSearch}
                    onChange={e => {
                      setClienteSearch(e.target.value)
                      setShowDropdown(true)
                      setForm(p => ({ ...p, cliente_id: '', destino_manual: '', plantilla: '' }))
                    }}
                    onFocus={() => clienteSearch && setShowDropdown(true)}
                    placeholder="Nombre, teléfono o email..."
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05]"
                  />
                </div>

                {showDropdown && clientesFiltrados.length > 0 && (
                  <div className="mt-1 overflow-hidden rounded-2xl border border-white/10 bg-[#0d0e14] shadow-xl">
                    {clientesFiltrados.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => seleccionarCliente(c)}
                        className={`flex w-full items-center gap-2.5 border-b border-white/[0.05] px-4 py-2.5 text-left last:border-0 transition hover:bg-white/[0.04] ${form.cliente_id === c.id ? 'bg-emerald-400/[0.06]' : ''}`}
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${form.cliente_id === c.id ? 'bg-emerald-400' : 'bg-white/15'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white/90">{c.nombre}</p>
                          <p className="text-[10px] text-white/35">{c.telefono || 'Sin tel.'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {clienteSeleccionado && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                      <p className="truncate text-sm font-semibold text-emerald-200">{clienteSeleccionado.nombre}</p>
                    </div>
                    <button type="button" onClick={resetForm} className="shrink-0 text-white/30 hover:text-white transition">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Plantillas */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-white/35">Plantilla</label>
                <div className="space-y-1">
                  {[
                    { p: 'pago_deuda'        as PlantillaWhatsApp, icon: '💰', label: 'Pago deuda',      active: 'border-rose-400/25 bg-rose-400/[0.07] text-rose-300',     inactive: 'border-white/[0.06] bg-white/[0.015] text-white/55 hover:border-white/10 hover:text-white/80' },
                    { p: 'bienvenida_cliente' as PlantillaWhatsApp, icon: '👋', label: 'Bienvenida',      active: 'border-violet-400/25 bg-violet-400/[0.07] text-violet-300', inactive: 'border-white/[0.06] bg-white/[0.015] text-white/55 hover:border-white/10 hover:text-white/80' },
                    { p: 'plan_por_vencer'   as PlantillaWhatsApp, icon: '📉', label: 'Plan por vencer', active: 'border-sky-400/25 bg-sky-400/[0.07] text-sky-300',         inactive: 'border-white/[0.06] bg-white/[0.015] text-white/55 hover:border-white/10 hover:text-white/80' },
                  ].map(opt => (
                    <button
                      key={opt.p}
                      type="button"
                      disabled={plantillaLoading}
                      onClick={() => void aplicarPlantilla(opt.p)}
                      className={`flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 ${form.plantilla === opt.p ? opt.active : opt.inactive}`}
                    >
                      <span className="text-base">{opt.icon}</span>
                      <span className="flex-1 text-left">{opt.label}</span>
                      {form.plantilla === opt.p && !plantillaLoading && <span className="text-[10px] opacity-60">✓ activa</span>}
                      {plantillaLoading && form.plantilla === opt.p && <span className="text-[10px] opacity-50">cargando…</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-white/[0.05]" />

              {/* Título */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-white/35">Título</label>
                <input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ej: Recordatorio de pago" className={inp} />
              </div>

              {/* Destino manual */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-white/35">Destino manual</label>
                <p className="mb-1.5 text-[11px] text-white/30">Opcional — sobreescribe el teléfono del cliente</p>
                <input value={form.destino_manual} onChange={e => setForm(p => ({ ...p, destino_manual: e.target.value }))} placeholder="+58 412 000 0000" className={inp} />
              </div>

              {/* Destino final */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-white/35">Destino final</label>
                <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-2.5 font-mono text-sm text-white/45">
                  {destinoFinal || <span className="italic text-white/20">sin destino configurado</span>}
                </div>
              </div>

              {/* Mensaje */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-white/35">Mensaje</label>
                <textarea
                  rows={7}
                  value={form.mensaje}
                  onChange={e => setForm(p => ({ ...p, mensaje: e.target.value }))}
                  placeholder="Escribe o aplica una plantilla arriba..."
                  className={`${inp} resize-none`}
                />
              </div>

              {/* Botones */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleGuardar as any}
                  disabled={saving}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-50"
                >
                  {saving ? 'Guardando…' : 'Guardar borrador'}
                </button>
                <button
                  type="button"
                  onClick={handleEnviar}
                  disabled={sending}
                  className="flex-1 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/15 disabled:opacity-50"
                >
                  {sending ? 'Enviando…' : '↗ Enviar'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ════ HISTORIAL ════ */}
        <div className="space-y-4">

          {/* búsqueda + filtros */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Buscar en historial…"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05]"
                />
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen(v => !v)}
                className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                  filtersOpen || estadoFiltro !== 'todos'
                    ? 'border-violet-400/25 bg-violet-400/10 text-violet-300'
                    : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.05] hover:text-white/80'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
              </button>
              {hayFiltros && (
                <button type="button" onClick={limpiarFiltros} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/50 transition hover:text-white/80">
                  Limpiar
                </button>
              )}
            </div>

            {filtersOpen && (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/35">Estado</label>
                  <select value={estadoFiltro} onChange={e => { setEstadoFiltro(e.target.value as EstadoFiltro); setPage(1) }} className={inp}>
                    <option value="todos"     className="bg-[#11131a]">Todos</option>
                    <option value="enviado"   className="bg-[#11131a]">Enviado</option>
                    <option value="borrador"  className="bg-[#11131a]">Borrador</option>
                    <option value="cancelado" className="bg-[#11131a]">Cancelado</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-[11px] text-white/30">
                {comunicacionesFiltradas.length === comunicaciones.length
                  ? `${comunicaciones.length} mensajes`
                  : `${comunicacionesFiltradas.length} de ${comunicaciones.length} mensajes`}
                {hayFiltros && <span className="ml-1 text-violet-400/70">· filtrado</span>}
              </p>
            </div>
          </div>

          {/* lista */}
          {loading ? (
            <div className="flex min-h-[20vh] items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
                <p className="text-sm text-white/30">Cargando historial…</p>
              </div>
            </div>
          ) : comunicacionesFiltradas.length === 0 ? (
            <div className="flex min-h-[16vh] items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.01]">
              <div className="text-center">
                <p className="text-sm font-medium text-white/40">Sin resultados</p>
                <p className="mt-1 text-xs text-white/25">
                  {filtroCliente ? `No hay mensajes para ${filtroCliente.nombre}` : 'Intenta con otros filtros'}
                </p>
                {hayFiltros && (
                  <button type="button" onClick={limpiarFiltros} className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/60 transition hover:bg-white/[0.06]">
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {comunicsPagina.map(c => (
                <ComunicacionCard
                  key={c.id}
                  item={c}
                  expanded={expandedIds.has(c.id)}
                  onToggle={() => toggleCard(c.id)}
                  onReenviar={() => void reenviar(c)}
                  sending={reSendingId === c.id}
                />
              ))}
            </div>
          )}

          {/* paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-white/30">{comunicacionesFiltradas.length} mensajes · página {page}/{totalPages}</p>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
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
                <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/[0.06] disabled:opacity-30">→</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}