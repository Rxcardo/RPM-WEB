'use client'

import { useEffect, useState } from 'react'
import { obtenerTasaBCV } from '@/lib/finanzas/tasas'

type Moneda = 'USD' | 'BS'

type Props = {
  fecha: string
  monedaPago: Moneda
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

export default function SelectorTasaBCV({
  fecha,
  monedaPago,
  montoUSD = 0,
  montoBs,
  onTasaChange,
  onMontoBsChange,
}: Props) {
  const [cargando, setCargando] = useState(false)
  const [tasaActual, setTasaActual] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [montoBsLocal, setMontoBsLocal] = useState(montoBs || 0)

  useEffect(() => {
    if (monedaPago !== 'BS') return

    async function cargar() {
      setCargando(true)
      setErrorMsg('')

      try {
        const tasa = await obtenerTasaBCV()
        setTasaActual(tasa)
        onTasaChange(tasa)

        if (tasa && montoUSD > 0 && !montoBs) {
          const calculado = r2(montoUSD * tasa)
          setMontoBsLocal(calculado)
          onMontoBsChange?.(calculado)
        }
      } catch (err: any) {
        console.error('Error cargando tasa:', err)
        setErrorMsg(err?.message || 'No se pudo obtener la tasa BCV')
        setTasaActual(null)
        onTasaChange(null)
      } finally {
        setCargando(false)
      }
    }

    void cargar()
  }, [fecha, monedaPago, montoUSD, montoBs, onTasaChange, onMontoBsChange])

  useEffect(() => {
    if (!tasaActual || montoUSD <= 0 || montoBs) return
    const calculado = r2(montoUSD * tasaActual)
    setMontoBsLocal(calculado)
    onMontoBsChange?.(calculado)
  }, [montoUSD, tasaActual, montoBs, onMontoBsChange])

  if (monedaPago !== 'BS') return null

  const montoBsCalculado = tasaActual && montoUSD > 0 ? r2(montoUSD * tasaActual) : 0

  return (
    <div className="space-y-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-amber-300">Pago en Bolívares</p>
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
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-2 text-xs text-rose-300 underline"
          >
            Reintentar
          </button>
        </div>
      )}

      {!cargando && !errorMsg && tasaActual && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs text-white/55">Tasa BCV (USD)</label>
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
                {onMontoBsChange && <span className="ml-1 text-white/35">(editable)</span>}
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={montoBsLocal || montoBsCalculado || ''}
                onChange={(e) => {
                  const valor = Number(e.target.value)
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
                <span className="text-white/55">Base USD:</span>
                <span className="text-white">${montoUSD.toFixed(2)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-white/55">× Tasa BCV:</span>
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
}