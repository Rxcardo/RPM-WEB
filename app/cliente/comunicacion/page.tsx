"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowLeft,
  Bell,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Inbox,
  MessageCircle,
  Phone,
  Plus,
  Send,
  UserRound,
  XCircle,
} from "lucide-react";

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

// Vista móvil: "home" | "chat" | "solicitudes"
type VistaMovil = "home" | "chat" | "solicitudes";

const SOLICITUDES_RAPIDAS: SolicitudRapida[] = [
  { value: "solicitar_cita", label: "Solicitar cita", placeholder: "Ej: Quiero solicitar una cita para esta semana..." },
  { value: "reagendar_cita", label: "Reagendar cita", placeholder: "Ej: Necesito cambiar mi cita para otro horario..." },
  { value: "cambio_horario", label: "Cambio de horario", placeholder: "Ej: Quiero cambiar mi horario regular..." },
  { value: "cambio_fisio", label: "Cambio de fisio", placeholder: "Ej: Quisiera solicitar un cambio de fisio..." },
  { value: "consulta_pago", label: "Consulta de pago", placeholder: "Ej: Tengo una duda sobre mi pago o deuda..." },
  { value: "consulta_clinica", label: "Consulta clínica", placeholder: "Ej: Tengo una duda sobre mi evolución o ejercicios..." },
  { value: "otro", label: "General", placeholder: "Escribe tu solicitud..." },
];

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
    solicitar_cita: "Solicitud de cita", reagendar_cita: "Reagendar cita", cancelar_cita: "Cancelar cita",
    cambio_horario: "Cambio de horario", cambio_fisio: "Cambio de fisio",
    aviso_no_asistencia_cliente: "Aviso no asistencia", consulta_pago: "Consulta pago",
    consulta_clinica: "Consulta clínica", otro: "General",
  };
  return map[tipo] || tipo;
}

function estadoStyle(estado: string) {
  switch (estado) {
    case "pendiente": return "border border-amber-400/20 bg-amber-400/10 text-amber-300";
    case "en_revision": return "border border-sky-400/20 bg-sky-400/10 text-sky-300";
    case "aprobada": case "resuelta": return "border border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "rechazada": case "cancelada": return "border border-rose-400/20 bg-rose-400/10 text-rose-300";
    default: return "border border-white/10 bg-white/[0.04] text-white/45";
  }
}

function avatarColor(name?: string | null) {
  const colors = ["from-violet-500 to-purple-600","from-sky-500 to-blue-600","from-emerald-500 to-teal-600","from-rose-500 to-pink-600","from-amber-500 to-orange-600","from-indigo-500 to-violet-600"];
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

export default function ClienteComunicacionPage() {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ), []);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [cliente, setCliente] = useState<ClienteActual | null>(null);
  const [citaHoy, setCitaHoy] = useState<CitaHoy | null>(null);
  const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);

  const [texto, setTexto] = useState("");
  const [toast, setToast] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  const [modalNoAsiste, setModalNoAsiste] = useState(false);
  const [motivoNoAsiste, setMotivoNoAsiste] = useState("");
  const [sendingAsistencia, setSendingAsistencia] = useState(false);

  const [tipoSolicitud, setTipoSolicitud] = useState("solicitar_cita");
  const [mensajeSolicitud, setMensajeSolicitud] = useState("");
  const [sendingSolicitud, setSendingSolicitud] = useState(false);

  const [vistaMovil, setVistaMovil] = useState<VistaMovil>("home");

  const selected = conversaciones.find((c) => c.id === selectedId) || null;
  const solicitudActual = SOLICITUDES_RAPIDAS.find((s) => s.value === tipoSolicitud) || SOLICITUDES_RAPIDAS[0];

  const selectedTitle = selected?.tipo === "cliente_recepcion"
    ? "Recepción"
    : firstOrNull(selected?.fisios)?.nombre || "Fisio";

  const fisioNombre =
    firstOrNull(citaHoy?.terapeutas)?.nombre ||
    firstOrNull(citaHoy?.empleados)?.nombre ||
    firstOrNull(conversaciones.find((c) => c.tipo === "cliente_fisio")?.fisios)?.nombre ||
    "Fisio";

  const servicioNombre = firstOrNull(citaHoy?.servicios)?.nombre || "Sesión";
  const solicitudesPendientes = solicitudes.filter((s) => s.estado === "pendiente");

  useEffect(() => { void boot(); }, []);

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
    const fisioId = cita?.terapeuta_id || cli.terapeuta_id || null;
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
    setTexto("");
    setSendingMsg(true);
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

  async function enviarSolicitudRapida() {
    if (!cliente || mensajeSolicitud.trim().length < 3 || sendingSolicitud) { setToast("Escribe el detalle de la solicitud."); return; }
    setSendingSolicitud(true);
    try {
      const conversacionRecepcion = conversaciones.find((c) => c.tipo === "cliente_recepcion") || null;
      const { data: solicitud, error } = await supabase.from("solicitudes_comunicacion")
        .insert({ conversacion_id: conversacionRecepcion?.id || null, cita_id: citaHoy?.id || null, cliente_id: cliente.id, fisio_id: citaHoy?.terapeuta_id || cliente.terapeuta_id || null, tipo: tipoSolicitud, estado: "pendiente", origen_tipo: "cliente", origen_id: cliente.id, destino_tipo: "recepcion", destino_id: null, titulo: solicitudLabel(tipoSolicitud), descripcion: mensajeSolicitud.trim() })
        .select().single();
      if (error) throw error;
      if (conversacionRecepcion?.id) {
        const { data: msg } = await supabase.from("mensajes")
          .insert({ conversacion_id: conversacionRecepcion.id, remitente_id: cliente.id, remitente_tipo: "cliente", tipo: "solicitud", solicitud_id: solicitud.id, mensaje: `${solicitudLabel(tipoSolicitud)}: ${mensajeSolicitud.trim()}` })
          .select().single();
        if (msg && selectedId === conversacionRecepcion.id) setMensajes((prev) => mergeMensaje(prev, msg as Mensaje));
      }
      setMensajeSolicitud("");
      setToast("Solicitud enviada a recepción.");
      await loadSolicitudes(cliente.id);
      await loadConversaciones(cliente.id);
    } catch (err: any) { setToast(err?.message || "No se pudo enviar la solicitud."); }
    finally { setSendingSolicitud(false); }
  }

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
    <div className="flex h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top_left,#1b1f31_0%,#0b0d12_54%,#090a0f_100%)] text-white">

      {/* Toast */}
      {toast && (
        <button type="button" onClick={() => setToast("")}
          className="fixed bottom-24 left-1/2 z-[60] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#11131b]/95 px-5 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur-xl md:bottom-auto md:right-4 md:top-4 md:left-auto md:translate-x-0">
          {toast}
        </button>
      )}

      {/* ─── DESKTOP: tres columnas ─── */}
      <div className="hidden h-full gap-5 p-5 md:flex">

        {/* Col 1: perfil + sesión + lista de chats */}
        <div className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-[2rem] bg-[#0c0e13]/92 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),0_24px_80px_-40px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
          {/* Perfil */}
          <div className="border-b border-white/[0.045] px-5 pb-4 pt-5">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarColor(cliente?.nombre)} text-sm font-black text-white shadow-lg`}>
                {initials(cliente?.nombre)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-black text-white">{cliente?.nombre || "Cliente"}</p>
                <p className="truncate text-xs text-white/35">{cliente?.telefono || cliente?.email || "Portal"}</p>
              </div>
            </div>

            {/* Sesión de hoy */}
            {citaHoy ? (
              <div className="mt-4 rounded-2xl bg-white/[0.04] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.045)]">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Sesión de hoy</p>
                <p className="mt-2 font-black text-white">{servicioNombre}</p>
                <p className="text-xs text-white/45">{formatTime(citaHoy.hora_inicio)} – {formatTime(citaHoy.hora_fin)} · {fisioNombre}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" disabled={sendingAsistencia} onClick={() => void confirmarAsistenciaCliente()}
                    className="flex flex-col items-center gap-1 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 py-2.5 text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-50">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-[10px] font-black">Voy</span>
                  </button>
                  <button type="button" disabled={sendingAsistencia} onClick={() => setModalNoAsiste(true)}
                    className="flex flex-col items-center gap-1 rounded-2xl border border-rose-400/20 bg-rose-400/10 py-2.5 text-rose-300 transition hover:bg-rose-400/15 disabled:opacity-50">
                    <XCircle className="h-4 w-4" />
                    <span className="text-[10px] font-black">No puedo</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-white/[0.03] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Sesión de hoy</p>
                <p className="mt-2 text-sm text-white/35">No tienes sesión programada hoy.</p>
              </div>
            )}
          </div>

          {/* Lista conversaciones */}
          <div className="flex-1 overflow-y-auto p-3">
            {conversaciones.length === 0 ? (
              <div className="p-4 text-center text-sm text-white/25">Sin conversaciones</div>
            ) : conversaciones.map((c) => {
              const active = selectedId === c.id;
              const title = c.tipo === "cliente_recepcion" ? "Recepción" : firstOrNull(c.fisios)?.nombre || "Fisio";
              return (
                <button key={c.id} type="button" onClick={() => setSelectedId(c.id)}
                  className={`mb-1.5 flex w-full items-center gap-3 rounded-2xl p-3 text-left transition ${active ? "bg-gradient-to-r from-violet-500/22 to-transparent shadow-[inset_0_0_0_1px_rgba(139,92,246,0.18)]" : "hover:bg-white/[0.04]"}`}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-violet-400/20 text-violet-200" : "bg-white/[0.06] text-white/45"}`}>
                    {c.tipo === "cliente_recepcion" ? <Bell className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <p className={`truncate text-sm font-bold ${active ? "text-violet-200" : "text-white"}`}>{title}</p>
                      <span className="text-[10px] text-white/25">{formatRelative(c.ultima_actividad_at)}</span>
                    </div>
                    <p className="truncate text-xs text-white/30">{c.ultimo_mensaje || "Sin mensajes"}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Col 2: chat */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[2rem] bg-[#131620]/95 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.045),0_24px_90px_-42px_rgba(0,0,0,0.95)] backdrop-blur-2xl">
          <div className="flex items-center gap-3 border-b border-white/[0.045] bg-white/[0.015] px-5 py-4">
            {selected ? (
              <>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-400/20 text-violet-200`}>
                  {selected.tipo === "cliente_recepcion" ? <Bell className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-white">{selectedTitle}</p>
                  <p className="text-xs text-white/35">{selected.tipo === "cliente_recepcion" ? "Cliente · Recepción" : "Cliente · Fisio"}</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-white/35">Selecciona una conversación</p>
            )}
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.08),transparent_38%)] px-5 py-5">
            {!selected ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
                  <MessageCircle className="h-7 w-7" />
                </div>
                <p className="text-sm text-white/35">Selecciona Recepción o Fisio</p>
              </div>
            ) : mensajes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] text-white/25">
                  <MessageCircle className="h-7 w-7" />
                </div>
                <p className="text-sm text-white/35">Sin mensajes todavía</p>
              </div>
            ) : mensajes.map((m) => {
              const mine = m.remitente_tipo === "cliente" && m.remitente_id === cliente?.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`flex max-w-[78%] flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                    {m.tipo === "solicitud" && (
                      <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-300">Solicitud</span>
                    )}
                    <div className={`rounded-[1.35rem] px-4 py-2.5 text-sm leading-relaxed shadow-sm ${mine ? "rounded-br-md bg-violet-500/22 text-white" : "rounded-bl-md bg-[#171922] text-white/82 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]"}`}>
                      {m.mensaje}
                    </div>
                    <span className={`text-[10px] ${mine ? "text-violet-300/40 self-end" : "text-white/25 self-start"}`}>
                      {isTempId(m.id) ? "Enviando…" : formatHour(m.created_at)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-white/[0.045] bg-[#11131b]/80 px-4 py-3">
            <div className="flex items-center gap-2 rounded-2xl bg-white/[0.045] px-4 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055)]">
              <input value={texto} onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviarMensaje(); } }}
                disabled={!selected || sendingMsg}
                placeholder={selected ? "Escribe un mensaje…" : "Selecciona una conversación"}
                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-white outline-none placeholder:text-white/25 disabled:opacity-40" />
              <button type="button" onClick={() => void enviarMensaje()} disabled={!selected || sendingMsg || !texto.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500 text-white shadow-[0_12px_38px_-16px_rgba(139,92,246,0.9)] transition hover:bg-violet-400 disabled:opacity-35">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Col 3: solicitudes */}
        <div className="flex w-[360px] shrink-0 flex-col overflow-hidden rounded-[2rem] bg-[#10131a]/88 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),0_20px_70px_-40px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
          <div className="border-b border-white/[0.045] px-5 pb-4 pt-5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-400/15 text-violet-300">
                <CalendarClock className="h-4 w-4" />
              </div>
              <div>
                <p className="font-black text-white">Solicitudes</p>
                <p className="text-xs text-white/30">Pide ayuda a recepción</p>
              </div>
            </div>
            {solicitudesPendientes.length > 0 && (
              <div className="mt-3 rounded-xl bg-amber-400/10 px-3 py-2">
                <p className="text-xs font-black text-amber-300">{solicitudesPendientes.length} pendiente{solicitudesPendientes.length !== 1 ? "s" : ""}</p>
              </div>
            )}
          </div>

          {/* Nueva solicitud form */}
          <div className="border-b border-white/[0.045] px-5 py-4 space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-white/30">Nueva solicitud</p>
            <select value={tipoSolicitud} onChange={(e) => { setTipoSolicitud(e.target.value); setMensajeSolicitud(""); }}
              className="w-full rounded-2xl bg-white/[0.045] px-4 py-3 text-sm text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055)] outline-none">
              {SOLICITUDES_RAPIDAS.map((s) => <option key={s.value} value={s.value} className="bg-[#0f1117]">{s.label}</option>)}
            </select>
            <textarea value={mensajeSolicitud} onChange={(e) => setMensajeSolicitud(e.target.value)}
              placeholder={solicitudActual.placeholder} rows={3}
              className="w-full resize-none rounded-2xl bg-white/[0.045] px-4 py-3 text-sm text-white placeholder:text-white/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055)] outline-none" />
            <button type="button" disabled={sendingSolicitud} onClick={() => void enviarSolicitudRapida()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-500 py-3 text-sm font-black text-white shadow-[0_14px_42px_-18px_rgba(139,92,246,0.9)] transition hover:bg-violet-400 disabled:opacity-50">
              <Send className="h-4 w-4" />
              {sendingSolicitud ? "Enviando…" : "Enviar solicitud"}
            </button>
          </div>

          {/* Mis solicitudes */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.08),transparent_38%)] p-5">
            <p className="text-xs font-black uppercase tracking-widest text-white/30">Mis solicitudes</p>
            {solicitudes.length === 0 ? (
              <div className="rounded-2xl bg-white/[0.035] p-4 text-center text-sm text-white/25 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]">Sin solicitudes todavía</div>
            ) : solicitudes.map((s) => (
              <article key={s.id} className="rounded-2xl bg-white/[0.035] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)] transition hover:bg-white/[0.05]">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-black text-white">{solicitudLabel(s.tipo)}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${estadoStyle(s.estado)}`}>{s.estado}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/55">{s.descripcion}</p>
                <p className="mt-1.5 text-[10px] text-white/25">{new Date(s.created_at).toLocaleString("es-ES")}</p>
                {s.conversacion_id && (
                  <button type="button" onClick={() => setSelectedId(s.conversacion_id || "")}
                    className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-1.5 text-xs font-black text-white/55 transition hover:bg-white/[0.09]">
                    <MessageCircle className="h-3 w-3" /> Abrir chat
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* ─── MÓVIL: vistas independientes ─── */}
      <div className="flex h-full flex-col md:hidden">

        {/* Vista: Home (chats + info sesión) */}
        {vistaMovil === "home" && (
          <div className="flex h-full flex-col">
            <div className="border-b border-white/[0.06] px-4 pt-12 pb-4 safe-top">
              {/* Header perfil */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarColor(cliente?.nombre)} text-sm font-black text-white`}>
                    {initials(cliente?.nombre)}
                  </div>
                  <div>
                    <p className="font-black text-white leading-tight">{cliente?.nombre || "Cliente"}</p>
                    <p className="text-[11px] text-white/35">Portal del cliente</p>
                  </div>
                </div>
                <button type="button" onClick={() => setVistaMovil("solicitudes")}
                  className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-white/45">
                  <Inbox className="h-4 w-4" />
                  {solicitudesPendientes.length > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-black">
                      {solicitudesPendientes.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Sesión de hoy */}
              {citaHoy ? (
                <div className="mt-4 rounded-2xl bg-white/[0.04] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.045)]">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Sesión de hoy</p>
                  <p className="mt-1.5 font-black text-white">{servicioNombre}</p>
                  <p className="text-xs text-white/40">{formatTime(citaHoy.hora_inicio)} – {formatTime(citaHoy.hora_fin)} · {fisioNombre}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" disabled={sendingAsistencia} onClick={() => void confirmarAsistenciaCliente()}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 py-3 text-xs font-black text-emerald-300 transition active:bg-emerald-400/15 disabled:opacity-50">
                      <CheckCircle2 className="h-4 w-4" /> Voy a asistir
                    </button>
                    <button type="button" disabled={sendingAsistencia} onClick={() => setModalNoAsiste(true)}
                      className="flex items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 py-3 text-xs font-black text-rose-300 transition active:bg-rose-400/15 disabled:opacity-50">
                      <XCircle className="h-4 w-4" /> No podré ir
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-white/[0.03] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.035)]">
                  <p className="text-xs text-white/30">No tienes sesión programada hoy.</p>
                </div>
              )}
            </div>

            {/* Lista de conversaciones */}
            <div className="flex-1 overflow-y-auto">
              <p className="px-4 pt-4 pb-2 text-[10px] font-black uppercase tracking-widest text-white/25">Mis chats</p>
              {conversaciones.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-white/25">Sin conversaciones</div>
              ) : conversaciones.map((c) => {
                const title = c.tipo === "cliente_recepcion" ? "Recepción" : firstOrNull(c.fisios)?.nombre || "Fisio";
                return (
                  <button key={c.id} type="button"
                    onClick={() => { setSelectedId(c.id); setVistaMovil("chat"); }}
                    className="flex w-full items-center gap-3.5 border-b border-white/[0.04] px-4 py-4 text-left transition active:bg-white/[0.04]">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-400/15 text-violet-200">
                      {c.tipo === "cliente_recepcion" ? <Bell className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-bold text-white">{title}</p>
                        <span className="shrink-0 text-[10px] text-white/25">{formatRelative(c.ultima_actividad_at)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-white/30">{c.ultimo_mensaje || "Sin mensajes"}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/15" />
                  </button>
                );
              })}
              <div className="h-24" />
            </div>

            {/* Tab bar */}
            <nav className="safe-bottom border-t border-white/[0.06] bg-[#0d0d12]/95 backdrop-blur-xl">
              <div className="grid grid-cols-2">
                <button type="button" onClick={() => setVistaMovil("home")}
                  className="flex flex-col items-center gap-1 py-3 text-[10px] font-black uppercase tracking-wider text-violet-300">
                  <MessageCircle className="h-5 w-5" /> Chats
                </button>
                <button type="button" onClick={() => setVistaMovil("solicitudes")}
                  className="relative flex flex-col items-center gap-1 py-3 text-[10px] font-black uppercase tracking-wider text-white/30">
                  <div className="relative">
                    <Inbox className="h-5 w-5" />
                    {solicitudesPendientes.length > 0 && (
                      <span className="absolute -top-1.5 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-black">
                        {solicitudesPendientes.length}
                      </span>
                    )}
                  </div>
                  Solicitudes
                </button>
              </div>
            </nav>
          </div>
        )}

        {/* Vista: Chat activo */}
        {vistaMovil === "chat" && (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-3 pt-12 pb-3 safe-top">
              <button type="button" onClick={() => setVistaMovil("home")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/50 active:bg-white/[0.06]">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-400/15 text-violet-200">
                {selected?.tipo === "cliente_recepcion" ? <Bell className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-white leading-tight">{selectedTitle}</p>
                <p className="text-[11px] text-white/35">{selected?.tipo === "cliente_recepcion" ? "Cliente · Recepción" : "Cliente · Fisio"}</p>
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {mensajes.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] text-white/20">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <p className="text-sm text-white/30">Sin mensajes todavía</p>
                </div>
              ) : mensajes.map((m) => {
                const mine = m.remitente_tipo === "cliente" && m.remitente_id === cliente?.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`flex max-w-[78%] flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                      {m.tipo === "solicitud" && (
                        <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-black uppercase text-amber-300">Solicitud</span>
                      )}
                      <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${mine ? "rounded-br-sm bg-violet-500/25 text-white" : "rounded-bl-sm bg-white/[0.07] text-white/85"}`}>
                        {m.mensaje}
                      </div>
                      <span className="text-[10px] text-white/20">
                        {isTempId(m.id) ? "Enviando…" : formatHour(m.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
              <div className="h-4" />
            </div>

            <div className="border-t border-white/[0.06] bg-[#0d0d12] px-3 py-3 safe-bottom">
              <div className="flex items-center gap-2 rounded-2xl border border-white/[0.09] bg-white/[0.05] px-4 py-2">
                <input value={texto} onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void enviarMensaje(); } }}
                  disabled={sendingMsg}
                  placeholder="Escribe un mensaje…"
                  className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-white outline-none placeholder:text-white/25 disabled:opacity-40" />
                <button type="button" onClick={() => void enviarMensaje()} disabled={sendingMsg || !texto.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500 text-white shadow-md transition active:bg-violet-400 disabled:opacity-35">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vista: Solicitudes */}
        {vistaMovil === "solicitudes" && (
          <div className="flex h-full flex-col">
            <div className="border-b border-white/[0.06] px-4 pt-12 pb-4 safe-top">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-white">Solicitudes</h2>
                  <p className="text-xs text-white/30">Pide ayuda a recepción</p>
                </div>
              </div>

              {/* Form nueva solicitud */}
              <div className="mt-4 space-y-3">
                <select value={tipoSolicitud} onChange={(e) => { setTipoSolicitud(e.target.value); setMensajeSolicitud(""); }}
                  className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white outline-none">
                  {SOLICITUDES_RAPIDAS.map((s) => <option key={s.value} value={s.value} className="bg-[#0f1117]">{s.label}</option>)}
                </select>
                <div className="flex gap-2">
                  <input value={mensajeSolicitud} onChange={(e) => setMensajeSolicitud(e.target.value)}
                    placeholder={solicitudActual.placeholder}
                    className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25" />
                  <button type="button" disabled={sendingSolicitud} onClick={() => void enviarSolicitudRapida()}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-md disabled:opacity-50">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/25">Mis solicitudes ({solicitudes.length})</p>
              {solicitudes.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-white/25">Sin solicitudes todavía</div>
              ) : solicitudes.map((s) => (
                <article key={s.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-black text-white">{solicitudLabel(s.tipo)}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${estadoStyle(s.estado)}`}>{s.estado}</span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-white/55">{s.descripcion}</p>
                  <p className="mt-1.5 text-[10px] text-white/25">{new Date(s.created_at).toLocaleString("es-ES")}</p>
                  {s.conversacion_id && (
                    <button type="button" onClick={() => { setSelectedId(s.conversacion_id || ""); setVistaMovil("chat"); }}
                      className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-1.5 text-xs font-black text-white/55">
                      <MessageCircle className="h-3 w-3" /> Abrir chat
                    </button>
                  )}
                </article>
              ))}
              <div className="h-24" />
            </div>

            {/* Tab bar */}
            <nav className="safe-bottom border-t border-white/[0.06] bg-[#0d0d12]/95 backdrop-blur-xl">
              <div className="grid grid-cols-2">
                <button type="button" onClick={() => setVistaMovil("home")}
                  className="flex flex-col items-center gap-1 py-3 text-[10px] font-black uppercase tracking-wider text-white/30">
                  <MessageCircle className="h-5 w-5" /> Chats
                </button>
                <button type="button" onClick={() => setVistaMovil("solicitudes")}
                  className="flex flex-col items-center gap-1 py-3 text-[10px] font-black uppercase tracking-wider text-amber-300">
                  <div className="relative">
                    <Inbox className="h-5 w-5" />
                    {solicitudesPendientes.length > 0 && (
                      <span className="absolute -top-1.5 -right-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-black text-black">
                        {solicitudesPendientes.length}
                      </span>
                    )}
                  </div>
                  Solicitudes
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>

      {/* ─── Modal: No asiste ─── */}
      {modalNoAsiste && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center">
          <div className="w-full max-w-md rounded-t-[2rem] bg-[#0f1117]/95 p-5 shadow-2xl ring-1 ring-white/10 backdrop-blur-2xl md:rounded-[2rem]">
            <div className="mb-1 flex h-1 w-10 mx-auto rounded-full bg-white/15 md:hidden" />
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-400/10 text-rose-300">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-black text-white">Avisar que no podrás ir</p>
                <p className="text-xs text-white/35">Recepción recibirá el aviso para gestionar la sesión.</p>
              </div>
            </div>
            {citaHoy && (
              <div className="mt-4 rounded-2xl bg-white/[0.04] px-4 py-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.045)]">
                <p className="text-sm font-black text-white">{servicioNombre}</p>
                <p className="text-xs text-white/40">{formatTime(citaHoy.hora_inicio)} – {formatTime(citaHoy.hora_fin)} · {fisioNombre}</p>
              </div>
            )}
            <textarea value={motivoNoAsiste} onChange={(e) => setMotivoNoAsiste(e.target.value)}
              placeholder="Motivo obligatorio…" rows={4}
              className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25" />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setModalNoAsiste(false)} disabled={sendingAsistencia}
                className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] py-3 text-sm font-bold text-white/55 disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={() => void avisarNoAsiste()} disabled={sendingAsistencia}
                className="flex-1 rounded-2xl bg-violet-500 py-3 text-sm font-black text-white shadow-[0_14px_42px_-18px_rgba(139,92,246,0.9)] transition hover:bg-violet-400 disabled:opacity-50">
                {sendingAsistencia ? "Enviando…" : "Enviar aviso"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}