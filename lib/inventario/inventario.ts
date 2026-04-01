import { supabase } from '@/lib/supabase/client';

export type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  cantidad_actual: number;
  unidad_medida: string;
  stock_minimo: number;
  precio_venta_usd: number;
  precio_compra_usd: number;
  estado: 'activo' | 'inactivo';
  created_at: string;
  updated_at: string;
};

export type NuevoProducto = Omit<Producto, 'id' | 'created_at' | 'updated_at'>;

// Obtener todos los productos
export async function obtenerProductos(soloActivos = true) {
  let query = supabase
    .from('inventario')
    .select('*')
    .order('nombre', { ascending: true });
  
  if (soloActivos) {
    query = query.eq('estado', 'activo');
  }
  
  const { data, error } = await query;
  
  if (error) throw error;
  return data as Producto[];
}

// Obtener productos con stock bajo
export async function obtenerProductosStockBajo() {
  const { data, error } = await supabase
    .from('inventario')
    .select('*')
    .eq('estado', 'activo')
    .order('cantidad_actual', { ascending: true });
  
  if (error) throw error;
  
  // Filtrar en JavaScript los que tienen stock <= stock_minimo
  const stockBajo = (data as Producto[]).filter(
    p => p.cantidad_actual <= p.stock_minimo
  );
  
  return stockBajo;
}

// Obtener un producto por ID
export async function obtenerProductoPorId(id: string) {
  const { data, error } = await supabase
    .from('inventario')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Producto;
}

// Crear producto
export async function crearProducto(producto: NuevoProducto) {
  const { data, error } = await supabase
    .from('inventario')
    .insert([producto])
    .select()
    .single();
  
  if (error) throw error;
  return data as Producto;
}

// Actualizar producto
export async function actualizarProducto(id: string, cambios: Partial<NuevoProducto>) {
  const { data, error } = await supabase
    .from('inventario')
    .update(cambios)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Producto;
}

// Desactivar producto (soft delete)
export async function desactivarProducto(id: string) {
  return actualizarProducto(id, { estado: 'inactivo' });
}

// Activar producto
export async function activarProducto(id: string) {
  return actualizarProducto(id, { estado: 'activo' });
}

// Obtener estadísticas de inventario
export async function obtenerEstadisticasInventario() {
  const { data, error } = await supabase
    .from('inventario')
    .select('cantidad_actual, precio_compra_usd, precio_venta_usd')
    .eq('estado', 'activo');
  
  if (error) throw error;
  
  const productos = data as Producto[];
  
  return {
    totalProductos: productos.length,
    valorInventarioCompra: productos.reduce((sum, p) => sum + (p.cantidad_actual * p.precio_compra_usd), 0),
    valorInventarioVenta: productos.reduce((sum, p) => sum + (p.cantidad_actual * p.precio_venta_usd), 0),
    margenPotencial: productos.reduce((sum, p) => {
      return sum + ((p.precio_venta_usd - p.precio_compra_usd) * p.cantidad_actual);
    }, 0),
  };
}