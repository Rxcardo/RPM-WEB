// lib/finanzas/pagos.ts
import { supabase } from '@/lib/supabase/client'
import { congelarMonto, type Moneda } from './tasas'

export interface RegistrarPagoParams {
  fecha: string
  tipo_origen: 'plan' | 'cita' | 'abono' | 'ajuste'
  cliente_id: string
  cliente_plan_id?: string | null
  cita_id?: string | null
  concepto: string
  categoria?: string
  moneda_pago: Moneda
  monto_pago: number
  tasa_bcv: number | null
  metodo_pago_id: string
  notas?: string | null
  referencia?: string | null
}

export interface PagoRegistrado {
  id: string
  monto_equivalente_usd: number
  monto_equivalente_bs: number | null
}

export async function registrarPago(
  params: RegistrarPagoParams
): Promise<PagoRegistrado> {
  const montoCongelado = congelarMonto(
    params.moneda_pago,
    params.monto_pago,
    params.tasa_bcv
  )

  const { data, error } = await supabase
    .from('pagos')
    .insert({
      fecha: params.fecha,
      tipo_origen: params.tipo_origen,
      cliente_id: params.cliente_id,
      cliente_plan_id: params.cliente_plan_id || null,
      cita_id: params.cita_id || null,
      concepto: params.concepto,
      categoria: params.categoria || params.tipo_origen,
      moneda_pago: montoCongelado.moneda_pago,
      monto: montoCongelado.monto_pago,
      monto_pago: montoCongelado.monto_pago,
      tasa_bcv: montoCongelado.tasa_bcv,
      monto_equivalente_usd: montoCongelado.monto_equivalente_usd,
      monto_equivalente_bs: montoCongelado.monto_equivalente_bs,
      metodo_pago_id: params.metodo_pago_id,
      estado: 'pagado',
      notas: params.notas || null,
      referencia: params.referencia || null,
    })
    .select('id, monto_equivalente_usd, monto_equivalente_bs')
    .single()

  if (error) throw new Error(error.message)

  return {
    id: data.id,
    monto_equivalente_usd: Number(data.monto_equivalente_usd || 0),
    monto_equivalente_bs:
      data.monto_equivalente_bs !== null
        ? Number(data.monto_equivalente_bs)
        : null,
  }
}