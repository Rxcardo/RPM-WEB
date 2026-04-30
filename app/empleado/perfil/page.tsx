'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Moon, Sun, UserRound, LogOut } from 'lucide-react'
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

  useEffect(() => {
    const saved = localStorage.getItem('rpm-empleado-theme') as 'dark' | 'light' | null
    if (saved) setTheme(saved)

    async function load() {
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

  const fields = [
    ['Nombre', empleado?.nombre],
    ['Correo', empleado?.email],
    ['Teléfono', empleado?.telefono],
    ['Cédula', empleado?.cedula],
    ['Especialidad', empleado?.especialidad],
    ['Rol', empleado?.rol],
    ['Estado', empleado?.estado],
    ['Fecha de creación', formatDate(empleado?.created_at)],
  ]

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="rpm-muted text-sm font-semibold">Configuración</p>
          <h1 className="mt-1 text-3xl font-black">Perfil</h1>
        </div>

        <button
          type="button"
          onClick={cerrarSesion}
          disabled={cerrando}
          className="
            inline-flex items-center gap-2 rounded-2xl
            border border-red-400/20 bg-red-500/10
            px-4 py-3 text-sm font-black text-red-300
            transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60
          "
        >
          <LogOut className="h-4 w-4" />
          {cerrando ? 'Cerrando...' : 'Cerrar sesión'}
        </button>
      </header>

      <section className="purple-card rounded-[2rem] p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
            <UserRound className="h-8 w-8" />
          </div>

          <div>
            <h2 className="text-2xl font-black">{empleado?.nombre || 'Empleado'}</h2>
            <p className="text-white/60">{empleado?.rol || 'terapeuta'}</p>
          </div>
        </div>
      </section>

      <section className="glass-card rounded-[1.8rem] p-4">
        <h2 className="text-lg font-black">Mis datos</h2>
        <p className="rpm-muted mt-1 text-sm">
          Solo lectura. Estos datos los modifica administración.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[var(--line)] p-3">
              <p className="rpm-muted text-xs font-semibold">{label}</p>
              <p className="mt-1 font-black">{value || '—'}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="glass-card rounded-[1.8rem] p-4">
        <h2 className="text-lg font-black">Apariencia</h2>
        <p className="rpm-muted mt-1 text-sm">
          El morado RPM se mantiene en ambos modos.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => changeTheme('dark')}
            className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-4 font-black ${
              theme === 'dark'
                ? 'bg-[var(--purple)] text-white'
                : 'border border-[var(--line)]'
            }`}
          >
            <Moon className="h-5 w-5" />
            Oscuro
          </button>

          <button
            type="button"
            onClick={() => changeTheme('light')}
            className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-4 font-black ${
              theme === 'light'
                ? 'bg-[var(--purple)] text-white'
                : 'border border-[var(--line)]'
            }`}
          >
            <Sun className="h-5 w-5" />
            Claro
          </button>
        </div>
      </section>
    </div>
  )
}