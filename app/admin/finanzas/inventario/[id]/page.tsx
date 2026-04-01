'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Edit,
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  History,
  BarChart3,
  Save,
} from 'lucide-react'
import {
  obtenerProductoPorId,
  desactivarProducto,
  activarProducto,
  actualizarProducto,
  type NuevoProducto,
  type Producto,
} from '@/lib/inventario/inventario'
import {
  obtenerMovimientosProducto,
  type MovimientoInventario,
} from '@/lib/inventario/movimientos'

type Vista = 'resumen' | 'editar'

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]'

const cardCls =
  'rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl'

function money(v: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(v || 0))
}

function movimientoColor(tipo: string) {
  if (tipo === 'entrada') return 'text-emerald-400'
  if (tipo === 'salida') return 'text-rose-400'
  return 'text-sky-400'
}

function movimientoBg(tipo: string) {
  if (tipo === 'entrada') return 'bg-emerald-400/10'
  if (tipo === 'salida') return 'bg-rose-400/10'
  return 'bg-sky-400/10'
}

export default function ProductoDetallePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [vista, setVista] = useState<Vista>('resumen')
  const [producto, setProducto] = useState<Producto | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([])
  const [cargando, setCargando] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState<Partial<NuevoProducto>>({
    nombre: '',
    descripcion: '',
    unidad_medida: 'unidades',
    stock_minimo: 0,
    precio_venta_usd: 0,
    precio_compra_usd: 0,
    estado: 'activo',
  })

  useEffect(() => {
    if (id) {
      void cargarDatos()
    }
  }, [id])

  async function cargarDatos() {
    try {
      setCargando(true)
      setError('')

      const [prod, movs] = await Promise.all([
        obtenerProductoPorId(id),
        obtenerMovimientosProducto(id, 20),
      ])

      setProducto(prod)
      setMovimientos(movs)

      setFormData({
        nombre: prod.nombre,
        descripcion: prod.descripcion,
        unidad_medida: prod.unidad_medida,
        stock_minimo: prod.stock_minimo,
        precio_venta_usd: prod.precio_venta_usd,
        precio_compra_usd: prod.precio_compra_usd,
        estado: prod.estado,
      })
    } catch (err) {
      console.error('Error cargando producto:', err)
      setError('Error al cargar el producto')
    } finally {
      setCargando(false)
    }
  }

  function handleChange(field: keyof NuevoProducto, value: any) {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError('')
  }

  async function handleToggleEstado() {
    if (!producto) return

    const confirmar = confirm(
      producto.estado === 'activo'
        ? '¿Desactivar este producto? No aparecerá en las listas activas.'
        : '¿Activar este producto?'
    )

    if (!confirmar) return

    try {
      setProcesando(true)

      if (producto.estado === 'activo') {
        await desactivarProducto(id)
      } else {
        await activarProducto(id)
      }

      await cargarDatos()
    } catch (err) {
      console.error('Error cambiando estado:', err)
      alert('Error al cambiar el estado del producto')
    } finally {
      setProcesando(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.nombre?.trim()) {
      setError('El nombre es requerido')
      return
    }

    if ((formData.precio_venta_usd || 0) <= 0) {
      setError('El precio de venta debe ser mayor a 0')
      return
    }

    if ((formData.precio_compra_usd || 0) <= 0) {
      setError('El precio de compra debe ser mayor a 0')
      return
    }

    if ((formData.precio_venta_usd || 0) < (formData.precio_compra_usd || 0)) {
      setError('El precio de venta no puede ser menor al precio de compra')
      return
    }

    try {
      setGuardando(true)
      setError('')

      await actualizarProducto(id, formData)
      await cargarDatos()
      setVista('resumen')
    } catch (err: any) {
      console.error('Error actualizando producto:', err)
      setError(err.message || 'Error al actualizar el producto')
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-sky-400" />
      </div>
    )
  }

  if (!producto) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <Package className="mx-auto mb-4 h-16 w-16 text-white/20" />
          <h3 className="mb-2 text-lg font-medium text-white">Producto no encontrado</h3>
          <Link
            href="/admin/finanzas/inventario"
            className="text-sky-300 hover:text-sky-200"
          >
            Volver a inventario
          </Link>
        </div>
      </div>
    )
  }

  const stockBajo = producto.cantidad_actual <= producto.stock_minimo
  const margen = producto.precio_venta_usd - producto.precio_compra_usd
  const porcentajeMargen =
    producto.precio_compra_usd > 0
      ? ((margen / producto.precio_compra_usd) * 100).toFixed(1)
      : '0'
  const valorStock = producto.cantidad_actual * producto.precio_venta_usd

  const margenEdit =
    (formData.precio_venta_usd || 0) - (formData.precio_compra_usd || 0)
  const porcentajeMargenEdit =
    (formData.precio_compra_usd || 0) > 0
      ? ((margenEdit / (formData.precio_compra_usd || 0)) * 100).toFixed(1)
      : '0'

  return (
    <div className="space-y-6 pb-8">
      <section className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/finanzas/inventario"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-white/70 transition hover:bg-white/[0.05] hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div>
            <p className="text-sm text-white/55">Finanzas / Inventario</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
              {producto.nombre}
            </h1>
            {producto.descripcion ? (
              <p className="mt-2 text-sm text-white/55">{producto.descripcion}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setVista('resumen')}
            className={
              vista === 'resumen'
                ? 'inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition'
                : 'inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.05] hover:text-white'
            }
          >
            Resumen
          </button>

          <button
            type="button"
            onClick={() => setVista('editar')}
            className={
              vista === 'editar'
                ? 'inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition'
                : 'inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.05] hover:text-white'
            }
          >
            <Edit className="h-4 w-4" />
            Editar
          </button>

          <button
            type="button"
            onClick={handleToggleEstado}
            disabled={procesando}
            className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
          >
            {procesando
              ? 'Procesando...'
              : producto.estado === 'activo'
              ? 'Desactivar'
              : 'Activar'}
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-4">
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}

      {vista === 'resumen' && (
        <>
          {stockBajo && producto.estado === 'activo' && (
            <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 text-amber-300" />
                <div>
                  <h3 className="font-semibold text-amber-200">Stock Bajo</h3>
                  <p className="mt-1 text-sm text-amber-300">
                    El stock actual ({producto.cantidad_actual} {producto.unidad_medida})
                    está en o por debajo del mínimo ({producto.stock_minimo}{' '}
                    {producto.unidad_medida})
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className={cardCls}>
              <div className="mb-3 flex items-center justify-between">
                <Package className="h-8 w-8 text-sky-300" />
              </div>
              <p className="text-sm text-white/55">Stock actual</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {producto.cantidad_actual}
              </p>
              <p className="mt-1 text-xs text-white/45">{producto.unidad_medida}</p>
            </div>

            <div className={cardCls}>
              <div className="mb-3 flex items-center justify-between">
                <DollarSign className="h-8 w-8 text-emerald-300" />
              </div>
              <p className="text-sm text-white/55">Valor stock</p>
              <p className="mt-2 text-3xl font-bold text-emerald-300">
                {money(valorStock)}
              </p>
              <p className="mt-1 text-xs text-white/45">A precio de venta</p>
            </div>

            <div className={cardCls}>
              <div className="mb-3 flex items-center justify-between">
                <TrendingUp className="h-8 w-8 text-violet-300" />
              </div>
              <p className="text-sm text-white/55">Precio venta</p>
              <p className="mt-2 text-3xl font-bold text-white">
                {money(producto.precio_venta_usd)}
              </p>
              <p className="mt-1 text-xs text-white/45">por {producto.unidad_medida}</p>
            </div>

            <div className={cardCls}>
              <div className="mb-3 flex items-center justify-between">
                <BarChart3 className="h-8 w-8 text-sky-300" />
              </div>
              <p className="text-sm text-white/55">Margen</p>
              <p className="mt-2 text-3xl font-bold text-sky-300">
                {porcentajeMargen}%
              </p>
              <p className="mt-1 text-xs text-white/45">{money(margen)} por unidad</p>
            </div>
          </div>

          <div className={cardCls}>
            <h2 className="mb-4 text-lg font-semibold text-white">Detalles del producto</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-white/55">Stock mínimo</p>
                <p className="mt-1 text-lg font-medium text-white">
                  {producto.stock_minimo} {producto.unidad_medida}
                </p>
              </div>

              <div>
                <p className="text-sm text-white/55">Unidad de medida</p>
                <p className="mt-1 text-lg font-medium capitalize text-white">
                  {producto.unidad_medida}
                </p>
              </div>

              <div>
                <p className="text-sm text-white/55">Precio de compra</p>
                <p className="mt-1 text-lg font-medium text-white">
                  {money(producto.precio_compra_usd)}
                </p>
              </div>

              <div>
                <p className="text-sm text-white/55">Precio de venta</p>
                <p className="mt-1 text-lg font-medium text-white">
                  {money(producto.precio_venta_usd)}
                </p>
              </div>

              <div>
                <p className="text-sm text-white/55">Estado</p>
                <p className="mt-1 text-lg font-medium capitalize text-white">
                  {producto.estado}
                </p>
              </div>

              <div>
                <p className="text-sm text-white/55">Fecha de creación</p>
                <p className="mt-1 text-lg font-medium text-white">
                  {new Date(producto.created_at).toLocaleDateString('es-VE')}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 p-5 md:p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <History className="h-5 w-5 text-white/60" />
                Últimos movimientos
              </h2>

              <Link
                href="/admin/finanzas/inventario"
                className="text-sm font-medium text-sky-300 hover:text-sky-200"
              >
                Ver todos
              </Link>
            </div>

            {movimientos.length === 0 ? (
              <div className="p-12 text-center">
                <History className="mx-auto mb-4 h-16 w-16 text-white/20" />
                <p className="text-white/55">No hay movimientos registrados</p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {movimientos.map((mov) => (
                  <div key={mov.id} className="p-4 md:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div
                          className={`rounded-2xl p-2 ${movimientoBg(mov.tipo)}`}
                        >
                          {mov.tipo === 'entrada' ? (
                            <TrendingUp className={`h-5 w-5 ${movimientoColor(mov.tipo)}`} />
                          ) : (
                            <TrendingDown className={`h-5 w-5 ${movimientoColor(mov.tipo)}`} />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-medium capitalize text-white">{mov.tipo}</p>
                          <p className="truncate text-sm text-white/60">{mov.concepto}</p>
                          <p className="mt-1 text-xs text-white/40">
                            {new Date(mov.created_at).toLocaleDateString('es-VE')} a las{' '}
                            {new Date(mov.created_at).toLocaleTimeString('es-VE', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className={`text-lg font-bold ${movimientoColor(mov.tipo)}`}>
                          {mov.tipo === 'entrada'
                            ? '+'
                            : mov.tipo === 'salida'
                            ? '-'
                            : ''}
                          {mov.cantidad}
                        </p>
                        <p className="text-xs text-white/45">
                          {mov.cantidad_anterior} → {mov.cantidad_nueva}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {vista === 'editar' && (
        <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
          <div className={cardCls}>
            <h2 className="mb-4 text-lg font-semibold text-white">Información básica</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Nombre del producto *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => handleChange('nombre', e.target.value)}
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion || ''}
                  onChange={(e) => handleChange('descripcion', e.target.value)}
                  rows={3}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Unidad de medida *
                </label>
                <select
                  value={formData.unidad_medida}
                  onChange={(e) => handleChange('unidad_medida', e.target.value)}
                  className={inputCls}
                  required
                >
                  <option value="unidades" className="bg-[#11131a]">Unidades</option>
                  <option value="botellas" className="bg-[#11131a]">Botellas</option>
                  <option value="cilindros" className="bg-[#11131a]">Cilindros</option>
                  <option value="paquetes" className="bg-[#11131a]">Paquetes</option>
                  <option value="cajas" className="bg-[#11131a]">Cajas</option>
                  <option value="litros" className="bg-[#11131a]">Litros</option>
                  <option value="kg" className="bg-[#11131a]">Kilogramos</option>
                  <option value="gramos" className="bg-[#11131a]">Gramos</option>
                </select>
              </div>
            </div>
          </div>

          <div className={cardCls}>
            <h2 className="mb-4 text-lg font-semibold text-white">Stock</h2>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/75">
                Stock mínimo *
              </label>
              <input
                type="number"
                value={formData.stock_minimo}
                onChange={(e) => handleChange('stock_minimo', parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                className={inputCls}
                required
              />
              <p className="mt-2 text-xs text-white/45">
                Alerta cuando el stock esté bajo
              </p>
            </div>
          </div>

          <div className={cardCls}>
            <h2 className="mb-4 text-lg font-semibold text-white">Precios (USD)</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Precio de compra *
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/45">
                    $
                  </span>
                  <input
                    type="number"
                    value={formData.precio_compra_usd}
                    onChange={(e) =>
                      handleChange('precio_compra_usd', parseFloat(e.target.value) || 0)
                    }
                    min="0.01"
                    step="0.01"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-8 pr-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Precio de venta *
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/45">
                    $
                  </span>
                  <input
                    type="number"
                    value={formData.precio_venta_usd}
                    onChange={(e) =>
                      handleChange('precio_venta_usd', parseFloat(e.target.value) || 0)
                    }
                    min="0.01"
                    step="0.01"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-8 pr-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]"
                    required
                  />
                </div>
              </div>
            </div>

            {(formData.precio_compra_usd || 0) > 0 && (formData.precio_venta_usd || 0) > 0 && (
              <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-sky-300">Margen de ganancia</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">{money(margenEdit)}</p>
                    <p className="text-sm text-sky-200">
                      {porcentajeMargenEdit}% de ganancia
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setVista('resumen')
                setError('')
              }}
              className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3 text-center text-sm font-medium text-white/80 transition hover:bg-white/[0.05] hover:text-white"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={guardando}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-500/20 px-6 py-3 text-sm font-semibold text-sky-300 transition hover:bg-sky-500/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {guardando ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-5 w-5" />
                  Guardar cambios
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}