'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Wallet, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

type MetodoPagoV2 = {
  id: string
  nombre: string
  moneda: 'USD' | 'BS' | 'VES' | string
  cartera_id: string
  cartera_nombre?: string
  activo?: boolean
}

type TipoCambioRow = {
  fecha?: string | null
  tasa?: number | string | null
  valor?: number | string | null
  monto?: number | string | null
  bcv?: number | string | null
  precio?: number | string | null
}

type Props = {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  cuenta: {
    id: string
    cliente_nombre: string
    saldo_usd: number
  }
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function money(value: number | string | null | undefined, currency: 'USD' | 'BS' = 'USD') {
  const num = Number(value || 0)

  if (currency === 'BS') {
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

async function registrarCobroCuenta(params: {
  cuenta_cobrar_id: string
  monto_pago: number
  moneda_pago: 'USD' | 'BS'
  metodo_pago_v2_id: string
  referencia?: string | null
  notas?: string | null
  fecha?: string
  tasa_bcv?: number | null
  registrado_por?: string | null
}) {
  const { data, error } = await supabase.rpc('registrar_cobro_cuenta', {
    p_cuenta_cobrar_id: params.cuenta_cobrar_id,
    p_monto_pago: params.monto_pago,
    p_moneda_pago: params.moneda_pago,
    p_metodo_pago_v2_id: params.metodo_pago_v2_id,
    p_referencia: params.referencia ?? null,
    p_notas: params.notas ?? null,
    p_fecha: params.fecha ?? new Date().toISOString().slice(0, 10),
    p_tasa_bcv: params.tasa_bcv ?? null,
    p_registrado_por: params.registrado_por ?? null,
  })

  if (error) {
    throw new Error(error.message || 'No se pudo registrar el cobro.')
  }

  return Array.isArray(data) ? data[0] : data
}

export default function CobrarCuentaModal({
  open,
  onClose,
  onSuccess,
  cuenta,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [loadingMetodos, setLoadingMetodos] = useState(false)
  const [error, setError] = useState('')
  const [metodos, setMetodos] = useState<MetodoPagoV2[]>([])

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [monedaPago, setMonedaPago] = useState<'USD' | 'BS'>('USD')
  const [montoPago, setMontoPago] = useState('')
  const [tasaBcv, setTasaBcv] = useState('')
  const [metodoPagoV2Id, setMetodoPagoV2Id] = useState('')
  const [referencia, setReferencia] = useState('')
  const [notas, setNotas] = useState('')

  useEffect(() => {
    if (!open) return
    void cargarMetodos()
  }, [open])

  useEffect(() => {
    if (!open) return

    setFecha(new Date().toISOString().slice(0, 10))
    setMonedaPago('USD')
    setMontoPago('')
    setTasaBcv('')
    setMetodoPagoV2Id('')
    setReferencia('')
    setNotas('')
    setError('')
  }, [open])

  useEffect(() => {
    if (!open) return
    if (monedaPago !== 'BS') return
    if (Number(tasaBcv || 0) > 0) return

    void resolverTasaBCVActual().catch((err) => {
      console.error('Error cargando tasa BCV automática:', err)
    })
  }, [open, monedaPago])

  async function cargarMetodos() {
    try {
      setLoadingMetodos(true)
      setError('')

      const { data, error } = await supabase
        .from('v_metodos_pago_completo')
        .select(`
          id,
          metodo_nombre,
          moneda,
          cartera_id,
          cartera_nombre,
          activo
        `)
        .eq('activo', true)

      if (error) throw error

      const rows: MetodoPagoV2[] = (data || []).map((item: any) => ({
        id: item.id,
        nombre: item.metodo_nombre,
        moneda: String(item.moneda || '').toUpperCase(),
        cartera_id: item.cartera_id,
        cartera_nombre: item.cartera_nombre,
        activo: item.activo,
      }))

      setMetodos(rows)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudieron cargar los métodos de pago.')
    } finally {
      setLoadingMetodos(false)
    }
  }

  async function resolverTasaBCVActual() {
    const hoy = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('tipos_cambio')
      .select('*')
      .lte('fecha', hoy)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    const row = data as TipoCambioRow | null

    const posibleTasa = Number(
      row?.tasa ?? row?.valor ?? row?.monto ?? row?.bcv ?? row?.precio ?? 0
    )

    if (!posibleTasa || posibleTasa <= 0) {
      throw new Error('No se pudo obtener la tasa BCV automática.')
    }

    setTasaBcv(String(posibleTasa))
    return posibleTasa
  }

  const metodosFiltrados = useMemo(() => {
    return metodos.filter((m) => {
      const moneda = String(m.moneda || '').toUpperCase()
      if (monedaPago === 'USD') return moneda === 'USD'
      return moneda === 'BS' || moneda === 'VES'
    })
  }, [metodos, monedaPago])

  useEffect(() => {
    if (!metodoPagoV2Id) return
    const existe = metodosFiltrados.some((m) => m.id === metodoPagoV2Id)
    if (!existe) setMetodoPagoV2Id('')
  }, [metodosFiltrados, metodoPagoV2Id])

  const montoNumero = Number(montoPago || 0)
  const tasaNumero = Number(tasaBcv || 0)
  const saldoUsd = Number(cuenta.saldo_usd || 0)

  const montoUsdAplicado = useMemo(() => {
    if (!montoNumero || montoNumero <= 0) return 0

    if (monedaPago === 'USD') {
      return Number(montoNumero.toFixed(2))
    }

    if (!tasaNumero || tasaNumero <= 0) return 0
    return Number((montoNumero / tasaNumero).toFixed(2))
  }, [montoNumero, monedaPago, tasaNumero])

  const montoBsMostrado = useMemo(() => {
    if (!montoNumero || montoNumero <= 0) return 0

    if (monedaPago === 'BS') return Number(montoNumero.toFixed(2))
    if (!tasaNumero || tasaNumero <= 0) return 0

    return Number((montoNumero * tasaNumero).toFixed(2))
  }, [montoNumero, monedaPago, tasaNumero])

  const saldoRestante = useMemo(() => {
    const restante = saldoUsd - montoUsdAplicado
    return Number(Math.max(restante, 0).toFixed(2))
  }, [saldoUsd, montoUsdAplicado])

  const excedeSaldo = montoUsdAplicado > saldoUsd
  const necesitaTasa = monedaPago === 'BS'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    try {
      setLoading(true)
      setError('')

      if (!montoNumero || montoNumero <= 0) {
        throw new Error('Debes ingresar un monto válido.')
      }

      if (!metodoPagoV2Id) {
        throw new Error('Debes seleccionar un método de pago.')
      }

      if (necesitaTasa && (!tasaNumero || tasaNumero <= 0)) {
        throw new Error('Debes indicar una tasa BCV válida.')
      }

      if (montoUsdAplicado <= 0) {
        throw new Error('El monto aplicado debe ser mayor a 0.')
      }

      if (excedeSaldo) {
        throw new Error('El cobro supera el saldo pendiente.')
      }

      await registrarCobroCuenta({
        cuenta_cobrar_id: cuenta.id,
        monto_pago: montoNumero,
        moneda_pago: monedaPago,
        metodo_pago_v2_id: metodoPagoV2Id,
        referencia: referencia.trim() || null,
        notas: notas.trim() || null,
        fecha,
        tasa_bcv: necesitaTasa ? tasaNumero : null,
      })

      onSuccess?.()
      onClose()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo registrar el cobro.')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0a0b0f] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <p className="text-sm font-medium tracking-wide text-white/55">
              Cobranzas / Registrar cobro
            </p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight text-white">
              {cuenta.cliente_nombre}
            </h3>
            <p className="mt-2 text-sm text-emerald-400">
              Saldo pendiente: {money(cuenta.saldo_usd, 'USD')}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-white/65 transition hover:bg-white/[0.08] hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          {error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Fecha *">
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={inputCls}
                required
              />
            </Field>

            <Field label="Moneda del pago *">
              <select
                value={monedaPago}
                onChange={(e) => setMonedaPago(e.target.value as 'USD' | 'BS')}
                className={inputCls}
              >
                <option value="USD" className="bg-[#11131a]">
                  USD
                </option>
                <option value="BS" className="bg-[#11131a]">
                  BS
                </option>
              </select>
            </Field>

            <Field label={`Monto en ${monedaPago} *`}>
              <input
                type="number"
                min="0"
                step="0.01"
                value={montoPago}
                onChange={(e) => setMontoPago(e.target.value)}
                placeholder={monedaPago === 'USD' ? '0.00' : '0,00'}
                className={inputCls}
                required
              />
            </Field>

            <Field label="Método de pago *">
              <select
                value={metodoPagoV2Id}
                onChange={(e) => setMetodoPagoV2Id(e.target.value)}
                className={inputCls}
                disabled={loadingMetodos}
                required
              >
                <option value="" className="bg-[#11131a]">
                  {loadingMetodos ? 'Cargando métodos...' : 'Selecciona un método'}
                </option>

                {metodosFiltrados.map((metodo) => (
                  <option key={metodo.id} value={metodo.id} className="bg-[#11131a]">
                    {metodo.nombre}
                    {metodo.cartera_nombre ? ` · ${metodo.cartera_nombre}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            {monedaPago === 'BS' ? (
              <Field label="Tasa BCV *">
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={tasaBcv}
                  onChange={(e) => setTasaBcv(e.target.value)}
                  placeholder="Ej: 40.25"
                  className={inputCls}
                  required
                />
              </Field>
            ) : (
              <div />
            )}

            <Field label="Referencia">
              <input
                type="text"
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                placeholder="Número de referencia..."
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Notas">
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={3}
              placeholder="Detalles adicionales..."
              className={cn(inputCls, 'resize-none')}
            />
          </Field>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/55">Saldo pendiente actual</span>
              <span className="font-semibold text-white">
                {money(saldoUsd, 'USD')}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-white/55">Aplicado a la cuenta en USD</span>
              <span className={cn('font-semibold', excedeSaldo ? 'text-rose-300' : 'text-emerald-400')}>
                {montoUsdAplicado > 0 ? money(montoUsdAplicado, 'USD') : '—'}
              </span>
            </div>

            {monedaPago === 'BS' && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-white/55">Monto recibido en Bs</span>
                <span className="font-semibold text-sky-300">
                  {montoBsMostrado > 0 ? money(montoBsMostrado, 'BS') : '—'}
                </span>
              </div>
            )}

            {monedaPago === 'BS' && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-white/55">Tasa BCV</span>
                <span className="font-semibold text-white">
                  {tasaNumero > 0 ? tasaNumero.toFixed(4) : '—'}
                </span>
              </div>
            )}

            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-white/55">Saldo restante</span>
              <span className="font-semibold text-white">
                {money(saldoRestante, 'USD')}
              </span>
            </div>

            {monedaPago === 'BS' && (
              <p className="mt-3 text-xs text-white/45">
                El pago entra en bolívares, pero a la deuda se le descuenta el equivalente en USD.
              </p>
            )}

            {excedeSaldo ? (
              <p className="mt-3 text-sm text-rose-300">
                El monto convertido a USD supera el saldo pendiente.
              </p>
            ) : null}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || excedeSaldo}
              className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registrando...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Registrar cobro
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4 text-sm font-semibold text-white/80 transition hover:bg-white/[0.07]"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-white/70">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-emerald-500/40 focus:bg-white/[0.07]'