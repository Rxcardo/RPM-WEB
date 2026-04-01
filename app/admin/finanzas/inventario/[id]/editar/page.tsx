'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { 
  obtenerProductoPorId, 
  actualizarProducto, 
  type NuevoProducto,
  type Producto 
} from '@/lib/inventario/inventario';

export default function EditarProductoPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<Partial<NuevoProducto>>({
    nombre: '',
    descripcion: '',
    unidad_medida: 'unidades',
    stock_minimo: 0,
    precio_venta_usd: 0,
    precio_compra_usd: 0,
    estado: 'activo',
  });

  useEffect(() => {
    if (id) {
      cargarProducto();
    }
  }, [id]);

  async function cargarProducto() {
    try {
      const producto = await obtenerProductoPorId(id);
      setFormData({
        nombre: producto.nombre,
        descripcion: producto.descripcion,
        unidad_medida: producto.unidad_medida,
        stock_minimo: producto.stock_minimo,
        precio_venta_usd: producto.precio_venta_usd,
        precio_compra_usd: producto.precio_compra_usd,
        estado: producto.estado,
      });
    } catch (error) {
      console.error('Error cargando producto:', error);
      setError('Error al cargar el producto');
    } finally {
      setCargando(false);
    }
  }

  function handleChange(field: keyof NuevoProducto, value: any) {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.nombre?.trim()) {
      setError('El nombre es requerido');
      return;
    }
    
    if ((formData.precio_venta_usd || 0) <= 0) {
      setError('El precio de venta debe ser mayor a 0');
      return;
    }
    
    if ((formData.precio_compra_usd || 0) <= 0) {
      setError('El precio de compra debe ser mayor a 0');
      return;
    }
    
    if ((formData.precio_venta_usd || 0) < (formData.precio_compra_usd || 0)) {
      setError('El precio de venta no puede ser menor al precio de compra');
      return;
    }
    
    try {
      setGuardando(true);
      setError('');
      
      await actualizarProducto(id, formData);
      
      router.push(`/admin/finanzas/inventario/${id}`);
      router.refresh();
    } catch (err: any) {
      console.error('Error actualizando producto:', err);
      setError(err.message || 'Error al actualizar el producto');
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const margen = (formData.precio_venta_usd || 0) - (formData.precio_compra_usd || 0);
  const porcentajeMargen = (formData.precio_compra_usd || 0) > 0
    ? ((margen / (formData.precio_compra_usd || 0)) * 100).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/admin/finanzas/inventario/${id}`}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Editar Producto</h1>
              <p className="text-sm text-gray-500">Modificar información del producto</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-4 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Información Básica</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Producto *
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => handleChange('nombre', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción
              </label>
              <textarea
                value={formData.descripcion || ''}
                onChange={(e) => handleChange('descripcion', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Unidad de Medida *
              </label>
              <select
                value={formData.unidad_medida}
                onChange={(e) => handleChange('unidad_medida', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="unidades">Unidades</option>
                <option value="botellas">Botellas</option>
                <option value="cilindros">Cilindros</option>
                <option value="paquetes">Paquetes</option>
                <option value="cajas">Cajas</option>
                <option value="litros">Litros</option>
                <option value="kg">Kilogramos</option>
                <option value="gramos">Gramos</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Stock</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stock Mínimo *
            </label>
            <input
              type="number"
              value={formData.stock_minimo}
              onChange={(e) => handleChange('stock_minimo', parseFloat(e.target.value) || 0)}
              min="0"
              step="0.01"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Alerta cuando el stock esté bajo
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Precios (USD)</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Precio de Compra *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={formData.precio_compra_usd}
                  onChange={(e) => handleChange('precio_compra_usd', parseFloat(e.target.value) || 0)}
                  min="0.01"
                  step="0.01"
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Precio de Venta *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={formData.precio_venta_usd}
                  onChange={(e) => handleChange('precio_venta_usd', parseFloat(e.target.value) || 0)}
                  min="0.01"
                  step="0.01"
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
          </div>

          {(formData.precio_compra_usd || 0) > 0 && (formData.precio_venta_usd || 0) > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 font-medium">Margen de Ganancia</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-900">
                    ${margen.toFixed(2)}
                  </p>
                  <p className="text-sm text-blue-700">
                    {porcentajeMargen}% de ganancia
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Link
            href={`/admin/finanzas/inventario/${id}`}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-center font-medium"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={guardando}
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
          >
            {guardando ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Guardar Cambios
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}