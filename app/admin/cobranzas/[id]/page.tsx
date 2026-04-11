'use client'

export const dynamic = 'force-dynamic'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
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
  registrarAbonoMixto,
  agruparAbonosPorOperacion,
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

type PagoMixtoItem = {
  id_local: string
  moneda_pago: 'USD' | 'BS'
  metodo_pago_v2_id: string
  monto_usd: string
  monto_bs: number | null
  tasa_bcv: number | null
  referencia: string
  notas: string
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

function detectarMetodoUsd(metodo: MetodoPagoV2 | null) {
  if (!metodo) return false

  const moneda = String(metodo.moneda || '').toUpperCase()
  const nombre = String(metodo.nombre || '').toLowerCase()
  const carteraCodigo = String(metodo.cartera?.codigo || '').toLowerCase()

  return (
    moneda === 'USD' ||
    nombre.includes('usd') ||
    nombre.includes('zelle') ||
    nombre.includes('efectivo $') ||
    nombre.includes('efectivo usd') ||
    carteraCodigo.includes('usd')
  )
}

function makePagoItem(moneda: 'USD' | 'BS' = 'USD'): PagoMixtoItem {
  return {
    id_local: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    moneda_pago: moneda,
    metodo_pago_v2_id: '',
    monto_usd: '',
    monto_bs: null,
    tasa_bcv: null,
    referencia: '',
    notas: '',
  }
}

const PagoBsSelector = memo(function PagoBsSelector({
  fecha,
  montoUsd,
  montoBs,
  onChangeTasa,
  onChangeMontoBs,
}: {
  fecha: string
  montoUsd: number
  montoBs: number | null
  onChangeTasa: (tasa: number | null) => void
  onChangeMontoBs: (monto: number) => void
}) {
  return (
    <SelectorTasaBCV
      fecha={fecha}
      monedaPago="BS"
      monedaReferencia="EUR"
      montoUSD={montoUsd}
      montoBs={montoBs || undefined}
      onTasaChange={onChangeTasa}
      onMontoBsChange={onChangeMontoBs}
    />
  )
})

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
    fecha: new Date().toISOString().split('T')[0],
    notas_generales: '',
  })

  const [pagosMixtos, setPagosMixtos] = useState<PagoMixtoItem[]>([makePagoItem('USD')])

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
        .eq('permite_recibir', true)
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

  function getMetodosForMoneda(moneda: 'USD' | 'BS') {
    return moneda === 'USD'
      ? metodosPago.filter((m) => detectarMetodoUsd(m))
      : metodosPago.filter((m) => detectarMetodoBs(m))
  }

  function updatePagoItem(idLocal: string, patch: Partial<PagoMixtoItem>) {
    setPagosMixtos((prev) =>
      prev.map((item) => (item.id_local === idLocal ? { ...item, ...patch } : item))
    )
  }

  function addPagoItem(moneda: 'USD' | 'BS' = 'USD') {
    setPagosMixtos((prev) => [...prev, makePagoItem(moneda)])
  }

  function removePagoItem(idLocal: string) {
    setPagosMixtos((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((item) => item.id_local !== idLocal)
    })
  }

  const handlePagoBsTasaChange = useCallback((idLocal: string, tasa: number | null) => {
    setPagosMixtos((prev) =>
      prev.map((item) =>
        item.id_local === idLocal ? { ...item, tasa_bcv: tasa } : item
      )
    )
  }, [])

  const handlePagoBsMontoChange = useCallback((idLocal: string, monto: number) => {
    setPagosMixtos((prev) =>
      prev.map((item) =>
        item.id_local === idLocal ? { ...item, monto_bs: monto } : item
      )
    )
  }, [])

  const saldo = Number(cuenta?.saldo_usd || 0)

  const resumenPagos = useMemo(() => {
    const items = pagosMixtos.map((item) => {
      const montoUsdEq =
        item.moneda_pago === 'USD'
          ? r2(Number(item.monto_usd || 0))
          : Number(item.monto_bs || 0) > 0 && Number(item.tasa_bcv || 0) > 0
            ? r2(Number(item.monto_bs || 0) / Number(item.tasa_bcv || 0))
            : 0

      const montoBs =
        item.moneda_pago === 'BS'
          ? r2(Number(item.monto_bs || 0))
          : Number(item.tasa_bcv || 0) > 0 && Number(item.monto_usd || 0) > 0
            ? r2(Number(item.monto_usd || 0) * Number(item.tasa_bcv || 0))
            : 0

      return {
        ...item,
        monto_equivalente_usd: montoUsdEq,
        monto_equivalente_bs: montoBs > 0 ? montoBs : null,
        monto_insertar:
          item.moneda_pago === 'BS'
            ? r2(Number(item.monto_bs || 0))
            : r2(Number(item.monto_usd || 0)),
        valido:
          !!item.metodo_pago_v2_id &&
          (
            item.moneda_pago === 'USD'
              ? Number(item.monto_usd || 0) > 0
              : Number(item.monto_bs || 0) > 0 && Number(item.tasa_bcv || 0) > 0
          ),
      }
    })

    const totalUsd = r2(
      items.reduce((acc, item) => acc + Number(item.monto_equivalente_usd || 0), 0)
    )
    const totalBs = r2(
      items.reduce((acc, item) => acc + Number(item.monto_equivalente_bs || 0), 0)
    )
    const faltanteUsd = r2(Math.max(saldo - totalUsd, 0))
    const excedenteUsd = r2(Math.max(totalUsd - saldo, 0))
    const diferenciaUsd = r2(saldo - totalUsd)

    return {
      items,
      totalUsd,
      totalBs,
      faltanteUsd,
      excedenteUsd,
      diferenciaUsd,
      cuadra: Math.abs(diferenciaUsd) < 0.01 && saldo > 0,
      todosValidos: items.every((item) => item.valido),
    }
  }, [pagosMixtos, saldo])

  function resetAbonoForm() {
    setFormAbono({
      fecha: new Date().toISOString().split('T')[0],
      notas_generales: '',
    })
    setPagosMixtos([makePagoItem('USD')])
  }

  async function handleRegistrarAbono(e: React.FormEvent) {
    e.preventDefault()

    if (!cuenta) return

    if (!resumenPagos.todosValidos) {
      setError('Completa correctamente todos los fragmentos del abono.')
      return
    }

    if (resumenPagos.totalUsd <= 0) {
      setError('El abono debe ser mayor a 0.')
      return
    }

    if (resumenPagos.totalUsd > Number(cuenta.saldo_usd || 0)) {
      setError(`El abono no puede ser mayor al saldo (${money(cuenta.saldo_usd)}).`)
      return
    }

    try {
      setGuardandoAbono(true)
      setError('')

      await registrarAbonoMixto({
        cuenta_cobrar_id: id,
        fecha: formAbono.fecha,
        notas_generales: formAbono.notas_generales || null,
        pagos: resumenPagos.items.map((item) => ({
          metodo_pago_v2_id: item.metodo_pago_v2_id,
          moneda_pago: item.moneda_pago,
          monto: item.monto_insertar,
          tasa_bcv: item.moneda_pago === 'BS' ? item.tasa_bcv : null,
          referencia: item.referencia || null,
          notas: item.notas || null,
        })),
      })

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

  const porcentajePagado =
    montoTotal > 0 ? Math.min(100, Math.round((montoPagado / montoTotal) * 100)) : 0

  const puedeAbonar =
    cuenta &&
    cuenta.estado !== 'cobrada' &&
    cuenta.estado !== 'cancelada' &&
    saldo > 0

  const gruposAbonos = useMemo(() => agruparAbonosPorOperacion(abonos), [abonos])

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
                <p className="text-xs uppercase tracking-wider text-white/45">Operaciones</p>
                <p className="mt-2 text-2xl font-bold text-white">{gruposAbonos.length}</p>
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
              <p className="text-sm text-white/55">Operaciones de abono</p>
              <p className="mt-2 text-2xl font-bold text-white">{gruposAbonos.length}</p>
            </div>

            {gruposAbonos.length > 0 ? (
              <div className="rounded-2xl bg-white/[0.03] p-4">
                <p className="text-sm text-white/55">Último abono</p>
                <div className="mt-2 flex items-start justify-between gap-4">
                  <p className="text-2xl font-bold text-white">
                    {money(gruposAbonos[0].total_usd)}
                  </p>
                  <p className="text-xs text-white/45">{formatDate(gruposAbonos[0].fecha)}</p>
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
            description={`${gruposAbonos.length} operación${gruposAbonos.length !== 1 ? 'es' : ''} registrada${gruposAbonos.length !== 1 ? 's' : ''}.`}
          />
        </div>

        {gruposAbonos.length === 0 ? (
          <div className="p-14 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
              <Receipt className="h-7 w-7 text-white/30" />
            </div>
            <p className="text-sm text-white/55">No hay abonos registrados todavía.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {gruposAbonos.map((grupo) => (
              <div key={grupo.operacion_pago_id} className="p-5 transition-colors hover:bg-white/[0.02]">
                <div className="flex items-start gap-4">
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-2.5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-white">
                          Abono de {money(grupo.total_usd)}
                          {grupo.es_pago_mixto ? ' · Pago mixto' : ''}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(grupo.fecha)}
                          </span>

                          {grupo.total_bs > 0 ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                              <Wallet className="h-3.5 w-3.5" />
                              {money(grupo.total_bs, 'VES')}
                            </span>
                          ) : null}

                          <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1">
                            {grupo.items_total} item{grupo.items_total !== 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className="mt-3 space-y-2">
                          {grupo.items.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <div className="flex flex-wrap items-center gap-2 text-white/70">
                                  <span className="font-medium text-white">
                                    {item.metodo_pago?.nombre || 'Método'}
                                  </span>
                                  <span>·</span>
                                  <span>{String(item.moneda_pago || 'USD')}</span>
                                  {item.referencia ? (
                                    <>
                                      <span>·</span>
                                      <span>Ref: {item.referencia}</span>
                                    </>
                                  ) : null}
                                </div>

                                <div className="text-right">
                                  <p className="font-semibold text-emerald-400">
                                    {money(item.monto_usd)}
                                  </p>
                                  {Number(item.monto_bs || 0) > 0 ? (
                                    <p className="text-xs text-amber-300">
                                      {money(item.monto_bs || 0, 'VES')}
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              {item.notas ? (
                                <p className="mt-2 text-xs text-white/45">{item.notas}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>

                      <p className="text-xl font-bold text-emerald-400">
                        {money(grupo.total_usd)}
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
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0b0f]/80 p-3 backdrop-blur-sm">
    <Card className="w-full max-w-3xl overflow-hidden border-white/10 bg-gradient-to-b from-[#0a0b0f] to-[#11131a] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-transparent px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-white">Registrar abono</h2>
                <p className="mt-1 text-sm text-white/55">
                  Registra uno o varios métodos de pago para esta cuenta.
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
  className="max-h-[82vh] overflow-y-auto bg-gradient-to-b from-[#0a0b0f] to-[#11131a] p-5"
>
              <div className="mb-5 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-4">
  <p className="text-xs font-medium uppercase tracking-wide text-sky-300">
    Saldo pendiente actual
  </p>
  <p className="mt-1 text-3xl font-bold tracking-tight text-white">
    {money(cuenta.saldo_usd)}
  </p>
</div>

              <div className="grid gap-4 sm:grid-cols-2">
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

                <Field label="Total registrado USD">
                  <input
                    type="text"
                    value={money(resumenPagos.totalUsd)}
                    readOnly
                    className={`${inputClassName} cursor-not-allowed opacity-70`}
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field label="Notas generales">
                    <textarea
                      value={formAbono.notas_generales}
                      onChange={(e) =>
                        setFormAbono((prev) => ({
                          ...prev,
                          notas_generales: e.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="Notas generales del abono"
                      className={`${inputClassName} min-h-[78px] resize-none`}                    />
                  </Field>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {pagosMixtos.map((item, index) => {
                  const metodosDisponibles = getMetodosForMoneda(item.moneda_pago)
                  const montoUsdEq =
                    item.moneda_pago === 'USD'
                      ? r2(Number(item.monto_usd || 0))
                      : Number(item.monto_bs || 0) > 0 && Number(item.tasa_bcv || 0) > 0
                        ? r2(Number(item.monto_bs || 0) / Number(item.tasa_bcv || 0))
                        : 0

                  return (
                    <div
  key={item.id_local}
  className="rounded-2xl border border-white/10 bg-white/[0.03] p-3.5"
>
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            Fragmento #{index + 1}
                          </p>
                          <p className="text-xs text-white/45">
                            {item.moneda_pago === 'BS'
                              ? `Equivalente USD calculado: ${money(montoUsdEq)}`
                              : `Monto del fragmento: ${money(montoUsdEq)}`}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removePagoItem(item.id_local)}
                          disabled={pagosMixtos.length <= 1}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70 hover:bg-white/[0.06] disabled:opacity-40"
                        >
                          Quitar
                        </button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <Field label="Moneda">
                          <select
                            value={item.moneda_pago}
                            onChange={(e) =>
                              updatePagoItem(item.id_local, {
                                moneda_pago: e.target.value as 'USD' | 'BS',
                                metodo_pago_v2_id: '',
                                monto_usd: '',
                                monto_bs: null,
                                tasa_bcv: null,
                              })
                            }
                            className={inputClassName}
                          >
                            <option value="USD" className="bg-[#11131a] text-white">
                              USD
                            </option>
                            <option value="BS" className="bg-[#11131a] text-white">
                              Bs
                            </option>
                          </select>
                        </Field>

                        <Field label={item.moneda_pago === 'USD' ? 'Método USD' : 'Método Bs'}>
                          <select
                            value={item.metodo_pago_v2_id}
                            onChange={(e) =>
                              updatePagoItem(item.id_local, {
                                metodo_pago_v2_id: e.target.value,
                              })
                            }
                            className={inputClassName}
                          >
                            <option value="" className="bg-[#11131a] text-white">
                              Seleccionar método
                            </option>
                            {metodosDisponibles.map((metodo) => (
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

                        {item.moneda_pago === 'USD' ? (
                          <Field label="Monto USD">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.monto_usd}
                              onChange={(e) =>
                                updatePagoItem(item.id_local, {
                                  monto_usd: e.target.value,
                                })
                              }
                              className={inputClassName}
                              placeholder="0.00"
                            />
                          </Field>
                        ) : (
                          <Field label="Monto Bs">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={item.monto_bs ?? ''}
                              onChange={(e) =>
                                updatePagoItem(item.id_local, {
                                  monto_bs: e.target.value ? Number(e.target.value) : null,
                                })
                              }
                              className={inputClassName}
                              placeholder="0.00"
                            />
                          </Field>
                        )}

                        {item.moneda_pago === 'BS' && (
                          <div className="md:col-span-3">
                            <PagoBsSelector
                              fecha={formAbono.fecha}
                              montoUsd={
                                Number(item.monto_bs || 0) > 0 && Number(item.tasa_bcv || 0) > 0
                                  ? r2(Number(item.monto_bs || 0) / Number(item.tasa_bcv || 0))
                                  : 0
                              }
                              montoBs={item.monto_bs}
                              onChangeTasa={(tasa) => handlePagoBsTasaChange(item.id_local, tasa)}
                              onChangeMontoBs={(monto) => handlePagoBsMontoChange(item.id_local, monto)}
                            />
                          </div>
                        )}

                        {item.moneda_pago === 'BS' && (
                          <div className="md:col-span-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-sm">
                            <div className="flex justify-between">
                              <span className="text-white/55">Equivalente USD calculado:</span>
                              <span className="text-white">
                                {money(
                                  Number(item.monto_bs || 0) > 0 && Number(item.tasa_bcv || 0) > 0
                                    ? r2(Number(item.monto_bs || 0) / Number(item.tasa_bcv || 0))
                                    : 0
                                )}
                              </span>
                            </div>
                          </div>
                        )}

                        <Field label="Referencia">
                          <input
                            type="text"
                            value={item.referencia}
                            onChange={(e) =>
                              updatePagoItem(item.id_local, {
                                referencia: e.target.value,
                              })
                            }
                            placeholder="Número de referencia o comprobante"
                            className={inputClassName}
                          />
                        </Field>

                        <div className="md:col-span-2">
                          <Field label="Notas del fragmento">
                            <input
                              type="text"
                              value={item.notas}
                              onChange={(e) =>
                                updatePagoItem(item.id_local, {
                                  notas: e.target.value,
                                })
                              }
                              placeholder="Notas del fragmento"
                              className={inputClassName}
                            />
                          </Field>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => addPagoItem('USD')}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
                >
                  + Agregar pago USD
                </button>

                <button
                  type="button"
                  onClick={() => addPagoItem('BS')}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
                >
                  + Agregar pago Bs
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const monto = saldo
                    setPagosMixtos([
                      {
                        ...makePagoItem('USD'),
                        monto_usd: String(monto),
                      },
                    ])
                  }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
                >
                  Pago total
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const monto = r2(saldo / 2)
                    setPagosMixtos([
                      {
                        ...makePagoItem('USD'),
                        monto_usd: String(monto),
                      },
                    ])
                  }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
                >
                  50%
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const monto = r2(saldo * 0.25)
                    setPagosMixtos([
                      {
                        ...makePagoItem('USD'),
                        monto_usd: String(monto),
                      },
                    ])
                  }}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
                >
                  25%
                </button>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div>
                    <p className="text-xs text-white/45">Saldo actual</p>
                    <p className="mt-1 font-semibold text-white">{money(saldo)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/45">Total registrado</p>
                    <p className="mt-1 font-semibold text-emerald-400">
                      {money(resumenPagos.totalUsd)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/45">Total Bs</p>
                    <p className="mt-1 font-semibold text-amber-300">
                      {money(resumenPagos.totalBs, 'VES')}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  {!resumenPagos.cuadra ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/55">Faltante USD:</span>
                        <span className="font-semibold text-amber-300">
                          {money(resumenPagos.faltanteUsd)}
                        </span>
                      </div>

                      {resumenPagos.excedenteUsd > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-white/55">Excedente USD:</span>
                          <span className="font-semibold text-rose-300">
                            {money(resumenPagos.excedenteUsd)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/55">Estado:</span>
                      <span className="font-semibold text-emerald-300">
                        Abono exacto
                      </span>
                    </div>
                  )}
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