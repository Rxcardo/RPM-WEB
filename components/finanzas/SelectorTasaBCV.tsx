'use client'

import { useEffect, useState } from 'react'
import { obtenerTasaDia, guardarTasaManual, formatBs, formatUSD } from '@/lib/finanzas/tasas'

interface Props {
  fecha: string
  monedaPago: 'USD' | 'BS'
  montoUSD: number
  montoBs?: number
  onTasaChange: (tasa: number | null) => void
  onMontoBsChange?: (monto: number) => void
  className?: string
}

const inputCls = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]
`

export default function SelectorTasaBCV({
  fecha,
  monedaPago,
  montoUSD,
  montoBs,
  onTasaChange,
  onMontoBsChange,
  className = '',
}: Props) {
  const [tasa, setTasa] = useState<string>('')
  const [cargando, setCargando] = useState(false)
  const [fuente, setFuente] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (monedaPago !== 'BS') {
      setTasa('')
      setFuente('')
      setError('')
      onTasaChange(null)
      return
    }

    void cargarTasa()
  }, [fecha, monedaPago])

  async function cargarTasa() {
    setCargando(true)
    setError('')
    setTasa('')

    try {
      const t = await obtenerTasaDia(fecha, 'USD')

      if (t && t > 0) {
        setTasa(String(t))
        setFuente('auto')
        onTasaChange(t)
      } else {
        setFuente('manual')
        setError('No se pudo obtener la tasa automáticamente. Ingresa la tasa BCV manualmente.')
      }
    } catch (err) {
      console.error('Error cargando tasa:', err)
      setError('Error al cargar la tasa')
      setFuente('manual')
    } finally {
      setCargando(false)
    }
  }

  async function handleTasaChange(value: string) {
    setTasa(value)
    const num = Number(value)

    if (num > 0) {
      onTasaChange(num)

      if (fuente === 'manual') {
        await guardarTasaManual(fecha, num, 'USD')
      }
    } else {
      onTasaChange(null)
    }
  }

  if (monedaPago !== 'BS') return null

  const tasaNum = Number(tasa) || 0
  const esTasaValida = tasaNum > 0

  const equivalenteBs =
    esTasaValida && montoUSD > 0
      ? Math.round(montoUSD * tasaNum * 100) / 100
      : null

  const equivalenteUsd =
    esTasaValida && (montoBs || 0) > 0
      ? Math.round(((montoBs || 0) / tasaNum) * 100) / 100
      : null

  return (
    <div className={`space-y-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-amber-300">Pago en bolívares</p>

        <button
          type="button"
          onClick={cargarTasa}
          disabled={cargando}
          className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-400/15 disabled:opacity-60"
        >
          {cargando ? 'Cargando...' : '↻ Actualizar tasa'}
        </button>
      </div>

      {cargando && <p className="text-xs text-white/60">🔄 Obteniendo tasa del BCV...</p>}
      {error && <p className="text-xs text-rose-400">{error}</p>}

      {fuente === 'auto' && tasa && !cargando && (
        <p className="text-xs text-emerald-400/70">✓ Tasa obtenida automáticamente (BCV)</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium text-white/60">
            Tasa BCV (Bs por USD)
          </label>

          <input
            type="number"
            step="0.0001"
            min="0"
            value={tasa}
            onChange={(e) => handleTasaChange(e.target.value)}
            placeholder="Ej: 459.45"
            className={inputCls}
          />

          {tasa && Number(tasa) > 0 && (
            <p className="mt-1 text-xs text-white/40">
              {Number(tasa).toLocaleString('es-VE')} Bs por USD
            </p>
          )}
        </div>

        {onMontoBsChange && (
          <div>
            <label className="mb-2 block text-xs font-medium text-white/60">
              Monto cobrado en Bs
            </label>

            <input
              type="number"
              step="0.01"
              min="0"
              value={montoBs ?? ''}
              onChange={(e) => onMontoBsChange(Number(e.target.value))}
              placeholder="0.00"
              className={inputCls}
            />
          </div>
        )}
      </div>

      {esTasaValida && (
        <div className="rounded-xl bg-white/[0.03] p-3">
          <p className="mb-2 text-xs text-white/45">Se guardará congelado así:</p>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {montoBs && montoBs > 0 ? (
              <>
                <div>
                  <p className="text-xs text-white/35">Cobrado en Bs</p>
                  <p className="font-semibold text-amber-300">{formatBs(montoBs)}</p>
                </div>

                <div>
                  <p className="text-xs text-white/35">Equivalente USD</p>
                  <p className="font-semibold text-emerald-400">
                    {equivalenteUsd ? formatUSD(equivalenteUsd) : '—'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-xs text-white/35">Precio USD</p>
                  <p className="font-semibold text-white">{formatUSD(montoUSD)}</p>
                </div>

                <div>
                  <p className="text-xs text-white/35">Equivalente Bs</p>
                  <p className="font-semibold text-amber-300">
                    {equivalenteBs ? formatBs(equivalenteBs) : '—'}
                  </p>
                </div>
              </>
            )}

            <div>
              <p className="text-xs text-white/35">Tasa BCV</p>
              <p className="font-medium text-white/70">
                Bs{' '}
                {tasaNum.toLocaleString('es-VE', {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 4,
                })}
              </p>
            </div>

            <div>
              <p className="text-xs text-white/35">Fecha</p>
              <p className="font-medium text-white/70">{fecha}</p>
            </div>
          </div>

          <p className="mt-2 text-xs text-white/30">
            ⚠️ Esta tasa quedará fija en el registro. No se recalculará.
          </p>
        </div>
      )}
    </div>
  )
}