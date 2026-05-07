'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { obtenerTasaBCV } from '@/lib/finanzas/tasas'

export type MonedaBCV = 'USD' | 'EUR'

type TasasBCVState = {
  usd: number | null
  eur: number | null
  loading: boolean
  error: string
  updatedAt: string | null
  refresh: () => Promise<void>
}

function normalizeRate(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function resolverTasaBCV(moneda: MonedaBCV, fecha?: string): Promise<number> {
  const fn = obtenerTasaBCV as any
  const candidatos = [
    () => fn(moneda, fecha),
    () => fn(moneda),
    () => fn(),
  ]

  let lastError: unknown = null

  for (const intento of candidatos) {
    try {
      const raw = await intento()

      if (typeof raw === 'object' && raw !== null) {
        const obj = raw as Record<string, unknown>
        const posible =
          obj[moneda] ??
          obj[moneda.toLowerCase()] ??
          obj.tasa ??
          obj.valor ??
          obj.rate

        const tasaObj = normalizeRate(posible)
        if (tasaObj) return tasaObj
      }

      const tasa = normalizeRate(raw)
      if (tasa) return tasa
    } catch (err) {
      lastError = err
    }
  }

  throw lastError || new Error(`No se pudo obtener la tasa BCV ${moneda}`)
}

export function useTasasBCV(fecha?: string): TasasBCVState {
  const [usd, setUsd] = useState<number | null>(null)
  const [eur, setEur] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [usdRate, eurRate] = await Promise.all([
        resolverTasaBCV('USD', fecha),
        resolverTasaBCV('EUR', fecha),
      ])

      if (!mountedRef.current) return

      setUsd(usdRate)
      setEur(eurRate)
      setUpdatedAt(new Date().toISOString())
    } catch (err: any) {
      if (!mountedRef.current) return
      setError(err?.message || 'No se pudieron obtener las tasas BCV')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [fecha])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return useMemo(() => ({ usd, eur, loading, error, updatedAt, refresh }), [usd, eur, loading, error, updatedAt, refresh])
}
