'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock3,
  DollarSign,
  History,
  Search,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { obtenerCuentasPorCobrar, type CuentaPorCobrar } from '@/lib/cobranzas/cuentas'

// ─── UI primitivos ────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.07] bg-[#13151c] shadow-xl transition-all duration-200 ${className}`}>
      {children}
    </div>
  )
}

type BadgeVariant = 'default' | 'danger' | 'warning' | 'success' | 'info'

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  const variants: Record<BadgeVariant, string> = {
    default:  'bg-white/[0.05] text-white/60 border-white/[0.08]',
    danger:   'bg-rose-500/10 text-rose-400 border-rose-500/20',
    warning:  'bg-amber-500/10 text-amber-400 border-amber-500/20',
    success:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    info:     'bg-sky-500/10 text-sky-400 border-sky-500/20',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${variants[variant]}`}>
      {children}
    </span>
  )
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EstadoCuentaCliente = {
  cliente_id: string
  total_pendiente_usd?: number | null
  credito_disponible_usd?: number | null
  saldo_pendiente_neto_usd?: number | null
  saldo_favor_neto_usd?: number | null
}

type ClienteAgrupado = {
  cliente_id: string
  cliente_nombre: string
  cuentas: CuentaPorCobrar[]
  total_deuda: number
  total_pagado: number
  cuentas_vencidas: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return value
  }
}

function calcularDiasVencidos(fechaVencimiento: string | null | undefined) {
  if (!fechaVencimiento) return 0
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const venc = new Date(fechaVencimiento)
  venc.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((hoy.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)))
}

function normalizeEstado(estado: string | null | undefined) {
  return String(estado || '').trim().toLowerCase()
}

function isPendienteEstado(estado: string | null | undefined) {
  const e = normalizeEstado(estado)
  return e === 'pendiente' || e === 'parcial' || e === 'vencida' || e === 'por_cobrar' || e === 'pendiente_de_pago'
}

function isEstadoCerrado(estado: string | null | undefined) {
  const e = normalizeEstado(estado)
  return e === 'cobrada' || e === 'cobrado' || e === 'pagado' || e === 'pagada' || e === 'cerrada' || e === 'cerrado'
}

function getSaldoRealUsd(cuenta: CuentaPorCobrar) {
  return Math.max(0, Number(cuenta.saldo_usd ?? 0))
}

function isPendienteCobrable(cuenta: CuentaPorCobrar) {
  if (isCanceladaEstado(cuenta.estado)) return false
  if (isEstadoCerrado(cuenta.estado)) return false
  if (!isPendienteEstado(cuenta.estado)) return false
  return getSaldoRealUsd(cuenta) > 0.01
}

function isHistorialEstado(estado: string | null | undefined) {
  const e = normalizeEstado(estado)
  return e === 'cobrada' || e === 'cobrado' || e === 'pagado' || e === 'pagada' || e === 'cancelada' || e === 'cancelado' || e === 'anulada' || e === 'anulado' || e === 'cerrada' || e === 'cerrado'
}

function isCanceladaEstado(estado: string | null | undefined) {
  const e = normalizeEstado(estado)
  return e === 'cancelada' || e === 'cancelado' || e === 'anulada' || e === 'anulado'
}

function getEstadoBadgeVariant(cuenta: CuentaPorCobrar): BadgeVariant {
  const e = normalizeEstado(cuenta.estado)
  if (e === 'cobrada' || e === 'cobrado' || e === 'pagado' || e === 'pagada') return 'success'
  if (e === 'cancelada' || e === 'cancelado' || e === 'anulada' || e === 'anulado') return 'default'
  if (e === 'vencida') return 'danger'
  if (e === 'parcial') return 'info'
  if (e === 'pendiente') return 'warning'
  return 'default'
}

function getEstadoLabel(estado: string | null | undefined) {
  const e = normalizeEstado(estado)
  if (e === 'cobrada' || e === 'cobrado') return 'Cobrada'
  if (e === 'pagado' || e === 'pagada') return 'Pagado'
  if (e === 'cancelada' || e === 'cancelado') return 'Cancelado'
  if (e === 'anulada' || e === 'anulado') return 'Anulado'
  if (e === 'vencida') return 'Vencida'
  if (e === 'parcial') return 'Parcial'
  if (e === 'pendiente' || e === 'por_cobrar' || e === 'pendiente_de_pago') return 'Pendiente'
  return estado || 'Sin estado'
}

// ─── Fila de cuenta individual ────────────────────────────────────────────────

function CuentaDetalle({ cuenta }: { cuenta: CuentaPorCobrar }) {
  const diasVencidos = calcularDiasVencidos(cuenta.fecha_vencimiento)
  const montoTotal = Number(cuenta.monto_total_usd || 0)
  const montoPagado = Number(cuenta.monto_pagado_usd || 0)
  const saldo = getSaldoRealUsd(cuenta)
  const progreso = montoTotal > 0 ? Math.min(100, Math.round((montoPagado / montoTotal) * 100)) : 0

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/10 hover:bg-white/[0.03]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white/90">{cuenta.concepto || 'Sin concepto'}</p>
            <Badge variant={getEstadoBadgeVariant(cuenta)}>{getEstadoLabel(cuenta.estado)}</Badge>
            {diasVencidos > 0 && isPendienteEstado(cuenta.estado) && (
              <Badge variant="danger">
                <Clock3 className="h-3 w-3" />
                {diasVencidos}d vencida
              </Badge>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-white/35">
            {cuenta.fecha_venta && <span>Emisión: {formatDate(cuenta.fecha_venta)}</span>}
            {cuenta.fecha_vencimiento && <span>Vence: {formatDate(cuenta.fecha_vencimiento)}</span>}
            {cuenta.tipo_origen && (
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5">
                {cuenta.tipo_origen}
              </span>
            )}
          </div>

          {montoTotal > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 flex justify-between text-[11px] text-white/35">
                <span>{formatMoney(montoPagado)} de {formatMoney(montoTotal)}</span>
                <span className="font-medium text-white/50">{progreso}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-1 rounded-full transition-all duration-500"
                  style={{
                    width: `${progreso}%`,
                    background: progreso >= 100
                      ? 'linear-gradient(to right, #10b981, #34d399)'
                      : 'linear-gradient(to right, #8b5cf6, #a78bfa)',
                  }}
                />
              </div>
            </div>
          )}

          {isPendienteCobrable(cuenta) && (
            <div className="mt-3">
              <Link
                href={`/admin/finanzas/ingresos?cliente=${cuenta.cliente_id}&tipoIngreso=saldo&destino=deuda&cuenta=${cuenta.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-300 transition hover:bg-violet-500/20"
              >
                Cobrar esta deuda
              </Link>
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className="text-lg font-bold text-white">{formatMoney(saldo)}</p>
          <p className="text-[11px] text-white/35">saldo pendiente</p>
        </div>
      </div>
    </div>
  )
}

// ─── Tarjeta de cliente agrupado ──────────────────────────────────────────────

function ClienteCard({
  grupo,
  estadoCuenta,
}: {
  grupo: ClienteAgrupado
  estadoCuenta?: EstadoCuentaCliente | null
}) {
  const [abierto, setAbierto] = useState(false)
  const creditoDisponible = Number(estadoCuenta?.credito_disponible_usd || 0)
  const porcentajeCobrado = (grupo.total_deuda + grupo.total_pagado) > 0
    ? Math.min(100, Math.round((grupo.total_pagado / (grupo.total_deuda + grupo.total_pagado)) * 100))
    : 0

  const primeraCuentaPendiente = grupo.cuentas.find((c) => isPendienteCobrable(c)) || grupo.cuentas[0] || null
  const iniciales = grupo.cliente_nombre.slice(0, 2).toUpperCase()

  return (
    <Card className={`overflow-hidden ${abierto ? 'border-white/[0.12]' : 'hover:border-white/[0.10] hover:bg-[#15171f]'}`}>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="w-full px-5 py-4 text-left"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/25 to-fuchsia-600/15 border border-violet-500/20 text-xs font-bold text-violet-300">
            {iniciales}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-white/90">{grupo.cliente_nombre}</p>
              {grupo.cuentas_vencidas > 0 && (
                <Badge variant="danger">
                  <Clock3 className="h-3 w-3" />
                  {grupo.cuentas_vencidas} vencida{grupo.cuentas_vencidas > 1 ? 's' : ''}
                </Badge>
              )}
              {creditoDisponible > 0.01 && (
                <Badge variant="success">
                  <TrendingUp className="h-3 w-3" />
                  Crédito {formatMoney(creditoDisponible)}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-white/35">
              {grupo.cuentas.length} cuenta{grupo.cuentas.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="hidden shrink-0 text-right sm:block">
            <p className="text-xl font-bold text-white">{formatMoney(grupo.total_deuda)}</p>
            <p className="text-[11px] text-white/35">deuda total</p>
          </div>

          <ChevronDown
            className={`h-4 w-4 shrink-0 text-white/30 transition-transform duration-300 ${abierto ? 'rotate-180' : ''}`}
          />
        </div>

        <div className="mt-4 sm:hidden">
          <p className="text-lg font-bold text-white">{formatMoney(grupo.total_deuda)}</p>
          <p className="text-[11px] text-white/35">deuda total</p>
        </div>

        {(grupo.total_deuda + grupo.total_pagado) > 0 && (
          <div className="mt-3 pl-14">
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-1 rounded-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-700"
                style={{ width: `${porcentajeCobrado}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-white/30">
              {formatMoney(grupo.total_pagado)} cobrado · {porcentajeCobrado}%
            </p>
          </div>
        )}
      </button>

      {abierto && (
        <div className="border-t border-white/[0.06] px-5 pb-5 pt-4">
          <div className="space-y-2.5">
            {grupo.cuentas.map((cuenta) => (
              <CuentaDetalle key={cuenta.id} cuenta={cuenta} />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.05] pt-4">
            <Link
              href={`/admin/finanzas/ingresos?cliente=${grupo.cliente_id}`}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white/90"
            >
              Nuevo ingreso
            </Link>
            <Link
              href={`/admin/finanzas/ingresos?cliente=${grupo.cliente_id}&tipoIngreso=saldo&destino=deuda&cuenta=${primeraCuentaPendiente?.id || ''}`}
              className="rounded-lg border border-violet-500/20 bg-violet-500/10 px-3.5 py-2 text-xs font-medium text-violet-300 transition hover:bg-violet-500/20"
            >
              Cobrar deuda
            </Link>
            <Link
              href={`/admin/finanzas/ingresos?cliente=${grupo.cliente_id}&tipoIngreso=saldo`}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white/90"
            >
              Agregar saldo
            </Link>
          </div>
        </div>
      )}
    </Card>
  )
}

// ─── ResumenCard ──────────────────────────────────────────────────────────────

type ResumenCardProps = {
  title: string
  value: string
  helper: string
  icon: React.ReactNode
  accent: string
}

function ResumenCard({ title, value, helper, icon, accent }: ResumenCardProps) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-white/35">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</p>
          <p className="mt-1 text-xs text-white/35">{helper}</p>
        </div>
        <div className={`shrink-0 rounded-xl border p-3 ${accent}`}>{icon}</div>
      </div>
    </Card>
  )
}

// ─── Page principal ───────────────────────────────────────────────────────────

export default function CobranzasDashboardPage() {
  const [cuentas, setCuentas] = useState<CuentaPorCobrar[]>([])
  const [estadoCuentaMap, setEstadoCuentaMap] = useState<Record<string, EstadoCuentaCliente>>({})
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [tab, setTab] = useState<'pendientes' | 'historial'>('pendientes')

  useEffect(() => { void cargarCuentas() }, [])

  async function cargarCuentas() {
    try {
      const data = await obtenerCuentasPorCobrar()
      const baseData = data || []

      // IMPORTANTE: obtenerCuentasPorCobrar() puede traer estado/saldo calculado viejo desde pagos/lotes.
      // Para cobranzas, la verdad debe salir de cuentas_por_cobrar: estado + saldo_usd.
      const cuentaIds = Array.from(new Set(baseData.map((c) => String(c.id || '').trim()).filter(Boolean)))
      let cuentasData = baseData

      if (cuentaIds.length > 0) {
        const { data: cuentasReales, error: cuentasError } = await supabase
          .from('cuentas_por_cobrar')
          .select('id, estado, monto_total_usd, monto_pagado_usd, saldo_usd, monto_total_bs, monto_pagado_bs, saldo_bs, fecha_venta, fecha_vencimiento')
          .in('id', cuentaIds)

        if (!cuentasError && cuentasReales) {
          const realesMap = new Map<string, Record<string, unknown>>()
          for (const row of cuentasReales as Array<Record<string, unknown>>) {
            realesMap.set(String(row.id), row)
          }

          cuentasData = baseData.map((cuenta) => {
            const real = realesMap.get(String(cuenta.id))
            return real ? ({ ...cuenta, ...real } as CuentaPorCobrar) : cuenta
          })
        }
      }

      setCuentas(cuentasData)

      const clienteIds = Array.from(new Set(cuentasData.map((c) => String(c.cliente_id || '').trim()).filter(Boolean)))

      if (clienteIds.length > 0) {
        const { data: estados, error } = await supabase
          .from('v_clientes_estado_cuenta')
          .select('cliente_id, total_pendiente_usd, credito_disponible_usd, saldo_pendiente_neto_usd, saldo_favor_neto_usd')
          .in('cliente_id', clienteIds)

        if (!error) {
          const nextMap: Record<string, EstadoCuentaCliente> = {}
          for (const item of estados || []) {
            const row = item as EstadoCuentaCliente
            nextMap[row.cliente_id] = row
          }
          setEstadoCuentaMap(nextMap)
        }
      }
    } catch (err) {
      console.error('Error cargando cobranzas:', err)
    } finally {
      setCargando(false)
    }
  }

  function agruparPorCliente(lista: CuentaPorCobrar[]): ClienteAgrupado[] {
    const mapa: Record<string, ClienteAgrupado> = {}

    for (const cuenta of lista) {
      const id = String(cuenta.cliente_id || 'sin_id')
      if (!mapa[id]) {
        mapa[id] = {
          cliente_id: id,
          cliente_nombre: cuenta.cliente_nombre || 'Cliente desconocido',
          cuentas: [],
          total_deuda: 0,
          total_pagado: 0,
          cuentas_vencidas: 0,
        }
      }
      mapa[id].cuentas.push(cuenta)
      mapa[id].total_deuda += isPendienteCobrable(cuenta) ? getSaldoRealUsd(cuenta) : 0
      mapa[id].total_pagado += Number(cuenta.monto_pagado_usd || 0)
      if (calcularDiasVencidos(cuenta.fecha_vencimiento) > 0 && isPendienteCobrable(cuenta)) {
        mapa[id].cuentas_vencidas++
      }
    }

    return Object.values(mapa).sort((a, b) => b.total_deuda - a.total_deuda)
  }

  // Solo cuentas activas (excluye canceladas/anuladas aunque tengan saldo)
  const cuentasPendientes = useMemo(() =>
    cuentas.filter((c) => isPendienteCobrable(c)),
    [cuentas]
  )

  // Historial: pagadas o cerradas (excluye canceladas/anuladas)
  const cuentasHistorial = useMemo(() =>
    cuentas.filter((c) => isHistorialEstado(c.estado) && !isCanceladaEstado(c.estado) && getSaldoRealUsd(c) <= 0.01),
    [cuentas]
  )

  const gruposPendientes = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const grupos = agruparPorCliente(cuentasPendientes)
    if (!q) return grupos
    return grupos.filter((g) => g.cliente_nombre.toLowerCase().includes(q))
  }, [cuentasPendientes, busqueda])

  const gruposHistorial = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const grupos = agruparPorCliente(cuentasHistorial)
    if (!q) return grupos
    return grupos.filter((g) => g.cliente_nombre.toLowerCase().includes(q))
  }, [cuentasHistorial, busqueda])

  // Totales: solo de cuentas activas (sin canceladas)
  const totalPendiente = useMemo(() =>
    cuentasPendientes.reduce((s, c) => s + getSaldoRealUsd(c), 0),
    [cuentasPendientes]
  )
  const totalCobrado = useMemo(() =>
    cuentas.filter((c) => !isCanceladaEstado(c.estado)).reduce((s, c) => s + Number(c.monto_pagado_usd || 0), 0),
    [cuentas]
  )
  const clientesConDeuda = gruposPendientes.length
  const clientesVencidos = useMemo(() => gruposPendientes.filter((g) => g.cuentas_vencidas > 0).length, [gruposPendientes])

  if (cargando) {
    return (
      <div className="min-h-screen bg-[#0d0e14]">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <div className="flex items-center justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-white/60" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d0e14]">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">

        {/* Header */}
        <div className="mb-8">
          <div className="mb-5 flex items-center gap-3">
            <Link
              href="/admin"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/50 transition hover:bg-white/[0.06] hover:text-white/80"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-1.5 text-xs text-white/30">
              <Link href="/admin" className="transition hover:text-white/60">Admin</Link>
              <span>/</span>
              <span className="text-white/60">Cobranzas</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Cobranzas</h1>
              <p className="mt-1 text-sm text-white/40">Deuda agrupada por cliente · haz clic para ver detalle</p>
            </div>
            <Link
              href="/admin/finanzas/ingresos"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-medium text-white/70 transition hover:bg-white/[0.06] hover:text-white/90"
            >
              Ir a ingresos
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ResumenCard
            title="Total pendiente"
            value={formatMoney(totalPendiente)}
            helper={`${clientesConDeuda} cliente(s) activos`}
            icon={<Wallet className="h-5 w-5" />}
            accent="border-violet-500/20 bg-violet-500/10 text-violet-400"
          />
          <ResumenCard
            title="Total cobrado"
            value={formatMoney(totalCobrado)}
            helper="Pagos registrados"
            icon={<DollarSign className="h-5 w-5" />}
            accent="border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
          />
          <ResumenCard
            title="Clientes con deuda"
            value={String(clientesConDeuda)}
            helper="Con saldo pendiente"
            icon={<Users className="h-5 w-5" />}
            accent="border-sky-500/20 bg-sky-500/10 text-sky-400"
          />
          <ResumenCard
            title="Con vencidas"
            value={String(clientesVencidos)}
            helper="Al menos 1 vencida"
            icon={<Calendar className="h-5 w-5" />}
            accent="border-rose-500/20 bg-rose-500/10 text-rose-400"
          />
        </div>

        {/* Barra de filtros */}
        <Card className="mb-4 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setTab('pendientes')}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                  tab === 'pendientes'
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/45 hover:bg-white/[0.04] hover:text-white/70'
                }`}
              >
                Pendientes
                <span className={`ml-1.5 rounded-md px-1.5 py-0.5 text-[11px] ${tab === 'pendientes' ? 'bg-violet-500/20 text-violet-300' : 'bg-white/[0.06] text-white/35'}`}>
                  {gruposPendientes.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTab('historial')}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                  tab === 'historial'
                    ? 'bg-white/[0.08] text-white'
                    : 'text-white/45 hover:bg-white/[0.04] hover:text-white/70'
                }`}
              >
                Historial
                <span className={`ml-1.5 rounded-md px-1.5 py-0.5 text-[11px] ${tab === 'historial' ? 'bg-white/[0.10] text-white/60' : 'bg-white/[0.06] text-white/35'}`}>
                  {gruposHistorial.length}
                </span>
              </button>
            </div>

            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full rounded-lg border border-white/[0.07] bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/15 focus:bg-white/[0.05]"
              />
            </div>
          </div>
        </Card>

        {/* Lista */}
        {tab === 'pendientes' && (
          <div className="space-y-2.5">
            {gruposPendientes.length === 0 ? (
              <Card className="py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white">Sin pendientes</h3>
                <p className="mt-1 text-sm text-white/40">No hay cuentas activas por cobrar.</p>
              </Card>
            ) : (
              gruposPendientes.map((grupo) => (
                <ClienteCard
                  key={grupo.cliente_id}
                  grupo={grupo}
                  estadoCuenta={estadoCuentaMap[grupo.cliente_id] || null}
                />
              ))
            )}
          </div>
        )}

        {tab === 'historial' && (
          <div className="space-y-2.5">
            {gruposHistorial.length === 0 ? (
              <Card className="py-16 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.05]">
                  <History className="h-7 w-7 text-white/40" />
                </div>
                <h3 className="text-lg font-semibold text-white">Sin historial</h3>
                <p className="mt-1 text-sm text-white/40">Aquí aparecerán cuentas ya cobradas.</p>
              </Card>
            ) : (
              gruposHistorial.map((grupo) => (
                <ClienteCard
                  key={grupo.cliente_id}
                  grupo={grupo}
                  estadoCuenta={estadoCuentaMap[grupo.cliente_id] || null}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
