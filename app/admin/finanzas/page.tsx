"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

type Pago = {
  id: string;
  fecha: string;
  concepto: string;
  categoria: string;
  monto: number;
  estado: string;
  tipo_origen: string;
  created_at?: string;
  moneda_pago: string | null;
  monto_equivalente_usd: number | null;
  monto_equivalente_bs: number | null;
  clientes: { nombre: string } | null;
  metodo_pago_v2?: {
    id?: string | null;
    nombre: string;
    moneda?: string | null;
    tipo?: string | null;
    cartera?: { nombre: string; codigo: string; moneda?: string | null } | null;
  } | null;
};

type Egreso = {
  id: string;
  fecha: string;
  concepto: string;
  categoria: string;
  monto: number;
  estado: string;
  proveedor: string | null;
  created_at?: string;
  moneda: string | null;
  monto_equivalente_usd: number | null;
  monto_equivalente_bs: number | null;
  empleado_id: string | null;
  empleados?: { nombre: string } | null;
  metodo_pago_v2?: {
    id?: string | null;
    nombre: string;
    moneda?: string | null;
    tipo?: string | null;
    cartera?: { nombre: string; codigo: string; moneda?: string | null } | null;
  } | null;
};

type MetodoSubcartera = {
  id: string;
  metodo_nombre: string;
  metodo_codigo: string;
  tipo: string | null;
  moneda: string;
  saldo_actual: number | null;
  banco: string | null;
  numero_cuenta: string | null;
  activo: boolean | null;
  cartera_id: string;
  cartera_nombre: string;
  cartera_codigo: string;
  cartera_color: string | null;
  cartera_icono: string | null;
};

type ComisionResumen = {
  empleado_id: string;
  nombre: string;
  total_base_usd: number;
  total_base_bs: number;
  total_profesional_usd: number;
  total_profesional_bs: number;
  total_rpm_usd: number;
  total_rpm_bs: number;
  cantidad: number;
};

type Movimiento = {
  id: string;
  fecha: string;
  tipo: "ingreso" | "egreso";
  concepto: string;
  categoria: string;
  tercero: string;
  metodo_id: string;
  metodo: string;
  cartera: string;
  cartera_codigo: string;
  moneda_metodo: string;
  estado: string;
  moneda_origen: string;
  monto_usd: number;
  monto_bs: number;
  created_at?: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const PIE_COLORS = ["#38bdf8", "#34d399", "#f59e0b", "#f87171", "#a78bfa", "#94a3b8"];
const MOVIMIENTOS_POR_SUBCARTERA = 10;

// ─── Utilities ───────────────────────────────────────────────────────────────

function money(v: number, currency: "USD" | "VES" = "USD") {
  if (currency === "VES")
    return new Intl.NumberFormat("es-VE", { style: "currency", currency: "VES", maximumFractionDigits: 2 }).format(Number(v || 0));
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(v || 0));
}

function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstDayOfMonthISO() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function shortDate(v: string) {
  try { return new Date(v).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }); }
  catch { return v; }
}

function normalizeMoneda(moneda: string | null | undefined) {
  const m = (moneda || "").toUpperCase();
  if (m === "BS") return "VES";
  return m;
}

function normalizeText(value: string | null | undefined) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizePago(row: any): Pago {
  const cliente = firstOrNull(row?.clientes);
  const metodo = firstOrNull(row?.metodo_pago_v2);
  const cartera = firstOrNull(metodo?.cartera);
  return {
    id: String(row?.id ?? ""), fecha: String(row?.fecha ?? ""), concepto: String(row?.concepto ?? ""),
    categoria: String(row?.categoria ?? ""), monto: Number(row?.monto || 0), estado: String(row?.estado ?? ""),
    tipo_origen: String(row?.tipo_origen ?? ""), created_at: row?.created_at ?? undefined,
    moneda_pago: row?.moneda_pago ?? null,
    monto_equivalente_usd: row?.monto_equivalente_usd != null ? Number(row.monto_equivalente_usd) : null,
    monto_equivalente_bs: row?.monto_equivalente_bs != null ? Number(row.monto_equivalente_bs) : null,
    clientes: cliente ? { nombre: String(cliente?.nombre ?? "") } : null,
    metodo_pago_v2: metodo ? {
      id: metodo?.id ? String(metodo.id) : null, nombre: String(metodo?.nombre ?? ""),
      moneda: metodo?.moneda ?? null, tipo: metodo?.tipo ?? null,
      cartera: cartera ? { nombre: String(cartera?.nombre ?? ""), codigo: String(cartera?.codigo ?? ""), moneda: cartera?.moneda ?? null } : null,
    } : null,
  };
}

function normalizeEgreso(row: any): Egreso {
  const empleado = firstOrNull(row?.empleados);
  const metodo = firstOrNull(row?.metodo_pago_v2);
  const cartera = firstOrNull(metodo?.cartera);
  return {
    id: String(row?.id ?? ""), fecha: String(row?.fecha ?? ""), concepto: String(row?.concepto ?? ""),
    categoria: String(row?.categoria ?? ""), monto: Number(row?.monto || 0), estado: String(row?.estado ?? ""),
    proveedor: row?.proveedor ?? null, created_at: row?.created_at ?? undefined, moneda: row?.moneda ?? null,
    monto_equivalente_usd: row?.monto_equivalente_usd != null ? Number(row.monto_equivalente_usd) : null,
    monto_equivalente_bs: row?.monto_equivalente_bs != null ? Number(row.monto_equivalente_bs) : null,
    empleado_id: row?.empleado_id ?? null,
    empleados: empleado ? { nombre: String(empleado?.nombre ?? "") } : null,
    metodo_pago_v2: metodo ? {
      id: metodo?.id ? String(metodo.id) : null, nombre: String(metodo?.nombre ?? ""),
      moneda: metodo?.moneda ?? null, tipo: metodo?.tipo ?? null,
      cartera: cartera ? { nombre: String(cartera?.nombre ?? ""), codigo: String(cartera?.codigo ?? ""), moneda: cartera?.moneda ?? null } : null,
    } : null,
  };
}

function getMetodoEmoji(codigo: string, moneda: string) {
  const key = `${codigo} ${moneda}`.toLowerCase();
  if (key.includes("zelle")) return "💸";
  if (key.includes("binance")) return "🟡";
  if (key.includes("paypal")) return "🅿️";
  if (key.includes("pago_movil")) return "📲";
  if (key.includes("punto_venta")) return "💳";
  if (key.includes("transferencia")) return "🏦";
  if (key.includes("efectivo") && moneda === "USD") return "💵";
  if (key.includes("efectivo") && (moneda === "VES" || moneda === "BS")) return "💰";
  return moneda === "USD" ? "💵" : "💰";
}

// ─── Design System ───────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/15 focus:bg-white/[0.05]";

function estadoBadge(e: string) {
  if (e === "pagado") return "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20";
  if (e === "anulado") return "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20";
  if (e === "pendiente") return "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20";
  return "bg-white/5 text-white/50 ring-1 ring-white/10";
}

function tipoBadge(t: "ingreso" | "egreso") {
  return t === "ingreso"
    ? "bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20"
    : "bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20";
}

function getCurrencyStyles(monedaVista: "USD" | "BS") {
  if (monedaVista === "USD") return {
    glow: "shadow-[0_0_40px_-8px_rgba(16,185,129,0.25)]",
    ring: "ring-1 ring-emerald-500/20",
    accent: "text-emerald-400",
    accentBg: "bg-emerald-500/10",
    dot: "bg-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
    bar: "#10b981",
    gradient: "from-emerald-500/10 to-transparent",
  };
  return {
    glow: "shadow-[0_0_40px_-8px_rgba(245,158,11,0.25)]",
    ring: "ring-1 ring-amber-500/20",
    accent: "text-amber-400",
    accentBg: "bg-amber-500/10",
    dot: "bg-amber-400",
    badge: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
    bar: "#f59e0b",
    gradient: "from-amber-500/10 to-transparent",
  };
}

function getMonedaMetodoNormalizada(value: string | null | undefined) {
  const m = normalizeMoneda(value);
  return m === "VES" ? "BS" : m === "USD" ? "USD" : "USD";
}

// ─── Micro-components ────────────────────────────────────────────────────────

function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${className}`}>
      {children}
    </span>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[11px] font-medium uppercase tracking-widest text-white/30">{children}</p>;
}

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, color, icon }: { title: string; value: string; sub?: string; color: string; icon: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#080b18] p-5 transition hover:border-white/10">
      {/* subtle inner glow top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-widest text-white/35">{title}</p>
          <p className={`mt-2.5 text-2xl font-bold tracking-tight ${color}`}>{value}</p>
          {sub && <p className="mt-1 text-[11px] text-white/30">{sub}</p>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-base">
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── SectionHeader ───────────────────────────────────────────────────────────

function SectionHeader({ title, description, right }: { title: string; description?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description && <p className="mt-0.5 text-[11px] text-white/35">{description}</p>}
      </div>
      {right}
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#080b18] ${className}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {children}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function FinanzasResumenPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fechaInicio, setFechaInicio] = useState(firstDayOfMonthISO());
  const [fechaFin, setFechaFin] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "ingreso" | "egreso">("todos");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todos");
  const [monedaVista, setMonedaVista] = useState<"USD" | "BS">("USD");
  const [subcarteraAbiertaId, setSubcarteraAbiertaId] = useState<string | null>(null);
  const [subcarteraPaginas, setSubcarteraPaginas] = useState<Record<string, number>>({});
  const [monedaFiltro, setMonedaFiltro] = useState<"todas" | "USD" | "VES" | "BS">("todas");
  const [carteraFiltro, setCarteraFiltro] = useState("todas");

  const [pagos, setPagos] = useState<Pago[]>([]);
  const [egresos, setEgresos] = useState<Egreso[]>([]);
  const [subcarteras, setSubcarteras] = useState<MetodoSubcartera[]>([]);
  const [comisiones, setComisiones] = useState<ComisionResumen[]>([]);

  useEffect(() => { void loadFinanzas(); }, [fechaInicio, fechaFin]);

  useEffect(() => {
    setSubcarteraAbiertaId(null);
    setSubcarteraPaginas({});
  }, [monedaVista, fechaInicio, fechaFin]);

  useEffect(() => {
    if (carteraFiltro === "todas") return;
    const carterasDisponibles = new Set(movimientos.map((m) => m.cartera_codigo).filter(Boolean));
    if (!carterasDisponibles.has(carteraFiltro)) setCarteraFiltro("todas");
  }, [monedaFiltro]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadFinanzas() {
    try {
      setLoading(true);
      setError("");

      const [pagosRes, egresosRes, comisionesRes, subcarterasRes] = await Promise.all([
        supabase.from("pagos").select(`id,fecha,concepto,categoria,monto,estado,tipo_origen,created_at,moneda_pago,monto_equivalente_usd,monto_equivalente_bs,clientes:cliente_id(nombre),metodo_pago_v2:metodo_pago_v2_id(id,nombre,moneda,tipo,cartera:cartera_id(nombre,codigo,moneda))`).gte("fecha", fechaInicio).lte("fecha", fechaFin).order("fecha", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("egresos").select(`id,fecha,concepto,categoria,monto,estado,proveedor,created_at,moneda,monto_equivalente_usd,monto_equivalente_bs,empleado_id,empleados:empleado_id(nombre),metodo_pago_v2:metodo_pago_v2_id(id,nombre,moneda,tipo,cartera:cartera_id(nombre,codigo,moneda))`).gte("fecha", fechaInicio).lte("fecha", fechaFin).order("fecha", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("comisiones_detalle").select(`empleado_id,monto_base_usd,monto_base_bs,monto_profesional_usd,monto_profesional_bs,monto_rpm_usd,monto_rpm_bs,empleados:empleado_id(nombre)`).gte("fecha", fechaInicio).lte("fecha", fechaFin).eq("estado", "pendiente"),
        supabase.from("v_metodos_pago_completo").select(`id,metodo_nombre,metodo_codigo,tipo,moneda,saldo_actual,banco,numero_cuenta,activo,cartera_id,cartera_nombre,cartera_codigo,cartera_color,cartera_icono`).order("moneda", { ascending: true }).order("cartera_nombre", { ascending: true }).order("metodo_nombre", { ascending: true }),
      ]);

      if (pagosRes.error) throw pagosRes.error;
      if (egresosRes.error) throw egresosRes.error;
      if (comisionesRes.error) throw comisionesRes.error;
      if (subcarterasRes.error) throw subcarterasRes.error;

      setPagos(((pagosRes.data || []) as any[]).map(normalizePago));
      setEgresos(((egresosRes.data || []) as any[]).map(normalizeEgreso));
      setSubcarteras((subcarterasRes.data || []) as MetodoSubcartera[]);

      const grouped = new Map<string, ComisionResumen>();
      ((comisionesRes.data || []) as any[]).forEach((c: any) => {
        const nombre = firstOrNull(c?.empleados)?.nombre || "Sin nombre";
        const key = String(c.empleado_id);
        const ex = grouped.get(key);
        if (ex) {
          ex.total_base_usd += Number(c.monto_base_usd || 0);
          ex.total_base_bs += Number(c.monto_base_bs || 0);
          ex.total_profesional_usd += Number(c.monto_profesional_usd || 0);
          ex.total_profesional_bs += Number(c.monto_profesional_bs || 0);
          ex.total_rpm_usd += Number(c.monto_rpm_usd || 0);
          ex.total_rpm_bs += Number(c.monto_rpm_bs || 0);
          ex.cantidad += 1;
        } else {
          grouped.set(key, { empleado_id: key, nombre, total_base_usd: Number(c.monto_base_usd || 0), total_base_bs: Number(c.monto_base_bs || 0), total_profesional_usd: Number(c.monto_profesional_usd || 0), total_profesional_bs: Number(c.monto_profesional_bs || 0), total_rpm_usd: Number(c.monto_rpm_usd || 0), total_rpm_bs: Number(c.monto_rpm_bs || 0), cantidad: 1 });
        }
      });
      setComisiones(Array.from(grouped.values()));
    } catch (err: any) {
      setError(err?.message || "Error cargando finanzas.");
    } finally {
      setLoading(false);
    }
  }

  const movimientos = useMemo(() => {
    const ingresos: Movimiento[] = pagos.map((p) => ({
      id: p.id, fecha: p.fecha, tipo: "ingreso" as const, concepto: p.concepto, categoria: p.categoria,
      tercero: p.clientes?.nombre || "—", metodo_id: p.metodo_pago_v2?.id || "",
      metodo: p.metodo_pago_v2?.nombre || "—", cartera: p.metodo_pago_v2?.cartera?.nombre || "Sin cartera",
      cartera_codigo: p.metodo_pago_v2?.cartera?.codigo || "",
      moneda_metodo: (p.metodo_pago_v2?.moneda || p.metodo_pago_v2?.cartera?.moneda || p.moneda_pago || "USD").toUpperCase(),
      estado: p.estado, moneda_origen: p.moneda_pago || "USD",
      monto_usd: Number(p.monto_equivalente_usd || 0), monto_bs: Number(p.monto_equivalente_bs || 0), created_at: p.created_at,
    }));
    const egs: Movimiento[] = egresos.map((e) => ({
      id: e.id, fecha: e.fecha, tipo: "egreso" as const, concepto: e.concepto, categoria: e.categoria,
      tercero: e.empleados?.nombre || e.proveedor || "—", metodo_id: e.metodo_pago_v2?.id || "",
      metodo: e.metodo_pago_v2?.nombre || "—", cartera: e.metodo_pago_v2?.cartera?.nombre || "Sin cartera",
      cartera_codigo: e.metodo_pago_v2?.cartera?.codigo || "",
      moneda_metodo: (e.metodo_pago_v2?.moneda || e.metodo_pago_v2?.cartera?.moneda || e.moneda || "USD").toUpperCase(),
      estado: e.estado, moneda_origen: e.moneda || "USD",
      monto_usd: Number(e.monto_equivalente_usd || 0), monto_bs: Number(e.monto_equivalente_bs || 0), created_at: e.created_at,
    }));
    return [...ingresos, ...egs].sort((a, b) =>
      new Date(`${b.fecha}T${b.created_at || "00:00"}`).getTime() - new Date(`${a.fecha}T${a.created_at || "00:00"}`).getTime()
    );
  }, [pagos, egresos]);

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      if (tipoFiltro !== "todos" && m.tipo !== tipoFiltro) return false;
      if (estadoFiltro !== "todos" && m.estado !== estadoFiltro) return false;
      if (categoriaFiltro !== "todos" && m.categoria !== categoriaFiltro) return false;
      if (monedaFiltro !== "todas") {
        if (normalizeMoneda(m.moneda_metodo) !== normalizeMoneda(monedaFiltro)) return false;
      }
      if (carteraFiltro !== "todas" && m.cartera_codigo !== carteraFiltro) return false;
      if (search) {
        const s = search.toLowerCase();
        return m.concepto.toLowerCase().includes(s) || m.tercero.toLowerCase().includes(s) || m.categoria.toLowerCase().includes(s) || m.metodo.toLowerCase().includes(s) || m.cartera.toLowerCase().includes(s);
      }
      return true;
    });
  }, [movimientos, tipoFiltro, estadoFiltro, categoriaFiltro, monedaFiltro, carteraFiltro, search]);

  const totales = useMemo(() => {
    const pagados = movimientosFiltrados.filter((m) => m.estado === "pagado");
    const ingresosUsd = pagados.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + Number(m.monto_usd || 0), 0);
    const ingresosBs = pagados.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + Number(m.monto_bs || 0), 0);
    const egresosUsd = pagados.filter((m) => m.tipo === "egreso").reduce((a, m) => a + Number(m.monto_usd || 0), 0);
    const egresosBs = pagados.filter((m) => m.tipo === "egreso").reduce((a, m) => a + Number(m.monto_bs || 0), 0);
    const comisionesPendientesUsd = comisiones.reduce((a, c) => a + Number(c.total_profesional_usd || 0), 0);
    const comisionesPendientesBs = comisiones.reduce((a, c) => a + Number(c.total_profesional_bs || 0), 0);
    return {
      ingresosUsd, ingresosBs, egresosUsd, egresosBs,
      utilidadUsd: ingresosUsd - egresosUsd, utilidadBs: ingresosBs - egresosBs,
      comisionesPendientesUsd, comisionesPendientesBs,
      flujoCajaUsd: ingresosUsd - egresosUsd - comisionesPendientesUsd,
      flujoCajaBs: ingresosBs - egresosBs - comisionesPendientesBs,
    };
  }, [movimientosFiltrados, comisiones]);

  const flujoPorDia = useMemo(() => {
    const byDate = new Map<string, { ingresos: number; egresos: number; saldo: number }>();
    movimientosFiltrados.filter((m) => m.estado === "pagado").forEach((m) => {
      const valor = monedaVista === "USD" ? m.monto_usd : m.monto_bs;
      const ex = byDate.get(m.fecha) || { ingresos: 0, egresos: 0, saldo: 0 };
      if (m.tipo === "ingreso") ex.ingresos += valor; else ex.egresos += valor;
      ex.saldo = ex.ingresos - ex.egresos;
      byDate.set(m.fecha, ex);
    });
    return Array.from(byDate.entries()).map(([fecha, data]) => ({
      label: shortDate(fecha), fecha,
      ingresos: Math.round(data.ingresos * 100) / 100,
      egresos: Math.round(data.egresos * 100) / 100,
      saldo: Math.round(data.saldo * 100) / 100,
    })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [movimientosFiltrados, monedaVista]);

  const acumuladoPorDia = useMemo(() => {
    let acc = 0;
    return flujoPorDia.map((d) => { acc += d.saldo; return { ...d, acumulado: Math.round(acc * 100) / 100 }; });
  }, [flujoPorDia]);

  const categoriasChart = useMemo(() => {
    const by = new Map<string, number>();
    movimientosFiltrados.filter((m) => m.estado === "pagado").forEach((m) => {
      const val = monedaVista === "USD" ? m.monto_usd : m.monto_bs;
      by.set(m.categoria, (by.get(m.categoria) || 0) + val);
    });
    return Array.from(by.entries()).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [movimientosFiltrados, monedaVista]);

  const porCategoria = useMemo(() => {
    const by = new Map<string, { categoria: string; ingresos: number; egresos: number }>();
    movimientosFiltrados.filter((m) => m.estado === "pagado").forEach((m) => {
      const val = monedaVista === "USD" ? m.monto_usd : m.monto_bs;
      const ex = by.get(m.categoria) || { categoria: m.categoria, ingresos: 0, egresos: 0 };
      if (m.tipo === "ingreso") ex.ingresos += val; else ex.egresos += val;
      by.set(m.categoria, ex);
    });
    return Array.from(by.values()).map((r) => ({ ...r, ingresos: Math.round(r.ingresos * 100) / 100, egresos: Math.round(r.egresos * 100) / 100 }));
  }, [movimientosFiltrados, monedaVista]);

  const egresosNomina = useMemo(() => {
    return egresos.filter((e) => e.categoria === "nomina" && e.estado === "pagado").filter((e) => {
      const monedaMetodo = normalizeMoneda(e.metodo_pago_v2?.moneda || e.metodo_pago_v2?.cartera?.moneda || e.moneda || "USD");
      const carteraCodigo = e.metodo_pago_v2?.cartera?.codigo || "";
      if (monedaFiltro !== "todas" && monedaMetodo !== normalizeMoneda(monedaFiltro)) return false;
      if (carteraFiltro !== "todas" && carteraCodigo !== carteraFiltro) return false;
      return true;
    }).map((e) => ({
      id: e.id, fecha: e.fecha, profesional: e.empleados?.nombre || e.proveedor || "—",
      concepto: e.concepto, moneda: e.moneda || "USD", monto: e.monto,
      equivalente_usd: Number(e.monto_equivalente_usd || 0), equivalente_bs: Number(e.monto_equivalente_bs || 0),
      cartera: e.metodo_pago_v2?.cartera?.nombre || "Sin cartera", metodo: e.metodo_pago_v2?.nombre || "—",
    }));
  }, [egresos, monedaFiltro, carteraFiltro]);

  const categoriasUnicas = useMemo(() => {
    const cats = new Set<string>();
    movimientos.forEach((m) => cats.add(m.categoria));
    return Array.from(cats).sort();
  }, [movimientos]);

  const carterasDisponibles = useMemo(() => {
    const map = new Map<string, { codigo: string; nombre: string; moneda: string }>();
    movimientos.forEach((m) => {
      if (!m.cartera_codigo) return;
      const monedaN = normalizeMoneda(m.moneda_metodo);
      if (monedaFiltro !== "todas" && monedaN !== normalizeMoneda(monedaFiltro)) return;
      if (!map.has(m.cartera_codigo)) map.set(m.cartera_codigo, { codigo: m.cartera_codigo, nombre: m.cartera, moneda: monedaN });
    });
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [movimientos, monedaFiltro]);

  type MonedaSeccion = "USD" | "BS";
  const getMontoMovimiento = (m: Movimiento, moneda: MonedaSeccion) => moneda === "USD" ? Number(m.monto_usd || 0) : Number(m.monto_bs || 0);

  function movimientoPerteneceASeccion(m: Movimiento, moneda: MonedaSeccion) {
    return getMonedaMetodoNormalizada(m.moneda_metodo) === moneda;
  }

  function movimientoCoincideConSubcartera(m: Movimiento, item: MetodoSubcartera) {
    if (m.metodo_id && item.id && m.metodo_id === item.id) return true;
    if (item.cartera_codigo && m.cartera_codigo !== item.cartera_codigo) return false;
    const metodoMov = normalizeText(m.metodo);
    const codigoMetodo = normalizeText(item.metodo_codigo);
    const nombreMetodo = normalizeText(item.metodo_nombre);
    return metodoMov === nombreMetodo || metodoMov === codigoMetodo || (!!metodoMov && !!nombreMetodo && metodoMov.includes(nombreMetodo)) || (!!metodoMov && !!nombreMetodo && nombreMetodo.includes(metodoMov));
  }

  function movimientoTieneSubcarteraRegistrada(m: Movimiento, moneda: MonedaSeccion) {
    return subcarteras.filter((item) => getMonedaMetodoNormalizada(item.moneda) === moneda).some((item) => movimientoCoincideConSubcartera(m, item));
  }

  function subcarterasVisiblesPorMoneda(moneda: MonedaSeccion) {
    const base = subcarteras.filter((item) => {
      if (getMonedaMetodoNormalizada(item.moneda) !== moneda) return false;
      return movimientos.some((m) => {
        if (m.estado !== "pagado" || m.tipo !== "ingreso") return false;
        if (!movimientoPerteneceASeccion(m, moneda)) return false;
        if (moneda === "USD" && Number(m.monto_usd || 0) <= 0) return false;
        if (moneda === "BS" && Number(m.monto_bs || 0) <= 0) return false;
        return movimientoCoincideConSubcartera(m, item);
      });
    });
    const hayMovimientosSinSubcartera = movimientos.some((m) => {
      if (m.estado !== "pagado" || m.tipo !== "ingreso") return false;
      if (!movimientoPerteneceASeccion(m, moneda)) return false;
      if (moneda === "USD" && Number(m.monto_usd || 0) <= 0) return false;
      if (moneda === "BS" && Number(m.monto_bs || 0) <= 0) return false;
      return !movimientoTieneSubcarteraRegistrada(m, moneda);
    });
    if (!hayMovimientosSinSubcartera) return base;
    const virtual: MetodoSubcartera = {
      id: `__sin_subcartera_${moneda}__`, metodo_nombre: "Sin método registrado",
      metodo_codigo: `SIN_METODO_${moneda}`, tipo: "sin método", moneda, saldo_actual: null,
      banco: null, numero_cuenta: null, activo: true, cartera_id: `__sin_subcartera_${moneda}__`,
      cartera_nombre: `Pagos ${moneda} sin subcartera`, cartera_codigo: `SIN_SUBCARTERA_${moneda}`,
      cartera_color: moneda === "USD" ? "#10b981" : "#f59e0b", cartera_icono: null,
    };
    return [...base, virtual];
  }

  function movimientosDeSubcartera(item: MetodoSubcartera, moneda: MonedaSeccion) {
    if (item.id.startsWith("__sin_subcartera_")) {
      return movimientos.filter((m) => {
        if (!movimientoPerteneceASeccion(m, moneda)) return false;
        if (moneda === "USD" && Number(m.monto_usd || 0) <= 0) return false;
        if (moneda === "BS" && Number(m.monto_bs || 0) <= 0) return false;
        return !movimientoTieneSubcarteraRegistrada(m, moneda);
      });
    }
    return movimientos.filter((m) => {
      if (!movimientoPerteneceASeccion(m, moneda)) return false;
      if (moneda === "USD" && Number(m.monto_usd || 0) <= 0) return false;
      if (moneda === "BS" && Number(m.monto_bs || 0) <= 0) return false;
      return movimientoCoincideConSubcartera(m, item);
    });
  }

  function resumenPeriodoSubcartera(item: MetodoSubcartera, moneda: MonedaSeccion) {
    const movsPagados = movimientosDeSubcartera(item, moneda).filter((m) => m.estado === "pagado");
    const resumen = movsPagados.reduce((acc, m) => {
      const valorUsd = Number(m.monto_usd || 0), valorBs = Number(m.monto_bs || 0);
      const valorPrincipal = moneda === "USD" ? valorUsd : valorBs;
      if (m.tipo === "ingreso") { acc.ingresos += valorPrincipal; acc.ingresosUsd += valorUsd; acc.ingresosBs += valorBs; }
      else { acc.egresos += valorPrincipal; acc.egresosUsd += valorUsd; acc.egresosBs += valorBs; }
      acc.saldo = acc.ingresos - acc.egresos; acc.saldoUsd = acc.ingresosUsd - acc.egresosUsd; acc.saldoBs = acc.ingresosBs - acc.egresosBs;
      return acc;
    }, { ingresos: 0, egresos: 0, saldo: 0, ingresosUsd: 0, ingresosBs: 0, egresosUsd: 0, egresosBs: 0, saldoUsd: 0, saldoBs: 0 });
    const tasaPromedio = resumen.ingresosUsd > 0 && resumen.ingresosBs > 0 ? resumen.ingresosBs / resumen.ingresosUsd : 0;
    return { ...resumen, tasaPromedio };
  }

  function totalIngresosSubcarteras(moneda: MonedaSeccion) {
    return subcarterasVisiblesPorMoneda(moneda).reduce((acc, item) => acc + resumenPeriodoSubcartera(item, moneda).ingresos, 0);
  }

  function setPaginaSubcartera(id: string, page: number) {
    setSubcarteraPaginas((prev) => ({ ...prev, [id]: Math.max(1, page) }));
  }

  function renderSubcarterasSection(moneda: "USD" | "BS") {
    const styles = getCurrencyStyles(moneda);
    const items = subcarterasVisiblesPorMoneda(moneda);
    const totalPeriodo = totalIngresosSubcarteras(moneda);
    const currency = moneda === "USD" ? "USD" : "VES";

    return (
      <div className="space-y-3">
        {/* Header strip */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
              Subcarteras {moneda}
            </span>
            <span className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/30">
              {fechaInicio} → {fechaFin}
            </span>
          </div>
          <div className={`rounded-xl border px-3.5 py-2 ${moneda === "USD" ? "border-emerald-500/15 bg-emerald-500/[0.06]" : "border-amber-500/15 bg-amber-500/[0.06]"}`}>
            <p className="text-[9px] font-medium uppercase tracking-widest text-white/30">Total período</p>
            <p className={`mt-0.5 text-base font-bold ${styles.accent}`}>{money(totalPeriodo, currency)}</p>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-5 text-center text-xs text-white/30">
            Sin subcarteras {moneda} con movimientos en este período
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => {
              const openKey = `${moneda}:${item.id}`;
              const abierta = subcarteraAbiertaId === openKey;
              const movs = movimientosDeSubcartera(item, moneda);
              const res = resumenPeriodoSubcartera(item, moneda);
              const paginaActual = subcarteraPaginas[openKey] || 1;
              const totalPaginas = Math.max(1, Math.ceil(movs.length / MOVIMIENTOS_POR_SUBCARTERA));
              const paginaSegura = Math.min(paginaActual, totalPaginas);
              const desdeMov = (paginaSegura - 1) * MOVIMIENTOS_POR_SUBCARTERA;
              const movsPagina = movs.slice(desdeMov, desdeMov + MOVIMIENTOS_POR_SUBCARTERA);

              return (
                <div
                  key={openKey}
                  className={`overflow-hidden rounded-xl border transition ${abierta ? `${moneda === "USD" ? "border-emerald-500/25 bg-emerald-500/[0.04]" : "border-amber-500/25 bg-amber-500/[0.04]"}` : "border-white/[0.06] bg-[#080b18] hover:border-white/10"}`}
                >
                  <button
                    type="button"
                    onClick={() => { setSubcarteraAbiertaId(abierta ? null : openKey); setPaginaSubcartera(openKey, 1); }}
                    className="w-full p-3.5 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] text-sm"
                        style={{ backgroundColor: item.cartera_color ? `${item.cartera_color}18` : "rgba(255,255,255,0.03)" }}
                      >
                        {getMetodoEmoji(item.metodo_codigo, moneda)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13px] font-semibold text-white">{item.metodo_nombre}</p>
                          {abierta && <Pill className={styles.badge}>activo</Pill>}
                        </div>
                        <p className="truncate text-[10px] text-white/30">{item.cartera_nombre}</p>
                      </div>
                      <Pill className={styles.badge}>{moneda}</Pill>
                    </div>

                    <div className="mt-3">
                      <p className="text-[9px] font-medium uppercase tracking-widest text-white/25">Ingresos del período</p>
                      <p className={`mt-1 text-lg font-bold ${styles.accent}`}>{money(res.ingresos, currency)}</p>
                      {moneda === "BS" && (
                        <div className="mt-1 space-y-0.5 text-[10px] text-white/30">
                          <span>{money(res.ingresosUsd, "USD")}</span>
                          {res.tasaPromedio > 0 && <span className="ml-2">· Bs {res.tasaPromedio.toLocaleString("es-VE", { maximumFractionDigits: 2 })}</span>}
                        </div>
                      )}
                      {moneda === "USD" && res.egresos > 0 && (
                        <p className="mt-0.5 text-[10px] text-white/30">Neto: {money(res.saldo, currency)}</p>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[10px] text-white/25">{item.tipo || "otro"} · {item.metodo_codigo}</span>
                      <span className="text-[10px] text-white/25">{movs.length} mov.</span>
                    </div>
                  </button>

                  {abierta && (
                    <div className="border-t border-white/[0.06] bg-black/20 px-3.5 pb-3.5 pt-3">
                      <div className="mb-2.5 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Movimientos</p>
                        {movs.length > 0 && (
                          <span className="text-[10px] text-white/25">
                            {desdeMov + 1}–{Math.min(desdeMov + MOVIMIENTOS_POR_SUBCARTERA, movs.length)} de {movs.length}
                          </span>
                        )}
                      </div>

                      {movs.length === 0 ? (
                        <p className="text-xs text-white/25">Sin movimientos en el período.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {movsPagina.map((m) => {
                            const valor = getMontoMovimiento(m, moneda);
                            const tasa = Number(m.monto_usd || 0) > 0 && Number(m.monto_bs || 0) > 0 ? Number(m.monto_bs) / Number(m.monto_usd) : 0;
                            return (
                              <div key={`${moneda}-${m.tipo}-${m.id}`} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1 mb-1">
                                      <Pill className={tipoBadge(m.tipo)}>{m.tipo}</Pill>
                                      <Pill className={estadoBadge(m.estado)}>{m.estado}</Pill>
                                      <span className="text-[9px] text-white/30">{shortDate(m.fecha)}</span>
                                    </div>
                                    <p className="truncate text-[11px] font-semibold text-white">{m.concepto || m.categoria}</p>
                                    <p className="truncate text-[10px] text-white/30">{m.tercero} · {m.categoria}</p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className={`text-[12px] font-bold ${m.tipo === "ingreso" ? styles.accent : "text-rose-400"}`}>
                                      {m.tipo === "egreso" ? "−" : "+"}{money(Math.abs(valor), currency)}
                                    </p>
                                    {moneda === "BS" && (
                                      <p className="text-[9px] text-white/25">{money(Number(m.monto_usd || 0), "USD")}{tasa > 0 ? ` · ${tasa.toLocaleString("es-VE", { maximumFractionDigits: 2 })}` : ""}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {movs.length > MOVIMIENTOS_POR_SUBCARTERA && (
                        <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.06] pt-2.5">
                          <button type="button" disabled={paginaSegura <= 1} onClick={(e) => { e.stopPropagation(); setPaginaSubcartera(openKey, paginaSegura - 1); }} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/40 transition hover:bg-white/[0.06] disabled:opacity-25">← Ant.</button>
                          <span className="text-[10px] text-white/25">{paginaSegura}/{totalPaginas}</span>
                          <button type="button" disabled={paginaSegura >= totalPaginas} onClick={(e) => { e.stopPropagation(); setPaginaSubcartera(openKey, paginaSegura + 1); }} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/40 transition hover:bg-white/[0.06] disabled:opacity-25">Sig. →</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const styles = getCurrencyStyles(monedaVista);
  const currency = monedaVista === "USD" ? "USD" : "VES";

  if (error) return (
    <Panel className="p-6">
      <p className="text-sm text-rose-400">{error}</p>
    </Panel>
  );

  const tooltipStyle = {
    background: "#070a14",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 12,
    color: "#fff",
    fontSize: 12,
  };

  return (
    <div className="space-y-5 pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">Finanzas</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white">Resumen Financiero</h1>
          <p className="mt-1 text-[11px] text-white/30">
            {fechaInicio} → {fechaFin}
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/cobranzas" className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2 text-[11px] font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white">
            <span>📊</span> Cobranzas
          </Link>
          <Link href="/admin/finanzas/inventario" className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3.5 py-2 text-[11px] font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white">
            <span>📦</span> Inventario
          </Link>
          <Link href="/admin/finanzas/ingresos" className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-3.5 py-2 text-[11px] font-semibold text-emerald-400 transition hover:bg-emerald-500/10">
            <span>＋</span> Ingreso
          </Link>
          <Link href="/admin/finanzas/egresos" className="flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] px-3.5 py-2 text-[11px] font-semibold text-rose-400 transition hover:bg-rose-500/10">
            <span>－</span> Egreso
          </Link>
        </div>
      </div>

      {/* ── Currency toggle ── */}
      <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-[#070a14] p-1 w-fit">
        {(["USD", "BS"] as const).map((m) => {
          const s = getCurrencyStyles(m);
          const active = monedaVista === m;
          return (
            <button key={m} type="button" onClick={() => setMonedaVista(m)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-semibold transition ${active ? `${m === "USD" ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20" : "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/20"}` : "text-white/35 hover:text-white/60"}`}
            >
              <span>{m === "USD" ? "💵" : "💰"}</span>
              <span>Resumen {m}</span>
            </button>
          );
        })}
      </div>

      {/* ── Subcarteras ── */}
      <Panel className="p-4 md:p-5">
        {renderSubcarterasSection(monedaVista)}
      </Panel>

      {/* ── Filtros ── */}
      <Panel className="p-4 md:p-5">
        <SectionHeader title="Filtros" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <Label>Desde</Label>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={inputCls} />
          </div>
          <div>
            <Label>Hasta</Label>
            <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className={inputCls} />
          </div>
          <div>
            <Label>Buscar</Label>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Concepto, cliente, cartera…" className={inputCls} />
          </div>
          <div>
            <Label>Tipo</Label>
            <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as any)} className={inputCls}>
              <option value="todos" className="bg-[#070a14]">Todos</option>
              <option value="ingreso" className="bg-[#070a14]">Ingresos</option>
              <option value="egreso" className="bg-[#070a14]">Egresos</option>
            </select>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <Label>Estado</Label>
            <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className={inputCls}>
              <option value="todos" className="bg-[#070a14]">Todos</option>
              <option value="pagado" className="bg-[#070a14]">Pagado</option>
              <option value="pendiente" className="bg-[#070a14]">Pendiente</option>
              <option value="anulado" className="bg-[#070a14]">Anulado</option>
            </select>
          </div>
          <div>
            <Label>Categoría</Label>
            <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className={inputCls}>
              <option value="todos" className="bg-[#070a14]">Todas</option>
              {categoriasUnicas.map((cat) => <option key={cat} value={cat} className="bg-[#070a14]">{cat}</option>)}
            </select>
          </div>
          <div>
            <Label>Moneda</Label>
            <select value={monedaFiltro} onChange={(e) => { setMonedaFiltro(e.target.value as any); setCarteraFiltro("todas"); }} className={inputCls}>
              <option value="todas" className="bg-[#070a14]">Todas</option>
              <option value="USD" className="bg-[#070a14]">USD</option>
              <option value="VES" className="bg-[#070a14]">VES / BS</option>
            </select>
          </div>
          <div>
            <Label>Cartera</Label>
            <select value={carteraFiltro} onChange={(e) => setCarteraFiltro(e.target.value)} className={inputCls}>
              <option value="todas" className="bg-[#070a14]">Todas</option>
              {carterasDisponibles.map((c) => <option key={c.codigo} value={c.codigo} className="bg-[#070a14]">{c.nombre} · {c.moneda}</option>)}
            </select>
          </div>
        </div>
      </Panel>

      {/* ── StatCards ── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          title={`Ingresos ${monedaVista}`}
          value={money(monedaVista === "USD" ? totales.ingresosUsd : totales.ingresosBs, currency)}
          color="text-emerald-400" icon="↑"
        />
        <StatCard
          title={`Egresos ${monedaVista}`}
          value={money(monedaVista === "USD" ? totales.egresosUsd : totales.egresosBs, currency)}
          color="text-rose-400" icon="↓"
        />
        <StatCard
          title={`Utilidad ${monedaVista}`}
          value={money(monedaVista === "USD" ? totales.utilidadUsd : totales.utilidadBs, currency)}
          color={(monedaVista === "USD" ? totales.utilidadUsd : totales.utilidadBs) >= 0 ? "text-emerald-400" : "text-rose-400"}
          icon="◎"
        />
        <StatCard
          title={`Flujo de caja ${monedaVista}`}
          value={money(monedaVista === "USD" ? totales.flujoCajaUsd : totales.flujoCajaBs, currency)}
          color={(monedaVista === "USD" ? totales.flujoCajaUsd : totales.flujoCajaBs) >= 0 ? "text-violet-400" : "text-amber-400"}
          icon="⟳"
        />
      </div>

      {/* ── Comisiones ── */}
      {comisiones.length > 0 && (
        <Panel className="p-4 md:p-5">
          <SectionHeader title="Comisiones pendientes" description="Compromiso con profesionales · afecta flujo de caja" />
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {comisiones.map((c) => (
              <div key={c.empleado_id} className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-[13px] font-semibold text-white truncate">{c.nombre}</p>
                  <span className="text-[10px] text-white/25 shrink-0">{c.cantidad} reg.</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-white/35">Base USD</span>
                    <span className="text-white/70">{money(c.total_base_usd)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/35">Base Bs</span>
                    <span className="text-white/70">{money(c.total_base_bs, "VES")}</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-white/[0.06] pt-2">
                    <span className="font-semibold text-emerald-400">Profesional USD</span>
                    <span className="font-bold text-emerald-400">{money(c.total_profesional_usd)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold text-amber-400">Profesional Bs</span>
                    <span className="font-bold text-amber-400">{money(c.total_profesional_bs, "VES")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── Nómina ── */}
      {egresosNomina.length > 0 && (
        <Panel>
          <div className="border-b border-white/[0.05] px-5 py-4">
            <SectionHeader title="Egresos por nómina" description="Pagos realizados al personal" />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px]">
              <thead className="border-b border-white/[0.05]">
                <tr className="text-left">
                  {["Fecha","Profesional","Concepto","Método","Cartera","Moneda","Monto","USD","Bs"].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold uppercase tracking-widest text-white/25">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {egresosNomina.map((e) => (
                  <tr key={e.id} className="transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-white/50">{e.fecha}</td>
                    <td className="px-4 py-3 font-medium text-white">{e.profesional}</td>
                    <td className="px-4 py-3 text-white/50">{e.concepto}</td>
                    <td className="px-4 py-3 text-white/50">{e.metodo}</td>
                    <td className="px-4 py-3 text-white/50">{e.cartera}</td>
                    <td className="px-4 py-3 text-white/50">{e.moneda}</td>
                    <td className="px-4 py-3 text-white/70">{money(e.monto, e.moneda === "VES" || e.moneda === "BS" ? "VES" : "USD")}</td>
                    <td className="px-4 py-3 text-emerald-400 font-medium">{money(e.equivalente_usd)}</td>
                    <td className="px-4 py-3 text-amber-400 font-medium">{money(e.equivalente_bs, "VES")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* ── Charts row 1 ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel className="p-4 md:p-5">
          <SectionHeader title={`Flujo acumulado (${monedaVista})`} description="Saldo acumulado día a día" />
          <div className="h-72">
            {acumuladoPorDia.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-white/25">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={acumuladoPorDia}>
                  <defs>
                    <linearGradient id="gradAcum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10 }} />
                  <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => money(Number(v), currency)} contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="acumulado" stroke="#a78bfa" strokeWidth={1.5} fill="url(#gradAcum)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel className="p-4 md:p-5">
          <SectionHeader title={`Ingresos vs Egresos (${monedaVista})`} description="Comparación diaria" />
          <div className="h-72">
            {flujoPorDia.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-white/25">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flujoPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10 }} />
                  <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v) => money(Number(v), currency)} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />
                  <Bar dataKey="ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="egresos" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      {/* ── Charts row 2 ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel className="p-4 md:p-5">
          <SectionHeader title={`Distribución por categoría (${monedaVista})`} description="Top 6 categorías · volumen total" />
          <div className="h-72">
            {categoriasChart.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-white/25">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoriasChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                    {categoriasChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => money(Number(v), currency)} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>

        <Panel className="p-4 md:p-5">
          <SectionHeader title={`Detalle por categoría (${monedaVista})`} description="Balance ingreso / egreso por categoría" />
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {porCategoria.length === 0 ? (
              <p className="text-xs text-white/25">Sin datos</p>
            ) : porCategoria.map((r) => (
              <div key={r.categoria} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                <p className="text-[12px] font-semibold text-white mb-2">{r.categoria}</p>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-white/25 mb-0.5">Ingresos</p>
                    <p className="font-semibold text-emerald-400">{money(r.ingresos, currency)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-white/25 mb-0.5">Egresos</p>
                    <p className="font-semibold text-rose-400">{money(r.egresos, currency)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-white/25 mb-0.5">Balance</p>
                    <p className={`font-bold ${r.ingresos - r.egresos >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {money(r.ingresos - r.egresos, currency)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── Movimientos table ── */}
      <Panel>
        <div className="border-b border-white/[0.05] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Movimientos</h2>
              <p className="mt-0.5 text-[11px] text-white/30">{movimientosFiltrados.length} registros en el período</p>
            </div>
            {loading && <span className="text-[10px] font-medium uppercase tracking-widest text-white/25 animate-pulse">Cargando…</span>}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px]">
            <thead className="border-b border-white/[0.05]">
              <tr className="text-left">
                {["Fecha","Tipo","Concepto","Categoría","Tercero","Método","Cartera","Estado","USD","Bs"].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold uppercase tracking-widest text-white/20">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-white/25">Cargando…</td></tr>
              ) : movimientosFiltrados.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-white/25">Sin movimientos para los filtros seleccionados</td></tr>
              ) : movimientosFiltrados.map((r) => (
                <tr key={`${r.tipo}-${r.id}`} className="transition hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white/40">{r.fecha}</td>
                  <td className="px-4 py-3"><Pill className={tipoBadge(r.tipo)}>{r.tipo}</Pill></td>
                  <td className="px-4 py-3 font-medium text-white">{r.concepto}</td>
                  <td className="px-4 py-3 text-white/40">{r.categoria}</td>
                  <td className="px-4 py-3 text-white/40">{r.tercero}</td>
                  <td className="px-4 py-3 text-white/40">{r.metodo}</td>
                  <td className="px-4 py-3 text-white/40">{r.cartera}</td>
                  <td className="px-4 py-3"><Pill className={estadoBadge(r.estado)}>{r.estado}</Pill></td>
                  <td className="px-4 py-3 font-semibold">
                    <span className={r.tipo === "ingreso" ? "text-emerald-400" : "text-rose-400"}>
                      {r.tipo === "ingreso" ? "+" : "−"}{money(r.monto_usd)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/40">{money(r.monto_bs, "VES")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

    </div>
  );
}