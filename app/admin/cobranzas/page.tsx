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
  User,
  Wallet,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { obtenerCuentasPorCobrar, type CuentaPorCobrar } from '@/lib/cobranzas/cuentas'

// ─── UI primitivos ────────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl transition-all duration-200 ${className}`}>
      {children}
    </div>
  )
}

function Badge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'danger' | 'warning' | 'success' }) {
  const variants = {
    default: 'bg-white/[0.04] text-white/75 border-white/10',
    danger: 'bg-white/[0.04] text-rose-300 border-rose-400/20',
    warning: 'bg-white/[0.04] text-amber-300 border-amber-400/20',
    success: 'bg-white/[0.04] text-emerald-300 border-emerald-400/20',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${variants[variant]}`}>
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

function isHistorialEstado(estado: string | null | undefined) {
  const e = normalizeEstado(estado)
  return e === 'pagado' || e === 'cancelada' || e === 'cancelado' || e === 'anulada' || e === 'anulado' || e === 'cerrada' || e === 'cerrado'
}

function getEstadoBadgeVariant(cuenta: CuentaPorCobrar): 'default' | 'danger' | 'warning' | 'success' {
  const e = normalizeEstado(cuenta.estado)
  if (e === 'pagado' || e === 'cancelada' || e === 'cancelado') return 'success'
  if (e === 'vencida') return 'danger'
  if (e === 'parcial' || e === 'pendiente') return 'warning'
  return 'default'
}

function getEstadoLabel(estado: string | null | undefined) {
  const e = normalizeEstado(estado)
  if (e === 'pagado') return 'Pagado'
  if (e === 'cancelada' || e === 'cancelado') return 'Cancelado'
  if (e === 'anulada' || e === 'anulado') return 'Anulado'
  if (e === 'vencida') return 'Vencida'
  if (e === 'parcial') return 'Parcial'
  if (e === 'pendiente' || e === 'por_cobrar' || e === 'pendiente_de_pago') return 'Pendiente'
  return estado || 'Sin estado'
}

// ─── Fila de cuenta individual (dentro del acordeón) ─────────────────────────

function CuentaDetalle({ cuenta }: { cuenta: CuentaPorCobrar }) {
  const diasVencidos = calcularDiasVencidos(cuenta.fecha_vencimiento)
  const montoTotal = Number(cuenta.monto_total_usd || 0)
  const montoPagado = Number(cuenta.monto_pagado_usd || 0)
  const saldo = Number(cuenta.saldo_usd || 0)
  const progreso = montoTotal > 0 ? Math.min(100, Math.round((montoPagado / montoTotal) * 100)) : 0

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-white">{cuenta.concepto || 'Sin concepto'}</p>
            <Badge variant={getEstadoBadgeVariant(cuenta)}>{getEstadoLabel(cuenta.estado)}</Badge>
            {diasVencidos > 0 && isPendienteEstado(cuenta.estado) && (
              <Badge variant="danger">
                <Clock3 className="h-3 w-3" />
                {diasVencidos}d vencida
              </Badge>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-4 text-xs text-white/40">
            {cuenta.fecha_venta && <span>Emisión: {formatDate(cuenta.fecha_venta)}</span>}
            {cuenta.fecha_vencimiento && <span>Vence: {formatDate(cuenta.fecha_vencimiento)}</span>}
            {cuenta.tipo_origen && <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5">{cuenta.tipo_origen}</span>}
          </div>

          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[11px] text-white/35">
              <span>Cobrado {formatMoney(montoPagado)} de {formatMoney(montoTotal)}</span>
              <span>{progreso}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/admin/finanzas/ingresos?cliente=${cuenta.cliente_id}&tipoIngreso=saldo&destino=deuda&cuenta=${cuenta.id}`}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]"
            >
              Cobrar esta deuda
            </Link>
          </div>
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
  const progreso = (grupo.total_deuda + grupo.total_pagado) > 0
    ? Math.min(100, Math.round((grupo.total_pagado / (grupo.total_deuda + grupo.total_pagado)) * 100))
    : 0

  const primeraCuentaPendiente = grupo.cuentas.find((c) => Number(c.saldo_usd || 0) > 0) || grupo.cuentas[0] || null

  return (
    <Card className={`overflow-hidden transition-all duration-300 ${abierto ? 'border-white/15' : 'hover:border-white/15 hover:bg-white/[0.04]'}`}>
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="w-full px-5 py-4 text-left"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 border border-violet-400/20 text-sm font-bold text-violet-200">
            {grupo.cliente_nombre.slice(0, 2).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-white">{grupo.cliente_nombre}</p>
              {grupo.cuentas_vencidas > 0 && (
                <Badge variant="danger">
                  <Clock3 className="h-3 w-3" />
                  {grupo.cuentas_vencidas} vencida{grupo.cuentas_vencidas > 1 ? 's' : ''}
                </Badge>
              )}
              {creditoDisponible > 0.01 && (
                <Badge variant="success">Crédito: {formatMoney(creditoDisponible)}</Badge>
              )}
            </div>
            <p className="mt-0.5 text-xs text-white/40">
              {grupo.cuentas.length} cuenta{grupo.cuentas.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-xl font-bold text-white">{formatMoney(grupo.total_deuda)}</p>
            <p className="text-[11px] text-white/35">deuda total</p>
          </div>

          <ChevronDown
            className={`h-5 w-5 shrink-0 text-white/40 transition-transform duration-300 ${abierto ? 'rotate-180' : ''}`}
          />
        </div>

        {(grupo.total_deuda + grupo.total_pagado) > 0 && (
          <div className="mt-3 pl-14">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${progreso}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-white/30">
              {formatMoney(grupo.total_pagado)} cobrado · {progreso}%
            </p>
          </div>
        )}
      </button>

      {abierto && (
        <div className="border-t border-white/8 px-5 pb-5 pt-4">
          <div className="space-y-3">
            {grupo.cuentas.map((cuenta) => (
              <CuentaDetalle key={cuenta.id} cuenta={cuenta} />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/admin/finanzas/ingresos?cliente=${grupo.cliente_id}`}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]"
            >
              Nuevo ingreso
            </Link>

            <Link
              href={`/admin/finanzas/ingresos?cliente=${grupo.cliente_id}&tipoIngreso=saldo&destino=deuda&cuenta=${primeraCuentaPendiente?.id || ''}`}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]"
            >
              Cobrar deuda
            </Link>

            <Link
              href={`/admin/finanzas/ingresos?cliente=${grupo.cliente_id}&tipoIngreso=saldo`}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]"
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

function ResumenCard({ title, value, helper, icon }: { title: string; value: string; helper: string; icon: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-white/55">{title}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">{value}</p>
          <p className="mt-1 text-xs text-white/40">{helper}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-white/75">{icon}</div>
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
      const cuentasData = data || []
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
      mapa[id].total_deuda += Number(cuenta.saldo_usd || 0)
      mapa[id].total_pagado += Number(cuenta.monto_pagado_usd || 0)
      if (calcularDiasVencidos(cuenta.fecha_vencimiento) > 0 && isPendienteEstado(cuenta.estado)) {
        mapa[id].cuentas_vencidas++
      }
    }

    return Object.values(mapa).sort((a, b) => b.total_deuda - a.total_deuda)
  }

  const cuentasPendientes = useMemo(() =>
    cuentas.filter((c) => isPendienteEstado(c.estado) || Number(c.saldo_usd || 0) > 0),
    [cuentas]
  )

  const cuentasHistorial = useMemo(() =>
    cuentas.filter((c) => isHistorialEstado(c.estado) && Number(c.saldo_usd || 0) <= 0),
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

  const totalPendiente = useMemo(() => cuentasPendientes.reduce((s, c) => s + Number(c.saldo_usd || 0), 0), [cuentasPendientes])
  const totalCobrado = useMemo(() => cuentas.reduce((s, c) => s + Number(c.monto_pagado_usd || 0), 0), [cuentas])
  const clientesConDeuda = gruposPendientes.length
  const clientesVencidos = useMemo(() => gruposPendientes.filter((g) => g.cuentas_vencidas > 0).length, [gruposPendientes])

  if (cargando) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0b0f] to-[#11131a]">
        <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
          <Card className="p-12">
            <div className="flex items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white/80" />
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0b0f] via-[#0d1017] to-[#11131a]">
      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <Link href="/admin" className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 transition-all hover:bg-white/[0.08]">
                <ArrowLeft className="h-5 w-5 text-white/70" />
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-sm text-white/35">
                <Link href="/admin" className="transition hover:text-white/70">Admin</Link>
                <span>/</span>
                <span className="text-white/70">Cobranzas</span>
              </div>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Cobranzas</h1>
            <p className="mt-2 text-base text-white/55">Deuda agrupada por cliente. Haz click en un cliente para ver sus cuentas.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link href="/admin/finanzas/ingresos" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]">
              Ir a ingresos
            </Link>
          </div>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-4">
          <ResumenCard title="Total pendiente" value={formatMoney(totalPendiente)} helper={`${clientesConDeuda} cliente(s) con deuda`} icon={<Wallet className="h-6 w-6" />} />
          <ResumenCard title="Total cobrado" value={formatMoney(totalCobrado)} helper="Suma de pagos registrados" icon={<DollarSign className="h-6 w-6" />} />
          <ResumenCard title="Clientes con deuda" value={String(clientesConDeuda)} helper="Tienen saldo pendiente" icon={<User className="h-6 w-6" />} />
          <ResumenCard title="Con vencidas" value={String(clientesVencidos)} helper="Al menos 1 cuenta vencida" icon={<Calendar className="h-6 w-6" />} />
        </div>

        <Card className="mb-6 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTab('pendientes')}
                className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${tab === 'pendientes' ? 'border-white/20 bg-white/[0.08] text-white' : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]'}`}
              >
                Pendientes ({gruposPendientes.length} clientes)
              </button>
              <button
                type="button"
                onClick={() => setTab('historial')}
                className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${tab === 'historial' ? 'border-white/20 bg-white/[0.08] text-white' : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]'}`}
              >
                Historial ({gruposHistorial.length} clientes)
              </button>
            </div>

            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05]"
              />
            </div>
          </div>
        </Card>

        {tab === 'pendientes' && (
          <div className="space-y-3">
            {gruposPendientes.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-full bg-emerald-400/10 p-4">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-semibold text-white">No hay pendientes</h3>
                <p className="mt-2 text-white/55">No tienes cuentas por cobrar pendientes.</p>
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
          <div className="space-y-3">
            {gruposHistorial.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-full bg-white/10 p-4">
                  <History className="h-10 w-10 text-white/70" />
                </div>
                <h3 className="text-2xl font-semibold text-white">Sin historial todavía</h3>
                <p className="mt-2 text-white/55">Aquí aparecerán clientes con cuentas ya cerradas.</p>
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