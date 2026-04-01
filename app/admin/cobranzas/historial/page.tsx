'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle,
  Calendar,
  DollarSign,
  ArrowLeft,
  CreditCard,
  TrendingUp,
} from 'lucide-react'
import { obtenerHistorialAbonos } from '@/lib/cobranzas/abonos'

type AbonoHistorial = {
  id: string
  monto_usd: number
  fecha: string
  referencia?: string | null
  notas?: string | null
  metodo_pago?: {
    nombre: string
  } | null
  cuenta?: {
    cliente_nombre?: string | null
    concepto?: string | null
  } | null
}

type ResumenMes = {
  mes: string
  total: number
  cantidad: number
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
  variant?: 'default' | 'success' | 'info'
}) {
  const variants = {
    default: 'bg-white/10 text-white/80 border-white/20',
    success: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
    info: 'bg-sky-400/10 text-sky-400 border-sky-400/20',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${variants[variant]}`}
    >
      {children}
    </span>
  )
}

export default function HistorialCobrosPage() {
  const [abonos, setAbonos] = useState<AbonoHistorial[]>([])
  const [cargando, setCargando] = useState(true)
  const [resumenPorMes, setResumenPorMes] = useState<ResumenMes[]>([])

  useEffect(() => {
    void cargarHistorial()
  }, [])

  async function cargarHistorial() {
    try {
      const data = (await obtenerHistorialAbonos(100)) as AbonoHistorial[]
      setAbonos(data || [])

      const resumen = (data || []).reduce<Record<string, ResumenMes>>((acc, abono) => {
        const fecha = new Date(abono.fecha)
        const mesKey = `${fecha.getFullYear()}-${fecha.getMonth() + 1}`
        const mesNombre = fecha.toLocaleDateString('es-VE', {
          month: 'long',
          year: 'numeric',
        })

        if (!acc[mesKey]) {
          acc[mesKey] = {
            mes: mesNombre,
            total: 0,
            cantidad: 0,
          }
        }

        acc[mesKey].total += Number(abono.monto_usd || 0)
        acc[mesKey].cantidad += 1

        return acc
      }, {})

      const resumenOrdenado: ResumenMes[] = Object.values(resumen).sort((a, b) => {
        const [mesATexto, yearATexto] = a.mes.split(' de ')
        const [mesBTexto, yearBTexto] = b.mes.split(' de ')

        const meses: Record<string, number> = {
          enero: 0,
          febrero: 1,
          marzo: 2,
          abril: 3,
          mayo: 4,
          junio: 5,
          julio: 6,
          agosto: 7,
          septiembre: 8,
          octubre: 9,
          noviembre: 10,
          diciembre: 11,
        }

        const dateA = new Date(Number(yearATexto), meses[mesATexto?.toLowerCase() ?? 'enero'] ?? 0, 1)
        const dateB = new Date(Number(yearBTexto), meses[mesBTexto?.toLowerCase() ?? 'enero'] ?? 0, 1)

        return dateB.getTime() - dateA.getTime()
      })

      setResumenPorMes(resumenOrdenado)
    } catch (error) {
      console.error('Error cargando historial:', error)
    } finally {
      setCargando(false)
    }
  }

  const totalCobrado = abonos.reduce((sum, a) => sum + Number(a.monto_usd || 0), 0)

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
                Historial de Cobros
              </h1>
              <p className="mt-1 text-base text-white/55">
                {abonos.length} pago{abonos.length !== 1 ? 's' : ''} registrado
                {abonos.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>

        <Card className="mb-8 overflow-hidden">
          <div className="relative bg-gradient-to-r from-emerald-500/10 to-sky-500/10 p-6">
            <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-emerald-500/5 blur-3xl" />
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-emerald-400/10 p-3">
                  <DollarSign className="h-8 w-8 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-white/55">Total Cobrado</p>
                  <p className="mt-1 text-4xl font-bold text-white">
                    ${totalCobrado.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="flex gap-6">
                <div>
                  <p className="text-sm text-white/55">Transacciones</p>
                  <p className="text-2xl font-bold text-emerald-400">{abonos.length}</p>
                </div>
                <div>
                  <p className="text-sm text-white/55">Promedio por pago</p>
                  <p className="text-2xl font-bold text-white">
                    ${(totalCobrado / (abonos.length || 1)).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {resumenPorMes.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold text-white">
              <TrendingUp className="h-5 w-5 text-white/55" />
              Resumen Mensual
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {resumenPorMes.slice(0, 6).map((mes, index) => (
                <Card key={`${mes.mes}-${index}`} className="p-5">
                  <p className="capitalize text-sm text-white/55">{mes.mes}</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-400">
                    ${mes.total.toFixed(2)}
                  </p>
                  <p className="mt-2 text-xs text-white/45">
                    {mes.cantidad} pago{mes.cantidad !== 1 ? 's' : ''}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {abonos.length === 0 ? (
          <Card className="p-16 text-center">
            <div className="mb-5 inline-flex items-center justify-center rounded-full bg-white/5 p-4">
              <CheckCircle className="h-12 w-12 text-white/30" />
            </div>
            <h3 className="mb-2 text-2xl font-semibold text-white">
              No hay cobros registrados
            </h3>
            <p className="mx-auto max-w-md text-white/55">
              Comienza a registrar pagos para ver el historial
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {abonos.map((abono) => (
              <Card
                key={abono.id}
                className="group p-6 transition-all duration-300 hover:border-white/20 hover:bg-white/[0.05]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 rounded-2xl bg-emerald-400/10 p-2.5 transition-transform group-hover:scale-105">
                    <CheckCircle className="h-6 w-6 text-emerald-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-white group-hover:text-white/90">
                            {abono.cuenta?.cliente_nombre || 'Cliente'}
                          </h3>
                          {abono.metodo_pago && (
                            <Badge variant="info">
                              <CreditCard className="h-3 w-3" />
                              {abono.metodo_pago.nombre}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-white/55">
                          {abono.cuenta?.concepto || 'Abono registrado'}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-2xl font-bold text-emerald-400">
                          ${Number(abono.monto_usd || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-white/45">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4" />
                        {new Date(abono.fecha).toLocaleDateString('es-VE', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>

                      {abono.referencia && (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs">
                          Ref: {abono.referencia}
                        </span>
                      )}

                      {abono.notas && (
                        <span className="text-xs text-white/40">
                          📝 {abono.notas}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}