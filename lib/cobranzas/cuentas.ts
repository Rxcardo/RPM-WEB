import { supabase } from '@/lib/supabase/client'

export type CuentaPorCobrar = {
  id: string
  cliente_id: string | null
  cliente_nombre: string
  concepto: string
  tipo_origen: 'venta_inventario' | 'servicio' | 'otro'
  inventario_id: string | null
  cantidad_producto: number | null
  monto_total_usd: number
  monto_pagado_usd: number
  saldo_usd: number
  fecha_venta: string
  fecha_vencimiento: string | null
  estado: 'pendiente' | 'parcial' | 'vencida' | 'cobrada' | 'cancelada'
  notas: string | null
  registrado_por: string | null
  created_at: string
  updated_at: string
  cliente?: {
    nombre: string
    telefono: string | null
    email?: string | null
  }
  inventario?: {
    nombre: string
    unidad_medida: string
  }
}

export type NuevaCuentaCobrar = {
  cliente_id?: string
  cliente_nombre: string
  concepto: string
  tipo_origen: 'venta_inventario' | 'servicio' | 'otro'
  inventario_id?: string
  cantidad_producto?: number
  monto_total_usd: number
  fecha_venta: string
  fecha_vencimiento?: string
  notas?: string
  registrado_por?: string
}

export async function obtenerCuentasPorCobrar(filtros?: {
  estado?: string
  clienteId?: string
  fechaDesde?: string
  fechaHasta?: string
}) {
  let query = supabase
    .from('v_cuentas_por_cobrar_resumen')
    .select(`
      *,
      cliente:cliente_id(nombre, telefono),
      inventario:inventario_id(nombre, unidad_medida)
    `)
    .order('created_at', { ascending: false })

  if (filtros?.estado) {
    query = query.eq('estado', filtros.estado)
  }

  if (filtros?.clienteId) {
    query = query.eq('cliente_id', filtros.clienteId)
  }

  if (filtros?.fechaDesde) {
    query = query.gte('fecha_venta', filtros.fechaDesde)
  }

  if (filtros?.fechaHasta) {
    query = query.lte('fecha_venta', filtros.fechaHasta)
  }

  const { data, error } = await query

  if (error) throw error
  return (data || []) as CuentaPorCobrar[]
}

export async function obtenerCuentaPorId(id: string) {
  const { data, error } = await supabase
    .from('v_cuentas_por_cobrar_resumen')
    .select(`
      *,
      cliente:cliente_id(nombre, telefono, email),
      inventario:inventario_id(nombre, unidad_medida)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as CuentaPorCobrar
}

export async function crearCuentaPorCobrar(cuenta: NuevaCuentaCobrar) {
  const { data, error } = await supabase
    .from('cuentas_por_cobrar')
    .insert([
      {
        ...cuenta,
        monto_pagado_usd: 0,
        saldo_usd: cuenta.monto_total_usd,
        estado: 'pendiente',
      },
    ])
    .select()
    .single()

  if (error) throw error
  return data as CuentaPorCobrar
}

export async function actualizarEstadoCuenta(id: string, nuevoEstado: string) {
  const { data, error } = await supabase
    .from('cuentas_por_cobrar')
    .update({ estado: nuevoEstado })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as CuentaPorCobrar
}

export async function obtenerEstadisticasCobranzas() {
  const { data, error } = await supabase
    .from('v_cuentas_por_cobrar_resumen')
    .select('estado, saldo_usd, monto_total_usd')
    .in('estado', ['pendiente', 'parcial', 'vencida'])

  if (error) throw error

  const cuentas = (data || []) as CuentaPorCobrar[]

  return {
    totalPendiente: cuentas.reduce((sum, c) => sum + Number(c.saldo_usd || 0), 0),
    cantidadCuentas: cuentas.length,
    vencidas: cuentas.filter((c) => c.estado === 'vencida').length,
    montoVencido: cuentas
      .filter((c) => c.estado === 'vencida')
      .reduce((sum, c) => sum + Number(c.saldo_usd || 0), 0),
  }
}

export async function cancelarCuenta(id: string, motivo: string) {
  const { data, error } = await supabase
    .from('cuentas_por_cobrar')
    .update({
      estado: 'cancelada',
      notas: motivo,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data as CuentaPorCobrar
}