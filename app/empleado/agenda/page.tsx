'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  MessageCircle,
  RefreshCcw,
  Search,
  ShieldAlert,
  TimerReset,
} from 'lucide-react'

type Empleado = { id: string; nombre: string }
type Cliente = { id: string; nombre: string | null; telefono: string | null }

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
type Toast = { type: 'ok' | 'error'; text: string } | null

type AgendaItem =
  | { tipo: 'cita'; id: string; hora: string; estado: string; cliente: string; telefono: string | null; raw: Cita }
  | { tipo: 'sesion'; id: string; hora: string; estado: AsistenciaEstado; cliente: string; telefono: string | null; raw: Sesion }

const asistenciaOptions: { value: AsistenciaEstado; label: string; hint: string; icon: any }[] = [
  { value: 'asistio', label: 'Asistió', hint: 'Consume sesión', icon: CheckCircle2 },
  { value: 'no_asistio_aviso', label: 'Avisó', hint: 'No consume', icon: TimerReset },
  { value: 'no_asistio_sin_aviso', label: 'Sin aviso', hint: 'Consume sesión', icon: ShieldAlert },
  { value: 'pendiente', label: 'Pendiente', hint: 'Revertir', icon: RefreshCcw },
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
    case 'asistio': return 'Asistió'
    case 'no_asistio_aviso': return 'Avisó'
    case 'no_asistio_sin_aviso': return 'Sin aviso'
    default: return 'Pendiente'
  }
}

function asistenciaBadge(value?: string | null) {
  switch ((value || 'pendiente').toLowerCase()) {
    case 'asistio': return 'border-emerald-400/30 bg-emerald-400/12 text-emerald-700 dark:text-emerald-200'
    case 'no_asistio_aviso': return 'border-amber-400/30 bg-amber-400/12 text-amber-700 dark:text-amber-200'
    case 'no_asistio_sin_aviso': return 'border-rose-400/30 bg-rose-400/12 text-rose-700 dark:text-rose-200'
    default: return 'border-[var(--line)] bg-white/20 text-[var(--muted)]'
  }
}

function citaBadge(value?: string | null) {
  switch ((value || '').toLowerCase()) {
    case 'completada': return 'border-emerald-400/30 bg-emerald-400/12 text-emerald-700 dark:text-emerald-200'
    case 'cancelada': return 'border-rose-400/30 bg-rose-400/12 text-rose-700 dark:text-rose-200'
    case 'confirmada': return 'border-sky-400/30 bg-sky-400/12 text-sky-700 dark:text-sky-200'
    case 'reprogramada': return 'border-amber-400/30 bg-amber-400/12 text-amber-700 dark:text-amber-200'
    default: return 'border-[var(--line)] bg-white/20 text-[var(--muted)]'
  }
}

function isDone(item: AgendaItem) {
  if (item.tipo === 'cita') return ['completada', 'cancelada'].includes((item.estado || '').toLowerCase())
  return (item.estado || 'pendiente') !== 'pendiente'
}

function normalize(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}


function formatDateLabel(value: string) {
  if (!value) return 'Fecha'
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, (month || 1) - 1, day || 1)
  return new Intl.DateTimeFormat('es-VE', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
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

export default function EmpleadoAgendaPage() {
  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  )

  const [empleado, setEmpleado] = useState<Empleado | null>(null)
  const [citas, setCitas] = useState<Cita[]>([])
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [clientes, setClientes] = useState<ClienteMap>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<Toast>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedDate, setSelectedDate] = useState(todayKey())

  async function load(keepOpen = true) {
    setLoading(true)
    setToast(null)

    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) {
      setLoading(false)
      return
    }

    const { data: emp, error: empError } = await supabase
      .from('empleados')
      .select('id,nombre')
      .eq('auth_user_id', user.id)
      .maybeSingle()

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

    if (citasError) setToast({ type: 'error', text: citasError.message })
    if (sesionesError) setToast({ type: 'error', text: sesionesError.message })

    const sesionesNormalizadas = ((sesionesData || []) as any[]) as Sesion[]
    const ids = Array.from(new Set(sesionesNormalizadas.map((s) => s.cliente_id).filter(Boolean))) as string[]

    let clientesMap: ClienteMap = {}
    if (ids.length) {
      const { data: clientesData } = await supabase.from('clientes').select('id,nombre,telefono').in('id', ids)
      clientesMap = Object.fromEntries(((clientesData || []) as Cliente[]).map((c) => [c.id, c]))
    }

    setClientes(clientesMap)
    setCitas((citasData || []) as any)
    setSesiones(sesionesNormalizadas)
    if (!keepOpen) setOpenId(null)
    setLoading(false)
  }

  useEffect(() => {
    void load(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

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

    if (error) {
      setToast({ type: 'error', text: error.message || 'No se pudo marcar la asistencia.' })
    } else {
      setToast({ type: 'ok', text: `Sesión actualizada: ${asistenciaLabel(estado)}.` })
    }

    await load()
    setOpenId(null)
    setBusy(null)
  }

  const agendaItems = useMemo<AgendaItem[]>(() => {
    const citaItems: AgendaItem[] = citas.map((cita) => ({
      tipo: 'cita',
      id: `cita:${cita.id}`,
      hora: cita.hora_inicio,
      estado: cita.estado,
      cliente: cita.clientes?.nombre || 'Cliente',
      telefono: cita.clientes?.telefono || null,
      raw: cita,
    }))

    const sesionItems: AgendaItem[] = sesiones.map((sesion) => {
      const cliente = sesion.cliente_id ? clientes[sesion.cliente_id] : null
      return {
        tipo: 'sesion',
        id: `sesion:${sesion.id}`,
        hora: sesion.hora_inicio || '',
        estado: (sesion.asistencia_estado || 'pendiente') as AsistenciaEstado,
        cliente: cliente?.nombre || 'Sesión programada',
        telefono: cliente?.telefono || null,
        raw: sesion,
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
  const marcadas = sesiones.filter((s) => (s.asistencia_estado || 'pendiente') !== 'pendiente').length

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-3 pb-5 sm:space-y-4 lg:max-w-[980px] xl:max-w-[1080px]">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="rpm-muted truncate text-[11px] font-black uppercase tracking-[0.18em]">{empleado?.nombre || 'Empleado'}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight sm:text-3xl lg:text-[2rem]">Agenda</h1>
          <p className="rpm-muted mt-1 text-xs font-bold capitalize">{formatDateLabel(selectedDate)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => load(false)}
            disabled={loading}
            className="rounded-2xl border border-[var(--line)] bg-white/10 px-3 py-2 text-xs font-black text-[var(--text)] transition hover:bg-white/20 disabled:opacity-50"
          >
            Actualizar
          </button>
        </div>
      </header>

      {toast ? (
        <div
          className={cx(
            'rounded-2xl border px-3 py-2 text-xs font-bold',
            toast.type === 'ok'
              ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-700 dark:text-emerald-200'
              : 'border-rose-400/25 bg-rose-400/10 text-rose-700 dark:text-rose-200'
          )}
        >
          {toast.text}
        </div>
      ) : null}

      <section className="grid gap-2 lg:grid-cols-[1fr_330px]">
        <div className="purple-card rounded-[1.35rem] p-3.5 text-white sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <CalendarDays className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Resumen</p>
                <h2 className="mt-0.5 text-xl font-black leading-none sm:text-2xl">{totalActividades} actividades</h2>
              </div>
            </div>
            <p className="hidden text-right text-xs font-semibold capitalize text-white/60 sm:block">{formatDateLabel(selectedDate)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="glass-card rounded-[1.1rem] p-2.5">
            <p className="rpm-muted text-[10px] font-bold uppercase tracking-wide">Ses.</p>
            <p className="mt-0.5 text-lg font-black">{sesiones.length}</p>
          </div>
          <div className="glass-card rounded-[1.1rem] p-2.5">
            <p className="rpm-muted text-[10px] font-bold uppercase tracking-wide">Pend.</p>
            <p className="mt-0.5 text-lg font-black">{pendientes}</p>
          </div>
          <div className="glass-card rounded-[1.1rem] p-2.5">
            <p className="rpm-muted text-[10px] font-bold uppercase tracking-wide">Listas</p>
            <p className="mt-0.5 text-lg font-black">{marcadas}</p>
          </div>
        </div>
      </section>

      <section className="glass-card grid gap-2 rounded-[1.15rem] p-2.5 sm:grid-cols-[auto_1fr_auto_auto]">
        <button
          type="button"
          onClick={() => setSelectedDate((prev) => moveDate(prev, -1))}
          className="rounded-2xl border border-[var(--line)] bg-white/10 px-3 py-2 text-xs font-black transition hover:bg-white/20"
        >
          Ayer
        </button>
        <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-[var(--line)] bg-white/10 px-3 py-2">
          <CalendarDays className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value || todayKey())}
            className="w-full bg-transparent text-sm font-black outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => setSelectedDate(todayKey())}
          className={cx(
            'rounded-2xl border px-3 py-2 text-xs font-black transition',
            selectedDate === todayKey()
              ? 'border-[var(--purple)] bg-[var(--purple)] text-white'
              : 'border-[var(--line)] bg-white/10 hover:bg-white/20'
          )}
        >
          Hoy
        </button>
        <button
          type="button"
          onClick={() => setSelectedDate((prev) => moveDate(prev, 1))}
          className="rounded-2xl border border-[var(--line)] bg-white/10 px-3 py-2 text-xs font-black transition hover:bg-white/20"
        >
          Mañana
        </button>
      </section>

      <label className="glass-card flex items-center gap-2 rounded-[1.15rem] px-3 py-2.5">
        <Search className="h-4 w-4 text-[var(--muted)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente, hora o estado..."
          className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-[var(--muted)]/70"
        />
      </label>

      {loading ? (
        <div className="glass-card rounded-[1.3rem] p-4 text-sm font-semibold rpm-muted">Cargando agenda...</div>
      ) : filteredItems.length === 0 ? (
        <div className="glass-card rounded-[1.3rem] p-4 text-sm rpm-muted">No hay resultados.</div>
      ) : (
        <section className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => {
            const abierto = openId === item.id
            const isSesion = item.tipo === 'sesion'
            const sesion = isSesion ? item.raw as Sesion : null
            const cita = !isSesion ? item.raw as Cita : null
            const statusLabel = isSesion ? asistenciaLabel(item.estado) : item.estado
            const badgeClass = isSesion ? asistenciaBadge(item.estado) : citaBadge(item.estado)

            return (
              <article
                key={item.id}
                className={cx(
                  'glass-card overflow-hidden rounded-[1.25rem] transition',
                  abierto ? 'ring-2 ring-[var(--purple)]/25' : 'hover:-translate-y-0.5'
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
                  className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-black sm:text-[15px]">{item.cliente}</p>
                      <span className="shrink-0 rounded-full border border-[var(--line)] px-1.5 py-0.5 text-[9px] font-black uppercase text-[var(--muted)]">
                        {isSesion ? 'Sesión' : 'Cita'}
                      </span>
                    </div>
                    <p className="rpm-muted mt-1 flex items-center gap-1.5 text-[11px] font-semibold">
                      <Clock className="h-3.5 w-3.5" /> {onlyHour(item.hora)} - {onlyHour(isSesion ? sesion?.hora_fin : cita?.hora_fin)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={cx('rounded-full border px-2 py-1 text-[10px] font-black', badgeClass)}>{statusLabel}</span>
                    {item.telefono ? (
                      <a
                        href={wa(item.telefono)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[var(--purple)] text-white transition hover:scale-[1.03]"
                        title="WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                </button>

                {abierto ? (
                  <div className="border-t border-[var(--line)] px-3 pb-3 pt-2">
                    {isSesion && sesion ? (
                      <div className="grid grid-cols-2 gap-1.5">
                        {asistenciaOptions.map((option) => {
                          const Icon = option.icon
                          const active = (sesion.asistencia_estado || 'pendiente') === option.value
                          const disabled = busy === `${sesion.id}:${option.value}` || active

                          return (
                            <button
                              key={option.value}
                              disabled={disabled}
                              onClick={() => marcarSesion(sesion.id, option.value)}
                              className={cx(
                                'min-h-[42px] rounded-2xl border px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-45',
                                active
                                  ? 'border-[var(--purple)] bg-[var(--purple)] text-white shadow-[0_10px_24px_rgba(124,92,255,.22)]'
                                  : 'border-[var(--line)] bg-white/10 hover:bg-white/20'
                              )}
                            >
                              <span className="flex items-center gap-1.5 text-[11px] font-black">
                                <Icon className="h-3.5 w-3.5" /> {option.label}
                              </span>
                              <span className={cx('mt-0.5 block text-[9px] font-bold', active ? 'text-white/65' : 'rpm-muted')}>{option.hint}</span>
                            </button>
                          )
                        })}
                      </div>
                    ) : cita ? (
                      <div className="space-y-2">
                        {cita.notas ? <p className="rpm-muted line-clamp-2 text-xs">{cita.notas}</p> : null}
                        <button
                          disabled={busy === cita.id || cita.estado === 'completada'}
                          onClick={() => completarCita(cita.id)}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--line)] bg-white/10 px-3 py-2 text-xs font-black transition hover:bg-[var(--purple)] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {cita.estado === 'completada' ? 'Completada' : 'Marcar completada'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            )
          })}
        </section>
      )}
    </div>
  )
}
