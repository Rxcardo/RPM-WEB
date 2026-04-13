'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock3,
  DollarSign,
  History,
  Search,
  Wallet,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { obtenerCuentasPorCobrar, type CuentaPorCobrar } from '@/lib/cobranzas/cuentas'

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  )
}

function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode
  variant?: 'default' | 'danger' | 'warning' | 'success'
}) {
  const variants = {
    default: 'bg-white/[0.04] text-white/75 border-white/10',
    danger: 'bg-white/[0.04] text-rose-300 border-rose-400/20',
    warning: 'bg-white/[0.04] text-amber-300 border-amber-400/20',
    success: 'bg-white/[0.04] text-emerald-300 border-emerald-400/20',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${variants[variant]}`}
    >
      {children}
    </span>
  )
}

type EstadoCuentaCliente = {
  cliente_id: string
  total_pendiente_usd?: number | null
  total_pendiente_bs?: number | null
  credito_disponible_usd?: number | null
  saldo_pendiente_neto_usd?: number | null
  saldo_favor_neto_usd?: number | null
  credito_disponible_bs?: number | null
  saldo_pendiente_neto_bs?: number | null
  saldo_favor_neto_bs?: number | null
}

function formatMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'

  try {
    return new Date(value).toLocaleDateString('es-VE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
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

  const diff = hoy.getTime() - venc.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

function normalizeEstado(estado: string | null | undefined) {
  return String(estado || '')
    .trim()
    .toLowerCase()
}

function isPendienteEstado(estado: string | null | undefined) {
  const e = normalizeEstado(estado)
  return (
    e === 'pendiente' ||
    e === 'parcial' ||
    e === 'vencida' ||
    e === 'por_cobrar' ||
    e === 'pendiente_de_pago'
  )
}

function isHistorialEstado(estado: string | null | undefined) {
  const e = normalizeEstado(estado)
  return (
    e === 'pagado' ||
    e === 'cancelada' ||
    e === 'cancelado' ||
    e === 'anulada' ||
    e === 'anulado' ||
    e === 'cerrada' ||
    e === 'cerrado'
  )
}

function getEstadoBadgeVariant(cuenta: CuentaPorCobrar): 'default' | 'danger' | 'warning' | 'success' {
  const estado = normalizeEstado(cuenta.estado)

  if (estado === 'pagado' || estado === 'cancelada' || estado === 'cancelado') return 'success'
  if (estado === 'vencida') return 'danger'
  if (estado === 'parcial' || estado === 'pendiente') return 'warning'
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

function ResumenCard({
  title,
  value,
  helper,
  icon,
  tone = 'default',
}: {
  title: string
  value: string
  helper: string
  icon: React.ReactNode
  tone?: 'default' | 'warning' | 'success'
}) {
  const tones = {
    default: 'from-white/[0.05] to-white/[0.02]',
    warning: 'from-white/[0.05] to-white/[0.02]',
    success: 'from-white/[0.05] to-white/[0.02]',
  }

  return (
    <Card className="overflow-hidden p-5">
      <div className={`rounded-2xl bg-gradient-to-r ${tones[tone]} p-4`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/55">{title}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white">{value}</p>
            <p className="mt-1 text-xs text-white/40">{helper}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-white/75">
            {icon}
          </div>
        </div>
      </div>
    </Card>
  )
}

function CuentaRow({
  cuenta,
  estadoCuenta,
}: {
  cuenta: CuentaPorCobrar
  estadoCuenta?: EstadoCuentaCliente | null
}) {
  const diasVencidos = calcularDiasVencidos(cuenta.fecha_vencimiento)
  const montoTotal = Number(cuenta.monto_total_usd || 0)
  const montoPagado = Number(cuenta.monto_pagado_usd || 0)
  const saldo = Number(cuenta.saldo_usd || 0)
  const progreso = montoTotal > 0 ? Math.min(100, Math.round((montoPagado / montoTotal) * 100)) : 0
  const creditoDisponible = Number(estadoCuenta?.credito_disponible_usd || 0)

  return (
    <Card className="group p-5 hover:bg-white/[0.05] hover:border-white/15">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-lg font-semibold text-white">{cuenta.cliente_nombre}</h3>
                <Badge variant={getEstadoBadgeVariant(cuenta)}>{getEstadoLabel(cuenta.estado)}</Badge>
                {diasVencidos > 0 && isPendienteEstado(cuenta.estado) && (
                  <Badge variant="danger">
                    <Clock3 className="h-3 w-3" />
                    {diasVencidos} día{diasVencidos !== 1 ? 's' : ''} vencido
                  </Badge>
                )}
              </div>

              <p className="mt-1 text-sm text-white/50">{cuenta.concepto || 'Sin concepto'}</p>
            </div>

            <div className="text-right">
              <p className="text-2xl font-bold text-white">{formatMoney(saldo)}</p>
              <p className="text-xs text-white/45">Deuda de esta cuenta</p>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-white/55 sm:grid-cols-3">
            <div>
              <p className="text-xs text-white/35">Monto total</p>
              <p className="mt-1 text-white">{formatMoney(montoTotal)}</p>
            </div>
            <div>
              <p className="text-xs text-white/35">Pagado</p>
              <p className="mt-1 text-white">{formatMoney(montoPagado)}</p>
            </div>
            <div>
              <p className="text-xs text-white/35">Saldo de esta cuenta</p>
              <p className="mt-1 text-white">{formatMoney(saldo)}</p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-white/45">
              <span>Progreso de cobro</span>
              <span>{progreso}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-white/45">
            {cuenta.tipo_origen ? (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                {cuenta.tipo_origen}
              </span>
            ) : null}
            {cuenta.notas ? (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                Con notas
              </span>
            ) : null}
            {creditoDisponible > 0.01 ? (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                Este cliente tiene crédito disponible: {formatMoney(creditoDisponible)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 xl:w-[220px]">
          <Link
            href={`/admin/finanzas/ingresos?cliente=${cuenta.cliente_id}`}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm font-medium text-white/85 transition hover:bg-white/[0.06]"
          >
            Cobrar en ingresos
          </Link>

          <Link
            href={`/admin/finanzas/ingresos?cliente=${cuenta.cliente_id}&tipoIngreso=saldo`}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm font-medium text-white/85 transition hover:bg-white/[0.06]"
          >
            Agregar saldo
          </Link>
        </div>
      </div>
    </Card>
  )
}

export default function CobranzasDashboardPage() {
  const [cuentas, setCuentas] = useState<CuentaPorCobrar[]>([])
  const [estadoCuentaMap, setEstadoCuentaMap] = useState<Record<string, EstadoCuentaCliente>>({})
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [tab, setTab] = useState<'pendientes' | 'historial'>('pendientes')

  useEffect(() => {
    void cargarCuentas()
  }, [])

  async function cargarCuentas() {
    try {
      const data = await obtenerCuentasPorCobrar()
      const cuentasData = data || []
      setCuentas(cuentasData)

      const clienteIds = Array.from(
        new Set(
          cuentasData
            .map((cuenta) => String(cuenta.cliente_id || '').trim())
            .filter(Boolean)
        )
      )

      if (clienteIds.length > 0) {
        const { data: estados, error } = await supabase
          .from('v_clientes_estado_cuenta')
          .select(`
            cliente_id,
            total_pendiente_usd,
            total_pendiente_bs,
            credito_disponible_usd,
            saldo_pendiente_neto_usd,
            saldo_favor_neto_usd,
            credito_disponible_bs,
            saldo_pendiente_neto_bs,
            saldo_favor_neto_bs
          `)
          .in('cliente_id', clienteIds)

        if (error) {
          console.error('Error cargando estado de cuenta en cobranzas:', error)
          setEstadoCuentaMap({})
        } else {
          const nextMap: Record<string, EstadoCuentaCliente> = {}
          for (const item of estados || []) {
            const row = item as EstadoCuentaCliente
            nextMap[row.cliente_id] = row
          }
          setEstadoCuentaMap(nextMap)
        }
      } else {
        setEstadoCuentaMap({})
      }
    } catch (error) {
      console.error('Error cargando cobranzas:', error)
      setCuentas([])
      setEstadoCuentaMap({})
    } finally {
      setCargando(false)
    }
  }

  const cuentasPendientes = useMemo(() => {
    return cuentas
      .filter((c) => isPendienteEstado(c.estado) || Number(c.saldo_usd || 0) > 0)
      .sort((a, b) => {
        const av = new Date(a.fecha_vencimiento || a.fecha_venta || a.created_at || 0).getTime()
        const bv = new Date(b.fecha_vencimiento || b.fecha_venta || b.created_at || 0).getTime()
        return av - bv
      })
  }, [cuentas])

  const cuentasHistorial = useMemo(() => {
    return cuentas
      .filter((c) => isHistorialEstado(c.estado) || Number(c.saldo_usd || 0) <= 0)
      .sort((a, b) => {
        const av = new Date(a.created_at || a.fecha_venta || 0).getTime()
        const bv = new Date(b.created_at || b.fecha_venta || 0).getTime()
        return bv - av
      })
  }, [cuentas])

  const pendientesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return cuentasPendientes

    return cuentasPendientes.filter((c) => {
      return (
        String(c.cliente_nombre || '').toLowerCase().includes(q) ||
        String(c.concepto || '').toLowerCase().includes(q) ||
        String(c.estado || '').toLowerCase().includes(q)
      )
    })
  }, [busqueda, cuentasPendientes])

  const historialFiltrado = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return cuentasHistorial

    return cuentasHistorial.filter((c) => {
      return (
        String(c.cliente_nombre || '').toLowerCase().includes(q) ||
        String(c.concepto || '').toLowerCase().includes(q) ||
        String(c.estado || '').toLowerCase().includes(q)
      )
    })
  }, [busqueda, cuentasHistorial])

  const totalPendiente = useMemo(
    () => cuentasPendientes.reduce((sum, c) => sum + Number(c.saldo_usd || 0), 0),
    [cuentasPendientes]
  )

  const totalHistorico = useMemo(
    () => cuentasHistorial.reduce((sum, c) => sum + Number(c.monto_pagado_usd || c.monto_total_usd || 0), 0),
    [cuentasHistorial]
  )

  const totalCobrado = useMemo(
    () => cuentas.reduce((sum, c) => sum + Number(c.monto_pagado_usd || 0), 0),
    [cuentas]
  )

  const cuentasVigentes = useMemo(
    () => cuentasPendientes.filter((c) => calcularDiasVencidos(c.fecha_vencimiento) === 0).length,
    [cuentasPendientes]
  )

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
              <Link
                href="/admin"
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 transition-all hover:bg-white/[0.08]"
              >
                <ArrowLeft className="h-5 w-5 text-white/70" />
              </Link>

              <div className="flex flex-wrap items-center gap-2 text-sm text-white/35">
                <Link href="/admin" className="transition hover:text-white/70">
                  Admin
                </Link>
                <span>/</span>
                <span className="text-white/70">Cobranzas</span>
              </div>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-white">Cobranzas</h1>
            <p className="mt-2 text-base text-white/55">
              Aquí se muestra solo la deuda de cada cuenta. El saldo neto general del cliente se trabaja en ingresos.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/admin/finanzas/ingresos"
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]"
            >
              Ir a ingresos
            </Link>
            <button
              type="button"
              onClick={() => setTab('pendientes')}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]"
            >
              Ver cuentas pendientes aquí
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-4">
          <ResumenCard
            title="Total pendiente"
            value={formatMoney(totalPendiente)}
            helper={`${cuentasPendientes.length} cuenta(s) por cobrar`}
            icon={<Wallet className="h-6 w-6" />}
            tone="warning"
          />
          <ResumenCard
            title="Total cobrado"
            value={formatMoney(totalCobrado)}
            helper="Suma de pagos registrados"
            icon={<DollarSign className="h-6 w-6" />}
            tone="success"
          />
          <ResumenCard
            title="En historial"
            value={String(cuentasHistorial.length)}
            helper={formatMoney(totalHistorico)}
            icon={<History className="h-6 w-6" />}
          />
          <ResumenCard
            title="Pendientes vigentes"
            value={String(cuentasVigentes)}
            helper="Aún no vencen"
            icon={<Calendar className="h-6 w-6" />}
          />
        </div>

        <Card className="mb-6 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTab('pendientes')}
                className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                  tab === 'pendientes'
                    ? 'border-white/20 bg-white/[0.08] text-white'
                    : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]'
                }`}
              >
                Cuentas pendientes ({pendientesFiltradas.length})
              </button>

              <button
                type="button"
                onClick={() => setTab('historial')}
                className={`rounded-2xl border px-4 py-2 text-sm font-medium transition ${
                  tab === 'historial'
                    ? 'border-white/20 bg-white/[0.08] text-white'
                    : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.06]'
                }`}
              >
                Cuentas cerradas ({historialFiltrado.length})
              </button>
            </div>

            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={`Buscar en ${tab}...`}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05]"
              />
            </div>
          </div>
        </Card>

        {tab === 'pendientes' && (
          <div className="space-y-4">
            {pendientesFiltradas.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-full bg-emerald-400/10 p-4">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-semibold text-white">No hay pendientes</h3>
                <p className="mt-2 text-white/55">
                  No tienes cuentas por cobrar pendientes en este momento.
                </p>
              </Card>
            ) : (
              pendientesFiltradas.map((cuenta) => (
                <CuentaRow
                  key={cuenta.id}
                  cuenta={cuenta}
                  estadoCuenta={estadoCuentaMap[String(cuenta.cliente_id || '')] || null}
                />
              ))
            )}
          </div>
        )}

        {tab === 'historial' && (
          <div className="space-y-4">
            {historialFiltrado.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="mx-auto mb-4 inline-flex items-center justify-center rounded-full bg-white/10 p-4">
                  <History className="h-10 w-10 text-white/70" />
                </div>
                <h3 className="text-2xl font-semibold text-white">Sin historial todavía</h3>
                <p className="mt-2 text-white/55">
                  Aquí aparecerán las cuentas ya cerradas, pagadas o anuladas.
                </p>
              </Card>
            ) : (
              historialFiltrado.map((cuenta) => (
                <CuentaRow
                  key={cuenta.id}
                  cuenta={cuenta}
                  estadoCuenta={estadoCuentaMap[String(cuenta.cliente_id || '')] || null}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
