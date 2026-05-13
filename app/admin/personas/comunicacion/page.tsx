"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MessageCircle,
  Phone,
  RefreshCcw,
  Search,
  Send,
  UserRound,
  UsersRound,
  XCircle,
  Inbox,
  Hash,
  Plus,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type ParticipanteTipo = "cliente" | "fisio" | "recepcion" | "admin" | "sistema";
type ConversacionTipo =
  | "cliente_fisio"
  | "cliente_recepcion"
  | "fisio_recepcion"
  | "grupo";
type MensajeTipo =
  | "texto"
  | "imagen"
  | "video"
  | "audio"
  | "archivo"
  | "sistema"
  | "solicitud";
type SolicitudEstado =
  | "pendiente"
  | "en_revision"
  | "aprobada"
  | "rechazada"
  | "resuelta"
  | "cancelada";
type SolicitudTipo =
  | "solicitar_cita"
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

type ClienteMini = { id?: string | null; nombre?: string | null; telefono?: string | null; email?: string | null };
type EmpleadoMini = { id?: string | null; nombre?: string | null; rol?: string | null; telefono?: string | null; email?: string | null };
type EmpleadoActual = { id: string; nombre: string | null; rol: string | null; auth_user_id: string | null };

type Conversacion = {
  id: string; tipo: ConversacionTipo; titulo: string | null; cliente_id: string | null;
  fisio_id: string | null; recepcionista_id: string | null; ultima_actividad_at: string | null;
  ultimo_mensaje: string | null; archivada: boolean | null; fijada: boolean | null;
  created_at: string | null;
  clientes?: ClienteMini | ClienteMini[] | null;
  fisios?: EmpleadoMini | EmpleadoMini[] | null;
  recepcionistas?: EmpleadoMini | EmpleadoMini[] | null;
};

type Mensaje = {
  id: string; conversacion_id: string; remitente_id: string; remitente_tipo: ParticipanteTipo;
  mensaje: string | null; tipo: MensajeTipo; archivo_url: string | null; archivo_nombre: string | null;
  solicitud_id: string | null; editado: boolean | null; eliminado: boolean | null;
  created_at: string; updated_at: string | null;
};

type Solicitud = {
  id: string; conversacion_id: string | null; cita_id: string | null; cliente_id: string | null;
  fisio_id: string | null; tipo: SolicitudTipo; estado: SolicitudEstado; origen_tipo: ParticipanteTipo;
  origen_id: string; destino_tipo: ParticipanteTipo; destino_id: string | null; titulo: string;
  descripcion: string; comentario_resolucion: string | null; created_at: string; updated_at: string | null;
  resuelto_at: string | null; resuelto_por: string | null;
  clientes?: ClienteMini | ClienteMini[] | null;
  fisios?: EmpleadoMini | EmpleadoMini[] | null;
};

type AlertState = { type: "success" | "error" | "info" | "warning"; title: string; message: string } | null;
type NuevaSolicitudState = { tipo: SolicitudTipo; cliente_id: string; fisio_id: string; titulo: string; descripcion: string };

// Vista actual en móvil: "list" | "chat" | "solicitudes"
type VistaMovil = "list" | "chat" | "solicitudes";

const NUEVA_SOLICITUD_INICIAL: NuevaSolicitudState = { tipo: "otro", cliente_id: "", fisio_id: "", titulo: "", descripcion: "" };

const SOLICITUD_LABELS: Record<SolicitudTipo, string> = {
  solicitar_cita: "Solicitud de cita", reagendar_cita: "Reagendar cita", cancelar_cita: "Cancelar cita",
  cambio_horario: "Cambio de horario", cambio_fisio: "Cambio de fisio",
  aviso_no_asistencia_cliente: "Aviso no asistencia", ausencia_fisio: "Ausencia fisio",
  bloqueo_horario: "Bloqueo horario", consulta_pago: "Consulta pago",
  consulta_clinica: "Consulta clínica", otro: "General",
};

const TIPOS_SOLICITUD: SolicitudTipo[] = [
  "solicitar_cita","reagendar_cita","cancelar_cita","cambio_horario","cambio_fisio",
  "aviso_no_asistencia_cliente","ausencia_fisio","bloqueo_horario","consulta_pago","consulta_clinica","otro",
];

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalize(value: string | null | undefined) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  try { return new Date(value).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return value; }
}

function formatHour(value: string | null | undefined) {
  if (!value) return "";
  try { return new Date(value).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

function formatRelative(value: string | null | undefined) {
  if (!value) return "";
  try {
    const d = new Date(value);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    if (days === 1) return "Ayer";
    if (days < 7) return d.toLocaleDateString("es-ES", { weekday: "short" });
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
  } catch { return ""; }
}

function initials(name?: string | null) {
  const parts = (name || "RPM").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "R";
}

function wa(phone?: string | null) {
  const clean = (phone || "").replace(/[^0-9]/g, "");
  return clean ? `https://wa.me/${clean}` : "#";
}

function estadoClass(estado: SolicitudEstado | string) {
  switch (estado) {
    case "pendiente": return "bg-amber-400/15 text-amber-300 border-amber-400/20";
    case "en_revision": return "bg-sky-400/15 text-sky-300 border-sky-400/20";
    case "aprobada": case "resuelta": return "bg-emerald-400/15 text-emerald-300 border-emerald-400/20";
    case "rechazada": case "cancelada": return "bg-rose-400/15 text-rose-300 border-rose-400/20";
    default: return "bg-white/5 text-white/40 border-white/10";
  }
}

function tipoConversacionLabel(tipo: ConversacionTipo) {
  if (tipo === "cliente_recepcion") return "Cliente · Recepción";
  if (tipo === "cliente_fisio") return "Cliente · Fisio";
  if (tipo === "fisio_recepcion") return "Fisio · Recepción";
  return "Grupo";
}

function roleToSender(rol: string | null | undefined): ParticipanteTipo {
  if ((rol || "").toLowerCase() === "admin") return "admin";
  if ((rol || "").toLowerCase() === "recepcionista") return "recepcion";
  return "fisio";
}

function dateValue(value?: string | null) {
  if (!value) return 0;
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : 0;
}

function isTempId(id: string) { return id.startsWith("temp-"); }

function samePendingMessage(a: Mensaje, b: Mensaje) {
  if (!isTempId(a.id)) return false;
  if (a.conversacion_id !== b.conversacion_id) return false;
  if (a.remitente_id !== b.remitente_id) return false;
  if (a.remitente_tipo !== b.remitente_tipo) return false;
  if (a.tipo !== b.tipo) return false;
  if ((a.mensaje || "").trim() !== (b.mensaje || "").trim()) return false;
  return Math.abs(new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) < 15000;
}

function mergeMensaje(prev: Mensaje[], msg: Mensaje) {
  if (prev.some((m) => m.id === msg.id)) return prev;
  const tempIndex = prev.findIndex((m) => samePendingMessage(m, msg));
  if (tempIndex >= 0) { const next = [...prev]; next[tempIndex] = msg; return next; }
  return [...prev, msg];
}

function conversationGroupKey(c: Conversacion) {
  if (c.tipo === "cliente_recepcion") return `cliente_recepcion:${c.cliente_id || "none"}`;
  if (c.tipo === "cliente_fisio") return `cliente_fisio:${c.cliente_id || "none"}:${c.fisio_id || "none"}`;
  if (c.tipo === "fisio_recepcion") return `fisio_recepcion:${c.fisio_id || "none"}:${c.recepcionista_id || "none"}`;
  return `${c.tipo}:${c.id}`;
}

function pickBetterConversation(a: Conversacion, b: Conversacion) {
  const aHasMessage = Boolean((a.ultimo_mensaje || "").trim());
  const bHasMessage = Boolean((b.ultimo_mensaje || "").trim());
  if (aHasMessage !== bHasMessage) return aHasMessage ? a : b;
  const aTime = dateValue(a.ultima_actividad_at || a.created_at);
  const bTime = dateValue(b.ultima_actividad_at || b.created_at);
  if (aTime !== bTime) return aTime > bTime ? a : b;
  return a;
}

function dedupeConversaciones(rows: Conversacion[]) {
  const map = new Map<string, Conversacion>();
  rows.forEach((row) => {
    const key = conversationGroupKey(row);
    const existing = map.get(key);
    map.set(key, existing ? pickBetterConversation(existing, row) : row);
  });
  return Array.from(map.values()).sort((a, b) =>
    dateValue(b.ultima_actividad_at || b.created_at) - dateValue(a.ultima_actividad_at || a.created_at),
  );
}

// Avatar con color hash basado en nombre
function avatarColor(name?: string | null) {
  const colors = [
    "from-violet-500 to-purple-600",
    "from-sky-500 to-blue-600",
    "from-emerald-500 to-teal-600",
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
    "from-indigo-500 to-violet-600",
  ];
  const s = name || "?";
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) & 0xffff;
  return colors[hash % colors.length];
}

function Avatar({ name, size = "md" }: { name?: string | null; size?: "sm" | "md" | "lg" }) {
  const sz = size === "sm" ? "h-9 w-9 text-xs" : size === "lg" ? "h-14 w-14 text-base" : "h-11 w-11 text-sm";
  return (
    <div className={`${sz} shrink-0 rounded-full bg-gradient-to-br ${avatarColor(name)} flex items-center justify-center font-black text-white shadow-lg`}>
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
  const [nuevaSolicitud, setNuevaSolicitud] = useState<NuevaSolicitudState>(NUEVA_SOLICITUD_INICIAL);
  const [savingSolicitud, setSavingSolicitud] = useState(false);

  // Vista móvil: list = lista de chats, chat = conversación, solicitudes = bandeja
  const [vistaMovil, setVistaMovil] = useState<VistaMovil>("list");

  const selected = conversaciones.find((c) => c.id === selectedId) || null;
  const selectedCliente = firstOrNull(selected?.clientes);
  const selectedFisio = firstOrNull(selected?.fisios);

  useEffect(() => { void boot(); }, []);

  useEffect(() => {
    if (!empleado?.id) return;
    const channel = supabase
      .channel("rpm-comunicacion-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "mensajes" }, (payload) => {
        const row = payload.new as Mensaje;
        if (!row?.id) return;
        setMensajes((prev) => {
          if (row.conversacion_id !== selectedId) return prev;
          return mergeMensaje(prev, row);
        });
        void loadConversaciones();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversaciones" }, () => { void loadConversaciones(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitudes_comunicacion" }, () => { void loadSolicitudes(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [empleado?.id, selectedId]);

  useEffect(() => { if (selectedId) void loadMensajes(selectedId); }, [selectedId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes.length, selectedId]);

  function showAlert(type: NonNullable<AlertState>["type"], title: string, message: string) {
    setAlert({ type, title, message });
    window.setTimeout(() => setAlert(null), 4200);
  }

  async function boot() {
    setLoading(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = auth.user?.id;
      if (!userId) throw new Error("No hay usuario autenticado.");
      const { data: emp, error: empError } = await supabase.from("empleados").select("id,nombre,rol,auth_user_id").eq("auth_user_id", userId).maybeSingle();
      if (empError) throw empError;
      if (!emp) throw new Error("Este usuario no tiene empleado vinculado.");
      setEmpleado(emp as EmpleadoActual);
      await Promise.all([loadCatalogos(), loadConversaciones(), loadSolicitudes()]);
    } catch (err: any) {
      showAlert("error", "Error", err?.message || "No se pudo cargar comunicación.");
    } finally { setLoading(false); }
  }

  async function loadCatalogos() {
    const [clientesRes, fisiosRes] = await Promise.all([
      supabase.from("clientes").select("id,nombre,telefono,email").neq("estado", "eliminado").order("nombre"),
      supabase.from("empleados").select("id,nombre,rol,telefono,email").in("rol", ["terapeuta", "recepcionista", "admin"]).eq("estado", "activo").order("nombre"),
    ]);
    if (clientesRes.error) throw clientesRes.error;
    if (fisiosRes.error) throw fisiosRes.error;
    setClientes((clientesRes.data || []) as ClienteMini[]);
    setFisios((fisiosRes.data || []) as EmpleadoMini[]);
  }

  async function loadConversaciones() {
    const { data, error } = await supabase
      .from("conversaciones")
      .select("*, clientes:cliente_id(id,nombre,telefono,email), fisios:fisio_id(id,nombre,rol,telefono,email), recepcionistas:recepcionista_id(id,nombre,rol)")
      .eq("archivada", false)
      .order("ultima_actividad_at", { ascending: false });
    if (error) throw error;
    const rows = dedupeConversaciones((data || []) as Conversacion[]);
    setConversaciones(rows);
    setSelectedId((prev) => {
      if (prev && rows.some((r) => r.id === prev)) return prev;
      return rows[0]?.id || "";
    });
  }

  async function loadMensajes(conversacionId: string) {
    setLoadingChat(true);
    try {
      const { data, error } = await supabase.from("mensajes").select("*").eq("conversacion_id", conversacionId).order("created_at", { ascending: true });
      if (error) throw error;
      setMensajes((data || []) as Mensaje[]);
    } catch (err: any) {
      showAlert("error", "Error", err?.message || "No se pudo cargar el chat.");
    } finally { setLoadingChat(false); }
  }

  async function loadSolicitudes() {
    const { data, error } = await supabase.from("solicitudes_comunicacion")
      .select("*, clientes:cliente_id(id,nombre,telefono,email), fisios:fisio_id(id,nombre,rol,telefono,email)")
      .order("created_at", { ascending: false }).limit(150);
    if (error) throw error;
    setSolicitudes((data || []) as Solicitud[]);
  }

  async function enviarMensaje() {
    if (!empleado || !selected || !texto.trim()) return;
    const body = texto.trim();
    const remitenteTipo = roleToSender(empleado.rol);
    setTexto("");
    const temp: Mensaje = {
      id: `temp-${Date.now()}`, conversacion_id: selected.id, remitente_id: empleado.id,
      remitente_tipo: remitenteTipo, mensaje: body, tipo: "texto", archivo_url: null,
      archivo_nombre: null, solicitud_id: null, editado: false, eliminado: false,
      created_at: new Date().toISOString(), updated_at: null,
    };
    setMensajes((prev) => mergeMensaje(prev, temp));
    const { data, error } = await supabase.from("mensajes")
      .insert({ conversacion_id: selected.id, remitente_id: empleado.id, remitente_tipo: remitenteTipo, mensaje: body, tipo: "texto" })
      .select().single();
    if (error) {
      setMensajes((prev) => prev.filter((m) => m.id !== temp.id));
      setTexto(body);
      showAlert("error", "Error", error.message);
    } else if (data) {
      setMensajes((prev) => mergeMensaje(prev, data as Mensaje));
      void loadConversaciones();
    }
  }

  async function actualizarSolicitud(id: string, estado: SolicitudEstado) {
    if (!empleado) return;
    const { error } = await supabase.from("solicitudes_comunicacion")
      .update({ estado, resuelto_at: ["aprobada","rechazada","resuelta","cancelada"].includes(estado) ? new Date().toISOString() : null, resuelto_por: empleado.id })
      .eq("id", id);
    if (error) { showAlert("error", "Error", error.message); return; }
    setSolicitudes((prev) => prev.map((s) => s.id === id ? { ...s, estado, resuelto_por: empleado.id } : s));
    showAlert("success", "Listo", "Solicitud actualizada.");
  }

  async function crearConversacionParaSolicitud(form: NuevaSolicitudState) {
    const tipo: ConversacionTipo = form.cliente_id && form.fisio_id ? "cliente_fisio" : form.cliente_id ? "cliente_recepcion" : "fisio_recepcion";
    let query = supabase.from("conversaciones").select("id").eq("tipo", tipo).eq("archivada", false);
    if (form.cliente_id) query = query.eq("cliente_id", form.cliente_id); else query = query.is("cliente_id", null);
    if (form.fisio_id) query = query.eq("fisio_id", form.fisio_id); else query = query.is("fisio_id", null);
    const { data: existente } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existente?.id) return existente.id as string;
    const cliente = clientes.find((c) => c.id === form.cliente_id);
    const fisio = fisios.find((f) => f.id === form.fisio_id);
    const { data, error } = await supabase.from("conversaciones")
      .insert({ tipo, titulo: cliente?.nombre || fisio?.nombre || "Comunicación interna", cliente_id: form.cliente_id || null, fisio_id: form.fisio_id || null, recepcionista_id: empleado?.id || null, created_by: empleado?.id || null })
      .select("id").single();
    if (error) throw error;
    return data.id as string;
  }

  async function crearSolicitud() {
    if (!empleado) return;
    if (!nuevaSolicitud.descripcion.trim()) { showAlert("warning", "Falta información", "Escribe el detalle de la solicitud."); return; }
    setSavingSolicitud(true);
    try {
      const conversacionId = await crearConversacionParaSolicitud(nuevaSolicitud);
      const titulo = nuevaSolicitud.titulo.trim() || SOLICITUD_LABELS[nuevaSolicitud.tipo];
      const { data: solicitud, error } = await supabase.from("solicitudes_comunicacion")
        .insert({ conversacion_id: conversacionId, cliente_id: nuevaSolicitud.cliente_id || null, fisio_id: nuevaSolicitud.fisio_id || null, tipo: nuevaSolicitud.tipo, estado: "pendiente", origen_tipo: roleToSender(empleado.rol), origen_id: empleado.id, destino_tipo: "recepcion", destino_id: null, titulo, descripcion: nuevaSolicitud.descripcion.trim() })
        .select("id").single();
      if (error) throw error;
      await supabase.from("mensajes").insert({ conversacion_id: conversacionId, remitente_id: empleado.id, remitente_tipo: roleToSender(empleado.rol), tipo: "solicitud", solicitud_id: solicitud.id, mensaje: `${titulo}: ${nuevaSolicitud.descripcion.trim()}` });
      setNuevaSolicitud(NUEVA_SOLICITUD_INICIAL);
      setShowNuevaSolicitud(false);
      setSelectedId(conversacionId);
      await Promise.all([loadSolicitudes(), loadConversaciones(), loadMensajes(conversacionId)]);
      showAlert("success", "Listo", "Solicitud creada.");
      setVistaMovil("chat");
    } catch (err: any) {
      showAlert("error", "Error", err?.message || "No se pudo crear la solicitud.");
    } finally { setSavingSolicitud(false); }
  }

  const conversacionesFiltradas = useMemo(() => {
    const q = normalize(busqueda);
    return conversaciones.filter((c) => {
      const cliente = firstOrNull(c.clientes);
      const fisio = firstOrNull(c.fisios);
      const matchTipo = tipoFiltro === "todas" || c.tipo === tipoFiltro;
      const matchQ = !q || [c.titulo, c.ultimo_mensaje, cliente?.nombre, cliente?.telefono, fisio?.nombre].some((v) => normalize(v).includes(q));
      return matchTipo && matchQ;
    });
  }, [conversaciones, busqueda, tipoFiltro]);

  const solicitudesFiltradas = useMemo(() => {
    const q = normalize(busqueda);
    return solicitudes.filter((s) => {
      const cliente = firstOrNull(s.clientes);
      const fisio = firstOrNull(s.fisios);
      const matchEstado = estadoFiltro === "todas" || s.estado === estadoFiltro;
      const matchQ = !q || [s.titulo, s.descripcion, SOLICITUD_LABELS[s.tipo], cliente?.nombre, cliente?.telefono, fisio?.nombre].some((v) => normalize(v).includes(q));
      return matchEstado && matchQ;
    });
  }, [solicitudes, busqueda, estadoFiltro]);

  const stats = useMemo(() => ({
    pendientes: solicitudes.filter((s) => s.estado === "pendiente").length,
    revision: solicitudes.filter((s) => s.estado === "en_revision").length,
    resueltas: solicitudes.filter((s) => s.estado === "resuelta" || s.estado === "aprobada").length,
    chatsActivos: conversaciones.length,
  }), [solicitudes, conversaciones]);

  const tituloChat = selected
    ? selected.tipo === "fisio_recepcion"
      ? firstOrNull(selected.fisios)?.nombre || selected.titulo || "Fisio"
      : firstOrNull(selected.clientes)?.nombre || selected.titulo || "Cliente"
    : "Chat";

  const subtituloChat = selected ? tipoConversacionLabel(selected.tipo) : "";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0d12]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-violet-400/20 border-t-violet-400" />
          <p className="text-sm text-white/35">Cargando comunicación…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0d0d12] text-white">
      {/* Toast alert */}
      {alert && (
        <button
          type="button"
          onClick={() => setAlert(null)}
          className={`fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border px-5 py-3 text-sm font-bold shadow-2xl backdrop-blur-xl md:bottom-auto md:right-4 md:top-4 md:left-auto md:translate-x-0 ${
            alert.type === "error" ? "border-rose-400/30 bg-rose-950/90 text-rose-200"
            : alert.type === "success" ? "border-emerald-400/30 bg-emerald-950/90 text-emerald-200"
            : alert.type === "warning" ? "border-amber-400/30 bg-amber-950/90 text-amber-200"
            : "border-sky-400/30 bg-sky-950/90 text-sky-200"
          }`}
        >
          <span className="font-black">{alert.title}</span>
          <span className="ml-2 opacity-70">{alert.message}</span>
        </button>
      )}

      {/* ─── LAYOUT DESKTOP: tres columnas ─── */}
      <div className="hidden h-full md:flex">
        {/* Col 1: lista de conversaciones */}
        <div className="flex w-[320px] shrink-0 flex-col border-r border-white/[0.06]">
          <div className="border-b border-white/[0.06] px-4 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-black tracking-tight">Mensajes</h1>
              <div className="flex gap-1">
                <button type="button" onClick={() => void Promise.all([loadConversaciones(), loadSolicitudes()])}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-white/35 transition hover:bg-white/[0.06] hover:text-white">
                  <RefreshCcw className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setShowNuevaSolicitud(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300 transition hover:bg-violet-500/30">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-white/25" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar…"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25" />
            </div>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {([["todas","Todos"],["cliente_recepcion","Recep."],["cliente_fisio","Cl/Fisio"],["fisio_recepcion","Fi/Rec"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setTipoFiltro(k)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black transition ${tipoFiltro === k ? "bg-violet-500 text-white" : "bg-white/[0.04] text-white/40 hover:bg-white/[0.07] hover:text-white/70"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversacionesFiltradas.length === 0 ? (
              <div className="p-6 text-center text-sm text-white/25">Sin conversaciones</div>
            ) : conversacionesFiltradas.map((c) => {
              const active = selectedId === c.id;
              const cliente = firstOrNull(c.clientes);
              const fisio = firstOrNull(c.fisios);
              const title = c.tipo === "fisio_recepcion" ? fisio?.nombre || c.titulo || "Fisio" : cliente?.nombre || c.titulo || "Cliente";
              return (
                <button key={c.id} type="button" onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition ${active ? "bg-violet-500/10" : "hover:bg-white/[0.03]"}`}>
                  <Avatar name={title} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`truncate text-sm font-bold ${active ? "text-violet-200" : "text-white"}`}>{title}</p>
                      <span className="shrink-0 text-[10px] text-white/25">{formatRelative(c.ultima_actividad_at)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-white/35">{c.ultimo_mensaje || "Sin mensajes"}</p>
                  </div>
                  {active && <div className="h-2 w-2 shrink-0 rounded-full bg-violet-400" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Col 2: chat */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header chat */}
          <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-3.5">
            {selected ? (
              <>
                <Avatar name={tituloChat} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black text-white">{tituloChat}</p>
                  <p className="text-xs text-white/35">{subtituloChat}</p>
                </div>
                {selectedCliente?.telefono && (
                  <a href={wa(selectedCliente.telefono)} target="_blank"
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 transition hover:bg-emerald-400/15">
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </>
            ) : (
              <p className="text-sm text-white/35">Selecciona una conversación</p>
            )}
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
            {loadingChat ? (
              <div className="flex h-full items-center justify-center text-sm text-white/35">Cargando…</div>
            ) : !selected ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
                  <MessageCircle className="h-7 w-7" />
                </div>
                <p className="text-sm text-white/35">Selecciona una conversación para ver los mensajes</p>
              </div>
            ) : mensajes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] text-white/25">
                  <MessageCircle className="h-7 w-7" />
                </div>
                <p className="text-sm text-white/35">Sin mensajes todavía</p>
              </div>
            ) : (
              mensajes.map((m) => {
                const mine = m.remitente_id === empleado?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`group relative max-w-[72%] ${mine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                      {m.tipo === "solicitud" && (
                        <span className="self-start rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-300">
                          Solicitud
                        </span>
                      )}
                      <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${mine ? "rounded-br-md bg-violet-500/25 text-white" : "rounded-bl-md bg-white/[0.06] text-white/85"}`}>
                        {m.eliminado ? <span className="italic text-white/35">Mensaje eliminado</span> : m.mensaje}
                      </div>
                      <span className={`text-[10px] ${mine ? "text-violet-300/40 self-end" : "text-white/25 self-start"}`}>
                        {isTempId(m.id) ? "Enviando…" : formatHour(m.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-2">
              <input value={texto} onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviarMensaje(); } }}
                disabled={!selected}
                placeholder={selected ? "Escribe un mensaje…" : "Selecciona una conversación"}
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-white outline-none placeholder:text-white/25 disabled:opacity-40" />
              <button type="button" onClick={() => void enviarMensaje()} disabled={!selected || !texto.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500 text-white shadow-md shadow-violet-950/40 transition hover:bg-violet-400 disabled:opacity-35">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Col 3: solicitudes */}
        <div className="flex w-[360px] shrink-0 flex-col border-l border-white/[0.06]">
          <div className="border-b border-white/[0.06] px-4 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black text-white">Solicitudes</h2>
                <p className="text-xs text-white/30">Bandeja operativa</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
                <Bell className="h-4 w-4" />
              </div>
            </div>
            {/* Stats row */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-amber-400/10 px-2 py-2 text-center">
                <p className="text-lg font-black text-amber-300">{stats.pendientes}</p>
                <p className="text-[10px] text-amber-300/60 uppercase font-black tracking-wide">Pend.</p>
              </div>
              <div className="rounded-xl bg-sky-400/10 px-2 py-2 text-center">
                <p className="text-lg font-black text-sky-300">{stats.revision}</p>
                <p className="text-[10px] text-sky-300/60 uppercase font-black tracking-wide">Rev.</p>
              </div>
              <div className="rounded-xl bg-emerald-400/10 px-2 py-2 text-center">
                <p className="text-lg font-black text-emerald-300">{stats.resueltas}</p>
                <p className="text-[10px] text-emerald-300/60 uppercase font-black tracking-wide">OK</p>
              </div>
            </div>
            <div className="mt-3 flex gap-1.5">
              {([["pendiente","Pendientes"],["en_revision","Revisión"],["todas","Todas"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setEstadoFiltro(k)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black transition ${estadoFiltro === k ? "bg-white text-slate-950" : "bg-white/[0.04] text-white/40 hover:text-white/70"}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {solicitudesFiltradas.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.06] p-5 text-center text-sm text-white/25">Sin solicitudes</div>
            ) : solicitudesFiltradas.map((s) => {
              const cliente = firstOrNull(s.clientes);
              const fisio = firstOrNull(s.fisios);
              return (
                <article key={s.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">{SOLICITUD_LABELS[s.tipo] || s.titulo}</p>
                      <p className="mt-0.5 truncate text-[11px] text-white/35">
                        {cliente?.nombre || "—"}{fisio?.nombre ? ` · ${fisio.nombre}` : ""}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${estadoClass(s.estado)}`}>
                      {s.estado.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-2.5 line-clamp-2 text-xs leading-relaxed text-white/55">{s.descripcion}</p>
                  <p className="mt-1.5 text-[10px] text-white/25">{formatDateTime(s.created_at)}</p>
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    <button type="button" onClick={() => void actualizarSolicitud(s.id, "en_revision")}
                      className="flex items-center justify-center gap-1 rounded-xl border border-sky-400/20 bg-sky-400/10 py-2 text-[10px] font-black text-sky-300 transition hover:bg-sky-400/15">
                      <Clock3 className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => void actualizarSolicitud(s.id, "resuelta")}
                      className="flex items-center justify-center gap-1 rounded-xl border border-emerald-400/20 bg-emerald-400/10 py-2 text-[10px] font-black text-emerald-300 transition hover:bg-emerald-400/15">
                      <CheckCircle2 className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => void actualizarSolicitud(s.id, "rechazada")}
                      className="flex items-center justify-center gap-1 rounded-xl border border-rose-400/20 bg-rose-400/10 py-2 text-[10px] font-black text-rose-300 transition hover:bg-rose-400/15">
                      <XCircle className="h-3 w-3" />
                    </button>
                    <button type="button" disabled={!s.conversacion_id}
                      onClick={() => s.conversacion_id && setSelectedId(s.conversacion_id)}
                      className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] py-2 text-[10px] font-black text-white/45 transition hover:bg-white/[0.07] disabled:opacity-30">
                      <MessageCircle className="h-3 w-3" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── LAYOUT MÓVIL: pantalla única con navegación ─── */}
      <div className="flex h-full flex-col md:hidden">

        {/* Vista: Lista de chats */}
        {vistaMovil === "list" && (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="border-b border-white/[0.06] px-4 pt-12 pb-3 safe-top">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-black tracking-tight">Chats</h1>
                <div className="flex gap-2">
                  <button type="button" onClick={() => void Promise.all([loadConversaciones(), loadSolicitudes()])}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-white/35 transition hover:bg-white/[0.06]">
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setShowNuevaSolicitud(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {/* Buscador */}
              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-4 py-3">
                <Search className="h-4 w-4 shrink-0 text-white/25" />
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar…"
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25" />
              </div>
              {/* Filtros scrollables */}
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {([["todas","Todos"],["cliente_recepcion","Recepción"],["cliente_fisio","Cl/Fisio"],["fisio_recepcion","Fi/Recep"]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setTipoFiltro(k)}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-black transition ${tipoFiltro === k ? "bg-violet-500 text-white" : "border border-white/[0.08] bg-white/[0.03] text-white/40"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto">
              {conversacionesFiltradas.length === 0 ? (
                <div className="flex h-40 items-center justify-center text-sm text-white/25">Sin conversaciones</div>
              ) : conversacionesFiltradas.map((c) => {
                const cliente = firstOrNull(c.clientes);
                const fisio = firstOrNull(c.fisios);
                const title = c.tipo === "fisio_recepcion" ? fisio?.nombre || c.titulo || "Fisio" : cliente?.nombre || c.titulo || "Cliente";
                return (
                  <button key={c.id} type="button"
                    onClick={() => { setSelectedId(c.id); setVistaMovil("chat"); }}
                    className="flex w-full items-center gap-3.5 border-b border-white/[0.04] px-4 py-4 text-left transition active:bg-white/[0.04]">
                    <Avatar name={title} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-bold text-white">{title}</p>
                        <span className="shrink-0 text-[10px] text-white/25">{formatRelative(c.ultima_actividad_at)}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-violet-300/50 font-semibold">{tipoConversacionLabel(c.tipo)}</p>
                      <p className="mt-0.5 truncate text-xs text-white/30">{c.ultimo_mensaje || "Sin mensajes"}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/15" />
                  </button>
                );
              })}
              <div className="h-24" />
            </div>
          </div>
        )}

        {/* Vista: Chat activo */}
        {vistaMovil === "chat" && (
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-3 pt-12 pb-3 safe-top">
              <button type="button" onClick={() => setVistaMovil("list")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/50 transition active:bg-white/[0.06]">
                <ArrowLeft className="h-5 w-5" />
              </button>
              {selected && <Avatar name={tituloChat} size="sm" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-white leading-tight">{tituloChat}</p>
                <p className="text-[11px] text-white/35">{subtituloChat}</p>
              </div>
              {selectedCliente?.telefono && (
                <a href={wa(selectedCliente.telefono)} target="_blank"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                  <Phone className="h-4 w-4" />
                </a>
              )}
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {loadingChat ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-400/20 border-t-violet-400" />
                </div>
              ) : mensajes.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] text-white/20">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <p className="text-sm text-white/30">Sin mensajes todavía</p>
                </div>
              ) : (
                mensajes.map((m) => {
                  const mine = m.remitente_id === empleado?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`flex max-w-[78%] flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                        {m.tipo === "solicitud" && (
                          <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-300">
                            Solicitud
                          </span>
                        )}
                        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${mine ? "rounded-br-sm bg-violet-500/25 text-white" : "rounded-bl-sm bg-white/[0.07] text-white/85"}`}>
                          {m.eliminado ? <span className="italic text-white/30">Mensaje eliminado</span> : m.mensaje}
                        </div>
                        <span className="text-[10px] text-white/20">
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

            {/* Input flotante */}
            <div className="border-t border-white/[0.06] bg-[#0d0d12] px-3 py-3 safe-bottom">
              <div className="flex items-center gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.05] px-4 py-2">
                <input value={texto} onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviarMensaje(); } }}
                  placeholder="Escribe un mensaje…"
                  className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-white outline-none placeholder:text-white/25" />
                <button type="button" onClick={() => void enviarMensaje()} disabled={!texto.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500 text-white shadow-md shadow-violet-950/40 transition active:bg-violet-400 disabled:opacity-35">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vista: Solicitudes */}
        {vistaMovil === "solicitudes" && (
          <div className="flex h-full flex-col">
            <div className="border-b border-white/[0.06] px-4 pt-12 pb-3 safe-top">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black">Solicitudes</h2>
                  <p className="text-xs text-white/30">Bandeja operativa interna</p>
                </div>
                <button type="button" onClick={() => setShowNuevaSolicitud(true)}
                  className="flex h-9 items-center gap-1.5 rounded-xl border border-violet-400/25 bg-violet-500/15 px-3 text-xs font-black text-violet-200">
                  <Plus className="h-3.5 w-3.5" /> Nueva
                </button>
              </div>
              {/* Stats mini */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-amber-400/10 px-3 py-2 text-center">
                  <p className="text-xl font-black text-amber-300">{stats.pendientes}</p>
                  <p className="text-[10px] font-black uppercase text-amber-300/50">Pend.</p>
                </div>
                <div className="rounded-xl bg-sky-400/10 px-3 py-2 text-center">
                  <p className="text-xl font-black text-sky-300">{stats.revision}</p>
                  <p className="text-[10px] font-black uppercase text-sky-300/50">Rev.</p>
                </div>
                <div className="rounded-xl bg-emerald-400/10 px-3 py-2 text-center">
                  <p className="text-xl font-black text-emerald-300">{stats.resueltas}</p>
                  <p className="text-[10px] font-black uppercase text-emerald-300/50">OK</p>
                </div>
              </div>
              {/* Filtros */}
              <div className="mt-3 flex gap-1.5">
                {([["pendiente","Pendientes"],["en_revision","Revisión"],["todas","Todas"]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setEstadoFiltro(k)}
                    className={`rounded-full px-3 py-1.5 text-[11px] font-black transition ${estadoFiltro === k ? "bg-white text-slate-950" : "border border-white/[0.08] bg-white/[0.03] text-white/40"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {solicitudesFiltradas.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-white/25">Sin solicitudes</div>
              ) : solicitudesFiltradas.map((s) => {
                const cliente = firstOrNull(s.clientes);
                const fisio = firstOrNull(s.fisios);
                return (
                  <article key={s.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-white">{SOLICITUD_LABELS[s.tipo] || s.titulo}</p>
                        <p className="mt-0.5 truncate text-xs text-white/35">
                          {cliente?.nombre || "—"}{fisio?.nombre ? ` · ${fisio.nombre}` : ""}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${estadoClass(s.estado)}`}>
                        {s.estado.replace("_"," ")}
                      </span>
                    </div>
                    <p className="mt-2.5 line-clamp-3 text-xs leading-relaxed text-white/55">{s.descripcion}</p>
                    <p className="mt-1.5 text-[10px] text-white/25">{formatDateTime(s.created_at)}</p>
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      <button type="button" onClick={() => void actualizarSolicitud(s.id, "en_revision")}
                        className="flex items-center justify-center gap-1 rounded-xl border border-sky-400/20 bg-sky-400/10 py-2.5 text-xs font-black text-sky-300 transition active:bg-sky-400/15">
                        <Clock3 className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => void actualizarSolicitud(s.id, "resuelta")}
                        className="flex items-center justify-center gap-1 rounded-xl border border-emerald-400/20 bg-emerald-400/10 py-2.5 text-xs font-black text-emerald-300 transition active:bg-emerald-400/15">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => void actualizarSolicitud(s.id, "rechazada")}
                        className="flex items-center justify-center gap-1 rounded-xl border border-rose-400/20 bg-rose-400/10 py-2.5 text-xs font-black text-rose-300 transition active:bg-rose-400/15">
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" disabled={!s.conversacion_id}
                        onClick={() => { if (s.conversacion_id) { setSelectedId(s.conversacion_id); setVistaMovil("chat"); } }}
                        className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-xs font-black text-white/45 transition active:bg-white/[0.07] disabled:opacity-30">
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })}
              <div className="h-24" />
            </div>
          </div>
        )}

        {/* Tab bar inferior — solo en móvil */}
        {vistaMovil !== "chat" && (
          <nav className="safe-bottom border-t border-white/[0.06] bg-[#0d0d12]/95 backdrop-blur-xl">
            <div className="grid grid-cols-2">
              <button type="button" onClick={() => setVistaMovil("list")}
                className={`flex flex-col items-center gap-1 py-3 text-[10px] font-black uppercase tracking-wider transition ${vistaMovil === "list" ? "text-violet-300" : "text-white/30"}`}>
                <MessageCircle className="h-5 w-5" />
                Chats
                {vistaMovil !== "list" && conversaciones.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-violet-500 text-[9px] font-black text-white flex items-center justify-center">
                    {conversaciones.length}
                  </span>
                )}
              </button>
              <button type="button" onClick={() => setVistaMovil("solicitudes")}
                className={`relative flex flex-col items-center gap-1 py-3 text-[10px] font-black uppercase tracking-wider transition ${vistaMovil === "solicitudes" ? "text-amber-300" : "text-white/30"}`}>
                <div className="relative">
                  <Inbox className="h-5 w-5" />
                  {stats.pendientes > 0 && (
                    <span className="absolute -top-1.5 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-black">
                      {stats.pendientes}
                    </span>
                  )}
                </div>
                Solicitudes
              </button>
            </div>
          </nav>
        )}
      </div>

      {/* ─── Modal: Nueva solicitud ─── */}
      {showNuevaSolicitud && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-xl rounded-t-[2rem] border border-white/10 bg-[#0f1117] p-5 shadow-2xl md:rounded-[2rem]">
            <div className="mb-1 flex h-1 w-10 mx-auto rounded-full bg-white/15 md:hidden" />
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-black text-white">Nueva solicitud</p>
                <p className="text-xs text-white/35">Queda registrada en el chat correspondiente.</p>
              </div>
              <button type="button" onClick={() => setShowNuevaSolicitud(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-white/35 transition hover:bg-white/[0.06]">
                ✕
              </button>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/35">Tipo</span>
                <select value={nuevaSolicitud.tipo} onChange={(e) => setNuevaSolicitud((p) => ({ ...p, tipo: e.target.value as SolicitudTipo }))}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none">
                  {TIPOS_SOLICITUD.map((t) => <option key={t} value={t} className="bg-[#0f1117]">{SOLICITUD_LABELS[t]}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/35">Cliente</span>
                <select value={nuevaSolicitud.cliente_id} onChange={(e) => setNuevaSolicitud((p) => ({ ...p, cliente_id: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none">
                  <option value="" className="bg-[#0f1117]">Sin cliente específico</option>
                  {clientes.map((c) => <option key={c.id} value={c.id || ""} className="bg-[#0f1117]">{c.nombre}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/35">Fisio</span>
                <select value={nuevaSolicitud.fisio_id} onChange={(e) => setNuevaSolicitud((p) => ({ ...p, fisio_id: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none">
                  <option value="" className="bg-[#0f1117]">Sin fisio específico</option>
                  {fisios.map((f) => <option key={f.id} value={f.id || ""} className="bg-[#0f1117]">{f.nombre} · {f.rol}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/35">Título (opcional)</span>
                <input value={nuevaSolicitud.titulo} onChange={(e) => setNuevaSolicitud((p) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ej: cambio de horario"
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none placeholder:text-white/25" />
              </label>
            </div>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/35">Detalle *</span>
              <textarea value={nuevaSolicitud.descripcion} onChange={(e) => setNuevaSolicitud((p) => ({ ...p, descripcion: e.target.value }))}
                rows={4} placeholder="Escribe el detalle…"
                className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white outline-none placeholder:text-white/25" />
            </label>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setShowNuevaSolicitud(false)} disabled={savingSolicitud}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-sm font-bold text-white/55 transition hover:bg-white/[0.07] disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={() => void crearSolicitud()} disabled={savingSolicitud}
                className="flex-1 rounded-2xl border border-violet-400/25 bg-violet-500/20 py-3 text-sm font-black text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-50">
                {savingSolicitud ? "Guardando…" : "Crear solicitud"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}