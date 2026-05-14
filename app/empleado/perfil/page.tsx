'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import {
  Moon,
  Sun,
  UserRound,
  LogOut,
  ShieldCheck,
  Briefcase,
  Mail,
  Phone,
  BadgeCheck,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

type Empleado = {
  id: string
  nombre: string | null
  email: string | null
  telefono: string | null
  especialidad: string | null
  estado: string | null
  rol: string | null
  cedula: string | null
  created_at: string | null
}

function formatDate(v?: string | null) {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleDateString('es-VE')
  } catch {
    return v
  }
}

function safeText(v?: string | null, fallback = '—') {
  const text = String(v ?? '').trim()
  return text || fallback
}

function getInitials(nombre?: string | null) {
  return safeText(nombre, 'Empleado')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function estadoClass(estado?: string | null) {
  const v = String(estado ?? '').toLowerCase()

  if (v === 'activo') {
    return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
  }

  if (v === 'inactivo' || v === 'suspendido') {
    return 'border-red-400/20 bg-red-500/10 text-red-300'
  }

  return 'border-[var(--line)] bg-white/5 text-[var(--muted)]'
}

export default function EmpleadoPerfilPage() {
  const router = useRouter()

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  const [empleado, setEmpleado] = useState<Empleado | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [cerrando, setCerrando] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('rpm-empleado-theme') as 'dark' | 'light' | null
    if (saved) setTheme(saved)

    async function load() {
      setLoading(true)

      const { data: auth } = await supabase.auth.getUser()

      if (!auth.user) {
        router.replace('/login')
        return
      }

      const { data } = await supabase
        .from('empleados')
        .select('id,nombre,email,telefono,especialidad,estado,rol,cedula,created_at')
        .eq('auth_user_id', auth.user.id)
        .maybeSingle()

      setEmpleado(data as Empleado | null)
      setLoading(false)
    }

    load()
  }, [supabase, router])

  function changeTheme(value: 'dark' | 'light') {
    setTheme(value)
    localStorage.setItem('rpm-empleado-theme', value)
    window.location.reload()
  }

  async function cerrarSesion() {
    if (cerrando) return

    setCerrando(true)

    try {
      await supabase.auth.signOut()
      router.replace('/login')
      router.refresh()
    } finally {
      setCerrando(false)
    }
  }

  const fields: Array<[string, string | null | undefined]> = [
    ['Nombre', empleado?.nombre],
    ['Correo', empleado?.email],
    ['Teléfono', empleado?.telefono],
    ['Cédula', empleado?.cedula],
    ['Especialidad', empleado?.especialidad],
    ['Rol', empleado?.rol],
    ['Estado', empleado?.estado],
    ['Fecha de creación', formatDate(empleado?.created_at)],
  ]

  const nombre = loading ? 'Cargando…' : safeText(empleado?.nombre, 'Empleado')
  const rol = safeText(empleado?.rol, 'Terapeuta')
  const estado = safeText(empleado?.estado, 'activo')
  const iniciales = getInitials(empleado?.nombre)

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="inline-flex items-center rounded-full border border-[var(--line)] bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[var(--muted)]">
            Configuración
          </div>

          <h1 className="mt-2 text-3xl font-black tracking-tight">Perfil</h1>

          <p className="rpm-muted mt-1 text-sm">
            Información del empleado, sesión y apariencia del portal.
          </p>
        </div>

        <button
          type="button"
          onClick={cerrarSesion}
          disabled={cerrando}
          className="
            inline-flex items-center justify-center gap-2 rounded-2xl
            border border-red-400/20 bg-red-500/10
            px-4 py-3 text-sm font-black text-red-300
            transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60
          "
        >
          <LogOut className="h-4 w-4" />
          {cerrando ? 'Cerrando...' : 'Cerrar sesión'}
        </button>
      </header>

      <section className="overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--card)] shadow-sm">
        <div className="h-1 bg-gradient-to-r from-[var(--purple)] via-fuchsia-500 to-orange-400" />

        <div className="p-5">
          <div className="flex items-center gap-4">
            <div
              className="
                grid h-20 w-20 shrink-0 place-items-center rounded-[1.6rem]
                bg-gradient-to-br from-[var(--purple)] to-fuchsia-500
                text-2xl font-black text-white shadow-lg shadow-purple-500/20
              "
            >
              {empleado?.nombre ? iniciales : <UserRound className="h-9 w-9" />}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--purple)]">
                Empleado RPM
              </p>

              <h2 className="mt-1 truncate text-2xl font-black tracking-tight">
                {nombre}
              </h2>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-white/5 px-3 py-1 text-xs font-black text-[var(--muted)]">
                  <Briefcase className="h-3.5 w-3.5" />
                  {rol}
                </span>

                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-black ${estadoClass(
                    empleado?.estado
                  )}`}
                >
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {estado}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <MiniStat
              icon={<Mail className="h-4 w-4" />}
              label="Correo"
              value={empleado?.email}
            />
            <MiniStat
              icon={<Phone className="h-4 w-4" />}
              label="Teléfono"
              value={empleado?.telefono}
            />
            <MiniStat
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Especialidad"
              value={empleado?.especialidad}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <section className="overflow-hidden rounded-[1.8rem] border border-[var(--line)] bg-[var(--card)]">
          <div className="h-1 bg-gradient-to-r from-[var(--purple)] to-fuchsia-500" />

          <div className="p-5">
            <div className="mb-4">
              <h2 className="text-lg font-black">Mis datos</h2>
              <p className="rpm-muted mt-1 text-sm">
                Solo lectura. Estos datos los modifica administración.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {fields.map(([label, value]) => (
                <InfoBox key={label} label={label} value={value} />
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[1.8rem] border border-[var(--line)] bg-[var(--card)]">
          <div className="h-1 bg-gradient-to-r from-orange-400 to-[var(--purple)]" />

          <div className="p-5">
            <div className="mb-4">
              <h2 className="text-lg font-black">Apariencia</h2>
              <p className="rpm-muted mt-1 text-sm">
                El morado RPM se mantiene en ambos modos.
              </p>
            </div>

            <div className="grid gap-3">
              <ThemeButton
                active={theme === 'dark'}
                icon={<Moon className="h-5 w-5" />}
                label="Oscuro"
                description="Interfaz profunda y premium."
                onClick={() => changeTheme('dark')}
              />

              <ThemeButton
                active={theme === 'light'}
                icon={<Sun className="h-5 w-5" />}
                label="Claro"
                description="Interfaz limpia y luminosa."
                onClick={() => changeTheme('light')}
              />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value?: string | null
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white/5 p-3">
      <div className="mb-2 flex items-center gap-2 text-[var(--muted)]">
        {icon}
        <p className="text-xs font-black uppercase tracking-[0.08em]">{label}</p>
      </div>

      <p className="truncate text-sm font-black">{safeText(value)}</p>
    </div>
  )
}

function InfoBox({
  label,
  value,
}: {
  label: string
  value?: string | null
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white/5 p-3">
      <p className="rpm-muted text-xs font-bold">{label}</p>
      <p className="mt-1 break-words text-sm font-black">{safeText(value)}</p>
    </div>
  )
}

function ThemeButton({
  active,
  icon,
  label,
  description,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center gap-3 rounded-2xl border p-4 text-left transition
        ${
          active
            ? 'border-[var(--purple)] bg-[var(--purple)] text-white shadow-lg shadow-purple-500/20'
            : 'border-[var(--line)] bg-white/5 hover:bg-white/10'
        }
      `}
    >
      <div
        className={`
          grid h-11 w-11 shrink-0 place-items-center rounded-2xl
          ${active ? 'bg-white/20' : 'bg-white/5'}
        `}
      >
        {icon}
      </div>

      <div>
        <p className="font-black">{label}</p>
        <p className={active ? 'text-sm text-white/70' : 'rpm-muted text-sm'}>
          {description}
        </p>
      </div>
    </button>
  )
}