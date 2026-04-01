// lib/finanzas/pagos.ts

import { supabase } from '@/lib/supabase/client'
import { congelarMonto, type RegistrarPagoParams, type Moneda } from './tasas'

/**
 * Registrar un pago (ingreso) con montos congelados
 */
export async function registrarPago(params: RegistrarPagoParams) {
  try {
    // Congelar montos en ambas monedas
    const montosCongelados = congelarMonto(params)

    // Preparar payload completo
    const payload = {
      fecha: params.fecha,
      concepto: params.concepto,
      categoria: params.categoria || 'general',
      tipo_origen: params.tipo_origen || 'otro_ingreso',
      cliente_id: params.cliente_id || null,
      cita_id: params.cita_id || null,
      cliente_plan_id: params.cliente_plan_id || null,
      monto: params.monto,
      metodo_pago_id: params.metodo_pago_id || null,
      estado: params.estado || 'pagado',
      notas: params.notas || null,
      referencia: params.referencia || null,
      ...montosCongelados,
    }

    const { data, error } = await supabase
      .from('pagos')
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    return { data, error: null }
  } catch (error: any) {
    console.error('Error registrando pago:', error)
    return { data: null, error: error.message || 'Error al registrar pago' }
  }
}

/**
 * Actualizar un pago existente
 */
export async function actualizarPago(id: string, params: Partial<RegistrarPagoParams>) {
  try {
    let payload: any = { ...params }

    // Si se actualizan montos, recalcular congelados
    if (params.monto !== undefined && params.moneda !== undefined) {
      const montosCongelados = congelarMonto({
        monto: params.monto,
        moneda: params.moneda,
        tasa_bcv: params.tasa_bcv,
      } as RegistrarPagoParams)

      payload = {
        ...payload,
        ...montosCongelados,
      }
    }

    const { data, error } = await supabase
      .from('pagos')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return { data, error: null }
  } catch (error: any) {
    console.error('Error actualizando pago:', error)
    return { data: null, error: error.message || 'Error al actualizar pago' }
  }
}

/**
 * Obtener pagos con filtros
 */
export async function obtenerPagos(filtros?: {
  estado?: string
  tipo_origen?: string
  cliente_id?: string
  fecha_desde?: string
  fecha_hasta?: string
}) {
  try {
    let query = supabase
      .from('pagos')
      .select(`
        id, fecha, concepto, categoria, tipo_origen, estado,
        moneda_pago, monto_equivalente_usd, monto_equivalente_bs,
        tasa_bcv, referencia, notas, created_at,
        clientes:cliente_id(id, nombre),
        metodos_pago:metodo_pago_id(id, nombre)
      `)

    if (filtros?.estado) {
      query = query.eq('estado', filtros.estado)
    }

    if (filtros?.tipo_origen) {
      query = query.eq('tipo_origen', filtros.tipo_origen)
    }

    if (filtros?.cliente_id) {
      query = query.eq('cliente_id', filtros.cliente_id)
    }

    if (filtros?.fecha_desde) {
      query = query.gte('fecha', filtros.fecha_desde)
    }

    if (filtros?.fecha_hasta) {
      query = query.lte('fecha', filtros.fecha_hasta)
    }

    query = query.order('fecha', { ascending: false })
    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) throw error

    return { data, error: null }
  } catch (error: any) {
    console.error('Error obteniendo pagos:', error)
    return { data: null, error: error.message || 'Error al obtener pagos' }
  }
}

/**
 * Registrar un egreso con montos congelados
 */
export async function registrarEgreso(params: {
  fecha: string
  concepto: string
  categoria: string
  proveedor?: string | null
  monto: number
  moneda: Moneda
  tasa_bcv?: number | null
  metodo_pago_id?: string | null
  estado?: 'pagado' | 'pendiente' | 'anulado'
  notas?: string | null
  empleado_id?: string | null
}) {
  try {
    // Congelar montos en ambas monedas
    const montosCongelados = congelarMonto({
      monto: params.monto,
      moneda: params.moneda,
      tasa_bcv: params.tasa_bcv,
    } as RegistrarPagoParams)

    const payload = {
      fecha: params.fecha,
      concepto: params.concepto,
      categoria: params.categoria,
      proveedor: params.proveedor || null,
      monto: params.monto,
      metodo_pago_id: params.metodo_pago_id || null,
      estado: params.estado || 'pagado',
      notas: params.notas || null,
      empleado_id: params.empleado_id || null,
      moneda: montosCongelados.moneda_pago,
      tasa_bcv: montosCongelados.tasa_bcv,
      monto_equivalente_usd: montosCongelados.monto_equivalente_usd,
      monto_equivalente_bs: montosCongelados.monto_equivalente_bs,
    }

    const { data, error } = await supabase
      .from('egresos')
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    return { data, error: null }
  } catch (error: any) {
    console.error('Error registrando egreso:', error)
    return { data: null, error: error.message || 'Error al registrar egreso' }
  }
}