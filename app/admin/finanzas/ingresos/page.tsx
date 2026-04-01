'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  ArrowLeft,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Package2,
  User2,
} from 'lucide-react'
import Link from 'next/link'
import SelectorMetodoPago from '@/components/finanzas/SelectorMetodoPago'
import { calcularEquivalentes, formatearMoneda } from '@/lib/finanzas/tasas'

interface Cartera {
  nombre: string
  codigo: string
}

interface MetodoPago {
  id: string
  nombre: string
  tipo?: string | null
  moneda?: string | null
  cartera?: Cartera | null
}

interface Producto {
  id: string
  nombre: string
  descripcion: string | null
  cantidad_actual: number | null
  unidad_medida: string | null
  precio_venta_usd: number | null
  estado: string | null
}

interface Cliente {
  id: string
  nombre: string
  telefono?: string | null
  email?: string | null
}

interface TipoCambioRow {
  fecha?: string | null
  tasa?: number | string | null
  valor?: number | string | null
  monto?: number | string | null
  bcv?: number | string | null
  precio?: number | string | null
}

interface Pago {
  id: string
  fecha: string
  concepto: string
  categoria: string
  tipo_origen: string
  monto_equivalente_usd: number | null
  monto_equivalente_bs: number | null
  moneda_pago: string
  estado: string
  cliente_id?: string | null
  metodo_pago_id?: string | null
  metodo_pago_v2_id?: string | null
  notas?: string | null
  referencia?: string | null
  metodos_pago_v2?: { nombre: string } | null
  clientes?: { nombre: string } | null
}

type EstadoUI = 'pagado' | 'pendiente'
type EstadoFiltro = 'todos' | 'pagado' | 'pendiente' | 'anulado'

type RawCartera =
  | {
      nombre?: unknown
      codigo?: unknown
    }
  | Array<{
      nombre?: unknown
      codigo?: unknown
    }>
  | null
  | undefined

type RawMetodoPago = {
  id?: unknown
  nombre?: unknown
  tipo?: unknown
  moneda?: unknown
  cartera?: RawCartera
}

type RawPago = {
  id?: unknown
  fecha?: unknown
  concepto?: unknown
  categoria?: unknown
  tipo_origen?: unknown
  estado?: unknown
  moneda_pago?: unknown
  monto_equivalente_usd?: unknown
  monto_equivalente_bs?: unknown
  cliente_id?: unknown
  metodo_pago_id?: unknown
  metodo_pago_v2_id?: unknown
  notas?: unknown
  referencia?: unknown
  metodos_pago_v2?:
    | { nombre?: unknown }
    | Array<{ nombre?: unknown }>
    | null
    | undefined
  clientes?:
    | { nombre?: unknown }
    | Array<{ nombre?: unknown }>
    | null
    | undefined
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05]'

const labelCls = 'mb-2 block text-sm font-medium text-white/75'

const panelCls =
  'rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl'

const softButtonCls =
  'rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]'

function formatQty(v: number | null | undefined) {
  return new Intl.NumberFormat('es-VE', {
    maximumFractionDigits: 2,
  }).format(Number(v || 0))
}

function estadoUiDesdeDb(estado: string): EstadoUI {
  if (estado === 'pagado') return 'pagado'
  return 'pendiente'
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

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeCartera(raw: RawCartera): Cartera | null {
  const item = firstItem(raw)
  if (!item) return null

  const nombre = toStringOrNull(item.nombre)
  const codigo = toStringOrNull(item.codigo)

  if (!nombre || !codigo) return null

  return { nombre, codigo }
}

function normalizeMetodoPago(raw: RawMetodoPago): MetodoPago {
  return {
    id: toStringSafe(raw.id),
    nombre: toStringSafe(raw.nombre),
    tipo: toStringOrNull(raw.tipo),
    moneda: toStringOrNull(raw.moneda),
    cartera: normalizeCartera(raw.cartera),
  }
}

function normalizePago(raw: RawPago): Pago {
  const metodo = firstItem(raw.metodos_pago_v2)
  const cliente = firstItem(raw.clientes)

  return {
    id: toStringSafe(raw.id),
    fecha: toStringSafe(raw.fecha),
    concepto: toStringSafe(raw.concepto),
    categoria: toStringSafe(raw.categoria),
    tipo_origen: toStringSafe(raw.tipo_origen),
    monto_equivalente_usd: toNumberOrNull(raw.monto_equivalente_usd),
    monto_equivalente_bs: toNumberOrNull(raw.monto_equivalente_bs),
    moneda_pago: toStringSafe(raw.moneda_pago),
    estado: toStringSafe(raw.estado),
    cliente_id: toStringOrNull(raw.cliente_id),
    metodo_pago_id: toStringOrNull(raw.metodo_pago_id),
    metodo_pago_v2_id: toStringOrNull(raw.metodo_pago_v2_id),
    notas: toStringOrNull(raw.notas),
    referencia: toStringOrNull(raw.referencia),
    metodos_pago_v2: metodo?.nombre
      ? { nombre: toStringSafe(metodo.nombre) }
      : null,
    clientes: cliente?.nombre
      ? { nombre: toStringSafe(cliente.nombre) }
      : null,
  }
}

export default function IngresosPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [pagos, setPagos] = useState<Pago[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])

  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [clienteId, setClienteId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [concepto, setConcepto] = useState('')
  const [metodoPagoId, setMetodoPagoId] = useState('')
  const [estado, setEstado] = useState<EstadoUI>('pagado')
  const [notas, setNotas] = useState('')
  const [tasaBCV, setTasaBCV] = useState(0)
  const [referencia, setReferencia] = useState('')

  useEffect(() => {
    void cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)

    const [pagosRes, metodosRes, productosRes, clientesRes] = await Promise.all([
      supabase
        .from('pagos')
        .select(`
          id,
          fecha,
          concepto,
          categoria,
          tipo_origen,
          estado,
          moneda_pago,
          monto_equivalente_usd,
          monto_equivalente_bs,
          cliente_id,
          metodo_pago_id,
          metodo_pago_v2_id,
          notas,
          referencia,
          metodos_pago_v2:metodo_pago_v2_id(nombre),
          clientes:cliente_id(nombre)
        `)
        .eq('categoria', 'producto')
        .eq('tipo_origen', 'producto')
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false }),

      supabase
        .from('metodos_pago_v2')
        .select(`
          id,
          nombre,
          tipo,
          moneda,
          cartera:carteras(nombre, codigo)
        `),

      supabase
        .from('inventario')
        .select(`
          id,
          nombre,
          descripcion,
          cantidad_actual,
          unidad_medida,
          precio_venta_usd,
          estado
        `)
        .eq('estado', 'activo')
        .order('nombre'),

      supabase
        .from('clientes')
        .select('id, nombre, telefono, email')
        .order('nombre'),
    ])

    if (pagosRes.data) {
      setPagos((pagosRes.data as RawPago[]).map(normalizePago))
    }

    if (metodosRes.data) {
      setMetodosPago((metodosRes.data as RawMetodoPago[]).map(normalizeMetodoPago))
    }

    if (productosRes.data) {
      setProductos(productosRes.data as Producto[])
    }

    if (clientesRes.data) {
      setClientes(clientesRes.data as Cliente[])
    }

    setLoading(false)
  }

  const clienteSeleccionado = useMemo(
    () => clientes.find((c) => c.id === clienteId) || null,
    [clientes, clienteId]
  )

  const productoSeleccionado = useMemo(
    () => productos.find((p) => p.id === productoId) || null,
    [productos, productoId]
  )

  const precioUnitarioUSD = Number(productoSeleccionado?.precio_venta_usd || 0)

  const totalUSD = useMemo(() => {
    return Math.round(Number((cantidad || 0) * precioUnitarioUSD) * 100) / 100
  }, [cantidad, precioUnitarioUSD])

  const stockInsuficiente = useMemo(() => {
    if (!productoSeleccionado) return false
    return cantidad > Number(productoSeleccionado.cantidad_actual || 0)
  }, [productoSeleccionado, cantidad])

  const metodoSeleccionado = useMemo(
    () => metodosPago.find((m) => m.id === metodoPagoId) || null,
    [metodosPago, metodoPagoId]
  )

  const esBs = useMemo(() => {
    const moneda = (metodoSeleccionado?.moneda || '').toUpperCase()
    const nombre = (metodoSeleccionado?.nombre || '').toLowerCase()

    return (
      moneda === 'BS' ||
      moneda === 'VES' ||
      nombre.includes('bs') ||
      nombre.includes('bolívar') ||
      nombre.includes('bolivar') ||
      nombre.includes('pago móvil') ||
      nombre.includes('pago movil')
    )
  }, [metodoSeleccionado])

  const totalBs = useMemo(() => {
    if (!esBs || !tasaBCV || totalUSD <= 0) return 0
    return Math.round(totalUSD * tasaBCV * 100) / 100
  }, [esBs, tasaBCV, totalUSD])

  async function resolverTasaBCVActual() {
    if (tasaBCV && tasaBCV > 0) return tasaBCV

    const hoy = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('tipos_cambio')
      .select('*')
      .lte('fecha', hoy)
      .order('fecha', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    const row = data as TipoCambioRow | null

    const posibleTasa = Number(
      row?.tasa ?? row?.valor ?? row?.monto ?? row?.bcv ?? row?.precio ?? 0
    )

    if (!posibleTasa || posibleTasa <= 0) {
      throw new Error('No se pudo obtener la tasa BCV automática')
    }

    setTasaBCV(posibleTasa)
    return posibleTasa
  }

  useEffect(() => {
    if (!esBs || estado !== 'pagado') return
    if (tasaBCV > 0) return

    void resolverTasaBCVActual().catch((err) => {
      console.error('Error cargando tasa BCV automática:', err)
    })
  }, [esBs, estado, tasaBCV])

  async function descontarInventarioYCrearMovimiento(args: {
    pagoId?: string | null
    productoId: string
    cantidad: number
    cantidadAnterior: number
    cantidadNueva: number
    precioUnitarioUSD: number
    totalUSD: number
    conceptoMovimiento: string
  }) {
    const { error: invError } = await supabase
      .from('inventario')
      .update({
        cantidad_actual: args.cantidadNueva,
      })
      .eq('id', args.productoId)

    if (invError) throw invError

    const { error: movError } = await supabase
      .from('movimientos_inventario')
      .insert({
        inventario_id: args.productoId,
        tipo: 'salida',
        cantidad: args.cantidad,
        cantidad_anterior: args.cantidadAnterior,
        cantidad_nueva: args.cantidadNueva,
        concepto: args.conceptoMovimiento,
        precio_unitario_usd: args.precioUnitarioUSD,
        monto_total_usd: args.totalUSD,
        pago_id: args.pagoId || null,
      })

    if (movError) throw movError
  }

  async function crearCuentaPorCobrar(args: {
    clienteId: string
    clienteNombre: string
    concepto: string
    inventarioId: string
    cantidad: number
    totalUSD: number
    notas: string | null
    fechaVenta: string
  }) {
    const { error } = await supabase
      .from('cuentas_por_cobrar')
      .insert({
        cliente_id: args.clienteId,
        cliente_nombre: args.clienteNombre,
        concepto: args.concepto,
        tipo_origen: 'venta_inventario',
        inventario_id: args.inventarioId,
        cantidad_producto: args.cantidad,
        monto_total_usd: args.totalUSD,
        monto_pagado_usd: 0,
        saldo_usd: args.totalUSD,
        fecha_venta: args.fechaVenta,
        fecha_vencimiento: null,
        estado: 'pendiente',
        notas: args.notas,
        registrado_por: null,
      })

    if (error) throw error
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!productoId) {
      alert('Selecciona un producto')
      return
    }

    if (!clienteId) {
      alert('Selecciona un cliente')
      return
    }

    if (cantidad <= 0) {
      alert('La cantidad debe ser mayor a 0')
      return
    }

    if (stockInsuficiente) {
      alert('No hay suficiente stock disponible')
      return
    }

    if (estado === 'pagado' && !metodoPagoId) {
      alert('Selecciona un método de pago')
      return
    }

    if (!productoSeleccionado) {
      alert('Producto inválido')
      return
    }

    if (!clienteSeleccionado) {
      alert('Cliente inválido')
      return
    }

    setSaving(true)

    try {
      const conceptoFinal =
        concepto.trim() || `Venta de ${productoSeleccionado.nombre} x${cantidad}`

      if (editingId) {
        if (estado === 'pendiente') {
          alert('Para evitar inconsistencias, una venta editada no se cambia a pendiente desde aquí.')
          setSaving(false)
          return
        }

        let payload: any = {}

        if (esBs) {
          const tasaAplicada = await resolverTasaBCVActual()

          if (!tasaAplicada || tasaAplicada <= 0) {
            throw new Error('Debe colocar la tasa BCV')
          }

          const montoBsCalculado = Math.round(totalUSD * tasaAplicada * 100) / 100
          const equivalentes = calcularEquivalentes(
            montoBsCalculado,
            'BS',
            tasaAplicada
          )

          payload = {
            fecha,
            concepto: conceptoFinal,
            categoria: 'producto',
            tipo_origen: 'producto',
            cliente_id: clienteSeleccionado.id,
            moneda_pago: 'BS',
            monto: montoBsCalculado,
            tasa_bcv: tasaAplicada,
            monto_equivalente_usd: equivalentes.usd,
            monto_equivalente_bs: equivalentes.bs,
            metodo_pago_id: null,
            metodo_pago_v2_id: metodoPagoId,
            estado: 'pagado',
            notas: notas.trim() || null,
            referencia: referencia.trim() || null,
          }
        } else {
          payload = {
            fecha,
            concepto: conceptoFinal,
            categoria: 'producto',
            tipo_origen: 'producto',
            cliente_id: clienteSeleccionado.id,
            moneda_pago: 'USD',
            monto: totalUSD,
            tasa_bcv: null,
            monto_equivalente_usd: totalUSD,
            monto_equivalente_bs: null,
            metodo_pago_id: null,
            metodo_pago_v2_id: metodoPagoId,
            estado: 'pagado',
            notas: notas.trim() || null,
            referencia: referencia.trim() || null,
          }
        }

        const { error } = await supabase
          .from('pagos')
          .update(payload)
          .eq('id', editingId)

        if (error) throw error

        alert('✅ Ingreso actualizado')
        resetForm()
        await cargarDatos()
        return
      }

      if (estado === 'pendiente') {
        const cantidadAnterior = Number(productoSeleccionado.cantidad_actual || 0)
        const cantidadNueva = cantidadAnterior - cantidad

        await crearCuentaPorCobrar({
          clienteId: clienteSeleccionado.id,
          clienteNombre: clienteSeleccionado.nombre,
          concepto: conceptoFinal,
          inventarioId: productoId,
          cantidad,
          totalUSD,
          notas: notas.trim() || null,
          fechaVenta: fecha,
        })

        await descontarInventarioYCrearMovimiento({
          pagoId: null,
          productoId,
          cantidad,
          cantidadAnterior,
          cantidadNueva,
          precioUnitarioUSD,
          totalUSD,
          conceptoMovimiento: `Venta pendiente a ${clienteSeleccionado.nombre}`,
        })

        alert('✅ Venta enviada a cobranzas')
        resetForm()
        await cargarDatos()
        return
      }

      let payload: any = {}

      if (esBs) {
        const tasaAplicada = await resolverTasaBCVActual()

        if (!tasaAplicada || tasaAplicada <= 0) {
          throw new Error('Debe colocar la tasa BCV')
        }

        const montoBsCalculado = Math.round(totalUSD * tasaAplicada * 100) / 100
        const equivalentes = calcularEquivalentes(
          montoBsCalculado,
          'BS',
          tasaAplicada
        )

        payload = {
          fecha,
          concepto: conceptoFinal,
          categoria: 'producto',
          tipo_origen: 'producto',
          cliente_id: clienteSeleccionado.id,
          moneda_pago: 'BS',
          monto: montoBsCalculado,
          tasa_bcv: tasaAplicada,
          monto_equivalente_usd: equivalentes.usd,
          monto_equivalente_bs: equivalentes.bs,
          metodo_pago_id: null,
          metodo_pago_v2_id: metodoPagoId,
          estado: 'pagado',
          notas: notas.trim() || null,
          referencia: referencia.trim() || null,
        }
      } else {
        payload = {
          fecha,
          concepto: conceptoFinal,
          categoria: 'producto',
          tipo_origen: 'producto',
          cliente_id: clienteSeleccionado.id,
          moneda_pago: 'USD',
          monto: totalUSD,
          tasa_bcv: null,
          monto_equivalente_usd: totalUSD,
          monto_equivalente_bs: null,
          metodo_pago_id: null,
          metodo_pago_v2_id: metodoPagoId,
          estado: 'pagado',
          notas: notas.trim() || null,
          referencia: referencia.trim() || null,
        }
      }

      const { data, error } = await supabase
        .from('pagos')
        .insert(payload)
        .select('id')
        .single()

      if (error) throw error

      const cantidadAnterior = Number(productoSeleccionado.cantidad_actual || 0)
      const cantidadNueva = cantidadAnterior - cantidad

      await descontarInventarioYCrearMovimiento({
        pagoId: data.id,
        productoId,
        cantidad,
        cantidadAnterior,
        cantidadNueva,
        precioUnitarioUSD,
        totalUSD,
        conceptoMovimiento: `Venta a ${clienteSeleccionado.nombre}`,
      })

      alert('✅ Ingreso registrado')
      resetForm()
      await cargarDatos()
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo guardar'))
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setProductoId('')
    setClienteId('')
    setCantidad(1)
    setConcepto('')
    setMetodoPagoId('')
    setEstado('pagado')
    setNotas('')
    setReferencia('')
    setTasaBCV(0)
    setFecha(new Date().toISOString().slice(0, 10))
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(pago: Pago) {
    setEditingId(pago.id)
    setFecha(pago.fecha)
    setConcepto(pago.concepto)
    setProductoId('')
    setCantidad(1)
    setClienteId(pago.cliente_id || '')
    setMetodoPagoId(pago.metodo_pago_v2_id || '')
    setEstado(estadoUiDesdeDb(pago.estado))
    setNotas(pago.notas || '')
    setReferencia(pago.referencia || '')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function eliminarPago(id: string) {
    if (!confirm('¿Eliminar este ingreso?')) return

    try {
      const { error } = await supabase.from('pagos').delete().eq('id', id)
      if (error) throw error

      alert('✅ Ingreso eliminado')
      await cargarDatos()
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo eliminar'))
    }
  }

  const pagosFiltrados = useMemo(() => {
    return pagos.filter((pago) => {
      const estadoUi = estadoUiDesdeDb(pago.estado)

      if (estadoFiltro !== 'todos' && estadoUi !== estadoFiltro) return false

      if (search) {
        const s = search.toLowerCase()
        return (
          pago.concepto.toLowerCase().includes(s) ||
          pago.categoria.toLowerCase().includes(s) ||
          pago.tipo_origen.toLowerCase().includes(s) ||
          (pago.clientes?.nombre || '').toLowerCase().includes(s)
        )
      }

      return true
    })
  }, [pagos, estadoFiltro, search])

  const totales = useMemo(() => {
    const pagados = pagos.filter((p) => estadoUiDesdeDb(p.estado) === 'pagado')

    return {
      totalUSD: pagados.reduce(
        (sum, p) => sum + Number(p.monto_equivalente_usd || 0),
        0
      ),
      totalBS: pagados.reduce(
        (sum, p) => sum + Number(p.monto_equivalente_bs || 0),
        0
      ),
      cantidad: pagados.length,
    }
  }, [pagos])

  if (loading) {
    return (
      <div className="min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="h-24 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
          <div className="h-[500px] animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Link
              href="/admin/finanzas"
              className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white/90"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a Finanzas
            </Link>

            <p className="mt-4 text-sm text-white/55">Finanzas</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Ingresos por productos
            </h1>
            <p className="mt-2 text-sm text-white/55">
              Registra ventas del inventario y, si queda pendiente, se envía a cobranzas con el cliente correcto.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:w-auto">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
              <p className="text-xs text-white/55">Total USD</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {formatearMoneda(totales.totalUSD, 'USD')}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
              <p className="text-xs text-white/55">Total Bs</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {formatearMoneda(totales.totalBS, 'BS')}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
              <p className="text-xs text-white/55">Registros</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {totales.cantidad}
              </p>
            </div>
          </div>
        </div>

        {!showForm && (
          <div>
            <button
              onClick={() => setShowForm(true)}
              className="
                inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10
                bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/85 transition
                hover:bg-white/[0.06]
              "
            >
              <Plus className="h-4 w-4" />
              Nueva venta
            </button>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          {showForm && (
            <div className="xl:col-span-1">
              <form onSubmit={handleSubmit} className={`${panelCls} space-y-5 p-6`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {editingId ? 'Editar ingreso' : 'Nueva venta'}
                    </h2>
                    <p className="mt-1 text-xs text-white/45">
                      Completa los datos de la venta del inventario.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-full border border-white/10 bg-white/[0.03] p-2 text-white/50 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div>
                  <label className={labelCls}>Fecha *</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <label className={labelCls}>Cliente *</label>
                  <select
                    value={clienteId}
                    onChange={(e) => setClienteId(e.target.value)}
                    className={inputCls}
                    required
                  >
                    <option value="" className="bg-[#11131a]">
                      Seleccionar cliente...
                    </option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id} className="bg-[#11131a]">
                        {cliente.nombre}
                      </option>
                    ))}
                  </select>

                  {clienteSeleccionado && (
                    <div className="mt-3 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
                        <User2 className="h-4 w-4 text-white/70" />
                      </div>
                      <div className="min-w-0 text-xs text-white/60">
                        <p className="truncate font-medium text-white">
                          {clienteSeleccionado.nombre}
                        </p>
                        {clienteSeleccionado.telefono ? (
                          <p>{clienteSeleccionado.telefono}</p>
                        ) : null}
                        {clienteSeleccionado.email ? (
                          <p className="truncate">{clienteSeleccionado.email}</p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <label className={labelCls}>Producto *</label>
                  <select
                    value={productoId}
                    onChange={(e) => {
                      const id = e.target.value
                      setProductoId(id)

                      const prod = productos.find((p) => p.id === id)
                      if (prod) {
                        setConcepto(`Venta de ${prod.nombre} x${cantidad}`)
                      }
                    }}
                    className={inputCls}
                    required
                  >
                    <option value="" className="bg-[#11131a]">
                      Seleccionar producto...
                    </option>
                    {productos.map((prod) => (
                      <option key={prod.id} value={prod.id} className="bg-[#11131a]">
                        {prod.nombre} - Stock: {prod.cantidad_actual} {prod.unidad_medida}
                      </option>
                    ))}
                  </select>

                  {productoSeleccionado && (
                    <div className="mt-3 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
                        <Package2 className="h-4 w-4 text-white/70" />
                      </div>

                      <div className="min-w-0 text-xs text-white/60">
                        <p className="truncate font-medium text-white">
                          {productoSeleccionado.nombre}
                        </p>
                        <p>
                          Stock: {productoSeleccionado.cantidad_actual}{' '}
                          {productoSeleccionado.unidad_medida}
                        </p>
                        <p>
                          Precio venta:{' '}
                          {formatearMoneda(
                            Number(productoSeleccionado.precio_venta_usd || 0),
                            'USD'
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Cantidad *</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={cantidad}
                    onChange={(e) => {
                      const nuevaCantidad = Number(e.target.value) || 1
                      setCantidad(nuevaCantidad)

                      if (productoSeleccionado) {
                        setConcepto(`Venta de ${productoSeleccionado.nombre} x${nuevaCantidad}`)
                      }
                    }}
                    className={inputCls}
                    required
                  />
                  {productoSeleccionado && (
                    <p className="mt-2 text-xs text-white/45">
                      Disponible: {formatQty(productoSeleccionado.cantidad_actual)}{' '}
                      {productoSeleccionado.unidad_medida}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Concepto</label>
                  <input
                    type="text"
                    value={concepto}
                    onChange={(e) => setConcepto(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/55">Precio unitario USD</span>
                    <span className="font-semibold text-white">
                      {formatearMoneda(precioUnitarioUSD, 'USD')}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-white/55">Total USD</span>
                    <span className="font-semibold text-white">
                      {formatearMoneda(totalUSD, 'USD')}
                    </span>
                  </div>

                  {esBs && estado === 'pagado' && (
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-white/55">Total Bs</span>
                      <span className="font-semibold text-white">
                        {totalBs > 0 ? formatearMoneda(totalBs, 'BS') : '—'}
                      </span>
                    </div>
                  )}

                  {estado === 'pendiente' && (
                    <p className="mt-3 text-xs text-amber-300">
                      Si no paga, se envía a cobranzas con el cliente seleccionado.
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Estado</label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as EstadoUI)}
                    className={inputCls}
                  >
                    <option value="pagado" className="bg-[#11131a]">
                      Pagado
                    </option>
                    <option value="pendiente" className="bg-[#11131a]">
                      Pendiente
                    </option>
                  </select>
                </div>

                {estado === 'pagado' && (
                  <SelectorMetodoPago
                    metodoPagoId={metodoPagoId}
                    onMetodoPagoChange={setMetodoPagoId}
                    onTasaChange={setTasaBCV}
                    tasaActual={tasaBCV}
                    monto={estado === 'pagado' && esBs ? totalBs : totalUSD}
                  />
                )}

                <div>
                  <label className={labelCls}>Referencia (opcional)</label>
                  <input
                    type="text"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Número de referencia..."
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Notas (opcional)</label>
                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Detalles adicionales..."
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </div>

                {stockInsuficiente && (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3">
                    <p className="text-sm text-rose-300">
                      No hay suficiente stock para esta venta.
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={saving || !!stockInsuficiente}
                    className="
                      flex-1 rounded-2xl border border-white/10 bg-white/[0.03]
                      px-6 py-3.5 text-sm font-medium text-white transition
                      hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50
                    "
                  >
                    {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Registrar'}
                  </button>

                  <button
                    type="button"
                    onClick={resetForm}
                    className={softButtonCls}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className={`space-y-4 ${showForm ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
            <div className={`${panelCls} p-4`}>
              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por concepto o cliente..."
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-white/20 focus:bg-white/[0.05]"
                  />
                </div>

                <select
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-white/20 focus:bg-white/[0.05]"
                >
                  <option value="todos" className="bg-[#11131a]">Todos</option>
                  <option value="pagado" className="bg-[#11131a]">Pagado</option>
                  <option value="pendiente" className="bg-[#11131a]">Pendiente</option>
                  <option value="anulado" className="bg-[#11131a]">Anulado</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {pagosFiltrados.length === 0 ? (
                <div className={`${panelCls} p-12 text-center`}>
                  <p className="text-white/45">No hay ingresos registrados</p>
                </div>
              ) : (
                pagosFiltrados.map((pago) => {
                  const estadoUi = estadoUiDesdeDb(pago.estado)

                  return (
                    <div
                      key={pago.id}
                      className={`${panelCls} p-5 transition hover:bg-white/[0.04]`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-medium text-white">
                            {pago.concepto}
                          </h3>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
                            <span>{pago.fecha}</span>
                            <span>•</span>
                            <span>{pago.categoria}</span>
                            <span>•</span>
                            <span>{pago.tipo_origen}</span>
                            {pago.clientes?.nombre ? (
                              <>
                                <span>•</span>
                                <span>{pago.clientes.nombre}</span>
                              </>
                            ) : null}

                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                                estadoUi === 'pagado'
                                  ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                                  : 'border-amber-400/20 bg-amber-400/10 text-amber-300'
                              }`}
                            >
                              {estadoUi}
                            </span>
                          </div>

                          <div className="mt-3 text-xs text-white/45">
                            {pago.metodos_pago_v2?.nombre || 'Sin método'}
                          </div>
                        </div>

                        <div className="flex items-start gap-4 lg:ml-4 lg:flex-shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-white">
                              {formatearMoneda(Number(pago.monto_equivalente_usd || 0), 'USD')}
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              {formatearMoneda(Number(pago.monto_equivalente_bs || 0), 'BS')}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEdit(pago)}
                              className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>

                            <button
                              onClick={() => eliminarPago(pago.id)}
                              className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-2 text-rose-300 transition hover:bg-rose-400/15"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}