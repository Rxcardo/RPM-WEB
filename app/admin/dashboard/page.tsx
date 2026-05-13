"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Cliente = {
  id: string;
  estado?: string | null;
  created_at?: string | null;
};
type CitaRaw = {
  id: string;
  fecha?: string | null;
  estado?: string | null;
  [key: string]: any;
};
type Pago = {
  id: string;
  fecha?: string | null;
  monto?: number | null;
  monto_equivalente_usd?: number | null;
  estado?: string | null;
};
type PagoDetalle = {
  id: string;
  fecha?: string | null;
  concepto?: string | null;
  monto?: number | null;
  monto_equivalente_usd?: number | null;
  moneda_pago?: string | null;
  estado?: string | null;
  cliente_nombre?: string | null;
  metodo_nombre?: string | null;
};
type Empleado = {
  id: string;
  nombre?: string | null;
  estado?: string | null;
  rol?: string | null;
};
type PlanCliente = {
  id: string;
  cliente_id?: string | null;
  plan_id?: string | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  estado?: string | null;
  sesiones_totales?: number | null;
  sesiones_usadas?: number | null;
  clientes?:
    | {
        nombre?: string | null;
        telefono?: string | null;
        email?: string | null;
      }
    | {
        nombre?: string | null;
        telefono?: string | null;
        email?: string | null;
      }[]
    | null;
  planes?: { nombre?: string | null } | { nombre?: string | null }[] | null;
};
type EstadoCuentaCliente = {
  cliente_id: string;
  total_pendiente_usd?: number | null;
  credito_disponible_usd?: number | null;
  saldo_pendiente_neto_usd?: number | null;
  saldo_favor_neto_usd?: number | null;
};
type CuentaPorCobrar = {
  id: string;
  cliente_id: string | null;
  cliente_nombre?: string | null;
  concepto?: string | null;
  saldo_usd?: number | null;
  estado?: string | null;
  fecha_venta?: string | null;
  created_at?: string | null;
  notas?: string | null;
};
type EntrenamientoPlanRow = {
  id: string;
  cliente_plan_id: string | null;
  cliente_id: string | null;
  empleado_id: string | null;
  recurso_id: string | null;
  fecha: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  estado: string | null;
  asistencia_estado: string | null;
  aviso_previo: boolean | null;
  consume_sesion: boolean | null;
  reprogramable: boolean | null;
  motivo_asistencia: string | null;
  fecha_asistencia: string | null;
  reprogramado_de_entrenamiento_id: string | null;
  marcado_por?: string | null;
  actualizado_por?: { id: string; nombre: string | null } | null;
  clientes?: { nombre: string } | { nombre: string }[] | null;
  empleados?:
    | { nombre: string; rol?: string | null }
    | { nombre: string; rol?: string | null }[]
    | null;
  clientes_planes?:
    | {
        id: string;
        fecha_fin?: string | null;
        estado?: string | null;
        planes?:
          | { nombre?: string | null }
          | { nombre?: string | null }[]
          | null;
      }
    | {
        id: string;
        fecha_fin?: string | null;
        estado?: string | null;
        planes?:
          | { nombre?: string | null }
          | { nombre?: string | null }[]
          | null;
      }[]
    | null;
};
type EmpleadoAsistenciaRow = {
  id: string;
  empleado_id: string;
  fecha: string;
  estado: "asistio" | "no_asistio" | "permiso" | "reposo" | "vacaciones";
  observaciones: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  empleados?:
    | { nombre: string; rol?: string | null }
    | { nombre: string; rol?: string | null }[]
    | null;
  actualizado_por?:
    | { id: string; nombre: string | null }
    | { id: string; nombre: string | null }[]
    | null;
};
type AlertType = "error" | "success" | "warning" | "info";
type ReprogramacionDraft = {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  motivo: string;
};
type AlertaSistema = {
  id: string;
  tipo: "sesiones" | "personal";
  mensaje: string;
  sub: string;
};
type SolicitudComunicacion = {
  id: string;
  conversacion_id?: string | null;
  cita_id?: string | null;
  cliente_id?: string | null;
  fisio_id?: string | null;
  tipo?: string | null;
  estado?: string | null;
  titulo?: string | null;
  descripcion?: string | null;
  created_at?: string | null;
  clientes?: { nombre?: string | null; telefono?: string | null } | { nombre?: string | null; telefono?: string | null }[] | null;
  fisios?: { nombre?: string | null; rol?: string | null } | { nombre?: string | null; rol?: string | null }[] | null;
};
type ConversacionComunicacion = {
  id: string;
  tipo?: string | null;
  titulo?: string | null;
  cliente_id?: string | null;
  fisio_id?: string | null;
  recepcionista_id?: string | null;
  ultimo_mensaje?: string | null;
  ultima_actividad_at?: string | null;
  clientes?: { nombre?: string | null; telefono?: string | null } | { nombre?: string | null; telefono?: string | null }[] | null;
  fisios?: { nombre?: string | null; rol?: string | null } | { nombre?: string | null; rol?: string | null }[] | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function sameMonth(dateStr: string | null | undefined, today: Date) {
  if (!dateStr) return false;
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  return String(dateStr).slice(0, 7) === currentMonthKey;
}

function sameDay(dateStr: string | null | undefined, todayStr: string) {
  if (!dateStr) return false;
  return dateStr === todayStr;
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es-ES");
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string | null | undefined) {
  if (!timeStr) return "—";
  return String(timeStr).slice(0, 5);
}

function normalizeSearch(value: string | null | undefined) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesSearch(
  query: string,
  values: Array<string | number | null | undefined>,
) {
  const q = normalizeSearch(query);
  if (!q) return true;
  return values.some((value) =>
    normalizeSearch(String(value ?? "")).includes(q),
  );
}

function getCitaCliente(cita: CitaRaw) {
  const cliente = firstOrNull(cita.clientes || cita.cliente || null);
  return cliente?.nombre || cita.cliente_nombre || "Cliente";
}

function getCitaEmpleado(cita: CitaRaw) {
  const empleado = firstOrNull(
    cita.empleados || cita.terapeuta || cita.personal || null,
  );
  return empleado?.nombre || cita.empleado_nombre || "Personal";
}

function getCitaServicio(cita: CitaRaw) {
  const servicio = firstOrNull(cita.servicios || cita.servicio || null);
  return servicio?.nombre || cita.servicio_nombre || "Servicio";
}

function getCitaHoraInicio(cita: CitaRaw) {
  return cita.hora_inicio || cita.hora || cita.inicio || null;
}
function getCitaHoraFin(cita: CitaRaw) {
  return cita.hora_fin || cita.fin || null;
}

function citaEstadoLabel(estado: string | null | undefined) {
  switch ((estado || "").toLowerCase()) {
    case "programada":
      return "Programada";
    case "confirmada":
      return "Confirmada";
    case "completada":
      return "Completada";
    case "cancelada":
      return "Cancelada";
    case "reprogramada":
      return "Reprogramada";
    default:
      return estado || "Sin estado";
  }
}

function asistenciaLabel(estado: string | null | undefined) {
  switch ((estado || "").toLowerCase()) {
    case "pendiente":
      return "Pendiente";
    case "asistio":
      return "Asistió";
    case "no_asistio_aviso":
      return "Avisó";
    case "no_asistio_sin_aviso":
      return "Sin aviso";
    case "reprogramado":
      return "Reprog.";
    default:
      return estado || "—";
  }
}

function asistenciaPersonalLabel(estado: string | null | undefined) {
  switch ((estado || "").toLowerCase()) {
    case "asistio":
      return "Asistió";
    case "no_asistio":
      return "No asistió";
    case "permiso":
      return "Permiso";
    case "reposo":
      return "Reposo";
    case "vacaciones":
      return "Vacaciones";
    default:
      return "Sin marcar";
  }
}

function roleLabel(rol: string | null | undefined) {
  const r = (rol || "").toLowerCase().trim();
  if (!r) return "Sin rol";
  if (r === "terapeuta" || r === "fisioterapeuta") return "Fisioterapeuta";
  if (r === "entrenador") return "Entrenador";
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function truncateText(value: string | null | undefined, max = 90) {
  const text = (value || "").trim();
  if (!text) return "Sin concepto";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

function onlyHour(value: string | null | undefined) {
  return (value || "").slice(0, 5);
}

function normalizeTimeForDb(value: string) {
  const clean = (value || "").trim();
  if (!clean) return null;
  return clean.length === 5 ? `${clean}:00` : clean;
}

function dateTimeMs(fecha: string, hora: string) {
  return new Date(`${fecha}T${hora || "00:00"}`).getTime();
}

function getDurationMinutes(
  inicio: string | null | undefined,
  fin: string | null | undefined,
) {
  const hi = onlyHour(inicio);
  const hf = onlyHour(fin);
  if (!hi || !hf) return 60;
  const diff = dateTimeMs("2000-01-01", hf) - dateTimeMs("2000-01-01", hi);
  const minutes = Math.round(diff / 60000);
  return minutes > 0 ? minutes : 60;
}

function addMinutesToHour(hour: string, minutes: number) {
  const base = new Date(`2000-01-01T${hour || "00:00"}`);
  base.setMinutes(base.getMinutes() + minutes);
  return `${String(base.getHours()).padStart(2, "0")}:${String(base.getMinutes()).padStart(2, "0")}`;
}

function isPlanOperativoFromRow(row: EntrenamientoPlanRow, hoy: string) {
  const cp = firstOrNull(row.clientes_planes);
  if (!cp) return false;
  const estadoPlan = (cp.estado || "").toLowerCase();
  if (estadoPlan !== "activo") return false;
  if (cp.fecha_fin && cp.fecha_fin < hoy) return false;
  return true;
}

function canReagendarSesion(row: EntrenamientoPlanRow) {
  const asistenciaActual = (row.asistencia_estado || "pendiente").toLowerCase();
  return (
    (asistenciaActual === "pendiente" ||
      (asistenciaActual === "no_asistio_aviso" &&
        row.reprogramable === true)) &&
    (row.estado || "").toLowerCase() !== "completado"
  );
}

function getBloqueKey(row: EntrenamientoPlanRow) {
  return `${onlyHour(row.hora_inicio) || "—"}-${onlyHour(row.hora_fin) || "—"}`;
}

function getBloqueLabel(row: EntrenamientoPlanRow) {
  return `${formatTime(row.hora_inicio)} – ${formatTime(row.hora_fin)}`;
}

// ─── Dot colours ──────────────────────────────────────────────────────────────

function asistenciaPlanDot(estado: string | null | undefined) {
  switch ((estado || "").toLowerCase()) {
    case "asistio":
      return "bg-emerald-400";
    case "no_asistio_aviso":
      return "bg-amber-400";
    case "no_asistio_sin_aviso":
      return "bg-rose-400";
    case "reprogramado":
      return "bg-violet-400";
    default:
      return "bg-white/20";
  }
}

function asistenciaPersonalDot(estado: string | null | undefined) {
  switch ((estado || "").toLowerCase()) {
    case "asistio":
      return "bg-emerald-400";
    case "no_asistio":
      return "bg-rose-400";
    case "permiso":
      return "bg-amber-400";
    case "reposo":
      return "bg-fuchsia-400";
    case "vacaciones":
      return "bg-sky-400";
    default:
      return "bg-white/15";
  }
}

function citaDot(estado: string | null | undefined) {
  switch ((estado || "").toLowerCase()) {
    case "completada":
      return "bg-emerald-400";
    case "confirmada":
      return "bg-sky-400";
    case "programada":
      return "bg-amber-400";
    case "cancelada":
      return "bg-rose-400";
    case "reprogramada":
      return "bg-violet-400";
    default:
      return "bg-white/20";
  }
}

function solicitudComunicacionLabel(tipo: string | null | undefined) {
  switch ((tipo || "").toLowerCase()) {
    case "solicitar_cita":
      return "Solicitud de cita";
    case "reagendar_cita":
      return "Reagendar cita";
    case "cancelar_cita":
      return "Cancelar cita";
    case "cambio_horario":
      return "Cambio de horario";
    case "cambio_fisio":
      return "Cambio de fisio";
    case "aviso_no_asistencia_cliente":
      return "Aviso no asistencia";
    case "ausencia_fisio":
      return "Ausencia fisio";
    case "bloqueo_horario":
      return "Bloqueo horario";
    case "consulta_pago":
      return "Consulta pago";
    case "consulta_clinica":
      return "Consulta clínica";
    default:
      return tipo || "Solicitud";
  }
}

function solicitudEstadoColor(estado: string | null | undefined) {
  switch ((estado || "").toLowerCase()) {
    case "pendiente":
      return "amber";
    case "en_revision":
      return "sky";
    case "aprobada":
    case "resuelta":
      return "emerald";
    case "rechazada":
    case "cancelada":
      return "rose";
    default:
      return "white";
  }
}

function conversacionComunicacionLabel(tipo: string | null | undefined) {
  switch ((tipo || "").toLowerCase()) {
    case "cliente_recepcion":
      return "Cliente ↔ Recepción";
    case "cliente_fisio":
      return "Cliente ↔ Fisio";
    case "fisio_recepcion":
      return "Fisio ↔ Recepción";
    default:
      return tipo || "Comunicación";
  }
}

function comunicacionDateValue(value: string | null | undefined) {
  if (!value) return 0;
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : 0;
}

function comunicacionGroupKey(c: ConversacionComunicacion) {
  const tipo = (c.tipo || "").toLowerCase();

  if (tipo === "cliente_recepcion") {
    return `cliente_recepcion:${c.cliente_id || "none"}`;
  }

  if (tipo === "cliente_fisio") {
    return `cliente_fisio:${c.cliente_id || "none"}:${c.fisio_id || "none"}`;
  }

  if (tipo === "fisio_recepcion") {
    return `fisio_recepcion:${c.fisio_id || "none"}:${c.recepcionista_id || "none"}`;
  }

  return `${tipo || "conversacion"}:${c.id}`;
}

function pickBetterConversacionComunicacion(
  a: ConversacionComunicacion,
  b: ConversacionComunicacion,
) {
  const aHasMessage = Boolean((a.ultimo_mensaje || "").trim());
  const bHasMessage = Boolean((b.ultimo_mensaje || "").trim());

  if (aHasMessage !== bHasMessage) return aHasMessage ? a : b;

  const aTime = comunicacionDateValue(a.ultima_actividad_at);
  const bTime = comunicacionDateValue(b.ultima_actividad_at);

  if (aTime !== bTime) return aTime > bTime ? a : b;

  return a;
}

function dedupeConversacionesComunicacion(rows: ConversacionComunicacion[]) {
  const map = new Map<string, ConversacionComunicacion>();

  rows.forEach((row) => {
    const key = comunicacionGroupKey(row);
    const existing = map.get(key);
    map.set(key, existing ? pickBetterConversacionComunicacion(existing, row) : row);
  });

  return Array.from(map.values()).sort(
    (a, b) =>
      comunicacionDateValue(b.ultima_actividad_at) -
      comunicacionDateValue(a.ultima_actividad_at),
  );
}


// ─── Sub-components ───────────────────────────────────────────────────────────

function PillBadge({
  children,
  color = "white",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  const map: Record<string, string> = {
    white: "border-white/10 bg-white/[0.06] text-white/60",
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    rose: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    violet: "border-violet-400/20 bg-violet-400/10 text-violet-300",
    sky: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tabular-nums ${map[color] ?? map.white}`}
    >
      {children}
    </span>
  );
}

function GhostBtn({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/65 transition hover:bg-white/[0.07] hover:text-white/90 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-white/30">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="h-px w-full bg-white/[0.06]" />;
}

function SlidePanel({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed right-0 top-0 z-40 h-full w-full max-w-sm overflow-y-auto bg-[#0d0d12] shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ borderLeft: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0d0d12] px-5 py-4">
          <p className="text-sm font-semibold text-white">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/[0.06] hover:text-white/80"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </>
  );
}

function MetricTile({
  label,
  value,
  sub,
  accent,
  onClick,
  active,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`group flex flex-col gap-1.5 rounded-2xl border p-4 text-left transition-all duration-200 ${
        active
          ? "border-white/15 bg-white/[0.06]"
          : "border-white/[0.06] bg-white/[0.025] hover:border-white/10 hover:bg-white/[0.04]"
      } ${onClick ? "cursor-pointer" : ""}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/35">
        {label}
      </p>
      <p
        className={`text-2xl font-bold tabular-nums tracking-tight ${accent ?? "text-white"}`}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-white/40">{sub}</p>}
    </Wrapper>
  );
}

function RowItem({
  left,
  right,
  dot,
  onClick,
  muted,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  dot?: string;
  onClick?: () => void;
  muted?: boolean;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      {...(onClick ? { type: "button" as const, onClick } : {})}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${onClick ? "hover:bg-white/[0.04]" : ""} ${muted ? "opacity-50" : ""}`}
    >
      {dot !== undefined && (
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      )}
      <div className="min-w-0 flex-1">{left}</div>
      {right && <div className="shrink-0">{right}</div>}
    </Wrapper>
  );
}

// ─── Alerta Sistema Component ─────────────────────────────────────────────────

function AlertaSistemaCard({
  alerta,
  onDescartar,
}: {
  alerta: AlertaSistema;
  onDescartar: (id: string) => void;
}) {
  const esSesiones = alerta.tipo === "sesiones";
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 transition-all ${
        esSesiones
          ? "border-amber-400/25 bg-amber-400/[0.07]"
          : "border-fuchsia-400/25 bg-fuchsia-400/[0.07]"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-base leading-none">
          {esSesiones ? "⚠️" : "👥"}
        </span>
        <div>
          <p
            className={`text-sm font-semibold ${esSesiones ? "text-amber-300" : "text-fuchsia-300"}`}
          >
            {alerta.mensaje}
          </p>
          <p className="mt-0.5 text-[11px] text-white/40">{alerta.sub}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDescartar(alerta.id)}
        className="shrink-0 rounded-lg p-1 text-white/30 transition hover:bg-white/[0.06] hover:text-white/70"
        aria-label="Descartar alerta"
      >
        ✕
      </button>
    </div>
  );
}

const PAGE_SIZE = 8;
const BLOQUES_PAGE_SIZE = 15;

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [alert, setAlert] = useState<{
    type: AlertType;
    title: string;
    message: string;
  } | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [citas, setCitas] = useState<CitaRaw[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [clientesPlanes, setClientesPlanes] = useState<PlanCliente[]>([]);
  const [entrenamientosPlan, setEntrenamientosPlan] = useState<
    EntrenamientoPlanRow[]
  >([]);
  const [empleadosAsistencia, setEmpleadosAsistencia] = useState<
    EmpleadoAsistenciaRow[]
  >([]);
  const [estadosCuentaClientes, setEstadosCuentaClientes] = useState<
    EstadoCuentaCliente[]
  >([]);
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState<CuentaPorCobrar[]>(
    [],
  );
  const [solicitudesComunicacion, setSolicitudesComunicacion] = useState<
    SolicitudComunicacion[]
  >([]);
  const [conversacionesComunicacion, setConversacionesComunicacion] = useState<
    ConversacionComunicacion[]
  >([]);
  const [comunicacionFilter, setComunicacionFilter] = useState("pendiente");
  const [empleadoActualId, setEmpleadoActualId] = useState<string>("");

  // Alertas sistema descartadas
  const [alertasSistemaDescartadas, setAlertasSistemaDescartadas] = useState<
    Set<string>
  >(new Set());

  // Panels
  const [panelOpen, setPanelOpen] = useState<
    | "citas"
    | "sesiones"
    | "personal"
    | "planes"
    | "saldos"
    | "ingresos"
    | "comunicacion"
    | null
  >(null);

  // Filters & pages
  const [asistenciaFilterFecha, setAsistenciaFilterFecha] = useState(
    getDateKey(new Date()),
  );
  const [filtroCitasHoy, setFiltroCitasHoy] = useState("");
  const [filtroSesionesPlan, setFiltroSesionesPlan] = useState("");
  const [vistaSesionesPlan, setVistaSesionesPlan] = useState<"bloques" | "lista">("bloques");
  const [filtroAsistenciaPersonal, setFiltroAsistenciaPersonal] = useState("");
  const [filtroPlanActivo, setFiltroPlanActivo] = useState("");

  const [savingCitaId, setSavingCitaId] = useState<string | null>(null);
  const [savingAsistenciaId, setSavingAsistenciaId] = useState<string | null>(
    null,
  );
  const [savingEmpleadoAsistenciaId, setSavingEmpleadoAsistenciaId] = useState<
    string | null
  >(null);
  const [openSesionPlanId, setOpenSesionPlanId] = useState<string | null>(null);
  const [openEmpleadoAsistenciaId, setOpenEmpleadoAsistenciaId] = useState<
    string | null
  >(null);
  const [reprogramandoId, setReprogramandoId] = useState<string | null>(null);
  const [reprogramacionDrafts, setReprogramacionDrafts] = useState<
    Record<string, ReprogramacionDraft>
  >({});
  const [bloqueSesionSeleccionado, setBloqueSesionSeleccionado] = useState<
    string | null
  >(null);
  const [bloquesSesionesPage, setBloquesSesionesPage] = useState(1);
  const [sesionReagendar, setSesionReagendar] =
    useState<EntrenamientoPlanRow | null>(null);
  const [reagendarForm, setReagendarForm] = useState<ReprogramacionDraft>({
    fecha: "",
    hora_inicio: "",
    hora_fin: "",
    motivo: "",
  });
  const [guardandoReagenda, setGuardandoReagenda] = useState(false);
  const [errorReagenda, setErrorReagenda] = useState("");

  const [citasHoyPage, setCitasHoyPage] = useState(1);
  const [sesionesPlanPage, setSesionesPlanPage] = useState(1);
  const [empleadosAsistenciaPage, setEmpleadosAsistenciaPage] = useState(1);
  const [planesPage, setPlanesPage] = useState(1);

  const [pagosDetalle, setPagosDetalle] = useState<PagoDetalle[]>([]);
  const [loadingPagosDetalle, setLoadingPagosDetalle] = useState(false);
  const [ingresosRangoDesde, setIngresosRangoDesde] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [ingresosRangoHasta, setIngresosRangoHasta] = useState(
    getDateKey(new Date()),
  );

  useEffect(() => {
    void loadDashboard();
    void loadEmpleadoActual();
  }, []);

  function showAlert(type: AlertType, title: string, message: string) {
    setAlert({ type, title, message });
    setTimeout(() => setAlert(null), 4000);
  }

  async function resolveEmpleadoActualId(): Promise<string> {
    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError) return "";
      const authUserId = authData.user?.id;
      if (!authUserId) return "";
      const { data: emp1 } = await supabase
        .from("empleados")
        .select("id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();
      if (emp1?.id) return String(emp1.id);
      const { data: emp2 } = await supabase
        .from("empleados")
        .select("id")
        .eq("id", authUserId)
        .maybeSingle();
      return emp2?.id ? String(emp2.id) : "";
    } catch {
      return "";
    }
  }

  async function loadEmpleadoActual() {
    setEmpleadoActualId(await resolveEmpleadoActualId());
  }

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const now = new Date();
      const mesDesde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const mesHasta = getDateKey(now);

      const [
        clientesRes,
        citasRes,
        pagosRes,
        empleadosRes,
        clientesPlanesRes,
        entrenamientosPlanRes,
        empleadosAsistenciaRes,
        estadosCuentaRes,
        cuentasPorCobrarRes,
        solicitudesComunicacionRes,
        conversacionesComunicacionRes,
      ] = await Promise.all([
        supabase.from("clientes").select("id, estado, created_at"),
        supabase
          .from("citas")
          .select(
            `*, clientes:cliente_id(nombre,telefono,email), empleados:terapeuta_id(nombre,rol), servicios:servicio_id(nombre)`,
          ),
        supabase
          .from("pagos")
          .select("id,fecha,monto,monto_equivalente_usd,estado")
          .eq("estado", "pagado")
          .gte("fecha", mesDesde)
          .lte("fecha", mesHasta)
          .order("fecha", { ascending: false }),
        supabase.from("empleados").select("id,nombre,estado,rol"),
        supabase
          .from("clientes_planes")
          .select(
            `id,cliente_id,plan_id,fecha_inicio,fecha_fin,estado,sesiones_totales,sesiones_usadas,clientes:cliente_id(nombre,telefono,email),planes:plan_id(nombre)`,
          ),
        supabase
          .from("entrenamientos")
          .select(
            `id,cliente_plan_id,cliente_id,empleado_id,recurso_id,fecha,hora_inicio,hora_fin,estado,asistencia_estado,aviso_previo,consume_sesion,reprogramable,motivo_asistencia,fecha_asistencia,reprogramado_de_entrenamiento_id,marcado_por,actualizado_por:marcado_por(id,nombre),clientes:cliente_id(nombre),empleados:empleado_id(nombre,rol),clientes_planes:cliente_plan_id(id,fecha_fin,estado,planes:plan_id(nombre))`,
          )
          .not("cliente_plan_id", "is", null)
          .neq("estado", "cancelado")
          .order("fecha", { ascending: true })
          .order("hora_inicio", { ascending: true }),
        supabase
          .from("empleados_asistencia")
          .select(
            `id,empleado_id,fecha,estado,observaciones,created_at,updated_at,created_by,updated_by,empleados:empleado_id(nombre,rol),actualizado_por:updated_by(id,nombre)`,
          )
          .order("fecha", { ascending: false }),
        supabase
          .from("v_clientes_estado_cuenta")
          .select(
            `cliente_id,total_pendiente_usd,credito_disponible_usd,saldo_pendiente_neto_usd,saldo_favor_neto_usd`,
          ),
        supabase
          .from("cuentas_por_cobrar")
          .select(
            `id,cliente_id,cliente_nombre,concepto,saldo_usd,estado,fecha_venta,created_at,notas`,
          )
          .gt("saldo_usd", 0)
          .neq("estado", "pagado")
          .order("created_at", { ascending: false }),
        supabase
          .from("solicitudes_comunicacion")
          .select(`*, clientes:cliente_id(nombre,telefono), fisios:fisio_id(nombre,rol)`)
          .order("created_at", { ascending: false })
          .limit(60),
        supabase
          .from("conversaciones")
          .select(`*, clientes:cliente_id(nombre,telefono), fisios:fisio_id(nombre,rol)`)
          .order("ultima_actividad_at", { ascending: false })
          .limit(40),
      ]);

      if (clientesRes.error) throw clientesRes.error;
      if (citasRes.error) throw citasRes.error;
      if (pagosRes.error) throw pagosRes.error;
      if (empleadosRes.error) throw empleadosRes.error;
      if (clientesPlanesRes.error) throw clientesPlanesRes.error;
      if (entrenamientosPlanRes.error) throw entrenamientosPlanRes.error;
      if (empleadosAsistenciaRes.error) throw empleadosAsistenciaRes.error;
      if (estadosCuentaRes.error) throw estadosCuentaRes.error;
      if (cuentasPorCobrarRes.error) throw cuentasPorCobrarRes.error;
      if (solicitudesComunicacionRes.error) throw solicitudesComunicacionRes.error;
      if (conversacionesComunicacionRes.error) throw conversacionesComunicacionRes.error;

      setClientes((clientesRes.data || []) as Cliente[]);
      setCitas((citasRes.data || []) as CitaRaw[]);
      setPagos((pagosRes.data || []) as Pago[]);
      setEmpleados((empleadosRes.data || []) as Empleado[]);
      setClientesPlanes((clientesPlanesRes.data || []) as PlanCliente[]);
      setEntrenamientosPlan(
        (entrenamientosPlanRes.data || []) as unknown as EntrenamientoPlanRow[],
      );
      setEmpleadosAsistencia(
        (empleadosAsistenciaRes.data ||
          []) as unknown as EmpleadoAsistenciaRow[],
      );
      setEstadosCuentaClientes(
        (estadosCuentaRes.data || []) as EstadoCuentaCliente[],
      );
      setCuentasPorCobrar(
        (cuentasPorCobrarRes.data || []) as CuentaPorCobrar[],
      );
      setSolicitudesComunicacion(
        (solicitudesComunicacionRes.data || []) as unknown as SolicitudComunicacion[],
      );
      setConversacionesComunicacion(
        dedupeConversacionesComunicacion(
          (conversacionesComunicacionRes.data || []) as unknown as ConversacionComunicacion[],
        ),
      );
    } catch (err: any) {
      setError(err?.message || "No se pudo cargar el dashboard.");
    } finally {
      setLoading(false);
    }
  }

  const today = useMemo(() => new Date(), []);
  const hoy = useMemo(() => getDateKey(today), [today]);

  const stats = useMemo(() => {
    const clientesActivos = clientes.filter(
      (c) => c.estado?.toLowerCase() === "activo",
    ).length;
    const clientesNuevosMes = clientes.filter((c) =>
      sameMonth(c.created_at, today),
    ).length;
    const citasHoy = citas.filter((c) => sameDay(c.fecha, hoy)).length;
    const programadasHoy = citas.filter(
      (c) => sameDay(c.fecha, hoy) && c.estado?.toLowerCase() === "programada",
    ).length;
    const completadasMes = citas.filter(
      (c) =>
        sameMonth(c.fecha, today) && c.estado?.toLowerCase() === "completada",
    ).length;
    const ingresosMes = pagos
      .filter(
        (p) =>
          p.estado?.toLowerCase() === "pagado" && sameMonth(p.fecha, today),
      )
      .reduce(
        (acc, p) => acc + Number(p.monto_equivalente_usd || p.monto || 0),
        0,
      );
    const pagosHoy = pagos
      .filter(
        (p) => p.estado?.toLowerCase() === "pagado" && sameDay(p.fecha, hoy),
      )
      .reduce(
        (acc, p) => acc + Number(p.monto_equivalente_usd || p.monto || 0),
        0,
      );
    const personalActivo = empleados.filter(
      (e) => e.estado?.toLowerCase() === "activo",
    ).length;
    const planesActivos = clientesPlanes.filter(
      (cp) => cp.estado?.toLowerCase() === "activo",
    ).length;
    const totalSesionesDisponibles = clientesPlanes
      .filter((cp) => cp.estado?.toLowerCase() === "activo")
      .reduce(
        (acc, cp) =>
          acc +
          (Number(cp.sesiones_totales || 0) - Number(cp.sesiones_usadas || 0)),
        0,
      );
    const sesionesPlanPendientes = entrenamientosPlan.filter((e) => {
      if (e.fecha !== asistenciaFilterFecha) return false;
      if ((e.estado || "").toLowerCase() === "cancelado") return false;
      const cp = firstOrNull(e.clientes_planes);
      if (!cp || (cp.estado || "").toLowerCase() === "cancelado") return false;
      return (e.asistencia_estado || "pendiente") === "pendiente";
    }).length;
    const clientesDeudores = Array.from(
      new Set(
        cuentasPorCobrar
          .filter((c) => Number(c.saldo_usd || 0) > 0.009)
          .map((c) => c.cliente_id),
      ),
    ).length;
    const solicitudesPendientes = solicitudesComunicacion.filter(
      (s) => (s.estado || "").toLowerCase() === "pendiente",
    ).length;
    const solicitudesRevision = solicitudesComunicacion.filter(
      (s) => (s.estado || "").toLowerCase() === "en_revision",
    ).length;

    return {
      clientesActivos,
      clientesNuevosMes,
      citasHoy,
      programadasHoy,
      completadasMes,
      ingresosMes,
      pagosHoy,
      personalActivo,
      planesActivos,
      totalSesionesDisponibles,
      sesionesPlanPendientes,
      clientesDeudores,
      solicitudesPendientes,
      solicitudesRevision,
    };
  }, [
    clientes,
    citas,
    pagos,
    empleados,
    clientesPlanes,
    entrenamientosPlan,
    cuentasPorCobrar,
    solicitudesComunicacion,
    today,
    hoy,
    asistenciaFilterFecha,
  ]);

  // ─── Alertas del sistema ───────────────────────────────────────────────────

  const alertasSistema = useMemo((): AlertaSistema[] => {
    const alertas: AlertaSistema[] = [];

    // ── Sesiones de plan: menos del 50% en "asistio" ──
    const sesionesDelDia = entrenamientosPlan.filter((row) => {
      if (row.fecha !== asistenciaFilterFecha) return false;
      if ((row.estado || "").toLowerCase() === "cancelado") return false;
      const cp = firstOrNull(row.clientes_planes);
      if (!cp || (cp.estado || "").toLowerCase() === "cancelado") return false;
      return true;
    });

    if (sesionesDelDia.length > 0) {
      const asistidas = sesionesDelDia.filter(
        (r) => (r.asistencia_estado || "").toLowerCase() === "asistio",
      ).length;
      const pct = asistidas / sesionesDelDia.length;
      if (pct < 0.5) {
        alertas.push({
          id: `sesiones-${asistenciaFilterFecha}`,
          tipo: "sesiones",
          mensaje: `Solo ${asistidas} de ${sesionesDelDia.length} sesiones tienen asistencia confirmada`,
          sub: `Menos del 50% marcado como "Asistió" — ${formatDate(asistenciaFilterFecha)}`,
        });
      }
    }

    // ── Personal activo: menos del 50% con estado "asistio" ──
    const personalActivo = empleados.filter(
      (e) =>
        e.estado?.toLowerCase() === "activo" &&
        (e.rol || "").toLowerCase() !== "admin",
    );

    if (personalActivo.length > 0) {
      const marcados = personalActivo.filter((emp) => {
        const reg = empleadosAsistencia.find(
          (r) => r.empleado_id === emp.id && r.fecha === asistenciaFilterFecha,
        );
        return (reg?.estado || "").toLowerCase() === "asistio";
      }).length;
      const pct = marcados / personalActivo.length;
      if (pct < 0.5) {
        alertas.push({
          id: `personal-${asistenciaFilterFecha}`,
          tipo: "personal",
          mensaje: `Solo ${marcados} de ${personalActivo.length} empleados tienen asistencia registrada`,
          sub: `Menos del 50% marcado como "Asistió" — ${formatDate(asistenciaFilterFecha)}`,
        });
      }
    }

    return alertas;
  }, [
    entrenamientosPlan,
    empleados,
    empleadosAsistencia,
    asistenciaFilterFecha,
  ]);

  // Filtrar las ya descartadas — pero si la condición se resuelve (pasan del 50%),
  // el id cambia en el siguiente re-render y vuelven a aparecer si era necesario.
  const alertasVisibles = useMemo(
    () => alertasSistema.filter((a) => !alertasSistemaDescartadas.has(a.id)),
    [alertasSistema, alertasSistemaDescartadas],
  );

  function descartarAlerta(id: string) {
    setAlertasSistemaDescartadas((prev) => new Set([...prev, id]));
  }

  // ─ Filtered lists ─

  const citasHoyFiltradas = useMemo(
    () =>
      citas
        .filter((cita) => {
          if (!sameDay(cita.fecha, asistenciaFilterFecha)) return false;
          if ((cita.estado || "").toLowerCase() === "cancelada") return false;
          return matchesSearch(filtroCitasHoy, [
            getCitaCliente(cita),
            getCitaEmpleado(cita),
            getCitaServicio(cita),
            cita.estado,
            getCitaHoraInicio(cita),
          ]);
        })
        .sort((a, b) =>
          String(getCitaHoraInicio(a) || "").localeCompare(
            String(getCitaHoraInicio(b) || ""),
          ),
        ),
    [citas, asistenciaFilterFecha, filtroCitasHoy],
  );

  const sesionesPlanBaseDia = useMemo(
    () =>
      entrenamientosPlan
        .filter((row) => {
          if (row.fecha !== asistenciaFilterFecha) return false;
          if ((row.estado || "").toLowerCase() === "cancelado") return false;
          if (!isPlanOperativoFromRow(row, hoy)) return false;
          return true;
        })
        .sort((a, b) =>
          `${a.hora_inicio || ""}`.localeCompare(`${b.hora_inicio || ""}`),
        ),
    [entrenamientosPlan, asistenciaFilterFecha, hoy],
  );

  const sesionesPlanHoyFiltradas = useMemo(() => {
    const q = normalizeSearch(filtroSesionesPlan);

    if (!q) return sesionesPlanBaseDia;

    const fechaReferencia = asistenciaFilterFecha || hoy;

    const getPrioridadBusqueda = (row: EntrenamientoPlanRow) => {
      const asistencia = (row.asistencia_estado || "pendiente").toLowerCase();
      const estado = (row.estado || "").toLowerCase();

      // Prioridad 0: si el cliente ya fue marcado como asistió hoy, esa es la sesión que debe salir.
      if (row.fecha === fechaReferencia && asistencia === "asistio") return 0;

      // Prioridad 1: cualquier sesión del día filtrado, aunque esté marcada como avisó/sin aviso/completada.
      if (row.fecha === fechaReferencia) return 1;

      // Prioridad 2: próxima sesión pendiente desde hoy hacia adelante.
      if (row.fecha && row.fecha >= hoy && asistencia === "pendiente") return 2;

      // Prioridad 3: próximas sesiones ya gestionadas.
      if (row.fecha && row.fecha >= hoy && estado !== "cancelado") return 3;

      // Prioridad 4: historial, solo como último respaldo si no hay nada más.
      return 4;
    };

    const candidatas = entrenamientosPlan
      .filter((row) => {
        if ((row.estado || "").toLowerCase() === "cancelado") return false;
        if (!row.fecha) return false;

        const cp = firstOrNull(row.clientes_planes);
        if (!cp || (cp.estado || "").toLowerCase() === "cancelado") return false;

        const cliente = firstOrNull(row.clientes);
        const empleado = firstOrNull(row.empleados);
        const plan = firstOrNull(cp?.planes);

        return matchesSearch(filtroSesionesPlan, [
          cliente?.nombre,
          empleado?.nombre,
          plan?.nombre,
          row.fecha,
          row.hora_inicio,
          row.asistencia_estado,
          row.estado,
        ]);
      })
      .sort((a, b) => {
        const prioridad = getPrioridadBusqueda(a) - getPrioridadBusqueda(b);
        if (prioridad !== 0) return prioridad;
        return `${a.fecha || "9999-99-99"} ${a.hora_inicio || "99:99"}`.localeCompare(
          `${b.fecha || "9999-99-99"} ${b.hora_inicio || "99:99"}`,
        );
      });

    const porCliente = new Map<string, EntrenamientoPlanRow>();
    candidatas.forEach((row) => {
      const key = row.cliente_id || firstOrNull(row.clientes)?.nombre || row.id;
      if (!porCliente.has(key)) porCliente.set(key, row);
    });

    return Array.from(porCliente.values());
  }, [
    entrenamientosPlan,
    sesionesPlanBaseDia,
    filtroSesionesPlan,
    asistenciaFilterFecha,
    hoy,
  ]);

  const bloquesSesionesPlan = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; sesiones: EntrenamientoPlanRow[] }
    >();
    sesionesPlanBaseDia.forEach((row) => {
        const key = getBloqueKey(row);
        if (!map.has(key))
          map.set(key, { key, label: getBloqueLabel(row), sesiones: [] });
        map.get(key)!.sesiones.push(row);
      });

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [sesionesPlanBaseDia]);

  const totalPagesBloquesSesiones = Math.max(
    1,
    Math.ceil(bloquesSesionesPlan.length / BLOQUES_PAGE_SIZE),
  );

  const bloquesSesionesPlanPageData = useMemo(() => {
    const safePage = Math.min(
      Math.max(bloquesSesionesPage, 1),
      totalPagesBloquesSesiones,
    );
    const start = (safePage - 1) * BLOQUES_PAGE_SIZE;
    return bloquesSesionesPlan.slice(start, start + BLOQUES_PAGE_SIZE);
  }, [bloquesSesionesPlan, bloquesSesionesPage, totalPagesBloquesSesiones]);

  useEffect(() => {
    setBloquesSesionesPage((page) =>
      Math.min(Math.max(page, 1), totalPagesBloquesSesiones),
    );
  }, [totalPagesBloquesSesiones]);

  useEffect(() => {
    if (!bloqueSesionSeleccionado) return;
    const sigueVisible = bloquesSesionesPlanPageData.some(
      (b) => b.key === bloqueSesionSeleccionado,
    );
    if (!sigueVisible) setBloqueSesionSeleccionado(null);
  }, [bloqueSesionSeleccionado, bloquesSesionesPlanPageData]);

  const bloqueActivoSesiones = useMemo(() => {
    if (!bloquesSesionesPlanPageData.length) return null;
    return (
      bloquesSesionesPlanPageData.find(
        (b) => b.key === bloqueSesionSeleccionado,
      ) || bloquesSesionesPlanPageData[0]
    );
  }, [bloquesSesionesPlanPageData, bloqueSesionSeleccionado]);

  const mostrandoBusquedaSesiones =
    normalizeSearch(filtroSesionesPlan).length > 0;

  function getBloqueResumen(sesiones: EntrenamientoPlanRow[]) {
    const asistidas = sesiones.filter(
      (row) => (row.asistencia_estado || "").toLowerCase() === "asistio",
    ).length;
    const pendientes = sesiones.filter(
      (row) => (row.asistencia_estado || "pendiente").toLowerCase() === "pendiente",
    ).length;
    return { asistidas, pendientes, total: sesiones.length };
  }

  const empleadosActivosNoAdmin = useMemo(
    () =>
      empleados.filter((e) => {
        if (e.estado?.toLowerCase() !== "activo") return false;
        if ((e.rol || "").toLowerCase() === "admin") return false;
        const reg = empleadosAsistencia.find(
          (r) => r.empleado_id === e.id && r.fecha === asistenciaFilterFecha,
        );
        return matchesSearch(filtroAsistenciaPersonal, [
          e.nombre,
          e.rol,
          reg?.estado,
        ]);
      }),
    [
      empleados,
      empleadosAsistencia,
      asistenciaFilterFecha,
      filtroAsistenciaPersonal,
    ],
  );

  const planesActivosDetalle = useMemo(
    () =>
      clientesPlanes
        .filter((cp) => (cp.estado || "").toLowerCase() === "activo")
        .map((cp) => {
          const cliente = firstOrNull(cp.clientes);
          const plan = firstOrNull(cp.planes);
          return {
            id: cp.id,
            cliente_id: cp.cliente_id || "",
            cliente_nombre: cliente?.nombre || "Cliente sin nombre",
            cliente_telefono: cliente?.telefono || "",
            plan_nombre: plan?.nombre || "Plan sin nombre",
            fecha_fin: cp.fecha_fin || null,
            sesiones_totales: Number(cp.sesiones_totales || 0),
            sesiones_usadas: Number(cp.sesiones_usadas || 0),
            sesiones_disponibles: Math.max(
              0,
              Number(cp.sesiones_totales || 0) -
                Number(cp.sesiones_usadas || 0),
            ),
          };
        })
        .filter((item) =>
          matchesSearch(filtroPlanActivo, [
            item.cliente_nombre,
            item.cliente_telefono,
            item.plan_nombre,
          ]),
        )
        .sort((a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre)),
    [clientesPlanes, filtroPlanActivo],
  );

  const mapaEstadoCuenta = useMemo(() => {
    const map = new Map<string, EstadoCuentaCliente>();
    estadosCuentaClientes.forEach((row) => {
      if (row?.cliente_id) map.set(String(row.cliente_id), row);
    });
    return map;
  }, [estadosCuentaClientes]);

  const cuentasPorCobrarPorCliente = useMemo(() => {
    const map = new Map<string, CuentaPorCobrar[]>();
    cuentasPorCobrar
      .filter((r) => Number(r.saldo_usd || 0) > 0.009)
      .forEach((r) => {
        if (!r.cliente_id) return;
        const k = String(r.cliente_id);
        map.set(k, [...(map.get(k) || []), r]);
      });
    return map;
  }, [cuentasPorCobrar]);

  const clientesConSaldoPendiente = useMemo(
    () =>
      Array.from(cuentasPorCobrarPorCliente.entries())
        .map(([clienteId, items]) => {
          const ec = mapaEstadoCuenta.get(clienteId);
          return {
            cliente_id: clienteId,
            cliente_nombre:
              items.find((x) => (x.cliente_nombre || "").trim())
                ?.cliente_nombre || "Cliente",
            saldo_pendiente_neto_usd: Number(ec?.saldo_pendiente_neto_usd || 0),
            razones: items
              .sort(
                (a, b) =>
                  new Date(b.created_at || "").getTime() -
                  new Date(a.created_at || "").getTime(),
              )
              .map((item) => ({
                id: item.id,
                concepto: truncateText(
                  item.concepto || item.notas || "Saldo pendiente",
                  80,
                ),
                saldo_usd: Number(item.saldo_usd || 0),
                fecha: item.fecha_venta || item.created_at || null,
              })),
          };
        })
        .filter(
          (r) => r.saldo_pendiente_neto_usd > 0.009 || r.razones.length > 0,
        )
        .sort(
          (a, b) => b.saldo_pendiente_neto_usd - a.saldo_pendiente_neto_usd,
        ),
    [cuentasPorCobrarPorCliente, mapaEstadoCuenta],
  );

  const conversacionesComunicacionUnicas = useMemo(
    () => dedupeConversacionesComunicacion(conversacionesComunicacion),
    [conversacionesComunicacion],
  );

  const solicitudesComunicacionFiltradas = useMemo(() => {
    return solicitudesComunicacion.filter((s) => {
      const estado = (s.estado || "").toLowerCase();
      return comunicacionFilter === "todas" || estado === comunicacionFilter;
    });
  }, [solicitudesComunicacion, comunicacionFilter]);

  async function actualizarSolicitudComunicacion(
    solicitudId: string,
    estado: "pendiente" | "en_revision" | "aprobada" | "rechazada" | "resuelta" | "cancelada",
  ) {
    try {
      let auditorId = empleadoActualId || (await resolveEmpleadoActualId());
      if (!empleadoActualId && auditorId) setEmpleadoActualId(auditorId);
      const { error } = await supabase
        .from("solicitudes_comunicacion")
        .update({
          estado,
          resuelto_at: ["aprobada", "rechazada", "resuelta", "cancelada"].includes(estado)
            ? new Date().toISOString()
            : null,
          resuelto_por: auditorId || null,
        })
        .eq("id", solicitudId);
      if (error) throw error;
      setSolicitudesComunicacion((prev) =>
        prev.map((s) => (s.id === solicitudId ? { ...s, estado } : s)),
      );
      showAlert("success", "Listo", "Solicitud actualizada.");
    } catch (err: any) {
      showAlert("error", "Error", err?.message || "No se pudo actualizar.");
    }
  }

  const mapaAsistenciaPersonalHoy = useMemo(() => {
    const map = new Map<string, EmpleadoAsistenciaRow>();
    empleadosAsistencia
      .filter((r) => r.fecha === asistenciaFilterFecha)
      .forEach((r) => map.set(r.empleado_id, r));
    return map;
  }, [empleadosAsistencia, asistenciaFilterFecha]);

  // ─ Pagination ─
  const citasPage = useMemo(
    () =>
      citasHoyFiltradas.slice(
        (citasHoyPage - 1) * PAGE_SIZE,
        citasHoyPage * PAGE_SIZE,
      ),
    [citasHoyFiltradas, citasHoyPage],
  );
  const sesionesPage = useMemo(
    () =>
      sesionesPlanHoyFiltradas.slice(
        (sesionesPlanPage - 1) * PAGE_SIZE,
        sesionesPlanPage * PAGE_SIZE,
      ),
    [sesionesPlanHoyFiltradas, sesionesPlanPage],
  );
  const empleadosPage = useMemo(
    () =>
      empleadosActivosNoAdmin.slice(
        (empleadosAsistenciaPage - 1) * PAGE_SIZE,
        empleadosAsistenciaPage * PAGE_SIZE,
      ),
    [empleadosActivosNoAdmin, empleadosAsistenciaPage],
  );
  const planesPageData = useMemo(
    () =>
      planesActivosDetalle.slice(
        (planesPage - 1) * PAGE_SIZE,
        planesPage * PAGE_SIZE,
      ),
    [planesActivosDetalle, planesPage],
  );

  const totalPagesCitas = Math.max(
    1,
    Math.ceil(citasHoyFiltradas.length / PAGE_SIZE),
  );
  const totalPagesSesiones = Math.max(
    1,
    Math.ceil(sesionesPlanHoyFiltradas.length / PAGE_SIZE),
  );
  const totalPagesEmpleados = Math.max(
    1,
    Math.ceil(empleadosActivosNoAdmin.length / PAGE_SIZE),
  );
  const totalPagesPlanes = Math.max(
    1,
    Math.ceil(planesActivosDetalle.length / PAGE_SIZE),
  );

  // ─ Actions ─

  async function marcarCitaCompletada(citaId: string) {
    setSavingCitaId(citaId);
    try {
      const { error } = await supabase
        .from("citas")
        .update({ estado: "completada" })
        .eq("id", citaId);
      if (error) throw error;
      setCitas((prev) =>
        prev.map((c) => (c.id === citaId ? { ...c, estado: "completada" } : c)),
      );
      showAlert("success", "Listo", "Cita marcada como completada.");
    } catch (err: any) {
      showAlert("error", "Error", err?.message);
    } finally {
      setSavingCitaId(null);
    }
  }

  async function marcarAsistenciaPlan(
    entrenamientoId: string,
    estado: "asistio" | "no_asistio_aviso" | "no_asistio_sin_aviso",
  ) {
    setSavingAsistenciaId(entrenamientoId);
    try {
      let auditorId = empleadoActualId || (await resolveEmpleadoActualId());
      if (!empleadoActualId && auditorId) setEmpleadoActualId(auditorId);
      const { data, error } = await supabase.rpc(
        "marcar_asistencia_entrenamiento_plan",
        {
          p_entrenamiento_id: entrenamientoId,
          p_asistencia_estado: estado,
          p_motivo: null,
          p_marcado_por: auditorId || null,
        },
      );
      if (error) throw error;
      if (data?.ok === false)
        throw new Error(data?.error || "No se pudo marcar.");
      const consumeSesion =
        estado === "asistio" || estado === "no_asistio_sin_aviso";
      const rowAnterior = entrenamientosPlan.find(
        (r) => r.id === entrenamientoId,
      );
      const consumiaAntes = rowAnterior?.consume_sesion === true;
      const delta =
        consumiaAntes === consumeSesion ? 0 : consumeSesion ? 1 : -1;
      setEntrenamientosPlan((prev) =>
        prev.map((r) =>
          r.id === entrenamientoId
            ? {
                ...r,
                asistencia_estado: estado,
                aviso_previo: estado === "no_asistio_aviso",
                consume_sesion: consumeSesion,
                reprogramable: estado === "no_asistio_aviso",
                fecha_asistencia: new Date().toISOString(),
                marcado_por: auditorId || r.marcado_por || null,
                estado: estado === "asistio" ? "completado" : "no_asistio",
              }
            : r,
        ),
      );
      if (rowAnterior?.cliente_plan_id && delta !== 0) {
        setClientesPlanes((prev) =>
          prev.map((p) => {
            if (p.id !== rowAnterior.cliente_plan_id) return p;
            const t = Number(p.sesiones_totales || 0);
            const u = Math.min(
              t,
              Math.max(0, Number(p.sesiones_usadas || 0) + delta),
            );
            return {
              ...p,
              sesiones_usadas: u,
              estado:
                t > 0 && u >= t
                  ? "agotado"
                  : p.estado === "agotado" && u < t
                    ? "activo"
                    : p.estado,
            };
          }),
        );
      }
      showAlert(
        "success",
        "Listo",
        estado === "no_asistio_aviso"
          ? "Sesión congelada."
          : "Asistencia registrada.",
      );
    } catch (err: any) {
      showAlert("error", "Error", err?.message);
    } finally {
      setSavingAsistenciaId(null);
    }
  }

  async function marcarAsistenciaEmpleado(
    empleadoId: string,
    estado: "asistio" | "no_asistio" | "permiso" | "reposo" | "vacaciones",
  ) {
    setSavingEmpleadoAsistenciaId(empleadoId);
    try {
      let auditorId = empleadoActualId || (await resolveEmpleadoActualId());
      if (!empleadoActualId && auditorId) setEmpleadoActualId(auditorId);
      const existente = empleadosAsistencia.find(
        (a) =>
          a.empleado_id === empleadoId && a.fecha === asistenciaFilterFecha,
      );
      if (existente) {
        const { error } = await supabase
          .from("empleados_asistencia")
          .update({
            estado,
            observaciones: null,
            updated_by: auditorId || null,
          })
          .eq("id", existente.id);
        if (error) throw error;
        setEmpleadosAsistencia((prev) =>
          prev.map((r) =>
            r.id === existente.id
              ? {
                  ...r,
                  estado,
                  updated_by: auditorId || null,
                  updated_at: new Date().toISOString(),
                }
              : r,
          ),
        );
      } else {
        const { data, error } = await supabase
          .from("empleados_asistencia")
          .insert({
            empleado_id: empleadoId,
            fecha: asistenciaFilterFecha,
            estado,
            observaciones: null,
            created_by: auditorId || null,
            updated_by: auditorId || null,
          })
          .select(
            `id,empleado_id,fecha,estado,observaciones,created_at,updated_at,created_by,updated_by,empleados:empleado_id(nombre,rol),actualizado_por:updated_by(id,nombre)`,
          )
          .single();
        if (error) throw error;
        setEmpleadosAsistencia((prev) => [
          data as unknown as EmpleadoAsistenciaRow,
          ...prev,
        ]);
      }
      showAlert("success", "Listo", "Asistencia actualizada.");
    } catch (err: any) {
      showAlert("error", "Error", err?.message);
    } finally {
      setSavingEmpleadoAsistenciaId(null);
    }
  }

  function abrirReagendarSesion(row: EntrenamientoPlanRow, usarHoy = false) {
    const inicio = onlyHour(row.hora_inicio) || "08:00";
    const duracion = getDurationMinutes(row.hora_inicio, row.hora_fin);
    const fin = onlyHour(row.hora_fin) || addMinutesToHour(inicio, duracion);

    setErrorReagenda("");
    setSesionReagendar(row);
    setReagendarForm({
      fecha: usarHoy ? hoy : row.fecha || hoy,
      hora_inicio: inicio,
      hora_fin: fin,
      motivo: usarHoy
        ? "Cliente asistió en una fecha distinta a su sesión programada."
        : "",
    });
  }

  function cerrarReagendarSesion() {
    if (guardandoReagenda) return;
    setSesionReagendar(null);
    setErrorReagenda("");
  }

  async function guardarReagendaSesion() {
    if (!sesionReagendar) return;

    const fecha = reagendarForm.fecha.trim();
    const horaInicio = reagendarForm.hora_inicio.trim();
    const horaFin = reagendarForm.hora_fin.trim();
    const motivo = reagendarForm.motivo.trim();

    if (!fecha) {
      setErrorReagenda("Selecciona la nueva fecha.");
      return;
    }
    if (!horaInicio || !horaFin) {
      setErrorReagenda("Selecciona hora inicio y hora fin.");
      return;
    }
    if (dateTimeMs(fecha, horaFin) <= dateTimeMs(fecha, horaInicio)) {
      setErrorReagenda("La hora fin debe ser mayor a la hora inicio.");
      return;
    }

    const cp = firstOrNull(sesionReagendar.clientes_planes);
    const asistenciaActual = (
      sesionReagendar.asistencia_estado || "pendiente"
    ).toLowerCase();
    const fechaFinPlan = cp?.fecha_fin || null;
    const puedeExtenderVencimiento = asistenciaActual === "no_asistio_aviso";

    if (fechaFinPlan && fecha > fechaFinPlan && !puedeExtenderVencimiento) {
      setErrorReagenda(
        `Solo las sesiones en estado Avisó pueden reagendarse después del vencimiento del plan (${fechaFinPlan}).`,
      );
      return;
    }

    setGuardandoReagenda(true);
    setErrorReagenda("");

    const anteriorFecha = sesionReagendar.fecha || "sin fecha";
    const anteriorInicio = onlyHour(sesionReagendar.hora_inicio) || "—";
    const anteriorFin = onlyHour(sesionReagendar.hora_fin) || "—";
    const notaReagenda = `Reagendada desde ${anteriorFecha} ${anteriorInicio}-${anteriorFin} hacia ${fecha} ${horaInicio}-${horaFin}${motivo ? `. Motivo: ${motivo}` : ""}`;

    try {
      let auditorId = empleadoActualId || (await resolveEmpleadoActualId());
      if (!empleadoActualId && auditorId) setEmpleadoActualId(auditorId);

      const rpcRes = await supabase.rpc(
        "reprogramar_entrenamiento_plan_seguro",
        {
          p_entrenamiento_id: sesionReagendar.id,
          p_nueva_fecha: fecha,
          p_nueva_hora_inicio: normalizeTimeForDb(horaInicio),
          p_nueva_hora_fin: normalizeTimeForDb(horaFin),
          p_motivo: notaReagenda,
          p_marcado_por: auditorId || null,
        },
      );

      if (rpcRes.error) throw rpcRes.error;
      const rpcData = rpcRes.data as {
        ok?: boolean;
        error?: string;
        extendio_plan?: boolean;
      } | null;
      if (rpcData && rpcData.ok === false)
        throw new Error(rpcData.error || "No se pudo reagendar la sesión.");

      const updateRes = await supabase
        .from("entrenamientos")
        .select(
          `id,cliente_plan_id,cliente_id,empleado_id,recurso_id,fecha,hora_inicio,hora_fin,estado,asistencia_estado,aviso_previo,consume_sesion,reprogramable,motivo_asistencia,fecha_asistencia,reprogramado_de_entrenamiento_id,marcado_por,actualizado_por:marcado_por(id,nombre),clientes:cliente_id(nombre),empleados:empleado_id(nombre,rol),clientes_planes:cliente_plan_id(id,fecha_fin,estado,planes:plan_id(nombre))`,
        )
        .eq("id", sesionReagendar.id)
        .single();

      if (updateRes.error) throw updateRes.error;

      const row: any = updateRes.data;
      const normalizada: EntrenamientoPlanRow = {
        ...row,
        clientes: firstOrNull(row?.clientes),
        empleados: firstOrNull(row?.empleados),
        clientes_planes: firstOrNull(row?.clientes_planes)
          ? {
              ...firstOrNull(row?.clientes_planes),
              planes: firstOrNull(firstOrNull(row?.clientes_planes)?.planes),
            }
          : null,
      };

      if (sesionReagendar.consume_sesion === true) {
        setClientesPlanes((prev) =>
          prev.map((p) => {
            if (p.id !== sesionReagendar.cliente_plan_id) return p;
            const total = Number(p.sesiones_totales || 0);
            const usadas = Math.min(
              total,
              Math.max(0, Number(p.sesiones_usadas || 0) - 1),
            );
            return { ...p, sesiones_usadas: usadas };
          }),
        );
      }

      setEntrenamientosPlan((prev) =>
        prev.map((r) => (r.id === normalizada.id ? normalizada : r)),
      );
      setCitas((prev) =>
        prev.map((c) =>
          c.id === normalizada.id
            ? {
                ...c,
                fecha,
                hora_inicio: normalizeTimeForDb(horaInicio) || horaInicio,
                hora_fin: normalizeTimeForDb(horaFin) || horaFin,
                estado: "programada",
                notas: notaReagenda,
              }
            : c,
        ),
      );

      showAlert(
        "success",
        "Listo",
        rpcData?.extendio_plan
          ? "Sesión reagendada y plan extendido."
          : "Sesión reagendada correctamente.",
      );
      setSesionReagendar(null);
      setPanelOpen("sesiones");
    } catch (err: any) {
      setErrorReagenda(err?.message || "No se pudo reagendar la sesión.");
      showAlert(
        "error",
        "Error",
        err?.message || "No se pudo reagendar la sesión.",
      );
    } finally {
      setGuardandoReagenda(false);
    }
  }

  async function loadPagosDetalle(
    desde = ingresosRangoDesde,
    hasta = ingresosRangoHasta,
  ) {
    if (loadingPagosDetalle) return;
    setLoadingPagosDetalle(true);
    try {
      const { data, error } = await supabase
        .from("pagos")
        .select(
          `id,fecha,concepto,monto,monto_equivalente_usd,moneda_pago,estado,created_at,clientes:cliente_id(nombre),metodo_pago_principal:metodo_pago_id(nombre),metodo_pago_v2:metodo_pago_v2_id(nombre)`,
        )
        .eq("estado", "pagado")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = ((data || []) as any[]).map((r) => ({
        id: r.id,
        fecha: r.fecha,
        concepto: r.concepto,
        monto: r.monto,
        monto_equivalente_usd: r.monto_equivalente_usd,
        moneda_pago: r.moneda_pago,
        estado: r.estado,
        cliente_nombre: firstOrNull(r.clientes)?.nombre || null,
        metodo_nombre:
          firstOrNull(r.metodo_pago_principal)?.nombre ||
          firstOrNull(r.metodo_pago_v2)?.nombre ||
          null,
      }));
      setPagosDetalle(rows);
      const now = new Date();
      const mesDesde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const mesHasta = getDateKey(now);
      if (desde === mesDesde && hasta === mesHasta)
        setPagos(
          rows.map((r) => ({
            id: r.id,
            fecha: r.fecha,
            monto: r.monto,
            monto_equivalente_usd: r.monto_equivalente_usd,
            estado: r.estado,
          })),
        );
    } catch (err: any) {
      showAlert("error", "Error", err?.message);
    } finally {
      setLoadingPagosDetalle(false);
    }
  }

  function renderSesionPlanCard(
    row: EntrenamientoPlanRow,
    options?: { compact?: boolean; searchResult?: boolean },
  ) {
    const cliente = firstOrNull(row.clientes);
    const empleado = firstOrNull(row.empleados);
    const cp = firstOrNull(row.clientes_planes);
    const plan = firstOrNull(cp?.planes);
    const open = openSesionPlanId === row.id;
    const puedeReagendar = canReagendarSesion(row);
    const saving = savingAsistenciaId === row.id;

    return (
      <div
        key={row.id}
        className={`overflow-hidden rounded-xl border ${options?.searchResult ? "border-violet-400/15 bg-violet-400/[0.04]" : "border-white/[0.06] bg-white/[0.02]"}`}
      >
        <RowItem
          dot={asistenciaPlanDot(row.asistencia_estado)}
          onClick={() => setOpenSesionPlanId(open ? null : row.id)}
          left={
            <div>
              <p className="truncate text-sm font-medium text-white">
                {cliente?.nombre || "Cliente"}
              </p>
              <p className="truncate text-[11px] text-white/40">
                {options?.searchResult ? `${formatDate(row.fecha)} · ` : ""}
                {formatTime(row.hora_inicio)} ·{" "}
                {asistenciaLabel(row.asistencia_estado)}
              </p>
            </div>
          }
          right={
            <span className="text-[10px] text-white/25">
              {open ? "−" : "+"}
            </span>
          }
        />

        {open && (
          <div className="border-t border-white/[0.06] px-3 pb-3 pt-2">
            <p className="mb-2 text-[11px] text-white/40">
              {empleado?.nombre || "Sin personal"} · {roleLabel(empleado?.rol)}{" "}
              ·{" "}
              <span className="text-violet-400/70">
                {plan?.nombre || "Plan"}
              </span>
              {cp?.fecha_fin ? (
                <span className="text-white/30">
                  {" "}
                  · Vence {formatDate(cp.fecha_fin)}
                </span>
              ) : null}
            </p>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => void marcarAsistenciaPlan(row.id, "asistio")}
                className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1.5 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-50"
              >
                Asistió
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void marcarAsistenciaPlan(row.id, "no_asistio_aviso")
                }
                className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2 py-1.5 text-[11px] font-semibold text-amber-300 transition hover:bg-amber-400/15 disabled:opacity-50"
              >
                Avisó
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void marcarAsistenciaPlan(row.id, "no_asistio_sin_aviso")
                }
                className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-2 py-1.5 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-400/15 disabled:opacity-50"
              >
                Sin aviso
              </button>
              <button
                type="button"
                disabled={!puedeReagendar}
                onClick={() => abrirReagendarSesion(row, true)}
                className="rounded-lg border border-violet-400/20 bg-violet-400/10 px-2 py-1.5 text-[11px] font-semibold text-violet-200 transition hover:bg-violet-400/15 disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-white/30"
              >
                Reagendar
              </button>
            </div>

            {options?.searchResult && row.cliente_id ? (
              <Link
                href={`/admin/personas/clientes/${row.cliente_id}`}
                className="mt-2 inline-flex text-[11px] text-white/35 underline underline-offset-2 transition hover:text-white/65"
              >
                Ver cliente
              </Link>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
          <p className="text-sm text-white/40">Cargando dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-8 px-4 pb-12 md:px-6">
      {/* ── Toast alert ── */}
      {alert && (
        <div
          className={`fixed right-4 top-4 z-50 max-w-xs rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-sm transition-all ${
            alert.type === "error"
              ? "border-rose-400/30 bg-rose-950/80 text-rose-300"
              : alert.type === "success"
                ? "border-emerald-400/30 bg-emerald-950/80 text-emerald-300"
                : alert.type === "warning"
                  ? "border-amber-400/30 bg-amber-950/80 text-amber-300"
                  : "border-sky-400/30 bg-sky-950/80 text-sky-300"
          }`}
        >
          <p className="text-sm font-semibold">{alert.title}</p>
          <p className="mt-0.5 text-xs opacity-80">{alert.message}</p>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 px-4 py-3">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col gap-5 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-white/30">
            Administración
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-white/35">
            {new Date().toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/operaciones/agenda/nueva"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/[0.08]"
          >
            + Nueva cita
          </Link>
          <Link
            href="/admin/personas/clientes/nuevo"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/[0.08]"
          >
            + Cliente
          </Link>
          <Link
            href="/admin/reportes"
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/[0.08]"
          >
            Reportes
          </Link>
        </div>
      </div>

      {/* ── Metrics grid ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <MetricTile
          label="Clientes activos"
          value={stats.clientesActivos}
          sub={`+${stats.clientesNuevosMes} este mes`}
          accent="text-sky-400"
        />
        <MetricTile
          label="Planes activos"
          value={stats.planesActivos}
          sub={`${stats.totalSesionesDisponibles} sesiones disp.`}
          accent="text-violet-400"
          onClick={() => setPanelOpen("planes")}
          active={panelOpen === "planes"}
        />
        <MetricTile
          label="Citas hoy"
          value={stats.citasHoy}
          sub={`${stats.programadasHoy} programadas`}
          accent="text-amber-400"
          onClick={() => setPanelOpen("citas")}
          active={panelOpen === "citas"}
        />
        <MetricTile
          label="Ingresos del mes"
          value={money(stats.ingresosMes)}
          sub={`Hoy ${money(stats.pagosHoy)}`}
          accent="text-emerald-400"
          onClick={() => {
            setPanelOpen("ingresos");
            void loadPagosDetalle();
          }}
          active={panelOpen === "ingresos"}
        />
        <MetricTile
          label="Personal activo"
          value={stats.personalActivo}
          sub="Ver asistencia →"
          onClick={() => setPanelOpen("personal")}
          active={panelOpen === "personal"}
        />
        <MetricTile
          label="Sesiones pendientes"
          value={stats.sesionesPlanPendientes}
          sub="Del día de hoy"
          accent={
            stats.sesionesPlanPendientes > 0
              ? "text-amber-400"
              : "text-white/60"
          }
          onClick={() => setPanelOpen("sesiones")}
          active={panelOpen === "sesiones"}
        />
        <MetricTile
          label="Comunicación"
          value={stats.solicitudesPendientes}
          sub={`${stats.solicitudesRevision} en revisión`}
          accent={
            stats.solicitudesPendientes > 0
              ? "text-amber-400"
              : "text-sky-400"
          }
          onClick={() => setPanelOpen("comunicacion")}
          active={panelOpen === "comunicacion"}
        />
      </div>

      {/* ── Date filter bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-white/30">Fecha de referencia:</p>
        <input
          type="date"
          value={asistenciaFilterFecha}
          onChange={(e) => {
            setAsistenciaFilterFecha(e.target.value);
            setCitasHoyPage(1);
            setSesionesPlanPage(1);
            setBloquesSesionesPage(1);
            setBloqueSesionSeleccionado(null);
            setEmpleadosAsistenciaPage(1);
            // Limpiar descartadas de la fecha anterior para que la nueva fecha arranque fresca
            setAlertasSistemaDescartadas(new Set());
          }}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white outline-none focus:border-white/20"
        />
        {asistenciaFilterFecha !== hoy && (
          <button
            type="button"
            onClick={() => {
              setAsistenciaFilterFecha(hoy);
              setBloquesSesionesPage(1);
              setBloqueSesionSeleccionado(null);
              setAlertasSistemaDescartadas(new Set());
            }}
            className="text-xs text-white/40 underline underline-offset-2 transition hover:text-white/70"
          >
            Volver a hoy
          </button>
        )}
      </div>

      {/* ── Alertas del sistema ── */}
      {alertasVisibles.length > 0 && (
        <div className="space-y-2">
          {alertasVisibles.map((alerta) => (
            <AlertaSistemaCard
              key={alerta.id}
              alerta={alerta}
              onDescartar={descartarAlerta}
            />
          ))}
        </div>
      )}

      {/* ── Comunicación interna ── */}
      <div className="rounded-3xl border border-sky-400/10 bg-sky-400/[0.035] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <SectionLabel>Comunicación interna</SectionLabel>
            <p className="text-sm text-white/55">
              {stats.solicitudesPendientes} solicitud(es) pendiente(s) · {conversacionesComunicacionUnicas.length} conversación(es) activas
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <GhostBtn onClick={() => setPanelOpen("comunicacion")}>
              Abrir bandeja
            </GhostBtn>
            <Link
              href="/admin/personas/comunicacion"
              className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-200 transition hover:bg-sky-400/15"
            >
              Ir al chat completo
            </Link>
          </div>
        </div>
        {solicitudesComunicacion.filter((s) => (s.estado || "").toLowerCase() === "pendiente").length > 0 ? (
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {solicitudesComunicacion
              .filter((s) => (s.estado || "").toLowerCase() === "pendiente")
              .slice(0, 3)
              .map((s) => {
                const cliente = firstOrNull(s.clientes);
                const fisio = firstOrNull(s.fisios);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPanelOpen("comunicacion")}
                    className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-left transition hover:bg-white/[0.04]"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-white">
                        {solicitudComunicacionLabel(s.tipo)}
                      </p>
                      <PillBadge color={solicitudEstadoColor(s.estado)}>
                        {s.estado || "pendiente"}
                      </PillBadge>
                    </div>
                    <p className="truncate text-[11px] text-white/40">
                      {cliente?.nombre || "Sin cliente"}{fisio?.nombre ? ` · ${fisio.nombre}` : ""}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-white/50">
                      {s.descripcion || s.titulo || "Sin descripción"}
                    </p>
                  </button>
                );
              })}
          </div>
        ) : null}
      </div>

      {/* ── Three columns ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Col 1 — Citas */}
        <div>
          <SectionLabel>Citas del día</SectionLabel>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 pb-1">
              <input
                type="text"
                value={filtroCitasHoy}
                onChange={(e) => {
                  setFiltroCitasHoy(e.target.value);
                  setCitasHoyPage(1);
                }}
                placeholder="Buscar…"
                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15"
              />
              <GhostBtn onClick={() => setPanelOpen("citas")}>
                {citasHoyFiltradas.length} ver
              </GhostBtn>
            </div>

            {citasHoyFiltradas.length === 0 ? (
              <p className="py-3 text-center text-xs text-white/30">
                Sin citas
              </p>
            ) : (
              citasPage.map((cita) => {
                const completada =
                  (cita.estado || "").toLowerCase() === "completada";
                return (
                  <RowItem
                    key={cita.id}
                    dot={citaDot(cita.estado)}
                    left={
                      <div>
                        <p className="truncate text-sm font-medium text-white">
                          {getCitaCliente(cita)}
                        </p>
                        <p className="truncate text-[11px] text-white/40">
                          {formatTime(getCitaHoraInicio(cita))} ·{" "}
                          {getCitaServicio(cita)}
                        </p>
                      </div>
                    }
                    right={
                      <button
                        type="button"
                        disabled={savingCitaId === cita.id || completada}
                        onClick={() => void marcarCitaCompletada(cita.id)}
                        className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${completada ? "text-emerald-400/60" : "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15"}`}
                      >
                        {completada
                          ? "✓"
                          : savingCitaId === cita.id
                            ? "…"
                            : "Completar"}
                      </button>
                    }
                  />
                );
              })
            )}

            {citasHoyFiltradas.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-white/25">
                  {citasHoyPage}/{totalPagesCitas}
                </p>
                <div className="flex gap-1">
                  <GhostBtn
                    onClick={() => setCitasHoyPage((p) => Math.max(p - 1, 1))}
                    disabled={citasHoyPage <= 1}
                  >
                    ←
                  </GhostBtn>
                  <GhostBtn
                    onClick={() =>
                      setCitasHoyPage((p) => Math.min(p + 1, totalPagesCitas))
                    }
                    disabled={citasHoyPage >= totalPagesCitas}
                  >
                    →
                  </GhostBtn>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Col 2 — Sesiones plan */}
        <div>
          <SectionLabel>Sesiones de plan</SectionLabel>
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-1">
              <input
                type="text"
                value={filtroSesionesPlan}
                onChange={(e) => {
                  setFiltroSesionesPlan(e.target.value);
                  setSesionesPlanPage(1);
                  setBloquesSesionesPage(1);
                  setBloqueSesionSeleccionado(null);
                }}
                placeholder="Buscar cliente con plan activo…"
                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15"
              />
              <GhostBtn onClick={() => setPanelOpen("sesiones")}>
                {mostrandoBusquedaSesiones
                  ? sesionesPlanHoyFiltradas.length
                  : vistaSesionesPlan === "bloques"
                    ? bloquesSesionesPlan.length
                    : sesionesPlanBaseDia.length}{" "}
                ver
              </GhostBtn>
            </div>

            {!mostrandoBusquedaSesiones && (
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
                <button
                  type="button"
                  onClick={() => setVistaSesionesPlan("bloques")}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${vistaSesionesPlan === "bloques" ? "bg-amber-400/15 text-amber-200" : "text-white/35 hover:bg-white/[0.04] hover:text-white/60"}`}
                >
                  Ver por bloques
                </button>
                <button
                  type="button"
                  onClick={() => setVistaSesionesPlan("lista")}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${vistaSesionesPlan === "lista" ? "bg-violet-400/15 text-violet-200" : "text-white/35 hover:bg-white/[0.04] hover:text-white/60"}`}
                >
                  Ver sesiones
                </button>
              </div>
            )}

            {mostrandoBusquedaSesiones ? (
              <div className="space-y-1.5">
                <p className="rounded-xl border border-violet-400/15 bg-violet-400/5 px-3 py-2 text-[11px] text-violet-200/80">
                  Si el cliente ya asistió hoy, se muestra esa sesión primero.
                  Si no, se muestra la sesión más cercana.
                </p>
                {sesionesPlanHoyFiltradas.length === 0 ? (
                  <p className="py-3 text-center text-xs text-white/30">
                    Sin sesiones pendientes cercanas
                  </p>
                ) : (
                  sesionesPage.map((row) =>
                    renderSesionPlanCard(row, { searchResult: true }),
                  )
                )}
              </div>
            ) : vistaSesionesPlan === "lista" ? (
              sesionesPlanBaseDia.length === 0 ? (
                <p className="py-3 text-center text-xs text-white/30">
                  Sin sesiones para este día
                </p>
              ) : (
                <div className="space-y-1.5">
                  {sesionesPlanBaseDia.map((row) => renderSesionPlanCard(row))}
                </div>
              )
            ) : bloquesSesionesPlan.length === 0 ? (
              <p className="py-3 text-center text-xs text-white/30">
                Sin bloques para este día
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid gap-2">
                  {bloquesSesionesPlanPageData.map((bloque) => {
                    const activo = bloqueActivoSesiones?.key === bloque.key;
                    return (
                      <button
                        key={bloque.key}
                        type="button"
                        onClick={() => setBloqueSesionSeleccionado(bloque.key)}
                        className={`rounded-xl border px-3 py-2 text-left transition ${activo ? "border-amber-400/25 bg-amber-400/10" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {bloque.label}
                            </p>
                            <p className="text-[11px] text-white/35">
                              Bloque de entrenamiento
                            </p>
                          </div>
                          {(() => {
                            const resumen = getBloqueResumen(bloque.sesiones);
                            return (
                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <PillBadge color="amber">
                                  {resumen.total} persona{resumen.total !== 1 ? "s" : ""}
                                </PillBadge>
                                <span className="text-[10px] text-white/30">
                                  {resumen.pendientes} pend. · {resumen.asistidas} asist.
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {bloquesSesionesPlan.length > BLOQUES_PAGE_SIZE && (
                  <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <p className="text-[11px] text-white/30">
                      Mostrando {bloquesSesionesPlanPageData.length} de{" "}
                      {bloquesSesionesPlan.length} bloques ·{" "}
                      {bloquesSesionesPage}/{totalPagesBloquesSesiones}
                    </p>
                    <div className="flex gap-1">
                      <GhostBtn
                        onClick={() => {
                          setBloquesSesionesPage((p) => Math.max(p - 1, 1));
                          setBloqueSesionSeleccionado(null);
                        }}
                        disabled={bloquesSesionesPage <= 1}
                      >
                        ←
                      </GhostBtn>
                      <GhostBtn
                        onClick={() => {
                          setBloquesSesionesPage((p) =>
                            Math.min(p + 1, totalPagesBloquesSesiones),
                          );
                          setBloqueSesionSeleccionado(null);
                        }}
                        disabled={
                          bloquesSesionesPage >= totalPagesBloquesSesiones
                        }
                      >
                        →
                      </GhostBtn>
                    </div>
                  </div>
                )}

                {bloqueActivoSesiones && (
                  <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
                    <p className="px-1 text-[11px] font-medium uppercase tracking-wider text-white/30">
                      {bloqueActivoSesiones.label}
                    </p>
                    {bloqueActivoSesiones.sesiones.map((row) =>
                      renderSesionPlanCard(row, { compact: true }),
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Col 3 — Personal */}
        <div>
          <SectionLabel>Asistencia personal</SectionLabel>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 pb-1">
              <input
                type="text"
                value={filtroAsistenciaPersonal}
                onChange={(e) => {
                  setFiltroAsistenciaPersonal(e.target.value);
                  setEmpleadosAsistenciaPage(1);
                }}
                placeholder="Buscar…"
                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15"
              />
            </div>

            {empleadosActivosNoAdmin.length === 0 ? (
              <p className="py-3 text-center text-xs text-white/30">
                Sin personal
              </p>
            ) : (
              empleadosPage.map((emp) => {
                const registro = mapaAsistenciaPersonalHoy.get(emp.id);
                const open = openEmpleadoAsistenciaId === emp.id;

                return (
                  <div
                    key={emp.id}
                    className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]"
                  >
                    <RowItem
                      dot={asistenciaPersonalDot(registro?.estado)}
                      onClick={() =>
                        setOpenEmpleadoAsistenciaId(open ? null : emp.id)
                      }
                      left={
                        <div>
                          <p className="truncate text-sm font-medium text-white">
                            {emp.nombre}
                          </p>
                          <p className="truncate text-[11px] text-white/40">
                            {roleLabel(emp.rol)} ·{" "}
                            {asistenciaPersonalLabel(registro?.estado)}
                          </p>
                        </div>
                      }
                      right={
                        <span className="text-[10px] text-white/25">
                          {open ? "−" : "+"}
                        </span>
                      }
                    />
                    {open && (
                      <div className="border-t border-white/[0.06] px-3 pb-3 pt-2">
                        <div className="grid grid-cols-5 gap-1.5">
                          {(
                            [
                              {
                                k: "asistio",
                                l: "✓",
                                c: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
                              },
                              {
                                k: "permiso",
                                l: "P",
                                c: "border-amber-400/20 bg-amber-400/10 text-amber-300",
                              },
                              {
                                k: "no_asistio",
                                l: "✕",
                                c: "border-rose-400/20 bg-rose-400/10 text-rose-300",
                              },
                              {
                                k: "reposo",
                                l: "R",
                                c: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-300",
                              },
                              {
                                k: "vacaciones",
                                l: "V",
                                c: "border-sky-400/20 bg-sky-400/10 text-sky-300",
                              },
                            ] as const
                          ).map(({ k, l, c }) => (
                            <button
                              key={k}
                              type="button"
                              disabled={savingEmpleadoAsistenciaId === emp.id}
                              onClick={() =>
                                void marcarAsistenciaEmpleado(emp.id, k as any)
                              }
                              className={`rounded-lg border py-2 text-xs font-bold transition disabled:opacity-50 ${c}`}
                            >
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {empleadosActivosNoAdmin.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-white/25">
                  {empleadosAsistenciaPage}/{totalPagesEmpleados}
                </p>
                <div className="flex gap-1">
                  <GhostBtn
                    onClick={() =>
                      setEmpleadosAsistenciaPage((p) => Math.max(p - 1, 1))
                    }
                    disabled={empleadosAsistenciaPage <= 1}
                  >
                    ←
                  </GhostBtn>
                  <GhostBtn
                    onClick={() =>
                      setEmpleadosAsistenciaPage((p) =>
                        Math.min(p + 1, totalPagesEmpleados),
                      )
                    }
                    disabled={empleadosAsistenciaPage >= totalPagesEmpleados}
                  >
                    →
                  </GhostBtn>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom strip: Saldos summary ── */}
      {clientesConSaldoPendiente.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <SectionLabel>Saldos pendientes</SectionLabel>
            <GhostBtn onClick={() => setPanelOpen("saldos")}>
              Ver todos · {clientesConSaldoPendiente.length}
            </GhostBtn>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {clientesConSaldoPendiente.slice(0, 4).map((row) => (
              <div
                key={row.cliente_id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-rose-400/10 bg-rose-400/[0.04] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {row.cliente_nombre}
                  </p>
                  <p className="truncate text-[11px] text-white/40">
                    {row.razones[0]?.concepto}
                  </p>
                </div>
                <PillBadge color="rose">
                  {money(row.saldo_pendiente_neto_usd)}
                </PillBadge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════ SLIDE PANELS ════ */}

      {/* Panel — Citas detalle */}
      <SlidePanel
        open={panelOpen === "citas"}
        onClose={() => setPanelOpen(null)}
        title={`Citas · ${asistenciaFilterFecha}`}
      >
        <div className="space-y-3">
          <input
            type="text"
            value={filtroCitasHoy}
            onChange={(e) => setFiltroCitasHoy(e.target.value)}
            placeholder="Buscar cliente, terapeuta…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15"
          />
          <Divider />
          {citasHoyFiltradas.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/30">
              Sin citas para este día
            </p>
          ) : (
            citasHoyFiltradas.map((cita) => {
              const completada =
                (cita.estado || "").toLowerCase() === "completada";
              return (
                <div key={cita.id} className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${citaDot(cita.estado)}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">
                      {getCitaCliente(cita)}
                    </p>
                    <p className="text-[11px] text-white/40">
                      {formatTime(getCitaHoraInicio(cita))} –{" "}
                      {formatTime(getCitaHoraFin(cita))} ·{" "}
                      {getCitaServicio(cita)}
                    </p>
                    <p className="text-[11px] text-white/30">
                      {getCitaEmpleado(cita)} · {citaEstadoLabel(cita.estado)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={savingCitaId === cita.id || completada}
                    onClick={() => void marcarCitaCompletada(cita.id)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${completada ? "text-emerald-400/60" : "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15"}`}
                  >
                    {completada
                      ? "✓"
                      : savingCitaId === cita.id
                        ? "…"
                        : "Completar"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </SlidePanel>

      {/* Panel — Sesiones detalle */}
      <SlidePanel
        open={panelOpen === "sesiones"}
        onClose={() => setPanelOpen(null)}
        title="Sesiones de plan"
      >
        <div className="space-y-3">
          <input
            type="text"
            value={filtroSesionesPlan}
            onChange={(e) => {
              setFiltroSesionesPlan(e.target.value);
              setSesionesPlanPage(1);
              setBloquesSesionesPage(1);
              setBloqueSesionSeleccionado(null);
            }}
            placeholder="Buscar cliente con plan activo…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15"
          />
          <Divider />

          {!mostrandoBusquedaSesiones && (
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
              <button
                type="button"
                onClick={() => setVistaSesionesPlan("bloques")}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${vistaSesionesPlan === "bloques" ? "bg-amber-400/15 text-amber-200" : "text-white/35 hover:bg-white/[0.04] hover:text-white/60"}`}
              >
                Ver por bloques
              </button>
              <button
                type="button"
                onClick={() => setVistaSesionesPlan("lista")}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${vistaSesionesPlan === "lista" ? "bg-violet-400/15 text-violet-200" : "text-white/35 hover:bg-white/[0.04] hover:text-white/60"}`}
              >
                Ver sesiones
              </button>
            </div>
          )}

          {mostrandoBusquedaSesiones ? (
            <div className="space-y-2">
              <p className="rounded-xl border border-violet-400/15 bg-violet-400/5 px-3 py-2 text-[11px] text-violet-200/80">
                Resultado inteligente: primero sale la sesión de hoy si ya fue marcada,
                y luego la sesión más cercana si todavía está pendiente.
              </p>
              {sesionesPlanHoyFiltradas.length === 0 ? (
                <p className="py-4 text-center text-sm text-white/30">
                  Sin sesiones pendientes cercanas
                </p>
              ) : (
                sesionesPlanHoyFiltradas.map((row) =>
                  renderSesionPlanCard(row, { searchResult: true }),
                )
              )}
            </div>
          ) : vistaSesionesPlan === "lista" ? (
            <div className="space-y-2">
              {sesionesPlanBaseDia.length === 0 ? (
                <p className="py-4 text-center text-sm text-white/30">
                  Sin sesiones para este día
                </p>
              ) : (
                sesionesPlanBaseDia.map((row) => renderSesionPlanCard(row))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {bloquesSesionesPlan.length === 0 ? (
                <p className="py-4 text-center text-sm text-white/30">
                  Sin bloques para este día
                </p>
              ) : (
                <>
                  <div className="grid gap-2">
                    {bloquesSesionesPlanPageData.map((bloque) => {
                      const activo = bloqueActivoSesiones?.key === bloque.key;
                      return (
                        <button
                          key={bloque.key}
                          type="button"
                          onClick={() =>
                            setBloqueSesionSeleccionado(bloque.key)
                          }
                          className={`rounded-xl border px-3 py-2 text-left transition ${activo ? "border-amber-400/25 bg-amber-400/10" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {bloque.label}
                              </p>
                              <p className="text-[11px] text-white/35">
                                Sesiones del {formatDate(asistenciaFilterFecha)}
                              </p>
                            </div>
                            {(() => {
                              const resumen = getBloqueResumen(bloque.sesiones);
                              return (
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <PillBadge color="amber">
                                    {resumen.total} persona{resumen.total !== 1 ? "s" : ""}
                                  </PillBadge>
                                  <span className="text-[10px] text-white/30">
                                    {resumen.pendientes} pend. · {resumen.asistidas} asist.
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {bloqueActivoSesiones && (
                    <div className="space-y-2 border-t border-white/[0.06] pt-3">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
                        Clientes en {bloqueActivoSesiones.label}
                      </p>
                      {bloqueActivoSesiones.sesiones.map((row) =>
                        renderSesionPlanCard(row),
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </SlidePanel>

      {/* Panel — Personal */}
      <SlidePanel
        open={panelOpen === "personal"}
        onClose={() => setPanelOpen(null)}
        title="Asistencia personal"
      >
        <div className="space-y-3">
          <input
            type="text"
            value={filtroAsistenciaPersonal}
            onChange={(e) => setFiltroAsistenciaPersonal(e.target.value)}
            placeholder="Buscar empleado…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15"
          />
          <Divider />
          {empleadosActivosNoAdmin.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/30">
              Sin personal
            </p>
          ) : (
            empleadosActivosNoAdmin.map((emp) => {
              const registro = mapaAsistenciaPersonalHoy.get(emp.id);
              const open = openEmpleadoAsistenciaId === emp.id;
              return (
                <div
                  key={emp.id}
                  className="overflow-hidden rounded-xl border border-white/[0.06]"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenEmpleadoAsistenciaId(open ? null : emp.id)
                    }
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.03]"
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${asistenciaPersonalDot(registro?.estado)}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">
                        {emp.nombre}
                      </p>
                      <p className="text-[11px] text-white/40">
                        {roleLabel(emp.rol)} ·{" "}
                        {asistenciaPersonalLabel(registro?.estado)}
                      </p>
                    </div>
                    <span className="text-[10px] text-white/25">
                      {open ? "−" : "+"}
                    </span>
                  </button>
                  {open && (
                    <div className="border-t border-white/[0.06] px-3 pb-3 pt-2">
                      <div className="grid grid-cols-5 gap-1.5">
                        {(
                          [
                            {
                              k: "asistio",
                              l: "✓",
                              c: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
                            },
                            {
                              k: "permiso",
                              l: "P",
                              c: "border-amber-400/20 bg-amber-400/10 text-amber-300",
                            },
                            {
                              k: "no_asistio",
                              l: "✕",
                              c: "border-rose-400/20 bg-rose-400/10 text-rose-300",
                            },
                            {
                              k: "reposo",
                              l: "R",
                              c: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-300",
                            },
                            {
                              k: "vacaciones",
                              l: "V",
                              c: "border-sky-400/20 bg-sky-400/10 text-sky-300",
                            },
                          ] as const
                        ).map(({ k, l, c }) => (
                          <button
                            key={k}
                            type="button"
                            disabled={savingEmpleadoAsistenciaId === emp.id}
                            onClick={() =>
                              void marcarAsistenciaEmpleado(emp.id, k as any)
                            }
                            className={`rounded-lg border py-2 text-xs font-bold transition disabled:opacity-50 ${c}`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </SlidePanel>

      {/* Panel — Planes activos */}
      <SlidePanel
        open={panelOpen === "planes"}
        onClose={() => setPanelOpen(null)}
        title="Planes activos"
      >
        <div className="space-y-3">
          <input
            type="text"
            value={filtroPlanActivo}
            onChange={(e) => setFiltroPlanActivo(e.target.value)}
            placeholder="Buscar cliente, plan…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15"
          />
          <p className="text-[11px] text-white/25">
            {planesActivosDetalle.length} planes
          </p>
          <Divider />
          {planesActivosDetalle.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/30">
              Sin planes activos
            </p>
          ) : (
            planesPageData.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {item.cliente_nombre}
                  </p>
                  <p className="truncate text-[11px] text-violet-400/70">
                    {item.plan_nombre}
                  </p>
                  <p className="text-[11px] text-white/30">
                    Vence {formatDate(item.fecha_fin)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <PillBadge color="violet">
                    {item.sesiones_disponibles}/{item.sesiones_totales}
                  </PillBadge>
                  {item.cliente_id && (
                    <Link
                      href={`/admin/personas/clientes/${item.cliente_id}`}
                      className="text-[11px] text-white/30 underline underline-offset-2 transition hover:text-white/60"
                    >
                      Ver
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
          {planesActivosDetalle.length > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-white/25">
                {planesPage}/{totalPagesPlanes}
              </p>
              <div className="flex gap-1">
                <GhostBtn
                  onClick={() => setPlanesPage((p) => Math.max(p - 1, 1))}
                  disabled={planesPage <= 1}
                >
                  ←
                </GhostBtn>
                <GhostBtn
                  onClick={() =>
                    setPlanesPage((p) => Math.min(p + 1, totalPagesPlanes))
                  }
                  disabled={planesPage >= totalPagesPlanes}
                >
                  →
                </GhostBtn>
              </div>
            </div>
          )}
        </div>
      </SlidePanel>

      {/* Panel — Saldos */}
      <SlidePanel
        open={panelOpen === "saldos"}
        onClose={() => setPanelOpen(null)}
        title="Saldos pendientes"
      >
        <div className="space-y-3">
          {clientesConSaldoPendiente.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/30">
              Sin deudas registradas
            </p>
          ) : (
            clientesConSaldoPendiente.map((row) => (
              <div
                key={row.cliente_id}
                className="rounded-xl border border-white/[0.06] px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">
                      {row.cliente_nombre}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/35">
                      {row.razones.length} concepto(s)
                    </p>
                  </div>
                  <PillBadge color="rose">
                    {money(row.saldo_pendiente_neto_usd)}
                  </PillBadge>
                </div>
                {row.razones.slice(0, 2).map((r) => (
                  <div
                    key={r.id}
                    className="mt-2 flex items-start justify-between gap-2"
                  >
                    <p className="text-[11px] text-white/45">{r.concepto}</p>
                    <p className="shrink-0 text-[11px] text-white/30">
                      {formatDate(r.fecha)}
                    </p>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </SlidePanel>

      {/* Panel — Comunicación */}
      <SlidePanel
        open={panelOpen === "comunicacion"}
        onClose={() => setPanelOpen(null)}
        title="Comunicación interna"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
            {[
              { key: "pendiente", label: "Pend." },
              { key: "en_revision", label: "Rev." },
              { key: "todas", label: "Todas" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setComunicacionFilter(item.key)}
                className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition ${
                  comunicacionFilter === item.key
                    ? "bg-sky-400/15 text-sky-200"
                    : "text-white/35 hover:bg-white/[0.04] hover:text-white/60"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/30">
              Solicitudes
            </p>
            {solicitudesComunicacionFiltradas.length === 0 ? (
              <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-center text-sm text-white/30">
                Sin solicitudes en este filtro
              </p>
            ) : (
              <div className="space-y-2">
                {solicitudesComunicacionFiltradas.map((s) => {
                  const cliente = firstOrNull(s.clientes);
                  const fisio = firstOrNull(s.fisios);
                  return (
                    <div
                      key={s.id}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {solicitudComunicacionLabel(s.tipo)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-white/35">
                            {cliente?.nombre || "Sin cliente"}
                            {fisio?.nombre ? ` · ${fisio.nombre}` : ""}
                          </p>
                        </div>
                        <PillBadge color={solicitudEstadoColor(s.estado)}>
                          {s.estado || "pendiente"}
                        </PillBadge>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-xs text-white/50">
                        {s.descripcion || s.titulo || "Sin descripción"}
                      </p>
                      <p className="mt-2 text-[10px] text-white/25">
                        {s.created_at ? new Date(s.created_at).toLocaleString("es-ES") : "—"}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            void actualizarSolicitudComunicacion(s.id, "en_revision")
                          }
                          className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-2 py-1.5 text-[11px] font-semibold text-sky-200 transition hover:bg-sky-400/15"
                        >
                          Revisar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void actualizarSolicitudComunicacion(s.id, "resuelta")
                          }
                          className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1.5 text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-400/15"
                        >
                          Resolver
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void actualizarSolicitudComunicacion(s.id, "aprobada")
                          }
                          className="rounded-lg border border-violet-400/20 bg-violet-400/10 px-2 py-1.5 text-[11px] font-semibold text-violet-200 transition hover:bg-violet-400/15"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void actualizarSolicitudComunicacion(s.id, "rechazada")
                          }
                          className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-2 py-1.5 text-[11px] font-semibold text-rose-300 transition hover:bg-rose-400/15"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Divider />

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
                Conversaciones
              </p>
              <Link
                href="/admin/comunicacion"
                className="text-[11px] text-sky-300 underline underline-offset-2 transition hover:text-sky-200"
              >
                Abrir chat
              </Link>
            </div>
            {conversacionesComunicacionUnicas.length === 0 ? (
              <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-center text-sm text-white/30">
                Sin conversaciones
              </p>
            ) : (
              <div className="space-y-2">
                {conversacionesComunicacionUnicas.slice(0, 12).map((c) => {
                  const cliente = firstOrNull(c.clientes);
                  const fisio = firstOrNull(c.fisios);
                  return (
                    <div
                      key={c.id}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3"
                    >
                      <p className="truncate text-sm font-medium text-white">
                        {cliente?.nombre || fisio?.nombre || c.titulo || "Conversación"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-sky-300/70">
                        {conversacionComunicacionLabel(c.tipo)}
                      </p>
                      <p className="mt-1 truncate text-[11px] text-white/35">
                        {c.ultimo_mensaje || "Sin mensajes"}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SlidePanel>

      {/* Panel — Ingresos */}
      <SlidePanel
        open={panelOpen === "ingresos"}
        onClose={() => setPanelOpen(null)}
        title="Detalle de ingresos"
      >
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Hoy", desde: hoy, hasta: hoy },
              {
                label: "Esta semana",
                desde: (() => {
                  const d = new Date();
                  d.setDate(d.getDate() - d.getDay());
                  return getDateKey(d);
                })(),
                hasta: hoy,
              },
              { label: "Este mes", desde: ingresosRangoDesde, hasta: hoy },
              {
                label: "Mes anterior",
                desde: (() => {
                  const d = new Date();
                  d.setDate(1);
                  d.setMonth(d.getMonth() - 1);
                  return getDateKey(d);
                })(),
                hasta: (() => {
                  const d = new Date();
                  d.setDate(0);
                  return getDateKey(d);
                })(),
              },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setIngresosRangoDesde(p.desde);
                  setIngresosRangoHasta(p.hasta);
                  void loadPagosDetalle(p.desde, p.hasta);
                }}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/55 transition hover:bg-white/[0.07] hover:text-white/80"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <p className="mb-1 text-[10px] text-white/30">Desde</p>
              <input
                type="date"
                value={ingresosRangoDesde}
                onChange={(e) => setIngresosRangoDesde(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none"
              />
            </div>
            <div>
              <p className="mb-1 text-[10px] text-white/30">Hasta</p>
              <input
                type="date"
                value={ingresosRangoHasta}
                onChange={(e) => setIngresosRangoHasta(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none"
              />
            </div>
            <GhostBtn
              onClick={() => void loadPagosDetalle()}
              disabled={loadingPagosDetalle}
            >
              {loadingPagosDetalle ? "…" : "Aplicar"}
            </GhostBtn>
          </div>

          {pagosDetalle.length > 0 && (
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-4 py-3">
              <p className="text-xs text-white/40">
                {pagosDetalle.length} pago(s)
              </p>
              <p className="text-xl font-bold text-emerald-400">
                {money(
                  pagosDetalle.reduce(
                    (acc, p) =>
                      acc + Number(p.monto_equivalente_usd || p.monto || 0),
                    0,
                  ),
                )}
              </p>
            </div>
          )}

          <Divider />

          {loadingPagosDetalle ? (
            <p className="py-4 text-center text-sm text-white/30">Cargando…</p>
          ) : pagosDetalle.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/30">
              Sin pagos en ese rango
            </p>
          ) : (
            pagosDetalle.map((pago) => (
              <div
                key={pago.id}
                className="flex items-start justify-between gap-3 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {pago.cliente_nombre || (
                      <span className="text-white/30">Sin cliente</span>
                    )}
                  </p>
                  <p className="truncate text-[11px] text-white/40">
                    {pago.concepto || "—"} ·{" "}
                    {pago.metodo_nombre || pago.moneda_pago || "—"}
                  </p>
                  <p className="text-[11px] text-white/25">
                    {formatDate(pago.fecha)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-emerald-400">
                  {money(pago.monto_equivalente_usd || pago.monto)}
                </p>
              </div>
            ))
          )}
        </div>
      </SlidePanel>

      {/* ── Modal Reagendar ── */}
      {sesionReagendar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0f1117] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-white">
                  Reagendar sesión
                </p>
                <p className="mt-1 text-sm text-white/50">
                  {firstOrNull(sesionReagendar.clientes)?.nombre || "Cliente"} ·{" "}
                  {firstOrNull(
                    firstOrNull(sesionReagendar.clientes_planes)?.planes,
                  )?.nombre || "Sesión del plan"}
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarReagendarSesion}
                className="rounded-full border border-white/10 px-3 py-1 text-sm text-white/60 transition hover:bg-white/[0.06]"
              >
                ×
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/65">
              <p>
                Actual: {formatDate(sesionReagendar.fecha)} ·{" "}
                {formatTime(sesionReagendar.hora_inicio)} -{" "}
                {formatTime(sesionReagendar.hora_fin)}
              </p>
              {firstOrNull(sesionReagendar.clientes_planes)?.fecha_fin ? (
                <p className="mt-1 text-xs text-white/40">
                  Vencimiento del plan:{" "}
                  {firstOrNull(sesionReagendar.clientes_planes)?.fecha_fin}
                </p>
              ) : null}
              {(sesionReagendar.asistencia_estado || "").toLowerCase() ===
              "no_asistio_aviso" ? (
                <p className="mt-1 text-xs text-violet-300">
                  Si eliges una fecha mayor al vencimiento, el plan se extenderá
                  automáticamente.
                </p>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-white/45">
                  Nueva fecha
                </span>
                <input
                  type="date"
                  value={reagendarForm.fecha}
                  onChange={(e) =>
                    setReagendarForm((prev) => ({
                      ...prev,
                      fecha: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-violet-400/40"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-white/45">
                    Hora inicio
                  </span>
                  <input
                    type="time"
                    value={reagendarForm.hora_inicio}
                    onChange={(e) => {
                      const nextInicio = e.target.value;
                      const duracion = getDurationMinutes(
                        sesionReagendar.hora_inicio,
                        sesionReagendar.hora_fin,
                      );
                      setReagendarForm((prev) => ({
                        ...prev,
                        hora_inicio: nextInicio,
                        hora_fin: addMinutesToHour(nextInicio, duracion),
                      }));
                    }}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-violet-400/40"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-white/45">
                    Hora fin
                  </span>
                  <input
                    type="time"
                    value={reagendarForm.hora_fin}
                    onChange={(e) =>
                      setReagendarForm((prev) => ({
                        ...prev,
                        hora_fin: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-violet-400/40"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-white/45">
                  Motivo opcional
                </span>
                <textarea
                  value={reagendarForm.motivo}
                  onChange={(e) =>
                    setReagendarForm((prev) => ({
                      ...prev,
                      motivo: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Ej: cliente vino hoy y se usa la sesión más cercana"
                  className="mt-1 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/40"
                />
              </label>
            </div>

            {errorReagenda ? (
              <p className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-300">
                {errorReagenda}
              </p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cerrarReagendarSesion}
                disabled={guardandoReagenda}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.06] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarReagendaSesion}
                disabled={guardandoReagenda}
                className="rounded-2xl border border-violet-400/20 bg-violet-400/15 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/20 disabled:opacity-50"
              >
                {guardandoReagenda ? "Guardando..." : "Guardar cambio"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
