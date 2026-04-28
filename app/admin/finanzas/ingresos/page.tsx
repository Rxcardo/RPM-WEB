'use client'

import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  ArrowLeft, Plus, Search, Edit2, Trash2, X, Package2, User2,
  Receipt, ChevronDown, AlertCircle, Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import SelectorTasaBCV from '@/components/finanzas/SelectorTasaBCV'
import { formatearMoneda } from '@/lib/finanzas/tasas'
import { registrarAbonoMixto } from '@/lib/cobranzas/abonos'
import PagoConDeudaSelector, {
  pagoConDeudaInitial,
  validarPagoConDeuda,
  buildCuentaPorCobrarPayload,
  buildPagosRpcPayload,
  type PagoConDeudaState,
  type MetodoPagoBase,
} from '@/components/pagos/PagoConDeudaSelector'

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Cartera { nombre: string; codigo: string }
interface MetodoPago { id: string; nombre: string; tipo?: string | null; moneda?: string | null; cartera?: Cartera | null }
interface Producto { id: string; nombre: string; descripcion: string | null; cantidad_actual: number | null; unidad_medida: string | null; precio_venta_usd: number | null; estado: string | null }
interface Cliente { id: string; nombre: string; telefono?: string | null; email?: string | null }
interface EmpleadoConsumidor { id: string; nombre: string; telefono?: string | null; email?: string | null; rol?: string | null }

interface CuentaPendienteResumen {
  id: string; cliente_id: string | null; cliente_nombre: string; concepto: string
  monto_total_usd: number | null; monto_pagado_usd: number | null; saldo_usd: number | null
  fecha_venta: string; fecha_vencimiento?: string | null; estado: string
}

interface EstadoCuentaCliente {
  cliente_id: string
  total_pendiente_usd?: number | null; credito_disponible_usd?: number | null
  saldo_pendiente_neto_usd?: number | null; saldo_favor_neto_usd?: number | null
  total_pendiente_bs?: number | null; credito_disponible_bs?: number | null
  saldo_pendiente_neto_bs?: number | null; saldo_favor_neto_bs?: number | null
}

interface EstadoCuentaEmpleado {
  empleado_id: string
  nombre?: string | null
  rol?: string | null
  total_pendiente_usd?: number | null; credito_disponible_usd?: number | null
  saldo_pendiente_neto_usd?: number | null; saldo_favor_neto_usd?: number | null
}

interface CuentaPendienteEmpleadoResumen {
  id: string; empleado_id: string | null; empleado_nombre: string; concepto: string
  monto_total_usd: number | null; monto_pagado_usd: number | null; saldo_usd: number | null
  fecha_venta: string; fecha_vencimiento?: string | null; estado: string
}

interface PagoItem {
  id: string; operacion_pago_id: string | null; pago_item_no: number | null
  pago_items_total: number | null; es_pago_mixto: boolean; fecha: string
  concepto: string; categoria: string; tipo_origen: string
  monto: number | null; monto_pago: number | null
  monto_equivalente_usd: number | null; monto_equivalente_bs: number | null
  moneda_pago: string; tasa_bcv: number | null; estado: string
  cliente_id?: string | null; inventario_id?: string | null; cantidad_producto?: number | null
  metodo_pago_id?: string | null; metodo_pago_v2_id?: string | null
  notas?: string | null; referencia?: string | null
  metodos_pago_v2?: { nombre: string } | null
  clientes?: { nombre: string } | null
}

interface PagoOperacion {
  key: string; id_representativo: string; operacion_pago_id: string | null
  fecha: string; concepto: string; categoria: string; tipo_origen: string; estado: string
  cliente_id: string | null; cliente_nombre: string | null
  inventario_id: string | null; cantidad_producto: number | null
  total_usd: number; total_bs: number; es_pago_mixto: boolean; items_total: number
  items: PagoItem[]
}

type EstadoUI = 'pagado' | 'pendiente'
type EstadoFiltro = 'todos' | 'pagado' | 'pendiente' | 'anulado'
type TipoIngresoUI = 'producto' | 'saldo'
type DestinoSaldo = 'credito' | 'deuda'
type TipoConsumidor = 'cliente' | 'empleado'
type ModoCobroEmpleadoProducto = 'pagado' | 'deuda'

type RawCartera = { nombre?: unknown; codigo?: unknown } | Array<{ nombre?: unknown; codigo?: unknown }> | null | undefined
type RawMetodoPago = { id?: unknown; nombre?: unknown; tipo?: unknown; moneda?: unknown; cartera?: RawCartera }
type RawPago = {
  id?: unknown; operacion_pago_id?: unknown; pago_item_no?: unknown; pago_items_total?: unknown
  es_pago_mixto?: unknown; fecha?: unknown; concepto?: unknown; categoria?: unknown
  tipo_origen?: unknown; estado?: unknown; moneda_pago?: unknown; tasa_bcv?: unknown
  monto?: unknown; monto_pago?: unknown; monto_equivalente_usd?: unknown; monto_equivalente_bs?: unknown
  cliente_id?: unknown; inventario_id?: unknown; cantidad_producto?: unknown
  metodo_pago_id?: unknown; metodo_pago_v2_id?: unknown; notas?: unknown; referencia?: unknown
  metodos_pago_v2?: { nombre?: unknown } | Array<{ nombre?: unknown }> | null | undefined
  clientes?: { nombre?: unknown } | Array<{ nombre?: unknown }> | null | undefined
}

type PagoMixtoFormItem = {
  moneda: 'USD' | 'BS'; metodoId: string; monto: string
  referencia: string; notas: string; tasaBcv: number | null; montoBs: number | null
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05]'
const labelCls = 'mb-2 block text-sm font-medium text-white/75'
const panelCls = 'rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl'
const softButtonCls = 'rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function r2(v: number) { return Math.round(Number(v || 0) * 100) / 100 }

function formatDateShort(value: string | null | undefined) {
  if (!value) return '—'
  try { return new Date(value).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return value }
}

function estadoFinancieroLabel(estado: EstadoCuentaCliente | null) {
  if (Number(estado?.saldo_pendiente_neto_usd || 0) > 0.01) return 'Debe'
  if (Number(estado?.saldo_favor_neto_usd || 0) > 0.01) return 'Crédito'
  return 'Al día'
}

function estadoFinancieroBadge(estado: EstadoCuentaCliente | null) {
  if (Number(estado?.saldo_pendiente_neto_usd || 0) > 0.01) return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
  if (Number(estado?.saldo_favor_neto_usd || 0) > 0.01) return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
  return 'border-white/10 bg-white/[0.04] text-white/70'
}

function formatQty(v: number | null | undefined) {
  return new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(Number(v || 0))
}

function estadoUiDesdeDb(estado: string): EstadoUI {
  return estado === 'pagado' ? 'pagado' : 'pendiente'
}

function firstItem<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function toStringSafe(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback
  return String(value)
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeCartera(raw: RawCartera): Cartera | null {
  const item = firstItem(raw)
  if (!item) return null
  const nombre = toStringOrNull(item.nombre)
  const codigo = toStringOrNull(item.codigo)
  if (!nombre || !codigo) return null
  return { nombre, codigo }
}

function normalizeMetodoPago(raw: RawMetodoPago): MetodoPago {
  return {
    id: toStringSafe(raw.id), nombre: toStringSafe(raw.nombre),
    tipo: toStringOrNull(raw.tipo), moneda: toStringOrNull(raw.moneda),
    cartera: normalizeCartera(raw.cartera),
  }
}

function normalizePago(raw: RawPago): PagoItem {
  const metodo = firstItem(raw.metodos_pago_v2)
  const cliente = firstItem(raw.clientes)
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
    inventario_id: toStringOrNull(raw.inventario_id),
    cantidad_producto: toNumberOrNull(raw.cantidad_producto),
    metodo_pago_id: toStringOrNull(raw.metodo_pago_id),
    metodo_pago_v2_id: toStringOrNull(raw.metodo_pago_v2_id),
    notas: toStringOrNull(raw.notas),
    referencia: toStringOrNull(raw.referencia),
    metodos_pago_v2: metodo?.nombre ? { nombre: toStringSafe(metodo.nombre) } : null,
    clientes: cliente?.nombre ? { nombre: toStringSafe(cliente.nombre) } : null,
  }
}

function detectarMetodoBs(metodo: MetodoPago | null) {
  if (!metodo) return false
  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const tipo = (metodo.tipo || '').toLowerCase()
  const cc = (metodo.cartera?.codigo || '').toLowerCase()
  return (
    moneda === 'BS' || moneda === 'VES' ||
    nombre.includes('bs') || nombre.includes('bolívar') || nombre.includes('bolivar') ||
    nombre.includes('pago movil') || nombre.includes('pago móvil') ||
    nombre.includes('movil') || nombre.includes('móvil') ||
    tipo.includes('bs') || tipo.includes('bolívar') || tipo.includes('bolivar') ||
    tipo.includes('pago_movil') || cc.includes('bs') || cc.includes('ves')
  )
}

function detectarMetodoUsd(metodo: MetodoPago | null) {
  if (!metodo) return false
  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const cc = (metodo.cartera?.codigo || '').toLowerCase()
  return (
    moneda === 'USD' || nombre.includes('usd') || nombre.includes('zelle') ||
    nombre.includes('efectivo $') || nombre.includes('efectivo usd') || cc.includes('usd')
  )
}

function pagoToUsd(pago: PagoMixtoFormItem): number {
  const monto = parseFloat(pago.monto) || 0
  if (pago.moneda === 'USD') return r2(monto)
  if (!pago.tasaBcv || pago.tasaBcv <= 0) return 0
  return r2(monto / pago.tasaBcv)
}

function pagoMontoEnBs(pago: PagoMixtoFormItem): number {
  if (pago.moneda !== 'BS') return 0
  return parseFloat(pago.monto) || 0
}

function agruparPagosPorOperacion(items: PagoItem[]): PagoOperacion[] {
  const map = new Map<string, PagoOperacion>()
  for (const item of items) {
    const key = item.operacion_pago_id || item.id
    if (!map.has(key)) {
      map.set(key, {
        key, id_representativo: item.id, operacion_pago_id: item.operacion_pago_id,
        fecha: item.fecha, concepto: item.concepto, categoria: item.categoria,
        tipo_origen: item.tipo_origen, estado: item.estado,
        cliente_id: item.cliente_id || null,
        cliente_nombre: item.clientes?.nombre || null,
        inventario_id: item.inventario_id || null,
        cantidad_producto: item.cantidad_producto ?? null,
        total_usd: 0, total_bs: 0, es_pago_mixto: Boolean(item.es_pago_mixto),
        items_total: Number(item.pago_items_total || 1), items: [],
      })
    }
    const group = map.get(key)!
    group.items.push(item)
    group.total_usd = r2(group.total_usd + Number(item.monto_equivalente_usd || 0))
    group.total_bs = r2(group.total_bs + Number(item.monto_equivalente_bs || 0))
    group.es_pago_mixto = group.es_pago_mixto || Boolean(item.es_pago_mixto)
    group.items_total = Math.max(group.items_total, Number(item.pago_items_total || 1))
  }
  return Array.from(map.values()).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function ClienteSearch({
  clientes, value, onChange, disabled = false,
}: { clientes: Cliente[]; value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const sel = useMemo(() => clientes.find((c) => c.id === value) || null, [clientes, value])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? clientes.filter((c) => c.nombre.toLowerCase().includes(q)).slice(0, 50) : clientes.slice(0, 50)
  }, [clientes, query])

  useEffect(() => {
    function out(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', out)
    return () => document.removeEventListener('mousedown', out)
  }, [])

  useEffect(() => { setHighlighted(0) }, [filtered])

  useEffect(() => {
    if (!listRef.current) return
    const item = listRef.current.children[highlighted] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  function handleSelect(id: string) { onChange(id); setQuery(''); setOpen(false) }
  function handleClear() {
    if (disabled) return
    onChange(''); setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) { if (e.key !== 'Tab') setOpen(true); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[highlighted]) handleSelect(filtered[highlighted].id) }
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {sel && !open ? (
        <div className={`flex w-full items-center gap-2 rounded-2xl border px-4 py-3 ${disabled ? 'border-white/10 bg-white/[0.03]' : 'border-violet-400/30 bg-violet-500/10'}`}>
          <span className="flex-1 truncate text-sm font-medium text-white">{sel.nombre}</span>
          {!disabled && (
            <button type="button" onClick={handleClear} className="shrink-0 rounded-full p-0.5 text-white/40 transition hover:text-white/80">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <input ref={inputRef} type="text" value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)} onKeyDown={handleKeyDown}
            placeholder="Buscar cliente por nombre..." className={inputCls}
            autoComplete="off" disabled={disabled} />
          <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/30" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
      {open && !disabled && (
        <ul ref={listRef} className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#16181f] py-1 shadow-xl">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-white/40">Sin resultados para "{query}"</li>
          ) : (
            filtered.map((c, i) => (
              <li key={c.id} onMouseDown={() => handleSelect(c.id)} onMouseEnter={() => setHighlighted(i)}
                className={`cursor-pointer px-4 py-2.5 text-sm transition ${i === highlighted ? 'bg-violet-500/20 text-violet-200' : 'text-white/80 hover:bg-white/[0.05]'}`}>
                {c.nombre}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

const PagoBsSelector = memo(function PagoBsSelector({
  fecha, montoUsd, montoBs, onChangeTasa, onChangeMontoBs,
}: { fecha: string; montoUsd: number; montoBs: number | null; onChangeTasa: (tasa: number | null) => void; onChangeMontoBs: (monto: number) => void }) {
  return (
    <SelectorTasaBCV fecha={fecha} monedaPago="BS" monedaReferencia="EUR"
      montoUSD={montoUsd} montoBs={montoBs || undefined}
      onTasaChange={onChangeTasa} onMontoBsChange={onChangeMontoBs} />
  )
})

function SelectorDeuda({ cuentas, seleccionadaId, onSeleccionar }: {
  cuentas: CuentaPendienteResumen[]; seleccionadaId: string; onSeleccionar: (id: string) => void
}) {
  const [abierto, setAbierto] = useState(true)
  const seleccionada = cuentas.find((c) => c.id === seleccionadaId)

  return (
    <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.04]">
      <button type="button" onClick={() => setAbierto(!abierto)} className="flex w-full items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-rose-300" />
          <p className="text-sm font-medium text-rose-200">{seleccionada ? `Pagando: ${seleccionada.concepto}` : 'Selecciona una deuda a pagar'}</p>
        </div>
        <div className="flex items-center gap-3">
          {seleccionada && <span className="text-sm font-bold text-white">{formatearMoneda(Number(seleccionada.saldo_usd || 0), 'USD')}</span>}
          <ChevronDown className={`h-4 w-4 text-white/40 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {abierto && (
        <div className="space-y-2 border-t border-rose-400/15 px-3 pb-3 pt-2">
          {cuentas.map((cuenta) => {
            const activa = cuenta.id === seleccionadaId
            const progreso = Number(cuenta.monto_total_usd || 0) > 0
              ? Math.min(100, Math.round((Number(cuenta.monto_pagado_usd || 0) / Number(cuenta.monto_total_usd || 0)) * 100)) : 0
            return (
              <button key={cuenta.id} type="button" onClick={() => onSeleccionar(cuenta.id)}
                className={`w-full rounded-2xl border p-3 text-left transition ${activa ? 'border-violet-400/30 bg-violet-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{cuenta.concepto}</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-white/40">
                      <span>Emisión: {formatDateShort(cuenta.fecha_venta)}</span>
                      {cuenta.fecha_vencimiento && <span>Vence: {formatDateShort(cuenta.fecha_vencimiento)}</span>}
                      <span className="capitalize">{cuenta.estado}</span>
                    </div>
                    <div className="mt-2">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-1 rounded-full bg-gradient-to-r from-violet-500 to-emerald-400" style={{ width: `${progreso}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-white/30">
                        {formatearMoneda(Number(cuenta.monto_pagado_usd || 0), 'USD')} pagado de {formatearMoneda(Number(cuenta.monto_total_usd || 0), 'USD')}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-bold text-white">{formatearMoneda(Number(cuenta.saldo_usd || 0), 'USD')}</p>
                    <p className="text-[11px] text-white/35">saldo</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PagoMixtoCard({ numero, pago, metodosPago, fecha, onChange }: {
  numero: 1 | 2; pago: PagoMixtoFormItem; metodosPago: MetodoPago[]
  fecha: string; onChange: (patch: Partial<PagoMixtoFormItem>) => void
}) {
  const isUsd = pago.moneda === 'USD'
  const equivalenteUsd = pagoToUsd(pago)
  const montoBsDisplay = pagoMontoEnBs(pago)
  const metodosDisponibles = useMemo(
    () => isUsd ? metodosPago.filter((m) => detectarMetodoUsd(m)) : metodosPago.filter((m) => detectarMetodoBs(m)),
    [metodosPago, isUsd]
  )
  const colors = numero === 1
    ? { border: 'border-blue-400/20', badge: 'bg-blue-500/15 text-blue-300', equiv: 'text-blue-300' }
    : { border: 'border-violet-400/20', badge: 'bg-violet-500/15 text-violet-300', equiv: 'text-violet-300' }

  return (
    <div className={`rounded-2xl border ${colors.border} bg-white/[0.02] p-5`}>
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${colors.badge}`}>{numero}</span>
          <div>
            <p className="text-sm font-medium text-white">Pago {numero}</p>
            <p className="text-xs text-white/40">{numero === 1 ? 'Método principal' : 'Método secundario'}</p>
          </div>
        </div>
        {(parseFloat(pago.monto) || 0) > 0 && (
          <div className="text-right">
            <p className={`text-lg font-semibold ${colors.equiv}`}>{isUsd ? formatearMoneda(equivalenteUsd, 'USD') : formatearMoneda(montoBsDisplay, 'BS')}</p>
            {!isUsd && equivalenteUsd > 0 && <p className="text-xs text-white/40">≈ {formatearMoneda(equivalenteUsd, 'USD')}</p>}
          </div>
        )}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Moneda</label>
          <select value={pago.moneda} onChange={(e) => onChange({ moneda: e.target.value as 'USD' | 'BS', metodoId: '', monto: '', tasaBcv: null, montoBs: null })} className={inputCls}>
            <option value="USD" className="bg-[#11131a]">USD</option>
            <option value="BS" className="bg-[#11131a]">Bolívares</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{isUsd ? 'Método USD' : 'Método Bs'}</label>
          <select value={pago.metodoId} onChange={(e) => onChange({ metodoId: e.target.value })} className={inputCls}>
            <option value="" className="bg-[#11131a]">Seleccionar método</option>
            {metodosDisponibles.map((m) => (
              <option key={m.id} value={m.id} className="bg-[#11131a]">{m.nombre}{m.moneda ? ` · ${m.moneda}` : ''}{m.cartera?.nombre ? ` · ${m.cartera.nombre}` : ''}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mb-3">
        <label className={labelCls}>{isUsd ? 'Monto USD' : 'Monto Bs'}</label>
        <input type="number" min={0} step="0.01" value={pago.monto} onChange={(e) => onChange({ monto: e.target.value })} className={inputCls} placeholder="0.00" />
      </div>
      {!isUsd && (
        <div className="mb-3">
          <PagoBsSelector fecha={fecha} montoUsd={equivalenteUsd} montoBs={parseFloat(pago.monto) || null}
            onChangeTasa={(tasa) => onChange({ tasaBcv: tasa })}
            onChangeMontoBs={(monto) => onChange({ monto: String(monto), montoBs: monto })} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Referencia</label>
          <input type="text" value={pago.referencia} onChange={(e) => onChange({ referencia: e.target.value })} className={inputCls} placeholder="Comprobante..." />
        </div>
        <div>
          <label className={labelCls}>Notas</label>
          <input type="text" value={pago.notas} onChange={(e) => onChange({ notas: e.target.value })} className={inputCls} placeholder="Opcional..." />
        </div>
      </div>
    </div>
  )
}

function LoadingIngresos() {
  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="h-24 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
        <div className="h-[500px] animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
      </div>
    </div>
  )
}

// ─── Page wrapper ─────────────────────────────────────────────────────────────

export default function IngresosPage() {
  return (
    <Suspense fallback={<LoadingIngresos />}>
      <IngresosPageContent />
    </Suspense>
  )
}

// ─── Page content ─────────────────────────────────────────────────────────────

function IngresosPageContent() {
  const searchParams = useSearchParams()
  const clientePrefill = searchParams.get('cliente') || searchParams.get('clienteId') || ''
  const empleadoPrefill = searchParams.get('empleado') || searchParams.get('empleadoId') || ''
  const tipoIngresoPrefill = searchParams.get('tipoIngreso')
  const destinoPrefill = searchParams.get('destino') || ''
  const cuentaPrefill = searchParams.get('cuenta') || searchParams.get('cuentaId') || ''

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [pagos, setPagos] = useState<PagoItem[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [empleados, setEmpleados] = useState<EmpleadoConsumidor[]>([])

  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingOperacionId, setEditingOperacionId] = useState<string | null>(null)

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [tipoIngreso, setTipoIngreso] = useState<TipoIngresoUI>('producto')
  const [tipoConsumidor, setTipoConsumidor] = useState<TipoConsumidor>('cliente')
  const [clienteId, setClienteId] = useState('')
  const [empleadoId, setEmpleadoId] = useState('')
  const [modoCobroEmpleadoProducto, setModoCobroEmpleadoProducto] = useState<ModoCobroEmpleadoProducto>('pagado')
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [concepto, setConcepto] = useState('')
  const [notas, setNotas] = useState('')

  // ── Venta rápida sin cliente ──────────────────────────────────────────────
  const [ventaSinCliente, setVentaSinCliente] = useState(false)

  // ── PagoConDeudaSelector (productos con cliente) ──────────────────────────
  const [pagoConDeudaState, setPagoConDeudaState] = useState<PagoConDeudaState>(pagoConDeudaInitial())

  // ── Pago rápido (venta sin cliente o edición — pago único/mixto manual) ───
  const [tipoPago, setTipoPago] = useState<'unico' | 'mixto'>('unico')
  const [monedaPagoUnico, setMonedaPagoUnico] = useState<'USD' | 'BS'>('USD')
  const [metodoPagoUnicoId, setMetodoPagoUnicoId] = useState('')
  const [referenciaPagoUnico, setReferenciaPagoUnico] = useState('')
  const [notasPagoUnico, setNotasPagoUnico] = useState('')
  const [tasaPagoUnico, setTasaPagoUnico] = useState<number | null>(null)
  const [montoPagoUnicoBs, setMontoPagoUnicoBs] = useState<number | null>(null)

  const pagoMixtoVacio = (moneda: 'USD' | 'BS' = 'USD'): PagoMixtoFormItem => ({
    moneda, metodoId: '', monto: '', referencia: '', notas: '', tasaBcv: null, montoBs: null,
  })
  const [pagoMixto1, setPagoMixto1] = useState<PagoMixtoFormItem>(pagoMixtoVacio('USD'))
  const [pagoMixto2, setPagoMixto2] = useState<PagoMixtoFormItem>(pagoMixtoVacio('BS'))

  // ── Saldo / abono a deuda ─────────────────────────────────────────────────
  const [estadoCuentaCliente, setEstadoCuentaCliente] = useState<EstadoCuentaCliente | null>(null)
  const [cuentasPendientesCliente, setCuentasPendientesCliente] = useState<CuentaPendienteResumen[]>([])
  const [estadoCuentaEmpleado, setEstadoCuentaEmpleado] = useState<EstadoCuentaEmpleado | null>(null)
  const [cuentasPendientesEmpleado, setCuentasPendientesEmpleado] = useState<CuentaPendienteEmpleadoResumen[]>([])
  const [destinoSaldo, setDestinoSaldo] = useState<DestinoSaldo>('credito')
  const [cuentaCobrarSeleccionadaId, setCuentaCobrarSeleccionadaId] = useState('')
  const [montoAbonoDeuda, setMontoAbonoDeuda] = useState('')
  const [montoManualUSD, setMontoManualUSD] = useState('')

  // ─── Derived ──────────────────────────────────────────────────────────────

  const clienteSeleccionado = useMemo(() => clientes.find((c) => c.id === clienteId) || null, [clientes, clienteId])
  const empleadoSeleccionado = useMemo(() => empleados.find((e) => e.id === empleadoId) || null, [empleados, empleadoId])
  const productoSeleccionado = useMemo(() => productos.find((p) => p.id === productoId) || null, [productos, productoId])
  const cuentaPendienteSeleccionada = useMemo(
    () => tipoConsumidor === 'empleado'
      ? cuentasPendientesEmpleado.find((c) => c.id === cuentaCobrarSeleccionadaId) || null
      : cuentasPendientesCliente.find((c) => c.id === cuentaCobrarSeleccionadaId) || null,
    [tipoConsumidor, cuentasPendientesCliente, cuentasPendientesEmpleado, cuentaCobrarSeleccionadaId]
  )
  const clienteTieneDeuda = useMemo(
    () => cuentasPendientesCliente.some((c) => Number(c.saldo_usd || 0) > 0.01),
    [cuentasPendientesCliente]
  )
  const empleadoTieneDeuda = useMemo(
    () => cuentasPendientesEmpleado.some((c) => Number(c.saldo_usd || 0) > 0.01),
    [cuentasPendientesEmpleado]
  )
  const precioUnitarioUSD = Number(productoSeleccionado?.precio_venta_usd || 0)
  const totalUSD = useMemo(() => r2(Number((cantidad || 0) * precioUnitarioUSD)), [cantidad, precioUnitarioUSD])
  const stockInsuficiente = useMemo(
    () => productoSeleccionado ? cantidad > Number(productoSeleccionado.cantidad_actual || 0) : false,
    [productoSeleccionado, cantidad]
  )
  const montoAbonoDeudaNumero = useMemo(() => r2(Number(montoAbonoDeuda || 0)), [montoAbonoDeuda])
  const montoManualUSDNumero = useMemo(() => r2(Number(montoManualUSD || 0)), [montoManualUSD])

  // Monto real que debe cobrar el bloque de pago rápido.
  // En productos usa el total del producto. En abono a deuda usa el monto a abonar.
  // En recarga de saldo usa un monto manual, porque no existe producto que defina totalUSD.
  const montoObjetivoPagoRapidoUsd = useMemo(() => {
    if (tipoIngreso === 'saldo' && destinoSaldo === 'deuda') return montoAbonoDeudaNumero
    if (tipoIngreso === 'saldo') return montoManualUSDNumero
    return totalUSD
  }, [tipoIngreso, destinoSaldo, montoAbonoDeudaNumero, montoManualUSDNumero, totalUSD])

  const creditoDisponibleUsd = useMemo(() => r2(Number(estadoCuentaCliente?.credito_disponible_usd || 0)), [estadoCuentaCliente])

  // Métodos de pago como MetodoPagoBase para PagoConDeudaSelector
  const metodosPagoBase = useMemo((): MetodoPagoBase[] => metodosPago.map((m) => ({
    id: m.id, nombre: m.nombre, tipo: m.tipo, moneda: m.moneda,
    cartera: m.cartera ? { nombre: m.cartera.nombre, codigo: m.cartera.codigo } : null,
  })), [metodosPago])

  // Fuerza a PagoConDeudaSelector a recalcular su monto interno cuando cambia el total.
  // Sin esto, el componente puede quedarse con el monto anterior hasta reiniciar el formulario.
  const pagoConDeudaKey = useMemo(
    () => `producto-${productoId || 'sin-producto'}-${cantidad || 0}-${totalUSD}-${clienteId || 'sin-cliente'}-${fecha}`,
    [productoId, cantidad, totalUSD, clienteId, fecha]
  )

  // Para venta rápida / edición: calcular totales del pago manual
  const totalPagoMixtoUsd = useMemo(() => {
    return r2(pagoToUsd(pagoMixto1) + pagoToUsd(pagoMixto2))
  }, [pagoMixto1, pagoMixto2])

  const totalPagoUnicoBs = useMemo(
    () => (monedaPagoUnico !== 'BS' || !tasaPagoUnico || tasaPagoUnico <= 0) ? 0 : r2(montoObjetivoPagoRapidoUsd * tasaPagoUnico),
    [monedaPagoUnico, tasaPagoUnico, montoObjetivoPagoRapidoUsd]
  )

  const totalPagoUnicoRealUsd = useMemo(() => {
    if (tipoPago !== 'unico') return 0
    if (monedaPagoUnico !== 'BS') return r2(montoObjetivoPagoRapidoUsd)
    const bsReal = Number(montoPagoUnicoBs || 0)
    if (!tasaPagoUnico || tasaPagoUnico <= 0 || bsReal <= 0) return 0
    return r2(bsReal / tasaPagoUnico)
  }, [tipoPago, monedaPagoUnico, montoObjetivoPagoRapidoUsd, montoPagoUnicoBs, tasaPagoUnico])

  const totalPagoRapidoRealUsd = useMemo(() => {
    return tipoPago === 'unico' ? totalPagoUnicoRealUsd : totalPagoMixtoUsd
  }, [tipoPago, totalPagoUnicoRealUsd, totalPagoMixtoUsd])

  const metodosPagoUnicoDisponibles = useMemo(
    () => monedaPagoUnico === 'USD' ? metodosPago.filter(detectarMetodoUsd) : metodosPago.filter(detectarMetodoBs),
    [metodosPago, monedaPagoUnico]
  )

  const resumenPagosMixtoRapido = useMemo(() => {
    const usd1 = pagoToUsd(pagoMixto1)
    const usd2 = pagoToUsd(pagoMixto2)
    const totalUsd = r2(usd1 + usd2)
    const totalBs = r2(pagoMontoEnBs(pagoMixto1) + pagoMontoEnBs(pagoMixto2))

    // Para recarga de saldo a favor en pago mixto, el total objetivo es la propia suma
    // de los fragmentos. Para producto/abono a deuda, sí debe cuadrar contra un total fijo.
    const esRecargaSaldoLibre = tipoIngreso === 'saldo' && destinoSaldo === 'credito'
    const totalObjetivo = esRecargaSaldoLibre ? totalUsd : montoObjetivoPagoRapidoUsd
    const diff = r2(totalObjetivo - totalUsd)
    const faltante = r2(Math.max(diff, 0))
    const cuadra = esRecargaSaldoLibre ? totalUsd > 0 : Math.abs(diff) < 0.01 && totalObjetivo > 0
    const pct1 = totalObjetivo > 0 ? Math.round((usd1 / totalObjetivo) * 100) : 0
    const pct2 = totalObjetivo > 0 ? Math.round((usd2 / totalObjetivo) * 100) : 0
    const p1Valido = !!pagoMixto1.metodoId && (pagoMixto1.moneda === 'USD' ? (parseFloat(pagoMixto1.monto) || 0) > 0 : (parseFloat(pagoMixto1.monto) || 0) > 0 && (pagoMixto1.tasaBcv || 0) > 0)
    const p2Valido = !!pagoMixto2.metodoId && (pagoMixto2.moneda === 'USD' ? (parseFloat(pagoMixto2.monto) || 0) > 0 : (parseFloat(pagoMixto2.monto) || 0) > 0 && (pagoMixto2.tasaBcv || 0) > 0)
    return { usd1, usd2, totalUsd, totalBs, faltante, cuadra, pct1, pct2, p1Valido, p2Valido, totalObjetivo, esRecargaSaldoLibre }
  }, [pagoMixto1, pagoMixto2, tipoIngreso, destinoSaldo, montoObjetivoPagoRapidoUsd])

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => { void cargarDatos() }, [])

  useEffect(() => {
    if (!ventaSinCliente && tipoConsumidor === 'cliente') void cargarEstadoCuentaCliente(clienteId)
  }, [clienteId, ventaSinCliente, tipoConsumidor])

  useEffect(() => {
    if (!ventaSinCliente && tipoConsumidor === 'empleado') void cargarEstadoCuentaEmpleado(empleadoId)
  }, [empleadoId, ventaSinCliente, tipoConsumidor])

  useEffect(() => {
    if (!clientePrefill || clientes.length === 0 || editingId) return
    if (!clientes.some((c) => c.id === clientePrefill)) return
    setClienteId(clientePrefill)
    setShowForm(true)
    if (tipoIngresoPrefill === 'saldo') {
      setTipoIngreso('saldo')
      if (destinoPrefill === 'deuda') { setDestinoSaldo('deuda'); setConcepto('Abono a deuda') }
      else { setDestinoSaldo('credito'); setConcepto('Recarga de saldo a favor') }
    }
  }, [clientePrefill, tipoIngresoPrefill, destinoPrefill, clientes, editingId])

  useEffect(() => {
    if (!empleadoPrefill || empleados.length === 0 || editingId) return
    if (!empleados.some((e) => e.id === empleadoPrefill)) return
    setTipoConsumidor('empleado')
    setEmpleadoId(empleadoPrefill)
    setShowForm(true)
    if (tipoIngresoPrefill === 'saldo') {
      setTipoIngreso('saldo')
      if (destinoPrefill === 'deuda') { setDestinoSaldo('deuda'); setConcepto('Abono a deuda de empleado') }
      else { setDestinoSaldo('credito'); setConcepto('Recarga de saldo a favor de empleado') }
    }
  }, [empleadoPrefill, tipoIngresoPrefill, destinoPrefill, empleados, editingId])

  useEffect(() => {
    const cuentasActivas = tipoConsumidor === 'empleado' ? cuentasPendientesEmpleado : cuentasPendientesCliente
    if (cuentasActivas.length > 0) {
      if (cuentaPrefill && cuentasActivas.some((c) => c.id === cuentaPrefill)) {
        setCuentaCobrarSeleccionadaId(cuentaPrefill); return
      }
      setCuentaCobrarSeleccionadaId((prev) => {
        if (prev && cuentasActivas.some((c) => c.id === prev)) return prev
        return cuentasActivas[0].id
      })
    } else {
      setCuentaCobrarSeleccionadaId(''); setMontoAbonoDeuda('')
      if (destinoSaldo === 'deuda') setDestinoSaldo('credito')
    }
  }, [tipoConsumidor, cuentasPendientesCliente, cuentasPendientesEmpleado, cuentaPrefill, destinoSaldo])

  useEffect(() => {
    if (destinoSaldo === 'deuda' && cuentaPendienteSeleccionada) {
      setConcepto(`Abono: ${cuentaPendienteSeleccionada.concepto}`)
    }
  }, [destinoSaldo, cuentaCobrarSeleccionadaId])

  useEffect(() => {
    if (destinoSaldo !== 'deuda') { setMontoAbonoDeuda(''); return }
    if (!cuentaPendienteSeleccionada) { setMontoAbonoDeuda(''); return }
    const saldo = r2(Number(cuentaPendienteSeleccionada.saldo_usd || 0))
    setMontoAbonoDeuda((prev) => {
      const prevNum = Number(prev || 0)
      if (!prev || prevNum <= 0 || prevNum > saldo) return saldo > 0 ? String(saldo) : ''
      return String(r2(prevNum))
    })
  }, [destinoSaldo, cuentaPendienteSeleccionada])

  useEffect(() => { setMetodoPagoUnicoId('') }, [monedaPagoUnico])

  useEffect(() => {
    if (tipoIngreso !== 'saldo' || destinoSaldo !== 'credito') setMontoManualUSD('')
  }, [tipoIngreso, destinoSaldo])

  useEffect(() => {
    if (tipoPago === 'mixto' && !editingId) {
      setPagoMixto1(pagoMixtoVacio('USD'))
      setPagoMixto2(pagoMixtoVacio('BS'))
    }
  }, [tipoPago, editingId])

  useEffect(() => {
    if (ventaSinCliente) {
      setClienteId(''); setEmpleadoId(''); setEstadoCuentaCliente(null); setCuentasPendientesCliente([]); setEstadoCuentaEmpleado(null); setCuentasPendientesEmpleado([])
      setTipoIngreso('producto'); setDestinoSaldo('credito')
    }
  }, [ventaSinCliente])

  // Reset pagoConDeudaState al cambiar producto/cantidad/cliente
  useEffect(() => {
    setPagoConDeudaState(pagoConDeudaInitial())
  }, [productoId, cantidad, clienteId, empleadoId, tipoIngreso, tipoConsumidor, totalUSD])

  // Mantiene el concepto sincronizado con la cantidad sin tener que reiniciar.
  useEffect(() => {
    if (editingId) return
    if (tipoIngreso !== 'producto') return
    if (!productoSeleccionado) return
    setConcepto(`Venta de ${productoSeleccionado.nombre} x${cantidad || 1}`)
  }, [editingId, tipoIngreso, productoSeleccionado?.id, productoSeleccionado?.nombre, cantidad])

  // ─── Loaders ──────────────────────────────────────────────────────────────

  async function cargarDatos() {
    setLoading(true)
    const [pagosRes, metodosRes, productosRes, clientesRes, empleadosRes] = await Promise.all([
      supabase.from('pagos')
        .select(`id, operacion_pago_id, pago_item_no, pago_items_total, es_pago_mixto, fecha, concepto, categoria, tipo_origen, estado, moneda_pago, tasa_bcv, monto, monto_pago, monto_equivalente_usd, monto_equivalente_bs, cliente_id, inventario_id, cantidad_producto, metodo_pago_id, metodo_pago_v2_id, notas, referencia, metodos_pago_v2:metodo_pago_v2_id(nombre), clientes:cliente_id(nombre)`)
        .in('categoria', ['producto', 'saldo_cliente'])
        .in('tipo_origen', ['producto', 'saldo_cliente'])
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('metodos_pago_v2')
        .select(`id, nombre, tipo, moneda, cartera:carteras(nombre, codigo)`)
        .eq('activo', true).eq('permite_recibir', true),
      supabase.from('inventario')
        .select(`id, nombre, descripcion, cantidad_actual, unidad_medida, precio_venta_usd, estado`)
        .eq('estado', 'activo').order('nombre'),
      supabase.from('clientes').select('id, nombre, telefono, email').order('nombre'),
      supabase.from('empleados').select('id, nombre, telefono, email, rol').eq('estado', 'activo').order('nombre'),
    ])
    if (pagosRes.data) setPagos((pagosRes.data as RawPago[]).map(normalizePago))
    if (metodosRes.data) setMetodosPago((metodosRes.data as RawMetodoPago[]).map(normalizeMetodoPago))
    if (productosRes.data) setProductos(productosRes.data as Producto[])
    if (clientesRes.data) setClientes(clientesRes.data as Cliente[])
    if (empleadosRes.data) setEmpleados(empleadosRes.data as EmpleadoConsumidor[])
    setLoading(false)
  }

  async function cargarEstadoCuentaCliente(id: string) {
    if (!id) { setEstadoCuentaCliente(null); setCuentasPendientesCliente([]); return }
    const [estadoRes, cuentasRes] = await Promise.all([
      supabase.from('v_clientes_estado_cuenta')
        .select(`cliente_id, total_pendiente_usd, credito_disponible_usd, saldo_pendiente_neto_usd, saldo_favor_neto_usd, total_pendiente_bs, credito_disponible_bs, saldo_pendiente_neto_bs, saldo_favor_neto_bs`)
        .eq('cliente_id', id).maybeSingle(),
      supabase.from('v_cuentas_por_cobrar_resumen')
        .select(`id, cliente_id, cliente_nombre, concepto, monto_total_usd, monto_pagado_usd, saldo_usd, fecha_venta, fecha_vencimiento, estado`)
        .eq('cliente_id', id).in('estado', ['pendiente', 'parcial', 'vencida'])
        .order('fecha_venta', { ascending: true }),
    ])
    setEstadoCuentaCliente((estadoRes.data as EstadoCuentaCliente | null) ?? null)
    setCuentasPendientesCliente((cuentasRes.data || []) as CuentaPendienteResumen[])
  }


  async function cargarEstadoCuentaEmpleado(id: string) {
    if (!id) { setEstadoCuentaEmpleado(null); setCuentasPendientesEmpleado([]); return }
    const [estadoRes, cuentasRes] = await Promise.all([
      supabase.from('v_empleados_estado_cuenta')
        .select(`empleado_id, nombre, rol, total_pendiente_usd, credito_disponible_usd, saldo_pendiente_neto_usd, saldo_favor_neto_usd`)
        .eq('empleado_id', id).maybeSingle(),
      supabase.from('v_empleados_cuentas_por_cobrar_resumen')
        .select(`id, empleado_id, empleado_nombre, concepto, monto_total_usd, monto_pagado_usd, saldo_usd, fecha_venta, fecha_vencimiento, estado`)
        .eq('empleado_id', id).in('estado', ['pendiente', 'parcial', 'vencida'])
        .order('fecha_venta', { ascending: true }),
    ])
    setEstadoCuentaEmpleado((estadoRes.data as EstadoCuentaEmpleado | null) ?? null)
    setCuentasPendientesEmpleado((cuentasRes.data || []) as CuentaPendienteEmpleadoResumen[])
  }

  // ─── Helpers de escritura ─────────────────────────────────────────────────

  async function limpiarCreditosExcedenteOperacion(operacionId: string | null) {
    if (!operacionId) return
    const { data: creditos, error } = await supabase
      .from('clientes_credito').select('id, monto_original, monto_disponible')
      .eq('origen_tipo', 'pago_excedente').eq('origen_id', operacionId)
    if (error) throw error
    if (!creditos || creditos.length === 0) return
    for (const credito of creditos) {
      if (Math.abs(Number(credito.monto_disponible || 0) - Number(credito.monto_original || 0)) > 0.01)
        throw new Error('Esta venta tiene un crédito generado que ya fue usado parcial o totalmente.')
      const { data: ap } = await supabase.from('clientes_credito_aplicaciones')
        .select('id').eq('credito_id', String(credito.id)).limit(1)
      if (ap && ap.length > 0) throw new Error('Esta venta tiene un crédito aplicado a otra deuda.')
    }
    const { error: deleteError } = await supabase.from('clientes_credito')
      .delete().in('id', creditos.map((c) => String(c.id)))
    if (deleteError) throw deleteError
  }

  async function crearCreditoCliente(args: {
    clienteId: string; operacionPagoId: string; excedenteUsd: number
    descripcion: string; origenTipo?: string; tasaRef?: number | null
  }) {
    const excedenteUsd = r2(args.excedenteUsd)
    if (excedenteUsd <= 0) return
    const montoBs = args.tasaRef ? r2(excedenteUsd * args.tasaRef) : null
    const { error } = await supabase.from('clientes_credito').insert({
      cliente_id: args.clienteId, origen_tipo: args.origenTipo || 'pago_excedente',
      origen_id: args.operacionPagoId, moneda: 'USD',
      monto_original: excedenteUsd, monto_disponible: excedenteUsd,
      tasa_bcv: args.tasaRef || null,
      monto_original_bs: montoBs, monto_disponible_bs: montoBs,
      descripcion: args.descripcion, fecha, estado: 'activo', registrado_por: null,
    })
    if (error) throw error
  }

  async function descontarInventarioYCrearMovimiento(args: {
    pagoId?: string | null; productoId: string; cantidad: number
    cantidadAnterior: number; cantidadNueva: number
    precioUnitarioUSD: number; totalUSD: number; conceptoMovimiento: string
  }) {
    const { error: invError } = await supabase.from('inventario')
      .update({ cantidad_actual: args.cantidadNueva }).eq('id', args.productoId)
    if (invError) throw invError
    const { error: movError } = await supabase.from('movimientos_inventario').insert({
      inventario_id: args.productoId, tipo: 'salida', cantidad: args.cantidad,
      cantidad_anterior: args.cantidadAnterior, cantidad_nueva: args.cantidadNueva,
      concepto: args.conceptoMovimiento, precio_unitario_usd: args.precioUnitarioUSD,
      monto_total_usd: args.totalUSD, pago_id: args.pagoId || null,
    })
    if (movError) throw movError
  }


  async function crearCreditoEmpleado(args: {
    empleadoId: string; operacionPagoId?: string | null; montoUsd: number
    descripcion: string; origenTipo?: string; tasaRef?: number | null
  }) {
    const montoUsd = r2(args.montoUsd)
    if (montoUsd <= 0) return
    const montoBs = args.tasaRef ? r2(montoUsd * args.tasaRef) : null
    const { error } = await supabase.from('empleados_credito').insert({
      empleado_id: args.empleadoId,
      origen_tipo: args.origenTipo || 'saldo_empleado',
      origen_id: args.operacionPagoId || null,
      moneda: 'USD',
      monto_original: montoUsd,
      monto_disponible: montoUsd,
      tasa_bcv: args.tasaRef || null,
      monto_original_bs: montoBs,
      monto_disponible_bs: montoBs,
      descripcion: args.descripcion,
      fecha,
      estado: 'activo',
      registrado_por: null,
    })
    if (error) throw error
  }

  async function crearDeudaEmpleado(args: {
    empleadoId: string; empleadoNombre: string; concepto: string; montoUsd: number
    inventarioId?: string | null; cantidadProducto?: number | null; notas?: string | null
  }) {
    const montoUsd = r2(args.montoUsd)
    if (montoUsd <= 0) return
    const { error } = await supabase.from('empleados_cuentas_por_cobrar').insert({
      empleado_id: args.empleadoId,
      empleado_nombre: args.empleadoNombre,
      concepto: args.concepto,
      tipo_origen: args.inventarioId ? 'venta_inventario_empleado' : 'saldo_empleado',
      origen_tipo: args.inventarioId ? 'venta_inventario_empleado' : 'saldo_empleado',
      inventario_id: args.inventarioId || null,
      cantidad_producto: args.cantidadProducto || null,
      monto_total_usd: montoUsd,
      monto_pagado_usd: 0,
      saldo_usd: montoUsd,
      fecha_venta: fecha,
      fecha_vencimiento: null,
      estado: 'pendiente',
      notas: args.notas || null,
      registrado_por: null,
      moneda: 'USD',
    })
    if (error) throw error
  }

  async function registrarAbonoDeudaEmpleado(args: {
    cuentaCobrarId: string; empleadoId: string; montoUsd: number; notas?: string | null
  }) {
    const montoUsd = r2(args.montoUsd)
    if (montoUsd <= 0) return
    const { error } = await supabase.from('empleados_abonos_cobranza').insert({
      cuenta_cobrar_id: args.cuentaCobrarId,
      empleado_id: args.empleadoId,
      fecha,
      monto_usd: montoUsd,
      notas: args.notas || null,
      registrado_por: null,
    })
    if (error) throw error
  }

  // ─── Build payloads para pago rápido (venta sin cliente / edición) ─────────

  function buildPagosPayloadRapido() {
    if (tipoPago === 'unico') {
      const montoBsReal = r2(Number(montoPagoUnicoBs || 0))
      return [{
        metodo_pago_v2_id: metodoPagoUnicoId,
        moneda_pago: monedaPagoUnico,
        // IMPORTANTE:
        // Si el pago es en Bs, se registra el monto REAL escrito/cargado en Bs.
        // Antes se mandaba montoObjetivoUSD * tasa, por eso no permitía que una
        // deuda de $110 se cobrara como $130 equivalentes cuando el cliente paga en Bs.
        monto: monedaPagoUnico === 'BS' ? (montoBsReal > 0 ? montoBsReal : r2(totalPagoUnicoBs)) : r2(montoObjetivoPagoRapidoUsd),
        tasa_bcv: monedaPagoUnico === 'BS' ? tasaPagoUnico : null,
        referencia: referenciaPagoUnico || null,
        notas: notasPagoUnico || null,
      }]
    }
    return [pagoMixto1, pagoMixto2].map((item, index) => {
      const monto = parseFloat(item.monto)
      if (!Number.isFinite(monto) || monto <= 0) {
        throw new Error(`El Pago ${index + 1} debe tener monto mayor a 0.`)
      }
      return {
        metodo_pago_v2_id: item.metodoId,
        moneda_pago: item.moneda,
        monto: r2(monto),
        tasa_bcv: item.moneda === 'BS' ? item.tasaBcv : null,
        referencia: item.referencia || null,
        notas: item.notas || null,
      }
    })
  }

  function validarPagoRapido(): string | null {
    if (tipoPago === 'unico') {
      if (!metodoPagoUnicoId) return 'Selecciona el método de pago.'
      if (!montoObjetivoPagoRapidoUsd || montoObjetivoPagoRapidoUsd <= 0) {
        return tipoIngreso === 'saldo' && destinoSaldo === 'credito'
          ? 'Indica el monto a recargar. Debe ser mayor a 0.'
          : 'El monto del pago debe ser mayor a 0.'
      }
      if (monedaPagoUnico === 'BS' && (!tasaPagoUnico || tasaPagoUnico <= 0))
        return 'Selecciona una tasa válida para el pago en bolívares.'
      if (monedaPagoUnico === 'BS' && Number(montoPagoUnicoBs || 0) <= 0)
        return 'El monto en bolívares debe ser mayor a 0.'
      return null
    }
    if (!resumenPagosMixtoRapido.p1Valido) return 'Completa el Pago 1: método, monto y tasa si aplica.'
    if (!resumenPagosMixtoRapido.p2Valido) return 'Completa el Pago 2: método, monto y tasa si aplica.'
    if (resumenPagosMixtoRapido.totalUsd <= 0) return 'La suma de los pagos debe ser mayor a 0.'
    if (!resumenPagosMixtoRapido.esRecargaSaldoLibre && !resumenPagosMixtoRapido.cuadra) {
      return `La suma no cuadra. Faltante: ${formatearMoneda(resumenPagosMixtoRapido.faltante, 'USD')}`
    }
    return null
  }

  async function registrarPagoMixtoProducto(args: {
    fecha: string; concepto: string; clienteId: string | null
    inventarioId: string; cantidad: number; notasGenerales: string | null
    pagos: any[]
  }) {
    const { data, error } = await supabase.rpc('registrar_pagos_mixtos', {
      p_fecha: args.fecha, p_tipo_origen: 'producto', p_categoria: 'producto',
      p_concepto: args.concepto, p_cliente_id: args.clienteId || null,
      p_cita_id: null, p_cliente_plan_id: null, p_cuenta_cobrar_id: null,
      p_inventario_id: args.inventarioId, p_registrado_por: null,
      p_notas_generales: args.notasGenerales, p_pagos: args.pagos,
    })
    if (error) throw error
    const operacionPagoId = data?.operacion_pago_id || null
    if (operacionPagoId) {
      await supabase.from('pagos')
        .update({ inventario_id: args.inventarioId, cantidad_producto: args.cantidad })
        .eq('operacion_pago_id', operacionPagoId)
    }
    return operacionPagoId as string | null
  }

  async function registrarPagoMixtoSaldo(args: {
    fecha: string; concepto: string; clienteId: string; notasGenerales: string | null; pagos: any[]
  }) {
    const { data, error } = await supabase.rpc('registrar_pagos_mixtos', {
      p_fecha: args.fecha, p_tipo_origen: 'saldo_cliente', p_categoria: 'saldo_cliente',
      p_concepto: args.concepto, p_cliente_id: args.clienteId,
      p_cita_id: null, p_cliente_plan_id: null, p_cuenta_cobrar_id: null,
      p_inventario_id: null, p_registrado_por: null,
      p_notas_generales: args.notasGenerales, p_pagos: args.pagos,
    })
    if (error) throw error
    return data?.operacion_pago_id || null
  }

  async function ajustarCuentaCobrarClienteSiAbonoSuperaSaldo(args: {
    cuenta: CuentaPendienteResumen
    montoAbonoUsd: number
  }) {
    const saldoActual = r2(Number(args.cuenta.saldo_usd || 0))
    const montoAbonoUsd = r2(args.montoAbonoUsd)
    const diferencia = r2(montoAbonoUsd - saldoActual)
    if (diferencia <= 0.01) return

    const totalActual = r2(Number(args.cuenta.monto_total_usd || 0))
    const pagadoActual = r2(Number(args.cuenta.monto_pagado_usd || 0))
    const nuevoTotal = r2(totalActual + diferencia)
    const nuevoSaldo = r2(Math.max(nuevoTotal - pagadoActual, 0))

    const { error } = await supabase.from('cuentas_por_cobrar').update({
      monto_total_usd: nuevoTotal,
      saldo_usd: nuevoSaldo,
      estado: nuevoSaldo <= 0.01 ? 'pagado' : (pagadoActual > 0 ? 'parcial' : 'pendiente'),
      notas: `${args.cuenta.concepto || 'Deuda'} | Ajuste por pago en Bs: total actualizado de ${formatearMoneda(totalActual, 'USD')} a ${formatearMoneda(nuevoTotal, 'USD')}.`,
    }).eq('id', args.cuenta.id)

    if (error) throw error
  }

  async function ajustarCuentaCobrarEmpleadoSiAbonoSuperaSaldo(args: {
    cuenta: CuentaPendienteEmpleadoResumen
    montoAbonoUsd: number
  }) {
    const saldoActual = r2(Number(args.cuenta.saldo_usd || 0))
    const montoAbonoUsd = r2(args.montoAbonoUsd)
    const diferencia = r2(montoAbonoUsd - saldoActual)
    if (diferencia <= 0.01) return

    const totalActual = r2(Number(args.cuenta.monto_total_usd || 0))
    const pagadoActual = r2(Number(args.cuenta.monto_pagado_usd || 0))
    const nuevoTotal = r2(totalActual + diferencia)
    const nuevoSaldo = r2(Math.max(nuevoTotal - pagadoActual, 0))

    const { error } = await supabase.from('empleados_cuentas_por_cobrar').update({
      monto_total_usd: nuevoTotal,
      saldo_usd: nuevoSaldo,
      estado: nuevoSaldo <= 0.01 ? 'pagado' : (pagadoActual > 0 ? 'parcial' : 'pendiente'),
      notas: `${args.cuenta.concepto || 'Deuda empleado'} | Ajuste por pago en Bs: total actualizado de ${formatearMoneda(totalActual, 'USD')} a ${formatearMoneda(nuevoTotal, 'USD')}.`,
    }).eq('id', args.cuenta.id)

    if (error) throw error
  }

  async function registrarPagoMixtoDeuda(args: {
    cuentaCobrarId: string; fecha: string; notasGenerales: string | null; pagos: any[]
  }) {
    await registrarAbonoMixto({
      cuenta_cobrar_id: args.cuentaCobrarId, fecha: args.fecha,
      notas_generales: args.notasGenerales, pagos: args.pagos,
    })
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // ══ VENTA RÁPIDA SIN CLIENTE ═════════════════════════════════════════════
    if (ventaSinCliente) {
      if (!productoId) { alert('Selecciona un producto'); return }
      if (cantidad <= 0) { alert('La cantidad debe ser mayor a 0'); return }
      if (stockInsuficiente) { alert('No hay suficiente stock disponible'); return }

      const err = validarPagoRapido()
      if (err) { alert(err); return }

      setSaving(true)
      try {
        const conceptoFinal = concepto.trim() || `Venta rápida de ${productoSeleccionado?.nombre || ''} x${cantidad}`
        const operacionPagoId = await registrarPagoMixtoProducto({
          fecha, concepto: conceptoFinal, clienteId: null,
          inventarioId: productoId, cantidad,
          notasGenerales: notas.trim() || null,
          pagos: buildPagosPayloadRapido(),
        })
        const cantidadAnterior = Number(productoSeleccionado?.cantidad_actual || 0)
        await descontarInventarioYCrearMovimiento({
          pagoId: operacionPagoId, productoId, cantidad,
          cantidadAnterior, cantidadNueva: cantidadAnterior - cantidad,
          precioUnitarioUSD, totalUSD,
          conceptoMovimiento: 'Venta rápida (sin cliente)',
        })
        alert(`✅ Venta rápida registrada: ${formatearMoneda(totalUSD, 'USD')}`)
        resetForm()
        await cargarDatos()
      } catch (err: any) {
        alert('Error: ' + (err.message || 'No se pudo guardar'))
      } finally { setSaving(false) }
      return
    }

    // ══ CONSUMO / SALDO DE EMPLEADO ════════════════════════════════════════
    if (!ventaSinCliente && tipoConsumidor === 'empleado') {
      if (!empleadoId || !empleadoSeleccionado) { alert('Selecciona un empleado'); return }

      // Abono a deuda existente del empleado
      if (tipoIngreso === 'saldo' && destinoSaldo === 'deuda' && cuentaPendienteSeleccionada) {
        if (montoAbonoDeudaNumero <= 0) { alert('El monto del abono debe ser mayor a 0'); return }
        const errSaldo = validarPagoRapido()
        if (errSaldo) { alert(errSaldo); return }
        const montoRealAbonoUsd = r2(totalPagoRapidoRealUsd || montoAbonoDeudaNumero)
        if (montoRealAbonoUsd <= 0) { alert('El pago real debe ser mayor a 0.'); return }

        setSaving(true)
        try {
          await ajustarCuentaCobrarEmpleadoSiAbonoSuperaSaldo({
            cuenta: cuentaPendienteSeleccionada as CuentaPendienteEmpleadoResumen,
            montoAbonoUsd: montoRealAbonoUsd,
          })
          await registrarAbonoDeudaEmpleado({
            cuentaCobrarId: cuentaPendienteSeleccionada.id,
            empleadoId: empleadoSeleccionado.id,
            montoUsd: montoRealAbonoUsd,
            notas: notas.trim() || null,
          })
          alert(`✅ Abono de empleado aplicado por ${formatearMoneda(montoRealAbonoUsd, 'USD')}`)
          resetForm()
          await cargarDatos()
          await cargarEstadoCuentaEmpleado(empleadoSeleccionado.id)
        } catch (err: any) {
          alert('Error: ' + (err.message || 'No se pudo guardar'))
        } finally { setSaving(false) }
        return
      }

      // Crédito / saldo a favor del empleado
      if (tipoIngreso === 'saldo') {
        const errSaldo = validarPagoRapido()
        if (errSaldo) { alert(errSaldo); return }
        const totalSaldoUsd = tipoPago === 'unico' ? totalPagoUnicoRealUsd : totalPagoMixtoUsd
        if (totalSaldoUsd <= 0) { alert('Debes indicar un monto válido para la recarga.'); return }

        setSaving(true)
        try {
          const conceptoFinal = concepto.trim() || `Recarga de saldo a favor - ${empleadoSeleccionado.nombre}`
          await crearCreditoEmpleado({
            empleadoId: empleadoSeleccionado.id,
            montoUsd: totalSaldoUsd,
            descripcion: conceptoFinal,
            origenTipo: 'saldo_empleado',
          })
          alert(`✅ Saldo agregado al empleado: ${formatearMoneda(totalSaldoUsd, 'USD')}`)
          resetForm()
          await cargarDatos()
          await cargarEstadoCuentaEmpleado(empleadoSeleccionado.id)
        } catch (err: any) {
          alert('Error: ' + (err.message || 'No se pudo guardar'))
        } finally { setSaving(false) }
        return
      }

      // Venta de producto a empleado: pagar ahora o dejar deuda
      if (tipoIngreso === 'producto') {
        if (!productoId) { alert('Selecciona un producto'); return }
        if (cantidad <= 0) { alert('La cantidad debe ser mayor a 0'); return }
        if (stockInsuficiente) { alert('No hay suficiente stock disponible'); return }

        setSaving(true)
        try {
          const conceptoFinal = concepto.trim() || `Consumo empleado: ${productoSeleccionado?.nombre || ''} x${cantidad} - ${empleadoSeleccionado.nombre}`
          let operacionPagoId: string | null = null

          if (modoCobroEmpleadoProducto === 'pagado') {
            const err = validarPagoRapido()
            if (err) { alert(err); setSaving(false); return }
            operacionPagoId = await registrarPagoMixtoProducto({
              fecha,
              concepto: conceptoFinal,
              clienteId: null,
              inventarioId: productoId,
              cantidad,
              notasGenerales: `Empleado: ${empleadoSeleccionado.nombre}${notas.trim() ? `
${notas.trim()}` : ''}`,
              pagos: buildPagosPayloadRapido(),
            })
          } else {
            await crearDeudaEmpleado({
              empleadoId: empleadoSeleccionado.id,
              empleadoNombre: empleadoSeleccionado.nombre,
              concepto: conceptoFinal,
              montoUsd: totalUSD,
              inventarioId: productoId,
              cantidadProducto: cantidad,
              notas: notas.trim() || null,
            })
          }

          const cantidadAnterior = Number(productoSeleccionado?.cantidad_actual || 0)
          await descontarInventarioYCrearMovimiento({
            pagoId: operacionPagoId,
            productoId,
            cantidad,
            cantidadAnterior,
            cantidadNueva: cantidadAnterior - cantidad,
            precioUnitarioUSD,
            totalUSD,
            conceptoMovimiento: `Consumo empleado - ${empleadoSeleccionado.nombre}`,
          })

          alert(modoCobroEmpleadoProducto === 'pagado'
            ? `✅ Consumo de empleado registrado y pagado: ${formatearMoneda(totalUSD, 'USD')}`
            : `✅ Consumo de empleado registrado como deuda: ${formatearMoneda(totalUSD, 'USD')}`)
          resetForm()
          await cargarDatos()
          await cargarEstadoCuentaEmpleado(empleadoSeleccionado.id)
        } catch (err: any) {
          alert('Error: ' + (err.message || 'No se pudo guardar'))
        } finally { setSaving(false) }
        return
      }
    }

    // ══ VALIDACIONES COMUNES ════════════════════════════════════════════════
    if (!clienteId) { alert('Selecciona un cliente'); return }
    if (!clienteSeleccionado) { alert('Cliente inválido'); return }

    // ══ ABONO A DEUDA (tipo saldo → destino deuda) ══════════════════════════
    if (tipoIngreso === 'saldo' && destinoSaldo === 'deuda' && cuentaPendienteSeleccionada) {
      if (montoAbonoDeudaNumero <= 0) { alert('El monto del abono debe ser mayor a 0'); return }
      const errSaldo = validarPagoRapido()
      if (errSaldo) { alert(errSaldo); return }
      const montoRealAbonoUsd = r2(totalPagoRapidoRealUsd || montoAbonoDeudaNumero)
      if (montoRealAbonoUsd <= 0) { alert('El pago real debe ser mayor a 0.'); return }

      setSaving(true)
      try {
        await ajustarCuentaCobrarClienteSiAbonoSuperaSaldo({
          cuenta: cuentaPendienteSeleccionada as CuentaPendienteResumen,
          montoAbonoUsd: montoRealAbonoUsd,
        })
        await registrarPagoMixtoDeuda({
          cuentaCobrarId: cuentaPendienteSeleccionada.id,
          fecha, notasGenerales: notas.trim() || null,
          pagos: buildPagosPayloadRapido(),
        })
        alert(`✅ Abono aplicado por ${formatearMoneda(montoRealAbonoUsd, 'USD')}`)
        resetForm()
        await cargarDatos()
        await cargarEstadoCuentaCliente(clienteSeleccionado.id)
      } catch (err: any) {
        alert('Error: ' + (err.message || 'No se pudo guardar'))
      } finally { setSaving(false) }
      return
    }

    // ══ RECARGA DE SALDO (tipo saldo → destino crédito) ═════════════════════
    if (tipoIngreso === 'saldo') {
      if (editingId) { alert('Las recargas de saldo no se editan. Registra una nueva.'); return }
      const errSaldo = validarPagoRapido()
      if (errSaldo) { alert(errSaldo); return }

      const totalSaldoUsd = tipoPago === 'unico'
        ? totalPagoUnicoRealUsd
        : r2(pagoToUsd(pagoMixto1) + pagoToUsd(pagoMixto2))

      if (totalSaldoUsd <= 0) { alert('Debes indicar un monto válido para la recarga.'); return }

      setSaving(true)
      try {
        const conceptoFinal = concepto.trim() || 'Recarga de saldo a favor'
        const operacionPagoId = await registrarPagoMixtoSaldo({
          fecha, concepto: conceptoFinal, clienteId: clienteSeleccionado.id,
          notasGenerales: notas.trim() || null,
          pagos: buildPagosPayloadRapido(),
        })
        if (!operacionPagoId) throw new Error('No se pudo generar la operación de recarga de saldo')
        await crearCreditoCliente({
          clienteId: clienteSeleccionado.id, operacionPagoId,
          excedenteUsd: totalSaldoUsd, descripcion: conceptoFinal,
          origenTipo: 'saldo_cliente',
        })
        alert(`✅ Saldo agregado: ${formatearMoneda(totalSaldoUsd, 'USD')}`)
        resetForm()
        await cargarDatos()
        await cargarEstadoCuentaCliente(clienteSeleccionado.id)
      } catch (err: any) {
        alert('Error: ' + (err.message || 'No se pudo guardar'))
      } finally { setSaving(false) }
      return
    }

    // ══ VENTA DE PRODUCTO CON CLIENTE (nuevo con PagoConDeudaSelector) ═══════
    if (tipoIngreso === 'producto') {
      if (!productoId) { alert('Selecciona un producto'); return }
      if (cantidad <= 0) { alert('La cantidad debe ser mayor a 0'); return }
      if (!editingId && stockInsuficiente) { alert('No hay suficiente stock disponible'); return }

      const conceptoFinal = concepto.trim() || `Venta de ${productoSeleccionado?.nombre || ''} x${cantidad}`

      // ── Edición ────────────────────────────────────────────────────────────
      if (editingId) {
        const errEdicion = validarPagoRapido()
        if (errEdicion) { alert(errEdicion); return }

        setSaving(true)
        try {
          await limpiarCreditosExcedenteOperacion(editingOperacionId)
          if (editingOperacionId) {
            const { error } = await supabase.from('pagos').delete().eq('operacion_pago_id', editingOperacionId)
            if (error) throw error
          } else {
            const { error } = await supabase.from('pagos').delete().eq('id', editingId)
            if (error) throw error
          }
          const nuevaOpId = await registrarPagoMixtoProducto({
            fecha, concepto: conceptoFinal, clienteId: clienteSeleccionado.id,
            inventarioId: productoId, cantidad,
            notasGenerales: notas.trim() || null,
            pagos: buildPagosPayloadRapido(),
          })
          alert('✅ Ingreso actualizado')
          resetForm()
          await cargarDatos()
          await cargarEstadoCuentaCliente(clienteSeleccionado.id)
        } catch (err: any) {
          alert('Error: ' + (err.message || 'No se pudo guardar'))
        } finally { setSaving(false) }
        return
      }

      // ── Nuevo con PagoConDeudaSelector ────────────────────────────────────
      if (pagoConDeudaState.tipoCobro !== 'sin_pago') {
        const errPago = validarPagoConDeuda(pagoConDeudaState, totalUSD)
        if (errPago) { alert(errPago); return }
      }

      setSaving(true)
      try {
        let operacionPagoId: string | null = null

        // Registrar pago si corresponde
        if (pagoConDeudaState.tipoCobro !== 'sin_pago') {
          const pagosRpc = buildPagosRpcPayload(pagoConDeudaState, totalUSD)
          if (pagosRpc) {
            operacionPagoId = await registrarPagoMixtoProducto({
              fecha, concepto: conceptoFinal, clienteId: clienteSeleccionado.id,
              inventarioId: productoId, cantidad,
              notasGenerales: notas.trim() || null,
              pagos: pagosRpc,
            })
          }
        }

        // Crear cuenta por cobrar si hay deuda
        const cxcPayload = buildCuentaPorCobrarPayload({
          state: pagoConDeudaState, montoTotal: totalUSD,
          clienteId: clienteSeleccionado.id, clienteNombre: clienteSeleccionado.nombre,
          concepto: conceptoFinal, fecha,
          registradoPor: null,
        })
        if (cxcPayload) {
          // Añadir datos de inventario a la cuenta por cobrar
          const { error: cxcErr } = await supabase.from('cuentas_por_cobrar').insert({
            ...cxcPayload,
            tipo_origen: 'venta_inventario',
            inventario_id: productoId,
            cantidad_producto: cantidad,
          })
          if (cxcErr) console.warn('No se pudo crear cuenta por cobrar:', cxcErr.message)
        }

        // Descontar inventario
        const cantidadAnterior = Number(productoSeleccionado?.cantidad_actual || 0)
        await descontarInventarioYCrearMovimiento({
          pagoId: operacionPagoId, productoId, cantidad,
          cantidadAnterior, cantidadNueva: cantidadAnterior - cantidad,
          precioUnitarioUSD, totalUSD,
          conceptoMovimiento: `Venta a ${clienteSeleccionado.nombre}`,
        })

        const deuda = r2(Math.max(totalUSD - (pagoConDeudaState.tipoCobro === 'sin_pago' ? 0 : r2(totalUSD)), 0))
        const msg = pagoConDeudaState.tipoCobro === 'sin_pago'
          ? `✅ Venta registrada. Deuda total: ${formatearMoneda(totalUSD, 'USD')}`
          : pagoConDeudaState.tipoCobro === 'abono'
          ? `✅ Venta registrada. Abono registrado, queda pendiente ${formatearMoneda(deuda, 'USD')}`
          : '✅ Venta registrada y pagada'

        alert(msg)
        resetForm()
        await cargarDatos()
        await cargarEstadoCuentaCliente(clienteSeleccionado.id)
      } catch (err: any) {
        alert('Error: ' + (err.message || 'No se pudo guardar'))
      } finally { setSaving(false) }
    }
  }

  // ─── Reset ────────────────────────────────────────────────────────────────

  function resetForm() {
    setTipoIngreso('producto'); setTipoConsumidor('cliente'); setModoCobroEmpleadoProducto('pagado'); setProductoId(''); setClienteId(''); setEmpleadoId('')
    setCantidad(1); setConcepto(''); setNotas('')
    setFecha(new Date().toISOString().slice(0, 10))
    setVentaSinCliente(false)
    setPagoConDeudaState(pagoConDeudaInitial())
    setTipoPago('unico'); setMonedaPagoUnico('USD'); setMetodoPagoUnicoId('')
    setReferenciaPagoUnico(''); setNotasPagoUnico(''); setTasaPagoUnico(null); setMontoPagoUnicoBs(null)
    setPagoMixto1(pagoMixtoVacio('USD')); setPagoMixto2(pagoMixtoVacio('BS'))
    setEditingId(null); setEditingOperacionId(null)
    setCuentaCobrarSeleccionadaId(''); setMontoAbonoDeuda(''); setMontoManualUSD('')
    setDestinoSaldo('credito'); setShowForm(false)
  }

  // ─── Edit ─────────────────────────────────────────────────────────────────

  function startEdit(operacion: PagoOperacion) {
    setVentaSinCliente(false)
    setTipoIngreso('producto')
    setEditingId(operacion.id_representativo)
    setEditingOperacionId(operacion.operacion_pago_id)
    setFecha(operacion.fecha)
    setConcepto(operacion.concepto)
    setProductoId(operacion.inventario_id || '')
    setCantidad(Number(operacion.cantidad_producto || 1))
    setClienteId(operacion.cliente_id || '')
    setNotas(operacion.items[0]?.notas || '')
    setPagoConDeudaState(pagoConDeudaInitial())

    const itemsOrdenados = [...operacion.items].sort((a, b) => Number(a.pago_item_no || 0) - Number(b.pago_item_no || 0))

    const mapItemToForm = (item?: PagoItem | null): PagoMixtoFormItem => {
      if (!item) return pagoMixtoVacio('USD')
      const moneda = ((item.moneda_pago || 'USD').toUpperCase() === 'BS' || (item.moneda_pago || '').toUpperCase() === 'VES') ? 'BS' : 'USD'
      const montoBase = moneda === 'BS'
        ? Number(item.monto ?? item.monto_pago ?? item.monto_equivalente_bs ?? 0)
        : Number(item.monto_equivalente_usd ?? item.monto ?? item.monto_pago ?? 0)
      return {
        moneda, metodoId: item.metodo_pago_v2_id || '',
        monto: montoBase > 0 ? String(r2(montoBase)) : '',
        referencia: item.referencia || '', notas: item.notas || '',
        tasaBcv: item.tasa_bcv ?? null,
        montoBs: moneda === 'BS' ? Number(item.monto_equivalente_bs ?? item.monto ?? item.monto_pago ?? 0) || null : null,
      }
    }

    if (operacion.es_pago_mixto || itemsOrdenados.length > 1) {
      setTipoPago('mixto')
      setPagoMixto1(mapItemToForm(itemsOrdenados[0]))
      setPagoMixto2(mapItemToForm(itemsOrdenados[1] || null))
      setMonedaPagoUnico('USD'); setMetodoPagoUnicoId(''); setReferenciaPagoUnico(''); setNotasPagoUnico(''); setTasaPagoUnico(null); setMontoPagoUnicoBs(null)
    } else {
      const first = itemsOrdenados[0]
      setTipoPago('unico')
      if (first) {
        const moneda = ((first.moneda_pago || 'USD').toUpperCase() === 'BS' || (first.moneda_pago || '').toUpperCase() === 'VES') ? 'BS' : 'USD'
        setMonedaPagoUnico(moneda)
        setMetodoPagoUnicoId(first.metodo_pago_v2_id || '')
        setReferenciaPagoUnico(first.referencia || '')
        setNotasPagoUnico(first.notas || '')
        setTasaPagoUnico(first.tasa_bcv ?? null)
        setMontoPagoUnicoBs(moneda === 'BS' ? Number(first.monto_equivalente_bs ?? first.monto ?? first.monto_pago ?? 0) || null : null)
      }
      setPagoMixto1(pagoMixtoVacio('USD')); setPagoMixto2(pagoMixtoVacio('BS'))
    }

    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function eliminarPago(operacion: PagoOperacion) {
    if (!confirm('¿Eliminar este ingreso?')) return
    try {
      await limpiarCreditosExcedenteOperacion(operacion.operacion_pago_id)
      let query = supabase.from('pagos').delete()
      query = operacion.operacion_pago_id
        ? query.eq('operacion_pago_id', operacion.operacion_pago_id)
        : query.eq('id', operacion.id_representativo)
      const { error } = await query
      if (error) throw error
      alert('✅ Ingreso eliminado')
      await cargarDatos()
      if (operacion.cliente_id) await cargarEstadoCuentaCliente(operacion.cliente_id)
    } catch (err: any) { alert('Error: ' + (err.message || 'No se pudo eliminar')) }
  }

  // ─── Derived list ─────────────────────────────────────────────────────────

  const operaciones = useMemo(() => agruparPagosPorOperacion(pagos), [pagos])

  const pagosFiltrados = useMemo(
    () => operaciones.filter((pago) => {
      if (estadoFiltro !== 'todos' && pago.estado !== estadoFiltro) return false
      if (search) {
        const s = search.toLowerCase()
        return pago.concepto.toLowerCase().includes(s) ||
          pago.categoria.toLowerCase().includes(s) ||
          (pago.cliente_nombre || '').toLowerCase().includes(s)
      }
      return true
    }),
    [operaciones, estadoFiltro, search]
  )

  const totales = useMemo(() => {
    const pagados = operaciones.filter((p) => p.estado === 'pagado')
    return {
      totalUSD: pagados.reduce((sum, p) => sum + Number(p.total_usd || 0), 0),
      totalBS: pagados.reduce((sum, p) => sum + Number(p.total_bs || 0), 0),
      cantidad: pagados.length,
    }
  }, [operaciones])

  // Determina si mostrar bloque de pago rápido (venta sin cliente, recarga saldo, edición, abono a deuda)
  const mostrarPagoRapido = ventaSinCliente ||
    (tipoIngreso === 'saldo') ||
    (!!editingId) ||
    (tipoConsumidor === 'empleado' && tipoIngreso === 'producto' && modoCobroEmpleadoProducto === 'pagado')

  if (loading) return <LoadingIngresos />

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Link href="/admin/finanzas" className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white/90">
              <ArrowLeft className="h-4 w-4" />Volver a Finanzas
            </Link>
            <p className="mt-4 text-sm text-white/55">Finanzas</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Ingresos, saldos y consumos</h1>
            <p className="mt-2 text-sm text-white/55">Registra ventas del inventario, recargas, deudas y créditos de clientes o empleados.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:w-auto">
            {[
              { label: 'Total USD', value: formatearMoneda(totales.totalUSD, 'USD') },
              { label: 'Total Bs', value: formatearMoneda(totales.totalBS, 'BS') },
              { label: 'Operaciones', value: String(totales.cantidad) },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
                <p className="text-xs text-white/55">{kpi.label}</p>
                <p className="mt-1 text-lg font-semibold text-white">{kpi.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Botones nuevo */}
        {!showForm && (
          <div className="flex flex-wrap gap-3">
            <button onClick={() => { setVentaSinCliente(false); setShowForm(true) }}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/85 transition hover:bg-white/[0.06]">
              <Plus className="h-4 w-4" />Nuevo ingreso
            </button>
            <button onClick={() => { setVentaSinCliente(true); setShowForm(true) }}
              className="inline-flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-5 py-3 text-sm font-medium text-amber-300 transition hover:bg-amber-400/15">
              <Zap className="h-4 w-4" />Venta rápida
            </button>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-3">

          {/* ── FORMULARIO ── */}
          {showForm && (
            <div className="xl:col-span-1">
              <form onSubmit={handleSubmit} className={`${panelCls} space-y-5 p-6`}>

                {/* Título */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">
                        {editingId ? 'Editar ingreso' : ventaSinCliente ? 'Venta rápida' : 'Nuevo ingreso'}
                      </h2>
                      {ventaSinCliente && !editingId && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                          <Zap className="h-3 w-3" />Sin cliente
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-white/45">
                      {ventaSinCliente && !editingId ? 'Pago inmediato. No genera historial de cliente.' : 'Completa los datos del ingreso.'}
                    </p>
                  </div>
                  <button type="button" onClick={resetForm}
                    className="rounded-full border border-white/10 bg-white/[0.03] p-2 text-white/50 transition hover:bg-white/[0.06] hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Toggle con/sin cliente */}
                {!editingId && (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setVentaSinCliente(false)}
                      className={`rounded-2xl border px-3 py-2.5 text-sm font-medium transition ${!ventaSinCliente ? 'border-violet-400/30 bg-violet-500/15 text-violet-300' : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'}`}>
                      Con cliente
                    </button>
                    <button type="button" onClick={() => setVentaSinCliente(true)}
                      className={`inline-flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-2.5 text-sm font-medium transition ${ventaSinCliente ? 'border-amber-400/30 bg-amber-400/15 text-amber-300' : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'}`}>
                      <Zap className="h-3.5 w-3.5" />Venta rápida
                    </button>
                  </div>
                )}

                {/* Fecha */}
                <div>
                  <label className={labelCls}>Fecha *</label>
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} required />
                </div>

                {/* Consumidor */}
                {!ventaSinCliente && !editingId && (
                  <div>
                    <label className={labelCls}>Consumidor *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => { setTipoConsumidor('cliente'); setEmpleadoId(''); setEstadoCuentaEmpleado(null); setCuentasPendientesEmpleado([]) }}
                        className={`rounded-2xl border px-3 py-2.5 text-sm font-medium transition ${tipoConsumidor === 'cliente' ? 'border-violet-400/30 bg-violet-500/15 text-violet-300' : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'}`}>
                        Cliente
                      </button>
                      <button type="button" onClick={() => { setTipoConsumidor('empleado'); setClienteId(''); setEstadoCuentaCliente(null); setCuentasPendientesCliente([]) }}
                        className={`rounded-2xl border px-3 py-2.5 text-sm font-medium transition ${tipoConsumidor === 'empleado' ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300' : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'}`}>
                        Empleado
                      </button>
                    </div>
                  </div>
                )}

                {/* Tipo de ingreso — solo con consumidor */}
                {!ventaSinCliente && (
                  <div>
                    <label className={labelCls}>Tipo de ingreso *</label>
                    <select value={tipoIngreso}
                      onChange={(e) => {
                        const next = e.target.value as TipoIngresoUI
                        setTipoIngreso(next); setProductoId(''); setCantidad(1)
                        if (next === 'saldo') { setDestinoSaldo('credito'); setConcepto('Recarga de saldo a favor') }
                        else setConcepto('')
                      }}
                      className={inputCls} disabled={!!editingId}>
                      <option value="producto" className="bg-[#11131a]">Venta de producto</option>
                      <option value="saldo" className="bg-[#11131a]">Recarga de saldo</option>
                    </select>
                    {editingId && <p className="mt-2 text-xs text-amber-300">Al editar, el tipo se mantiene como venta de producto.</p>}
                  </div>
                )}

                {/* Bloque cliente */}
                {!ventaSinCliente && tipoConsumidor === 'cliente' && (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div>
                      <label className={labelCls}>Cliente *</label>
                      <ClienteSearch clientes={clientes} value={clienteId} onChange={(id) => setClienteId(id)} />
                      {clientePrefill && clienteSeleccionado && <p className="mt-2 text-xs text-cyan-300">Cliente cargado automáticamente desde su ficha.</p>}
                    </div>

                    {clienteSeleccionado && (
                      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
                          <User2 className="h-4 w-4 text-white/70" />
                        </div>
                        <div className="min-w-0 text-xs text-white/60">
                          <p className="truncate font-medium text-white">{clienteSeleccionado.nombre}</p>
                          {clienteSeleccionado.telefono && <p>{clienteSeleccionado.telefono}</p>}
                          {clienteSeleccionado.email && <p className="truncate">{clienteSeleccionado.email}</p>}
                        </div>
                      </div>
                    )}

                    {clienteSeleccionado && estadoCuentaCliente && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                          <p className="text-sm font-medium text-white">Estado financiero</p>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoFinancieroBadge(estadoCuentaCliente)}`}>
                            {estadoFinancieroLabel(estadoCuentaCliente)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: 'Deuda total', val: formatearMoneda(Number(estadoCuentaCliente.total_pendiente_usd || 0), 'USD'), sub: formatearMoneda(Number(estadoCuentaCliente.total_pendiente_bs || 0), 'BS') },
                            { label: 'Crédito disp.', val: formatearMoneda(Number(estadoCuentaCliente.credito_disponible_usd || 0), 'USD'), sub: formatearMoneda(Number(estadoCuentaCliente.credito_disponible_bs || 0), 'BS') },
                            { label: 'Neto', val: formatearMoneda(Number(estadoCuentaCliente.saldo_pendiente_neto_usd || 0), 'USD'), sub: formatearMoneda(Number(estadoCuentaCliente.saldo_pendiente_neto_bs || 0), 'BS') },
                          ].map((kpi) => (
                            <div key={kpi.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
                              <p className="text-[10px] uppercase tracking-wide text-white/40">{kpi.label}</p>
                              <p className="mt-1 text-xs font-semibold text-white">{kpi.val}</p>
                              <p className="text-[10px] text-white/35">{kpi.sub}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Destino saldo cuando es recarga y hay deuda */}
                    {clienteSeleccionado && clienteTieneDeuda && tipoIngreso === 'saldo' && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-white/55">¿A dónde va este pago?</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setDestinoSaldo('deuda')}
                            className={`rounded-2xl border p-3 text-left text-sm transition ${destinoSaldo === 'deuda' ? 'border-rose-400/30 bg-rose-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}>
                            <p className="font-medium text-white">Pagar deuda</p>
                            <p className="mt-0.5 text-xs text-white/40">Aplica a una cuenta pendiente.</p>
                          </button>
                          <button type="button" onClick={() => setDestinoSaldo('credito')}
                            className={`rounded-2xl border p-3 text-left text-sm transition ${destinoSaldo === 'credito' ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}>
                            <p className="font-medium text-white">Agregar crédito</p>
                            <p className="mt-0.5 text-xs text-white/40">Guarda como saldo a favor.</p>
                          </button>
                        </div>

                        {destinoSaldo === 'deuda' && cuentasPendientesCliente.length > 0 && (
                          <>
                            <SelectorDeuda cuentas={cuentasPendientesCliente}
                              seleccionadaId={cuentaCobrarSeleccionadaId}
                              onSeleccionar={(id) => {
                                setCuentaCobrarSeleccionadaId(id)
                                const cuenta = cuentasPendientesCliente.find((c) => c.id === id)
                                if (cuenta) {
                                  setConcepto(`Abono: ${cuenta.concepto}`)
                                  setMontoAbonoDeuda(String(r2(Number(cuenta.saldo_usd || 0))))
                                }
                              }} />
                            {cuentaPendienteSeleccionada && (
                              <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.05] p-3">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-white">Monto a abonar</p>
                                    <p className="text-xs text-white/45">Puedes registrar un pago parcial o el saldo completo.</p>
                                  </div>
                                  <button type="button"
                                    onClick={() => setMontoAbonoDeuda(String(r2(Number(cuentaPendienteSeleccionada.saldo_usd || 0))))}
                                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/75 transition hover:bg-white/[0.06]">
                                    Usar saldo completo
                                  </button>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <label className={labelCls}>Abono USD</label>
                                    <input type="number" min={0}
                                      step="0.01" value={montoAbonoDeuda} onChange={(e) => setMontoAbonoDeuda(e.target.value)}
                                      className={inputCls} placeholder="0.00" />
                                  </div>
                                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                                    <p className="text-xs text-white/45">Saldo pendiente</p>
                                    <p className="mt-1 text-sm font-semibold text-white">{formatearMoneda(Number(cuentaPendienteSeleccionada.saldo_usd || 0), 'USD')}</p>
                                    <p className="mt-2 text-xs text-white/45">Saldo restante</p>
                                    <p className="mt-1 text-sm font-semibold text-amber-300">
                                      {formatearMoneda(Math.max(0, r2(Number(cuentaPendienteSeleccionada.saldo_usd || 0) - montoAbonoDeudaNumero)), 'USD')}
                                    </p>
                                    {montoAbonoDeudaNumero > Number(cuentaPendienteSeleccionada.saldo_usd || 0) && (
                                      <p className="mt-2 text-[11px] text-violet-300">
                                        Se actualizará la deuda a {formatearMoneda(r2(Number(cuentaPendienteSeleccionada.monto_total_usd || 0) + (montoAbonoDeudaNumero - Number(cuentaPendienteSeleccionada.saldo_usd || 0))), 'USD')} antes de cobrar.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                        {destinoSaldo === 'deuda' && cuentasPendientesCliente.length === 0 && (
                          <div className="flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
                            <AlertCircle className="h-4 w-4 text-amber-300" />
                            <p className="text-xs text-amber-300">No se encontraron deudas activas para este cliente.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Bloque empleado */}
                {!ventaSinCliente && tipoConsumidor === 'empleado' && (
                  <div className="space-y-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] p-4">
                    <div>
                      <label className={labelCls}>Empleado *</label>
                      <ClienteSearch clientes={empleados} value={empleadoId} onChange={(id) => setEmpleadoId(id)} />
                      {empleadoPrefill && empleadoSeleccionado && <p className="mt-2 text-xs text-cyan-300">Empleado cargado automáticamente desde su ficha.</p>}
                    </div>

                    {empleadoSeleccionado && (
                      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
                          <User2 className="h-4 w-4 text-white/70" />
                        </div>
                        <div className="min-w-0 text-xs text-white/60">
                          <p className="truncate font-medium text-white">{empleadoSeleccionado.nombre}</p>
                          {empleadoSeleccionado.rol && <p className="capitalize">{empleadoSeleccionado.rol}</p>}
                          {empleadoSeleccionado.telefono && <p>{empleadoSeleccionado.telefono}</p>}
                          {empleadoSeleccionado.email && <p className="truncate">{empleadoSeleccionado.email}</p>}
                        </div>
                      </div>
                    )}

                    {empleadoSeleccionado && estadoCuentaEmpleado && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                          <p className="text-sm font-medium text-white">Estado financiero empleado</p>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${Number(estadoCuentaEmpleado.saldo_pendiente_neto_usd || 0) > 0.01 ? 'border-rose-400/20 bg-rose-400/10 text-rose-300' : Number(estadoCuentaEmpleado.saldo_favor_neto_usd || 0) > 0.01 ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/[0.04] text-white/70'}`}>
                            {Number(estadoCuentaEmpleado.saldo_pendiente_neto_usd || 0) > 0.01 ? 'Debe' : Number(estadoCuentaEmpleado.saldo_favor_neto_usd || 0) > 0.01 ? 'Crédito' : 'Al día'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: 'Deuda total', val: formatearMoneda(Number(estadoCuentaEmpleado.total_pendiente_usd || 0), 'USD') },
                            { label: 'Crédito disp.', val: formatearMoneda(Number(estadoCuentaEmpleado.credito_disponible_usd || 0), 'USD') },
                            { label: 'Neto', val: formatearMoneda(Number(estadoCuentaEmpleado.saldo_pendiente_neto_usd || 0), 'USD') },
                          ].map((kpi) => (
                            <div key={kpi.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
                              <p className="text-[10px] uppercase tracking-wide text-white/40">{kpi.label}</p>
                              <p className="mt-1 text-xs font-semibold text-white">{kpi.val}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {empleadoSeleccionado && tipoIngreso === 'producto' && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-white/55">Cobro del consumo</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setModoCobroEmpleadoProducto('pagado')}
                            className={`rounded-2xl border p-3 text-left text-sm transition ${modoCobroEmpleadoProducto === 'pagado' ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}>
                            <p className="font-medium text-white">Paga ahora</p>
                            <p className="mt-0.5 text-xs text-white/40">Registra el pago.</p>
                          </button>
                          <button type="button" onClick={() => setModoCobroEmpleadoProducto('deuda')}
                            className={`rounded-2xl border p-3 text-left text-sm transition ${modoCobroEmpleadoProducto === 'deuda' ? 'border-rose-400/30 bg-rose-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}>
                            <p className="font-medium text-white">Dejar deuda</p>
                            <p className="mt-0.5 text-xs text-white/40">Crea cuenta por cobrar.</p>
                          </button>
                        </div>
                      </div>
                    )}

                    {empleadoSeleccionado && empleadoTieneDeuda && tipoIngreso === 'saldo' && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-white/55">¿A dónde va este pago?</p>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => setDestinoSaldo('deuda')}
                            className={`rounded-2xl border p-3 text-left text-sm transition ${destinoSaldo === 'deuda' ? 'border-rose-400/30 bg-rose-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}>
                            <p className="font-medium text-white">Pagar deuda</p>
                            <p className="mt-0.5 text-xs text-white/40">Aplica a cuenta pendiente.</p>
                          </button>
                          <button type="button" onClick={() => setDestinoSaldo('credito')}
                            className={`rounded-2xl border p-3 text-left text-sm transition ${destinoSaldo === 'credito' ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}>
                            <p className="font-medium text-white">Agregar crédito</p>
                            <p className="mt-0.5 text-xs text-white/40">Saldo a favor.</p>
                          </button>
                        </div>

                        {destinoSaldo === 'deuda' && cuentasPendientesEmpleado.length > 0 && (
                          <>
                            <SelectorDeuda cuentas={cuentasPendientesEmpleado as any} seleccionadaId={cuentaCobrarSeleccionadaId}
                              onSeleccionar={(id) => {
                                setCuentaCobrarSeleccionadaId(id)
                                const cuenta = cuentasPendientesEmpleado.find((c) => c.id === id)
                                if (cuenta) {
                                  setConcepto(`Abono empleado: ${cuenta.concepto}`)
                                  setMontoAbonoDeuda(String(r2(Number(cuenta.saldo_usd || 0))))
                                }
                              }} />
                            {cuentaPendienteSeleccionada && (
                              <div className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.05] p-3">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium text-white">Monto a abonar</p>
                                    <p className="text-xs text-white/45">Puedes registrar un pago parcial o completo.</p>
                                  </div>
                                  <button type="button" onClick={() => setMontoAbonoDeuda(String(r2(Number(cuentaPendienteSeleccionada.saldo_usd || 0))))}
                                    className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/75 transition hover:bg-white/[0.06]">
                                    Usar saldo completo
                                  </button>
                                </div>
                                <input type="number" min={0} step="0.01"
                                  value={montoAbonoDeuda} onChange={(e) => setMontoAbonoDeuda(e.target.value)} className={inputCls} placeholder="0.00" />
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Aviso venta rápida */}
                {ventaSinCliente && !editingId && (
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-3">
                    <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                    <p className="text-xs text-amber-200/90">
                      Modo venta rápida: no se asocia ningún cliente. El pago es obligatorio e inmediato. No genera crédito ni deuda.
                    </p>
                  </div>
                )}

                {/* Producto */}
                {tipoIngreso === 'producto' && (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div>
                      <label className={labelCls}>Producto *</label>
                      <select value={productoId}
                        onChange={(e) => {
                          const id = e.target.value; setProductoId(id)
                          const prod = productos.find((p) => p.id === id)
                          if (prod) setConcepto(`Venta de ${prod.nombre} x${cantidad}`)
                        }}
                        className={inputCls} required disabled={!!editingId}>
                        <option value="" className="bg-[#11131a]">Seleccionar producto...</option>
                        {productos.map((prod) => (
                          <option key={prod.id} value={prod.id} className="bg-[#11131a]">
                            {prod.nombre} - Stock: {prod.cantidad_actual} {prod.unidad_medida}
                          </option>
                        ))}
                      </select>
                      {editingId && <p className="mt-2 text-xs text-amber-300">Al editar, producto y cantidad quedan bloqueados.</p>}
                    </div>
                    {productoSeleccionado && (
                      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
                          <Package2 className="h-4 w-4 text-white/70" />
                        </div>
                        <div className="min-w-0 text-xs text-white/60">
                          <p className="truncate font-medium text-white">{productoSeleccionado.nombre}</p>
                          <p>Stock: {productoSeleccionado.cantidad_actual} {productoSeleccionado.unidad_medida}</p>
                          <p>Precio: {formatearMoneda(Number(productoSeleccionado.precio_venta_usd || 0), 'USD')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Cantidad */}
                {tipoIngreso === 'producto' && (
                  <div>
                    <label className={labelCls}>Cantidad *</label>
                    <input type="number" min="1" step="1" value={cantidad}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 1; setCantidad(v)
                        if (productoSeleccionado) setConcepto(`Venta de ${productoSeleccionado.nombre} x${v}`)
                      }}
                      className={inputCls} required disabled={!!editingId} />
                    {productoSeleccionado && (
                      <p className="mt-1 text-xs text-white/45">Disponible: {formatQty(productoSeleccionado.cantidad_actual)} {productoSeleccionado.unidad_medida}</p>
                    )}
                  </div>
                )}

                {/* Concepto */}
                <div>
                  <label className={labelCls}>Concepto</label>
                  <input type="text" value={concepto} onChange={(e) => setConcepto(e.target.value)} className={inputCls} required />
                </div>

                {/* Resumen precio */}
                {tipoIngreso === 'producto' && productoSeleccionado && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-white/55">Precio unitario</span>
                      <span className="font-semibold text-white">{formatearMoneda(precioUnitarioUSD, 'USD')}</span>
                    </div>
                    <div className="mt-2 flex justify-between text-sm">
                      <span className="text-white/55">Total</span>
                      <span className="text-lg font-bold text-white">{formatearMoneda(totalUSD, 'USD')}</span>
                    </div>
                  </div>
                )}

                {/* ══ BLOQUE DE PAGO ══ */}

                {/* Caso A: venta con cliente, nuevo registro → PagoConDeudaSelector */}
                {tipoIngreso === 'producto' && !ventaSinCliente && tipoConsumidor === 'cliente' && !editingId && clienteId && productoId && totalUSD > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-white/75">Cobro</p>
                    <PagoConDeudaSelector
                      key={pagoConDeudaKey}
                      montoTotal={totalUSD}
                      fecha={fecha}
                      metodosPago={metodosPagoBase}
                      value={pagoConDeudaState}
                      onChange={setPagoConDeudaState}
                      concepto={concepto || `Venta de ${productoSeleccionado?.nombre || ''}`}
                      clienteNombre={clienteSeleccionado?.nombre || ''}
                      mostrarMontoTotal={true}
                    />
                  </div>
                )}

                {/* Caso B: pago rápido (venta sin cliente, saldo, edición) */}
                {mostrarPagoRapido && (
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-medium text-white">
                      {tipoIngreso === 'saldo' && destinoSaldo === 'deuda' ? 'Método de pago del abono' : 'Pago'}
                    </p>

                    {/* Selector único/mixto */}
                    <div className="grid grid-cols-2 gap-2">
                      {(['unico', 'mixto'] as const).map((t) => (
                        <button key={t} type="button" onClick={() => setTipoPago(t)}
                          className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${tipoPago === t ? 'border-violet-400/40 bg-violet-500/20 text-violet-300' : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]'}`}>
                          {t === 'unico' ? 'Pago único' : 'Pago mixto'}
                        </button>
                      ))}
                    </div>

                    {tipoPago === 'unico' && (
                      <div className="space-y-3">
                        <div>
                          <label className={labelCls}>Moneda</label>
                          <select value={monedaPagoUnico} onChange={(e) => setMonedaPagoUnico(e.target.value as 'USD' | 'BS')} className={inputCls}>
                            <option value="USD" className="bg-[#11131a]">USD</option>
                            <option value="BS" className="bg-[#11131a]">Bs</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>{monedaPagoUnico === 'USD' ? 'Método USD' : 'Método Bs'}</label>
                          <select value={metodoPagoUnicoId} onChange={(e) => setMetodoPagoUnicoId(e.target.value)} className={inputCls}>
                            <option value="" className="bg-[#11131a]">Seleccionar método</option>
                            {metodosPagoUnicoDisponibles.map((m) => (
                              <option key={m.id} value={m.id} className="bg-[#11131a]">
                                {m.nombre}{m.moneda ? ` · ${m.moneda}` : ''}{m.cartera?.nombre ? ` · ${m.cartera.nombre}` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        {tipoIngreso === 'saldo' && destinoSaldo !== 'deuda' && (
                          <div>
                            <label className={labelCls}>Monto a recargar (USD)</label>
                            <input type="number" min={0} step="0.01"
                              value={montoManualUSD}
                              onChange={(e) => setMontoManualUSD(e.target.value)}
                              className={inputCls} placeholder="Ingresa el monto..." />
                            <p className="mt-1 text-xs text-white/40">Este monto se usará para validar el pago único y calcular Bs si aplica.</p>
                          </div>
                        )}
                        {monedaPagoUnico === 'BS' && (
                          <PagoBsSelector fecha={fecha}
                            montoUsd={montoObjetivoPagoRapidoUsd}
                            montoBs={montoPagoUnicoBs}
                            onChangeTasa={setTasaPagoUnico}
                            onChangeMontoBs={setMontoPagoUnicoBs} />
                        )}
                        <div>
                          <label className={labelCls}>Referencia</label>
                          <input type="text" value={referenciaPagoUnico} onChange={(e) => setReferenciaPagoUnico(e.target.value)} placeholder="Número de referencia..." className={inputCls} />
                        </div>
                        <div>
                          <label className={labelCls}>Notas del pago</label>
                          <input type="text" value={notasPagoUnico} onChange={(e) => setNotasPagoUnico(e.target.value)} placeholder="Notas opcionales" className={inputCls} />
                        </div>
                      </div>
                    )}

                    {tipoPago === 'mixto' && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <div className="mb-3 flex items-baseline justify-between">
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-semibold text-white">
                                {formatearMoneda(resumenPagosMixtoRapido.totalObjetivo, 'USD')}
                              </span>
                              <span className="text-sm text-white/45">total a cobrar</span>
                            </div>
                            {resumenPagosMixtoRapido.totalUsd > 0 && (
                              <span className={`text-sm font-medium ${resumenPagosMixtoRapido.cuadra ? 'text-emerald-400' : 'text-amber-400'}`}>
                                {resumenPagosMixtoRapido.cuadra ? '✓ Cuadra' : `Faltan ${formatearMoneda(resumenPagosMixtoRapido.faltante, 'USD')}`}
                              </span>
                            )}
                          </div>
                          <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
                            <div className="bg-blue-500 transition-all duration-300" style={{ width: `${Math.min(resumenPagosMixtoRapido.pct1, 100)}%` }} />
                            <div className="bg-violet-500 transition-all duration-300" style={{ width: `${Math.min(resumenPagosMixtoRapido.pct2, 100 - resumenPagosMixtoRapido.pct1)}%` }} />
                          </div>
                          {resumenPagosMixtoRapido.totalUsd > 0 && (
                            <div className="mt-2 flex gap-4">
                              <span className="text-xs text-blue-400">■ Pago 1: {formatearMoneda(resumenPagosMixtoRapido.usd1, 'USD')} ({resumenPagosMixtoRapido.pct1}%)</span>
                              <span className="text-xs text-violet-400">■ Pago 2: {formatearMoneda(resumenPagosMixtoRapido.usd2, 'USD')} ({resumenPagosMixtoRapido.pct2}%)</span>
                            </div>
                          )}
                        </div>
                        <PagoMixtoCard numero={1} pago={pagoMixto1} metodosPago={metodosPago} fecha={fecha}
                          onChange={(patch) => setPagoMixto1((prev) => ({ ...prev, ...patch }))} />
                        <div className="flex items-center justify-center gap-2 py-1 text-white/30">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 2v10M3 8l4 4 4-4" /></svg>
                          <span className="text-xs">+</span>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 2v10M3 8l4 4 4-4" /></svg>
                        </div>
                        <PagoMixtoCard numero={2} pago={pagoMixto2} metodosPago={metodosPago} fecha={fecha}
                          onChange={(patch) => setPagoMixto2((prev) => ({ ...prev, ...patch }))} />
                        <div className={`rounded-xl border p-3 ${resumenPagosMixtoRapido.cuadra ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-amber-400/20 bg-amber-400/5'}`}>
                          <p className={`text-sm font-medium ${resumenPagosMixtoRapido.cuadra ? 'text-emerald-300' : 'text-amber-300'}`}>
                            {resumenPagosMixtoRapido.cuadra ? 'La suma de pagos cuadra correctamente.' : `Faltante: ${formatearMoneda(resumenPagosMixtoRapido.faltante, 'USD')}`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Notas generales */}
                <div>
                  <label className={labelCls}>Notas generales (opcional)</label>
                  <textarea value={notas} onChange={(e) => setNotas(e.target.value)}
                    placeholder="Detalles adicionales..." rows={3} className={`${inputCls} resize-none`} />
                </div>

                {/* Stock insuficiente */}
                {tipoIngreso === 'producto' && stockInsuficiente && !editingId && (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3">
                    <p className="text-sm text-rose-300">No hay suficiente stock para esta venta.</p>
                  </div>
                )}

                {/* Botones */}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="submit"
                    disabled={saving || (tipoIngreso === 'producto' && !!stockInsuficiente && !editingId)}
                    className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-medium text-white transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50">
                    {saving ? 'Guardando...' : editingId ? 'Actualizar' : ventaSinCliente ? 'Registrar venta rápida' : 'Registrar'}
                  </button>
                  <button type="button" onClick={resetForm} className={softButtonCls}>Cancelar</button>
                </div>
              </form>
            </div>
          )}

          {/* ── LISTA ── */}
          <div className={`space-y-4 ${showForm ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
            <div className={`${panelCls} p-4`}>
              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por concepto o cliente..."
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-white/20 focus:bg-white/[0.05]" />
                </div>
                <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-white/20 focus:bg-white/[0.05]">
                  <option value="todos" className="bg-[#11131a]">Todos</option>
                  <option value="pagado" className="bg-[#11131a]">Pagado</option>
                  <option value="pendiente" className="bg-[#11131a]">Pendiente</option>
                  <option value="anulado" className="bg-[#11131a]">Anulado</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {pagosFiltrados.length === 0 ? (
                <div className={`${panelCls} p-12 text-center`}>
                  <p className="text-white/45">No hay ingresos registrados</p>
                </div>
              ) : (
                pagosFiltrados.map((operacion) => {
                  const estadoUi = estadoUiDesdeDb(operacion.estado)
                  return (
                    <div key={operacion.key} className={`${panelCls} p-5 transition hover:bg-white/[0.04]`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate font-medium text-white">{operacion.concepto}</h3>
                            {!operacion.cliente_id && (
                              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                                <Zap className="h-2.5 w-2.5" />Rápida
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
                            <span>{operacion.fecha}</span>
                            <span>•</span><span>{operacion.categoria}</span>
                            <span>•</span><span>{operacion.tipo_origen}</span>
                            {operacion.cliente_nombre && (<><span>•</span><span>{operacion.cliente_nombre}</span></>)}
                            {operacion.es_pago_mixto && (<><span>•</span><span>{operacion.items_total} pagos</span></>)}
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${estadoUi === 'pagado' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-300'}`}>
                              {operacion.estado}
                            </span>
                          </div>
                          <div className="mt-3 space-y-2">
                            {operacion.items.map((item) => (
                              <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                  <div className="flex flex-wrap items-center gap-2 text-white/70">
                                    <span className="font-medium text-white">{item.metodos_pago_v2?.nombre || 'Método'}</span>
                                    <span>·</span><span>{item.moneda_pago || 'USD'}</span>
                                    {item.referencia && (<><span>·</span><span>Ref: {item.referencia}</span></>)}
                                  </div>
                                  <div className="text-right">
                                    <p className="font-semibold text-white">{formatearMoneda(Number(item.monto_equivalente_usd || 0), 'USD')}</p>
                                    <p className="text-xs text-white/45">{formatearMoneda(Number(item.monto_equivalente_bs || 0), 'BS')}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-start gap-4 lg:ml-4 lg:flex-shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-white">{formatearMoneda(Number(operacion.total_usd || 0), 'USD')}</p>
                            <p className="mt-1 text-xs text-white/45">{formatearMoneda(Number(operacion.total_bs || 0), 'BS')}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => startEdit(operacion)}
                              className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-white/60 transition hover:bg-white/[0.06] hover:text-white" title="Editar">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => eliminarPago(operacion)}
                              className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-2 text-rose-300 transition hover:bg-rose-400/15" title="Eliminar">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}