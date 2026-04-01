import { supabase } from '@/lib/supabase/client'

export type MonedaCobro = 'USD' | 'VES'

export interface RegistrarCobroCuentaParams {
  cuenta_cobrar_id: string
  monto_pago: number
  moneda_pago: MonedaCobro
  metodo_pago_v2_id: string
  referencia?: string | null
  notas?: string | null
  fecha?: string
  tasa_bcv?: number | null
  registrado_por?: string | null
}

export interface CobroCuentaResultado {
  cuenta_cobrar_id: string
  pago_id: string
  abono_id: string
  cliente_id: string | null
  cliente_nombre: string | null
  monto_pago: number
  moneda_pago: MonedaCobro
  monto_usd_aplicado: number
  saldo_anterior_usd: number
  saldo_nuevo_usd: number
  estado_cuenta: string
}

export async function registrarCobroCuenta(
  params: RegistrarCobroCuentaParams
): Promise<CobroCuentaResultado> {
  const {
    cuenta_cobrar_id,
    monto_pago,
    moneda_pago,
    metodo_pago_v2_id,
    referencia = null,
    notas = null,
    fecha,
    tasa_bcv = null,
    registrado_por = null,
  } = params

  const { data, error } = await supabase.rpc('registrar_cobro_cuenta', {
    p_cuenta_cobrar_id: cuenta_cobrar_id,
    p_monto_pago: monto_pago,
    p_moneda_pago: moneda_pago,
    p_metodo_pago_v2_id: metodo_pago_v2_id,
    p_referencia: referencia,
    p_notas: notas,
    p_fecha: fecha ?? new Date().toISOString().slice(0, 10),
    p_tasa_bcv: tasa_bcv,
    p_registrado_por: registrado_por,
  })

  if (error) {
    throw new Error(error.message || 'No se pudo registrar el cobro.')
  }

  const row = Array.isArray(data) ? data[0] : data

  if (!row) {
    throw new Error('No se recibió respuesta del cobro.')
  }

  return {
    cuenta_cobrar_id: row.cuenta_cobrar_id,
    pago_id: row.pago_id,
    abono_id: row.abono_id,
    cliente_id: row.cliente_id,
    cliente_nombre: row.cliente_nombre,
    monto_pago: Number(row.monto_pago || 0),
    moneda_pago: row.moneda_pago,
    monto_usd_aplicado: Number(row.monto_usd_aplicado || 0),
    saldo_anterior_usd: Number(row.saldo_anterior_usd || 0),
    saldo_nuevo_usd: Number(row.saldo_nuevo_usd || 0),
    estado_cuenta: row.estado_cuenta,
  }
}