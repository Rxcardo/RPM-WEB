'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  MessageCircle,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldAlert,
  TimerReset,
} from 'lucide-react'

type Empleado  = { id: string; nombre: string }
type Cliente   = { id: string; nombre: string | null; telefono: string | null }

type Cita = {
  id: string
  cliente_id?: string | null
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: string
  notas: string | null
  clientes?: Cliente | null
}

type AsistenciaEstado = 'pendiente' | 'asistio' | 'no_asistio_aviso' | 'no_asistio_sin_aviso'

type Sesion = {
  id: string
  cliente_plan_id: string | null
  cliente_id: string | null
  empleado_id: string | null
  recurso_id: string | null
  fecha: string | null
  hora_inicio: string | null
  hora_fin: string | null
  estado: string | null
  asistencia_estado: AsistenciaEstado | null
  aviso_previo: boolean | null
  consume_sesion: boolean | null
  reprogramable: boolean | null
  motivo_asistencia: string | null
  fecha_asistencia: string | null
  plan_estado?: string | null
  sesiones_totales?: number | null
  sesiones_usadas?: number | null
}

type ClienteMap = Record<string, Cliente>
type Toast      = { type: 'ok' | 'error'; text: string } | null

type AgendaItem =
  | { tipo: 'cita';   id: string; hora: string; estado: string;           cliente: string; telefono: string | null; raw: Cita }
  | { tipo: 'sesion'; id: string; hora: string; estado: AsistenciaEstado; cliente: string; telefono: string | null; raw: Sesion }

const asistenciaOptions: { value: AsistenciaEstado; label: string; hint: string; icon: React.ElementType }[] = [
  { value: 'asistio',              label: 'Asistió',   hint: 'Consume sesión', icon: CheckCircle2 },
  { value: 'no_asistio_aviso',     label: 'Avisó',     hint: 'No consume',    icon: TimerReset   },
  { value: 'no_asistio_sin_aviso', label: 'Sin aviso', hint: 'Consume sesión', icon: ShieldAlert  },
  { value: 'pendiente',            label: 'Pendiente', hint: 'Revertir',      icon: RefreshCcw   },
]

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function onlyHour(value?: string | null) {
  return (value || '').slice(0, 5) || '—'
}

function wa(phone?: string | null) {
  const clean = (phone || '').replace(/[^0-9]/g, '')
  return clean ? `https://wa.me/${clean}` : '#'
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function asistenciaLabel(value?: string | null) {
  switch ((value || 'pendiente').toLowerCase()) {
    case 'asistio':              return 'Asistió'
    case 'no_asistio_aviso':     return 'Avisó'
    case 'no_asistio_sin_aviso': return 'Sin aviso'
    default:                     return 'Pendiente'
  }
}

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function formatDateLabel(value: string) {
  if (!value) return 'Fecha'
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  return new Intl.DateTimeFormat('es-VE', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
  }).format(date)
}

function moveDate(value: string, days: number) {
  const base = value || todayKey()
  const [year, month, day] = base.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isDone(item: AgendaItem) {
  if (item.tipo === 'cita') return ['completada', 'cancelada'].includes((item.estado || '').toLowerCase())
  return (item.estado || 'pendiente') !== 'pendiente'
}

/* ── Badge helpers ─────────────────────────────────────────── */
type BadgeVariant = 'green' | 'amber' | 'red' | 'blue' | 'muted'

function asistenciaBadgeVariant(value?: string | null): BadgeVariant {
  switch ((value || 'pendiente').toLowerCase()) {
    case 'asistio':              return 'green'
    case 'no_asistio_aviso':     return 'amber'
    case 'no_asistio_sin_aviso': return 'red'
    default:                     return 'muted'
  }
}

function citaBadgeVariant(value?: string | null): BadgeVariant {
  switch ((value || '').toLowerCase()) {
    case 'completada':  return 'green'
    case 'cancelada':   return 'red'
    case 'confirmada':  return 'blue'
    case 'reprogramada': return 'amber'
    default:            return 'muted'
  }
}

const badgeStyles: Record<BadgeVariant, React.CSSProperties> = {
  green: { background: 'rgba(52,211,153,0.1)',  border: '1px solid rgba(52,211,153,0.25)',  color: 'var(--green)'  },
  amber: { background: 'rgba(251,191,36,0.1)',  border: '1px solid rgba(251,191,36,0.25)',  color: '#d97706'       },
  red:   { background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: 'var(--red)'    },
  blue:  { background: 'rgba(56,189,248,0.1)',  border: '1px solid rgba(56,189,248,0.25)',  color: '#0284c7'       },
  muted: { background: 'var(--purple-soft)',     border: '1px solid var(--border)',           color: 'var(--text-sub)' },
}

function Badge({ variant, label }: { variant: BadgeVariant; label: string }) {
  return (
    <span
      style={{
        ...badgeStyles[variant],
        display: 'inline-flex', alignItems: 'center',
        borderRadius: '100px', padding: '2px 8px',
        fontSize: '10px', fontWeight: 700, letterSpacing: '0.03em',
      }}
    >
      {label}
    </span>
  )
}

/* ── Tipo pill ──────────────────────────────────────────────── */
function TipoPill({ tipo }: { tipo: 'sesion' | 'cita' }) {
  return (
    <span style={{
      fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', padding: '2px 6px',
      borderRadius: '100px', background: 'var(--surface2)',
      border: '1px solid var(--border)', color: 'var(--text-sub)',
    }}>
      {tipo === 'sesion' ? 'Sesión' : 'Cita'}
    </span>
  )
}

export default function EmpleadoAgendaPage() {
  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  )

  const [empleado, setEmpleado]   = useState<Empleado | null>(null)
  const [citas, setCitas]         = useState<Cita[]>([])
  const [sesiones, setSesiones]   = useState<Sesion[]>([])
  const [clientes, setClientes]   = useState<ClienteMap>({})
  const [busy, setBusy]           = useState<string | null>(null)
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState<Toast>(null)
  const [openId, setOpenId]       = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [selectedDate, setSelectedDate] = useState(todayKey())

  async function load(keepOpen = true) {
    setLoading(true)
    setToast(null)

    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) { setLoading(false); return }

    const { data: emp, error: empError } = await supabase
      .from('empleados').select('id,nombre').eq('auth_user_id', user.id).maybeSingle()

    if (empError || !emp) {
      setToast({ type: 'error', text: empError?.message || 'No se encontró el empleado vinculado.' })
      setLoading(false)
      return
    }

    setEmpleado(emp as Empleado)
    const fechaConsulta = selectedDate || todayKey()

    const [{ data: citasData, error: citasError }, { data: sesionesData, error: sesionesError }] = await Promise.all([
      supabase
        .from('citas')
        .select('id,cliente_id,fecha,hora_inicio,hora_fin,estado,notas,clientes:cliente_id(id,nombre,telefono)')
        .eq('terapeuta_id', emp.id)
        .eq('fecha', fechaConsulta)
        .order('hora_inicio'),
      supabase
        .from('v_entrenamientos_plan_asistencia')
        .select('*')
        .eq('empleado_id', emp.id)
        .eq('fecha', fechaConsulta)
        .order('hora_inicio'),
    ])

    if (citasError)   setToast({ type: 'error', text: citasError.message })
    if (sesionesError) setToast({ type: 'error', text: sesionesError.message })

    const sesionesNorm = ((sesionesData || []) as any[]) as Sesion[]
    const ids = Array.from(new Set(sesionesNorm.map((s) => s.cliente_id).filter(Boolean))) as string[]

    let clientesMap: ClienteMap = {}
    if (ids.length) {
      const { data: clientesData } = await supabase.from('clientes').select('id,nombre,telefono').in('id', ids)
      clientesMap = Object.fromEntries(((clientesData || []) as Cliente[]).map((c) => [c.id, c]))
    }

    setClientes(clientesMap)
    setCitas((citasData || []) as any)
    setSesiones(sesionesNorm)
    if (!keepOpen) setOpenId(null)
    setLoading(false)
  }

  useEffect(() => { void load(false) }, [selectedDate])

  async function completarCita(id: string) {
    setBusy(id)
    setToast(null)
    const { error } = await supabase
      .from('citas')
      .update({ estado: 'completada', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) setToast({ type: 'error', text: error.message })
    else setToast({ type: 'ok', text: 'Cita marcada como completada.' })
    await load()
    setOpenId(null)
    setBusy(null)
  }

  async function marcarSesion(id: string, estado: AsistenciaEstado) {
    setBusy(`${id}:${estado}`)
    setToast(null)
    const { error } = await supabase.rpc('marcar_asistencia_entrenamiento', {
      p_entrenamiento_id: id,
      p_asistencia_estado: estado,
      p_motivo: null,
      p_marcado_por: null,
    })
    if (error) setToast({ type: 'error', text: error.message || 'No se pudo marcar la asistencia.' })
    else setToast({ type: 'ok', text: `Sesión actualizada: ${asistenciaLabel(estado)}.` })
    await load()
    setOpenId(null)
    setBusy(null)
  }

  const agendaItems = useMemo<AgendaItem[]>(() => {
    const citaItems: AgendaItem[] = citas.map((cita) => ({
      tipo: 'cita', id: `cita:${cita.id}`, hora: cita.hora_inicio,
      estado: cita.estado, cliente: cita.clientes?.nombre || 'Cliente',
      telefono: cita.clientes?.telefono || null, raw: cita,
    }))
    const sesionItems: AgendaItem[] = sesiones.map((sesion) => {
      const cliente = sesion.cliente_id ? clientes[sesion.cliente_id] : null
      return {
        tipo: 'sesion', id: `sesion:${sesion.id}`, hora: sesion.hora_inicio || '',
        estado: (sesion.asistencia_estado || 'pendiente') as AsistenciaEstado,
        cliente: cliente?.nombre || 'Sesión programada',
        telefono: cliente?.telefono || null, raw: sesion,
      }
    })
    return [...citaItems, ...sesionItems].sort((a, b) => {
      const doneDiff = Number(isDone(a)) - Number(isDone(b))
      if (doneDiff !== 0) return doneDiff
      return (a.hora || '').localeCompare(b.hora || '')
    })
  }, [citas, sesiones, clientes])

  const filteredItems = useMemo(() => {
    const q = normalize(search.trim())
    if (!q) return agendaItems
    return agendaItems.filter((item) => {
      const estado = item.tipo === 'sesion' ? asistenciaLabel(item.estado) : item.estado
      return normalize(`${item.cliente} ${item.hora} ${estado} ${item.tipo}`).includes(q)
    })
  }, [agendaItems, search])

  const totalActividades = citas.length + sesiones.length
  const pendientes = sesiones.filter((s) => (s.asistencia_estado || 'pendiente') === 'pendiente').length
  const marcadas   = sesiones.filter((s) => (s.asistencia_estado || 'pendiente') !== 'pendiente').length
  const isToday    = selectedDate === todayKey()

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-3 pb-5 sm:space-y-4 lg:max-w-[980px] xl:max-w-[1080px]">

      {/* ── HEADER ── */}
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="rpm-label truncate">{empleado?.nombre || 'Empleado'}</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl lg:text-[1.9rem]">Agenda</h1>
          <p className="rpm-muted mt-0.5 text-xs font-semibold capitalize">{formatDateLabel(selectedDate)}</p>
        </div>
        <button
          type="button"
          onClick={() => load(false)}
          disabled={loading}
          className="glass-card flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold transition disabled:opacity-40"
          style={{ color: 'var(--accent)' }}
        >
          <RotateCcw className={cx('h-3.5 w-3.5', loading ? 'animate-spin' : '')} />
          Actualizar
        </button>
      </header>

      {/* ── TOAST ── */}
      {toast && (
        <div
          style={toast.type === 'ok'
            ? { background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', color: 'var(--green)' }
            : { background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: 'var(--red)' }
          }
          className="rounded-2xl px-4 py-2.5 text-xs font-bold"
        >
          {toast.text}
        </div>
      )}

      {/* ── RESUMEN ── */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: 'Actividades', val: totalActividades },
          { label: 'Sesiones',    val: sesiones.length },
          { label: 'Pendientes',  val: pendientes },
          { label: 'Marcadas',    val: marcadas },
        ].map(({ label, val }) => (
          <div key={label} className="glass-card rounded-[1.1rem] p-3 text-center">
            <p className="rpm-label" style={{ fontSize: '9px' }}>{label}</p>
            <p className="mt-1.5 text-2xl font-black">{val}</p>
          </div>
        ))}
      </section>

      {/* ── SELECTOR DE FECHA ── */}
      <section className="glass-card flex flex-wrap items-center justify-between gap-2 rounded-[1.15rem] p-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <label
            title="Seleccionar fecha"
            className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl"
            style={{ background: 'var(--purple-soft)', border: '1px solid var(--border-hover)' }}
          >
            <CalendarDays className="pointer-events-none h-4 w-4" style={{ color: 'var(--accent)' }} />
            <input
              aria-label="Seleccionar fecha"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value || todayKey())}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <div className="min-w-0">
            <p className="text-sm font-black capitalize leading-tight">{formatDateLabel(selectedDate)}</p>
            {isToday && (
              <p className="rpm-label" style={{ fontSize: '9px' }}>Hoy</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {[
            { label: 'Ayer',    delta: -1 },
            { label: 'Hoy',     delta:  0 },
            { label: 'Mañana',  delta: +1 },
          ].map(({ label, delta }) => {
            const isActive = delta === 0 && isToday
            return (
              <button
                key={label}
                type="button"
                onClick={() => delta === 0 ? setSelectedDate(todayKey()) : setSelectedDate((prev) => moveDate(prev, delta))}
                className="rounded-xl px-3 py-1.5 text-xs font-bold transition"
                style={isActive
                  ? { background: 'var(--purple)', color: '#fff', border: '1px solid transparent' }
                  : { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text-sub)' }
                }
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── BUSCADOR ── */}
      <label
        className="glass-card flex items-center gap-2.5 rounded-[1.1rem] px-3.5 py-2.5"
        style={{ cursor: 'text' }}
      >
        <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--text-sub)' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente, hora o estado..."
          className="w-full bg-transparent text-sm font-semibold outline-none"
          style={{ color: 'var(--text)' }}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="shrink-0 text-xs font-bold"
            style={{ color: 'var(--text-sub)' }}
          >
            Limpiar
          </button>
        )}
      </label>

      {/* ── LISTA ── */}
      {loading ? (
        <div className="glass-card rounded-[1.3rem] p-5 text-sm font-semibold rpm-muted">
          Cargando agenda...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="glass-card rounded-[1.3rem] p-5">
          <p className="text-sm font-semibold rpm-muted">
            {search ? 'Sin resultados para esa búsqueda.' : 'No hay actividades para esta fecha.'}
          </p>
        </div>
      ) : (
        <section className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => {
            const abierto    = openId === item.id
            const isSesion   = item.tipo === 'sesion'
            const sesion     = isSesion ? (item.raw as Sesion) : null
            const cita       = !isSesion ? (item.raw as Cita) : null
            const statusLabel = isSesion ? asistenciaLabel(item.estado) : item.estado
            const badgeVariant = isSesion ? asistenciaBadgeVariant(item.estado) : citaBadgeVariant(item.estado)
            const done       = isDone(item)

            return (
              <article
                key={item.id}
                className="glass-card overflow-hidden rounded-[1.25rem] transition"
                style={abierto ? { borderColor: 'var(--border-hover)', boxShadow: '0 0 0 1px var(--border-hover), var(--shadow-card)' } : {}}
              >
                {/* ── Row principal ── */}
                <button
                  type="button"
                  onClick={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition"
                  style={done ? { opacity: 0.6 } : {}}
                >
                  {/* Hora */}
                  <div
                    className="flex shrink-0 flex-col items-center justify-center rounded-xl"
                    style={{ width: 44, height: 44, background: 'var(--surface2)', border: '1px solid var(--border)' }}
                  >
                    <span className="text-sm font-black leading-none">{onlyHour(item.hora)}</span>
                    <span className="mt-0.5 text-[9px] font-bold" style={{ color: 'var(--text-sub)' }}>
                      {isSesion ? onlyHour(sesion?.hora_fin) : onlyHour(cita?.hora_fin)}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-black">{item.cliente}</p>
                      <TipoPill tipo={item.tipo} />
                    </div>
                    <div className="mt-1">
                      <Badge variant={badgeVariant} label={statusLabel} />
                    </div>
                  </div>

                  {/* WhatsApp */}
                  {item.telefono && (
                    <a
                      href={wa(item.telefono)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition hover:scale-105"
                      style={{ background: 'var(--purple-soft)', border: '1px solid var(--border-hover)' }}
                      title="WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    </a>
                  )}
                </button>

                {/* ── Panel expandido ── */}
                {abierto && (
                  <div
                    className="px-4 pb-4 pt-0"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <div className="pt-3">
                      {isSesion && sesion ? (
                        <div className="grid grid-cols-2 gap-2">
                          {asistenciaOptions.map((option) => {
                            const Icon   = option.icon
                            const active = (sesion.asistencia_estado || 'pendiente') === option.value
                            const isBusy = busy === `${sesion.id}:${option.value}`

                            return (
                              <button
                                key={option.value}
                                disabled={isBusy || active}
                                onClick={() => marcarSesion(sesion.id, option.value)}
                                className="flex min-h-[46px] flex-col justify-center rounded-xl px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40"
                                style={active
                                  ? { background: 'var(--purple)', border: '1px solid transparent', color: '#fff' }
                                  : { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }
                                }
                              >
                                <span className="flex items-center gap-1.5 text-[11px] font-black">
                                  <Icon className="h-3.5 w-3.5" /> {option.label}
                                </span>
                                <span
                                  className="mt-0.5 block text-[9px] font-bold"
                                  style={{ color: active ? 'rgba(255,255,255,0.6)' : 'var(--text-sub)' }}
                                >
                                  {option.hint}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      ) : cita ? (
                        <div className="space-y-2">
                          {cita.notas && (
                            <p className="line-clamp-2 text-xs rpm-muted">{cita.notas}</p>
                          )}
                          <button
                            disabled={busy === cita.id || cita.estado === 'completada'}
                            onClick={() => completarCita(cita.id)}
                            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40"
                            style={cita.estado === 'completada'
                              ? { background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: 'var(--green)' }
                              : { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }
                            }
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {cita.estado === 'completada' ? 'Completada' : 'Marcar completada'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}