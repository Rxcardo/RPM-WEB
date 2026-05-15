"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function ActualizarPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sesionLista, setSesionLista] = useState(false);

  useEffect(() => {
    // Supabase inyecta la sesión de recuperación desde el hash de la URL
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSesionLista(true);
      }
    });
  }, []);

  async function handleActualizar(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setSuccess("Contraseña actualizada correctamente. Redirigiendo al login...");
      setTimeout(() => router.replace("/login"), 2500);
    } catch (err: any) {
      setError(err?.message || "No se pudo actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform:translateY(32px) scale(0.98); }
          to { opacity:1; transform:translateY(0) scale(1); }
        }
        .card-anim { animation: slideUp 0.65s cubic-bezier(.22,1,.36,1) 0.05s both; }
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
        }
        .rpm-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 12px 28px rgba(109,40,217,0.45);
        }
        .rpm-btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
        .eye-btn {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          background: none; border: none; color: rgba(255,255,255,0.4);
          cursor: pointer; padding: 4px 6px; font-size: 13px; font-weight: 700; white-space: nowrap;
        }
      `}</style>

      <div
        style={{
          minHeight: "100dvh",
          background: "#0b0b10",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 16px",
        }}
      >
        <div
          className="card-anim"
          style={{
            width: "100%",
            maxWidth: 420,
            background: "rgba(13,12,20,0.82)",
            backdropFilter: "blur(36px)",
            WebkitBackdropFilter: "blur(36px)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 22,
            padding: "clamp(24px, 6vw, 40px)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.55)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>
              Nueva contraseña
            </h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.34)", margin: 0 }}>
              {sesionLista
                ? "Ingresa tu nueva contraseña"
                : "Verificando enlace de recuperación..."}
            </p>
          </div>

          {!sesionLista ? (
            <div
              style={{
                textAlign: "center",
                padding: "24px 0",
                color: "rgba(255,255,255,0.35)",
                fontSize: 13,
              }}
            >
              Cargando sesión... Si esto tarda mucho,{" "}
              <button
                type="button"
                onClick={() => router.replace("/login")}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(167,139,250,0.75)",
                  cursor: "pointer",
                  fontSize: 13,
                  textDecoration: "underline",
                }}
              >
                vuelve al login
              </button>
              .
            </div>
          ) : (
            <form onSubmit={handleActualizar} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
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
                  Nueva contraseña
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="rpm-input"
                    autoComplete="new-password"
                    style={{ paddingRight: 68 }}
                    required
                  />
                  <button
                    type="button"
                    className="eye-btn"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </div>

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
                  Confirmar contraseña
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="rpm-input"
                  autoComplete="new-password"
                  required
                />
              </div>

              {error && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.18)",
                    borderRadius: 12,
                    padding: "12px 14px",
                    fontSize: 13,
                    color: "#fca5a5",
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

              <button type="submit" disabled={loading} className="rpm-btn">
                {loading ? "Guardando..." : "Actualizar contraseña"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
