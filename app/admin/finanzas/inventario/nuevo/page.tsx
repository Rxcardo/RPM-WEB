'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Package } from 'lucide-react';
import Link from 'next/link';
import { crearProducto, type NuevoProducto } from '@/lib/inventario/inventario';

export default function NuevoProductoPage() {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<NuevoProducto>({
    nombre: '',
    descripcion: '',
    cantidad_actual: 0,
    unidad_medida: 'unidades',
    stock_minimo: 0,
    precio_venta_usd: 0,
    precio_compra_usd: 0,
    estado: 'activo',
  });

  function handleChange(field: keyof NuevoProducto, value: any) {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validaciones
    if (!formData.nombre.trim()) {
      setError('El nombre es requerido');
      return;
    }
    
    if (formData.precio_venta_usd <= 0) {
      setError('El precio de venta debe ser mayor a 0');
      return;
    }
    
    if (formData.precio_compra_usd <= 0) {
      setError('El precio de compra debe ser mayor a 0');
      return;
    }
    
    if (formData.precio_venta_usd < formData.precio_compra_usd) {
      setError('El precio de venta no puede ser menor al precio de compra');
      return;
    }
    
    try {
      setGuardando(true);
      setError('');
      
      await crearProducto(formData);
      
      router.push('/admin/finanzas/inventario/productos');
      router.refresh();
    } catch (err: any) {
      console.error('Error creando producto:', err);
      setError(err.message || 'Error al crear el producto');
    } finally {
      setGuardando(false);
    }
  }

  const margen = formData.precio_venta_usd - formData.precio_compra_usd;
  const porcentajeMargen = formData.precio_compra_usd > 0
    ? ((margen / formData.precio_compra_usd) * 100).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/finanzas/inventario/productos"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Nuevo Producto</h1>
              <p className="text-sm text-gray-500">Agregar producto al inventario</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Información Básica */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Información Básica
          </h2>

          <div className="space-y-4">
            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del Producto *
              </label>
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => handleChange('nombre', e.target.value)}
                placeholder="Ej: Agua Mineral, Gas, Jabón..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descripción
              </label>
              <textarea
                value={formData.descripcion || ''}
                onChange={(e) => handleChange('descripcion', e.target.value)}
                placeholder="Descripción opcional del producto"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            {/* Unidad de Medida */}
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

        {/* Stock */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Stock Inicial</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Cantidad Actual */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cantidad Inicial
              </label>
              <input
                type="number"
                value={formData.cantidad_actual}
                onChange={(e) => handleChange('cantidad_actual', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Puedes dejarlo en 0 y agregarlo después
              </p>
            </div>

            {/* Stock Mínimo */}
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
        </div>

        {/* Precios */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Precios (USD)</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Precio de Compra */}
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
              <p className="text-xs text-gray-500 mt-1">
                Costo de adquisición
              </p>
            </div>

            {/* Precio de Venta */}
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
              <p className="text-xs text-gray-500 mt-1">
                Precio al cliente
              </p>
            </div>
          </div>

          {/* Margen */}
          {formData.precio_compra_usd > 0 && formData.precio_venta_usd > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-700 font-medium">Margen de Ganancia</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    Por unidad vendida
                  </p>
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

        {/* Botones */}
        <div className="flex gap-3">
          <Link
            href="/admin/finanzas/inventario/productos"
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
                Guardar Producto
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}