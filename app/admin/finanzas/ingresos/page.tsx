'use client'

import { memo, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
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
  Wallet,
  Receipt,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import SelectorTasaBCV from '@/components/finanzas/SelectorTasaBCV'
import { formatearMoneda } from '@/lib/finanzas/tasas'
import { registrarAbonoMixto } from '@/lib/cobranzas/abonos'

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

interface CuentaPendienteResumen {
  id: string
  cliente_id: string | null
  cliente_nombre: string
  concepto: string
  monto_total_usd: number | null
  monto_pagado_usd: number | null
  saldo_usd: number | null
  fecha_venta: string
  fecha_vencimiento?: string | null
  estado: string
}

interface EstadoCuentaCliente {
  cliente_id: string
  total_pendiente_usd?: number | null
  credito_disponible_usd?: number | null
  saldo_pendiente_neto_usd?: number | null
  saldo_favor_neto_usd?: number | null
  total_pendiente_bs?: number | null
  credito_disponible_bs?: number | null
  saldo_pendiente_neto_bs?: number | null
  saldo_favor_neto_bs?: number | null
}

interface TipoCambioRow {
  fecha?: string | null
  tasa?: number | string | null
  valor?: number | string | null
  monto?: number | string | null
  bcv?: number | string | null
  precio?: number | string | null
}

interface PagoItem {
  id: string
  operacion_pago_id: string | null
  pago_item_no: number | null
  pago_items_total: number | null
  es_pago_mixto: boolean
  fecha: string
  concepto: string
  categoria: string
  tipo_origen: string
  monto: number | null
  monto_pago: number | null
  monto_equivalente_usd: number | null
  monto_equivalente_bs: number | null
  moneda_pago: string
  tasa_bcv: number | null
  estado: string
  cliente_id?: string | null
  inventario_id?: string | null
  cantidad_producto?: number | null
  metodo_pago_id?: string | null
  metodo_pago_v2_id?: string | null
  notas?: string | null
  referencia?: string | null
  metodos_pago_v2?: { nombre: string } | null
  clientes?: { nombre: string } | null
}

interface PagoOperacion {
  key: string
  id_representativo: string
  operacion_pago_id: string | null
  fecha: string
  concepto: string
  categoria: string
  tipo_origen: string
  estado: string
  cliente_id: string | null
  cliente_nombre: string | null
  inventario_id: string | null
  cantidad_producto: number | null
  total_usd: number
  total_bs: number
  es_pago_mixto: boolean
  items_total: number
  items: PagoItem[]
}

type EstadoUI = 'pagado' | 'pendiente'
type EstadoFiltro = 'todos' | 'pagado' | 'pendiente' | 'anulado'
type TipoIngresoUI = 'producto' | 'saldo'

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
  operacion_pago_id?: unknown
  pago_item_no?: unknown
  pago_items_total?: unknown
  es_pago_mixto?: unknown
  fecha?: unknown
  concepto?: unknown
  categoria?: unknown
  tipo_origen?: unknown
  estado?: unknown
  moneda_pago?: unknown
  tasa_bcv?: unknown
  monto?: unknown
  monto_pago?: unknown
  monto_equivalente_usd?: unknown
  monto_equivalente_bs?: unknown
  cliente_id?: unknown
  inventario_id?: unknown
  cantidad_producto?: unknown
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

type PagoMixtoItem = {
  id_local: string
  moneda_pago: 'USD' | 'BS'
  metodo_pago_v2_id: string
  monto_usd: string
  monto_bs: number | null
  tasa_bcv: number | null
  referencia: string
  notas: string
}

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05]'

const labelCls = 'mb-2 block text-sm font-medium text-white/75'

const panelCls =
  'rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl'

const softButtonCls =
  'rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]'

function r2(v: number) {
  return Math.round(Number(v || 0) * 100) / 100
}

function formatDateShort(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

function estadoFinancieroLabel(estado: EstadoCuentaCliente | null) {
  const pendiente = Number(estado?.saldo_pendiente_neto_usd || 0)
  const credito = Number(estado?.saldo_favor_neto_usd || 0)
  if (pendiente > 0.01) return 'Debe'
  if (credito > 0.01) return 'Crédito'
  return 'Al día'
}

function estadoFinancieroBadge(estado: EstadoCuentaCliente | null) {
  const pendiente = Number(estado?.saldo_pendiente_neto_usd || 0)
  const credito = Number(estado?.saldo_favor_neto_usd || 0)
  if (pendiente > 0.01) return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
  if (credito > 0.01) return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
  return 'border-white/10 bg-white/[0.04] text-white/70'
}

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
  if (value === null || value === undefined || value === '') return null
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

function normalizePago(raw: RawPago): PagoItem {
  const metodo = firstItem(raw.metodos_pago_v2)
  const cliente = firstItem(raw.clientes)

  return {
    id: toStringSafe(raw.id),
    operacion_pago_id: toStringOrNull(raw.operacion_pago_id),
    pago_item_no: toNumberOrNull(raw.pago_item_no),
    pago_items_total: toNumberOrNull(raw.pago_items_total),
    es_pago_mixto: Boolean(raw.es_pago_mixto),
    fecha: toStringSafe(raw.fecha),
    concepto: toStringSafe(raw.concepto),
    categoria: toStringSafe(raw.categoria),
    tipo_origen: toStringSafe(raw.tipo_origen),
    monto: toNumberOrNull(raw.monto),
    monto_pago: toNumberOrNull(raw.monto_pago),
    monto_equivalente_usd: toNumberOrNull(raw.monto_equivalente_usd),
    monto_equivalente_bs: toNumberOrNull(raw.monto_equivalente_bs),
    moneda_pago: toStringSafe(raw.moneda_pago),
    tasa_bcv: toNumberOrNull(raw.tasa_bcv),
    estado: toStringSafe(raw.estado),
    cliente_id: toStringOrNull(raw.cliente_id),
    inventario_id: toStringOrNull(raw.inventario_id),
    cantidad_producto: toNumberOrNull(raw.cantidad_producto),
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

function detectarMetodoBs(metodo: MetodoPago | null) {
  if (!metodo) return false

  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const tipo = (metodo.tipo || '').toLowerCase()
  const carteraCodigo = (metodo.cartera?.codigo || '').toLowerCase()

  return (
    moneda === 'BS' ||
    moneda === 'VES' ||
    nombre.includes('bs') ||
    nombre.includes('bolívar') ||
    nombre.includes('bolivar') ||
    nombre.includes('pago movil') ||
    nombre.includes('pago móvil') ||
    nombre.includes('movil') ||
    nombre.includes('móvil') ||
    tipo.includes('bs') ||
    tipo.includes('bolívar') ||
    tipo.includes('bolivar') ||
    tipo.includes('pago_movil') ||
    carteraCodigo.includes('bs') ||
    carteraCodigo.includes('ves')
  )
}

function detectarMetodoUsd(metodo: MetodoPago | null) {
  if (!metodo) return false

  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const carteraCodigo = (metodo.cartera?.codigo || '').toLowerCase()

  return (
    moneda === 'USD' ||
    nombre.includes('usd') ||
    nombre.includes('zelle') ||
    nombre.includes('efectivo $') ||
    nombre.includes('efectivo usd') ||
    carteraCodigo.includes('usd')
  )
}

function agruparPagosPorOperacion(items: PagoItem[]): PagoOperacion[] {
  const map = new Map<string, PagoOperacion>()

  for (const item of items) {
    const key = item.operacion_pago_id || item.id

    if (!map.has(key)) {
      map.set(key, {
        key,
        id_representativo: item.id,
        operacion_pago_id: item.operacion_pago_id,
        fecha: item.fecha,
        concepto: item.concepto,
        categoria: item.categoria,
        tipo_origen: item.tipo_origen,
        estado: item.estado,
        cliente_id: item.cliente_id || null,
        cliente_nombre: item.clientes?.nombre || null,
        inventario_id: item.inventario_id || null,
        cantidad_producto: item.cantidad_producto ?? null,
        total_usd: 0,
        total_bs: 0,
        es_pago_mixto: Boolean(item.es_pago_mixto),
        items_total: Number(item.pago_items_total || 1),
        items: [],
      })
    }

    const group = map.get(key)!
    group.items.push(item)
    group.total_usd = r2(group.total_usd + Number(item.monto_equivalente_usd || 0))
    group.total_bs = r2(group.total_bs + Number(item.monto_equivalente_bs || 0))
    group.es_pago_mixto = group.es_pago_mixto || Boolean(item.es_pago_mixto)
    group.items_total = Math.max(group.items_total, Number(item.pago_items_total || 1))
  }

  return Array.from(map.values()).sort((a, b) => {
    const fa = new Date(a.fecha).getTime()
    const fb = new Date(b.fecha).getTime()
    return fb - fa
  })
}

function makePagoItem(moneda: 'USD' | 'BS' = 'USD'): PagoMixtoItem {
  return {
    id_local: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    moneda_pago: moneda,
    metodo_pago_v2_id: '',
    monto_usd: '',
    monto_bs: null,
    tasa_bcv: null,
    referencia: '',
    notas: '',
  }
}

const PagoBsSelector = memo(function PagoBsSelector({
  fecha,
  montoUsd,
  montoBs,
  onChangeTasa,
  onChangeMontoBs,
}: {
  fecha: string
  montoUsd: number
  montoBs: number | null
  onChangeTasa: (tasa: number | null) => void
  onChangeMontoBs: (monto: number) => void
}) {
  return (
    <SelectorTasaBCV
      fecha={fecha}
      monedaPago="BS"
      monedaReferencia="EUR"
      montoUSD={montoUsd}
      montoBs={montoBs || undefined}
      onTasaChange={onChangeTasa}
      onMontoBsChange={onChangeMontoBs}
    />
  )
})

function LoadingIngresos() {
  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="h-24 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
        <div className="h-[500px] animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
      </div>
    </div>
  )
}

export default function IngresosPage() {
  return (
    <Suspense fallback={<LoadingIngresos />}>
      <IngresosPageContent />
    </Suspense>
  )
}

function IngresosPageContent() {
  const searchParams = useSearchParams()
  const clientePrefill = searchParams.get('cliente') || searchParams.get('clienteId') || ''
  const tipoIngresoPrefill = searchParams.get('tipoIngreso')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [pagos, setPagos] = useState<PagoItem[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])

  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingOperacionId, setEditingOperacionId] = useState<string | null>(null)

  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [tipoIngreso, setTipoIngreso] = useState<TipoIngresoUI>('producto')
  const [clienteId, setClienteId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [concepto, setConcepto] = useState('')
  const [estado, setEstado] = useState<EstadoUI>('pagado')
  const [notas, setNotas] = useState('')
  const [pagosMixtos, setPagosMixtos] = useState<PagoMixtoItem[]>([makePagoItem('USD')])
  const [estadoCuentaCliente, setEstadoCuentaCliente] = useState<EstadoCuentaCliente | null>(null)
  const [cuentasPendientesCliente, setCuentasPendientesCliente] = useState<CuentaPendienteResumen[]>([])
  const [cuentaCobrarSeleccionadaId, setCuentaCobrarSeleccionadaId] = useState('')
  const [modoAplicacionSaldo, setModoAplicacionSaldo] = useState<'credito' | 'deuda'>('credito')

  useEffect(() => {
    void cargarDatos()
  }, [])

  useEffect(() => {
    void cargarEstadoCuentaCliente(clienteId)
  }, [clienteId])

  useEffect(() => {
    if (!clientePrefill || clientes.length === 0 || editingId) return

    const clienteExiste = clientes.some((cliente) => cliente.id === clientePrefill)
    if (!clienteExiste) return

    setClienteId((prev) => (prev ? prev : clientePrefill))
    setShowForm(true)

    if (tipoIngresoPrefill === 'saldo') {
      setTipoIngreso('saldo')
      setEstado('pagado')
      setConcepto((prev) => prev || 'Recarga de saldo a favor')
      if (cuentasPendientesCliente.length > 0) {
        setModoAplicacionSaldo('deuda')
      }
    }
  }, [clientePrefill, tipoIngresoPrefill, clientes, editingId, cuentasPendientesCliente.length])

  async function cargarDatos() {
    setLoading(true)

    const [pagosRes, metodosRes, productosRes, clientesRes] = await Promise.all([
      supabase
        .from('pagos')
        .select(`
          id,
          operacion_pago_id,
          pago_item_no,
          pago_items_total,
          es_pago_mixto,
          fecha,
          concepto,
          categoria,
          tipo_origen,
          estado,
          moneda_pago,
          tasa_bcv,
          monto,
          monto_pago,
          monto_equivalente_usd,
          monto_equivalente_bs,
          cliente_id,
          inventario_id,
          cantidad_producto,
          metodo_pago_id,
          metodo_pago_v2_id,
          notas,
          referencia,
          metodos_pago_v2:metodo_pago_v2_id(nombre),
          clientes:cliente_id(nombre)
        `)
        .in('categoria', ['producto', 'saldo_cliente'])
        .in('tipo_origen', ['producto', 'saldo_cliente'])
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
        `)
        .eq('activo', true)
        .eq('permite_recibir', true),

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

  async function cargarEstadoCuentaCliente(id: string) {
    if (!id) {
      setEstadoCuentaCliente(null)
      setCuentasPendientesCliente([])
      setCuentaCobrarSeleccionadaId('')
      setModoAplicacionSaldo('credito')
      return
    }

    const [estadoRes, cuentasRes] = await Promise.all([
      supabase
        .from('v_clientes_estado_cuenta')
        .select(`
          cliente_id,
          total_pendiente_usd,
          credito_disponible_usd,
          saldo_pendiente_neto_usd,
          saldo_favor_neto_usd,
          total_pendiente_bs,
          credito_disponible_bs,
          saldo_pendiente_neto_bs,
          saldo_favor_neto_bs
        `)
        .eq('cliente_id', id)
        .maybeSingle(),
      supabase
        .from('v_cuentas_por_cobrar_resumen')
        .select(`
          id,
          cliente_id,
          cliente_nombre,
          concepto,
          monto_total_usd,
          monto_pagado_usd,
          saldo_usd,
          fecha_venta,
          fecha_vencimiento,
          estado
        `)
        .eq('cliente_id', id)
        .in('estado', ['pendiente', 'parcial', 'vencida'])
        .order('fecha_venta', { ascending: true }),
    ])

    if (estadoRes.error) {
      console.error('Error cargando estado de cuenta del cliente', estadoRes.error)
      setEstadoCuentaCliente(null)
    } else {
      setEstadoCuentaCliente((estadoRes.data as EstadoCuentaCliente | null) ?? null)
    }

    if (cuentasRes.error) {
      console.error('Error cargando cuentas pendientes del cliente', cuentasRes.error)
      setCuentasPendientesCliente([])
      setCuentaCobrarSeleccionadaId('')
      setModoAplicacionSaldo('credito')
      return
    }

    const cuentas = (cuentasRes.data || []) as CuentaPendienteResumen[]
    setCuentasPendientesCliente(cuentas)

    if (cuentas.length > 0) {
      setCuentaCobrarSeleccionadaId((prev) => prev || cuentas[0].id)
      setModoAplicacionSaldo((prev) => (prev === 'credito' ? 'deuda' : prev))
    } else {
      setCuentaCobrarSeleccionadaId('')
      setModoAplicacionSaldo('credito')
    }
  }

  async function limpiarCreditosExcedenteOperacion(operacionId: string | null) {
    if (!operacionId) return

    const { data: creditos, error: creditosError } = await supabase
      .from('clientes_credito')
      .select('id, monto_original, monto_disponible')
      .eq('origen_tipo', 'pago_excedente')
      .eq('origen_id', operacionId)

    if (creditosError) throw creditosError
    if (!creditos || creditos.length === 0) return

    for (const credito of creditos) {
      const montoOriginal = Number(credito.monto_original || 0)
      const montoDisponible = Number(credito.monto_disponible || 0)

      if (Math.abs(montoDisponible - montoOriginal) > 0.01) {
        throw new Error(
          'Esta venta tiene un crédito generado que ya fue usado parcial o totalmente. No se puede editar ni eliminar desde aquí.'
        )
      }

      const { data: aplicaciones, error: aplicacionesError } = await supabase
        .from('clientes_credito_aplicaciones')
        .select('id')
        .eq('credito_id', String(credito.id))
        .limit(1)

      if (aplicacionesError) throw aplicacionesError
      if (aplicaciones && aplicaciones.length > 0) {
        throw new Error(
          'Esta venta tiene un crédito aplicado a otra deuda. No se puede editar ni eliminar desde aquí.'
        )
      }
    }

    const ids = creditos.map((credito) => String(credito.id))
    const { error: deleteError } = await supabase
      .from('clientes_credito')
      .delete()
      .in('id', ids)

    if (deleteError) throw deleteError
  }

  async function crearCreditoCliente(args: {
    clienteId: string
    operacionPagoId: string
    excedenteUsd: number
    descripcion: string
    origenTipo?: string
  }) {
    const excedenteUsd = r2(args.excedenteUsd)
    if (excedenteUsd <= 0) return

    const tasaReferencia =
      resumenPagos.totalUsd > 0 && resumenPagos.totalBs > 0
        ? r2(resumenPagos.totalBs / resumenPagos.totalUsd)
        : null

    const montoBs = tasaReferencia ? r2(excedenteUsd * tasaReferencia) : null

    const { error } = await supabase.from('clientes_credito').insert({
      cliente_id: args.clienteId,
      origen_tipo: args.origenTipo || 'pago_excedente',
      origen_id: args.operacionPagoId,
      moneda: 'USD',
      monto_original: excedenteUsd,
      monto_disponible: excedenteUsd,
      tasa_bcv: tasaReferencia,
      monto_original_bs: montoBs,
      monto_disponible_bs: montoBs,
      descripcion: args.descripcion,
      fecha,
      estado: 'activo',
      registrado_por: null,
    })

    if (error) throw error
  }

  const clienteSeleccionado = useMemo(
    () => clientes.find((c) => c.id === clienteId) || null,
    [clientes, clienteId]
  )

  const productoSeleccionado = useMemo(
    () => productos.find((p) => p.id === productoId) || null,
    [productos, productoId]
  )

  const cuentaPendienteSeleccionada = useMemo(
    () =>
      cuentasPendientesCliente.find((cuenta) => cuenta.id === cuentaCobrarSeleccionadaId) || null,
    [cuentasPendientesCliente, cuentaCobrarSeleccionadaId]
  )

  const clienteTieneDeuda = useMemo(
    () => Number(estadoCuentaCliente?.total_pendiente_usd || 0) > 0.01,
    [estadoCuentaCliente]
  )

  const precioUnitarioUSD = Number(productoSeleccionado?.precio_venta_usd || 0)

  const totalUSD = useMemo(() => {
    return r2(Number((cantidad || 0) * precioUnitarioUSD))
  }, [cantidad, precioUnitarioUSD])

  const totalObjetivoUSD = useMemo(() => {
    if (tipoIngreso === 'saldo' && modoAplicacionSaldo === 'deuda') {
      return r2(Number(cuentaPendienteSeleccionada?.saldo_usd || 0))
    }

    return totalUSD
  }, [tipoIngreso, modoAplicacionSaldo, cuentaPendienteSeleccionada, totalUSD])

  const stockInsuficiente = useMemo(() => {
    if (!productoSeleccionado) return false
    return cantidad > Number(productoSeleccionado.cantidad_actual || 0)
  }, [productoSeleccionado, cantidad])

  async function resolverTasaBCVActual() {
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

    return posibleTasa
  }

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

  function getMetodosForMoneda(moneda: 'USD' | 'BS') {
    return moneda === 'USD'
      ? metodosPago.filter((m) => detectarMetodoUsd(m))
      : metodosPago.filter((m) => detectarMetodoBs(m))
  }

  function updatePagoItem(idLocal: string, patch: Partial<PagoMixtoItem>) {
    setPagosMixtos((prev) =>
      prev.map((item) => (item.id_local === idLocal ? { ...item, ...patch } : item))
    )
  }

  function addPagoItem(moneda: 'USD' | 'BS' = 'USD') {
    setPagosMixtos((prev) => [...prev, makePagoItem(moneda)])
  }

  function removePagoItem(idLocal: string) {
    setPagosMixtos((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((item) => item.id_local !== idLocal)
    })
  }

  const handlePagoBsTasaChange = useCallback((idLocal: string, tasa: number | null) => {
    setPagosMixtos((prev) =>
      prev.map((item) =>
        item.id_local === idLocal ? { ...item, tasa_bcv: tasa } : item
      )
    )
  }, [])

  const handlePagoBsMontoChange = useCallback((idLocal: string, monto: number) => {
    setPagosMixtos((prev) =>
      prev.map((item) =>
        item.id_local === idLocal ? { ...item, monto_bs: monto } : item
      )
    )
  }, [])

  const resumenPagos = useMemo(() => {
    const items = pagosMixtos.map((item) => {
      const montoUsdEq =
        item.moneda_pago === 'USD'
          ? r2(Number(item.monto_usd || 0))
          : Number(item.monto_bs || 0) > 0 && Number(item.tasa_bcv || 0) > 0
            ? r2(Number(item.monto_bs || 0) / Number(item.tasa_bcv || 0))
            : 0

      const montoBs =
        item.moneda_pago === 'BS'
          ? r2(Number(item.monto_bs || 0))
          : Number(item.tasa_bcv || 0) > 0 && Number(item.monto_usd || 0) > 0
            ? r2(Number(item.monto_usd || 0) * Number(item.tasa_bcv || 0))
            : 0

      return {
        ...item,
        monto_equivalente_usd: montoUsdEq,
        monto_equivalente_bs: montoBs > 0 ? montoBs : null,
        monto_insertar:
          item.moneda_pago === 'BS'
            ? r2(Number(item.monto_bs || 0))
            : r2(Number(item.monto_usd || 0)),
        valido:
          !!item.metodo_pago_v2_id &&
          (
            item.moneda_pago === 'USD'
              ? Number(item.monto_usd || 0) > 0
              : Number(item.monto_bs || 0) > 0 && Number(item.tasa_bcv || 0) > 0
          ),
      }
    })

    const totalUsd = r2(
      items.reduce((acc, item) => acc + Number(item.monto_equivalente_usd || 0), 0)
    )
    const totalBs = r2(
      items.reduce((acc, item) => acc + Number(item.monto_equivalente_bs || 0), 0)
    )
    const faltanteUsd = r2(Math.max(totalObjetivoUSD - totalUsd, 0))
    const excedenteUsd = r2(Math.max(totalUsd - totalObjetivoUSD, 0))
    const diferenciaUsd = r2(totalObjetivoUSD - totalUsd)
    const cubreTotal = totalObjetivoUSD > 0 && diferenciaUsd <= 0.01

    return {
      items,
      totalUsd,
      totalBs,
      faltanteUsd,
      excedenteUsd,
      diferenciaUsd,
      cubreTotal,
      tieneExcedente: excedenteUsd > 0.01,
      todosValidos: items.every((item) => item.valido),
    }
  }, [pagosMixtos, totalObjetivoUSD])

  async function registrarPagoMixtoProducto(args: {
    fecha: string
    concepto: string
    clienteId: string
    inventarioId: string
    cantidad: number
    notasGenerales: string | null
  }) {
    const { data, error } = await supabase.rpc('registrar_pagos_mixtos', {
      p_fecha: args.fecha,
      p_tipo_origen: 'producto',
      p_categoria: 'producto',
      p_concepto: args.concepto,
      p_cliente_id: args.clienteId,
      p_cita_id: null,
      p_cliente_plan_id: null,
      p_cuenta_cobrar_id: null,
      p_inventario_id: args.inventarioId,
      p_registrado_por: null,
      p_notas_generales: args.notasGenerales,
      p_pagos: resumenPagos.items.map((item) => ({
        metodo_pago_v2_id: item.metodo_pago_v2_id,
        moneda_pago: item.moneda_pago,
        monto: item.monto_insertar,
        tasa_bcv: item.moneda_pago === 'BS' ? item.tasa_bcv : null,
        referencia: item.referencia || null,
        notas: item.notas || null,
      })),
    })

    if (error) throw error

    const operacionPagoId = data?.operacion_pago_id || null

    if (operacionPagoId) {
      await supabase
        .from('pagos')
        .update({
          inventario_id: args.inventarioId,
          cantidad_producto: args.cantidad,
        })
        .eq('operacion_pago_id', operacionPagoId)
    }

    return operacionPagoId
  }

  async function registrarPagoMixtoSaldo(args: {
    fecha: string
    concepto: string
    clienteId: string
    notasGenerales: string | null
  }) {
    const { data, error } = await supabase.rpc('registrar_pagos_mixtos', {
      p_fecha: args.fecha,
      p_tipo_origen: 'saldo_cliente',
      p_categoria: 'saldo_cliente',
      p_concepto: args.concepto,
      p_cliente_id: args.clienteId,
      p_cita_id: null,
      p_cliente_plan_id: null,
      p_cuenta_cobrar_id: null,
      p_inventario_id: null,
      p_registrado_por: null,
      p_notas_generales: args.notasGenerales,
      p_pagos: resumenPagos.items.map((item) => ({
        metodo_pago_v2_id: item.metodo_pago_v2_id,
        moneda_pago: item.moneda_pago,
        monto: item.monto_insertar,
        tasa_bcv: item.moneda_pago === 'BS' ? item.tasa_bcv : null,
        referencia: item.referencia || null,
        notas: item.notas || null,
      })),
    })

    if (error) throw error

    return data?.operacion_pago_id || null
  }

  async function registrarPagoMixtoDeuda(args: {
    cuentaCobrarId: string
    fecha: string
    notasGenerales: string | null
  }) {
    await registrarAbonoMixto({
      cuenta_cobrar_id: args.cuentaCobrarId,
      fecha: args.fecha,
      notas_generales: args.notasGenerales,
      pagos: resumenPagos.items.map((item) => ({
        metodo_pago_v2_id: item.metodo_pago_v2_id,
        moneda_pago: item.moneda_pago,
        monto: item.monto_insertar,
        tasa_bcv: item.moneda_pago === 'BS' ? item.tasa_bcv : null,
        referencia: item.referencia || null,
        notas: item.notas || null,
      })),
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!clienteId) {
      alert('Selecciona un cliente')
      return
    }

    if (!clienteSeleccionado) {
      alert('Cliente inválido')
      return
    }

    if (tipoIngreso === 'producto') {
      if (!productoId) {
        alert('Selecciona un producto')
        return
      }

      if (cantidad <= 0) {
        alert('La cantidad debe ser mayor a 0')
        return
      }

      if (!editingId && stockInsuficiente) {
        alert('No hay suficiente stock disponible')
        return
      }

      if (!productoSeleccionado) {
        alert('Producto inválido')
        return
      }
    }

    if (tipoIngreso === 'saldo' && estado !== 'pagado') {
      alert('La recarga de saldo solo se puede registrar como pagada.')
      return
    }

    const productoActual = tipoIngreso === 'producto' ? productoSeleccionado : null

    const conceptoFinal =
      tipoIngreso === 'saldo'
        ? concepto.trim() || 'Recarga de saldo a favor'
        : concepto.trim() || `Venta de ${productoActual?.nombre || ''} x${cantidad}`

    setSaving(true)

    try {
      if (tipoIngreso === 'saldo') {
        if (editingId) {
          alert('Las recargas de saldo no se editan desde aquí. Registra una nueva o elimina la anterior si no ha sido usada.')
          setSaving(false)
          return
        }

        if (!resumenPagos.todosValidos) {
          alert('Completa correctamente todos los fragmentos del pago.')
          setSaving(false)
          return
        }

        if (resumenPagos.totalUsd <= 0) {
          alert('Debes indicar un monto válido para la recarga.')
          setSaving(false)
          return
        }

        if (modoAplicacionSaldo === 'deuda' && cuentaPendienteSeleccionada) {
          const objetivo = Number(cuentaPendienteSeleccionada.saldo_usd || 0)

          if (Math.abs(resumenPagos.totalUsd - objetivo) > 0.01) {
            alert(
              `El pago debe cubrir exactamente la deuda seleccionada. Deuda: ${formatearMoneda(
                objetivo,
                'USD'
              )} | Registrado: ${formatearMoneda(resumenPagos.totalUsd, 'USD')}`
            )
            setSaving(false)
            return
          }

          await registrarPagoMixtoDeuda({
            cuentaCobrarId: cuentaPendienteSeleccionada.id,
            fecha,
            notasGenerales: notas.trim() || null,
          })

          alert(`✅ Deuda aplicada por ${formatearMoneda(objetivo, 'USD')}.`)
          resetForm()
          await cargarDatos()
          await cargarEstadoCuentaCliente(clienteSeleccionado.id)
          return
        }

        const operacionPagoId = await registrarPagoMixtoSaldo({
          fecha,
          concepto: conceptoFinal,
          clienteId: clienteSeleccionado.id,
          notasGenerales: notas.trim() || null,
        })

        if (!operacionPagoId) {
          throw new Error('No se pudo generar la operación de recarga de saldo')
        }

        await crearCreditoCliente({
          clienteId: clienteSeleccionado.id,
          operacionPagoId,
          excedenteUsd: resumenPagos.totalUsd,
          descripcion: conceptoFinal,
          origenTipo: 'saldo_cliente',
        })

        alert(`✅ Saldo agregado. Se acreditó ${formatearMoneda(resumenPagos.totalUsd, 'USD')} al cliente.`)
        resetForm()
        await cargarDatos()
        await cargarEstadoCuentaCliente(clienteSeleccionado.id)
        return
      }

      if (editingId) {
        if (estado === 'pendiente') {
          alert('Una operación pagada no se puede convertir a pendiente desde aquí.')
          setSaving(false)
          return
        }

        if (!resumenPagos.todosValidos) {
          alert('Completa correctamente todos los fragmentos del pago.')
          setSaving(false)
          return
        }

        if (!resumenPagos.cubreTotal) {
          alert(
            `La suma de pagos no cubre el total. Objetivo: ${formatearMoneda(totalUSD, 'USD')} | Registrado: ${formatearMoneda(
              resumenPagos.totalUsd,
              'USD'
            )} | Faltante: ${formatearMoneda(resumenPagos.faltanteUsd, 'USD')}`
          )
          setSaving(false)
          return
        }

        await limpiarCreditosExcedenteOperacion(editingOperacionId)

        if (editingOperacionId) {
          const { error: deleteError } = await supabase
            .from('pagos')
            .delete()
            .eq('operacion_pago_id', editingOperacionId)

          if (deleteError) throw deleteError
        } else {
          const { error: deleteError } = await supabase
            .from('pagos')
            .delete()
            .eq('id', editingId)

          if (deleteError) throw deleteError
        }

        const nuevaOperacionPagoId = await registrarPagoMixtoProducto({
          fecha,
          concepto: conceptoFinal,
          clienteId: clienteSeleccionado.id,
          inventarioId: productoId,
          cantidad,
          notasGenerales: notas.trim() || null,
        })

        if (nuevaOperacionPagoId && resumenPagos.excedenteUsd > 0.01) {
          await crearCreditoCliente({
            clienteId: clienteSeleccionado.id,
            operacionPagoId: nuevaOperacionPagoId,
            excedenteUsd: resumenPagos.excedenteUsd,
            descripcion: `Crédito por excedente en ${conceptoFinal}`,
          })
        }

        alert(
          resumenPagos.excedenteUsd > 0.01
            ? `✅ Ingreso actualizado. Se generó crédito por ${formatearMoneda(resumenPagos.excedenteUsd, 'USD')}`
            : '✅ Ingreso actualizado'
        )
        resetForm()
        await cargarDatos()
        await cargarEstadoCuentaCliente(clienteSeleccionado.id)
        return
      }

      if (estado === 'pendiente') {
        const cantidadAnterior = Number(productoActual?.cantidad_actual || 0)
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
        await cargarEstadoCuentaCliente(clienteSeleccionado.id)
        return
      }

      if (!resumenPagos.todosValidos) {
        alert('Completa correctamente todos los fragmentos del pago.')
        setSaving(false)
        return
      }

      if (!resumenPagos.cubreTotal) {
        alert(
          `La suma de pagos no cubre el total. Objetivo: ${formatearMoneda(totalUSD, 'USD')} | Registrado: ${formatearMoneda(
            resumenPagos.totalUsd,
            'USD'
          )} | Faltante: ${formatearMoneda(resumenPagos.faltanteUsd, 'USD')}`
        )
        setSaving(false)
        return
      }

      const operacionPagoId = await registrarPagoMixtoProducto({
        fecha,
        concepto: conceptoFinal,
        clienteId: clienteSeleccionado.id,
        inventarioId: productoId,
        cantidad,
        notasGenerales: notas.trim() || null,
      })

      if (operacionPagoId && resumenPagos.excedenteUsd > 0.01) {
        await crearCreditoCliente({
          clienteId: clienteSeleccionado.id,
          operacionPagoId,
          excedenteUsd: resumenPagos.excedenteUsd,
          descripcion: `Crédito por excedente en ${conceptoFinal}`,
        })
      }

      const cantidadAnterior = Number(productoActual?.cantidad_actual || 0)
      const cantidadNueva = cantidadAnterior - cantidad

      await descontarInventarioYCrearMovimiento({
        pagoId: null,
        productoId,
        cantidad,
        cantidadAnterior,
        cantidadNueva,
        precioUnitarioUSD,
        totalUSD,
        conceptoMovimiento: `Venta a ${clienteSeleccionado.nombre}`,
      })

      alert(
        resumenPagos.excedenteUsd > 0.01
          ? `✅ Ingreso registrado. Se generó crédito por ${formatearMoneda(resumenPagos.excedenteUsd, 'USD')}`
          : '✅ Ingreso registrado'
      )
      resetForm()
      await cargarDatos()
      await cargarEstadoCuentaCliente(clienteSeleccionado.id)
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo guardar'))
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setTipoIngreso('producto')
    setProductoId('')
    setClienteId('')
    setCantidad(1)
    setConcepto('')
    setEstado('pagado')
    setNotas('')
    setFecha(new Date().toISOString().slice(0, 10))
    setPagosMixtos([makePagoItem('USD')])
    setEditingId(null)
    setEditingOperacionId(null)
    setCuentaCobrarSeleccionadaId('')
    setModoAplicacionSaldo('credito')
    setShowForm(false)
  }

  function startEdit(operacion: PagoOperacion) {
    setTipoIngreso('producto')
    setEditingId(operacion.id_representativo)
    setEditingOperacionId(operacion.operacion_pago_id)
    setFecha(operacion.fecha)
    setConcepto(operacion.concepto)
    setProductoId(operacion.inventario_id || '')
    setCantidad(Number(operacion.cantidad_producto || 1))
    setClienteId(operacion.cliente_id || '')
    setEstado(estadoUiDesdeDb(operacion.estado))
    setNotas(operacion.items[0]?.notas || '')
    setPagosMixtos(
      operacion.items.map((item) => ({
        id_local: `${item.id}_${Math.random().toString(36).slice(2, 6)}`,
        moneda_pago: (item.moneda_pago || 'USD') as 'USD' | 'BS',
        metodo_pago_v2_id: item.metodo_pago_v2_id || '',
        monto_usd: String(r2(Number(item.monto_equivalente_usd || 0))),
        monto_bs:
          item.moneda_pago === 'BS'
            ? r2(Number(item.monto_equivalente_bs || item.monto || 0))
            : null,
        tasa_bcv: item.tasa_bcv || null,
        referencia: item.referencia || '',
        notas: item.notas || '',
      }))
    )
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function eliminarPago(operacion: PagoOperacion) {
    if (!confirm('¿Eliminar este ingreso?')) return

    try {
      await limpiarCreditosExcedenteOperacion(operacion.operacion_pago_id)

      let query = supabase.from('pagos').delete()

      if (operacion.operacion_pago_id) {
        query = query.eq('operacion_pago_id', operacion.operacion_pago_id)
      } else {
        query = query.eq('id', operacion.id_representativo)
      }

      const { error } = await query
      if (error) throw error

      alert('✅ Ingreso eliminado')
      await cargarDatos()
      if (operacion.cliente_id) {
        await cargarEstadoCuentaCliente(operacion.cliente_id)
      }
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo eliminar'))
    }
  }

  const operaciones = useMemo(() => agruparPagosPorOperacion(pagos), [pagos])

  const pagosFiltrados = useMemo(() => {
    return operaciones.filter((pago) => {
      if (estadoFiltro !== 'todos' && pago.estado !== estadoFiltro) return false

      if (search) {
        const s = search.toLowerCase()
        return (
          pago.concepto.toLowerCase().includes(s) ||
          pago.categoria.toLowerCase().includes(s) ||
          pago.tipo_origen.toLowerCase().includes(s) ||
          (pago.cliente_nombre || '').toLowerCase().includes(s)
        )
      }

      return true
    })
  }, [operaciones, estadoFiltro, search])

  const totales = useMemo(() => {
    const pagados = operaciones.filter((p) => p.estado === 'pagado')

    return {
      totalUSD: pagados.reduce((sum, p) => sum + Number(p.total_usd || 0), 0),
      totalBS: pagados.reduce((sum, p) => sum + Number(p.total_bs || 0), 0),
      cantidad: pagados.length,
    }
  }, [operaciones])

  if (loading) {
    return <LoadingIngresos />
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
              Ingresos y saldo de clientes
            </h1>
            <p className="mt-2 text-sm text-white/55">
              Registra ventas del inventario o recargas de saldo a favor del cliente desde un solo lugar.
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
              <p className="text-xs text-white/55">Operaciones</p>
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
              Nuevo ingreso
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
                      {editingId ? 'Editar ingreso' : 'Nuevo ingreso'}
                    </h2>
                    <p className="mt-1 text-xs text-white/45">
                      Completa los datos del ingreso, ya sea venta o recarga de saldo.
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

                <div>
                  <label className={labelCls}>Tipo de ingreso *</label>
                  <select
                    value={tipoIngreso}
                    onChange={(e) => {
                      const next = e.target.value as TipoIngresoUI
                      setTipoIngreso(next)
                      setProductoId('')
                      setCantidad(1)
                      setConcepto(next === 'saldo' ? 'Recarga de saldo a favor' : '')
                      setEstado('pagado')
                      if (next === 'saldo' && cuentasPendientesCliente.length > 0) {
                        setCuentaCobrarSeleccionadaId((prev) => prev || cuentasPendientesCliente[0].id)
                      }
                    }}
                    className={inputCls}
                    disabled={!!editingId}
                  >
                    <option value="producto" className="bg-[#11131a]">
                      Venta de producto
                    </option>
                    <option value="saldo" className="bg-[#11131a]">
                      Recarga de saldo
                    </option>
                  </select>
                  {editingId && (
                    <p className="mt-2 text-xs text-amber-300">
                      Al editar, el tipo de ingreso se mantiene como venta de producto.
                    </p>
                  )}
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

                  {clientePrefill && clienteSeleccionado && (
                    <p className="mt-3 text-xs text-cyan-300">
                      Cliente cargado automáticamente desde su ficha para agilizar el registro.
                    </p>
                  )}

                  {clienteSeleccionado && (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
                          <User2 className="h-4 w-4 text-white/70" />
                        </div>
                        <div className="min-w-0 text-xs text-white/60">
                          <p className="truncate font-medium text-white">
                            {clienteSeleccionado.nombre}
                          </p>
                          {clienteSeleccionado.telefono ? <p>{clienteSeleccionado.telefono}</p> : null}
                          {clienteSeleccionado.email ? <p className="truncate">{clienteSeleccionado.email}</p> : null}
                        </div>
                      </div>

                      {estadoCuentaCliente && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-white/45">
                                Estado del cliente
                              </p>
                              <p className="mt-1 text-sm font-medium text-white">
                                Resumen financiero
                              </p>
                            </div>
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoFinancieroBadge(estadoCuentaCliente)}`}
                            >
                              {estadoFinancieroLabel(estadoCuentaCliente)}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                              <p className="text-[11px] uppercase tracking-wide text-white/45">
                                Deuda total
                              </p>
                              <p className="mt-1 text-sm font-semibold text-white">
                                {formatearMoneda(Number(estadoCuentaCliente.total_pendiente_usd || 0), 'USD')}
                              </p>
                              <p className="mt-1 text-[11px] text-white/45">
                                {formatearMoneda(Number(estadoCuentaCliente.total_pendiente_bs || 0), 'BS')}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                              <p className="text-[11px] uppercase tracking-wide text-white/45">
                                Crédito disponible
                              </p>
                              <p className="mt-1 text-sm font-semibold text-white">
                                {formatearMoneda(Number(estadoCuentaCliente.credito_disponible_usd || 0), 'USD')}
                              </p>
                              <p className="mt-1 text-[11px] text-white/45">
                                {formatearMoneda(Number(estadoCuentaCliente.credito_disponible_bs || 0), 'BS')}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                              <p className="text-[11px] uppercase tracking-wide text-white/45">
                                Pendiente neto
                              </p>
                              <p className="mt-1 text-sm font-semibold text-white">
                                {formatearMoneda(Number(estadoCuentaCliente.saldo_pendiente_neto_usd || 0), 'USD')}
                              </p>
                              <p className="mt-1 text-[11px] text-white/45">
                                {formatearMoneda(Number(estadoCuentaCliente.saldo_pendiente_neto_bs || 0), 'BS')}
                              </p>
                            </div>
                          </div>

                          {clienteTieneDeuda && (
                            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-rose-300/90">
                                    Este cliente tiene deudas activas
                                  </p>
                                  <p className="mt-1 text-sm font-medium text-white">
                                    Puedes cobrar una deuda específica desde aquí mismo.
                                  </p>
                                </div>
                                <Receipt className="h-4 w-4 text-rose-300" />
                              </div>
                            </div>
                          )}

                          {clienteTieneDeuda && (
                            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[11px] uppercase tracking-wide text-white/45">
                                    Mini menú de deudas
                                  </p>
                                  <p className="mt-1 text-sm font-medium text-white">
                                    Elige si este pago va a crédito o a una deuda concreta
                                  </p>
                                </div>
                                <Wallet className="h-4 w-4 text-white/45" />
                              </div>

                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <button
                                  type="button"
                                  onClick={() => setModoAplicacionSaldo('deuda')}
                                  className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                                    modoAplicacionSaldo === 'deuda'
                                      ? 'border-white/20 bg-white/[0.08] text-white'
                                      : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.05]'
                                  }`}
                                >
                                  <p className="font-medium">Aplicar a deuda</p>
                                  <p className="mt-1 text-xs text-white/45">
                                    Cobra una cuenta pendiente específica.
                                  </p>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setModoAplicacionSaldo('credito')}
                                  className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                                    modoAplicacionSaldo === 'credito'
                                      ? 'border-white/20 bg-white/[0.08] text-white'
                                      : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.05]'
                                  }`}
                                >
                                  <p className="font-medium">Guardar como crédito</p>
                                  <p className="mt-1 text-xs text-white/45">
                                    Deja el dinero como saldo a favor del cliente.
                                  </p>
                                </button>
                              </div>

                              {modoAplicacionSaldo === 'deuda' && (
                                <div className="space-y-2">
                                  {cuentasPendientesCliente.map((cuenta) => {
                                    const activa = cuenta.id === cuentaCobrarSeleccionadaId

                                    return (
                                      <button
                                        key={cuenta.id}
                                        type="button"
                                        onClick={() => {
                                          setCuentaCobrarSeleccionadaId(cuenta.id)
                                          setConcepto(`Abono a deuda: ${cuenta.concepto}`)
                                          setTipoIngreso('saldo')
                                          setEstado('pagado')
                                        }}
                                        className={`w-full rounded-2xl border p-3 text-left transition ${
                                          activa
                                            ? 'border-white/20 bg-white/[0.08]'
                                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-white">
                                              {cuenta.concepto}
                                            </p>
                                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/45">
                                              <span>{formatDateShort(cuenta.fecha_venta)}</span>
                                              <span>•</span>
                                              <span>{cuenta.estado}</span>
                                            </div>
                                          </div>

                                          <div className="text-right">
                                            <p className="text-sm font-semibold text-white">
                                              {formatearMoneda(Number(cuenta.saldo_usd || 0), 'USD')}
                                            </p>
                                            {activa ? (
                                              <span className="mt-1 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/70">
                                                Seleccionada
                                              </span>
                                            ) : null}
                                          </div>
                                        </div>
                                      </button>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {tipoIngreso === 'producto' && (
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
                      disabled={!!editingId}
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

                    {editingId && (
                      <p className="mt-2 text-xs text-amber-300">
                        Al editar, producto y cantidad quedan bloqueados para no desajustar el stock.
                      </p>
                    )}

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
                            Stock: {productoSeleccionado.cantidad_actual} {productoSeleccionado.unidad_medida}
                          </p>
                          <p>
                            Precio venta:{' '}
                            {formatearMoneda(Number(productoSeleccionado.precio_venta_usd || 0), 'USD')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {tipoIngreso === 'producto' && (
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
                      disabled={!!editingId}
                    />
                    {productoSeleccionado && (
                      <p className="mt-2 text-xs text-white/45">
                        Disponible: {formatQty(productoSeleccionado.cantidad_actual)} {productoSeleccionado.unidad_medida}
                      </p>
                    )}
                  </div>
                )}

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

                {tipoIngreso === 'producto' ? (
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

                    {estado === 'pendiente' && (
                      <p className="mt-3 text-xs text-amber-300">
                        Si no paga, se envía a cobranzas con el cliente seleccionado.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/55">
                        {modoAplicacionSaldo === 'deuda' ? 'Deuda seleccionada USD' : 'Total a acreditar USD'}
                      </span>
                      <span className="font-semibold text-white">
                        {formatearMoneda(
                          modoAplicacionSaldo === 'deuda'
                            ? Number(cuentaPendienteSeleccionada?.saldo_usd || 0)
                            : resumenPagos.totalUsd,
                          'USD'
                        )}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-white/55">Total registrado Bs</span>
                      <span className="font-semibold text-white">
                        {formatearMoneda(resumenPagos.totalBs, 'BS')}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-white/70">
                      {modoAplicacionSaldo === 'deuda'
                        ? 'Este pago se aplicará directamente a la deuda seleccionada.'
                        : 'Esta operación deja el dinero como saldo a favor del cliente.'}
                    </p>
                  </div>
                )}

                <div>
                  <label className={labelCls}>Estado</label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as EstadoUI)}
                    className={inputCls}
                    disabled={!!editingId}
                  >
                    <option value="pagado" className="bg-[#11131a]">
                      Pagado
                    </option>
                    {tipoIngreso === 'producto' && (
                      <option value="pendiente" className="bg-[#11131a]">
                        Pendiente
                      </option>
                    )}
                  </select>

                  {editingId && (
                    <p className="mt-2 text-xs text-amber-300">
                      Al editar, esta operación se mantiene como pagada.
                    </p>
                  )}
                </div>

                {estado === 'pagado' && (
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm font-medium text-white">Pago</p>

                    {pagosMixtos.map((item, index) => {
                      const metodosDisponibles = getMetodosForMoneda(item.moneda_pago)
                      const montoUsdEq =
                        item.moneda_pago === 'USD'
                          ? r2(Number(item.monto_usd || 0))
                          : Number(item.monto_bs || 0) > 0 && Number(item.tasa_bcv || 0) > 0
                            ? r2(Number(item.monto_bs || 0) / Number(item.tasa_bcv || 0))
                            : 0

                      return (
                        <div
                          key={item.id_local}
                          className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                        >
                          <div className="mb-4 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                Fragmento #{index + 1}
                              </p>
                              <p className="text-xs text-white/45">
                                {item.moneda_pago === 'BS'
                                  ? `Equivalente USD calculado: ${formatearMoneda(montoUsdEq, 'USD')}`
                                  : `Monto del fragmento: ${formatearMoneda(montoUsdEq, 'USD')}`}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => removePagoItem(item.id_local)}
                              disabled={pagosMixtos.length <= 1}
                              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70 hover:bg-white/[0.06] disabled:opacity-40"
                            >
                              Quitar
                            </button>
                          </div>

                          <div className="grid gap-4 md:grid-cols-3">
                            <div>
                              <label className={labelCls}>Moneda</label>
                              <select
                                value={item.moneda_pago}
                                onChange={(e) =>
                                  updatePagoItem(item.id_local, {
                                    moneda_pago: e.target.value as 'USD' | 'BS',
                                    metodo_pago_v2_id: '',
                                    monto_usd: '',
                                    monto_bs: null,
                                    tasa_bcv: null,
                                  })
                                }
                                className={inputCls}
                              >
                                <option value="USD" className="bg-[#11131a]">USD</option>
                                <option value="BS" className="bg-[#11131a]">Bs</option>
                              </select>
                            </div>

                            <div>
                              <label className={labelCls}>
                                {item.moneda_pago === 'USD' ? 'Método USD' : 'Método Bs'}
                              </label>
                              <select
                                value={item.metodo_pago_v2_id}
                                onChange={(e) =>
                                  updatePagoItem(item.id_local, {
                                    metodo_pago_v2_id: e.target.value,
                                  })
                                }
                                className={inputCls}
                              >
                                <option value="" className="bg-[#11131a]">
                                  Seleccionar método
                                </option>
                                {metodosDisponibles.map((metodo) => (
                                  <option key={metodo.id} value={metodo.id} className="bg-[#11131a]">
                                    {metodo.nombre}
                                    {metodo.moneda ? ` · ${metodo.moneda}` : ''}
                                    {metodo.cartera?.nombre ? ` · ${metodo.cartera.nombre}` : ''}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {item.moneda_pago === 'USD' ? (
                              <div>
                                <label className={labelCls}>Monto USD</label>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={item.monto_usd}
                                  onChange={(e) =>
                                    updatePagoItem(item.id_local, {
                                      monto_usd: e.target.value,
                                    })
                                  }
                                  className={inputCls}
                                  placeholder="0.00"
                                />
                              </div>
                            ) : (
                              <div>
                                <label className={labelCls}>Monto Bs</label>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  value={item.monto_bs ?? ''}
                                  onChange={(e) =>
                                    updatePagoItem(item.id_local, {
                                      monto_bs: e.target.value ? Number(e.target.value) : null,
                                    })
                                  }
                                  className={inputCls}
                                  placeholder="0.00"
                                />
                              </div>
                            )}

                            {item.moneda_pago === 'BS' && (
                              <div className="md:col-span-3">
                                <PagoBsSelector
                                  fecha={fecha}
                                  montoUsd={
                                    Number(item.monto_bs || 0) > 0 && Number(item.tasa_bcv || 0) > 0
                                      ? r2(Number(item.monto_bs || 0) / Number(item.tasa_bcv || 0))
                                      : 0
                                  }
                                  montoBs={item.monto_bs}
                                  onChangeTasa={(tasa) => handlePagoBsTasaChange(item.id_local, tasa)}
                                  onChangeMontoBs={(monto) => handlePagoBsMontoChange(item.id_local, monto)}
                                />
                              </div>
                            )}

                            <div>
                              <label className={labelCls}>Referencia</label>
                              <input
                                type="text"
                                value={item.referencia}
                                onChange={(e) =>
                                  updatePagoItem(item.id_local, {
                                    referencia: e.target.value,
                                  })
                                }
                                placeholder="Número de referencia..."
                                className={inputCls}
                              />
                            </div>

                            <div className="md:col-span-2">
                              <label className={labelCls}>Notas del fragmento</label>
                              <input
                                type="text"
                                value={item.notas}
                                onChange={(e) =>
                                  updatePagoItem(item.id_local, {
                                    notas: e.target.value,
                                  })
                                }
                                placeholder="Notas del fragmento"
                                className={inputCls}
                              />
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => addPagoItem('USD')}
                        className={softButtonCls}
                      >
                        + Agregar pago USD
                      </button>

                      <button
                        type="button"
                        onClick={() => addPagoItem('BS')}
                        className={softButtonCls}
                      >
                        + Agregar pago Bs
                      </button>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="grid gap-3 text-sm sm:grid-cols-3">
                        <div>
                          <p className="text-xs text-white/45">Objetivo</p>
                          <p className="mt-1 font-semibold text-white">
                            {formatearMoneda(totalObjetivoUSD, 'USD')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-white/45">Total USD</p>
                          <p className="mt-1 font-semibold text-emerald-400">
                            {formatearMoneda(resumenPagos.totalUsd, 'USD')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-white/45">Total Bs</p>
                          <p className="mt-1 font-semibold text-amber-300">
                            {formatearMoneda(resumenPagos.totalBs, 'BS')}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        {!resumenPagos.cubreTotal ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-white/55">Faltante USD:</span>
                              <span className="font-semibold text-amber-300">
                                {formatearMoneda(resumenPagos.faltanteUsd, 'USD')}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-white/55">Estado:</span>
                              <span className="font-semibold text-emerald-300">
                                Pago cubierto
                              </span>
                            </div>
                            {resumenPagos.tieneExcedente && (
                              <div className="flex justify-between text-sm">
                                <span className="text-white/55">Crédito a generar:</span>
                                <span className="font-semibold text-cyan-300">
                                  {formatearMoneda(resumenPagos.excedenteUsd, 'USD')}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className={labelCls}>Notas generales (opcional)</label>
                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Detalles adicionales..."
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </div>

                {tipoIngreso === 'producto' && stockInsuficiente && !editingId && (
                  <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3">
                    <p className="text-sm text-rose-300">
                      No hay suficiente stock para esta venta.
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={saving || (tipoIngreso === 'producto' && !!stockInsuficiente && !editingId)}
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
                pagosFiltrados.map((operacion) => {
                  const estadoUi = estadoUiDesdeDb(operacion.estado)

                  return (
                    <div
                      key={operacion.key}
                      className={`${panelCls} p-5 transition hover:bg-white/[0.04]`}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-medium text-white">
                            {operacion.concepto}
                          </h3>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
                            <span>{operacion.fecha}</span>
                            <span>•</span>
                            <span>{operacion.categoria}</span>
                            <span>•</span>
                            <span>{operacion.tipo_origen}</span>
                            {operacion.cliente_nombre ? (
                              <>
                                <span>•</span>
                                <span>{operacion.cliente_nombre}</span>
                              </>
                            ) : null}

                            {operacion.es_pago_mixto ? (
                              <>
                                <span>•</span>
                                <span>{operacion.items_total} pagos</span>
                              </>
                            ) : null}

                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                                estadoUi === 'pagado'
                                  ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                                  : 'border-amber-400/20 bg-amber-400/10 text-amber-300'
                              }`}
                            >
                              {operacion.estado}
                            </span>
                          </div>

                          <div className="mt-3 space-y-2">
                            {operacion.items.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                  <div className="flex flex-wrap items-center gap-2 text-white/70">
                                    <span className="font-medium text-white">
                                      {item.metodos_pago_v2?.nombre || 'Método'}
                                    </span>
                                    <span>·</span>
                                    <span>{item.moneda_pago || 'USD'}</span>
                                    {item.referencia ? (
                                      <>
                                        <span>·</span>
                                        <span>Ref: {item.referencia}</span>
                                      </>
                                    ) : null}
                                  </div>

                                  <div className="text-right">
                                    <p className="font-semibold text-white">
                                      {formatearMoneda(Number(item.monto_equivalente_usd || 0), 'USD')}
                                    </p>
                                    <p className="text-xs text-white/45">
                                      {formatearMoneda(Number(item.monto_equivalente_bs || 0), 'BS')}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-start gap-4 lg:ml-4 lg:flex-shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-white">
                              {formatearMoneda(Number(operacion.total_usd || 0), 'USD')}
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              {formatearMoneda(Number(operacion.total_bs || 0), 'BS')}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => startEdit(operacion)}
                              className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                              title="Editar"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>

                            <button
                              onClick={() => eliminarPago(operacion)}
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