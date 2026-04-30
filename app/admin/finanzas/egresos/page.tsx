'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit2, Plus, Search, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import SelectorTasaBCV from '@/components/finanzas/SelectorTasaBCV'
import { formatearMoneda } from '@/lib/finanzas/tasas'

type EstadoEgreso = 'pagado' | 'pendiente' | 'anulado' | 'liquidado'
type MonedaPago = 'USD' | 'BS'

interface Cartera {
  nombre: string
  codigo: string
  color?: string | null
  icono?: string | null
}

interface MetodoPago {
  id: string
  nombre: string
  tipo?: string | null
  moneda?: string | null
  color?: string | null
  icono?: string | null
  activo?: boolean | null
  cartera?: Cartera | null
}

interface Egreso {
  id: string
  fecha: string
  concepto: string
  categoria: string
  proveedor: string | null
  monto: number | null
  monto_equivalente_usd: number | null
  monto_equivalente_bs: number | null
  moneda: string
  tasa_bcv?: number | null
  estado: EstadoEgreso
  notas?: string | null
  metodo_pago_v2_id?: string | null
  metodo_pago_v2?: {
    nombre: string
    moneda?: string | null
    tipo?: string | null
    cartera?: { nombre: string; codigo: string } | null
  } | null
}

type RawCartera =
  | { nombre?: unknown; codigo?: unknown; color?: unknown; icono?: unknown }
  | Array<{ nombre?: unknown; codigo?: unknown; color?: unknown; icono?: unknown }>
  | null
  | undefined

type RawMetodoPagoRelacionado =
  | { nombre?: unknown; moneda?: unknown; tipo?: unknown; cartera?: RawCartera }
  | Array<{ nombre?: unknown; moneda?: unknown; tipo?: unknown; cartera?: RawCartera }>
  | null
  | undefined

type RawMetodoPago = {
  id?: unknown
  nombre?: unknown
  tipo?: unknown
  moneda?: unknown
  color?: unknown
  icono?: unknown
  activo?: unknown
  cartera?: RawCartera
}

type RawEgreso = {
  id?: unknown
  fecha?: unknown
  concepto?: unknown
  categoria?: unknown
  proveedor?: unknown
  monto?: unknown
  estado?: unknown
  moneda?: unknown
  tasa_bcv?: unknown
  metodo_pago_v2_id?: unknown
  monto_equivalente_usd?: unknown
  monto_equivalente_bs?: unknown
  notas?: unknown
  metodo_pago_v2?: RawMetodoPagoRelacionado
}

const CATEGORIAS = [
  'operativo',
  'nomina',
  'alquiler',
  'servicios',
  'equipos',
  'mantenimiento',
  'marketing',
  'insumos',
  'transporte',
  'otros',
]

const inputCls =
  'w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05]'
const labelCls = 'mb-2 block text-sm font-medium text-white/75'
const panelCls = 'rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl'
const softButtonCls =
  'rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]'

function r2(v: number) {
  return Math.round(Number(v || 0) * 100) / 100
}

function firstItem<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function toNumber(value: unknown): number | null {
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

  return {
    nombre,
    codigo,
    color: toStringOrNull(item.color),
    icono: toStringOrNull(item.icono),
  }
}

function normalizeMetodoPago(raw: RawMetodoPago): MetodoPago {
  return {
    id: String(raw.id ?? ''),
    nombre: String(raw.nombre ?? ''),
    tipo: toStringOrNull(raw.tipo),
    moneda: toStringOrNull(raw.moneda),
    color: toStringOrNull(raw.color),
    icono: toStringOrNull(raw.icono),
    activo: typeof raw.activo === 'boolean' ? raw.activo : null,
    cartera: normalizeCartera(raw.cartera),
  }
}

function normalizeMetodoPagoRelacionado(raw: RawMetodoPagoRelacionado): Egreso['metodo_pago_v2'] {
  const item = firstItem(raw)
  if (!item) return null

  const nombre = toStringOrNull(item.nombre)
  if (!nombre) return null

  const cartera = normalizeCartera(item.cartera)

  return {
    nombre,
    moneda: toStringOrNull(item.moneda),
    tipo: toStringOrNull(item.tipo),
    cartera: cartera ? { nombre: cartera.nombre, codigo: cartera.codigo } : null,
  }
}

function normalizeEgreso(raw: RawEgreso): Egreso {
  const estadoRaw = String(raw.estado ?? 'pendiente')
  const estado: EstadoEgreso =
    estadoRaw === 'pagado' || estadoRaw === 'pendiente' || estadoRaw === 'anulado' || estadoRaw === 'liquidado'
      ? estadoRaw
      : 'pendiente'

  return {
    id: String(raw.id ?? ''),
    fecha: String(raw.fecha ?? ''),
    concepto: String(raw.concepto ?? ''),
    categoria: String(raw.categoria ?? ''),
    proveedor: toStringOrNull(raw.proveedor),
    monto: toNumber(raw.monto),
    monto_equivalente_usd: toNumber(raw.monto_equivalente_usd),
    monto_equivalente_bs: toNumber(raw.monto_equivalente_bs),
    moneda: String(raw.moneda ?? 'USD'),
    tasa_bcv: toNumber(raw.tasa_bcv),
    estado,
    notas: toStringOrNull(raw.notas),
    metodo_pago_v2_id: toStringOrNull(raw.metodo_pago_v2_id),
    metodo_pago_v2: normalizeMetodoPagoRelacionado(raw.metodo_pago_v2),
  }
}

function metodoEsBs(metodo: MetodoPago | null) {
  if (!metodo) return false
  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const tipo = (metodo.tipo || '').toLowerCase()
  const cartera = (metodo.cartera?.codigo || '').toLowerCase()

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
    cartera.includes('bs') ||
    cartera.includes('ves')
  )
}

function metodoEsUsd(metodo: MetodoPago | null) {
  if (!metodo) return false
  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const tipo = (metodo.tipo || '').toLowerCase()
  const cartera = (metodo.cartera?.codigo || '').toLowerCase()

  return (
    moneda === 'USD' ||
    nombre.includes('usd') ||
    nombre.includes('zelle') ||
    nombre.includes('efectivo $') ||
    nombre.includes('efectivo usd') ||
    tipo.includes('usd') ||
    cartera.includes('usd')
  )
}

function calcularMontoEgreso(args: {
  moneda: MonedaPago
  montoUsd: number
  montoBs: number | null
  tasaBcv: number | null
}) {
  const montoUsd = r2(args.montoUsd || 0)
  const tasa = Number(args.tasaBcv || 0)

  if (args.moneda === 'USD') {
    return {
      moneda: 'USD' as const,
      monto: montoUsd,
      tasa_bcv: null as number | null,
      monto_equivalente_usd: montoUsd,
      monto_equivalente_bs: null as number | null,
    }
  }

  const montoBs = r2(Number(args.montoBs || 0) > 0 ? Number(args.montoBs || 0) : montoUsd * tasa)
  const equivalenteUsd = tasa > 0 ? r2(montoBs / tasa) : montoUsd

  return {
    moneda: 'BS' as const,
    monto: montoBs,
    tasa_bcv: tasa,
    monto_equivalente_usd: equivalenteUsd,
    monto_equivalente_bs: montoBs,
  }
}

function estadoBadge(estado: EstadoEgreso) {
  if (estado === 'pagado') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
  if (estado === 'pendiente') return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
  if (estado === 'liquidado') return 'border-violet-400/20 bg-violet-400/10 text-violet-300'
  return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
}

export default function EgresosPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])

  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | EstadoEgreso>('todos')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [concepto, setConcepto] = useState('')
  const [categoria, setCategoria] = useState('operativo')
  const [proveedor, setProveedor] = useState('')
  const [montoUSD, setMontoUSD] = useState('')
  const [estado, setEstado] = useState<'pagado' | 'pendiente'>('pagado')
  const [monedaPago, setMonedaPago] = useState<MonedaPago>('USD')
  const [metodoPagoId, setMetodoPagoId] = useState('')
  const [montoPagoBs, setMontoPagoBs] = useState<number | null>(null)
  const [tasaBCV, setTasaBCV] = useState<number | null>(null)
  const [notas, setNotas] = useState('')

  useEffect(() => {
    void cargarDatos()
  }, [])

  const metodosPagoDisponibles = useMemo(
    () => (monedaPago === 'USD' ? metodosPago.filter(metodoEsUsd) : metodosPago.filter(metodoEsBs)),
    [metodosPago, monedaPago]
  )

  const metodoSeleccionado = useMemo(
    () => metodosPago.find((m) => m.id === metodoPagoId) || null,
    [metodosPago, metodoPagoId]
  )

  const resumenMonto = useMemo(() => {
    const montoBaseUsd = Number(montoUSD || 0)
    if (!montoBaseUsd || montoBaseUsd <= 0) return { usd: 0, bs: 0 }

    const conversion = calcularMontoEgreso({
      moneda: monedaPago,
      montoUsd: montoBaseUsd,
      montoBs: montoPagoBs,
      tasaBcv: tasaBCV,
    })

    return {
      usd: conversion.monto_equivalente_usd,
      bs: conversion.monto_equivalente_bs || 0,
    }
  }, [montoUSD, monedaPago, montoPagoBs, tasaBCV])

  const egresosFiltrados = useMemo(() => {
    return egresos.filter((eg) => {
      if (estadoFiltro !== 'todos' && eg.estado !== estadoFiltro) return false
      if (categoriaFiltro !== 'todos' && eg.categoria !== categoriaFiltro) return false

      if (search.trim()) {
        const s = search.trim().toLowerCase()
        return (
          eg.concepto.toLowerCase().includes(s) ||
          eg.categoria.toLowerCase().includes(s) ||
          (eg.proveedor || '').toLowerCase().includes(s) ||
          (eg.metodo_pago_v2?.nombre || '').toLowerCase().includes(s) ||
          (eg.metodo_pago_v2?.cartera?.nombre || '').toLowerCase().includes(s)
        )
      }

      return true
    })
  }, [egresos, estadoFiltro, categoriaFiltro, search])

  const totales = useMemo(() => {
    const pagados = egresos.filter((e) => e.estado === 'pagado' || e.estado === 'liquidado')
    return {
      totalUSD: pagados.reduce((sum, e) => sum + Number(e.monto_equivalente_usd || 0), 0),
      totalBS: pagados.reduce((sum, e) => sum + Number(e.monto_equivalente_bs || 0), 0),
      cantidad: pagados.length,
    }
  }, [egresos])

  async function cargarDatos() {
    setLoading(true)

    const [egresosRes, metodosRes] = await Promise.all([
      supabase
        .from('egresos')
        .select(`
          id, fecha, concepto, categoria, proveedor, monto, estado, moneda, tasa_bcv,
          metodo_pago_v2_id, monto_equivalente_usd, monto_equivalente_bs, notas,
          metodo_pago_v2:metodo_pago_v2_id (
            nombre, moneda, tipo,
            cartera:cartera_id ( nombre, codigo )
          )
        `)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false }),

      supabase
        .from('metodos_pago_v2')
        .select(`
          id, nombre, tipo, moneda, color, icono, activo,
          cartera:cartera_id ( nombre, codigo, color, icono )
        `)
        .eq('activo', true)
        .eq('permite_pagar', true)
        .order('orden', { ascending: true })
        .order('nombre', { ascending: true }),
    ])

    if (egresosRes.error) alert('Error cargando egresos: ' + egresosRes.error.message)
    else setEgresos(((egresosRes.data || []) as RawEgreso[]).map(normalizeEgreso))

    if (metodosRes.error) alert('Error cargando métodos: ' + metodosRes.error.message)
    else setMetodosPago(((metodosRes.data || []) as RawMetodoPago[]).map(normalizeMetodoPago))

    setLoading(false)
  }

  function resetForm() {
    setConcepto('')
    setCategoria('operativo')
    setProveedor('')
    setMontoUSD('')
    setEstado('pagado')
    setMonedaPago('USD')
    setMetodoPagoId('')
    setMontoPagoBs(null)
    setTasaBCV(null)
    setNotas('')
    setFecha(new Date().toISOString().slice(0, 10))
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(egreso: Egreso) {
    const monedaNormalizada: MonedaPago =
      (egreso.moneda || 'USD').toUpperCase() === 'BS' || (egreso.moneda || '').toUpperCase() === 'VES'
        ? 'BS'
        : 'USD'

    setEditingId(egreso.id)
    setFecha(egreso.fecha)
    setConcepto(egreso.concepto)
    setCategoria(egreso.categoria)
    setProveedor(egreso.proveedor || '')
    setMontoUSD(String(egreso.monto_equivalente_usd || egreso.monto || 0))
    setEstado(egreso.estado === 'pagado' || egreso.estado === 'liquidado' ? 'pagado' : 'pendiente')
    setMonedaPago(monedaNormalizada)
    setMetodoPagoId(egreso.metodo_pago_v2_id || '')
    setMontoPagoBs(Number(egreso.monto_equivalente_bs || egreso.monto || 0) || null)
    setTasaBCV(Number(egreso.tasa_bcv || 0) || null)
    setNotas(egreso.notas || '')
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const montoBaseUsd = Number(montoUSD || 0)

    if (!concepto.trim() || montoBaseUsd <= 0 || !metodoPagoId) {
      alert('Completa concepto, monto y método de pago.')
      return
    }

    if (!metodoSeleccionado) {
      alert('Selecciona un método de pago válido.')
      return
    }

    if (monedaPago === 'USD' && !metodoEsUsd(metodoSeleccionado)) {
      alert('El método seleccionado no corresponde a USD.')
      return
    }

    if (monedaPago === 'BS' && !metodoEsBs(metodoSeleccionado)) {
      alert('El método seleccionado no corresponde a Bolívares.')
      return
    }

    if (monedaPago === 'BS' && (!tasaBCV || tasaBCV <= 0)) {
      alert('Selecciona una tasa BCV válida para pagos en Bolívares.')
      return
    }

    setSaving(true)

    try {
      const conversion = calcularMontoEgreso({
        moneda: monedaPago,
        montoUsd: montoBaseUsd,
        montoBs: montoPagoBs,
        tasaBcv: tasaBCV,
      })

      const payload = {
        fecha,
        concepto: concepto.trim(),
        categoria,
        proveedor: proveedor.trim() || null,
        moneda: conversion.moneda,
        monto: conversion.monto,
        tasa_bcv: conversion.tasa_bcv,
        monto_equivalente_usd: conversion.monto_equivalente_usd,
        monto_equivalente_bs: conversion.monto_equivalente_bs,
        metodo_pago_id: null,
        metodo_pago_v2_id: metodoPagoId,
        estado,
        notas: notas.trim() || null,
      }

      if (editingId) {
        const { error } = await supabase.from('egresos').update(payload).eq('id', editingId)
        if (error) throw error
        alert('✅ Egreso actualizado')
      } else {
        const { error } = await supabase.from('egresos').insert(payload)
        if (error) throw error
        alert('✅ Egreso registrado')
      }

      resetForm()
      await cargarDatos()
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo guardar'))
    } finally {
      setSaving(false)
    }
  }

  async function eliminarEgreso(id: string) {
    if (!confirm('¿Eliminar este egreso?')) return

    try {
      const { error } = await supabase.from('egresos').delete().eq('id', id)
      if (error) throw error
      alert('✅ Egreso eliminado')
      await cargarDatos()
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo eliminar'))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="h-20 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
          <div className="h-96 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Link href="/admin/finanzas" className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white/90">
              <ArrowLeft className="h-4 w-4" />
              Volver a Finanzas
            </Link>
            <p className="mt-4 text-sm text-white/55">Finanzas</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Egresos</h1>
            <p className="mt-2 text-sm text-white/55">Registra gastos con método de pago USD/Bs desde metodos_pago_v2.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:w-auto">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
              <p className="text-xs text-white/55">Total USD</p>
              <p className="mt-1 text-lg font-semibold text-white">{formatearMoneda(totales.totalUSD, 'USD')}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
              <p className="text-xs text-white/55">Total Bs</p>
              <p className="mt-1 text-lg font-semibold text-white">{formatearMoneda(totales.totalBS, 'BS')}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
              <p className="text-xs text-white/55">Registros</p>
              <p className="mt-1 text-lg font-semibold text-white">{totales.cantidad}</p>
            </div>
          </div>
        </div>

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/85 transition hover:bg-white/[0.06] sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Nuevo egreso
          </button>
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          {showForm && (
            <div className="xl:col-span-1">
              <form onSubmit={handleSubmit} className={`${panelCls} space-y-5 p-6`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{editingId ? 'Editar egreso' : 'Nuevo egreso'}</h2>
                    <p className="mt-1 text-xs text-white/45">Completa los datos del gasto.</p>
                  </div>
                  <button type="button" onClick={resetForm} className="rounded-full border border-white/10 bg-white/[0.03] p-2 text-white/50 transition hover:bg-white/[0.06] hover:text-white">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div>
                  <label className={labelCls}>Fecha *</label>
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} required />
                </div>

                <div>
                  <label className={labelCls}>Concepto *</label>
                  <input type="text" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej: Pago de alquiler, compra de equipos..." className={inputCls} required />
                </div>

                <div>
                  <label className={labelCls}>Categoría</label>
                  <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputCls}>
                    {CATEGORIAS.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#11131a]">{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>Proveedor (opcional)</label>
                  <input type="text" value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Nombre del proveedor" className={inputCls} />
                </div>

                <div>
                  <label className={labelCls}>Monto base (USD) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={montoUSD}
                    onChange={(e) => {
                      setMontoUSD(e.target.value)
                      if (monedaPago === 'BS') setMontoPagoBs(null)
                    }}
                    placeholder="0.00"
                    className={inputCls}
                    required
                  />
                  <p className="mt-1 text-xs text-white/40">Equivalente contable en USD. Si pagas en Bs, abajo se calcula o ajusta el monto real.</p>
                </div>

                <div>
                  <label className={labelCls}>Estado</label>
                  <select value={estado} onChange={(e) => setEstado(e.target.value as 'pagado' | 'pendiente')} className={inputCls}>
                    <option value="pagado" className="bg-[#11131a]">Pagado</option>
                    <option value="pendiente" className="bg-[#11131a]">Pendiente</option>
                  </select>
                </div>

                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm font-medium text-white">Método de pago</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Moneda</label>
                      <select
                        value={monedaPago}
                        onChange={(e) => {
                          setMonedaPago(e.target.value as MonedaPago)
                          setMetodoPagoId('')
                          setMontoPagoBs(null)
                          setTasaBCV(null)
                        }}
                        className={inputCls}
                      >
                        <option value="USD" className="bg-[#11131a]">USD</option>
                        <option value="BS" className="bg-[#11131a]">Bs</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>{monedaPago === 'USD' ? 'Método USD' : 'Método Bs'}</label>
                      <select value={metodoPagoId} onChange={(e) => setMetodoPagoId(e.target.value)} className={inputCls} required>
                        <option value="" className="bg-[#11131a]">Seleccionar método</option>
                        {metodosPagoDisponibles.map((m) => (
                          <option key={m.id} value={m.id} className="bg-[#11131a]">
                            {m.nombre}{m.moneda ? ` · ${m.moneda}` : ''}{m.cartera?.nombre ? ` · ${m.cartera.nombre}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {monedaPago === 'BS' && estado === 'pagado' && (
                    <SelectorTasaBCV
                      fecha={fecha}
                      monedaPago="BS"
                      monedaReferencia="EUR"
                      montoUSD={Number(montoUSD || 0)}
                      montoBs={montoPagoBs || undefined}
                      onTasaChange={setTasaBCV}
                      onMontoBsChange={(monto) => setMontoPagoBs(monto)}
                    />
                  )}

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/55">Equivalente USD</span>
                      <span className="font-semibold text-white">{resumenMonto.usd > 0 ? formatearMoneda(resumenMonto.usd, 'USD') : '—'}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-white/55">Monto en Bs</span>
                      <span className="font-semibold text-white">{resumenMonto.bs > 0 ? formatearMoneda(resumenMonto.bs, 'BS') : '—'}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Notas (opcional)</label>
                  <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Detalles adicionales..." rows={3} className={`${inputCls} resize-none`} />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="submit" disabled={saving} className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-medium text-white transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50">
                    {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Registrar'}
                  </button>
                  <button type="button" onClick={resetForm} className={softButtonCls}>Cancelar</button>
                </div>
              </form>
            </div>
          )}

          <div className={`space-y-4 ${showForm ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
            <div className={`${panelCls} p-4`}>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-white/20 focus:bg-white/[0.05]"
                  />
                </div>

                <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value as 'todos' | EstadoEgreso)} className={inputCls}>
                  <option value="todos" className="bg-[#11131a]">Todos</option>
                  <option value="pagado" className="bg-[#11131a]">Pagado</option>
                  <option value="pendiente" className="bg-[#11131a]">Pendiente</option>
                  <option value="anulado" className="bg-[#11131a]">Anulado</option>
                  <option value="liquidado" className="bg-[#11131a]">Liquidado</option>
                </select>

                <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className={inputCls}>
                  <option value="todos" className="bg-[#11131a]">Todas las categorías</option>
                  {CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#11131a]">{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {egresosFiltrados.length === 0 ? (
                <div className={`${panelCls} p-12 text-center`}>
                  <p className="text-white/45">No hay egresos registrados</p>
                </div>
              ) : (
                egresosFiltrados.map((eg) => (
                  <div key={eg.id} className={`${panelCls} p-5 transition hover:bg-white/[0.04]`}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-medium text-white">{eg.concepto}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
                          <span>{eg.fecha}</span>
                          <span>•</span>
                          <span>{eg.categoria}</span>
                          {eg.proveedor ? (<><span>•</span><span>{eg.proveedor}</span></>) : null}
                          {eg.metodo_pago_v2?.nombre ? (<><span>•</span><span>{eg.metodo_pago_v2.nombre}</span></>) : null}
                          {eg.metodo_pago_v2?.cartera?.nombre ? (<><span>•</span><span>{eg.metodo_pago_v2.cartera.nombre}</span></>) : null}
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${estadoBadge(eg.estado)}`}>{eg.estado}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 lg:ml-4 lg:flex-shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-white">{formatearMoneda(Number(eg.monto_equivalente_usd || 0), 'USD')}</p>
                          <p className="mt-1 text-xs text-white/45">{formatearMoneda(Number(eg.monto_equivalente_bs || 0), 'BS')}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button onClick={() => startEdit(eg)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-white/60 transition hover:bg-white/[0.06] hover:text-white" title="Editar">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => eliminarEgreso(eg.id)} className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-2 text-rose-300 transition hover:bg-rose-400/15" title="Eliminar">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
