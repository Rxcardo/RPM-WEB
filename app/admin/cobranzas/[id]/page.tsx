'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  AlertCircle,
  Plus,
  CheckCircle2,
  CreditCard,
  X,
  Calendar,
  Wallet,
  Receipt,
  Ban,
} from 'lucide-react'
import {
  obtenerCuentaPorId,
  cancelarCuenta,
  type CuentaPorCobrar,
} from '@/lib/cobranzas/cuentas'
import {
  obtenerAbonosCuenta,
  registrarAbono,
  type Abono,
} from '@/lib/cobranzas/abonos'
import { supabase } from '@/lib/supabase/client'
import SelectorTasaBCV from '@/components/finanzas/SelectorTasaBCV'

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

function r2(value: number) {
  return Math.round(value * 100) / 100
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

function Field({
  label,
  children,
  helper,
}: {
  label: string
  children: React.ReactNode
  helper?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/75">{label}</label>
      {children}
      {helper ? <p className="mt-2 text-xs text-white/45">{helper}</p> : null}
    </div>
  )
}

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

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

  if ((estado || '').toLowerCase() === 'cobrada') {
    return (
      <span className={cn(base, 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300')}>
        Cobrada
      </span>
    )
  }

  if ((estado || '').toLowerCase() === 'cancelada') {
    return (
      <span className={cn(base, 'border-white/10 bg-white/[0.05] text-white/70')}>
        Cancelada
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

  return (
    <span className={cn(base, 'border-sky-400/20 bg-sky-400/10 text-sky-300')}>
      Pendiente
    </span>
  )
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

type MetodoPagoV2 = {
  id: string
  nombre: string
  cartera_id: string | null
  moneda: string | null
  tipo: string | null
  cartera: {
    nombre: string
    codigo: string | null
  } | null
}

type MetodoPagoV2Raw = {
  id: string
  nombre: string
  cartera_id: string | null
  moneda: string | null
  tipo: string | null
  cartera:
    | {
        nombre: string
        codigo: string | null
      }[]
    | {
        nombre: string
        codigo: string | null
      }
    | null
}

function detectarMetodoBs(metodo: MetodoPagoV2 | null) {
  if (!metodo) return false

  const moneda = String(metodo.moneda || '').toUpperCase()
  const nombre = String(metodo.nombre || '').toLowerCase()
  const tipo = String(metodo.tipo || '').toLowerCase()
  const carteraCodigo = String(metodo.cartera?.codigo || '').toLowerCase()

  return (
    moneda === 'BS' ||
    moneda === 'VES' ||
    nombre.includes('bs') ||
    nombre.includes('bolívar') ||
    nombre.includes('bolivar') ||
    nombre.includes('pago movil') ||
    nombre.includes('pago móvil') ||
    nombre.includes('movil') ||
    nombre.includes('móvil') ||
    tipo.includes('bs') ||
    tipo.includes('bolívar') ||
    tipo.includes('bolivar') ||
    tipo.includes('pago_movil') ||
    carteraCodigo.includes('bs') ||
    carteraCodigo.includes('ves')
  )
}

export default function DetalleCuentaPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [cuenta, setCuenta] = useState<CuentaPorCobrar | null>(null)
  const [abonos, setAbonos] = useState<Abono[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPagoV2[]>([])
  const [cargando, setCargando] = useState(true)
  const [mostrarFormAbono, setMostrarFormAbono] = useState(false)
  const [guardandoAbono, setGuardandoAbono] = useState(false)
  const [error, setError] = useState('')

  const [formAbono, setFormAbono] = useState({
    monto_usd: 0,
    metodo_pago_v2_id: '',
    referencia: '',
    fecha: new Date().toISOString().split('T')[0],
    notas: '',
  })

  const [tasaCongelada, setTasaCongelada] = useState<number | null>(null)
  const [montoBsPersonalizado, setMontoBsPersonalizado] = useState<number | null>(null)

  useEffect(() => {
    if (!id) return
    void cargarTodo()
  }, [id])

  async function cargarTodo() {
    try {
      setCargando(true)
      setError('')
      await Promise.all([cargarDatos(), cargarMetodosPago()])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo cargar la cuenta.')
    } finally {
      setCargando(false)
    }
  }

  async function cargarDatos() {
    const [cuentaData, abonosData] = await Promise.all([
      obtenerCuentaPorId(id),
      obtenerAbonosCuenta(id),
    ])

    setCuenta(cuentaData)
    setAbonos(abonosData || [])
  }

  async function cargarMetodosPago() {
    try {
      const { data, error } = await supabase
        .from('metodos_pago_v2')
        .select(`
          id,
          nombre,
          cartera_id,
          moneda,
          tipo,
          cartera:carteras(nombre, codigo)
        `)
        .eq('activo', true)
        .order('nombre')

      if (error) throw error

      const metodosNormalizados: MetodoPagoV2[] = ((data || []) as MetodoPagoV2Raw[]).map(
        (item) => {
          const cartera = firstOrNull(item.cartera)

          return {
            id: item.id,
            nombre: item.nombre,
            cartera_id: item.cartera_id,
            moneda: item.moneda ?? null,
            tipo: item.tipo ?? null,
            cartera: cartera
              ? {
                  nombre: cartera.nombre,
                  codigo: cartera.codigo ?? null,
                }
              : null,
          }
        }
      )

      setMetodosPago(metodosNormalizados)
    } catch (err) {
      console.error('Error cargando métodos de pago:', err)
      setMetodosPago([])
    }
  }

  const metodoSeleccionado = useMemo(
    () => metodosPago.find((m) => m.id === formAbono.metodo_pago_v2_id) || null,
    [metodosPago, formAbono.metodo_pago_v2_id]
  )

  const esBs = useMemo(() => detectarMetodoBs(metodoSeleccionado), [metodoSeleccionado])

  const montoAbonoFinalUsd = useMemo(() => {
    if (esBs && montoBsPersonalizado && tasaCongelada && tasaCongelada > 0) {
      return r2(montoBsPersonalizado / tasaCongelada)
    }

    return r2(Number(formAbono.monto_usd || 0))
  }, [esBs, montoBsPersonalizado, tasaCongelada, formAbono.monto_usd])

  const montoAbonoFinalBs = useMemo(() => {
    if (esBs && montoBsPersonalizado) return r2(montoBsPersonalizado)
    if (esBs && tasaCongelada && formAbono.monto_usd > 0) {
      return r2(formAbono.monto_usd * tasaCongelada)
    }
    return 0
  }, [esBs, montoBsPersonalizado, tasaCongelada, formAbono.monto_usd])

  function resetAbonoForm() {
    setFormAbono({
      monto_usd: 0,
      metodo_pago_v2_id: '',
      referencia: '',
      fecha: new Date().toISOString().split('T')[0],
      notas: '',
    })
    setTasaCongelada(null)
    setMontoBsPersonalizado(null)
  }

  async function handleRegistrarAbono(e: React.FormEvent) {
    e.preventDefault()

    if (!cuenta) return

    if (montoAbonoFinalUsd <= 0) {
      setError('El monto debe ser mayor a 0.')
      return
    }

    if (montoAbonoFinalUsd > Number(cuenta.saldo_usd || 0)) {
      setError(`El monto no puede ser mayor al saldo (${money(cuenta.saldo_usd)}).`)
      return
    }

    if (esBs && (!tasaCongelada || tasaCongelada <= 0)) {
      setError('Debes cargar la tasa BCV para registrar un pago en bolívares.')
      return
    }

    try {
      setGuardandoAbono(true)
      setError('')

      const notasFinales = [
        formAbono.notas?.trim() || '',
        esBs && tasaCongelada
          ? `Pago en Bs | Tasa BCV: ${tasaCongelada} | Monto Bs: ${money(montoAbonoFinalBs, 'VES')} | Equivalente USD: ${money(montoAbonoFinalUsd)}`
          : '',
      ]
        .filter(Boolean)
        .join(' | ')

      await registrarAbono({
        cuenta_cobrar_id: id,
        monto_usd: montoAbonoFinalUsd,
        metodo_pago_v2_id: formAbono.metodo_pago_v2_id || null,
        referencia: formAbono.referencia || null,
        fecha: formAbono.fecha,
        notas: notasFinales || null,
      } as any)

      await cargarDatos()

      setMostrarFormAbono(false)
      resetAbonoForm()
    } catch (err: any) {
      console.error('Error registrando abono:', err)
      setError(err?.message || 'Error al registrar el abono.')
    } finally {
      setGuardandoAbono(false)
    }
  }

  async function handleCancelarCuenta() {
    if (!cuenta) return

    const motivo = window.prompt('¿Por qué deseas cancelar esta cuenta?')
    if (!motivo) return

    const confirmar = window.confirm(
      '¿Estás seguro de cancelar esta cuenta? Esta acción no se puede deshacer.'
    )
    if (!confirmar) return

    try {
      await cancelarCuenta(id, motivo)
      router.push('/admin/cobranzas/pendientes')
      router.refresh()
    } catch (err) {
      console.error('Error cancelando cuenta:', err)
      window.alert('Error al cancelar la cuenta.')
    }
  }

  const diasVencimiento = useMemo(
    () => diasParaVencer(cuenta?.fecha_vencimiento || null),
    [cuenta?.fecha_vencimiento]
  )

  const estaVencida = diasVencimiento !== null && diasVencimiento < 0
  const porVencer = diasVencimiento !== null && diasVencimiento >= 0 && diasVencimiento <= 7

  const montoTotal = Number(cuenta?.monto_total_usd || 0)
  const montoPagado = Number(cuenta?.monto_pagado_usd || 0)
  const saldo = Number(cuenta?.saldo_usd || 0)

  const porcentajePagado =
    montoTotal > 0 ? Math.min(100, Math.round((montoPagado / montoTotal) * 100)) : 0

  const puedeAbonar =
    cuenta &&
    cuenta.estado !== 'cobrada' &&
    cuenta.estado !== 'cancelada' &&
    saldo > 0

  if (cargando) {
    return (
      <div className="w-full">
        <Card className="p-14">
          <div className="flex items-center justify-center">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          </div>
        </Card>
      </div>
    )
  }

  if (!cuenta) {
    return (
      <div className="w-full">
        <Card className="p-16 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
            <Wallet className="h-8 w-8 text-white/35" />
          </div>

          <h3 className="text-2xl font-semibold text-white">Cuenta no encontrada</h3>
          <p className="mt-2 text-sm text-white/55">
            No pudimos encontrar esta cuenta por cobrar.
          </p>

          <Link
            href="/admin/cobranzas/pendientes"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a cuentas
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/cobranzas/pendientes"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"
          >
            <ArrowLeft className="h-5 w-5 text-white/75" />
          </Link>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight text-white">
                {cuenta.cliente_nombre}
              </h1>
              <StatusBadge estado={cuenta.estado} dias={diasVencimiento} />
            </div>

            <p className="mt-2 text-sm text-white/55">{cuenta.concepto}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {puedeAbonar ? (
            <button
              type="button"
              onClick={() => {
                setMostrarFormAbono(true)
                setError('')
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
            >
              <Plus className="h-4 w-4" />
              Registrar abono
            </button>
          ) : null}

          {cuenta.estado !== 'cobrada' && cuenta.estado !== 'cancelada' ? (
            <button
              type="button"
              onClick={handleCancelarCuenta}
              className="inline-flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-400/15"
            >
              <Ban className="h-4 w-4" />
              Cancelar cuenta
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <Card className="border-rose-400/25 bg-rose-400/5 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-400" />
            <div>
              <p className="font-semibold text-rose-300">Error</p>
              <p className="mt-1 text-sm text-rose-200/70">{error}</p>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden border-white/10 bg-gradient-to-b from-[#0a0b0f] to-[#11131a]">
        <div className="relative p-6 sm:p-8">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-500/10 via-white/[0.01] to-emerald-500/10" />
          <div className="relative grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
            <div>
              <p className="text-sm text-white/55">Saldo pendiente</p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                {money(saldo)}
              </p>
              <p className="mt-2 text-sm text-white/45">
                de {money(montoTotal)} total
              </p>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-white/55">Progreso de pago</span>
                  <span className="font-semibold text-white">{porcentajePagado}%</span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-500"
                    style={{ width: `${porcentajePagado}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-wider text-white/45">Pagado</p>
                <p className="mt-2 text-2xl font-bold text-emerald-400">
                  {money(montoPagado)}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-wider text-white/45">Abonos</p>
                <p className="mt-2 text-2xl font-bold text-white">{abonos.length}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <SectionHeader
            title="Detalles de la cuenta"
            description="Información general de esta cuenta por cobrar."
          />

          <div className="grid gap-4">
            <div className="flex items-start justify-between gap-4 rounded-2xl bg-white/[0.03] p-4">
              <span className="text-sm text-white/55">Cliente</span>
              <span className="text-right text-sm font-medium text-white">
                {cuenta.cliente_nombre}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-2xl bg-white/[0.03] p-4">
              <span className="text-sm text-white/55">Concepto</span>
              <span className="text-right text-sm font-medium text-white">
                {cuenta.concepto}
              </span>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-2xl bg-white/[0.03] p-4">
              <span className="text-sm text-white/55">Fecha de venta</span>
              <span className="text-right text-sm font-medium text-white">
                {formatDate(cuenta.fecha_venta)}
              </span>
            </div>

            {cuenta.fecha_vencimiento ? (
              <div className="flex items-start justify-between gap-4 rounded-2xl bg-white/[0.03] p-4">
                <span className="text-sm text-white/55">Fecha de vencimiento</span>

                <div className="text-right">
                  <p
                    className={cn(
                      'text-sm font-medium',
                      estaVencida
                        ? 'text-rose-400'
                        : porVencer
                          ? 'text-amber-400'
                          : 'text-white'
                    )}
                  >
                    {formatDate(cuenta.fecha_vencimiento)}
                  </p>

                  {diasVencimiento !== null ? (
                    <p
                      className={cn(
                        'mt-1 text-xs',
                        estaVencida
                          ? 'text-rose-400/75'
                          : porVencer
                            ? 'text-amber-400/75'
                            : 'text-white/45'
                      )}
                    >
                      {estaVencida
                        ? `Vencida hace ${Math.abs(diasVencimiento)} día${Math.abs(diasVencimiento) !== 1 ? 's' : ''}`
                        : `Vence en ${diasVencimiento} día${diasVencimiento !== 1 ? 's' : ''}`}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-4 rounded-2xl bg-white/[0.03] p-4">
              <span className="text-sm text-white/55">Estado</span>
              <StatusBadge estado={cuenta.estado} dias={diasVencimiento} />
            </div>

            {cuenta.inventario ? (
              <div className="flex items-start justify-between gap-4 rounded-2xl bg-white/[0.03] p-4">
                <span className="text-sm text-white/55">Producto</span>
                <span className="text-right text-sm font-medium text-white">
                  {cuenta.inventario.nombre}
                  {cuenta.cantidad_producto
                    ? ` (${cuenta.cantidad_producto} ${cuenta.inventario.unidad_medida})`
                    : ''}
                </span>
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
          <SectionHeader
            title="Resumen de pagos"
            description="Vista rápida de lo abonado y el movimiento reciente."
          />

          <div className="grid gap-4">
            <div className="rounded-2xl bg-white/[0.03] p-4">
              <p className="text-sm text-white/55">Total abonado</p>
              <p className="mt-2 text-2xl font-bold text-emerald-400">
                {money(montoPagado)}
              </p>
            </div>

            <div className="rounded-2xl bg-white/[0.03] p-4">
              <p className="text-sm text-white/55">Número de abonos</p>
              <p className="mt-2 text-2xl font-bold text-white">{abonos.length}</p>
            </div>

            {abonos.length > 0 ? (
              <div className="rounded-2xl bg-white/[0.03] p-4">
                <p className="text-sm text-white/55">Último abono</p>
                <div className="mt-2 flex items-start justify-between gap-4">
                  <p className="text-2xl font-bold text-white">
                    {money((abonos[0] as any).monto_usd)}
                  </p>
                  <p className="text-xs text-white/45">{formatDate((abonos[0] as any).fecha)}</p>
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-white/10 p-6">
          <SectionHeader
            title="Historial de abonos"
            description={`${abonos.length} abono${abonos.length !== 1 ? 's' : ''} registrado${abonos.length !== 1 ? 's' : ''}.`}
          />
        </div>

        {abonos.length === 0 ? (
          <div className="p-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
              <Receipt className="h-7 w-7 text-white/30" />
            </div>
            <p className="text-sm text-white/55">No hay abonos registrados todavía.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {abonos.map((abono: any) => (
              <div key={abono.id} className="p-5 transition-colors hover:bg-white/[0.02]">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-2.5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-white">
                          Abono de {money(abono.monto_usd)}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(abono.fecha)}
                          </span>

                          {abono.metodo_pago?.nombre ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                              <CreditCard className="h-3.5 w-3.5" />
                              {abono.metodo_pago.nombre}
                            </span>
                          ) : null}

                          {abono.referencia ? (
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                              Ref: {abono.referencia}
                            </span>
                          ) : null}
                        </div>

                        {abono.notas ? (
                          <p className="mt-3 text-sm text-white/50">{abono.notas}</p>
                        ) : null}
                      </div>

                      <p className="text-xl font-bold text-emerald-400">
                        {money(abono.monto_usd)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {mostrarFormAbono ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0b0f]/80 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl overflow-hidden border-white/10 bg-gradient-to-b from-[#0a0b0f] to-[#11131a]">
            <div className="flex items-center justify-between border-b border-white/10 bg-transparent px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-white">Registrar abono</h2>
                <p className="mt-1 text-sm text-white/55">
                  Registra un nuevo pago para esta cuenta.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMostrarFormAbono(false)
                  setError('')
                  resetAbonoForm()
                }}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 transition hover:bg-white/[0.06]"
              >
                <X className="h-5 w-5 text-white/65" />
              </button>
            </div>

            <form
              onSubmit={handleRegistrarAbono}
              className="bg-gradient-to-b from-[#0a0b0f] to-[#11131a] p-6"
            >
              <div className="mb-6 rounded-3xl border border-sky-400/20 bg-sky-400/10 p-5">
                <p className="text-sm font-medium text-sky-300">Saldo pendiente actual</p>
                <p className="mt-2 text-4xl font-bold tracking-tight text-white">
                  {money(cuenta.saldo_usd)}
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Método de pago">
                  <select
                    value={formAbono.metodo_pago_v2_id}
                    onChange={(e) => {
                      setFormAbono((prev) => ({
                        ...prev,
                        metodo_pago_v2_id: e.target.value,
                      }))
                      setTasaCongelada(null)
                      setMontoBsPersonalizado(null)
                      setError('')
                    }}
                    className={inputClassName}
                  >
                    <option value="" className="bg-[#11131a] text-white">
                      Seleccionar método
                    </option>
                    {metodosPago.map((metodo) => (
                      <option
                        key={metodo.id}
                        value={metodo.id}
                        className="bg-[#11131a] text-white"
                      >
                        {metodo.nombre}
                        {metodo.moneda ? ` · ${metodo.moneda}` : ''}
                        {metodo.cartera?.nombre ? ` · ${metodo.cartera.nombre}` : ''}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Fecha">
                  <input
                    type="date"
                    value={formAbono.fecha}
                    onChange={(e) =>
                      setFormAbono((prev) => ({ ...prev, fecha: e.target.value }))
                    }
                    className={inputClassName}
                    required
                  />
                </Field>

                {!esBs ? (
                  <Field label="Monto del abono (USD)" helper="No puede ser mayor al saldo pendiente.">
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35">
                        $
                      </span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={saldo}
                        value={formAbono.monto_usd || ''}
                        onChange={(e) => {
                          setFormAbono((prev) => ({
                            ...prev,
                            monto_usd: parseFloat(e.target.value) || 0,
                          }))
                          setError('')
                        }}
                        className={`${inputClassName} pl-8`}
                        required
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFormAbono((prev) => ({ ...prev, monto_usd: saldo }))
                        }
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/75 transition hover:bg-white/[0.06]"
                      >
                        Pago total
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setFormAbono((prev) => ({
                            ...prev,
                            monto_usd: Number((saldo / 2).toFixed(2)),
                          }))
                        }
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/75 transition hover:bg-white/[0.06]"
                      >
                        50%
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setFormAbono((prev) => ({
                            ...prev,
                            monto_usd: Number((saldo * 0.25).toFixed(2)),
                          }))
                        }
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/75 transition hover:bg-white/[0.06]"
                      >
                        25%
                      </button>
                    </div>
                  </Field>
                ) : (
                  <div className="sm:col-span-2">
                    <Field
                      label="Monto base del abono (USD)"
                      helper="Este monto es el equivalente en USD que se registrará en la cuenta."
                    >
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35">
                          $
                        </span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          max={saldo}
                          value={formAbono.monto_usd || ''}
                          onChange={(e) => {
                            setFormAbono((prev) => ({
                              ...prev,
                              monto_usd: parseFloat(e.target.value) || 0,
                            }))
                            setMontoBsPersonalizado(null)
                            setError('')
                          }}
                          className={`${inputClassName} pl-8`}
                          required
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFormAbono((prev) => ({ ...prev, monto_usd: saldo }))
                            if (tasaCongelada && tasaCongelada > 0) {
                              setMontoBsPersonalizado(r2(saldo * tasaCongelada))
                            }
                          }}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/75 transition hover:bg-white/[0.06]"
                        >
                          Pago total
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const usd = Number((saldo / 2).toFixed(2))
                            setFormAbono((prev) => ({ ...prev, monto_usd: usd }))
                            if (tasaCongelada && tasaCongelada > 0) {
                              setMontoBsPersonalizado(r2(usd * tasaCongelada))
                            }
                          }}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/75 transition hover:bg-white/[0.06]"
                        >
                          50%
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const usd = Number((saldo * 0.25).toFixed(2))
                            setFormAbono((prev) => ({ ...prev, monto_usd: usd }))
                            if (tasaCongelada && tasaCongelada > 0) {
                              setMontoBsPersonalizado(r2(usd * tasaCongelada))
                            }
                          }}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/75 transition hover:bg-white/[0.06]"
                        >
                          25%
                        </button>
                      </div>
                    </Field>

                    <div className="mt-5">
                      <SelectorTasaBCV
                        fecha={formAbono.fecha}
                        monedaPago="BS"
                        montoUSD={Number(formAbono.monto_usd || 0)}
                        montoBs={montoBsPersonalizado || undefined}
                        onTasaChange={setTasaCongelada}
                        onMontoBsChange={(monto) => {
                          setMontoBsPersonalizado(monto)
                          if (monto > 0 && tasaCongelada) {
                            setFormAbono((prev) => ({
                              ...prev,
                              monto_usd: r2(monto / tasaCongelada),
                            }))
                          }
                        }}
                      />
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs text-white/45">Tasa BCV</p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {tasaCongelada ? tasaCongelada : '—'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs text-white/45">Total Bs</p>
                        <p className="mt-2 text-lg font-semibold text-amber-300">
                          {montoAbonoFinalBs > 0 ? money(montoAbonoFinalBs, 'VES') : '—'}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs text-white/45">Equivalente USD</p>
                        <p className="mt-2 text-lg font-semibold text-emerald-400">
                          {montoAbonoFinalUsd > 0 ? money(montoAbonoFinalUsd) : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Field label="Referencia">
                  <input
                    type="text"
                    value={formAbono.referencia}
                    onChange={(e) =>
                      setFormAbono((prev) => ({
                        ...prev,
                        referencia: e.target.value,
                      }))
                    }
                    placeholder="Número de referencia o comprobante"
                    className={inputClassName}
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field label="Notas">
                    <textarea
                      value={formAbono.notas}
                      onChange={(e) =>
                        setFormAbono((prev) => ({
                          ...prev,
                          notas: e.target.value,
                        }))
                      }
                      rows={4}
                      placeholder="Notas adicionales del abono"
                      className={`${inputClassName} min-h-[120px] resize-none`}
                    />
                  </Field>
                </div>
              </div>

              {error ? (
                <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
                  <p className="text-sm text-rose-300">{error}</p>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMostrarFormAbono(false)
                    setError('')
                    resetAbonoForm()
                  }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={guardandoAbono}
                  className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-60"
                >
                  {guardandoAbono ? 'Guardando...' : 'Registrar abono'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
