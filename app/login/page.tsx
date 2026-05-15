"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useState } from "react";
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
      if (perfil.rol === "cliente") {
        router.replace("/cliente");
        return;
      }

      if (perfil.rol === "terapeuta") {
        router.replace("/empleado");
        return;
      }

      if (perfil.rol === "admin" || perfil.rol === "recepcion") {
        router.replace("/admin");
        return;
      }
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

    if (rol === "cliente") {
      router.replace("/cliente");
      return;
    }

    if (rol === "terapeuta") {
      router.replace("/empleado");
      return;
    }

    if (rol === "admin" || rol === "recepcionista" || rol === "recepcion") {
      router.replace("/admin");
      return;
    }

    router.replace("/sin-acceso");
  }

  async function verificarSesion() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) return;

    await redirigirUsuario(session.user.id);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (loginError) {
        setError(loginError.message || "No se pudo iniciar sesión");
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("No se pudo obtener el usuario autenticado");
        return;
      }

      setSuccess("Inicio de sesión correcto");
      await redirigirUsuario(user.id);
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegistro(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const payload =
        tipoRegistro === "existente"
          ? {
              tipo: "existente",
              cedula: registro.cedula,
              telefono: registro.telefono,
              email: registro.email,
              password: registro.password,
            }
          : {
              tipo: "nuevo",
              nombre: registro.nombre,
              cedula: registro.cedula,
              telefono: registro.telefono,
              email: registro.email,
              fecha_nacimiento: registro.fecha_nacimiento || null,
              motivo: registro.motivo || null,
            };

      const res = await fetch("/api/auth/registro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "No se pudo completar el registro.");
      }

      setSuccess(data.message || "Registro completado correctamente.");

      if (tipoRegistro === "existente") {
        setVista("login");
        setEmail(registro.email);
        setPassword("");
      }

      setRegistro({
        nombre: "",
        cedula: "",
        telefono: "",
        email: "",
        password: "",
        fecha_nacimiento: "",
        motivo: "",
      });
    } catch (err: any) {
      setError(err?.message || "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecuperar(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${window.location.origin}/actualizar-password` },
      );

      if (resetError) throw resetError;

      setSuccess(
        "Te enviamos un correo con el enlace para restablecer tu contraseña. Revisa tu bandeja de entrada.",
      );
      setEmail("");
    } catch (err: any) {
      setError(err?.message || "No se pudo enviar el correo. Verifica el email ingresado.");
    } finally {
      setLoading(false);
    }
  }

  function updateRegistro(name: string, value: string) {
    setRegistro((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <>
      <style>{`
        @keyframes drift1 {
          0%,100% { transform: translate(0,0) scale(1); }
          40% { transform: translate(5%,-7%) scale(1.06); }
          70% { transform: translate(-4%,5%) scale(0.97); }
        }
        @keyframes drift2 {
          0%,100% { transform: translate(0,0) scale(1); }
          35% { transform: translate(-6%,4%) scale(1.04); }
          65% { transform: translate(5%,-5%) scale(0.98); }
        }
        @keyframes drift3 {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(3%,8%) scale(1.03); }
        }
        @keyframes slideUp {
          from { opacity:0; transform:translateY(32px) scale(0.98); }
          to { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes fadeIn {
          from { opacity:0; }
          to { opacity:1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .d1 { animation: drift1 16s ease-in-out infinite; }
        .d2 { animation: drift2 20s ease-in-out infinite; }
        .d3 { animation: drift3 24s ease-in-out infinite; }
        .card-anim { animation: slideUp 0.65s cubic-bezier(.22,1,.36,1) 0.05s both; }
        .bg-anim { animation: fadeIn 0.4s ease both; }

        .rpm-input {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255,255,255,0.045);
          border: 1.5px solid rgba(255,255,255,0.09);
          border-radius: 14px;
          padding: 15px 16px;
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
          padding: 16px;
          font-size: 15px;
          font-weight: 800;
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
        .rpm-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
        }

        .rpm-secondary-btn {
          width: 100%;
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.78);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 13px;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
        }

        .rpm-tab {
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          color: rgba(255,255,255,0.48);
          border-radius: 14px;
          padding: 11px 10px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }

        .rpm-tab-active {
          background: rgba(124,58,237,0.95);
          color: white;
          border-color: rgba(167,139,250,0.4);
        }

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
          font-weight: 700;
          white-space: nowrap;
        }

        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0px 1000px rgba(20,18,30,0.95) inset !important;
          -webkit-text-fill-color: #fff !important;
          border-color: rgba(139,92,246,0.4) !important;
          transition: background-color 5000s ease-in-out 0s;
        }

        @media (min-width: 640px) {
          .watermark { display: block !important; }
        }
      `}</style>

      <div
        className="bg-anim"
        style={{
          minHeight: "100dvh",
          background: "#0b0b10",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 16px",
        }}
      >
        <div
          className="d1"
          style={{
            position: "absolute",
            borderRadius: "50%",
            width: "min(70vw, 520px)",
            height: "min(70vw, 520px)",
            top: "-18%",
            right: "-12%",
            background:
              "radial-gradient(circle, rgba(109,40,217,0.60) 0%, transparent 68%)",
            filter: "blur(70px)",
          }}
        />

        <div
          className="d2"
          style={{
            position: "absolute",
            borderRadius: "50%",
            width: "min(60vw, 440px)",
            height: "min(60vw, 440px)",
            bottom: "-14%",
            left: "-8%",
            background:
              "radial-gradient(circle, rgba(167,139,250,0.40) 0%, transparent 68%)",
            filter: "blur(80px)",
          }}
        />

        <div
          className="d3"
          style={{
            position: "absolute",
            borderRadius: "50%",
            width: "min(45vw, 320px)",
            height: "min(45vw, 320px)",
            top: "30%",
            left: "10%",
            background:
              "radial-gradient(circle, rgba(76,29,149,0.45) 0%, transparent 68%)",
            filter: "blur(60px)",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at center, transparent 20%, rgba(0,0,0,0.55) 100%)",
          }}
        />

        <div
          className="card-anim"
          style={{
            position: "relative",
            zIndex: 10,
            width: "100%",
            maxWidth: 440,
            background: "rgba(13,12,20,0.82)",
            backdropFilter: "blur(36px)",
            WebkitBackdropFilter: "blur(36px)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 22,
            padding: "clamp(24px, 6vw, 40px)",
            boxShadow:
              "0 32px 80px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.025) inset",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>
            <div
              style={{
                background: "rgba(255,255,255,0.06)",
                borderRadius: 16,
                padding: "12px 20px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Image
                src="/logo-rpm.png"
                alt="RPM"
                width={100}
                height={32}
                style={{ objectFit: "contain", display: "block" }}
                priority
              />
            </div>
          </div>

          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <h1
              style={{
                fontSize: "clamp(20px,5vw,24px)",
                fontWeight: 800,
                color: "#fff",
                margin: "0 0 6px",
              }}
            >
              {vista === "login" ? "Iniciar sesión" : vista === "recuperar" ? "Recuperar contraseña" : "Crear cuenta"}
            </h1>

            <p
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.34)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {vista === "login"
                ? "Accede a tu panel según tu rol"
                : vista === "recuperar"
                ? "Te enviaremos un enlace para restablecer tu contraseña"
                : "Activa tu acceso o solicita registrarte en RPM"}
            </p>
          </div>

          {vista === "recuperar" ? (
            <form onSubmit={handleRecuperar} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <FieldLabel label="Correo electrónico">
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
              </FieldLabel>

              <Alerts error={error} success={success} />

              <button type="submit" disabled={loading} className="rpm-btn">
                {loading ? "Enviando..." : "Enviar enlace"}
              </button>

              <button
                type="button"
                className="rpm-secondary-btn"
                onClick={() => { setVista("login"); setError(""); setSuccess(""); setEmail(""); }}
              >
                Volver al login
              </button>
            </form>
          ) : vista === "login" ? (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <FieldLabel label="Correo electrónico">
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
              </FieldLabel>

              <FieldLabel label="Contraseña">
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="rpm-input"
                    autoComplete="current-password"
                    style={{ paddingRight: 68 }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="eye-btn"
                  >
                    {showPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </FieldLabel>

              <Alerts error={error} success={success} />

              <button type="submit" disabled={loading} className="rpm-btn">
                {loading ? "Entrando..." : "Entrar"}
              </button>

              <button
                type="button"
                className="rpm-secondary-btn"
                onClick={() => {
                  setVista("registro");
                  setError("");
                  setSuccess("");
                }}
              >
                Crear cuenta / Solicitar acceso
              </button>

              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(167,139,250,0.75)",
                  fontSize: 13,
                  cursor: "pointer",
                  padding: "4px 0",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
                onClick={() => {
                  setVista("recuperar");
                  setError("");
                  setSuccess("");
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegistro} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button
                  type="button"
                  className={`rpm-tab ${tipoRegistro === "existente" ? "rpm-tab-active" : ""}`}
                  onClick={() => {
                    setTipoRegistro("existente");
                    setError("");
                    setSuccess("");
                  }}
                >
                  Soy usuario RPM
                </button>

                <button
                  type="button"
                  className={`rpm-tab ${tipoRegistro === "nuevo" ? "rpm-tab-active" : ""}`}
                  onClick={() => {
                    setTipoRegistro("nuevo");
                    setError("");
                    setSuccess("");
                  }}
                >
                  No soy usuario
                </button>
              </div>

              {tipoRegistro === "nuevo" && (
                <FieldLabel label="Nombre completo">
                  <input
                    className="rpm-input"
                    value={registro.nombre}
                    onChange={(e) => updateRegistro("nombre", e.target.value)}
                    placeholder="Nombre y apellido"
                    required
                  />
                </FieldLabel>
              )}

              <FieldLabel label="Cédula">
                <input
                  className="rpm-input"
                  value={registro.cedula}
                  onChange={(e) => updateRegistro("cedula", e.target.value)}
                  placeholder="Ej: V12345678"
                  required={tipoRegistro === "existente"}
                />
              </FieldLabel>

              <FieldLabel label="Teléfono">
                <input
                  className="rpm-input"
                  value={registro.telefono}
                  onChange={(e) => updateRegistro("telefono", e.target.value)}
                  placeholder="04141234567"
                  required
                />
              </FieldLabel>

              <FieldLabel label="Correo electrónico">
                <input
                  type="email"
                  className="rpm-input"
                  value={registro.email}
                  onChange={(e) => updateRegistro("email", e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                />
              </FieldLabel>

              {tipoRegistro === "existente" && (
                <FieldLabel label="Crear contraseña">
                  <input
                    type="password"
                    className="rpm-input"
                    value={registro.password}
                    onChange={(e) => updateRegistro("password", e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                  />
                </FieldLabel>
              )}

              {tipoRegistro === "nuevo" && (
                <>
                  <FieldLabel label="Fecha de nacimiento">
                    <input
                      type="date"
                      className="rpm-input"
                      value={registro.fecha_nacimiento}
                      onChange={(e) => updateRegistro("fecha_nacimiento", e.target.value)}
                    />
                  </FieldLabel>

                  <FieldLabel label="Motivo o servicio de interés">
                    <textarea
                      className="rpm-input"
                      value={registro.motivo}
                      onChange={(e) => updateRegistro("motivo", e.target.value)}
                      placeholder="Ej: fisioterapia, entrenamiento, evaluación..."
                      rows={3}
                      style={{ resize: "none" }}
                    />
                  </FieldLabel>
                </>
              )}

              <Alerts error={error} success={success} />

              <button type="submit" disabled={loading} className="rpm-btn">
                {loading
                  ? "Procesando..."
                  : tipoRegistro === "existente"
                  ? "Crear mi acceso"
                  : "Enviar solicitud"}
              </button>

              <button
                type="button"
                className="rpm-secondary-btn"
                onClick={() => {
                  setVista("login");
                  setError("");
                  setSuccess("");
                }}
              >
                Volver al login
              </button>
            </form>
          )}

          <p
            style={{
              textAlign: "center",
              marginTop: 20,
              fontSize: 12,
              color: "rgba(255,255,255,0.18)",
              lineHeight: 1.5,
            }}
          >
            RPM · Prehab Carabobo
          </p>
        </div>
      </div>
    </>
  );
}

function FieldLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 11,
          color: "rgba(255,255,255,0.42)",
          marginBottom: 8,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
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
        <div
          style={{
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.18)",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 13,
            color: "#fca5a5",
            lineHeight: 1.5,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            background: "rgba(52,211,153,0.07)",
            border: "1px solid rgba(52,211,153,0.16)",
            borderRadius: 12,
            padding: "12px 14px",
            fontSize: 13,
            color: "#6ee7b7",
          }}
        >
          {success}
        </div>
      )}
    </>
  );
}