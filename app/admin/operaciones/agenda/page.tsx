"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import ActionCard from "@/components/ui/ActionCard";

// ─── Types ───────────────────────────────────────────────────────────────────

type CitaRow = {
  id: string;
  fecha: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  estado: string;
  notas: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  cliente_plan_id: string | null;
  clientes: {
    id: string;
    nombre: string | null;
    telefono: string | null;
    email: string | null;
  } | null;
  empleados: {
    id: string;
    nombre: string | null;
    rol: string | null;
  } | null;
  servicios: {
    id: string;
    nombre: string | null;
    duracion_minutos: number | null;
  } | null;
  creado_por: {
    id: string;
    nombre: string | null;
  } | null;
  editado_por: {
    id: string;
    nombre: string | null;
  } | null;
  clientes_planes: {
    id: string;
    sesiones_totales: number | null;
    sesiones_usadas: number | null;
    estado: string | null;
    planes: {
      id: string;
      nombre: string | null;
    } | null;
  } | null;
};

type EstadoCita =
  | "programada"
  | "confirmada"
  | "completada"
  | "cancelada"
  | "reprogramada"
  | "no_asistio";

type EstadoFiltro = "todos" | EstadoCita;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ITEMS_POR_PAGINA = 15;

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function formatDateTime(
  fecha: string | null | undefined,
  hora?: string | null,
) {
  if (!fecha) return "—";
  const fechaStr = formatDate(fecha);
  return hora ? `${fechaStr} · ${hora.slice(0, 5)}` : fechaStr;
}

function formatAuditDate(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-VE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function getAuditLines(cita: CitaRow) {
  const creador = cita.creado_por?.nombre || "Sin registro";
  const editor = cita.editado_por?.nombre || "Sin registro";
  const createdAt = formatAuditDate(cita.created_at);
  const updatedAt = formatAuditDate(cita.updated_at);
  const wasEdited =
    !!cita.updated_at &&
    cita.updated_at !== cita.created_at &&
    !!cita.updated_by;

  if (!wasEdited) return [`Creó: ${creador} · ${createdAt}`];
  return [`Creó: ${creador} · ${createdAt}`, `Editó: ${editor} · ${updatedAt}`];
}

function estadoBadge(estado: string) {
  switch ((estado || "").toLowerCase()) {
    case "programada":
      return "border-sky-400/25 bg-sky-400/10 text-sky-300";
    case "confirmada":
      return "border-emerald-400/25 bg-emerald-400/10 text-emerald-300";
    case "completada":
      return "border-violet-400/25 bg-violet-400/10 text-violet-300";
    case "cancelada":
      return "border-rose-400/25 bg-rose-400/10 text-rose-300";
    case "reprogramada":
      return "border-amber-400/25 bg-amber-400/10 text-amber-300";
    case "no_asistio":
    case "no asistio":
      return "border-orange-400/25 bg-orange-400/10 text-orange-300";
    default:
      return "border-white/10 bg-white/[0.05] text-white/70";
  }
}

function tipoCitaBadge(cita: CitaRow) {
  if (cita.cliente_plan_id)
    return "border-violet-400/25 bg-violet-400/10 text-violet-300";
  const notas = (cita.notas || "").toLowerCase();
  const servicio = (cita.servicios?.nombre || "").toLowerCase();
  if (notas.includes("recovery") || servicio.includes("recovery"))
    return "border-amber-400/25 bg-amber-400/10 text-amber-300";
  return "border-white/10 bg-white/[0.05] text-white/70";
}

function getTipoCita(cita: CitaRow) {
  if (cita.cliente_plan_id) return "Plan";
  const notas = (cita.notas || "").toLowerCase();
  const servicio = (cita.servicios?.nombre || "").toLowerCase();
  if (notas.includes("recovery") || servicio.includes("recovery"))
    return "Recovery";
  return "Independiente";
}

function getPlanDisponible(cita: CitaRow) {
  const total = Number(cita.clientes_planes?.sesiones_totales || 0);
  const usadas = Number(cita.clientes_planes?.sesiones_usadas || 0);
  return Math.max(total - usadas, 0);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ActionButton({
  children,
  onClick,
  disabled = false,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "default" | "confirm" | "complete" | "cancel" | "restore";
}) {
  const toneCls =
    tone === "confirm"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
      : tone === "complete"
        ? "border-violet-400/20 bg-violet-400/10 text-violet-300 hover:bg-violet-400/20"
        : tone === "cancel"
          ? "border-rose-400/20 bg-rose-400/10 text-rose-300 hover:bg-rose-400/20"
          : tone === "restore"
            ? "border-amber-400/20 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
            : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${toneCls}`}
    >
      {children}
    </button>
  );
}

// Tab de estado con conteo
function EstadoTab({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        group flex flex-col items-start gap-1 rounded-2xl border px-5 py-4 text-left
        transition-all duration-200 cursor-pointer
        ${
          active
            ? "border-white/20 bg-white/[0.08] shadow-lg shadow-black/20"
            : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10"
        }
      `}
    >
      <span
        className={`text-2xl font-bold tracking-tight ${active ? color : "text-white/80"}`}
      >
        {count}
      </span>
      <span
        className={`text-xs font-medium ${active ? "text-white/80" : "text-white/40"}`}
      >
        {label}
      </span>
      {active && (
        <span
          className={`mt-0.5 h-0.5 w-6 rounded-full ${color.replace("text-", "bg-")}`}
        />
      )}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AgendaPage() {
  const [loading, setLoading] = useState(true);
  const [citas, setCitas] = useState<CitaRow[]>([]);
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [fechaFiltro, setFechaFiltro] = useState("");
  const [pagina, setPagina] = useState(1);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [empleadoActualId, setEmpleadoActualId] = useState<string>("");

  useEffect(() => {
    void loadAgenda();
    void loadEmpleadoActual();
  }, []);

  // Reset página al cambiar filtros
  useEffect(() => {
    setPagina(1);
  }, [search, estadoFiltro, fechaFiltro]);

  async function resolveEmpleadoActualId(): Promise<string> {
    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError) return "";
      const authUserId = authData.user?.id;
      if (!authUserId) return "";

      const { data: empleadoPorAuth, error: errorPorAuth } = await supabase
        .from("empleados")
        .select("id, nombre, auth_user_id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (!errorPorAuth && empleadoPorAuth?.id)
        return String(empleadoPorAuth.id);

      const { data: empleadoPorId, error: errorPorId } = await supabase
        .from("empleados")
        .select("id, nombre")
        .eq("id", authUserId)
        .maybeSingle();

      if (!errorPorId && empleadoPorId?.id) return String(empleadoPorId.id);

      return "";
    } catch {
      return "";
    }
  }

  async function loadEmpleadoActual() {
    const empleadoId = await resolveEmpleadoActualId();
    setEmpleadoActualId(empleadoId);
  }

  async function loadAgenda() {
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase
        .from("citas")
        .select(
          `
          id,
          fecha,
          hora_inicio,
          hora_fin,
          estado,
          notas,
          created_at,
          updated_at,
          created_by,
          updated_by,
          cliente_plan_id,
          clientes:cliente_id ( id, nombre, telefono, email ),
          empleados:terapeuta_id ( id, nombre, rol ),
          servicios:servicio_id ( id, nombre, duracion_minutos ),
          creado_por:created_by ( id, nombre ),
          editado_por:updated_by ( id, nombre ),
          clientes_planes:cliente_plan_id (
            id,
            sesiones_totales,
            sesiones_usadas,
            estado,
            planes:plan_id ( id, nombre )
          )
        `,
        )
        .order("fecha", { ascending: false })
        .order("hora_inicio", { ascending: false });

      if (err) throw new Error(err.message);
      setCitas((data || []) as unknown as CitaRow[]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No se pudo cargar la agenda.");
      setCitas([]);
    } finally {
      setLoading(false);
    }
  }

  async function cambiarEstado(
    cita: CitaRow,
    nuevoEstado: "confirmada" | "completada" | "cancelada",
  ) {
    setActionError("");
    const estadoActual = (cita.estado || "").toLowerCase();
    if (estadoActual === nuevoEstado) return;

    if (
      nuevoEstado === "cancelada" &&
      !window.confirm(
        `¿Seguro que deseas cancelar la cita de ${cita.clientes?.nombre || "este cliente"}?

La cita quedará registrada como cancelada y se eliminarán/reversarán pagos, cuentas por cobrar, abonos, créditos, movimientos y comisiones relacionadas.

¿Deseas continuar?`,
      )
    )
      return;

    if (
      nuevoEstado === "completada" &&
      !window.confirm(
        cita.cliente_plan_id
          ? `¿Seguro que deseas completar esta cita?\n\nEsta cita está ligada a un plan y al completarla consumirá 1 sesión de ese plan.`
          : `¿Seguro que deseas completar esta cita?\n\nEsta cita no está ligada a un plan, así que no consumirá sesiones.`,
      )
    )
      return;

    setUpdatingId(cita.id);
    try {
      let auditorId = empleadoActualId || "";
      if (!auditorId) {
        auditorId = await resolveEmpleadoActualId();
        setEmpleadoActualId(auditorId);
      }

      if (nuevoEstado === "cancelada") {
        const { data, error } = await supabase.rpc("cancelar_cita_segura", {
          p_cita_id: cita.id,
          p_usuario_id: auditorId || null,
          p_revertir_finanzas: true,
          p_motivo: "cancelada_desde_agenda",
        });

        if (error) throw new Error(error.message);
        console.info("Cita cancelada con reversión financiera:", data);
      } else {
        const { error: updateError } = await supabase
          .from("citas")
          .update({ estado: nuevoEstado, updated_by: auditorId || null })
          .eq("id", cita.id);

        if (updateError) throw new Error(updateError.message);
      }

      await loadAgenda();
    } catch (err: any) {
      console.error(err);
      setActionError(err?.message || "No se pudo cambiar/cancelar la cita.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function volverAProgramada(cita: CitaRow) {
    setActionError("");

    const estadoActual = (cita.estado || "").toLowerCase() as EstadoCita;
    const estadoDestino: EstadoCita = "programada";

    if (estadoActual === estadoDestino) return;

    // Regla solicitada: una cita cancelada NO se puede regresar a otro estado.
    // Cancelar ya reversa pagos/deudas/movimientos/comisiones y no debe recrearse desde aquí.
    if (estadoActual === "cancelada") {
      setActionError(
        "Las citas canceladas no se pueden regresar a otro estado. Debes crear una cita nueva si el cliente vuelve.",
      );
      return;
    }

    const nombreCliente = cita.clientes?.nombre || "este cliente";
    const esCompletada = estadoActual === "completada";

    const mensaje = esCompletada
      ? `¿Seguro que deseas volver la cita de ${nombreCliente} a "programada"?\n\nSi está ligada a un plan, se devolverá 1 sesión al plan. Esto solo cambia la cita a programada; las cuentas por cobrar se tocan únicamente al cancelar.`
      : `¿Seguro que deseas volver la cita de ${nombreCliente} a "programada"?\n\nEsto solo cambia la cita a programada; las cuentas por cobrar se tocan únicamente al cancelar.`;

    if (!window.confirm(mensaje)) return;

    setUpdatingId(cita.id);
    try {
      let auditorId = empleadoActualId || "";
      if (!auditorId) {
        auditorId = await resolveEmpleadoActualId();
        setEmpleadoActualId(auditorId);
      }

      const { error: updateError } = await supabase
        .from("citas")
        .update({
          estado: estadoDestino,
          updated_by: auditorId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", cita.id);

      if (updateError) throw new Error(updateError.message);

      // Si una cita completada consumió sesión de plan, la reversión devuelve 1 sesión.
      // Se hace con el valor actual de la fila cargada para evitar sesiones negativas.
      if (esCompletada && cita.cliente_plan_id) {
        const sesionesUsadasActuales = Number(
          cita.clientes_planes?.sesiones_usadas || 0,
        );
        const sesionesUsadasRevertidas = Math.max(
          sesionesUsadasActuales - 1,
          0,
        );

        const { error: planError } = await supabase
          .from("clientes_planes")
          .update({
            sesiones_usadas: sesionesUsadasRevertidas,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cita.cliente_plan_id);

        if (planError) throw new Error(planError.message);
      }

      await loadAgenda();
    } catch (err: any) {
      console.error(err);
      setActionError(err?.message || "No se pudo volver la cita a programada.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function eliminarCitaCompleta(cita: CitaRow) {
    setActionError("");
    const nombreCliente = cita.clientes?.nombre || "este cliente";
    const fechaCita = formatDateTime(cita.fecha, cita.hora_inicio);

    const ok = window.confirm(
      `⚠️ Vas a eliminar completamente la cita de ${nombreCliente} (${fechaCita}).\n\nLa cita se eliminará desde la RPC segura y se revertirá su impacto financiero: pagos, deudas, abonos, créditos, movimientos y comisiones relacionadas.\n\n¿Seguro que deseas continuar?`,
    );
    if (!ok) return;

    setDeletingId(cita.id);
    try {
      let auditorId = empleadoActualId || "";
      if (!auditorId) {
        auditorId = await resolveEmpleadoActualId();
        setEmpleadoActualId(auditorId);
      }

      const { data, error } = await supabase.rpc("eliminar_cita_segura", {
        p_cita_id: cita.id,
        p_usuario_id: auditorId || null,
        p_revertir_finanzas: true,
        p_motivo: "eliminada_desde_agenda",
      });

      if (error) throw new Error(error.message);

      const resumen = data as {
        pagos_reversados?: number;
        deudas_canceladas?: number;
        comisiones_canceladas?: number;
      } | null;

      setActionError("");
      console.info("Cita eliminada con RPC segura:", resumen);
      await loadAgenda();
    } catch (err: any) {
      console.error(err);
      setActionError(err?.message || "No se pudo eliminar la cita completa.");
    } finally {
      setDeletingId(null);
    }
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(
    () => ({
      total: citas.length,
      programadas: citas.filter((c) => c.estado?.toLowerCase() === "programada")
        .length,
      confirmadas: citas.filter((c) => c.estado?.toLowerCase() === "confirmada")
        .length,
      completadas: citas.filter((c) => c.estado?.toLowerCase() === "completada")
        .length,
      canceladas: citas.filter((c) => c.estado?.toLowerCase() === "cancelada")
        .length,
    }),
    [citas],
  );

  // ─── Filtrado ─────────────────────────────────────────────────────────────

  const citasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return citas.filter((cita) => {
      const tipoCita = getTipoCita(cita).toLowerCase();
      const nombrePlan = (
        cita.clientes_planes?.planes?.nombre || ""
      ).toLowerCase();

      const matchSearch =
        !q ||
        cita.clientes?.nombre?.toLowerCase().includes(q) ||
        cita.clientes?.telefono?.toLowerCase().includes(q) ||
        cita.clientes?.email?.toLowerCase().includes(q) ||
        cita.empleados?.nombre?.toLowerCase().includes(q) ||
        cita.empleados?.rol?.toLowerCase().includes(q) ||
        cita.servicios?.nombre?.toLowerCase().includes(q) ||
        cita.estado?.toLowerCase().includes(q) ||
        cita.notas?.toLowerCase().includes(q) ||
        tipoCita.includes(q) ||
        nombrePlan.includes(q);

      const matchEstado =
        estadoFiltro === "todos" ||
        cita.estado?.toLowerCase() === estadoFiltro.toLowerCase();

      const matchFecha = !fechaFiltro || cita.fecha === fechaFiltro;

      return Boolean(matchSearch && matchEstado && matchFecha);
    });
  }, [citas, search, estadoFiltro, fechaFiltro]);

  // ─── Paginación ───────────────────────────────────────────────────────────

  const totalPaginas = Math.max(
    1,
    Math.ceil(citasFiltradas.length / ITEMS_POR_PAGINA),
  );
  const citasPagina = useMemo(() => {
    const inicio = (pagina - 1) * ITEMS_POR_PAGINA;
    return citasFiltradas.slice(inicio, inicio + ITEMS_POR_PAGINA);
  }, [citasFiltradas, pagina]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-7">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-white/30">
            Operaciones
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Agenda
          </h1>
          <p className="mt-1.5 text-sm text-white/45">
            Gestión de citas, estados, clientes, personal y servicios.
          </p>
        </div>
        <div className="w-full max-w-xs">
          <ActionCard
            title="Nueva cita"
            description="Crear y registrar una nueva cita."
            href="/admin/operaciones/agenda/nueva"
          />
        </div>
      </div>

      {/* ── Errores ── */}
      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3">
          <span className="mt-0.5 text-rose-400">⚠</span>
          <div>
            <p className="text-sm font-medium text-rose-300">Error al cargar</p>
            <p className="mt-0.5 text-xs text-white/45">{error}</p>
          </div>
        </div>
      ) : null}

      {actionError ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-3">
          <span className="mt-0.5 text-amber-400">⚠</span>
          <div>
            <p className="text-sm font-medium text-amber-300">
              Error en acción
            </p>
            <p className="mt-0.5 text-xs text-white/45">{actionError}</p>
          </div>
        </div>
      ) : null}

      {/* ── Tabs de estado (clickeables) ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <EstadoTab
          label="Total citas"
          count={stats.total}
          active={estadoFiltro === "todos"}
          color="text-white"
          onClick={() => setEstadoFiltro("todos")}
        />
        <EstadoTab
          label="Programadas"
          count={stats.programadas}
          active={estadoFiltro === "programada"}
          color="text-sky-400"
          onClick={() => setEstadoFiltro("programada")}
        />
        <EstadoTab
          label="Confirmadas"
          count={stats.confirmadas}
          active={estadoFiltro === "confirmada"}
          color="text-emerald-400"
          onClick={() => setEstadoFiltro("confirmada")}
        />
        <EstadoTab
          label="Completadas"
          count={stats.completadas}
          active={estadoFiltro === "completada"}
          color="text-violet-400"
          onClick={() => setEstadoFiltro("completada")}
        />
        <EstadoTab
          label="Canceladas"
          count={stats.canceladas}
          active={estadoFiltro === "cancelada"}
          color="text-rose-400"
          onClick={() => setEstadoFiltro("cancelada")}
        />
      </div>

      {/* ── Barra de filtros mejorada ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 md:flex-row md:items-end">
        {/* Buscador */}
        <div className="flex-1">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/35">
            Buscar
          </label>
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
              />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cliente, fisioterapeuta, servicio, plan, tipo..."
              className="
                w-full rounded-xl border border-white/10 bg-white/[0.04]
                py-2.5 pl-10 pr-4 text-sm text-white outline-none transition
                placeholder:text-white/25 focus:border-white/20 focus:bg-white/[0.07]
              "
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition hover:text-white/60"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filtro estado adicional */}
        <div className="w-full md:w-48">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/35">
            Estado
          </label>
          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)}
            className="
              w-full rounded-xl border border-white/10 bg-white/[0.04]
              px-3 py-2.5 text-sm text-white outline-none transition
              focus:border-white/20 focus:bg-white/[0.07]
            "
          >
            <option value="todos" className="bg-[#0e101a]">
              Todos los estados
            </option>
            <option value="programada" className="bg-[#0e101a]">
              Programadas
            </option>
            <option value="confirmada" className="bg-[#0e101a]">
              Confirmadas
            </option>
            <option value="completada" className="bg-[#0e101a]">
              Completadas
            </option>
            <option value="cancelada" className="bg-[#0e101a]">
              Canceladas
            </option>
            <option value="reprogramada" className="bg-[#0e101a]">
              Reprogramadas
            </option>
            <option value="no_asistio" className="bg-[#0e101a]">
              No asistió
            </option>
          </select>
        </div>

        {/* Filtro fecha */}
        <div className="w-full md:w-48">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/35">
            Fecha
          </label>
          <div className="relative">
            <input
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
              className="
                w-full rounded-xl border border-white/10 bg-white/[0.04]
                px-3 py-2.5 text-sm text-white outline-none transition
                focus:border-white/20 focus:bg-white/[0.07]
              "
            />
            {fechaFiltro && (
              <button
                type="button"
                onClick={() => setFechaFiltro("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition hover:text-white/60"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
        {/* Encabezado de sección */}
        <div className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.02] px-5 py-3.5">
          <div>
            <span className="text-sm font-semibold text-white">
              Listado de citas
            </span>
            {!loading && (
              <span className="ml-2 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-xs text-white/50">
                {citasFiltradas.length}{" "}
                {citasFiltradas.length === 1 ? "cita" : "citas"}
              </span>
            )}
          </div>
          {totalPaginas > 1 && (
            <span className="text-xs text-white/35">
              Pág. {pagina} de {totalPaginas}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.01] text-left">
                {[
                  "Fecha / Hora",
                  "Cliente",
                  "Fisioterapeuta",
                  "Servicio",
                  "Tipo",
                  "Estado",
                  "Notas",
                  "Acciones",
                ].map((col) => (
                  <th
                    key={col}
                    className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-white/30"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-white/[0.05] text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-white/50" />
                      <span className="text-xs text-white/35">
                        Cargando agenda...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : citasPagina.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center">
                    <p className="text-sm text-white/30">
                      No hay citas que coincidan con los filtros.
                    </p>
                    {(search || estadoFiltro !== "todos" || fechaFiltro) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setEstadoFiltro("todos");
                          setFechaFiltro("");
                        }}
                        className="mt-2 text-xs text-white/40 underline underline-offset-2 transition hover:text-white/60"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                citasPagina.map((cita) => {
                  const duracion = cita.servicios?.duracion_minutos || 0;
                  const estado = (cita.estado || "").toLowerCase();
                  const disabled =
                    updatingId === cita.id || deletingId === cita.id;

                  const puedeConfirmar = [
                    "programada",
                    "reprogramada",
                  ].includes(estado);
                  const puedeCompletar = [
                    "programada",
                    "confirmada",
                    "reprogramada",
                  ].includes(estado);
                  const puedeCancelar = !["cancelada"].includes(estado);
                  const puedeVolverAProgramada = [
                    "confirmada",
                    "completada",
                    "reprogramada",
                    "no_asistio",
                  ].includes(estado);
                  const puedeEditar = !["completada", "cancelada"].includes(
                    estado,
                  );
                  const puedeReprogramar = ![
                    "completada",
                    "cancelada",
                  ].includes(estado);

                  return (
                    <tr
                      key={cita.id}
                      className="group align-top transition-colors duration-100 hover:bg-white/[0.025]"
                    >
                      {/* Fecha */}
                      <td className="px-5 py-4">
                        <div className="font-medium text-white">
                          {formatDateTime(cita.fecha, cita.hora_inicio)}
                        </div>
                        {cita.hora_fin && (
                          <div className="mt-0.5 text-xs text-white/35">
                            hasta {cita.hora_fin.slice(0, 5)}
                          </div>
                        )}
                        {duracion > 0 && (
                          <div className="mt-1 text-[11px] text-white/30">
                            {duracion} min
                          </div>
                        )}
                        <div className="mt-1.5 space-y-0.5">
                          {getAuditLines(cita).map((line, i) => (
                            <div
                              key={i}
                              className="text-[10px] leading-4 text-white/25"
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="px-5 py-4">
                        <div className="font-medium text-white">
                          {cita.clientes?.nombre || "Sin cliente"}
                        </div>
                        <div className="mt-0.5 text-xs text-white/40">
                          {cita.clientes?.telefono ||
                            cita.clientes?.email ||
                            "Sin contacto"}
                        </div>
                      </td>

                      {/* Fisio */}
                      <td className="px-5 py-4">
                        <div className="font-medium text-white">
                          {cita.empleados?.nombre || "Sin asignar"}
                        </div>
                        <div className="mt-0.5 text-xs text-white/40">
                          {["terapeuta", "fisioterapeuta"].includes(
                            cita.empleados?.rol || "",
                          )
                            ? "Fisioterapeuta"
                            : cita.empleados?.rol || "Sin rol"}
                        </div>
                      </td>

                      {/* Servicio */}
                      <td className="px-5 py-4">
                        <div className="font-medium text-white">
                          {cita.servicios?.nombre || "Sin servicio"}
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${tipoCitaBadge(cita)}`}
                        >
                          {getTipoCita(cita)}
                        </span>
                        {cita.cliente_plan_id && (
                          <div className="mt-1.5 text-[11px] text-white/40">
                            <div className="truncate max-w-[130px]">
                              {cita.clientes_planes?.planes?.nombre || "Plan"}
                            </div>
                            <div>
                              {getPlanDisponible(cita)}/
                              {Number(
                                cita.clientes_planes?.sesiones_totales || 0,
                              )}{" "}
                              disponibles
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${estadoBadge(cita.estado)}`}
                        >
                          {cita.estado}
                        </span>
                      </td>

                      {/* Notas */}
                      <td className="px-5 py-4">
                        <p className="max-w-[160px] text-xs leading-relaxed text-white/55">
                          {cita.notas?.trim() || (
                            <span className="text-white/25">Sin notas</span>
                          )}
                        </p>
                      </td>

                      {/* Acciones */}
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <Link
                            href={`/admin/operaciones/agenda/${cita.id}`}
                            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/70 transition hover:bg-white/[0.07]"
                          >
                            Ver
                          </Link>

                          <Link
                            href={`/admin/operaciones/agenda/${cita.id}/editar`}
                            className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${
                              puedeEditar
                                ? "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]"
                                : "pointer-events-none cursor-not-allowed border-white/[0.05] bg-transparent text-white/20"
                            }`}
                          >
                            Editar
                          </Link>

                          <Link
                            href={`/admin/operaciones/agenda/${cita.id}/reprogramar`}
                            className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${
                              puedeReprogramar
                                ? "border-amber-400/20 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
                                : "pointer-events-none cursor-not-allowed border-white/[0.05] bg-transparent text-white/20"
                            }`}
                          >
                            Reprogramar
                          </Link>

                          <ActionButton
                            tone="confirm"
                            disabled={!puedeConfirmar || disabled}
                            onClick={() => cambiarEstado(cita, "confirmada")}
                          >
                            {disabled && updatingId === cita.id
                              ? "..."
                              : "Confirmar"}
                          </ActionButton>

                          <ActionButton
                            tone="complete"
                            disabled={!puedeCompletar || disabled}
                            onClick={() => cambiarEstado(cita, "completada")}
                          >
                            {disabled && updatingId === cita.id
                              ? "..."
                              : "Completar"}
                          </ActionButton>

                          <ActionButton
                            tone="cancel"
                            disabled={!puedeCancelar || disabled}
                            onClick={() => cambiarEstado(cita, "cancelada")}
                          >
                            {disabled && updatingId === cita.id
                              ? "..."
                              : "Cancelar"}
                          </ActionButton>

                          <ActionButton
                            tone="restore"
                            disabled={!puedeVolverAProgramada || disabled}
                            onClick={() => volverAProgramada(cita)}
                          >
                            {disabled && updatingId === cita.id
                              ? "..."
                              : "A programada"}
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Paginación ── */}
        {!loading && totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-white/[0.06] bg-white/[0.01] px-5 py-3.5">
            <span className="text-xs text-white/35">
              Mostrando {(pagina - 1) * ITEMS_POR_PAGINA + 1}–
              {Math.min(pagina * ITEMS_POR_PAGINA, citasFiltradas.length)} de{" "}
              {citasFiltradas.length}
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={pagina === 1}
                onClick={() => setPagina((p) => p - 1)}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-30"
              >
                ← Anterior
              </button>

              {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 1,
                )
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (
                    idx > 0 &&
                    typeof arr[idx - 1] === "number" &&
                    (p as number) - (arr[idx - 1] as number) > 1
                  ) {
                    acc.push("...");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === "..." ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1.5 text-xs text-white/25"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPagina(p as number)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        pagina === p
                          ? "border-white/20 bg-white/[0.1] text-white"
                          : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.07]"
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}

              <button
                type="button"
                disabled={pagina === totalPaginas}
                onClick={() => setPagina((p) => p + 1)}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
