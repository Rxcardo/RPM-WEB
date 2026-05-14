"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Phone,
  Plus,
  RefreshCcw,
  RotateCcw,
  Search,
  Send,
  XCircle,
  Inbox,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type ParticipanteTipo = "cliente" | "fisio" | "recepcion" | "admin" | "sistema";
type ConversacionTipo = "cliente_fisio" | "cliente_recepcion" | "fisio_recepcion" | "grupo";
type MensajeTipo = "texto" | "imagen" | "video" | "audio" | "archivo" | "sistema" | "solicitud";
type SolicitudEstado = "pendiente" | "en_revision" | "aprobada" | "rechazada" | "resuelta" | "cancelada";

type SolicitudTipo =
  | "solicitar_cita"
  | "solicitar_plan"
  | "renovar_plan"
  | "renovar_mi_plan"
  | "congelar_cita"
  | "congelar_plan"
  | "reagendar_cita"
  | "cancelar_cita"
  | "cambio_horario"
  | "cambio_fisio"
  | "aviso_no_asistencia_cliente"
  | "ausencia_fisio"
  | "bloqueo_horario"
  | "consulta_pago"
  | "consulta_clinica"
  | "otro";

type ClienteMini = {
  id: string;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  terapeuta_id: string | null;
};

type EmpleadoMini = {
  id: string;
  nombre: string | null;
  rol: string | null;
  telefono?: string | null;
  email?: string | null;
};

type EmpleadoActual = {
  id: string;
  nombre: string | null;
  rol: string | null;
  auth_user_id: string | null;
};

type Conversacion = {
  id: string;
  tipo: ConversacionTipo;
  titulo: string | null;
  cliente_id: string | null;
  fisio_id: string | null;
  recepcionista_id: string | null;
  ultima_actividad_at: string | null;
  ultimo_mensaje: string | null;
  archivada: boolean | null;
  fijada: boolean | null;
  created_at: string | null;
  clientes?: ClienteMini | ClienteMini[] | null;
  fisios?: EmpleadoMini | EmpleadoMini[] | null;
  recepcionistas?: EmpleadoMini | EmpleadoMini[] | null;
};

type Mensaje = {
  id: string;
  conversacion_id: string;
  remitente_id: string;
  remitente_tipo: ParticipanteTipo;
  mensaje: string | null;
  tipo: MensajeTipo;
  archivo_url: string | null;
  archivo_nombre: string | null;
  solicitud_id: string | null;
  editado: boolean | null;
  eliminado: boolean | null;
  created_at: string;
  updated_at: string | null;
};

type Solicitud = {
  id: string;
  conversacion_id: string | null;
  cita_id: string | null;
  cliente_id: string | null;
  fisio_id: string | null;
  tipo: SolicitudTipo;
  estado: SolicitudEstado;
  origen_tipo: ParticipanteTipo;
  origen_id: string;
  destino_tipo: ParticipanteTipo;
  destino_id: string | null;
  titulo: string;
  descripcion: string;
  comentario_resolucion: string | null;
  created_at: string;
  updated_at: string | null;
  resuelto_at: string | null;
  resuelto_por: string | null;
  clientes?: ClienteMini | ClienteMini[] | null;
  fisios?: EmpleadoMini | EmpleadoMini[] | null;
};

type ListEntry =
  | { kind: "conversacion"; data: Conversacion }
  | { kind: "cliente_sin_conv"; cliente: ClienteMini };

type AlertState =
  | { type: "success" | "error" | "info" | "warning"; title: string; message: string }
  | null;

type NuevaSolicitudState = {
  tipo: SolicitudTipo;
  cliente_id: string;
  fisio_id: string;
  titulo: string;
  descripcion: string;
};

type VistaMovil = "list" | "chat" | "solicitudes";

const NUEVA_SOLICITUD_INICIAL: NuevaSolicitudState = {
  tipo: "otro",
  cliente_id: "",
  fisio_id: "",
  titulo: "",
  descripcion: "",
};

const SOLICITUD_LABELS: Record<SolicitudTipo, string> = {
  solicitar_cita: "Solicitud de cita",
  solicitar_plan: "Solicitar plan",
  renovar_plan: "Renovar mi plan",
  renovar_mi_plan: "Renovar mi plan",
  congelar_cita: "Congelar cita",
  congelar_plan: "Congelar plan",
  reagendar_cita: "Reagendar cita",
  cancelar_cita: "Cancelar cita",
  cambio_horario: "Cambio de horario",
  cambio_fisio: "Cambio de fisio",
  aviso_no_asistencia_cliente: "Aviso no asistencia",
  ausencia_fisio: "Ausencia fisio",
  bloqueo_horario: "Bloqueo horario",
  consulta_pago: "Consulta pago",
  consulta_clinica: "Consulta clínica",
  otro: "General",
};

const TIPOS_SOLICITUD: SolicitudTipo[] = [
  "solicitar_cita",
  "solicitar_plan",
  "renovar_plan",
  "congelar_cita",
  "reagendar_cita",
  "cancelar_cita",
  "cambio_horario",
  "cambio_fisio",
  "aviso_no_asistencia_cliente",
  "ausencia_fisio",
  "bloqueo_horario",
  "consulta_pago",
  "consulta_clinica",
  "otro",
];

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function normalize(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function solicitudVisibleParaFisio(s: Solicitud) {
  const raw = normalize([s.tipo, s.titulo, s.descripcion].filter(Boolean).join(" "));

  return (
    raw.includes("solicitar_cita") ||
    raw.includes("solicitud de cita") ||
    raw.includes("cita") ||
    raw.includes("solicitar_plan") ||
    raw.includes("solicitud de plan") ||
    raw.includes("plan") ||
    raw.includes("renovar_plan") ||
    raw.includes("renovar_mi_plan") ||
    raw.includes("renovar") ||
    raw.includes("congelar") ||
    raw.includes("reagendar") ||
    raw.includes("reprogramar") ||
    raw.includes("cambio_horario") ||
    raw.includes("horario")
  );
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function formatHour(value: string | null | undefined) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatRelative(value: string | null | undefined) {
  if (!value) return "";
  try {
    const d = new Date(value);
    const now = new Date();
    const days = Math.floor((now.getTime() - d.getTime()) / 86400000);

    if (days === 0) {
      return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    }

    if (days === 1) return "Ayer";
    if (days < 7) return d.toLocaleDateString("es-ES", { weekday: "short" });

    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

function initials(name?: string | null) {
  return (
    (name || "RPM")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "R"
  );
}

function wa(phone?: string | null) {
  const clean = (phone || "").replace(/[^0-9]/g, "");
  return clean ? `https://wa.me/${clean}` : "#";
}

function roleToSender(rol: string | null | undefined): ParticipanteTipo {
  const r = (rol || "").toLowerCase();
  if (r === "admin") return "admin";
  if (r === "recepcionista" || r === "recepcion") return "recepcion";
  return "fisio";
}

function dateValue(value?: string | null) {
  const n = new Date(value || "").getTime();
  return Number.isFinite(n) ? n : 0;
}

function isTempId(id: string) {
  return id.startsWith("temp-");
}

function samePendingMessage(a: Mensaje, b: Mensaje) {
  return (
    isTempId(a.id) &&
    a.conversacion_id === b.conversacion_id &&
    a.remitente_id === b.remitente_id &&
    a.tipo === b.tipo &&
    (a.mensaje || "").trim() === (b.mensaje || "").trim() &&
    Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < 15000
  );
}

function mergeMensaje(prev: Mensaje[], msg: Mensaje): Mensaje[] {
  if (prev.some((m) => m.id === msg.id)) return prev;

  const tempIndex = prev.findIndex((m) => samePendingMessage(m, msg));

  if (tempIndex >= 0) {
    const next = [...prev];
    next[tempIndex] = msg;
    return next;
  }

  return [...prev, msg];
}

function conversationGroupKey(c: Conversacion) {
  if (c.tipo === "cliente_recepcion") return `cr:${c.cliente_id || "x"}`;
  if (c.tipo === "cliente_fisio") return `cf:${c.cliente_id || "x"}:${c.fisio_id || "x"}`;
  if (c.tipo === "fisio_recepcion") return `fr:${c.fisio_id || "x"}:${c.recepcionista_id || "x"}`;
  return `g:${c.id}`;
}

function dedupeConversaciones(rows: Conversacion[]) {
  const map = new Map<string, Conversacion>();

  rows.forEach((row) => {
    const key = conversationGroupKey(row);
    const current = map.get(key);

    if (!current) {
      map.set(key, row);
      return;
    }

    const currentHasMsg = Boolean((current.ultimo_mensaje || "").trim());
    const rowHasMsg = Boolean((row.ultimo_mensaje || "").trim());

    const winner =
      currentHasMsg !== rowHasMsg
        ? currentHasMsg
          ? current
          : row
        : dateValue(current.ultima_actividad_at) >= dateValue(row.ultima_actividad_at)
          ? current
          : row;

    map.set(key, winner);
  });

  return Array.from(map.values()).sort(
    (a, b) =>
      dateValue(b.ultima_actividad_at || b.created_at) -
      dateValue(a.ultima_actividad_at || a.created_at)
  );
}

function tipoConversacionLabel(tipo: ConversacionTipo) {
  if (tipo === "cliente_recepcion") return "Cliente · Recepción";
  if (tipo === "cliente_fisio") return "Cliente · Fisio";
  if (tipo === "fisio_recepcion") return "Fisio · Recepción";
  return "Grupo";
}

function estadoBadgeStyle(estado: string): React.CSSProperties {
  switch (estado) {
    case "pendiente":
      return {
        background: "rgba(251,191,36,0.1)",
        border: "1px solid rgba(251,191,36,0.22)",
        color: "#d97706",
      };
    case "en_revision":
      return {
        background: "rgba(56,189,248,0.1)",
        border: "1px solid rgba(56,189,248,0.22)",
        color: "#0284c7",
      };
    case "aprobada":
    case "resuelta":
      return {
        background: "rgba(52,211,153,0.1)",
        border: "1px solid rgba(52,211,153,0.22)",
        color: "var(--green)",
      };
    case "rechazada":
    case "cancelada":
      return {
        background: "rgba(248,113,113,0.1)",
        border: "1px solid rgba(248,113,113,0.22)",
        color: "var(--red)",
      };
    default:
      return {
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        color: "var(--text-sub)",
      };
  }
}

const AVATAR_COLORS: [string, string][] = [
  ["#7c3aed", "#5b21b6"],
  ["#0ea5e9", "#0369a1"],
  ["#10b981", "#059669"],
  ["#f43f5e", "#be123c"],
  ["#f59e0b", "#b45309"],
  ["#6366f1", "#4338ca"],
];

function avatarGradient(name?: string | null): [string, string] {
  const s = name || "?";
  let hash = 0;

  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) & 0xffff;
  }

  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function Avatar({
  name,
  size = "md",
}: {
  name?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const [c1, c2] = avatarGradient(name);
  const dim = size === "sm" ? 36 : size === "lg" ? 52 : 42;
  const font = size === "sm" ? 12 : size === "lg" ? 16 : 13;

  return (
    <div
      style={{
        width: dim,
        height: dim,
        borderRadius: "50%",
        background: `linear-gradient(135deg,${c1},${c2})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: font,
        fontWeight: 800,
        color: "#fff",
        flexShrink: 0,
        boxShadow: `0 2px 8px ${c2}55`,
      }}
    >
      {initials(name)}
    </div>
  );
}

export default function ComunicacionPage() {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);

  const [empleado, setEmpleado] = useState<EmpleadoActual | null>(null);
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [clientes, setClientes] = useState<ClienteMini[]>([]);
  const [fisios, setFisios] = useState<EmpleadoMini[]>([]);

  const [selectedId, setSelectedId] = useState("");
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<"pendiente" | "en_revision" | "todas">("pendiente");
  const [tipoFiltro, setTipoFiltro] = useState<"todas" | ConversacionTipo>("todas");

  const [showNuevaSolicitud, setShowNuevaSolicitud] = useState(false);
  const [nuevaSolicitud, setNuevaSolicitud] =
    useState<NuevaSolicitudState>(NUEVA_SOLICITUD_INICIAL);
  const [savingSolicitud, setSavingSolicitud] = useState(false);
  const [vistaMovil, setVistaMovil] = useState<VistaMovil>("list");

  const selected = conversaciones.find((c) => c.id === selectedId) || null;
  const clienteDirectoId = selectedId.startsWith("cliente:")
    ? selectedId.replace("cliente:", "")
    : null;
  const clienteDirecto = clienteDirectoId
    ? clientes.find((c) => c.id === clienteDirectoId) || null
    : null;

  const selectedCliente = clienteDirecto || firstOrNull(selected?.clientes);

  const tituloChat =
    clienteDirecto?.nombre ||
    (selected
      ? selected.tipo === "fisio_recepcion"
        ? firstOrNull(selected.fisios)?.nombre || selected.titulo || "Fisio"
        : firstOrNull(selected.clientes)?.nombre || selected.titulo || "Cliente"
      : "Chat");

  const subtituloChat = clienteDirecto
    ? "Cliente · nuevo chat"
    : selected
      ? tipoConversacionLabel(selected.tipo)
      : "";

  useEffect(() => {
    void boot();
  }, []);

  useEffect(() => {
    if (!empleado?.id) return;

    const ch = supabase
      .channel("rpm-comunicacion-empleado")
      .on("postgres_changes", { event: "*", schema: "public", table: "mensajes" }, (payload) => {
        const row = payload.new as Mensaje;
        if (!row?.id || row.conversacion_id !== selectedId) return;

        setMensajes((prev) => mergeMensaje(prev, row));
        void loadConversaciones();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversaciones" }, () => {
        void loadConversaciones();
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "solicitudes_comunicacion" },
        () => {
          void loadSolicitudes();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [empleado?.id, selectedId]);

  useEffect(() => {
    if (selectedId && !selectedId.startsWith("cliente:")) void loadMensajes(selectedId);
    else setMensajes([]);
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes.length, selectedId]);

  function showAlert(type: NonNullable<AlertState>["type"], title: string, message: string) {
    setAlert({ type, title, message });
    window.setTimeout(() => setAlert(null), 4200);
  }

  function puedeVerTodo(emp: EmpleadoActual | null | undefined) {
    const rol = (emp?.rol || "").toLowerCase();
    return rol === "admin" || rol === "recepcionista" || rol === "recepcion";
  }

  function idsClientesPermitidos(lista: ClienteMini[]) {
    return lista.map((c) => c.id).filter(Boolean);
  }

  async function boot() {
    setLoading(true);

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const userId = auth.user?.id;
      if (!userId) throw new Error("No hay usuario autenticado.");

      const { data: emp, error: empError } = await supabase
        .from("empleados")
        .select("id,nombre,rol,auth_user_id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      if (empError) throw empError;
      if (!emp) throw new Error("Este usuario no tiene empleado vinculado.");

      const empleadoActual = emp as EmpleadoActual;
      setEmpleado(empleadoActual);

      const clientesPermitidos = await loadCatalogos(empleadoActual);

      await Promise.all([
        loadConversaciones(empleadoActual, clientesPermitidos),
        loadSolicitudes(empleadoActual, clientesPermitidos),
      ]);
    } catch (err: any) {
      showAlert("error", "Error", err?.message || "No se pudo cargar comunicación.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCatalogos(emp: EmpleadoActual = empleado as EmpleadoActual): Promise<ClienteMini[]> {
    let clientesQuery = supabase
      .from("clientes")
      .select("id,nombre,telefono,email,terapeuta_id")
      .neq("estado", "eliminado")
      .order("nombre");

    if (!puedeVerTodo(emp)) clientesQuery = clientesQuery.eq("terapeuta_id", emp.id);

    const [cr, fr] = await Promise.all([
      clientesQuery,
      supabase
        .from("empleados")
        .select("id,nombre,rol,telefono,email")
        .in("rol", ["terapeuta", "recepcionista", "admin"])
        .eq("estado", "activo")
        .order("nombre"),
    ]);

    if (cr.error) throw cr.error;
    if (fr.error) throw fr.error;

    const clientesPermitidos = (cr.data || []) as ClienteMini[];

    setClientes(clientesPermitidos);
    setFisios((fr.data || []) as EmpleadoMini[]);

    return clientesPermitidos;
  }

  async function loadConversaciones(
    emp: EmpleadoActual = empleado as EmpleadoActual,
    clientesBase: ClienteMini[] = clientes
  ) {
    let query = supabase
      .from("conversaciones")
      .select(
        "*, clientes:cliente_id(id,nombre,telefono,email,terapeuta_id), fisios:fisio_id(id,nombre,rol,telefono,email), recepcionistas:recepcionista_id(id,nombre,rol)"
      )
      .eq("archivada", false)
      .order("ultima_actividad_at", { ascending: false });

    if (!puedeVerTodo(emp)) {
      const permitidos = idsClientesPermitidos(clientesBase);

      if (permitidos.length === 0) {
        setConversaciones([]);
        setSelectedId("");
        return;
      }

      query = query.or(`cliente_id.in.(${permitidos.join(",")}),fisio_id.eq.${emp.id}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const permitidosSet = new Set(idsClientesPermitidos(clientesBase));

    const rows = dedupeConversaciones((data || []) as Conversacion[]).filter((c) => {
      if (puedeVerTodo(emp)) return true;
      if (c.tipo === "fisio_recepcion") return c.fisio_id === emp.id;
      return Boolean(c.cliente_id && permitidosSet.has(c.cliente_id));
    });

    setConversaciones(rows);

    setSelectedId((prev) => {
      if (
        prev &&
        (rows.some((r) => r.id === prev) ||
          (prev.startsWith("cliente:") && permitidosSet.has(prev.replace("cliente:", ""))))
      ) {
        return prev;
      }

      return rows[0]?.id || "";
    });
  }

  async function loadMensajes(conversacionId: string) {
    setLoadingChat(true);

    try {
      const { data, error } = await supabase
        .from("mensajes")
        .select("*")
        .eq("conversacion_id", conversacionId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMensajes((data || []) as Mensaje[]);
    } catch (err: any) {
      showAlert("error", "Error", err?.message || "No se pudo cargar el chat.");
    } finally {
      setLoadingChat(false);
    }
  }

  async function loadSolicitudes(
    emp: EmpleadoActual = empleado as EmpleadoActual,
    clientesBase: ClienteMini[] = clientes
  ) {
    let query = supabase
      .from("solicitudes_comunicacion")
      .select("*, clientes:cliente_id(id,nombre,telefono,email,terapeuta_id), fisios:fisio_id(id,nombre,rol,telefono,email)")
      .order("created_at", { ascending: false })
      .limit(150);

    if (!puedeVerTodo(emp)) {
      const permitidos = idsClientesPermitidos(clientesBase);

      if (permitidos.length === 0) {
        setSolicitudes([]);
        return;
      }

      query = query.in("cliente_id", permitidos);
    }

    const { data, error } = await query;
    if (error) throw error;

    const permitidosSet = new Set(idsClientesPermitidos(clientesBase));

    const rows = ((data || []) as Solicitud[]).filter((s) => {
      if (puedeVerTodo(emp)) return true;

      return Boolean(
        s.cliente_id &&
          permitidosSet.has(s.cliente_id) &&
          solicitudVisibleParaFisio(s)
      );
    });

    setSolicitudes(rows);
  }

  async function ensureConversacion(): Promise<string | null> {
    if (selected) return selected.id;
    if (!clienteDirectoId || !empleado) return null;

    const { data: ex } = await supabase
      .from("conversaciones")
      .select("id")
      .eq("tipo", "cliente_recepcion")
      .eq("cliente_id", clienteDirectoId)
      .eq("archivada", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ex?.id) {
      await loadConversaciones();
      setSelectedId(ex.id);
      return ex.id;
    }

    const { data, error } = await supabase
      .from("conversaciones")
      .insert({
        tipo: "cliente_recepcion",
        titulo: clienteDirecto?.nombre || "Conversación",
        cliente_id: clienteDirectoId,
        fisio_id: null,
        recepcionista_id: empleado.id,
        created_by: empleado.id,
      })
      .select("id")
      .single();

    if (error) throw error;

    await loadConversaciones();
    setSelectedId(data.id);

    return data.id;
  }

  async function enviarMensaje() {
    if (!empleado || !texto.trim()) return;

    const body = texto.trim();
    const remitenteTipo = roleToSender(empleado.rol);

    setTexto("");

    try {
      const convId = await ensureConversacion();
      if (!convId) return;

      const temp: Mensaje = {
        id: `temp-${Date.now()}`,
        conversacion_id: convId,
        remitente_id: empleado.id,
        remitente_tipo: remitenteTipo,
        mensaje: body,
        tipo: "texto",
        archivo_url: null,
        archivo_nombre: null,
        solicitud_id: null,
        editado: false,
        eliminado: false,
        created_at: new Date().toISOString(),
        updated_at: null,
      };

      setMensajes((prev) => mergeMensaje(prev, temp));

      const { data, error } = await supabase
        .from("mensajes")
        .insert({
          conversacion_id: convId,
          remitente_id: empleado.id,
          remitente_tipo: remitenteTipo,
          mensaje: body,
          tipo: "texto",
        })
        .select()
        .single();

      if (error) {
        setMensajes((prev) => prev.filter((m) => m.id !== temp.id));
        setTexto(body);
        showAlert("error", "Error", error.message);
      } else if (data) {
        setMensajes((prev) => mergeMensaje(prev, data as Mensaje));
        void loadConversaciones();
      }
    } catch (err: any) {
      setTexto(body);
      showAlert("error", "Error", err?.message || "No se pudo enviar.");
    }
  }

  async function actualizarSolicitud(id: string, estado: SolicitudEstado) {
    if (!empleado) return;

    const finalizada = ["aprobada", "rechazada", "resuelta", "cancelada"].includes(estado);

    const { error } = await supabase
      .from("solicitudes_comunicacion")
      .update({
        estado,
        resuelto_at: finalizada ? new Date().toISOString() : null,
        resuelto_por: empleado.id,
      })
      .eq("id", id);

    if (error) {
      showAlert("error", "Error", error.message);
      return;
    }

    setSolicitudes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, estado, resuelto_por: empleado.id } : s))
    );

    showAlert("success", "Listo", "Solicitud actualizada.");
  }

  async function crearConversacionParaSolicitud(form: NuevaSolicitudState) {
    const tipo: ConversacionTipo =
      form.cliente_id && form.fisio_id
        ? "cliente_fisio"
        : form.cliente_id
          ? "cliente_recepcion"
          : "fisio_recepcion";

    let q = supabase
      .from("conversaciones")
      .select("id")
      .eq("tipo", tipo)
      .eq("archivada", false);

    q = form.cliente_id ? q.eq("cliente_id", form.cliente_id) : q.is("cliente_id", null);
    q = form.fisio_id ? q.eq("fisio_id", form.fisio_id) : q.is("fisio_id", null);

    const { data: ex } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (ex?.id) return ex.id as string;

    const cliente = clientes.find((c) => c.id === form.cliente_id);
    const fisio = fisios.find((f) => f.id === form.fisio_id);

    const { data, error } = await supabase
      .from("conversaciones")
      .insert({
        tipo,
        titulo: cliente?.nombre || fisio?.nombre || "Comunicación interna",
        cliente_id: form.cliente_id || null,
        fisio_id: form.fisio_id || null,
        recepcionista_id: empleado?.id || null,
        created_by: empleado?.id || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return data.id as string;
  }

  async function crearSolicitud() {
    if (!empleado) return;

    if (!nuevaSolicitud.descripcion.trim()) {
      showAlert("warning", "Falta info", "Escribe el detalle.");
      return;
    }

    setSavingSolicitud(true);

    try {
      const convId = await crearConversacionParaSolicitud(nuevaSolicitud);
      const titulo = nuevaSolicitud.titulo.trim() || SOLICITUD_LABELS[nuevaSolicitud.tipo];

      const { data: sol, error } = await supabase
        .from("solicitudes_comunicacion")
        .insert({
          conversacion_id: convId,
          cliente_id: nuevaSolicitud.cliente_id || null,
          fisio_id: nuevaSolicitud.fisio_id || null,
          tipo: nuevaSolicitud.tipo,
          estado: "pendiente",
          origen_tipo: roleToSender(empleado.rol),
          origen_id: empleado.id,
          destino_tipo: "recepcion",
          destino_id: null,
          titulo,
          descripcion: nuevaSolicitud.descripcion.trim(),
        })
        .select("id")
        .single();

      if (error) throw error;

      await supabase.from("mensajes").insert({
        conversacion_id: convId,
        remitente_id: empleado.id,
        remitente_tipo: roleToSender(empleado.rol),
        tipo: "solicitud",
        solicitud_id: sol.id,
        mensaje: `${titulo}: ${nuevaSolicitud.descripcion.trim()}`,
      });

      setNuevaSolicitud(NUEVA_SOLICITUD_INICIAL);
      setShowNuevaSolicitud(false);
      setSelectedId(convId);

      await Promise.all([loadSolicitudes(), loadConversaciones(), loadMensajes(convId)]);

      showAlert("success", "Listo", "Solicitud creada.");
      setVistaMovil("chat");
    } catch (err: any) {
      showAlert("error", "Error", err?.message || "No se pudo crear la solicitud.");
    } finally {
      setSavingSolicitud(false);
    }
  }

  const listaEntries = useMemo<ListEntry[]>(() => {
    const q = normalize(busqueda);

    const clientesConConv = new Set(
      conversaciones
        .map((c) => c.cliente_id)
        .filter((id): id is string => Boolean(id))
    );

    const convEntries: ListEntry[] = conversaciones
      .filter((c) => {
        const cliente = firstOrNull(c.clientes);
        const fisio = firstOrNull(c.fisios);

        const matchTipo = tipoFiltro === "todas" || c.tipo === tipoFiltro;

        const matchQ =
          !q ||
          [c.titulo, c.ultimo_mensaje, cliente?.nombre, cliente?.telefono, fisio?.nombre].some(
            (v) => normalize(v).includes(q)
          );

        return matchTipo && matchQ;
      })
      .map((c) => ({ kind: "conversacion" as const, data: c }));

    const sinConvEntries: ListEntry[] =
      tipoFiltro === "todas" || tipoFiltro === "cliente_recepcion"
        ? clientes
            .filter((c) => {
              const id = c.id;
              if (!id) return false;

              const matchBusqueda =
                !q ||
                normalize(c.nombre).includes(q) ||
                normalize(c.telefono).includes(q) ||
                normalize(c.email).includes(q);

              return !clientesConConv.has(id) && matchBusqueda;
            })
            .map((c) => ({ kind: "cliente_sin_conv" as const, cliente: c }))
        : [];

    return [...convEntries, ...sinConvEntries];
  }, [conversaciones, clientes, busqueda, tipoFiltro]);

  const solicitudesFiltradas = useMemo(() => {
    return solicitudes.filter((s) => {
      const q = normalize(busqueda);
      const cliente = firstOrNull(s.clientes);
      const fisio = firstOrNull(s.fisios);

      const matchE = estadoFiltro === "todas" || s.estado === estadoFiltro;

      const matchQ =
        !q ||
        [s.titulo, s.descripcion, SOLICITUD_LABELS[s.tipo], cliente?.nombre, fisio?.nombre].some(
          (v) => normalize(v).includes(q)
        );

      return matchE && matchQ;
    });
  }, [solicitudes, busqueda, estadoFiltro]);

  const stats = useMemo(
    () => ({
      pendientes: solicitudes.filter((s) => s.estado === "pendiente").length,
      revision: solicitudes.filter((s) => s.estado === "en_revision").length,
      resueltas: solicitudes.filter((s) => s.estado === "resuelta" || s.estado === "aprobada")
        .length,
      chatsActivos: conversaciones.length,
    }),
    [solicitudes, conversaciones]
  );

  const entryId = (e: ListEntry) =>
    e.kind === "cliente_sin_conv" ? `cliente:${e.cliente.id}` : e.data.id;

  const entryName = (e: ListEntry) => {
    if (e.kind === "cliente_sin_conv") return e.cliente.nombre || "Cliente";

    return e.data.tipo === "fisio_recepcion"
      ? firstOrNull(e.data.fisios)?.nombre || e.data.titulo || "Fisio"
      : firstOrNull(e.data.clientes)?.nombre || e.data.titulo || "Cliente";
  };

  const entrySub = (e: ListEntry) =>
    e.kind === "cliente_sin_conv" ? "Sin mensajes" : tipoConversacionLabel(e.data.tipo);

  const entryLastMsg = (e: ListEntry) =>
    e.kind === "conversacion" ? e.data.ultimo_mensaje || "" : "";

  const entryTime = (e: ListEntry) =>
    e.kind === "conversacion" ? formatRelative(e.data.ultima_actividad_at) : "";

  const entryActive = (e: ListEntry) => entryId(e) === selectedId;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="text-center">
          <div
            className="mx-auto mb-4 h-7 w-7 animate-spin rounded-full"
            style={{ border: "2px solid var(--purple-soft)", borderTopColor: "var(--purple)" }}
          />
          <p className="text-sm rpm-muted">Cargando comunicación…</p>
        </div>
      </div>
    );
  }

  const buscadorEl = (
    <div
      className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2.5"
      style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
    >
      <Search className="h-4 w-4 shrink-0" style={{ color: "var(--text-sub)" }} />
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar…"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        style={{ color: "var(--text)" }}
      />
    </div>
  );

  const filtrosBarra = (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
      {[
        ["todas", "Todos"],
        ["cliente_recepcion", "Recepción"],
        ["cliente_fisio", "Cl/Fisio"],
        ["fisio_recepcion", "Fi/Rec"],
      ].map(([k, l]) => (
        <button
          key={k}
          type="button"
          onClick={() => setTipoFiltro(k as "todas" | ConversacionTipo)}
          className="shrink-0 rounded-full px-4 py-1.5 text-xs font-black transition"
          style={
            tipoFiltro === k
              ? { background: "var(--purple)", color: "#fff" }
              : {
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  color: "var(--text-sub)",
                }
          }
        >
          {l}
        </button>
      ))}
    </div>
  );

  const listaItems = (
    <>
      {listaEntries.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm rpm-muted">Sin resultados</div>
      ) : (
        listaEntries.map((entry) => {
          const name = entryName(entry);
          const active = entryActive(entry);
          const sinConv = entry.kind === "cliente_sin_conv";

          return (
            <button
              key={entryId(entry)}
              type="button"
              onClick={() => {
                setSelectedId(entryId(entry));
                setVistaMovil("chat");
              }}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition"
              style={{
                borderBottom: "1px solid var(--border)",
                background: active ? "var(--purple-soft)" : "transparent",
              }}
            >
              <Avatar name={name} size="md" />

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p
                    className="truncate text-sm font-bold"
                    style={{ color: active ? "var(--accent)" : "var(--text)" }}
                  >
                    {name}
                  </p>

                  {entryTime(entry) && (
                    <span className="shrink-0 text-[10px] rpm-muted">{entryTime(entry)}</span>
                  )}
                </div>

                <p className="mt-0.5 text-[11px] font-semibold" style={{ color: "var(--accent)", opacity: 0.65 }}>
                  {entrySub(entry)}
                </p>

                {entryLastMsg(entry) ? (
                  <p className="mt-0.5 truncate text-xs rpm-muted">{entryLastMsg(entry)}</p>
                ) : (
                  sinConv && <p className="mt-0.5 text-xs italic rpm-muted">Sin mensajes aún</p>
                )}
              </div>

              {active && <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--purple)" }} />}
            </button>
          );
        })
      )}

      <div className="h-24" />
    </>
  );

  const mensajesEl = (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
      {loadingChat ? (
        <div className="flex h-full items-center justify-center">
          <div
            className="h-6 w-6 animate-spin rounded-full"
            style={{ border: "2px solid var(--purple-soft)", borderTopColor: "var(--purple)" }}
          />
        </div>
      ) : clienteDirecto && mensajes.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--purple-soft)" }}>
            <MessageCircle className="h-6 w-6" style={{ color: "var(--accent)" }} />
          </div>
          <p className="text-sm rpm-muted">Escribe el primer mensaje a {clienteDirecto.nombre?.split(" ")[0]}</p>
        </div>
      ) : mensajes.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--surface2)" }}>
            <MessageCircle className="h-6 w-6 rpm-muted" />
          </div>
          <p className="text-sm rpm-muted">Sin mensajes todavía</p>
        </div>
      ) : (
        mensajes.map((m) => {
          const mine = m.remitente_id === empleado?.id;

          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`flex max-w-[78%] flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                {m.tipo === "solicitud" && (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase"
                    style={{ background: "rgba(251,191,36,0.12)", color: "#d97706" }}
                  >
                    Solicitud
                  </span>
                )}

                <div
                  className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
                  style={
                    mine
                      ? { background: "var(--purple)", color: "#fff", borderBottomRightRadius: 4 }
                      : {
                          background: "var(--surface2)",
                          color: "var(--text)",
                          border: "1px solid var(--border)",
                          borderBottomLeftRadius: 4,
                        }
                  }
                >
                  {m.eliminado ? <span className="italic rpm-muted">Mensaje eliminado</span> : m.mensaje}
                </div>

                <span className="text-[10px] rpm-muted">
                  {isTempId(m.id) ? "Enviando…" : formatHour(m.created_at)}
                </span>
              </div>
            </div>
          );
        })
      )}

      <div ref={bottomRef} />
      <div className="h-4" />
    </div>
  );

  const inputMensaje = (
    <div className="px-3 py-3" style={{ borderTop: "1px solid var(--border)" }}>
      <div
        className="flex items-center gap-2 rounded-2xl px-4 py-2"
        style={{ background: "var(--surface2)", border: "1px solid var(--border)" }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void enviarMensaje();
            }
          }}
          disabled={!selectedId}
          placeholder={selectedId ? "Escribe un mensaje…" : "Selecciona una conversación"}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none disabled:opacity-40"
          style={{ color: "var(--text)" }}
        />

        <button
          type="button"
          onClick={() => void enviarMensaje()}
          disabled={!selectedId || !texto.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-35"
          style={{ background: "var(--purple)" }}
        >
          <Send className="h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  );

  const statsRow = (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {[
        { label: "Pend.", val: stats.pendientes, color: "#d97706", bg: "rgba(251,191,36,0.08)" },
        { label: "Rev.", val: stats.revision, color: "#0284c7", bg: "rgba(56,189,248,0.08)" },
        { label: "OK", val: stats.resueltas, color: "var(--green)", bg: "rgba(52,211,153,0.08)" },
      ].map(({ label, val, color, bg }) => (
        <div key={label} className="rounded-xl py-2 text-center" style={{ background: bg }}>
          <p className="text-xl font-black" style={{ color }}>
            {val}
          </p>
          <p className="text-[10px] font-black uppercase" style={{ color, opacity: 0.6 }}>
            {label}
          </p>
        </div>
      ))}
    </div>
  );

  const filtrosEstado = (
    <div className="mt-3 flex gap-1.5">
      {[
        ["pendiente", "Pendientes"],
        ["en_revision", "Revisión"],
        ["todas", "Todas"],
      ].map(([k, l]) => (
        <button
          key={k}
          type="button"
          onClick={() => setEstadoFiltro(k as "pendiente" | "en_revision" | "todas")}
          className="shrink-0 rounded-full px-3 py-1 text-[11px] font-black transition"
          style={
            estadoFiltro === k
              ? { background: "var(--text)", color: "var(--bg)" }
              : {
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  color: "var(--text-sub)",
                }
          }
        >
          {l}
        </button>
      ))}
    </div>
  );

  const solicitudesItems = (isMobile = false) =>
    solicitudesFiltradas.length === 0 ? (
      <div className="p-6 text-center text-sm rpm-muted">Sin solicitudes</div>
    ) : (
      solicitudesFiltradas.map((s) => {
        const cliente = firstOrNull(s.clientes);
        const fisio = firstOrNull(s.fisios);

        return (
          <article key={s.id} className="glass-card rounded-[1.2rem] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{SOLICITUD_LABELS[s.tipo] || s.titulo}</p>
                <p className="mt-0.5 truncate text-[11px] rpm-muted">
                  {cliente?.nombre || "—"}
                  {fisio?.nombre ? ` · ${fisio.nombre}` : ""}
                </p>
              </div>

              <span
                className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase"
                style={estadoBadgeStyle(s.estado)}
              >
                {s.estado.replace("_", " ")}
              </span>
            </div>

            <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed rpm-muted">{s.descripcion}</p>
            <p className="mt-1.5 text-[10px] rpm-muted">{formatDateTime(s.created_at)}</p>

            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {[
                {
                  est: "en_revision",
                  icon: <Clock3 key="cr" className="h-3.5 w-3.5" />,
                  bg: "rgba(56,189,248,0.1)",
                  border: "rgba(56,189,248,0.2)",
                  color: "#0284c7",
                },
                {
                  est: "resuelta",
                  icon: <CheckCircle2 key="ck" className="h-3.5 w-3.5" />,
                  bg: "rgba(52,211,153,0.1)",
                  border: "rgba(52,211,153,0.2)",
                  color: "var(--green)",
                },
                {
                  est: "rechazada",
                  icon: <XCircle key="xc" className="h-3.5 w-3.5" />,
                  bg: "rgba(248,113,113,0.1)",
                  border: "rgba(248,113,113,0.2)",
                  color: "var(--red)",
                },
              ].map((item) => (
                <button
                  key={item.est}
                  type="button"
                  onClick={() => void actualizarSolicitud(s.id, item.est as SolicitudEstado)}
                  className="flex items-center justify-center rounded-xl py-2.5 transition"
                  style={{
                    background: item.bg,
                    border: `1px solid ${item.border}`,
                    color: item.color,
                  }}
                >
                  {item.icon}
                </button>
              ))}

              <button
                type="button"
                disabled={!s.conversacion_id}
                onClick={() => {
                  if (s.conversacion_id) {
                    setSelectedId(s.conversacion_id);
                    if (isMobile) setVistaMovil("chat");
                  }
                }}
                className="flex items-center justify-center rounded-xl py-2.5 transition disabled:opacity-30"
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  color: "var(--text-sub)",
                }}
              >
                <MessageCircle className="h-3.5 w-3.5" />
              </button>
            </div>
          </article>
        );
      })
    );

  const navInferiorMovil = (
    <nav
      className="safe-bottom"
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--nav-bg)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div className="grid grid-cols-2">
        {[
          { vista: "list" as VistaMovil, icon: <MessageCircle className="h-5 w-5" />, label: "Chats", badge: 0 },
          { vista: "solicitudes" as VistaMovil, icon: <Inbox className="h-5 w-5" />, label: "Solicitudes", badge: stats.pendientes },
        ].map(({ vista, icon, label, badge }) => (
          <button
            key={vista}
            type="button"
            onClick={() => setVistaMovil(vista)}
            className="flex flex-col items-center gap-1 py-3 text-[10px] font-black uppercase tracking-wider transition"
            style={{ color: vistaMovil === vista ? "var(--accent)" : "var(--text-sub)" }}
          >
            <div className="relative">
              {icon}
              {badge > 0 && (
                <span
                  className="absolute -top-1.5 -right-2 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white"
                  style={{ background: "var(--purple)" }}
                >
                  {badge}
                </span>
              )}
            </div>
            {label}
          </button>
        ))}
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: "var(--bg)", color: "var(--text)" }}>
      {alert && (
        <button
          type="button"
          onClick={() => setAlert(null)}
          className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-bold shadow-2xl backdrop-blur-xl md:bottom-auto md:right-4 md:top-4 md:left-auto md:translate-x-0"
          style={
            alert.type === "error"
              ? {
                  background: "rgba(248,113,113,0.12)",
                  border: "1px solid rgba(248,113,113,0.25)",
                  color: "var(--red)",
                }
              : alert.type === "success"
                ? {
                    background: "rgba(52,211,153,0.12)",
                    border: "1px solid rgba(52,211,153,0.25)",
                    color: "var(--green)",
                  }
                : alert.type === "warning"
                  ? {
                      background: "rgba(251,191,36,0.12)",
                      border: "1px solid rgba(251,191,36,0.25)",
                      color: "#d97706",
                    }
                  : {
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }
          }
        >
          <span className="font-black">{alert.title}</span>
          <span className="ml-2 opacity-70">{alert.message}</span>
        </button>
      )}

      <div className="hidden h-full md:flex" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex w-[300px] shrink-0 flex-col" style={{ borderRight: "1px solid var(--border)" }}>
          <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-black">Mensajes</h1>

              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => void Promise.all([loadConversaciones(), loadSolicitudes()])}
                  className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ color: "var(--text-sub)" }}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowNuevaSolicitud(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl"
                  style={{ background: "var(--purple-soft)", color: "var(--accent)" }}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {buscadorEl}
            {filtrosBarra}
          </div>

          <div className="flex-1 overflow-y-auto">{listaItems}</div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "1px solid var(--border)" }}>
            {selectedId ? (
              <>
                <Avatar name={tituloChat} size="md" />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-black">{tituloChat}</p>
                  <p className="text-xs rpm-muted">{subtituloChat}</p>
                </div>

                {selectedCliente?.telefono && (
                  <a
                    href={wa(selectedCliente.telefono)}
                    target="_blank"
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{
                      background: "rgba(52,211,153,0.1)",
                      border: "1px solid rgba(52,211,153,0.2)",
                      color: "var(--green)",
                    }}
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </>
            ) : (
              <p className="text-sm rpm-muted">Selecciona una conversación</p>
            )}
          </div>

          {mensajesEl}
          {inputMensaje}
        </div>

        <div className="flex w-[340px] shrink-0 flex-col" style={{ borderLeft: "1px solid var(--border)" }}>
          <div className="px-4 pt-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black">Solicitudes</h2>
                <p className="text-xs rpm-muted">Bandeja operativa</p>
              </div>

              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: "rgba(251,191,36,0.1)", color: "#d97706" }}
              >
                <Bell className="h-4 w-4" />
              </div>
            </div>

            {statsRow}
            {filtrosEstado}
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">{solicitudesItems()}</div>
        </div>
      </div>

      <div className="flex h-full flex-col md:hidden">
        {vistaMovil === "list" && (
          <div className="flex h-full flex-col">
            <div className="px-4 pt-12 pb-3 safe-top" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-black">Chats</h1>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void Promise.all([loadConversaciones(), loadSolicitudes()])}
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ color: "var(--text-sub)" }}
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowNuevaSolicitud(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: "var(--purple-soft)", color: "var(--accent)" }}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {buscadorEl}
              {filtrosBarra}
            </div>

            <div className="flex-1 overflow-y-auto">{listaItems}</div>
            {navInferiorMovil}
          </div>
        )}

        {vistaMovil === "chat" && (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 px-3 pt-12 pb-3 safe-top" style={{ borderBottom: "1px solid var(--border)" }}>
              <button
                type="button"
                onClick={() => setVistaMovil("list")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ color: "var(--text-sub)" }}
              >
                <ArrowLeft className="h-5 w-5" />
              </button>

              {selectedId && <Avatar name={tituloChat} size="sm" />}

              <div className="min-w-0 flex-1">
                <p className="truncate font-black leading-tight">{tituloChat}</p>
                <p className="text-[11px] rpm-muted">{subtituloChat}</p>
              </div>

              {selectedCliente?.telefono && (
                <a
                  href={wa(selectedCliente.telefono)}
                  target="_blank"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: "rgba(52,211,153,0.1)",
                    border: "1px solid rgba(52,211,153,0.2)",
                    color: "var(--green)",
                  }}
                >
                  <Phone className="h-4 w-4" />
                </a>
              )}
            </div>

            {mensajesEl}
            {inputMensaje}
          </div>
        )}

        {vistaMovil === "solicitudes" && (
          <div className="flex h-full flex-col">
            <div className="px-4 pt-12 pb-3 safe-top" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black">Solicitudes</h2>
                  <p className="text-xs rpm-muted">Bandeja operativa interna</p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowNuevaSolicitud(true)}
                  className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-black"
                  style={{
                    background: "var(--purple-soft)",
                    border: "1px solid var(--border-hover)",
                    color: "var(--accent)",
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nueva
                </button>
              </div>

              {statsRow}
              {filtrosEstado}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">{solicitudesItems(true)}</div>
            {navInferiorMovil}
          </div>
        )}
      </div>

      {showNuevaSolicitud && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="w-full max-w-xl rounded-t-[2rem] p-5 shadow-2xl md:rounded-[1.5rem]"
            style={{ background: "var(--bg2)", border: "1px solid var(--border)" }}
          >
            <div className="mb-1 mx-auto flex h-1 w-10 rounded-full md:hidden" style={{ background: "var(--border-hover)" }} />

            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-black">Nueva solicitud</p>
                <p className="text-xs rpm-muted">Queda registrada en el chat correspondiente.</p>
              </div>

              <button
                type="button"
                onClick={() => setShowNuevaSolicitud(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl rpm-muted"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {[
                {
                  label: "Tipo",
                  field: "tipo" as const,
                  options: TIPOS_SOLICITUD.map((t) => ({ value: t, label: SOLICITUD_LABELS[t] })),
                },
                {
                  label: "Cliente",
                  field: "cliente_id" as const,
                  options: [
                    { value: "", label: "Sin cliente" },
                    ...clientes.map((c) => ({ value: c.id, label: c.nombre || "" })),
                  ],
                },
                {
                  label: "Fisio",
                  field: "fisio_id" as const,
                  options: [
                    { value: "", label: "Sin fisio" },
                    ...fisios.map((f) => ({ value: f.id, label: `${f.nombre || "Sin nombre"} · ${f.rol || "rol"}` })),
                  ],
                },
              ].map(({ label, field, options }) => (
                <label key={field} className="block">
                  <span className="rpm-label mb-1.5 block">{label}</span>

                  <select
                    value={nuevaSolicitud[field]}
                    onChange={(e) =>
                      setNuevaSolicitud((p) => ({
                        ...p,
                        [field]: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl px-3 py-3 text-sm outline-none"
                    style={{
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                    }}
                  >
                    {options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              <label className="block">
                <span className="rpm-label mb-1.5 block">Título opcional</span>

                <input
                  value={nuevaSolicitud.titulo}
                  onChange={(e) =>
                    setNuevaSolicitud((p) => ({
                      ...p,
                      titulo: e.target.value,
                    }))
                  }
                  placeholder="Ej: cambio de horario"
                  className="w-full rounded-2xl px-3 py-3 text-sm outline-none"
                  style={{
                    background: "var(--surface2)",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                  }}
                />
              </label>
            </div>

            <label className="mt-3 block">
              <span className="rpm-label mb-1.5 block">Detalle *</span>

              <textarea
                value={nuevaSolicitud.descripcion}
                onChange={(e) =>
                  setNuevaSolicitud((p) => ({
                    ...p,
                    descripcion: e.target.value,
                  }))
                }
                rows={4}
                placeholder="Escribe el detalle…"
                className="w-full resize-none rounded-2xl px-3 py-3 text-sm outline-none"
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                }}
              />
            </label>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowNuevaSolicitud(false)}
                disabled={savingSolicitud}
                className="flex-1 rounded-2xl py-3 text-sm font-bold disabled:opacity-50"
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  color: "var(--text-sub)",
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void crearSolicitud()}
                disabled={savingSolicitud}
                className="flex-1 rounded-2xl py-3 text-sm font-black disabled:opacity-50"
                style={{ background: "var(--purple)", color: "#fff" }}
              >
                {savingSolicitud ? "Guardando…" : "Crear solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}