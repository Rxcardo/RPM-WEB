'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, TrendingUp, Save } from 'lucide-react'
import Link from 'next/link'
import { obtenerProductos, type Producto } from '@/lib/inventario/inventario'
import { registrarEntrada } from '@/lib/inventario/movimientos'

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]'

const cardCls =
  'rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl'

export default function RegistrarEntradaPage() {
  const router = useRouter()
  const [productos, setProductos] = useState<Producto[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    inventario_id: '',
    cantidad: 0,
    precio_unitario_usd: 0,
    concepto: '',
  })

  useEffect(() => {
    cargarProductos()
  }, [])

  async function cargarProductos() {
    try {
      const data = await obtenerProductos()
      setProductos(data)
    } catch (error) {
      console.error('Error cargando productos:', error)
    }
  }

  const productoSeleccionado = productos.find((p) => p.id === formData.inventario_id)
  const total = formData.cantidad * formData.precio_unitario_usd

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.inventario_id) {
      setError('Selecciona un producto')
      return
    }

    if (formData.cantidad <= 0) {
      setError('La cantidad debe ser mayor a 0')
      return
    }

    if (formData.precio_unitario_usd <= 0) {
      setError('El precio unitario debe ser mayor a 0')
      return
    }

    if (!formData.concepto.trim()) {
      setError('El concepto es requerido')
      return
    }

    try {
      setGuardando(true)
      setError('')

      await registrarEntrada(formData)

      router.push('/admin/finanzas/inventario')
      router.refresh()
    } catch (err: any) {
      console.error('Error registrando entrada:', err)
      setError(err.message || 'Error al registrar la entrada')
    } finally {
      setGuardando(false)
    }
  }

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
              Registrar Entrada
            </h1>
            <p className="mt-2 text-sm text-white/55">Compra o ingreso de productos al stock.</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-4">
          <p className="text-sm text-rose-300">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
        <div className={cardCls}>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            Información de la compra
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/75">
                Producto *
              </label>
              <select
                value={formData.inventario_id}
                onChange={(e) => {
                  const producto = productos.find((p) => p.id === e.target.value)
                  setFormData((prev) => ({
                    ...prev,
                    inventario_id: e.target.value,
                    precio_unitario_usd: producto?.precio_compra_usd || 0,
                  }))
                  setError('')
                }}
                className={inputCls}
                required
              >
                <option value="" className="bg-[#11131a]">
                  Seleccionar producto...
                </option>
                {productos.map((producto) => (
                  <option key={producto.id} value={producto.id} className="bg-[#11131a]">
                    {producto.nombre} - Stock actual: {producto.cantidad_actual}{' '}
                    {producto.unidad_medida}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Cantidad *
                </label>
                <input
                  type="number"
                  value={formData.cantidad || ''}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      cantidad: parseFloat(e.target.value) || 0,
                    }))
                    setError('')
                  }}
                  min="0.01"
                  step="0.01"
                  className={inputCls}
                  required
                />
                {productoSeleccionado && (
                  <p className="mt-2 text-xs text-white/45">
                    Unidad: {productoSeleccionado.unidad_medida}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Precio unitario (USD) *
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/45">
                    $
                  </span>
                  <input
                    type="number"
                    value={formData.precio_unitario_usd || ''}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        precio_unitario_usd: parseFloat(e.target.value) || 0,
                      }))
                      setError('')
                    }}
                    min="0.01"
                    step="0.01"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-8 pr-4 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/75">
                Concepto *
              </label>
              <input
                type="text"
                value={formData.concepto}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, concepto: e.target.value }))
                  setError('')
                }}
                placeholder="Ej: Compra a proveedor X"
                className={inputCls}
                required
              />
            </div>
          </div>
        </div>

        {productoSeleccionado && formData.cantidad > 0 && (
          <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-6">
            <h3 className="mb-4 text-lg font-semibold text-emerald-300">Resumen</h3>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-white/55">Producto</span>
                <span className="font-medium text-white">{productoSeleccionado.nombre}</span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-white/55">Cantidad</span>
                <span className="font-medium text-white">
                  {formData.cantidad} {productoSeleccionado.unidad_medida}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-white/55">Precio unitario</span>
                <span className="font-medium text-white">
                  ${formData.precio_unitario_usd.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-3">
                <span className="font-semibold text-emerald-300">Total</span>
                <span className="text-xl font-bold text-white">${total.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between gap-4 text-xs">
                <span className="text-white/45">Stock nuevo</span>
                <span className="text-white/70">
                  {productoSeleccionado.cantidad_actual} →{' '}
                  {productoSeleccionado.cantidad_actual + formData.cantidad}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/admin/finanzas/inventario"
            className="inline-flex flex-1 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3 text-center text-sm font-medium text-white/80 transition hover:bg-white/[0.05] hover:text-white"
          >
            Cancelar
          </Link>

          <button
            type="submit"
            disabled={guardando}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/20 px-6 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white" />
                Registrando...
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                Registrar Entrada
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}