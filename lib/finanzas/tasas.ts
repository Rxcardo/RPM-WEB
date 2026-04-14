// lib/finanzas/tasas.ts

import { supabase } from '@/lib/supabase/client'

const TIMEOUT_MS = 8000

async function obtenerDesdeDolarAPI(): Promise<number | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const response = await fetch('https://ve.dolarapi.com/v1/euros/oficial', { signal: controller.signal, headers: { 'Accept': 'application/json' } })
    clearTimeout(timeoutId)
    if (!response.ok) throw new Error(`DolarAPI HTTP ${response.status}`)
    const data = await response.json()
    if (data && typeof data.promedio === 'number' && data.promedio > 0) {
      console.log('✅ Tasa BCV obtenida desde DolarAPI:', data.promedio)
      return data.promedio
    }
    throw new Error('DolarAPI: respuesta inválida')
  } catch (error: any) {
    if (error.name === 'AbortError') console.warn('⏱️ Timeout en DolarAPI')
    else console.warn('❌ Error en DolarAPI:', error.message)
    return null
  }
}

async function obtenerDesdeBCVDirecto(): Promise<number | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const response = await fetch('https://www.bcv.org.ve/', { signal: controller.signal, headers: { 'Accept': 'text/html' } })
    clearTimeout(timeoutId)
    if (!response.ok) throw new Error(`BCV HTTP ${response.status}`)
    const html = await response.text()
    const matches = html.match(/USD<\/strong>\s*<\/div>\s*<div[^>]*>\s*<strong>([0-9]+[,.]?[0-9]*)/i)
    if (matches && matches[1]) {
      const tasa = parseFloat(matches[1].replace(',', '.'))
      if (!isNaN(tasa) && tasa > 0) {
        console.log('✅ Tasa BCV obtenida desde BCV Directo:', tasa)
        return tasa
      }
    }
    throw new Error('BCV: no se pudo parsear la tasa')
  } catch (error: any) {
    if (error.name === 'AbortError') console.warn('⏱️ Timeout en BCV Directo')
    else console.warn('❌ Error en BCV Directo:', error.message)
    return null
  }
}

async function obtenerDesdeBDCache(): Promise<number | null> {
  try {
    const { data, error } = await supabase.from('tipos_cambio').select('tasa, fecha').eq('moneda_referencia', 'USD').order('fecha', { ascending: false }).limit(1).single()
    if (error) throw error
    if (data && data.tasa > 0) {
      const dias = Math.floor((Date.now() - new Date(data.fecha).getTime()) / (1000 * 60 * 60 * 24))
      console.log(`✅ Tasa BCV desde BD cache (${dias} días):`, data.tasa)
      return data.tasa
    }
    return null
  } catch (error: any) {
    console.warn('❌ Error obteniendo tasa desde BD:', error.message)
    return null
  }
}

async function guardarTasaEnBD(tasa: number, moneda: 'USD' | 'EUR' = 'USD'): Promise<void> {
  try {
    const hoy = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('tipos_cambio').upsert({ fecha: hoy, moneda_referencia: moneda, tasa, fuente: 'api' }, { onConflict: 'fecha,moneda_referencia' })
    if (error) console.warn('No se pudo guardar tasa en BD:', error.message)
    else console.log('💾 Tasa guardada en BD como cache')
  } catch (error) {
    console.warn('Error guardando tasa en BD:', error)
  }
}

export async function obtenerTasaBCV(): Promise<number> {
  console.log('🔄 Obteniendo tasa BCV...')
  let tasa = await obtenerDesdeDolarAPI()
  if (tasa && tasa > 0) { await guardarTasaEnBD(tasa); return tasa }
  console.log('⚠️ DolarAPI falló, intentando BCV Directo...')
  tasa = await obtenerDesdeBCVDirecto()
  if (tasa && tasa > 0) { await guardarTasaEnBD(tasa); return tasa }
  console.log('⚠️ BCV Directo falló, usando cache de BD...')
  tasa = await obtenerDesdeBDCache()
  if (tasa && tasa > 0) return tasa
  console.error('❌ No se pudo obtener tasa BCV de ninguna fuente')
  throw new Error('No se pudo obtener la tasa BCV. Verifica tu conexión o ingresa la tasa manualmente.')
}

// ── EUR (sucio pero funciona) ─────────────────────────────────────────────────

async function obtenerEurosDesdeDolarAPI(): Promise<number | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
    const response = await fetch('https://ve.dolarapi.com/v1/euros/oficial', { signal: controller.signal, headers: { 'Accept': 'application/json' } })
    clearTimeout(timeoutId)
    if (!response.ok) throw new Error(`DolarAPI EUR HTTP ${response.status}`)
    const data = await response.json()
    if (data && typeof data.promedio === 'number' && data.promedio > 0) {
      console.log('✅ Tasa EUR obtenida desde DolarAPI:', data.promedio)
      return data.promedio
    }
    throw new Error('DolarAPI EUR: respuesta inválida')
  } catch (error: any) {
    if (error.name === 'AbortError') console.warn('⏱️ Timeout en DolarAPI EUR')
    else console.warn('❌ Error en DolarAPI EUR:', error.message)
    return null
  }
}

async function obtenerEurosDesdeBDCache(): Promise<number | null> {
  try {
    const { data, error } = await supabase.from('tipos_cambio').select('tasa, fecha').eq('moneda_referencia', 'EUR').order('fecha', { ascending: false }).limit(1).single()
    if (error) throw error
    if (data && data.tasa > 0) {
      const dias = Math.floor((Date.now() - new Date(data.fecha).getTime()) / (1000 * 60 * 60 * 24))
      console.log(`✅ Tasa EUR desde BD cache (${dias} días):`, data.tasa)
      return data.tasa
    }
    return null
  } catch (error: any) {
    console.warn('❌ Error obteniendo tasa EUR desde BD:', error.message)
    return null
  }
}

export async function obtenerTasaBCVEuro(): Promise<number> {
  console.log('🔄 Obteniendo tasa EUR BCV...')
  let tasa = await obtenerEurosDesdeDolarAPI()
  if (tasa && tasa > 0) { await guardarTasaEnBD(tasa, 'EUR'); return tasa }
  console.log('⚠️ DolarAPI EUR falló, usando cache de BD...')
  tasa = await obtenerEurosDesdeBDCache()
  if (tasa && tasa > 0) return tasa
  console.error('❌ No se pudo obtener tasa EUR de ninguna fuente')
  throw new Error('No se pudo obtener la tasa EUR. Verifica tu conexión o ingresa la tasa manualmente.')
}

// ─────────────────────────────────────────────────────────────────────────────

export function calcularEquivalentes(monto: number, monedaOrigen: 'USD' | 'BS', tasaBCV: number): { usd: number; bs: number } {
  if (monedaOrigen === 'USD') return { usd: monto, bs: monto * tasaBCV }
  return { usd: monto / tasaBCV, bs: monto }
}

export function formatearMoneda(monto: number, moneda: 'USD' | 'BS'): string {
  if (moneda === 'BS') return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES', maximumFractionDigits: 2 }).format(monto)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(monto)
}

export async function obtenerTasaBCVDelDia(): Promise<number | null> {
  try {
    const hoy = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase.from('tipos_cambio').select('tasa').eq('moneda_referencia', 'USD').eq('fecha', hoy).single()
    if (error || !data) return null
    return data.tasa
  } catch { return null }
}

export type Moneda = 'USD' | 'BS'

export interface RegistrarPagoParams {
  fecha: string; concepto: string; categoria?: string; tipo_origen?: string
  cliente_id?: string | null; cita_id?: string | null; cliente_plan_id?: string | null
  monto: number; moneda: Moneda; tasa_bcv?: number | null; metodo_pago_id?: string | null
  estado?: 'pagado' | 'pendiente' | 'anulado'; notas?: string | null; referencia?: string | null
}

export function congelarMonto(params: RegistrarPagoParams) {
  const { monto, moneda, tasa_bcv } = params
  if (moneda === 'USD') {
    const tasaParaConversion = tasa_bcv || 0
    return { moneda_pago: 'USD', monto_pago: monto, tasa_bcv: tasaParaConversion > 0 ? tasaParaConversion : null, monto_equivalente_usd: monto, monto_equivalente_bs: tasaParaConversion > 0 ? monto * tasaParaConversion : null }
  }
  if (moneda === 'BS') {
    const tasaParaConversion = tasa_bcv || 0
    if (!tasaParaConversion || tasaParaConversion <= 0) throw new Error('Se requiere tasa BCV válida para pagos en Bolívares')
    return { moneda_pago: 'BS', monto_pago: monto, tasa_bcv: tasaParaConversion, monto_equivalente_usd: monto / tasaParaConversion, monto_equivalente_bs: monto }
  }
  throw new Error('Moneda no válida')
}