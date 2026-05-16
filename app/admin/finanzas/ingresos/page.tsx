"use client";

import { memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Package2,
  User2,
  Receipt,
  ChevronDown,
  AlertCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SelectorTasaBCV from "@/components/finanzas/SelectorTasaBCV";
import { formatearMoneda } from "@/lib/finanzas/tasas";
import { registrarAbonoMixto } from "@/lib/cobranzas/abonos";
import PagoConDeudaSelector, {
  pagoConDeudaInitial,
  validarPagoConDeuda,
  buildCuentaPorCobrarPayload,
  buildPagosRpcPayload,
  type PagoConDeudaState,
  type MetodoPagoBase,
} from "@/components/pagos/PagoConDeudaSelector";

// ─── Interfaces (sin cambios) ─────────────────────────────────────────────────

interface Cartera {
  nombre: string;
  codigo: string;
}
interface MetodoPago {
  id: string;
  nombre: string;
  tipo?: string | null;
  moneda?: string | null;
  cartera?: Cartera | null;
}
interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  cantidad_actual: number | null;
  unidad_medida: string | null;
  precio_venta_usd: number | null;
  estado: string | null;
}
interface ProductoVentaItem {
  uid: string;
  productoId: string;
  cantidad: number;
}
interface Cliente {
  id: string;
  nombre: string;
  telefono?: string | null;
  email?: string | null;
}
interface EmpleadoConsumidor {
  id: string;
  nombre: string;
  telefono?: string | null;
  email?: string | null;
  rol?: string | null;
}

interface CuentaPendienteResumen {
  id: string;
  cliente_id: string | null;
  cliente_nombre: string;
  concepto: string;
  monto_total_usd: number | null;
  monto_pagado_usd: number | null;
  saldo_usd: number | null;
  fecha_venta: string;
  fecha_vencimiento?: string | null;
  estado: string;
}

interface EstadoCuentaCliente {
  cliente_id: string;
  total_pendiente_usd?: number | null;
  credito_disponible_usd?: number | null;
  saldo_pendiente_neto_usd?: number | null;
  saldo_favor_neto_usd?: number | null;
  total_pendiente_bs?: number | null;
  credito_disponible_bs?: number | null;
  saldo_pendiente_neto_bs?: number | null;
  saldo_favor_neto_bs?: number | null;
}

interface EstadoCuentaEmpleado {
  empleado_id: string;
  nombre?: string | null;
  rol?: string | null;
  total_pendiente_usd?: number | null;
  credito_disponible_usd?: number | null;
  saldo_pendiente_neto_usd?: number | null;
  saldo_favor_neto_usd?: number | null;
}

interface CuentaPendienteEmpleadoResumen {
  id: string;
  empleado_id: string | null;
  empleado_nombre: string;
  concepto: string;
  monto_total_usd: number | null;
  monto_pagado_usd: number | null;
  saldo_usd: number | null;
  fecha_venta: string;
  fecha_vencimiento?: string | null;
  estado: string;
}

interface PagoItem {
  id: string;
  operacion_pago_id: string | null;
  pago_item_no: number | null;
  pago_items_total: number | null;
  es_pago_mixto: boolean;
  fecha: string;
  concepto: string;
  categoria: string;
  tipo_origen: string;
  monto: number | null;
  monto_pago: number | null;
  monto_equivalente_usd: number | null;
  monto_equivalente_bs: number | null;
  moneda_pago: string;
  tasa_bcv: number | null;
  estado: string;
  cliente_id?: string | null;
  cita_id?: string | null;
  cliente_plan_id?: string | null;
  inventario_id?: string | null;
  cantidad_producto?: number | null;
  metodo_pago_id?: string | null;
  metodo_pago_v2_id?: string | null;
  notas?: string | null;
  referencia?: string | null;
  metodos_pago_v2?: {
    id?: string | null;
    nombre: string;
    tipo?: string | null;
    moneda?: string | null;
    cartera?: Cartera | null;
  } | null;
  clientes?: { nombre: string } | null;
}

interface PagoOperacion {
  key: string;
  id_representativo: string;
  operacion_pago_id: string | null;
  fecha: string;
  concepto: string;
  categoria: string;
  tipo_origen: string;
  estado: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  inventario_id: string | null;
  cantidad_producto: number | null;
  total_usd: number;
  total_bs: number;
  es_pago_mixto: boolean;
  items_total: number;
  items: PagoItem[];
}

type EstadoUI = "pagado" | "pendiente";
type EstadoFiltro = "todos" | "pagado" | "pendiente" | "anulado";
type TipoIngresoUI = "producto" | "saldo";
type DestinoSaldo = "credito" | "deuda";
type TipoConsumidor = "cliente" | "empleado";
type ModoCobroEmpleadoProducto = "pagado" | "deuda";
type TipoFiltroIngreso =
  | "todos"
  | "producto"
  | "saldo"
  | "venta_rapida"
  | "plan"
  | "cita"
  | "abono"
  | "otros";

type RawCartera =
  | { nombre?: unknown; codigo?: unknown }
  | Array<{ nombre?: unknown; codigo?: unknown }>
  | null
  | undefined;
type RawMetodoPago = {
  id?: unknown;
  nombre?: unknown;
  tipo?: unknown;
  moneda?: unknown;
  cartera?: RawCartera;
};
type RawPago = {
  id?: unknown;
  operacion_pago_id?: unknown;
  pago_item_no?: unknown;
  pago_items_total?: unknown;
  es_pago_mixto?: unknown;
  fecha?: unknown;
  concepto?: unknown;
  categoria?: unknown;
  tipo_origen?: unknown;
  estado?: unknown;
  moneda_pago?: unknown;
  tasa_bcv?: unknown;
  monto?: unknown;
  monto_pago?: unknown;
  monto_equivalente_usd?: unknown;
  monto_equivalente_bs?: unknown;
  cliente_id?: unknown;
  cita_id?: unknown;
  cliente_plan_id?: unknown;
  inventario_id?: unknown;
  cantidad_producto?: unknown;
  metodo_pago_id?: unknown;
  metodo_pago_v2_id?: unknown;
  notas?: unknown;
  referencia?: unknown;
  metodos_pago_v2?:
    | { id?: unknown; nombre?: unknown; tipo?: unknown; moneda?: unknown; cartera?: RawCartera }
    | Array<{ id?: unknown; nombre?: unknown; tipo?: unknown; moneda?: unknown; cartera?: RawCartera }>
    | null
    | undefined;
  clientes?:
    | { nombre?: unknown }
    | Array<{ nombre?: unknown }>
    | null
    | undefined;
};

type PagoMixtoFormItem = {
  moneda: "USD" | "BS";
  metodoId: string;
  monto: string;
  referencia: string;
  notas: string;
  tasaBcv: number | null;
  montoBs: number | null;
};

function nuevoProductoVentaItem(): ProductoVentaItem {
  return {
    uid: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productoId: "",
    cantidad: 1,
  };
}

// ─── Design tokens refinados ──────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white outline-none transition placeholder:text-white/25 focus:border-white/[0.15] focus:bg-white/[0.05]";
const labelCls =
  "mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/35";
const panelCls = "rounded-2xl border border-white/[0.07] bg-[#080c18]";
const sectionCls = "rounded-xl border border-white/[0.06] bg-white/[0.02]";
const ghostBtn =
  "rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white/90";
const tabActive =
  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition";

// ─── Helpers (sin cambios) ────────────────────────────────────────────────────

function r2(v: number) {
  return Math.round(Number(v || 0) * 100) / 100;
}
function formatDateShort(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("es-VE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}
function estadoFinancieroLabel(estado: EstadoCuentaCliente | null) {
  if (Number(estado?.saldo_pendiente_neto_usd || 0) > 0.01) return "Debe";
  if (Number(estado?.saldo_favor_neto_usd || 0) > 0.01) return "Crédito";
  return "Al día";
}
function estadoFinancieroBadge(estado: EstadoCuentaCliente | null) {
  if (Number(estado?.saldo_pendiente_neto_usd || 0) > 0.01)
    return "border-rose-400/20 bg-rose-400/10 text-rose-300";
  if (Number(estado?.saldo_favor_neto_usd || 0) > 0.01)
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  return "border-white/[0.08] bg-white/[0.04] text-white/55";
}
function formatQty(v: number | null | undefined) {
  return new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 }).format(
    Number(v || 0),
  );
}
function estadoUiDesdeDb(estado: string): EstadoUI {
  return estado === "pagado" ? "pagado" : "pendiente";
}
function firstItem<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
function toStringSafe(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}
function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function normalizeCartera(raw: RawCartera): Cartera | null {
  const item = firstItem(raw);
  if (!item) return null;
  const nombre = toStringOrNull(item.nombre);
  const codigo = toStringOrNull(item.codigo);
  if (!nombre || !codigo) return null;
  return { nombre, codigo };
}
function normalizeMetodoPago(raw: RawMetodoPago): MetodoPago {
  return {
    id: toStringSafe(raw.id),
    nombre: toStringSafe(raw.nombre),
    tipo: toStringOrNull(raw.tipo),
    moneda: toStringOrNull(raw.moneda),
    cartera: normalizeCartera(raw.cartera),
  };
}
function normalizePago(raw: RawPago): PagoItem {
  const metodo = firstItem(raw.metodos_pago_v2);
  const cliente = firstItem(raw.clientes);
  return {
    id: toStringSafe(raw.id),
    operacion_pago_id: toStringOrNull(raw.operacion_pago_id),
    pago_item_no: toNumberOrNull(raw.pago_item_no),
    pago_items_total: toNumberOrNull(raw.pago_items_total),
    es_pago_mixto: Boolean(raw.es_pago_mixto),
    fecha: toStringSafe(raw.fecha),
    concepto: toStringSafe(raw.concepto),
    categoria: toStringSafe(raw.categoria),
    tipo_origen: toStringSafe(raw.tipo_origen),
    monto: toNumberOrNull(raw.monto),
    monto_pago: toNumberOrNull(raw.monto_pago),
    monto_equivalente_usd: toNumberOrNull(raw.monto_equivalente_usd),
    monto_equivalente_bs: toNumberOrNull(raw.monto_equivalente_bs),
    moneda_pago: toStringSafe(raw.moneda_pago),
    tasa_bcv: toNumberOrNull(raw.tasa_bcv),
    estado: toStringSafe(raw.estado),
    cliente_id: toStringOrNull(raw.cliente_id),
    cita_id: toStringOrNull(raw.cita_id),
    cliente_plan_id: toStringOrNull(raw.cliente_plan_id),
    inventario_id: toStringOrNull(raw.inventario_id),
    cantidad_producto: toNumberOrNull(raw.cantidad_producto),
    metodo_pago_id: toStringOrNull(raw.metodo_pago_id),
    metodo_pago_v2_id: toStringOrNull(raw.metodo_pago_v2_id),
    notas: toStringOrNull(raw.notas),
    referencia: toStringOrNull(raw.referencia),
    metodos_pago_v2: metodo?.nombre
      ? {
          id: toStringOrNull(metodo.id),
          nombre: toStringSafe(metodo.nombre),
          tipo: toStringOrNull(metodo.tipo),
          moneda: toStringOrNull(metodo.moneda),
          cartera: normalizeCartera(metodo.cartera),
        }
      : null,
    clientes: cliente?.nombre ? { nombre: toStringSafe(cliente.nombre) } : null,
  };
}
function detectarMetodoBs(metodo: MetodoPago | null) {
  if (!metodo) return false;
  const moneda = (metodo.moneda || "").toUpperCase();
  const nombre = (metodo.nombre || "").toLowerCase();
  const tipo = (metodo.tipo || "").toLowerCase();
  const cc = (metodo.cartera?.codigo || "").toLowerCase();
  return (
    moneda === "BS" ||
    moneda === "VES" ||
    nombre.includes("bs") ||
    nombre.includes("bolívar") ||
    nombre.includes("bolivar") ||
    nombre.includes("pago movil") ||
    nombre.includes("pago móvil") ||
    nombre.includes("movil") ||
    nombre.includes("móvil") ||
    tipo.includes("bs") ||
    tipo.includes("bolívar") ||
    tipo.includes("bolivar") ||
    tipo.includes("pago_movil") ||
    cc.includes("bs") ||
    cc.includes("ves")
  );
}
function detectarMetodoUsd(metodo: MetodoPago | null) {
  if (!metodo) return false;
  const moneda = (metodo.moneda || "").toUpperCase();
  const nombre = (metodo.nombre || "").toLowerCase();
  const cc = (metodo.cartera?.codigo || "").toLowerCase();
  return (
    moneda === "USD" ||
    nombre.includes("usd") ||
    nombre.includes("zelle") ||
    nombre.includes("efectivo $") ||
    nombre.includes("efectivo usd") ||
    cc.includes("usd")
  );
}
function pagoToUsd(pago: PagoMixtoFormItem): number {
  const monto = parseFloat(pago.monto) || 0;
  if (pago.moneda === "USD") return r2(monto);
  if (!pago.tasaBcv || pago.tasaBcv <= 0) return 0;
  return r2(monto / pago.tasaBcv);
}
function pagoMontoEnBs(pago: PagoMixtoFormItem): number {
  if (pago.moneda !== "BS") return 0;
  return parseFloat(pago.monto) || 0;
}
function agruparPagosPorOperacion(items: PagoItem[]): PagoOperacion[] {
  const map = new Map<string, PagoOperacion>();
  for (const item of items) {
    const key = item.operacion_pago_id || item.id;
    if (!map.has(key)) {
      map.set(key, {
        key,
        id_representativo: item.id,
        operacion_pago_id: item.operacion_pago_id,
        fecha: item.fecha,
        concepto: item.concepto,
        categoria: item.categoria,
        tipo_origen: item.tipo_origen,
        estado: item.estado,
        cliente_id: item.cliente_id || null,
        cliente_nombre: item.clientes?.nombre || null,
        inventario_id: item.inventario_id || null,
        cantidad_producto: item.cantidad_producto ?? null,
        total_usd: 0,
        total_bs: 0,
        es_pago_mixto: Boolean(item.es_pago_mixto),
        items_total: Number(item.pago_items_total || 1),
        items: [],
      });
    }
    const group = map.get(key)!;
    group.items.push(item);
    group.total_usd = r2(
      group.total_usd + Number(item.monto_equivalente_usd || 0),
    );
    group.total_bs = r2(
      group.total_bs + Number(item.monto_equivalente_bs || 0),
    );
    group.es_pago_mixto = group.es_pago_mixto || Boolean(item.es_pago_mixto);
    group.items_total = Math.max(
      group.items_total,
      Number(item.pago_items_total || 1),
    );
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
  );
}

// ─── Sub-componentes rediseñados ──────────────────────────────────────────────

function ClienteSearch({
  clientes,
  value,
  onChange,
  disabled = false,
}: {
  clientes: Cliente[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sel = useMemo(
    () => clientes.find((c) => c.id === value) || null,
    [clientes, value],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? clientes.filter((c) => c.nombre.toLowerCase().includes(q)).slice(0, 50)
      : clientes.slice(0, 50);
  }, [clientes, query]);
  useEffect(() => {
    function out(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setOpen(false);
    }
    document.addEventListener("mousedown", out);
    return () => document.removeEventListener("mousedown", out);
  }, []);
  useEffect(() => {
    setHighlighted(0);
  }, [filtered]);
  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[highlighted] as
      | HTMLElement
      | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);
  function handleSelect(id: string) {
    onChange(id);
    setQuery("");
    setOpen(false);
  }
  function handleClear() {
    if (disabled) return;
    onChange("");
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key !== "Tab") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlighted]) handleSelect(filtered[highlighted].id);
    } else if (e.key === "Escape") setOpen(false);
  }
  return (
    <div ref={containerRef} className="relative">
      {sel && !open ? (
        <div
          className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 ${disabled ? "border-white/[0.06] bg-white/[0.02]" : "border-violet-400/25 bg-violet-500/[0.08]"}`}
        >
          <span className="flex-1 truncate text-xs font-medium text-white">
            {sel.nombre}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="shrink-0 text-white/30 transition hover:text-white/70"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar cliente..."
            className={inputCls}
            autoComplete="off"
            disabled={disabled}
          />
          <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
        </div>
      )}
      {open && !disabled && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-white/[0.08] bg-[#0d1120] py-1 shadow-2xl"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2.5 text-xs text-white/35">
              Sin resultados para "{query}"
            </li>
          ) : (
            filtered.map((c, i) => (
              <li
                key={c.id}
                onMouseDown={() => handleSelect(c.id)}
                onMouseEnter={() => setHighlighted(i)}
                className={`cursor-pointer px-3 py-2 text-xs transition ${i === highlighted ? "bg-violet-500/15 text-violet-200" : "text-white/70 hover:bg-white/[0.04]"}`}
              >
                {c.nombre}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

const PagoBsSelector = memo(function PagoBsSelector({
  fecha,
  montoUsd,
  montoBs,
  onChangeTasa,
  onChangeMontoBs,
}: {
  fecha: string;
  montoUsd: number;
  montoBs: number | null;
  onChangeTasa: (tasa: number | null) => void;
  onChangeMontoBs: (monto: number) => void;
}) {
  return (
    <SelectorTasaBCV
      fecha={fecha}
      monedaPago="BS"
      monedaReferencia="EUR"
      montoUSD={montoUsd}
      montoBs={montoBs || undefined}
      onTasaChange={onChangeTasa}
      onMontoBsChange={onChangeMontoBs}
    />
  );
});

function SelectorDeuda({
  cuentas,
  seleccionadaId,
  onSeleccionar,
}: {
  cuentas: CuentaPendienteResumen[];
  seleccionadaId: string;
  onSeleccionar: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(true);
  const seleccionada = cuentas.find((c) => c.id === seleccionadaId);
  return (
    <div className="rounded-xl border border-rose-400/15 bg-rose-400/[0.03]">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5"
      >
        <div className="flex items-center gap-2">
          <Receipt className="h-3.5 w-3.5 text-rose-300/70" />
          <p className="text-xs font-medium text-rose-200/80">
            {seleccionada
              ? `Pagando: ${seleccionada.concepto}`
              : "Selecciona una deuda"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {seleccionada && (
            <span className="text-xs font-bold text-white">
              {formatearMoneda(Number(seleccionada.saldo_usd || 0), "USD")}
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-white/30 transition-transform ${abierto ? "rotate-180" : ""}`}
          />
        </div>
      </button>
      {abierto && (
        <div className="space-y-1.5 border-t border-rose-400/10 px-2.5 pb-2.5 pt-2">
          {cuentas.map((cuenta) => {
            const activa = cuenta.id === seleccionadaId;
            const progreso =
              Number(cuenta.monto_total_usd || 0) > 0
                ? Math.min(
                    100,
                    Math.round(
                      (Number(cuenta.monto_pagado_usd || 0) /
                        Number(cuenta.monto_total_usd || 0)) *
                        100,
                    ),
                  )
                : 0;
            return (
              <button
                key={cuenta.id}
                type="button"
                onClick={() => onSeleccionar(cuenta.id)}
                className={`w-full rounded-xl border p-2.5 text-left transition ${activa ? "border-violet-400/25 bg-violet-500/[0.08]" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white">
                      {cuenta.concepto}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-white/35">
                      <span>{formatDateShort(cuenta.fecha_venta)}</span>
                      {cuenta.fecha_vencimiento && (
                        <span>
                          · Vence {formatDateShort(cuenta.fecha_vencimiento)}
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                        <div
                          className="h-0.5 rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all"
                          style={{ width: `${progreso}%` }}
                        />
                      </div>
                      <p className="mt-1 text-[10px] text-white/25">
                        {formatearMoneda(
                          Number(cuenta.monto_pagado_usd || 0),
                          "USD",
                        )}{" "}
                        /{" "}
                        {formatearMoneda(
                          Number(cuenta.monto_total_usd || 0),
                          "USD",
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-white">
                      {formatearMoneda(Number(cuenta.saldo_usd || 0), "USD")}
                    </p>
                    <p className="text-[10px] text-white/30">saldo</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PagoMixtoCard({
  numero,
  pago,
  metodosPago,
  fecha,
  onChange,
}: {
  numero: 1 | 2;
  pago: PagoMixtoFormItem;
  metodosPago: MetodoPago[];
  fecha: string;
  onChange: (patch: Partial<PagoMixtoFormItem>) => void;
}) {
  const isUsd = pago.moneda === "USD";
  const equivalenteUsd = pagoToUsd(pago);
  const montoBsDisplay = pagoMontoEnBs(pago);
  const metodosDisponibles = useMemo(
    () =>
      isUsd
        ? metodosPago.filter((m) => detectarMetodoUsd(m))
        : metodosPago.filter((m) => detectarMetodoBs(m)),
    [metodosPago, isUsd],
  );
  const colors =
    numero === 1
      ? {
          ring: "border-sky-400/20 bg-sky-400/[0.03]",
          badge: "bg-sky-500/15 text-sky-300",
        }
      : {
          ring: "border-violet-400/20 bg-violet-400/[0.03]",
          badge: "bg-violet-500/15 text-violet-300",
        };
  return (
    <div className={`rounded-xl border p-3 ${colors.ring}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${colors.badge}`}
          >
            {numero}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
            Pago {numero}
          </span>
        </div>
        {(parseFloat(pago.monto) || 0) > 0 && (
          <span className="text-sm font-bold text-white">
            {isUsd
              ? formatearMoneda(equivalenteUsd, "USD")
              : formatearMoneda(montoBsDisplay, "BS")}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Moneda</label>
          <select
            value={pago.moneda}
            onChange={(e) =>
              onChange({
                moneda: e.target.value as "USD" | "BS",
                metodoId: "",
                monto: "",
                tasaBcv: null,
                montoBs: null,
              })
            }
            className={inputCls}
          >
            <option value="USD" className="bg-[#0d1120]">
              USD
            </option>
            <option value="BS" className="bg-[#0d1120]">
              Bolívares
            </option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Método</label>
          <select
            value={pago.metodoId}
            onChange={(e) => onChange({ metodoId: e.target.value })}
            className={inputCls}
          >
            <option value="" className="bg-[#0d1120]">
              Seleccionar…
            </option>
            {metodosDisponibles.map((m) => (
              <option key={m.id} value={m.id} className="bg-[#0d1120]">
                {m.nombre}
                {m.moneda ? ` · ${m.moneda}` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-2">
        <label className={labelCls}>{isUsd ? "Monto USD" : "Monto Bs"}</label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={pago.monto}
          onChange={(e) => onChange({ monto: e.target.value })}
          className={inputCls}
          placeholder="0.00"
        />
      </div>
      {!isUsd && (
        <div className="mt-2">
          <PagoBsSelector
            fecha={fecha}
            montoUsd={equivalenteUsd}
            montoBs={parseFloat(pago.monto) || null}
            onChangeTasa={(tasa) => onChange({ tasaBcv: tasa })}
            onChangeMontoBs={(monto) =>
              onChange({ monto: String(monto), montoBs: monto })
            }
          />
        </div>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Referencia</label>
          <input
            type="text"
            value={pago.referencia}
            onChange={(e) => onChange({ referencia: e.target.value })}
            className={inputCls}
            placeholder="Comprobante…"
          />
        </div>
        <div>
          <label className={labelCls}>Notas</label>
          <input
            type="text"
            value={pago.notas}
            onChange={(e) => onChange({ notas: e.target.value })}
            className={inputCls}
            placeholder="Opcional…"
          />
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
  size = "sm",
}: {
  options: { value: string; label: React.ReactNode }[];
  value: string;
  onChange: (v: string) => void;
  size?: "sm" | "xs";
}) {
  return (
    <div className="flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-0.5">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-[10px] px-2.5 py-1.5 text-center transition ${size === "xs" ? "text-[10px]" : "text-xs"} font-semibold ${value === opt.value ? "bg-white/[0.08] text-white shadow-sm" : "text-white/35 hover:text-white/60"}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-white/[0.05]" />;
}


function ingresoTipoBadge(operacion: PagoOperacion) {
  const concepto = operacion.concepto.toLowerCase();
  const categoria = operacion.categoria.toLowerCase();
  const origen = operacion.tipo_origen.toLowerCase();
  if (!operacion.cliente_id && (origen === "producto" || categoria === "producto")) return "Venta rápida";
  if (categoria === "saldo_cliente" || origen === "saldo_cliente" || concepto.includes("saldo") || concepto.includes("recarga")) return "Saldo";
  if (origen === "producto" || categoria === "producto" || operacion.inventario_id) return "Producto";
  if ((operacion.items as any[]).some((i) => i.cliente_plan_id) || origen.includes("plan") || origen.includes("cliente_plan") || categoria.includes("plan") || concepto.includes("plan")) return "Plan";
  if ((operacion.items as any[]).some((i) => i.cita_id) || origen.includes("cita") || categoria.includes("cita") || concepto.includes("cita") || concepto.includes("sesión") || concepto.includes("sesion")) return "Cita";
  if (origen.includes("abono") || categoria.includes("abono") || concepto.includes("abono") || concepto.includes("deuda")) return "Abono";
  return operacion.categoria || operacion.tipo_origen || "Ingreso";
}

function esOperacionEditableDesdeIngresos(operacion: PagoOperacion) {
  const tipo = ingresoTipoBadge(operacion).toLowerCase();
  return tipo === "producto" || tipo === "venta rápida" || tipo === "saldo";
}

function metodoLinea(item: PagoItem) {
  const metodo = item.metodos_pago_v2;
  const cartera = metodo?.cartera?.nombre || "Sin cartera";
  const moneda = metodo?.moneda || item.moneda_pago || "USD";
  return `${metodo?.nombre || "Método"} · ${cartera} · ${moneda}`;
}

function OperacionDetalleDrawer({
  operacion,
  onClose,
}: {
  operacion: PagoOperacion | null;
  onClose: () => void;
}) {
  const open = !!operacion;
  const tasaPrincipal = operacion?.items.find((item) => Number(item.tasa_bcv || 0) > 0)?.tasa_bcv || null;
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] transition-all duration-300 ${open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        className={`fixed bottom-4 right-4 top-4 z-50 flex w-[430px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#080b18]/95 shadow-[0_24px_90px_rgba(0,0,0,0.65)] backdrop-blur-xl transition-all duration-300 ease-out ${open ? "translate-x-0 opacity-100" : "translate-x-[115%] opacity-0"}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-400/[0.05] via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/30 to-transparent" />
        {operacion && (
          <>
            <div className="relative z-10 flex items-start justify-between gap-3 border-b border-white/[0.06] bg-[#080b18]/90 px-5 py-4 backdrop-blur-xl">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300/80">Detalle de ingreso</p>
                <h2 className="mt-1 line-clamp-2 text-lg font-bold leading-tight text-white">{operacion.concepto}</h2>
                <p className="mt-1 text-xs text-white/35">{operacion.fecha} · {ingresoTipoBadge(operacion)} · {operacion.estado}</p>
              </div>
              <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white/45 transition hover:bg-white/[0.08] hover:text-white" aria-label="Cerrar detalle">✕</button>
            </div>

            <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-3 py-2">
                  <p className="text-[9px] uppercase tracking-widest text-emerald-300/60">Total USD</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-emerald-300">{formatearMoneda(operacion.total_usd, "USD")}</p>
                </div>
                <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2">
                  <p className="text-[9px] uppercase tracking-widest text-amber-300/60">Total BS</p>
                  <p className="mt-1 text-sm font-bold tabular-nums text-amber-300">{formatearMoneda(operacion.total_bs, "BS")}</p>
                </div>
                <div className="rounded-xl border border-violet-400/15 bg-violet-400/[0.05] px-3 py-2">
                  <p className="text-[9px] uppercase tracking-widest text-violet-300/60">Cliente</p>
                  <p className="mt-1 truncate text-sm font-bold text-violet-100">{operacion.cliente_nombre || "Venta rápida / sin cliente"}</p>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                  <p className="text-[9px] uppercase tracking-widest text-white/30">Operación</p>
                  <p className="mt-1 truncate text-sm font-bold text-white/70">{operacion.operacion_pago_id || operacion.id_representativo}</p>
                </div>
              </div>

              <Divider />

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-white/30">Movimientos de pago</p>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/45">{operacion.items.length}</span>
                </div>
                {operacion.items.map((item, index) => (
                  <div key={item.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-3 transition hover:bg-white/[0.045]">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">Ingreso</span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/50">Pago {item.pago_item_no || index + 1}</span>
                      <span className="text-[10px] text-white/25">{item.fecha}</span>
                    </div>
                    <p className="text-xs font-semibold text-white">{metodoLinea(item)}</p>
                    <p className="mt-1 text-[11px] text-white/35">Cartera: {item.metodos_pago_v2?.cartera?.nombre || "Sin cartera"} · Categoría: {item.categoria}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                        <p className="text-[9px] uppercase tracking-widest text-white/25">Monto origen</p>
                        <p className="mt-1 text-xs font-bold text-white">{formatearMoneda(Number(item.monto ?? item.monto_pago ?? 0), item.moneda_pago === "BS" || item.moneda_pago === "VES" ? "BS" : "USD")}</p>
                      </div>
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-2.5 py-2">
                        <p className="text-[9px] uppercase tracking-widest text-white/25">Equivalente</p>
                        <p className="mt-1 text-xs font-bold text-emerald-300">{formatearMoneda(Number(item.monto_equivalente_usd || 0), "USD")}</p>
                        <p className="text-[10px] text-amber-300/80">{formatearMoneda(Number(item.monto_equivalente_bs || 0), "BS")}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-white/30">
                      {item.referencia && <span>Ref: #{item.referencia}</span>}
                      {item.tasa_bcv && <span>Tasa: {item.tasa_bcv}</span>}
                      {item.notas && <span>Nota: {item.notas}</span>}
                    </div>
                  </div>
                ))}
              </div>

              <Divider />

              <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/30">Resumen técnico</p>
                <div className="space-y-1 text-[11px] text-white/45">
                  <p><span className="text-white/25">Tipo origen:</span> {operacion.tipo_origen || "—"}</p>
                  <p><span className="text-white/25">Categoría:</span> {operacion.categoria || "—"}</p>
                  <p><span className="text-white/25">Producto / inventario:</span> {operacion.inventario_id || "—"}</p>
                  <p><span className="text-white/25">Cantidad:</span> {operacion.cantidad_producto || "—"}</p>
                  {tasaPrincipal && <p><span className="text-white/25">Tasa BCV usada:</span> {tasaPrincipal}</p>}
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function LoadingIngresos() {
  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="h-20 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
        <div className="h-[600px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
      </div>
    </div>
  );
}

export default function IngresosPage() {
  return (
    <Suspense fallback={<LoadingIngresos />}>
      <IngresosPageContent />
    </Suspense>
  );
}

// ─── Page content (lógica idéntica al original) ───────────────────────────────

function IngresosPageContent() {
  const searchParams = useSearchParams();
  const clientePrefill =
    searchParams.get("cliente") || searchParams.get("clienteId") || "";
  const empleadoPrefill =
    searchParams.get("empleado") || searchParams.get("empleadoId") || "";
  const tipoIngresoPrefill = searchParams.get("tipoIngreso");
  const destinoPrefill = searchParams.get("destino") || "";
  const cuentaPrefill =
    searchParams.get("cuenta") || searchParams.get("cuentaId") || "";

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pagos, setPagos] = useState<PagoItem[]>([]);
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoConsumidor[]>([]);
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltroIngreso>("todos");
  const [productoFiltro, setProductoFiltro] = useState("todos");
  const [clienteFiltro, setClienteFiltro] = useState("todos");
  const [metodoFiltro, setMetodoFiltro] = useState("todos");
  const [fechaDesdeFiltro, setFechaDesdeFiltro] = useState("");
  const [fechaHastaFiltro, setFechaHastaFiltro] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [detalleOperacion, setDetalleOperacion] = useState<PagoOperacion | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingOperacionId, setEditingOperacionId] = useState<string | null>(
    null,
  );
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [tipoIngreso, setTipoIngreso] = useState<TipoIngresoUI>("producto");
  const [tipoConsumidor, setTipoConsumidor] =
    useState<TipoConsumidor>("cliente");
  const [clienteId, setClienteId] = useState("");
  const [empleadoId, setEmpleadoId] = useState("");
  const [modoCobroEmpleadoProducto, setModoCobroEmpleadoProducto] =
    useState<ModoCobroEmpleadoProducto>("pagado");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [productosVenta, setProductosVenta] = useState<ProductoVentaItem[]>(
    () => [nuevoProductoVentaItem()],
  );
  const [concepto, setConcepto] = useState("");
  const [notas, setNotas] = useState("");
  const [ventaSinCliente, setVentaSinCliente] = useState(false);
  const [pagoConDeudaState, setPagoConDeudaState] = useState<PagoConDeudaState>(
    pagoConDeudaInitial(),
  );
  const [tipoPago, setTipoPago] = useState<"unico" | "mixto">("unico");
  const [monedaPagoUnico, setMonedaPagoUnico] = useState<"USD" | "BS">("USD");
  const [metodoPagoUnicoId, setMetodoPagoUnicoId] = useState("");
  const [referenciaPagoUnico, setReferenciaPagoUnico] = useState("");
  const [notasPagoUnico, setNotasPagoUnico] = useState("");
  const [tasaPagoUnico, setTasaPagoUnico] = useState<number | null>(null);
  const [montoPagoUnicoBs, setMontoPagoUnicoBs] = useState<number | null>(null);
  const pagoMixtoVacio = (moneda: "USD" | "BS" = "USD"): PagoMixtoFormItem => ({
    moneda,
    metodoId: "",
    monto: "",
    referencia: "",
    notas: "",
    tasaBcv: null,
    montoBs: null,
  });
  const [pagoMixto1, setPagoMixto1] = useState<PagoMixtoFormItem>(
    pagoMixtoVacio("USD"),
  );
  const [pagoMixto2, setPagoMixto2] = useState<PagoMixtoFormItem>(
    pagoMixtoVacio("BS"),
  );
  const [estadoCuentaCliente, setEstadoCuentaCliente] =
    useState<EstadoCuentaCliente | null>(null);
  const [cuentasPendientesCliente, setCuentasPendientesCliente] = useState<
    CuentaPendienteResumen[]
  >([]);
  const [estadoCuentaEmpleado, setEstadoCuentaEmpleado] =
    useState<EstadoCuentaEmpleado | null>(null);
  const [cuentasPendientesEmpleado, setCuentasPendientesEmpleado] = useState<
    CuentaPendienteEmpleadoResumen[]
  >([]);
  const [destinoSaldo, setDestinoSaldo] = useState<DestinoSaldo>("credito");
  const [cuentaCobrarSeleccionadaId, setCuentaCobrarSeleccionadaId] =
    useState("");
  const [montoAbonoDeuda, setMontoAbonoDeuda] = useState("");
  const [montoActualizarDeudaUSD, setMontoActualizarDeudaUSD] = useState("");
  const [montoManualUSD, setMontoManualUSD] = useState("");

  // ─── Derived (idéntico al original) ──────────────────────────────────────

  const clienteSeleccionado = useMemo(
    () => clientes.find((c) => c.id === clienteId) || null,
    [clientes, clienteId],
  );
  const empleadoSeleccionado = useMemo(
    () => empleados.find((e) => e.id === empleadoId) || null,
    [empleados, empleadoId],
  );
  const productoSeleccionado = useMemo(
    () => productos.find((p) => p.id === productoId) || null,
    [productos, productoId],
  );
  const productosVentaDetalle = useMemo(
    () =>
      productosVenta
        .map((item) => {
          const producto =
            productos.find((p) => p.id === item.productoId) || null;
          const cantidadItem = Math.max(1, Number(item.cantidad || 1));
          const precio = Number(producto?.precio_venta_usd || 0);
          return {
            uid: item.uid,
            productoId: item.productoId,
            producto,
            cantidad: cantidadItem,
            precioUnitarioUSD: precio,
            totalUSD: r2(cantidadItem * precio),
          };
        })
        .filter((item) => item.productoId && item.producto),
    [productosVenta, productos],
  );
  const productoPrincipal = useMemo(
    () => productosVentaDetalle[0]?.producto || productoSeleccionado,
    [productosVentaDetalle, productoSeleccionado],
  );
  const productoPrincipalId = useMemo(
    () => productosVentaDetalle[0]?.productoId || productoId,
    [productosVentaDetalle, productoId],
  );
  const cantidadPrincipal = useMemo(
    () => productosVentaDetalle[0]?.cantidad || cantidad,
    [productosVentaDetalle, cantidad],
  );
  const resumenProductosVenta = useMemo(() => {
    if (productosVentaDetalle.length === 0) return "";
    return productosVentaDetalle
      .map((item) => `${item.producto?.nombre || "Producto"} x${item.cantidad}`)
      .join(" + ");
  }, [productosVentaDetalle]);
  const cantidadTotalProductos = useMemo(
    () => productosVentaDetalle.reduce((sum, item) => sum + item.cantidad, 0),
    [productosVentaDetalle],
  );
  const precioUnitarioUSD = Number(productoPrincipal?.precio_venta_usd || 0);
  const totalUSD = useMemo(
    () =>
      r2(productosVentaDetalle.reduce((sum, item) => sum + item.totalUSD, 0)),
    [productosVentaDetalle],
  );
  const stockInsuficiente = useMemo(() => {
    const usados = new Map<string, number>();
    for (const item of productosVentaDetalle)
      usados.set(
        item.productoId,
        (usados.get(item.productoId) || 0) + item.cantidad,
      );
    return Array.from(usados.entries()).some(([id, cant]) => {
      const prod = productos.find((p) => p.id === id);
      return cant > Number(prod?.cantidad_actual || 0);
    });
  }, [productosVentaDetalle, productos]);
  const cuentaPendienteSeleccionada = useMemo(
    () =>
      tipoConsumidor === "empleado"
        ? cuentasPendientesEmpleado.find(
            (c) => c.id === cuentaCobrarSeleccionadaId,
          ) || null
        : cuentasPendientesCliente.find(
            (c) => c.id === cuentaCobrarSeleccionadaId,
          ) || null,
    [
      tipoConsumidor,
      cuentasPendientesCliente,
      cuentasPendientesEmpleado,
      cuentaCobrarSeleccionadaId,
    ],
  );
  const clienteTieneDeuda = useMemo(
    () => cuentasPendientesCliente.some((c) => Number(c.saldo_usd || 0) > 0.01),
    [cuentasPendientesCliente],
  );
  const empleadoTieneDeuda = useMemo(
    () =>
      cuentasPendientesEmpleado.some((c) => Number(c.saldo_usd || 0) > 0.01),
    [cuentasPendientesEmpleado],
  );
  const montoAbonoDeudaNumero = useMemo(
    () => r2(Number(montoAbonoDeuda || 0)),
    [montoAbonoDeuda],
  );
  const montoActualizarDeudaNumero = useMemo(
    () => r2(Number(montoActualizarDeudaUSD || 0)),
    [montoActualizarDeudaUSD],
  );
  const saldoBaseDeudaParaAbono = useMemo(() => {
    const saldoActual = r2(Number(cuentaPendienteSeleccionada?.saldo_usd || 0));
    return montoActualizarDeudaUSD.trim() !== ""
      ? montoActualizarDeudaNumero
      : saldoActual;
  }, [
    cuentaPendienteSeleccionada,
    montoActualizarDeudaUSD,
    montoActualizarDeudaNumero,
  ]);
  const restanteDeudaPreview = useMemo(
    () => r2(Math.max(0, saldoBaseDeudaParaAbono - montoAbonoDeudaNumero)),
    [saldoBaseDeudaParaAbono, montoAbonoDeudaNumero],
  );
  const montoManualUSDNumero = useMemo(
    () => r2(Number(montoManualUSD || 0)),
    [montoManualUSD],
  );
  const esRecargaSaldoCredito =
    tipoIngreso === "saldo" && destinoSaldo === "credito";
  const montoObjetivoPagoRapidoUsd = useMemo(() => {
    if (tipoIngreso === "saldo" && destinoSaldo === "deuda")
      return montoAbonoDeudaNumero;
    if (esRecargaSaldoCredito) {
      if (tipoPago === "unico" && monedaPagoUnico === "BS") {
        const bsReal = Number(montoPagoUnicoBs || 0);
        if (!tasaPagoUnico || tasaPagoUnico <= 0 || bsReal <= 0) return 0;
        return r2(bsReal / tasaPagoUnico);
      }
      return montoManualUSDNumero;
    }
    return totalUSD;
  }, [
    tipoIngreso,
    destinoSaldo,
    esRecargaSaldoCredito,
    tipoPago,
    monedaPagoUnico,
    montoAbonoDeudaNumero,
    montoManualUSDNumero,
    montoPagoUnicoBs,
    tasaPagoUnico,
    totalUSD,
  ]);
  const creditoDisponibleUsd = useMemo(
    () => r2(Number(estadoCuentaCliente?.credito_disponible_usd || 0)),
    [estadoCuentaCliente],
  );
  const metodosPagoBase = useMemo(
    (): MetodoPagoBase[] =>
      metodosPago.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        tipo: m.tipo,
        moneda: m.moneda,
        cartera: m.cartera
          ? { nombre: m.cartera.nombre, codigo: m.cartera.codigo }
          : null,
      })),
    [metodosPago],
  );
  const pagoConDeudaKey = useMemo(
    () =>
      `producto-${productosVenta.map((i) => `${i.productoId}:${i.cantidad}`).join("|") || "sin-producto"}-${totalUSD}-${clienteId || "sin-cliente"}-${fecha}`,
    [productosVenta, totalUSD, clienteId, fecha],
  );
  const totalPagoMixtoUsd = useMemo(
    () => r2(pagoToUsd(pagoMixto1) + pagoToUsd(pagoMixto2)),
    [pagoMixto1, pagoMixto2],
  );
  const totalPagoUnicoBs = useMemo(
    () =>
      monedaPagoUnico !== "BS" || !tasaPagoUnico || tasaPagoUnico <= 0
        ? 0
        : r2(montoObjetivoPagoRapidoUsd * tasaPagoUnico),
    [monedaPagoUnico, tasaPagoUnico, montoObjetivoPagoRapidoUsd],
  );
  const totalPagoUnicoRealUsd = useMemo(() => {
    if (tipoPago !== "unico") return 0;
    if (monedaPagoUnico !== "BS") return r2(montoObjetivoPagoRapidoUsd);
    const bsReal = Number(montoPagoUnicoBs || 0);
    if (!tasaPagoUnico || tasaPagoUnico <= 0 || bsReal <= 0) return 0;
    return r2(bsReal / tasaPagoUnico);
  }, [
    tipoPago,
    monedaPagoUnico,
    montoObjetivoPagoRapidoUsd,
    montoPagoUnicoBs,
    tasaPagoUnico,
  ]);
  const totalPagoRapidoRealUsd = useMemo(
    () => (tipoPago === "unico" ? totalPagoUnicoRealUsd : totalPagoMixtoUsd),
    [tipoPago, totalPagoUnicoRealUsd, totalPagoMixtoUsd],
  );
  const metodosPagoUnicoDisponibles = useMemo(
    () =>
      monedaPagoUnico === "USD"
        ? metodosPago.filter(detectarMetodoUsd)
        : metodosPago.filter(detectarMetodoBs),
    [metodosPago, monedaPagoUnico],
  );
  const resumenPagosMixtoRapido = useMemo(() => {
    const usd1 = pagoToUsd(pagoMixto1);
    const usd2 = pagoToUsd(pagoMixto2);
    const totalUsd = r2(usd1 + usd2);
    const totalBs = r2(pagoMontoEnBs(pagoMixto1) + pagoMontoEnBs(pagoMixto2));
    const esRecargaSaldoLibre =
      tipoIngreso === "saldo" && destinoSaldo === "credito";
    const totalObjetivo = esRecargaSaldoLibre
      ? totalUsd
      : montoObjetivoPagoRapidoUsd;
    const diff = r2(totalObjetivo - totalUsd);
    const faltante = r2(Math.max(diff, 0));
    const cuadra = esRecargaSaldoLibre
      ? totalUsd > 0
      : Math.abs(diff) < 0.01 && totalObjetivo > 0;
    const pct1 =
      totalObjetivo > 0 ? Math.round((usd1 / totalObjetivo) * 100) : 0;
    const pct2 =
      totalObjetivo > 0 ? Math.round((usd2 / totalObjetivo) * 100) : 0;
    const p1Valido =
      !!pagoMixto1.metodoId &&
      (pagoMixto1.moneda === "USD"
        ? (parseFloat(pagoMixto1.monto) || 0) > 0
        : (parseFloat(pagoMixto1.monto) || 0) > 0 &&
          (pagoMixto1.tasaBcv || 0) > 0);
    const p2Valido =
      !!pagoMixto2.metodoId &&
      (pagoMixto2.moneda === "USD"
        ? (parseFloat(pagoMixto2.monto) || 0) > 0
        : (parseFloat(pagoMixto2.monto) || 0) > 0 &&
          (pagoMixto2.tasaBcv || 0) > 0);
    return {
      usd1,
      usd2,
      totalUsd,
      totalBs,
      faltante,
      cuadra,
      pct1,
      pct2,
      p1Valido,
      p2Valido,
      totalObjetivo,
      esRecargaSaldoLibre,
    };
  }, [
    pagoMixto1,
    pagoMixto2,
    tipoIngreso,
    destinoSaldo,
    montoObjetivoPagoRapidoUsd,
  ]);

  // ─── Effects (idénticos al original) ─────────────────────────────────────

  useEffect(() => {
    void cargarDatos();
  }, []);
  useEffect(() => {
    if (!ventaSinCliente && tipoConsumidor === "cliente")
      void cargarEstadoCuentaCliente(clienteId);
  }, [clienteId, ventaSinCliente, tipoConsumidor]);
  useEffect(() => {
    if (!ventaSinCliente && tipoConsumidor === "empleado")
      void cargarEstadoCuentaEmpleado(empleadoId);
  }, [empleadoId, ventaSinCliente, tipoConsumidor]);
  useEffect(() => {
    if (!clientePrefill || clientes.length === 0 || editingId) return;
    if (!clientes.some((c) => c.id === clientePrefill)) return;
    setClienteId(clientePrefill);
    setShowForm(true);
    if (tipoIngresoPrefill === "saldo") {
      setTipoIngreso("saldo");
      if (destinoPrefill === "deuda") {
        setDestinoSaldo("deuda");
        setConcepto("Abono a deuda");
      } else {
        setDestinoSaldo("credito");
        setConcepto("Recarga de saldo a favor");
      }
    }
  }, [clientePrefill, tipoIngresoPrefill, destinoPrefill, clientes, editingId]);
  useEffect(() => {
    if (!empleadoPrefill || empleados.length === 0 || editingId) return;
    if (!empleados.some((e) => e.id === empleadoPrefill)) return;
    setTipoConsumidor("empleado");
    setEmpleadoId(empleadoPrefill);
    setShowForm(true);
    if (tipoIngresoPrefill === "saldo") {
      setTipoIngreso("saldo");
      if (destinoPrefill === "deuda") {
        setDestinoSaldo("deuda");
        setConcepto("Abono a deuda de empleado");
      } else {
        setDestinoSaldo("credito");
        setConcepto("Recarga de saldo a favor de empleado");
      }
    }
  }, [
    empleadoPrefill,
    tipoIngresoPrefill,
    destinoPrefill,
    empleados,
    editingId,
  ]);
  useEffect(() => {
    const cuentasActivas =
      tipoConsumidor === "empleado"
        ? cuentasPendientesEmpleado
        : cuentasPendientesCliente;
    if (cuentasActivas.length > 0) {
      if (cuentaPrefill && cuentasActivas.some((c) => c.id === cuentaPrefill)) {
        setCuentaCobrarSeleccionadaId(cuentaPrefill);
        return;
      }
      setCuentaCobrarSeleccionadaId((prev) => {
        if (prev && cuentasActivas.some((c) => c.id === prev)) return prev;
        return cuentasActivas[0].id;
      });
    } else {
      setCuentaCobrarSeleccionadaId("");
      setMontoAbonoDeuda("");
      setMontoActualizarDeudaUSD("");
      if (destinoSaldo === "deuda") setDestinoSaldo("credito");
    }
  }, [
    tipoConsumidor,
    cuentasPendientesCliente,
    cuentasPendientesEmpleado,
    cuentaPrefill,
    destinoSaldo,
  ]);
  useEffect(() => {
    if (destinoSaldo === "deuda" && cuentaPendienteSeleccionada)
      setConcepto(`Abono: ${cuentaPendienteSeleccionada.concepto}`);
  }, [destinoSaldo, cuentaCobrarSeleccionadaId]);
  useEffect(() => {
    if (destinoSaldo !== "deuda") {
      setMontoAbonoDeuda("");
      setMontoActualizarDeudaUSD("");
      return;
    }
    if (!cuentaPendienteSeleccionada) {
      setMontoAbonoDeuda("");
      setMontoActualizarDeudaUSD("");
      return;
    }
    const saldo = r2(Number(cuentaPendienteSeleccionada.saldo_usd || 0));
    setMontoAbonoDeuda((prev) => {
      const prevNum = Number(prev || 0);
      if (!prev || prevNum <= 0 || prevNum > saldo)
        return saldo > 0 ? String(saldo) : "";
      return String(r2(prevNum));
    });
    setMontoActualizarDeudaUSD("");
  }, [destinoSaldo, cuentaPendienteSeleccionada]);
  useEffect(() => {
    setMetodoPagoUnicoId("");
  }, [monedaPagoUnico]);
  useEffect(() => {
    if (tipoIngreso !== "saldo" || destinoSaldo !== "credito")
      setMontoManualUSD("");
  }, [tipoIngreso, destinoSaldo]);
  useEffect(() => {
    if (tipoPago === "mixto" && !editingId) {
      setPagoMixto1(pagoMixtoVacio("USD"));
      setPagoMixto2(pagoMixtoVacio("BS"));
    }
  }, [tipoPago, editingId]);
  useEffect(() => {
    if (ventaSinCliente) {
      setClienteId("");
      setEmpleadoId("");
      setEstadoCuentaCliente(null);
      setCuentasPendientesCliente([]);
      setEstadoCuentaEmpleado(null);
      setCuentasPendientesEmpleado([]);
      setTipoIngreso("producto");
      setDestinoSaldo("credito");
    }
  }, [ventaSinCliente]);
  useEffect(() => {
    setPagoConDeudaState(pagoConDeudaInitial());
  }, [
    productosVenta,
    clienteId,
    empleadoId,
    tipoIngreso,
    tipoConsumidor,
    totalUSD,
  ]);
  useEffect(() => {
    if (editingId) return;
    if (tipoIngreso !== "producto") return;
    if (!resumenProductosVenta) return;
    setConcepto(`Venta de ${resumenProductosVenta}`);
  }, [editingId, tipoIngreso, resumenProductosVenta]);

  // ─── Loaders / helpers / submit / reset / edit (todos idénticos al original) ─

  async function cargarDatos() {
    setLoading(true);
    setLoadError("");
    try {
      const [pagosRes, metodosRes, productosRes, clientesRes, empleadosRes] =
        await Promise.all([
          supabase
            .from("pagos")
            .select(
              `id, operacion_pago_id, pago_item_no, pago_items_total, es_pago_mixto, fecha, concepto, categoria, tipo_origen, estado, moneda_pago, tasa_bcv, monto, monto_pago, monto_equivalente_usd, monto_equivalente_bs, cliente_id, cita_id, cliente_plan_id, inventario_id, cantidad_producto, metodo_pago_id, metodo_pago_v2_id, notas, referencia, metodos_pago_v2:metodo_pago_v2_id(id, nombre, tipo, moneda, cartera:cartera_id(nombre, codigo)), clientes:cliente_id(nombre)`,
            )
            .order("fecha", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("metodos_pago_v2")
            .select(`id, nombre, tipo, moneda, cartera:carteras(nombre, codigo)`)
            .eq("activo", true)
            .eq("permite_recibir", true),
          supabase
            .from("inventario")
            .select(
              `id, nombre, descripcion, cantidad_actual, unidad_medida, precio_venta_usd, estado`,
            )
            .eq("estado", "activo")
            .order("nombre"),
          supabase
            .from("clientes")
            .select("id, nombre, telefono, email")
            .order("nombre"),
          supabase
            .from("empleados")
            .select("id, nombre, telefono, email, rol")
            .eq("estado", "activo")
            .order("nombre"),
        ]);

      if (pagosRes.error) throw pagosRes.error;
      if (metodosRes.error) throw metodosRes.error;
      if (productosRes.error) throw productosRes.error;
      if (clientesRes.error) throw clientesRes.error;
      if (empleadosRes.error) throw empleadosRes.error;

      setPagos((pagosRes.data || []).map(normalizePago));
      setMetodosPago((metodosRes.data || []).map(normalizeMetodoPago));
      setProductos((productosRes.data || []) as Producto[]);
      setClientes((clientesRes.data || []) as Cliente[]);
      setEmpleados((empleadosRes.data || []) as EmpleadoConsumidor[]);
    } catch (err: any) {
      setLoadError(err?.message || "No se pudieron cargar los ingresos.");
      setPagos([]);
    } finally {
      setLoading(false);
    }
  }

  async function cargarEstadoCuentaCliente(id: string) {
    if (!id) {
      setEstadoCuentaCliente(null);
      setCuentasPendientesCliente([]);
      return;
    }
    const [estadoRes, cuentasRes] = await Promise.all([
      supabase
        .from("v_clientes_estado_cuenta")
        .select(
          `cliente_id, total_pendiente_usd, credito_disponible_usd, saldo_pendiente_neto_usd, saldo_favor_neto_usd, total_pendiente_bs, credito_disponible_bs, saldo_pendiente_neto_bs, saldo_favor_neto_bs`,
        )
        .eq("cliente_id", id)
        .maybeSingle(),
      supabase
        .from("v_cuentas_por_cobrar_resumen")
        .select(
          `id, cliente_id, cliente_nombre, concepto, monto_total_usd, monto_pagado_usd, saldo_usd, fecha_venta, fecha_vencimiento, estado`,
        )
        .eq("cliente_id", id)
        .in("estado", ["pendiente", "parcial", "vencida"])
        .order("fecha_venta", { ascending: true }),
    ]);
    setEstadoCuentaCliente(
      (estadoRes.data as EstadoCuentaCliente | null) ?? null,
    );
    setCuentasPendientesCliente(
      (cuentasRes.data || []) as CuentaPendienteResumen[],
    );
  }

  async function cargarEstadoCuentaEmpleado(id: string) {
    if (!id) {
      setEstadoCuentaEmpleado(null);
      setCuentasPendientesEmpleado([]);
      return;
    }
    const [estadoRes, cuentasRes] = await Promise.all([
      supabase
        .from("v_empleados_estado_cuenta")
        .select(
          `empleado_id, nombre, rol, total_pendiente_usd, credito_disponible_usd, saldo_pendiente_neto_usd, saldo_favor_neto_usd`,
        )
        .eq("empleado_id", id)
        .maybeSingle(),
      supabase
        .from("v_empleados_cuentas_por_cobrar_resumen")
        .select(
          `id, empleado_id, empleado_nombre, concepto, monto_total_usd, monto_pagado_usd, saldo_usd, fecha_venta, fecha_vencimiento, estado`,
        )
        .eq("empleado_id", id)
        .in("estado", ["pendiente", "parcial", "vencida"])
        .order("fecha_venta", { ascending: true }),
    ]);
    setEstadoCuentaEmpleado(
      (estadoRes.data as EstadoCuentaEmpleado | null) ?? null,
    );
    setCuentasPendientesEmpleado(
      (cuentasRes.data || []) as CuentaPendienteEmpleadoResumen[],
    );
  }

  async function limpiarCreditosExcedenteOperacion(operacionId: string | null) {
    if (!operacionId) return;
    const { data: creditos, error } = await supabase
      .from("clientes_credito")
      .select("id, monto_original, monto_disponible")
      .eq("origen_tipo", "pago_excedente")
      .eq("origen_id", operacionId);
    if (error) throw error;
    if (!creditos || creditos.length === 0) return;
    for (const credito of creditos) {
      if (
        Math.abs(
          Number(credito.monto_disponible || 0) -
            Number(credito.monto_original || 0),
        ) > 0.01
      )
        throw new Error(
          "Esta venta tiene un crédito generado que ya fue usado parcial o totalmente.",
        );
      const { data: ap } = await supabase
        .from("clientes_credito_aplicaciones")
        .select("id")
        .eq("credito_id", String(credito.id))
        .limit(1);
      if (ap && ap.length > 0)
        throw new Error("Esta venta tiene un crédito aplicado a otra deuda.");
    }
    const { error: deleteError } = await supabase
      .from("clientes_credito")
      .delete()
      .in(
        "id",
        creditos.map((c) => String(c.id)),
      );
    if (deleteError) throw deleteError;
  }

  async function crearCreditoCliente(args: {
    clienteId: string;
    operacionPagoId: string;
    excedenteUsd: number;
    descripcion: string;
    origenTipo?: string;
    tasaRef?: number | null;
  }) {
    const excedenteUsd = r2(args.excedenteUsd);
    if (excedenteUsd <= 0) return;
    const montoBs = args.tasaRef ? r2(excedenteUsd * args.tasaRef) : null;
    const { error } = await supabase
      .from("clientes_credito")
      .insert({
        cliente_id: args.clienteId,
        origen_tipo: args.origenTipo || "pago_excedente",
        origen_id: args.operacionPagoId,
        moneda: "USD",
        monto_original: excedenteUsd,
        monto_disponible: excedenteUsd,
        tasa_bcv: args.tasaRef || null,
        monto_original_bs: montoBs,
        monto_disponible_bs: montoBs,
        descripcion: args.descripcion,
        fecha,
        estado: "activo",
        registrado_por: null,
      });
    if (error) throw error;
  }

  async function descontarInventarioYCrearMovimiento(args: {
    pagoId?: string | null;
    productoId: string;
    cantidad: number;
    cantidadAnterior: number;
    cantidadNueva: number;
    precioUnitarioUSD: number;
    totalUSD: number;
    conceptoMovimiento: string;
  }) {
    const { error: invError } = await supabase
      .from("inventario")
      .update({ cantidad_actual: args.cantidadNueva })
      .eq("id", args.productoId);
    if (invError) throw invError;
    const { error: movError } = await supabase
      .from("movimientos_inventario")
      .insert({
        inventario_id: args.productoId,
        tipo: "salida",
        cantidad: args.cantidad,
        cantidad_anterior: args.cantidadAnterior,
        cantidad_nueva: args.cantidadNueva,
        concepto: args.conceptoMovimiento,
        precio_unitario_usd: args.precioUnitarioUSD,
        monto_total_usd: args.totalUSD,
        pago_id: args.pagoId || null,
      });
    if (movError) throw movError;
  }

  async function descontarInventarioVentaActual(
    pagoId: string | null,
    conceptoMovimiento: string,
  ) {
    for (const item of productosVentaDetalle) {
      const cantidadAnterior = Number(item.producto?.cantidad_actual || 0);
      await descontarInventarioYCrearMovimiento({
        pagoId,
        productoId: item.productoId,
        cantidad: item.cantidad,
        cantidadAnterior,
        cantidadNueva: cantidadAnterior - item.cantidad,
        precioUnitarioUSD: item.precioUnitarioUSD,
        totalUSD: item.totalUSD,
        conceptoMovimiento: `${conceptoMovimiento}: ${item.producto?.nombre || "Producto"} x${item.cantidad}`,
      });
    }
  }

  async function crearCreditoEmpleado(args: {
    empleadoId: string;
    operacionPagoId?: string | null;
    montoUsd: number;
    descripcion: string;
    origenTipo?: string;
    tasaRef?: number | null;
  }) {
    const montoUsd = r2(args.montoUsd);
    if (montoUsd <= 0) return;
    const montoBs = args.tasaRef ? r2(montoUsd * args.tasaRef) : null;
    const { error } = await supabase
      .from("empleados_credito")
      .insert({
        empleado_id: args.empleadoId,
        origen_tipo: args.origenTipo || "saldo_empleado",
        origen_id: args.operacionPagoId || null,
        moneda: "USD",
        monto_original: montoUsd,
        monto_disponible: montoUsd,
        tasa_bcv: args.tasaRef || null,
        monto_original_bs: montoBs,
        monto_disponible_bs: montoBs,
        descripcion: args.descripcion,
        fecha,
        estado: "activo",
        registrado_por: null,
      });
    if (error) throw error;
  }

  async function crearDeudaEmpleado(args: {
    empleadoId: string;
    empleadoNombre: string;
    concepto: string;
    montoUsd: number;
    inventarioId?: string | null;
    cantidadProducto?: number | null;
    notas?: string | null;
  }) {
    const montoUsd = r2(args.montoUsd);
    if (montoUsd <= 0) return;
    const { error } = await supabase
      .from("empleados_cuentas_por_cobrar")
      .insert({
        empleado_id: args.empleadoId,
        empleado_nombre: args.empleadoNombre,
        concepto: args.concepto,
        tipo_origen: args.inventarioId
          ? "venta_inventario_empleado"
          : "saldo_empleado",
        origen_tipo: args.inventarioId
          ? "venta_inventario_empleado"
          : "saldo_empleado",
        inventario_id: args.inventarioId || null,
        cantidad_producto: args.cantidadProducto || null,
        monto_total_usd: montoUsd,
        monto_pagado_usd: 0,
        saldo_usd: montoUsd,
        fecha_venta: fecha,
        fecha_vencimiento: null,
        estado: "pendiente",
        notas: args.notas || null,
        registrado_por: null,
        moneda: "USD",
      });
    if (error) throw error;
  }

  async function registrarAbonoDeudaEmpleado(args: {
    cuentaCobrarId: string;
    empleadoId: string;
    montoUsd: number;
    notas?: string | null;
  }) {
    const montoUsd = r2(args.montoUsd);
    if (montoUsd <= 0) return;
    const { error } = await supabase
      .from("empleados_abonos_cobranza")
      .insert({
        cuenta_cobrar_id: args.cuentaCobrarId,
        empleado_id: args.empleadoId,
        fecha,
        monto_usd: montoUsd,
        notas: args.notas || null,
        registrado_por: null,
      });
    if (error) throw error;
  }

  function buildPagosPayloadRapido() {
    if (tipoPago === "unico") {
      const montoBsReal = r2(Number(montoPagoUnicoBs || 0));
      return [
        {
          metodo_pago_v2_id: metodoPagoUnicoId,
          moneda_pago: monedaPagoUnico,
          monto:
            monedaPagoUnico === "BS"
              ? montoBsReal > 0
                ? montoBsReal
                : r2(totalPagoUnicoBs)
              : r2(montoObjetivoPagoRapidoUsd),
          tasa_bcv: monedaPagoUnico === "BS" ? tasaPagoUnico : null,
          referencia: referenciaPagoUnico || null,
          notas: notasPagoUnico || null,
        },
      ];
    }
    return [pagoMixto1, pagoMixto2].map((item, index) => {
      const monto = parseFloat(item.monto);
      if (!Number.isFinite(monto) || monto <= 0)
        throw new Error(`El Pago ${index + 1} debe tener monto mayor a 0.`);
      return {
        metodo_pago_v2_id: item.metodoId,
        moneda_pago: item.moneda,
        monto: r2(monto),
        tasa_bcv: item.moneda === "BS" ? item.tasaBcv : null,
        referencia: item.referencia || null,
        notas: item.notas || null,
      };
    });
  }

  function validarPagoRapido(): string | null {
    if (tipoPago === "unico") {
      if (!metodoPagoUnicoId) return "Selecciona el método de pago.";
      if (monedaPagoUnico === "BS" && (!tasaPagoUnico || tasaPagoUnico <= 0))
        return "Selecciona una tasa válida para el pago en bolívares.";
      if (monedaPagoUnico === "BS" && Number(montoPagoUnicoBs || 0) <= 0)
        return "El monto en bolívares debe ser mayor a 0.";
      if (
        monedaPagoUnico === "USD" &&
        (!montoObjetivoPagoRapidoUsd || montoObjetivoPagoRapidoUsd <= 0)
      )
        return esRecargaSaldoCredito
          ? "Indica el monto a recargar en USD."
          : "El monto debe ser mayor a 0.";
      if (monedaPagoUnico === "BS" && totalPagoUnicoRealUsd <= 0)
        return "No se pudo convertir el monto en bolívares a USD.";
      return null;
    }
    if (!resumenPagosMixtoRapido.p1Valido)
      return "Completa el Pago 1: método, monto y tasa.";
    if (!resumenPagosMixtoRapido.p2Valido)
      return "Completa el Pago 2: método, monto y tasa.";
    if (resumenPagosMixtoRapido.totalUsd <= 0)
      return "La suma de los pagos debe ser mayor a 0.";
    if (
      !resumenPagosMixtoRapido.esRecargaSaldoLibre &&
      !resumenPagosMixtoRapido.cuadra
    )
      return `La suma no cuadra. Faltante: ${formatearMoneda(resumenPagosMixtoRapido.faltante, "USD")}`;
    return null;
  }

  async function registrarPagoMixtoProducto(args: {
    fecha: string;
    concepto: string;
    clienteId: string | null;
    inventarioId: string;
    cantidad: number;
    notasGenerales: string | null;
    pagos: any[];
  }) {
    const { data, error } = await supabase.rpc("registrar_pagos_mixtos", {
      p_fecha: args.fecha,
      p_tipo_origen: "producto",
      p_categoria: "producto",
      p_concepto: args.concepto,
      p_cliente_id: args.clienteId || null,
      p_cita_id: null,
      p_cliente_plan_id: null,
      p_cuenta_cobrar_id: null,
      p_inventario_id: args.inventarioId,
      p_registrado_por: null,
      p_notas_generales: args.notasGenerales,
      p_pagos: args.pagos,
    });
    if (error) throw error;
    const operacionPagoId = data?.operacion_pago_id || null;
    if (operacionPagoId)
      await supabase
        .from("pagos")
        .update({
          inventario_id: args.inventarioId,
          cantidad_producto: args.cantidad,
        })
        .eq("operacion_pago_id", operacionPagoId);
    return operacionPagoId as string | null;
  }

  async function obtenerPagoRealIdPorOperacion(operacionPagoId: string | null) {
    if (!operacionPagoId) return null;
    const { data, error } = await supabase
      .from("pagos")
      .select("id")
      .eq("operacion_pago_id", operacionPagoId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.id || null;
  }

  async function registrarPagoMixtoSaldo(args: {
    fecha: string;
    concepto: string;
    clienteId: string;
    notasGenerales: string | null;
    pagos: any[];
  }) {
    const { data, error } = await supabase.rpc("registrar_pagos_mixtos", {
      p_fecha: args.fecha,
      p_tipo_origen: "saldo_cliente",
      p_categoria: "saldo_cliente",
      p_concepto: args.concepto,
      p_cliente_id: args.clienteId,
      p_cita_id: null,
      p_cliente_plan_id: null,
      p_cuenta_cobrar_id: null,
      p_inventario_id: null,
      p_registrado_por: null,
      p_notas_generales: args.notasGenerales,
      p_pagos: args.pagos,
    });
    if (error) throw error;
    return data?.operacion_pago_id || null;
  }

  async function ajustarCuentaCobrarClienteParaAbono(args: {
    cuenta: CuentaPendienteResumen;
    montoAbonoUsd: number;
  }) {
    const saldoActual = r2(Number(args.cuenta.saldo_usd || 0));
    const montoAbonoUsd = r2(args.montoAbonoUsd);
    const diferencia = r2(montoAbonoUsd - saldoActual);

    // Solo se ajusta ANTES cuando el pago real supera el saldo. Esto evita que el abono falle
    // por diferencias de tasa/bolívares, pero no toca monto_pagado_usd para no duplicar el abono.
    if (diferencia <= 0.01) return;

    const totalActual = r2(Number(args.cuenta.monto_total_usd || 0));
    const pagadoActual = r2(Number(args.cuenta.monto_pagado_usd || 0));
    const nuevoTotal = r2(totalActual + diferencia);
    const nuevoSaldo = r2(Math.max(nuevoTotal - pagadoActual, 0));

    const { error } = await supabase
      .from("cuentas_por_cobrar")
      .update({
        monto_total_usd: nuevoTotal,
        saldo_usd: nuevoSaldo,
        estado:
          nuevoSaldo <= 0.01
            ? "cobrada"
            : pagadoActual > 0
              ? "parcial"
              : "pendiente",
        notas: "Ajuste automático por pago superior a la deuda.",
      })
      .eq("id", args.cuenta.id);

    if (error) throw error;
  }

  async function sincronizarCuentaCobrarClienteDesdeAbonos(args: {
    cuentaId: string;
    montoNuevoAbonoUsd: number;
    montoPagadoBaseUsd: number;
  }) {
    // IMPORTANTE:
    // El abono posterior debe sumar sobre el pagado que tenía la deuda ANTES
    // de llamar registrarAbonoMixto. Esa función/RPC puede recalcular usando solo
    // los abonos posteriores y perder el pago inicial del plan/cita.
    //
    // Ejemplo correcto:
    // total 110, pagado inicial 50, abono nuevo 60 => pagado 110, saldo 0.
    // Ejemplo incorrecto que evitamos:
    // total 110, abono nuevo 60 => pagado 60, saldo 50.
    const { data: cuenta, error: cuentaError } = await supabase
      .from("cuentas_por_cobrar")
      .select("id, monto_total_usd")
      .eq("id", args.cuentaId)
      .maybeSingle();

    if (cuentaError) throw cuentaError;
    if (!cuenta) return;

    const pagadoBase = r2(Number(args.montoPagadoBaseUsd || 0));
    const montoNuevoAbonoUsd = r2(Number(args.montoNuevoAbonoUsd || 0));
    const pagadoReal = r2(pagadoBase + montoNuevoAbonoUsd);
    const totalActual = r2(Number(cuenta.monto_total_usd || 0));
    const totalFinal = r2(Math.max(totalActual, pagadoReal));
    const saldoFinal = r2(Math.max(totalFinal - pagadoReal, 0));
    const estadoFinal =
      saldoFinal <= 0.01
        ? "cobrada"
        : pagadoReal > 0.01
          ? "parcial"
          : "pendiente";

    const { error } = await supabase
      .from("cuentas_por_cobrar")
      .update({
        monto_total_usd: totalFinal,
        monto_pagado_usd: pagadoReal,
        saldo_usd: saldoFinal,
        estado: estadoFinal,
      })
      .eq("id", args.cuentaId);

    if (error) throw error;
  }

  async function actualizarSaldoRealCuentaCliente(args: {
    cuenta: CuentaPendienteResumen;
    saldoRealUsd: number;
  }) {
    const saldoRealUsd = r2(args.saldoRealUsd);
    if (saldoRealUsd < 0)
      throw new Error("El nuevo saldo de la deuda no puede ser negativo.");

    const pagadoActual = r2(Number(args.cuenta.monto_pagado_usd || 0));
    const nuevoTotal = r2(pagadoActual + saldoRealUsd);
    const estadoFinal =
      saldoRealUsd <= 0.01
        ? "cobrada"
        : pagadoActual > 0.01
          ? "parcial"
          : "pendiente";

    const { error } = await supabase
      .from("cuentas_por_cobrar")
      .update({
        monto_total_usd: nuevoTotal,
        saldo_usd: saldoRealUsd,
        estado: estadoFinal,
        notas: `Ajuste manual de deuda. Saldo actualizado a ${formatearMoneda(saldoRealUsd, "USD")}.`,
      })
      .eq("id", args.cuenta.id);

    if (error) throw error;
  }

  async function actualizarSaldoRealCuentaEmpleado(args: {
    cuenta: CuentaPendienteEmpleadoResumen;
    saldoRealUsd: number;
  }) {
    const saldoRealUsd = r2(args.saldoRealUsd);
    if (saldoRealUsd < 0)
      throw new Error("El nuevo saldo de la deuda no puede ser negativo.");

    const pagadoActual = r2(Number(args.cuenta.monto_pagado_usd || 0));
    const nuevoTotal = r2(pagadoActual + saldoRealUsd);
    const estadoFinal =
      saldoRealUsd <= 0.01
        ? "cobrada"
        : pagadoActual > 0.01
          ? "parcial"
          : "pendiente";

    const { error } = await supabase
      .from("empleados_cuentas_por_cobrar")
      .update({
        monto_total_usd: nuevoTotal,
        saldo_usd: saldoRealUsd,
        estado: estadoFinal,
        notas: `Ajuste manual de deuda. Saldo actualizado a ${formatearMoneda(saldoRealUsd, "USD")}.`,
      })
      .eq("id", args.cuenta.id);

    if (error) throw error;
  }

  async function ajustarCuentaCobrarEmpleadoParaAbono(args: {
    cuenta: CuentaPendienteEmpleadoResumen;
    montoAbonoUsd: number;
  }) {
    const saldoActual = r2(Number(args.cuenta.saldo_usd || 0));
    const montoAbonoUsd = r2(args.montoAbonoUsd);
    const diferencia = r2(montoAbonoUsd - saldoActual);

    // Solo se ajusta ANTES cuando el pago real supera el saldo. Esto evita que el abono falle
    // por diferencias de tasa/bolívares, pero no toca monto_pagado_usd para no duplicar el abono.
    if (diferencia <= 0.01) return;

    const totalActual = r2(Number(args.cuenta.monto_total_usd || 0));
    const pagadoActual = r2(Number(args.cuenta.monto_pagado_usd || 0));
    const nuevoTotal = r2(totalActual + diferencia);
    const nuevoSaldo = r2(Math.max(nuevoTotal - pagadoActual, 0));

    const { error } = await supabase
      .from("empleados_cuentas_por_cobrar")
      .update({
        monto_total_usd: nuevoTotal,
        saldo_usd: nuevoSaldo,
        estado:
          nuevoSaldo <= 0.01
            ? "cobrada"
            : pagadoActual > 0
              ? "parcial"
              : "pendiente",
        notas: "Ajuste automático por pago superior a la deuda.",
      })
      .eq("id", args.cuenta.id);

    if (error) throw error;
  }

  async function sincronizarCuentaCobrarEmpleadoDesdeAbonos(cuentaId: string) {
    const [
      { data: cuenta, error: cuentaError },
      { data: abonos, error: abonosError },
    ] = await Promise.all([
      supabase
        .from("empleados_cuentas_por_cobrar")
        .select("id, monto_total_usd")
        .eq("id", cuentaId)
        .maybeSingle(),
      supabase
        .from("empleados_abonos_cobranza")
        .select("monto_usd")
        .eq("cuenta_cobrar_id", cuentaId),
    ]);

    if (cuentaError) throw cuentaError;
    if (abonosError) throw abonosError;
    if (!cuenta) return;

    const pagadoReal = r2(
      (abonos || []).reduce((sum, row) => sum + Number(row.monto_usd || 0), 0),
    );
    const totalActual = r2(Number(cuenta.monto_total_usd || 0));
    const totalFinal = r2(Math.max(totalActual, pagadoReal));
    const saldoFinal = r2(Math.max(totalFinal - pagadoReal, 0));
    const estadoFinal =
      saldoFinal <= 0.01
        ? "cobrada"
        : pagadoReal > 0.01
          ? "parcial"
          : "pendiente";

    const { error } = await supabase
      .from("empleados_cuentas_por_cobrar")
      .update({
        monto_total_usd: totalFinal,
        monto_pagado_usd: pagadoReal,
        saldo_usd: saldoFinal,
        estado: estadoFinal,
      })
      .eq("id", cuentaId);

    if (error) throw error;
  }

  async function registrarPagoMixtoDeuda(args: {
    cuentaCobrarId: string;
    fecha: string;
    notasGenerales: string | null;
    pagos: any[];
  }) {
    await registrarAbonoMixto({
      cuenta_cobrar_id: args.cuentaCobrarId,
      fecha: args.fecha,
      notas_generales: args.notasGenerales,
      pagos: args.pagos,
    });
  }

  function obtenerContextoPagoRapidoComision() {
    if (tipoPago === "unico") {
      return {
        monedaPago: monedaPagoUnico,
        tasaBcv: monedaPagoUnico === "BS" ? tasaPagoUnico : null,
      };
    }

    const pagos = [pagoMixto1, pagoMixto2];
    const pagoBs = pagos.find(
      (p) => p.moneda === "BS" && Number(p.monto || 0) > 0,
    );
    if (pagoBs)
      return { monedaPago: "BS" as const, tasaBcv: pagoBs.tasaBcv || null };
    return { monedaPago: "USD" as const, tasaBcv: null };
  }

  async function liberarComisionesRetenidas(cuentaId: string) {
    const { data: cuenta } = await supabase
      .from("cuentas_por_cobrar")
      .select("saldo_usd, estado")
      .eq("id", cuentaId)
      .maybeSingle();
    if (!cuenta) return;
    const cobrada =
      String(cuenta.estado || "").toLowerCase() === "cobrada" ||
      Number(cuenta.saldo_usd || 0) <= 0.01;
    if (!cobrada) return;
    await supabase
      .from("comisiones_detalle")
      .update({ cuenta_por_cobrar_id: cuentaId, estado: "pendiente" })
      .eq("cuenta_por_cobrar_id", cuentaId)
      .eq("estado", "retenida")
      .eq("pagado", false)
      .is("liquidacion_id", null)
      .is("pago_empleado_id", null);
  }

  async function sincronizarComisionPlanDesdeDeudaCliente(args: {
    cuentaCobrarId: string;
    monedaPago: "USD" | "BS";
    tasaBcv: number | null;
  }) {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "sincronizar_comision_plan_desde_deuda",
      {
        p_cuenta_cobrar_id: args.cuentaCobrarId,
        p_moneda_pago: args.monedaPago,
        p_tasa_bcv: args.tasaBcv,
      },
    );

    // Si el RPC existe, él hace la corrección atómica en BD y no seguimos.
    if (!rpcError) return rpcData;

    // Fallback para no dejar la pantalla rota si aún no corriste el SQL.
    // Actualiza solo columnas que existan en tu tabla de comisiones_detalle.
    const { data: cuenta, error: cuentaError } = await supabase
      .from("cuentas_por_cobrar")
      .select("*")
      .eq("id", args.cuentaCobrarId)
      .maybeSingle();

    if (cuentaError) throw cuentaError;
    if (!cuenta) return null;

    const totalUsd = r2(Number(cuenta.monto_total_usd || 0));
    if (totalUsd <= 0) return null;

    const origenId = String(cuenta.cliente_plan_id || cuenta.origen_id || "");
    const clienteCuentaId = String(cuenta.cliente_id || "");
    const query = supabase.from("comisiones_detalle").select("*");

    if (origenId) query.eq("cliente_plan_id", origenId);
    else if (clienteCuentaId) query.eq("cliente_id", clienteCuentaId);
    else return null;

    const { data: comisiones, error: comisionError } = await query;
    if (comisionError) throw comisionError;
    if (!comisiones || comisiones.length === 0) return null;

    const tasa = Number(args.tasaBcv || 0);
    const monedaFinal = args.monedaPago === "BS" && tasa > 0 ? "BS" : "USD";
    const totalBs = monedaFinal === "BS" ? r2(totalUsd * tasa) : null;

    for (const row of comisiones as any[]) {
      if (
        row.pagado === true ||
        String(row.estado || "").toLowerCase() === "liquidado"
      )
        continue;

      const baseAnterior = r2(
        Number(
          row.monto_base_usd ?? row.base ?? row.monto_total_usd ?? totalUsd,
        ),
      );
      const profesionalAnterior = r2(
        Number(row.monto_profesional_usd ?? row.profesional ?? 0),
      );
      const ratioProfesional =
        baseAnterior > 0 && profesionalAnterior > 0
          ? profesionalAnterior / baseAnterior
          : 0.35;
      const profesionalUsd = r2(totalUsd * ratioProfesional);
      const rpmUsd = r2(Math.max(totalUsd - profesionalUsd, 0));
      const profesionalBs = totalBs !== null ? r2(profesionalUsd * tasa) : null;
      const rpmBs = totalBs !== null ? r2(rpmUsd * tasa) : null;

      const patch: Record<string, any> = {};
      const has = (key: string) =>
        Object.prototype.hasOwnProperty.call(row, key);

      if (has("moneda")) patch.moneda = monedaFinal;
      if (has("base")) patch.base = totalUsd;
      if (has("profesional")) patch.profesional = profesionalUsd;
      if (has("rpm")) patch.rpm = rpmUsd;
      if (has("monto_base_usd"))
        patch.monto_base_usd = monedaFinal === "USD" ? totalUsd : null;
      if (has("monto_rpm_usd"))
        patch.monto_rpm_usd = monedaFinal === "USD" ? rpmUsd : null;
      if (has("monto_profesional_usd"))
        patch.monto_profesional_usd =
          monedaFinal === "USD" ? profesionalUsd : null;
      if (has("monto_base_bs"))
        patch.monto_base_bs = monedaFinal === "BS" ? totalBs : null;
      if (has("monto_rpm_bs"))
        patch.monto_rpm_bs = monedaFinal === "BS" ? rpmBs : null;
      if (has("monto_profesional_bs"))
        patch.monto_profesional_bs =
          monedaFinal === "BS" ? profesionalBs : null;
      if (has("tasa_bcv")) patch.tasa_bcv = monedaFinal === "BS" ? tasa : null;
      if (has("updated_at")) patch.updated_at = new Date().toISOString();

      if (Object.keys(patch).length > 0) {
        const { error: updError } = await supabase
          .from("comisiones_detalle")
          .update(patch)
          .eq("id", row.id);
        if (updError) throw updError;
      }
    }

    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (ventaSinCliente) {
      if (productosVentaDetalle.length === 0) {
        alert("Agrega al menos un producto");
        return;
      }
      if (productosVentaDetalle.some((item) => item.cantidad <= 0)) {
        alert("Todas las cantidades deben ser mayores a 0");
        return;
      }
      if (stockInsuficiente) {
        alert("No hay suficiente stock disponible");
        return;
      }
      const err = validarPagoRapido();
      if (err) {
        alert(err);
        return;
      }
      setSaving(true);
      try {
        const conceptoFinal =
          concepto.trim() || `Venta rápida de ${resumenProductosVenta}`;
        const operacionPagoId = await registrarPagoMixtoProducto({
          fecha,
          concepto: conceptoFinal,
          clienteId: null,
          inventarioId: productoPrincipalId,
          cantidad: cantidadTotalProductos,
          notasGenerales: notas.trim() || null,
          pagos: buildPagosPayloadRapido(),
        });
        const pagoRealId = await obtenerPagoRealIdPorOperacion(operacionPagoId);
        await descontarInventarioVentaActual(
          pagoRealId,
          "Venta rápida (sin cliente)",
        );
        alert(
          `✅ Venta rápida registrada: ${formatearMoneda(totalUSD, "USD")}`,
        );
        resetForm();
        await cargarDatos();
      } catch (err: any) {
        alert("Error: " + (err.message || "No se pudo guardar"));
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!ventaSinCliente && tipoConsumidor === "empleado") {
      if (!empleadoId || !empleadoSeleccionado) {
        alert("Selecciona un empleado");
        return;
      }
      if (
        tipoIngreso === "saldo" &&
        destinoSaldo === "deuda" &&
        cuentaPendienteSeleccionada
      ) {
        const ajusteManualActivo = montoActualizarDeudaUSD.trim() !== "";
        const saldoActual = r2(
          Number(cuentaPendienteSeleccionada.saldo_usd || 0),
        );
        const saldoBaseParaAbono = ajusteManualActivo
          ? montoActualizarDeudaNumero
          : saldoActual;

        if (!ajusteManualActivo && montoAbonoDeudaNumero <= 0) {
          alert("El monto del abono debe ser mayor a 0");
          return;
        }
        if (ajusteManualActivo && montoActualizarDeudaNumero < 0) {
          alert("El nuevo saldo de la deuda no puede ser negativo.");
          return;
        }
        if (montoAbonoDeudaNumero < 0) {
          alert("El abono no puede ser negativo.");
          return;
        }
        if (montoAbonoDeudaNumero > saldoBaseParaAbono) {
          alert(
            `El abono no puede ser mayor al saldo pendiente (${formatearMoneda(saldoBaseParaAbono, "USD")})`,
          );
          return;
        }

        let montoRealAbonoUsd = 0;
        if (montoAbonoDeudaNumero > 0) {
          const errSaldo = validarPagoRapido();
          if (errSaldo) {
            alert(errSaldo);
            return;
          }
          montoRealAbonoUsd = r2(
            totalPagoRapidoRealUsd || montoAbonoDeudaNumero,
          );
          if (montoRealAbonoUsd <= 0) {
            alert("El pago real debe ser mayor a 0.");
            return;
          }
          if (montoRealAbonoUsd > saldoBaseParaAbono) {
            alert(
              `El pago real no puede ser mayor al saldo pendiente (${formatearMoneda(saldoBaseParaAbono, "USD")})`,
            );
            return;
          }
        }

        setSaving(true);
        try {
          if (ajusteManualActivo)
            await actualizarSaldoRealCuentaEmpleado({
              cuenta:
                cuentaPendienteSeleccionada as CuentaPendienteEmpleadoResumen,
              saldoRealUsd: saldoBaseParaAbono,
            });
          else
            await ajustarCuentaCobrarEmpleadoParaAbono({
              cuenta:
                cuentaPendienteSeleccionada as CuentaPendienteEmpleadoResumen,
              montoAbonoUsd: montoRealAbonoUsd,
            });

          if (montoRealAbonoUsd > 0) {
            await registrarAbonoDeudaEmpleado({
              cuentaCobrarId: cuentaPendienteSeleccionada.id,
              empleadoId: empleadoSeleccionado.id,
              montoUsd: montoRealAbonoUsd,
              notas: notas.trim() || null,
            });
            await sincronizarCuentaCobrarEmpleadoDesdeAbonos(
              cuentaPendienteSeleccionada.id,
            );
          }

          alert(
            montoRealAbonoUsd > 0
              ? `✅ Abono de empleado aplicado por ${formatearMoneda(montoRealAbonoUsd, "USD")}`
              : `✅ Deuda de empleado actualizada a ${formatearMoneda(saldoBaseParaAbono, "USD")}`,
          );
          resetForm();
          await cargarDatos();
          await cargarEstadoCuentaEmpleado(empleadoSeleccionado.id);
        } catch (err: any) {
          alert("Error: " + (err.message || "No se pudo guardar"));
        } finally {
          setSaving(false);
        }
        return;
      }
      if (tipoIngreso === "saldo") {
        const errSaldo = validarPagoRapido();
        if (errSaldo) {
          alert(errSaldo);
          return;
        }
        const totalSaldoUsd =
          tipoPago === "unico" ? totalPagoUnicoRealUsd : totalPagoMixtoUsd;
        if (totalSaldoUsd <= 0) {
          alert("Debes indicar un monto válido para la recarga.");
          return;
        }
        setSaving(true);
        try {
          const conceptoFinal =
            concepto.trim() ||
            `Recarga de saldo a favor - ${empleadoSeleccionado.nombre}`;
          await crearCreditoEmpleado({
            empleadoId: empleadoSeleccionado.id,
            montoUsd: totalSaldoUsd,
            descripcion: conceptoFinal,
            origenTipo: "saldo_empleado",
          });
          alert(
            `✅ Saldo agregado al empleado: ${formatearMoneda(totalSaldoUsd, "USD")}`,
          );
          resetForm();
          await cargarDatos();
          await cargarEstadoCuentaEmpleado(empleadoSeleccionado.id);
        } catch (err: any) {
          alert("Error: " + (err.message || "No se pudo guardar"));
        } finally {
          setSaving(false);
        }
        return;
      }
      if (tipoIngreso === "producto") {
        if (productosVentaDetalle.length === 0) {
          alert("Agrega al menos un producto");
          return;
        }
        if (productosVentaDetalle.some((item) => item.cantidad <= 0)) {
          alert("Todas las cantidades deben ser mayores a 0");
          return;
        }
        if (stockInsuficiente) {
          alert("No hay suficiente stock disponible");
          return;
        }
        setSaving(true);
        try {
          const conceptoFinal =
            concepto.trim() ||
            `Consumo empleado: ${resumenProductosVenta} - ${empleadoSeleccionado.nombre}`;
          let operacionPagoId: string | null = null;
          if (modoCobroEmpleadoProducto === "pagado") {
            const err = validarPagoRapido();
            if (err) {
              alert(err);
              setSaving(false);
              return;
            }
            operacionPagoId = await registrarPagoMixtoProducto({
              fecha,
              concepto: conceptoFinal,
              clienteId: null,
              inventarioId: productoPrincipalId,
              cantidad: cantidadTotalProductos,
              notasGenerales: `Empleado: ${empleadoSeleccionado.nombre}${notas.trim() ? `\n${notas.trim()}` : ""}`,
              pagos: buildPagosPayloadRapido(),
            });
          } else {
            await crearDeudaEmpleado({
              empleadoId: empleadoSeleccionado.id,
              empleadoNombre: empleadoSeleccionado.nombre,
              concepto: conceptoFinal,
              montoUsd: totalUSD,
              inventarioId: productoPrincipalId,
              cantidadProducto: cantidadTotalProductos,
              notas: notas.trim() || null,
            });
          }
          const pagoRealId =
            await obtenerPagoRealIdPorOperacion(operacionPagoId);
          await descontarInventarioVentaActual(
            pagoRealId,
            `Consumo empleado - ${empleadoSeleccionado.nombre}`,
          );
          alert(
            modoCobroEmpleadoProducto === "pagado"
              ? `✅ Consumo registrado y pagado: ${formatearMoneda(totalUSD, "USD")}`
              : `✅ Consumo registrado como deuda: ${formatearMoneda(totalUSD, "USD")}`,
          );
          resetForm();
          await cargarDatos();
          await cargarEstadoCuentaEmpleado(empleadoSeleccionado.id);
        } catch (err: any) {
          alert("Error: " + (err.message || "No se pudo guardar"));
        } finally {
          setSaving(false);
        }
        return;
      }
    }
    if (!clienteId) {
      alert("Selecciona un cliente");
      return;
    }
    if (!clienteSeleccionado) {
      alert("Cliente inválido");
      return;
    }
    if (
      tipoIngreso === "saldo" &&
      destinoSaldo === "deuda" &&
      cuentaPendienteSeleccionada
    ) {
      const ajusteManualActivo = montoActualizarDeudaUSD.trim() !== "";
      const saldoActual = r2(
        Number(cuentaPendienteSeleccionada.saldo_usd || 0),
      );
      const saldoBaseParaAbono = ajusteManualActivo
        ? montoActualizarDeudaNumero
        : saldoActual;

      if (!ajusteManualActivo && montoAbonoDeudaNumero <= 0) {
        alert("El monto del abono debe ser mayor a 0");
        return;
      }
      if (ajusteManualActivo && montoActualizarDeudaNumero < 0) {
        alert("El nuevo saldo de la deuda no puede ser negativo.");
        return;
      }
      if (montoAbonoDeudaNumero < 0) {
        alert("El abono no puede ser negativo.");
        return;
      }
      if (montoAbonoDeudaNumero > saldoBaseParaAbono) {
        alert(
          `El abono no puede ser mayor al saldo pendiente (${formatearMoneda(saldoBaseParaAbono, "USD")})`,
        );
        return;
      }

      let montoRealAbonoUsd = 0;
      if (montoAbonoDeudaNumero > 0) {
        const errSaldo = validarPagoRapido();
        if (errSaldo) {
          alert(errSaldo);
          return;
        }
        montoRealAbonoUsd = r2(totalPagoRapidoRealUsd || montoAbonoDeudaNumero);
        if (montoRealAbonoUsd <= 0) {
          alert("El pago real debe ser mayor a 0.");
          return;
        }
        // En deudas de planes se permite que el pago real en Bs supere el saldo base.
        // Ej: deuda 130 USD, pago en Bs equivale a 150 USD: la cuenta sube a 150
        // y luego se recalcula la comisión del plan sobre 150.
        if (ajusteManualActivo && montoRealAbonoUsd > saldoBaseParaAbono) {
          alert(
            `El pago real no puede ser mayor al saldo ajustado (${formatearMoneda(saldoBaseParaAbono, "USD")})`,
          );
          return;
        }
      }

      setSaving(true);
      try {
        if (ajusteManualActivo)
          await actualizarSaldoRealCuentaCliente({
            cuenta: cuentaPendienteSeleccionada as CuentaPendienteResumen,
            saldoRealUsd: saldoBaseParaAbono,
          });
        else
          await ajustarCuentaCobrarClienteParaAbono({
            cuenta: cuentaPendienteSeleccionada as CuentaPendienteResumen,
            montoAbonoUsd: montoRealAbonoUsd,
          });

        if (ajusteManualActivo && montoRealAbonoUsd <= 0) {
          await liberarComisionesRetenidas(cuentaPendienteSeleccionada.id);
          const contextoComision = obtenerContextoPagoRapidoComision();
          await sincronizarComisionPlanDesdeDeudaCliente({
            cuentaCobrarId: cuentaPendienteSeleccionada.id,
            monedaPago: contextoComision.monedaPago,
            tasaBcv: contextoComision.tasaBcv,
          });
        }

        if (montoRealAbonoUsd > 0) {
          await registrarPagoMixtoDeuda({
            cuentaCobrarId: cuentaPendienteSeleccionada.id,
            fecha,
            notasGenerales: notas.trim() || null,
            pagos: buildPagosPayloadRapido(),
          });
          await sincronizarCuentaCobrarClienteDesdeAbonos({
            cuentaId: cuentaPendienteSeleccionada.id,
            montoNuevoAbonoUsd: montoRealAbonoUsd,
            montoPagadoBaseUsd: Number(
              cuentaPendienteSeleccionada.monto_pagado_usd || 0,
            ),
          });
          await liberarComisionesRetenidas(cuentaPendienteSeleccionada.id);
          const contextoComision = obtenerContextoPagoRapidoComision();
          await sincronizarComisionPlanDesdeDeudaCliente({
            cuentaCobrarId: cuentaPendienteSeleccionada.id,
            monedaPago: contextoComision.monedaPago,
            tasaBcv: contextoComision.tasaBcv,
          });
        }

        alert(
          montoRealAbonoUsd > 0
            ? `✅ Abono aplicado por ${formatearMoneda(montoRealAbonoUsd, "USD")}`
            : `✅ Deuda actualizada a ${formatearMoneda(saldoBaseParaAbono, "USD")}`,
        );
        resetForm();
        await cargarDatos();
        await cargarEstadoCuentaCliente(clienteSeleccionado.id);
      } catch (err: any) {
        alert("Error: " + (err.message || "No se pudo guardar"));
      } finally {
        setSaving(false);
      }
      return;
    }
    if (tipoIngreso === "saldo") {
      if (editingId) {
        alert("Las recargas de saldo no se editan.");
        return;
      }
      const errSaldo = validarPagoRapido();
      if (errSaldo) {
        alert(errSaldo);
        return;
      }
      const totalSaldoUsd =
        tipoPago === "unico" ? totalPagoUnicoRealUsd : totalPagoMixtoUsd;
      if (totalSaldoUsd <= 0) {
        alert("Debes indicar un monto válido para la recarga.");
        return;
      }
      setSaving(true);
      try {
        const conceptoFinal = concepto.trim() || "Recarga de saldo a favor";
        const operacionPagoId = await registrarPagoMixtoSaldo({
          fecha,
          concepto: conceptoFinal,
          clienteId: clienteSeleccionado.id,
          notasGenerales: notas.trim() || null,
          pagos: buildPagosPayloadRapido(),
        });
        if (!operacionPagoId)
          throw new Error("No se pudo generar la operación de recarga");
        await crearCreditoCliente({
          clienteId: clienteSeleccionado.id,
          operacionPagoId,
          excedenteUsd: totalSaldoUsd,
          descripcion: conceptoFinal,
          origenTipo: "saldo_cliente",
        });
        alert(`✅ Saldo agregado: ${formatearMoneda(totalSaldoUsd, "USD")}`);
        resetForm();
        await cargarDatos();
        await cargarEstadoCuentaCliente(clienteSeleccionado.id);
      } catch (err: any) {
        alert("Error: " + (err.message || "No se pudo guardar"));
      } finally {
        setSaving(false);
      }
      return;
    }
    if (tipoIngreso === "producto") {
      if (productosVentaDetalle.length === 0) {
        alert("Agrega al menos un producto");
        return;
      }
      if (productosVentaDetalle.some((item) => item.cantidad <= 0)) {
        alert("Todas las cantidades deben ser mayores a 0");
        return;
      }
      if (!editingId && stockInsuficiente) {
        alert("No hay suficiente stock disponible");
        return;
      }
      const conceptoFinal =
        concepto.trim() || `Venta de ${resumenProductosVenta}`;
      if (editingId) {
        const errEdicion = validarPagoRapido();
        if (errEdicion) {
          alert(errEdicion);
          return;
        }
        setSaving(true);
        try {
          await limpiarCreditosExcedenteOperacion(editingOperacionId);
          if (editingOperacionId) {
            const { error } = await supabase
              .from("pagos")
              .delete()
              .eq("operacion_pago_id", editingOperacionId);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("pagos")
              .delete()
              .eq("id", editingId);
            if (error) throw error;
          }
          const nuevaOpId = await registrarPagoMixtoProducto({
            fecha,
            concepto: conceptoFinal,
            clienteId: clienteSeleccionado.id,
            inventarioId: productoPrincipalId,
            cantidad: cantidadTotalProductos,
            notasGenerales: notas.trim() || null,
            pagos: buildPagosPayloadRapido(),
          });
          alert("✅ Ingreso actualizado");
          resetForm();
          await cargarDatos();
          await cargarEstadoCuentaCliente(clienteSeleccionado.id);
        } catch (err: any) {
          alert("Error: " + (err.message || "No se pudo guardar"));
        } finally {
          setSaving(false);
        }
        return;
      }
      if (pagoConDeudaState.tipoCobro !== "sin_pago") {
        const errPago = validarPagoConDeuda(pagoConDeudaState, totalUSD);
        if (errPago) {
          alert(errPago);
          return;
        }
      }
      setSaving(true);
      try {
        let operacionPagoId: string | null = null;
        if (pagoConDeudaState.tipoCobro !== "sin_pago") {
          const pagosRpc = buildPagosRpcPayload(pagoConDeudaState, totalUSD);
          if (pagosRpc)
            operacionPagoId = await registrarPagoMixtoProducto({
              fecha,
              concepto: conceptoFinal,
              clienteId: clienteSeleccionado.id,
              inventarioId: productoPrincipalId,
              cantidad: cantidadTotalProductos,
              notasGenerales: notas.trim() || null,
              pagos: pagosRpc,
            });
        }
        const cxcPayload = buildCuentaPorCobrarPayload({
          state: pagoConDeudaState,
          montoTotal: totalUSD,
          clienteId: clienteSeleccionado.id,
          clienteNombre: clienteSeleccionado.nombre,
          concepto: conceptoFinal,
          fecha,
          registradoPor: null,
        });
        if (cxcPayload) {
          const { error: cxcErr } = await supabase
            .from("cuentas_por_cobrar")
            .insert({
              ...cxcPayload,
              tipo_origen: "venta_inventario",
              inventario_id: productoPrincipalId,
              cantidad_producto: cantidadTotalProductos,
            });
          if (cxcErr)
            console.warn("No se pudo crear cuenta por cobrar:", cxcErr.message);
        }
        const pagoRealId = await obtenerPagoRealIdPorOperacion(operacionPagoId);
        await descontarInventarioVentaActual(
          pagoRealId,
          `Venta a ${clienteSeleccionado.nombre}`,
        );
        alert(
          pagoConDeudaState.tipoCobro === "sin_pago"
            ? `✅ Venta registrada. Deuda total: ${formatearMoneda(totalUSD, "USD")}`
            : "✅ Venta registrada",
        );
        resetForm();
        await cargarDatos();
        await cargarEstadoCuentaCliente(clienteSeleccionado.id);
      } catch (err: any) {
        alert("Error: " + (err.message || "No se pudo guardar"));
      } finally {
        setSaving(false);
      }
    }
  }

  function resetForm() {
    setTipoIngreso("producto");
    setTipoConsumidor("cliente");
    setModoCobroEmpleadoProducto("pagado");
    setProductoId("");
    setClienteId("");
    setEmpleadoId("");
    setCantidad(1);
    setProductosVenta([nuevoProductoVentaItem()]);
    setConcepto("");
    setNotas("");
    setFecha(new Date().toISOString().slice(0, 10));
    setVentaSinCliente(false);
    setPagoConDeudaState(pagoConDeudaInitial());
    setTipoPago("unico");
    setMonedaPagoUnico("USD");
    setMetodoPagoUnicoId("");
    setReferenciaPagoUnico("");
    setNotasPagoUnico("");
    setTasaPagoUnico(null);
    setMontoPagoUnicoBs(null);
    setPagoMixto1(pagoMixtoVacio("USD"));
    setPagoMixto2(pagoMixtoVacio("BS"));
    setEditingId(null);
    setEditingOperacionId(null);
    setCuentaCobrarSeleccionadaId("");
    setMontoAbonoDeuda("");
    setMontoActualizarDeudaUSD("");
    setMontoManualUSD("");
    setDestinoSaldo("credito");
    setShowForm(false);
    setDetalleOperacion(null);
  }

  function startEdit(operacion: PagoOperacion) {
    setVentaSinCliente(false);
    setTipoIngreso("producto");
    setEditingId(operacion.id_representativo);
    setEditingOperacionId(operacion.operacion_pago_id);
    setFecha(operacion.fecha);
    setConcepto(operacion.concepto);
    setProductoId(operacion.inventario_id || "");
    setCantidad(Number(operacion.cantidad_producto || 1));
    setProductosVenta([
      {
        uid: `edit-${operacion.id_representativo}`,
        productoId: operacion.inventario_id || "",
        cantidad: Number(operacion.cantidad_producto || 1),
      },
    ]);
    setClienteId(operacion.cliente_id || "");
    setNotas(operacion.items[0]?.notas || "");
    setPagoConDeudaState(pagoConDeudaInitial());
    const itemsOrdenados = [...operacion.items].sort(
      (a, b) => Number(a.pago_item_no || 0) - Number(b.pago_item_no || 0),
    );
    const mapItemToForm = (item?: PagoItem | null): PagoMixtoFormItem => {
      if (!item) return pagoMixtoVacio("USD");
      const moneda =
        (item.moneda_pago || "USD").toUpperCase() === "BS" ||
        (item.moneda_pago || "").toUpperCase() === "VES"
          ? "BS"
          : "USD";
      const montoBase =
        moneda === "BS"
          ? Number(
              item.monto ?? item.monto_pago ?? item.monto_equivalente_bs ?? 0,
            )
          : Number(
              item.monto_equivalente_usd ?? item.monto ?? item.monto_pago ?? 0,
            );
      return {
        moneda,
        metodoId: item.metodo_pago_v2_id || "",
        monto: montoBase > 0 ? String(r2(montoBase)) : "",
        referencia: item.referencia || "",
        notas: item.notas || "",
        tasaBcv: item.tasa_bcv ?? null,
        montoBs:
          moneda === "BS"
            ? Number(
                item.monto_equivalente_bs ?? item.monto ?? item.monto_pago ?? 0,
              ) || null
            : null,
      };
    };
    if (operacion.es_pago_mixto || itemsOrdenados.length > 1) {
      setTipoPago("mixto");
      setPagoMixto1(mapItemToForm(itemsOrdenados[0]));
      setPagoMixto2(mapItemToForm(itemsOrdenados[1] || null));
      setMonedaPagoUnico("USD");
      setMetodoPagoUnicoId("");
      setReferenciaPagoUnico("");
      setNotasPagoUnico("");
      setTasaPagoUnico(null);
      setMontoPagoUnicoBs(null);
    } else {
      const first = itemsOrdenados[0];
      setTipoPago("unico");
      if (first) {
        const moneda =
          (first.moneda_pago || "USD").toUpperCase() === "BS" ||
          (first.moneda_pago || "").toUpperCase() === "VES"
            ? "BS"
            : "USD";
        setMonedaPagoUnico(moneda);
        setMetodoPagoUnicoId(first.metodo_pago_v2_id || "");
        setReferenciaPagoUnico(first.referencia || "");
        setNotasPagoUnico(first.notas || "");
        setTasaPagoUnico(first.tasa_bcv ?? null);
        setMontoPagoUnicoBs(
          moneda === "BS"
            ? Number(
                first.monto_equivalente_bs ??
                  first.monto ??
                  first.monto_pago ??
                  0,
              ) || null
            : null,
        );
      }
      setPagoMixto1(pagoMixtoVacio("USD"));
      setPagoMixto2(pagoMixtoVacio("BS"));
    }
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminarPago(operacion: PagoOperacion) {
    if (!confirm("¿Eliminar este ingreso?")) return;
    try {
      await limpiarCreditosExcedenteOperacion(operacion.operacion_pago_id);
      let query = supabase.from("pagos").delete();
      query = operacion.operacion_pago_id
        ? query.eq("operacion_pago_id", operacion.operacion_pago_id)
        : query.eq("id", operacion.id_representativo);
      const { error } = await query;
      if (error) throw error;
      alert("✅ Ingreso eliminado");
      await cargarDatos();
      if (operacion.cliente_id)
        await cargarEstadoCuentaCliente(operacion.cliente_id);
    } catch (err: any) {
      alert("Error: " + (err.message || "No se pudo eliminar"));
    }
  }

  const operaciones = useMemo(() => agruparPagosPorOperacion(pagos), [pagos]);
  const productoNombrePorId = useMemo(() => {
    const map = new Map<string, string>();
    productos.forEach((p) => map.set(p.id, p.nombre));
    return map;
  }, [productos]);
  const clientesFiltroOpciones = useMemo(() => {
    const map = new Map<string, string>();
    operaciones.forEach((op) => {
      if (op.cliente_id && op.cliente_nombre)
        map.set(op.cliente_id, op.cliente_nombre);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [operaciones]);
  const metodosFiltroOpciones = useMemo(() => {
    const map = new Map<string, string>();
    operaciones.forEach((op) => {
      op.items.forEach((item) => {
        if (item.metodo_pago_v2_id)
          map.set(
            item.metodo_pago_v2_id,
            item.metodos_pago_v2?.nombre || "Método",
          );
      });
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [operaciones]);
  const productosFiltroOpciones = useMemo(
    () =>
      productos
        .filter((prod) =>
          operaciones.some(
            (op) =>
              op.inventario_id === prod.id ||
              op.concepto.toLowerCase().includes(prod.nombre.toLowerCase()),
          ),
        )
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [productos, operaciones],
  );
  const filtrosActivos = useMemo(
    () =>
      [
        search.trim() ? 1 : 0,
        estadoFiltro !== "todos" ? 1 : 0,
        tipoFiltro !== "todos" ? 1 : 0,
        productoFiltro !== "todos" ? 1 : 0,
        clienteFiltro !== "todos" ? 1 : 0,
        metodoFiltro !== "todos" ? 1 : 0,
        fechaDesdeFiltro ? 1 : 0,
        fechaHastaFiltro ? 1 : 0,
      ].reduce((sum, value) => sum + value, 0),
    [
      search,
      estadoFiltro,
      tipoFiltro,
      productoFiltro,
      clienteFiltro,
      metodoFiltro,
      fechaDesdeFiltro,
      fechaHastaFiltro,
    ],
  );
  function limpiarFiltros() {
    setSearch("");
    setEstadoFiltro("todos");
    setTipoFiltro("todos");
    setProductoFiltro("todos");
    setClienteFiltro("todos");
    setMetodoFiltro("todos");
    setFechaDesdeFiltro("");
    setFechaHastaFiltro("");
  }
  const pagosFiltrados = useMemo(
    () =>
      operaciones.filter((pago) => {
        const fechaPago = (pago.fecha || "").slice(0, 10);
        const conceptoLower = pago.concepto.toLowerCase();
        if (estadoFiltro !== "todos" && pago.estado !== estadoFiltro)
          return false;
        if (tipoFiltro === "producto") {
          const esProducto =
            pago.categoria === "producto" ||
            pago.tipo_origen === "producto" ||
            !!pago.inventario_id;
          if (!esProducto) return false;
        }
        if (tipoFiltro === "saldo") {
          const esSaldo =
            pago.categoria === "saldo_cliente" ||
            pago.tipo_origen === "saldo_cliente" ||
            conceptoLower.includes("saldo") ||
            conceptoLower.includes("recarga");
          if (!esSaldo) return false;
        }
        if (tipoFiltro === "venta_rapida") {
          const esVentaRapida =
            !pago.cliente_id &&
            (pago.categoria === "producto" ||
              pago.tipo_origen === "producto" ||
              !!pago.inventario_id);
          if (!esVentaRapida) return false;
        }
        if (tipoFiltro === "plan") {
          const esPlan = ingresoTipoBadge(pago).toLowerCase() === "plan";
          if (!esPlan) return false;
        }
        if (tipoFiltro === "cita") {
          const esCita = ingresoTipoBadge(pago).toLowerCase() === "cita";
          if (!esCita) return false;
        }
        if (tipoFiltro === "abono") {
          const esAbono = ingresoTipoBadge(pago).toLowerCase() === "abono";
          if (!esAbono) return false;
        }
        if (tipoFiltro === "otros") {
          const tipoIngresoActual = ingresoTipoBadge(pago).toLowerCase();
          if (["producto", "venta rápida", "saldo", "plan", "cita", "abono"].includes(tipoIngresoActual)) return false;
        }
        if (productoFiltro !== "todos") {
          const nombreProducto =
            productoNombrePorId.get(productoFiltro)?.toLowerCase() || "";
          const coincideProducto =
            pago.inventario_id === productoFiltro ||
            (!!nombreProducto && conceptoLower.includes(nombreProducto));
          if (!coincideProducto) return false;
        }
        if (clienteFiltro !== "todos" && pago.cliente_id !== clienteFiltro)
          return false;
        if (
          metodoFiltro !== "todos" &&
          !pago.items.some((item) => item.metodo_pago_v2_id === metodoFiltro)
        )
          return false;
        if (fechaDesdeFiltro && fechaPago && fechaPago < fechaDesdeFiltro)
          return false;
        if (fechaHastaFiltro && fechaPago && fechaPago > fechaHastaFiltro)
          return false;
        if (search) {
          const s = search.toLowerCase();
          return (
            conceptoLower.includes(s) ||
            pago.categoria.toLowerCase().includes(s) ||
            pago.tipo_origen.toLowerCase().includes(s) ||
            (pago.cliente_nombre || "").toLowerCase().includes(s) ||
            pago.items.some(
              (item) =>
                (item.metodos_pago_v2?.nombre || "")
                  .toLowerCase()
                  .includes(s) ||
                (item.referencia || "").toLowerCase().includes(s),
            )
          );
        }
        return true;
      }),
    [
      operaciones,
      estadoFiltro,
      tipoFiltro,
      productoFiltro,
      clienteFiltro,
      metodoFiltro,
      fechaDesdeFiltro,
      fechaHastaFiltro,
      search,
      productoNombrePorId,
    ],
  );
  const totales = useMemo(() => {
    const pagadosFiltrados = pagosFiltrados.filter((p) => p.estado === "pagado");
    return {
      totalUSD: r2(pagadosFiltrados.reduce((sum, p) => sum + Number(p.total_usd || 0), 0)),
      totalBS: r2(pagadosFiltrados.reduce((sum, p) => sum + Number(p.total_bs || 0), 0)),
      cantidad: pagadosFiltrados.length,
    };
  }, [pagosFiltrados]);
  const mostrarPagoRapido =
    ventaSinCliente ||
    tipoIngreso === "saldo" ||
    !!editingId ||
    (tipoConsumidor === "empleado" &&
      tipoIngreso === "producto" &&
      modoCobroEmpleadoProducto === "pagado");

  if (loading) return <LoadingIngresos />;
  if (loadError) {
    return (
      <div className="min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200">
          Error cargando ingresos: {loadError}
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/admin/finanzas"
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/35 transition hover:text-white/70"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Finanzas
            </Link>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-white">
              Ingresos y consumos
            </h1>
            <p className="mt-0.5 text-xs text-white/35">
              Planes · citas · productos · recargas · abonos
            </p>
          </div>

          {/* KPIs compactos */}
          <div className="flex items-center gap-2">
            {[
              {
                label: "USD",
                value: formatearMoneda(totales.totalUSD, "USD"),
                color: "text-emerald-300",
              },
              {
                label: "BS",
                value: formatearMoneda(totales.totalBS, "BS"),
                color: "text-amber-300",
              },
              {
                label: "Ops.",
                value: String(totales.cantidad),
                color: "text-white/70",
              },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-right"
              >
                <p className="text-[9px] font-semibold uppercase tracking-widest text-white/25">
                  {kpi.label}
                </p>
                <p
                  className={`mt-0.5 text-sm font-bold tabular-nums ${kpi.color}`}
                >
                  {kpi.value}
                </p>
              </div>
            ))}
            {!showForm && (
              <>
                <button
                  onClick={() => {
                    setVentaSinCliente(false);
                    setShowForm(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo
                </button>
                <button
                  onClick={() => {
                    setVentaSinCliente(true);
                    setShowForm(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/[0.08] px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/[0.12]"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Rápida
                </button>
              </>
            )}
          </div>
        </div>

        <OperacionDetalleDrawer operacion={detalleOperacion} onClose={() => setDetalleOperacion(null)} />

        <div className="grid gap-5 xl:grid-cols-3">
          {/* ══ FORMULARIO ══ */}
          {showForm && (
            <div className="xl:col-span-1">
              <div className={`${panelCls} overflow-hidden`}>
                {/* Form header */}
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-white">
                      {editingId
                        ? "Editar ingreso"
                        : ventaSinCliente
                          ? "Venta rápida"
                          : "Nuevo ingreso"}
                    </p>
                    {ventaSinCliente && !editingId && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/[0.08] px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        <Zap className="h-2.5 w-2.5" />
                        Sin cliente
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-1.5 text-white/35 transition hover:text-white/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 p-4">
                  {/* Toggle con/sin cliente */}
                  {!editingId && (
                    <SegmentedControl
                      options={[
                        { value: "con", label: "Con cliente" },
                        {
                          value: "sin",
                          label: (
                            <span className="flex items-center justify-center gap-1">
                              <Zap className="h-3 w-3" />
                              Rápida
                            </span>
                          ),
                        },
                      ]}
                      value={ventaSinCliente ? "sin" : "con"}
                      onChange={(v) => setVentaSinCliente(v === "sin")}
                    />
                  )}

                  {/* Fecha + Tipo */}
                  <div className="grid grid-cols-2 gap-2">
                    <FieldRow label="Fecha *">
                      <input
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        className={inputCls}
                        required
                      />
                    </FieldRow>
                    {!ventaSinCliente && (
                      <FieldRow label="Tipo *">
                        <select
                          value={tipoIngreso}
                          onChange={(e) => {
                            const next = e.target.value as TipoIngresoUI;
                            setTipoIngreso(next);
                            setProductoId("");
                            setCantidad(1);
                            setProductosVenta([nuevoProductoVentaItem()]);
                            if (next === "saldo") {
                              setDestinoSaldo("credito");
                              setConcepto("Recarga de saldo a favor");
                            } else setConcepto("");
                          }}
                          className={inputCls}
                          disabled={!!editingId}
                        >
                          <option value="producto" className="bg-[#0d1120]">
                            Producto
                          </option>
                          <option value="saldo" className="bg-[#0d1120]">
                            Saldo
                          </option>
                        </select>
                      </FieldRow>
                    )}
                  </div>

                  {/* Aviso venta rápida */}
                  {ventaSinCliente && !editingId && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2">
                      <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/70" />
                      <p className="text-[11px] text-amber-200/70">
                        Pago inmediato. No genera historial de cliente.
                      </p>
                    </div>
                  )}

                  {/* Consumidor (tab) */}
                  {!ventaSinCliente && !editingId && (
                    <div>
                      <p className={labelCls}>Consumidor</p>
                      <SegmentedControl
                        options={[
                          { value: "cliente", label: "Cliente" },
                          { value: "empleado", label: "Empleado" },
                        ]}
                        value={tipoConsumidor}
                        onChange={(v) => {
                          const t = v as TipoConsumidor;
                          setTipoConsumidor(t);
                          if (t === "cliente") {
                            setEmpleadoId("");
                            setEstadoCuentaEmpleado(null);
                            setCuentasPendientesEmpleado([]);
                          } else {
                            setClienteId("");
                            setEstadoCuentaCliente(null);
                            setCuentasPendientesCliente([]);
                          }
                        }}
                      />
                    </div>
                  )}

                  {/* Bloque cliente */}
                  {!ventaSinCliente && tipoConsumidor === "cliente" && (
                    <div
                      className={`space-y-3 rounded-xl border border-violet-400/[0.12] bg-violet-400/[0.03] p-3`}
                    >
                      <FieldRow label="Cliente *">
                        <ClienteSearch
                          clientes={clientes}
                          value={clienteId}
                          onChange={(id) => setClienteId(id)}
                        />
                      </FieldRow>

                      {clienteSeleccionado && estadoCuentaCliente && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
                              Estado financiero
                            </p>
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${estadoFinancieroBadge(estadoCuentaCliente)}`}
                            >
                              {estadoFinancieroLabel(estadoCuentaCliente)}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              {
                                label: "Deuda",
                                val: formatearMoneda(
                                  Number(
                                    estadoCuentaCliente.total_pendiente_usd ||
                                      0,
                                  ),
                                  "USD",
                                ),
                              },
                              {
                                label: "Crédito",
                                val: formatearMoneda(
                                  Number(
                                    estadoCuentaCliente.credito_disponible_usd ||
                                      0,
                                  ),
                                  "USD",
                                ),
                              },
                              {
                                label: "Neto",
                                val: formatearMoneda(
                                  Number(
                                    estadoCuentaCliente.saldo_pendiente_neto_usd ||
                                      0,
                                  ),
                                  "USD",
                                ),
                              },
                            ].map((kpi) => (
                              <div
                                key={kpi.label}
                                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-center"
                              >
                                <p className="text-[9px] uppercase tracking-wider text-white/30">
                                  {kpi.label}
                                </p>
                                <p className="mt-0.5 text-xs font-bold text-white">
                                  {kpi.val}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {clienteSeleccionado &&
                        clienteTieneDeuda &&
                        tipoIngreso === "saldo" && (
                          <div className="space-y-2">
                            <p className={labelCls}>¿A dónde va este pago?</p>
                            <SegmentedControl
                              options={[
                                { value: "deuda", label: "Pagar deuda" },
                                { value: "credito", label: "Agregar crédito" },
                              ]}
                              value={destinoSaldo}
                              onChange={(v) =>
                                setDestinoSaldo(v as DestinoSaldo)
                              }
                            />
                            {destinoSaldo === "deuda" &&
                              cuentasPendientesCliente.length > 0 && (
                                <>
                                  <SelectorDeuda
                                    cuentas={cuentasPendientesCliente}
                                    seleccionadaId={cuentaCobrarSeleccionadaId}
                                    onSeleccionar={(id) => {
                                      setCuentaCobrarSeleccionadaId(id);
                                      const cuenta =
                                        cuentasPendientesCliente.find(
                                          (c) => c.id === id,
                                        );
                                      if (cuenta) {
                                        setConcepto(
                                          `Abono: ${cuenta.concepto}`,
                                        );
                                        setMontoAbonoDeuda(
                                          String(
                                            r2(Number(cuenta.saldo_usd || 0)),
                                          ),
                                        );
                                        setMontoActualizarDeudaUSD("");
                                      }
                                    }}
                                  />
                                  {cuentaPendienteSeleccionada && (
                                    <div className="rounded-xl border border-violet-400/15 bg-violet-500/[0.05] p-3">
                                      <div className="mb-2 flex items-center justify-between">
                                        <p className="text-xs font-medium text-white">
                                          Monto a abonar
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setMontoAbonoDeuda(
                                              String(
                                                r2(
                                                  Number(
                                                    cuentaPendienteSeleccionada.saldo_usd ||
                                                      0,
                                                  ),
                                                ),
                                              ),
                                            )
                                          }
                                          className={ghostBtn}
                                        >
                                          Saldo completo
                                        </button>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className={labelCls}>
                                            Abono USD
                                          </label>
                                          <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={montoAbonoDeuda}
                                            onChange={(e) =>
                                              setMontoAbonoDeuda(e.target.value)
                                            }
                                            className={inputCls}
                                            placeholder="Dinero recibido"
                                          />
                                        </div>
                                        <div>
                                          <label className={labelCls}>
                                            Actualizar deuda a USD
                                          </label>
                                          <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={montoActualizarDeudaUSD}
                                            onChange={(e) => {
                                              const saldoActual = String(
                                                r2(
                                                  Number(
                                                    cuentaPendienteSeleccionada.saldo_usd ||
                                                      0,
                                                  ),
                                                ),
                                              );
                                              setMontoActualizarDeudaUSD(
                                                e.target.value,
                                              );
                                              if (
                                                montoAbonoDeuda === saldoActual
                                              )
                                                setMontoAbonoDeuda("");
                                            }}
                                            className={inputCls}
                                            placeholder={String(
                                              r2(
                                                Number(
                                                  cuentaPendienteSeleccionada.saldo_usd ||
                                                    0,
                                                ),
                                              ),
                                            )}
                                          />
                                        </div>
                                      </div>
                                      <div className="mt-2 grid grid-cols-3 gap-2">
                                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                                          <p className="text-[9px] text-white/30">
                                            Pendiente actual
                                          </p>
                                          <p className="mt-0.5 text-xs font-bold text-white">
                                            {formatearMoneda(
                                              Number(
                                                cuentaPendienteSeleccionada.saldo_usd ||
                                                  0,
                                              ),
                                              "USD",
                                            )}
                                          </p>
                                        </div>
                                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                                          <p className="text-[9px] text-white/30">
                                            Base ajustada
                                          </p>
                                          <p className="mt-0.5 text-xs font-bold text-violet-200">
                                            {formatearMoneda(
                                              saldoBaseDeudaParaAbono,
                                              "USD",
                                            )}
                                          </p>
                                        </div>
                                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                                          <p className="text-[9px] text-white/30">
                                            Restante final
                                          </p>
                                          <p className="mt-0.5 text-xs font-bold text-amber-300">
                                            {formatearMoneda(
                                              restanteDeudaPreview,
                                              "USD",
                                            )}
                                          </p>
                                        </div>
                                      </div>
                                      <p className="mt-2 text-[10px] text-white/35">
                                        Usa “Actualizar deuda a USD” solo si el
                                        saldo real cambió. Ej: deuda 130 →
                                        actualizar a 120, sin registrar eso como
                                        pago.
                                      </p>
                                    </div>
                                  )}
                                </>
                              )}
                            {destinoSaldo === "deuda" &&
                              cuentasPendientesCliente.length === 0 && (
                                <div className="flex items-center gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-3 py-2">
                                  <AlertCircle className="h-3.5 w-3.5 text-amber-300" />
                                  <p className="text-[11px] text-amber-300">
                                    No hay deudas activas para este cliente.
                                  </p>
                                </div>
                              )}
                          </div>
                        )}
                    </div>
                  )}

                  {/* Bloque empleado */}
                  {!ventaSinCliente && tipoConsumidor === "empleado" && (
                    <div className="space-y-3 rounded-xl border border-emerald-400/[0.12] bg-emerald-400/[0.03] p-3">
                      <FieldRow label="Empleado *">
                        <ClienteSearch
                          clientes={empleados}
                          value={empleadoId}
                          onChange={(id) => setEmpleadoId(id)}
                        />
                      </FieldRow>

                      {empleadoSeleccionado && estadoCuentaEmpleado && (
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            {
                              label: "Deuda",
                              val: formatearMoneda(
                                Number(
                                  estadoCuentaEmpleado.total_pendiente_usd || 0,
                                ),
                                "USD",
                              ),
                            },
                            {
                              label: "Crédito",
                              val: formatearMoneda(
                                Number(
                                  estadoCuentaEmpleado.credito_disponible_usd ||
                                    0,
                                ),
                                "USD",
                              ),
                            },
                            {
                              label: "Neto",
                              val: formatearMoneda(
                                Number(
                                  estadoCuentaEmpleado.saldo_pendiente_neto_usd ||
                                    0,
                                ),
                                "USD",
                              ),
                            },
                          ].map((kpi) => (
                            <div
                              key={kpi.label}
                              className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-center"
                            >
                              <p className="text-[9px] uppercase tracking-wider text-white/30">
                                {kpi.label}
                              </p>
                              <p className="mt-0.5 text-xs font-bold text-white">
                                {kpi.val}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {empleadoSeleccionado && tipoIngreso === "producto" && (
                        <div>
                          <p className={labelCls}>Cobro del consumo</p>
                          <SegmentedControl
                            options={[
                              { value: "pagado", label: "Paga ahora" },
                              { value: "deuda", label: "Dejar deuda" },
                            ]}
                            value={modoCobroEmpleadoProducto}
                            onChange={(v) =>
                              setModoCobroEmpleadoProducto(
                                v as ModoCobroEmpleadoProducto,
                              )
                            }
                          />
                        </div>
                      )}

                      {empleadoSeleccionado &&
                        empleadoTieneDeuda &&
                        tipoIngreso === "saldo" && (
                          <div className="space-y-2">
                            <p className={labelCls}>¿A dónde va este pago?</p>
                            <SegmentedControl
                              options={[
                                { value: "deuda", label: "Pagar deuda" },
                                { value: "credito", label: "Agregar crédito" },
                              ]}
                              value={destinoSaldo}
                              onChange={(v) =>
                                setDestinoSaldo(v as DestinoSaldo)
                              }
                            />
                            {destinoSaldo === "deuda" &&
                              cuentasPendientesEmpleado.length > 0 && (
                                <>
                                  <SelectorDeuda
                                    cuentas={cuentasPendientesEmpleado as any}
                                    seleccionadaId={cuentaCobrarSeleccionadaId}
                                    onSeleccionar={(id) => {
                                      setCuentaCobrarSeleccionadaId(id);
                                      const cuenta =
                                        cuentasPendientesEmpleado.find(
                                          (c) => c.id === id,
                                        );
                                      if (cuenta) {
                                        setConcepto(
                                          `Abono empleado: ${cuenta.concepto}`,
                                        );
                                        setMontoAbonoDeuda(
                                          String(
                                            r2(Number(cuenta.saldo_usd || 0)),
                                          ),
                                        );
                                        setMontoActualizarDeudaUSD("");
                                      }
                                    }}
                                  />
                                  {cuentaPendienteSeleccionada && (
                                    <div className="rounded-xl border border-violet-400/15 bg-violet-500/[0.05] p-3">
                                      <div className="mb-2 flex items-center justify-between">
                                        <p className="text-xs font-medium text-white">
                                          Monto a abonar
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setMontoAbonoDeuda(
                                              String(
                                                r2(
                                                  Number(
                                                    cuentaPendienteSeleccionada.saldo_usd ||
                                                      0,
                                                  ),
                                                ),
                                              ),
                                            )
                                          }
                                          className={ghostBtn}
                                        >
                                          Saldo completo
                                        </button>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className={labelCls}>
                                            Abono USD
                                          </label>
                                          <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={montoAbonoDeuda}
                                            onChange={(e) =>
                                              setMontoAbonoDeuda(e.target.value)
                                            }
                                            className={inputCls}
                                            placeholder="Dinero recibido"
                                          />
                                        </div>
                                        <div>
                                          <label className={labelCls}>
                                            Actualizar deuda a USD
                                          </label>
                                          <input
                                            type="number"
                                            min={0}
                                            step="0.01"
                                            value={montoActualizarDeudaUSD}
                                            onChange={(e) => {
                                              const saldoActual = String(
                                                r2(
                                                  Number(
                                                    cuentaPendienteSeleccionada.saldo_usd ||
                                                      0,
                                                  ),
                                                ),
                                              );
                                              setMontoActualizarDeudaUSD(
                                                e.target.value,
                                              );
                                              if (
                                                montoAbonoDeuda === saldoActual
                                              )
                                                setMontoAbonoDeuda("");
                                            }}
                                            className={inputCls}
                                            placeholder={String(
                                              r2(
                                                Number(
                                                  cuentaPendienteSeleccionada.saldo_usd ||
                                                    0,
                                                ),
                                              ),
                                            )}
                                          />
                                        </div>
                                      </div>
                                      <div className="mt-2 grid grid-cols-3 gap-2">
                                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                                          <p className="text-[9px] text-white/30">
                                            Pendiente actual
                                          </p>
                                          <p className="mt-0.5 text-xs font-bold text-white">
                                            {formatearMoneda(
                                              Number(
                                                cuentaPendienteSeleccionada.saldo_usd ||
                                                  0,
                                              ),
                                              "USD",
                                            )}
                                          </p>
                                        </div>
                                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                                          <p className="text-[9px] text-white/30">
                                            Base ajustada
                                          </p>
                                          <p className="mt-0.5 text-xs font-bold text-violet-200">
                                            {formatearMoneda(
                                              saldoBaseDeudaParaAbono,
                                              "USD",
                                            )}
                                          </p>
                                        </div>
                                        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                                          <p className="text-[9px] text-white/30">
                                            Restante final
                                          </p>
                                          <p className="mt-0.5 text-xs font-bold text-amber-300">
                                            {formatearMoneda(
                                              restanteDeudaPreview,
                                              "USD",
                                            )}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </>
                              )}
                          </div>
                        )}
                    </div>
                  )}

                  {/* Productos */}
                  {tipoIngreso === "producto" && (
                    <div className={`${sectionCls} p-3`}>
                      <div className="mb-2.5 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">
                          Productos *
                        </p>
                        {!editingId && (
                          <button
                            type="button"
                            onClick={() =>
                              setProductosVenta((prev) => [
                                ...prev,
                                nuevoProductoVentaItem(),
                              ])
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-violet-400/20 bg-violet-500/[0.08] px-2 py-1 text-[10px] font-semibold text-violet-300 transition hover:bg-violet-500/[0.12]"
                          >
                            <Plus className="h-3 w-3" />
                            Agregar
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {productosVenta.map((item, index) => {
                          const prod =
                            productos.find((p) => p.id === item.productoId) ||
                            null;
                          const precio = Number(prod?.precio_venta_usd || 0);
                          const subtotal = r2(
                            Number(item.cantidad || 0) * precio,
                          );
                          const cantidadUsadaMismoProducto = productosVenta
                            .filter(
                              (row) =>
                                row.productoId &&
                                row.productoId === item.productoId,
                            )
                            .reduce(
                              (sum, row) => sum + Number(row.cantidad || 0),
                              0,
                            );
                          const sinStock =
                            !!prod &&
                            cantidadUsadaMismoProducto >
                              Number(prod.cantidad_actual || 0);
                          return (
                            <div
                              key={item.uid}
                              className={`rounded-xl border p-2.5 ${sinStock ? "border-rose-400/20 bg-rose-500/[0.06]" : "border-white/[0.06] bg-white/[0.02]"}`}
                            >
                              <div className="mb-1.5 flex items-center justify-between">
                                <span className="text-[9px] font-semibold uppercase tracking-widest text-white/25">
                                  #{index + 1}
                                </span>
                                {!editingId && productosVenta.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setProductosVenta((prev) =>
                                        prev.filter(
                                          (row) => row.uid !== item.uid,
                                        ),
                                      )
                                    }
                                    className="text-white/25 transition hover:text-rose-300"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                              <div className="grid grid-cols-[1fr_72px] gap-2">
                                <div>
                                  <select
                                    value={item.productoId}
                                    onChange={(e) => {
                                      const nextId = e.target.value;
                                      setProductosVenta((prev) =>
                                        prev.map((row) =>
                                          row.uid === item.uid
                                            ? { ...row, productoId: nextId }
                                            : row,
                                        ),
                                      );
                                      if (index === 0) setProductoId(nextId);
                                    }}
                                    className={inputCls}
                                    required
                                    disabled={!!editingId}
                                  >
                                    <option value="" className="bg-[#0d1120]">
                                      Seleccionar…
                                    </option>
                                    {productos.map((prod) => (
                                      <option
                                        key={prod.id}
                                        value={prod.id}
                                        className="bg-[#0d1120]"
                                      >
                                        {prod.nombre} (Stock:{" "}
                                        {prod.cantidad_actual})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  value={item.cantidad}
                                  onChange={(e) => {
                                    const nextCantidad = Math.max(
                                      1,
                                      Number(e.target.value) || 1,
                                    );
                                    setProductosVenta((prev) =>
                                      prev.map((row) =>
                                        row.uid === item.uid
                                          ? { ...row, cantidad: nextCantidad }
                                          : row,
                                      ),
                                    );
                                    if (index === 0) setCantidad(nextCantidad);
                                  }}
                                  className={inputCls}
                                  required
                                  disabled={!!editingId}
                                />
                              </div>
                              {prod && (
                                <div className="mt-2 flex items-center justify-between text-[10px] text-white/35">
                                  <span>
                                    Stock: {formatQty(prod.cantidad_actual)} ·{" "}
                                    {formatearMoneda(precio, "USD")}/u
                                  </span>
                                  <span className="font-bold text-white/60">
                                    {formatearMoneda(subtotal, "USD")}
                                  </span>
                                </div>
                              )}
                              {sinStock && (
                                <p className="mt-1 text-[10px] text-rose-300">
                                  Stock insuficiente.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Total */}
                      {productosVentaDetalle.length > 0 && (
                        <div className="mt-2 flex items-center justify-between border-t border-white/[0.05] pt-2">
                          <span className="text-[10px] text-white/30">
                            {cantidadTotalProductos} unidad
                            {cantidadTotalProductos !== 1 ? "es" : ""}
                          </span>
                          <span className="text-sm font-bold text-white">
                            {formatearMoneda(totalUSD, "USD")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Concepto */}
                  <FieldRow label="Concepto *">
                    <input
                      type="text"
                      value={concepto}
                      onChange={(e) => setConcepto(e.target.value)}
                      className={inputCls}
                      required
                    />
                  </FieldRow>

                  {/* ── Pago con deuda (cliente nuevo) ── */}
                  {tipoIngreso === "producto" &&
                    !ventaSinCliente &&
                    tipoConsumidor === "cliente" &&
                    !editingId &&
                    clienteId &&
                    productosVentaDetalle.length > 0 &&
                    totalUSD > 0 && (
                      <div>
                        <p className={labelCls}>Cobro</p>
                        <PagoConDeudaSelector
                          key={pagoConDeudaKey}
                          montoTotal={totalUSD}
                          fecha={fecha}
                          metodosPago={metodosPagoBase}
                          value={pagoConDeudaState}
                          onChange={setPagoConDeudaState}
                          concepto={
                            concepto || `Venta de ${resumenProductosVenta}`
                          }
                          clienteNombre={clienteSeleccionado?.nombre || ""}
                          mostrarMontoTotal={true}
                        />
                      </div>
                    )}

                  {/* ── Pago rápido ── */}
                  {mostrarPagoRapido && (
                    <div className={`${sectionCls} p-3`}>
                      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">
                        {tipoIngreso === "saldo" && destinoSaldo === "deuda"
                          ? "Método del abono"
                          : "Pago"}
                      </p>
                      <div className="mb-3">
                        <SegmentedControl
                          options={[
                            { value: "unico", label: "Único" },
                            { value: "mixto", label: "Mixto" },
                          ]}
                          value={tipoPago}
                          onChange={(v) => setTipoPago(v as "unico" | "mixto")}
                        />
                      </div>

                      {tipoPago === "unico" && (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-2 gap-2">
                            <FieldRow label="Moneda">
                              <select
                                value={monedaPagoUnico}
                                onChange={(e) =>
                                  setMonedaPagoUnico(
                                    e.target.value as "USD" | "BS",
                                  )
                                }
                                className={inputCls}
                              >
                                <option value="USD" className="bg-[#0d1120]">
                                  USD
                                </option>
                                <option value="BS" className="bg-[#0d1120]">
                                  Bs
                                </option>
                              </select>
                            </FieldRow>
                            <FieldRow label="Método">
                              <select
                                value={metodoPagoUnicoId}
                                onChange={(e) =>
                                  setMetodoPagoUnicoId(e.target.value)
                                }
                                className={inputCls}
                              >
                                <option value="" className="bg-[#0d1120]">
                                  Seleccionar…
                                </option>
                                {metodosPagoUnicoDisponibles.map((m) => (
                                  <option
                                    key={m.id}
                                    value={m.id}
                                    className="bg-[#0d1120]"
                                  >
                                    {m.nombre}
                                    {m.moneda ? ` · ${m.moneda}` : ""}
                                  </option>
                                ))}
                              </select>
                            </FieldRow>
                          </div>
                          {tipoIngreso === "saldo" &&
                            destinoSaldo !== "deuda" &&
                            monedaPagoUnico === "USD" && (
                              <FieldRow label="Monto USD a recargar">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={montoManualUSD}
                                  onChange={(e) =>
                                    setMontoManualUSD(e.target.value)
                                  }
                                  className={inputCls}
                                  placeholder="Ej: 50.00"
                                />
                              </FieldRow>
                            )}
                          {monedaPagoUnico === "BS" && (
                            <PagoBsSelector
                              fecha={fecha}
                              montoUsd={montoObjetivoPagoRapidoUsd}
                              montoBs={montoPagoUnicoBs}
                              onChangeTasa={setTasaPagoUnico}
                              onChangeMontoBs={setMontoPagoUnicoBs}
                            />
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <FieldRow label="Referencia">
                              <input
                                type="text"
                                value={referenciaPagoUnico}
                                onChange={(e) =>
                                  setReferenciaPagoUnico(e.target.value)
                                }
                                placeholder="Ref…"
                                className={inputCls}
                              />
                            </FieldRow>
                            <FieldRow label="Notas">
                              <input
                                type="text"
                                value={notasPagoUnico}
                                onChange={(e) =>
                                  setNotasPagoUnico(e.target.value)
                                }
                                placeholder="Opcional"
                                className={inputCls}
                              />
                            </FieldRow>
                          </div>
                        </div>
                      )}

                      {tipoPago === "mixto" && (
                        <div className="space-y-3">
                          {/* Barra de progreso */}
                          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                            <div className="mb-1.5 flex items-center justify-between text-xs">
                              <span className="font-bold text-white">
                                {formatearMoneda(
                                  resumenPagosMixtoRapido.totalObjetivo,
                                  "USD",
                                )}
                              </span>
                              <span
                                className={`text-[11px] font-semibold ${resumenPagosMixtoRapido.cuadra ? "text-emerald-400" : "text-amber-400"}`}
                              >
                                {resumenPagosMixtoRapido.cuadra
                                  ? "✓ Cuadra"
                                  : `Faltan ${formatearMoneda(resumenPagosMixtoRapido.faltante, "USD")}`}
                              </span>
                            </div>
                            <div className="flex h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                              <div
                                className="bg-sky-500 transition-all"
                                style={{
                                  width: `${Math.min(resumenPagosMixtoRapido.pct1, 100)}%`,
                                }}
                              />
                              <div
                                className="bg-violet-500 transition-all"
                                style={{
                                  width: `${Math.min(resumenPagosMixtoRapido.pct2, 100 - resumenPagosMixtoRapido.pct1)}%`,
                                }}
                              />
                            </div>
                          </div>
                          <PagoMixtoCard
                            numero={1}
                            pago={pagoMixto1}
                            metodosPago={metodosPago}
                            fecha={fecha}
                            onChange={(patch) =>
                              setPagoMixto1((prev) => ({ ...prev, ...patch }))
                            }
                          />
                          <PagoMixtoCard
                            numero={2}
                            pago={pagoMixto2}
                            metodosPago={metodosPago}
                            fecha={fecha}
                            onChange={(patch) =>
                              setPagoMixto2((prev) => ({ ...prev, ...patch }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notas generales */}
                  <FieldRow label="Notas (opcional)">
                    <textarea
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Detalles adicionales…"
                      rows={2}
                      className={`${inputCls} resize-none`}
                    />
                  </FieldRow>

                  {/* Stock warning */}
                  {tipoIngreso === "producto" &&
                    stockInsuficiente &&
                    !editingId && (
                      <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-3 py-2">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-300" />
                        <p className="text-[11px] text-rose-300">
                          Stock insuficiente para esta venta.
                        </p>
                      </div>
                    )}

                  {/* Botones submit */}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={
                        saving ||
                        (tipoIngreso === "producto" &&
                          !!stockInsuficiente &&
                          !editingId)
                      }
                      className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-xs font-bold text-white transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {saving
                        ? "Guardando…"
                        : editingId
                          ? "Actualizar"
                          : ventaSinCliente
                            ? "Registrar venta"
                            : "Registrar"}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className={ghostBtn}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ══ LISTA ══ */}
          <div
            className={`space-y-4 ${showForm ? "xl:col-span-2" : "xl:col-span-3"}`}
          >
            {/* Filtros */}
            <div className={`${panelCls} p-3`}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar concepto, cliente, método…"
                    className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] py-2 pl-9 pr-3 text-xs text-white placeholder:text-white/25 outline-none transition focus:border-white/[0.12] focus:bg-white/[0.05]"
                  />
                </div>
                {filtrosActivos > 0 && (
                  <button
                    type="button"
                    onClick={limpiarFiltros}
                    className={`${ghostBtn} shrink-0`}
                  >
                    Limpiar {filtrosActivos > 0 ? `(${filtrosActivos})` : ""}
                  </button>
                )}
              </div>

              {/* Tipo pills */}
              <div className="mt-2.5 flex flex-wrap gap-1">
                {[
                  { value: "todos", label: "Todos" },
                  { value: "plan", label: "Planes" },
                  { value: "cita", label: "Citas" },
                  { value: "abono", label: "Abonos" },
                  { value: "producto", label: "Productos" },
                  { value: "saldo", label: "Saldos" },
                  { value: "venta_rapida", label: "Rápidas" },
                  { value: "otros", label: "Otros" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() =>
                      setTipoFiltro(item.value as TipoFiltroIngreso)
                    }
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${tipoFiltro === item.value ? "border-violet-400/30 bg-violet-500/[0.12] text-violet-200" : "border-white/[0.07] bg-white/[0.02] text-white/40 hover:text-white/60"}`}
                  >
                    {item.label}
                  </button>
                ))}
                <div className="ml-auto flex gap-1">
                  {(
                    [
                      "todos",
                      "pagado",
                      "pendiente",
                      "anulado",
                    ] as EstadoFiltro[]
                  ).map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setEstadoFiltro(e)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${estadoFiltro === e ? "border-white/15 bg-white/[0.08] text-white" : "border-white/[0.07] bg-white/[0.02] text-white/35 hover:text-white/55"}`}
                    >
                      {e === "todos"
                        ? "Estado"
                        : e.charAt(0).toUpperCase() + e.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selects de filtro */}
              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <select
                  value={productoFiltro}
                  onChange={(e) => {
                    setProductoFiltro(e.target.value);
                    if (e.target.value !== "todos") setTipoFiltro("producto");
                  }}
                  className={inputCls}
                >
                  <option value="todos" className="bg-[#0d1120]">
                    Todos los productos
                  </option>
                  {productosFiltroOpciones.map((prod) => (
                    <option
                      key={prod.id}
                      value={prod.id}
                      className="bg-[#0d1120]"
                    >
                      {prod.nombre}
                    </option>
                  ))}
                </select>
                <select
                  value={clienteFiltro}
                  onChange={(e) => setClienteFiltro(e.target.value)}
                  className={inputCls}
                >
                  <option value="todos" className="bg-[#0d1120]">
                    Todos los clientes
                  </option>
                  {clientesFiltroOpciones.map(([id, nombre]) => (
                    <option key={id} value={id} className="bg-[#0d1120]">
                      {nombre}
                    </option>
                  ))}
                </select>
                <select
                  value={metodoFiltro}
                  onChange={(e) => setMetodoFiltro(e.target.value)}
                  className={inputCls}
                >
                  <option value="todos" className="bg-[#0d1120]">
                    Todos los métodos
                  </option>
                  {metodosFiltroOpciones.map(([id, nombre]) => (
                    <option key={id} value={id} className="bg-[#0d1120]">
                      {nombre}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-1">
                  <input
                    type="date"
                    value={fechaDesdeFiltro}
                    onChange={(e) => setFechaDesdeFiltro(e.target.value)}
                    className={inputCls}
                    title="Desde"
                  />
                  <input
                    type="date"
                    value={fechaHastaFiltro}
                    onChange={(e) => setFechaHastaFiltro(e.target.value)}
                    className={inputCls}
                    title="Hasta"
                  />
                </div>
              </div>

              {/* Productos rápidos */}
              {productosFiltroOpciones.length > 0 && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-white/[0.05] pt-2.5">
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-white/20">
                    Producto
                  </span>
                  {productosFiltroOpciones.slice(0, 8).map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => {
                        setProductoFiltro(prod.id);
                        setTipoFiltro("producto");
                      }}
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${productoFiltro === prod.id ? "border-emerald-400/30 bg-emerald-500/[0.10] text-emerald-200" : "border-white/[0.07] bg-white/[0.02] text-white/40 hover:text-white/60"}`}
                    >
                      {prod.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lista de operaciones */}
            <div className="space-y-2">
              {pagosFiltrados.length === 0 ? (
                <div
                  className={`${panelCls} flex flex-col items-center justify-center py-12`}
                >
                  <Package2 className="mb-3 h-8 w-8 text-white/15" />
                  <p className="text-sm text-white/30">
                    Sin ingresos registrados
                  </p>
                </div>
              ) : (
                pagosFiltrados.map((operacion) => {
                  const estadoUi = estadoUiDesdeDb(operacion.estado);
                  return (
                    <div
                      key={operacion.key}
                      className={`${panelCls} transition hover:border-white/[0.10]`}
                    >
                      <div className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${estadoUi === "pagado" ? "bg-emerald-400" : "bg-amber-400"}`}
                            />
                            <p className="truncate text-sm font-semibold text-white">
                              {operacion.concepto}
                            </p>
                            {!operacion.cliente_id && (
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-400/20 bg-amber-400/[0.08] px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                                <Zap className="h-2.5 w-2.5" />
                                Rápida
                              </span>
                            )}
                            <span
                              className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${estadoUi === "pagado" ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300" : "border-amber-400/20 bg-amber-400/[0.08] text-amber-300"}`}
                            >
                              {operacion.estado}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-white/30">
                            <span>{operacion.fecha}</span>
                            <span>·</span>
                            <span>{ingresoTipoBadge(operacion)}</span>
                            {operacion.cliente_nombre && (
                              <>
                                <span>·</span>
                                <span>{operacion.cliente_nombre}</span>
                              </>
                            )}
                            <span>·</span>
                            <span>{operacion.categoria}</span>
                            {operacion.es_pago_mixto && (
                              <>
                                <span>·</span>
                                <span>{operacion.items_total} pagos</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="text-right">
                            <p className="text-sm font-bold text-white">
                              {formatearMoneda(
                                Number(operacion.total_usd || 0),
                                "USD",
                              )}
                            </p>
                            <p className="text-[10px] text-white/30">
                              {formatearMoneda(
                                Number(operacion.total_bs || 0),
                                "BS",
                              )}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setDetalleOperacion(operacion)}
                              className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.06] p-1.5 text-emerald-300/70 transition hover:text-emerald-200"
                              title="Ver detalle de movimientos"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                            </button>
                            {esOperacionEditableDesdeIngresos(operacion) && (
                              <>
                                <button
                                  onClick={() => startEdit(operacion)}
                                  className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-1.5 text-white/35 transition hover:text-white/70"
                                  title="Editar ingreso operativo"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => eliminarPago(operacion)}
                                  className="rounded-lg border border-rose-400/15 bg-rose-400/[0.06] p-1.5 text-rose-300/60 transition hover:text-rose-300"
                                  title="Eliminar ingreso operativo"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Items de pago */}
                      {operacion.items.length > 0 && (
                        <div className="border-t border-white/[0.05] px-4 pb-3 pt-2">
                          <div className="space-y-1">
                            {operacion.items.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5"
                              >
                                <div className="min-w-0 flex-1 text-[11px] text-white/50">
                                  <p className="truncate font-medium text-white/70">{metodoLinea(item)}</p>
                                  <p className="mt-0.5 truncate text-[10px] text-white/30">
                                    {item.referencia ? `Ref: #${item.referencia}` : "Sin referencia"}
                                    {item.tasa_bcv ? ` · Tasa: ${item.tasa_bcv}` : ""}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-semibold text-white">
                                    {formatearMoneda(
                                      Number(item.monto_equivalente_usd || 0),
                                      "USD",
                                    )}
                                  </span>
                                  <span className="ml-2 text-[10px] text-white/30">
                                    {formatearMoneda(
                                      Number(item.monto_equivalente_bs || 0),
                                      "BS",
                                    )}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
