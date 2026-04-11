'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { obtenerTasaBCV } from '@/lib/finanzas/tasas'

type MonedaPago = 'USD' | 'BS'
type MonedaReferencia = 'USD' | 'EUR'

type Props = {
  fecha: string
  monedaPago: MonedaPago
  monedaReferencia?: MonedaReferencia
  montoUSD?: number
  montoBs?: number
  onTasaChange: (tasa: number | null) => void
  onMontoBsChange?: (monto: number) => void
}

const r2 = (v: number) => Math.round(v * 100) / 100

function formatBs(v: number) {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    maximumFractionDigits: 2,
  }).format(v)
}

async function resolverTasaBCV(
  monedaReferencia: MonedaReferencia,
  fecha?: string
): Promise<number> {
  const fn = obtenerTasaBCV as any

  const candidatos = [
    () => fn(monedaReferencia, fecha),
    () => fn(monedaReferencia),
    () => fn(),
  ]

  let lastError: any = null

  for (const intento of candidatos) {
    try {
      const value = await intento()
      const tasa = Number(value)

      if (Number.isFinite(tasa) && tasa > 0) {
        return tasa
      }
    } catch (err) {
      lastError = err
    }
  }

  throw lastError || new Error('No se pudo obtener la tasa BCV')
}

const SelectorTasaBCV = memo(function SelectorTasaBCV({
  fecha,
  monedaPago,
  monedaReferencia = 'EUR',
  montoUSD = 0,
  montoBs,
  onTasaChange,
  onMontoBsChange,
}: Props) {
  const [cargando, setCargando] = useState(false)
  const [tasaActual, setTasaActual] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [montoBsLocal, setMontoBsLocal] = useState<number>(Number(montoBs || 0))

  const lastFetchKeyRef = useRef<string>('')

  useEffect(() => {
    setMontoBsLocal(Number(montoBs || 0))
  }, [montoBs])

  useEffect(() => {
    if (monedaPago !== 'BS') {
      setTasaActual(null)
      setErrorMsg('')
      return
    }

    const fetchKey = `${fecha}__${monedaPago}__${monedaReferencia}`

    if (lastFetchKeyRef.current === fetchKey && tasaActual) {
      return
    }

    let cancelled = false

    async function cargar() {
      setCargando(true)
      setErrorMsg('')

      try {
        const tasa = await resolverTasaBCV(monedaReferencia, fecha)

        if (cancelled) return

        setTasaActual(tasa)
        onTasaChange(tasa)
        lastFetchKeyRef.current = fetchKey
      } catch (err: any) {
        if (cancelled) return

        console.error('Error cargando tasa:', err)
        setErrorMsg(err?.message || 'No se pudo obtener la tasa BCV')
        setTasaActual(null)
        onTasaChange(null)
      } finally {
        if (!cancelled) {
          setCargando(false)
        }
      }
    }

    void cargar()

    return () => {
      cancelled = true
    }
  }, [fecha, monedaPago, monedaReferencia, onTasaChange, tasaActual])

  const montoBsCalculado = useMemo(() => {
    if (!tasaActual || montoUSD <= 0) return 0
    return r2(montoUSD * tasaActual)
  }, [montoUSD, tasaActual])

  useEffect(() => {
    if (monedaPago !== 'BS') return
    if (!onMontoBsChange) return
    if (!tasaActual || montoUSD <= 0) return

    const propMontoBs = Number(montoBs || 0)

    if (propMontoBs > 0) return

    const calculado = r2(montoUSD * tasaActual)
    setMontoBsLocal(calculado)
    onMontoBsChange(calculado)
  }, [monedaPago, montoUSD, montoBs, onMontoBsChange, tasaActual])

  if (monedaPago !== 'BS') return null

  return (
    <div className="space-y-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-amber-300">
          Pago en Bolívares
        </p>

        {cargando && (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            <span className="text-xs text-amber-400/70">Obteniendo tasa...</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
          <p className="text-sm text-rose-400">{errorMsg}</p>
        </div>
      )}

      {!cargando && !errorMsg && tasaActual && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs text-white/55">
                Tasa BCV ({monedaReferencia})
              </label>

              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="text-sm font-medium text-emerald-400">
                  Bs. {tasaActual.toFixed(4)}
                </span>

                <span className="ml-auto text-xs text-white/35">
                  {fecha
                    ? new Date(`${fecha}T00:00:00`).toLocaleDateString('es-VE', {
                        day: 'numeric',
                        month: 'short',
                      })
                    : ''}
                </span>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs text-white/55">
                Total en Bolívares
                {onMontoBsChange ? <span className="ml-1 text-white/35">(editable)</span> : null}
              </label>

              <input
                type="number"
                min={0}
                step="0.01"
                value={montoBsLocal || montoBsCalculado || ''}
                onChange={(e) => {
                  const valor = Number(e.target.value || 0)
                  setMontoBsLocal(valor)
                  onMontoBsChange?.(valor)
                }}
                readOnly={!onMontoBsChange}
                placeholder="0.00"
                className={`w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05] ${
                  !onMontoBsChange ? 'cursor-not-allowed opacity-60' : ''
                }`}
              />
            </div>
          </div>

          {montoUSD > 0 && tasaActual && (
            <div className="rounded-xl bg-white/[0.03] p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-white/55">Base equivalente USD:</span>
                <span className="text-white">${montoUSD.toFixed(2)}</span>
              </div>

              <div className="mt-1 flex justify-between">
                <span className="text-white/55">× Tasa BCV ({monedaReferencia}):</span>
                <span className="text-white">Bs. {tasaActual.toFixed(4)}</span>
              </div>

              <div className="mt-2 flex justify-between border-t border-white/10 pt-2">
                <span className="font-medium text-amber-300">Total calculado:</span>
                <span className="font-semibold text-amber-400">
                  {formatBs(montoBsCalculado)}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {!cargando && !errorMsg && !tasaActual && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="text-sm text-white/55">
            No se pudo obtener la tasa BCV para esta fecha.
          </p>
        </div>
      )}
    </div>
  )
})

export default SelectorTasaBCV