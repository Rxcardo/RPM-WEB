'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { ArrowLeft, Plus, Search, Edit2, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import SelectorMetodoPago from '@/components/finanzas/SelectorMetodoPago'
import { formatearMoneda } from '@/lib/finanzas/tasas'

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
  estado: 'pagado' | 'pendiente' | 'anulado' | 'liquidado'
  metodo_pago_v2_id?: string | null
  metodo_pago_v2?: {
    nombre: string
    moneda?: string | null
    tipo?: string | null
    cartera?: {
      nombre: string
      codigo: string
    } | null
  } | null
}

interface TipoCambioRow {
  fecha?: string | null
  tasa?: number | string | null
  valor?: number | string | null
  monto?: number | string | null
  bcv?: number | string | null
  precio?: number | string | null
}

type RawCartera =
  | {
      nombre?: unknown
      codigo?: unknown
      color?: unknown
      icono?: unknown
    }
  | Array<{
      nombre?: unknown
      codigo?: unknown
      color?: unknown
      icono?: unknown
    }>
  | null
  | undefined

type RawMetodoPagoRelacionado =
  | {
      nombre?: unknown
      moneda?: unknown
      tipo?: unknown
      cartera?: RawCartera
    }
  | Array<{
      nombre?: unknown
      moneda?: unknown
      tipo?: unknown
      cartera?: RawCartera
    }>
  | null
  | undefined

type RawEgreso = {
  id?: unknown
  fecha?: unknown
  concepto?: unknown
  categoria?: unknown
  proveedor?: unknown
  monto?: unknown
  estado?: unknown
  moneda?: unknown
  metodo_pago_v2_id?: unknown
  monto_equivalente_usd?: unknown
  monto_equivalente_bs?: unknown
  metodo_pago_v2?: RawMetodoPagoRelacionado
}

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

const panelCls =
  'rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl'

const softButtonCls =
  'rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]'

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null
  return String(value)
}

function firstItem<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
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
    cartera: cartera
      ? {
          nombre: cartera.nombre,
          codigo: cartera.codigo,
        }
      : null,
  }
}

function normalizeEgreso(raw: RawEgreso): Egreso {
  const estadoRaw = String(raw.estado ?? 'pendiente')
  const estado: Egreso['estado'] =
    estadoRaw === 'pagado' ||
    estadoRaw === 'pendiente' ||
    estadoRaw === 'anulado' ||
    estadoRaw === 'liquidado'
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
    estado,
    metodo_pago_v2_id: toStringOrNull(raw.metodo_pago_v2_id),
    metodo_pago_v2: normalizeMetodoPagoRelacionado(raw.metodo_pago_v2),
  }
}

function monedaMetodoEsBs(metodo: MetodoPago | null) {
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
    tipo.includes('pago_movil') ||
    carteraCodigo.includes('bs') ||
    carteraCodigo.includes('ves')
  )
}

function calcularDesdeMontoUsd(montoUsd: number, esBs: boolean, tasaBCV: number) {
  const usd = Number((montoUsd || 0).toFixed(2))

  if (!esBs) {
    return {
      moneda: 'USD' as const,
      monto: usd,
      usd,
      bs: null as number | null,
      tasa: null as number | null,
    }
  }

  const bs = Number((usd * tasaBCV).toFixed(2))

  return {
    moneda: 'BS' as const,
    monto: bs,
    usd,
    bs,
    tasa: tasaBCV,
  }
}

export default function EgresosPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])

  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'pagado' | 'pendiente' | 'anulado' | 'liquidado'>('todos')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todos')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [concepto, setConcepto] = useState('')
  const [categoria, setCategoria] = useState('operativo')
  const [proveedor, setProveedor] = useState('')
  const [montoUSD, setMontoUSD] = useState('')
  const [metodoPagoId, setMetodoPagoId] = useState('')
  const [estado, setEstado] = useState<'pagado' | 'pendiente'>('pagado')
  const [notas, setNotas] = useState('')
  const [tasaBCV, setTasaBCV] = useState(0)

  useEffect(() => {
    void cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)

    const [egresosRes, metodosRes] = await Promise.all([
      supabase
        .from('egresos')
        .select(`
          id,
          fecha,
          concepto,
          categoria,
          proveedor,
          monto,
          estado,
          moneda,
          metodo_pago_v2_id,
          monto_equivalente_usd,
          monto_equivalente_bs,
          metodo_pago_v2:metodo_pago_v2_id (
            nombre,
            moneda,
            tipo,
            cartera:cartera_id (
              nombre,
              codigo
            )
          )
        `)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false }),

      supabase
        .from('metodos_pago_v2')
        .select(`
          id,
          nombre,
          tipo,
          moneda,
          color,
          icono,
          activo,
          cartera:cartera_id (
            nombre,
            codigo,
            color,
            icono
          )
        `)
        .eq('activo', true)
        .eq('permite_pagar', true)
        .order('orden', { ascending: true })
        .order('nombre', { ascending: true }),
    ])

    if (egresosRes.data) {
      const dataNormalizada = (egresosRes.data as RawEgreso[]).map(normalizeEgreso)
      setEgresos(dataNormalizada)
    }

    if (metodosRes.data) {
      const metodosNormalizados = (metodosRes.data as RawMetodoPago[]).map(normalizeMetodoPago)
      setMetodosPago(metodosNormalizados)
    }

    setLoading(false)
  }

  const metodoSeleccionado = useMemo(
    () => metodosPago.find((m) => m.id === metodoPagoId) || null,
    [metodosPago, metodoPagoId]
  )

  const esBs = useMemo(
    () => monedaMetodoEsBs(metodoSeleccionado),
    [metodoSeleccionado]
  )

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

  const resumenMonto = useMemo(() => {
    const montoBaseUsd = Number(montoUSD || 0)

    if (!montoBaseUsd || montoBaseUsd <= 0) {
      return {
        usd: 0,
        bs: 0,
      }
    }

    if (!esBs) {
      return {
        usd: Number(montoBaseUsd.toFixed(2)),
        bs: 0,
      }
    }

    if (!tasaBCV || tasaBCV <= 0) {
      return {
        usd: Number(montoBaseUsd.toFixed(2)),
        bs: 0,
      }
    }

    return {
      usd: Number(montoBaseUsd.toFixed(2)),
      bs: Number((montoBaseUsd * tasaBCV).toFixed(2)),
    }
  }, [montoUSD, esBs, tasaBCV])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!concepto.trim() || !montoUSD || Number(montoUSD) <= 0 || !metodoPagoId) {
      alert('Completa los campos obligatorios')
      return
    }

    const metodo = metodosPago.find((m) => m.id === metodoPagoId) || null
    const metodoEsBs = monedaMetodoEsBs(metodo)

    if (metodoEsBs && (!tasaBCV || tasaBCV <= 0)) {
      alert('Ingresa la tasa BCV para pagos en Bolívares')
      return
    }

    setSaving(true)

    try {
      const montoBaseUsd = Number(montoUSD)
      const conversion = calcularDesdeMontoUsd(
        montoBaseUsd,
        metodoEsBs,
        Number(tasaBCV || 0)
      )

      const payload = {
        fecha,
        concepto: concepto.trim(),
        categoria,
        proveedor: proveedor.trim() || null,
        moneda: conversion.moneda,
        monto: conversion.monto,
        tasa_bcv: conversion.tasa,
        monto_equivalente_usd: conversion.usd,
        monto_equivalente_bs: conversion.bs,
        metodo_pago_id: null,
        metodo_pago_v2_id: metodoPagoId,
        estado,
        notas: notas.trim() || null,
      }

      if (editingId) {
        const { error } = await supabase
          .from('egresos')
          .update(payload)
          .eq('id', editingId)

        if (error) throw error
        alert('✅ Egreso actualizado')
      } else {
        const { error } = await supabase
          .from('egresos')
          .insert(payload)

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

  function resetForm() {
    setConcepto('')
    setCategoria('operativo')
    setProveedor('')
    setMontoUSD('')
    setMetodoPagoId('')
    setEstado('pagado')
    setNotas('')
    setTasaBCV(0)
    setFecha(new Date().toISOString().slice(0, 10))
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(egreso: Egreso) {
    setEditingId(egreso.id)
    setFecha(egreso.fecha)
    setConcepto(egreso.concepto)
    setCategoria(egreso.categoria)
    setProveedor(egreso.proveedor || '')
    setMontoUSD(String(egreso.monto_equivalente_usd || 0))
    setMetodoPagoId(egreso.metodo_pago_v2_id || '')
    setEstado(egreso.estado === 'anulado' ? 'pendiente' : 'pagado')
    setNotas('')
    setTasaBCV(
      egreso.moneda?.toUpperCase() === 'BS' || egreso.moneda?.toUpperCase() === 'VES'
        ? Number(
            egreso.monto_equivalente_usd && egreso.monto_equivalente_bs
              ? Number(egreso.monto_equivalente_bs) / Number(egreso.monto_equivalente_usd)
              : 0
          )
        : 0
    )
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function eliminarEgreso(id: string) {
    if (!confirm('¿Eliminar este egreso?')) return

    try {
      const { error } = await supabase
        .from('egresos')
        .delete()
        .eq('id', id)

      if (error) throw error

      alert('✅ Egreso eliminado')
      await cargarDatos()
    } catch (err: any) {
      alert('Error: ' + (err.message || 'No se pudo eliminar'))
    }
  }

  const egresosFiltrados = useMemo(() => {
    return egresos.filter((eg) => {
      if (estadoFiltro !== 'todos' && eg.estado !== estadoFiltro) return false
      if (categoriaFiltro !== 'todos' && eg.categoria !== categoriaFiltro) return false

      if (search) {
        const s = search.toLowerCase()
        return (
          eg.concepto.toLowerCase().includes(s) ||
          eg.categoria.toLowerCase().includes(s) ||
          eg.proveedor?.toLowerCase().includes(s) ||
          eg.metodo_pago_v2?.nombre?.toLowerCase().includes(s) ||
          eg.metodo_pago_v2?.cartera?.nombre?.toLowerCase().includes(s)
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

  if (loading) {
    return (
      <div className="min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="space-y-6">
            <div className="h-20 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
            <div className="h-96 animate-pulse rounded-3xl border border-white/10 bg-white/[0.03]" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6 sm:space-y-8">
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
              Egresos
            </h1>
            <p className="mt-2 text-sm text-white/55">
              Registra y gestiona todos los gastos operativos.
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
                inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10
                bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/85 transition
                hover:bg-white/[0.06] sm:w-auto
              "
            >
              <Plus className="h-4 w-4" />
              Nuevo egreso
            </button>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-3">
          {showForm && (
            <div className="xl:col-span-1">
              <form
                onSubmit={handleSubmit}
                className={`${panelCls} space-y-5 p-6`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {editingId ? 'Editar egreso' : 'Nuevo egreso'}
                    </h2>
                    <p className="mt-1 text-xs text-white/45">
                      Completa los datos del gasto.
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
                  <label className={labelCls}>
                    Fecha *
                  </label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>

                <div>
                  <label className={labelCls}>
                    Concepto *
                  </label>
                  <input
                    type="text"
                    value={concepto}
                    onChange={(e) => setConcepto(e.target.value)}
                    placeholder="Ej: Pago de alquiler, Compra de equipos..."
                    className={inputCls}
                    required
                  />
                </div>

                <div>
                  <label className={labelCls}>
                    Categoría
                  </label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className={inputCls}
                  >
                    {CATEGORIAS.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#11131a]">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelCls}>
                    Proveedor (opcional)
                  </label>
                  <input
                    type="text"
                    value={proveedor}
                    onChange={(e) => setProveedor(e.target.value)}
                    placeholder="Nombre del proveedor"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>
                    Monto base (USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={montoUSD}
                    onChange={(e) => setMontoUSD(e.target.value)}
                    placeholder="0.00"
                    className={inputCls}
                    required
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/55">Monto base USD</span>
                    <span className="font-semibold text-white">
                      {resumenMonto.usd > 0 ? formatearMoneda(resumenMonto.usd, 'USD') : '—'}
                    </span>
                  </div>

                  {esBs && estado === 'pagado' && (
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-white/55">Monto a pagar en Bs</span>
                      <span className="font-semibold text-white">
                        {resumenMonto.bs > 0 ? formatearMoneda(resumenMonto.bs, 'BS') : '—'}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelCls}>
                    Estado
                  </label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as 'pagado' | 'pendiente')}
                    className={inputCls}
                  >
                    <option value="pagado" className="bg-[#11131a]">Pagado</option>
                    <option value="pendiente" className="bg-[#11131a]">Pendiente</option>
                  </select>
                </div>

               <SelectorMetodoPago
  metodoPagoId={metodoPagoId}
  onMetodoPagoChange={setMetodoPagoId}
  onTasaChange={setTasaBCV}
  tasaActual={tasaBCV}
  monto={esBs ? resumenMonto.bs : resumenMonto.usd}
/> 

                <div>
                  <label className={labelCls}>
                    Notas (opcional)
                  </label>
                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Detalles adicionales..."
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={saving}
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
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-white/20 focus:bg-white/[0.05]"
                  />
                </div>

                <select
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value as 'todos' | 'pagado' | 'pendiente' | 'anulado' | 'liquidado')}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-white/20 focus:bg-white/[0.05]"
                >
                  <option value="todos" className="bg-[#11131a]">Todos</option>
                  <option value="pagado" className="bg-[#11131a]">Pagado</option>
                  <option value="pendiente" className="bg-[#11131a]">Pendiente</option>
                  <option value="anulado" className="bg-[#11131a]">Anulado</option>
                  <option value="liquidado" className="bg-[#11131a]">Liquidado</option>
                </select>

                <select
                  value={categoriaFiltro}
                  onChange={(e) => setCategoriaFiltro(e.target.value)}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-white/20 focus:bg-white/[0.05]"
                >
                  <option value="todos" className="bg-[#11131a]">Todas las categorías</option>
                  {CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#11131a]">
                      {cat}
                    </option>
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
                  <div
                    key={eg.id}
                    className={`${panelCls} p-5 transition hover:bg-white/[0.04]`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-medium text-white">
                          {eg.concepto}
                        </h3>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/45">
                          <span>{eg.fecha}</span>
                          <span>•</span>
                          <span>{eg.categoria}</span>

                          {eg.proveedor && (
                            <>
                              <span>•</span>
                              <span>{eg.proveedor}</span>
                            </>
                          )}

                          {eg.metodo_pago_v2?.nombre && (
                            <>
                              <span>•</span>
                              <span>{eg.metodo_pago_v2.nombre}</span>
                            </>
                          )}

                          {eg.metodo_pago_v2?.cartera?.nombre && (
                            <>
                              <span>•</span>
                              <span>{eg.metodo_pago_v2.cartera.nombre}</span>
                            </>
                          )}

                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                              eg.estado === 'pagado'
                                ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                                : eg.estado === 'pendiente'
                                  ? 'border-amber-400/20 bg-amber-400/10 text-amber-300'
                                  : eg.estado === 'liquidado'
                                    ? 'border-violet-400/20 bg-violet-400/10 text-violet-300'
                                    : 'border-rose-400/20 bg-rose-400/10 text-rose-300'
                            }`}
                          >
                            {eg.estado}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 lg:ml-4 lg:flex-shrink-0">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-white">
                            {formatearMoneda(Number(eg.monto_equivalente_usd || 0), 'USD')}
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            {formatearMoneda(Number(eg.monto_equivalente_bs || 0), 'BS')}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEdit(eg)}
                            className="rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => eliminarEgreso(eg.id)}
                            className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-2 text-rose-300 transition hover:bg-rose-400/15"
                            title="Eliminar"
                          >
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