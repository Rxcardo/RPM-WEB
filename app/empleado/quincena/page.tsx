'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, ChevronDown, RefreshCcw, WalletCards } from 'lucide-react'

// ─────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────
type PeriodoKey = 'actual' | 'anterior'
type Moneda = 'USD' | 'BS'
type EstadoFiltro = 'todos' | 'pendiente' | 'pagado'
type MonedaFiltro = 'todas' | Moneda

type ApiData = {
  empleado?: { id: string; nombre: string | null; rol: string | null }
  periodo?: { key: PeriodoKey; start: string; end: string; label: string }
  resumen?: {
    total_facturado_usd: number | null
    total_pagado_usd: number | null
    total_pendiente_usd: number | null
    credito_disponible_usd: number | null
    saldo_favor_neto_usd: number | null
    saldo_pendiente_neto_usd: number | null
  }
  fuente?: string
  pagos?: any[]
  detalle?: any[]
  debug?: Record<string, any>
}

// Tipo rico de ComisionDetalle proveniente del sistema RPM
type ComisionDetalle = {
  id: string
  tipo: string | null
  estado: string | null
  fecha: string | null
  moneda: string | null
  tasa_bcv: number | null
  monto_base_usd: number | null
  monto_base_bs: number | null
  monto_rpm_usd: number | null
  monto_rpm_bs: number | null
  monto_profesional_usd: number | null
  monto_profesional_bs: number | null
  monto_profesional_neto_usd: number | null
  monto_profesional_neto_bs: number | null
  descuento_deuda_usd: number | null
  descuento_deuda_bs: number | null
  liquidacion_id: string | null
  pago_empleado_id: string | null
  pagado: boolean | null
  fecha_pago: string | null
  // campos enriquecidos
  cliente_nombre: string | null
  pago_cliente_nombre: string | null
  servicio_nombre: string | null
  cita_fecha: string | null
  cita_hora_inicio: string | null
  concepto: string | null
  descripcion: string | null
  // campo genérico "profesional" (fallback)
  profesional?: number | null
  base?: number | null
  rpm?: number | null
}

type ComisionVista = {
  id: string
  raw: any
  tipo: string
  estado: string
  estadoNormalizado: string
  pagado: boolean
  moneda: Moneda
  fecha: string
  cliente: string
  servicio: string
  concepto: string
  subtitulo: string
  baseUsd: number
  baseBs: number
  rpmUsd: number
  rpmBs: number
  profesionalUsd: number
  profesionalBs: number
  descuentoUsd: number
  descuentoBs: number
  netoUsd: number
  netoBs: number
}

// ─────────────────────────────────────────────
// UTILIDADES NUMÉRICAS
// ─────────────────────────────────────────────
function r2(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function num(value: any) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function money(n: number | string | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(n || 0))
}

function bs(n: number | string | null | undefined) {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0))
}

function monto(n: number | string | null | undefined, moneda: Moneda) {
  return moneda === 'USD' ? money(n) : bs(n)
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

// ─────────────────────────────────────────────
// UTILIDADES DE ESTADO (lógica RPM)
// ─────────────────────────────────────────────
function normalizarEstado(value: any) {
  return String(value || '').trim().toLowerCase()
}

function isPendienteEstado(value: any) {
  return normalizarEstado(value) === 'pendiente'
}

function isFacturadaEstado(value: any) {
  return ['liquidado', 'liquidada', 'pagado', 'pagada', 'cobrada'].includes(normalizarEstado(value))
}

function esPendiente(row: any) {
  const estado = normalizarEstado(row?.estado || row?.status || '')
  const pagado = row?.pagado ?? row?.paid
  if (pagado === true) return false
  if (isFacturadaEstado(estado)) return false
  return pagado === false || isPendienteEstado(estado) || estado === 'parcial' || estado === 'vencida'
}

function esPagado(row: any) {
  if (row?.pagado === true || row?.paid === true) return true
  return isFacturadaEstado(row?.estado || row?.status)
}

// ─────────────────────────────────────────────
// UTILIDADES DE CONCEPTO (lógica RPM)
// ─────────────────────────────────────────────
function formatDate(v: string | null | undefined) {
  if (!v || v === '—') return '—'
  try {
    return new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return String(v)
  }
}

/** Concepto principal — idéntico a getComisionConcepto del sistema RPM */
function getComisionConcepto(row: any): string {
  const concepto = String(row?.concepto || row?.descripcion || '').trim()
  if (concepto) return concepto

  const tipo = String(row?.tipo || '').toLowerCase()
  const servicio = String(row?.servicio_nombre || '').trim()
  const cliente = String(row?.cliente_nombre || row?.pago_cliente_nombre || '').trim()

  if (tipo === 'plan') {
    if (servicio && cliente) return `Plan · ${servicio} · ${cliente}`
    if (servicio) return `Plan · ${servicio}`
    if (cliente) return `Plan · ${cliente}`
    return 'Comisión por plan'
  }
  if (tipo === 'cita') {
    if (servicio && cliente) return `Cita · ${servicio} · ${cliente}`
    if (servicio) return `Cita · ${servicio}`
    if (cliente) return `Cita · ${cliente}`
    return 'Comisión por cita'
  }
  if (servicio && cliente) return `${servicio} · ${cliente}`
  if (servicio) return servicio
  if (cliente) return `Comisión · ${cliente}`
  const fecha = row?.cita_fecha || row?.fecha
  return `Comisión · ${formatDate(fecha)}`
}

/** Subtítulo enriquecido — idéntico a getComisionSubtitulo del sistema RPM */
function getComisionSubtitulo(row: any): string {
  const partes: string[] = []
  const cliente = String(row?.cliente_nombre || row?.pago_cliente_nombre || '').trim()
  if (cliente && cliente !== 'Cliente desconocido') partes.push(cliente)

  const fecha = row?.cita_fecha || row?.fecha
  if (fecha) partes.push(formatDate(fecha))

  const hora = String(row?.cita_hora_inicio || '').slice(0, 5)
  if (hora) partes.push(hora)

  const servicio = String(row?.servicio_nombre || '').trim()
  if (servicio) partes.push(servicio)

  return partes.length ? partes.join(' · ') : String(row?.concepto || 'Comisión registrada')
}

// ─────────────────────────────────────────────
// UTILIDADES DE MONTO (lógica RPM)
// ─────────────────────────────────────────────
function getComisionBrutoByMoneda(row: any, moneda: Moneda): number {
  return moneda === 'USD'
    ? num(row?.monto_profesional_usd ?? row?.profesional_usd ?? row?.profesional ?? 0)
    : num(row?.monto_profesional_bs ?? row?.profesional_bs ?? 0)
}

function getComisionDescuentoByMoneda(row: any, moneda: Moneda): number {
  return moneda === 'USD'
    ? num(row?.descuento_deuda_usd ?? row?.monto_descuento_usd ?? 0)
    : num(row?.descuento_deuda_bs ?? row?.monto_descuento_bs ?? 0)
}

/**
 * Monto neto por moneda — prioriza el neto persistido en BD,
 * si no existe calcula bruto - descuento. Idéntico a getComisionMontoByMoneda del sistema RPM.
 */
function getComisionNetoByMoneda(row: any, moneda: Moneda): number {
  const netoPersistido =
    moneda === 'USD'
      ? Number(row?.monto_profesional_neto_usd ?? NaN)
      : Number(row?.monto_profesional_neto_bs ?? NaN)

  if (Number.isFinite(netoPersistido)) return r2(Math.max(netoPersistido, 0))

  const bruto = getComisionBrutoByMoneda(row, moneda)
  const descuento = getComisionDescuentoByMoneda(row, moneda)
  return r2(Math.max(bruto - descuento, 0))
}

function inferirMoneda(row: any): Moneda {
  const raw = String(row?.moneda || row?.moneda_pago || row?.currency || '').toUpperCase()
  if (raw === 'BS' || raw === 'VES' || raw === 'VEF') return 'BS'
  if (raw === 'USD' || raw === '$') return 'USD'
  // heurística: si tiene bs y no usd
  const bsAmt = num(row?.monto_profesional_bs ?? row?.profesional_bs ?? row?.monto_bs ?? 0)
  const usdAmt = num(row?.monto_profesional_usd ?? row?.profesional_usd ?? row?.monto_usd ?? 0)
  if (bsAmt > 0 && usdAmt <= 0) return 'BS'
  return 'USD'
}

// ─────────────────────────────────────────────
// NORMALIZACIÓN PRINCIPAL
// ─────────────────────────────────────────────
function normalizarComision(row: any, index: number): ComisionVista {
  const moneda = inferirMoneda(row)
  const estadoRaw = String(row?.estado || row?.status || (esPagado(row) ? 'pagado' : 'pendiente'))
  const estadoNormalizado = normalizarEstado(estadoRaw)
  const pagado = esPagado(row)

  const profesionalUsd = getComisionBrutoByMoneda(row, 'USD')
  const profesionalBs = getComisionBrutoByMoneda(row, 'BS')
  const descuentoUsd = getComisionDescuentoByMoneda(row, 'USD')
  const descuentoBs = getComisionDescuentoByMoneda(row, 'BS')
  const netoUsd = getComisionNetoByMoneda(row, 'USD')
  const netoBs = getComisionNetoByMoneda(row, 'BS')

  return {
    id: String(row?.id || row?.comision_id || row?.pago_id || `row-${index}`),
    raw: row,
    tipo: String(row?.tipo || 'comisión'),
    estado: estadoRaw,
    estadoNormalizado,
    pagado,
    moneda,
    fecha: String(row?.cita_fecha || row?.fecha || row?.fecha_pago || row?.created_at || '').slice(0, 10) || '—',
    cliente: String(row?.cliente_nombre || row?.pago_cliente_nombre || row?.paciente_nombre || 'Cliente / paciente'),
    servicio: String(row?.servicio_nombre || row?.servicio || ''),
    concepto: getComisionConcepto(row),
    subtitulo: getComisionSubtitulo(row),
    baseUsd: num(row?.monto_base_usd ?? row?.base_usd ?? (moneda === 'USD' ? (row?.base ?? 0) : 0)),
    baseBs: num(row?.monto_base_bs ?? row?.base_bs ?? (moneda === 'BS' ? (row?.base ?? 0) : 0)),
    rpmUsd: num(row?.monto_rpm_usd ?? row?.rpm_usd ?? (moneda === 'USD' ? (row?.rpm ?? 0) : 0)),
    rpmBs: num(row?.monto_rpm_bs ?? row?.rpm_bs ?? (moneda === 'BS' ? (row?.rpm ?? 0) : 0)),
    profesionalUsd: r2(profesionalUsd),
    profesionalBs: r2(profesionalBs),
    descuentoUsd: r2(descuentoUsd),
    descuentoBs: r2(descuentoBs),
    netoUsd,
    netoBs,
  }
}

// ─────────────────────────────────────────────
// BADGES
// ─────────────────────────────────────────────
function estadoBadgeClass(c: ComisionVista) {
  if (c.pagado) return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
  if (c.estadoNormalizado === 'pendiente') return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
  return 'border-white/10 bg-white/10 text-white/60'
}

function tipoBadgeClass(tipo: string) {
  const t = tipo.toLowerCase()
  if (t === 'plan') return 'bg-violet-500/10 text-violet-300'
  if (t === 'cita') return 'bg-sky-500/10 text-sky-300'
  return 'bg-white/10 text-white/60'
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────
export default function EmpleadoQuincenaPage() {
  const [periodo, setPeriodo] = useState<PeriodoKey>('actual')
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showDebug, setShowDebug] = useState(false)
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos')
  const [monedaFiltro, setMonedaFiltro] = useState<MonedaFiltro>('todas')

  async function load(nextPeriodo = periodo) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/empleado/quincena?periodo=${nextPeriodo}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'No se pudo cargar la quincena.')
      setData(json)
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar la quincena.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(periodo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo])

  const resumen = data?.resumen || null

  // ── Normalización de comisiones ──────────────
  const comisiones = useMemo(() => {
    const detalle = Array.isArray(data?.detalle) ? data!.detalle! : []
    const pagos = Array.isArray(data?.pagos) ? data!.pagos! : []
    const rows = [...detalle, ...pagos]
    const map = new Map<string, ComisionVista>()
    rows.forEach((row, index) => {
      const item = normalizarComision(row, index)
      if (!map.has(item.id)) map.set(item.id, item)
    })
    // orden: pendientes primero, luego por fecha desc
    return [...map.values()].sort((a, b) => {
      if (a.pagado !== b.pagado) return a.pagado ? 1 : -1
      return String(b.fecha).localeCompare(String(a.fecha))
    })
  }, [data])

  const pendientes = useMemo(() => comisiones.filter((c) => !c.pagado && esPendiente(c.raw)), [comisiones])
  const liquidadas = useMemo(() => comisiones.filter((c) => c.pagado), [comisiones])

  // ── Resumen financiero ───────────────────────
  const resumenComisiones = useMemo(() => {
    const sum = (items: ComisionVista[], key: keyof ComisionVista) =>
      r2(items.reduce((acc, item) => acc + num(item[key] as any), 0))
    return {
      pendienteBaseUsd: sum(pendientes, 'baseUsd'),
      pendienteBaseBs: sum(pendientes, 'baseBs'),
      pendienteRpmUsd: sum(pendientes, 'rpmUsd'),
      pendienteRpmBs: sum(pendientes, 'rpmBs'),
      // profesional disponible usa netoUsd/netoBs (ya descuenta deuda aplicada)
      pendienteProfesionalUsd: sum(pendientes, 'netoUsd'),
      pendienteProfesionalBs: sum(pendientes, 'netoBs'),
      pagadoProfesionalUsd: sum(liquidadas, 'netoUsd'),
      pagadoProfesionalBs: sum(liquidadas, 'netoBs'),
      deduccionesUsd: sum(comisiones, 'descuentoUsd'),
      deduccionesBs: sum(comisiones, 'descuentoBs'),
    }
  }, [comisiones, pendientes, liquidadas])

  const deudaEmpleadoUsd = r2(num(resumen?.saldo_pendiente_neto_usd || resumen?.total_pendiente_usd))
  const creditoUsd = r2(num(resumen?.credito_disponible_usd))
  const saldoFavorUsd = r2(num(resumen?.saldo_favor_neto_usd))

  // ── Filtros ──────────────────────────────────
  const comisionesFiltradas = useMemo(() => {
    return comisiones.filter((c) => {
      if (estadoFiltro === 'pendiente' && c.pagado) return false
      if (estadoFiltro === 'pagado' && !c.pagado) return false
      if (monedaFiltro !== 'todas' && c.moneda !== monedaFiltro) return false
      return true
    })
  }, [comisiones, estadoFiltro, monedaFiltro])

  const pendientePrincipal =
    resumenComisiones.pendienteProfesionalUsd > 0
      ? resumenComisiones.pendienteProfesionalUsd
      : resumenComisiones.pendienteProfesionalBs
  const pendientePrincipalMoneda: Moneda =
    resumenComisiones.pendienteProfesionalUsd > 0 ? 'USD' : 'BS'

  // ─────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-3 pb-5 sm:space-y-4 lg:max-w-[980px] xl:max-w-[1080px]">

      {/* ── Header ── */}
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="rpm-muted truncate text-[11px] font-black uppercase tracking-[0.18em]">
            {data?.empleado?.nombre || 'Empleado'}
          </p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight sm:text-3xl lg:text-[2rem]">
            Mi quincena
          </h1>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="flex shrink-0 items-center gap-2 rounded-2xl border border-[var(--line)] bg-white/10 px-3 py-2 text-xs font-black text-[var(--text)] transition hover:bg-white/20 disabled:opacity-50"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Actualizar
        </button>
      </header>

      {/* ── Hero card + selector periodo ── */}
      <section className="grid gap-2 lg:grid-cols-[1fr_310px]">
        <div className="purple-card rounded-[1.35rem] p-3.5 text-white sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <WalletCards className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
                  Profesional pendiente
                </p>
                <h2 className="mt-0.5 text-2xl font-black leading-none sm:text-3xl">
                  {monto(pendientePrincipal, pendientePrincipalMoneda)}
                </h2>
                <p className="mt-1 text-[11px] font-semibold text-white/65">
                  USD {money(resumenComisiones.pendienteProfesionalUsd)} · Bs{' '}
                  {bs(resumenComisiones.pendienteProfesionalBs)}
                </p>
              </div>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-black text-white/80">{data?.periodo?.label || 'Quincena'}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/55">
                {data?.periodo?.start || '—'} / {data?.periodo?.end || '—'}
              </p>
            </div>
          </div>
        </div>

        <label className="glass-card flex items-center gap-2 rounded-[1.15rem] px-3 py-2.5">
          <CalendarRange className="h-4 w-4 text-[var(--muted)]" />
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as PeriodoKey)}
            className="w-full bg-transparent text-sm font-black outline-none"
          >
            <option value="actual">Quincena actual</option>
            <option value="anterior">Quincena pasada</option>
          </select>
        </label>
      </section>

      {/* ── Error ── */}
      {error ? (
        <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {/* ── Stats fila 1: base / pagado / pendiente / deducciones / conteo ── */}
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <div className="glass-card rounded-[1.15rem] p-3">
          <p className="rpm-muted text-[10px] font-black uppercase tracking-wide">Base pendiente</p>
          <p className="mt-1 text-lg font-black">{money(resumenComisiones.pendienteBaseUsd)}</p>
          <p className="rpm-muted mt-0.5 text-[10px] font-semibold">{bs(resumenComisiones.pendienteBaseBs)}</p>
        </div>
        <div className="glass-card rounded-[1.15rem] p-3">
          <p className="rpm-muted text-[10px] font-black uppercase tracking-wide">Pagado</p>
          <p className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-300">
            {money(resumenComisiones.pagadoProfesionalUsd)}
          </p>
          <p className="rpm-muted mt-0.5 text-[10px] font-semibold">
            {bs(resumenComisiones.pagadoProfesionalBs)}
          </p>
        </div>
        <div className="glass-card rounded-[1.15rem] p-3">
          <p className="rpm-muted text-[10px] font-black uppercase tracking-wide">Pendiente</p>
          <p className="mt-1 text-lg font-black text-rose-600 dark:text-rose-300">
            {money(resumenComisiones.pendienteProfesionalUsd)}
          </p>
          <p className="rpm-muted mt-0.5 text-[10px] font-semibold">
            {bs(resumenComisiones.pendienteProfesionalBs)}
          </p>
        </div>
        <div className="glass-card rounded-[1.15rem] p-3">
          <p className="rpm-muted text-[10px] font-black uppercase tracking-wide">Deducciones</p>
          <p className="mt-1 text-lg font-black text-amber-500 dark:text-amber-300">
            {money(resumenComisiones.deduccionesUsd)}
          </p>
          <p className="rpm-muted mt-0.5 text-[10px] font-semibold">{bs(resumenComisiones.deduccionesBs)}</p>
        </div>
        <div className="glass-card rounded-[1.15rem] p-3 col-span-2 lg:col-span-1">
          <p className="rpm-muted text-[10px] font-black uppercase tracking-wide">Registros</p>
          <p className="mt-1 text-lg font-black">{pendientes.length}</p>
          <p className="rpm-muted mt-0.5 text-[10px] font-semibold">
            pendiente(s) · {liquidadas.length} liquidada(s)
          </p>
        </div>
      </section>

      {/* ── Stats fila 2: profesional / RPM / deuda / crédito ── */}
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="glass-card rounded-[1.15rem] p-3">
          <p className="rpm-muted text-[10px] font-black uppercase tracking-wide">Profesional pendiente</p>
          <p className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-300">
            {money(resumenComisiones.pendienteProfesionalUsd)}
          </p>
          <p className="rpm-muted mt-0.5 text-[10px] font-semibold">
            {bs(resumenComisiones.pendienteProfesionalBs)}
          </p>
        </div>
        <div className="glass-card rounded-[1.15rem] p-3">
          <p className="rpm-muted text-[10px] font-black uppercase tracking-wide">RPM pendiente</p>
          <p className="mt-1 text-lg font-black">{money(resumenComisiones.pendienteRpmUsd)}</p>
          <p className="rpm-muted mt-0.5 text-[10px] font-semibold">{bs(resumenComisiones.pendienteRpmBs)}</p>
        </div>
        <div className="glass-card rounded-[1.15rem] p-3">
          <p className="rpm-muted text-[10px] font-black uppercase tracking-wide">Deuda empleado</p>
          <p className="mt-1 text-lg font-black text-rose-600 dark:text-rose-300">{money(deudaEmpleadoUsd)}</p>
        </div>
        <div className="glass-card rounded-[1.15rem] p-3">
          <p className="rpm-muted text-[10px] font-black uppercase tracking-wide">Crédito / a favor</p>
          <p className="mt-1 text-lg font-black">{money(creditoUsd)}</p>
          <p className="rpm-muted mt-0.5 text-[10px] font-semibold">A favor {money(saldoFavorUsd)}</p>
        </div>
      </section>

      {/* ── Tabla de comisiones ── */}
      <section className="glass-card overflow-hidden rounded-[1.25rem]">
        <div className="flex flex-col gap-2 border-b border-[var(--line)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setShowDebug((v) => !v)}
            className="flex min-w-0 items-center justify-between gap-3 text-left"
          >
            <div>
              <h2 className="text-sm font-black">Comisiones detectadas</h2>
              <p className="rpm-muted mt-0.5 text-[11px] font-semibold">
                {comisionesFiltradas.length} de {comisiones.length} registro(s). Neto calculado
                con lógica RPM: persistido → bruto − descuento deuda.
              </p>
            </div>
            <ChevronDown
              className={cx('h-4 w-4 shrink-0 transition sm:hidden', showDebug && 'rotate-180')}
            />
          </button>

          <div className="flex gap-2">
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)}
              className="rounded-xl border border-[var(--line)] bg-white/10 px-3 py-2 text-xs font-black outline-none"
            >
              <option value="todos">Todos</option>
              <option value="pendiente">Pendientes</option>
              <option value="pagado">Pagadas</option>
            </select>
            <select
              value={monedaFiltro}
              onChange={(e) => setMonedaFiltro(e.target.value as MonedaFiltro)}
              className="rounded-xl border border-[var(--line)] bg-white/10 px-3 py-2 text-xs font-black outline-none"
            >
              <option value="todas">Todas</option>
              <option value="USD">USD</option>
              <option value="BS">Bs</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="p-4 text-sm font-semibold rpm-muted">Cargando quincena...</p>
        ) : comisionesFiltradas.length === 0 ? (
          <div className="p-4">
            <p className="text-sm font-black">No hay comisiones con estos filtros.</p>
            <p className="rpm-muted mt-1 text-xs">
              La API debe enviar registros desde comisiones_detalle o pagos_empleados_detalle.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {comisionesFiltradas.map((item) => {
              const mainAmount = item.moneda === 'USD' ? item.netoUsd : item.netoBs
              const profTxt = item.moneda === 'USD' ? money(item.netoUsd) : bs(item.netoBs)
              const baseTxt = item.moneda === 'USD' ? money(item.baseUsd) : bs(item.baseBs)
              const rpmTxt = item.moneda === 'USD' ? money(item.rpmUsd) : bs(item.rpmBs)
              return (
                <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-3">
                  <div className="min-w-0">
                    {/* Badges */}
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span
                        className={cx(
                          'rounded-full px-2 py-0.5 text-[10px] font-black uppercase',
                          tipoBadgeClass(item.tipo)
                        )}
                      >
                        {item.tipo}
                      </span>
                      <span
                        className={cx(
                          'rounded-full border px-2 py-0.5 text-[10px] font-black uppercase',
                          estadoBadgeClass(item)
                        )}
                      >
                        {item.pagado ? 'Pagado' : item.estado || 'Pendiente'}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase text-white/70">
                        {item.moneda === 'USD' ? 'USD' : 'Bs'}
                      </span>
                    </div>

                    {/* Concepto (getComisionConcepto) */}
                    <p className="truncate text-sm font-black">{item.concepto}</p>

                    {/* Subtítulo (getComisionSubtitulo) */}
                    <p className="rpm-muted mt-0.5 text-[11px] font-semibold">{item.subtitulo}</p>

                    {/* Descuento deuda */}
                    {(item.descuentoUsd > 0 || item.descuentoBs > 0) ? (
                      <p className="mt-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-300">
                        Deuda desc.{' '}
                        {item.moneda === 'USD' ? money(item.descuentoUsd) : bs(item.descuentoBs)}
                      </p>
                    ) : null}
                  </div>

                  {/* Montos */}
                  <div className="shrink-0 text-right">
                    <p
                      className={cx(
                        'text-lg font-black tabular-nums',
                        item.pagado
                          ? 'text-emerald-600 dark:text-emerald-300'
                          : 'text-amber-500 dark:text-amber-300'
                      )}
                    >
                      {monto(mainAmount, item.moneda)}
                    </p>
                    <div className="mt-1 flex justify-end gap-3 text-[10px] font-bold text-[var(--muted)]">
                      <span>Base {baseTxt}</span>
                      <span>RPM {rpmTxt}</span>
                      <span>Prof. {profTxt}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Debug ── */}
      {showDebug ? (
        <section className="glass-card rounded-[1.25rem] p-3">
          <h3 className="text-sm font-black">Diagnóstico rápido</h3>
          <p className="rpm-muted mt-1 text-xs font-semibold">
            Úsalo solo para revisar nombres de columnas cuando algo no cuadre.
          </p>
          <pre className="mt-2 max-h-[220px] overflow-auto rounded-2xl border border-[var(--line)] bg-black/10 p-3 text-[11px] rpm-muted">
            {JSON.stringify(
              { debug: data?.debug || {}, primer_registro: comisiones[0]?.raw || null },
              null,
              2
            )}
          </pre>
        </section>
      ) : null}
    </div>
  )
}