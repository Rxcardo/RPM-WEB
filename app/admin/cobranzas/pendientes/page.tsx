'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Clock3,
  Plus,
  Search,
  Wallet,
  CheckCircle2,
  FileText,
  ArrowRight,
  User2,
} from 'lucide-react'

type CuentaPendiente = {
  id: string
  cliente_id: string | null
  cliente_nombre: string
  concepto: string
  tipo_origen: string
  monto_total_usd: number
  monto_pagado_usd: number
  saldo_usd: number
  fecha_venta: string
  fecha_vencimiento: string | null
  estado: string
  notas: string | null
  created_at?: string | null
  clientes?: {
    id: string
    nombre: string
  } | null
}

type CuentaPendienteRaw = {
  id: string
  cliente_id: string | null
  cliente_nombre: string
  concepto: string
  tipo_origen: string
  monto_total_usd: number | string | null
  monto_pagado_usd: number | string | null
  saldo_usd: number | string | null
  fecha_venta: string
  fecha_vencimiento: string | null
  estado: string
  notas: string | null
  created_at?: string | null
  clientes?: { id: string; nombre: string }[] | { id: string; nombre: string } | null
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function money(value: number | string | null | undefined, currency: 'USD' | 'VES' = 'USD') {
  const num = Number(value || 0)

  if (currency === 'VES') {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'VES',
      maximumFractionDigits: 2,
    }).format(num)
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(num)
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

function diasParaVencer(fechaVencimiento: string | null) {
  if (!fechaVencimiento) return null

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const venc = new Date(fechaVencimiento)
  venc.setHours(0, 0, 0, 0)

  const diff = venc.getTime() - hoy.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function nombreClienteCuenta(cuenta: CuentaPendiente) {
  return cuenta.clientes?.nombre || cuenta.cliente_nombre || 'Cliente sin nombre'
}

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl',
        className
      )}
    >
      {children}
    </div>
  )
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
        {description ? <p className="mt-1 text-sm text-white/55">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

function StatCard({
  title,
  value,
  subtitle,
  tone = 'default',
  icon: Icon,
}: {
  title: string
  value: string | number
  subtitle?: string
  tone?: 'default' | 'sky' | 'amber' | 'rose' | 'emerald'
  icon: React.ComponentType<{ className?: string }>
}) {
  const toneMap = {
    default: 'text-white',
    sky: 'text-sky-400',
    amber: 'text-amber-400',
    rose: 'text-rose-400',
    emerald: 'text-emerald-400',
  }

  return (
    <Card className="p-5 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.05]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-sm font-medium uppercase tracking-wider text-white/50">
          {title}
        </p>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5">
          <Icon className="h-5 w-5 text-white/65" />
        </div>
      </div>

      <p className={cn('text-3xl font-bold tracking-tight', toneMap[tone])}>{value}</p>

      {subtitle ? <p className="mt-2 text-xs text-white/45">{subtitle}</p> : null}
    </Card>
  )
}

function StatusBadge({
  estado,
  dias,
}: {
  estado: string
  dias: number | null
}) {
  const base =
    'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium'

  if (dias !== null && dias < 0) {
    return (
      <span className={cn(base, 'border-rose-400/20 bg-rose-400/10 text-rose-300')}>
        Vencida
      </span>
    )
  }

  if (dias !== null && dias >= 0 && dias <= 7) {
    return (
      <span className={cn(base, 'border-amber-400/20 bg-amber-400/10 text-amber-300')}>
        Próxima a vencer
      </span>
    )
  }

  if ((estado || '').toLowerCase() === 'parcial') {
    return (
      <span className={cn(base, 'border-sky-400/20 bg-sky-400/10 text-sky-300')}>
        Parcial
      </span>
    )
  }

  if ((estado || '').toLowerCase() === 'pagada') {
    return (
      <span className={cn(base, 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300')}>
        Pagada
      </span>
    )
  }

  return (
    <span className={cn(base, 'border-white/10 bg-white/[0.05] text-white/75')}>
      Pendiente
    </span>
  )
}

export default function CuentasPendientesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [cuentas, setCuentas] = useState<CuentaPendiente[]>([])

  useEffect(() => {
    void cargarCuentas()
  }, [])

  async function cargarCuentas() {
    try {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('cuentas_por_cobrar')
        .select(`
          id,
          cliente_id,
          cliente_nombre,
          concepto,
          tipo_origen,
          monto_total_usd,
          monto_pagado_usd,
          saldo_usd,
          fecha_venta,
          fecha_vencimiento,
          estado,
          notas,
          created_at,
          clientes (
            id,
            nombre
          )
        `)
        .in('estado', ['pendiente', 'parcial'])
        .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })

      if (error) throw error

      const cuentasNormalizadas: CuentaPendiente[] = ((data || []) as CuentaPendienteRaw[]).map(
        (item) => ({
          id: item.id,
          cliente_id: item.cliente_id,
          cliente_nombre: item.cliente_nombre,
          concepto: item.concepto,
          tipo_origen: item.tipo_origen,
          monto_total_usd: Number(item.monto_total_usd || 0),
          monto_pagado_usd: Number(item.monto_pagado_usd || 0),
          saldo_usd: Number(item.saldo_usd || 0),
          fecha_venta: item.fecha_venta,
          fecha_vencimiento: item.fecha_vencimiento,
          estado: item.estado,
          notas: item.notas,
          created_at: item.created_at ?? null,
          clientes: Array.isArray(item.clientes) ? item.clientes[0] ?? null : item.clientes ?? null,
        })
      )

      setCuentas(cuentasNormalizadas)
    } catch (err: any) {
      console.error('Error cargando cuentas pendientes:', err)
      setError(err?.message || 'No se pudieron cargar las cuentas pendientes.')
      setCuentas([])
    } finally {
      setLoading(false)
    }
  }

  const cuentasFiltradas = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return cuentas

    return cuentas.filter((cuenta) => {
      const texto = [
        nombreClienteCuenta(cuenta),
        cuenta.cliente_nombre,
        cuenta.concepto,
        cuenta.tipo_origen,
        cuenta.estado,
        cuenta.notas,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return texto.includes(q)
    })
  }, [cuentas, query])

  const resumen = useMemo(() => {
    let totalPendiente = 0
    let vencidas = 0
    let montoVencido = 0
    let porVencer = 0

    for (const cuenta of cuentasFiltradas) {
      const saldo = Number(cuenta.saldo_usd || 0)
      totalPendiente += saldo

      const dias = diasParaVencer(cuenta.fecha_vencimiento)

      if (dias !== null && dias < 0) {
        vencidas += 1
        montoVencido += saldo
      }

      if (dias !== null && dias >= 0 && dias <= 7) {
        porVencer += 1
      }
    }

    return {
      cantidad: cuentasFiltradas.length,
      totalPendiente,
      vencidas,
      montoVencido,
      porVencer,
    }
  }, [cuentasFiltradas])

  return (
    <div className="w-full">
      <div className="space-y-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex items-start gap-3">
            <Link
              href="/admin/cobranzas"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"
            >
              <ArrowLeft className="h-5 w-5 text-white/75" />
            </Link>

            <div>
              <p className="text-sm font-medium tracking-wide text-white/55">
                Finanzas / Cobranzas
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">
                Cuentas pendientes
              </h1>
              <p className="mt-2 text-sm text-white/55">
                Seguimiento visual de cuentas por cobrar activas y parciales.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/cobranzas/nuevo"
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
            >
              <Plus className="h-4 w-4" />
              Nueva cuenta
            </Link>

            <Link
              href="/admin/cobranzas"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
            >
              Volver al resumen
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {error ? (
          <Card className="border-rose-400/25 bg-rose-400/5 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-400" />
              <div>
                <p className="font-semibold text-rose-300">Error al cargar</p>
                <p className="mt-1 text-sm text-rose-200/70">{error}</p>
              </div>
            </div>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Cuentas activas"
            value={resumen.cantidad}
            subtitle="Pendientes o parciales"
            icon={FileText}
          />
          <StatCard
            title="Total pendiente"
            value={money(resumen.totalPendiente)}
            subtitle="Saldo por cobrar"
            tone="sky"
            icon={Wallet}
          />
          <StatCard
            title="Vencidas"
            value={resumen.vencidas}
            subtitle={resumen.vencidas > 0 ? 'Requieren acción' : 'Todo al día'}
            tone={resumen.vencidas > 0 ? 'rose' : 'default'}
            icon={AlertCircle}
          />
          <StatCard
            title="Próximas a vencer"
            value={resumen.porVencer}
            subtitle="En los próximos 7 días"
            tone={resumen.porVencer > 0 ? 'amber' : 'default'}
            icon={Clock3}
          />
        </div>

        <Card className="p-5">
          <SectionHeader
            title="Listado de cuentas"
            description="Busca por cliente, concepto, tipo o notas."
            action={
              <div className="w-full sm:w-auto">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar cuenta..."
                    className="
                      w-full rounded-2xl border border-white/10 bg-white/[0.03]
                      py-3 pl-11 pr-4 text-sm text-white outline-none transition
                      placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]
                      sm:w-[280px]
                    "
                  />
                </div>
              </div>
            }
          />

          {loading ? (
            <div className="py-16">
              <div className="flex items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
              </div>
            </div>
          ) : cuentasFiltradas.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                <CheckCircle2 className="h-7 w-7 text-white/30" />
              </div>
              <p className="text-sm text-white/55">
                {query
                  ? 'No se encontraron cuentas con esa búsqueda.'
                  : 'No hay cuentas pendientes registradas.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {cuentasFiltradas.map((cuenta) => {
                const dias = diasParaVencer(cuenta.fecha_vencimiento)
                const vencida = dias !== null && dias < 0
                const cercana = dias !== null && dias >= 0 && dias <= 7
                const nombreCliente = nombreClienteCuenta(cuenta)

                return (
                  <Link
                    key={cuenta.id}
                    href={`/admin/cobranzas/${cuenta.id}`}
                    className="block"
                  >
                    <Card
                      className={cn(
                        'p-5 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.05]',
                        vencida && 'border-rose-400/20',
                        !vencida && cercana && 'border-amber-400/20'
                      )}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={cn(
                            'rounded-2xl border p-3',
                            vencida && 'border-rose-400/20 bg-rose-400/10',
                            !vencida && cercana && 'border-amber-400/20 bg-amber-400/10',
                            !vencida && !cercana && 'border-white/10 bg-white/[0.04]'
                          )}
                        >
                          {vencida ? (
                            <AlertCircle className="h-5 w-5 text-rose-400" />
                          ) : cercana ? (
                            <Clock3 className="h-5 w-5 text-amber-400" />
                          ) : (
                            <Wallet className="h-5 w-5 text-white/65" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <div className="inline-flex min-w-0 items-center gap-2">
                                  <User2 className="h-4 w-4 text-white/45" />
                                  <p className="truncate text-lg font-semibold text-white">
                                    {nombreCliente}
                                  </p>
                                </div>
                                <StatusBadge estado={cuenta.estado} dias={dias} />
                              </div>

                              <p className="text-sm text-white/55">{cuenta.concepto}</p>

                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/45">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  Venta: {formatDate(cuenta.fecha_venta)}
                                </span>

                                {cuenta.tipo_origen ? (
                                  <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                                    {cuenta.tipo_origen}
                                  </span>
                                ) : null}

                                {dias !== null ? (
                                  <span
                                    className={cn(
                                      'inline-flex items-center rounded-full border px-2.5 py-1 font-medium',
                                      vencida &&
                                        'border-rose-400/20 bg-rose-400/10 text-rose-300',
                                      !vencida &&
                                        cercana &&
                                        'border-amber-400/20 bg-amber-400/10 text-amber-300',
                                      !vencida &&
                                        !cercana &&
                                        'border-white/10 bg-white/[0.03] text-white/55'
                                    )}
                                  >
                                    {vencida
                                      ? `Vencida hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`
                                      : `Vence en ${dias} día${dias !== 1 ? 's' : ''}`}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="text-left lg:text-right">
                              <p className="text-2xl font-bold text-white">
                                {money(cuenta.saldo_usd)}
                              </p>
                              <p className="mt-1 text-xs text-white/45">
                                de {money(cuenta.monto_total_usd)}
                              </p>
                              <p className="mt-1 text-xs text-emerald-400/85">
                                abonado {money(cuenta.monto_pagado_usd)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}