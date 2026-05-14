"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  ChevronRight,
  Inbox,
  MessageCircle,
  Send,
  UserRound,
  XCircle,
} from "lucide-react";

/* ── TYPES ─────────────────────────────────────────────────────────────── */

type ParticipanteTipo = "cliente" | "fisio" | "recepcion" | "admin" | "sistema";

type ClienteActual = {
  id: string;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  auth_user_id: string | null;
  terapeuta_id: string | null;
};

type CitaHoy = {
  id: string;
  fecha: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  estado: string | null;
  cliente_id: string | null;
  terapeuta_id: string | null;
  servicio_id: string | null;
  terapeutas?: { nombre?: string | null } | { nombre?: string | null }[] | null;
  empleados?: { nombre?: string | null } | { nombre?: string | null }[] | null;
  servicios?: { nombre?: string | null } | { nombre?: string | null }[] | null;
};

type ClientePlanActual = {
  id: string;
  cliente_id: string | null;
  plan_id: string | null;
  estado: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  sesiones_totales: number | null;
  sesiones_usadas: number | null;
  planes?: { nombre?: string | null } | { nombre?: string | null }[] | null;
};

type Conversacion = {
  id: string;
  tipo: "cliente_fisio" | "cliente_recepcion" | "fisio_recepcion" | "grupo";
  titulo: string | null;
  cliente_id: string | null;
  fisio_id: string | null;
  recepcionista_id: string | null;
  ultimo_mensaje: string | null;
  ultima_actividad_at: string | null;
  created_at?: string | null;
  fisios?: { nombre?: string | null; rol?: string | null } | { nombre?: string | null; rol?: string | null }[] | null;
};

type Mensaje = {
  id: string;
  conversacion_id: string;
  remitente_id: string;
  remitente_tipo: ParticipanteTipo;
  mensaje: string | null;
  tipo: "texto" | "imagen" | "video" | "audio" | "archivo" | "sistema" | "solicitud";
  solicitud_id: string | null;
  created_at: string;
};

type Solicitud = {
  id: string;
  conversacion_id: string | null;
  cita_id: string | null;
  cliente_id: string | null;
  fisio_id: string | null;
  tipo: string;
  estado: "pendiente" | "en_revision" | "aprobada" | "rechazada" | "resuelta" | "cancelada";
  titulo: string;
  descripcion: string;
  created_at: string;
};

type SolicitudRapida = { value: string; label: string; placeholder: string };
type ServicioSolicitudCita = "banera_inmersion" | "evaluacion" | "recovery" | "terapia";
type VistaMovil = "home" | "chat" | "solicitudes";

/* ── CONSTANTS ─────────────────────────────────────────────────────────── */

const SOLICITUDES_RAPIDAS: SolicitudRapida[] = [
  { value: "solicitar_cita",    label: "Solicitar cita",    placeholder: "Ej: Quiero una cita esta semana en la tarde..." },
  { value: "solicitar_plan",    label: "Solicitar plan",    placeholder: "Hola, quisiera saber los planes activos, precios y disponibilidad." },
  { value: "renovar_plan",      label: "Renovar mi plan",   placeholder: "Hola, quisiera renovar mi plan actual o conocer opciones similares." },
  { value: "congelar_plan",     label: "Congelar plan",     placeholder: "Explica por qué necesitas congelar tu plan..." },
  { value: "reagendar_cita",    label: "Reagendar cita",    placeholder: "Ej: Necesito cambiar mi cita para otro horario..." },
  { value: "cambio_horario",    label: "Cambio de horario", placeholder: "Ej: Quiero cambiar mi horario regular..." },
  { value: "cambio_fisio",      label: "Cambio de fisio",   placeholder: "Ej: Quisiera solicitar un cambio de fisio..." },
  { value: "consulta_pago",     label: "Consulta de pago",  placeholder: "Ej: Tengo una duda sobre mi pago o deuda..." },
  { value: "consulta_clinica",  label: "Consulta clínica",  placeholder: "Ej: Tengo una duda sobre mi evolución o ejercicios..." },
  { value: "otro",              label: "General",            placeholder: "Escribe tu solicitud..." },
];

const SERVICIOS_SOLICITUD_CITA: { value: ServicioSolicitudCita; label: string }[] = [
  { value: "banera_inmersion", label: "Bañera de inmersión" },
  { value: "evaluacion",       label: "Evaluación" },
  { value: "recovery",         label: "Recovery" },
  { value: "terapia",          label: "Terapia" },
];

/* ── HELPERS ───────────────────────────────────────────────────────────── */

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatTime(value?: string | null) {
  return value ? String(value).slice(0, 5) : "—";
}

function formatHour(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(value: string | null | undefined) {
  if (!value) return "";
  try {
    const d = new Date(value);
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    if (days === 1) return "Ayer";
    if (days < 7) return d.toLocaleDateString("es-ES", { weekday: "short" });
    return d.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" });
  } catch { return ""; }
}

function initials(name?: string | null) {
  const parts = (name || "C").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("") || "C";
}

function solicitudLabel(tipo: string) {
  const map: Record<string, string> = {
    solicitar_cita: "Solicitud de cita", solicitar_plan: "Solicitar plan",
    renovar_plan: "Renovar plan", congelar_plan: "Congelar plan",
    reagendar_cita: "Reagendar cita", cancelar_cita: "Cancelar cita",
    cambio_horario: "Cambio de horario", cambio_fisio: "Cambio de fisio",
    aviso_no_asistencia_cliente: "Aviso no asistencia", consulta_pago: "Consulta pago",
    consulta_clinica: "Consulta clínica", otro: "General",
  };
  return map[tipo] || tipo;
}

function estadoChipStyle(estado: string): React.CSSProperties {
  switch (estado) {
    case "pendiente":   return { background: "rgba(251,191,36,0.12)",  border: "1px solid rgba(251,191,36,0.24)",  color: "var(--yellow)" };
    case "en_revision": return { background: "rgba(56,189,248,0.12)",  border: "1px solid rgba(56,189,248,0.24)",  color: "#7dd3fc" };
    case "aprobada":
    case "resuelta":    return { background: "var(--green-soft)",       border: "1px solid rgba(52,211,153,0.24)", color: "var(--green)" };
    case "rechazada":
    case "cancelada":   return { background: "var(--red-soft)",         border: "1px solid rgba(248,113,113,0.24)", color: "var(--red)" };
    default:            return { background: "var(--surface2)",         border: "1px solid var(--border)",          color: "var(--muted)" };
  }
}

function isTempId(id: string) { return id.startsWith("temp-"); }

function samePendingMessage(a: Mensaje, b: Mensaje) {
  if (!isTempId(a.id)) return false;
  if (a.conversacion_id !== b.conversacion_id) return false;
  if (a.remitente_id !== b.remitente_id) return false;
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

function dateValue(value?: string | null) {
  if (!value) return 0;
  const n = new Date(value).getTime();
  return Number.isFinite(n) ? n : 0;
}

function conversationGroupKey(c: Conversacion) {
  if (c.tipo === "cliente_recepcion") return `cliente_recepcion:${c.cliente_id || "none"}`;
  if (c.tipo === "cliente_fisio") return `cliente_fisio:${c.cliente_id || "none"}:${c.fisio_id || "none"}`;
  return `${c.tipo}:${c.id}`;
}

function pickBetterConversation(a: Conversacion, b: Conversacion) {
  const aHasMessage = Boolean((a.ultimo_mensaje || "").trim());
  const bHasMessage = Boolean((b.ultimo_mensaje || "").trim());
  if (aHasMessage !== bHasMessage) return aHasMessage ? a : b;
  const aActivity = dateValue(a.ultima_actividad_at || a.created_at);
  const bActivity = dateValue(b.ultima_actividad_at || b.created_at);
  if (aActivity !== bActivity) return aActivity > bActivity ? a : b;
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

/* ── PAGE ──────────────────────────────────────────────────────────────── */

export default function ClienteComunicacionPage() {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ), []);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading]               = useState(true);
  const [cliente, setCliente]               = useState<ClienteActual | null>(null);
  const [citaHoy, setCitaHoy]               = useState<CitaHoy | null>(null);
  const [planActual, setPlanActual]         = useState<ClientePlanActual | null>(null);
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [selectedId, setSelectedId]         = useState("");
  const [mensajes, setMensajes]             = useState<Mensaje[]>([]);
  const [solicitudes, setSolicitudes]       = useState<Solicitud[]>([]);

  const [texto, setTexto]                   = useState("");
  const [toast, setToast]                   = useState("");
  const [sendingMsg, setSendingMsg]         = useState(false);

  const [modalNoAsiste, setModalNoAsiste]   = useState(false);
  const [motivoNoAsiste, setMotivoNoAsiste] = useState("");
  const [sendingAsistencia, setSendingAsistencia] = useState(false);

  const [tipoSolicitud, setTipoSolicitud]   = useState("solicitar_cita");
  const [mensajeSolicitud, setMensajeSolicitud] = useState("");
  const [servicioSolicitud, setServicioSolicitud] = useState<ServicioSolicitudCita>("terapia");
  const [fechaSolicitud, setFechaSolicitud] = useState("");
  const [horaSolicitud, setHoraSolicitud]   = useState("");
  const [fechaCongelarDesde, setFechaCongelarDesde] = useState("");
  const [fechaCongelarHasta, setFechaCongelarHasta] = useState("");
  const [sendingSolicitud, setSendingSolicitud] = useState(false);

  const [vistaMovil, setVistaMovil]         = useState<VistaMovil>("home");

  const selected          = conversaciones.find((c) => c.id === selectedId) || null;
  const solicitudActual   = SOLICITUDES_RAPIDAS.find((s) => s.value === tipoSolicitud) || SOLICITUDES_RAPIDAS[0];
  const esSolicitudCita   = tipoSolicitud === "solicitar_cita";
  const esCongelarPlan    = tipoSolicitud === "congelar_plan";
  const esSolicitudPlan   = ["solicitar_plan", "renovar_plan", "congelar_plan"].includes(tipoSolicitud);
  const planInicio        = planActual?.fecha_inicio || "";
  const planFin           = planActual?.fecha_fin || "";

  const servicioSolicitudLabel = SERVICIOS_SOLICITUD_CITA.find((s) => s.value === servicioSolicitud)?.label || "Terapia";

  const diasCongelar = useMemo(() => {
    if (!fechaCongelarDesde || !fechaCongelarHasta) return 0;
    const desde = new Date(`${fechaCongelarDesde}T00:00:00`);
    const hasta = new Date(`${fechaCongelarHasta}T00:00:00`);
    const diff = Math.floor((hasta.getTime() - desde.getTime()) / 86400000) + 1;
    return Number.isFinite(diff) && diff > 0 ? diff : 0;
  }, [fechaCongelarDesde, fechaCongelarHasta]);

  const selectedTitle = selected?.tipo === "cliente_recepcion"
    ? "Recepción"
    : firstOrNull(selected?.fisios)?.nombre || "Fisio";

  const fisioNombre =
    firstOrNull(citaHoy?.terapeutas)?.nombre ||
    firstOrNull(citaHoy?.empleados)?.nombre ||
    firstOrNull(conversaciones.find((c) => c.tipo === "cliente_fisio")?.fisios)?.nombre ||
    "Fisio";

  const servicioNombre          = firstOrNull(citaHoy?.servicios)?.nombre || "Sesión";
  const solicitudesPendientes   = solicitudes.filter((s) => s.estado === "pendiente");

  useEffect(() => { void boot(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!cliente?.id) return;
    const channel = supabase
      .channel(`cliente-comunicacion-${cliente.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mensajes" }, (payload) => {
        const row = payload.new as Mensaje;
        if (!row?.conversacion_id) return;
        setMensajes((prev) => {
          if (row.conversacion_id !== selectedId) return prev;
          return mergeMensaje(prev, row);
        });
        void loadConversaciones(cliente.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "solicitudes_comunicacion" }, () => {
        void loadSolicitudes(cliente.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cliente?.id, selectedId, supabase]);

  useEffect(() => { if (selectedId) void loadMensajes(selectedId); }, [selectedId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes.length, selectedId]);

  /* ── DATA ── */

  async function boot() {
    setLoading(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const userId = auth.user?.id;
      if (!userId) { setToast("No hay sesión activa."); return; }

      const { data: cli, error: cliError } = await supabase
        .from("clientes").select("id,nombre,telefono,email,auth_user_id,terapeuta_id")
        .eq("auth_user_id", userId).maybeSingle();
      if (cliError) throw cliError;
      if (!cli) { setToast("Este usuario no tiene cliente vinculado."); return; }

      const clienteActual = cli as ClienteActual;
      setCliente(clienteActual);

      const hoy = todayKey();
      const { data: cita, error: citaError } = await supabase
        .from("citas")
        .select("id,fecha,hora_inicio,hora_fin,estado,cliente_id,terapeuta_id,servicio_id,terapeutas:terapeuta_id(nombre),empleados:terapeuta_id(nombre),servicios:servicio_id(nombre)")
        .eq("cliente_id", clienteActual.id).eq("fecha", hoy).neq("estado", "cancelada")
        .order("hora_inicio", { ascending: true }).limit(1).maybeSingle();
      if (citaError) throw citaError;

      const citaActual = (cita || null) as CitaHoy | null;
      setCitaHoy(citaActual);

      const { data: plan, error: planError } = await supabase
        .from("clientes_planes")
        .select("id,cliente_id,plan_id,estado,fecha_inicio,fecha_fin,sesiones_totales,sesiones_usadas,planes:plan_id(nombre)")
        .eq("cliente_id", clienteActual.id)
        .in("estado", ["activo", "vigente", "pendiente"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (planError) throw planError;
      setPlanActual((plan || null) as ClientePlanActual | null);

      await ensureConversaciones(clienteActual, citaActual);
      await loadSolicitudes(clienteActual.id);
    } catch (err: any) {
      setToast(err?.message || "No se pudo cargar comunicación.");
    } finally { setLoading(false); }
  }

  async function ensureConversaciones(cli: ClienteActual, cita: CitaHoy | null) {
    const { data: existentes, error } = await supabase
      .from("conversaciones").select("*, fisios:fisio_id(nombre,rol)")
      .eq("cliente_id", cli.id).in("tipo", ["cliente_recepcion", "cliente_fisio"])
      .order("ultima_actividad_at", { ascending: false });
    if (error) throw error;

    const rows = dedupeConversaciones((existentes || []) as Conversacion[]);
    const hasRecep = rows.some((r) => r.tipo === "cliente_recepcion");
    const fisioId  = cita?.terapeuta_id || cli.terapeuta_id || null;
    const hasFisio = rows.some((r) => r.tipo === "cliente_fisio" && r.fisio_id === fisioId);
    const inserts: any[] = [];

    if (!hasRecep) inserts.push({ tipo: "cliente_recepcion", titulo: "Recepción", cliente_id: cli.id, fisio_id: fisioId, created_by: cli.id });
    if (!hasFisio && fisioId) inserts.push({ tipo: "cliente_fisio", titulo: "Fisio", cliente_id: cli.id, fisio_id: fisioId, created_by: cli.id });

    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from("conversaciones").insert(inserts);
      if (insertError) throw insertError;
    }
    await loadConversaciones(cli.id);
  }

  async function loadConversaciones(clienteId: string) {
    const { data, error } = await supabase
      .from("conversaciones").select("*, fisios:fisio_id(nombre,rol)")
      .eq("cliente_id", clienteId).in("tipo", ["cliente_recepcion", "cliente_fisio"])
      .order("ultima_actividad_at", { ascending: false });
    if (error) { setToast(error.message); return; }
    const rows = dedupeConversaciones((data || []) as Conversacion[]);
    setConversaciones(rows);
    setSelectedId((prev) => {
      if (prev && rows.some((r) => r.id === prev)) return prev;
      return rows[0]?.id || "";
    });
  }

  async function loadMensajes(conversacionId: string) {
    const { data, error } = await supabase.from("mensajes").select("*")
      .eq("conversacion_id", conversacionId).order("created_at", { ascending: true });
    if (error) { setToast(error.message); return; }
    setMensajes((data || []) as Mensaje[]);
  }

  async function loadSolicitudes(clienteId: string) {
    const { data, error } = await supabase.from("solicitudes_comunicacion").select("*")
      .eq("cliente_id", clienteId).order("created_at", { ascending: false }).limit(50);
    if (error) { setToast(error.message); return; }
    setSolicitudes((data || []) as Solicitud[]);
  }

  async function enviarMensaje() {
    if (!cliente || !selected || !texto.trim() || sendingMsg) return;
    const body = texto.trim();
    setTexto(""); setSendingMsg(true);
    const temp: Mensaje = {
      id: `temp-${Date.now()}`, conversacion_id: selected.id, remitente_id: cliente.id,
      remitente_tipo: "cliente", mensaje: body, tipo: "texto", solicitud_id: null,
      created_at: new Date().toISOString(),
    };
    setMensajes((prev) => mergeMensaje(prev, temp));
    const { data, error } = await supabase.from("mensajes")
      .insert({ conversacion_id: selected.id, remitente_id: cliente.id, remitente_tipo: "cliente", mensaje: body, tipo: "texto" })
      .select().single();
    if (error) {
      setMensajes((prev) => prev.filter((m) => m.id !== temp.id));
      setTexto(body); setToast(error.message);
    } else if (data) {
      setMensajes((prev) => mergeMensaje(prev, data as Mensaje));
      void loadConversaciones(cliente.id);
    }
    setSendingMsg(false);
  }

  async function confirmarAsistenciaCliente() {
    if (!cliente || !citaHoy || sendingAsistencia) return;
    setSendingAsistencia(true);
    try {
      const conversacionRecepcion = conversaciones.find((c) => c.tipo === "cliente_recepcion") || null;
      const { data: solicitud, error } = await supabase.from("solicitudes_comunicacion")
        .insert({ conversacion_id: conversacionRecepcion?.id || null, cita_id: citaHoy.id, cliente_id: cliente.id, fisio_id: citaHoy.terapeuta_id, tipo: "otro", estado: "resuelta", origen_tipo: "cliente", origen_id: cliente.id, destino_tipo: "recepcion", destino_id: null, titulo: "Cliente confirma asistencia", descripcion: "El cliente indicó desde su portal que asistirá a la sesión de hoy." })
        .select().single();
      if (error) throw error;
      if (conversacionRecepcion?.id) {
        const { data: msg } = await supabase.from("mensajes")
          .insert({ conversacion_id: conversacionRecepcion.id, remitente_id: cliente.id, remitente_tipo: "cliente", tipo: "solicitud", solicitud_id: solicitud.id, mensaje: "Confirmo que voy a asistir a mi sesión de hoy." })
          .select().single();
        if (msg && selectedId === conversacionRecepcion.id) setMensajes((prev) => mergeMensaje(prev, msg as Mensaje));
      }
      setToast("Listo. Avisaste que vas a asistir.");
      await loadSolicitudes(cliente.id);
      await loadConversaciones(cliente.id);
    } catch (err: any) { setToast(err?.message || "No se pudo confirmar asistencia."); }
    finally { setSendingAsistencia(false); }
  }

  async function avisarNoAsiste() {
    if (!cliente || !citaHoy || sendingAsistencia) return;
    const motivo = motivoNoAsiste.trim();
    if (motivo.length < 3) { setToast("El motivo es obligatorio."); return; }
    setSendingAsistencia(true);
    try {
      const { error } = await supabase.rpc("crear_aviso_no_asistencia_cliente", {
        p_cita_id: citaHoy.id, p_cliente_id: cliente.id, p_motivo: motivo, p_origen_id: cliente.id,
      });
      if (error) throw error;
      setModalNoAsiste(false); setMotivoNoAsiste("");
      setToast("Aviso enviado a recepción.");
      await loadSolicitudes(cliente.id);
      await loadConversaciones(cliente.id);
    } catch (err: any) { setToast(err?.message || "No se pudo enviar el aviso."); }
    finally { setSendingAsistencia(false); }
  }

  function cambiarTipoSolicitud(value: string) {
    setTipoSolicitud(value);
    setMensajeSolicitud(
      value === "solicitar_plan" ? "Hola, quisiera saber los planes activos, precios y disponibilidad."
      : value === "renovar_plan" ? "Hola, quisiera renovar mi plan actual."
      : ""
    );
    setFechaSolicitud(""); setHoraSolicitud("");
    setFechaCongelarDesde(""); setFechaCongelarHasta("");
    setServicioSolicitud("terapia");
  }

  function construirDescripcionSolicitud() {
    const detalle = mensajeSolicitud.trim();
    if (tipoSolicitud === "solicitar_cita") return ["El cliente solicita una nueva cita.", "", `Servicio solicitado: ${servicioSolicitudLabel}`, `Fecha deseada: ${fechaSolicitud || "No indicada"}`, `Hora deseada: ${horaSolicitud || "No indicada"}`, "", `Mensaje: ${detalle}`].join("\n");
    if (tipoSolicitud === "solicitar_plan") return ["El cliente solicita información de planes activos.", "", "Quiere conocer precios, disponibilidad y opciones vigentes.", "", `Mensaje: ${detalle}`].join("\n");
    if (tipoSolicitud === "renovar_plan")   return ["El cliente solicita renovar su plan.", "", "Quiere renovar el plan actual o conocer opciones similares.", "", `Mensaje: ${detalle}`].join("\n");
    if (tipoSolicitud === "congelar_plan")  return ["El cliente solicita congelar su plan.", "", `Plan actual: ${firstOrNull(planActual?.planes)?.nombre || "Plan no detectado"}`, `Plan ID: ${planActual?.id || "No detectado"}`, `Vigencia del plan: ${planActual?.fecha_inicio || "Sin inicio"} hasta ${planActual?.fecha_fin || "Sin fin"}`, `Rango solicitado: ${fechaCongelarDesde || "No indicado"} hasta ${fechaCongelarHasta || "No indicado"}`, `Días a congelar: ${diasCongelar || "No calculado"}`, "", `Motivo obligatorio: ${detalle}`].join("\n");
    return detalle;
  }

  async function enviarSolicitudRapida() {
    if (!cliente || sendingSolicitud) return;
    const detalle = mensajeSolicitud.trim();
    if (detalle.length < 3) { setToast(esCongelarPlan ? "El motivo para congelar el plan es obligatorio." : "Escribe el detalle de la solicitud."); return; }
    if (esCongelarPlan) {
      if (!planActual) { setToast("No se detectó un plan activo para congelar."); return; }
      if (!fechaCongelarDesde || !fechaCongelarHasta) { setToast("Selecciona desde cuándo y hasta cuándo quieres congelar el plan."); return; }
      if (planInicio && fechaCongelarDesde < planInicio) { setToast("La fecha de inicio no puede ser antes del inicio del plan."); return; }
      if (planFin && fechaCongelarHasta > planFin) { setToast("La fecha final no puede pasar la fecha de vencimiento del plan."); return; }
      if (fechaCongelarHasta < fechaCongelarDesde) { setToast("La fecha final no puede ser menor que la fecha inicial."); return; }
    }
    setSendingSolicitud(true);
    try {
      const conversacionRecepcion = conversaciones.find((c) => c.tipo === "cliente_recepcion") || null;
      const descripcionSolicitud  = construirDescripcionSolicitud();
      const { data: solicitud, error } = await supabase.from("solicitudes_comunicacion")
        .insert({ conversacion_id: conversacionRecepcion?.id || null, cita_id: ["reagendar_cita", "cancelar_cita"].includes(tipoSolicitud) ? citaHoy?.id || null : null, cliente_id: cliente.id, fisio_id: citaHoy?.terapeuta_id || cliente.terapeuta_id || null, tipo: tipoSolicitud, estado: "pendiente", origen_tipo: "cliente", origen_id: cliente.id, destino_tipo: "recepcion", destino_id: null, titulo: solicitudLabel(tipoSolicitud), descripcion: descripcionSolicitud })
        .select().single();
      if (error) throw error;
      if (conversacionRecepcion?.id) {
        const { data: msg } = await supabase.from("mensajes")
          .insert({ conversacion_id: conversacionRecepcion.id, remitente_id: cliente.id, remitente_tipo: "cliente", tipo: "solicitud", solicitud_id: solicitud.id, mensaje: `${solicitudLabel(tipoSolicitud)}: ${descripcionSolicitud}` })
          .select().single();
        if (msg && selectedId === conversacionRecepcion.id) setMensajes((prev) => mergeMensaje(prev, msg as Mensaje));
      }
      setMensajeSolicitud(""); setFechaSolicitud(""); setHoraSolicitud("");
      setFechaCongelarDesde(""); setFechaCongelarHasta(""); setServicioSolicitud("terapia");
      setToast("Solicitud enviada a recepción.");
      await loadSolicitudes(cliente.id);
      await loadConversaciones(cliente.id);
    } catch (err: any) { setToast(err?.message || "No se pudo enviar la solicitud."); }
    finally { setSendingSolicitud(false); }
  }

  /* ── LOADING ── */
  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "100dvh", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2.5px solid var(--border)", borderTopColor: "var(--purple2)", animation: "spin 0.8s linear infinite", margin: "0 auto 14px" }} />
          <p style={{ fontSize: 13, color: "var(--muted)" }}>Cargando comunicación…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ── SHARED SUB-COMPONENTS ── */

  const SessionCard = () => citaHoy ? (
    <div style={{ marginTop: 14, borderRadius: 16, background: "var(--surface2)", border: "1px solid var(--border)", padding: "14px" }}>
      <p style={{ margin: "0 0 2px", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.16em", color: "var(--muted2)" }}>Sesión de hoy</p>
      <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 900, color: "var(--text)" }}>{servicioNombre}</p>
      <p style={{ margin: "0 0 12px", fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>{formatTime(citaHoy.hora_inicio)} – {formatTime(citaHoy.hora_fin)} · {fisioNombre}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button type="button" disabled={sendingAsistencia} onClick={() => void confirmarAsistenciaCliente()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, borderRadius: 14, border: "1px solid rgba(52,211,153,0.24)", background: "var(--green-soft)", color: "var(--green)", padding: "10px 0", cursor: "pointer", opacity: sendingAsistencia ? 0.5 : 1 }}>
          <CheckCircle2 size={16} /><span style={{ fontSize: 10, fontWeight: 900 }}>Voy</span>
        </button>
        <button type="button" disabled={sendingAsistencia} onClick={() => setModalNoAsiste(true)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, borderRadius: 14, border: "1px solid rgba(248,113,113,0.24)", background: "var(--red-soft)", color: "var(--red)", padding: "10px 0", cursor: "pointer", opacity: sendingAsistencia ? 0.5 : 1 }}>
          <XCircle size={16} /><span style={{ fontSize: 10, fontWeight: 900 }}>No puedo</span>
        </button>
      </div>
    </div>
  ) : (
    <div style={{ marginTop: 14, borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--border)", padding: "12px 14px" }}>
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>No tienes sesión programada hoy.</p>
    </div>
  );

  const SolicitudForm = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Selector tipo */}
      <select value={tipoSolicitud} onChange={(e) => cambiarTipoSolicitud(e.target.value)}
        style={{ width: "100%", borderRadius: 14, border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--text)", padding: "11px 14px", fontSize: 13, fontFamily: "inherit", fontWeight: 700, outline: "none" }}>
        {SOLICITUDES_RAPIDAS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      {/* Cita extra fields */}
      {esSolicitudCita && (
        <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface2)", padding: "12px" }}>
          <p style={{ margin: "0 0 8px", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted2)" }}>Tipo de cita</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            {SERVICIOS_SOLICITUD_CITA.map((srv) => (
              <button key={srv.value} type="button" onClick={() => setServicioSolicitud(srv.value)}
                style={{ borderRadius: 10, border: "none", padding: "8px", fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", background: servicioSolicitud === srv.value ? "var(--purple)" : "var(--border)", color: servicioSolicitud === srv.value ? "white" : "var(--muted)" }}>
                {srv.label}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <input type="date" value={fechaSolicitud} onChange={(e) => setFechaSolicitud(e.target.value)}
              style={{ borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text)", padding: "8px 10px", fontSize: 12, outline: "none", fontFamily: "inherit" }} />
            <input type="time" value={horaSolicitud} onChange={(e) => setHoraSolicitud(e.target.value)}
              style={{ borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text)", padding: "8px 10px", fontSize: 12, outline: "none", fontFamily: "inherit" }} />
          </div>
        </div>
      )}

      {/* Plan info banner */}
      {esSolicitudPlan && !esCongelarPlan && (
        <div style={{ borderRadius: 12, background: "var(--purple-glow)", border: "1px solid var(--border-strong)", padding: "10px 14px", fontSize: 12, color: "var(--purple2)", fontWeight: 600, lineHeight: 1.5 }}>
          {tipoSolicitud === "renovar_plan" ? "Recepción recibirá que quieres renovar tu plan actual." : "Recepción recibirá que quieres conocer planes activos, precios y disponibilidad."}
        </div>
      )}

      {/* Congelar plan */}
      {esCongelarPlan && (
        <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface2)", padding: "12px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <p style={{ margin: "0 0 4px", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted2)" }}>Plan actual</p>
            <p style={{ margin: "0 0 2px", fontSize: 13, fontWeight: 800, color: "var(--text)" }}>{firstOrNull(planActual?.planes)?.nombre || "No se detectó un plan activo"}</p>
            <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Vigencia: {planInicio || "Sin inicio"} — {planFin || "Sin fin"}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <input type="date" value={fechaCongelarDesde} min={planInicio || undefined} max={planFin || undefined} onChange={(e) => setFechaCongelarDesde(e.target.value)}
              style={{ borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text)", padding: "8px 10px", fontSize: 12, outline: "none", fontFamily: "inherit" }} />
            <input type="date" value={fechaCongelarHasta} min={fechaCongelarDesde || planInicio || undefined} max={planFin || undefined} onChange={(e) => setFechaCongelarHasta(e.target.value)}
              style={{ borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text)", padding: "8px 10px", fontSize: 12, outline: "none", fontFamily: "inherit" }} />
          </div>
          <div style={{ borderRadius: 10, background: diasCongelar > 0 ? "var(--yellow-soft)" : "var(--surface)", border: `1px solid ${diasCongelar > 0 ? "rgba(251,191,36,0.22)" : "var(--border)"}`, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: diasCongelar > 0 ? "var(--yellow)" : "var(--muted)" }}>
            {diasCongelar > 0 ? `Solicitas congelar ${diasCongelar} día${diasCongelar === 1 ? "" : "s"}.` : "Selecciona el rango de fechas que quieres congelar."}
          </div>
        </div>
      )}

      {/* Message input + send */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <input value={mensajeSolicitud} onChange={(e) => setMensajeSolicitud(e.target.value)}
          placeholder={solicitudActual.placeholder}
          style={{ flex: 1, minWidth: 0, borderRadius: 14, border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--text)", padding: "11px 14px", fontSize: 13, outline: "none", fontFamily: "inherit" }} />
        <button type="button" disabled={sendingSolicitud} onClick={() => void enviarSolicitudRapida()}
          style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 14, border: "none", background: "linear-gradient(135deg, var(--purple), var(--purple2))", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: sendingSolicitud ? 0.5 : 1 }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );

  /* ── RENDER ─────────────────────────────────────────────────────────── */
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", overflow: "hidden", background: "var(--bg)", color: "var(--text)" }}>

      {/* Toast */}
      {toast && (
        <button type="button" onClick={() => setToast("")} style={{
          position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)", zIndex: 60,
          borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)",
          padding: "12px 20px", fontSize: 13, fontWeight: 600, color: "var(--text)",
          backdropFilter: "blur(24px)", boxShadow: "var(--shadow-lg)", cursor: "pointer",
          whiteSpace: "nowrap",
        }}>
          {toast}
        </button>
      )}

      {/* ─── DESKTOP: tres columnas ─── */}
      <div style={{ display: "none", height: "100%", gap: 16, padding: 16 }} className="comm-desktop">
        <style>{`.comm-desktop { display: none; } @media (min-width: 768px) { .comm-desktop { display: flex !important; } .comm-mobile { display: none !important; } }`}</style>

        {/* Col 1: perfil + sesión + lista chats */}
        <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 24, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
          {/* Top strip */}
          <div style={{ height: 3, background: "linear-gradient(90deg, var(--purple), var(--purple2))", flexShrink: 0 }} />

          {/* Profile */}
          <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 0 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(145deg, var(--purple), var(--purple2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "white", flexShrink: 0 }}>
                {initials(cliente?.nombre)}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cliente?.nombre || "Cliente"}</p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{cliente?.telefono || cliente?.email || "Portal"}</p>
              </div>
            </div>
            <SessionCard />
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
            <p style={{ padding: "8px 8px 6px", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted2)", margin: 0 }}>Mis chats</p>
            {conversaciones.length === 0 ? (
              <p style={{ padding: 16, textAlign: "center", fontSize: 13, color: "var(--muted)" }}>Sin conversaciones</p>
            ) : conversaciones.map((c) => {
              const active = selectedId === c.id;
              const title  = c.tipo === "cliente_recepcion" ? "Recepción" : firstOrNull(c.fisios)?.nombre || "Fisio";
              return (
                <button key={c.id} type="button" onClick={() => setSelectedId(c.id)} style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  borderRadius: 16, padding: "10px 10px", textAlign: "left", border: "none", cursor: "pointer",
                  marginBottom: 4, fontFamily: "inherit",
                  background: active ? "var(--purple-glow)" : "transparent",
                  outline: active ? "1px solid var(--border-strong)" : "1px solid transparent",
                  transition: "background .15s",
                }}>
                  <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: active ? "var(--purple-glow)" : "var(--surface2)", border: "1px solid var(--border)", color: active ? "var(--purple2)" : "var(--muted)" }}>
                    {c.tipo === "cliente_recepcion" ? <Bell size={16} /> : <UserRound size={16} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: active ? "var(--purple2)" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
                      <span style={{ fontSize: 10, color: "var(--muted2)", flexShrink: 0 }}>{formatRelative(c.ultima_actividad_at)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11.5, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.ultimo_mensaje || "Sin mensajes"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Col 2: chat */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 24, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
          <div style={{ height: 3, background: "linear-gradient(90deg, var(--purple2), var(--purple))", flexShrink: 0 }} />
          {/* Chat header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            {selected ? (
              <>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: "var(--purple-glow)", border: "1px solid var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--purple2)" }}>
                  {selected.tipo === "cliente_recepcion" ? <Bell size={16} /> : <UserRound size={16} />}
                </div>
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 900, color: "var(--text)" }}>{selectedTitle}</p>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{selected.tipo === "cliente_recepcion" ? "Cliente · Recepción" : "Cliente · Fisio"}</p>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Selecciona una conversación</p>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {!selected ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <div style={{ width: 56, height: 56, borderRadius: 18, background: "var(--purple-glow)", border: "1px solid var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--purple2)" }}>
                  <MessageCircle size={24} />
                </div>
                <p style={{ fontSize: 13, color: "var(--muted)" }}>Selecciona Recepción o Fisio</p>
              </div>
            ) : mensajes.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <div style={{ width: 56, height: 56, borderRadius: 18, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
                  <MessageCircle size={24} />
                </div>
                <p style={{ fontSize: 13, color: "var(--muted)" }}>Sin mensajes todavía</p>
              </div>
            ) : mensajes.map((m) => {
              const mine = m.remitente_tipo === "cliente" && m.remitente_id === cliente?.id;
              return (
                <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: mine ? "flex-end" : "flex-start", maxWidth: "76%" }}>
                    {m.tipo === "solicitud" && (
                      <span style={{ borderRadius: 999, background: "var(--yellow-soft)", border: "1px solid rgba(251,191,36,0.22)", padding: "2px 10px", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", color: "var(--yellow)" }}>Solicitud</span>
                    )}
                    <div style={{ borderRadius: 18, padding: "10px 14px", fontSize: 13.5, lineHeight: 1.5, background: mine ? "var(--purple-glow)" : "var(--surface2)", border: `1px solid ${mine ? "var(--border-strong)" : "var(--border)"}`, color: "var(--text)", borderBottomRightRadius: mine ? 4 : 18, borderBottomLeftRadius: mine ? 18 : 4 }}>
                      {m.mensaje}
                    </div>
                    <span style={{ fontSize: 10, color: "var(--muted2)" }}>{isTempId(m.id) ? "Enviando…" : formatHour(m.created_at)}</span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", borderRadius: 16, border: "1.5px solid var(--border)", background: "var(--surface2)", padding: "6px 8px 6px 14px" }}>
              <input value={texto} onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviarMensaje(); } }}
                disabled={!selected || sendingMsg}
                placeholder={selected ? "Escribe un mensaje…" : "Selecciona una conversación"}
                style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontSize: 13.5, color: "var(--text)", fontFamily: "inherit", padding: "6px 0" }} />
              <button type="button" onClick={() => void enviarMensaje()} disabled={!selected || sendingMsg || !texto.trim()}
                style={{ width: 36, height: 36, borderRadius: 11, border: "none", background: "linear-gradient(135deg, var(--purple), var(--purple2))", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, opacity: (!selected || sendingMsg || !texto.trim()) ? 0.35 : 1 }}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Col 3: solicitudes */}
        <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden", borderRadius: 24, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-md)" }}>
          <div style={{ height: 3, background: "linear-gradient(90deg, var(--orange), var(--yellow))", flexShrink: 0 }} />

          {/* Nueva solicitud */}
          <div style={{ padding: "16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 900, color: "var(--text)" }}>Solicitudes</p>
            <p style={{ margin: "0 0 12px", fontSize: 11.5, color: "var(--muted)", fontWeight: 600 }}>Pide ayuda a recepción</p>
            {solicitudesPendientes.length > 0 && (
              <div style={{ marginBottom: 12, borderRadius: 10, background: "var(--yellow-soft)", border: "1px solid rgba(251,191,36,0.22)", padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "var(--yellow)" }}>
                {solicitudesPendientes.length} pendiente{solicitudesPendientes.length !== 1 ? "s" : ""}
              </div>
            )}
            <SolicitudForm />
          </div>

          {/* Lista solicitudes */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            <p style={{ margin: "0 0 10px", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted2)" }}>Mis solicitudes ({solicitudes.length})</p>
            {solicitudes.length === 0 ? (
              <div style={{ borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--border)", padding: "20px", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>Sin solicitudes todavía</div>
            ) : solicitudes.map((s) => (
              <article key={s.id} style={{ borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--border)", padding: "12px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{solicitudLabel(s.tipo)}</p>
                  <span style={{ flexShrink: 0, borderRadius: 999, padding: "3px 9px", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", ...estadoChipStyle(s.estado) }}>{s.estado}</span>
                </div>
                <p style={{ margin: "0 0 4px", fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.descripcion}</p>
                <p style={{ margin: 0, fontSize: 10, color: "var(--muted2)" }}>{new Date(s.created_at).toLocaleString("es-ES")}</p>
                {s.conversacion_id && (
                  <button type="button" onClick={() => setSelectedId(s.conversacion_id || "")}
                    style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", padding: "5px 10px", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>
                    <MessageCircle size={11} /> Abrir chat
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* ─── MÓVIL ─── */}
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }} className="comm-mobile">

        {/* Vista: Home */}
        {vistaMovil === "home" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Header */}
            <div style={{ padding: "52px 18px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(145deg, var(--purple), var(--purple2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "white", flexShrink: 0 }}>
                    {initials(cliente?.nombre)}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: "var(--text)", lineHeight: 1.2 }}>{cliente?.nombre || "Cliente"}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>Portal del cliente</p>
                  </div>
                </div>
                {/* Solicitudes badge */}
                <button type="button" onClick={() => setVistaMovil("solicitudes")}
                  style={{ position: "relative", width: 38, height: 38, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Inbox size={17} />
                  {solicitudesPendientes.length > 0 && (
                    <span style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: "var(--yellow)", fontSize: 9, fontWeight: 900, color: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {solicitudesPendientes.length}
                    </span>
                  )}
                </button>
              </div>
              <SessionCard />
            </div>

            {/* Conversation list */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              <p style={{ padding: "14px 18px 8px", margin: 0, fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted2)" }}>Mis chats</p>
              {conversaciones.length === 0 ? (
                <p style={{ padding: "32px 18px", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>Sin conversaciones</p>
              ) : conversaciones.map((c) => {
                const title = c.tipo === "cliente_recepcion" ? "Recepción" : firstOrNull(c.fisios)?.nombre || "Fisio";
                return (
                  <button key={c.id} type="button" onClick={() => { setSelectedId(c.id); setVistaMovil("chat"); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderBottom: "1px solid var(--border)", textAlign: "left", border: "none", borderBottom: `1px solid var(--border)`, background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--purple-glow)", border: "1px solid var(--border-strong)", color: "var(--purple2)" }}>
                      {c.tipo === "cliente_recepcion" ? <Bell size={18} /> : <UserRound size={18} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
                        <span style={{ fontSize: 10, color: "var(--muted2)", flexShrink: 0 }}>{formatRelative(c.ultima_actividad_at)}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.ultimo_mensaje || "Sin mensajes"}</p>
                    </div>
                    <ChevronRight size={16} style={{ color: "var(--muted2)", flexShrink: 0 }} />
                  </button>
                );
              })}
              <div style={{ height: 96 }} />
            </div>

            {/* Tab bar */}
            <nav style={{ flexShrink: 0, borderTop: "1px solid var(--border)", background: "var(--nav-bg)", backdropFilter: "blur(24px)", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              <button type="button" onClick={() => setVistaMovil("home")}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 0", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", border: "none", background: "transparent", color: "var(--purple2)", cursor: "pointer", fontFamily: "inherit" }}>
                <MessageCircle size={20} /> Chats
              </button>
              <button type="button" onClick={() => setVistaMovil("solicitudes")}
                style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 0", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>
                <div style={{ position: "relative" }}>
                  <Inbox size={20} />
                  {solicitudesPendientes.length > 0 && (
                    <span style={{ position: "absolute", top: -6, right: -8, width: 16, height: 16, borderRadius: "50%", background: "var(--yellow)", fontSize: 9, fontWeight: 900, color: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {solicitudesPendientes.length}
                    </span>
                  )}
                </div>
                Solicitudes
              </button>
            </nav>
          </div>
        )}

        {/* Vista: Chat */}
        {vistaMovil === "chat" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Chat header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "50px 14px 12px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <button type="button" onClick={() => setVistaMovil("home")}
                style={{ width: 38, height: 38, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--purple-glow)", border: "1px solid var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--purple2)", flexShrink: 0 }}>
                {selected?.tipo === "cliente_recepcion" ? <Bell size={15} /> : <UserRound size={15} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: "0 0 1px", fontSize: 14, fontWeight: 900, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedTitle}</p>
                <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", fontWeight: 600 }}>{selected?.tipo === "cliente_recepcion" ? "Cliente · Recepción" : "Cliente · Fisio"}</p>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {mensajes.length === 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
                    <MessageCircle size={22} />
                  </div>
                  <p style={{ fontSize: 13, color: "var(--muted)" }}>Sin mensajes todavía</p>
                </div>
              ) : mensajes.map((m) => {
                const mine = m.remitente_tipo === "cliente" && m.remitente_id === cliente?.id;
                return (
                  <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: mine ? "flex-end" : "flex-start", maxWidth: "78%" }}>
                      {m.tipo === "solicitud" && (
                        <span style={{ borderRadius: 999, background: "var(--yellow-soft)", border: "1px solid rgba(251,191,36,0.22)", padding: "2px 10px", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", color: "var(--yellow)" }}>Solicitud</span>
                      )}
                      <div style={{ borderRadius: 18, padding: "10px 14px", fontSize: 13.5, lineHeight: 1.5, background: mine ? "var(--purple-glow)" : "var(--surface2)", border: `1px solid ${mine ? "var(--border-strong)" : "var(--border)"}`, color: "var(--text)", borderBottomRightRadius: mine ? 4 : 18, borderBottomLeftRadius: mine ? 18 : 4 }}>
                        {m.mensaje}
                      </div>
                      <span style={{ fontSize: 10, color: "var(--muted2)" }}>{isTempId(m.id) ? "Enviando…" : formatHour(m.created_at)}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
              <div style={{ height: 8 }} />
            </div>

            {/* Input */}
            <div style={{ padding: "10px 14px 16px", borderTop: "1px solid var(--border)", flexShrink: 0, background: "var(--nav-bg)", backdropFilter: "blur(24px)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", borderRadius: 16, border: "1.5px solid var(--border)", background: "var(--surface2)", padding: "6px 8px 6px 14px" }}>
                <input value={texto} onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviarMensaje(); } }}
                  disabled={sendingMsg}
                  placeholder="Escribe un mensaje…"
                  style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "var(--text)", fontFamily: "inherit", padding: "7px 0" }} />
                <button type="button" onClick={() => void enviarMensaje()} disabled={sendingMsg || !texto.trim()}
                  style={{ width: 38, height: 38, borderRadius: 12, border: "none", background: "linear-gradient(135deg, var(--purple), var(--purple2))", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, opacity: (sendingMsg || !texto.trim()) ? 0.35 : 1 }}>
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vista: Solicitudes */}
        {vistaMovil === "solicitudes" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Header + form */}
            <div style={{ padding: "52px 18px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div style={{ marginBottom: 14 }}>
                <p style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 900, color: "var(--text)", letterSpacing: "-0.03em" }}>Solicitudes</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Pide ayuda a recepción</p>
              </div>
              {solicitudesPendientes.length > 0 && (
                <div style={{ marginBottom: 12, borderRadius: 10, background: "var(--yellow-soft)", border: "1px solid rgba(251,191,36,0.22)", padding: "7px 12px", fontSize: 12, fontWeight: 700, color: "var(--yellow)" }}>
                  {solicitudesPendientes.length} solicitud{solicitudesPendientes.length !== 1 ? "es" : ""} pendiente{solicitudesPendientes.length !== 1 ? "s" : ""}
                </div>
              )}
              <SolicitudForm />
            </div>

            {/* Solicitudes list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
              <p style={{ margin: "0 0 10px", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: "var(--muted2)" }}>Mis solicitudes ({solicitudes.length})</p>
              {solicitudes.length === 0 ? (
                <div style={{ borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--border)", padding: "24px", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>Sin solicitudes todavía</div>
              ) : solicitudes.map((s) => (
                <article key={s.id} style={{ borderRadius: 16, background: "var(--surface2)", border: "1px solid var(--border)", padding: "14px", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 900, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{solicitudLabel(s.tipo)}</p>
                    <span style={{ flexShrink: 0, borderRadius: 999, padding: "3px 9px", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", ...estadoChipStyle(s.estado) }}>{s.estado}</span>
                  </div>
                  <p style={{ margin: "0 0 5px", fontSize: 12, color: "var(--muted)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>{s.descripcion}</p>
                  <p style={{ margin: 0, fontSize: 10, color: "var(--muted2)" }}>{new Date(s.created_at).toLocaleString("es-ES")}</p>
                  {s.conversacion_id && (
                    <button type="button" onClick={() => { setSelectedId(s.conversacion_id || ""); setVistaMovil("chat"); }}
                      style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", padding: "6px 12px", fontSize: 12, fontWeight: 700, color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>
                      <MessageCircle size={12} /> Abrir chat
                    </button>
                  )}
                </article>
              ))}
              <div style={{ height: 32 }} />
            </div>

            {/* Tab bar */}
            <nav style={{ flexShrink: 0, borderTop: "1px solid var(--border)", background: "var(--nav-bg)", backdropFilter: "blur(24px)", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
              <button type="button" onClick={() => setVistaMovil("home")}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 0", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", fontFamily: "inherit" }}>
                <MessageCircle size={20} /> Chats
              </button>
              <button type="button" onClick={() => setVistaMovil("solicitudes")}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 0", fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", border: "none", background: "transparent", color: "var(--yellow)", cursor: "pointer", fontFamily: "inherit" }}>
                <Inbox size={20} /> Solicitudes
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* ─── Modal: No asiste ─── */}
      {modalNoAsiste && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)", padding: "0 0 16px" }}>
          <div style={{ width: "100%", maxWidth: 480, borderRadius: 24, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
            <div style={{ height: 3, background: "linear-gradient(90deg, var(--red), var(--orange))" }} />
            <div style={{ padding: 20 }}>
              <div style={{ width: 36, height: 4, borderRadius: 999, background: "var(--border)", margin: "0 auto 16px" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 13, background: "var(--red-soft)", border: "1px solid rgba(248,113,113,0.24)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--red)", flexShrink: 0 }}>
                  <XCircle size={20} />
                </div>
                <div>
                  <p style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 900, color: "var(--text)" }}>Avisar que no podrás ir</p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Recepción recibirá el aviso para gestionar la sesión.</p>
                </div>
              </div>
              {citaHoy && (
                <div style={{ marginBottom: 14, borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--border)", padding: "12px 14px" }}>
                  <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{servicioNombre}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>{formatTime(citaHoy.hora_inicio)} – {formatTime(citaHoy.hora_fin)} · {fisioNombre}</p>
                </div>
              )}
              <textarea value={motivoNoAsiste} onChange={(e) => setMotivoNoAsiste(e.target.value)}
                placeholder="Motivo obligatorio…" rows={4}
                style={{ width: "100%", resize: "none", borderRadius: 14, border: "1.5px solid var(--border)", background: "var(--surface2)", color: "var(--text)", padding: "12px 14px", fontSize: 13.5, outline: "none", fontFamily: "inherit", marginBottom: 14, boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => setModalNoAsiste(false)} disabled={sendingAsistencia}
                  style={{ flex: 1, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--muted)", padding: "12px", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: sendingAsistencia ? 0.5 : 1 }}>
                  Cancelar
                </button>
                <button type="button" onClick={() => void avisarNoAsiste()} disabled={sendingAsistencia}
                  style={{ flex: 1, borderRadius: 14, border: "none", background: "linear-gradient(135deg, var(--purple), var(--purple2))", color: "white", padding: "12px", fontSize: 13.5, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", opacity: sendingAsistencia ? 0.5 : 1 }}>
                  {sendingAsistencia ? "Enviando…" : "Enviar aviso"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}