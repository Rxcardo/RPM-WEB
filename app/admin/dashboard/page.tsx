"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";
import StatCard from "@/components/ui/StatCard";
import ActionCard from "@/components/ui/ActionCard";
import Link from "next/link";

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
  actualizado_por?: {
    id: string;
    nombre: string | null;
  } | null;
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

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function sameMonth(dateStr: string | null | undefined, today: Date) {
  if (!dateStr) return false;

  // IMPORTANTE: no usar new Date('YYYY-MM-DD') para comparar meses.
  // JS lo interpreta como UTC y en zonas horarias como USA puede mover
  // el 01/05 a 30/04 localmente. Eso hacía que el StatCard de
  // "Ingresos del mes" excluyera pagos del día 1 y no coincidiera
  // con el panel filtrado por rango.
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const valueMonthKey = String(dateStr).slice(0, 7);

  return valueMonthKey === currentMonthKey;
}

function sameDay(dateStr: string | null | undefined, todayStr: string) {
  if (!dateStr) return false;
  return dateStr === todayStr;
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function addMinutesToTime(timeStr: string | null | undefined, minutes: number) {
  if (!timeStr) return "";
  const [h, m] = String(timeStr).slice(0, 5).split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function asistenciaPlanDotClass(estado: string | null | undefined) {
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
      return "bg-white/30";
  }
}

function asistenciaPersonalDotClass(estado: string | null | undefined) {
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
      return "bg-white/30";
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
  return (
    cliente?.nombre || cita.cliente_nombre || cita.nombre_cliente || "Cliente"
  );
}

function getCitaEmpleado(cita: CitaRaw) {
  const empleado = firstOrNull(
    cita.empleados || cita.terapeuta || cita.personal || null,
  );
  return (
    empleado?.nombre ||
    cita.empleado_nombre ||
    cita.terapeuta_nombre ||
    cita.personal_nombre ||
    "Personal"
  );
}

function getCitaServicio(cita: CitaRaw) {
  const servicio = firstOrNull(cita.servicios || cita.servicio || null);
  return (
    servicio?.nombre || cita.servicio_nombre || cita.tipo_servicio || "Servicio"
  );
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

function citaDotClass(estado: string | null | undefined) {
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
      return "bg-white/30";
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getEstadoCuentaLabel(estado: EstadoCuentaCliente | null | undefined) {
  const pendiente = Number(estado?.saldo_pendiente_neto_usd || 0);
  const credito = Number(estado?.saldo_favor_neto_usd || 0);

  if (pendiente > 0.009) return `Debe ${money(pendiente)}`;
  if (credito > 0.009) return `Saldo a favor ${money(credito)}`;
  return "Al día";
}

function getEstadoCuentaClass(estado: EstadoCuentaCliente | null | undefined) {
  const pendiente = Number(estado?.saldo_pendiente_neto_usd || 0);
  const credito = Number(estado?.saldo_favor_neto_usd || 0);

  if (pendiente > 0.009)
    return "border-rose-400/20 bg-rose-400/10 text-rose-300";
  if (credito > 0.009)
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  return "border-white/10 bg-white/[0.03] text-white/70";
}

function getEstadoCuentaDetalle(
  estado: EstadoCuentaCliente | null | undefined,
) {
  const pendiente = Number(estado?.saldo_pendiente_neto_usd || 0);
  const credito = Number(estado?.saldo_favor_neto_usd || 0);
  const deudaTotal = Number(estado?.total_pendiente_usd || 0);
  const creditoDisponible = Number(estado?.credito_disponible_usd || 0);

  if (pendiente > 0.009) {
    return `Pendiente neto ${money(pendiente)} · Deuda total ${money(deudaTotal)}`;
  }

  if (credito > 0.009) {
    return `Crédito disponible ${money(creditoDisponible || credito)}`;
  }

  return "Sin deuda pendiente";
}

function truncateText(value: string | null | undefined, max = 90) {
  const text = (value || "").trim();
  if (!text) return "Sin concepto";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`;

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

  const [empleadoActualId, setEmpleadoActualId] = useState<string>("");

  const [asistenciaFilterFecha, setAsistenciaFilterFecha] = useState(
    getDateKey(new Date()),
  );
  const [mostrarCitasHoy, setMostrarCitasHoy] = useState(false);
  const [mostrarSesionesPlanHoy, setMostrarSesionesPlanHoy] = useState(false);
  const [mostrarAsistenciaPersonalHoy, setMostrarAsistenciaPersonalHoy] =
    useState(false);
  const [mostrarSaldosPendientes, setMostrarSaldosPendientes] = useState(false);
  const [filtroCitasHoy, setFiltroCitasHoy] = useState("");
  const [filtroSesionesPlan, setFiltroSesionesPlan] = useState("");
  const [filtroAsistenciaPersonal, setFiltroAsistenciaPersonal] = useState("");
  const [savingCitaId, setSavingCitaId] = useState<string | null>(null);
  const [citasHoyPage, setCitasHoyPage] = useState(1);
  const [savingAsistenciaId, setSavingAsistenciaId] = useState<string | null>(
    null,
  );
  const [openReprogramacionId, setOpenReprogramacionId] = useState<
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
  const [savingEmpleadoAsistenciaId, setSavingEmpleadoAsistenciaId] = useState<
    string | null
  >(null);
  const [sesionesPlanPage, setSesionesPlanPage] = useState(1);
  const [empleadosAsistenciaPage, setEmpleadosAsistenciaPage] = useState(1);
  const [mostrarPlanesActivos, setMostrarPlanesActivos] = useState(false);
  const [filtroPlanActivo, setFiltroPlanActivo] = useState("");
  const [mostrarIngresosDetalle, setMostrarIngresosDetalle] = useState(false);
  const [ingresosRangoDesde, setIngresosRangoDesde] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [ingresosRangoHasta, setIngresosRangoHasta] = useState(
    getDateKey(new Date()),
  );
  const [pagosDetalle, setPagosDetalle] = useState<PagoDetalle[]>([]);
  const [loadingPagosDetalle, setLoadingPagosDetalle] = useState(false);

  const PAGE_SIZE = 10;

  useEffect(() => {
    void loadDashboard();
    void loadEmpleadoActual();
  }, []);

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

      if (!errorPorAuth && empleadoPorAuth?.id) {
        return String(empleadoPorAuth.id);
      }

      const { data: empleadoPorId, error: errorPorId } = await supabase
        .from("empleados")
        .select("id, nombre")
        .eq("id", authUserId)
        .maybeSingle();

      if (!errorPorId && empleadoPorId?.id) {
        return String(empleadoPorId.id);
      }

      return "";
    } catch {
      return "";
    }
  }

  async function loadEmpleadoActual() {
    const empleadoId = await resolveEmpleadoActualId();
    setEmpleadoActualId(empleadoId);
  }

  function showAlert(type: AlertType, title: string, message: string) {
    setAlert({ type, title, message });
  }

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      // Importante: el total de "Ingresos del mes" debe salir del mismo rango
      // que el detalle mensual. Si no filtramos aquí, Supabase puede traer una
      // muestra distinta o datos viejos y el StatCard no coincide con la tabla.
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
      ] = await Promise.all([
        supabase.from("clientes").select("id, estado, created_at"),
        supabase.from("citas").select(`
            *,
            clientes:cliente_id ( nombre, telefono, email ),
            empleados:terapeuta_id ( nombre, rol ),
            servicios:servicio_id ( nombre )
          `),
        supabase
          .from("pagos")
          .select("id, fecha, monto, monto_equivalente_usd, estado")
          .eq("estado", "pagado")
          .gte("fecha", mesDesde)
          .lte("fecha", mesHasta)
          .order("fecha", { ascending: false }),
        supabase.from("empleados").select("id, nombre, estado, rol"),
        supabase.from("clientes_planes").select(`
            id,
            cliente_id,
            plan_id,
            fecha_inicio,
            fecha_fin,
            estado,
            sesiones_totales,
            sesiones_usadas,
            clientes:cliente_id ( nombre, telefono, email ),
            planes:plan_id ( nombre )
          `),
        supabase
          .from("entrenamientos")
          .select(
            `
            id,
            cliente_plan_id,
            cliente_id,
            empleado_id,
            recurso_id,
            fecha,
            hora_inicio,
            hora_fin,
            estado,
            asistencia_estado,
            aviso_previo,
            consume_sesion,
            reprogramable,
            motivo_asistencia,
            fecha_asistencia,
            reprogramado_de_entrenamiento_id,
            marcado_por,
            actualizado_por:marcado_por ( id, nombre ),
            clientes:cliente_id ( nombre ),
            empleados:empleado_id ( nombre, rol ),
            clientes_planes:cliente_plan_id (
              id,
              fecha_fin,
              estado,
              planes:plan_id ( nombre )
            )
          `,
          )
          .not("cliente_plan_id", "is", null)
          .neq("estado", "cancelado")
          .order("fecha", { ascending: true })
          .order("hora_inicio", { ascending: true }),
        supabase
          .from("empleados_asistencia")
          .select(
            `
            id,
            empleado_id,
            fecha,
            estado,
            observaciones,
            created_at,
            updated_at,
            created_by,
            updated_by,
            empleados:empleado_id ( nombre, rol ),
            actualizado_por:updated_by ( id, nombre )
          `,
          )
          .order("fecha", { ascending: false }),
        supabase.from("v_clientes_estado_cuenta").select(`
            cliente_id,
            total_pendiente_usd,
            credito_disponible_usd,
            saldo_pendiente_neto_usd,
            saldo_favor_neto_usd
          `),
        supabase
          .from("cuentas_por_cobrar")
          .select(
            `
            id,
            cliente_id,
            cliente_nombre,
            concepto,
            saldo_usd,
            estado,
            fecha_venta,
            created_at,
            notas
          `,
          )
          .gt("saldo_usd", 0)
          .neq("estado", "pagado")
          .order("created_at", { ascending: false }),
      ]);

      if (clientesRes.error) throw new Error(clientesRes.error.message);
      if (citasRes.error) throw new Error(citasRes.error.message);
      if (pagosRes.error) throw new Error(pagosRes.error.message);
      if (empleadosRes.error) throw new Error(empleadosRes.error.message);
      if (clientesPlanesRes.error)
        throw new Error(clientesPlanesRes.error.message);
      if (entrenamientosPlanRes.error)
        throw new Error(entrenamientosPlanRes.error.message);
      if (empleadosAsistenciaRes.error)
        throw new Error(empleadosAsistenciaRes.error.message);
      if (estadosCuentaRes.error)
        throw new Error(estadosCuentaRes.error.message);
      if (cuentasPorCobrarRes.error)
        throw new Error(cuentasPorCobrarRes.error.message);

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
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "No se pudo cargar el dashboard.");
      setClientes([]);
      setCitas([]);
      setPagos([]);
      setEmpleados([]);
      setClientesPlanes([]);
      setEntrenamientosPlan([]);
      setEmpleadosAsistencia([]);
      setEstadosCuentaClientes([]);
      setCuentasPorCobrar([]);
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
    const canceladasMes = citas.filter(
      (c) =>
        sameMonth(c.fecha, today) && c.estado?.toLowerCase() === "cancelada",
    ).length;

    const ingresosMes = pagos
      .filter(
        (p) =>
          p.estado?.toLowerCase() === "pagado" && sameMonth(p.fecha, today),
      )
      .reduce(
        (acc, pago) =>
          acc + Number(pago.monto_equivalente_usd || pago.monto || 0),
        0,
      );

    const pagosHoy = pagos
      .filter(
        (p) => p.estado?.toLowerCase() === "pagado" && sameDay(p.fecha, hoy),
      )
      .reduce(
        (acc, pago) =>
          acc + Number(pago.monto_equivalente_usd || pago.monto || 0),
        0,
      );

    const personalActivo = empleados.filter(
      (e) => e.estado?.toLowerCase() === "activo",
    ).length;

    const planesPorVencer = clientesPlanes.filter((cp) => {
      if (cp.estado?.toLowerCase() !== "activo" || !cp.fecha_fin) return false;
      const fin = new Date(cp.fecha_fin);
      const diff = fin.getTime() - today.getTime();
      const dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return dias >= 0 && dias <= 7;
    }).length;

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

    return {
      clientesActivos,
      clientesNuevosMes,
      citasHoy,
      programadasHoy,
      completadasMes,
      canceladasMes,
      ingresosMes,
      pagosHoy,
      personalActivo,
      planesPorVencer,
      planesActivos,
      totalSesionesDisponibles,
      sesionesPlanPendientes,
    };
  }, [
    clientes,
    citas,
    pagos,
    empleados,
    clientesPlanes,
    entrenamientosPlan,
    today,
    hoy,
    asistenciaFilterFecha,
  ]);

  const citasHoyFiltradas = useMemo(() => {
    return citas
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
      );
  }, [citas, asistenciaFilterFecha, filtroCitasHoy]);

  const citasHoyTotalPages = useMemo(
    () => Math.max(1, Math.ceil(citasHoyFiltradas.length / PAGE_SIZE)),
    [citasHoyFiltradas.length],
  );

  const citasHoyPaginadas = useMemo(() => {
    const start = (citasHoyPage - 1) * PAGE_SIZE;
    return citasHoyFiltradas.slice(start, start + PAGE_SIZE);
  }, [citasHoyFiltradas, citasHoyPage]);

  const planesActivosDetalle = useMemo(() => {
    return clientesPlanes
      .filter((cp) => (cp.estado || "").toLowerCase() === "activo")
      .map((cp) => {
        const cliente = firstOrNull(cp.clientes);
        const plan = firstOrNull(cp.planes);
        const sesionesTotales = Number(cp.sesiones_totales || 0);
        const sesionesUsadas = Number(cp.sesiones_usadas || 0);
        const sesionesDisponibles = Math.max(
          0,
          sesionesTotales - sesionesUsadas,
        );

        return {
          id: cp.id,
          cliente_id: cp.cliente_id || "",
          cliente_nombre: cliente?.nombre || "Cliente sin nombre",
          cliente_telefono: cliente?.telefono || "",
          cliente_email: cliente?.email || "",
          plan_nombre: plan?.nombre || "Plan sin nombre",
          fecha_inicio: cp.fecha_inicio || null,
          fecha_fin: cp.fecha_fin || null,
          sesiones_totales: sesionesTotales,
          sesiones_usadas: sesionesUsadas,
          sesiones_disponibles: sesionesDisponibles,
        };
      })
      .sort((a, b) => a.cliente_nombre.localeCompare(b.cliente_nombre));
  }, [clientesPlanes]);

  const planesActivosDetalleFiltrados = useMemo(() => {
    const query = filtroPlanActivo.trim().toLowerCase();

    if (!query) return planesActivosDetalle;

    return planesActivosDetalle.filter((item) => {
      const searchable = [
        item.cliente_nombre,
        item.cliente_telefono,
        item.cliente_email,
        item.plan_nombre,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [planesActivosDetalle, filtroPlanActivo]);

  const mapaEstadoCuentaClientes = useMemo(() => {
    const map = new Map<string, EstadoCuentaCliente>();
    estadosCuentaClientes.forEach((row) => {
      if (row?.cliente_id) map.set(String(row.cliente_id), row);
    });
    return map;
  }, [estadosCuentaClientes]);

  const cuentasPorCobrarPorCliente = useMemo(() => {
    const map = new Map<string, CuentaPorCobrar[]>();

    cuentasPorCobrar
      .filter((row) => Number(row.saldo_usd || 0) > 0.009)
      .forEach((row) => {
        if (!row.cliente_id) return;
        const key = String(row.cliente_id);
        const current = map.get(key) || [];
        current.push(row);
        map.set(key, current);
      });

    return map;
  }, [cuentasPorCobrar]);

  const clientesConSaldoPendiente = useMemo(() => {
    const rows = Array.from(cuentasPorCobrarPorCliente.entries()).map(
      ([clienteId, items]) => {
        const estadoCuenta = mapaEstadoCuentaClientes.get(clienteId);
        const saldoPendiente = Number(
          estadoCuenta?.saldo_pendiente_neto_usd || 0,
        );
        const deudaTotal = Number(estadoCuenta?.total_pendiente_usd || 0);
        const nombreFallback =
          items.find((x) => (x.cliente_nombre || "").trim())?.cliente_nombre ||
          "Cliente";

        const razones = items
          .sort(
            (a, b) =>
              new Date(b.created_at || b.fecha_venta || "").getTime() -
              new Date(a.created_at || a.fecha_venta || "").getTime(),
          )
          .map((item) => ({
            id: item.id,
            concepto: truncateText(
              item.concepto || item.notas || "Saldo pendiente",
              120,
            ),
            saldo_usd: Number(item.saldo_usd || 0),
            fecha: item.fecha_venta || item.created_at || null,
            notas: item.notas || null,
          }));

        return {
          cliente_id: clienteId,
          cliente_nombre: nombreFallback,
          saldo_pendiente_neto_usd: saldoPendiente,
          total_pendiente_usd: deudaTotal,
          razones,
        };
      },
    );

    return rows
      .filter(
        (row) => row.saldo_pendiente_neto_usd > 0.009 || row.razones.length > 0,
      )
      .sort((a, b) => b.saldo_pendiente_neto_usd - a.saldo_pendiente_neto_usd)
      .slice(0, 8);
  }, [cuentasPorCobrarPorCliente, mapaEstadoCuentaClientes]);

  const sesionesPlanHoyCompactas = useMemo(() => {
    return entrenamientosPlan.filter((row) => {
      if (row.fecha !== asistenciaFilterFecha) return false;
      if ((row.estado || "").toLowerCase() === "cancelado") return false;
      const cp = firstOrNull(row.clientes_planes);
      if (!cp) return false;
      if ((cp.estado || "").toLowerCase() === "cancelado") return false;
      const cliente = firstOrNull(row.clientes);
      const empleado = firstOrNull(row.empleados);
      const plan = firstOrNull(cp.planes);
      return matchesSearch(filtroSesionesPlan, [
        cliente?.nombre,
        empleado?.nombre,
        empleado?.rol,
        plan?.nombre,
        row.asistencia_estado,
        row.hora_inicio,
      ]);
    });
  }, [entrenamientosPlan, asistenciaFilterFecha, filtroSesionesPlan]);

  const sesionesPlanTotalPages = useMemo(
    () => Math.max(1, Math.ceil(sesionesPlanHoyCompactas.length / PAGE_SIZE)),
    [sesionesPlanHoyCompactas.length],
  );

  const sesionesPlanHoyPaginadas = useMemo(() => {
    const start = (sesionesPlanPage - 1) * PAGE_SIZE;
    return sesionesPlanHoyCompactas.slice(start, start + PAGE_SIZE);
  }, [sesionesPlanHoyCompactas, sesionesPlanPage]);

  const empleadosActivosNoAdmin = useMemo(() => {
    return empleados
      .filter((e) => {
        if (e.estado?.toLowerCase() !== "activo") return false;
        if ((e.rol || "").toLowerCase() === "admin") return false;
        const registro = empleadosAsistencia.find(
          (row) =>
            row.empleado_id === e.id && row.fecha === asistenciaFilterFecha,
        );
        return matchesSearch(filtroAsistenciaPersonal, [
          e.nombre,
          e.rol,
          registro?.estado,
        ]);
      })
      .sort((a, b) => {
        const registroA = empleadosAsistencia.find(
          (row) =>
            row.empleado_id === a.id && row.fecha === asistenciaFilterFecha,
        );
        const registroB = empleadosAsistencia.find(
          (row) =>
            row.empleado_id === b.id && row.fecha === asistenciaFilterFecha,
        );

        const aMarcado = registroA?.estado ? 1 : 0;
        const bMarcado = registroB?.estado ? 1 : 0;

        if (aMarcado !== bMarcado) return aMarcado - bMarcado;
        return String(a.nombre || "").localeCompare(
          String(b.nombre || ""),
          "es",
        );
      });
  }, [
    empleados,
    empleadosAsistencia,
    asistenciaFilterFecha,
    filtroAsistenciaPersonal,
  ]);

  const empleadosAsistenciaTotalPages = useMemo(
    () => Math.max(1, Math.ceil(empleadosActivosNoAdmin.length / PAGE_SIZE)),
    [empleadosActivosNoAdmin.length],
  );

  const empleadosActivosNoAdminPaginados = useMemo(() => {
    const start = (empleadosAsistenciaPage - 1) * PAGE_SIZE;
    return empleadosActivosNoAdmin.slice(start, start + PAGE_SIZE);
  }, [empleadosActivosNoAdmin, empleadosAsistenciaPage]);

  const mapaAsistenciaPersonalHoy = useMemo(() => {
    const map = new Map<string, EmpleadoAsistenciaRow>();
    empleadosAsistencia
      .filter((row) => row.fecha === asistenciaFilterFecha)
      .forEach((row) => map.set(row.empleado_id, row));
    return map;
  }, [empleadosAsistencia, asistenciaFilterFecha]);

  useEffect(() => {
    setCitasHoyPage(1);
    setSesionesPlanPage(1);
    setEmpleadosAsistenciaPage(1);
  }, [
    asistenciaFilterFecha,
    filtroCitasHoy,
    filtroSesionesPlan,
    filtroAsistenciaPersonal,
  ]);

  useEffect(() => {
    if (citasHoyPage > citasHoyTotalPages) {
      setCitasHoyPage(citasHoyTotalPages);
    }
  }, [citasHoyPage, citasHoyTotalPages]);

  useEffect(() => {
    if (sesionesPlanPage > sesionesPlanTotalPages) {
      setSesionesPlanPage(sesionesPlanTotalPages);
    }
  }, [sesionesPlanPage, sesionesPlanTotalPages]);

  useEffect(() => {
    if (empleadosAsistenciaPage > empleadosAsistenciaTotalPages) {
      setEmpleadosAsistenciaPage(empleadosAsistenciaTotalPages);
    }
  }, [empleadosAsistenciaPage, empleadosAsistenciaTotalPages]);

  const alertas = useMemo(() => {
    const items: {
      titulo: string;
      detalle: string;
      tipo: "warning" | "info" | "success";
    }[] = [];

    if (stats.planesPorVencer > 0) {
      items.push({
        titulo: "⚠️ Planes por vencer",
        detalle: `${stats.planesPorVencer} plan(es) vencen en los próximos 7 días.`,
        tipo: "warning",
      });
    }

    if (stats.canceladasMes > 5) {
      items.push({
        titulo: "⚠️ Citas canceladas",
        detalle: `${stats.canceladasMes} cita(s) canceladas este mes.`,
        tipo: "warning",
      });
    }

    if (stats.totalSesionesDisponibles < 20) {
      items.push({
        titulo: "⚠️ Sesiones disponibles bajas",
        detalle: `Solo quedan ${stats.totalSesionesDisponibles} sesiones disponibles en total.`,
        tipo: "warning",
      });
    }

    if (stats.sesionesPlanPendientes > 0) {
      items.push({
        titulo: "📋 Asistencia de planes pendiente",
        detalle: `${stats.sesionesPlanPendientes} sesión(es) del día siguen pendientes.`,
        tipo: "info",
      });
    }

    if (items.length === 0) {
      items.push({
        titulo: "✓ Todo en orden",
        detalle: "No hay alertas críticas por el momento.",
        tipo: "success",
      });
    }

    return items;
  }, [stats]);

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
          `
          id,
          fecha,
          concepto,
          monto,
          monto_equivalente_usd,
          moneda_pago,
          estado,
          created_at,
          clientes:cliente_id ( nombre ),
          metodo_pago_principal:metodo_pago_id ( nombre ),
          metodo_pago_v2:metodo_pago_v2_id ( nombre )
        `,
        )
        .eq("estado", "pagado")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const rows = ((data || []) as any[]).map((row) => ({
        id: row.id,
        fecha: row.fecha,
        concepto: row.concepto,
        monto: row.monto,
        monto_equivalente_usd: row.monto_equivalente_usd,
        moneda_pago: row.moneda_pago,
        estado: row.estado,
        cliente_nombre: firstOrNull(row.clientes)?.nombre || null,
        metodo_nombre:
          firstOrNull(row.metodo_pago_principal)?.nombre ||
          firstOrNull(row.metodo_pago_v2)?.nombre ||
          null,
      }));

      setPagosDetalle(rows);

      // Si el panel está mostrando el mes actual completo, refrescamos también
      // el array usado por el StatCard para que ambos totales coincidan.
      const now = new Date();
      const mesDesde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const mesHasta = getDateKey(now);
      if (desde === mesDesde && hasta === mesHasta) {
        setPagos(
          rows.map((row) => ({
            id: row.id,
            fecha: row.fecha,
            monto: row.monto,
            monto_equivalente_usd: row.monto_equivalente_usd,
            estado: row.estado,
          })),
        );
      }
    } catch (err: any) {
      showAlert(
        "error",
        "Error",
        err?.message || "No se pudo cargar el detalle de ingresos.",
      );
    } finally {
      setLoadingPagosDetalle(false);
    }
  }

  async function marcarCitaCompletada(citaId: string) {
    try {
      setSavingCitaId(citaId);
      setAlert(null);

      const { error } = await supabase
        .from("citas")
        .update({ estado: "completada" })
        .eq("id", citaId);

      if (error) throw new Error(error.message);

      setCitas((prev) =>
        prev.map((cita) =>
          cita.id === citaId
            ? {
                ...cita,
                estado: "completada",
              }
            : cita,
        ),
      );

      showAlert(
        "success",
        "Cita completada",
        "La cita fue marcada como completada correctamente.",
      );
    } catch (err: any) {
      showAlert(
        "error",
        "Error",
        err?.message || "No se pudo completar la cita.",
      );
    } finally {
      setSavingCitaId(null);
    }
  }

  async function copiarNombrePlanActivo(nombre: string) {
    const nombreLimpio = (nombre || "").trim();
    if (!nombreLimpio) return;

    try {
      await navigator.clipboard.writeText(nombreLimpio);
      showAlert(
        "success",
        "Copiado",
        `${nombreLimpio} copiado al portapapeles.`,
      );
    } catch {
      showAlert("warning", "No se pudo copiar", "Copia el nombre manualmente.");
    }
  }

  async function marcarAsistenciaPlan(
    entrenamientoId: string,
    estado: "asistio" | "no_asistio_aviso" | "no_asistio_sin_aviso",
  ) {
    try {
      setSavingAsistenciaId(entrenamientoId);
      setAlert(null);

      let auditorId = empleadoActualId || "";
      if (!auditorId) {
        auditorId = await resolveEmpleadoActualId();
        setEmpleadoActualId(auditorId);
      }

      const { data, error } = await supabase.rpc(
        "marcar_asistencia_entrenamiento_plan",
        {
          p_entrenamiento_id: entrenamientoId,
          p_asistencia_estado: estado,
          p_motivo: null,
          p_marcado_por: auditorId || null,
        },
      );

      if (error) throw new Error(error.message);
      if (data?.ok === false)
        throw new Error(data?.error || "No se pudo marcar la asistencia.");

      const mensaje =
        estado === "no_asistio_aviso"
          ? "Sesión congelada: no consume sesión y queda disponible para reprogramar."
          : estado === "no_asistio_sin_aviso"
            ? "No asistió sin aviso: la sesión fue consumida."
            : "Asistió: la sesión fue consumida.";

      const fechaAsistencia = new Date().toISOString();
      const consumeSesion =
        estado === "asistio" || estado === "no_asistio_sin_aviso";
      const rowAnterior = entrenamientosPlan.find(
        (row) => row.id === entrenamientoId,
      );
      const consumiaAntes = rowAnterior?.consume_sesion === true;
      const deltaSesiones =
        consumiaAntes === consumeSesion ? 0 : consumeSesion ? 1 : -1;

      setEntrenamientosPlan((prev) =>
        prev.map((row) =>
          row.id === entrenamientoId
            ? {
                ...row,
                asistencia_estado: estado,
                aviso_previo: estado === "no_asistio_aviso",
                consume_sesion: consumeSesion,
                reprogramable: estado === "no_asistio_aviso",
                fecha_asistencia: fechaAsistencia,
                marcado_por: auditorId || row.marcado_por || null,
                estado: estado === "asistio" ? "completado" : "no_asistio",
              }
            : row,
        ),
      );

      if (rowAnterior?.cliente_plan_id && deltaSesiones !== 0) {
        setClientesPlanes((prev) =>
          prev.map((plan) => {
            if (plan.id !== rowAnterior.cliente_plan_id) return plan;

            const sesionesTotales = Number(plan.sesiones_totales || 0);
            const sesionesUsadasActuales = Number(plan.sesiones_usadas || 0);
            const sesionesUsadas = Math.min(
              sesionesTotales,
              Math.max(0, sesionesUsadasActuales + deltaSesiones),
            );

            return {
              ...plan,
              sesiones_usadas: sesionesUsadas,
              estado:
                sesionesTotales > 0 && sesionesUsadas >= sesionesTotales
                  ? "agotado"
                  : plan.estado === "agotado" &&
                      sesionesUsadas < sesionesTotales
                    ? "activo"
                    : plan.estado,
            };
          }),
        );
      }

      showAlert("success", "Listo", mensaje);
    } catch (err: any) {
      showAlert(
        "error",
        "Error",
        err?.message || "No se pudo marcar la asistencia.",
      );
    } finally {
      setSavingAsistenciaId(null);
    }
  }

  function initReprogramacionDraft(
    row: EntrenamientoPlanRow,
  ): ReprogramacionDraft {
    return {
      fecha: row.fecha || "",
      hora_inicio: formatTime(row.hora_inicio),
      hora_fin: formatTime(row.hora_fin),
      motivo:
        row.motivo_asistencia || "Reprogramación por inasistencia con aviso",
    };
  }

  function handleOpenReprogramacion(row: EntrenamientoPlanRow) {
    setOpenReprogramacionId((current) => (current === row.id ? null : row.id));
    setReprogramacionDrafts((prev) => {
      if (prev[row.id]) return prev;
      return { ...prev, [row.id]: initReprogramacionDraft(row) };
    });
  }

  async function reprogramarSesion(row: EntrenamientoPlanRow) {
    const draft = reprogramacionDrafts[row.id];
    if (!draft) return;

    if (!draft.fecha || !draft.hora_inicio || !draft.hora_fin) {
      showAlert("warning", "Faltan datos", "Completa fecha y horas.");
      return;
    }

    if (draft.hora_fin <= draft.hora_inicio) {
      showAlert(
        "warning",
        "Horario inválido",
        "La hora final debe ser mayor que la inicial.",
      );
      return;
    }

    const clientePlan = firstOrNull(row.clientes_planes);
    const fechaFinPlan = clientePlan?.fecha_fin || null;

    if (fechaFinPlan && draft.fecha > fechaFinPlan) {
      showAlert(
        "warning",
        "Fuera de vigencia",
        `No puedes reprogramar después del vencimiento del plan (${fechaFinPlan}).`,
      );
      return;
    }

    if (
      (row.asistencia_estado || "").toLowerCase() !== "no_asistio_aviso" ||
      row.reprogramable !== true
    ) {
      showAlert(
        "warning",
        "No disponible",
        "Solo puedes reprogramar sesiones congeladas por inasistencia con aviso.",
      );
      return;
    }

    try {
      setReprogramandoId(row.id);
      setAlert(null);

      let auditorId = empleadoActualId || "";
      if (!auditorId) {
        auditorId = await resolveEmpleadoActualId();
        setEmpleadoActualId(auditorId);
      }

      const horaInicioNormalizada =
        draft.hora_inicio.length === 5
          ? `${draft.hora_inicio}:00`
          : draft.hora_inicio;
      const horaFinNormalizada =
        draft.hora_fin.length === 5 ? `${draft.hora_fin}:00` : draft.hora_fin;

      const { data, error } = await supabase.rpc(
        "reprogramar_entrenamiento_plan",
        {
          p_entrenamiento_id: row.id,
          p_nueva_fecha: draft.fecha,
          p_nueva_hora_inicio: horaInicioNormalizada,
          p_nueva_hora_fin: horaFinNormalizada,
          p_motivo: draft.motivo || null,
          p_marcado_por: auditorId || null,
        },
      );

      if (error) throw new Error(error.message);
      if (data?.ok === false)
        throw new Error(data?.error || "No se pudo reprogramar.");

      const horaInicioNormalizadaLocal = horaInicioNormalizada;
      const horaFinNormalizadaLocal = horaFinNormalizada;

      setEntrenamientosPlan((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? {
                ...item,
                fecha: draft.fecha,
                hora_inicio: horaInicioNormalizadaLocal,
                hora_fin: horaFinNormalizadaLocal,
                estado: "programado",
                asistencia_estado: "pendiente",
                aviso_previo: false,
                consume_sesion: false,
                reprogramable: false,
                motivo_asistencia: draft.motivo || null,
                fecha_asistencia: null,
                marcado_por: auditorId || item.marcado_por || null,
              }
            : item,
        ),
      );

      setReprogramacionDrafts((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      setOpenReprogramacionId(null);
      showAlert(
        "success",
        "Reprogramado",
        "La sesión fue reprogramada correctamente.",
      );
    } catch (err: any) {
      showAlert(
        "error",
        "Error",
        err?.message || "No se pudo reprogramar la sesión.",
      );
    } finally {
      setReprogramandoId(null);
    }
  }

  async function marcarAsistenciaEmpleado(
    empleadoId: string,
    estado: "asistio" | "no_asistio" | "permiso" | "reposo" | "vacaciones",
  ) {
    try {
      setSavingEmpleadoAsistenciaId(empleadoId);
      setAlert(null);

      let auditorId = empleadoActualId || "";
      if (!auditorId) {
        auditorId = await resolveEmpleadoActualId();
        setEmpleadoActualId(auditorId);
      }

      const existente = empleadosAsistencia.find(
        (a) =>
          a.empleado_id === empleadoId && a.fecha === asistenciaFilterFecha,
      );

      const nowIso = new Date().toISOString();

      if (existente) {
        const { error } = await supabase
          .from("empleados_asistencia")
          .update({
            estado,
            observaciones: null,
            updated_by: auditorId || null,
          })
          .eq("id", existente.id);

        if (error) throw new Error(error.message);

        setEmpleadosAsistencia((prev) =>
          prev.map((row) =>
            row.id === existente.id
              ? {
                  ...row,
                  estado,
                  observaciones: null,
                  updated_by: auditorId || null,
                  updated_at: nowIso,
                }
              : row,
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
            `
            id,
            empleado_id,
            fecha,
            estado,
            observaciones,
            created_at,
            updated_at,
            created_by,
            updated_by,
            empleados:empleado_id ( nombre, rol ),
            actualizado_por:updated_by ( id, nombre )
          `,
          )
          .single();

        if (error) throw new Error(error.message);

        setEmpleadosAsistencia((prev) => [
          data as unknown as EmpleadoAsistenciaRow,
          ...prev,
        ]);
      }

      showAlert("success", "Listo", "Asistencia del personal actualizada.");
    } catch (err: any) {
      showAlert(
        "error",
        "Error",
        err?.message || "No se pudo marcar la asistencia del personal.",
      );
    } finally {
      setSavingEmpleadoAsistenciaId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 px-3 pb-4 sm:px-4 md:px-0">
        <div>
          <p className="text-xs text-white/55 sm:text-sm">Administración</p>
          <h1 className="mt-1 text-xl font-semibold text-white sm:text-2xl">
            Dashboard
          </h1>
        </div>

        <Card className="p-4 sm:p-6">
          <p className="text-sm text-white/55 sm:text-base">
            Cargando dashboard...
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-3 pb-4 sm:px-4 md:space-y-6 md:px-0">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-white/55 sm:text-sm">Administración</p>

          <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Dashboard
          </h1>

          <p className="mt-2 text-xs leading-5 text-white/55 sm:text-sm">
            Vista general ·{" "}
            {new Date().toLocaleDateString("es-ES", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ActionCard
            title="Nueva cita"
            description="Registrar una cita."
            href="/admin/operaciones/agenda/nueva"
          />
          <ActionCard
            title="Nuevo cliente"
            description="Crear perfil de cliente."
            href="/admin/personas/clientes/nuevo"
          />
          <ActionCard
            title="Reportes"
            description="Ver reportes financieros."
            href="/admin/reportes"
          />
        </div>
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error al cargar</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      {alert ? (
        <Card
          className={`p-4 ${
            alert.type === "error"
              ? "border-rose-400/30 bg-rose-400/10"
              : alert.type === "success"
                ? "border-emerald-400/30 bg-emerald-400/10"
                : alert.type === "warning"
                  ? "border-amber-400/30 bg-amber-400/10"
                  : "border-sky-400/30 bg-sky-400/10"
          }`}
        >
          <p
            className={`text-sm font-medium ${
              alert.type === "error"
                ? "text-rose-300"
                : alert.type === "success"
                  ? "text-emerald-300"
                  : alert.type === "warning"
                    ? "text-amber-300"
                    : "text-sky-300"
            }`}
          >
            {alert.title}
          </p>
          <p className="mt-1 text-sm text-white/75">{alert.message}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Clientes activos"
          value={stats.clientesActivos}
          subtitle={`+${stats.clientesNuevosMes} este mes`}
          color="text-sky-400"
        />
        <button
          type="button"
          onClick={() => setMostrarPlanesActivos((prev) => !prev)}
          className="block rounded-3xl text-left transition hover:-translate-y-0.5 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-violet-400/40"
        >
          <StatCard
            title="Planes activos"
            value={stats.planesActivos}
            subtitle={
              mostrarPlanesActivos
                ? "Ocultar personas"
                : `${stats.totalSesionesDisponibles} sesiones disponibles`
            }
            color="text-violet-400"
          />
        </button>
        <StatCard
          title="Citas hoy"
          value={stats.citasHoy}
          subtitle={`${stats.programadasHoy} programadas`}
          color="text-amber-400"
        />
        <button
          type="button"
          onClick={() => {
            const nextOpen = !mostrarIngresosDetalle;
            setMostrarIngresosDetalle(nextOpen);
            if (nextOpen) void loadPagosDetalle();
          }}
          className="block rounded-3xl text-left transition hover:-translate-y-0.5 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
        >
          <StatCard
            title="Ingresos del mes"
            value={money(stats.ingresosMes)}
            subtitle={
              mostrarIngresosDetalle
                ? "Ocultar detalle"
                : `Hoy: ${money(stats.pagosHoy)}`
            }
            color="text-emerald-400"
          />
        </button>
        <StatCard
          title="Personal activo"
          value={stats.personalActivo}
          subtitle="Acción rápida abajo"
        />
        <StatCard
          title="Asistencia planes"
          value={stats.sesionesPlanPendientes}
          subtitle="Pendientes del día"
          color={
            stats.sesionesPlanPendientes > 0
              ? "text-amber-400"
              : "text-white/75"
          }
        />
      </div>

      {mostrarPlanesActivos ? (
        <Section
          title="Personas con planes activos"
          description="Vista compacta de clientes con plan activo."
        >
          <Card className="p-3 sm:p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="text"
                value={filtroPlanActivo}
                onChange={(e) => setFiltroPlanActivo(e.target.value)}
                placeholder="Buscar nombre, plan, teléfono..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05] sm:max-w-xs"
              />

              <p className="text-[11px] text-white/45">
                {planesActivosDetalleFiltrados.length} de{" "}
                {planesActivosDetalle.length}
              </p>
            </div>

            {planesActivosDetalle.length === 0 ? (
              <p className="text-sm text-white/55">
                No hay personas con planes activos.
              </p>
            ) : planesActivosDetalleFiltrados.length === 0 ? (
              <p className="text-sm text-white/55">
                No hay resultados con ese filtro.
              </p>
            ) : (
              <div className="max-h-[360px] overflow-y-auto pr-1">
                <div className="divide-y divide-white/10">
                  {planesActivosDetalleFiltrados.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-1 gap-2 py-2.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {item.cliente_nombre}
                        </p>
                        {item.cliente_telefono || item.cliente_email ? (
                          <p className="mt-0.5 truncate text-[11px] text-white/40">
                            {[item.cliente_telefono, item.cliente_email]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-violet-300">
                          {item.plan_nombre}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-white/40">
                          Vence: {formatDate(item.fecha_fin)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
                        <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-1 text-[11px] font-medium text-violet-300">
                          {item.sesiones_disponibles}/{item.sesiones_totales}{" "}
                          sesiones
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            void copiarNombrePlanActivo(item.cliente_nombre)
                          }
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/70 transition hover:bg-white/[0.06]"
                        >
                          Copiar
                        </button>

                        {item.cliente_id ? (
                          <Link
                            href={`/admin/personas/clientes/${item.cliente_id}`}
                            className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/70 transition hover:bg-white/[0.06]"
                          >
                            Ver
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </Section>
      ) : null}

      {mostrarIngresosDetalle ? (
        <Section
          title="Detalle de ingresos"
          description="Pagos completados en el rango seleccionado."
        >
          <Card className="p-3 sm:p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-white/45">Desde</label>
                  <input
                    type="date"
                    value={ingresosRangoDesde}
                    onChange={(e) => setIngresosRangoDesde(e.target.value)}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-white/45">Hasta</label>
                  <input
                    type="date"
                    value={ingresosRangoHasta}
                    onChange={(e) => setIngresosRangoHasta(e.target.value)}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={loadingPagosDetalle}
                    onClick={() => void loadPagosDetalle()}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06] disabled:opacity-50"
                  >
                    {loadingPagosDetalle ? "Cargando..." : "Aplicar"}
                  </button>
                </div>
              </div>

              {pagosDetalle.length > 0 ? (
                <div className="text-right">
                  <p className="text-xs text-white/45">
                    {pagosDetalle.length} pago(s)
                  </p>
                  <p className="text-sm font-semibold text-emerald-400">
                    {money(
                      pagosDetalle.reduce(
                        (acc, p) =>
                          acc + Number(p.monto_equivalente_usd || p.monto || 0),
                        0,
                      ),
                    )}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {[
                {
                  label: "Hoy",
                  desde: getDateKey(new Date()),
                  hasta: getDateKey(new Date()),
                },
                {
                  label: "Esta semana",
                  desde: (() => {
                    const d = new Date();
                    d.setDate(d.getDate() - d.getDay());
                    return getDateKey(d);
                  })(),
                  hasta: getDateKey(new Date()),
                },
                {
                  label: "Este mes",
                  desde: (() => {
                    const d = new Date();
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
                  })(),
                  hasta: getDateKey(new Date()),
                },
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
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setIngresosRangoDesde(preset.desde);
                    setIngresosRangoHasta(preset.hasta);
                    void loadPagosDetalle(preset.desde, preset.hasta);
                  }}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/60 transition hover:bg-white/[0.07] hover:text-white/80"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {loadingPagosDetalle ? (
              <p className="text-sm text-white/55">Cargando...</p>
            ) : pagosDetalle.length === 0 ? (
              <p className="text-sm text-white/55">
                No hay pagos en ese rango.
              </p>
            ) : (
              <div className="max-h-[400px] overflow-y-auto pr-1">
                <div className="mb-1 hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.8fr)] gap-2 px-1 sm:grid">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                    Cliente
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                    Concepto
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                    Método
                  </p>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                    Fecha
                  </p>
                  <p className="text-right text-[11px] font-semibold uppercase tracking-wide text-white/35">
                    Monto
                  </p>
                </div>

                <div className="divide-y divide-white/[0.06]">
                  {pagosDetalle.map((pago) => (
                    <div
                      key={pago.id}
                      className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.8fr)] sm:items-center sm:gap-2"
                    >
                      <p className="truncate text-sm font-medium text-white">
                        {pago.cliente_nombre || (
                          <span className="text-white/35">Sin cliente</span>
                        )}
                      </p>
                      <p className="truncate text-xs text-white/60">
                        {pago.concepto || "—"}
                      </p>
                      <p className="truncate text-xs text-white/55">
                        {pago.metodo_nombre || pago.moneda_pago || "—"}
                      </p>
                      <p className="text-xs text-white/45">
                        {formatDate(pago.fecha)}
                      </p>
                      <p className="text-right text-sm font-semibold text-emerald-400">
                        {money(pago.monto_equivalente_usd || pago.monto)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </Section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <Section
            title="Citas de hoy"
            description="Citas del día para completar rápido."
          >
            <Card className="p-3 sm:p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="date"
                    value={asistenciaFilterFecha}
                    onChange={(e) => setAsistenciaFilterFecha(e.target.value)}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setMostrarCitasHoy((prev) => !prev)}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06]"
                  >
                    {mostrarCitasHoy ? "Ocultar" : "Mostrar"} ·{" "}
                    {citasHoyFiltradas.length}
                  </button>
                </div>

                <input
                  type="text"
                  value={filtroCitasHoy}
                  onChange={(e) => setFiltroCitasHoy(e.target.value)}
                  placeholder="Buscar cita, cliente, terapeuta, servicio..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]"
                />
              </div>

              {!mostrarCitasHoy ? (
                <p className="mt-3 text-xs text-white/45">
                  Lista oculta. Usa el buscador y toca Mostrar para revisar o
                  completar citas.
                </p>
              ) : citasHoyFiltradas.length === 0 ? (
                <p className="mt-3 text-sm text-white/55">
                  No hay citas con ese filtro.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {citasHoyPaginadas.map((cita) => {
                    const estado = (cita.estado || "").toLowerCase();
                    const completada = estado === "completada";

                    return (
                      <div
                        key={cita.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${citaDotClass(cita.estado)}`}
                              />
                              <p className="truncate text-sm font-semibold text-white">
                                {getCitaCliente(cita)}
                              </p>
                            </div>
                            <p className="mt-0.5 truncate pl-4 text-[11px] text-white/45">
                              {formatTime(getCitaHoraInicio(cita))} -{" "}
                              {formatTime(getCitaHoraFin(cita))} ·{" "}
                              {getCitaServicio(cita)}
                            </p>
                            <p className="mt-0.5 truncate pl-4 text-[11px] text-white/35">
                              {getCitaEmpleado(cita)} ·{" "}
                              {citaEstadoLabel(cita.estado)}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={savingCitaId === cita.id || completada}
                            onClick={() => void marcarCitaCompletada(cita.id)}
                            className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                              completada
                                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                                : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15"
                            }`}
                          >
                            {completada
                              ? "Completada"
                              : savingCitaId === cita.id
                                ? "Guardando..."
                                : "Completar"}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {citasHoyFiltradas.length > PAGE_SIZE ? (
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <p className="text-xs text-white/45">
                        Página {citasHoyPage} de {citasHoyTotalPages}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={citasHoyPage <= 1}
                          onClick={() =>
                            setCitasHoyPage((prev) => Math.max(prev - 1, 1))
                          }
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06] disabled:opacity-40"
                        >
                          Anterior
                        </button>
                        <button
                          type="button"
                          disabled={citasHoyPage >= citasHoyTotalPages}
                          onClick={() =>
                            setCitasHoyPage((prev) =>
                              Math.min(prev + 1, citasHoyTotalPages),
                            )
                          }
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06] disabled:opacity-40"
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </Card>
          </Section>
        </div>

        <div className="xl:col-span-1">
          <Section
            title="Sesiones del plan de hoy"
            description="Asistencia de planes cerrada por defecto."
          >
            <Card className="p-3 sm:p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="date"
                    value={asistenciaFilterFecha}
                    onChange={(e) => setAsistenciaFilterFecha(e.target.value)}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setMostrarSesionesPlanHoy((prev) => !prev)}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06]"
                  >
                    {mostrarSesionesPlanHoy ? "Ocultar" : "Mostrar"} ·{" "}
                    {sesionesPlanHoyCompactas.length}
                  </button>
                </div>

                <input
                  type="text"
                  value={filtroSesionesPlan}
                  onChange={(e) => setFiltroSesionesPlan(e.target.value)}
                  placeholder="Buscar César Quintero, plan, terapeuta..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]"
                />

                <div className="flex items-center gap-3 text-xs text-white/55">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    {
                      sesionesPlanHoyCompactas.filter(
                        (x) =>
                          (x.asistencia_estado || "pendiente") === "pendiente",
                      ).length
                    }
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    {
                      sesionesPlanHoyCompactas.filter(
                        (x) => (x.asistencia_estado || "") === "asistio",
                      ).length
                    }
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    {
                      sesionesPlanHoyCompactas.filter(
                        (x) =>
                          (x.asistencia_estado || "") ===
                          "no_asistio_sin_aviso",
                      ).length
                    }
                  </span>
                </div>
              </div>

              {!mostrarSesionesPlanHoy ? (
                <p className="mt-3 text-xs text-white/45">
                  Lista oculta para mantener el dashboard compacto.
                </p>
              ) : sesionesPlanHoyCompactas.length === 0 ? (
                <p className="mt-3 text-sm text-white/55">
                  No hay sesiones del plan con ese filtro.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {sesionesPlanHoyPaginadas.map((row) => {
                    const cliente = firstOrNull(row.clientes);
                    const empleado = firstOrNull(row.empleados);
                    const clientePlan = firstOrNull(row.clientes_planes);
                    const plan = firstOrNull(clientePlan?.planes);
                    const sesionAbierta = openSesionPlanId === row.id;

                    return (
                      <Card key={row.id} className="overflow-hidden p-0">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSesionPlanId((current) =>
                              current === row.id ? null : row.id,
                            )
                          }
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.03]"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 shrink-0 rounded-full ${asistenciaPlanDotClass(row.asistencia_estado)}`}
                              />
                              <p className="truncate text-sm font-semibold text-white">
                                {cliente?.nombre || "Cliente"}
                              </p>
                            </div>
                            <p className="mt-0.5 truncate pl-4 text-[11px] text-white/45">
                              {formatTime(row.hora_inicio)} -{" "}
                              {formatTime(row.hora_fin)} ·{" "}
                              {asistenciaLabel(row.asistencia_estado)}
                            </p>
                          </div>

                          <span className="shrink-0 text-xs text-white/40">
                            {sesionAbierta ? "−" : "+"}
                          </span>
                        </button>

                        {sesionAbierta ? (
                          <div className="border-t border-white/10 px-3 pb-3 pt-2">
                            <p className="truncate text-xs text-white/60">
                              {empleado?.nombre || "Empleado"} ·{" "}
                              {roleLabel(empleado?.rol)}
                            </p>
                            <p className="mt-1 truncate text-[11px] text-violet-300/80">
                              {plan?.nombre || "Plan"}
                            </p>

                            <div className="mt-3 grid grid-cols-3 gap-1.5">
                              <button
                                type="button"
                                disabled={savingAsistenciaId === row.id}
                                onClick={() =>
                                  void marcarAsistenciaPlan(row.id, "asistio")
                                }
                                className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-60"
                              >
                                ✓ Asistió
                              </button>
                              <button
                                type="button"
                                disabled={savingAsistenciaId === row.id}
                                onClick={() =>
                                  void marcarAsistenciaPlan(
                                    row.id,
                                    "no_asistio_aviso",
                                  )
                                }
                                className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/15 disabled:opacity-60"
                              >
                                Avisó
                              </button>
                              <button
                                type="button"
                                disabled={savingAsistenciaId === row.id}
                                onClick={() =>
                                  void marcarAsistenciaPlan(
                                    row.id,
                                    "no_asistio_sin_aviso",
                                  )
                                }
                                className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-2 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/15 disabled:opacity-60"
                              >
                                Sin aviso
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </Card>
                    );
                  })}

                  {sesionesPlanHoyCompactas.length > PAGE_SIZE ? (
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <p className="text-xs text-white/45">
                        Página {sesionesPlanPage} de {sesionesPlanTotalPages}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={sesionesPlanPage <= 1}
                          onClick={() =>
                            setSesionesPlanPage((prev) => Math.max(prev - 1, 1))
                          }
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06] disabled:opacity-40"
                        >
                          Anterior
                        </button>
                        <button
                          type="button"
                          disabled={sesionesPlanPage >= sesionesPlanTotalPages}
                          onClick={() =>
                            setSesionesPlanPage((prev) =>
                              Math.min(prev + 1, sesionesPlanTotalPages),
                            )
                          }
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06] disabled:opacity-40"
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </Card>
          </Section>
        </div>

        <div className="xl:col-span-1">
          <Section
            title="Asistencia del personal hoy"
            description="Personal cerrado por defecto."
          >
            <Card className="p-3 sm:p-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="date"
                    value={asistenciaFilterFecha}
                    onChange={(e) => setAsistenciaFilterFecha(e.target.value)}
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setMostrarAsistenciaPersonalHoy((prev) => !prev)
                    }
                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06]"
                  >
                    {mostrarAsistenciaPersonalHoy ? "Ocultar" : "Mostrar"} ·{" "}
                    {empleadosActivosNoAdmin.length}
                  </button>
                </div>

                <input
                  type="text"
                  value={filtroAsistenciaPersonal}
                  onChange={(e) => setFiltroAsistenciaPersonal(e.target.value)}
                  placeholder="Buscar empleado, rol o estado..."
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]"
                />
              </div>

              {!mostrarAsistenciaPersonalHoy ? (
                <p className="mt-3 text-xs text-white/45">
                  Lista oculta para mantener el dashboard compacto.
                </p>
              ) : empleadosActivosNoAdmin.length === 0 ? (
                <p className="mt-3 text-sm text-white/55">
                  No hay personal activo con ese filtro.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {empleadosActivosNoAdminPaginados.map((empleado) => {
                    const registro = mapaAsistenciaPersonalHoy.get(empleado.id);
                    const abierto = openEmpleadoAsistenciaId === empleado.id;

                    return (
                      <Card key={empleado.id} className="overflow-hidden p-0">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenEmpleadoAsistenciaId((current) =>
                              current === empleado.id ? null : empleado.id,
                            )
                          }
                          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.04]"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold text-white">
                                {empleado.nombre || "Empleado"}
                              </p>
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${asistenciaPersonalDotClass(registro?.estado)}`}
                              />
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-white/45">
                              {roleLabel(empleado.rol)} ·{" "}
                              {asistenciaPersonalLabel(registro?.estado)}
                            </p>
                          </div>

                          <span className="shrink-0 text-xs text-white/40">
                            {abierto ? "−" : "+"}
                          </span>
                        </button>

                        {abierto ? (
                          <div className="border-t border-white/10 px-3 pb-3 pt-2">
                            <div className="grid grid-cols-5 gap-1.5">
                              <button
                                type="button"
                                disabled={
                                  savingEmpleadoAsistenciaId === empleado.id
                                }
                                onClick={() =>
                                  void marcarAsistenciaEmpleado(
                                    empleado.id,
                                    "asistio",
                                  )
                                }
                                className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-60"
                              >
                                ✓
                              </button>
                              <button
                                type="button"
                                disabled={
                                  savingEmpleadoAsistenciaId === empleado.id
                                }
                                onClick={() =>
                                  void marcarAsistenciaEmpleado(
                                    empleado.id,
                                    "permiso",
                                  )
                                }
                                className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/15 disabled:opacity-60"
                              >
                                P
                              </button>
                              <button
                                type="button"
                                disabled={
                                  savingEmpleadoAsistenciaId === empleado.id
                                }
                                onClick={() =>
                                  void marcarAsistenciaEmpleado(
                                    empleado.id,
                                    "no_asistio",
                                  )
                                }
                                className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-2 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/15 disabled:opacity-60"
                              >
                                X
                              </button>
                              <button
                                type="button"
                                disabled={
                                  savingEmpleadoAsistenciaId === empleado.id
                                }
                                onClick={() =>
                                  void marcarAsistenciaEmpleado(
                                    empleado.id,
                                    "reposo",
                                  )
                                }
                                className="rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/10 px-2 py-1.5 text-xs font-semibold text-fuchsia-300 transition hover:bg-fuchsia-400/15 disabled:opacity-60"
                              >
                                R
                              </button>
                              <button
                                type="button"
                                disabled={
                                  savingEmpleadoAsistenciaId === empleado.id
                                }
                                onClick={() =>
                                  void marcarAsistenciaEmpleado(
                                    empleado.id,
                                    "vacaciones",
                                  )
                                }
                                className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-2 py-1.5 text-[11px] font-semibold text-sky-300 transition hover:bg-sky-400/15 disabled:opacity-60"
                              >
                                Vac.
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </Card>
                    );
                  })}

                  {empleadosActivosNoAdmin.length > PAGE_SIZE ? (
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <p className="text-xs text-white/45">
                        Página {empleadosAsistenciaPage} de{" "}
                        {empleadosAsistenciaTotalPages}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={empleadosAsistenciaPage <= 1}
                          onClick={() =>
                            setEmpleadosAsistenciaPage((prev) =>
                              Math.max(prev - 1, 1),
                            )
                          }
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06] disabled:opacity-40"
                        >
                          Anterior
                        </button>
                        <button
                          type="button"
                          disabled={
                            empleadosAsistenciaPage >=
                            empleadosAsistenciaTotalPages
                          }
                          onClick={() =>
                            setEmpleadosAsistenciaPage((prev) =>
                              Math.min(prev + 1, empleadosAsistenciaTotalPages),
                            )
                          }
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06] disabled:opacity-40"
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </Card>
          </Section>
        </div>
      </div>

      <Section
        title="Clientes con saldo pendiente"
        description="Resumen compacto de deudas. Puedes ocultarlo para limpiar el dashboard."
      >
        <Card className="p-3 sm:p-4">
          <button
            type="button"
            onClick={() => setMostrarSaldosPendientes((prev) => !prev)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                Saldos pendientes
              </p>
              <p className="mt-0.5 text-[11px] text-white/45">
                {clientesConSaldoPendiente.length} cliente(s) con deuda
                registrada
              </p>
            </div>

            <span className="shrink-0 rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-300">
              {mostrarSaldosPendientes ? "Ocultar" : "Mostrar"}
            </span>
          </button>

          {!mostrarSaldosPendientes ? (
            <p className="mt-3 text-xs text-white/40">
              La lista está cerrada para mantener el dashboard más limpio.
            </p>
          ) : clientesConSaldoPendiente.length === 0 ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
              <p className="text-sm text-white/55">
                No hay clientes con saldo pendiente.
              </p>
            </div>
          ) : (
            <div className="mt-3 max-h-[360px] overflow-y-auto pr-1">
              <div className="divide-y divide-white/10">
                {clientesConSaldoPendiente.map((row) => {
                  const montoPendiente = Number(
                    row.saldo_pendiente_neto_usd ||
                      row.total_pendiente_usd ||
                      0,
                  );
                  const primeraRazon = row.razones[0];

                  return (
                    <div
                      key={row.cliente_id}
                      className="grid grid-cols-1 gap-2 py-2.5 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">
                          {row.cliente_nombre}
                        </p>
                        <p className="mt-0.5 text-[11px] text-white/40">
                          {row.razones.length} concepto(s) pendiente(s)
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-xs text-white/65">
                          {primeraRazon?.concepto || "Saldo pendiente"}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-white/35">
                          {primeraRazon?.fecha
                            ? `Fecha: ${formatDate(primeraRazon.fecha)}`
                            : "Fecha: —"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-300">
                          {money(montoPendiente)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </Section>
    </div>
  );
}
