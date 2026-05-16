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
  Pencil,
  Check,
  X,
  Calendar,
  CreditCard,
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
  return safeText(nombre, 'E')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
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

  const [editingPhone, setEditingPhone] = useState(false)
  const [phoneValue, setPhoneValue] = useState('')
  const [savingPhone, setSavingPhone] = useState(false)
  const [phoneError, setPhoneError] = useState('')

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
      setPhoneValue(data?.telefono ?? '')
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

  async function savePhone() {
    if (!empleado) return
    setSavingPhone(true)
    setPhoneError('')
    try {
      const { error } = await supabase
        .from('empleados')
        .update({ telefono: phoneValue.trim() || null })
        .eq('id', empleado.id)

      if (error) {
        setPhoneError('No se pudo guardar. Intenta de nuevo.')
        return
      }

      setEmpleado((prev) =>
        prev ? { ...prev, telefono: phoneValue.trim() || null } : prev
      )
      setEditingPhone(false)
    } finally {
      setSavingPhone(false)
    }
  }

  function cancelPhone() {
    setPhoneValue(empleado?.telefono ?? '')
    setPhoneError('')
    setEditingPhone(false)
  }

  const nombre = loading ? 'Cargando…' : safeText(empleado?.nombre, 'Empleado')
  const rol = safeText(empleado?.rol, 'Terapeuta')
  const estadoRaw = (empleado?.estado ?? 'activo').toLowerCase()
  const iniciales = getInitials(empleado?.nombre)

  const estadoBadge =
    estadoRaw === 'activo'
      ? { bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.2)', color: '#34d399', label: 'Activo' }
      : estadoRaw === 'inactivo' || estadoRaw === 'suspendido'
        ? { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.2)', color: '#f87171', label: safeText(empleado?.estado) }
        : { bg: 'var(--surface2)', border: 'var(--border)', color: 'var(--text-sub)', label: safeText(empleado?.estado) }

  const readOnlyFields = [
    { icon: <Mail className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />, label: 'Correo electrónico', value: empleado?.email },
    { icon: <CreditCard className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />, label: 'Cédula', value: empleado?.cedula },
    { icon: <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />, label: 'Especialidad', value: empleado?.especialidad },
    { icon: <Briefcase className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />, label: 'Rol', value: empleado?.rol },
    { icon: <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />, label: 'Miembro desde', value: formatDate(empleado?.created_at) },
  ]

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="rpm-label">Mi cuenta</p>
          <h1 className="mt-1.5 text-[1.75rem] font-black tracking-tight leading-tight">
            Perfil
          </h1>
          <p className="mt-1 text-sm rpm-muted">
            Tu información, sesión y apariencia.
          </p>
        </div>

        <button
          type="button"
          onClick={cerrarSesion}
          disabled={cerrando}
          className="flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition"
          style={{
            background: 'rgba(248,113,113,0.1)',
            border: '1px solid rgba(248,113,113,0.2)',
            color: 'var(--red)',
          }}
        >
          <LogOut className="h-4 w-4" />
          {cerrando ? 'Saliendo...' : 'Cerrar sesión'}
        </button>
      </header>

      {/* Profile hero */}
      <div className="purple-card p-5 text-white">
        <div className="flex items-center gap-4">
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-[1.4rem] text-xl font-black"
            style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
          >
            {empleado?.nombre ? iniciales : <UserRound className="h-8 w-8" />}
          </div>

          <div className="min-w-0 flex-1">
            <p
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.55)',
              }}
            >
              Empleado RPM
            </p>

            <h2 className="mt-1 truncate text-xl font-black">{nombre}</h2>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }}
              >
                <Briefcase className="h-3 w-3" />
                {rol}
              </span>

              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                style={{
                  background: estadoBadge.bg,
                  border: `1px solid ${estadoBadge.border}`,
                  color: estadoBadge.color,
                }}
              >
                <BadgeCheck className="h-3 w-3" />
                {estadoBadge.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Data + Appearance */}
      <div className="grid gap-4 md:grid-cols-[1.5fr_0.5fr]">
        {/* Data section */}
        <div className="glass-card p-5">
          <div className="mb-4">
            <h2 className="font-black">Mis datos</h2>
            <p className="mt-0.5 text-xs rpm-muted">
              Puedes editar tu teléfono. El resto lo gestiona administración.
            </p>
          </div>

          <div className="space-y-2">
            {/* Editable: Phone */}
            <div className="stat-mini">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
                  <p className="rpm-label">Teléfono</p>
                </div>

                {!editingPhone ? (
                  <button
                    type="button"
                    onClick={() => setEditingPhone(true)}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition"
                    style={{ background: 'var(--purple-soft)', color: 'var(--accent)' }}
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={savePhone}
                      disabled={savingPhone}
                      aria-label="Guardar teléfono"
                      className="flex h-7 w-7 items-center justify-center rounded-lg transition disabled:opacity-50"
                      style={{ background: 'rgba(52,211,153,0.15)', color: 'var(--green)' }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelPhone}
                      aria-label="Cancelar edición"
                      className="flex h-7 w-7 items-center justify-center rounded-lg transition"
                      style={{ background: 'rgba(248,113,113,0.1)', color: 'var(--red)' }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {editingPhone ? (
                <>
                  <input
                    className="rpm-input mt-2"
                    value={phoneValue}
                    onChange={(e) => setPhoneValue(e.target.value)}
                    placeholder="Ej: +58 412 000 0000"
                    type="tel"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') savePhone()
                      if (e.key === 'Escape') cancelPhone()
                    }}
                  />
                  {phoneError && (
                    <p className="mt-1 text-xs" style={{ color: 'var(--red)' }}>
                      {phoneError}
                    </p>
                  )}
                </>
              ) : (
                <p className="mt-1 text-sm font-black">{safeText(empleado?.telefono)}</p>
              )}
            </div>

            {/* Read-only fields */}
            {readOnlyFields.map(({ icon, label, value }) => (
              <div key={label} className="stat-mini">
                <div className="flex items-center gap-2">
                  {icon}
                  <p className="rpm-label">{label}</p>
                </div>
                <p className="mt-1 text-sm font-black">{safeText(value)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Appearance section */}
        <div className="glass-card p-5">
          <div className="mb-4">
            <h2 className="font-black">Apariencia</h2>
            <p className="mt-0.5 text-xs rpm-muted">
              El morado RPM se mantiene en ambos modos.
            </p>
          </div>

          <div className="space-y-3">
            {(
              [
                { value: 'dark', icon: <Moon className="h-4 w-4" />, label: 'Oscuro', desc: 'Profundo y premium.' },
                { value: 'light', icon: <Sun className="h-4 w-4" />, label: 'Claro', desc: 'Limpio y luminoso.' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => changeTheme(opt.value)}
                className="flex w-full items-center gap-3 rounded-[1.2rem] p-4 text-left transition"
                style={
                  theme === opt.value
                    ? {
                        background: 'var(--purple)',
                        border: '1px solid transparent',
                        color: '#fff',
                        boxShadow: '0 2px 12px var(--purple-glow)',
                      }
                    : {
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                      }
                }
              >
                <div
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                  style={{
                    background: theme === opt.value ? 'rgba(255,255,255,0.2)' : 'var(--purple-soft)',
                  }}
                >
                  {opt.icon}
                </div>
                <div>
                  <p className="text-sm font-black">{opt.label}</p>
                  <p
                    className="text-xs"
                    style={{ color: theme === opt.value ? 'rgba(255,255,255,0.65)' : 'var(--text-sub)' }}
                  >
                    {opt.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
