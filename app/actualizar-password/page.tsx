'use client'

export const dynamic = 'force-dynamic'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ResetPasswordPage() {
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  const [ready, setReady] = useState(false)

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    let mounted = true

    async function initializeRecovery() {
      try {
        setChecking(true)
        setError('')

        const currentUrl = new URL(window.location.href)

        // PKCE flow (?code=)
        const code = currentUrl.searchParams.get('code')

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code)

          if (exchangeError) {
            throw exchangeError
          }

          if (mounted) {
            setReady(true)
            setChecking(false)
          }

          // limpiar URL
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname
          )

          return
        }

        // hash flow (#access_token)
        const hash = window.location.hash

        if (hash && hash.includes('access_token')) {
          const params = new URLSearchParams(hash.replace('#', ''))

          const access_token = params.get('access_token')
          const refresh_token = params.get('refresh_token')

          if (access_token && refresh_token) {
            const { error: sessionError } =
              await supabase.auth.setSession({
                access_token,
                refresh_token,
              })

            if (sessionError) {
              throw sessionError
            }

            if (mounted) {
              setReady(true)
              setChecking(false)
            }

            return
          }
        }

        // sesión existente
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          if (mounted) {
            setReady(true)
            setChecking(false)
          }

          return
        }

        if (mounted) {
          setReady(false)
          setChecking(false)
          setError('El enlace de recuperación es inválido o expiró.')
        }
      } catch (err: any) {
        if (mounted) {
          setReady(false)
          setChecking(false)

          setError(
            err?.message ||
              'No se pudo verificar el enlace de recuperación.'
          )
        }
      }
    }

    initializeRecovery()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === 'PASSWORD_RECOVERY' ||
        event === 'SIGNED_IN'
      ) {
        if (session) {
          setReady(true)
          setChecking(false)
          setError('')
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()

    setError('')
    setSuccess('')

    if (!password || password.length < 6) {
      setError('La contraseña debe tener mínimo 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    try {
      setLoading(true)

      const { error: updateError } =
        await supabase.auth.updateUser({
          password,
        })

      if (updateError) {
        throw updateError
      }

      setSuccess('Contraseña actualizada correctamente.')

      await supabase.auth.signOut()

      setTimeout(() => {
        router.replace('/login')
      }, 1800)
    } catch (err: any) {
      setError(
        err?.message || 'No se pudo actualizar la contraseña.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style jsx global>{`
        html,
        body {
          margin: 0;
          padding: 0;
          background: #06070d;
          font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            'Segoe UI',
            sans-serif;
        }

        * {
          box-sizing: border-box;
        }

        input,
        textarea,
        select {
          font-size: 16px !important;
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div
        style={{
          minHeight: '100dvh',
          background:
            'radial-gradient(circle at top, rgba(124,58,237,0.18), transparent 35%), #06070d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 18,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 430,
            borderRadius: 28,
            padding: 28,
            background: 'rgba(10,11,18,0.9)',
            border: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
            animation: 'fadeUp .45s ease',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              marginBottom: 28,
            }}
          >
            <h1
              style={{
                color: '#fff',
                margin: 0,
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: '-0.03em',
              }}
            >
              Nueva contraseña
            </h1>

            <p
              style={{
                marginTop: 10,
                color: 'rgba(255,255,255,0.38)',
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {ready
                ? 'Ingresa una nueva contraseña para tu cuenta.'
                : 'Verificando enlace de recuperación...'}
            </p>
          </div>

          {checking ? (
            <div
              style={{
                textAlign: 'center',
                color: 'rgba(255,255,255,0.45)',
                fontSize: 14,
                padding: '30px 0',
              }}
            >
              Cargando sesión...
            </div>
          ) : !ready ? (
            <div>
              <div
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.16)',
                  color: '#fca5a5',
                  padding: 14,
                  borderRadius: 16,
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>

              <button
                onClick={() => router.replace('/login')}
                style={{
                  width: '100%',
                  marginTop: 16,
                  border: 'none',
                  borderRadius: 16,
                  padding: '15px 18px',
                  background:
                    'linear-gradient(135deg,#7c3aed,#6d28d9)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                }}
              >
                Volver al login
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    color: 'rgba(255,255,255,0.52)',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Nueva contraseña
                </label>

                <div
                  style={{
                    position: 'relative',
                  }}
                >
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder='Mínimo 6 caracteres'
                    autoComplete='new-password'
                    required
                    style={{
                      width: '100%',
                      borderRadius: 18,
                      border:
                        '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.04)',
                      padding: '16px 58px 16px 16px',
                      color: '#fff',
                      outline: 'none',
                    }}
                  />

                  <button
                    type='button'
                    onClick={() =>
                      setShowPassword((prev) => !prev)
                    }
                    style={{
                      position: 'absolute',
                      top: '50%',
                      right: 14,
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.5)',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {showPassword ? 'Ocultar' : 'Ver'}
                  </button>
                </div>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    color: 'rgba(255,255,255,0.52)',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Confirmar contraseña
                </label>

                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  placeholder='Repite tu contraseña'
                  autoComplete='new-password'
                  required
                  style={{
                    width: '100%',
                    borderRadius: 18,
                    border:
                      '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.04)',
                    padding: '16px',
                    color: '#fff',
                    outline: 'none',
                  }}
                />
              </div>

              {error ? (
                <div
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.16)',
                    color: '#fca5a5',
                    padding: 14,
                    borderRadius: 16,
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {error}
                </div>
              ) : null}

              {success ? (
                <div
                  style={{
                    background: 'rgba(16,185,129,0.08)',
                    border: '1px solid rgba(16,185,129,0.18)',
                    color: '#6ee7b7',
                    padding: 14,
                    borderRadius: 16,
                    fontSize: 14,
                    lineHeight: 1.5,
                  }}
                >
                  {success}
                </div>
              ) : null}

              <button
                type='submit'
                disabled={loading}
                style={{
                  width: '100%',
                  border: 'none',
                  borderRadius: 18,
                  padding: '17px 18px',
                  background:
                    'linear-gradient(135deg,#7c3aed,#6d28d9)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  marginTop: 4,
                }}
              >
                {loading
                  ? 'Actualizando...'
                  : 'Actualizar contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  )
}