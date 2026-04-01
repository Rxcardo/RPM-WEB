'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  Calendar,
  ArrowLeft,
  Clock,
} from 'lucide-react'
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
    default: 'bg-white/10 text-white/80 border-white/20',
    danger: 'bg-rose-400/10 text-rose-400 border-rose-400/20',
    warning: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
    success: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${variants[variant]}`}
    >
      {children}
    </span>
  )
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

export default function CuentasVencidasPage() {
  const [cuentas, setCuentas] = useState<CuentaPorCobrar[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    void cargarCuentas()
  }, [])

  async function cargarCuentas() {
    try {
      const data = await obtenerCuentasPorCobrar({ estado: 'vencida' })
      setCuentas(data || [])
    } catch (error) {
      console.error('Error cargando cuentas:', error)
      setCuentas([])
    } finally {
      setCargando(false)
    }
  }

  const totalVencido = useMemo(
    () => cuentas.reduce((sum, c) => sum + Number(c.saldo_usd || 0), 0),
    [cuentas]
  )

  if (cargando) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0b0f] to-[#11131a]">
        <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
          <Card className="p-12">
            <div className="flex items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-3 border-white/20 border-t-white/80" />
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0b0f] to-[#11131a]">
      <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/cobranzas"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 transition-all hover:bg-white/[0.08]"
            >
              <ArrowLeft className="h-5 w-5 text-white/70" />
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Deudas Vencidas
              </h1>
              <p className="mt-1 text-base text-white/55">
                {cuentas.length} cuenta{cuentas.length !== 1 ? 's' : ''} vencida
                {cuentas.length !== 1 ? 's' : ''} que requieren atención
              </p>
            </div>
          </div>
        </div>

        <Card className="mb-8 overflow-hidden">
          <div className="relative bg-gradient-to-r from-rose-500/10 to-amber-500/10 p-6">
            <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-rose-500/5 blur-3xl" />
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-rose-400/10 p-3">
                  <AlertCircle className="h-8 w-8 text-rose-400" />
                </div>
                <div>
                  <p className="text-sm text-white/55">Total Vencido</p>
                  <p className="mt-1 text-4xl font-bold text-white">
                    ${totalVencido.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div>
                  <p className="text-sm text-white/55">Cuentas vencidas</p>
                  <p className="text-2xl font-bold text-rose-400">{cuentas.length}</p>
                </div>
                <div>
                  <p className="text-sm text-white/55">Promedio por cuenta</p>
                  <p className="text-2xl font-bold text-white">
                    ${(totalVencido / (cuentas.length || 1)).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {cuentas.length === 0 ? (
          <Card className="p-16 text-center">
            <div className="mb-5 inline-flex items-center justify-center rounded-full bg-emerald-400/10 p-4">
              <AlertCircle className="h-12 w-12 text-emerald-400" />
            </div>
            <h3 className="mb-2 text-2xl font-semibold text-white">
              ¡No hay deudas vencidas!
            </h3>
            <p className="mx-auto max-w-md text-white/55">
              Todas las cuentas están al día. Sigue así 👏
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {cuentas.map((cuenta) => {
              const diasVencidos = calcularDiasVencidos(cuenta.fecha_vencimiento)
              const porcentajeVencido =
                Number(cuenta.monto_total_usd || 0) > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (Number(cuenta.saldo_usd || 0) / Number(cuenta.monto_total_usd || 0)) * 100
                      )
                    )
                  : 0

              return (
                <Link
                  key={cuenta.id}
                  href={`/admin/cobranzas/${cuenta.id}`}
                  className="block"
                >
                  <Card className="group border-rose-400/20 p-6 transition-all duration-300 hover:border-rose-400/30 hover:bg-white/[0.05]">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                      <div className="flex-shrink-0 rounded-2xl bg-rose-400/10 p-3 transition-all group-hover:scale-105">
                        <AlertCircle className="h-6 w-6 text-rose-400" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-semibold text-white transition-colors group-hover:text-white/90">
                                {cuenta.cliente_nombre}
                              </h3>
                              <Badge variant="danger">
                                <Clock className="h-3 w-3" />
                                {diasVencidos} días vencido
                              </Badge>
                            </div>
                            <p className="text-sm text-white/55">{cuenta.concepto}</p>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="text-2xl font-bold text-rose-400">
                              ${Number(cuenta.saldo_usd || 0).toFixed(2)}
                            </p>
                            <p className="text-xs text-white/45">
                              de ${Number(cuenta.monto_total_usd || 0).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="mb-2 flex items-center justify-between text-xs text-white/55">
                            <span>Monto pendiente: ${Number(cuenta.saldo_usd || 0).toFixed(2)}</span>
                            <span>{porcentajeVencido}% del total</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-2 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-500"
                              style={{ width: `${porcentajeVencido}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-white/45">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4" />
                            Vencimiento:{' '}
                            {cuenta.fecha_vencimiento
                              ? new Date(cuenta.fecha_vencimiento).toLocaleDateString('es-VE', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </span>
                          <span className="flex items-center gap-1.5 text-rose-400">
                            <Clock className="h-4 w-4" />
                            Vencida hace {diasVencidos} día{diasVencidos !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}