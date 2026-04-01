'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Filter, Calendar } from 'lucide-react';
import { obtenerMovimientos, type MovimientoInventario } from '@/lib/inventario/movimientos';

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'entrada' | 'salida' | 'ajuste'>('todos');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarMovimientos();
  }, [filtroTipo]);

  async function cargarMovimientos() {
    try {
      const data = await obtenerMovimientos({
        tipo: filtroTipo === 'todos' ? undefined : filtroTipo,
        limite: 100,
      });
      setMovimientos(data);
    } catch (error) {
      console.error('Error cargando movimientos:', error);
    } finally {
      setCargando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/admin/finanzas/inventario"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Movimientos</h1>
              <p className="text-sm text-gray-500">
                {movimientos.length} movimiento{movimientos.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setFiltroTipo('todos')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filtroTipo === 'todos'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroTipo('entrada')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filtroTipo === 'entrada'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Entradas
            </button>
            <button
              onClick={() => setFiltroTipo('salida')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filtroTipo === 'salida'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Salidas
            </button>
            <button
              onClick={() => setFiltroTipo('ajuste')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                filtroTipo === 'ajuste'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Ajustes
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {movimientos.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Filter className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay movimientos
            </h3>
            <p className="text-gray-600">
              No se encontraron movimientos con los filtros seleccionados
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {movimientos.map((mov) => (
              <div
                key={mov.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    mov.tipo === 'entrada' 
                      ? 'bg-green-100' 
                      : mov.tipo === 'salida' 
                      ? 'bg-red-100' 
                      : 'bg-blue-100'
                  }`}>
                    {mov.tipo === 'entrada' ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : mov.tipo === 'salida' ? (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    ) : (
                      <Filter className="w-5 h-5 text-blue-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 capitalize">
                          {mov.tipo}
                        </h3>
                        <p className="text-sm text-gray-600 truncate">
                          {mov.inventario?.nombre}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-xl font-bold ${
                          mov.tipo === 'entrada' 
                            ? 'text-green-600' 
                            : mov.tipo === 'salida' 
                            ? 'text-red-600' 
                            : 'text-blue-600'
                        }`}>
                          {mov.tipo === 'entrada' ? '+' : mov.tipo === 'salida' ? '-' : ''}
                          {mov.cantidad}
                        </p>
                        <p className="text-xs text-gray-500">
                          {mov.inventario?.unidad_medida}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-3">
                      {mov.concepto}
                    </p>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(mov.created_at).toLocaleDateString('es-VE')} - {' '}
                        {new Date(mov.created_at).toLocaleTimeString('es-VE', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                      <span>
                        {mov.cantidad_anterior} → {mov.cantidad_nueva}
                      </span>
                    </div>

                    {mov.monto_total_usd && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-sm text-gray-700">
                          Total: <span className="font-semibold">${mov.monto_total_usd.toFixed(2)}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}