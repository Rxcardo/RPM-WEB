'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import { CalendarDays, WalletCards, MessageCircle, UserRound, GripVertical, ArrowRight } from 'lucide-react'

type Empleado = { id: string; nombre: string; rol: string | null }
type EstadoCuenta = { total_facturado_usd: number | null; total_pagado_usd: number | null; saldo_pendiente_neto_usd: number | null }
type Sesion = { id: string; fecha: string; hora_inicio: string | null; asistencia_estado: string | null }
type Cita = { id: string; fecha: string; hora_inicio: string; estado: string }

type CardKey = 'agenda' | 'quincena' | 'chat' | 'perfil'

const defaultOrder: CardKey[] = ['agenda', 'quincena', 'chat', 'perfil']

const cards = {
  agenda: { href: '/empleado/agenda', label: 'Agenda del día', icon: CalendarDays, desc: 'Citas y sesiones de hoy' },
  quincena: { href: '/empleado/quincena', label: 'Mi quincena', icon: WalletCards, desc: 'Comisiones y saldo' },
  chat: { href: '/empleado/chat', label: 'Chat y WhatsApp', icon: MessageCircle, desc: 'Recepción y clientes' },
  perfil: { href: '/empleado/perfil', label: 'Perfil', icon: UserRound, desc: 'Datos y apariencia' },
}

function money(n: number | null | undefined) {
  return `$${Number(n || 0).toFixed(2)}`
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export default function EmpleadoInicioPage() {
  const supabase = useMemo(
    () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!),
    []
  )

  const [empleado, setEmpleado] = useState<Empleado | null>(null)
  const [estado, setEstado] = useState<EstadoCuenta | null>(null)
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
        if (Array.isArray(parsed)) setOrder(parsed)
      } catch {}
    }
  }, [])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      const { data: auth } = await supabase.auth.getUser()
      const user = auth.user
      if (!user) return

      const { data: emp } = await supabase
        .from('empleados')
        .select('id,nombre,rol')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (!mounted || !emp) return
      setEmpleado(emp)

      const hoy = todayKey()
      const [{ data: est }, { data: ses }, { data: cit }] = await Promise.all([
        supabase.from('v_empleados_estado_cuenta').select('*').eq('empleado_id', emp.id).maybeSingle(),
        supabase.from('v_entrenamientos_plan_asistencia').select('id,fecha,hora_inicio,asistencia_estado').eq('empleado_id', emp.id).eq('fecha', hoy),
        supabase.from('citas').select('id,fecha,hora_inicio,estado').eq('terapeuta_id', emp.id).eq('fecha', hoy),
      ])

      if (!mounted) return
      setEstado(est as EstadoCuenta | null)
      setSesiones((ses || []) as Sesion[])
      setCitas((cit || []) as Cita[])
      setLoading(false)
    }
    load()
    return () => { mounted = false }
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

  return (
    <div className="mx-auto w-full max-w-[430px] space-y-4 pb-6 md:max-w-[1120px] md:space-y-5 md:py-2 lg:max-w-[1180px]">
      <header className="flex items-start justify-between gap-4 md:items-center">
        <div>
          <p className="rpm-muted text-sm font-semibold md:text-xs">Hoy</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl md:text-3xl lg:text-4xl">
            Hola, {empleado?.nombre?.split(' ')?.[0] || 'Empleado'}
          </h1>
        </div>
        <Link
          href="/empleado/perfil"
          className="glass-card flex h-12 w-12 shrink-0 items-center justify-center rounded-full md:h-11 md:w-11"
        >
          <UserRound className="h-5 w-5" />
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-[1.45fr_.9fr] md:items-stretch">
        <div className="purple-card rounded-[2rem] p-5 text-white md:rounded-[1.7rem] md:p-5 lg:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[.28em] text-white/60 md:text-[10px]">
            Próxima sesión
          </p>
          <h2 className="mt-4 text-2xl font-black md:mt-3 md:text-2xl lg:text-3xl">
            {primeraSesion ? 'Sesión programada' : 'Sin sesiones pendientes'}
          </h2>
          <p className="mt-1 text-white/70 md:text-sm">{primeraSesion?.hora_inicio || 'Agenda limpia por ahora'}</p>
          <Link
            href="/empleado/agenda"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-[#22183a] md:mt-4 md:px-4 md:py-2.5"
          >
            Ver agenda <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-3">
          <div className="glass-card rounded-[1.6rem] p-4 md:rounded-[1.35rem] md:p-4">
            <p className="rpm-muted text-sm font-semibold md:text-xs">Sesiones hoy</p>
            <p className="mt-3 text-3xl font-black md:mt-2 md:text-3xl">{sesiones.length}</p>
          </div>
          <div className="glass-card rounded-[1.6rem] p-4 md:rounded-[1.35rem] md:p-4">
            <p className="rpm-muted text-sm font-semibold md:text-xs">Citas hoy</p>
            <p className="mt-3 text-3xl font-black md:mt-2 md:text-3xl">{citas.length}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-[.95fr_1.05fr]">
        <div className="glass-card rounded-[1.8rem] p-4 md:rounded-[1.45rem] md:p-4">
          <p className="rpm-muted text-sm font-semibold md:text-xs">Resumen de quincena</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center md:mt-3">
            <div className="rounded-2xl border border-[var(--line)] p-3 md:p-3">
              <p className="rpm-muted text-[11px]">Facturado</p>
              <p className="mt-1 text-sm font-black md:text-base">{money(estado?.total_facturado_usd)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] p-3 md:p-3">
              <p className="rpm-muted text-[11px]">Pagado</p>
              <p className="mt-1 text-sm font-black md:text-base">{money(estado?.total_pagado_usd)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--line)] p-3 md:p-3">
              <p className="rpm-muted text-[11px]">Pendiente</p>
              <p className="mt-1 text-sm font-black md:text-base">{money(estado?.saldo_pendiente_neto_usd)}</p>
            </div>
          </div>
        </div>

        <section className="grid grid-cols-2 gap-3 md:gap-3">
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
                onDrop={(e) => { e.preventDefault(); onDrop(key) }}
                className="glass-card group relative min-h-[118px] rounded-[1.6rem] p-4 transition hover:-translate-y-0.5 md:min-h-[104px] md:rounded-[1.35rem] md:p-4"
              >
                <GripVertical className="absolute right-3 top-3 h-4 w-4 text-[var(--muted)]" />
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--purple)] text-white md:h-9 md:w-9 md:rounded-xl">
                  <Icon className="h-5 w-5 md:h-4 md:w-4" />
                </div>
                <h3 className="mt-4 text-sm font-black md:mt-3">{card.label}</h3>
                <p className="rpm-muted mt-1 text-xs leading-snug">{card.desc}</p>
              </Link>
            )
          })}
        </section>
      </section>

      {loading && <p className="rpm-muted text-center text-xs">Cargando datos...</p>}
    </div>
  )
}
