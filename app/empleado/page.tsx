'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import {
  CalendarDays,
  WalletCards,
  MessageCircle,
  UserRound,
  GripVertical,
  ArrowRight,
  Clock,
  TrendingUp,
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

type CardKey = 'agenda' | 'quincena' | 'chat' | 'perfil'

type QuincenaApiData = {
  resumen?: {
    total_facturado_usd?: number | null
    total_pagado_usd?: number | null
    total_pendiente_usd?: number | null
    saldo_pendiente_neto_usd?: number | null
  }
  detalle?: any[]
  pagos?: any[]
}

const defaultOrder: CardKey[] = ['agenda', 'quincena', 'chat', 'perfil']

const cards: Record<CardKey, { href: string; label: string; icon: React.ElementType; desc: string }> = {
  agenda: {
    href: '/empleado/agenda',
    label: 'Agenda',
    icon: CalendarDays,
    desc: 'Citas y sesiones',
  },
  quincena: {
    href: '/empleado/quincena',
    label: 'Quincena',
    icon: WalletCards,
    desc: 'Comisiones y saldo',
  },
  chat: {
    href: '/empleado/chat',
    label: 'Mensajes',
    icon: MessageCircle,
    desc: 'Recepción y clientes',
  },
  perfil: {
    href: '/empleado/perfil',
    label: 'Perfil',
    icon: UserRound,
    desc: 'Datos y apariencia',
  },
}

function num(value: any) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function r2(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function money(n: number | null | undefined) {
  return `$${Number(n || 0).toFixed(2)}`
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate() {
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

function normalizarEstado(value: any) {
  return String(value || '').trim().toLowerCase()
}

function isPagado(row: any) {
  const estado = normalizarEstado(row?.estado || row?.status)

  return (
    row?.pagado === true ||
    row?.paid === true ||
    ['liquidado', 'liquidada', 'pagado', 'pagada', 'cobrada'].includes(estado)
  )
}

function isPendiente(row: any) {
  const estado = normalizarEstado(row?.estado || row?.status)
  const pagado = row?.pagado ?? row?.paid

  if (pagado === true) return false
  if (isPagado(row)) return false

  return (
    pagado === false ||
    estado === 'pendiente' ||
    estado === 'parcial' ||
    estado === 'vencida'
  )
}

function getProfesionalUsd(row: any) {
  const neto = Number(row?.monto_profesional_neto_usd ?? NaN)

  if (Number.isFinite(neto)) {
    return r2(Math.max(neto, 0))
  }

  const bruto = num(row?.monto_profesional_usd ?? row?.profesional_usd ?? row?.profesional ?? 0)
  const descuento = num(row?.descuento_deuda_usd ?? row?.monto_descuento_usd ?? 0)

  return r2(Math.max(bruto - descuento, 0))
}

function calcularPendienteFisioUsd(quincena: QuincenaApiData | null) {
  const detalle = Array.isArray(quincena?.detalle) ? quincena.detalle : []
  const pagos = Array.isArray(quincena?.pagos) ? quincena.pagos : []
  const map = new Map<string, any>()

  ;[...detalle, ...pagos].forEach((row, index) => {
    const id = String(row?.id || row?.comision_id || row?.pago_id || `row-${index}`)
    if (!map.has(id)) map.set(id, row)
  })

  const rows = [...map.values()]
  const pendiente = rows
    .filter((row) => !isPagado(row) && isPendiente(row))
    .reduce((acc, row) => acc + getProfesionalUsd(row), 0)

  return r2(pendiente)
}

export default function EmpleadoInicioPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  const [empleado, setEmpleado] = useState<Empleado | null>(null)
  const [estado, setEstado] = useState<EstadoCuenta | null>(null)
  const [quincena, setQuincena] = useState<QuincenaApiData | null>(null)
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [citas, setCitas] = useState<Cita[]>([])
  const [order, setOrder] = useState<CardKey[]>(defaultOrder)
  const [dragKey, setDragKey] = useState<CardKey | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('rpm-empleado-card-order')

    if (saved) {
      try {
        const parsed = JSON.parse(saved)

        if (Array.isArray(parsed)) {
          const valid = parsed.filter((key) => defaultOrder.includes(key))
          const missing = defaultOrder.filter((key) => !valid.includes(key))
          setOrder([...valid, ...missing])
        }
      } catch {}
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)

      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user

      if (!user) {
        setLoading(false)
        return
      }

      const { data: emp } = await supabase
        .from('empleados')
        .select('id,nombre,rol')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (!mounted || !emp) {
        setLoading(false)
        return
      }

      setEmpleado(emp)

      const hoy = todayKey()

      const [{ data: est }, { data: ses }, { data: cit }, quincenaRes] = await Promise.all([
        supabase
          .from('v_empleados_estado_cuenta')
          .select('*')
          .eq('empleado_id', emp.id)
          .maybeSingle(),

        supabase
          .from('v_entrenamientos_plan_asistencia')
          .select('id,fecha,hora_inicio,asistencia_estado')
          .eq('empleado_id', emp.id)
          .eq('fecha', hoy),

        supabase
          .from('citas')
          .select('id,fecha,hora_inicio,estado')
          .eq('terapeuta_id', emp.id)
          .eq('fecha', hoy),

        fetch('/api/empleado/quincena?periodo=actual', { cache: 'no-store' })
          .then((res) => res.json())
          .catch(() => null),
      ])

      if (!mounted) return

      setEstado(est as EstadoCuenta | null)
      setSesiones((ses || []) as Sesion[])
      setCitas((cit || []) as Cita[])
      setQuincena(quincenaRes as QuincenaApiData | null)
      setLoading(false)
    }

    load()

    return () => {
      mounted = false
    }
  }, [supabase])

  function onDrop(target: CardKey) {
    if (!dragKey || dragKey === target) return

    const next = [...order]
    const from = next.indexOf(dragKey)
    const to = next.indexOf(target)

    next.splice(from, 1)
    next.splice(to, 0, dragKey)

    setOrder(next)
    localStorage.setItem('rpm-empleado-card-order', JSON.stringify(next))
    setDragKey(null)
  }

  const primeraSesion = sesiones[0]

  const facturadoQuincena = num(
    quincena?.resumen?.total_facturado_usd ?? estado?.total_facturado_usd
  )

  const pagadoQuincena = num(
    quincena?.resumen?.total_pagado_usd ?? estado?.total_pagado_usd
  )

  const pendienteFisio = calcularPendienteFisioUsd(quincena)
  const hasPendienteFisio = pendienteFisio > 0

  return (
    <div className="mx-auto w-full max-w-[430px] space-y-4 pb-6 md:max-w-[1120px] md:py-2 lg:max-w-[1180px]">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="rpm-label">{formatDate()}</p>

          <h1 className="mt-1.5 text-[1.75rem] font-black tracking-tight leading-tight sm:text-[2rem] md:text-[1.65rem] lg:text-[2rem]">
            {empleado ? greet(empleado.nombre) : 'Cargando...'}
          </h1>

          {empleado?.rol && (
            <p className="mt-1 text-sm rpm-muted font-medium capitalize">
              {empleado.rol}
            </p>
          )}
        </div>

        <Link
          href="/empleado/perfil"
          className="glass-card flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          title="Perfil"
        >
          <UserRound className="h-5 w-5" style={{ color: 'var(--accent)' }} />
        </Link>
      </header>

      <section className="grid gap-3 md:grid-cols-[1.4fr_0.85fr] md:items-stretch">
        <div className="purple-card rounded-[1.6rem] p-5 text-white md:rounded-[1.4rem] md:p-5">
          <p
            style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.07em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            Próxima sesión
          </p>

          <h2 className="mt-4 text-[1.45rem] font-black leading-snug md:mt-3 md:text-[1.35rem] lg:text-[1.55rem]">
            {primeraSesion ? 'Sesión programada' : 'Sin sesiones hoy'}
          </h2>

          {primeraSesion ? (
            <div className="mt-1 flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.65)' }}>
              <Clock className="h-3.5 w-3.5" />
              <span className="text-sm font-semibold">{primeraSesion.hora_inicio}</span>
            </div>
          ) : (
            <p className="mt-1 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Agenda limpia por ahora
            </p>
          )}

          <Link
            href="/empleado/agenda"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold md:mt-4"
            style={{ color: '#3b0fa0' }}
          >
            Ver agenda <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
          <div className="glass-card rounded-[1.4rem] p-4">
            <p className="rpm-label">Sesiones hoy</p>
            <p className="mt-2.5 text-[2.2rem] font-black leading-none">
              {loading ? '—' : sesiones.length}
            </p>
            <p className="mt-1 text-xs rpm-muted">entrenamiento</p>
          </div>

          <div className="glass-card rounded-[1.4rem] p-4">
            <p className="rpm-label">Citas hoy</p>
            <p className="mt-2.5 text-[2.2rem] font-black leading-none">
              {loading ? '—' : citas.length}
            </p>
            <p className="mt-1 text-xs rpm-muted">terapia</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-[0.95fr_1.05fr] md:items-start">
        <div className="glass-card rounded-[1.6rem] p-5 md:rounded-[1.4rem] md:p-4">
          <div className="flex items-center justify-between">
            <p className="rpm-label">Resumen quincena</p>
            <TrendingUp className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 md:mt-3">
            {[
              { label: 'Facturado', val: facturadoQuincena },
              { label: 'Pagado', val: pagadoQuincena },
              { label: 'Pendiente fisio', val: pendienteFisio },
            ].map(({ label, val }) => (
              <div key={label} className="stat-mini text-center">
                <p className="rpm-label" style={{ fontSize: '9px' }}>
                  {label}
                </p>
                <p className="mt-1.5 text-sm font-black">
                  {loading ? '—' : money(val)}
                </p>
              </div>
            ))}
          </div>

          {hasPendienteFisio && !loading && (
            <div
              className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2"
              style={{
                background: 'rgba(251,191,36,0.08)',
                border: '1px solid rgba(251,191,36,0.18)',
              }}
            >
              <div
                className="h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: '#d97706' }}
              />

              <p className="text-xs font-semibold" style={{ color: '#d97706' }}>
                Pendiente por liquidar al fisio: {money(pendienteFisio)}
              </p>
            </div>
          )}

          <Link
            href="/empleado/quincena"
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition"
            style={{ background: 'var(--purple-soft)', color: 'var(--accent)' }}
          >
            Ver detalles <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {order.map((key) => {
            const card = cards[key]
            const Icon = card.icon

            return (
              <Link
                key={key}
                href={card.href}
                draggable
                onDragStart={() => setDragKey(key)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  onDrop(key)
                }}
                className="glass-card group relative flex flex-col justify-between min-h-[110px] rounded-[1.4rem] p-4 md:min-h-[100px]"
              >
                <div className="flex items-start justify-between">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: 'var(--purple-soft)' }}
                  >
                    <Icon className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  </div>

                  <GripVertical
                    className="h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity"
                    style={{ color: 'var(--text-sub)' }}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-black">{card.label}</h3>
                  <p className="mt-0.5 text-xs rpm-muted leading-snug">{card.desc}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {loading && <p className="rpm-muted text-center text-xs py-2">Cargando datos...</p>}
    </div>
  )
}