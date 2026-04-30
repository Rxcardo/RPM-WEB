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

  useEffect(() => { void verificarSesion() }, [])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: empleado, error: empleadoError } = await supabase
      .from('empleados')
      .select('id, auth_user_id, rol, roles:rol_id(nombre)')
      .eq('auth_user_id', session.user.id)
      .maybeSingle()
    if (empleadoError || !empleado) return
    const rol = getRolNombre(empleado) ?? empleado?.rol ?? null
    if (rol === 'cliente') { router.replace('/cliente'); return }
    if (rol === 'terapeuta') { router.replace('/empleado'); return }
    if (rol === 'admin' || rol === 'recepcionista') { router.replace('/admin'); return }
    router.replace('/sin-acceso')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (loginError) { setError(loginError.message || 'No se pudo iniciar sesión'); return }
      setSuccess('Inicio de sesión correcto')
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) { setError('No se pudo obtener el usuario autenticado'); return }
      const { data: empleado, error: empleadoError } = await supabase
        .from('empleados')
        .select('id, auth_user_id, rol, roles:rol_id(nombre)')
        .eq('auth_user_id', user.id)
        .maybeSingle()
      if (empleadoError) { setError('Error consultando el perfil del empleado'); return }
      if (!empleado) { setError('Tu usuario autenticado no está vinculado a un empleado'); return }
      const rol = getRolNombre(empleado) ?? empleado?.rol ?? null
      if (rol === 'cliente') { router.replace('/cliente'); return }
      if (rol === 'terapeuta') { router.replace('/empleado'); return }
    if (rol === 'admin' || rol === 'recepcionista') { router.replace('/admin'); return }
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
        @keyframes drift1 {
          0%,100% { transform: translate(0,0) scale(1); }
          40%      { transform: translate(5%,-7%) scale(1.06); }
          70%      { transform: translate(-4%,5%) scale(0.97); }
        }
        @keyframes drift2 {
          0%,100% { transform: translate(0,0) scale(1); }
          35%     { transform: translate(-6%,4%) scale(1.04); }
          65%     { transform: translate(5%,-5%) scale(0.98); }
        }
        @keyframes drift3 {
          0%,100% { transform: translate(0,0) scale(1); }
          50%     { transform: translate(3%,8%) scale(1.03); }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(32px) scale(0.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity:0; }
          to   { opacity:1; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .d1 { animation: drift1 16s ease-in-out infinite; }
        .d2 { animation: drift2 20s ease-in-out infinite; }
        .d3 { animation: drift3 24s ease-in-out infinite; }
        .card-anim { animation: slideUp 0.65s cubic-bezier(.22,1,.36,1) 0.05s both; }
        .bg-anim   { animation: fadeIn 0.4s ease both; }

        .rpm-input {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255,255,255,0.045);
          border: 1.5px solid rgba(255,255,255,0.09);
          border-radius: 14px;
          padding: 16px 18px;
          color: #fff;
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          -webkit-appearance: none;
        }
        .rpm-input::placeholder { color: rgba(255,255,255,0.2); }
        .rpm-input:focus {
          border-color: rgba(139,92,246,0.55);
          background: rgba(255,255,255,0.07);
          box-shadow: 0 0 0 3px rgba(139,92,246,0.10);
        }

        .rpm-btn {
          width: 100%;
          background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
          color: #fff;
          border: none;
          border-radius: 14px;
          padding: 17px;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.03em;
          transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
          box-shadow: 0 8px 24px rgba(109,40,217,0.35);
          -webkit-tap-highlight-color: transparent;
        }
        .rpm-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 12px 28px rgba(109,40,217,0.45);
        }
        .rpm-btn:active:not(:disabled) { transform: translateY(0); }
        .rpm-btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }

        .eye-btn {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: rgba(255,255,255,0.4);
          cursor: pointer;
          padding: 4px 6px;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.04em;
          transition: color 0.15s;
          -webkit-tap-highlight-color: transparent;
          white-space: nowrap;
        }
        .eye-btn:hover { color: rgba(255,255,255,0.75); }

        /* Removes autofill yellow bg on mobile Chrome */
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0px 1000px rgba(20,18,30,0.95) inset !important;
          -webkit-text-fill-color: #fff !important;
          border-color: rgba(139,92,246,0.4) !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      {/* ── Full screen background ── */}
      <div className="bg-anim" style={{
        minHeight: '100dvh',
        background: '#0b0b10',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 16px',
      }}>

        {/* Ambient blobs */}
        <div className="d1" style={{
          position: 'absolute', borderRadius: '50%',
          width: 'min(70vw, 520px)', height: 'min(70vw, 520px)',
          top: '-18%', right: '-12%',
          background: 'radial-gradient(circle, rgba(109,40,217,0.60) 0%, transparent 68%)',
          filter: 'blur(70px)', pointerEvents: 'none',
        }} />
        <div className="d2" style={{
          position: 'absolute', borderRadius: '50%',
          width: 'min(60vw, 440px)', height: 'min(60vw, 440px)',
          bottom: '-14%', left: '-8%',
          background: 'radial-gradient(circle, rgba(167,139,250,0.40) 0%, transparent 68%)',
          filter: 'blur(80px)', pointerEvents: 'none',
        }} />
        <div className="d3" style={{
          position: 'absolute', borderRadius: '50%',
          width: 'min(45vw, 320px)', height: 'min(45vw, 320px)',
          top: '30%', left: '10%',
          background: 'radial-gradient(circle, rgba(76,29,149,0.45) 0%, transparent 68%)',
          filter: 'blur(60px)', pointerEvents: 'none',
        }} />

        {/* Vignette */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.55) 100%)',
        }} />

        {/* Watermark text — hidden on small screens */}
        <div style={{
          position: 'absolute', bottom: 36, left: 40,
          zIndex: 1, pointerEvents: 'none', userSelect: 'none',
          display: 'none',
        }}
          className="watermark"
        >
          <p style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(196,167,255,0.30)', margin: '0 0 5px', fontWeight: 600 }}>
            Bienvenido
          </p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,52px)', fontWeight: 800, color: 'rgba(255,255,255,0.05)', lineHeight: 1.05, margin: 0, letterSpacing: '-0.02em' }}>
            Gestiona<br />tu negocio.
          </h2>
        </div>

        {/* ── Card ── */}
        <div className="card-anim" style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 420,
          background: 'rgba(13,12,20,0.82)',
          backdropFilter: 'blur(36px)',
          WebkitBackdropFilter: 'blur(36px)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 22,
          padding: 'clamp(28px, 6vw, 44px) clamp(22px, 6vw, 40px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.025) inset',
        }}>

          {/* Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 16,
              padding: '12px 20px',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <Image
                src="/logo-rpm.png"
                alt="RPM"
                width={100}
                height={32}
                style={{ objectFit: 'contain', display: 'block' }}
                priority
              />
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h1 style={{ fontSize: 'clamp(20px,5vw,24px)', fontWeight: 700, color: '#fff', margin: '0 0 6px' }}>
              Iniciar sesión
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.32)', margin: 0, lineHeight: 1.5 }}>
              Accede a tu panel según tu rol
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Email */}
            <div>
              <label style={{
                display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.40)',
                marginBottom: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@empresa.com"
                className="rpm-input"
                autoComplete="email"
                inputMode="email"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block', fontSize: 11, color: 'rgba(255,255,255,0.40)',
                marginBottom: 8, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="rpm-input"
                  autoComplete="current-password"
                  style={{ paddingRight: 68 }}
                  required
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="eye-btn">
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
                borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#fca5a5', lineHeight: 1.5,
              }}>
                {error}
              </div>
            )}

            {/* Success */}
            {success && (
              <div style={{
                background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.16)',
                borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#6ee7b7',
              }}>
                {success}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} className="rpm-btn" style={{ marginTop: 6 }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ animation: 'spin 0.8s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Entrando...
                </span>
              ) : 'Entrar'}
            </button>

          </form>

          {/* Footer */}
          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,0.18)', lineHeight: 1.5 }}>
            RPM · Prehab Carabobo
          </p>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @media (min-width: 640px) {
            .watermark { display: block !important; }
          }
        `}</style>
      </div>
    </>
  )
}