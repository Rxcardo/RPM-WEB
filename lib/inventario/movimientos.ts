import { supabase } from '@/lib/supabase/client';

export type MovimientoInventario = {
  id: string;
  inventario_id: string;
  tipo: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  cantidad_anterior: number;
  cantidad_nueva: number;
  concepto: string;
  precio_unitario_usd: number | null;
  monto_total_usd: number | null;
  pago_id: string | null;
  cuenta_cobrar_id: string | null;
  registrado_por: string | null;
  created_at: string;
  inventario?: {
    nombre: string;
    unidad_medida: string;
  };
};

export type NuevoMovimiento = {
  inventario_id: string;
  tipo: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  concepto: string;
  precio_unitario_usd?: number;
  monto_total_usd?: number;
  pago_id?: string;
  cuenta_cobrar_id?: string;
  registrado_por?: string;
};

// Registrar movimiento de inventario
export async function registrarMovimiento(movimiento: NuevoMovimiento) {
  // 1. Obtener cantidad actual
  const { data: producto, error: errorProducto } = await supabase
    .from('inventario')
    .select('cantidad_actual')
    .eq('id', movimiento.inventario_id)
    .single();
  
  if (errorProducto) throw errorProducto;
  
  const cantidadAnterior = producto.cantidad_actual;
  let nuevaCantidad = cantidadAnterior;
  
  // 2. Calcular nueva cantidad según tipo
  if (movimiento.tipo === 'entrada') {
    nuevaCantidad = cantidadAnterior + movimiento.cantidad;
  } else if (movimiento.tipo === 'salida') {
    nuevaCantidad = cantidadAnterior - movimiento.cantidad;
    if (nuevaCantidad < 0) {
      throw new Error('No hay suficiente stock disponible');
    }
  } else if (movimiento.tipo === 'ajuste') {
    nuevaCantidad = movimiento.cantidad; // En ajuste, la cantidad es el valor absoluto nuevo
  }
  
  // 3. Crear el movimiento
  const { data: nuevoMov, error: errorMov } = await supabase
    .from('movimientos_inventario')
    .insert([{
      ...movimiento,
      cantidad_anterior: cantidadAnterior,
      cantidad_nueva: nuevaCantidad,
    }])
    .select()
    .single();
  
  if (errorMov) throw errorMov;
  
  // 4. Actualizar cantidad en inventario
  const { error: errorUpdate } = await supabase
    .from('inventario')
    .update({ cantidad_actual: nuevaCantidad })
    .eq('id', movimiento.inventario_id);
  
  if (errorUpdate) throw errorUpdate;
  
  return nuevoMov as MovimientoInventario;
}

// Obtener movimientos de un producto
export async function obtenerMovimientosProducto(inventarioId: string, limite = 50) {
  const { data, error } = await supabase
    .from('movimientos_inventario')
    .select(`
      *,
      inventario:inventario_id(nombre, unidad_medida)
    `)
    .eq('inventario_id', inventarioId)
    .order('created_at', { ascending: false })
    .limit(limite);
  
  if (error) throw error;
  return data as MovimientoInventario[];
}

// Obtener todos los movimientos (con filtros)
export async function obtenerMovimientos(filtros?: {
  tipo?: 'entrada' | 'salida' | 'ajuste';
  fechaDesde?: string;
  fechaHasta?: string;
  limite?: number;
}) {
  let query = supabase
    .from('movimientos_inventario')
    .select(`
      *,
      inventario:inventario_id(nombre, unidad_medida)
    `)
    .order('created_at', { ascending: false });
  
  if (filtros?.tipo) {
    query = query.eq('tipo', filtros.tipo);
  }
  
  if (filtros?.fechaDesde) {
    query = query.gte('created_at', filtros.fechaDesde);
  }
  
  if (filtros?.fechaHasta) {
    query = query.lte('created_at', filtros.fechaHasta);
  }
  
  if (filtros?.limite) {
    query = query.limit(filtros.limite);
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data as MovimientoInventario[];
}

// Registrar entrada (compra)
export async function registrarEntrada(params: {
  inventario_id: string;
  cantidad: number;
  precio_unitario_usd: number;
  concepto: string;
  registrado_por?: string;
}) {
  return registrarMovimiento({
    inventario_id: params.inventario_id,
    tipo: 'entrada',
    cantidad: params.cantidad,
    concepto: params.concepto,
    precio_unitario_usd: params.precio_unitario_usd,
    monto_total_usd: params.cantidad * params.precio_unitario_usd,
    registrado_por: params.registrado_por,
  });
}

// Registrar salida (uso interno o venta)
export async function registrarSalida(params: {
  inventario_id: string;
  cantidad: number;
  concepto: string;
  precio_unitario_usd?: number;
  cuenta_cobrar_id?: string;
  registrado_por?: string;
}) {
  return registrarMovimiento({
    inventario_id: params.inventario_id,
    tipo: 'salida',
    cantidad: params.cantidad,
    concepto: params.concepto,
    precio_unitario_usd: params.precio_unitario_usd,
    monto_total_usd: params.precio_unitario_usd ? params.cantidad * params.precio_unitario_usd : undefined,
    cuenta_cobrar_id: params.cuenta_cobrar_id,
    registrado_por: params.registrado_por,
  });
}

// Registrar ajuste (corrección de stock)
export async function registrarAjuste(params: {
  inventario_id: string;
  cantidad_nueva: number;
  concepto: string;
  registrado_por?: string;
}) {
  return registrarMovimiento({
    inventario_id: params.inventario_id,
    tipo: 'ajuste',
    cantidad: params.cantidad_nueva, // En ajuste, cantidad es el valor absoluto
    concepto: params.concepto,
    registrado_por: params.registrado_por,
  });
}