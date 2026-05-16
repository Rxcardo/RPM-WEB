"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Image from "next/image";

type Vista = "login" | "registro" | "recuperar";
type TipoRegistro = "existente" | "nuevo";

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function getRolNombre(empleado: any): string | null {
  const rol = firstOrNull(empleado?.roles);
  return rol?.nombre ? String(rol.nombre) : null;
}

export default function LoginPage() {
  const router = useRouter();

  const [vista, setVista] = useState<Vista>("login");
  const [tipoRegistro, setTipoRegistro] = useState<TipoRegistro>("existente");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [registro, setRegistro] = useState({
    nombre: "",
    identificador: "",
    cedula: "",
    telefono: "",
    email: "",
    password: "",
    fecha_nacimiento: "",
    motivo: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    void verificarSesion();
  }, []);

  async function redirigirUsuario(userId: string) {
    const { data: perfil } = await supabase
      .from("perfiles_usuario")
      .select("rol, activo, cliente_id, empleado_id")
      .eq("id", userId)
      .maybeSingle();

    if (perfil?.activo) {
      if (perfil.rol === "cliente") { router.replace("/cliente"); return; }
      if (perfil.rol === "terapeuta") { router.replace("/empleado"); return; }
      if (perfil.rol === "admin" || perfil.rol === "recepcion") { router.replace("/admin"); return; }
    }

    const { data: cliente } = await supabase
      .from("clientes")
      .select("id, auth_user_id, acceso_portal, estado")
      .eq("auth_user_id", userId)
      .maybeSingle();

    if (cliente?.acceso_portal && cliente.estado !== "eliminado") {
      router.replace("/cliente");
      return;
    }

    const { data: empleado } = await supabase
      .from("empleados")
      .select("id, auth_user_id, rol, roles:rol_id(nombre)")
      .eq("auth_user_id", userId)
      .maybeSingle();

    const rol = getRolNombre(empleado) ?? empleado?.rol ?? null;

    if (rol === "cliente") { router.replace("/cliente"); return; }
    if (rol === "terapeuta") { router.replace("/empleado"); return; }
    if (rol === "admin" || rol === "recepcionista" || rol === "recepcion") { router.replace("/admin"); return; }

    router.replace("/sin-acceso");
  }

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await redirigirUsuario(session.user.id);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (loginError) { setError(loginError.message || "No se pudo iniciar sesión"); return; }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { setError("No se pudo obtener el usuario autenticado"); return; }

      setSuccess("Inicio de sesión correcto");
      await redirigirUsuario(user.id);
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const payload =
        tipoRegistro === "existente"
          ? { tipo: "existente", identificador: registro.identificador, password: registro.password }
          : { tipo: "nuevo", nombre: registro.nombre, cedula: registro.cedula, telefono: registro.telefono, email: registro.email, fecha_nacimiento: registro.fecha_nacimiento || null, motivo: registro.motivo || null };

      const res = await fetch("/api/auth/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo completar el registro.");

      setSuccess(data.message || "Registro completado correctamente.");

      if (tipoRegistro === "existente") {
        setVista("login");
        setEmail(data.email || registro.identificador);
        setPassword("");
      }

      setRegistro({ nombre: "", identificador: "", cedula: "", telefono: "", email: "", password: "", fecha_nacimiento: "", motivo: "" });
    } catch (err: any) {
      setError(err?.message || "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecuperar(e: React.FormEvent) {
  e.preventDefault();

  setLoading(true);
  setError("");
  setSuccess("");

  try {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo:
          "https://www.rpmvzla.com/auth/callback?next=/actualizar-password",
      }
    );

    if (resetError) throw resetError;

    setSuccess("Te enviamos un correo con el enlace para restablecer tu contraseña.");
    setEmail("");
  } catch (err: any) {
    setError(err?.message || "No se pudo enviar el correo de recuperación.");
  } finally {
    setLoading(false);
  }
}

  function updateRegistro(name: string, value: string) {
    setRegistro((prev) => ({ ...prev, [name]: value }));
  }

  function reset() {
    setError("");
    setSuccess("");
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .rpm-card { animation: fadeUp 0.5s cubic-bezier(.16,1,.3,1) both; }

        .rpm-input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 12px 14px 12px 42px;
          color: #f0ecff;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color .2s, background .2s, box-shadow .2s;
          -webkit-appearance: none;
        }
        .rpm-input-bare { padding-left: 14px; }
        .rpm-input::placeholder { color: rgba(255,255,255,0.22); }
        .rpm-input:focus {
          border-color: rgba(139,92,246,0.6);
          background: rgba(139,92,246,0.07);
          box-shadow: 0 0 0 3px rgba(139,92,246,0.12);
        }

        .rpm-btn {
          width: 100%;
          background: #7c3aed;
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 13px;
          font-size: 14px;
          font-weight: 700;
          font-family: 'Inter', sans-serif;
          letter-spacing: 0.01em;
          cursor: pointer;
          transition: background .18s, transform .12s, box-shadow .18s;
          box-shadow: 0 4px 16px rgba(124,58,237,0.35);
        }
        .rpm-btn:hover:not(:disabled) {
          background: #6d28d9;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(124,58,237,0.45);
        }
        .rpm-btn:active:not(:disabled) { transform: translateY(0); }
        .rpm-btn:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }

        .rpm-btn-ghost {
          width: 100%;
          background: transparent;
          color: rgba(255,255,255,0.45);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 12px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          cursor: pointer;
          transition: background .18s, border-color .18s, color .18s;
        }
        .rpm-btn-ghost:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.18); color: rgba(255,255,255,0.7); }

        .rpm-tab {
          flex: 1;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 9px 8px;
          font-size: 12px;
          font-weight: 600;
          font-family: 'Inter', sans-serif;
          color: rgba(255,255,255,0.38);
          cursor: pointer;
          transition: all .15s;
          text-align: center;
        }
        .rpm-tab-active {
          background: rgba(124,58,237,0.15);
          border-color: rgba(139,92,246,0.35);
          color: #c4b5fd;
        }

        .rpm-icon {
          position: absolute;
          left: 13px;
          top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.22);
          pointer-events: none;
          display: flex;
          align-items: center;
        }

        .rpm-eye {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: rgba(255,255,255,0.28);
          cursor: pointer;
          padding: 4px;
          font-size: 11px;
          font-weight: 700;
          font-family: 'Inter', sans-serif;
          transition: color .15s;
        }
        .rpm-eye:hover { color: #c4b5fd; }

        .rpm-spinner {
          display: inline-block;
          width: 13px;
          height: 13px;
          border: 2px solid rgba(255,255,255,0.25);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin .55s linear infinite;
          vertical-align: middle;
          margin-right: 7px;
        }

        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 1000px #0f0e1a inset !important;
          -webkit-text-fill-color: #f0ecff !important;
          border-color: rgba(139,92,246,0.5) !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>

      <div style={{
        minHeight: "100dvh",
        background: "#080810",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Fondo: un único glow suave, no tres orbs */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(109,40,217,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        {/* Grid muy sutil */}
        <div style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(ellipse 65% 55% at 50% 50%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 65% 55% at 50% 50%, black 30%, transparent 100%)",
          pointerEvents: "none",
        }} />

        {/* Card */}
        <div className="rpm-card" style={{
          position: "relative",
          zIndex: 10,
          width: "100%",
          maxWidth: 400,
          background: "rgba(11,10,20,0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.04) inset",
        }}>
          {/* Línea superior */}
          <div style={{ height: 2, background: "linear-gradient(90deg, transparent, #7c3aed 40%, #a855f7 60%, transparent)" }} />

          <div style={{ padding: "clamp(28px,6vw,40px)" }}>

            {/* Marca */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 28, gap: 10 }}>
              <div style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 18,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Image
                  src="/logo-nuevo.png"
                  alt="RPM Venezuela"
                  width={72}
                  height={72}
                  style={{ objectFit: "contain", display: "block" }}
                  priority
                />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: "#e9e4ff", letterSpacing: "-0.01em" }}>
                  RPM Venezuela
                </p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.28)", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 2 }}>
                  Rehabilitación · Programación · Movimiento
                </p>
              </div>
            </div>

            {/* Separador */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", marginBottom: 24 }} />

            {/* Título dinámico */}
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "#f0ecff", letterSpacing: "-0.02em" }}>
                {vista === "login" && "Ingresar"}
                {vista === "recuperar" && "Recuperar acceso"}
                {vista === "registro" && "Crear cuenta"}
              </h1>
              {vista === "registro" && (
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 4 }}>
                  Activa tu acceso o solicita registro
                </p>
              )}
            </div>

            {/* ── RECUPERAR ── */}
            {vista === "recuperar" && (
              <form onSubmit={handleRecuperar} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Field label="Correo electrónico">
                  <div style={{ position: "relative" }}>
                    <span className="rpm-icon"><IconMail /></span>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className="rpm-input" autoComplete="email" inputMode="email" required />
                  </div>
                </Field>

                <Alerts error={error} success={success} />

                <button type="submit" disabled={loading} className="rpm-btn">
                  {loading ? <><span className="rpm-spinner" />Enviando...</> : "Enviar enlace"}
                </button>
                <button type="button" className="rpm-btn-ghost" onClick={() => { setVista("login"); reset(); setEmail(""); }}>
                  ← Volver
                </button>
              </form>
            )}

            {/* ── LOGIN ── */}
            {vista === "login" && (
              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <Field label="Correo electrónico">
                  <div style={{ position: "relative" }}>
                    <span className="rpm-icon"><IconMail /></span>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className="rpm-input" autoComplete="email" inputMode="email" required />
                  </div>
                </Field>

                <Field label="Contraseña">
                  <div style={{ position: "relative" }}>
                    <span className="rpm-icon"><IconLock /></span>
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="rpm-input" autoComplete="current-password" style={{ paddingRight: 64 }} required />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="rpm-eye">
                      {showPassword ? "Ocultar" : "Ver"}
                    </button>
                  </div>
                </Field>

                <div style={{ textAlign: "right" }}>
                  <button type="button" onClick={() => { setVista("recuperar"); reset(); }} style={{ background: "none", border: "none", color: "rgba(167,139,250,0.55)", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, transition: "color .15s" }}>
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <Alerts error={error} success={success} />

                <button type="submit" disabled={loading} className="rpm-btn" style={{ marginTop: 2 }}>
                  {loading ? <><span className="rpm-spinner" />Entrando...</> : "Entrar"}
                </button>

                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />

                <button type="button" className="rpm-btn-ghost" onClick={() => { setVista("registro"); reset(); }}>
                  Crear cuenta / Solicitar acceso
                </button>
              </form>
            )}

            {/* ── REGISTRO ── */}
            {vista === "registro" && (
              <form onSubmit={handleRegistro} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" className={`rpm-tab ${tipoRegistro === "existente" ? "rpm-tab-active" : ""}`} onClick={() => { setTipoRegistro("existente"); reset(); }}>
                    Soy usuario RPM
                  </button>
                  <button type="button" className={`rpm-tab ${tipoRegistro === "nuevo" ? "rpm-tab-active" : ""}`} onClick={() => { setTipoRegistro("nuevo"); reset(); }}>
                    No soy usuario
                  </button>
                </div>

                {tipoRegistro === "existente" && (
                  <>
                    <Field label="Tu cédula, teléfono o correo">
                      <input
                        className="rpm-input rpm-input-bare"
                        value={registro.identificador}
                        onChange={(e) => updateRegistro("identificador", e.target.value)}
                        placeholder="V12345678 · 04141234567 · correo@ejemplo.com"
                        autoComplete="off"
                        required
                      />
                    </Field>
                    <Field label="Crear contraseña">
                      <div style={{ position: "relative" }}>
                        <span className="rpm-icon"><IconLock /></span>
                        <input type="password" className="rpm-input" value={registro.password} onChange={(e) => updateRegistro("password", e.target.value)} placeholder="Mínimo 6 caracteres" required />
                      </div>
                    </Field>
                  </>
                )}

                {tipoRegistro === "nuevo" && (
                  <>
                    <Field label="Nombre completo">
                      <input className="rpm-input rpm-input-bare" value={registro.nombre} onChange={(e) => updateRegistro("nombre", e.target.value)} placeholder="Nombre y apellido" required />
                    </Field>
                    <Field label="Cédula">
                      <input className="rpm-input rpm-input-bare" value={registro.cedula} onChange={(e) => updateRegistro("cedula", e.target.value)} placeholder="V12345678" />
                    </Field>
                    <Field label="Teléfono">
                      <input className="rpm-input rpm-input-bare" value={registro.telefono} onChange={(e) => updateRegistro("telefono", e.target.value)} placeholder="04141234567" inputMode="tel" required />
                    </Field>
                    <Field label="Correo electrónico">
                      <div style={{ position: "relative" }}>
                        <span className="rpm-icon"><IconMail /></span>
                        <input type="email" className="rpm-input" value={registro.email} onChange={(e) => updateRegistro("email", e.target.value)} placeholder="correo@ejemplo.com" inputMode="email" required />
                      </div>
                    </Field>
                    <Field label="Fecha de nacimiento">
                      <input type="date" className="rpm-input rpm-input-bare" value={registro.fecha_nacimiento} onChange={(e) => updateRegistro("fecha_nacimiento", e.target.value)} />
                    </Field>
                    <Field label="Motivo o servicio de interés">
                      <textarea className="rpm-input rpm-input-bare" value={registro.motivo} onChange={(e) => updateRegistro("motivo", e.target.value)} placeholder="Ej: fisioterapia, entrenamiento, evaluación..." rows={3} style={{ resize: "none", paddingTop: 11, paddingBottom: 11, minHeight: "auto" }} />
                    </Field>
                  </>
                )}

                <Alerts error={error} success={success} />

                <button type="submit" disabled={loading} className="rpm-btn">
                  {loading
                    ? <><span className="rpm-spinner" />Procesando...</>
                    : tipoRegistro === "existente" ? "Crear mi acceso" : "Enviar solicitud"}
                </button>

                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />

                <button type="button" className="rpm-btn-ghost" onClick={() => { setVista("login"); reset(); }}>
                  ← Volver al inicio de sesión
                </button>
              </form>
            )}

            {/* Footer */}
            <p style={{ textAlign: "center", marginTop: 24, fontSize: 10, color: "rgba(255,255,255,0.12)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              rpmvzla.com
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 6, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Alerts({ error, success }: { error: string; success: string }) {
  return (
    <>
      {error && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 10, padding: "11px 14px", fontSize: 13, color: "#fca5a5", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>⚠</span>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.18)", borderRadius: 10, padding: "11px 14px", fontSize: 13, color: "#6ee7b7", lineHeight: 1.5, display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span style={{ flexShrink: 0, marginTop: 1 }}>✓</span>
          <span>{success}</span>
        </div>
      )}
    </>
  );
}

function IconMail() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="m2 7 10 7 10-7" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
