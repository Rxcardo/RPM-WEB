'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import {
  CalendarDays,
  WalletCards,
  MessageCircle,
  UserRound,
  ArrowRight,
  Clock,
  ChevronRight,
  Dumbbell,
  Stethoscope,
} from 'lucide-react'

type Empleado = { id: string; nombre: string; rol: string | null }

type EstadoCuenta = {
  total_facturado_usd: number | null
  total_pagado_usd: number | null
  saldo_pendiente_neto_usd: number | null
}

type Sesion = {
  id: string
  fecha: string
  hora_inicio: string | null
  asistencia_estado: string | null
}

type Cita = {
  id: string
  fecha: string
  hora_inicio: string
  estado: string
}

type QuincenaData = {
  resumen?: {
    total_pagado_usd?: number | null
    total_pendiente_usd?: number | null
    saldo_pendiente_neto_usd?: number | null
  }
  detalle?: any[]
  pagos?: any[]
}

function num(v: any) {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function r2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

function money(n: number | null | undefined) {
  return `$${Number(n || 0).toFixed(2)}`
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function formatDateLong() {
  return new Date().toLocaleDateString('es-VE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function greet(nombre: string) {
  const h = new Date().getHours()
  const first = nombre.split(' ')[0]
  if (h < 12) return `Buenos días, ${first}`
  if (h < 18) return `Buenas tardes, ${first}`
  return `Buenas noches, ${first}`
}

function formatHora(h: string | null) {
  if (!h) return ''
  return h.slice(0, 5)
}

function calcPendienteFisio(q: QuincenaData | null) {
  const detalle = Array.isArray(q?.detalle) ? q!.detalle! : []
  const pagos = Array.isArray(q?.pagos) ? q!.pagos! : []
  const map = new Map<string, any>()
  ;[...detalle, ...pagos].forEach((row, i) => {
    const id = String(row?.id || row?.comision_id || `row-${i}`)
    if (!map.has(id)) map.set(id, row)
  })
  let total = 0
  map.forEach((row) => {
    const pagado = row?.pagado === true || row?.paid === true
    const estado = String(row?.estado || '').toLowerCase()
    const isLiq = ['liquidado', 'liquidada', 'pagado', 'pagada', 'cobrada'].includes(estado)
    if (!pagado && !isLiq) {
      const neto = Number(row?.monto_profesional_neto_usd ?? NaN)
      if (Number.isFinite(neto)) {
        total += Math.max(neto, 0)
      } else {
        const bruto = num(row?.monto_profesional_usd ?? row?.profesional ?? 0)
        const desc = num(row?.descuento_deuda_usd ?? 0)
        total += Math.max(bruto - desc, 0)
      }
    }
  })
  return r2(total)
}

const quickLinks = [
  { href: '/empleado/agenda',   label: 'Agenda',   icon: CalendarDays, desc: 'Citas y sesiones' },
  { href: '/empleado/quincena', label: 'Quincena', icon: WalletCards,  desc: 'Comisiones' },
  { href: '/empleado/chat',     label: 'Chat',     icon: MessageCircle, desc: 'Mensajes' },
  { href: '/empleado/perfil',   label: 'Perfil',   icon: UserRound,    desc: 'Mis datos' },
]

export default function EmpleadoInicioPage() {
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  const [empleado, setEmpleado] = useState<Empleado | null>(null)
  const [estado, setEstado] = useState<EstadoCuenta | null>(null)
  const [quincena, setQuincena] = useState<QuincenaData | null>(null)
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [citas, setCitas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) { setLoading(false); return }

      const { data: emp } = await supabase
        .from('empleados')
        .select('id,nombre,rol')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (!mounted || !emp) { setLoading(false); return }
      setEmpleado(emp)

      const hoy = todayKey()

      const [{ data: est }, { data: ses }, { data: cit }, qRes] = await Promise.all([
        supabase.from('v_empleados_estado_cuenta').select('*').eq('empleado_id', emp.id).maybeSingle(),
        supabase.from('v_entrenamientos_plan_asistencia').select('id,fecha,hora_inicio,asistencia_estado').eq('empleado_id', emp.id).eq('fecha', hoy).order('hora_inicio'),
        supabase.from('citas').select('id,fecha,hora_inicio,estado').eq('terapeuta_id', emp.id).eq('fecha', hoy).order('hora_inicio'),
        fetch('/api/empleado/quincena?periodo=actual', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      ])

      if (!mounted) return
      setEstado(est as EstadoCuenta | null)
      setSesiones((ses || []) as Sesion[])
      setCitas((cit || []) as Cita[])
      setQuincena(qRes as QuincenaData | null)
      setLoading(false)
    }

    load()
    return () => { mounted = false }
  }, [supabase])

  const pendienteFisio = calcPendienteFisio(quincena)
  const pagadoQuincena = num(quincena?.resumen?.total_pagado_usd ?? estado?.total_pagado_usd)
  const deuda = num(quincena?.resumen?.saldo_pendiente_neto_usd ?? estado?.saldo_pendiente_neto_usd)

  // Merge citas + sesiones sorted by hour
  type ActivityItem = { id: string; hora: string; label: string; tipo: 'cita' | 'sesion'; estado: string }
  const activities: ActivityItem[] = [
    ...sesiones.map(s => ({ id: s.id, hora: formatHora(s.hora_inicio), label: 'Entrenamiento', tipo: 'sesion' as const, estado: s.asistencia_estado || 'pendiente' })),
    ...citas.map(c => ({ id: c.id, hora: formatHora(c.hora_inicio), label: 'Cita', tipo: 'cita' as const, estado: c.estado })),
  ].sort((a, b) => a.hora.localeCompare(b.hora))

  const totalHoy = activities.length
  const nextActivity = activities[0] ?? null

  return (
    <div className="mx-auto w-full max-w-[430px] space-y-3 pb-4 md:max-w-[900px]">

      {/* ── Header ── */}
      <header className="flex items-start justify-between gap-4 pb-1">
        <div>
          <p className="rpm-label">{formatDateLong()}</p>
          <h1 className="mt-1.5 text-[1.7rem] font-black tracking-tight leading-tight">
            {loading || !empleado ? 'Cargando…' : greet(empleado.nombre)}
          </h1>
          {empleado?.rol && (
            <p className="mt-0.5 text-xs rpm-muted font-medium capitalize">{empleado.rol}</p>
          )}
        </div>

        <Link
          href="/empleado/perfil"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
        >
          <UserRound className="h-4.5 w-4.5" style={{ color: 'var(--accent)' }} />
        </Link>
      </header>

      <div className="md:grid md:grid-cols-[1fr_340px] md:gap-4 md:items-start">
        <div className="space-y-3">

          {/* ── Hoy ── */}
          <section className="glass-card overflow-hidden rounded-[1.1rem]">
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div>
                <p className="text-sm font-black">Hoy</p>
                <p className="mt-0.5 text-xs rpm-muted">
                  {loading ? '—' : totalHoy === 0 ? 'Sin actividades' : `${totalHoy} actividad${totalHoy !== 1 ? 'es' : ''}`}
                </p>
              </div>

              <Link
                href="/empleado/agenda"
                className="flex items-center gap-1 text-xs font-bold"
                style={{ color: 'var(--accent)' }}
              >
                Ver todo <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="px-4 py-5 text-xs rpm-muted">Cargando agenda…</div>
            ) : activities.length === 0 ? (
              <div className="px-4 py-5">
                <p className="text-sm font-semibold rpm-muted">Día libre — sin agenda hoy</p>
              </div>
            ) : (
              <div>
                {activities.map((act, idx) => (
                  <div
                    key={act.id}
                    className="flex items-center gap-3 px-4 py-3"
                    style={idx > 0 ? { borderTop: '1px solid var(--border)' } : {}}
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        background: act.tipo === 'cita'
                          ? 'rgba(56,189,248,0.1)'
                          : 'rgba(139,120,244,0.1)',
                      }}
                    >
                      {act.tipo === 'cita'
                        ? <Stethoscope className="h-4 w-4" style={{ color: '#38bdf8' }} />
                        : <Dumbbell className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                      }
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{act.label}</p>
                      <div className="mt-0.5 flex items-center gap-1 rpm-muted">
                        <Clock className="h-3 w-3" />
                        <span className="text-xs font-semibold">{act.hora || '—'}</span>
                      </div>
                    </div>

                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      style={{
                        background: act.estado === 'asistio' || act.estado === 'confirmada'
                          ? 'rgba(52,211,153,0.1)'
                          : 'rgba(255,255,255,0.05)',
                        color: act.estado === 'asistio' || act.estado === 'confirmada'
                          ? 'var(--green)'
                          : 'var(--text-sub)',
                        border: '1px solid transparent',
                      }}
                    >
                      {act.estado === 'asistio' ? 'Asistió' : act.estado === 'confirmada' ? 'Confirmada' : 'Pendiente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Quick links ── */}
          <section className="grid grid-cols-2 gap-2.5">
            {quickLinks.map(({ href, label, icon: Icon, desc }) => (
              <Link
                key={href}
                href={href}
                className="glass-card flex flex-col gap-3 rounded-[1.1rem] p-4"
              >
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: 'var(--purple-soft)' }}
                >
                  <Icon className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <p className="text-sm font-black">{label}</p>
                  <p className="mt-0.5 text-xs rpm-muted">{desc}</p>
                </div>
              </Link>
            ))}
          </section>

        </div>

        {/* ── Sidebar: Quincena ── */}
        <aside className="mt-3 md:mt-0 space-y-2.5">
          <section className="glass-card rounded-[1.1rem] overflow-hidden">
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <p className="text-sm font-black">Quincena actual</p>
              <Link href="/empleado/quincena" style={{ color: 'var(--accent)' }}>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as any}>
              {[
                { label: 'Pagado', val: pagadoQuincena, color: 'var(--green)' },
                { label: 'Pendiente fisio', val: pendienteFisio, color: pendienteFisio > 0 ? '#fbbf24' : undefined },
                { label: 'Deuda', val: deuda, color: deuda > 0 ? 'var(--red)' : undefined },
              ].map(({ label, val, color }) => (
                <div
                  key={label}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <p className="text-xs rpm-muted font-semibold">{label}</p>
                  <p
                    className="text-sm font-black tabular-nums"
                    style={color ? { color } : {}}
                  >
                    {loading ? '—' : money(val)}
                  </p>
                </div>
              ))}
            </div>

            <div className="px-4 pb-4 pt-2">
              <Link
                href="/empleado/quincena"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold"
                style={{ background: 'var(--purple-soft)', color: 'var(--accent)' }}
              >
                Ver comisiones <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </section>

          {/* ── Totals hoy ── */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="glass-card rounded-[1.1rem] p-4 text-center">
              <p className="rpm-label" style={{ fontSize: '9px' }}>Sesiones</p>
              <p className="mt-2 text-2xl font-black">{loading ? '—' : sesiones.length}</p>
              <p className="mt-0.5 text-[10px] rpm-muted">hoy</p>
            </div>
            <div className="glass-card rounded-[1.1rem] p-4 text-center">
              <p className="rpm-label" style={{ fontSize: '9px' }}>Citas</p>
              <p className="mt-2 text-2xl font-black">{loading ? '—' : citas.length}</p>
              <p className="mt-0.5 text-[10px] rpm-muted">hoy</p>
            </div>
          </div>
        </aside>
      </div>

    </div>
  )
}
