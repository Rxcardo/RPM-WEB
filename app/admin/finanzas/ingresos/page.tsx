'use client'

import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  ArrowLeft, Plus, Search, Edit2, Trash2, X, Package2, User2,
  Wallet, Receipt, ChevronDown, AlertCircle,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import SelectorTasaBCV from '@/components/finanzas/SelectorTasaBCV'
import { formatearMoneda } from '@/lib/finanzas/tasas'
import { registrarAbonoMixto } from '@/lib/cobranzas/abonos'

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Cartera { nombre: string; codigo: string }
interface MetodoPago { id: string; nombre: string; tipo?: string | null; moneda?: string | null; cartera?: Cartera | null }
interface Producto { id: string; nombre: string; descripcion: string | null; cantidad_actual: number | null; unidad_medida: string | null; precio_venta_usd: number | null; estado: string | null }
interface Cliente { id: string; nombre: string; telefono?: string | null; email?: string | null }

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

interface PagoItem {
  id: string; operacion_pago_id: string | null; pago_item_no: number | null; pago_items_total: number | null
  es_pago_mixto: boolean; fecha: string; concepto: string; categoria: string; tipo_origen: string
  monto: number | null; monto_pago: number | null; monto_equivalente_usd: number | null; monto_equivalente_bs: number | null
  moneda_pago: string; tasa_bcv: number | null; estado: string; cliente_id?: string | null
  inventario_id?: string | null; cantidad_producto?: number | null; metodo_pago_id?: string | null
  metodo_pago_v2_id?: string | null; notas?: string | null; referencia?: string | null
  metodos_pago_v2?: { nombre: string } | null; clientes?: { nombre: string } | null
}

interface PagoOperacion {
  key: string; id_representativo: string; operacion_pago_id: string | null; fecha: string
  concepto: string; categoria: string; tipo_origen: string; estado: string
  cliente_id: string | null; cliente_nombre: string | null; inventario_id: string | null
  cantidad_producto: number | null; total_usd: number; total_bs: number
  es_pago_mixto: boolean; items_total: number; items: PagoItem[]
}

type EstadoUI = 'pagado' | 'pendiente'
type EstadoFiltro = 'todos' | 'pagado' | 'pendiente' | 'anulado'
type TipoIngresoUI = 'producto' | 'saldo'
type DestinoSaldo = 'credito' | 'deuda'
type TipoPago = 'unico' | 'mixto'

type RawCartera = { nombre?: unknown; codigo?: unknown } | Array<{ nombre?: unknown; codigo?: unknown }> | null | undefined
type RawMetodoPago = { id?: unknown; nombre?: unknown; tipo?: unknown; moneda?: unknown; cartera?: RawCartera }
type RawPago = {
  id?: unknown; operacion_pago_id?: unknown; pago_item_no?: unknown; pago_items_total?: unknown
  es_pago_mixto?: unknown; fecha?: unknown; concepto?: unknown; categoria?: unknown; tipo_origen?: unknown
  estado?: unknown; moneda_pago?: unknown; tasa_bcv?: unknown; monto?: unknown; monto_pago?: unknown
  monto_equivalente_usd?: unknown; monto_equivalente_bs?: unknown; cliente_id?: unknown
  inventario_id?: unknown; cantidad_producto?: unknown; metodo_pago_id?: unknown; metodo_pago_v2_id?: unknown
  notas?: unknown; referencia?: unknown
  metodos_pago_v2?: { nombre?: unknown } | Array<{ nombre?: unknown }> | null | undefined
  clientes?: { nombre?: unknown } | Array<{ nombre?: unknown }> | null | undefined
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05]'
const labelCls = 'mb-2 block text-sm font-medium text-white/75'
const panelCls = 'rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl'
const softButtonCls = 'rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function r2(v: number) { return Math.round(Number(v || 0) * 100) / 100 }
function clamp(v: number, min: number, max: number) { return Math.min(Math.max(v, min), max) }

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
  return { id: toStringSafe(raw.id), nombre: toStringSafe(raw.nombre), tipo: toStringOrNull(raw.tipo), moneda: toStringOrNull(raw.moneda), cartera: normalizeCartera(raw.cartera) }
}

function normalizePago(raw: RawPago): PagoItem {
  const metodo = firstItem(raw.metodos_pago_v2)
  const cliente = firstItem(raw.clientes)
  return {
    id: toStringSafe(raw.id), operacion_pago_id: toStringOrNull(raw.operacion_pago_id),
    pago_item_no: toNumberOrNull(raw.pago_item_no), pago_items_total: toNumberOrNull(raw.pago_items_total),
    es_pago_mixto: Boolean(raw.es_pago_mixto), fecha: toStringSafe(raw.fecha),
    concepto: toStringSafe(raw.concepto), categoria: toStringSafe(raw.categoria),
    tipo_origen: toStringSafe(raw.tipo_origen), monto: toNumberOrNull(raw.monto),
    monto_pago: toNumberOrNull(raw.monto_pago), monto_equivalente_usd: toNumberOrNull(raw.monto_equivalente_usd),
    monto_equivalente_bs: toNumberOrNull(raw.monto_equivalente_bs), moneda_pago: toStringSafe(raw.moneda_pago),
    tasa_bcv: toNumberOrNull(raw.tasa_bcv), estado: toStringSafe(raw.estado),
    cliente_id: toStringOrNull(raw.cliente_id), inventario_id: toStringOrNull(raw.inventario_id),
    cantidad_producto: toNumberOrNull(raw.cantidad_producto), metodo_pago_id: toStringOrNull(raw.metodo_pago_id),
    metodo_pago_v2_id: toStringOrNull(raw.metodo_pago_v2_id), notas: toStringOrNull(raw.notas),
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
  return moneda === 'BS' || moneda === 'VES' || nombre.includes('bs') || nombre.includes('bolívar') || nombre.includes('bolivar') || nombre.includes('pago movil') || nombre.includes('pago móvil') || nombre.includes('movil') || nombre.includes('móvil') || tipo.includes('bs') || tipo.includes('bolívar') || tipo.includes('bolivar') || tipo.includes('pago_movil') || cc.includes('bs') || cc.includes('ves')
}

function detectarMetodoUsd(metodo: MetodoPago | null) {
  if (!metodo) return false
  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const cc = (metodo.cartera?.codigo || '').toLowerCase()
  return moneda === 'USD' || nombre.includes('usd') || nombre.includes('zelle') || nombre.includes('efectivo $') || nombre.includes('efectivo usd') || cc.includes('usd')
}

function agruparPagosPorOperacion(items: PagoItem[]): PagoOperacion[] {
  const map = new Map<string, PagoOperacion>()
  for (const item of items) {
    const key = item.operacion_pago_id || item.id
    if (!map.has(key)) {
      map.set(key, { key, id_representativo: item.id, operacion_pago_id: item.operacion_pago_id, fecha: item.fecha, concepto: item.concepto, categoria: item.categoria, tipo_origen: item.tipo_origen, estado: item.estado, cliente_id: item.cliente_id || null, cliente_nombre: item.clientes?.nombre || null, inventario_id: item.inventario_id || null, cantidad_producto: item.cantidad_producto ?? null, total_usd: 0, total_bs: 0, es_pago_mixto: Boolean(item.es_pago_mixto), items_total: Number(item.pago_items_total || 1), items: [] })
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

// ─── ClienteSearch ────────────────────────────────────────────────────────────

function ClienteSearch({
  clientes,
  value,
  onChange,
  disabled = false,
}: {
  clientes: Cliente[]
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
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
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar cliente por nombre..."
            className={inputCls}
            autoComplete="off"
            disabled={disabled}
          />
          <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/30" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10.5 10.5L13 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      )}
      {open && !disabled && (
        <ul ref={listRef} className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#16181f] py-1 shadow-xl">
          {filtered.length === 0
            ? <li className="px-4 py-3 text-sm text-white/40">Sin resultados para "{query}"</li>
            : filtered.map((c, i) => (
              <li
                key={c.id}
                onMouseDown={() => handleSelect(c.id)}
                onMouseEnter={() => setHighlighted(i)}
                className={`cursor-pointer px-4 py-2.5 text-sm transition ${i === highlighted ? 'bg-violet-500/20 text-violet-200' : 'text-white/80 hover:bg-white/[0.05]'}`}
              >
                {c.nombre}
              </li>
            ))
          }
        </ul>
      )}
    </div>
  )
}

// ─── PagoBsSelector ───────────────────────────────────────────────────────────

const PagoBsSelector = memo(function PagoBsSelector({
  fecha, montoUsd, montoBs, onChangeTasa, onChangeMontoBs,
}: {
  fecha: string; montoUsd: number; montoBs: number | null
  onChangeTasa: (tasa: number | null) => void; onChangeMontoBs: (monto: number) => void
}) {
  return <SelectorTasaBCV fecha={fecha} monedaPago="BS" monedaReferencia="EUR" montoUSD={montoUsd} montoBs={montoBs || undefined} onTasaChange={onChangeTasa} onMontoBsChange={onChangeMontoBs} />
})

// ─── SelectorDeuda ────────────────────────────────────────────────────────────

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
        <div className="border-t border-rose-400/15 px-3 pb-3 pt-2 space-y-2">
          {cuentas.map((cuenta) => {
            const activa = cuenta.id === seleccionadaId
            const progreso = Number(cuenta.monto_total_usd || 0) > 0
              ? Math.min(100, Math.round((Number(cuenta.monto_pagado_usd || 0) / Number(cuenta.monto_total_usd || 0)) * 100))
              : 0
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

// ─── Loading ──────────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IngresosPage() {
  return (
    <Suspense fallback={<LoadingIngresos />}>
      <IngresosPageContent />
    </Suspense>
  )
}

function IngresosPageContent() {
  const searchParams = useSearchParams()
  const clientePrefill = searchParams.get('cliente') || searchParams.get('clienteId') || ''
  const tipoIngresoPrefill = searchParams.get('tipoIngreso')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [pagos, setPagos] = useState<PagoItem[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])

  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingOperacionId, setEditingOperacionId] = useState<string | null>(null)

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [tipoIngreso, setTipoIngreso] = useState<TipoIngresoUI>('producto')
  const [clienteId, setClienteId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [concepto, setConcepto] = useState('')
  const [estado, setEstado] = useState<EstadoUI>('pagado')
  const [notas, setNotas] = useState('')

  // ── Pago único / mixto ────────────────────────────────────────────────────
  const [tipoPago, setTipoPago] = useState<TipoPago>('unico')

  // Pago único
  const [monedaPagoUnico, setMonedaPagoUnico] = useState<'USD' | 'BS'>('USD')
  const [metodoPagoUnicoId, setMetodoPagoUnicoId] = useState('')
  const [referenciaPagoUnico, setReferenciaPagoUnico] = useState('')
  const [notasPagoUnico, setNotasPagoUnico] = useState('')
  const [tasaPagoUnico, setTasaPagoUnico] = useState<number | null>(null)
  const [montoPagoUnicoBs, setMontoPagoUnicoBs] = useState<number | null>(null)

  // Pago mixto (2 partes fijas)
  const [mixtoMonedaIngresada, setMixtoMonedaIngresada] = useState<'USD' | 'BS'>('USD')
  const [mixtoMetodoIngresadoId, setMixtoMetodoIngresadoId] = useState('')
  const [mixtoMetodoDiferenciaId, setMixtoMetodoDiferenciaId] = useState('')
  const [mixtoMontoIngresadoUsd, setMixtoMontoIngresadoUsd] = useState('')
  const [mixtoMontoIngresadoBs, setMixtoMontoIngresadoBs] = useState<number | null>(null)
  const [mixtoTasaBcv, setMixtoTasaBcv] = useState<number | null>(null)
  const [mixtoReferenciaIngresada, setMixtoReferenciaIngresada] = useState('')
  const [mixtoReferenciaDiferencia, setMixtoReferenciaDiferencia] = useState('')
  const [mixtoNotasIngresada, setMixtoNotasIngresada] = useState('')
  const [mixtoNotasDiferencia, setMixtoNotasDiferencia] = useState('')

  const [estadoCuentaCliente, setEstadoCuentaCliente] = useState<EstadoCuentaCliente | null>(null)
  const [cuentasPendientesCliente, setCuentasPendientesCliente] = useState<CuentaPendienteResumen[]>([])
  const [destinoSaldo, setDestinoSaldo] = useState<DestinoSaldo>('credito')
  const [cuentaCobrarSeleccionadaId, setCuentaCobrarSeleccionadaId] = useState('')

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => { void cargarDatos() }, [])
  useEffect(() => { void cargarEstadoCuentaCliente(clienteId) }, [clienteId])

  useEffect(() => {
    if (!clientePrefill || clientes.length === 0 || editingId) return
    if (!clientes.some((c) => c.id === clientePrefill)) return
    setClienteId((prev) => prev || clientePrefill)
    setShowForm(true)
    if (tipoIngresoPrefill === 'saldo') {
      setTipoIngreso('saldo'); setEstado('pagado')
      setConcepto((prev) => prev || 'Recarga de saldo a favor')
    }
  }, [clientePrefill, tipoIngresoPrefill, clientes, editingId])

  useEffect(() => {
    if (cuentasPendientesCliente.length > 0) {
      setCuentaCobrarSeleccionadaId((prev) => prev || cuentasPendientesCliente[0].id)
      setDestinoSaldo('deuda')
    } else {
      setCuentaCobrarSeleccionadaId(''); setDestinoSaldo('credito')
    }
  }, [cuentasPendientesCliente])

  // Reset método al cambiar moneda única
  useEffect(() => { setMetodoPagoUnicoId('') }, [monedaPagoUnico])

  // Reset mixto al cambiar moneda ingresada
  useEffect(() => {
    setMixtoMetodoIngresadoId(''); setMixtoMetodoDiferenciaId('')
    setMixtoReferenciaIngresada(''); setMixtoReferenciaDiferencia('')
    setMixtoNotasIngresada(''); setMixtoNotasDiferencia('')
    setMixtoMontoIngresadoUsd(''); setMixtoMontoIngresadoBs(null)
  }, [mixtoMonedaIngresada])

  // ─── Carga de datos ────────────────────────────────────────────────────────

  async function cargarDatos() {
    setLoading(true)
    const [pagosRes, metodosRes, productosRes, clientesRes] = await Promise.all([
      supabase.from('pagos').select(`id, operacion_pago_id, pago_item_no, pago_items_total, es_pago_mixto, fecha, concepto, categoria, tipo_origen, estado, moneda_pago, tasa_bcv, monto, monto_pago, monto_equivalente_usd, monto_equivalente_bs, cliente_id, inventario_id, cantidad_producto, metodo_pago_id, metodo_pago_v2_id, notas, referencia, metodos_pago_v2:metodo_pago_v2_id(nombre), clientes:cliente_id(nombre)`).in('categoria', ['producto', 'saldo_cliente']).in('tipo_origen', ['producto', 'saldo_cliente']).order('fecha', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('metodos_pago_v2').select(`id, nombre, tipo, moneda, cartera:carteras(nombre, codigo)`).eq('activo', true).eq('permite_recibir', true),
      supabase.from('inventario').select(`id, nombre, descripcion, cantidad_actual, unidad_medida, precio_venta_usd, estado`).eq('estado', 'activo').order('nombre'),
      supabase.from('clientes').select('id, nombre, telefono, email').order('nombre'),
    ])
    if (pagosRes.data) setPagos((pagosRes.data as RawPago[]).map(normalizePago))
    if (metodosRes.data) setMetodosPago((metodosRes.data as RawMetodoPago[]).map(normalizeMetodoPago))
    if (productosRes.data) setProductos(productosRes.data as Producto[])
    if (clientesRes.data) setClientes(clientesRes.data as Cliente[])
    setLoading(false)
  }

  async function cargarEstadoCuentaCliente(id: string) {
    if (!id) { setEstadoCuentaCliente(null); setCuentasPendientesCliente([]); return }
    const [estadoRes, cuentasRes] = await Promise.all([
      supabase.from('v_clientes_estado_cuenta').select(`cliente_id, total_pendiente_usd, credito_disponible_usd, saldo_pendiente_neto_usd, saldo_favor_neto_usd, total_pendiente_bs, credito_disponible_bs, saldo_pendiente_neto_bs, saldo_favor_neto_bs`).eq('cliente_id', id).maybeSingle(),
      supabase.from('v_cuentas_por_cobrar_resumen').select(`id, cliente_id, cliente_nombre, concepto, monto_total_usd, monto_pagado_usd, saldo_usd, fecha_venta, fecha_vencimiento, estado`).eq('cliente_id', id).in('estado', ['pendiente', 'parcial', 'vencida']).order('fecha_venta', { ascending: true }),
    ])
    setEstadoCuentaCliente((estadoRes.data as EstadoCuentaCliente | null) ?? null)
    setCuentasPendientesCliente((cuentasRes.data || []) as CuentaPendienteResumen[])
  }

  // ─── Helpers crédito/inventario ────────────────────────────────────────────

  async function limpiarCreditosExcedenteOperacion(operacionId: string | null) {
    if (!operacionId) return
    const { data: creditos, error } = await supabase.from('clientes_credito').select('id, monto_original, monto_disponible').eq('origen_tipo', 'pago_excedente').eq('origen_id', operacionId)
    if (error) throw error
    if (!creditos || creditos.length === 0) return
    for (const credito of creditos) {
      if (Math.abs(Number(credito.monto_disponible || 0) - Number(credito.monto_original || 0)) > 0.01) throw new Error('Esta venta tiene un crédito generado que ya fue usado parcial o totalmente.')
      const { data: ap } = await supabase.from('clientes_credito_aplicaciones').select('id').eq('credito_id', String(credito.id)).limit(1)
      if (ap && ap.length > 0) throw new Error('Esta venta tiene un crédito aplicado a otra deuda.')
    }
    const { error: deleteError } = await supabase.from('clientes_credito').delete().in('id', creditos.map((c) => String(c.id)))
    if (deleteError) throw deleteError
  }

  async function crearCreditoCliente(args: { clienteId: string; operacionPagoId: string; excedenteUsd: number; descripcion: string; origenTipo?: string }) {
    const excedenteUsd = r2(args.excedenteUsd)
    if (excedenteUsd <= 0) return
    const tasaReferencia = resumenPagos.totalUsd > 0 && resumenPagos.totalBs > 0 ? r2(resumenPagos.totalBs / resumenPagos.totalUsd) : null
    const montoBs = tasaReferencia ? r2(excedenteUsd * tasaReferencia) : null
    const { error } = await supabase.from('clientes_credito').insert({ cliente_id: args.clienteId, origen_tipo: args.origenTipo || 'pago_excedente', origen_id: args.operacionPagoId, moneda: 'USD', monto_original: excedenteUsd, monto_disponible: excedenteUsd, tasa_bcv: tasaReferencia, monto_original_bs: montoBs, monto_disponible_bs: montoBs, descripcion: args.descripcion, fecha, estado: 'activo', registrado_por: null })
    if (error) throw error
  }

  async function descontarInventarioYCrearMovimiento(args: { pagoId?: string | null; productoId: string; cantidad: number; cantidadAnterior: number; cantidadNueva: number; precioUnitarioUSD: number; totalUSD: number; conceptoMovimiento: string }) {
    const { error: invError } = await supabase.from('inventario').update({ cantidad_actual: args.cantidadNueva }).eq('id', args.productoId)
    if (invError) throw invError
    const { error: movError } = await supabase.from('movimientos_inventario').insert({ inventario_id: args.productoId, tipo: 'salida', cantidad: args.cantidad, cantidad_anterior: args.cantidadAnterior, cantidad_nueva: args.cantidadNueva, concepto: args.conceptoMovimiento, precio_unitario_usd: args.precioUnitarioUSD, monto_total_usd: args.totalUSD, pago_id: args.pagoId || null })
    if (movError) throw movError
  }

  async function crearCuentaPorCobrar(args: { clienteId: string; clienteNombre: string; concepto: string; inventarioId: string; cantidad: number; totalUSD: number; notas: string | null; fechaVenta: string }) {
    const { error } = await supabase.from('cuentas_por_cobrar').insert({ cliente_id: args.clienteId, cliente_nombre: args.clienteNombre, concepto: args.concepto, tipo_origen: 'venta_inventario', inventario_id: args.inventarioId, cantidad_producto: args.cantidad, monto_total_usd: args.totalUSD, monto_pagado_usd: 0, saldo_usd: args.totalUSD, fecha_venta: args.fechaVenta, fecha_vencimiento: null, estado: 'pendiente', notas: args.notas, registrado_por: null })
    if (error) throw error
  }

  // ─── Computed ─────────────────────────────────────────────────────────────

  const clienteSeleccionado = useMemo(() => clientes.find((c) => c.id === clienteId) || null, [clientes, clienteId])
  const productoSeleccionado = useMemo(() => productos.find((p) => p.id === productoId) || null, [productos, productoId])
  const cuentaPendienteSeleccionada = useMemo(() => cuentasPendientesCliente.find((c) => c.id === cuentaCobrarSeleccionadaId) || null, [cuentasPendientesCliente, cuentaCobrarSeleccionadaId])
  const clienteTieneDeuda = useMemo(() => Number(estadoCuentaCliente?.total_pendiente_usd || 0) > 0.01, [estadoCuentaCliente])
  const precioUnitarioUSD = Number(productoSeleccionado?.precio_venta_usd || 0)
  const totalUSD = useMemo(() => r2(Number((cantidad || 0) * precioUnitarioUSD)), [cantidad, precioUnitarioUSD])
  const stockInsuficiente = useMemo(() => productoSeleccionado ? cantidad > Number(productoSeleccionado.cantidad_actual || 0) : false, [productoSeleccionado, cantidad])

  const totalObjetivoUSD = useMemo(() => {
    if (destinoSaldo === 'deuda' && cuentaPendienteSeleccionada) return r2(Number(cuentaPendienteSeleccionada.saldo_usd || 0))
    return tipoIngreso === 'producto' ? totalUSD : 0
  }, [destinoSaldo, cuentaPendienteSeleccionada, tipoIngreso, totalUSD])

  // Métodos por moneda
  const metodosPagoUnicoDisponibles = useMemo(
    () => monedaPagoUnico === 'USD' ? metodosPago.filter(detectarMetodoUsd) : metodosPago.filter(detectarMetodoBs),
    [metodosPago, monedaPagoUnico]
  )
  const metodosMixtoIngresado = useMemo(
    () => mixtoMonedaIngresada === 'USD' ? metodosPago.filter(detectarMetodoUsd) : metodosPago.filter(detectarMetodoBs),
    [metodosPago, mixtoMonedaIngresada]
  )
  const metodosMixtoDiferencia = useMemo(
    () => mixtoMonedaIngresada === 'USD' ? metodosPago.filter(detectarMetodoBs) : metodosPago.filter(detectarMetodoUsd),
    [metodosPago, mixtoMonedaIngresada]
  )

  // Cálculos pago único
  const totalPagoUnicoUsd = useMemo(() => r2(totalObjetivoUSD), [totalObjetivoUSD])
  const totalPagoUnicoBs = useMemo(
    () => (monedaPagoUnico !== 'BS' || !tasaPagoUnico || tasaPagoUnico <= 0) ? 0 : r2(totalObjetivoUSD * tasaPagoUnico),
    [monedaPagoUnico, tasaPagoUnico, totalObjetivoUSD]
  )

  // Cálculos pago mixto
  const mixtoMontoIngresadoUsdEquiv = useMemo(() => {
    if (mixtoMonedaIngresada === 'USD') return r2(clamp(Number(mixtoMontoIngresadoUsd || 0), 0, totalObjetivoUSD))
    if (!mixtoTasaBcv || mixtoTasaBcv <= 0) return 0
    return r2(Math.max(Number(mixtoMontoIngresadoBs || 0), 0) / mixtoTasaBcv)
  }, [mixtoMonedaIngresada, mixtoMontoIngresadoUsd, mixtoMontoIngresadoBs, mixtoTasaBcv, totalObjetivoUSD])

  const mixtoFaltanteUsd = useMemo(
    () => r2(Math.max(totalObjetivoUSD - mixtoMontoIngresadoUsdEquiv, 0)),
    [totalObjetivoUSD, mixtoMontoIngresadoUsdEquiv]
  )
  const mixtoFaltanteBs = useMemo(
    () => (!mixtoTasaBcv || mixtoTasaBcv <= 0) ? 0 : r2(mixtoFaltanteUsd * mixtoTasaBcv),
    [mixtoFaltanteUsd, mixtoTasaBcv]
  )

  // Resumen unificado
  const resumenPagos = useMemo(() => {
    if (tipoPago === 'unico') {
      return {
        items: [{
          metodo_pago_v2_id: metodoPagoUnicoId, moneda_pago: monedaPagoUnico,
          monto_insertar: monedaPagoUnico === 'BS' ? r2(totalPagoUnicoBs) : r2(totalObjetivoUSD),
          monto_equivalente_usd: r2(totalObjetivoUSD),
          monto_equivalente_bs: monedaPagoUnico === 'BS' ? r2(totalPagoUnicoBs) : null,
          tasa_bcv: monedaPagoUnico === 'BS' ? tasaPagoUnico : null,
          referencia: referenciaPagoUnico || null, notas: notasPagoUnico || null,
        }],
        totalUsd: r2(totalObjetivoUSD), totalBs: r2(totalPagoUnicoBs),
        faltanteUsd: 0, excedenteUsd: 0, diferenciaUsd: 0,
        cubreTotal: totalObjetivoUSD > 0,
        tieneExcedente: false,
        todosValidos: !!metodoPagoUnicoId && (monedaPagoUnico === 'USD' || (!!tasaPagoUnico && tasaPagoUnico > 0)),
      }
    }

    const items = [
      {
        metodo_pago_v2_id: mixtoMetodoIngresadoId, moneda_pago: mixtoMonedaIngresada,
        monto_insertar: mixtoMonedaIngresada === 'USD'
          ? r2(clamp(Number(mixtoMontoIngresadoUsd || 0), 0, totalObjetivoUSD))
          : r2(Number(mixtoMontoIngresadoBs || 0)),
        monto_equivalente_usd: mixtoMontoIngresadoUsdEquiv,
        monto_equivalente_bs: mixtoMonedaIngresada === 'BS'
          ? r2(Number(mixtoMontoIngresadoBs || 0))
          : (mixtoTasaBcv && mixtoTasaBcv > 0 ? r2(clamp(Number(mixtoMontoIngresadoUsd || 0), 0, totalObjetivoUSD) * mixtoTasaBcv) : null),
        tasa_bcv: mixtoMonedaIngresada === 'BS' ? mixtoTasaBcv : null,
        referencia: mixtoReferenciaIngresada || null, notas: mixtoNotasIngresada || null,
        valido: !!mixtoMetodoIngresadoId && (
          mixtoMonedaIngresada === 'USD'
            ? Number(mixtoMontoIngresadoUsd || 0) > 0
            : Number(mixtoMontoIngresadoBs || 0) > 0 && Number(mixtoTasaBcv || 0) > 0
        ),
      },
      {
        metodo_pago_v2_id: mixtoMetodoDiferenciaId,
        moneda_pago: mixtoMonedaIngresada === 'USD' ? ('BS' as const) : ('USD' as const),
        monto_insertar: mixtoMonedaIngresada === 'USD' ? r2(mixtoFaltanteBs) : r2(mixtoFaltanteUsd),
        monto_equivalente_usd: mixtoFaltanteUsd,
        monto_equivalente_bs: mixtoMonedaIngresada === 'USD'
          ? r2(mixtoFaltanteBs)
          : (mixtoTasaBcv && mixtoTasaBcv > 0 ? r2(mixtoFaltanteUsd * mixtoTasaBcv) : null),
        tasa_bcv: mixtoMonedaIngresada === 'USD' ? mixtoTasaBcv : null,
        referencia: mixtoReferenciaDiferencia || null, notas: mixtoNotasDiferencia || null,
        valido: !!mixtoMetodoDiferenciaId && (
          mixtoMonedaIngresada === 'USD'
            ? Number(mixtoFaltanteBs || 0) >= 0 && Number(mixtoTasaBcv || 0) > 0
            : Number(mixtoFaltanteUsd || 0) >= 0
        ),
      },
    ]

    const totalUsd = r2(items.reduce((a, i) => a + Number(i.monto_equivalente_usd || 0), 0))
    const totalBs = r2(items.reduce((a, i) => a + Number(i.monto_equivalente_bs || 0), 0))
    const diferenciaUsd = r2(totalObjetivoUSD - totalUsd)
    const faltanteUsd = r2(Math.max(totalObjetivoUSD - totalUsd, 0))
    const excedenteUsd = r2(Math.max(totalUsd - totalObjetivoUSD, 0))

    return {
      items, totalUsd, totalBs, faltanteUsd, excedenteUsd, diferenciaUsd,
      cubreTotal: Math.abs(diferenciaUsd) < 0.01 && totalObjetivoUSD > 0,
      tieneExcedente: excedenteUsd > 0.01,
      todosValidos: items.every((i) => i.valido),
    }
  }, [
    tipoPago, monedaPagoUnico, metodoPagoUnicoId, tasaPagoUnico, referenciaPagoUnico, notasPagoUnico,
    totalObjetivoUSD, totalPagoUnicoBs,
    mixtoMonedaIngresada, mixtoMetodoIngresadoId, mixtoMetodoDiferenciaId,
    mixtoMontoIngresadoUsd, mixtoMontoIngresadoBs, mixtoTasaBcv,
    mixtoReferenciaIngresada, mixtoReferenciaDiferencia, mixtoNotasIngresada, mixtoNotasDiferencia,
    mixtoMontoIngresadoUsdEquiv, mixtoFaltanteUsd, mixtoFaltanteBs,
  ])

  // ─── RPC helpers ──────────────────────────────────────────────────────────

  function buildPagosPayload() {
    return resumenPagos.items.map((item) => ({
      metodo_pago_v2_id: item.metodo_pago_v2_id, moneda_pago: item.moneda_pago,
      monto: item.monto_insertar,
      tasa_bcv: item.moneda_pago === 'BS' ? item.tasa_bcv : null,
      referencia: item.referencia || null, notas: item.notas || null,
    }))
  }

  async function registrarPagoMixtoProducto(args: { fecha: string; concepto: string; clienteId: string; inventarioId: string; cantidad: number; notasGenerales: string | null }) {
    const { data, error } = await supabase.rpc('registrar_pagos_mixtos', { p_fecha: args.fecha, p_tipo_origen: 'producto', p_categoria: 'producto', p_concepto: args.concepto, p_cliente_id: args.clienteId, p_cita_id: null, p_cliente_plan_id: null, p_cuenta_cobrar_id: null, p_inventario_id: args.inventarioId, p_registrado_por: null, p_notas_generales: args.notasGenerales, p_pagos: buildPagosPayload() })
    if (error) throw error
    const operacionPagoId = data?.operacion_pago_id || null
    if (operacionPagoId) await supabase.from('pagos').update({ inventario_id: args.inventarioId, cantidad_producto: args.cantidad }).eq('operacion_pago_id', operacionPagoId)
    return operacionPagoId
  }

  async function registrarPagoMixtoSaldo(args: { fecha: string; concepto: string; clienteId: string; notasGenerales: string | null }) {
    const { data, error } = await supabase.rpc('registrar_pagos_mixtos', { p_fecha: args.fecha, p_tipo_origen: 'saldo_cliente', p_categoria: 'saldo_cliente', p_concepto: args.concepto, p_cliente_id: args.clienteId, p_cita_id: null, p_cliente_plan_id: null, p_cuenta_cobrar_id: null, p_inventario_id: null, p_registrado_por: null, p_notas_generales: args.notasGenerales, p_pagos: buildPagosPayload() })
    if (error) throw error
    return data?.operacion_pago_id || null
  }

  async function registrarPagoMixtoDeuda(args: { cuentaCobrarId: string; fecha: string; notasGenerales: string | null }) {
    await registrarAbonoMixto({ cuenta_cobrar_id: args.cuentaCobrarId, fecha: args.fecha, notas_generales: args.notasGenerales, pagos: buildPagosPayload() })
  }

  // ─── Validación pago ──────────────────────────────────────────────────────

  function validarPago(): string | null {
    if (tipoPago === 'unico') {
      if (!metodoPagoUnicoId) return 'Selecciona el método de pago.'
      if (monedaPagoUnico === 'BS' && (!tasaPagoUnico || tasaPagoUnico <= 0)) return 'Selecciona una tasa válida para el pago en bolívares.'
    } else {
      if (!mixtoMetodoIngresadoId) return 'Selecciona el método del monto recibido.'
      if (!mixtoMetodoDiferenciaId) return 'Selecciona el método de la diferencia.'
      if (mixtoMonedaIngresada === 'USD' && Number(mixtoMontoIngresadoUsd || 0) <= 0) return 'Ingresa el monto recibido en USD.'
      if (mixtoMonedaIngresada === 'BS' && Number(mixtoMontoIngresadoBs || 0) <= 0) return 'Ingresa el monto recibido en bolívares.'
      if (!mixtoTasaBcv || mixtoTasaBcv <= 0) return 'Selecciona una tasa válida para el pago mixto.'
      if (!resumenPagos.todosValidos) return 'Completa correctamente los datos del pago mixto.'
      if (!resumenPagos.cubreTotal) return `La suma no cuadra. Faltante: ${formatearMoneda(resumenPagos.faltanteUsd, 'USD')}`
    }
    return null
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clienteId) { alert('Selecciona un cliente'); return }
    if (!clienteSeleccionado) { alert('Cliente inválido'); return }
    if (tipoIngreso === 'producto') {
      if (!productoId) { alert('Selecciona un producto'); return }
      if (cantidad <= 0) { alert('La cantidad debe ser mayor a 0'); return }
      if (!editingId && stockInsuficiente) { alert('No hay suficiente stock disponible'); return }
    }
    if (tipoIngreso === 'saldo' && estado !== 'pagado') { alert('La recarga de saldo solo se puede registrar como pagada.'); return }

    const productoActual = tipoIngreso === 'producto' ? productoSeleccionado : null
    const conceptoFinal = tipoIngreso === 'saldo'
      ? (concepto.trim() || (destinoSaldo === 'deuda' && cuentaPendienteSeleccionada ? `Abono a deuda: ${cuentaPendienteSeleccionada.concepto}` : 'Recarga de saldo a favor'))
      : (concepto.trim() || `Venta de ${productoActual?.nombre || ''} x${cantidad}`)

    setSaving(true)
    try {
      // ── Pago de deuda ──
      if (destinoSaldo === 'deuda' && cuentaPendienteSeleccionada && estado === 'pagado') {
        const err = validarPago(); if (err) { alert(err); setSaving(false); return }
        const objetivo = Number(cuentaPendienteSeleccionada.saldo_usd || 0)
        if (Math.abs(resumenPagos.totalUsd - objetivo) > 0.01) {
          alert(`El pago debe cubrir exactamente la deuda.\nDeuda: ${formatearMoneda(objetivo, 'USD')} | Registrado: ${formatearMoneda(resumenPagos.totalUsd, 'USD')}`)
          setSaving(false); return
        }
        await registrarPagoMixtoDeuda({ cuentaCobrarId: cuentaPendienteSeleccionada.id, fecha, notasGenerales: notas.trim() || null })
        alert(`✅ Deuda aplicada por ${formatearMoneda(objetivo, 'USD')}.`)
        resetForm(); await cargarDatos(); await cargarEstadoCuentaCliente(clienteSeleccionado.id); return
      }

      // ── Saldo a crédito ──
      if (tipoIngreso === 'saldo') {
        if (editingId) { alert('Las recargas de saldo no se editan. Registra una nueva.'); setSaving(false); return }
        const err = validarPago(); if (err) { alert(err); setSaving(false); return }
        if (resumenPagos.totalUsd <= 0) { alert('Debes indicar un monto válido para la recarga.'); setSaving(false); return }
        const operacionPagoId = await registrarPagoMixtoSaldo({ fecha, concepto: conceptoFinal, clienteId: clienteSeleccionado.id, notasGenerales: notas.trim() || null })
        if (!operacionPagoId) throw new Error('No se pudo generar la operación de recarga de saldo')
        await crearCreditoCliente({ clienteId: clienteSeleccionado.id, operacionPagoId, excedenteUsd: resumenPagos.totalUsd, descripcion: conceptoFinal, origenTipo: 'saldo_cliente' })
        alert(`✅ Saldo agregado. Se acreditó ${formatearMoneda(resumenPagos.totalUsd, 'USD')} al cliente.`)
        resetForm(); await cargarDatos(); await cargarEstadoCuentaCliente(clienteSeleccionado.id); return
      }

      // ── Edición ──
      if (editingId) {
        if (estado === 'pendiente') { alert('Una operación pagada no se puede convertir a pendiente.'); setSaving(false); return }
        const err = validarPago(); if (err) { alert(err); setSaving(false); return }
        await limpiarCreditosExcedenteOperacion(editingOperacionId)
        if (editingOperacionId) {
          const { error } = await supabase.from('pagos').delete().eq('operacion_pago_id', editingOperacionId)
          if (error) throw error
        } else {
          const { error } = await supabase.from('pagos').delete().eq('id', editingId)
          if (error) throw error
        }
        const nuevaOpId = await registrarPagoMixtoProducto({ fecha, concepto: conceptoFinal, clienteId: clienteSeleccionado.id, inventarioId: productoId, cantidad, notasGenerales: notas.trim() || null })
        if (nuevaOpId && resumenPagos.excedenteUsd > 0.01) await crearCreditoCliente({ clienteId: clienteSeleccionado.id, operacionPagoId: nuevaOpId, excedenteUsd: resumenPagos.excedenteUsd, descripcion: `Crédito por excedente en ${conceptoFinal}` })
        alert(resumenPagos.excedenteUsd > 0.01 ? `✅ Actualizado. Crédito generado: ${formatearMoneda(resumenPagos.excedenteUsd, 'USD')}` : '✅ Ingreso actualizado')
        resetForm(); await cargarDatos(); await cargarEstadoCuentaCliente(clienteSeleccionado.id); return
      }

      // ── Venta pendiente ──
      if (estado === 'pendiente') {
        const cantidadAnterior = Number(productoActual?.cantidad_actual || 0)
        await crearCuentaPorCobrar({ clienteId: clienteSeleccionado.id, clienteNombre: clienteSeleccionado.nombre, concepto: conceptoFinal, inventarioId: productoId, cantidad, totalUSD, notas: notas.trim() || null, fechaVenta: fecha })
        await descontarInventarioYCrearMovimiento({ pagoId: null, productoId, cantidad, cantidadAnterior, cantidadNueva: cantidadAnterior - cantidad, precioUnitarioUSD, totalUSD, conceptoMovimiento: `Venta pendiente a ${clienteSeleccionado.nombre}` })
        alert('✅ Venta enviada a cobranzas')
        resetForm(); await cargarDatos(); await cargarEstadoCuentaCliente(clienteSeleccionado.id); return
      }

      // ── Venta pagada ──
      const err = validarPago(); if (err) { alert(err); setSaving(false); return }
      const operacionPagoId = await registrarPagoMixtoProducto({ fecha, concepto: conceptoFinal, clienteId: clienteSeleccionado.id, inventarioId: productoId, cantidad, notasGenerales: notas.trim() || null })
      if (operacionPagoId && resumenPagos.excedenteUsd > 0.01) await crearCreditoCliente({ clienteId: clienteSeleccionado.id, operacionPagoId, excedenteUsd: resumenPagos.excedenteUsd, descripcion: `Crédito por excedente en ${conceptoFinal}` })
      const cantidadAnterior = Number(productoActual?.cantidad_actual || 0)
      await descontarInventarioYCrearMovimiento({ pagoId: null, productoId, cantidad, cantidadAnterior, cantidadNueva: cantidadAnterior - cantidad, precioUnitarioUSD, totalUSD, conceptoMovimiento: `Venta a ${clienteSeleccionado.nombre}` })
      alert(resumenPagos.excedenteUsd > 0.01 ? `✅ Registrado. Crédito generado: ${formatearMoneda(resumenPagos.excedenteUsd, 'USD')}` : '✅ Ingreso registrado')
      resetForm(); await cargarDatos(); await cargarEstadoCuentaCliente(clienteSeleccionado.id)
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo guardar'))
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setTipoIngreso('producto'); setProductoId(''); setClienteId(''); setCantidad(1); setConcepto('')
    setEstado('pagado'); setNotas(''); setFecha(new Date().toISOString().slice(0, 10))
    // Reset pago
    setTipoPago('unico'); setMonedaPagoUnico('USD'); setMetodoPagoUnicoId('')
    setReferenciaPagoUnico(''); setNotasPagoUnico(''); setTasaPagoUnico(null); setMontoPagoUnicoBs(null)
    setMixtoMonedaIngresada('USD'); setMixtoMetodoIngresadoId(''); setMixtoMetodoDiferenciaId('')
    setMixtoMontoIngresadoUsd(''); setMixtoMontoIngresadoBs(null); setMixtoTasaBcv(null)
    setMixtoReferenciaIngresada(''); setMixtoReferenciaDiferencia(''); setMixtoNotasIngresada(''); setMixtoNotasDiferencia('')
    setEditingId(null); setEditingOperacionId(null)
    setCuentaCobrarSeleccionadaId(''); setDestinoSaldo('credito'); setShowForm(false)
  }

  function startEdit(operacion: PagoOperacion) {
    setTipoIngreso('producto'); setEditingId(operacion.id_representativo); setEditingOperacionId(operacion.operacion_pago_id)
    setFecha(operacion.fecha); setConcepto(operacion.concepto); setProductoId(operacion.inventario_id || '')
    setCantidad(Number(operacion.cantidad_producto || 1)); setClienteId(operacion.cliente_id || '')
    setEstado(estadoUiDesdeDb(operacion.estado)); setNotas(operacion.items[0]?.notas || '')
    // Al editar cargamos como pago único
    setTipoPago('unico')
    const first = operacion.items[0]
    if (first) {
      setMonedaPagoUnico((first.moneda_pago || 'USD') as 'USD' | 'BS')
      setMetodoPagoUnicoId(first.metodo_pago_v2_id || '')
      setReferenciaPagoUnico(first.referencia || '')
      setNotasPagoUnico(first.notas || '')
    }
    setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function eliminarPago(operacion: PagoOperacion) {
    if (!confirm('¿Eliminar este ingreso?')) return
    try {
      await limpiarCreditosExcedenteOperacion(operacion.operacion_pago_id)
      let query = supabase.from('pagos').delete()
      query = operacion.operacion_pago_id ? query.eq('operacion_pago_id', operacion.operacion_pago_id) : query.eq('id', operacion.id_representativo)
      const { error } = await query
      if (error) throw error
      alert('✅ Ingreso eliminado'); await cargarDatos()
      if (operacion.cliente_id) await cargarEstadoCuentaCliente(operacion.cliente_id)
    } catch (err: any) { alert('Error: ' + (err.message || 'No se pudo eliminar')) }
  }

  const operaciones = useMemo(() => agruparPagosPorOperacion(pagos), [pagos])

  const pagosFiltrados = useMemo(() => operaciones.filter((pago) => {
    if (estadoFiltro !== 'todos' && pago.estado !== estadoFiltro) return false
    if (search) { const s = search.toLowerCase(); return pago.concepto.toLowerCase().includes(s) || pago.categoria.toLowerCase().includes(s) || (pago.cliente_nombre || '').toLowerCase().includes(s) }
    return true
  }), [operaciones, estadoFiltro, search])

  const totales = useMemo(() => {
    const pagados = operaciones.filter((p) => p.estado === 'pagado')
    return { totalUSD: pagados.reduce((sum, p) => sum + Number(p.total_usd || 0), 0), totalBS: pagados.reduce((sum, p) => sum + Number(p.total_bs || 0), 0), cantidad: pagados.length }
  }, [operaciones])

  if (loading) return <LoadingIngresos />

  // ─── Render ────────────────────────────────────────────────────────────────

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
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Ingresos y saldo de clientes</h1>
            <p className="mt-2 text-sm text-white/55">Registra ventas del inventario o recargas de saldo a favor del cliente.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:w-auto">
            {[{ label: 'Total USD', value: formatearMoneda(totales.totalUSD, 'USD') }, { label: 'Total Bs', value: formatearMoneda(totales.totalBS, 'BS') }, { label: 'Operaciones', value: String(totales.cantidad) }].map((kpi) => (
              <div key={kpi.label} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
                <p className="text-xs text-white/55">{kpi.label}</p>
                <p className="mt-1 text-lg font-semibold text-white">{kpi.value}</p>
              </div>
            ))}
          </div>
        </div>

        {!showForm && (
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/85 transition hover:bg-white/[0.06]">
            <Plus className="h-4 w-4" />Nuevo ingreso
          </button>
        )}

        <div className="grid gap-6 xl:grid-cols-3">

          {/* ── Formulario ── */}
          {showForm && (
            <div className="xl:col-span-1">
              <form onSubmit={handleSubmit} className={`${panelCls} space-y-5 p-6`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{editingId ? 'Editar ingreso' : 'Nuevo ingreso'}</h2>
                    <p className="mt-1 text-xs text-white/45">Completa los datos del ingreso.</p>
                  </div>
                  <button type="button" onClick={resetForm} className="rounded-full border border-white/10 bg-white/[0.03] p-2 text-white/50 transition hover:bg-white/[0.06] hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Fecha */}
                <div>
                  <label className={labelCls}>Fecha *</label>
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} required />
                </div>

                {/* Tipo de ingreso */}
                <div>
                  <label className={labelCls}>Tipo de ingreso *</label>
                  <select value={tipoIngreso} onChange={(e) => { const next = e.target.value as TipoIngresoUI; setTipoIngreso(next); setProductoId(''); setCantidad(1); setConcepto(next === 'saldo' ? 'Recarga de saldo a favor' : ''); setEstado('pagado') }} className={inputCls} disabled={!!editingId}>
                    <option value="producto" className="bg-[#11131a]">Venta de producto</option>
                    <option value="saldo" className="bg-[#11131a]">Recarga de saldo</option>
                  </select>
                  {editingId && <p className="mt-2 text-xs text-amber-300">Al editar, el tipo se mantiene como venta de producto.</p>}
                </div>

                {/* ── Selector cliente ── */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                  <div>
                    <label className={labelCls}>Cliente *</label>
                    <ClienteSearch clientes={clientes} value={clienteId} onChange={(id) => setClienteId(id)} />
                    {clientePrefill && clienteSeleccionado && (
                      <p className="mt-2 text-xs text-cyan-300">Cliente cargado automáticamente desde su ficha.</p>
                    )}
                  </div>

                  {/* Info del cliente */}
                  {clienteSeleccionado && (
                    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2"><User2 className="h-4 w-4 text-white/70" /></div>
                      <div className="min-w-0 text-xs text-white/60">
                        <p className="truncate font-medium text-white">{clienteSeleccionado.nombre}</p>
                        {clienteSeleccionado.telefono && <p>{clienteSeleccionado.telefono}</p>}
                        {clienteSeleccionado.email && <p className="truncate">{clienteSeleccionado.email}</p>}
                      </div>
                    </div>
                  )}

                  {/* Estado financiero */}
                  {clienteSeleccionado && estadoCuentaCliente && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                        <p className="text-sm font-medium text-white">Estado financiero</p>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoFinancieroBadge(estadoCuentaCliente)}`}>{estadoFinancieroLabel(estadoCuentaCliente)}</span>
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

                  {/* Destino pago si tiene deudas */}
                  {clienteSeleccionado && clienteTieneDeuda && estado === 'pagado' && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-white/55 uppercase tracking-wide">¿A dónde va este pago?</p>
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
                        <SelectorDeuda
                          cuentas={cuentasPendientesCliente}
                          seleccionadaId={cuentaCobrarSeleccionadaId}
                          onSeleccionar={(id) => {
                            setCuentaCobrarSeleccionadaId(id)
                            const cuenta = cuentasPendientesCliente.find((c) => c.id === id)
                            if (cuenta) setConcepto(`Abono: ${cuenta.concepto}`)
                          }}
                        />
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

                {/* Producto */}
                {tipoIngreso === 'producto' && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                    <div>
                      <label className={labelCls}>Producto *</label>
                      <select value={productoId} onChange={(e) => { const id = e.target.value; setProductoId(id); const prod = productos.find((p) => p.id === id); if (prod) setConcepto(`Venta de ${prod.nombre} x${cantidad}`) }} className={inputCls} required disabled={!!editingId}>
                        <option value="" className="bg-[#11131a]">Seleccionar producto...</option>
                        {productos.map((prod) => <option key={prod.id} value={prod.id} className="bg-[#11131a]">{prod.nombre} - Stock: {prod.cantidad_actual} {prod.unidad_medida}</option>)}
                      </select>
                      {editingId && <p className="mt-2 text-xs text-amber-300">Al editar, producto y cantidad quedan bloqueados.</p>}
                    </div>
                    {productoSeleccionado && (
                      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2"><Package2 className="h-4 w-4 text-white/70" /></div>
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
                    <input type="number" min="1" step="1" value={cantidad} onChange={(e) => { const v = Number(e.target.value) || 1; setCantidad(v); if (productoSeleccionado) setConcepto(`Venta de ${productoSeleccionado.nombre} x${v}`) }} className={inputCls} required disabled={!!editingId} />
                    {productoSeleccionado && <p className="mt-1 text-xs text-white/45">Disponible: {formatQty(productoSeleccionado.cantidad_actual)} {productoSeleccionado.unidad_medida}</p>}
                  </div>
                )}

                {/* Concepto */}
                <div>
                  <label className={labelCls}>Concepto</label>
                  <input type="text" value={concepto} onChange={(e) => setConcepto(e.target.value)} className={inputCls} required />
                </div>

                {/* Resumen montos */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  {tipoIngreso === 'producto' ? (
                    <>
                      <div className="flex justify-between text-sm"><span className="text-white/55">Precio unitario</span><span className="font-semibold text-white">{formatearMoneda(precioUnitarioUSD, 'USD')}</span></div>
                      <div className="mt-2 flex justify-between text-sm"><span className="text-white/55">Total</span><span className="font-semibold text-white">{formatearMoneda(totalUSD, 'USD')}</span></div>
                      {estado === 'pendiente' && <p className="mt-3 text-xs text-amber-300">Si no paga, se envía a cobranzas.</p>}
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/55">{destinoSaldo === 'deuda' ? 'Deuda seleccionada' : 'Total a acreditar'}</span>
                        <span className="font-semibold text-white">{formatearMoneda(destinoSaldo === 'deuda' ? Number(cuentaPendienteSeleccionada?.saldo_usd || 0) : resumenPagos.totalUsd, 'USD')}</span>
                      </div>
                      <div className="mt-2 flex justify-between text-sm"><span className="text-white/55">Total Bs</span><span className="font-semibold text-white">{formatearMoneda(resumenPagos.totalBs, 'BS')}</span></div>
                      <p className="mt-3 text-xs text-white/55">{destinoSaldo === 'deuda' ? 'Este pago se aplicará directamente a la deuda seleccionada.' : 'Deja el dinero como saldo a favor del cliente.'}</p>
                    </>
                  )}
                </div>

                {/* Estado */}
                <div>
                  <label className={labelCls}>Estado</label>
                  <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoUI)} className={inputCls} disabled={!!editingId}>
                    <option value="pagado" className="bg-[#11131a]">Pagado</option>
                    {tipoIngreso === 'producto' && <option value="pendiente" className="bg-[#11131a]">Pendiente</option>}
                  </select>
                  {editingId && <p className="mt-2 text-xs text-amber-300">Al editar, se mantiene como pagada.</p>}
                </div>

                {/* ── Sección de pago ── */}
                {estado === 'pagado' && (
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-medium text-white">Pago</p>

                    {/* Toggle único / mixto */}
                    <div className="grid grid-cols-2 gap-2">
                      {(['unico', 'mixto'] as TipoPago[]).map((t) => (
                        <button key={t} type="button" onClick={() => setTipoPago(t)}
                          className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${tipoPago === t ? 'border-violet-400/40 bg-violet-500/20 text-violet-300' : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]'}`}>
                          {t === 'unico' ? 'Pago único' : 'Pago mixto'}
                        </button>
                      ))}
                    </div>

                    {/* ── Pago único ── */}
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
                              <option key={m.id} value={m.id} className="bg-[#11131a]">{m.nombre}{m.moneda ? ` · ${m.moneda}` : ''}{m.cartera?.nombre ? ` · ${m.cartera.nombre}` : ''}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>{monedaPagoUnico === 'USD' ? 'Monto USD' : 'Monto Bs'}</label>
                          <input type="text"
                            value={monedaPagoUnico === 'USD' ? formatearMoneda(totalPagoUnicoUsd, 'USD') : formatearMoneda(totalPagoUnicoBs, 'BS')}
                            readOnly className={`${inputCls} cursor-not-allowed opacity-80`} />
                        </div>
                        {monedaPagoUnico === 'BS' && (
                          <PagoBsSelector fecha={fecha} montoUsd={totalObjetivoUSD} montoBs={montoPagoUnicoBs}
                            onChangeTasa={setTasaPagoUnico} onChangeMontoBs={setMontoPagoUnicoBs} />
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

                    {/* ── Pago mixto ── */}
                    {tipoPago === 'mixto' && (
                      <div className="space-y-3">
                        <p className="text-xs text-white/55">Escribe lo que recibiste primero; el sistema calcula la diferencia automáticamente.</p>

                        <div>
                          <label className={labelCls}>Moneda recibida primero</label>
                          <select value={mixtoMonedaIngresada} onChange={(e) => setMixtoMonedaIngresada(e.target.value as 'USD' | 'BS')} className={inputCls}>
                            <option value="USD" className="bg-[#11131a]">USD</option>
                            <option value="BS" className="bg-[#11131a]">Bs</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Método del pago recibido</label>
                          <select value={mixtoMetodoIngresadoId} onChange={(e) => setMixtoMetodoIngresadoId(e.target.value)} className={inputCls}>
                            <option value="" className="bg-[#11131a]">Seleccionar método</option>
                            {metodosMixtoIngresado.map((m) => (
                              <option key={m.id} value={m.id} className="bg-[#11131a]">{m.nombre}{m.moneda ? ` · ${m.moneda}` : ''}{m.cartera?.nombre ? ` · ${m.cartera.nombre}` : ''}</option>
                            ))}
                          </select>
                        </div>

                        {mixtoMonedaIngresada === 'USD'
                          ? (
                            <div>
                              <label className={labelCls}>Monto recibido en USD</label>
                              <input type="number" min={0} step="0.01" value={mixtoMontoIngresadoUsd} onChange={(e) => setMixtoMontoIngresadoUsd(e.target.value)} className={inputCls} placeholder="0.00" />
                            </div>
                          ) : (
                            <div>
                              <label className={labelCls}>Monto recibido en Bs</label>
                              <input type="number" min={0} step="0.01" value={mixtoMontoIngresadoBs ?? ''} onChange={(e) => setMixtoMontoIngresadoBs(e.target.value ? Number(e.target.value) : null)} className={inputCls} placeholder="0.00" />
                            </div>
                          )
                        }

                        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                          <p className="text-xs text-white/45">Equivale en USD</p>
                          <p className="mt-1 text-base font-semibold text-white">{formatearMoneda(mixtoMontoIngresadoUsdEquiv, 'USD')}</p>
                          <p className="mt-1 text-xs text-white/40">{mixtoMonedaIngresada === 'USD' ? 'Pago directo en USD' : `Desde ${formatearMoneda(Number(mixtoMontoIngresadoBs || 0), 'BS')}`}</p>
                        </div>

                        <PagoBsSelector
                          fecha={fecha}
                          montoUsd={mixtoMonedaIngresada === 'USD' ? r2(clamp(Number(mixtoMontoIngresadoUsd || 0), 0, totalObjetivoUSD)) : mixtoMontoIngresadoUsdEquiv}
                          montoBs={mixtoMonedaIngresada === 'BS' ? mixtoMontoIngresadoBs : mixtoFaltanteBs}
                          onChangeTasa={setMixtoTasaBcv}
                          onChangeMontoBs={(m) => { if (mixtoMonedaIngresada === 'BS') setMixtoMontoIngresadoBs(m) }}
                        />

                        <div>
                          <label className={labelCls}>Referencia del pago recibido</label>
                          <input type="text" value={mixtoReferenciaIngresada} onChange={(e) => setMixtoReferenciaIngresada(e.target.value)} className={inputCls} placeholder="Referencia o comprobante" />
                        </div>
                        <div>
                          <label className={labelCls}>Notas del pago recibido</label>
                          <input type="text" value={mixtoNotasIngresada} onChange={(e) => setMixtoNotasIngresada(e.target.value)} className={inputCls} placeholder="Notas opcionales..." />
                        </div>

                        {/* Diferencia automática */}
                        <div className="rounded-xl border border-violet-400/15 bg-violet-500/5 p-3 space-y-3">
                          <p className="text-sm font-semibold text-violet-300">Diferencia automática</p>

                          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                            <p className="text-xs text-white/45">Faltan</p>
                            <p className="mt-1 text-base font-semibold text-white">{formatearMoneda(mixtoFaltanteUsd, 'USD')}</p>
                            <p className="mt-1 text-xs text-white/40">{mixtoMonedaIngresada === 'USD' ? `Equivale a ${formatearMoneda(mixtoFaltanteBs, 'BS')}` : 'Se mantiene en USD'}</p>
                          </div>

                          <div>
                            <label className={labelCls}>{mixtoMonedaIngresada === 'USD' ? 'Método para cobrar la diferencia en Bs' : 'Método para cobrar la diferencia en USD'}</label>
                            <select value={mixtoMetodoDiferenciaId} onChange={(e) => setMixtoMetodoDiferenciaId(e.target.value)} className={inputCls}>
                              <option value="" className="bg-[#11131a]">Seleccionar método</option>
                              {metodosMixtoDiferencia.map((m) => (
                                <option key={m.id} value={m.id} className="bg-[#11131a]">{m.nombre}{m.moneda ? ` · ${m.moneda}` : ''}{m.cartera?.nombre ? ` · ${m.cartera.nombre}` : ''}</option>
                              ))}
                            </select>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                            <p className="text-xs text-white/45">Monto automático de la diferencia</p>
                            <p className="mt-1 text-base font-semibold text-white">
                              {mixtoMonedaIngresada === 'USD' ? formatearMoneda(mixtoFaltanteBs, 'BS') : formatearMoneda(mixtoFaltanteUsd, 'USD')}
                            </p>
                          </div>

                          <div>
                            <label className={labelCls}>Referencia de la diferencia</label>
                            <input type="text" value={mixtoReferenciaDiferencia} onChange={(e) => setMixtoReferenciaDiferencia(e.target.value)} className={inputCls} placeholder="Referencia o comprobante" />
                          </div>
                          <div>
                            <label className={labelCls}>Notas de la diferencia</label>
                            <input type="text" value={mixtoNotasDiferencia} onChange={(e) => setMixtoNotasDiferencia(e.target.value)} className={inputCls} placeholder="Notas opcionales..." />
                          </div>
                        </div>

                        {/* Estado del cuadre */}
                        <div className={`rounded-xl border p-3 ${resumenPagos.cubreTotal ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-amber-400/20 bg-amber-400/5'}`}>
                          <p className={`text-sm font-medium ${resumenPagos.cubreTotal ? 'text-emerald-300' : 'text-amber-300'}`}>
                            {resumenPagos.cubreTotal ? 'La suma de pagos cuadra correctamente.' : `Faltante: ${formatearMoneda(resumenPagos.faltanteUsd, 'USD')}`}
                          </p>
                          <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-white/55">
                            <div>Objetivo: <span className="text-white">{formatearMoneda(totalObjetivoUSD, 'USD')}</span></div>
                            <div>USD: <span className="text-white">{formatearMoneda(resumenPagos.totalUsd, 'USD')}</span></div>
                            <div>Bs: <span className="text-white">{formatearMoneda(resumenPagos.totalBs, 'BS')}</span></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Resumen pagos (ambos modos) */}
                    {tipoPago === 'unico' && (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                        <div className="grid gap-3 text-sm sm:grid-cols-3">
                          <div><p className="text-xs text-white/45">Objetivo</p><p className="mt-1 font-semibold text-white">{formatearMoneda(totalObjetivoUSD, 'USD')}</p></div>
                          <div><p className="text-xs text-white/45">Total USD</p><p className="mt-1 font-semibold text-emerald-400">{formatearMoneda(resumenPagos.totalUsd, 'USD')}</p></div>
                          <div><p className="text-xs text-white/45">Total Bs</p><p className="mt-1 font-semibold text-amber-300">{formatearMoneda(resumenPagos.totalBs, 'BS')}</p></div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Notas */}
                <div>
                  <label className={labelCls}>Notas generales (opcional)</label>
                  <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Detalles adicionales..." rows={3} className={`${inputCls} resize-none`} />
                </div>

                {tipoIngreso === 'producto' && stockInsuficiente && !editingId && (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3">
                    <p className="text-sm text-rose-300">No hay suficiente stock para esta venta.</p>
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="submit" disabled={saving || (tipoIngreso === 'producto' && !!stockInsuficiente && !editingId)}
                    className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-medium text-white transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50">
                    {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Registrar'}
                  </button>
                  <button type="button" onClick={resetForm} className={softButtonCls}>Cancelar</button>
                </div>
              </form>
            </div>
          )}

          {/* ── Lista de pagos ── */}
          <div className={`space-y-4 ${showForm ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
            <div className={`${panelCls} p-4`}>
              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por concepto o cliente..." className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-white/20 focus:bg-white/[0.05]" />
                </div>
                <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-white/20 focus:bg-white/[0.05]">
                  <option value="todos" className="bg-[#11131a]">Todos</option>
                  <option value="pagado" className="bg-[#11131a]">Pagado</option>
                  <option value="pendiente" className="bg-[#11131a]">Pendiente</option>
                  <option value="anulado" className="bg-[#11131a]">Anulado</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {pagosFiltrados.length === 0 ? (
                <div className={`${panelCls} p-12 text-center`}><p className="text-white/45">No hay ingresos registrados</p></div>
              ) : (
                pagosFiltrados.map((operacion) => {
                  const estadoUi = estadoUiDesdeDb(operacion.estado)
                  return (
                    <div key={operacion.key} className={`${panelCls} p-5 transition hover:bg-white/[0.04]`}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-medium text-white">{operacion.concepto}</h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
                            <span>{operacion.fecha}</span><span>•</span><span>{operacion.categoria}</span><span>•</span><span>{operacion.tipo_origen}</span>
                            {operacion.cliente_nombre && <><span>•</span><span>{operacion.cliente_nombre}</span></>}
                            {operacion.es_pago_mixto && <><span>•</span><span>{operacion.items_total} pagos</span></>}
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${estadoUi === 'pagado' ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/20 bg-amber-400/10 text-amber-300'}`}>{operacion.estado}</span>
                          </div>
                          <div className="mt-3 space-y-2">
                            {operacion.items.map((item) => (
                              <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                  <div className="flex flex-wrap items-center gap-2 text-white/70">
                                    <span className="font-medium text-white">{item.metodos_pago_v2?.nombre || 'Método'}</span><span>·</span><span>{item.moneda_pago || 'USD'}</span>
                                    {item.referencia && <><span>·</span><span>Ref: {item.referencia}</span></>}
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
                            <button onClick={() => startEdit(operacion)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-white/60 transition hover:bg-white/[0.06] hover:text-white" title="Editar"><Edit2 className="h-4 w-4" /></button>
                            <button onClick={() => eliminarPago(operacion)} className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-2 text-rose-300 transition hover:bg-rose-400/15" title="Eliminar"><Trash2 className="h-4 w-4" /></button>
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