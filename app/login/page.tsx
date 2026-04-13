'use client'

export const dynamic = 'force-dynamic'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Image from 'next/image'

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

    const { data: empleado, error: empleadoError } = await supabase
      .from('empleados')
      .select('id, auth_user_id, rol, roles:rol_id(nombre)')
      .eq('auth_user_id', session.user.id)
      .maybeSingle()

    if (empleadoError) {
      console.error('Error verificando sesión:', empleadoError)
      return
    }

    if (!empleado) return

    const rol = getRolNombre(empleado) ?? empleado?.rol ?? null

    if (rol === 'cliente') {
      router.replace('/cliente')
      return
    }

    if (rol === 'admin' || rol === 'recepcionista' || rol === 'terapeuta') {
      router.replace('/admin')
      return
    }

    router.replace('/sin-acceso')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (loginError) {
        setError(loginError.message || 'No se pudo iniciar sesión')
        return
      }

      setSuccess('Inicio de sesión correcto')

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        setError('No se pudo obtener el usuario autenticado')
        return
      }

      const { data: empleado, error: empleadoError } = await supabase
        .from('empleados')
        .select('id, auth_user_id, rol, roles:rol_id(nombre)')
        .eq('auth_user_id', user.id)
        .maybeSingle()

      if (empleadoError) {
        setError('Error consultando el perfil del empleado')
        return
      }

      if (!empleado) {
        setError('Tu usuario autenticado no está vinculado a un empleado')
        return
      }

      const rol = getRolNombre(empleado) ?? empleado?.rol ?? null

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
    <>
      <style>{`
        @keyframes blob1 {
          0%   { transform: translate(0,0) scale(1); }
          33%  { transform: translate(6%,-8%) scale(1.07); }
          66%  { transform: translate(-5%,7%) scale(0.96); }
          100% { transform: translate(0,0) scale(1); }
        }
        @keyframes blob2 {
          0%   { transform: translate(0,0) scale(1); }
          33%  { transform: translate(-8%,5%) scale(1.05); }
          66%  { transform: translate(7%,-6%) scale(0.98); }
          100% { transform: translate(0,0) scale(1); }
        }
        @keyframes blob3 {
          0%   { transform: translate(0,0) scale(1); }
          50%  { transform: translate(4%,9%) scale(1.04); }
          100% { transform: translate(0,0) scale(1); }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .b1 { animation: blob1 14s ease-in-out infinite; }
        .b2 { animation: blob2 18s ease-in-out infinite; }
        .b3 { animation: blob3 22s ease-in-out infinite; }
        .card { animation: fadeUp 0.7s cubic-bezier(.22,1,.36,1) both; }

        .inp {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 8px;
          padding: 13px 16px;
          color: #fff;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .inp::placeholder { color: rgba(255,255,255,0.22); }
        .inp:focus { border-color: rgba(139,92,246,0.65); }

        .btn-submit {
          width: 100%;
          background: #7c3aed;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 14px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: background 0.2s, transform 0.15s;
        }
        .btn-submit:hover:not(:disabled) { background: #6d28d9; transform: translateY(-1px); }
        .btn-submit:active:not(:disabled) { transform: translateY(0); }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        .btn-toggle {
          flex-shrink: 0;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 8px;
          padding: 13px 16px;
          color: rgba(255,255,255,0.6);
          font-size: 13px;
          cursor: pointer;
          transition: background 0.2s;
          white-space: nowrap;
        }
        .btn-toggle:hover { background: rgba(255,255,255,0.09); }
      `}</style>

      <div
        style={{
          minHeight: '100vh',
          background: '#0b0b10',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
        }}
      >
        <div
          className="b1"
          style={{
            position: 'absolute',
            borderRadius: '50%',
            width: '65vw',
            height: '65vw',
            top: '-20%',
            right: '-15%',
            background:
              'radial-gradient(circle, rgba(109,40,217,0.65) 0%, transparent 70%)',
            filter: 'blur(72px)',
            pointerEvents: 'none',
          }}
        />
        <div
          className="b2"
          style={{
            position: 'absolute',
            borderRadius: '50%',
            width: '55vw',
            height: '55vw',
            bottom: '-15%',
            left: '-10%',
            background:
              'radial-gradient(circle, rgba(167,139,250,0.45) 0%, transparent 70%)',
            filter: 'blur(80px)',
            pointerEvents: 'none',
          }}
        />
        <div
          className="b3"
          style={{
            position: 'absolute',
            borderRadius: '50%',
            width: '40vw',
            height: '40vw',
            top: '25%',
            left: '15%',
            background:
              'radial-gradient(circle, rgba(76,29,149,0.50) 0%, transparent 70%)',
            filter: 'blur(64px)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.60) 100%)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'absolute',
            bottom: 44,
            left: 52,
            zIndex: 1,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <p
            style={{
              fontSize: 12,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(196,167,255,0.40)',
              margin: '0 0 6px',
              fontWeight: 600,
            }}
          >
            Bienvenido
          </p>
          <h2
            style={{
              fontSize: 'clamp(32px, 4.5vw, 60px)',
              fontWeight: 800,
              color: 'rgba(255,255,255,0.07)',
              lineHeight: 1.05,
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Gestiona
            <br />
            tu negocio.
          </h2>
        </div>

        <div
          className="card"
          style={{
            position: 'relative',
            zIndex: 10,
            width: '100%',
            maxWidth: 460,
            background: 'rgba(15, 15, 22, 0.78)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: '44px 44px',
            boxShadow:
              '0 40px 100px rgba(0,0,0,0.60), 0 0 0 0.5px rgba(255,255,255,0.03) inset',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <Image
              src="/logo-rpm.png"
              alt="Logo"
              width={110}
              height={36}
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>

          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: '#fff',
              margin: '0 0 4px',
              textAlign: 'center',
            }}
          >
            Iniciar sesión
          </h1>

          <p
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.35)',
              margin: '0 0 32px',
              textAlign: 'center',
            }}
          >
            Accede a tu panel según tu rol
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.45)',
                  marginBottom: 8,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@empresa.com"
                className="inp"
                required
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.45)',
                  marginBottom: 8,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                Contraseña
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="inp"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="btn-toggle"
                >
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.20)',
                  borderRadius: 8,
                  padding: '11px 14px',
                  fontSize: 13,
                  color: '#fca5a5',
                }}
              >
                {error}
              </div>
            )}

            {success && (
              <div
                style={{
                  background: 'rgba(52,211,153,0.07)',
                  border: '1px solid rgba(52,211,153,0.18)',
                  borderRadius: 8,
                  padding: '11px 14px',
                  fontSize: 13,
                  color: '#6ee7b7',
                }}
              >
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-submit"
              style={{ marginTop: 4 }}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}