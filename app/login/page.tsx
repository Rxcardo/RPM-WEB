'use client'

export const dynamic = 'force-dynamic'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function getRolNombre(empleado: any): string | null {
  const rol = firstOrNull(empleado?.roles)
  return rol?.nombre ? String(rol.nombre) : null
}

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    void verificarSesion()
  }, [])

  async function verificarSesion() {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) return

    const { data: empleado } = await supabase
      .from('empleados')
      .select('id, roles:rol_id(nombre)')
      .eq('id', session.user.id)
      .single()

    const rol = getRolNombre(empleado)

    if (rol === 'cliente') {
      router.replace('/cliente')
      return
    }

    if (rol) {
      router.replace('/admin')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setError(error.message || 'No se pudo iniciar sesión')
        return
      }

      setSuccess('Inicio de sesión correcto')

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError('No se pudo obtener el usuario autenticado')
        return
      }

      const { data: empleado } = await supabase
        .from('empleados')
        .select('id, roles:rol_id(nombre)')
        .eq('id', user.id)
        .single()

      const rol = getRolNombre(empleado)

      if (rol === 'cliente') {
        router.replace('/cliente')
        return
      }

      if (rol === 'admin' || rol === 'recepcionista' || rol === 'terapeuta') {
        router.replace('/admin')
        return
      }

      router.replace('/sin-acceso')
    } catch (err: any) {
      setError(err?.message || 'Ocurrió un error inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">Iniciar sesión</h1>
          <p className="mt-2 text-sm text-white/60">
            Accede a tu panel según tu rol
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/80">
              Correo
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@empresa.com"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-white/20"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/80">
              Contraseña
            </label>

            <div className="flex gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tu contraseña"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-white/20"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm font-medium text-white/80 transition hover:bg-white/[0.10]"
              >
                {showPassword ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </Card>
    </div>
  )
}