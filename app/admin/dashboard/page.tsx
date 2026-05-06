"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Cliente = { id: string; estado?: string | null; created_at?: string | null };
type CitaRaw = { id: string; fecha?: string | null; estado?: string | null; [key: string]: any };
type Pago = { id: string; fecha?: string | null; monto?: number | null; monto_equivalente_usd?: number | null; estado?: string | null };
type PagoDetalle = { id: string; fecha?: string | null; concepto?: string | null; monto?: number | null; monto_equivalente_usd?: number | null; moneda_pago?: string | null; estado?: string | null; cliente_nombre?: string | null; metodo_nombre?: string | null };
type Empleado = { id: string; nombre?: string | null; estado?: string | null; rol?: string | null };
type PlanCliente = { id: string; cliente_id?: string | null; plan_id?: string | null; fecha_inicio?: string | null; fecha_fin?: string | null; estado?: string | null; sesiones_totales?: number | null; sesiones_usadas?: number | null; clientes?: { nombre?: string | null; telefono?: string | null; email?: string | null } | { nombre?: string | null; telefono?: string | null; email?: string | null }[] | null; planes?: { nombre?: string | null } | { nombre?: string | null }[] | null };
type EstadoCuentaCliente = { cliente_id: string; total_pendiente_usd?: number | null; credito_disponible_usd?: number | null; saldo_pendiente_neto_usd?: number | null; saldo_favor_neto_usd?: number | null };
type CuentaPorCobrar = { id: string; cliente_id: string | null; cliente_nombre?: string | null; concepto?: string | null; saldo_usd?: number | null; estado?: string | null; fecha_venta?: string | null; created_at?: string | null; notas?: string | null };
type EntrenamientoPlanRow = { id: string; cliente_plan_id: string | null; cliente_id: string | null; empleado_id: string | null; recurso_id: string | null; fecha: string | null; hora_inicio: string | null; hora_fin: string | null; estado: string | null; asistencia_estado: string | null; aviso_previo: boolean | null; consume_sesion: boolean | null; reprogramable: boolean | null; motivo_asistencia: string | null; fecha_asistencia: string | null; reprogramado_de_entrenamiento_id: string | null; marcado_por?: string | null; actualizado_por?: { id: string; nombre: string | null } | null; clientes?: { nombre: string } | { nombre: string }[] | null; empleados?: { nombre: string; rol?: string | null } | { nombre: string; rol?: string | null }[] | null; clientes_planes?: { id: string; fecha_fin?: string | null; estado?: string | null; planes?: { nombre?: string | null } | { nombre?: string | null }[] | null } | { id: string; fecha_fin?: string | null; estado?: string | null; planes?: { nombre?: string | null } | { nombre?: string | null }[] | null }[] | null };
type EmpleadoAsistenciaRow = { id: string; empleado_id: string; fecha: string; estado: "asistio" | "no_asistio" | "permiso" | "reposo" | "vacaciones"; observaciones: string | null; created_at?: string | null; updated_at?: string | null; created_by?: string | null; updated_by?: string | null; empleados?: { nombre: string; rol?: string | null } | { nombre: string; rol?: string | null }[] | null; actualizado_por?: { id: string; nombre: string | null } | { id: string; nombre: string | null }[] | null };
type AlertType = "error" | "success" | "warning" | "info";
type ReprogramacionDraft = { fecha: string; hora_inicio: string; hora_fin: string; motivo: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(value || 0));
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
  try { return new Date(`${dateStr}T00:00:00`).toLocaleDateString("es-ES"); } catch { return dateStr; }
}

function formatTime(timeStr: string | null | undefined) {
  if (!timeStr) return "—";
  return String(timeStr).slice(0, 5);
}

function normalizeSearch(value: string | null | undefined) {
  return (value || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function matchesSearch(query: string, values: Array<string | number | null | undefined>) {
  const q = normalizeSearch(query);
  if (!q) return true;
  return values.some((value) => normalizeSearch(String(value ?? "")).includes(q));
}

function getCitaCliente(cita: CitaRaw) {
  const cliente = firstOrNull(cita.clientes || cita.cliente || null);
  return cliente?.nombre || cita.cliente_nombre || "Cliente";
}

function getCitaEmpleado(cita: CitaRaw) {
  const empleado = firstOrNull(cita.empleados || cita.terapeuta || cita.personal || null);
  return empleado?.nombre || cita.empleado_nombre || "Personal";
}

function getCitaServicio(cita: CitaRaw) {
  const servicio = firstOrNull(cita.servicios || cita.servicio || null);
  return servicio?.nombre || cita.servicio_nombre || "Servicio";
}

function getCitaHoraInicio(cita: CitaRaw) { return cita.hora_inicio || cita.hora || cita.inicio || null; }
function getCitaHoraFin(cita: CitaRaw) { return cita.hora_fin || cita.fin || null; }

function citaEstadoLabel(estado: string | null | undefined) {
  switch ((estado || "").toLowerCase()) {
    case "programada": return "Programada";
    case "confirmada": return "Confirmada";
    case "completada": return "Completada";
    case "cancelada": return "Cancelada";
    case "reprogramada": return "Reprogramada";
    default: return estado || "Sin estado";
  }
}

function asistenciaLabel(estado: string | null | undefined) {
  switch ((estado || "").toLowerCase()) {
    case "pendiente": return "Pendiente";
    case "asistio": return "Asistió";
    case "no_asistio_aviso": return "Avisó";
    case "no_asistio_sin_aviso": return "Sin aviso";
    case "reprogramado": return "Reprog.";
    default: return estado || "—";
  }
}

function asistenciaPersonalLabel(estado: string | null | undefined) {
  switch ((estado || "").toLowerCase()) {
    case "asistio": return "Asistió";
    case "no_asistio": return "No asistió";
    case "permiso": return "Permiso";
    case "reposo": return "Reposo";
    case "vacaciones": return "Vacaciones";
    default: return "Sin marcar";
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

// ─── Dot colours ──────────────────────────────────────────────────────────────

function asistenciaPlanDot(estado: string | null | undefined) {
  switch ((estado || "").toLowerCase()) {
    case "asistio": return "bg-emerald-400";
    case "no_asistio_aviso": return "bg-amber-400";
    case "no_asistio_sin_aviso": return "bg-rose-400";
    case "reprogramado": return "bg-violet-400";
    default: return "bg-white/20";
  }
}

function asistenciaPersonalDot(estado: string | null | undefined) {
  switch ((estado || "").toLowerCase()) {
    case "asistio": return "bg-emerald-400";
    case "no_asistio": return "bg-rose-400";
    case "permiso": return "bg-amber-400";
    case "reposo": return "bg-fuchsia-400";
    case "vacaciones": return "bg-sky-400";
    default: return "bg-white/15";
  }
}

function citaDot(estado: string | null | undefined) {
  switch ((estado || "").toLowerCase()) {
    case "completada": return "bg-emerald-400";
    case "confirmada": return "bg-sky-400";
    case "programada": return "bg-amber-400";
    case "cancelada": return "bg-rose-400";
    case "reprogramada": return "bg-violet-400";
    default: return "bg-white/20";
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PillBadge({ children, color = "white" }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    white: "border-white/10 bg-white/[0.06] text-white/60",
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    rose: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    violet: "border-violet-400/20 bg-violet-400/10 text-violet-300",
    sky: "border-sky-400/20 bg-sky-400/10 text-sky-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tabular-nums ${map[color] ?? map.white}`}>
      {children}
    </span>
  );
}

function GhostBtn({ children, onClick, disabled, className = "" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
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

// Floating panel that slides in from the right on click
function SlidePanel({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <>
      {/* backdrop */}
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

// Big metric tile — replaces StatCard
function MetricTile({ label, value, sub, accent, onClick, active }: { label: string; value: string | number; sub?: string; accent?: string; onClick?: () => void; active?: boolean }) {
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
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/35">{label}</p>
      <p className={`text-2xl font-bold tabular-nums tracking-tight ${accent ?? "text-white"}`}>{value}</p>
      {sub && <p className="text-[11px] text-white/40">{sub}</p>}
    </Wrapper>
  );
}

// Compact row item for lists
function RowItem({ left, right, dot, onClick, muted }: { left: React.ReactNode; right?: React.ReactNode; dot?: string; onClick?: () => void; muted?: boolean }) {
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

const PAGE_SIZE = 8;

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [alert, setAlert] = useState<{ type: AlertType; title: string; message: string } | null>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [citas, setCitas] = useState<CitaRaw[]>([]);
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [clientesPlanes, setClientesPlanes] = useState<PlanCliente[]>([]);
  const [entrenamientosPlan, setEntrenamientosPlan] = useState<EntrenamientoPlanRow[]>([]);
  const [empleadosAsistencia, setEmpleadosAsistencia] = useState<EmpleadoAsistenciaRow[]>([]);
  const [estadosCuentaClientes, setEstadosCuentaClientes] = useState<EstadoCuentaCliente[]>([]);
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState<CuentaPorCobrar[]>([]);
  const [empleadoActualId, setEmpleadoActualId] = useState<string>("");

  // Panels
  const [panelOpen, setPanelOpen] = useState<"citas" | "sesiones" | "personal" | "planes" | "saldos" | "ingresos" | null>(null);

  // Filters & pages
  const [asistenciaFilterFecha, setAsistenciaFilterFecha] = useState(getDateKey(new Date()));
  const [filtroCitasHoy, setFiltroCitasHoy] = useState("");
  const [filtroSesionesPlan, setFiltroSesionesPlan] = useState("");
  const [filtroAsistenciaPersonal, setFiltroAsistenciaPersonal] = useState("");
  const [filtroPlanActivo, setFiltroPlanActivo] = useState("");

  const [savingCitaId, setSavingCitaId] = useState<string | null>(null);
  const [savingAsistenciaId, setSavingAsistenciaId] = useState<string | null>(null);
  const [savingEmpleadoAsistenciaId, setSavingEmpleadoAsistenciaId] = useState<string | null>(null);
  const [openSesionPlanId, setOpenSesionPlanId] = useState<string | null>(null);
  const [openEmpleadoAsistenciaId, setOpenEmpleadoAsistenciaId] = useState<string | null>(null);
  const [reprogramandoId, setReprogramandoId] = useState<string | null>(null);
  const [reprogramacionDrafts, setReprogramacionDrafts] = useState<Record<string, ReprogramacionDraft>>({});

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
  const [ingresosRangoHasta, setIngresosRangoHasta] = useState(getDateKey(new Date()));

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
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) return "";
      const authUserId = authData.user?.id;
      if (!authUserId) return "";
      const { data: emp1 } = await supabase.from("empleados").select("id").eq("auth_user_id", authUserId).maybeSingle();
      if (emp1?.id) return String(emp1.id);
      const { data: emp2 } = await supabase.from("empleados").select("id").eq("id", authUserId).maybeSingle();
      return emp2?.id ? String(emp2.id) : "";
    } catch { return ""; }
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
        clientesRes, citasRes, pagosRes, empleadosRes, clientesPlanesRes,
        entrenamientosPlanRes, empleadosAsistenciaRes, estadosCuentaRes, cuentasPorCobrarRes,
      ] = await Promise.all([
        supabase.from("clientes").select("id, estado, created_at"),
        supabase.from("citas").select(`*, clientes:cliente_id(nombre,telefono,email), empleados:terapeuta_id(nombre,rol), servicios:servicio_id(nombre)`),
        supabase.from("pagos").select("id,fecha,monto,monto_equivalente_usd,estado").eq("estado", "pagado").gte("fecha", mesDesde).lte("fecha", mesHasta).order("fecha", { ascending: false }),
        supabase.from("empleados").select("id,nombre,estado,rol"),
        supabase.from("clientes_planes").select(`id,cliente_id,plan_id,fecha_inicio,fecha_fin,estado,sesiones_totales,sesiones_usadas,clientes:cliente_id(nombre,telefono,email),planes:plan_id(nombre)`),
        supabase.from("entrenamientos").select(`id,cliente_plan_id,cliente_id,empleado_id,recurso_id,fecha,hora_inicio,hora_fin,estado,asistencia_estado,aviso_previo,consume_sesion,reprogramable,motivo_asistencia,fecha_asistencia,reprogramado_de_entrenamiento_id,marcado_por,actualizado_por:marcado_por(id,nombre),clientes:cliente_id(nombre),empleados:empleado_id(nombre,rol),clientes_planes:cliente_plan_id(id,fecha_fin,estado,planes:plan_id(nombre))`).not("cliente_plan_id", "is", null).neq("estado", "cancelado").order("fecha", { ascending: true }).order("hora_inicio", { ascending: true }),
        supabase.from("empleados_asistencia").select(`id,empleado_id,fecha,estado,observaciones,created_at,updated_at,created_by,updated_by,empleados:empleado_id(nombre,rol),actualizado_por:updated_by(id,nombre)`).order("fecha", { ascending: false }),
        supabase.from("v_clientes_estado_cuenta").select(`cliente_id,total_pendiente_usd,credito_disponible_usd,saldo_pendiente_neto_usd,saldo_favor_neto_usd`),
        supabase.from("cuentas_por_cobrar").select(`id,cliente_id,cliente_nombre,concepto,saldo_usd,estado,fecha_venta,created_at,notas`).gt("saldo_usd", 0).neq("estado", "pagado").order("created_at", { ascending: false }),
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

      setClientes((clientesRes.data || []) as Cliente[]);
      setCitas((citasRes.data || []) as CitaRaw[]);
      setPagos((pagosRes.data || []) as Pago[]);
      setEmpleados((empleadosRes.data || []) as Empleado[]);
      setClientesPlanes((clientesPlanesRes.data || []) as PlanCliente[]);
      setEntrenamientosPlan((entrenamientosPlanRes.data || []) as unknown as EntrenamientoPlanRow[]);
      setEmpleadosAsistencia((empleadosAsistenciaRes.data || []) as unknown as EmpleadoAsistenciaRow[]);
      setEstadosCuentaClientes((estadosCuentaRes.data || []) as EstadoCuentaCliente[]);
      setCuentasPorCobrar((cuentasPorCobrarRes.data || []) as CuentaPorCobrar[]);
    } catch (err: any) {
      setError(err?.message || "No se pudo cargar el dashboard.");
    } finally {
      setLoading(false);
    }
  }

  const today = useMemo(() => new Date(), []);
  const hoy = useMemo(() => getDateKey(today), [today]);

  const stats = useMemo(() => {
    const clientesActivos = clientes.filter((c) => c.estado?.toLowerCase() === "activo").length;
    const clientesNuevosMes = clientes.filter((c) => sameMonth(c.created_at, today)).length;
    const citasHoy = citas.filter((c) => sameDay(c.fecha, hoy)).length;
    const programadasHoy = citas.filter((c) => sameDay(c.fecha, hoy) && c.estado?.toLowerCase() === "programada").length;
    const completadasMes = citas.filter((c) => sameMonth(c.fecha, today) && c.estado?.toLowerCase() === "completada").length;
    const ingresosMes = pagos.filter((p) => p.estado?.toLowerCase() === "pagado" && sameMonth(p.fecha, today)).reduce((acc, p) => acc + Number(p.monto_equivalente_usd || p.monto || 0), 0);
    const pagosHoy = pagos.filter((p) => p.estado?.toLowerCase() === "pagado" && sameDay(p.fecha, hoy)).reduce((acc, p) => acc + Number(p.monto_equivalente_usd || p.monto || 0), 0);
    const personalActivo = empleados.filter((e) => e.estado?.toLowerCase() === "activo").length;
    const planesActivos = clientesPlanes.filter((cp) => cp.estado?.toLowerCase() === "activo").length;
    const totalSesionesDisponibles = clientesPlanes.filter((cp) => cp.estado?.toLowerCase() === "activo").reduce((acc, cp) => acc + (Number(cp.sesiones_totales || 0) - Number(cp.sesiones_usadas || 0)), 0);
    const sesionesPlanPendientes = entrenamientosPlan.filter((e) => {
      if (e.fecha !== asistenciaFilterFecha) return false;
      if ((e.estado || "").toLowerCase() === "cancelado") return false;
      const cp = firstOrNull(e.clientes_planes);
      if (!cp || (cp.estado || "").toLowerCase() === "cancelado") return false;
      return (e.asistencia_estado || "pendiente") === "pendiente";
    }).length;
    const clientesDeudores = Array.from(new Set(cuentasPorCobrar.filter((c) => Number(c.saldo_usd || 0) > 0.009).map((c) => c.cliente_id))).length;

    return { clientesActivos, clientesNuevosMes, citasHoy, programadasHoy, completadasMes, ingresosMes, pagosHoy, personalActivo, planesActivos, totalSesionesDisponibles, sesionesPlanPendientes, clientesDeudores };
  }, [clientes, citas, pagos, empleados, clientesPlanes, entrenamientosPlan, cuentasPorCobrar, today, hoy, asistenciaFilterFecha]);

  // ─ Filtered lists ─

  const citasHoyFiltradas = useMemo(() => citas.filter((cita) => {
    if (!sameDay(cita.fecha, asistenciaFilterFecha)) return false;
    if ((cita.estado || "").toLowerCase() === "cancelada") return false;
    return matchesSearch(filtroCitasHoy, [getCitaCliente(cita), getCitaEmpleado(cita), getCitaServicio(cita), cita.estado, getCitaHoraInicio(cita)]);
  }).sort((a, b) => String(getCitaHoraInicio(a) || "").localeCompare(String(getCitaHoraInicio(b) || ""))), [citas, asistenciaFilterFecha, filtroCitasHoy]);

  const sesionesPlanHoyFiltradas = useMemo(() => entrenamientosPlan.filter((row) => {
    if (row.fecha !== asistenciaFilterFecha) return false;
    if ((row.estado || "").toLowerCase() === "cancelado") return false;
    const cp = firstOrNull(row.clientes_planes);
    if (!cp || (cp.estado || "").toLowerCase() === "cancelado") return false;
    const cliente = firstOrNull(row.clientes);
    const empleado = firstOrNull(row.empleados);
    const plan = firstOrNull(cp.planes);
    return matchesSearch(filtroSesionesPlan, [cliente?.nombre, empleado?.nombre, plan?.nombre, row.asistencia_estado]);
  }), [entrenamientosPlan, asistenciaFilterFecha, filtroSesionesPlan]);

  const empleadosActivosNoAdmin = useMemo(() => empleados.filter((e) => {
    if (e.estado?.toLowerCase() !== "activo") return false;
    if ((e.rol || "").toLowerCase() === "admin") return false;
    const reg = empleadosAsistencia.find((r) => r.empleado_id === e.id && r.fecha === asistenciaFilterFecha);
    return matchesSearch(filtroAsistenciaPersonal, [e.nombre, e.rol, reg?.estado]);
  }), [empleados, empleadosAsistencia, asistenciaFilterFecha, filtroAsistenciaPersonal]);

  const planesActivosDetalle = useMemo(() => clientesPlanes.filter((cp) => (cp.estado || "").toLowerCase() === "activo").map((cp) => {
    const cliente = firstOrNull(cp.clientes);
    const plan = firstOrNull(cp.planes);
    return { id: cp.id, cliente_id: cp.cliente_id || "", cliente_nombre: cliente?.nombre || "Cliente sin nombre", cliente_telefono: cliente?.telefono || "", plan_nombre: plan?.nombre || "Plan sin nombre", fecha_fin: cp.fecha_fin || null, sesiones_totales: Number(cp.sesiones_totales || 0), sesiones_usadas: Number(cp.sesiones_usadas || 0), sesiones_disponibles: Math.max(0, Number(cp.sesiones_totales || 0) - Number(cp.sesiones_usadas || 0)) };
  }).filter((item) => matchesSearch(filtroPlanActivo, [item.cliente_nombre, item.cliente_telefono, item.plan_nombre])).sort((a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre)), [clientesPlanes, filtroPlanActivo]);

  const mapaEstadoCuenta = useMemo(() => {
    const map = new Map<string, EstadoCuentaCliente>();
    estadosCuentaClientes.forEach((row) => { if (row?.cliente_id) map.set(String(row.cliente_id), row); });
    return map;
  }, [estadosCuentaClientes]);

  const cuentasPorCobrarPorCliente = useMemo(() => {
    const map = new Map<string, CuentaPorCobrar[]>();
    cuentasPorCobrar.filter((r) => Number(r.saldo_usd || 0) > 0.009).forEach((r) => {
      if (!r.cliente_id) return;
      const k = String(r.cliente_id);
      map.set(k, [...(map.get(k) || []), r]);
    });
    return map;
  }, [cuentasPorCobrar]);

  const clientesConSaldoPendiente = useMemo(() => Array.from(cuentasPorCobrarPorCliente.entries()).map(([clienteId, items]) => {
    const ec = mapaEstadoCuenta.get(clienteId);
    return {
      cliente_id: clienteId,
      cliente_nombre: items.find((x) => (x.cliente_nombre || "").trim())?.cliente_nombre || "Cliente",
      saldo_pendiente_neto_usd: Number(ec?.saldo_pendiente_neto_usd || 0),
      razones: items.sort((a, b) => new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime()).map((item) => ({ id: item.id, concepto: truncateText(item.concepto || item.notas || "Saldo pendiente", 80), saldo_usd: Number(item.saldo_usd || 0), fecha: item.fecha_venta || item.created_at || null })),
    };
  }).filter((r) => r.saldo_pendiente_neto_usd > 0.009 || r.razones.length > 0).sort((a, b) => b.saldo_pendiente_neto_usd - a.saldo_pendiente_neto_usd), [cuentasPorCobrarPorCliente, mapaEstadoCuenta]);

  const mapaAsistenciaPersonalHoy = useMemo(() => {
    const map = new Map<string, EmpleadoAsistenciaRow>();
    empleadosAsistencia.filter((r) => r.fecha === asistenciaFilterFecha).forEach((r) => map.set(r.empleado_id, r));
    return map;
  }, [empleadosAsistencia, asistenciaFilterFecha]);

  // ─ Pagination ─
  const citasPage = useMemo(() => citasHoyFiltradas.slice((citasHoyPage - 1) * PAGE_SIZE, citasHoyPage * PAGE_SIZE), [citasHoyFiltradas, citasHoyPage]);
  const sesionesPage = useMemo(() => sesionesPlanHoyFiltradas.slice((sesionesPlanPage - 1) * PAGE_SIZE, sesionesPlanPage * PAGE_SIZE), [sesionesPlanHoyFiltradas, sesionesPlanPage]);
  const empleadosPage = useMemo(() => empleadosActivosNoAdmin.slice((empleadosAsistenciaPage - 1) * PAGE_SIZE, empleadosAsistenciaPage * PAGE_SIZE), [empleadosActivosNoAdmin, empleadosAsistenciaPage]);
  const planesPageData = useMemo(() => planesActivosDetalle.slice((planesPage - 1) * PAGE_SIZE, planesPage * PAGE_SIZE), [planesActivosDetalle, planesPage]);

  const totalPagesCitas = Math.max(1, Math.ceil(citasHoyFiltradas.length / PAGE_SIZE));
  const totalPagesSesiones = Math.max(1, Math.ceil(sesionesPlanHoyFiltradas.length / PAGE_SIZE));
  const totalPagesEmpleados = Math.max(1, Math.ceil(empleadosActivosNoAdmin.length / PAGE_SIZE));
  const totalPagesPlanes = Math.max(1, Math.ceil(planesActivosDetalle.length / PAGE_SIZE));

  // ─ Actions ─

  async function marcarCitaCompletada(citaId: string) {
    setSavingCitaId(citaId);
    try {
      const { error } = await supabase.from("citas").update({ estado: "completada" }).eq("id", citaId);
      if (error) throw error;
      setCitas((prev) => prev.map((c) => c.id === citaId ? { ...c, estado: "completada" } : c));
      showAlert("success", "Listo", "Cita marcada como completada.");
    } catch (err: any) { showAlert("error", "Error", err?.message); }
    finally { setSavingCitaId(null); }
  }

  async function marcarAsistenciaPlan(entrenamientoId: string, estado: "asistio" | "no_asistio_aviso" | "no_asistio_sin_aviso") {
    setSavingAsistenciaId(entrenamientoId);
    try {
      let auditorId = empleadoActualId || await resolveEmpleadoActualId();
      if (!empleadoActualId && auditorId) setEmpleadoActualId(auditorId);
      const { data, error } = await supabase.rpc("marcar_asistencia_entrenamiento_plan", { p_entrenamiento_id: entrenamientoId, p_asistencia_estado: estado, p_motivo: null, p_marcado_por: auditorId || null });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data?.error || "No se pudo marcar.");
      const consumeSesion = estado === "asistio" || estado === "no_asistio_sin_aviso";
      const rowAnterior = entrenamientosPlan.find((r) => r.id === entrenamientoId);
      const consumiaAntes = rowAnterior?.consume_sesion === true;
      const delta = consumiaAntes === consumeSesion ? 0 : consumeSesion ? 1 : -1;
      setEntrenamientosPlan((prev) => prev.map((r) => r.id === entrenamientoId ? { ...r, asistencia_estado: estado, aviso_previo: estado === "no_asistio_aviso", consume_sesion: consumeSesion, reprogramable: estado === "no_asistio_aviso", fecha_asistencia: new Date().toISOString(), marcado_por: auditorId || r.marcado_por || null, estado: estado === "asistio" ? "completado" : "no_asistio" } : r));
      if (rowAnterior?.cliente_plan_id && delta !== 0) {
        setClientesPlanes((prev) => prev.map((p) => {
          if (p.id !== rowAnterior.cliente_plan_id) return p;
          const t = Number(p.sesiones_totales || 0);
          const u = Math.min(t, Math.max(0, Number(p.sesiones_usadas || 0) + delta));
          return { ...p, sesiones_usadas: u, estado: t > 0 && u >= t ? "agotado" : p.estado === "agotado" && u < t ? "activo" : p.estado };
        }));
      }
      showAlert("success", "Listo", estado === "no_asistio_aviso" ? "Sesión congelada." : "Asistencia registrada.");
    } catch (err: any) { showAlert("error", "Error", err?.message); }
    finally { setSavingAsistenciaId(null); }
  }

  async function marcarAsistenciaEmpleado(empleadoId: string, estado: "asistio" | "no_asistio" | "permiso" | "reposo" | "vacaciones") {
    setSavingEmpleadoAsistenciaId(empleadoId);
    try {
      let auditorId = empleadoActualId || await resolveEmpleadoActualId();
      if (!empleadoActualId && auditorId) setEmpleadoActualId(auditorId);
      const existente = empleadosAsistencia.find((a) => a.empleado_id === empleadoId && a.fecha === asistenciaFilterFecha);
      if (existente) {
        const { error } = await supabase.from("empleados_asistencia").update({ estado, observaciones: null, updated_by: auditorId || null }).eq("id", existente.id);
        if (error) throw error;
        setEmpleadosAsistencia((prev) => prev.map((r) => r.id === existente.id ? { ...r, estado, updated_by: auditorId || null, updated_at: new Date().toISOString() } : r));
      } else {
        const { data, error } = await supabase.from("empleados_asistencia").insert({ empleado_id: empleadoId, fecha: asistenciaFilterFecha, estado, observaciones: null, created_by: auditorId || null, updated_by: auditorId || null }).select(`id,empleado_id,fecha,estado,observaciones,created_at,updated_at,created_by,updated_by,empleados:empleado_id(nombre,rol),actualizado_por:updated_by(id,nombre)`).single();
        if (error) throw error;
        setEmpleadosAsistencia((prev) => [data as unknown as EmpleadoAsistenciaRow, ...prev]);
      }
      showAlert("success", "Listo", "Asistencia actualizada.");
    } catch (err: any) { showAlert("error", "Error", err?.message); }
    finally { setSavingEmpleadoAsistenciaId(null); }
  }

  async function loadPagosDetalle(desde = ingresosRangoDesde, hasta = ingresosRangoHasta) {
    if (loadingPagosDetalle) return;
    setLoadingPagosDetalle(true);
    try {
      const { data, error } = await supabase.from("pagos").select(`id,fecha,concepto,monto,monto_equivalente_usd,moneda_pago,estado,created_at,clientes:cliente_id(nombre),metodo_pago_principal:metodo_pago_id(nombre),metodo_pago_v2:metodo_pago_v2_id(nombre)`).eq("estado", "pagado").gte("fecha", desde).lte("fecha", hasta).order("fecha", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      const rows = ((data || []) as any[]).map((r) => ({ id: r.id, fecha: r.fecha, concepto: r.concepto, monto: r.monto, monto_equivalente_usd: r.monto_equivalente_usd, moneda_pago: r.moneda_pago, estado: r.estado, cliente_nombre: firstOrNull(r.clientes)?.nombre || null, metodo_nombre: firstOrNull(r.metodo_pago_principal)?.nombre || firstOrNull(r.metodo_pago_v2)?.nombre || null }));
      setPagosDetalle(rows);
      const now = new Date();
      const mesDesde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const mesHasta = getDateKey(now);
      if (desde === mesDesde && hasta === mesHasta) setPagos(rows.map((r) => ({ id: r.id, fecha: r.fecha, monto: r.monto, monto_equivalente_usd: r.monto_equivalente_usd, estado: r.estado })));
    } catch (err: any) { showAlert("error", "Error", err?.message); }
    finally { setLoadingPagosDetalle(false); }
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
            alert.type === "error" ? "border-rose-400/30 bg-rose-950/80 text-rose-300"
              : alert.type === "success" ? "border-emerald-400/30 bg-emerald-950/80 text-emerald-300"
              : alert.type === "warning" ? "border-amber-400/30 bg-amber-950/80 text-amber-300"
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
          <p className="text-[11px] font-medium uppercase tracking-widest text-white/30">Administración</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-white/35">
            {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* Quick actions */}
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
          onClick={() => { setPanelOpen("ingresos"); void loadPagosDetalle(); }}
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
          accent={stats.sesionesPlanPendientes > 0 ? "text-amber-400" : "text-white/60"}
          onClick={() => setPanelOpen("sesiones")}
          active={panelOpen === "sesiones"}
        />
      </div>

      {/* ── Date filter bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-white/30">Fecha de referencia:</p>
        <input
          type="date"
          value={asistenciaFilterFecha}
          onChange={(e) => { setAsistenciaFilterFecha(e.target.value); setCitasHoyPage(1); setSesionesPlanPage(1); setEmpleadosAsistenciaPage(1); }}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white outline-none focus:border-white/20"
        />
        {asistenciaFilterFecha !== hoy && (
          <button
            type="button"
            onClick={() => setAsistenciaFilterFecha(hoy)}
            className="text-xs text-white/40 underline underline-offset-2 transition hover:text-white/70"
          >
            Volver a hoy
          </button>
        )}
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
                onChange={(e) => { setFiltroCitasHoy(e.target.value); setCitasHoyPage(1); }}
                placeholder="Buscar…"
                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15"
              />
              <GhostBtn onClick={() => setPanelOpen("citas")}>
                {citasHoyFiltradas.length} ver
              </GhostBtn>
            </div>

            {citasHoyFiltradas.length === 0 ? (
              <p className="py-3 text-center text-xs text-white/30">Sin citas</p>
            ) : citasPage.map((cita) => {
              const completada = (cita.estado || "").toLowerCase() === "completada";
              return (
                <RowItem
                  key={cita.id}
                  dot={citaDot(cita.estado)}
                  left={
                    <div>
                      <p className="truncate text-sm font-medium text-white">{getCitaCliente(cita)}</p>
                      <p className="truncate text-[11px] text-white/40">{formatTime(getCitaHoraInicio(cita))} · {getCitaServicio(cita)}</p>
                    </div>
                  }
                  right={
                    <button
                      type="button"
                      disabled={savingCitaId === cita.id || completada}
                      onClick={() => void marcarCitaCompletada(cita.id)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${completada ? "text-emerald-400/60" : "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15"}`}
                    >
                      {completada ? "✓" : savingCitaId === cita.id ? "…" : "Completar"}
                    </button>
                  }
                />
              );
            })}

            {citasHoyFiltradas.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-white/25">{citasHoyPage}/{totalPagesCitas}</p>
                <div className="flex gap-1">
                  <GhostBtn onClick={() => setCitasHoyPage((p) => Math.max(p - 1, 1))} disabled={citasHoyPage <= 1}>←</GhostBtn>
                  <GhostBtn onClick={() => setCitasHoyPage((p) => Math.min(p + 1, totalPagesCitas))} disabled={citasHoyPage >= totalPagesCitas}>→</GhostBtn>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Col 2 — Sesiones plan */}
        <div>
          <SectionLabel>Sesiones de plan</SectionLabel>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 pb-1">
              <input
                type="text"
                value={filtroSesionesPlan}
                onChange={(e) => { setFiltroSesionesPlan(e.target.value); setSesionesPlanPage(1); }}
                placeholder="Buscar…"
                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15"
              />
              <div className="flex shrink-0 gap-1.5 text-[11px]">
                <span className="flex items-center gap-1 text-white/35"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{sesionesPlanHoyFiltradas.filter((x) => (x.asistencia_estado || "pendiente") === "pendiente").length}</span>
                <span className="flex items-center gap-1 text-white/35"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{sesionesPlanHoyFiltradas.filter((x) => x.asistencia_estado === "asistio").length}</span>
              </div>
            </div>

            {sesionesPlanHoyFiltradas.length === 0 ? (
              <p className="py-3 text-center text-xs text-white/30">Sin sesiones</p>
            ) : sesionesPage.map((row) => {
              const cliente = firstOrNull(row.clientes);
              const empleado = firstOrNull(row.empleados);
              const cp = firstOrNull(row.clientes_planes);
              const plan = firstOrNull(cp?.planes);
              const open = openSesionPlanId === row.id;

              return (
                <div key={row.id} className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <RowItem
                    dot={asistenciaPlanDot(row.asistencia_estado)}
                    onClick={() => setOpenSesionPlanId(open ? null : row.id)}
                    left={
                      <div>
                        <p className="truncate text-sm font-medium text-white">{cliente?.nombre || "Cliente"}</p>
                        <p className="truncate text-[11px] text-white/40">{formatTime(row.hora_inicio)} · {asistenciaLabel(row.asistencia_estado)}</p>
                      </div>
                    }
                    right={<span className="text-[10px] text-white/25">{open ? "−" : "+"}</span>}
                  />
                  {open && (
                    <div className="border-t border-white/[0.06] px-3 pb-3 pt-2">
                      <p className="mb-2 text-[11px] text-white/40">{empleado?.nombre} · {roleLabel(empleado?.rol)} · <span className="text-violet-400/70">{plan?.nombre}</span></p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(["asistio", "no_asistio_aviso", "no_asistio_sin_aviso"] as const).map((estado) => {
                          const labels = { asistio: "Asistió", no_asistio_aviso: "Avisó", no_asistio_sin_aviso: "Sin aviso" };
                          const colors = { asistio: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15", no_asistio_aviso: "border-amber-400/20 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15", no_asistio_sin_aviso: "border-rose-400/20 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15" };
                          return (
                            <button key={estado} type="button" disabled={savingAsistenciaId === row.id} onClick={() => void marcarAsistenciaPlan(row.id, estado)} className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition disabled:opacity-50 ${colors[estado]}`}>
                              {labels[estado]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {sesionesPlanHoyFiltradas.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-white/25">{sesionesPlanPage}/{totalPagesSesiones}</p>
                <div className="flex gap-1">
                  <GhostBtn onClick={() => setSesionesPlanPage((p) => Math.max(p - 1, 1))} disabled={sesionesPlanPage <= 1}>←</GhostBtn>
                  <GhostBtn onClick={() => setSesionesPlanPage((p) => Math.min(p + 1, totalPagesSesiones))} disabled={sesionesPlanPage >= totalPagesSesiones}>→</GhostBtn>
                </div>
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
                onChange={(e) => { setFiltroAsistenciaPersonal(e.target.value); setEmpleadosAsistenciaPage(1); }}
                placeholder="Buscar…"
                className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15"
              />
            </div>

            {empleadosActivosNoAdmin.length === 0 ? (
              <p className="py-3 text-center text-xs text-white/30">Sin personal</p>
            ) : empleadosPage.map((emp) => {
              const registro = mapaAsistenciaPersonalHoy.get(emp.id);
              const open = openEmpleadoAsistenciaId === emp.id;

              return (
                <div key={emp.id} className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <RowItem
                    dot={asistenciaPersonalDot(registro?.estado)}
                    onClick={() => setOpenEmpleadoAsistenciaId(open ? null : emp.id)}
                    left={
                      <div>
                        <p className="truncate text-sm font-medium text-white">{emp.nombre}</p>
                        <p className="truncate text-[11px] text-white/40">{roleLabel(emp.rol)} · {asistenciaPersonalLabel(registro?.estado)}</p>
                      </div>
                    }
                    right={<span className="text-[10px] text-white/25">{open ? "−" : "+"}</span>}
                  />
                  {open && (
                    <div className="border-t border-white/[0.06] px-3 pb-3 pt-2">
                      <div className="grid grid-cols-5 gap-1.5">
                        {([
                          { k: "asistio", l: "✓", c: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" },
                          { k: "permiso", l: "P", c: "border-amber-400/20 bg-amber-400/10 text-amber-300" },
                          { k: "no_asistio", l: "✕", c: "border-rose-400/20 bg-rose-400/10 text-rose-300" },
                          { k: "reposo", l: "R", c: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-300" },
                          { k: "vacaciones", l: "V", c: "border-sky-400/20 bg-sky-400/10 text-sky-300" },
                        ] as const).map(({ k, l, c }) => (
                          <button key={k} type="button" disabled={savingEmpleadoAsistenciaId === emp.id} onClick={() => void marcarAsistenciaEmpleado(emp.id, k as any)} className={`rounded-lg border py-2 text-xs font-bold transition disabled:opacity-50 ${c}`}>{l}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {empleadosActivosNoAdmin.length > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-white/25">{empleadosAsistenciaPage}/{totalPagesEmpleados}</p>
                <div className="flex gap-1">
                  <GhostBtn onClick={() => setEmpleadosAsistenciaPage((p) => Math.max(p - 1, 1))} disabled={empleadosAsistenciaPage <= 1}>←</GhostBtn>
                  <GhostBtn onClick={() => setEmpleadosAsistenciaPage((p) => Math.min(p + 1, totalPagesEmpleados))} disabled={empleadosAsistenciaPage >= totalPagesEmpleados}>→</GhostBtn>
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
                  <p className="truncate text-sm font-medium text-white">{row.cliente_nombre}</p>
                  <p className="truncate text-[11px] text-white/40">{row.razones[0]?.concepto}</p>
                </div>
                <PillBadge color="rose">{money(row.saldo_pendiente_neto_usd)}</PillBadge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════ SLIDE PANELS ════ */}

      {/* Panel — Citas detalle */}
      <SlidePanel open={panelOpen === "citas"} onClose={() => setPanelOpen(null)} title={`Citas · ${asistenciaFilterFecha}`}>
        <div className="space-y-3">
          <input type="text" value={filtroCitasHoy} onChange={(e) => setFiltroCitasHoy(e.target.value)} placeholder="Buscar cliente, terapeuta…" className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15" />
          <Divider />
          {citasHoyFiltradas.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/30">Sin citas para este día</p>
          ) : citasHoyFiltradas.map((cita) => {
            const completada = (cita.estado || "").toLowerCase() === "completada";
            return (
              <div key={cita.id} className="flex items-start gap-3">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${citaDot(cita.estado)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white">{getCitaCliente(cita)}</p>
                  <p className="text-[11px] text-white/40">{formatTime(getCitaHoraInicio(cita))} – {formatTime(getCitaHoraFin(cita))} · {getCitaServicio(cita)}</p>
                  <p className="text-[11px] text-white/30">{getCitaEmpleado(cita)} · {citaEstadoLabel(cita.estado)}</p>
                </div>
                <button type="button" disabled={savingCitaId === cita.id || completada} onClick={() => void marcarCitaCompletada(cita.id)} className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${completada ? "text-emerald-400/60" : "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15"}`}>
                  {completada ? "✓" : savingCitaId === cita.id ? "…" : "Completar"}
                </button>
              </div>
            );
          })}
        </div>
      </SlidePanel>

      {/* Panel — Sesiones detalle */}
      <SlidePanel open={panelOpen === "sesiones"} onClose={() => setPanelOpen(null)} title="Sesiones de plan">
        <div className="space-y-3">
          <input type="text" value={filtroSesionesPlan} onChange={(e) => setFiltroSesionesPlan(e.target.value)} placeholder="Buscar…" className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15" />
          <Divider />
          {sesionesPlanHoyFiltradas.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/30">Sin sesiones</p>
          ) : sesionesPlanHoyFiltradas.map((row) => {
            const cliente = firstOrNull(row.clientes);
            const empleado = firstOrNull(row.empleados);
            const cp = firstOrNull(row.clientes_planes);
            const plan = firstOrNull(cp?.planes);
            const open = openSesionPlanId === row.id;
            return (
              <div key={row.id} className="overflow-hidden rounded-xl border border-white/[0.06]">
                <button type="button" onClick={() => setOpenSesionPlanId(open ? null : row.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.03]">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${asistenciaPlanDot(row.asistencia_estado)}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{cliente?.nombre}</p>
                    <p className="text-[11px] text-white/40">{formatTime(row.hora_inicio)} · {plan?.nombre} · {asistenciaLabel(row.asistencia_estado)}</p>
                  </div>
                  <span className="text-[10px] text-white/25">{open ? "−" : "+"}</span>
                </button>
                {open && (
                  <div className="border-t border-white/[0.06] px-3 pb-3 pt-2">
                    <p className="mb-2 text-[11px] text-white/40">{empleado?.nombre} · {roleLabel(empleado?.rol)}</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["asistio", "no_asistio_aviso", "no_asistio_sin_aviso"] as const).map((estado) => {
                        const labels = { asistio: "Asistió", no_asistio_aviso: "Avisó", no_asistio_sin_aviso: "Sin aviso" };
                        const colors = { asistio: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15", no_asistio_aviso: "border-amber-400/20 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15", no_asistio_sin_aviso: "border-rose-400/20 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15" };
                        return <button key={estado} type="button" disabled={savingAsistenciaId === row.id} onClick={() => void marcarAsistenciaPlan(row.id, estado)} className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition disabled:opacity-50 ${colors[estado]}`}>{labels[estado]}</button>;
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SlidePanel>

      {/* Panel — Personal */}
      <SlidePanel open={panelOpen === "personal"} onClose={() => setPanelOpen(null)} title="Asistencia personal">
        <div className="space-y-3">
          <input type="text" value={filtroAsistenciaPersonal} onChange={(e) => setFiltroAsistenciaPersonal(e.target.value)} placeholder="Buscar empleado…" className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15" />
          <Divider />
          {empleadosActivosNoAdmin.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/30">Sin personal</p>
          ) : empleadosActivosNoAdmin.map((emp) => {
            const registro = mapaAsistenciaPersonalHoy.get(emp.id);
            const open = openEmpleadoAsistenciaId === emp.id;
            return (
              <div key={emp.id} className="overflow-hidden rounded-xl border border-white/[0.06]">
                <button type="button" onClick={() => setOpenEmpleadoAsistenciaId(open ? null : emp.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.03]">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${asistenciaPersonalDot(registro?.estado)}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{emp.nombre}</p>
                    <p className="text-[11px] text-white/40">{roleLabel(emp.rol)} · {asistenciaPersonalLabel(registro?.estado)}</p>
                  </div>
                  <span className="text-[10px] text-white/25">{open ? "−" : "+"}</span>
                </button>
                {open && (
                  <div className="border-t border-white/[0.06] px-3 pb-3 pt-2">
                    <div className="grid grid-cols-5 gap-1.5">
                      {([
                        { k: "asistio", l: "✓", c: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" },
                        { k: "permiso", l: "P", c: "border-amber-400/20 bg-amber-400/10 text-amber-300" },
                        { k: "no_asistio", l: "✕", c: "border-rose-400/20 bg-rose-400/10 text-rose-300" },
                        { k: "reposo", l: "R", c: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-300" },
                        { k: "vacaciones", l: "V", c: "border-sky-400/20 bg-sky-400/10 text-sky-300" },
                      ] as const).map(({ k, l, c }) => (
                        <button key={k} type="button" disabled={savingEmpleadoAsistenciaId === emp.id} onClick={() => void marcarAsistenciaEmpleado(emp.id, k as any)} className={`rounded-lg border py-2 text-xs font-bold transition disabled:opacity-50 ${c}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SlidePanel>

      {/* Panel — Planes activos */}
      <SlidePanel open={panelOpen === "planes"} onClose={() => setPanelOpen(null)} title="Planes activos">
        <div className="space-y-3">
          <input type="text" value={filtroPlanActivo} onChange={(e) => setFiltroPlanActivo(e.target.value)} placeholder="Buscar cliente, plan…" className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15" />
          <p className="text-[11px] text-white/25">{planesActivosDetalle.length} planes</p>
          <Divider />
          {planesActivosDetalle.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/30">Sin planes activos</p>
          ) : planesPageData.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{item.cliente_nombre}</p>
                <p className="truncate text-[11px] text-violet-400/70">{item.plan_nombre}</p>
                <p className="text-[11px] text-white/30">Vence {formatDate(item.fecha_fin)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <PillBadge color="violet">{item.sesiones_disponibles}/{item.sesiones_totales}</PillBadge>
                {item.cliente_id && <Link href={`/admin/personas/clientes/${item.cliente_id}`} className="text-[11px] text-white/30 underline underline-offset-2 transition hover:text-white/60">Ver</Link>}
              </div>
            </div>
          ))}
          {planesActivosDetalle.length > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-[11px] text-white/25">{planesPage}/{totalPagesPlanes}</p>
              <div className="flex gap-1">
                <GhostBtn onClick={() => setPlanesPage((p) => Math.max(p - 1, 1))} disabled={planesPage <= 1}>←</GhostBtn>
                <GhostBtn onClick={() => setPlanesPage((p) => Math.min(p + 1, totalPagesPlanes))} disabled={planesPage >= totalPagesPlanes}>→</GhostBtn>
              </div>
            </div>
          )}
        </div>
      </SlidePanel>

      {/* Panel — Saldos */}
      <SlidePanel open={panelOpen === "saldos"} onClose={() => setPanelOpen(null)} title="Saldos pendientes">
        <div className="space-y-3">
          {clientesConSaldoPendiente.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/30">Sin deudas registradas</p>
          ) : clientesConSaldoPendiente.map((row) => (
            <div key={row.cliente_id} className="rounded-xl border border-white/[0.06] px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{row.cliente_nombre}</p>
                  <p className="mt-0.5 text-[11px] text-white/35">{row.razones.length} concepto(s)</p>
                </div>
                <PillBadge color="rose">{money(row.saldo_pendiente_neto_usd)}</PillBadge>
              </div>
              {row.razones.slice(0, 2).map((r) => (
                <div key={r.id} className="mt-2 flex items-start justify-between gap-2">
                  <p className="text-[11px] text-white/45">{r.concepto}</p>
                  <p className="shrink-0 text-[11px] text-white/30">{formatDate(r.fecha)}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </SlidePanel>

      {/* Panel — Ingresos */}
      <SlidePanel open={panelOpen === "ingresos"} onClose={() => setPanelOpen(null)} title="Detalle de ingresos">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Hoy", desde: hoy, hasta: hoy },
              { label: "Esta semana", desde: (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return getDateKey(d); })(), hasta: hoy },
              { label: "Este mes", desde: ingresosRangoDesde, hasta: hoy },
              { label: "Mes anterior", desde: (() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return getDateKey(d); })(), hasta: (() => { const d = new Date(); d.setDate(0); return getDateKey(d); })() },
            ].map((p) => (
              <button key={p.label} type="button" onClick={() => { setIngresosRangoDesde(p.desde); setIngresosRangoHasta(p.hasta); void loadPagosDetalle(p.desde, p.hasta); }} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/55 transition hover:bg-white/[0.07] hover:text-white/80">
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <p className="mb-1 text-[10px] text-white/30">Desde</p>
              <input type="date" value={ingresosRangoDesde} onChange={(e) => setIngresosRangoDesde(e.target.value)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none" />
            </div>
            <div>
              <p className="mb-1 text-[10px] text-white/30">Hasta</p>
              <input type="date" value={ingresosRangoHasta} onChange={(e) => setIngresosRangoHasta(e.target.value)} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none" />
            </div>
            <GhostBtn onClick={() => void loadPagosDetalle()} disabled={loadingPagosDetalle}>
              {loadingPagosDetalle ? "…" : "Aplicar"}
            </GhostBtn>
          </div>

          {pagosDetalle.length > 0 && (
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-4 py-3">
              <p className="text-xs text-white/40">{pagosDetalle.length} pago(s)</p>
              <p className="text-xl font-bold text-emerald-400">
                {money(pagosDetalle.reduce((acc, p) => acc + Number(p.monto_equivalente_usd || p.monto || 0), 0))}
              </p>
            </div>
          )}

          <Divider />

          {loadingPagosDetalle ? (
            <p className="py-4 text-center text-sm text-white/30">Cargando…</p>
          ) : pagosDetalle.length === 0 ? (
            <p className="py-4 text-center text-sm text-white/30">Sin pagos en ese rango</p>
          ) : pagosDetalle.map((pago) => (
            <div key={pago.id} className="flex items-start justify-between gap-3 py-1.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{pago.cliente_nombre || <span className="text-white/30">Sin cliente</span>}</p>
                <p className="truncate text-[11px] text-white/40">{pago.concepto || "—"} · {pago.metodo_nombre || pago.moneda_pago || "—"}</p>
                <p className="text-[11px] text-white/25">{formatDate(pago.fecha)}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold text-emerald-400">{money(pago.monto_equivalente_usd || pago.monto)}</p>
            </div>
          ))}
        </div>
      </SlidePanel>

    </div>
  );
}