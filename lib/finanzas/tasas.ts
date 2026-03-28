// lib/finanzas/tasas.ts
import { supabase } from '@/lib/supabase/client'

export type Moneda = 'USD' | 'BS'
type MonedaReferencia = 'USD' | 'EUR'

// ─────────────────────────────────────────────
// FORMATOS
// ─────────────────────────────────────────────

export function formatUSD(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '$0.00'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatBs(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return 'Bs 0,00'
  }

  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// ─────────────────────────────────────────────
// API BCV
// ─────────────────────────────────────────────

export async function obtenerTasaBCV(fecha: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://ve.dolarapi.com/v1/dolares/oficial?fecha=${fecha}`,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    let tasa: number | null = null

    if (Array.isArray(data) && data.length > 0) {
      tasa = data[0]?.promedio ?? data[0]?.precio ?? null
    } else if (data && typeof data === 'object') {
      tasa = data.promedio ?? data.precio ?? null
    }

    if (typeof tasa === 'number' && tasa > 0) {
      return Math.round(tasa * 100) / 100
    }

    return null
  } catch (error) {
    console.error('Error obteniendo tasa BCV:', error)
    return null
  }
}

export async function guardarTasaDia(
  fecha: string,
  tasa: number,
  moneda: MonedaReferencia = 'USD',
  fuente: 'BCV' | 'manual' = 'manual'
): Promise<void> {
  const { error } = await supabase.from('tipos_cambio').upsert(
    {
      fecha,
      moneda_referencia: moneda,
      tasa,
      fuente,
    },
    {
      onConflict: 'fecha,moneda_referencia',
    }
  )

  if (error) {
    console.error('Error guardando tasa:', error)
  }
}

export const guardarTasaManual = guardarTasaDia

export async function obtenerTasaMasReciente(): Promise<number | null> {
  const { data: latest } = await supabase
    .from('tipos_cambio')
    .select('tasa, fecha')
    .eq('moneda_referencia', 'USD')
    .order('fecha', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latest?.tasa) {
    return Number(latest.tasa)
  }

  const hoy = new Date()

  for (let i = 0; i < 30; i++) {
    const fecha = new Date(hoy)
    fecha.setDate(hoy.getDate() - i)
    const fechaStr = fecha.toISOString().split('T')[0]

    const tasa = await obtenerTasaBCV(fechaStr)

    if (tasa && tasa > 0) {
      await guardarTasaDia(fechaStr, tasa, 'USD', 'BCV')
      return tasa
    }
  }

  return null
}

export async function obtenerTasaDia(
  fecha: string,
  moneda: MonedaReferencia = 'USD'
): Promise<number | null> {
  const hoy = new Date().toISOString().split('T')[0]

  if (fecha > hoy) {
    return await obtenerTasaMasReciente()
  }

  const { data: cached } = await supabase
    .from('tipos_cambio')
    .select('tasa, fuente')
    .eq('fecha', fecha)
    .eq('moneda_referencia', moneda)
    .maybeSingle()

  if (cached?.tasa) {
    return Number(cached.tasa)
  }

  const tasaAPI = await obtenerTasaBCV(fecha)

  if (tasaAPI) {
    await guardarTasaDia(fecha, tasaAPI, moneda, 'BCV')
    return tasaAPI
  }

  return await obtenerTasaMasReciente()
}

// ─────────────────────────────────────────────
// CONVERSIÓN / CONGELAMIENTO
// ─────────────────────────────────────────────

export function congelarMonto(
  moneda_pago: Moneda,
  monto_pago: number,
  tasa_bcv: number | null
): {
  moneda_pago: Moneda
  monto_pago: number
  tasa_bcv: number | null
  monto_equivalente_usd: number
  monto_equivalente_bs: number | null
} {
  const r2 = (v: number) => Math.round(v * 100) / 100

  if (moneda_pago === 'USD') {
    return {
      moneda_pago,
      monto_pago,
      tasa_bcv: tasa_bcv || null,
      monto_equivalente_usd: r2(monto_pago),
      monto_equivalente_bs: tasa_bcv ? r2(monto_pago * tasa_bcv) : null,
    }
  }

  return {
    moneda_pago,
    monto_pago,
    tasa_bcv,
    monto_equivalente_usd: tasa_bcv ? r2(monto_pago / tasa_bcv) : 0,
    monto_equivalente_bs: r2(monto_pago),
  }
}

export function calcularEquivalentes(
  monto: number,
  moneda: Moneda,
  tasa: number
): {
  monto_equivalente_usd: number
  monto_equivalente_bs: number
} {
  const r2 = (v: number) => Math.round(v * 100) / 100

  if (moneda === 'USD') {
    return {
      monto_equivalente_usd: r2(monto),
      monto_equivalente_bs: tasa > 0 ? r2(monto * tasa) : 0,
    }
  }

  return {
    monto_equivalente_usd: tasa > 0 ? r2(monto / tasa) : 0,
    monto_equivalente_bs: r2(monto),
  }
}

export function convertirUsdABs(usd: number, tasa: number): number {
  return Math.round(usd * tasa * 100) / 100
}

export function convertirBsAUsd(bs: number, tasa: number): number {
  return Math.round((bs / tasa) * 100) / 100
}

export function esTasaValida(tasa: number | null | undefined): boolean {
  if (tasa === null || tasa === undefined) return false
  return tasa > 0 && Number.isFinite(tasa) && !Number.isNaN(tasa)
}