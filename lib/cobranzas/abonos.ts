import { supabase } from '@/lib/supabase/client'

export type Abono = {
  id: string
  cuenta_cobrar_id: string
  pago_id: string | null
  monto_usd: number
  metodo_pago_id: string | null
  metodo_pago_v2_id?: string | null
  referencia: string | null
  fecha: string
  notas: string | null
  registrado_por: string | null
  created_at: string
  metodo_pago?: {
    nombre: string
  } | null
}

export type NuevoAbono = {
  cuenta_cobrar_id: string
  monto_usd: number
  metodo_pago_id?: string | null
  metodo_pago_v2_id?: string | null
  referencia?: string | null
  fecha: string
  notas?: string | null
  registrado_por?: string | null
}

// Registrar abono a cuenta
export async function registrarAbono(abono: NuevoAbono) {
  // 1. Obtener cuenta actual
  const { data: cuenta, error: errorCuenta } = await supabase
    .from('cuentas_por_cobrar')
    .select('*')
    .eq('id', abono.cuenta_cobrar_id)
    .single()

  if (errorCuenta) throw errorCuenta
  if (!cuenta) throw new Error('No se encontró la cuenta por cobrar.')

  const montoAbono = Number(abono.monto_usd || 0)
  const saldoActual = Number(cuenta.saldo_usd || 0)
  const montoPagadoActual = Number(cuenta.monto_pagado_usd || 0)
  const montoTotal = Number(cuenta.monto_total_usd || 0)

  // 2. Validaciones
  if (montoAbono <= 0) {
    throw new Error('El abono debe ser mayor a 0.')
  }

  if (montoAbono > saldoActual) {
    throw new Error(
      `El abono (${montoAbono.toFixed(2)}) excede el saldo pendiente (${saldoActual.toFixed(2)}).`
    )
  }

  // 3. Crear registro en pagos
  const payloadPago = {
    fecha: abono.fecha,
    tipo_origen: 'otro_ingreso',
    cliente_id: cuenta.cliente_id || null,
    concepto: `Abono a cuenta por cobrar - ${cuenta.concepto}`,
    categoria: 'cobranzas',
    monto: montoAbono,
    monto_pago: montoAbono,
    moneda_pago: 'USD',
    monto_equivalente_usd: montoAbono,
    monto_equivalente_bs: null,
    metodo_pago_id: abono.metodo_pago_id || null,
    metodo_pago_v2_id: abono.metodo_pago_v2_id || null,
    referencia: abono.referencia || null,
    estado: 'pagado',
    es_cobro_credito: true,
    cuenta_cobrar_id: abono.cuenta_cobrar_id,
    registrado_por: abono.registrado_por || null,
  }

  const { data: pagoCreado, error: errorPago } = await supabase
    .from('pagos')
    .insert([payloadPago])
    .select('id')
    .single()

  if (errorPago) throw errorPago

  // 4. Crear el abono
  const payloadAbono = {
    cuenta_cobrar_id: abono.cuenta_cobrar_id,
    pago_id: pagoCreado.id,
    monto_usd: montoAbono,
    metodo_pago_id: abono.metodo_pago_id || null,
    metodo_pago_v2_id: abono.metodo_pago_v2_id || null,
    referencia: abono.referencia || null,
    fecha: abono.fecha,
    notas: abono.notas || null,
    registrado_por: abono.registrado_por || null,
  }

  const { data: nuevoAbono, error: errorAbono } = await supabase
    .from('abonos_cobranza')
    .insert([payloadAbono])
    .select(`
      *,
      metodo_pago:metodo_pago_v2_id(nombre)
    `)
    .single()

  if (errorAbono) throw errorAbono

  // 5. Actualizar la cuenta
  const nuevoMontoPagado = Number((montoPagadoActual + montoAbono).toFixed(2))
  const nuevoSaldo = Number((montoTotal - nuevoMontoPagado).toFixed(2))

  const nuevoEstado =
    nuevoSaldo <= 0 ? 'cobrada' : nuevoMontoPagado > 0 ? 'parcial' : 'pendiente'

  const { error: errorUpdate } = await supabase
    .from('cuentas_por_cobrar')
    .update({
      monto_pagado_usd: nuevoMontoPagado,
      saldo_usd: nuevoSaldo < 0 ? 0 : nuevoSaldo,
      estado: nuevoEstado,
    })
    .eq('id', abono.cuenta_cobrar_id)

  if (errorUpdate) throw errorUpdate

  return nuevoAbono as Abono
}

// Obtener abonos de una cuenta
export async function obtenerAbonosCuenta(cuentaId: string) {
  const { data, error } = await supabase
    .from('abonos_cobranza')
    .select(`
      *,
      metodo_pago:metodo_pago_v2_id(nombre)
    `)
    .eq('cuenta_cobrar_id', cuentaId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as Abono[]
}

// Obtener todos los abonos (historial)
export async function obtenerHistorialAbonos(limite = 100) {
  const { data, error } = await supabase
    .from('abonos_cobranza')
    .select(`
      *,
      metodo_pago:metodo_pago_v2_id(nombre),
      cuenta:cuenta_cobrar_id(concepto, cliente_nombre)
    `)
    .order('created_at', { ascending: false })
    .limit(limite)

  if (error) throw error
  return data || []
}