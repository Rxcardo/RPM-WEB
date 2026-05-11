"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Section from "@/components/ui/Section";
import StatCard from "@/components/ui/StatCard";
import ActionCard from "@/components/ui/ActionCard";

type Empleado = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  rol: string;
  especialidad: string | null;
  estado: string;
  comision_plan_porcentaje: number;
  comision_cita_porcentaje: number;
  created_at: string;
};

type ClienteAsignado = {
  id: string;
  nombre: string;
  telefono: string | null;
  estado: string;
};

type AgendaItem = {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  nombre: string;
  subtitulo: string;
  tipo: "entrenamiento" | "cita";
  notas: string | null;
};

type ComisionDetalle = {
  id: string;
  base: number;
  profesional: number;
  rpm: number;
  fecha: string;
  tipo: string;
  estado: string;
  moneda: "USD" | "BS" | string | null;
  tasa_bcv: number | null;
  monto_base_usd: number | null;
  monto_base_bs: number | null;
  monto_rpm_usd: number | null;
  monto_rpm_bs: number | null;
  monto_profesional_usd: number | null;
  monto_profesional_bs: number | null;
  pagado: boolean | null;
  fecha_pago: string | null;
  liquidacion_id?: string | null;
  pago_empleado_id?: string | null;
  pago_id?: string | null;
  cliente_id?: string | null;
  cliente_plan_id?: string | null;
  pago_concepto?: string | null;
  pago_categoria?: string | null;
  pago_fecha?: string | null;
  pago_cliente_nombre?: string | null;
  cita_id?: string | null;
  servicio_id?: string | null;
  concepto?: string | null;
  descripcion?: string | null;
  cliente_nombre?: string | null;
  servicio_nombre?: string | null;
  cita_fecha?: string | null;
  cita_hora_inicio?: string | null;
  descuento_deuda_usd?: number | null;
  descuento_deuda_bs?: number | null;
  monto_profesional_neto_usd?: number | null;
  monto_profesional_neto_bs?: number | null;
  descuento_deuda_registros?: Array<{
    id?: string;
    estado?: string | null;
    modo?: string | null;
    liquidacion_id?: string | null;
    pago_empleado_id?: string | null;
    created_at?: string | null;
    notas?: string | null;
    monto_descuento_usd?: number | null;
    monto_descuento_bs?: number | null;
  }>;
};

type Liquidacion = {
  id: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  total_base: number;
  total_profesional: number;
  total_rpm: number;
  cantidad_citas: number;
  estado: string;
  pagado_at: string | null;
  moneda_pago: "USD" | "BS" | string | null;
  monto_pago: number | null;
  tasa_bcv: number | null;
  monto_equivalente_usd: number | null;
  monto_equivalente_bs: number | null;
  referencia: string | null;
  notas: string | null;
  metodo_pago_id: string | null;
  metodo_pago_v2_id?: string | null;
  pago_empleado_id: string | null;
  egreso_id: string | null;
};

type EstadoCuentaEmpleado = {
  empleado_id: string;
  nombre: string | null;
  rol: string | null;
  total_facturado_usd: number | null;
  total_pagado_usd: number | null;
  total_pendiente_usd: number | null;
  credito_disponible_usd: number | null;
  saldo_pendiente_neto_usd: number | null;
  saldo_favor_neto_usd: number | null;
};

type CuentaPendienteEmpleado = {
  id: string;
  empleado_id: string | null;
  empleado_nombre: string;
  concepto: string;
  monto_total_usd: number | null;
  monto_pagado_usd: number | null;
  saldo_usd: number | null;
  fecha_venta: string;
  fecha_vencimiento: string | null;
  estado: string;
};

type MetodoPago = {
  id: string;
  nombre: string;
  tipo?: string | null;
  moneda?: string | null;
  color?: string | null;
  icono?: string | null;
  cartera?: {
    id?: string;
    nombre: string;
    codigo: string;
    saldo_actual?: number | string | null;
    moneda?: string | null;
  } | null;
};

type SplitPago = {
  id: string;
  metodoPagoId: string;
  monto: string;
};

type TipoCambioRow = {
  fecha?: string | null;
  tasa?: number | string | null;
  valor?: number | string | null;
  monto?: number | string | null;
  bcv?: number | string | null;
  precio?: number | string | null;
};

type Moneda = "USD" | "BS";
type Tab = "info" | "agenda" | "comisiones";
type PeriodoComision = "pendientes" | "quincena" | "mes" | "liquidacion" | "personalizado";

function getTodayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getCurrentQuincenaRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const dia = now.getDate();
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
  if (dia <= 15) {
    return { label: `1–15 de ${now.toLocaleDateString("es", { month: "long" })}`, inicio: `${y}-${m}-01`, fin: `${y}-${m}-15` };
  }
  return { label: `16–${lastDay} de ${now.toLocaleDateString("es", { month: "long" })}`, inicio: `${y}-${m}-16`, fin: `${y}-${m}-${String(lastDay).padStart(2, "0")}` };
}

function formatMoney(v: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v || 0));
}

function formatBs(v: number | null | undefined) {
  return new Intl.NumberFormat("es-VE", { style: "currency", currency: "VES", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v || 0));
}

function formatMontoByMoneda(v: number | null | undefined, moneda: Moneda) {
  return moneda === "USD" ? formatMoney(v) : formatBs(v);
}

function monedaAbbr(moneda: Moneda) { return moneda === "USD" ? "USD" : "Bs"; }

function formatDate(v: string | null) {
  if (!v) return "—";
  try { return new Date(`${v}T00:00:00`).toLocaleDateString("es"); } catch { return v; }
}

function formatDateLong(v: string | null) {
  if (!v) return "—";
  try { return new Date(`${v}T00:00:00`).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" }); } catch { return v; }
}

function shortDate(value: string | null | undefined) {
  if (!value) return "—";
  try { return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return String(value); }
}

function sanitizeFilePart(value: string) {
  return String(value || "").trim().replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "_").slice(0, 80);
}

function firstDayOfCurrentMonthISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function lastDayOfCurrentMonthISO() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

async function fetchImageAsBase64(src: string) {
  const res = await fetch(src);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function drawCommissionHeader(args: { doc: jsPDF; logoSrc: string; numero: string; empleado: Empleado; fechaPago: string; }) {
  const { doc, logoSrc, numero, empleado, fechaPago } = args;
  try { const base64 = await fetchImageAsBase64(logoSrc); doc.addImage(base64, "PNG", 18, 10, 34, 34); } catch {}
  doc.setDrawColor(40); doc.setLineWidth(0.25); doc.rect(105, 13, 82, 28);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(75);
  doc.text("Número:", 113, 22); doc.text("Fecha pago:", 151, 22);
  doc.text("Nombre:", 113, 31); doc.text("Rol:", 113, 38);
  doc.setFont("helvetica", "bold"); doc.setTextColor(20);
  doc.text(numero, 128, 22); doc.text(shortDate(fechaPago), 171, 22, { align: "center" });
  doc.text(String(empleado.nombre || "—").toUpperCase(), 128, 31);
  doc.text(String(empleado.rol || "—").toUpperCase(), 128, 38);
  doc.setDrawColor(30); doc.setLineWidth(0.35); doc.line(15, 52, 195, 52);
}

function drawCommissionFooter(doc: jsPDF) {
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(55);
  doc.text("Naguanagua, complejo Bicentenario Asociación de Tenis de Carabobo ATEC, VALENCIA - ESTADO CARABOBO - Teléfonos: 0412-2405745", 105, pageHeight - 8, { align: "center" });
}

function estadoBadge(e: string) {
  switch ((e || "").toLowerCase()) {
    case "activo": return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "inactivo": return "border-white/10 bg-white/[0.05] text-white/50";
    case "suspendido": return "border-rose-400/20 bg-rose-400/10 text-rose-300";
    default: return "border-amber-400/20 bg-amber-400/10 text-amber-300";
  }
}

function citaBadge(e: string) {
  switch ((e || "").toLowerCase()) {
    case "confirmada": return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
    case "completada": return "border-violet-400/20 bg-violet-400/10 text-violet-300";
    case "cancelada": return "border-rose-400/20 bg-rose-400/10 text-rose-300";
    case "reprogramada": return "border-amber-400/20 bg-amber-400/10 text-amber-300";
    default: return "border-sky-400/20 bg-sky-400/10 text-sky-300";
  }
}

function inputCls(disabled = false) {
  return `w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05] ${disabled ? "cursor-not-allowed opacity-60" : ""}`;
}

function r2(v: number) { return Math.round(v * 100) / 100; }
function normalizeEstado(value: string | null | undefined) { return (value || "").trim().toLowerCase(); }
function isPendienteEstado(value: string | null | undefined) { return normalizeEstado(value) === "pendiente"; }
function isFacturadaEstado(value: string | null | undefined) { return ["liquidado", "liquidada", "pagado", "pagada"].includes(normalizeEstado(value)); }
function firstOrNull<T>(value: T | T[] | null | undefined): T | null { if (Array.isArray(value)) return value[0] ?? null; return value ?? null; }

function normalizeMetodoPago(row: any): MetodoPago {
  const cartera = firstOrNull(row?.cartera);
  return {
    id: String(row?.id ?? ""), nombre: String(row?.nombre ?? ""), tipo: row?.tipo ?? null,
    moneda: row?.moneda ?? null, color: row?.color ?? null, icono: row?.icono ?? null,
    cartera: cartera ? { id: cartera?.id ? String(cartera.id) : undefined, nombre: String(cartera?.nombre ?? ""), codigo: String(cartera?.codigo ?? ""), saldo_actual: cartera?.saldo_actual ?? null, moneda: cartera?.moneda ?? null } : null,
  };
}

function monedaMetodoEsBs(metodo: MetodoPago | null) {
  if (!metodo) return false;
  const moneda = (metodo.moneda || "").toUpperCase();
  const nombre = (metodo.nombre || "").toLowerCase();
  const tipo = (metodo.tipo || "").toLowerCase();
  const carteraCodigo = (metodo.cartera?.codigo || "").toLowerCase();
  const carteraMoneda = (metodo.cartera?.moneda || "").toUpperCase();
  return moneda === "BS" || moneda === "VES" || carteraMoneda === "BS" || carteraMoneda === "VES" || nombre.includes("bs") || nombre.includes("bolívar") || nombre.includes("bolivar") || nombre.includes("pago movil") || nombre.includes("pago móvil") || nombre.includes("movil") || nombre.includes("móvil") || tipo.includes("pago_movil") || carteraCodigo.includes("bs") || carteraCodigo.includes("ves");
}

function getMetodoMoneda(metodo: MetodoPago | null): Moneda { return monedaMetodoEsBs(metodo) ? "BS" : "USD"; }
function getMetodoSaldo(metodo: MetodoPago | null) { const raw = metodo?.cartera?.saldo_actual; const n = Number(raw || 0); return Number.isFinite(n) ? n : 0; }

function getComisionBrutoByMoneda(c: ComisionDetalle, moneda: Moneda) {
  return moneda === "USD" ? Number(c.monto_profesional_usd ?? c.profesional ?? 0) : Number(c.monto_profesional_bs ?? 0);
}
function getComisionDescuentoDeudaByMoneda(c: ComisionDetalle, moneda: Moneda) {
  return moneda === "USD" ? Number(c.descuento_deuda_usd ?? 0) : Number(c.descuento_deuda_bs ?? 0);
}
function getComisionMontoByMoneda(c: ComisionDetalle, moneda: Moneda) {
  const bruto = getComisionBrutoByMoneda(c, moneda);
  const descuento = getComisionDescuentoDeudaByMoneda(c, moneda);
  const netoPersistido = moneda === "USD" ? Number(c.monto_profesional_neto_usd ?? NaN) : Number(c.monto_profesional_neto_bs ?? NaN);
  if (Number.isFinite(netoPersistido)) return r2(Math.max(netoPersistido, 0));
  return r2(Math.max(bruto - descuento, 0));
}

function getComisionPagoEstadoPDF(c: ComisionDetalle, liquidacionId?: string | null, pagoEmpleadoId?: string | null) {
  const descuentoUsd = getComisionDescuentoDeudaByMoneda(c, "USD");
  const enlazadaLiquidacion = (!!liquidacionId && c.liquidacion_id === liquidacionId) || (!!pagoEmpleadoId && c.pago_empleado_id === pagoEmpleadoId);
  const descuentoLigado = (c.descuento_deuda_registros || []).some((d) => (!!liquidacionId && d?.liquidacion_id === liquidacionId) || (!!pagoEmpleadoId && d?.pago_empleado_id === pagoEmpleadoId));
  if (isFacturadaEstado(c.estado) || enlazadaLiquidacion) return "LIQUIDADO";
  if (descuentoUsd > 0 || descuentoLigado) return "PENDIENTE NETO";
  return normalizeEstado(c.estado).toUpperCase() || "PENDIENTE";
}

function convertirMonto(monto: number, from: Moneda, to: Moneda, tasa: number | null | undefined): number | null {
  const montoNum = Number(monto || 0);
  if (!Number.isFinite(montoNum)) return null;
  if (from === to) return r2(montoNum);
  if (!tasa || tasa <= 0) return null;
  if (from === "USD" && to === "BS") return r2(montoNum * tasa);
  if (from === "BS" && to === "USD") return r2(montoNum / tasa);
  return null;
}

function uniqueStrings(values: any[]) { return [...new Set(values.map((v) => (v ? String(v) : "")).filter(Boolean))]; }
function mapById<T extends { id?: string | null }>(rows: T[] | null | undefined) {
  const map = new Map<string, T>();
  for (const row of rows || []) { if (row?.id) map.set(String(row.id), row); }
  return map;
}

function normalizeComisionDetalle(row: any, ctx?: { pagosMap?: Map<string, any>; clientesMap?: Map<string, any>; citasMap?: Map<string, any>; serviciosMap?: Map<string, any>; clientesPlanesMap?: Map<string, any>; descuentosMap?: Map<string, { usd: number; bs: number; registros: any[] }>; }): ComisionDetalle {
  const get = (v: any) => { if (!v) return null; return Array.isArray(v) ? v[0] : v; };
  const pago = get(row?.pagos) ?? (row?.pago_id ? ctx?.pagosMap?.get(String(row.pago_id)) : null);
  const cita = get(row?.citas) ?? (row?.cita_id ? ctx?.citasMap?.get(String(row.cita_id)) : null);
  const plan = get(row?.clientes_planes) ?? (row?.cliente_plan_id ? ctx?.clientesPlanesMap?.get(String(row.cliente_plan_id)) : null);
  const clientePago = pago?.cliente_id ? ctx?.clientesMap?.get(String(pago.cliente_id)) : get(pago?.clientes);
  const clienteDirecto = get(row?.clientes) ?? (row?.cliente_id ? ctx?.clientesMap?.get(String(row.cliente_id)) : null);
  const clienteCita = cita?.cliente_id ? ctx?.clientesMap?.get(String(cita.cliente_id)) : get(cita?.clientes);
  const clientePlan = plan?.cliente_id ? ctx?.clientesMap?.get(String(plan.cliente_id)) : get(plan?.clientes);
  const servicioDirecto = get(row?.servicios) ?? (row?.servicio_id ? ctx?.serviciosMap?.get(String(row.servicio_id)) : null);
  const servicioCita = cita?.servicio_id ? ctx?.serviciosMap?.get(String(cita.servicio_id)) : get(cita?.servicios);
  const conceptoPago = typeof pago?.concepto === "string" ? pago.concepto.trim() : "";
  const servicioNombre = servicioDirecto?.nombre ?? servicioCita?.nombre ?? row?.servicio_nombre ?? null;
  const clienteNombre = clientePago?.nombre ?? clienteDirecto?.nombre ?? clienteCita?.nombre ?? clientePlan?.nombre ?? (row?.cliente_id ? `Cliente ${String(row.cliente_id).slice(0, 6)}` : null) ?? "Cliente desconocido";
  const descuentoAplicado = row?.id ? ctx?.descuentosMap?.get(String(row.id)) : null;
  return {
    ...row, pago_id: row?.pago_id ?? pago?.id ?? null, concepto: (row?.concepto ?? conceptoPago) || null,
    pago_concepto: conceptoPago || null, pago_categoria: pago?.categoria ?? null, pago_fecha: pago?.fecha ?? null,
    pago_cliente_nombre: clientePago?.nombre ?? null, cliente_nombre: clienteNombre, servicio_nombre: servicioNombre,
    cita_fecha: cita?.fecha ?? null, cita_hora_inicio: cita?.hora_inicio ?? null,
    descuento_deuda_usd: r2(Number(descuentoAplicado?.usd || 0)), descuento_deuda_bs: r2(Number(descuentoAplicado?.bs || 0)),
    descuento_deuda_registros: descuentoAplicado?.registros || [],
    monto_profesional_neto_usd: r2(Math.max(Number(row?.monto_profesional_usd ?? row?.profesional ?? 0) - Number(descuentoAplicado?.usd || 0), 0)),
    monto_profesional_neto_bs: r2(Math.max(Number(row?.monto_profesional_bs ?? 0) - Number(descuentoAplicado?.bs || 0), 0)),
  };
}

function getComisionConcepto(c: ComisionDetalle): string {
  if (c.concepto?.trim()) return c.concepto.trim();
  const tipo = (c.tipo || "").toLowerCase();
  const servicio = c.servicio_nombre?.trim();
  const cliente = c.cliente_nombre?.trim();
  if (tipo === "plan") { if (servicio && cliente) return `Plan · ${servicio} · ${cliente}`; if (servicio) return `Plan · ${servicio}`; if (cliente) return `Plan · ${cliente}`; return "Comisión por plan"; }
  if (tipo === "cita") { if (servicio && cliente) return `Cita · ${servicio} · ${cliente}`; if (servicio) return `Cita · ${servicio}`; if (cliente) return `Cita · ${cliente}`; return "Comisión por cita"; }
  if (servicio && cliente) return `${servicio} · ${cliente}`;
  if (servicio) return servicio;
  if (cliente) return `Comisión · ${cliente}`;
  return `Comisión · ${formatDate(c.cita_fecha || c.fecha)}`;
}

function getComisionSubtitulo(c: ComisionDetalle): string {
  const partes: string[] = [];
  if (c.cliente_nombre && c.cliente_nombre !== "Cliente desconocido") partes.push(c.cliente_nombre);
  if (c.cita_fecha) partes.push(formatDate(c.cita_fecha)); else partes.push(formatDate(c.fecha));
  if (c.cita_hora_inicio) partes.push(String(c.cita_hora_inicio).slice(0, 5));
  if (c.servicio_nombre) partes.push(c.servicio_nombre);
  return partes.length ? partes.join(" · ") : c.concepto || "Comisión registrada";
}

function chunkAgendaByCliente(items: AgendaItem[]) {
  const map = new Map<string, { cliente: string; items: AgendaItem[] }>();
  for (const item of items) {
    const key = item.nombre || "Sin cliente";
    if (!map.has(key)) map.set(key, { cliente: key, items: [] });
    map.get(key)!.items.push(item);
  }
  return [...map.values()].map((group) => ({ ...group, items: [...group.items].sort((a, b) => `${a.fecha} ${a.hora_inicio}`.localeCompare(`${b.fecha} ${b.hora_inicio}`)) })).sort((a, b) => a.cliente.localeCompare(b.cliente));
}

export default function VerPersonalPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("info");
  const [loading, setLoading] = useState(true);
  const [empleado, setEmpleado] = useState<Empleado | null>(null);
  const [clientes, setClientes] = useState<ClienteAsignado[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [comisiones, setComisiones] = useState<ComisionDetalle[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([]);
  const [liquidacionAbiertaId, setLiquidacionAbiertaId] = useState<string | null>(null);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [estadoCuentaEmpleado, setEstadoCuentaEmpleado] = useState<EstadoCuentaEmpleado | null>(null);
  const [cuentasPendientesEmpleado, setCuentasPendientesEmpleado] = useState<CuentaPendienteEmpleado[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [facturando, setFacturando] = useState(false);
  const [agendaFiltro, setAgendaFiltro] = useState<"hoy" | "proximos" | "todos">("hoy");
  const [agendaTipo, setAgendaTipo] = useState<"todos" | "entrenamientos" | "citas">("todos");
  const [agendaClienteFiltro, setAgendaClienteFiltro] = useState("todos");
  const [monedaPago, setMonedaPago] = useState<Moneda>("USD");
  const [fechaPagoComision, setFechaPagoComision] = useState("");
  const [periodoComision, setPeriodoComision] = useState<PeriodoComision>("pendientes");
  const [fechaInicioComision, setFechaInicioComision] = useState("");
  const [fechaFinComision, setFechaFinComision] = useState("");
  const [liquidacionImprimirId, setLiquidacionImprimirId] = useState("");
  const [referencia, setReferencia] = useState("");
  const [notasLiquidacion, setNotasLiquidacion] = useState("");
  const [tasaBCV, setTasaBCV] = useState<number | null>(null);
  const [tasaBCVAuto, setTasaBCVAuto] = useState<number | null>(null);
  const [cargandoTasa, setCargandoTasa] = useState(false);
  const [selectedComisionIds, setSelectedComisionIds] = useState<string[]>([]);
  const [splitsPago, setSplitsPago] = useState<SplitPago[]>([{ id: crypto.randomUUID(), metodoPagoId: "", monto: "" }]);
  const [aplicarDescuentoDeuda, setAplicarDescuentoDeuda] = useState(false);
  const [descuentoDeudaUsdInput, setDescuentoDeudaUsdInput] = useState("");
  const [modoDescuentoDeuda, setModoDescuentoDeuda] = useState<"solo_descuento" | "descuento_y_pagar">("descuento_y_pagar");
  const [destinoDescuentoDeuda, setDestinoDescuentoDeuda] = useState<"ingreso_rpm" | "ajuste_nomina">("ingreso_rpm");

  useEffect(() => { setMounted(true); }, []);
  const hoy = useMemo(() => (mounted ? getTodayLocal() : ""), [mounted]);
  const quincenaActual = useMemo(() => mounted ? getCurrentQuincenaRange() : { label: "", inicio: "", fin: "" }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    setFechaPagoComision((prev) => prev || getTodayLocal());
    setFechaInicioComision((prev) => prev || quincenaActual.inicio);
    setFechaFinComision((prev) => prev || quincenaActual.fin);
  }, [mounted, quincenaActual.inicio, quincenaActual.fin]);

  useEffect(() => { if (!mounted || !id) return; void loadAll(); }, [id, mounted]);

  useEffect(() => {
    setSelectedComisionIds([]); setSplitsPago([{ id: crypto.randomUUID(), metodoPagoId: "", monto: "" }]);
    setReferencia(""); setNotasLiquidacion(""); setTasaBCV(null); setTasaBCVAuto(null);
    setAplicarDescuentoDeuda(false); setDescuentoDeudaUsdInput(""); setModoDescuentoDeuda("descuento_y_pagar"); setDestinoDescuentoDeuda("ingreso_rpm");
  }, [monedaPago]);

  async function fetchComisionesDetalladas(empleadoId: string) {
    const baseRes = await supabase.from("comisiones_detalle").select("*").eq("empleado_id", empleadoId).order("fecha", { ascending: false });
    if (baseRes.error) return baseRes;
    const rows = (baseRes.data || []) as any[];
    const pagoIds = uniqueStrings(rows.map((r) => r.pago_id));
    const citaIds = uniqueStrings(rows.map((r) => r.cita_id));
    const servicioIdsDirectos = uniqueStrings(rows.map((r) => r.servicio_id));
    const clienteIdsDirectos = uniqueStrings(rows.map((r) => r.cliente_id));
    const clientePlanIds = uniqueStrings(rows.map((r) => r.cliente_plan_id));
    const comisionIds = uniqueStrings(rows.map((r) => r.id));
    let pagosMap = new Map<string, any>(); let citasMap = new Map<string, any>(); let serviciosMap = new Map<string, any>(); let clientesPlanesMap = new Map<string, any>(); let clientesMap = new Map<string, any>(); let descuentosMap = new Map<string, { usd: number; bs: number; registros: any[] }>();
    if (comisionIds.length > 0) {
      const { data, error: descuentosError } = await supabase.from("comisiones_descuentos_deuda").select("*").in("comision_id", comisionIds);
      if (descuentosError) console.error("Error cargando descuentos de deuda:", descuentosError);
      for (const d of (data || []) as any[]) {
        const key = String(d.comision_id || ""); if (!key) continue;
        const estado = normalizeEstado(d.estado);
        if (["anulado", "anulada", "cancelado", "cancelada", "revertido", "revertida"].includes(estado)) continue;
        const prev = descuentosMap.get(key) || { usd: 0, bs: 0, registros: [] };
        descuentosMap.set(key, { usd: r2(prev.usd + Number(d.monto_descuento_usd || 0)), bs: r2(prev.bs + Number(d.monto_descuento_bs || 0)), registros: [...prev.registros, d] });
      }
    }
    if (pagoIds.length > 0) { const { data } = await supabase.from("pagos").select("id, concepto, categoria, fecha, cliente_id").in("id", pagoIds); pagosMap = mapById((data || []) as any[]); }
    if (citaIds.length > 0) { const { data } = await supabase.from("citas").select("id, fecha, hora_inicio, cliente_id, servicio_id").in("id", citaIds); citasMap = mapById((data || []) as any[]); }
    if (clientePlanIds.length > 0) { const { data } = await supabase.from("clientes_planes").select("id, cliente_id").in("id", clientePlanIds); clientesPlanesMap = mapById((data || []) as any[]); }
    const servicioIds = uniqueStrings([...servicioIdsDirectos, ...[...citasMap.values()].map((c) => c?.servicio_id)]);
    if (servicioIds.length > 0) { const { data } = await supabase.from("servicios").select("id, nombre").in("id", servicioIds); serviciosMap = mapById((data || []) as any[]); }
    const clienteIds = uniqueStrings([...clienteIdsDirectos, ...[...pagosMap.values()].map((p) => p?.cliente_id), ...[...citasMap.values()].map((c) => c?.cliente_id), ...[...clientesPlanesMap.values()].map((p) => p?.cliente_id)]);
    if (clienteIds.length > 0) { const { data } = await supabase.from("clientes").select("id, nombre").in("id", clienteIds); clientesMap = mapById((data || []) as any[]); }
    return { ...baseRes, data: rows.map((row) => normalizeComisionDetalle(row, { pagosMap, clientesMap, citasMap, serviciosMap, clientesPlanesMap, descuentosMap })) };
  }

  async function loadAll() {
    setLoading(true); setErrorMsg("");
    const [empRes, clientesRes, entRes, citasRes, comRes, liqRes, metodosRes, estadoCuentaRes, cuentasEmpleadoRes] = await Promise.all([
      supabase.from("empleados").select("id, nombre, email, telefono, rol, especialidad, estado, comision_plan_porcentaje, comision_cita_porcentaje, created_at").eq("id", id).single(),
      supabase.from("clientes").select("id, nombre, telefono, estado").eq("terapeuta_id", id).eq("estado", "activo").order("nombre"),
      supabase.from("entrenamientos").select("id, fecha, hora_inicio, hora_fin, estado, clientes:cliente_id ( nombre )").eq("empleado_id", id).order("fecha").order("hora_inicio"),
      supabase.from("citas").select("id, fecha, hora_inicio, hora_fin, estado, notas, clientes:cliente_id ( nombre ), servicios:servicio_id ( nombre )").eq("terapeuta_id", id).order("fecha").order("hora_inicio"),
      fetchComisionesDetalladas(id),
      supabase.from("comisiones_liquidaciones").select("id, fecha_inicio, fecha_fin, total_base, total_profesional, total_rpm, cantidad_citas, estado, pagado_at, moneda_pago, monto_pago, tasa_bcv, monto_equivalente_usd, monto_equivalente_bs, referencia, notas, metodo_pago_id, metodo_pago_v2_id, pago_empleado_id, egreso_id").eq("empleado_id", id).order("pagado_at", { ascending: false }).limit(30),
      supabase.from("metodos_pago_v2").select("id, nombre, tipo, moneda, color, icono, cartera:cartera_id ( id, nombre, codigo, saldo_actual, moneda )").eq("activo", true).eq("permite_pagar", true).order("orden", { ascending: true }).order("nombre", { ascending: true }),
      supabase.from("v_empleados_estado_cuenta").select("empleado_id, nombre, rol, total_facturado_usd, total_pagado_usd, total_pendiente_usd, credito_disponible_usd, saldo_pendiente_neto_usd, saldo_favor_neto_usd").eq("empleado_id", id).maybeSingle(),
      supabase.from("v_empleados_cuentas_por_cobrar_resumen").select("id, empleado_id, empleado_nombre, concepto, monto_total_usd, monto_pagado_usd, saldo_usd, fecha_venta, fecha_vencimiento, estado").eq("empleado_id", id).in("estado", ["pendiente", "parcial", "vencida"]).order("fecha_venta", { ascending: true }),
    ]);
    if (empRes.error || !empRes.data) { setErrorMsg("No se pudo cargar."); setLoading(false); return; }
    setEmpleado(empRes.data as Empleado);
    setClientes((clientesRes.data || []) as ClienteAsignado[]);
    const ents = ((entRes.data || []) as any[]).map((e) => ({ id: e.id, fecha: e.fecha, hora_inicio: e.hora_inicio, hora_fin: e.hora_fin, estado: e.estado, nombre: e.clientes?.nombre || "—", subtitulo: "Entrenamiento", tipo: "entrenamiento" as const, notas: null }));
    const cts = ((citasRes.data || []) as any[]).map((c) => ({ id: c.id, fecha: c.fecha, hora_inicio: c.hora_inicio, hora_fin: c.hora_fin, estado: c.estado, nombre: c.clientes?.nombre || "—", subtitulo: c.servicios?.nombre || "Cita", tipo: "cita" as const, notas: c.notas }));
    const metodosNormalizados: MetodoPago[] = ((metodosRes.data || []) as any[]).map(normalizeMetodoPago);
    setAgenda([...ents, ...cts].sort((a, b) => `${a.fecha} ${a.hora_inicio}`.localeCompare(`${b.fecha} ${b.hora_inicio}`)));
    setComisiones((comRes.data || []) as ComisionDetalle[]);
    setLiquidaciones((liqRes.data || []) as Liquidacion[]);
    setMetodosPago(metodosNormalizados);
    setEstadoCuentaEmpleado((estadoCuentaRes.data as EstadoCuentaEmpleado | null) ?? null);
    setCuentasPendientesEmpleado((cuentasEmpleadoRes.data || []) as CuentaPendienteEmpleado[]);
    setLoading(false);
  }

  async function resolverTasaBCVActual() {
    const hoyFecha = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.from("tipos_cambio").select("*").lte("fecha", hoyFecha).order("fecha", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    const row = data as TipoCambioRow | null;
    const posibleTasa = Number(row?.tasa ?? row?.valor ?? row?.monto ?? row?.bcv ?? row?.precio ?? 0);
    if (!posibleTasa || posibleTasa <= 0) throw new Error("No se pudo obtener la tasa BCV automática");
    return r2(posibleTasa);
  }

  async function cargarTasaBCVAutomatica() {
    setCargandoTasa(true);
    try { const tasa = await resolverTasaBCVActual(); setTasaBCVAuto(tasa); setTasaBCV((prev) => (prev && prev > 0 ? prev : tasa)); } catch { setTasaBCVAuto(null); } finally { setCargandoTasa(false); }
  }

  const agendaFiltrada = useMemo(() => {
    let items = agenda;
    if (agendaTipo === "entrenamientos") items = items.filter((x) => x.tipo === "entrenamiento");
    if (agendaTipo === "citas") items = items.filter((x) => x.tipo === "cita");
    if (agendaFiltro === "hoy") items = items.filter((x) => x.fecha === hoy);
    if (agendaFiltro === "proximos") items = items.filter((x) => x.fecha >= hoy).slice(0, 100);
    if (agendaClienteFiltro !== "todos") items = items.filter((x) => x.nombre === agendaClienteFiltro);
    return items;
  }, [agenda, agendaFiltro, agendaTipo, agendaClienteFiltro, hoy]);

  const agendaAgrupadaPorCliente = useMemo(() => chunkAgendaByCliente(agendaFiltrada), [agendaFiltrada]);

  const comisionesPendientes = useMemo(() => comisiones.filter((c) => isPendienteEstado(c.estado)), [comisiones]);
  const comisionesLiquidadaHoyQuincena = useMemo(() => comisiones.filter((c) => { if (!isFacturadaEstado(c.estado)) return false; return c.fecha >= quincenaActual.inicio && c.fecha <= quincenaActual.fin; }), [comisiones, quincenaActual]);
  const comisionesDisponibles = useMemo(() => comisiones.filter((c) => isPendienteEstado(c.estado)), [comisiones]);

  const resumenDisponible = useMemo(() => {
    const profesionalUsd = comisionesDisponibles.reduce((a, c) => a + getComisionMontoByMoneda(c, "USD"), 0);
    const profesionalBs = comisionesDisponibles.reduce((a, c) => a + getComisionMontoByMoneda(c, "BS"), 0);
    const rpmUsd = comisionesDisponibles.reduce((a, c) => a + Number(c.monto_rpm_usd ?? c.rpm ?? 0), 0);
    const rpmBs = comisionesDisponibles.reduce((a, c) => a + Number(c.monto_rpm_bs ?? 0), 0);
    const baseUsd = comisionesDisponibles.reduce((a, c) => a + Number(c.monto_base_usd ?? c.base ?? 0), 0);
    const baseBs = comisionesDisponibles.reduce((a, c) => a + Number(c.monto_base_bs ?? 0), 0);
    return { baseUsd: r2(baseUsd), baseBs: r2(baseBs), profesionalUsd: r2(profesionalUsd), profesionalBs: r2(profesionalBs), rpmUsd: r2(rpmUsd), rpmBs: r2(rpmBs), pendientes: comisionesDisponibles.length };
  }, [comisionesDisponibles]);

  const stats = useMemo(() => ({
    hoyTotal: agenda.filter((x) => x.fecha === hoy).length,
    comisionPendienteUsd: resumenDisponible.profesionalUsd,
    comisionPendienteBs: resumenDisponible.profesionalBs,
    registrosPendientes: resumenDisponible.pendientes,
  }), [agenda, hoy, resumenDisponible]);

  const comisionesPendientesMoneda = useMemo(() => comisionesPendientes.filter((c) => getComisionMontoByMoneda(c, monedaPago) > 0), [comisionesPendientes, monedaPago]);
  const allCurrentCurrencySelected = useMemo(() => { if (comisionesPendientesMoneda.length === 0) return false; return comisionesPendientesMoneda.every((c) => selectedComisionIds.includes(c.id)); }, [comisionesPendientesMoneda, selectedComisionIds]);
  const comisionesSeleccionadas = useMemo(() => { const ids = new Set(selectedComisionIds); return comisionesPendientesMoneda.filter((c) => ids.has(c.id)); }, [comisionesPendientesMoneda, selectedComisionIds]);

  const resumenSeleccionado = useMemo(() => {
    const baseUsd = comisionesSeleccionadas.reduce((a, c) => a + Number(c.monto_base_usd ?? c.base ?? 0), 0);
    const baseBs = comisionesSeleccionadas.reduce((a, c) => a + Number(c.monto_base_bs ?? 0), 0);
    const profesionalUsd = comisionesSeleccionadas.reduce((a, c) => a + getComisionMontoByMoneda(c, "USD"), 0);
    const profesionalBs = comisionesSeleccionadas.reduce((a, c) => a + getComisionMontoByMoneda(c, "BS"), 0);
    const rpmUsd = comisionesSeleccionadas.reduce((a, c) => a + Number(c.monto_rpm_usd ?? c.rpm ?? 0), 0);
    const rpmBs = comisionesSeleccionadas.reduce((a, c) => a + Number(c.monto_rpm_bs ?? 0), 0);
    return { baseUsd: r2(baseUsd), baseBs: r2(baseBs), profesionalUsd: r2(profesionalUsd), profesionalBs: r2(profesionalBs), rpmUsd: r2(rpmUsd), rpmBs: r2(rpmBs), pendientes: comisionesSeleccionadas.length };
  }, [comisionesSeleccionadas]);

  const totalSplits = useMemo(() => r2(splitsPago.reduce((acc, split) => { const monto = Number(split.monto || 0); return acc + (Number.isFinite(monto) ? monto : 0); }, 0)), [splitsPago]);
  const montoFacturar = useMemo(() => monedaPago === "USD" ? r2(resumenSeleccionado.profesionalUsd) : r2(resumenSeleccionado.profesionalBs), [monedaPago, resumenSeleccionado]);

  const deudaEmpleadoUsd = useMemo(() => {
    const desdeEstado = Number(estadoCuentaEmpleado?.saldo_pendiente_neto_usd || 0);
    const desdeCuentas = cuentasPendientesEmpleado.reduce((acc, cuenta) => acc + Number(cuenta.saldo_usd || 0), 0);
    const deuda = Math.max(desdeEstado, desdeCuentas, 0);
    return r2(Number.isFinite(deuda) ? deuda : 0);
  }, [estadoCuentaEmpleado, cuentasPendientesEmpleado]);

  const descuentoDeudaUsd = useMemo(() => {
    if (!aplicarDescuentoDeuda) return 0;
    const solicitado = descuentoDeudaUsdInput.trim() ? Number(descuentoDeudaUsdInput) : deudaEmpleadoUsd;
    const maximoPorComision = resumenSeleccionado.profesionalUsd;
    const normalizado = Math.max(0, Math.min(Number(solicitado || 0), deudaEmpleadoUsd, maximoPorComision));
    return r2(Number.isFinite(normalizado) ? normalizado : 0);
  }, [aplicarDescuentoDeuda, descuentoDeudaUsdInput, deudaEmpleadoUsd, resumenSeleccionado.profesionalUsd]);

  const requiereTasaPorDescuentoDeuda = useMemo(() => aplicarDescuentoDeuda && descuentoDeudaUsd > 0 && monedaPago === "BS", [aplicarDescuentoDeuda, descuentoDeudaUsd, monedaPago]);

  const descuentoDeudaEnMonedaPago = useMemo(() => {
    if (!aplicarDescuentoDeuda || descuentoDeudaUsd <= 0) return 0;
    if (monedaPago === "USD") return r2(descuentoDeudaUsd);
    if (!tasaBCV || tasaBCV <= 0) return 0;
    return r2(descuentoDeudaUsd * tasaBCV);
  }, [aplicarDescuentoDeuda, descuentoDeudaUsd, monedaPago, tasaBCV]);

  const montoNetoAPagar = useMemo(() => r2(Math.max(montoFacturar - descuentoDeudaEnMonedaPago, 0)), [montoFacturar, descuentoDeudaEnMonedaPago]);
  const restantePorAsignar = useMemo(() => r2(montoNetoAPagar - totalSplits), [montoNetoAPagar, totalSplits]);

  const splitsConMetodo = useMemo(() => splitsPago.map((split) => {
    const metodo = metodosPago.find((m) => m.id === split.metodoPagoId) || null;
    const metodoMoneda = getMetodoMoneda(metodo);
    const montoLiquidacion = r2(Number(split.monto || 0));
    const montoDescontar = convertirMonto(montoLiquidacion, monedaPago, metodoMoneda, tasaBCV);
    const requiereConversion = !!metodo && metodoMoneda !== monedaPago;
    const saldo = getMetodoSaldo(metodo);
    return { ...split, metodo, metodoMoneda, montoLiquidacion, montoDescontar, requiereConversion, saldo };
  }), [splitsPago, metodosPago, monedaPago, tasaBCV]);

  const requiereTasa = useMemo(() => splitsConMetodo.some((split) => split.metodo && split.requiereConversion) || requiereTasaPorDescuentoDeuda, [splitsConMetodo, requiereTasaPorDescuentoDeuda]);
  const soloDescontarDeudaActivo = aplicarDescuentoDeuda && modoDescuentoDeuda === "solo_descuento";

  useEffect(() => { if (!soloDescontarDeudaActivo) return; setSplitsPago([{ id: crypto.randomUUID(), metodoPagoId: "", monto: "" }]); }, [soloDescontarDeudaActivo]);
  useEffect(() => { if (!requiereTasa) return; if (tasaBCV && tasaBCV > 0) return; void cargarTasaBCVAutomatica(); }, [requiereTasa, tasaBCV]);

  function toggleComision(idComision: string) { setSelectedComisionIds((prev) => prev.includes(idComision) ? prev.filter((id) => id !== idComision) : [...prev, idComision]); }
  function selectAllCurrentCurrency() { if (allCurrentCurrencySelected) { setSelectedComisionIds([]); return; } setSelectedComisionIds(comisionesPendientesMoneda.map((c) => c.id)); }

  const comisionesPorLiquidacion = useMemo(() => {
    const map = new Map<string, ComisionDetalle[]>();
    for (const liq of liquidaciones) {
      const detalle = comisiones.filter((c) => { const pertenecePorLiquidacion = c.liquidacion_id === liq.id; const pertenecePorPagoEmpleado = !!liq.pago_empleado_id && c.pago_empleado_id === liq.pago_empleado_id; return pertenecePorLiquidacion || pertenecePorPagoEmpleado; }).sort((a, b) => { const fa = `${a.cita_fecha || a.fecha} ${a.cita_hora_inicio || ""}`; const fb = `${b.cita_fecha || b.fecha} ${b.cita_hora_inicio || ""}`; return fa.localeCompare(fb); });
      map.set(liq.id, detalle);
    }
    return map;
  }, [comisiones, liquidaciones]);

  function toggleLiquidacionAbierta(liquidacionId: string) { setLiquidacionAbiertaId((prev) => (prev === liquidacionId ? null : liquidacionId)); }

  function aplicarPeriodoComision(value: PeriodoComision) {
    setPeriodoComision(value);
    if (value !== "liquidacion") setLiquidacionImprimirId("");
    if (value === "pendientes") { setFechaInicioComision(""); setFechaFinComision(""); return; }
    if (value === "quincena") { setFechaInicioComision(quincenaActual.inicio); setFechaFinComision(quincenaActual.fin); return; }
    if (value === "mes") { setFechaInicioComision(firstDayOfCurrentMonthISO()); setFechaFinComision(lastDayOfCurrentMonthISO()); return; }
  }

  function seleccionarLiquidacionParaImprimir(liquidacionId: string) {
    setLiquidacionImprimirId(liquidacionId); setPeriodoComision(liquidacionId ? "liquidacion" : "pendientes");
    const liq = liquidaciones.find((item) => item.id === liquidacionId); if (!liq) return;
    setFechaInicioComision(liq.fecha_inicio || ""); setFechaFinComision(liq.fecha_fin || "");
    setFechaPagoComision((liq.pagado_at || "").slice(0, 10) || getTodayLocal()); setReferencia(liq.referencia || "");
    if (liq.moneda_pago === "USD" || liq.moneda_pago === "BS") setMonedaPago(liq.moneda_pago as Moneda);
  }

  const comisionesParaImprimir = useMemo(() => {
    if (liquidacionImprimirId) {
      const liq = liquidaciones.find((item) => item.id === liquidacionImprimirId) || null;
      return comisiones.filter((c) => { const perteneceALiquidacion = c.liquidacion_id === liquidacionImprimirId || (!!liq?.pago_empleado_id && c.pago_empleado_id === liq.pago_empleado_id); return perteneceALiquidacion && isFacturadaEstado(c.estado); }).sort((a, b) => { const fa = `${a.cita_fecha || a.fecha} ${a.cita_hora_inicio || ""}`; const fb = `${b.cita_fecha || b.fecha} ${b.cita_hora_inicio || ""}`; return fa.localeCompare(fb); });
    }
    const base = selectedComisionIds.length > 0 ? comisionesSeleccionadas : comisionesPendientesMoneda;
    return base.filter((c) => { const fecha = c.cita_fecha || c.fecha; if (!isPendienteEstado(c.estado)) return false; if (periodoComision === "pendientes") return true; if (fechaInicioComision && fecha < fechaInicioComision) return false; if (fechaFinComision && fecha > fechaFinComision) return false; return true; }).sort((a, b) => { const fa = `${a.cita_fecha || a.fecha} ${a.cita_hora_inicio || ""}`; const fb = `${b.cita_fecha || b.fecha} ${b.cita_hora_inicio || ""}`; return fa.localeCompare(fb); });
  }, [comisiones, comisionesSeleccionadas, comisionesPendientesMoneda, selectedComisionIds.length, fechaInicioComision, fechaFinComision, periodoComision, liquidacionImprimirId, liquidaciones]);

  async function exportComisionPDF(liquidacionHistorica?: Liquidacion) {
    if (!empleado) return;
    const liquidacionPdf = liquidacionHistorica || null;
    const rows = liquidacionPdf ? (comisionesPorLiquidacion.get(liquidacionPdf.id) || []).filter((c) => isFacturadaEstado(c.estado)).sort((a, b) => { const fa = `${a.cita_fecha || a.fecha} ${a.cita_hora_inicio || ""}`; const fb = `${b.cita_fecha || b.fecha} ${b.cita_hora_inicio || ""}`; return fa.localeCompare(fb); }) : comisionesPendientesMoneda.filter((c) => isPendienteEstado(c.estado)).sort((a, b) => { const fa = `${a.cita_fecha || a.fecha} ${a.cita_hora_inicio || ""}`; const fb = `${b.cita_fecha || b.fecha} ${b.cita_hora_inicio || ""}`; return fa.localeCompare(fb); });
    if (rows.length === 0) { alert(liquidacionPdf ? "Esta liquidación no tiene comisiones enlazadas para imprimir." : `No hay comisiones pendientes con monto para ${monedaPago}.`); return; }
    const logoSrc = "/logo-imprimir.png";
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const numero = liquidacionPdf ? `LIQ-${liquidacionPdf.id.slice(0, 8).toUpperCase()}` : `PEND-${new Date().getTime().toString().slice(-6)}`;
    const fechaPago = (liquidacionPdf?.pagado_at || "").slice(0, 10) || rows.find((c) => c.fecha_pago)?.fecha_pago || fechaPagoComision || getTodayLocal();
    const fechasRows = rows.map((c) => c.cita_fecha || c.fecha).filter(Boolean).sort();
    const fechaInicioPdf = liquidacionPdf?.fecha_inicio || fechasRows[0] || getTodayLocal();
    const fechaFinPdf = liquidacionPdf?.fecha_fin || fechasRows[fechasRows.length - 1] || getTodayLocal();
    const rangoTxt = `${shortDate(fechaInicioPdf)} AL ${shortDate(fechaFinPdf)}`;
    const monedaPdf = (liquidacionPdf?.moneda_pago === "BS" || liquidacionPdf?.moneda_pago === "USD") ? liquidacionPdf.moneda_pago : monedaPago;
    const referenciaPdf = liquidacionPdf?.referencia || referencia.trim() || "—";
    await drawCommissionHeader({ doc, logoSrc, numero, empleado, fechaPago });
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(20);
    doc.text(`SERVICIOS FACTURADOS DESDE EL ${rangoTxt}`, 15, 58);
    const serviciosBody = rows.map((c, index) => {
      const fecha = c.cita_fecha || c.fecha; const hora = c.cita_hora_inicio ? String(c.cita_hora_inicio).slice(0, 5) : "—";
      const paciente = String(c.cliente_nombre || c.pago_cliente_nombre || "—").toUpperCase();
      const tipoSesion = String(c.servicio_nombre || getComisionConcepto(c) || c.tipo || "COMISIÓN").toUpperCase();
      const honorarios = getComisionBrutoByMoneda(c, "USD"); const descuento = getComisionDescuentoDeudaByMoneda(c, "USD"); const neto = getComisionMontoByMoneda(c, "USD");
      const estadoPago = getComisionPagoEstadoPDF(c, liquidacionPdf?.id || null, liquidacionPdf?.pago_empleado_id || null);
      return [index + 1, shortDate(fecha), hora, paciente, tipoSesion, estadoPago, `$ ${honorarios.toFixed(2)}`, descuento > 0 ? `$ ${descuento.toFixed(2)}` : "$ 0.00", `$ ${neto.toFixed(2)}`];
    });
    autoTable(doc, { startY: 62, margin: { left: 15, right: 15, bottom: 28 }, head: [["", "FECHA", "HORA", "PACIENTE/CLIENTE", "TIPO DE SESIÓN", "ESTADO", "BRUTO", "DEUDA", "NETO"]], body: serviciosBody, theme: "grid", styles: { font: "helvetica", fontSize: 7.3, cellPadding: 1.6, lineColor: [160, 160, 160], lineWidth: 0.18, textColor: [25, 35, 45], valign: "middle" }, headStyles: { fillColor: [245, 245, 245], textColor: [45, 45, 45], fontStyle: "bold" }, columnStyles: { 0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 18, halign: "center" }, 2: { cellWidth: 13, halign: "center" }, 3: { cellWidth: 36 }, 4: { cellWidth: 38 }, 5: { cellWidth: 20, halign: "center", fontStyle: "bold" }, 6: { cellWidth: 16, halign: "right" }, 7: { cellWidth: 15, halign: "right", textColor: [190, 55, 75] }, 8: { cellWidth: 16, halign: "right", fontStyle: "bold", textColor: [20, 130, 95] } } });
    let cursorY = ((doc as any).lastAutoTable?.finalY || 62) + 7;
    const totalBrutoUsd = r2(rows.reduce((acc, c) => acc + getComisionBrutoByMoneda(c, "USD"), 0));
    const totalDeduccionesUsd = r2(rows.reduce((acc, c) => acc + getComisionDescuentoDeudaByMoneda(c, "USD"), 0));
    const totalNetoUsd = r2(rows.reduce((acc, c) => acc + getComisionMontoByMoneda(c, "USD"), 0));
    const esLiquidacionHistorica = !!liquidacionPdf;
    const totalPagadoLiquidacionUsd = esLiquidacionHistorica ? r2(Number(liquidacionPdf?.monto_equivalente_usd ?? liquidacionPdf?.monto_pago ?? totalNetoUsd)) : 0;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("Total Facturado:", 145, cursorY, { align: "right" }); doc.text(`$ ${totalBrutoUsd.toFixed(2)}`, 188, cursorY, { align: "right" }); cursorY += 8;
    doc.setDrawColor(30); doc.line(15, cursorY, 195, cursorY); cursorY += 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(`DEDUCCIONES Y PERCEPCIONES ADICIONALES DESDE EL ${rangoTxt}`, 15, cursorY); cursorY += 4;
    const deduccionesBody: any[] = [];
    for (const c of rows) { const descuento = getComisionDescuentoDeudaByMoneda(c, "USD"); if (descuento <= 0) continue; deduccionesBody.push(["DEDUCCIÓN", `DEUDA / CONSUMO DESCONTADO · ${String(c.cliente_nombre || c.pago_cliente_nombre || getComisionConcepto(c) || "COMISIÓN").toUpperCase()} · NETO PENDIENTE $ ${getComisionMontoByMoneda(c, "USD").toFixed(2)}`, `$ ${descuento.toFixed(2)}`]); }
    autoTable(doc, { startY: cursorY, margin: { left: 15, right: 15, bottom: 28 }, head: [["TIPO", "DESCRIPCIÓN", "MONTO"]], body: deduccionesBody.length ? deduccionesBody : [["—", "SIN DEDUCCIONES REGISTRADAS", "$ 0.00"]], theme: "plain", styles: { font: "helvetica", fontSize: 8, cellPadding: 2, textColor: [35, 35, 35] }, headStyles: { textColor: [70, 70, 70], fontStyle: "bold", halign: "center" }, columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 100 }, 2: { cellWidth: 40, halign: "right" } } });
    cursorY = ((doc as any).lastAutoTable?.finalY || cursorY) + 8;
    if (cursorY > 225) { doc.addPage(); await drawCommissionHeader({ doc, logoSrc, numero, empleado, fechaPago }); cursorY = 62; }
    doc.setDrawColor(30); doc.line(15, cursorY, 195, cursorY); cursorY += 8;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("FORMA DE PAGO Y TOTALES:", 15, cursorY); cursorY += 8;
    const formaPagoRows = esLiquidacionHistorica ? [["Fecha de pago", shortDate(fechaPago)], ["Tipo", "TRANSFERENCIA / EFECTIVO / MÉTODO REGISTRADO"], ["Referencia", referenciaPdf], ["Moneda liquidación", monedaPdf], ["TOTAL FACTURADO", `$ ${totalBrutoUsd.toFixed(2)}`], ["Total Deducciones y Percepciones", `$ ${totalDeduccionesUsd.toFixed(2)}`], ["Total Neto generado", `$ ${totalNetoUsd.toFixed(2)}`], ["Total pagado/liquidado", `$ ${totalPagadoLiquidacionUsd.toFixed(2)}`], ["TOTAL RECIBO", `$ ${totalPagadoLiquidacionUsd.toFixed(2)}`]] : [["Fecha de emisión", shortDate(getTodayLocal())], ["Estado", "PENDIENTE - NO PAGADO AL EMPLEADO"], ["Moneda referencia", monedaPdf], ["TOTAL FACTURADO", `$ ${totalBrutoUsd.toFixed(2)}`], ["Total Deducciones y Percepciones", `$ ${totalDeduccionesUsd.toFixed(2)}`], ["TOTAL PENDIENTE NETO", `$ ${totalNetoUsd.toFixed(2)}`]];
    autoTable(doc, { startY: cursorY, margin: { left: 105, right: 15, bottom: 28 }, body: formaPagoRows, theme: "plain", styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.8, textColor: [25, 25, 25] }, columnStyles: { 0: { fontStyle: "bold", halign: "right", cellWidth: 48 }, 1: { halign: "right", cellWidth: 42 } } });
    cursorY = ((doc as any).lastAutoTable?.finalY || cursorY) + 12;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.text("RECIBÍ CONFORME:", 15, cursorY); doc.line(48, cursorY + 15, 112, cursorY + 15); doc.setFont("helvetica", "bold"); doc.text(String(empleado.nombre || "").toUpperCase(), 80, cursorY + 20, { align: "center" });
    const totalPages = (doc as any).internal.getNumberOfPages?.() || 1;
    for (let i = 1; i <= totalPages; i++) { doc.setPage(i); drawCommissionFooter(doc); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(75); doc.text(`Página ${i} de ${totalPages}`, 190, doc.internal.pageSize.getHeight() - 4, { align: "right" }); }
    doc.save(`RPM_Comision_${sanitizeFilePart(empleado.nombre)}_${sanitizeFilePart(fechaInicioPdf)}_${sanitizeFilePart(fechaFinPdf)}.pdf`);
  }

  function addSplit() { setSplitsPago((prev) => [...prev, { id: crypto.randomUUID(), metodoPagoId: "", monto: "" }]); }
  function removeSplit(idSplit: string) { setSplitsPago((prev) => { if (prev.length <= 1) return prev; return prev.filter((x) => x.id !== idSplit); }); }
  function updateSplit(idSplit: string, patch: Partial<SplitPago>) { setSplitsPago((prev) => prev.map((x) => (x.id === idSplit ? { ...x, ...patch } : x))); }
  function fillRemainingOnSplit(idSplit: string) { const otros = splitsPago.filter((x) => x.id !== idSplit).reduce((acc, x) => acc + Number(x.monto || 0), 0); const restante = r2(Math.max(montoNetoAPagar - otros, 0)); updateSplit(idSplit, { monto: String(restante) }); }

  async function descontarDeudaSinPagarComision() {
    const pendientes = comisionesSeleccionadas;
    if (pendientes.length === 0) { alert("Selecciona al menos una comisión pendiente para descontar la deuda."); return; }
    if (!aplicarDescuentoDeuda || descuentoDeudaUsd <= 0) { alert("Activa el descuento e indica un monto mayor a 0."); return; }
    if (descuentoDeudaUsd > resumenSeleccionado.profesionalUsd) { alert("El descuento de deuda no puede ser mayor que la comisión neta seleccionada."); return; }
    if (requiereTasaPorDescuentoDeuda && (!tasaBCV || tasaBCV <= 0)) { alert("Para descontar en Bs necesitas una tasa BCV válida."); return; }
    const ok = window.confirm(`¿Descontar deuda SIN pagar comisión ahora?\n\nComisiones seleccionadas: ${pendientes.length}\nComisión neta disponible: ${formatMoney(resumenSeleccionado.profesionalUsd)}\nDescuento a deuda: ${formatMoney(descuentoDeudaUsd)}\nComisión pendiente luego: ${formatMoney(Math.max(resumenSeleccionado.profesionalUsd - descuentoDeudaUsd, 0))}\n\nLa comisión NO quedará liquidada.`);
    if (!ok) return;
    setFacturando(true);
    try {
      const { error } = await supabase.rpc("registrar_descuento_deuda_comision", { p_empleado_id: id, p_comision_ids: pendientes.map((c) => c.id), p_monto_usd: descuentoDeudaUsd, p_monto_bs: descuentoDeudaEnMonedaPago, p_tasa_bcv: tasaBCV, p_liquidacion_id: null, p_pago_empleado_id: null, p_modo: "solo_descuento", p_referencia: referencia.trim() || null, p_notas: [`Destino interno: ${destinoDescuentoDeuda === "ingreso_rpm" ? "Ingreso RPM / retención interna" : "Ajuste de nómina"}`, notasLiquidacion.trim() || "Descuento de deuda aplicado contra comisión pendiente sin pagar comisión."].join("\n") });
      if (error) throw new Error(error.message || "No se pudo descontar la deuda.");
      alert(`✅ Deuda descontada sin pagar comisión.\n\nDescontado: ${formatMoney(descuentoDeudaUsd)}\nLa comisión queda pendiente por el neto restante.`);
      setSelectedComisionIds([]); setSplitsPago([{ id: crypto.randomUUID(), metodoPagoId: "", monto: "" }]); setReferencia(""); setNotasLiquidacion(""); setTasaBCV(null); setTasaBCVAuto(null); setAplicarDescuentoDeuda(false); setDescuentoDeudaUsdInput(""); setModoDescuentoDeuda("descuento_y_pagar"); setDestinoDescuentoDeuda("ingreso_rpm");
      await loadAll();
    } catch (err: any) { console.error(err); alert(err?.message || "Error al descontar deuda contra comisión."); } finally { setFacturando(false); }
  }

  async function liquidarSaldoDisponible() {
    const pendientes = comisionesSeleccionadas;
    if (pendientes.length === 0) { alert("Selecciona al menos una comisión pendiente."); return; }
    const splitsValidos = splitsPago.map((s) => { const metodo = metodosPago.find((m) => m.id === s.metodoPagoId) || null; const metodoMoneda = getMetodoMoneda(metodo); const montoNum = r2(Number(s.monto || 0)); const montoDescontarMetodo = convertirMonto(montoNum, monedaPago, metodoMoneda, tasaBCV); return { ...s, montoNum, metodo, metodoMoneda, montoDescontarMetodo, requiereConversion: !!metodo && metodoMoneda !== monedaPago }; }).filter((s) => s.metodoPagoId && s.montoNum > 0);
    if (montoNetoAPagar > 0 && splitsValidos.length === 0) { alert("Debes indicar al menos un método de pago con monto para pagar el neto al empleado."); return; }
    if (montoNetoAPagar === 0 && splitsValidos.length > 0) { alert("El neto a pagar es $0.00 porque la deuda cubre toda la liquidación. Quita los métodos de pago o deja los montos en 0."); return; }
    const requiereConversion = splitsValidos.some((s) => s.requiereConversion);
    if ((requiereConversion || requiereTasaPorDescuentoDeuda) && (!tasaBCV || tasaBCV <= 0)) { alert("No se pudo obtener la tasa automática. Indícala manualmente."); return; }
    if (aplicarDescuentoDeuda && descuentoDeudaUsd <= 0) { alert("Activa el descuento solo si vas a descontar una deuda mayor a 0."); return; }
    if (descuentoDeudaUsd > resumenSeleccionado.profesionalUsd) { alert("El descuento de deuda no puede ser mayor que la comisión seleccionada."); return; }
    const metodoIds = new Set<string>();
    for (const split of splitsValidos) { if (metodoIds.has(split.metodoPagoId)) { alert("No repitas el mismo método en dos líneas."); return; } metodoIds.add(split.metodoPagoId); }
    const sumaSplits = r2(splitsValidos.reduce((acc, x) => acc + x.montoNum, 0));
    if (sumaSplits !== montoNetoAPagar) { alert(`La suma de métodos (${formatMontoByMoneda(sumaSplits, monedaPago)}) debe ser igual al neto a pagar (${formatMontoByMoneda(montoNetoAPagar, monedaPago)}).`); return; }
    for (const split of splitsValidos) {
      if (!split.metodo) { alert("Uno de los métodos seleccionados no es válido."); return; }
      if (split.requiereConversion && (split.montoDescontarMetodo === null || split.montoDescontarMetodo <= 0)) { alert(`No se pudo calcular la conversión para el método "${split.metodo.nombre}".`); return; }
      const saldo = getMetodoSaldo(split.metodo); const montoContraMetodo = split.requiereConversion ? Number(split.montoDescontarMetodo || 0) : split.montoNum;
      if (saldo > 0 && montoContraMetodo > saldo) { alert(`El método "${split.metodo.nombre}" no tiene saldo suficiente.\nSaldo: ${formatMontoByMoneda(saldo, split.metodoMoneda)}\nIntentas usar: ${formatMontoByMoneda(montoContraMetodo, split.metodoMoneda)}`); return; }
    }
    const montoPagoNum = montoNetoAPagar; const montoBrutoLiquidacion = montoFacturar;
    const montoEquivalenteUsd = monedaPago === "USD" ? r2(montoPagoNum) : tasaBCV && tasaBCV > 0 ? r2(montoPagoNum / tasaBCV) : r2(resumenSeleccionado.profesionalUsd);
    const montoEquivalenteBs = monedaPago === "BS" ? r2(montoPagoNum) : tasaBCV && tasaBCV > 0 ? r2(montoPagoNum * tasaBCV) : r2(resumenSeleccionado.profesionalBs);
    const fechaFacturacion = fechaPagoComision || getTodayLocal();
    const fechaInicioRango = [...pendientes].map((c) => c.fecha).sort()[0];
    const fechaFinRango = [...pendientes].map((c) => c.fecha).sort().slice(-1)[0];
    const resumenMetodos = splitsValidos.map((s) => { const nombre = s.metodo?.nombre || "Método"; const cartera = s.metodo?.cartera?.nombre ? ` / ${s.metodo.cartera.nombre}` : ""; const baseTxt = formatMontoByMoneda(s.montoNum, monedaPago); if (!s.requiereConversion) return `• ${nombre}${cartera}: ${baseTxt}`; const convertidoTxt = formatMontoByMoneda(s.montoDescontarMetodo, s.metodoMoneda); return `• ${nombre}${cartera}: ${baseTxt} → se descuenta ${convertidoTxt}`; }).join("\n");
    const ok = window.confirm(`¿Liquidar comisiones seleccionadas?\n\nRegistros: ${pendientes.length}\nMoneda: ${monedaPago}\nNeto seleccionado: ${formatMontoByMoneda(montoBrutoLiquidacion, monedaPago)}\n${descuentoDeudaUsd > 0 ? `Descuento deuda: ${formatMoney(descuentoDeudaUsd)}\n` : ""}Neto a pagar: ${formatMontoByMoneda(montoPagoNum, monedaPago)}\n\nMétodos:\n${resumenMetodos}`);
    if (!ok) return;
    setFacturando(true);
    try {
      const notasFinales = [notasLiquidacion.trim() || `Liquidación manual - ${empleado?.nombre || "Profesional"}`, "", `Moneda: ${monedaPago}`, `Neto seleccionado: ${formatMontoByMoneda(montoBrutoLiquidacion, monedaPago)}`, ...(descuentoDeudaUsd > 0 ? [`Descuento deuda: ${formatMoney(descuentoDeudaUsd)}`, `Neto pagado: ${formatMontoByMoneda(montoPagoNum, monedaPago)}`] : []), ...((requiereConversion || requiereTasaPorDescuentoDeuda) && tasaBCV ? [`Tasa BCV: ${tasaBCV}`] : []), "", "Desglose:", ...splitsValidos.map((s) => { const nombre = s.metodo?.nombre || "Método"; const cartera = s.metodo?.cartera?.nombre ? ` (${s.metodo.cartera.nombre})` : ""; const montoTxt = formatMontoByMoneda(s.montoNum, monedaPago); if (!s.requiereConversion) return `- ${nombre}${cartera}: ${montoTxt}`; const convertidoTxt = formatMontoByMoneda(s.montoDescontarMetodo, s.metodoMoneda); return `- ${nombre}${cartera}: ${montoTxt} -> ${convertidoTxt}`; })].join("\n");
      const { data: liquidacion, error: liqError } = await supabase.from("comisiones_liquidaciones").insert({ empleado_id: id, fecha_inicio: fechaInicioRango, fecha_fin: fechaFinRango, total_base: resumenSeleccionado.baseUsd, total_rpm: resumenSeleccionado.rpmUsd, total_profesional: resumenSeleccionado.profesionalUsd, cantidad_citas: pendientes.length, porcentaje_rpm: 100 - (empleado?.comision_plan_porcentaje ?? 40), porcentaje_profesional: empleado?.comision_plan_porcentaje ?? 40, estado: "liquidado", pagado_at: new Date().toISOString(), notas: notasFinales, moneda_pago: monedaPago, monto_pago: montoPagoNum, tasa_bcv: requiereConversion || requiereTasaPorDescuentoDeuda ? tasaBCV : null, monto_equivalente_usd: montoEquivalenteUsd, monto_equivalente_bs: montoEquivalenteBs, metodo_pago_id: null, metodo_pago_v2_id: splitsValidos[0]?.metodoPagoId || null, referencia: referencia.trim() || null }).select("id").single();
      if (liqError || !liquidacion) throw new Error(liqError?.message || "No se pudo crear la liquidación.");
      const { data: pagoEmpleado, error: pagoEmpleadoError } = await supabase.from("pagos_empleados").insert({ empleado_id: id, fecha: fechaFacturacion, tipo: "liquidacion_manual", moneda_pago: monedaPago, monto_pago: montoPagoNum, tasa_bcv: requiereConversion || requiereTasaPorDescuentoDeuda ? tasaBCV : null, monto_equivalente_usd: montoEquivalenteUsd, monto_equivalente_bs: montoEquivalenteBs, metodo_pago_id: null, metodo_pago_v2_id: splitsValidos[0]?.metodoPagoId || null, referencia: referencia.trim() || null, liquidacion_id: liquidacion.id, notas: notasFinales }).select("id").single();
      if (pagoEmpleadoError || !pagoEmpleado) throw new Error(pagoEmpleadoError?.message || "No se pudo crear el pago al empleado.");
      if (descuentoDeudaUsd > 0) { const { error: descuentoError } = await supabase.rpc("registrar_descuento_deuda_comision", { p_empleado_id: id, p_comision_ids: pendientes.map((c) => c.id), p_monto_usd: descuentoDeudaUsd, p_monto_bs: descuentoDeudaEnMonedaPago, p_tasa_bcv: tasaBCV, p_liquidacion_id: liquidacion.id, p_pago_empleado_id: pagoEmpleado.id, p_modo: "descuento_y_liquidacion", p_referencia: referencia.trim() || null, p_notas: `Descuento de deuda desde liquidación ${liquidacion.id}` }); if (descuentoError) throw new Error(descuentoError.message || "No se pudo aplicar el descuento de deuda."); }
      const detalleRows = pendientes.map((c) => ({ pago_empleado_id: pagoEmpleado.id, comision_id: c.id, monto_usd: getComisionMontoByMoneda(c, "USD"), monto_bs: getComisionMontoByMoneda(c, "BS") }));
      const { error: detalleError } = await supabase.from("pagos_empleados_detalle").insert(detalleRows);
      if (detalleError) throw new Error(detalleError.message || "No se pudo crear el detalle.");
      const egresoIds: string[] = [];
      for (let i = 0; i < splitsValidos.length; i++) {
        const split = splitsValidos[i]; const concepto = `Liquidación comisión - ${empleado?.nombre || "Profesional"} - ${fechaFacturacion} - Parte ${i + 1}/${splitsValidos.length}`; const monedaMetodo = split.metodoMoneda; const montoContraMetodo = split.requiereConversion ? Number(split.montoDescontarMetodo || 0) : split.montoNum;
        const montoSplitUsd = monedaMetodo === "USD" ? r2(montoContraMetodo) : tasaBCV && tasaBCV > 0 ? r2(montoContraMetodo / tasaBCV) : 0;
        const montoSplitBs = monedaMetodo === "BS" ? r2(montoContraMetodo) : tasaBCV && tasaBCV > 0 ? r2(montoContraMetodo * tasaBCV) : 0;
        const { data: egreso, error: egresoError } = await supabase.from("egresos").insert({ fecha: fechaFacturacion, categoria: "liquidacion", concepto, proveedor: empleado?.nombre || null, monto: montoContraMetodo, metodo_pago_id: null, metodo_pago_v2_id: split.metodoPagoId, estado: "pagado", notas: `Parte ${i + 1} de ${splitsValidos.length}\n` + notasFinales, moneda: monedaMetodo, tasa_bcv: split.requiereConversion ? tasaBCV : null, monto_equivalente_usd: montoSplitUsd, monto_equivalente_bs: montoSplitBs, empleado_id: id, referencia: referencia.trim() || null }).select("id").single();
        if (egresoError || !egreso) throw new Error(egresoError?.message || "No se pudo crear el egreso.");
        egresoIds.push(egreso.id);
      }
      const { error: liqUpdateError } = await supabase.from("comisiones_liquidaciones").update({ pago_empleado_id: pagoEmpleado.id, egreso_id: egresoIds[0] || null }).eq("id", liquidacion.id);
      if (liqUpdateError) throw new Error(liqUpdateError.message || "No se pudo enlazar la liquidación.");
      const { error: updError } = await supabase.from("comisiones_detalle").update({ estado: "liquidado", liquidacion_id: liquidacion.id, pagado: true, fecha_pago: fechaFacturacion, pago_empleado_id: pagoEmpleado.id }).in("id", pendientes.map((c) => c.id));
      if (updError) throw new Error(updError.message || "No se pudieron actualizar las comisiones.");
      alert(`✅ Liquidación realizada.\n\nMoneda: ${monedaPago}\nMonto: ${formatMontoByMoneda(montoPagoNum, monedaPago)}\nRegistros liquidados: ${pendientes.length}`);
      setSelectedComisionIds([]); setSplitsPago([{ id: crypto.randomUUID(), metodoPagoId: "", monto: "" }]); setReferencia(""); setNotasLiquidacion(""); setTasaBCV(null); setTasaBCVAuto(null); setAplicarDescuentoDeuda(false); setDescuentoDeudaUsdInput(""); setModoDescuentoDeuda("descuento_y_pagar"); setDestinoDescuentoDeuda("ingreso_rpm");
      await loadAll();
    } catch (err: any) { console.error(err); alert(err?.message || "Error al liquidar."); } finally { setFacturando(false); }
  }

  if (!mounted || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-2 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-violet-400" />
          <p className="text-xs text-white/35">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (!empleado) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-rose-400">{errorMsg || "No encontrado."}</p>
      </div>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "info", label: "Info" },
    { key: "agenda", label: `Agenda${agendaFiltrada.length ? ` (${agendaFiltrada.length})` : ""}` },
    { key: "comisiones", label: "Comisiones" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-12">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 text-lg font-bold text-violet-300 ring-1 ring-white/10">
            {empleado.nombre.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-white">{empleado.nombre}</h1>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${estadoBadge(empleado.estado)}`}>{empleado.estado}</span>
            </div>
            <p className="mt-0.5 text-sm text-white/45 capitalize">
              {empleado.rol}{empleado.especialidad ? ` · ${empleado.especialidad}` : ""}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Link href={`/admin/personas/personal/${id}/editar`} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.08]">
            Editar
          </Link>
          <Link href={`/admin/personas/personal/${id}/estadisticas`} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.08]">
            Estadísticas
          </Link>
          <Link href="/admin/personas/personal" className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.08]">
            ← Volver
          </Link>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {[
          { label: "Clientes", value: clientes.length, color: "text-sky-300" },
          { label: "Hoy", value: stats.hoyTotal, color: "text-violet-300" },
          { label: "Disponible", value: formatMoney(stats.comisionPendienteUsd), color: "text-emerald-300" },
          { label: "En Bs", value: formatBs(stats.comisionPendienteBs), color: "text-amber-300" },
          { label: "Debe", value: formatMoney(estadoCuentaEmpleado?.saldo_pendiente_neto_usd || 0), color: "text-rose-300" },
          { label: "Crédito", value: formatMoney(estadoCuentaEmpleado?.saldo_favor_neto_usd || 0), color: "text-cyan-300" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5">
            <p className="text-[10px] text-white/40">{s.label}</p>
            <p className={`mt-0.5 text-sm font-semibold tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-0.5">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`flex-1 rounded-[10px] px-4 py-2 text-xs font-semibold transition ${tab === t.key ? "bg-white/[0.09] text-white" : "text-white/40 hover:text-white/65"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════
          TAB: INFO
      ════════════════════════════════════════ */}
      {tab === "info" && (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-2">

            {/* Datos de contacto */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/30">Contacto</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { label: "Email", value: empleado.email || "—" },
                  { label: "Teléfono", value: empleado.telefono || "—" },
                  { label: "Rol", value: empleado.rol },
                  { label: "Miembro desde", value: formatDate(empleado.created_at.slice(0, 10)) },
                ].map((row) => (
                  <div key={row.label}>
                    <p className="text-[10px] text-white/35">{row.label}</p>
                    <p className="mt-0.5 text-sm text-white capitalize">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Estado de cuenta */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/30">Estado de cuenta</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <div className="rounded-xl border border-rose-400/15 bg-rose-400/5 px-3 py-2.5">
                  <p className="text-[10px] text-white/40">Deuda total</p>
                  <p className="mt-0.5 text-sm font-bold text-rose-300">{formatMoney(estadoCuentaEmpleado?.total_pendiente_usd || 0)}</p>
                </div>
                <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/5 px-3 py-2.5">
                  <p className="text-[10px] text-white/40">Crédito</p>
                  <p className="mt-0.5 text-sm font-bold text-cyan-300">{formatMoney(estadoCuentaEmpleado?.credito_disponible_usd || 0)}</p>
                </div>
                <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 px-3 py-2.5">
                  <p className="text-[10px] text-white/40">Neto pendiente</p>
                  <p className="mt-0.5 text-sm font-bold text-amber-300">{formatMoney(estadoCuentaEmpleado?.saldo_pendiente_neto_usd || 0)}</p>
                </div>
                <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-2.5">
                  <p className="text-[10px] text-white/40">A favor</p>
                  <p className="mt-0.5 text-sm font-bold text-emerald-300">{formatMoney(estadoCuentaEmpleado?.saldo_favor_neto_usd || 0)}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/admin/finanzas/ingresos?empleado=${id}&tipoIngreso=producto`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.06]">Registrar consumo</Link>
                <Link href={`/admin/finanzas/ingresos?empleado=${id}&tipoIngreso=saldo&destino=deuda`} className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-400/15">Abonar deuda</Link>
                <Link href={`/admin/finanzas/ingresos?empleado=${id}&tipoIngreso=saldo&destino=credito`} className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-medium text-cyan-300 transition hover:bg-cyan-400/15">Agregar crédito</Link>
              </div>

              {cuentasPendientesEmpleado.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {cuentasPendientesEmpleado.map((cuenta) => (
                    <div key={cuenta.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-white">{cuenta.concepto}</p>
                        <p className="text-[10px] text-white/35">{formatDate(cuenta.fecha_venta)} · {cuenta.estado}</p>
                      </div>
                      <div className="ml-3 shrink-0 text-right">
                        <p className="text-xs font-semibold text-rose-300">{formatMoney(cuenta.saldo_usd)}</p>
                        <p className="text-[10px] text-white/30">{formatMoney(cuenta.monto_pagado_usd)} / {formatMoney(cuenta.monto_total_usd)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Clientes */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/30">Clientes activos ({clientes.length})</p>
              {clientes.length === 0 ? (
                <p className="text-xs text-white/35">Sin clientes asignados.</p>
              ) : (
                <div className="space-y-1">
                  {clientes.map((c) => (
                    <Link key={c.id} href={`/admin/personas/clientes/${c.id}`} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition hover:bg-white/[0.045]">
                      <div>
                        <p className="text-sm font-medium text-white">{c.nombre}</p>
                        {c.telefono && <p className="text-[10px] text-white/35">{c.telefono}</p>}
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${estadoBadge(c.estado)}`}>{c.estado}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/30">Saldo disponible</p>
              <div className="space-y-2">
                <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-3">
                  <p className="text-[10px] text-white/40">Profesional USD</p>
                  <p className="mt-0.5 text-lg font-bold text-emerald-400">{formatMoney(resumenDisponible.profesionalUsd)}</p>
                </div>
                <div className="rounded-xl border border-amber-400/15 bg-amber-400/5 px-3 py-3">
                  <p className="text-[10px] text-white/40">Profesional Bs</p>
                  <p className="mt-0.5 text-lg font-bold text-amber-300">{formatBs(resumenDisponible.profesionalBs)}</p>
                </div>
              </div>

              {deudaEmpleadoUsd > 0 && resumenDisponible.profesionalUsd > 0 && (
                <div className="mt-2 rounded-xl border border-rose-400/15 bg-rose-400/5 px-3 py-2.5">
                  <p className="text-[10px] text-white/40">Deuda del empleado</p>
                  <p className="mt-0.5 text-sm font-bold text-rose-300">{formatMoney(deudaEmpleadoUsd)}</p>
                </div>
              )}

              <div className="mt-3 space-y-2">
                <button type="button" onClick={() => setTab("comisiones")} className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.07]">
                  Ver liquidación →
                </button>
                {deudaEmpleadoUsd > 0 && resumenDisponible.profesionalUsd > 0 && (
                  <button type="button" onClick={() => { setTab("comisiones"); setAplicarDescuentoDeuda(true); setSelectedComisionIds((prev) => prev.length > 0 ? prev : comisionesPendientesMoneda.map((c) => c.id)); }} className="w-full rounded-xl border border-rose-400/20 bg-rose-400/10 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-400/15">
                    Descontar deuda →
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">Comisiones</p>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-white/50">
                  <span>Base USD</span><span className="font-medium text-white">{formatMoney(resumenDisponible.baseUsd)}</span>
                </div>
                <div className="flex justify-between text-white/50">
                  <span>RPM USD</span><span className="font-medium text-violet-300">{formatMoney(resumenDisponible.rpmUsd)}</span>
                </div>
                <div className="flex justify-between text-white/50">
                  <span>Pendientes</span><span className="font-medium text-white">{resumenDisponible.pendientes}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════
          TAB: AGENDA
      ════════════════════════════════════════ */}
      {tab === "agenda" && (
        <div className="space-y-3">
          {/* Filtros compactos */}
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-0.5">
              {(["hoy", "proximos", "todos"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setAgendaFiltro(f)}
                  className={`rounded-[8px] px-3 py-1.5 text-xs font-medium transition capitalize ${agendaFiltro === f ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/65"}`}>
                  {f === "proximos" ? "Próximos" : f === "todos" ? "Todos" : "Hoy"}
                </button>
              ))}
            </div>
            <div className="flex gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-0.5">
              {(["todos", "entrenamientos", "citas"] as const).map((f) => (
                <button key={f} type="button" onClick={() => setAgendaTipo(f)}
                  className={`rounded-[8px] px-3 py-1.5 text-xs font-medium transition capitalize ${agendaTipo === f ? "bg-white/[0.08] text-white" : "text-white/40 hover:text-white/65"}`}>
                  {f === "entrenamientos" ? "Ent." : f}
                </button>
              ))}
            </div>
            <select value={agendaClienteFiltro} onChange={(e) => setAgendaClienteFiltro(e.target.value)} className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-1.5 text-xs text-white/70 outline-none">
              <option value="todos" className="bg-[#11131a]">Todos los clientes</option>
              {[...new Set(agenda.map((a) => a.nombre))].sort().map((nombre) => (
                <option key={nombre} value={nombre} className="bg-[#11131a]">{nombre}</option>
              ))}
            </select>
          </div>

          {agendaAgrupadaPorCliente.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] py-12 text-center">
              <p className="text-xs text-white/35">{agendaFiltro === "hoy" ? "Sin actividad para hoy." : "Sin registros."}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {agendaAgrupadaPorCliente.map((group) => (
                <div key={group.cliente} className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
                  <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-white">{group.cliente}</p>
                      <p className="text-[10px] text-white/35">{group.items.length} bloque(s)</p>
                    </div>
                    <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">Cliente</span>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {group.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${item.tipo === "entrenamiento" ? "bg-violet-500/15 text-violet-300" : "bg-sky-500/15 text-sky-300"}`}>
                          {item.tipo === "entrenamiento" ? "E" : "C"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">{item.subtitulo}</p>
                          <p className="text-[10px] text-white/40">{formatDateLong(item.fecha)} · {item.hora_inicio.slice(0, 5)}–{item.hora_fin.slice(0, 5)}</p>
                          {item.notas && <p className="mt-0.5 truncate text-[10px] text-white/30">{item.notas}</p>}
                        </div>
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${citaBadge(item.estado)}`}>{item.estado}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════
          TAB: COMISIONES
      ════════════════════════════════════════ */}
      {tab === "comisiones" && (
        <div className="space-y-4">

          {/* ── Resumen disponible ── */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-3">
              <p className="text-[10px] text-white/35">Base USD</p>
              <p className="mt-0.5 text-sm font-semibold text-white">{formatMoney(resumenDisponible.baseUsd)}</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.04] px-3 py-3">
              <p className="text-[10px] text-white/35">Profesional disponible</p>
              <p className="mt-0.5 text-sm font-semibold text-emerald-400">{formatMoney(resumenDisponible.profesionalUsd)}</p>
              <p className="text-[10px] text-white/30">{formatBs(resumenDisponible.profesionalBs)}</p>
            </div>
            <div className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.04] px-3 py-3">
              <p className="text-[10px] text-white/35">RPM</p>
              <p className="mt-0.5 text-sm font-semibold text-violet-400">{formatMoney(resumenDisponible.rpmUsd)}</p>
            </div>
          </div>

          {/* ── Panel de liquidación ── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">

            {/* Controles superiores */}
            <div className="border-b border-white/[0.06] px-4 py-3">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-white/30">Configuración de liquidación</p>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[10px] text-white/40">Moneda</label>
                  <select value={monedaPago} onChange={(e) => setMonedaPago(e.target.value as Moneda)} className={inputCls()}>
                    <option value="USD" className="bg-[#11131a]">USD</option>
                    <option value="BS" className="bg-[#11131a]">BS</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-white/40">Fecha de pago</label>
                  <input type="date" value={fechaPagoComision} onChange={(e) => setFechaPagoComision(e.target.value)} className={inputCls()} />
                </div>
                {requiereTasa && (
                  <div>
                    <label className="mb-1 block text-[10px] text-white/40">Tasa BCV</label>
                    <div className="flex gap-1.5">
                      <input type="number" step="0.0001" min="0" value={tasaBCV ?? ""} onChange={(e) => setTasaBCV(e.target.value ? Number(e.target.value) : null)} className={inputCls()} placeholder="36.52" />
                      <button type="button" onClick={() => void cargarTasaBCVAutomatica()} disabled={cargandoTasa} className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-2 text-[10px] text-white/60 hover:bg-white/[0.06] disabled:opacity-50">
                        {cargandoTasa ? "…" : "Auto"}
                      </button>
                    </div>
                    {tasaBCVAuto && <p className="mt-1 text-[10px] text-emerald-300">Automática: {tasaBCVAuto}</p>}
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-[10px] text-white/40">Seleccionadas</label>
                  <div className="flex h-[38px] items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white">
                    <span>{resumenSeleccionado.pendientes} comisión(es)</span>
                    {resumenSeleccionado.pendientes > 0 && <span className="text-emerald-300">{formatMoney(resumenSeleccionado.profesionalUsd)}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Botón imprimir pendientes */}
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
              <div>
                <p className="text-xs font-medium text-white/70">Imprimir comisiones pendientes</p>
                <p className="text-[10px] text-white/35">{comisionesPendientesMoneda.length} pendiente(s) para {monedaPago}</p>
              </div>
              <button type="button" onClick={() => void exportComisionPDF()} className="rounded-xl border border-sky-400/25 bg-sky-400/[0.08] px-3 py-2 text-xs font-medium text-sky-300 transition hover:bg-sky-400/15">
                📄 PDF
              </button>
            </div>

            {/* Lista comisiones pendientes */}
            <div className="px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-white/60">Pendientes · {monedaPago}</p>
                <button type="button" onClick={selectAllCurrentCurrency} className="text-[10px] text-white/40 hover:text-white/65 transition">
                  {allCurrentCurrencySelected ? "Quitar todas" : "Seleccionar todas"}
                </button>
              </div>

              {comisionesPendientesMoneda.length === 0 ? (
                <p className="py-4 text-center text-xs text-white/35">No hay comisiones pendientes para {monedaPago}.</p>
              ) : (
                <div className="space-y-1">
                  {comisionesPendientesMoneda.map((c) => {
                    const checked = selectedComisionIds.includes(c.id);
                    const monto = getComisionMontoByMoneda(c, monedaPago);
                    const concepto = getComisionConcepto(c);
                    const descuentoUsd = getComisionDescuentoDeudaByMoneda(c, "USD");
                    return (
                      <button key={c.id} type="button" onClick={() => toggleComision(c.id)} aria-pressed={checked}
                        className={`group w-full rounded-xl border px-3 py-2.5 text-left transition ${checked ? "border-emerald-400/30 bg-emerald-400/[0.07]" : "border-white/[0.06] bg-white/[0.015] hover:bg-white/[0.03]"}`}>
                        <div className="flex items-center gap-3">
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold transition ${checked ? "border-emerald-400/50 bg-emerald-400/20 text-emerald-300" : "border-white/10 text-white/20 group-hover:text-white/40"}`}>
                            {checked ? "✓" : ""}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1 mb-0.5">
                              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${c.tipo === "plan" ? "bg-violet-500/10 text-violet-300" : "bg-sky-500/10 text-sky-300"}`}>
                                {c.tipo || "comisión"}
                              </span>
                              <span className="text-[10px] text-white/35">
                                {c.cita_fecha ? formatDate(c.cita_fecha) : formatDate(c.fecha)}
                                {c.cita_hora_inicio && ` · ${String(c.cita_hora_inicio).slice(0, 5)}`}
                              </span>
                            </div>
                            <p className="truncate text-xs font-medium text-white">{concepto}</p>
                            {descuentoUsd > 0 && <p className="text-[10px] text-rose-300/80">Deuda desc. {formatMoney(descuentoUsd)}</p>}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`text-sm font-bold tabular-nums ${checked ? "text-emerald-300" : "text-white/70"}`}>
                              {formatMontoByMoneda(monto, monedaPago)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Métodos de pago */}
            <div className="border-t border-white/[0.06] px-4 py-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">
                {soloDescontarDeudaActivo ? "Descuento interno · sin pago" : "Métodos de pago"}
              </p>

              {/* Resumen neto */}
              <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                  <p className="text-[10px] text-white/35">Neto {monedaAbbr(monedaPago)}</p>
                  <p className="mt-0.5 font-semibold text-white">{formatMontoByMoneda(montoFacturar, monedaPago)}</p>
                  {descuentoDeudaUsd > 0 && <p className="text-[10px] text-rose-300">- deuda {formatMoney(descuentoDeudaUsd)}</p>}
                </div>
                <div className="rounded-xl border border-violet-400/15 bg-violet-400/[0.04] px-3 py-2">
                  <p className="text-[10px] text-white/35">{soloDescontarDeudaActivo ? "Pago empleado" : `Asignado ${monedaAbbr(monedaPago)}`}</p>
                  <p className="mt-0.5 font-semibold text-violet-300">{soloDescontarDeudaActivo ? formatMoney(0) : formatMontoByMoneda(totalSplits, monedaPago)}</p>
                </div>
                <div className={`rounded-xl border px-3 py-2 ${restantePorAsignar === 0 || soloDescontarDeudaActivo ? "border-emerald-400/15 bg-emerald-400/[0.04]" : "border-amber-400/15 bg-amber-400/[0.04]"}`}>
                  <p className="text-[10px] text-white/35">{soloDescontarDeudaActivo ? "Pendiente luego" : "Restante"}</p>
                  <p className={`mt-0.5 font-semibold ${restantePorAsignar === 0 || soloDescontarDeudaActivo ? "text-emerald-300" : "text-amber-300"}`}>
                    {soloDescontarDeudaActivo ? formatMontoByMoneda(montoNetoAPagar, monedaPago) : formatMontoByMoneda(restantePorAsignar, monedaPago)}
                  </p>
                </div>
              </div>

              {/* Descuento de deuda */}
              {deudaEmpleadoUsd > 0 && (
                <div className="mb-3 rounded-xl border border-rose-400/15 bg-rose-400/[0.04] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-rose-300">Descontar deuda</p>
                      <p className="text-[10px] text-white/40">Deuda: {formatMoney(deudaEmpleadoUsd)}</p>
                    </div>
                    <label className="flex items-center gap-1.5 text-[10px] text-white/60 cursor-pointer">
                      <input type="checkbox" checked={aplicarDescuentoDeuda} disabled={resumenSeleccionado.pendientes === 0} onChange={(e) => setAplicarDescuentoDeuda(e.target.checked)} className="accent-rose-400" />
                      Aplicar
                    </label>
                  </div>

                  {resumenSeleccionado.pendientes === 0 && (
                    <p className="mt-2 text-[10px] text-amber-300/80">Primero selecciona comisiones arriba.</p>
                  )}

                  {aplicarDescuentoDeuda && resumenSeleccionado.pendientes > 0 && (
                    <div className="mt-2 space-y-2">
                      <div className="grid grid-cols-2 gap-1.5">
                        {(["solo_descuento", "descuento_y_pagar"] as const).map((modo) => (
                          <button key={modo} type="button" onClick={() => setModoDescuentoDeuda(modo)}
                            className={`rounded-lg border px-2 py-2 text-left text-[10px] transition ${modoDescuentoDeuda === modo ? (modo === "solo_descuento" ? "border-rose-400/25 bg-rose-400/10 text-rose-200" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200") : "border-white/10 bg-white/[0.02] text-white/45"}`}>
                            <span className="block text-xs font-semibold text-white">
                              {modo === "solo_descuento" ? "Solo descontar" : "Descontar + pagar"}
                            </span>
                            {modo === "solo_descuento" ? "Comisión queda pendiente." : "Paga el neto restante."}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-[10px] text-white/40">Monto a descontar USD</label>
                          <input type="number" min="0" step="0.01" max={Math.min(deudaEmpleadoUsd, resumenSeleccionado.profesionalUsd)} value={descuentoDeudaUsdInput} onChange={(e) => setDescuentoDeudaUsdInput(e.target.value)} className={inputCls()} placeholder={`Máx. ${formatMoney(Math.min(deudaEmpleadoUsd, resumenSeleccionado.profesionalUsd))}`} />
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.04] px-2.5 py-2">
                            <p className="text-[10px] text-white/35">Descuento</p>
                            <p className="text-xs font-semibold text-rose-300">{formatMoney(descuentoDeudaUsd)}</p>
                          </div>
                          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] px-2.5 py-2">
                            <p className="text-[10px] text-white/35">Neto a pagar</p>
                            <p className="text-xs font-semibold text-emerald-300">{formatMontoByMoneda(montoNetoAPagar, monedaPago)}</p>
                          </div>
                        </div>
                      </div>

                      {soloDescontarDeudaActivo && (
                        <div>
                          <label className="mb-1 block text-[10px] text-white/40">Destino interno</label>
                          <select value={destinoDescuentoDeuda} onChange={(e) => setDestinoDescuentoDeuda(e.target.value as any)} className={inputCls()}>
                            <option value="ingreso_rpm" className="bg-[#11131a]">Ingreso RPM / retención</option>
                            <option value="ajuste_nomina" className="bg-[#11131a]">Ajuste de nómina</option>
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Splits de pago */}
              {!soloDescontarDeudaActivo && (
                <div className="space-y-2">
                  {splitsConMetodo.map((split, index) => {
                    const metodo = split.metodo;
                    const saldo = split.saldo;
                    const monedaMetodo = split.metodoMoneda;
                    const montoContraMetodo = split.requiereConversion ? split.montoDescontar : split.montoLiquidacion;
                    return (
                      <div key={split.id} className="grid gap-2 rounded-xl border border-white/[0.06] bg-white/[0.015] p-2.5 md:grid-cols-[1fr_auto_auto_auto]">
                        <div>
                          <label className="mb-1 block text-[10px] text-white/35">Método #{index + 1}</label>
                          <select value={split.metodoPagoId} onChange={(e) => updateSplit(split.id, { metodoPagoId: e.target.value })} className={inputCls()}>
                            <option value="" className="bg-[#11131a]">Seleccionar método</option>
                            {metodosPago.map((m) => {
                              const saldoM = getMetodoSaldo(m); const monedaM = getMetodoMoneda(m);
                              return <option key={m.id} value={m.id} className="bg-[#11131a]">{m.nombre}{m.cartera?.nombre ? ` · ${m.cartera.nombre}` : ""}{` · ${monedaM}`}{saldoM > 0 ? ` · ${formatMontoByMoneda(saldoM, monedaM)}` : ""}</option>;
                            })}
                          </select>
                          {metodo && split.requiereConversion && (
                            <p className="mt-1 text-[10px] text-amber-300/80">→ {montoContraMetodo !== null ? formatMontoByMoneda(montoContraMetodo, monedaMetodo) : "—"} de {metodo.cartera?.nombre || monedaMetodo}</p>
                          )}
                        </div>
                        <div className="min-w-[110px]">
                          <label className="mb-1 block text-[10px] text-white/35">Monto {monedaAbbr(monedaPago)}</label>
                          <input type="number" min="0" step="0.01" value={split.monto} onChange={(e) => updateSplit(split.id, { monto: e.target.value })} className={inputCls()} placeholder="0.00" />
                        </div>
                        <div className="flex items-end">
                          <button type="button" onClick={() => fillRemainingOnSplit(split.id)} className="h-[38px] rounded-xl border border-white/10 bg-white/[0.03] px-2.5 text-[10px] text-white/60 hover:bg-white/[0.06]">Completar</button>
                        </div>
                        <div className="flex items-end">
                          <button type="button" onClick={() => removeSplit(split.id)} className="h-[38px] rounded-xl border border-rose-400/20 bg-rose-400/[0.06] px-2.5 text-[10px] text-rose-300 hover:bg-rose-400/10">×</button>
                        </div>
                      </div>
                    );
                  })}
                  <button type="button" onClick={addSplit} className="text-[10px] text-white/40 hover:text-white/65 transition">+ Agregar método</button>
                </div>
              )}

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] text-white/40">Referencia</label>
                  <input type="text" value={referencia} onChange={(e) => setReferencia(e.target.value)} className={inputCls()} placeholder="N° referencia" />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-white/40">Notas</label>
                  <input type="text" value={notasLiquidacion} onChange={(e) => setNotasLiquidacion(e.target.value)} className={inputCls()} placeholder="Notas" />
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {resumenSeleccionado.pendientes > 0 && aplicarDescuentoDeuda && modoDescuentoDeuda === "solo_descuento" && (
                  <button type="button" onClick={descontarDeudaSinPagarComision} disabled={facturando || descuentoDeudaUsd <= 0} className="w-full rounded-xl border border-rose-400/25 bg-rose-400/[0.08] py-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/15 disabled:opacity-50">
                    {facturando ? "Descontando…" : `Descontar ${formatMoney(descuentoDeudaUsd)} de deuda · sin pagar`}
                  </button>
                )}
                {resumenSeleccionado.pendientes > 0 && (!aplicarDescuentoDeuda || modoDescuentoDeuda === "descuento_y_pagar") && (
                  <button type="button" onClick={liquidarSaldoDisponible} disabled={facturando} className="w-full rounded-xl border border-emerald-400/25 bg-emerald-400/[0.08] py-2.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-50">
                    {facturando ? "Liquidando…" : `Liquidar ${resumenSeleccionado.pendientes} comisión(es) · ${formatMontoByMoneda(montoNetoAPagar, monedaPago)} en ${monedaAbbr(monedaPago)}`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Quincena referencia ── */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/30">Quincena actual · {quincenaActual.label}</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-[10px] text-white/35">Pendientes en quincena</p>
                <p className="mt-0.5 font-medium text-white">{comisiones.filter((c) => isPendienteEstado(c.estado) && c.fecha >= quincenaActual.inicio && c.fecha <= quincenaActual.fin).length} registros</p>
              </div>
              <div>
                <p className="text-[10px] text-white/35">Liquidados en quincena</p>
                <p className="mt-0.5 font-medium text-white">{comisionesLiquidadaHoyQuincena.length} registros</p>
              </div>
              <div>
                <p className="text-[10px] text-white/35">Rango</p>
                <p className="mt-0.5 font-medium text-white">{formatDate(quincenaActual.inicio)} – {formatDate(quincenaActual.fin)}</p>
              </div>
            </div>
          </div>

          {/* ── Historial de liquidaciones ── */}
          {liquidaciones.length > 0 && (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] overflow-hidden">
              <div className="border-b border-white/[0.06] px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/30">Historial de liquidaciones</p>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {liquidaciones.map((liq) => {
                  const detalleLiquidado = comisionesPorLiquidacion.get(liq.id) || [];
                  const abierta = liquidacionAbiertaId === liq.id;
                  const totalDetalleUsd = r2(detalleLiquidado.reduce((acc, c) => acc + getComisionMontoByMoneda(c, "USD"), 0));
                  const totalDetalleBs = r2(detalleLiquidado.reduce((acc, c) => acc + getComisionMontoByMoneda(c, "BS"), 0));
                  return (
                    <div key={liq.id}>
                      <button type="button" onClick={() => toggleLiquidacionAbierta(liq.id)} aria-expanded={abierta}
                        className={`w-full px-4 py-3 text-left transition hover:bg-white/[0.02] ${abierta ? "bg-white/[0.02]" : ""}`}>
                        <div className="flex items-center gap-3">
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] transition ${abierta ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300" : "border-white/10 text-white/25"}`}>
                            {abierta ? "▲" : "▼"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-white">
                                {formatDate(liq.fecha_inicio)} – {formatDate(liq.fecha_fin)}
                              </p>
                              <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${isFacturadaEstado(liq.estado) ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-amber-400/20 bg-amber-400/10 text-amber-300"}`}>
                                {isFacturadaEstado(liq.estado) ? "✓ Liquidado" : liq.estado}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[10px] text-white/35">
                              {detalleLiquidado.length || liq.cantidad_citas} registro(s) · {liq.moneda_pago || "—"}
                              {liq.referencia ? ` · Ref: ${liq.referencia}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold text-emerald-400">
                              {liq.moneda_pago === "BS" ? formatBs(liq.monto_pago) : formatMoney(liq.monto_pago)}
                            </p>
                            <p className="text-[10px] text-white/30">{formatMoney(liq.monto_equivalente_usd)}</p>
                          </div>
                        </div>
                      </button>

                      {abierta && (
                        <div className="border-t border-white/[0.04] bg-black/10 px-4 py-3">
                          <div className="mb-2 grid grid-cols-3 gap-2">
                            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                              <p className="text-[10px] text-white/35">Conceptos</p>
                              <p className="mt-0.5 text-sm font-bold text-white">{detalleLiquidado.length}</p>
                            </div>
                            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] px-3 py-2">
                              <p className="text-[10px] text-white/35">Neto USD</p>
                              <p className="mt-0.5 text-sm font-bold text-emerald-300">{formatMoney(totalDetalleUsd)}</p>
                            </div>
                            <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2">
                              <p className="text-[10px] text-white/35">Neto Bs</p>
                              <p className="mt-0.5 text-sm font-bold text-amber-300">{formatBs(totalDetalleBs)}</p>
                            </div>
                          </div>

                          {detalleLiquidado.length === 0 ? (
                            <p className="rounded-xl border border-amber-400/15 bg-amber-400/[0.06] px-3 py-2 text-[10px] text-amber-200">
                              Sin conceptos enlazados. Revisa liquidacion_id o pago_empleado_id.
                            </p>
                          ) : (
                            <div className="divide-y divide-white/[0.03] rounded-xl border border-white/[0.06] overflow-hidden">
                              {detalleLiquidado.map((c, index) => {
                                const descuentoUsd = getComisionDescuentoDeudaByMoneda(c, "USD");
                                return (
                                  <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.01]">
                                    <span className="shrink-0 text-[10px] text-white/25 w-4">#{index + 1}</span>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-1 mb-0.5">
                                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${c.tipo === "plan" ? "bg-violet-500/10 text-violet-300" : "bg-sky-500/10 text-sky-300"}`}>{c.tipo || "comisión"}</span>
                                        <span className="text-[10px] text-white/30">{formatDate(c.cita_fecha || c.fecha)}{c.cita_hora_inicio && ` · ${String(c.cita_hora_inicio).slice(0, 5)}`}</span>
                                      </div>
                                      <p className="truncate text-xs font-medium text-white">{getComisionConcepto(c)}</p>
                                      {descuentoUsd > 0 && <p className="text-[10px] text-rose-300/70">Deuda desc. {formatMoney(descuentoUsd)}</p>}
                                    </div>
                                    <div className="shrink-0 text-right">
                                      <p className="text-xs font-bold text-emerald-300">{formatMoney(getComisionMontoByMoneda(c, "USD"))}</p>
                                      <p className="text-[10px] text-white/25">{formatBs(getComisionMontoByMoneda(c, "BS"))}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          <button type="button" onClick={() => void exportComisionPDF(liq)} className="mt-2 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] px-3 py-2 text-[10px] font-medium text-sky-300 transition hover:bg-sky-400/10">
                            📄 Imprimir esta liquidación
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}