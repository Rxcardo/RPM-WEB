'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase/client'

type Vista = 'productos' | 'nuevo' | 'movimientos'

type InventarioItem = {
  id: string
  nombre: string
  descripcion: string | null
  cantidad_actual: number | null
  unidad_medida: string | null
  stock_minimo: number | null
  precio_venta_usd: number | null
  precio_compra_usd: number | null
  estado: string | null
  created_at: string | null
}

type MovimientoInventario = {
  id: string
  inventario_id: string
  tipo: 'entrada' | 'salida' | 'ajuste' | string
  cantidad: number
  cantidad_anterior: number | null
  cantidad_nueva: number | null
  concepto: string
  precio_unitario_usd: number | null
  monto_total_usd: number | null
  created_at: string | null
  inventario?: {
    nombre: string
    unidad_medida: string | null
  } | null
}

type NuevoProductoForm = {
  nombre: string
  descripcion: string
  cantidad_actual: number
  unidad_medida: string
  stock_minimo: number
  precio_venta_usd: number
  precio_compra_usd: number
  estado: string
}

type RawInventarioRelacionado =
  | {
      nombre?: unknown
      unidad_medida?: unknown
    }
  | Array<{
      nombre?: unknown
      unidad_medida?: unknown
    }>
  | null
  | undefined

type RawMovimientoInventario = {
  id?: unknown
  inventario_id?: unknown
  tipo?: unknown
  cantidad?: unknown
  cantidad_anterior?: unknown
  cantidad_nueva?: unknown
  concepto?: unknown
  precio_unitario_usd?: unknown
  monto_total_usd?: unknown
  created_at?: unknown
  inventario?: RawInventarioRelacionado
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]'

const btnPrimary =
  'inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:scale-[1.01] hover:shadow-sky-500/35 active:scale-[0.99]'

const btnSecondary =
  'inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.05] hover:text-white'

function money(v: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(v || 0))
}

function formatNumber(v: number) {
  return new Intl.NumberFormat('es-VE', {
    maximumFractionDigits: 2,
  }).format(Number(v || 0))
}

function estadoBadge(estado: string) {
  if (estado === 'activo') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
  if (estado === 'inactivo') return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
  if (estado === 'agotado') return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
  if (estado === 'bajo') return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
  return 'border-white/10 bg-white/[0.05] text-white/70'
}

function movimientoBadge(tipo: string) {
  if (tipo === 'entrada') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
  if (tipo === 'salida') return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
  return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
}

function firstItem<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function toStringSafe(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback
  return String(value)
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return String(value)
}

function toNumberSafe(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeMovimiento(raw: RawMovimientoInventario): MovimientoInventario {
  const inventario = firstItem(raw.inventario)

  return {
    id: toStringSafe(raw.id),
    inventario_id: toStringSafe(raw.inventario_id),
    tipo: toStringSafe(raw.tipo),
    cantidad: toNumberSafe(raw.cantidad),
    cantidad_anterior: toNumberOrNull(raw.cantidad_anterior),
    cantidad_nueva: toNumberOrNull(raw.cantidad_nueva),
    concepto: toStringSafe(raw.concepto),
    precio_unitario_usd: toNumberOrNull(raw.precio_unitario_usd),
    monto_total_usd: toNumberOrNull(raw.monto_total_usd),
    created_at: toStringOrNull(raw.created_at),
    inventario: inventario?.nombre
      ? {
          nombre: toStringSafe(inventario.nombre),
          unidad_medida: toStringOrNull(inventario.unidad_medida),
        }
      : null,
  }
}

export default function InventarioPage() {
  const [vista, setVista] = useState<Vista>('productos')

  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [items, setItems] = useState<InventarioItem[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([])

  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [filtroTipoMov, setFiltroTipoMov] = useState<'todos' | 'entrada' | 'salida' | 'ajuste'>(
    'todos'
  )

  const [formData, setFormData] = useState<NuevoProductoForm>({
    nombre: '',
    descripcion: '',
    cantidad_actual: 0,
    unidad_medida: 'unidades',
    stock_minimo: 0,
    precio_venta_usd: 0,
    precio_compra_usd: 0,
    estado: 'activo',
  })

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError('')

      const [inventarioRes, movimientosRes] = await Promise.all([
        supabase
          .from('inventario')
          .select(`
            id,
            nombre,
            descripcion,
            cantidad_actual,
            unidad_medida,
            stock_minimo,
            precio_venta_usd,
            precio_compra_usd,
            estado,
            created_at
          `)
          .order('created_at', { ascending: false }),

        supabase
          .from('movimientos_inventario')
          .select(`
            id,
            inventario_id,
            tipo,
            cantidad,
            cantidad_anterior,
            cantidad_nueva,
            concepto,
            precio_unitario_usd,
            monto_total_usd,
            created_at,
            inventario:inventario_id (
              nombre,
              unidad_medida
            )
          `)
          .order('created_at', { ascending: false })
          .limit(100),
      ])

      if (inventarioRes.error) throw inventarioRes.error
      if (movimientosRes.error) throw movimientosRes.error

      setItems((inventarioRes.data || []) as InventarioItem[])
      setMovimientos(((movimientosRes.data || []) as RawMovimientoInventario[]).map(normalizeMovimiento))
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Error cargando inventario.')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setFormData({
      nombre: '',
      descripcion: '',
      cantidad_actual: 0,
      unidad_medida: 'unidades',
      stock_minimo: 0,
      precio_venta_usd: 0,
      precio_compra_usd: 0,
      estado: 'activo',
    })
  }

  async function handleCrearProducto(e: FormEvent) {
    e.preventDefault()

    if (!formData.nombre.trim()) {
      setError('El nombre es requerido')
      return
    }

    if (formData.precio_venta_usd <= 0) {
      setError('El precio de venta debe ser mayor a 0')
      return
    }

    if (formData.precio_compra_usd <= 0) {
      setError('El precio de compra debe ser mayor a 0')
      return
    }

    if (formData.precio_venta_usd < formData.precio_compra_usd) {
      setError('El precio de venta no puede ser menor al precio de compra')
      return
    }

    try {
      setGuardando(true)
      setError('')
      setSuccess('')

      const { error } = await supabase.from('inventario').insert({
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim() || null,
        cantidad_actual: Number(formData.cantidad_actual || 0),
        unidad_medida: formData.unidad_medida,
        stock_minimo: Number(formData.stock_minimo || 0),
        precio_venta_usd: Number(formData.precio_venta_usd || 0),
        precio_compra_usd: Number(formData.precio_compra_usd || 0),
        estado: formData.estado,
      })

      if (error) throw error

      setSuccess('Producto creado correctamente')
      resetForm()
      setVista('productos')
      await loadData()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'Error al crear el producto')
    } finally {
      setGuardando(false)
    }
  }

  const itemsConEstado = useMemo(() => {
    return items.map((item) => {
      const cantidad = Number(item.cantidad_actual || 0)
      const minimo = Number(item.stock_minimo || 0)

      let estadoVisual = item.estado || 'activo'

      if (cantidad <= 0) {
        estadoVisual = 'agotado'
      } else if (minimo > 0 && cantidad <= minimo) {
        estadoVisual = 'bajo'
      }

      return {
        ...item,
        estadoVisual,
      }
    })
  }, [items])

  const itemsFiltrados = useMemo(() => {
    return itemsConEstado.filter((item) => {
      if (estadoFiltro !== 'todos' && item.estadoVisual !== estadoFiltro) return false

      if (search.trim()) {
        const s = search.toLowerCase()
        return (
          item.nombre.toLowerCase().includes(s) ||
          (item.descripcion || '').toLowerCase().includes(s) ||
          (item.unidad_medida || '').toLowerCase().includes(s)
        )
      }

      return true
    })
  }, [itemsConEstado, search, estadoFiltro])

  const movimientosFiltrados = useMemo(() => {
    if (filtroTipoMov === 'todos') return movimientos
    return movimientos.filter((m) => m.tipo === filtroTipoMov)
  }, [movimientos, filtroTipoMov])

  const resumen = useMemo(() => {
    const totalProductos = itemsConEstado.length
    const activos = itemsConEstado.filter((i) => i.estadoVisual === 'activo').length
    const stockBajo = itemsConEstado.filter((i) => i.estadoVisual === 'bajo').length
    const agotados = itemsConEstado.filter((i) => i.estadoVisual === 'agotado').length

    const valorCompra = itemsConEstado.reduce((acc, item) => {
      return acc + Number(item.cantidad_actual || 0) * Number(item.precio_compra_usd || 0)
    }, 0)

    const valorVenta = itemsConEstado.reduce((acc, item) => {
      return acc + Number(item.cantidad_actual || 0) * Number(item.precio_venta_usd || 0)
    }, 0)

    return {
      totalProductos,
      activos,
      stockBajo,
      agotados,
      valorCompra,
      valorVenta,
    }
  }, [itemsConEstado])

  const margen = formData.precio_venta_usd - formData.precio_compra_usd
  const porcentajeMargen =
    formData.precio_compra_usd > 0
      ? ((margen / formData.precio_compra_usd) * 100).toFixed(1)
      : '0'

  return (
    <div className="space-y-6 pb-8">
      <section className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm text-white/55">Finanzas / Inventario</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
            Inventario
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Productos, registro de nuevos artículos y movimientos en una sola ruta.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setVista('productos')}
            className={vista === 'productos' ? btnPrimary : btnSecondary}
          >
            Productos
          </button>
          <button
            type="button"
            onClick={() => setVista('nuevo')}
            className={vista === 'nuevo' ? btnPrimary : btnSecondary}
          >
            Nuevo producto
          </button>
          <button
            type="button"
            onClick={() => setVista('movimientos')}
            className={vista === 'movimientos' ? btnPrimary : btnSecondary}
          >
            Movimientos
          </button>
          <Link href="/admin/finanzas/inventario/entrada" className={btnSecondary}>
            Entrada
          </Link>
          <Link href="/admin/finanzas/inventario/salida" className={btnSecondary}>
            Salida
          </Link>
        </div>
      </section>

      {error ? (
        <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      {vista === 'productos' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
              <p className="text-sm text-white/55">Total productos</p>
              <p className="mt-3 text-3xl font-bold text-white">{resumen.totalProductos}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
              <p className="text-sm text-white/55">Activos</p>
              <p className="mt-3 text-3xl font-bold text-emerald-400">{resumen.activos}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
              <p className="text-sm text-white/55">Stock bajo</p>
              <p className="mt-3 text-3xl font-bold text-amber-300">{resumen.stockBajo}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
              <p className="text-sm text-white/55">Agotados</p>
              <p className="mt-3 text-3xl font-bold text-rose-400">{resumen.agotados}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
              <p className="text-sm text-white/55">Valor compra</p>
              <p className="mt-3 text-3xl font-bold text-sky-300">
                {money(resumen.valorCompra)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
              <p className="text-sm text-white/55">Valor venta estimado</p>
              <p className="mt-3 text-3xl font-bold text-violet-300">
                {money(resumen.valorVenta)}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
              <p className="text-sm text-white/55">Margen potencial</p>
              <p className="mt-3 text-3xl font-bold text-emerald-300">
                {money(resumen.valorVenta - resumen.valorCompra)}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6 backdrop-blur-xl">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Buscar
                </label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre, descripción, unidad..."
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Estado
                </label>
                <select
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value)}
                  className={inputCls}
                >
                  <option value="todos" className="bg-[#11131a]">Todos</option>
                  <option value="activo" className="bg-[#11131a]">Activo</option>
                  <option value="bajo" className="bg-[#11131a]">Stock bajo</option>
                  <option value="agotado" className="bg-[#11131a]">Agotado</option>
                  <option value="inactivo" className="bg-[#11131a]">Inactivo</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setEstadoFiltro('todos')
                  }}
                  className={btnSecondary + ' w-full'}
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
            <div className="border-b border-white/10 p-5 md:p-6">
              <h2 className="text-lg font-semibold text-white">Listado de productos</h2>
              <p className="mt-1 text-sm text-white/55">
                {loading
                  ? 'Cargando inventario...'
                  : `${itemsFiltrados.length} producto(s) encontrados`}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03]">
                  <tr className="text-left text-white/55">
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Descripción</th>
                    <th className="px-4 py-3 font-medium">Cantidad</th>
                    <th className="px-4 py-3 font-medium">Unidad</th>
                    <th className="px-4 py-3 font-medium">Stock mínimo</th>
                    <th className="px-4 py-3 font-medium">Compra USD</th>
                    <th className="px-4 py-3 font-medium">Venta USD</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-white/55">
                        Cargando...
                      </td>
                    </tr>
                  ) : itemsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-white/55">
                        No hay productos registrados.
                      </td>
                    </tr>
                  ) : (
                    itemsFiltrados.map((item) => (
                      <tr key={item.id} className="transition hover:bg-white/[0.03]">
                        <td className="px-4 py-3 font-medium text-white">{item.nombre}</td>
                        <td className="px-4 py-3 text-white/75">{item.descripcion || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-white">
                          {formatNumber(Number(item.cantidad_actual || 0))}
                        </td>
                        <td className="px-4 py-3 text-white/75">{item.unidad_medida || '—'}</td>
                        <td className="px-4 py-3 text-white/75">
                          {formatNumber(Number(item.stock_minimo || 0))}
                        </td>
                        <td className="px-4 py-3 text-white/75">
                          {money(Number(item.precio_compra_usd || 0))}
                        </td>
                        <td className="px-4 py-3 text-white/75">
                          {money(Number(item.precio_venta_usd || 0))}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(
                              item.estadoVisual
                            )}`}
                          >
                            {item.estadoVisual}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/admin/finanzas/inventario/${item.id}`}
                              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/80 transition hover:bg-white/[0.05] hover:text-white"
                            >
                              Ver
                            </Link>
                            <Link
                              href={`/admin/finanzas/inventario/entrada?id=${item.id}`}
                              className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-400/15"
                            >
                              Entrada
                            </Link>
                            <Link
                              href={`/admin/finanzas/inventario/salida?id=${item.id}`}
                              className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-300 transition hover:bg-amber-400/15"
                            >
                              Salida
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {vista === 'nuevo' && (
        <form onSubmit={handleCrearProducto} className="mx-auto max-w-4xl space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
            <h2 className="mb-4 text-lg font-semibold text-white">Información básica</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Nombre del producto *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  placeholder="Ej: Agua mineral, gas, jabón..."
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Descripción
                </label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, descripcion: e.target.value }))
                  }
                  rows={3}
                  placeholder="Descripción opcional"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Unidad de medida *
                </label>
                <select
                  value={formData.unidad_medida}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, unidad_medida: e.target.value }))
                  }
                  className={inputCls}
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

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
            <h2 className="mb-4 text-lg font-semibold text-white">Stock inicial</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Cantidad inicial
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.cantidad_actual}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      cantidad_actual: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Stock mínimo
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.stock_minimo}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      stock_minimo: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
            <h2 className="mb-4 text-lg font-semibold text-white">Precios USD</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Precio de compra *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.precio_compra_usd}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      precio_compra_usd: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className={inputCls}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-white/75">
                  Precio de venta *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.precio_venta_usd}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      precio_venta_usd: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className={inputCls}
                />
              </div>
            </div>

            {formData.precio_compra_usd > 0 && formData.precio_venta_usd > 0 && (
              <div className="mt-4 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4">
                <p className="text-sm font-medium text-sky-300">Margen por unidad</p>
                <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <p className="text-2xl font-bold text-white">{money(margen)}</p>
                  <p className="text-sm text-sky-200">{porcentajeMargen}% de ganancia</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                resetForm()
                setVista('productos')
                setError('')
              }}
              className={btnSecondary + ' flex-1'}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={guardando}
              className={btnPrimary + ' flex-1'}
            >
              {guardando ? 'Guardando...' : 'Guardar producto'}
            </button>
          </div>
        </form>
      )}

      {vista === 'movimientos' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-6 backdrop-blur-xl">
            <div className="flex flex-wrap gap-2">
              {(['todos', 'entrada', 'salida', 'ajuste'] as const).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setFiltroTipoMov(tipo)}
                  className={
                    filtroTipoMov === tipo
                      ? btnPrimary
                      : 'rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/75 transition hover:bg-white/[0.05] hover:text-white'
                  }
                >
                  {tipo === 'todos'
                    ? 'Todos'
                    : tipo === 'entrada'
                    ? 'Entradas'
                    : tipo === 'salida'
                    ? 'Salidas'
                    : 'Ajustes'}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
            <div className="border-b border-white/10 p-5 md:p-6">
              <h2 className="text-lg font-semibold text-white">Movimientos</h2>
              <p className="mt-1 text-sm text-white/55">
                {movimientosFiltrados.length} movimiento(s)
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03]">
                  <tr className="text-left text-white/55">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Producto</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Cantidad</th>
                    <th className="px-4 py-3 font-medium">Concepto</th>
                    <th className="px-4 py-3 font-medium">Anterior</th>
                    <th className="px-4 py-3 font-medium">Nueva</th>
                    <th className="px-4 py-3 font-medium">Monto USD</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-white/55">
                        Cargando...
                      </td>
                    </tr>
                  ) : movimientosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-white/55">
                        No hay movimientos registrados.
                      </td>
                    </tr>
                  ) : (
                    movimientosFiltrados.map((mov) => (
                      <tr key={mov.id} className="transition hover:bg-white/[0.03]">
                        <td className="px-4 py-3 text-white/75">
                          {mov.created_at
                            ? new Date(mov.created_at).toLocaleString('es-VE')
                            : '—'}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          {mov.inventario?.nombre || 'Producto'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${movimientoBadge(
                              mov.tipo
                            )}`}
                          >
                            {mov.tipo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/75">
                          {formatNumber(Number(mov.cantidad || 0))}
                        </td>
                        <td className="px-4 py-3 text-white/75">{mov.concepto}</td>
                        <td className="px-4 py-3 text-white/75">
                          {formatNumber(Number(mov.cantidad_anterior || 0))}
                        </td>
                        <td className="px-4 py-3 text-white/75">
                          {formatNumber(Number(mov.cantidad_nueva || 0))}
                        </td>
                        <td className="px-4 py-3 text-white/75">
                          {money(Number(mov.monto_total_usd || 0))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}