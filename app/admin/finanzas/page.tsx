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
type CajaChicaModo = "cargar" | "gasto";
type CajaChicaForm = {
  fecha: string;
  monto: string;
  moneda: "USD" | "BS";
  tasa_bcv: string;
  metodo_origen_v2_id: string;
  categoria: string;
  concepto: string;
  proveedor: string;
  notas: string;
  referencia: string;
};

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
function isTransferenciaInterna(m: { categoria?: string | null; concepto?: string | null }) {
  const cat = normalizeText(m.categoria);
  const con = normalizeText(m.concepto);
  return cat === "transferencia_interna" || con.includes("transferencia_a_caja_chica") || con.includes("ingreso_a_caja_chica");
}
function buildReferencia(prefix: string) {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
}

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
function MetricTile({ label, value, sub, accent, active, onClick }: { label: string; value: string; sub?: string; accent?: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[116px] flex-col gap-1.5 rounded-2xl border p-4 text-left transition ${active ? "border-sky-400/30 bg-sky-400/[0.07] shadow-[0_0_0_1px_rgba(56,189,248,0.08)]" : "border-white/[0.06] bg-white/[0.025] hover:border-white/[0.12] hover:bg-white/[0.04]"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-white/35">{label}</p>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${active ? "border-sky-400/25 bg-sky-400/10 text-sky-300" : "border-white/10 bg-white/[0.04] text-white/25"}`}>VER</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums tracking-tight ${accent??"text-white"}`}>{value}</p>
      {sub && <p className="text-[11px] text-white/40">{sub}</p>}
    </button>
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

// ─── Caja Chica: Card compacta + Drawer ──────────────────────────────────────

function CajaChicaCard({
  saldoUsd,
  saldoBs,
  cajaMetodo,
  onAbrir,
}: {
  saldoUsd: number;
  saldoBs: number;
  cajaMetodo: MetodoSubcartera | null;
  onAbrir: (modo: CajaChicaModo) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#080b18]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-400/[0.03] via-transparent to-transparent" />

      <div className="relative flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
        {/* Info */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] text-lg">
            🏦
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300/70">Caja chica</p>
            <p className="mt-0.5 text-sm font-bold text-white">
              {cajaMetodo ? cajaMetodo.metodo_nombre : "Sin configurar"}
            </p>
          </div>
        </div>

        {/* Saldos */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] px-3 py-1.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-emerald-300/50">USD</p>
            <p className="mt-0.5 text-sm font-black tabular-nums text-emerald-300">{money(saldoUsd)}</p>
          </div>
          <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.06] px-3 py-1.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-amber-300/50">BS</p>
            <p className="mt-0.5 text-sm font-black tabular-nums text-amber-300">{money(saldoBs, "VES")}</p>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onAbrir("cargar")}
            disabled={!cajaMetodo}
            className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Cargar
          </button>
          <button
            type="button"
            onClick={() => onAbrir("gasto")}
            disabled={!cajaMetodo}
            className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-400/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            − Gasto
          </button>
          <button
            type="button"
            onClick={() => onAbrir("cargar")}
            disabled={!cajaMetodo}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/50 transition hover:bg-white/[0.06] hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Ver historial →
          </button>
        </div>
      </div>

      {!cajaMetodo && (
        <div className="border-t border-amber-400/10 bg-amber-400/[0.04] px-4 py-2.5 text-[11px] text-amber-200/70">
          No encontré el método <strong>CAJA_CHICA_USD</strong>. Ejecuta el SQL de caja chica y recarga.
        </div>
      )}
    </div>
  );
}

function CajaChicaDrawer({
  open,
  modo,
  form,
  cajaMetodo,
  metodosOrigen,
  movimientosCaja,
  saving,
  mensaje,
  onClose,
  onModoChange,
  onFormChange,
  onCargar,
  onGasto,
}: {
  open: boolean;
  modo: CajaChicaModo;
  form: CajaChicaForm;
  cajaMetodo: MetodoSubcartera | null;
  metodosOrigen: MetodoSubcartera[];
  movimientosCaja: Movimiento[];
  saving: boolean;
  mensaje: { type: "success" | "error"; text: string } | null;
  onClose: () => void;
  onModoChange: (m: CajaChicaModo) => void;
  onFormChange: (patch: Partial<CajaChicaForm>) => void;
  onCargar: () => void;
  onGasto: () => void;
}) {
  const montoValido = Number(form.monto || 0) > 0;
  const requiereTasa = form.moneda === "BS";
  const tasaValida = !requiereTasa || Number(form.tasa_bcv || 0) > 0;
  const puedeGuardarCarga = montoValido && tasaValida && !!form.metodo_origen_v2_id && !saving;
  const puedeGuardarGasto = montoValido && tasaValida && !!cajaMetodo?.id && !saving;
  const ultimos = movimientosCaja.slice(0, 8);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] transition-all duration-300 ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
      />

      {/* Drawer */}
      <aside
        className={`fixed bottom-4 right-4 top-4 z-50 flex w-[420px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#080b18]/95 shadow-[0_24px_90px_rgba(0,0,0,0.65)] backdrop-blur-xl transition-all duration-300 ease-out ${open ? "translate-x-0 opacity-100" : "translate-x-[115%] opacity-0"}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-400/[0.04] via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/25 to-transparent" />

        {/* Header */}
        <div className="relative z-10 flex items-start justify-between gap-3 border-b border-white/[0.06] bg-[#080b18]/90 px-5 py-4 backdrop-blur-xl">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300/80">Caja chica · {cajaMetodo?.cartera_nombre || "—"}</p>
            <h2 className="mt-1 text-lg font-bold text-white">Fondo operativo</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white/45 transition hover:bg-white/[0.08] hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-5 py-4">

          {/* Tabs modo */}
          <div className="mb-4 flex gap-2">
            <button
              type="button"
              onClick={() => onModoChange("cargar")}
              className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition ${modo === "cargar" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/[0.07] bg-white/[0.025] text-white/40 hover:text-white/70"}`}
            >
              + Cargar fondo
            </button>
            <button
              type="button"
              onClick={() => onModoChange("gasto")}
              className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition ${modo === "gasto" ? "border-rose-400/30 bg-rose-400/10 text-rose-300" : "border-white/[0.07] bg-white/[0.025] text-white/40 hover:text-white/70"}`}
            >
              − Registrar gasto
            </button>
          </div>

          {/* Mensaje */}
          {mensaje && (
            <div className={`mb-4 rounded-xl border px-3 py-2.5 text-xs ${mensaje.type === "success" ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-200" : "border-rose-400/20 bg-rose-400/[0.07] text-rose-200"}`}>
              {mensaje.text}
            </div>
          )}

          {/* Formulario */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">Fecha</span>
              <input type="date" value={form.fecha} onChange={(e) => onFormChange({ fecha: e.target.value })} className="w-full rounded-xl border border-white/[0.08] bg-[#050714] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/40" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">Moneda</span>
              <select value={form.moneda} onChange={(e) => onFormChange({ moneda: e.target.value as "USD" | "BS", metodo_origen_v2_id: "" })} className="w-full rounded-xl border border-white/[0.08] bg-[#050714] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/40">
                <option value="USD">USD</option>
                <option value="BS">BS</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">Monto</span>
              <input type="number" min="0" step="0.01" value={form.monto} onChange={(e) => onFormChange({ monto: e.target.value })} placeholder="0.00" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-emerald-400/40" />
            </label>
            {requiereTasa && (
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">Tasa BCV</span>
                <input type="number" min="0" step="0.0001" value={form.tasa_bcv} onChange={(e) => onFormChange({ tasa_bcv: e.target.value })} placeholder="Ej: 36.50" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-400/40" />
              </label>
            )}

            {modo === "cargar" ? (
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">Sale desde</span>
                <select value={form.metodo_origen_v2_id} onChange={(e) => onFormChange({ metodo_origen_v2_id: e.target.value })} className="w-full rounded-xl border border-white/[0.08] bg-[#050714] px-3 py-2.5 text-sm text-white outline-none focus:border-emerald-400/40">
                  <option value="">Seleccionar origen…</option>
                  {metodosOrigen.map((m) => (
                    <option key={m.id} value={m.id}>{m.metodo_nombre} · {m.cartera_nombre} · {normalizeMoneda(m.moneda)}</option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">Categoría</span>
                  <input value={form.categoria} onChange={(e) => onFormChange({ categoria: e.target.value })} placeholder="limpieza, transporte…" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-rose-400/40" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">Proveedor</span>
                  <input value={form.proveedor} onChange={(e) => onFormChange({ proveedor: e.target.value })} placeholder="Opcional" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-rose-400/40" />
                </label>
              </>
            )}

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">Concepto</span>
              <input value={form.concepto} onChange={(e) => onFormChange({ concepto: e.target.value })} placeholder={modo === "cargar" ? "Carga de fondo caja chica" : "Compra menor / gasto operativo"} className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-sky-400/40" />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">Referencia</span>
              <input value={form.referencia} onChange={(e) => onFormChange({ referencia: e.target.value })} placeholder="Opcional — se genera automáticamente" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-sky-400/40" />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-white/30">Notas</span>
              <input value={form.notas} onChange={(e) => onFormChange({ notas: e.target.value })} placeholder="Opcional" className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-sky-400/40" />
            </label>
          </div>

          {/* Botón guardar */}
          <div className="mt-5">
            <button
              type="button"
              onClick={modo === "cargar" ? onCargar : onGasto}
              disabled={modo === "cargar" ? !puedeGuardarCarga : !puedeGuardarGasto}
              className={`w-full rounded-xl py-3 text-sm font-black text-slate-950 transition disabled:cursor-not-allowed disabled:opacity-40 ${modo === "cargar" ? "bg-emerald-400 hover:bg-emerald-300" : "bg-rose-400 hover:bg-rose-300"}`}
            >
              {saving ? "Guardando…" : modo === "cargar" ? "Cargar caja chica" : "Registrar gasto"}
            </button>
            <p className="mt-2 text-center text-[10px] text-white/25">
              {modo === "cargar" ? "Crea egreso + ingreso interno con la misma referencia." : "Crea un egreso real desde Caja Chica."}
            </p>
          </div>

          {/* Historial rápido */}
          {ultimos.length > 0 && (
            <>
              <Divider />
              <div className="mt-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">Últimos movimientos</p>
                  <Pill color="emerald">{ultimos.length}</Pill>
                </div>
                <div className="space-y-2">
                  {ultimos.map((m) => {
                    const v = Number(m.monto_usd || 0);
                    return (
                      <div key={`caja-${m.tipo}-${m.id}`} className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">{tipoPill(m.tipo)}{estadoPill(m.estado)}<span className="text-[10px] text-white/25">{m.fecha}</span></div>
                        <p className="truncate text-xs font-semibold text-white">{m.concepto || m.categoria}</p>
                        <p className="truncate text-[11px] text-white/35">{m.categoria} · {m.tercero}</p>
                        <p className={`mt-1 text-right text-sm font-bold tabular-nums ${m.tipo === "ingreso" ? "text-emerald-300" : "text-rose-300"}`}>
                          {m.tipo === "ingreso" ? "+" : "−"}{money(Math.abs(v))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
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

function PanelMovimientosCard({ open, resumen, moneda, onClose }: {
  open: boolean;
  resumen: { title: string; description: string; movimientos: Movimiento[]; totalIngresos: number; totalEgresos: number; totalComisiones: number; neto: number };
  moneda: "USD"|"BS";
  onClose: () => void;
}) {
  const currency = moneda === "USD" ? "USD" : "VES";
  const topMovs = resumen.movimientos.slice(0, 24);
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] transition-all duration-300 ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        className={`fixed bottom-4 right-4 top-4 z-50 flex w-[390px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#080b18]/95 shadow-[0_24px_90px_rgba(0,0,0,0.65)] backdrop-blur-xl transition-all duration-300 ease-out ${open ? "translate-x-0 opacity-100" : "translate-x-[115%] opacity-0"}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-400/[0.05] via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/30 to-transparent" />
        <div className="relative z-10 flex items-start justify-between gap-3 border-b border-white/[0.06] bg-[#080b18]/90 px-5 py-4 backdrop-blur-xl">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-300/80">Detalle financiero</p>
            <h2 className="mt-1 truncate text-lg font-bold text-white">{resumen.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-white/35">{resumen.description}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white/45 transition hover:bg-white/[0.08] hover:text-white" aria-label="Cerrar panel">✕</button>
        </div>
        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-2">
              <p className="text-[9px] uppercase tracking-widest text-emerald-300/60">Ingresos</p>
              <p className="mt-1 text-sm font-bold tabular-nums text-emerald-300">{money(resumen.totalIngresos, currency)}</p>
            </div>
            <div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.05] px-3 py-2">
              <p className="text-[9px] uppercase tracking-widest text-rose-300/60">Egresos</p>
              <p className="mt-1 text-sm font-bold tabular-nums text-rose-300">{money(resumen.totalEgresos, currency)}</p>
            </div>
            {resumen.totalComisiones > 0 && (
              <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2">
                <p className="text-[9px] uppercase tracking-widest text-amber-300/60">Comisiones</p>
                <p className="mt-1 text-sm font-bold tabular-nums text-amber-300">{money(resumen.totalComisiones, currency)}</p>
              </div>
            )}
            <div className="rounded-xl border border-violet-400/15 bg-violet-400/[0.05] px-3 py-2">
              <p className="text-[9px] uppercase tracking-widest text-violet-300/60">Neto</p>
              <p className={`mt-1 text-sm font-bold tabular-nums ${resumen.neto >= 0 ? "text-violet-300" : "text-rose-300"}`}>{money(resumen.neto, currency)}</p>
            </div>
          </div>
          <Divider />
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">Movimientos</p>
              <span className="text-[11px] text-white/25">{resumen.movimientos.length}</span>
            </div>
            {topMovs.length === 0 ? (
              <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-center text-xs text-white/25">Sin movimientos.</p>
            ) : (
              <div className="space-y-2 pb-2">
                {topMovs.map((m) => {
                  const valor = moneda === "USD" ? Number(m.monto_usd || 0) : Number(m.monto_bs || 0);
                  return (
                    <div key={`panel-${m.tipo}-${m.id}`} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-3 transition hover:bg-white/[0.045]">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">{tipoPill(m.tipo)}{estadoPill(m.estado)}<span className="text-[10px] text-white/25">{m.fecha}</span></div>
                      <p className="line-clamp-2 text-xs font-semibold leading-snug text-white">{m.concepto || m.categoria}</p>
                      <p className="mt-1 truncate text-[11px] text-white/35">{m.tercero} · {m.metodo} · {m.cartera}</p>
                      <p className={`mt-2 text-right text-sm font-bold tabular-nums ${m.tipo === "ingreso" ? "text-emerald-300" : "text-rose-300"}`}>{m.tipo === "ingreso" ? "+" : "−"}{money(Math.abs(valor), currency)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

const tooltipStyle = { background:"#070a14", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, color:"#fff", fontSize:11 };

export default function FinanzasResumenPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fechaInicio, setFechaInicio] = useState(todayISO());
  const [fechaFin, setFechaFin] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"todos"|"ingreso"|"egreso">("todos");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [categoriaFiltro, setCategoriaFiltro] = useState("todos");
  const [monedaFiltro, setMonedaFiltro] = useState<"todas"|"USD"|"VES"|"BS">("todas");
  const [carteraFiltro, setCarteraFiltro] = useState("todas");
  const [movPage, setMovPage] = useState(1);
  const [monedaVista, setMonedaVista] = useState<"USD"|"BS">("USD");
  const [panelActivo, setPanelActivo] = useState<"ingresos"|"egresos"|"utilidad"|"flujo"|null>(null);
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

  // ── Caja chica state ──
  const [cajaChicaDrawerOpen, setCajaChicaDrawerOpen] = useState(false);
  const [cajaChicaModo, setCajaChicaModo] = useState<CajaChicaModo>("cargar");
  const [cajaChicaSaving, setCajaChicaSaving] = useState(false);
  const [cajaChicaMensaje, setCajaChicaMensaje] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [cajaChicaForm, setCajaChicaForm] = useState<CajaChicaForm>({
    fecha: todayISO(),
    monto: "",
    moneda: "USD",
    tasa_bcv: "",
    metodo_origen_v2_id: "",
    categoria: "gasto_caja_chica",
    concepto: "",
    proveedor: "",
    notas: "",
    referencia: "",
  });

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
    const pagados = movimientosFiltrados.filter((m) => m.estado==="pagado" && !isTransferenciaInterna(m));
    const iU=pagados.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.monto_usd,0);
    const iB=pagados.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.monto_bs,0);
    const eU=pagados.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.monto_usd,0);
    const eB=pagados.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.monto_bs,0);
    const cpU=comisiones.reduce((a,c)=>a+c.total_profesional_usd,0);
    const cpB=comisiones.reduce((a,c)=>a+c.total_profesional_bs,0);
    return {ingresosUsd:iU,ingresosBs:iB,egresosUsd:eU,egresosBs:eB,utilidadUsd:iU-eU,utilidadBs:iB-eB,comisionesPendientesUsd:cpU,comisionesPendientesBs:cpB,flujoCajaUsd:iU-eU-cpU,flujoCajaBs:iB-eB-cpB};
  },[movimientosFiltrados,comisiones]);

  const panelResumen = useMemo(() => {
    const pagados = movimientosFiltrados.filter((m) => m.estado === "pagado" && !isTransferenciaInterna(m));
    const valor = (m: Movimiento) => monedaVista === "USD" ? Number(m.monto_usd || 0) : Number(m.monto_bs || 0);
    const ingresos = pagados.filter((m) => m.tipo === "ingreso");
    const egresosPag = pagados.filter((m) => m.tipo === "egreso");
    const utilidad = [...ingresos, ...egresosPag];
    const flujo = [...utilidad];
    const data = { ingresos, egresos: egresosPag, utilidad, flujo };
    const activePanel = panelActivo || "ingresos";
    const selected = data[activePanel];
    const totalIngresos = selected.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + valor(m), 0);
    const totalEgresos = selected.filter((m) => m.tipo === "egreso").reduce((a, m) => a + valor(m), 0);
    const totalComisiones = activePanel === "flujo" ? (monedaVista === "USD" ? totales.comisionesPendientesUsd : totales.comisionesPendientesBs) : 0;
    const neto = totalIngresos - totalEgresos - totalComisiones;
    const titles = { ingresos: "Ingresos", egresos: "Egresos", utilidad: "Utilidad", flujo: "Flujo de caja" };
    const descriptions = { ingresos:"Movimientos pagados que entraron en el período seleccionado.", egresos:"Movimientos pagados que salieron en el período seleccionado.", utilidad:"Ingresos menos egresos pagados del período.", flujo:"Utilidad menos comisiones pendientes del período." };
    return { title: `${titles[activePanel]} ${monedaVista}`, description: descriptions[activePanel], movimientos: selected, totalIngresos, totalEgresos, totalComisiones, neto };
  }, [movimientosFiltrados, monedaVista, panelActivo, totales]);

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
    metodoCambios.forEach((c) => { if (!map.has(c.pago_id)) map.set(c.pago_id, c); });
    return map;
  }, [metodoCambios]);

  const metodosEditables = useMemo(() => {
    return subcarteras.filter((m) => m.activo !== false && !String(m.id || "").startsWith("__")).sort((a, b) => `${a.moneda}-${a.cartera_nombre}-${a.metodo_nombre}`.localeCompare(`${b.moneda}-${b.cartera_nombre}-${b.metodo_nombre}`));
  }, [subcarteras]);

  const cajaChicaMetodo = useMemo(() => {
    return subcarteras.find((m) => m.metodo_codigo === "CAJA_CHICA_USD") || subcarteras.find((m) => m.cartera_codigo === "CAJA_CHICA") || null;
  }, [subcarteras]);

  const metodosOrigenCajaChica = useMemo(() => {
    return subcarteras.filter((m) => m.activo !== false).filter((m) => m.id !== cajaChicaMetodo?.id).filter((m) => getMMN(m.moneda) === cajaChicaForm.moneda).sort((a, b) => `${a.moneda}-${a.cartera_nombre}-${a.metodo_nombre}`.localeCompare(`${b.moneda}-${b.cartera_nombre}-${b.metodo_nombre}`));
  }, [subcarteras, cajaChicaMetodo?.id, cajaChicaForm.moneda]);

  const movimientosCajaChica = useMemo(() => {
    if (!cajaChicaMetodo) return [];
    return movimientos.filter((m) => m.metodo_id === cajaChicaMetodo.id || m.cartera_codigo === "CAJA_CHICA");
  }, [movimientos, cajaChicaMetodo]);

  const cajaChicaSaldo = useMemo(() => {
    return movimientosCajaChica.filter((m) => m.estado === "pagado").reduce((acc, m) => {
      const sign = m.tipo === "ingreso" ? 1 : -1;
      acc.usd += sign * Number(m.monto_usd || 0);
      acc.bs += sign * Number(m.monto_bs || 0);
      return acc;
    }, { usd: 0, bs: 0 });
  }, [movimientosCajaChica]);

  useEffect(() => {
    if (!cajaChicaForm.metodo_origen_v2_id && metodosOrigenCajaChica[0]?.id) {
      setCajaChicaForm((prev) => ({ ...prev, metodo_origen_v2_id: metodosOrigenCajaChica[0].id }));
    }
  }, [cajaChicaForm.metodo_origen_v2_id, metodosOrigenCajaChica]);

  function updateCajaChicaForm(patch: Partial<CajaChicaForm>) {
    setCajaChicaMensaje(null);
    setCajaChicaForm((prev) => ({ ...prev, ...patch }));
  }

  function abrirCajaChicaDrawer(modo: CajaChicaModo) {
    setCajaChicaModo(modo);
    setCajaChicaMensaje(null);
    setCajaChicaDrawerOpen(true);
  }

  function cerrarCajaChicaDrawer() {
    if (cajaChicaSaving) return;
    setCajaChicaDrawerOpen(false);
  }

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
      setEditSaving(true); setError("");
      const metodoNuevo = metodosEditables.find((m) => m.id === editMetodoId) || null;
      const metodoAnterior = subcarteras.find((m) => m.id === editingMovimiento.metodo_id) || null;
      const { data: userData } = await supabase.auth.getUser();
      const actorId = userData?.user?.id || null;
      const actorEmail = userData?.user?.email || null;
      const upd = await supabase.from("pagos").update({ metodo_pago_v2_id: editMetodoId }).eq("id", editingMovimiento.id);
      if (upd.error) throw upd.error;
      const ins = await supabase.from("pagos_metodo_cambios").insert({ pago_id: editingMovimiento.id, metodo_anterior_id: editingMovimiento.metodo_id || null, metodo_nuevo_id: editMetodoId, metodo_anterior_nombre: metodoAnterior?.metodo_nombre || editingMovimiento.metodo || null, metodo_nuevo_nombre: metodoNuevo?.metodo_nombre || null, actor_id: actorId, actor_email: actorEmail, motivo: editMotivo || "Corrección de destino del abono" });
      if (ins.error) throw ins.error;
      await loadFinanzas();
      setEditingMovimiento(null); setEditMetodoId(""); setEditMotivo("");
    } catch (err: any) { setError(err?.message || "No se pudo cambiar el destino del abono."); }
    finally { setEditSaving(false); }
  }

  function resetCajaChicaForm(keepMode: CajaChicaModo = cajaChicaModo) {
    setCajaChicaForm((prev) => ({ fecha: todayISO(), monto: "", moneda: prev.moneda || "USD", tasa_bcv: prev.tasa_bcv || "", metodo_origen_v2_id: keepMode === "cargar" ? (prev.metodo_origen_v2_id || metodosOrigenCajaChica[0]?.id || "") : prev.metodo_origen_v2_id, categoria: "gasto_caja_chica", concepto: "", proveedor: "", notas: "", referencia: "" }));
  }

  async function registrarCargaCajaChica() {
    if (cajaChicaSaving) return;
    const monto = Number(cajaChicaForm.monto || 0);
    const tasa = cajaChicaForm.moneda === "BS" ? Number(cajaChicaForm.tasa_bcv || 0) : (cajaChicaForm.tasa_bcv ? Number(cajaChicaForm.tasa_bcv) : null);
    if (!monto || monto <= 0) { setCajaChicaMensaje({ type: "error", text: "El monto debe ser mayor a 0." }); return; }
    if (!cajaChicaForm.metodo_origen_v2_id) { setCajaChicaMensaje({ type: "error", text: "Selecciona desde dónde sale el dinero." }); return; }
    if (cajaChicaForm.moneda === "BS" && (!tasa || tasa <= 0)) { setCajaChicaMensaje({ type: "error", text: "Para BS debes colocar tasa BCV." }); return; }
    try {
      setCajaChicaSaving(true); setCajaChicaMensaje(null);
      const referencia = cajaChicaForm.referencia.trim() || buildReferencia("CAJA-CHICA");
      const { data, error } = await supabase.rpc("registrar_carga_caja_chica", { p_monto: monto, p_fecha: cajaChicaForm.fecha || todayISO(), p_metodo_origen_v2_id: cajaChicaForm.metodo_origen_v2_id, p_metodo_destino_v2_id: cajaChicaMetodo?.id || null, p_moneda: cajaChicaForm.moneda, p_tasa_bcv: tasa, p_referencia: referencia, p_concepto: cajaChicaForm.concepto.trim() || "Carga de fondo caja chica", p_notas: cajaChicaForm.notas.trim() || null, p_registrado_por: null });
      if (error) throw error;
      setCajaChicaMensaje({ type: "success", text: data?.duplicado_evitado ? "Referencia ya registrada. No se duplicó." : "Caja chica cargada correctamente." });
      resetCajaChicaForm("cargar");
      await loadFinanzas();
    } catch (err: any) { setCajaChicaMensaje({ type: "error", text: err?.message || "No se pudo cargar caja chica." }); }
    finally { setCajaChicaSaving(false); }
  }

  async function registrarGastoCajaChica() {
    if (cajaChicaSaving) return;
    const monto = Number(cajaChicaForm.monto || 0);
    const tasa = cajaChicaForm.moneda === "BS" ? Number(cajaChicaForm.tasa_bcv || 0) : (cajaChicaForm.tasa_bcv ? Number(cajaChicaForm.tasa_bcv) : null);
    if (!monto || monto <= 0) { setCajaChicaMensaje({ type: "error", text: "El monto debe ser mayor a 0." }); return; }
    if (!cajaChicaMetodo?.id) { setCajaChicaMensaje({ type: "error", text: "No existe el método Caja Chica USD." }); return; }
    if (cajaChicaForm.moneda === "BS" && (!tasa || tasa <= 0)) { setCajaChicaMensaje({ type: "error", text: "Para BS debes colocar tasa BCV." }); return; }
    try {
      setCajaChicaSaving(true); setCajaChicaMensaje(null);
      const referencia = cajaChicaForm.referencia.trim() || buildReferencia("GASTO-CAJA");
      const { data, error } = await supabase.rpc("registrar_gasto_caja_chica", { p_monto: monto, p_fecha: cajaChicaForm.fecha || todayISO(), p_categoria: cajaChicaForm.categoria.trim() || "gasto_caja_chica", p_concepto: cajaChicaForm.concepto.trim() || "Gasto de caja chica", p_metodo_caja_chica_v2_id: cajaChicaMetodo.id, p_moneda: cajaChicaForm.moneda, p_tasa_bcv: tasa, p_referencia: referencia, p_proveedor: cajaChicaForm.proveedor.trim() || "Caja chica", p_notas: cajaChicaForm.notas.trim() || null, p_registrado_por: null });
      if (error) throw error;
      setCajaChicaMensaje({ type: "success", text: data?.duplicado_evitado ? "Referencia ya registrada. No se duplicó." : "Gasto de caja chica registrado." });
      resetCajaChicaForm("gasto");
      await loadFinanzas();
    } catch (err: any) { setCajaChicaMensaje({ type: "error", text: err?.message || "No se pudo registrar el gasto." }); }
    finally { setCajaChicaSaving(false); }
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

      {/* ── Caja chica: card compacta ── */}
      <CajaChicaCard
        saldoUsd={cajaChicaSaldo.usd}
        saldoBs={cajaChicaSaldo.bs}
        cajaMetodo={cajaChicaMetodo}
        onAbrir={abrirCajaChicaDrawer}
      />

      {/* ── Caja chica: drawer ── */}
      <CajaChicaDrawer
        open={cajaChicaDrawerOpen}
        modo={cajaChicaModo}
        form={cajaChicaForm}
        cajaMetodo={cajaChicaMetodo}
        metodosOrigen={metodosOrigenCajaChica}
        movimientosCaja={movimientosCajaChica}
        saving={cajaChicaSaving}
        mensaje={cajaChicaMensaje}
        onClose={cerrarCajaChicaDrawer}
        onModoChange={(m) => { setCajaChicaModo(m); setCajaChicaMensaje(null); }}
        onFormChange={updateCajaChicaForm}
        onCargar={registrarCargaCajaChica}
        onGasto={registrarGastoCajaChica}
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile active={panelActivo==="ingresos"} onClick={()=>setPanelActivo("ingresos")} label={`Ingresos ${monedaVista}`} value={money(monedaVista==="USD"?totales.ingresosUsd:totales.ingresosBs,currency)} accent="text-emerald-400" />
        <MetricTile active={panelActivo==="egresos"} onClick={()=>setPanelActivo("egresos")} label={`Egresos ${monedaVista}`} value={money(monedaVista==="USD"?totales.egresosUsd:totales.egresosBs,currency)} accent="text-rose-400" />
        <MetricTile active={panelActivo==="utilidad"} onClick={()=>setPanelActivo("utilidad")} label={`Utilidad ${monedaVista}`} value={money(monedaVista==="USD"?totales.utilidadUsd:totales.utilidadBs,currency)} accent={(monedaVista==="USD"?totales.utilidadUsd:totales.utilidadBs)>=0?"text-emerald-400":"text-rose-400"} />
        <MetricTile active={panelActivo==="flujo"} onClick={()=>setPanelActivo("flujo")} label={`Flujo de caja ${monedaVista}`} value={money(monedaVista==="USD"?totales.flujoCajaUsd:totales.flujoCajaBs,currency)} accent={(monedaVista==="USD"?totales.flujoCajaUsd:totales.flujoCajaBs)>=0?"text-violet-400":"text-amber-400"} sub={comisiones.length>0?`Com. pend. ${money(monedaVista==="USD"?totales.comisionesPendientesUsd:totales.comisionesPendientesBs, currency)}`:undefined} />
      </div>

      <PanelMovimientosCard open={panelActivo!==null} resumen={panelResumen} moneda={monedaVista} onClose={()=>setPanelActivo(null)} />

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

      {/* Filtros de movimientos */}
      <div>
        <SectionLabel>Filtros de movimientos</SectionLabel>
        <div className="space-y-3">
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setMovPage(1); }} placeholder="Buscar concepto, cliente, cartera…" className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-2.5 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15" />
          <div className="flex flex-wrap gap-1.5">
            {(["todos","ingreso","egreso"] as const).map((t) => (
              <button key={t} type="button" onClick={() => { setTipoFiltro(t); setMovPage(1); }} className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${tipoFiltro===t?"border-white/15 bg-white/[0.08] text-white":"border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70"}`}>{t==="todos"?"Todos":t==="ingreso"?"Ingresos":"Egresos"}</button>
            ))}
            <span className="w-px self-stretch bg-white/[0.06]" />
            {(["todos","pagado","pendiente","anulado"] as const).map((e) => (
              <button key={e} type="button" onClick={() => { setEstadoFiltro(e); setMovPage(1); }} className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${estadoFiltro===e?"border-white/15 bg-white/[0.08] text-white":"border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70"}`}>{e==="todos"?"Estado":e.charAt(0).toUpperCase()+e.slice(1)}</button>
            ))}
            <span className="w-px self-stretch bg-white/[0.06]" />
            {(["todas","USD","VES"] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setMonedaFiltro(m as any); setCarteraFiltro("todas"); setMovPage(1); }} className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${monedaFiltro===m?"border-white/15 bg-white/[0.08] text-white":"border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70"}`}>{m==="todas"?"Moneda":m==="VES"?"VES/BS":m}</button>
            ))}
          </div>
          {categoriasUnicas.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => { setCategoriaFiltro("todos"); setMovPage(1); }} className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${categoriaFiltro==="todos"?"border-white/15 bg-white/[0.08] text-white":"border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70"}`}>Todas categorías</button>
              {categoriasUnicas.map((cat) => (
                <button key={cat} type="button" onClick={() => { setCategoriaFiltro(cat); setMovPage(1); }} className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${categoriaFiltro===cat?"border-white/15 bg-white/[0.08] text-white":"border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70"}`}>{cat}</button>
              ))}
            </div>
          )}
          {carterasDisponibles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => { setCarteraFiltro("todas"); setMovPage(1); }} className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${carteraFiltro==="todas"?"border-white/15 bg-white/[0.08] text-white":"border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70"}`}>Todas las carteras</button>
              {carterasDisponibles.map((c) => (
                <button key={c.codigo} type="button" onClick={() => { setCarteraFiltro(c.codigo); setMovPage(1); }} className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${carteraFiltro===c.codigo?"border-white/15 bg-white/[0.08] text-white":"border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70"}`}>{c.nombre} <span className="ml-1 text-white/30">{c.moneda}</span></button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Nómina */}
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

      {/* Movimientos paginados */}
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
                    <div className="mb-0.5 flex flex-wrap items-center gap-1.5">{tipoPill(r.tipo)}{estadoPill(r.estado)}<span className="text-[10px] text-white/25">{r.fecha}</span></div>
                    <p className="truncate text-sm font-medium text-white">{r.concepto}</p>
                    <p className="truncate text-[11px] text-white/40">{r.tercero} · {r.metodo} · {r.cartera}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-[11px] text-white/25">{r.categoria}</p>
                      {r.tipo === "ingreso" && (
                        <button type="button" onClick={() => abrirEditorMetodo(r)} className="rounded-lg border border-sky-400/15 bg-sky-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-300 transition hover:bg-sky-400/15">Editar destino</button>
                      )}
                      {r.tipo === "ingreso" && ultimoCambioPorPago.get(r.id) && (
                        <span className="text-[10px] text-amber-300/70">Cambio: {ultimoCambioPorPago.get(r.id)?.actor_email || "sin usuario"}</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-bold tabular-nums ${r.tipo==="ingreso"?"text-emerald-400":"text-rose-400"}`}>{r.tipo==="ingreso"?"+":"−"}{money(r.monto_usd)}</p>
                    <p className="text-[10px] text-white/30 tabular-nums">{money(r.monto_bs,"VES")}</p>
                  </div>
                </div>
              ))}
            </div>
            {movimientosFiltrados.length > MOV_PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-[11px] text-white/30">Página {movPage} de {Math.ceil(movimientosFiltrados.length/MOV_PAGE_SIZE)} · {movimientosFiltrados.length} registros</p>
                <div className="flex gap-1.5">
                  <GhostBtn onClick={() => setMovPage(1)} disabled={movPage<=1}>«</GhostBtn>
                  <GhostBtn onClick={() => setMovPage(p=>Math.max(1,p-1))} disabled={movPage<=1}>← Ant.</GhostBtn>
                  {Array.from({length:Math.min(5,Math.ceil(movimientosFiltrados.length/MOV_PAGE_SIZE))},(_,i)=>{
                    const total = Math.ceil(movimientosFiltrados.length/MOV_PAGE_SIZE);
                    let start = Math.max(1, movPage-2);
                    if (start+4>total) start = Math.max(1,total-4);
                    const p = start+i;
                    if (p>total) return null;
                    return <button key={p} type="button" onClick={() => setMovPage(p)} className={`h-8 min-w-[2rem] rounded-lg border px-2 text-[11px] font-semibold transition ${movPage===p?"border-white/15 bg-white/[0.1] text-white":"border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70"}`}>{p}</button>;
                  })}
                  <GhostBtn onClick={() => setMovPage(p=>Math.min(Math.ceil(movimientosFiltrados.length/MOV_PAGE_SIZE),p+1))} disabled={movPage>=Math.ceil(movimientosFiltrados.length/MOV_PAGE_SIZE)}>Sig. →</GhostBtn>
                  <GhostBtn onClick={() => setMovPage(Math.ceil(movimientosFiltrados.length/MOV_PAGE_SIZE))} disabled={movPage>=Math.ceil(movimientosFiltrados.length/MOV_PAGE_SIZE)}>»</GhostBtn>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal editar destino de pago */}
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
                  {metodosEditables.map((m) => (<option key={m.id} value={m.id}>{m.metodo_nombre} · {m.cartera_nombre} · {normalizeMoneda(m.moneda)}</option>))}
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