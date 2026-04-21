'use client'

/**
 * PagoConDeudaSelector — v2
 * ─────────────────────────────────────────────────────────────────
 * Maneja 3 casos de cobro × 2 modos de pago:
 *
 * Casos de cobro:
 *   1. Pago completo  → registra el monto total, sin deuda
 *   2. Abono parcial  → registra lo abonado + genera cuenta por cobrar
 *   3. Sin pago       → no registra pago, genera cuenta por cobrar total
 *
 * Modos de pago (aplica en casos 1 y 2):
 *   - Pago único  → un solo método
 *   - Pago mixto  → dos métodos (USD + BS u otro combo)
 *
 * Ruta: /components/pagos/PagoConDeudaSelector.tsx
 * ─────────────────────────────────────────────────────────────────
 */

import { memo, useEffect, useMemo } from 'react'
import SelectorTasaBCV from '@/components/finanzas/SelectorTasaBCV'

// ─── Types ─────────────────────────────────────────────────────────

export type TipoCobro = 'completo' | 'abono' | 'sin_pago'
export type ModoPago  = 'unico' | 'mixto'
export type MonedaPago = 'USD' | 'BS'

export type MetodoPagoBase = {
  id: string
  nombre: string
  tipo?: string | null
  moneda?: string | null
  cartera?: { nombre: string; codigo: string } | null
}

export type PagoItemState = {
  moneda: MonedaPago
  metodoId: string
  monto: string
  referencia: string
  notas: string
  tasaBcv: number | null
  montoBs: number | null
}

export type PagoConDeudaState = {
  tipoCobro: TipoCobro
  modoPago: ModoPago
  pagoUnico: PagoItemState
  pagoMixto1: PagoItemState
  pagoMixto2: PagoItemState
  notasDeuda: string
}

export type PagoConDeudaProps = {
  montoTotal: number
  fecha: string
  metodosPago: MetodoPagoBase[]
  value: PagoConDeudaState
  onChange: (state: PagoConDeudaState) => void
  concepto?: string
  clienteNombre?: string
  mostrarMontoTotal?: boolean
}

// ─── Estado inicial ─────────────────────────────────────────────────

function pagoItemVacio(moneda: MonedaPago = 'USD'): PagoItemState {
  return { moneda, metodoId: '', monto: '', referencia: '', notas: '', tasaBcv: null, montoBs: null }
}

export function pagoConDeudaInitial(): PagoConDeudaState {
  return {
    tipoCobro: 'completo',
    modoPago: 'unico',
    pagoUnico: pagoItemVacio('USD'),
    pagoMixto1: pagoItemVacio('USD'),
    pagoMixto2: pagoItemVacio('BS'),
    notasDeuda: '',
  }
}

// ─── Detección de moneda ────────────────────────────────────────────

export function detectarMetodoBs(metodo: MetodoPagoBase | null) {
  if (!metodo) return false
  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const tipo   = (metodo.tipo || '').toLowerCase()
  const cc     = (metodo.cartera?.codigo || '').toLowerCase()
  return (
    moneda === 'BS' || moneda === 'VES' || moneda === 'BOLIVARES' ||
    nombre.includes('bs') || nombre.includes('bolívar') || nombre.includes('bolivar') ||
    nombre.includes('pago movil') || nombre.includes('pago móvil') ||
    nombre.includes('movil') || nombre.includes('móvil') ||
    tipo.includes('pago_movil') ||
    (tipo.includes('transferencia') && moneda === 'VES') ||
    cc.includes('bs') || cc.includes('ves')
  )
}

export function detectarMetodoUsd(metodo: MetodoPagoBase | null) {
  if (!metodo) return false
  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const cc     = (metodo.cartera?.codigo || '').toLowerCase()
  return (
    moneda === 'USD' ||
    nombre.includes('usd') || nombre.includes('zelle') ||
    nombre.includes('efectivo $') || nombre.includes('efectivo usd') ||
    cc.includes('usd')
  )
}

// ─── Cálculos internos ──────────────────────────────────────────────

const r2 = (v: number) => Math.round(v * 100) / 100

function itemToUsd(item: PagoItemState): number {
  const monto = parseFloat(item.monto) || 0
  if (item.moneda === 'USD') return r2(monto)
  if (!item.tasaBcv || item.tasaBcv <= 0) return 0
  return r2(monto / item.tasaBcv)
}

function itemToBs(item: PagoItemState): number {
  if (item.moneda !== 'BS') return 0
  return parseFloat(item.monto) || 0
}

function calcTotalUsd(state: PagoConDeudaState): number {
  if (state.tipoCobro === 'sin_pago') return 0
  if (state.modoPago === 'unico') return itemToUsd(state.pagoUnico)
  return r2(itemToUsd(state.pagoMixto1) + itemToUsd(state.pagoMixto2))
}

function calcTotalBs(state: PagoConDeudaState): number {
  if (state.tipoCobro === 'sin_pago') return 0
  if (state.modoPago === 'unico') return itemToBs(state.pagoUnico)
  return r2(itemToBs(state.pagoMixto1) + itemToBs(state.pagoMixto2))
}

// ─── Formateo ───────────────────────────────────────────────────────

function formatMoney(v: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v || 0))
}
function formatBs(v: number | null | undefined) {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES', maximumFractionDigits: 2 }).format(Number(v || 0))
}

// ─── Validación pública ─────────────────────────────────────────────

export function validarPagoConDeuda(state: PagoConDeudaState, montoTotal: number): string | null {
  if (state.tipoCobro === 'sin_pago') return null

  const totalUsd = calcTotalUsd(state)

  if (state.modoPago === 'unico') {
    const item = state.pagoUnico
    if (!item.metodoId) return 'Selecciona el método de pago.'
    if ((parseFloat(item.monto) || 0) <= 0) return 'El monto debe ser mayor a 0.'
    if (item.moneda === 'BS' && (!item.tasaBcv || item.tasaBcv <= 0))
      return 'Selecciona una tasa BCV válida para el pago en bolívares.'
  } else {
    const p1 = state.pagoMixto1
    const p2 = state.pagoMixto2
    if (!p1.metodoId) return 'Pago 1: selecciona el método.'
    if ((parseFloat(p1.monto) || 0) <= 0) return 'Pago 1: monto requerido.'
    if (p1.moneda === 'BS' && (!p1.tasaBcv || p1.tasaBcv <= 0)) return 'Pago 1: selecciona una tasa BCV válida.'
    if (!p2.metodoId) return 'Pago 2: selecciona el método.'
    if ((parseFloat(p2.monto) || 0) <= 0) return 'Pago 2: monto requerido.'
    if (p2.moneda === 'BS' && (!p2.tasaBcv || p2.tasaBcv <= 0)) return 'Pago 2: selecciona una tasa BCV válida.'
    if (state.tipoCobro === 'completo' && Math.abs(totalUsd - montoTotal) > 0.01)
      return `La suma de pagos no cuadra. Total: ${formatMoney(montoTotal)} | Registrado: ${formatMoney(totalUsd)} | Faltante: ${formatMoney(Math.max(montoTotal - totalUsd, 0))}`
  }

  if (state.tipoCobro === 'abono') {
    if (totalUsd <= 0) return 'El monto abonado debe ser mayor a 0.'
    if (totalUsd >= montoTotal - 0.01)
      return `El abono (${formatMoney(totalUsd)}) es igual o mayor al total. Usa "Pago completo".`
  }

  return null
}

// ─── Builders públicos ──────────────────────────────────────────────

export function buildCuentaPorCobrarPayload(params: {
  state: PagoConDeudaState
  montoTotal: number
  clienteId: string
  clienteNombre: string
  concepto: string
  fecha: string
  registradoPor?: string | null
}): {
  cliente_id: string
  cliente_nombre: string
  concepto: string
  tipo_origen: string
  monto_total_usd: number
  monto_pagado_usd: number
  saldo_usd: number
  fecha_venta: string
  estado: string
  notas: string | null
  registrado_por: string | null
} | null {
  const { state, montoTotal, clienteId, clienteNombre, concepto, fecha, registradoPor } = params
  if (state.tipoCobro === 'completo') return null

  const montoAbonadoUsd = state.tipoCobro === 'abono' ? calcTotalUsd(state) : 0
  const deuda = r2(montoTotal - montoAbonadoUsd)
  if (deuda <= 0.009) return null

  const notasLabel =
    state.tipoCobro === 'sin_pago'
      ? `Sin pago al momento del registro. ${state.notasDeuda || ''}`.trim()
      : `Abono parcial: ${formatMoney(montoAbonadoUsd)}. Resta: ${formatMoney(deuda)}. ${state.notasDeuda || ''}`.trim()

  return {
    cliente_id: clienteId,
    cliente_nombre: clienteNombre,
    concepto,
    tipo_origen: 'otro',
    monto_total_usd: montoTotal,
    monto_pagado_usd: montoAbonadoUsd,
    saldo_usd: deuda,
    fecha_venta: fecha,
    estado: 'pendiente',
    notas: notasLabel || null,
    registrado_por: registradoPor || null,
  }
}

export function buildPagosRpcPayload(
  state: PagoConDeudaState,
  montoTotal: number
): Array<{
  metodo_pago_v2_id: string
  moneda_pago: string
  monto: number
  tasa_bcv: number | null
  referencia: string | null
  notas: string | null
}> | null {
  if (state.tipoCobro === 'sin_pago') return null

  if (state.modoPago === 'unico') {
    const item = state.pagoUnico
    const montoNum =
      state.tipoCobro === 'completo' && item.moneda === 'USD'
        ? montoTotal
        : parseFloat(item.monto) || 0
    return [{
      metodo_pago_v2_id: item.metodoId,
      moneda_pago: item.moneda,
      monto: montoNum,
      tasa_bcv: item.moneda === 'BS' ? item.tasaBcv : null,
      referencia: item.referencia || null,
      notas: item.notas || null,
    }]
  }

  return [state.pagoMixto1, state.pagoMixto2].map((item) => ({
    metodo_pago_v2_id: item.metodoId,
    moneda_pago: item.moneda,
    monto: parseFloat(item.monto) || 0,
    tasa_bcv: item.moneda === 'BS' ? item.tasaBcv : null,
    referencia: item.referencia || null,
    notas: item.notas || null,
  }))
}

/** Tasa BCV de referencia para usar en comisiones_detalle */
export function getTasaReferenciaFromState(state: PagoConDeudaState): number | null {
  if (state.modoPago === 'unico') return state.pagoUnico.moneda === 'BS' ? state.pagoUnico.tasaBcv : null
  return state.pagoMixto1.tasaBcv || state.pagoMixto2.tasaBcv || null
}

// ─── Estilos compartidos ────────────────────────────────────────────

const inputCls = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]
`

function Field({ label, children, helper }: { label: string; children: React.ReactNode; helper?: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/75">{label}</label>
      {children}
      {helper && <p className="mt-2 text-xs text-white/45">{helper}</p>}
    </div>
  )
}

// ─── BsSelector ─────────────────────────────────────────────────────

const BsSelector = memo(function BsSelector({
  fecha, montoUsd, montoBs, onChangeTasa, onChangeMontoBs,
}: {
  fecha: string; montoUsd: number; montoBs: number | null
  onChangeTasa: (t: number | null) => void; onChangeMontoBs: (m: number) => void
}) {
  return (
    <SelectorTasaBCV
      fecha={fecha} monedaPago="BS" monedaReferencia="EUR"
      montoUSD={montoUsd} montoBs={montoBs || undefined}
      onTasaChange={onChangeTasa} onMontoBsChange={onChangeMontoBs}
    />
  )
})

// ─── PagoItemForm ────────────────────────────────────────────────────

function PagoItemForm({
  label, badge, item, metodosPago, fecha, montoUsdRef, readonlyMonto, onChange,
  colorBorder, colorBadge, colorEquiv,
}: {
  label: string; badge?: number; item: PagoItemState; metodosPago: MetodoPagoBase[]
  fecha: string; montoUsdRef: number; readonlyMonto?: boolean
  onChange: (patch: Partial<PagoItemState>) => void
  colorBorder: string; colorBadge: string; colorEquiv: string
}) {
  const isBS = item.moneda === 'BS'
  const metodosUsd = useMemo(() => metodosPago.filter(detectarMetodoUsd), [metodosPago])
  const metodosBS  = useMemo(() => metodosPago.filter(detectarMetodoBs),  [metodosPago])
  const metodosActuales = isBS ? metodosBS : metodosUsd
  const montoNum = parseFloat(item.monto) || 0

  return (
    <div className={`rounded-2xl border ${colorBorder} bg-white/[0.02] p-5`}>
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          {badge !== undefined && (
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${colorBadge}`}>
              {badge}
            </span>
          )}
          <div>
            <p className="text-sm font-medium text-white">{label}</p>
            {badge !== undefined && (
              <p className="text-xs text-white/40">{badge === 1 ? 'Método principal' : 'Método secundario'}</p>
            )}
          </div>
        </div>
        {montoNum > 0 && (
          <div className="text-right">
            <p className={`text-lg font-semibold ${colorEquiv}`}>
              {isBS ? formatBs(montoNum) : formatMoney(montoUsdRef)}
            </p>
            {isBS && montoUsdRef > 0 && <p className="text-xs text-white/40">≈ {formatMoney(montoUsdRef)}</p>}
          </div>
        )}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <Field label="Moneda">
          <select value={item.moneda}
            onChange={(e) => onChange({ moneda: e.target.value as MonedaPago, metodoId: '', monto: '', tasaBcv: null, montoBs: null })}
            className={inputCls}>
            <option value="USD" className="bg-[#11131a]">USD</option>
            <option value="BS"  className="bg-[#11131a]">Bolívares</option>
          </select>
        </Field>
        <Field label={isBS ? 'Método Bs' : 'Método USD'}>
          <select value={item.metodoId} onChange={(e) => onChange({ metodoId: e.target.value })} className={inputCls}>
            <option value="" className="bg-[#11131a]">Seleccionar</option>
            {metodosActuales.map((m) => (
              <option key={m.id} value={m.id} className="bg-[#11131a]">
                {m.nombre}{m.moneda ? ` · ${m.moneda}` : ''}{m.tipo ? ` · ${m.tipo}` : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mb-3">
        <Field label={isBS ? 'Monto Bs' : 'Monto USD'}>
          <input type="number" min={0} step="0.01" value={item.monto}
            readOnly={readonlyMonto && !isBS}
            onChange={(e) => onChange({ monto: e.target.value })}
            className={`${inputCls} ${readonlyMonto && !isBS ? 'cursor-not-allowed opacity-70' : ''}`}
            placeholder="0.00" />
        </Field>
      </div>

      {isBS && (
        <div className="mb-3">
          <BsSelector fecha={fecha} montoUsd={montoUsdRef} montoBs={montoNum || null}
            onChangeTasa={(t) => onChange({ tasaBcv: t })}
            onChangeMontoBs={(m) => onChange({ monto: String(m), montoBs: m })} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Referencia">
          <input type="text" value={item.referencia} onChange={(e) => onChange({ referencia: e.target.value })}
            className={inputCls} placeholder="Comprobante..." />
        </Field>
        <Field label="Notas">
          <input type="text" value={item.notas} onChange={(e) => onChange({ notas: e.target.value })}
            className={inputCls} placeholder="Opcional..." />
        </Field>
      </div>
    </div>
  )
}

// ─── Componente principal ────────────────────────────────────────────

export const PagoConDeudaSelector = memo(function PagoConDeudaSelector({
  montoTotal, fecha, metodosPago, value, onChange, mostrarMontoTotal = true,
}: PagoConDeudaProps) {
  const isCompleto = value.tipoCobro === 'completo'
  const isAbono    = value.tipoCobro === 'abono'
  const isSinPago  = value.tipoCobro === 'sin_pago'
  const isMixto    = value.modoPago  === 'mixto'

  const totalUsd = useMemo(() => calcTotalUsd(value), [value])
  const totalBs  = useMemo(() => calcTotalBs(value),  [value])

  const deudaGenerada = useMemo(() => {
    if (isCompleto) return 0
    if (isSinPago)  return r2(montoTotal)
    return r2(Math.max(montoTotal - totalUsd, 0))
  }, [isCompleto, isSinPago, montoTotal, totalUsd])

  const montoPagarMostrar = useMemo(() => {
    if (isSinPago)  return 0
    if (isCompleto) return montoTotal
    return totalUsd
  }, [isSinPago, isCompleto, montoTotal, totalUsd])

  // Mixto barra
  const pct1 = montoTotal > 0 ? Math.round((itemToUsd(value.pagoMixto1) / montoTotal) * 100) : 0
  const pct2 = montoTotal > 0 ? Math.round((itemToUsd(value.pagoMixto2) / montoTotal) * 100) : 0
  const faltanteMixto = r2(Math.max(montoTotal - totalUsd, 0))
  const cuadraMixto   = Math.abs(montoTotal - totalUsd) < 0.01 && montoTotal > 0

  function setTipoCobro(tipo: TipoCobro) {
    onChange({ ...value, tipoCobro: tipo,
      pagoUnico: pagoItemVacio('USD'), pagoMixto1: pagoItemVacio('USD'), pagoMixto2: pagoItemVacio('BS') })
  }

  function setModoPago(modo: ModoPago) {
    onChange({ ...value, modoPago: modo,
      pagoUnico: pagoItemVacio('USD'), pagoMixto1: pagoItemVacio('USD'), pagoMixto2: pagoItemVacio('BS') })
  }

  // Auto-set monto USD en pago único completo
  useEffect(() => {
    if (isCompleto && !isMixto && value.pagoUnico.moneda === 'USD') {
      if (value.pagoUnico.monto !== String(montoTotal)) {
        onChange({ ...value, pagoUnico: { ...value.pagoUnico, monto: String(montoTotal) } })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montoTotal, isCompleto, isMixto, value.pagoUnico.moneda])

  return (
    <div className="space-y-5">

      {/* ── 1. Tipo de cobro ── */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { key: 'completo' as TipoCobro, label: 'Pago completo', desc: 'Cancela el total ahora',
            active: isCompleto, color: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300' },
          { key: 'abono'    as TipoCobro, label: 'Abono parcial',  desc: 'Paga una parte ahora',
            active: isAbono,   color: 'border-amber-400/40 bg-amber-500/15 text-amber-300' },
          { key: 'sin_pago' as TipoCobro, label: 'Sin pago',       desc: 'Queda como deuda total',
            active: isSinPago, color: 'border-rose-400/40 bg-rose-500/15 text-rose-300' },
        ]).map((op) => (
          <button key={op.key} type="button" onClick={() => setTipoCobro(op.key)}
            className={`rounded-2xl border px-3 py-3 text-left transition ${
              op.active ? op.color : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06]'
            }`}>
            <p className="text-sm font-semibold">{op.label}</p>
            <p className="mt-0.5 text-xs opacity-70">{op.desc}</p>
          </button>
        ))}
      </div>

      {/* ── 2. Resumen montos ── */}
      {mostrarMontoTotal && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-xs text-white/45">Total servicio</p>
            <p className="mt-1 text-sm font-semibold text-white">{formatMoney(montoTotal)}</p>
          </div>
          <div className={`rounded-2xl border p-3 ${montoPagarMostrar > 0 ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-white/10 bg-white/[0.03]'}`}>
            <p className="text-xs text-white/45">Se paga ahora</p>
            <p className={`mt-1 text-sm font-semibold ${montoPagarMostrar > 0 ? 'text-emerald-300' : 'text-white/40'}`}>
              {montoPagarMostrar > 0 ? formatMoney(montoPagarMostrar) : '—'}
            </p>
          </div>
          <div className={`rounded-2xl border p-3 ${deudaGenerada > 0 ? 'border-rose-400/20 bg-rose-400/5' : 'border-white/10 bg-white/[0.03]'}`}>
            <p className="text-xs text-white/45">Queda como deuda</p>
            <p className={`mt-1 text-sm font-semibold ${deudaGenerada > 0 ? 'text-rose-300' : 'text-white/40'}`}>
              {deudaGenerada > 0 ? formatMoney(deudaGenerada) : '—'}
            </p>
          </div>
        </div>
      )}

      {/* ── 3. Formulario de pago ── */}
      {!isSinPago && (
        <div className="space-y-4">
          {/* Selector único/mixto */}
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'unico' as ModoPago, label: 'Pago único',  desc: 'Un solo método' },
              { key: 'mixto' as ModoPago, label: 'Pago mixto',  desc: 'Dos métodos' },
            ]).map((op) => (
              <button key={op.key} type="button" onClick={() => setModoPago(op.key)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  value.modoPago === op.key
                    ? 'border-violet-400/40 bg-violet-500/20 text-violet-300'
                    : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]'
                }`}>
                <p>{op.label}</p>
                <p className="mt-0.5 text-xs font-normal opacity-60">{op.desc}</p>
              </button>
            ))}
          </div>

          {/* Pago único */}
          {!isMixto && (
            <PagoItemForm
              label="Método de pago"
              item={value.pagoUnico}
              metodosPago={metodosPago}
              fecha={fecha}
              montoUsdRef={isCompleto ? montoTotal : itemToUsd(value.pagoUnico)}
              readonlyMonto={isCompleto}
              onChange={(patch) => onChange({ ...value, pagoUnico: { ...value.pagoUnico, ...patch } })}
              colorBorder="border-emerald-400/20"
              colorBadge="bg-emerald-500/15 text-emerald-300"
              colorEquiv="text-emerald-300"
            />
          )}

          {/* Pago mixto */}
          {isMixto && (
            <div className="space-y-4">
              {/* Barra progreso */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-white">{formatMoney(montoTotal)}</span>
                    <span className="text-sm text-white/45">total a cobrar</span>
                  </div>
                  {totalUsd > 0 && (
                    <span className={`text-sm font-medium ${cuadraMixto ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {cuadraMixto ? '✓ Cuadra' : `Faltan ${formatMoney(faltanteMixto)}`}
                    </span>
                  )}
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="bg-blue-500 transition-all duration-300"   style={{ width: `${Math.min(pct1, 100)}%` }} />
                  <div className="bg-violet-500 transition-all duration-300" style={{ width: `${Math.min(pct2, 100 - pct1)}%` }} />
                </div>
                {totalUsd > 0 && (
                  <div className="mt-2 flex gap-4 text-xs">
                    <span className="text-blue-400">■ Pago 1: {formatMoney(itemToUsd(value.pagoMixto1))} ({pct1}%)</span>
                    <span className="text-violet-400">■ Pago 2: {formatMoney(itemToUsd(value.pagoMixto2))} ({pct2}%)</span>
                  </div>
                )}
              </div>

              <PagoItemForm label="Pago 1" badge={1}
                item={value.pagoMixto1} metodosPago={metodosPago} fecha={fecha}
                montoUsdRef={itemToUsd(value.pagoMixto1)}
                onChange={(patch) => onChange({ ...value, pagoMixto1: { ...value.pagoMixto1, ...patch } })}
                colorBorder="border-blue-400/20" colorBadge="bg-blue-500/15 text-blue-300" colorEquiv="text-blue-300" />

              <div className="flex items-center justify-center gap-2 py-1 text-white/30">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M7 2v10M3 8l4 4 4-4"/>
                </svg>
                <span className="text-xs">+</span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M7 2v10M3 8l4 4 4-4"/>
                </svg>
              </div>

              <PagoItemForm label="Pago 2" badge={2}
                item={value.pagoMixto2} metodosPago={metodosPago} fecha={fecha}
                montoUsdRef={itemToUsd(value.pagoMixto2)}
                onChange={(patch) => onChange({ ...value, pagoMixto2: { ...value.pagoMixto2, ...patch } })}
                colorBorder="border-violet-400/20" colorBadge="bg-violet-500/15 text-violet-300" colorEquiv="text-violet-300" />

              {/* Status cuadre */}
              <div className={`rounded-2xl border p-4 ${cuadraMixto ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-amber-400/20 bg-amber-400/5'}`}>
                <p className={`text-sm font-medium ${cuadraMixto ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {cuadraMixto
                    ? '✓ La suma de pagos cuadra correctamente.'
                    : faltanteMixto > 0
                      ? `Faltan ${formatMoney(faltanteMixto)} para completar el total.`
                      : `Excedente de ${formatMoney(r2(totalUsd - montoTotal))} sobre el total.`}
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-white/50">
                  <div>Objetivo: <span className="text-white/80">{formatMoney(montoTotal)}</span></div>
                  <div>Registrado: <span className="text-white/80">{formatMoney(totalUsd)}</span></div>
                  {totalBs > 0 && <div>Bs total: <span className="text-white/80">{formatBs(totalBs)}</span></div>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4. Aviso de deuda generada ── */}
      {deudaGenerada > 0.009 && (
        <div className="space-y-3 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 shrink-0 text-rose-400" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <div>
              <p className="text-sm font-medium text-rose-300">
                Se creará una cuenta por cobrar de {formatMoney(deudaGenerada)}
              </p>
              <p className="mt-1 text-xs text-rose-300/70">
                {isSinPago
                  ? 'El cliente no pagó nada. El monto total queda pendiente en cobranzas.'
                  : `El cliente abonó ${formatMoney(montoPagarMostrar)}. El restante queda pendiente en cobranzas.`}
              </p>
            </div>
          </div>
          <Field label="Notas para la cuenta por cobrar (opcional)">
            <input type="text" value={value.notasDeuda}
              onChange={(e) => onChange({ ...value, notasDeuda: e.target.value })}
              className={inputCls} placeholder="Ej: Cliente acordó pagar el 30 de enero..." />
          </Field>
        </div>
      )}

      {/* ── 5. Resumen abono ── */}
      {isAbono && totalUsd > 0 && deudaGenerada > 0 && (
        <div className="rounded-2xl border border-amber-400/15 bg-amber-400/5 p-4">
          <p className="text-sm font-medium text-amber-300">Resumen del abono</p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-white/45">Total</p>
              <p className="font-semibold text-white">{formatMoney(montoTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-white/45">Abono ahora</p>
              <p className="font-semibold text-amber-300">{formatMoney(totalUsd)}</p>
              {totalBs > 0 && <p className="text-xs text-white/40">{formatBs(totalBs)}</p>}
            </div>
            <div>
              <p className="text-xs text-white/45">Queda pendiente</p>
              <p className="font-semibold text-rose-300">{formatMoney(deudaGenerada)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export default PagoConDeudaSelector