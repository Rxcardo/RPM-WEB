"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis,
  Tooltip, Legend, PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";

// ─── Types ───────────────────────────────────────────────────────────────────

type Pago = { id: string; fecha: string; concepto: string; categoria: string; monto: number; estado: string; tipo_origen: string; created_at?: string; moneda_pago: string | null; monto_equivalente_usd: number | null; monto_equivalente_bs: number | null; clientes: { nombre: string } | null; metodo_pago_v2?: { id?: string | null; nombre: string; moneda?: string | null; tipo?: string | null; cartera?: { nombre: string; codigo: string; moneda?: string | null } | null } | null };
type Egreso = { id: string; fecha: string; concepto: string; categoria: string; monto: number; estado: string; proveedor: string | null; created_at?: string; moneda: string | null; monto_equivalente_usd: number | null; monto_equivalente_bs: number | null; empleado_id: string | null; empleados?: { nombre: string } | null; metodo_pago_v2?: { id?: string | null; nombre: string; moneda?: string | null; tipo?: string | null; cartera?: { nombre: string; codigo: string; moneda?: string | null } | null } | null };
type MetodoSubcartera = { id: string; metodo_nombre: string; metodo_codigo: string; tipo: string | null; moneda: string; saldo_actual: number | null; banco: string | null; numero_cuenta: string | null; activo: boolean | null; cartera_id: string; cartera_nombre: string; cartera_codigo: string; cartera_color: string | null; cartera_icono: string | null };
type ComisionResumen = { empleado_id: string; nombre: string; total_base_usd: number; total_base_bs: number; total_profesional_usd: number; total_profesional_bs: number; total_rpm_usd: number; total_rpm_bs: number; cantidad: number };
type Movimiento = { id: string; fecha: string; tipo: "ingreso" | "egreso"; concepto: string; categoria: string; tercero: string; metodo_id: string; metodo: string; cartera: string; cartera_codigo: string; moneda_metodo: string; estado: string; moneda_origen: string; monto_usd: number; monto_bs: number; created_at?: string };
type PagoMetodoCambio = { id: string; pago_id: string; metodo_anterior_id: string | null; metodo_nuevo_id: string | null; metodo_anterior_nombre: string | null; metodo_nuevo_nombre: string | null; actor_email: string | null; actor_id: string | null; motivo: string | null; created_at: string; };

const PIE_COLORS = ["#38bdf8","#34d399","#f59e0b","#f87171","#a78bfa","#94a3b8"];
const MOVIMIENTOS_POR_SUBCARTERA = 10;
const MOV_PAGE_SIZE = 20;

function money(v: number, currency: "USD" | "VES" = "USD") {
  if (currency === "VES") return new Intl.NumberFormat("es-VE", { style: "currency", currency: "VES", maximumFractionDigits: 2 }).format(Number(v || 0));
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Number(v || 0));
}
function todayISO() { return new Date().toISOString().slice(0, 10); }
function firstDayOfMonthISO() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10); }
function shortDate(v: string) { try { return new Date(v).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit" }); } catch { return v; } }
function normalizeMoneda(m: string | null | undefined) { const s = (m || "").toUpperCase(); return s === "BS" ? "VES" : s; }
function normalizeText(v: string | null | undefined) { return String(v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""); }
function firstOrNull<T>(v: T | T[] | null | undefined): T | null { if (Array.isArray(v)) return v[0] ?? null; return v ?? null; }
function getMMN(v: string | null | undefined) { const m = normalizeMoneda(v); return m === "VES" ? "BS" : m === "USD" ? "USD" : "USD"; }

function normalizePago(row: any): Pago {
  const c = firstOrNull(row?.clientes); const mt = firstOrNull(row?.metodo_pago_v2); const ca = firstOrNull(mt?.cartera);
  return { id: String(row?.id??""), fecha: String(row?.fecha??""), concepto: String(row?.concepto??""), categoria: String(row?.categoria??""), monto: Number(row?.monto||0), estado: String(row?.estado??""), tipo_origen: String(row?.tipo_origen??""), created_at: row?.created_at, moneda_pago: row?.moneda_pago??null, monto_equivalente_usd: row?.monto_equivalente_usd!=null?Number(row.monto_equivalente_usd):null, monto_equivalente_bs: row?.monto_equivalente_bs!=null?Number(row.monto_equivalente_bs):null, clientes: c?{nombre:String(c?.nombre??"")}:null, metodo_pago_v2: mt?{id:mt?.id?String(mt.id):null,nombre:String(mt?.nombre??""),moneda:mt?.moneda??null,tipo:mt?.tipo??null,cartera:ca?{nombre:String(ca?.nombre??""),codigo:String(ca?.codigo??""),moneda:ca?.moneda??null}:null}:null };
}
function normalizeEgreso(row: any): Egreso {
  const e = firstOrNull(row?.empleados); const mt = firstOrNull(row?.metodo_pago_v2); const ca = firstOrNull(mt?.cartera);
  return { id: String(row?.id??""), fecha: String(row?.fecha??""), concepto: String(row?.concepto??""), categoria: String(row?.categoria??""), monto: Number(row?.monto||0), estado: String(row?.estado??""), proveedor: row?.proveedor??null, created_at: row?.created_at, moneda: row?.moneda??null, monto_equivalente_usd: row?.monto_equivalente_usd!=null?Number(row.monto_equivalente_usd):null, monto_equivalente_bs: row?.monto_equivalente_bs!=null?Number(row.monto_equivalente_bs):null, empleado_id: row?.empleado_id??null, empleados: e?{nombre:String(e?.nombre??"")}:null, metodo_pago_v2: mt?{id:mt?.id?String(mt.id):null,nombre:String(mt?.nombre??""),moneda:mt?.moneda??null,tipo:mt?.tipo??null,cartera:ca?{nombre:String(ca?.nombre??""),codigo:String(ca?.codigo??""),moneda:ca?.moneda??null}:null}:null };
}
function getMetodoEmoji(codigo: string, moneda: string) {
  const k = `${codigo} ${moneda}`.toLowerCase();
  if (k.includes("zelle")) return "💸"; if (k.includes("binance")) return "🟡"; if (k.includes("paypal")) return "🅿️";
  if (k.includes("pago_movil")) return "📲"; if (k.includes("punto_venta")) return "💳"; if (k.includes("transferencia")) return "🏦";
  if (k.includes("efectivo") && moneda==="USD") return "💵"; if (k.includes("efectivo")) return "💰";
  return moneda==="USD"?"💵":"💰";
}

// ─── Design tokens ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-white/30">{children}</p>;
}
function GhostBtn({ children, onClick, disabled, className="" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/65 transition hover:bg-white/[0.07] hover:text-white/90 disabled:opacity-40 ${className}`}>{children}</button>;
}
function Divider() { return <div className="h-px w-full bg-white/[0.06]" />; }
function Panel({ children, className="" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#080b18] ${className}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {children}
    </div>
  );
}
function MetricTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/35">{label}</p>
      <p className={`text-2xl font-bold tabular-nums tracking-tight ${accent??"text-white"}`}>{value}</p>
      {sub && <p className="text-[11px] text-white/40">{sub}</p>}
    </div>
  );
}
function Pill({ children, color="white" }: { children: ReactNode; color?: string }) {
  const map: Record<string,string> = { white:"border-white/10 bg-white/[0.06] text-white/60", emerald:"border-emerald-400/20 bg-emerald-400/10 text-emerald-300", rose:"border-rose-400/20 bg-rose-400/10 text-rose-300", amber:"border-amber-400/20 bg-amber-400/10 text-amber-300", violet:"border-violet-400/20 bg-violet-400/10 text-violet-300", sky:"border-sky-400/20 bg-sky-400/10 text-sky-300", orange:"border-orange-400/20 bg-orange-400/10 text-orange-300" };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[color]??map.white}`}>{children}</span>;
}
const estadoPill = (e: string) => e==="pagado"?<Pill color="emerald">pagado</Pill>:e==="anulado"?<Pill color="rose">anulado</Pill>:e==="pendiente"?<Pill color="amber">pendiente</Pill>:<Pill>{e}</Pill>;
const tipoPill = (t: "ingreso"|"egreso") => t==="ingreso"?<Pill color="sky">ingreso</Pill>:<Pill color="orange">egreso</Pill>;

function MonedaToggle({ value, onChange }: { value: "USD"|"BS"; onChange: (v: "USD"|"BS") => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
      {(["USD","BS"] as const).map((m) => (
        <button key={m} type="button" onClick={() => onChange(m)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${value===m?m==="USD"?"bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25":"bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/25":"text-white/35 hover:text-white/60"}`}>
          {m==="USD"?"💵":"💰"} {m}
        </button>
      ))}
    </div>
  );
}

function SubcarteraCard({ item, moneda, open, onToggle, movimientos: movs, resumen, pagina, totalPaginas, onPaginaChange }: {
  item: MetodoSubcartera; moneda: "USD"|"BS"; open: boolean; onToggle: () => void;
  movimientos: Movimiento[]; resumen: { ingresos: number; egresos: number; saldo: number; ingresosUsd: number; tasaPromedio: number };
  pagina: number; totalPaginas: number; onPaginaChange: (p: number) => void;
}) {
  const currency = moneda==="USD"?"USD":"VES";
  const acCls = moneda==="USD"?"text-emerald-400":"text-amber-400";
  const borderActive = moneda==="USD"?"border-emerald-400/20 bg-emerald-400/[0.03]":"border-amber-400/20 bg-amber-400/[0.03]";
  const desde = (pagina-1)*MOVIMIENTOS_POR_SUBCARTERA;
  const movsPag = movs.slice(desde, desde+MOVIMIENTOS_POR_SUBCARTERA);
  return (
    <div className={`overflow-hidden rounded-xl border transition-colors ${open?borderActive:"border-white/[0.06] bg-white/[0.02] hover:border-white/10"}`}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] text-sm" style={{ backgroundColor: item.cartera_color?`${item.cartera_color}18`:"rgba(255,255,255,0.03)" }}>
          {getMetodoEmoji(item.metodo_codigo, moneda)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{item.metodo_nombre}</p>
          <p className="truncate text-[11px] text-white/35">{item.cartera_nombre} · {movs.length} mov.</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-bold tabular-nums ${acCls}`}>{money(resumen.ingresos, currency)}</p>
          {moneda==="BS"&&resumen.tasaPromedio>0&&<p className="text-[10px] text-white/25">{money(resumen.ingresosUsd,"USD")}</p>}
        </div>
        <span className="shrink-0 text-[10px] text-white/25">{open?"−":"+"}</span>
      </button>
      {open&&(
        <div className="border-t border-white/[0.06] px-4 pb-4 pt-3">
          <div className="mb-3 grid grid-cols-3 gap-2">
            {[{l:"Ingresos",v:money(resumen.ingresos,currency),c:acCls},{l:"Egresos",v:money(resumen.egresos,currency),c:"text-rose-400"},{l:"Neto",v:money(resumen.saldo,currency),c:resumen.saldo>=0?acCls:"text-rose-400"}].map((s) => (
              <div key={s.l} className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2">
                <p className="text-[9px] uppercase tracking-widest text-white/25">{s.l}</p>
                <p className={`mt-1 text-[13px] font-bold tabular-nums ${s.c}`}>{s.v}</p>
              </div>
            ))}
          </div>
          <Divider />
          <div className="mt-3 space-y-1">
            {movs.length===0?<p className="text-xs text-white/25">Sin movimientos.</p>:movsPag.map((m) => {
              const valor = moneda==="USD"?Number(m.monto_usd||0):Number(m.monto_bs||0);
              return (
                <div key={`${moneda}-${m.tipo}-${m.id}`} className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.03]">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">{tipoPill(m.tipo)}{estadoPill(m.estado)}<span className="text-[10px] text-white/25">{shortDate(m.fecha)}</span></div>
                    <p className="truncate text-xs font-medium text-white">{m.concepto||m.categoria}</p>
                    <p className="truncate text-[11px] text-white/35">{m.tercero} · {m.categoria}</p>
                  </div>
                  <p className={`shrink-0 text-sm font-bold tabular-nums ${m.tipo==="ingreso"?acCls:"text-rose-400"}`}>{m.tipo==="egreso"?"−":"+"}{money(Math.abs(valor),currency)}</p>
                </div>
              );
            })}
          </div>
          {movs.length>MOVIMIENTOS_POR_SUBCARTERA&&(
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[11px] text-white/25">{pagina}/{totalPaginas}</p>
              <div className="flex gap-1">
                <GhostBtn onClick={() => onPaginaChange(pagina-1)} disabled={pagina<=1}>←</GhostBtn>
                <GhostBtn onClick={() => onPaginaChange(pagina+1)} disabled={pagina>=totalPaginas}>→</GhostBtn>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const tooltipStyle = { background:"#070a14", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, color:"#fff", fontSize:11 };

export default function FinanzasResumenPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fechaInicio, setFechaInicio] = useState(firstDayOfMonthISO());
  const [fechaFin, setFechaFin] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"todos"|"ingreso"|"egreso">("todos");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todos");
  const [monedaFiltro, setMonedaFiltro] = useState<"todas"|"USD"|"VES"|"BS">("todas");
  const [carteraFiltro, setCarteraFiltro] = useState("todas");
  const [movPage, setMovPage] = useState(1);
  const [monedaVista, setMonedaVista] = useState<"USD"|"BS">("USD");
  const [subcarteraAbiertaId, setSubcarteraAbiertaId] = useState<string|null>(null);
  const [subcarteraPaginas, setSubcarteraPaginas] = useState<Record<string,number>>({});
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [egresos, setEgresos] = useState<Egreso[]>([]);
  const [subcarteras, setSubcarteras] = useState<MetodoSubcartera[]>([]);
  const [comisiones, setComisiones] = useState<ComisionResumen[]>([]);
  const [metodoCambios, setMetodoCambios] = useState<PagoMetodoCambio[]>([]);
  const [editingMovimiento, setEditingMovimiento] = useState<Movimiento | null>(null);
  const [editMetodoId, setEditMetodoId] = useState("");
  const [editMotivo, setEditMotivo] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { void loadFinanzas(); }, [fechaInicio, fechaFin]);
  useEffect(() => { setSubcarteraAbiertaId(null); setSubcarteraPaginas({}); }, [monedaVista, fechaInicio, fechaFin]);

  async function loadFinanzas() {
    try {
      setLoading(true); setError("");
      const [pagosRes, egresosRes, comisionesRes, subcarterasRes, cambiosRes] = await Promise.all([
        supabase.from("pagos").select(`id,fecha,concepto,categoria,monto,estado,tipo_origen,created_at,moneda_pago,monto_equivalente_usd,monto_equivalente_bs,clientes:cliente_id(nombre),metodo_pago_v2:metodo_pago_v2_id(id,nombre,moneda,tipo,cartera:cartera_id(nombre,codigo,moneda))`).gte("fecha",fechaInicio).lte("fecha",fechaFin).order("fecha",{ascending:false}).order("created_at",{ascending:false}),
        supabase.from("egresos").select(`id,fecha,concepto,categoria,monto,estado,proveedor,created_at,moneda,monto_equivalente_usd,monto_equivalente_bs,empleado_id,empleados:empleado_id(nombre),metodo_pago_v2:metodo_pago_v2_id(id,nombre,moneda,tipo,cartera:cartera_id(nombre,codigo,moneda))`).gte("fecha",fechaInicio).lte("fecha",fechaFin).order("fecha",{ascending:false}).order("created_at",{ascending:false}),
        supabase.from("comisiones_detalle").select(`empleado_id,monto_base_usd,monto_base_bs,monto_profesional_usd,monto_profesional_bs,monto_rpm_usd,monto_rpm_bs,empleados:empleado_id(nombre)`).gte("fecha",fechaInicio).lte("fecha",fechaFin).eq("estado","pendiente"),
        supabase.from("v_metodos_pago_completo").select(`id,metodo_nombre,metodo_codigo,tipo,moneda,saldo_actual,banco,numero_cuenta,activo,cartera_id,cartera_nombre,cartera_codigo,cartera_color,cartera_icono`).order("moneda",{ascending:true}).order("cartera_nombre",{ascending:true}).order("metodo_nombre",{ascending:true}),
        supabase.from("pagos_metodo_cambios").select(`id,pago_id,metodo_anterior_id,metodo_nuevo_id,metodo_anterior_nombre,metodo_nuevo_nombre,actor_email,actor_id,motivo,created_at`).order("created_at",{ascending:false}).limit(300),
      ]);
      if (pagosRes.error) throw pagosRes.error; if (egresosRes.error) throw egresosRes.error; if (comisionesRes.error) throw comisionesRes.error; if (subcarterasRes.error) throw subcarterasRes.error;
      setPagos(((pagosRes.data||[]) as any[]).map(normalizePago));
      setEgresos(((egresosRes.data||[]) as any[]).map(normalizeEgreso));
      setSubcarteras((subcarterasRes.data||[]) as MetodoSubcartera[]);
      setMetodoCambios(cambiosRes.error ? [] : ((cambiosRes.data||[]) as PagoMetodoCambio[]));
      const grouped = new Map<string,ComisionResumen>();
      ((comisionesRes.data||[]) as any[]).forEach((c:any) => {
        const nombre = firstOrNull(c?.empleados)?.nombre||"Sin nombre"; const key=String(c.empleado_id); const ex=grouped.get(key);
        if(ex){ex.total_base_usd+=Number(c.monto_base_usd||0);ex.total_base_bs+=Number(c.monto_base_bs||0);ex.total_profesional_usd+=Number(c.monto_profesional_usd||0);ex.total_profesional_bs+=Number(c.monto_profesional_bs||0);ex.total_rpm_usd+=Number(c.monto_rpm_usd||0);ex.total_rpm_bs+=Number(c.monto_rpm_bs||0);ex.cantidad+=1;}
        else{grouped.set(key,{empleado_id:key,nombre,total_base_usd:Number(c.monto_base_usd||0),total_base_bs:Number(c.monto_base_bs||0),total_profesional_usd:Number(c.monto_profesional_usd||0),total_profesional_bs:Number(c.monto_profesional_bs||0),total_rpm_usd:Number(c.monto_rpm_usd||0),total_rpm_bs:Number(c.monto_rpm_bs||0),cantidad:1});}
      });
      setComisiones(Array.from(grouped.values()));
    } catch(err:any){setError(err?.message||"Error cargando finanzas.");}
    finally{setLoading(false);}
  }

  const movimientos = useMemo(() => {
    const ing: Movimiento[] = pagos.map((p) => ({id:p.id,fecha:p.fecha,tipo:"ingreso",concepto:p.concepto,categoria:p.categoria,tercero:p.clientes?.nombre||"—",metodo_id:p.metodo_pago_v2?.id||"",metodo:p.metodo_pago_v2?.nombre||"—",cartera:p.metodo_pago_v2?.cartera?.nombre||"Sin cartera",cartera_codigo:p.metodo_pago_v2?.cartera?.codigo||"",moneda_metodo:(p.metodo_pago_v2?.moneda||p.metodo_pago_v2?.cartera?.moneda||p.moneda_pago||"USD").toUpperCase(),estado:p.estado,moneda_origen:p.moneda_pago||"USD",monto_usd:Number(p.monto_equivalente_usd||0),monto_bs:Number(p.monto_equivalente_bs||0),created_at:p.created_at}));
    const egs: Movimiento[] = egresos.map((e) => ({id:e.id,fecha:e.fecha,tipo:"egreso",concepto:e.concepto,categoria:e.categoria,tercero:e.empleados?.nombre||e.proveedor||"—",metodo_id:e.metodo_pago_v2?.id||"",metodo:e.metodo_pago_v2?.nombre||"—",cartera:e.metodo_pago_v2?.cartera?.nombre||"Sin cartera",cartera_codigo:e.metodo_pago_v2?.cartera?.codigo||"",moneda_metodo:(e.metodo_pago_v2?.moneda||e.metodo_pago_v2?.cartera?.moneda||e.moneda||"USD").toUpperCase(),estado:e.estado,moneda_origen:e.moneda||"USD",monto_usd:Number(e.monto_equivalente_usd||0),monto_bs:Number(e.monto_equivalente_bs||0),created_at:e.created_at}));
    return [...ing,...egs].sort((a,b)=>new Date(`${b.fecha}T${b.created_at||"00:00"}`).getTime()-new Date(`${a.fecha}T${a.created_at||"00:00"}`).getTime());
  },[pagos,egresos]);

  const movimientosFiltrados = useMemo(() => movimientos.filter((m) => {
    if(tipoFiltro!=="todos"&&m.tipo!==tipoFiltro) return false;
    if(estadoFiltro!=="todos"&&m.estado!==estadoFiltro) return false;
    if(categoriaFiltro!=="todos"&&m.categoria!==categoriaFiltro) return false;
    if(monedaFiltro!=="todas"&&normalizeMoneda(m.moneda_metodo)!==normalizeMoneda(monedaFiltro)) return false;
    if(carteraFiltro!=="todas"&&m.cartera_codigo!==carteraFiltro) return false;
    if(search){const s=search.toLowerCase();return m.concepto.toLowerCase().includes(s)||m.tercero.toLowerCase().includes(s)||m.categoria.toLowerCase().includes(s)||m.metodo.toLowerCase().includes(s)||m.cartera.toLowerCase().includes(s);}
    return true;
  }),[movimientos,tipoFiltro,estadoFiltro,categoriaFiltro,monedaFiltro,carteraFiltro,search]);

  const totales = useMemo(() => {
    const pagados = movimientosFiltrados.filter((m) => m.estado==="pagado");
    const iU=pagados.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.monto_usd,0);
    const iB=pagados.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.monto_bs,0);
    const eU=pagados.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.monto_usd,0);
    const eB=pagados.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.monto_bs,0);
    const cpU=comisiones.reduce((a,c)=>a+c.total_profesional_usd,0);
    const cpB=comisiones.reduce((a,c)=>a+c.total_profesional_bs,0);
    return {ingresosUsd:iU,ingresosBs:iB,egresosUsd:eU,egresosBs:eB,utilidadUsd:iU-eU,utilidadBs:iB-eB,comisionesPendientesUsd:cpU,comisionesPendientesBs:cpB,flujoCajaUsd:iU-eU-cpU,flujoCajaBs:iB-eB-cpB};
  },[movimientosFiltrados,comisiones]);

  const flujoPorDia = useMemo(() => {
    const byDate = new Map<string,{ingresos:number;egresos:number;saldo:number}>();
    movimientosFiltrados.filter(m=>m.estado==="pagado").forEach((m) => {
      const v=monedaVista==="USD"?m.monto_usd:m.monto_bs;
      const ex=byDate.get(m.fecha)||{ingresos:0,egresos:0,saldo:0};
      if(m.tipo==="ingreso")ex.ingresos+=v;else ex.egresos+=v;
      ex.saldo=ex.ingresos-ex.egresos;byDate.set(m.fecha,ex);
    });
    return Array.from(byDate.entries()).map(([fecha,d])=>({label:shortDate(fecha),fecha,ingresos:Math.round(d.ingresos*100)/100,egresos:Math.round(d.egresos*100)/100,saldo:Math.round(d.saldo*100)/100})).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  },[movimientosFiltrados,monedaVista]);

  const acumuladoPorDia = useMemo(() => { let acc=0; return flujoPorDia.map(d=>{acc+=d.saldo;return{...d,acumulado:Math.round(acc*100)/100};}); },[flujoPorDia]);

  const categoriasChart = useMemo(() => {
    const by=new Map<string,number>();
    movimientosFiltrados.filter(m=>m.estado==="pagado").forEach(m=>{const v=monedaVista==="USD"?m.monto_usd:m.monto_bs;by.set(m.categoria,(by.get(m.categoria)||0)+v);});
    return Array.from(by.entries()).map(([name,value])=>({name,value:Math.round(value*100)/100})).sort((a,b)=>b.value-a.value).slice(0,6);
  },[movimientosFiltrados,monedaVista]);

  const porCategoria = useMemo(() => {
    const by=new Map<string,{categoria:string;ingresos:number;egresos:number}>();
    movimientosFiltrados.filter(m=>m.estado==="pagado").forEach(m=>{const v=monedaVista==="USD"?m.monto_usd:m.monto_bs;const ex=by.get(m.categoria)||{categoria:m.categoria,ingresos:0,egresos:0};if(m.tipo==="ingreso")ex.ingresos+=v;else ex.egresos+=v;by.set(m.categoria,ex);});
    return Array.from(by.values()).map(r=>({...r,ingresos:Math.round(r.ingresos*100)/100,egresos:Math.round(r.egresos*100)/100}));
  },[movimientosFiltrados,monedaVista]);

  const egresosNomina = useMemo(() => egresos.filter(e=>e.categoria==="nomina"&&e.estado==="pagado").filter(e=>{
    const mm=normalizeMoneda(e.metodo_pago_v2?.moneda||e.metodo_pago_v2?.cartera?.moneda||e.moneda||"USD");
    const cc=e.metodo_pago_v2?.cartera?.codigo||"";
    if(monedaFiltro!=="todas"&&mm!==normalizeMoneda(monedaFiltro))return false;
    if(carteraFiltro!=="todas"&&cc!==carteraFiltro)return false;
    return true;
  }).map(e=>({id:e.id,fecha:e.fecha,profesional:e.empleados?.nombre||e.proveedor||"—",concepto:e.concepto,moneda:e.moneda||"USD",monto:e.monto,equivalente_usd:Number(e.monto_equivalente_usd||0),equivalente_bs:Number(e.monto_equivalente_bs||0),cartera:e.metodo_pago_v2?.cartera?.nombre||"Sin cartera",metodo:e.metodo_pago_v2?.nombre||"—"})),[egresos,monedaFiltro,carteraFiltro]);

  const categoriasUnicas = useMemo(()=>{const c=new Set<string>();movimientos.forEach(m=>c.add(m.categoria));return Array.from(c).sort();},[movimientos]);
  const carterasDisponibles = useMemo(()=>{
    const map=new Map<string,{codigo:string;nombre:string;moneda:string}>();
    movimientos.forEach(m=>{if(!m.cartera_codigo)return;const mn=normalizeMoneda(m.moneda_metodo);if(monedaFiltro!=="todas"&&mn!==normalizeMoneda(monedaFiltro))return;if(!map.has(m.cartera_codigo))map.set(m.cartera_codigo,{codigo:m.cartera_codigo,nombre:m.cartera,moneda:mn});});
    return Array.from(map.values()).sort((a,b)=>a.nombre.localeCompare(b.nombre));
  },[movimientos,monedaFiltro]);

  type MonedaSeccion = "USD"|"BS";
  const movimientoPerteneceASeccion = (m: Movimiento, moneda: MonedaSeccion) => getMMN(m.moneda_metodo)===moneda;
  const movimientoCoincideConSubcartera = (m: Movimiento, item: MetodoSubcartera) => {
    if(m.metodo_id&&item.id&&m.metodo_id===item.id)return true;
    if(item.cartera_codigo&&m.cartera_codigo!==item.cartera_codigo)return false;
    const mm=normalizeText(m.metodo),cm=normalizeText(item.metodo_codigo),nm=normalizeText(item.metodo_nombre);
    return mm===nm||mm===cm||(!!mm&&!!nm&&mm.includes(nm))||(!!mm&&!!nm&&nm.includes(mm));
  };
  const movimientoTieneSubcarteraRegistrada = (m: Movimiento, moneda: MonedaSeccion) => subcarteras.filter(item=>getMMN(item.moneda)===moneda).some(item=>movimientoCoincideConSubcartera(m,item));
  const subcarterasVisiblesPorMoneda = (moneda: MonedaSeccion) => {
    const base=subcarteras.filter(item=>{
      if(getMMN(item.moneda)!==moneda)return false;
      return movimientos.some(m=>{if(m.estado!=="pagado"||m.tipo!=="ingreso")return false;if(!movimientoPerteneceASeccion(m,moneda))return false;if(moneda==="USD"&&Number(m.monto_usd||0)<=0)return false;if(moneda==="BS"&&Number(m.monto_bs||0)<=0)return false;return movimientoCoincideConSubcartera(m,item);});
    });
    const haySin=movimientos.some(m=>{if(m.estado!=="pagado"||m.tipo!=="ingreso")return false;if(!movimientoPerteneceASeccion(m,moneda))return false;if(moneda==="USD"&&Number(m.monto_usd||0)<=0)return false;if(moneda==="BS"&&Number(m.monto_bs||0)<=0)return false;return!movimientoTieneSubcarteraRegistrada(m,moneda);});
    if(!haySin)return base;
    const v:MetodoSubcartera={id:`__sin_subcartera_${moneda}__`,metodo_nombre:"Sin método registrado",metodo_codigo:`SIN_METODO_${moneda}`,tipo:"sin método",moneda,saldo_actual:null,banco:null,numero_cuenta:null,activo:true,cartera_id:`__sin_subcartera_${moneda}__`,cartera_nombre:`Pagos ${moneda} sin subcartera`,cartera_codigo:`SIN_SUBCARTERA_${moneda}`,cartera_color:moneda==="USD"?"#10b981":"#f59e0b",cartera_icono:null};
    return [...base,v];
  };
  const movimientosDeSubcartera = (item: MetodoSubcartera, moneda: MonedaSeccion) => {
    if(item.id.startsWith("__sin_subcartera_"))return movimientos.filter(m=>{if(!movimientoPerteneceASeccion(m,moneda))return false;if(moneda==="USD"&&Number(m.monto_usd||0)<=0)return false;if(moneda==="BS"&&Number(m.monto_bs||0)<=0)return false;return!movimientoTieneSubcarteraRegistrada(m,moneda);});
    return movimientos.filter(m=>{if(!movimientoPerteneceASeccion(m,moneda))return false;if(moneda==="USD"&&Number(m.monto_usd||0)<=0)return false;if(moneda==="BS"&&Number(m.monto_bs||0)<=0)return false;return movimientoCoincideConSubcartera(m,item);});
  };
  const resumenPeriodoSubcartera = (item: MetodoSubcartera, moneda: MonedaSeccion) => {
    const mp=movimientosDeSubcartera(item,moneda).filter(m=>m.estado==="pagado");
    const res=mp.reduce((acc,m)=>{const vU=Number(m.monto_usd||0),vB=Number(m.monto_bs||0),vP=moneda==="USD"?vU:vB;if(m.tipo==="ingreso"){acc.ingresos+=vP;acc.ingresosUsd+=vU;acc.ingresosBs+=vB;}else acc.egresos+=vP;acc.saldo=acc.ingresos-acc.egresos;return acc;},{ingresos:0,egresos:0,saldo:0,ingresosUsd:0,ingresosBs:0});
    return {...res,tasaPromedio:res.ingresosUsd>0&&res.ingresosBs>0?res.ingresosBs/res.ingresosUsd:0};
  };
  const totalIngresosSubcarteras = (moneda: MonedaSeccion) => subcarterasVisiblesPorMoneda(moneda).reduce((acc,item)=>acc+resumenPeriodoSubcartera(item,moneda).ingresos,0);
  const setPaginaSubcartera = (id: string, p: number) => setSubcarteraPaginas(prev=>({...prev,[id]:Math.max(1,p)}));



  const ultimoCambioPorPago = useMemo(() => {
    const map = new Map<string, PagoMetodoCambio>();
    metodoCambios.forEach((c) => {
      if (!map.has(c.pago_id)) map.set(c.pago_id, c);
    });
    return map;
  }, [metodoCambios]);

  const metodosEditables = useMemo(() => {
    return subcarteras
      .filter((m) => m.activo !== false && !String(m.id || "").startsWith("__"))
      .sort((a, b) => `${a.moneda}-${a.cartera_nombre}-${a.metodo_nombre}`.localeCompare(`${b.moneda}-${b.cartera_nombre}-${b.metodo_nombre}`));
  }, [subcarteras]);

  function abrirEditorMetodo(mov: Movimiento) {
    if (mov.tipo !== "ingreso") return;
    setEditingMovimiento(mov);
    setEditMetodoId(mov.metodo_id || "");
    setEditMotivo("Corrección de destino del abono");
  }

  function cerrarEditorMetodo() {
    if (editSaving) return;
    setEditingMovimiento(null);
    setEditMetodoId("");
    setEditMotivo("");
  }

  async function guardarCambioMetodoPago() {
    if (!editingMovimiento) return;
    if (editingMovimiento.tipo !== "ingreso") return;
    if (!editMetodoId || editMetodoId === editingMovimiento.metodo_id) return;

    try {
      setEditSaving(true);
      setError("");

      const metodoNuevo = metodosEditables.find((m) => m.id === editMetodoId) || null;
      const metodoAnterior = subcarteras.find((m) => m.id === editingMovimiento.metodo_id) || null;

      const { data: userData } = await supabase.auth.getUser();
      const actorId = userData?.user?.id || null;
      const actorEmail = userData?.user?.email || null;

      const upd = await supabase
        .from("pagos")
        .update({ metodo_pago_v2_id: editMetodoId })
        .eq("id", editingMovimiento.id);

      if (upd.error) throw upd.error;

      const ins = await supabase.from("pagos_metodo_cambios").insert({
        pago_id: editingMovimiento.id,
        metodo_anterior_id: editingMovimiento.metodo_id || null,
        metodo_nuevo_id: editMetodoId,
        metodo_anterior_nombre: metodoAnterior?.metodo_nombre || editingMovimiento.metodo || null,
        metodo_nuevo_nombre: metodoNuevo?.metodo_nombre || null,
        actor_id: actorId,
        actor_email: actorEmail,
        motivo: editMotivo || "Corrección de destino del abono",
      });

      if (ins.error) throw ins.error;

      await loadFinanzas();
      setEditingMovimiento(null);
      setEditMetodoId("");
      setEditMotivo("");
    } catch (err: any) {
      setError(err?.message || "No se pudo cambiar el destino del abono.");
    } finally {
      setEditSaving(false);
    }
  }

  const currency = monedaVista==="USD"?"USD":"VES";
  const accentClass = monedaVista==="USD"?"text-emerald-400":"text-amber-400";

  if(error) return <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 px-4 py-3"><p className="text-sm text-rose-400">{error}</p></div>;

  return (
    <div className="min-h-screen space-y-8 px-4 pb-12 md:px-6">

      {/* Header */}
      <div className="flex flex-col gap-5 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-white/30">Finanzas</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-3xl">Resumen financiero</h1>
          <p className="mt-1 text-sm text-white/35">{fechaInicio} → {fechaFin}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/cobranzas" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.07]">📊 Cobranzas</Link>
          <Link href="/admin/finanzas/inventario" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.07]">📦 Inventario</Link>
          <Link href="/admin/finanzas/ingresos" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/15">+ Ingreso</Link>
          <Link href="/admin/finanzas/egresos" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/15">− Egreso</Link>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <MonedaToggle value={monedaVista} onChange={setMonedaVista} />
        <div className="flex items-center gap-2">
          <input type="date" value={fechaInicio} onChange={(e)=>setFechaInicio(e.target.value)} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-white outline-none focus:border-white/15" />
          <span className="text-xs text-white/25">→</span>
          <input type="date" value={fechaFin} onChange={(e)=>setFechaFin(e.target.value)} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-white outline-none focus:border-white/15" />
        </div>
        {loading&&<span className="animate-pulse text-[11px] text-white/25">Cargando…</span>}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile label={`Ingresos ${monedaVista}`} value={money(monedaVista==="USD"?totales.ingresosUsd:totales.ingresosBs,currency)} accent="text-emerald-400" />
        <MetricTile label={`Egresos ${monedaVista}`} value={money(monedaVista==="USD"?totales.egresosUsd:totales.egresosBs,currency)} accent="text-rose-400" />
        <MetricTile label={`Utilidad ${monedaVista}`} value={money(monedaVista==="USD"?totales.utilidadUsd:totales.utilidadBs,currency)} accent={(monedaVista==="USD"?totales.utilidadUsd:totales.utilidadBs)>=0?"text-emerald-400":"text-rose-400"} />
        <MetricTile label={`Flujo de caja ${monedaVista}`} value={money(monedaVista==="USD"?totales.flujoCajaUsd:totales.flujoCajaBs,currency)} accent={(monedaVista==="USD"?totales.flujoCajaUsd:totales.flujoCajaBs)>=0?"text-violet-400":"text-amber-400"} sub={comisiones.length>0?`Com. pend. ${money(totales.comisionesPendientesUsd)}`:undefined} />
      </div>

      {/* Subcarteras */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel>Subcarteras {monedaVista} · {fechaInicio} → {fechaFin}</SectionLabel>
          <span className={`text-sm font-bold tabular-nums ${accentClass}`}>{money(totalIngresosSubcarteras(monedaVista),currency)} total</span>
        </div>
        {subcarterasVisiblesPorMoneda(monedaVista).length===0?(
          <p className="py-4 text-center text-xs text-white/30">Sin subcarteras con movimientos en este período</p>
        ):(
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {subcarterasVisiblesPorMoneda(monedaVista).map((item)=>{
              const openKey=`${monedaVista}:${item.id}`;const abierta=subcarteraAbiertaId===openKey;
              const movs=movimientosDeSubcartera(item,monedaVista);const res=resumenPeriodoSubcartera(item,monedaVista);
              const paginaActual=subcarteraPaginas[openKey]||1;const totalPags=Math.max(1,Math.ceil(movs.length/MOVIMIENTOS_POR_SUBCARTERA));
              return <SubcarteraCard key={openKey} item={item} moneda={monedaVista} open={abierta} onToggle={()=>{setSubcarteraAbiertaId(abierta?null:openKey);setPaginaSubcartera(openKey,1);}} movimientos={movs} resumen={res} pagina={Math.min(paginaActual,totalPags)} totalPaginas={totalPags} onPaginaChange={(p)=>setPaginaSubcartera(openKey,p)} />;
            })}
          </div>
        )}
      </div>

      {/* Comisiones */}
      {comisiones.length>0&&(
        <div>
          <SectionLabel>Comisiones pendientes</SectionLabel>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {comisiones.map((c)=>(
              <div key={c.empleado_id} className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4">
                <div className="mb-3 flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-white">{c.nombre}</p><span className="shrink-0 text-[10px] text-white/25">{c.cantidad} reg.</span></div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between"><span className="text-white/35">Base USD</span><span className="text-white/65">{money(c.total_base_usd)}</span></div>
                  <div className="flex justify-between"><span className="text-white/35">Base Bs</span><span className="text-white/65">{money(c.total_base_bs,"VES")}</span></div>
                  <Divider />
                  <div className="flex justify-between"><span className="font-semibold text-emerald-400">Prof. USD</span><span className="font-bold text-emerald-400">{money(c.total_profesional_usd)}</span></div>
                  <div className="flex justify-between"><span className="font-semibold text-amber-400">Prof. Bs</span><span className="font-bold text-amber-400">{money(c.total_profesional_bs,"VES")}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel className="p-4 md:p-5">
          <div className="mb-4"><SectionLabel>Flujo acumulado ({monedaVista})</SectionLabel></div>
          <div className="h-60">
            {acumuladoPorDia.length===0?<div className="flex h-full items-center justify-center text-xs text-white/25">Sin datos</div>:(
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={acumuladoPorDia}>
                  <defs><linearGradient id="gradAcum" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a78bfa" stopOpacity={0.2}/><stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.15)" tick={{fontSize:10}}/>
                  <YAxis stroke="rgba(255,255,255,0.15)" tick={{fontSize:10}}/>
                  <Tooltip formatter={(v)=>money(Number(v),currency)} contentStyle={tooltipStyle}/>
                  <Area type="monotone" dataKey="acumulado" stroke="#a78bfa" strokeWidth={1.5} fill="url(#gradAcum)" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
        <Panel className="p-4 md:p-5">
          <div className="mb-4"><SectionLabel>Ingresos vs Egresos ({monedaVista})</SectionLabel></div>
          <div className="h-60">
            {flujoPorDia.length===0?<div className="flex h-full items-center justify-center text-xs text-white/25">Sin datos</div>:(
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={flujoPorDia}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                  <XAxis dataKey="label" stroke="rgba(255,255,255,0.15)" tick={{fontSize:10}}/>
                  <YAxis stroke="rgba(255,255,255,0.15)" tick={{fontSize:10}}/>
                  <Tooltip formatter={(v)=>money(Number(v),currency)} contentStyle={tooltipStyle}/>
                  <Legend wrapperStyle={{fontSize:10,color:"rgba(255,255,255,0.35)"}}/>
                  <Bar dataKey="ingresos" fill="#10b981" radius={[3,3,0,0]}/>
                  <Bar dataKey="egresos" fill="#f43f5e" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel className="p-4 md:p-5">
          <div className="mb-4"><SectionLabel>Distribución por categoría ({monedaVista})</SectionLabel></div>
          <div className="h-52">
            {categoriasChart.length===0?<div className="flex h-full items-center justify-center text-xs text-white/25">Sin datos</div>:(
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoriasChart} dataKey="value" nameKey="name" innerRadius={45} outerRadius={78} paddingAngle={2}>
                    {categoriasChart.map((_,i)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                  </Pie>
                  <Tooltip formatter={(v)=>money(Number(v),currency)} contentStyle={tooltipStyle}/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Panel>
        <Panel className="p-4 md:p-5">
          <div className="mb-4"><SectionLabel>Balance por categoría ({monedaVista})</SectionLabel></div>
          <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
            {porCategoria.length===0?<p className="text-xs text-white/25">Sin datos</p>:porCategoria.map((r)=>(
              <div key={r.categoria} className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-white/[0.03]">
                <p className="min-w-0 flex-1 truncate text-xs font-medium text-white">{r.categoria}</p>
                <div className="flex shrink-0 items-center gap-3 text-[11px]">
                  <span className="tabular-nums text-emerald-400">{money(r.ingresos,currency)}</span>
                  <span className="text-white/20">·</span>
                  <span className="tabular-nums text-rose-400">{money(r.egresos,currency)}</span>
                  <span className={`font-bold tabular-nums ${r.ingresos-r.egresos>=0?"text-white/70":"text-rose-400"}`}>{money(r.ingresos-r.egresos,currency)}</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── Filtros de movimientos ── */}
      <div>
        <SectionLabel>Filtros de movimientos</SectionLabel>
        <div className="space-y-3">
          {/* Search */}
          <input
            type="text" value={search} onChange={(e) => { setSearch(e.target.value); setMovPage(1); }}
            placeholder="Buscar concepto, cliente, cartera…"
            className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15"
          />
          {/* Tipo */}
          <div className="flex flex-wrap gap-1.5">
            {(["todos","ingreso","egreso"] as const).map((t) => (
              <button key={t} type="button"
                onClick={() => { setTipoFiltro(t); setMovPage(1); }}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${tipoFiltro===t?"border-white/15 bg-white/[0.08] text-white":"border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70"}`}>
                {t==="todos"?"Todos":t==="ingreso"?"Ingresos":"Egresos"}
              </button>
            ))}
            <span className="w-px self-stretch bg-white/[0.06]" />
            {(["todos","pagado","pendiente","anulado"] as const).map((e) => (
              <button key={e} type="button"
                onClick={() => { setEstadoFiltro(e); setMovPage(1); }}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${estadoFiltro===e?"border-white/15 bg-white/[0.08] text-white":"border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70"}`}>
                {e==="todos"?"Estado":e.charAt(0).toUpperCase()+e.slice(1)}
              </button>
            ))}
            <span className="w-px self-stretch bg-white/[0.06]" />
            {(["todas","USD","VES"] as const).map((m) => (
              <button key={m} type="button"
                onClick={() => { setMonedaFiltro(m as any); setCarteraFiltro("todas"); setMovPage(1); }}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${monedaFiltro===m?"border-white/15 bg-white/[0.08] text-white":"border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70"}`}>
                {m==="todas"?"Moneda":m==="VES"?"VES/BS":m}
              </button>
            ))}
          </div>
          {/* Categoría — pill buttons */}
          {categoriasUnicas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button"
                onClick={() => { setCategoriaFiltro("todos"); setMovPage(1); }}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${categoriaFiltro==="todos"?"border-white/15 bg-white/[0.08] text-white":"border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70"}`}>
                Todas categorías
              </button>
              {categoriasUnicas.map((cat) => (
                <button key={cat} type="button"
                  onClick={() => { setCategoriaFiltro(cat); setMovPage(1); }}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${categoriaFiltro===cat?"border-white/15 bg-white/[0.08] text-white":"border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70"}`}>
                  {cat}
                </button>
              ))}
            </div>
          )}
          {/* Cartera — pill buttons (solo cuando hay opciones) */}
          {carterasDisponibles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button"
                onClick={() => { setCarteraFiltro("todas"); setMovPage(1); }}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${carteraFiltro==="todas"?"border-white/15 bg-white/[0.08] text-white":"border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70"}`}>
                Todas las carteras
              </button>
              {carterasDisponibles.map((c) => (
                <button key={c.codigo} type="button"
                  onClick={() => { setCarteraFiltro(c.codigo); setMovPage(1); }}
                  className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${carteraFiltro===c.codigo?"border-white/15 bg-white/[0.08] text-white":"border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70"}`}>
                  {c.nombre} <span className="ml-1 text-white/30">{c.moneda}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Nómina ── */}
      {egresosNomina.length > 0 && (
        <div>
          <SectionLabel>Egresos por nómina · {egresosNomina.length}</SectionLabel>
          <div className="space-y-1.5">
            {egresosNomina.map((e) => (
              <div key={e.id} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition hover:bg-white/[0.04]">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-rose-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{e.profesional}</p>
                  <p className="truncate text-[11px] text-white/40">{e.concepto} · {e.metodo} · {e.cartera}</p>
                  <p className="text-[11px] text-white/25">{e.fecha} · {e.moneda}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-rose-400">{money(e.equivalente_usd)}</p>
                  <p className="text-[10px] text-white/30">{money(e.equivalente_bs,"VES")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Movimientos — lista paginada 20 por página ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <SectionLabel>Movimientos</SectionLabel>
          <p className="text-[11px] text-white/25">{movimientosFiltrados.length} registros</p>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-white/30">Cargando…</p>
        ) : movimientosFiltrados.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/30">Sin movimientos para los filtros seleccionados</p>
        ) : (
          <>
            <div className="space-y-1.5">
              {movimientosFiltrados.slice((movPage-1)*MOV_PAGE_SIZE, movPage*MOV_PAGE_SIZE).map((r) => (
                <div key={`${r.tipo}-${r.id}`} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition hover:bg-white/[0.04]">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${r.tipo==="ingreso"?"bg-emerald-400":"bg-rose-400"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                      {tipoPill(r.tipo)}
                      {estadoPill(r.estado)}
                      <span className="text-[10px] text-white/25">{r.fecha}</span>
                    </div>
                    <p className="truncate text-sm font-medium text-white">{r.concepto}</p>
                    <p className="truncate text-[11px] text-white/40">{r.tercero} · {r.metodo} · {r.cartera}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-[11px] text-white/25">{r.categoria}</p>
                      {r.tipo === "ingreso" && (
                        <button type="button" onClick={() => abrirEditorMetodo(r)} className="rounded-lg border border-sky-400/15 bg-sky-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-300 transition hover:bg-sky-400/15">
                          Editar destino
                        </button>
                      )}
                      {r.tipo === "ingreso" && ultimoCambioPorPago.get(r.id) && (
                        <span className="text-[10px] text-amber-300/70">
                          Cambio: {ultimoCambioPorPago.get(r.id)?.actor_email || "sin usuario"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-bold tabular-nums ${r.tipo==="ingreso"?"text-emerald-400":"text-rose-400"}`}>
                      {r.tipo==="ingreso"?"+":"−"}{money(r.monto_usd)}
                    </p>
                    <p className="text-[10px] text-white/30 tabular-nums">{money(r.monto_bs,"VES")}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Paginación */}
            {movimientosFiltrados.length > MOV_PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-[11px] text-white/30">
                  Página {movPage} de {Math.ceil(movimientosFiltrados.length/MOV_PAGE_SIZE)} · {movimientosFiltrados.length} registros
                </p>
                <div className="flex gap-1.5">
                  <GhostBtn onClick={() => setMovPage(1)} disabled={movPage<=1}>«</GhostBtn>
                  <GhostBtn onClick={() => setMovPage(p=>Math.max(1,p-1))} disabled={movPage<=1}>← Ant.</GhostBtn>
                  {/* Números de página */}
                  {Array.from({length:Math.min(5,Math.ceil(movimientosFiltrados.length/MOV_PAGE_SIZE))},(_,i)=>{
                    const total = Math.ceil(movimientosFiltrados.length/MOV_PAGE_SIZE);
                    let start = Math.max(1, movPage-2);
                    if (start+4>total) start = Math.max(1,total-4);
                    const p = start+i;
                    if (p>total) return null;
                    return (
                      <button key={p} type="button" onClick={() => setMovPage(p)}
                        className={`h-8 min-w-[2rem] rounded-lg border px-2 text-[11px] font-semibold transition ${movPage===p?"border-white/15 bg-white/[0.1] text-white":"border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70"}`}>
                        {p}
                      </button>
                    );
                  })}
                  <GhostBtn onClick={() => setMovPage(p=>Math.min(Math.ceil(movimientosFiltrados.length/MOV_PAGE_SIZE),p+1))} disabled={movPage>=Math.ceil(movimientosFiltrados.length/MOV_PAGE_SIZE)}>Sig. →</GhostBtn>
                  <GhostBtn onClick={() => setMovPage(Math.ceil(movimientosFiltrados.length/MOV_PAGE_SIZE))} disabled={movPage>=Math.ceil(movimientosFiltrados.length/MOV_PAGE_SIZE)}>»</GhostBtn>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {editingMovimiento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080b18] shadow-2xl">
            <div className="border-b border-white/[0.06] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-white">Editar destino del abono</p>
                  <p className="mt-1 text-xs text-white/40">Solo se cambia dónde cayó el dinero. El monto, cliente y fecha no se modifican.</p>
                </div>
                <button type="button" onClick={cerrarEditorMetodo} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/45 hover:text-white">✕</button>
              </div>
            </div>

            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                <p className="text-xs font-semibold text-white">{editingMovimiento.concepto}</p>
                <p className="mt-1 text-[11px] text-white/40">{editingMovimiento.tercero} · {editingMovimiento.fecha}</p>
                <p className="mt-2 text-[11px] text-white/35">Actual: <span className="font-semibold text-white/70">{editingMovimiento.metodo} · {editingMovimiento.cartera}</span></p>
                <p className="mt-1 text-[11px] text-white/35">Monto: <span className="font-semibold text-emerald-300">{money(editingMovimiento.monto_usd)}</span> · <span className="font-semibold text-amber-300">{money(editingMovimiento.monto_bs,"VES")}</span></p>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-white/35">Nuevo destino del dinero</span>
                <select value={editMetodoId} onChange={(e)=>setEditMetodoId(e.target.value)} className="w-full rounded-xl border border-white/[0.08] bg-[#050714] px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400/40">
                  <option value="">Seleccionar método…</option>
                  {metodosEditables.map((m) => (
                    <option key={m.id} value={m.id}>{m.metodo_nombre} · {m.cartera_nombre} · {normalizeMoneda(m.moneda)}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-white/35">Motivo opcional</span>
                <input value={editMotivo} onChange={(e)=>setEditMotivo(e.target.value)} placeholder="Ej: se registró como efectivo USD pero era Zelle" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-sky-400/40" />
              </label>

              {ultimoCambioPorPago.get(editingMovimiento.id) && (
                <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-3 text-[11px] text-amber-100/80">
                  Último cambio: {ultimoCambioPorPago.get(editingMovimiento.id)?.metodo_anterior_nombre || "—"} → {ultimoCambioPorPago.get(editingMovimiento.id)?.metodo_nuevo_nombre || "—"} por {ultimoCambioPorPago.get(editingMovimiento.id)?.actor_email || "sin usuario"}.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] p-5">
              <GhostBtn onClick={cerrarEditorMetodo} disabled={editSaving}>Cancelar</GhostBtn>
              <button type="button" onClick={guardarCambioMetodoPago} disabled={editSaving || !editMetodoId || editMetodoId === editingMovimiento.metodo_id} className="rounded-xl bg-sky-400 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-40">
                {editSaving ? "Guardando…" : "Guardar cambio"}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}