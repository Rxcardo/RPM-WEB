'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Edit2,
  HandCoins,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import SelectorTasaBCV from '@/components/finanzas/SelectorTasaBCV'
import { formatearMoneda } from '@/lib/finanzas/tasas'

type EstadoEgreso = 'pagado' | 'pendiente' | 'anulado' | 'liquidado'
type MonedaPago = 'USD' | 'BS'
type CategoriaPrincipal = 'nomina' | 'liquidacion' | 'gasto'
type EstadoFiltro = 'todos' | EstadoEgreso
type PrincipalFiltro = 'todos' | CategoriaPrincipal

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

const CATEGORIAS_PRINCIPALES: Array<{ value: CategoriaPrincipal; label: string; descripcion: string }> = [
  { value: 'nomina', label: 'Nómina', descripcion: 'Pagos fijos del personal' },
  { value: 'liquidacion', label: 'Liquidación', descripcion: 'Liquidaciones de comisiones/profesionales' },
  { value: 'gasto', label: 'Gastos', descripcion: 'Operativos, servicios, equipos y más' },
]

const SUBCATEGORIAS_GASTO = [
  { value: 'gasto_operativo', label: 'Gasto operativo' },
  { value: 'gasto_alquiler', label: 'Alquiler' },
  { value: 'gasto_servicios', label: 'Servicios' },
  { value: 'gasto_mantenimiento', label: 'Mantenimiento' },
  { value: 'gasto_equipo', label: 'Equipo' },
  { value: 'gasto_marketing', label: 'Marketing' },
  { value: 'gasto_insumos', label: 'Insumos' },
  { value: 'gasto_transporte', label: 'Transporte' },
  { value: 'gasto_otros', label: 'Otros gastos' },
]

const LEGACY_GASTOS = new Set(['operativo', 'alquiler', 'servicios', 'equipos', 'equipo', 'mantenimiento', 'marketing', 'insumos', 'transporte', 'otros'])

const inputCls = 'w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-white outline-none transition placeholder:text-white/25 focus:border-white/[0.15] focus:bg-white/[0.05]'
const labelCls = 'mb-1 block text-[10px] font-semibold uppercase tracking-widest text-white/35'
const panelCls = 'rounded-2xl border border-white/[0.07] bg-[#080c18]'
const sectionCls = 'rounded-xl border border-white/[0.06] bg-white/[0.02]'
const ghostBtn = 'rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white/90'

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
  return { nombre, codigo, color: toStringOrNull(item.color), icono: toStringOrNull(item.icono) }
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
  const estado: EstadoEgreso = estadoRaw === 'pagado' || estadoRaw === 'pendiente' || estadoRaw === 'anulado' || estadoRaw === 'liquidado' ? estadoRaw : 'pendiente'
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
  return moneda === 'BS' || moneda === 'VES' || nombre.includes('bs') || nombre.includes('bolívar') || nombre.includes('bolivar') || nombre.includes('pago movil') || nombre.includes('pago móvil') || nombre.includes('movil') || nombre.includes('móvil') || tipo.includes('bs') || tipo.includes('bolívar') || tipo.includes('bolivar') || tipo.includes('pago_movil') || cartera.includes('bs') || cartera.includes('ves')
}

function metodoEsUsd(metodo: MetodoPago | null) {
  if (!metodo) return false
  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const tipo = (metodo.tipo || '').toLowerCase()
  const cartera = (metodo.cartera?.codigo || '').toLowerCase()
  return moneda === 'USD' || nombre.includes('usd') || nombre.includes('zelle') || nombre.includes('efectivo $') || nombre.includes('efectivo usd') || tipo.includes('usd') || cartera.includes('usd')
}

function calcularMontoEgreso(args: { moneda: MonedaPago; montoUsd: number; montoBs: number | null; tasaBcv: number | null }) {
  const montoUsd = r2(args.montoUsd || 0)
  const tasa = Number(args.tasaBcv || 0)
  if (args.moneda === 'USD') {
    return { moneda: 'USD' as const, monto: montoUsd, tasa_bcv: null as number | null, monto_equivalente_usd: montoUsd, monto_equivalente_bs: null as number | null }
  }
  const montoBs = r2(Number(args.montoBs || 0) > 0 ? Number(args.montoBs || 0) : montoUsd * tasa)
  const equivalenteUsd = tasa > 0 ? r2(montoBs / tasa) : montoUsd
  return { moneda: 'BS' as const, monto: montoBs, tasa_bcv: tasa, monto_equivalente_usd: equivalenteUsd, monto_equivalente_bs: montoBs }
}

function categoriaPrincipalDesdeCategoria(categoria: string): CategoriaPrincipal {
  const cat = (categoria || '').toLowerCase()
  if (cat === 'nomina' || cat === 'nómina') return 'nomina'
  if (cat === 'liquidacion' || cat === 'liquidación' || cat === 'comision' || cat === 'comisión' || cat === 'comisiones') return 'liquidacion'
  return 'gasto'
}

function categoriaPersistida(principal: CategoriaPrincipal, subcategoriaGasto: string) {
  if (principal === 'nomina') return 'nomina'
  if (principal === 'liquidacion') return 'liquidacion'
  return subcategoriaGasto || 'gasto_operativo'
}

function labelCategoria(categoria: string) {
  const principal = categoriaPrincipalDesdeCategoria(categoria)
  if (principal === 'nomina') return 'Nómina'
  if (principal === 'liquidacion') return 'Liquidación'
  const normalized = LEGACY_GASTOS.has(categoria) ? `gasto_${categoria === 'equipos' ? 'equipo' : categoria}` : categoria
  return SUBCATEGORIAS_GASTO.find((s) => s.value === normalized)?.label || categoria || 'Gasto'
}

function estadoBadge(estado: EstadoEgreso) {
  if (estado === 'pagado') return 'border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300'
  if (estado === 'pendiente') return 'border-amber-400/20 bg-amber-400/[0.08] text-amber-300'
  if (estado === 'liquidado') return 'border-violet-400/20 bg-violet-400/[0.08] text-violet-300'
  return 'border-rose-400/20 bg-rose-400/[0.08] text-rose-300'
}

function principalBadge(principal: CategoriaPrincipal) {
  if (principal === 'nomina') return 'border-sky-400/20 bg-sky-400/[0.08] text-sky-300'
  if (principal === 'liquidacion') return 'border-violet-400/20 bg-violet-400/[0.08] text-violet-300'
  return 'border-amber-400/20 bg-amber-400/[0.08] text-amber-300'
}

function formatDateShort(value: string | null | undefined) {
  if (!value) return '—'
  try { return new Date(value).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return value }
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={labelCls}>{label}</label>{children}</div>
}

function SegmentedControl({ options, value, onChange }: { options: { value: string; label: React.ReactNode }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-0.5">
      {options.map((opt) => (
        <button key={String(opt.value)} type="button" onClick={() => onChange(opt.value)} className={`flex-1 rounded-[10px] px-2.5 py-1.5 text-center text-xs font-semibold transition ${value === opt.value ? 'bg-white/[0.08] text-white shadow-sm' : 'text-white/35 hover:text-white/60'}`}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function LoadingEgresos() {
  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="h-20 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
        <div className="h-[600px] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
      </div>
    </div>
  )
}

export default function EgresosPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])

  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos')
  const [principalFiltro, setPrincipalFiltro] = useState<PrincipalFiltro>('todos')
  const [subcategoriaFiltro, setSubcategoriaFiltro] = useState('todos')
  const [metodoFiltro, setMetodoFiltro] = useState('todos')
  const [proveedorFiltro, setProveedorFiltro] = useState('todos')
  const [fechaDesdeFiltro, setFechaDesdeFiltro] = useState('')
  const [fechaHastaFiltro, setFechaHastaFiltro] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [concepto, setConcepto] = useState('')
  const [categoriaPrincipal, setCategoriaPrincipal] = useState<CategoriaPrincipal>('gasto')
  const [subcategoriaGasto, setSubcategoriaGasto] = useState('gasto_operativo')
  const [proveedor, setProveedor] = useState('')
  const [montoUSD, setMontoUSD] = useState('')
  const [estado, setEstado] = useState<'pagado' | 'pendiente'>('pagado')
  const [monedaPago, setMonedaPago] = useState<MonedaPago>('USD')
  const [metodoPagoId, setMetodoPagoId] = useState('')
  const [montoPagoBs, setMontoPagoBs] = useState<number | null>(null)
  const [tasaBCV, setTasaBCV] = useState<number | null>(null)
  const [notas, setNotas] = useState('')

  useEffect(() => { void cargarDatos() }, [])

  const metodosPagoDisponibles = useMemo(() => (monedaPago === 'USD' ? metodosPago.filter(metodoEsUsd) : metodosPago.filter(metodoEsBs)), [metodosPago, monedaPago])
  const metodoSeleccionado = useMemo(() => metodosPago.find((m) => m.id === metodoPagoId) || null, [metodosPago, metodoPagoId])

  const resumenMonto = useMemo(() => {
    const montoBaseUsd = Number(montoUSD || 0)
    if (!montoBaseUsd || montoBaseUsd <= 0) return { usd: 0, bs: 0 }
    const conversion = calcularMontoEgreso({ moneda: monedaPago, montoUsd: montoBaseUsd, montoBs: montoPagoBs, tasaBcv: tasaBCV })
    return { usd: conversion.monto_equivalente_usd, bs: conversion.monto_equivalente_bs || 0 }
  }, [montoUSD, monedaPago, montoPagoBs, tasaBCV])

  const proveedoresFiltroOpciones = useMemo(() => {
    const set = new Set<string>()
    egresos.forEach((e) => { if (e.proveedor) set.add(e.proveedor) })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [egresos])

  const metodosFiltroOpciones = useMemo(() => {
    const map = new Map<string, string>()
    egresos.forEach((e) => { if (e.metodo_pago_v2_id) map.set(e.metodo_pago_v2_id, e.metodo_pago_v2?.nombre || 'Método') })
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [egresos])

  const filtrosActivos = useMemo(() => [
    search.trim() ? 1 : 0,
    estadoFiltro !== 'todos' ? 1 : 0,
    principalFiltro !== 'todos' ? 1 : 0,
    subcategoriaFiltro !== 'todos' ? 1 : 0,
    metodoFiltro !== 'todos' ? 1 : 0,
    proveedorFiltro !== 'todos' ? 1 : 0,
    fechaDesdeFiltro ? 1 : 0,
    fechaHastaFiltro ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0), [search, estadoFiltro, principalFiltro, subcategoriaFiltro, metodoFiltro, proveedorFiltro, fechaDesdeFiltro, fechaHastaFiltro])

  const egresosFiltrados = useMemo(() => {
    return egresos.filter((eg) => {
      const principal = categoriaPrincipalDesdeCategoria(eg.categoria)
      const fechaEgreso = (eg.fecha || '').slice(0, 10)
      const categoriaNormalizada = LEGACY_GASTOS.has(eg.categoria) ? `gasto_${eg.categoria === 'equipos' ? 'equipo' : eg.categoria}` : eg.categoria
      if (estadoFiltro !== 'todos' && eg.estado !== estadoFiltro) return false
      if (principalFiltro !== 'todos' && principal !== principalFiltro) return false
      if (subcategoriaFiltro !== 'todos' && categoriaNormalizada !== subcategoriaFiltro) return false
      if (metodoFiltro !== 'todos' && eg.metodo_pago_v2_id !== metodoFiltro) return false
      if (proveedorFiltro !== 'todos' && eg.proveedor !== proveedorFiltro) return false
      if (fechaDesdeFiltro && fechaEgreso && fechaEgreso < fechaDesdeFiltro) return false
      if (fechaHastaFiltro && fechaEgreso && fechaEgreso > fechaHastaFiltro) return false
      if (search.trim()) {
        const s = search.trim().toLowerCase()
        return eg.concepto.toLowerCase().includes(s) || eg.categoria.toLowerCase().includes(s) || labelCategoria(eg.categoria).toLowerCase().includes(s) || (eg.proveedor || '').toLowerCase().includes(s) || (eg.notas || '').toLowerCase().includes(s) || (eg.metodo_pago_v2?.nombre || '').toLowerCase().includes(s) || (eg.metodo_pago_v2?.cartera?.nombre || '').toLowerCase().includes(s)
      }
      return true
    })
  }, [egresos, estadoFiltro, principalFiltro, subcategoriaFiltro, metodoFiltro, proveedorFiltro, fechaDesdeFiltro, fechaHastaFiltro, search])

  const totales = useMemo(() => {
    const base = egresosFiltrados.filter((e) => e.estado === 'pagado' || e.estado === 'liquidado')
    return {
      totalUSD: base.reduce((sum, e) => sum + Number(e.monto_equivalente_usd || 0), 0),
      totalBS: base.reduce((sum, e) => sum + Number(e.monto_equivalente_bs || 0), 0),
      cantidad: base.length,
      nomina: base.filter((e) => categoriaPrincipalDesdeCategoria(e.categoria) === 'nomina').reduce((sum, e) => sum + Number(e.monto_equivalente_usd || 0), 0),
      liquidacion: base.filter((e) => categoriaPrincipalDesdeCategoria(e.categoria) === 'liquidacion').reduce((sum, e) => sum + Number(e.monto_equivalente_usd || 0), 0),
      gastos: base.filter((e) => categoriaPrincipalDesdeCategoria(e.categoria) === 'gasto').reduce((sum, e) => sum + Number(e.monto_equivalente_usd || 0), 0),
    }
  }, [egresosFiltrados])

  async function cargarDatos() {
    setLoading(true)
    const [egresosRes, metodosRes] = await Promise.all([
      supabase.from('egresos').select(`id, fecha, concepto, categoria, proveedor, monto, estado, moneda, tasa_bcv, metodo_pago_v2_id, monto_equivalente_usd, monto_equivalente_bs, notas, metodo_pago_v2:metodo_pago_v2_id ( nombre, moneda, tipo, cartera:cartera_id ( nombre, codigo ) )`).order('fecha', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('metodos_pago_v2').select(`id, nombre, tipo, moneda, color, icono, activo, cartera:cartera_id ( nombre, codigo, color, icono )`).eq('activo', true).eq('permite_pagar', true).order('orden', { ascending: true }).order('nombre', { ascending: true }),
    ])
    if (egresosRes.error) alert('Error cargando egresos: ' + egresosRes.error.message)
    else setEgresos(((egresosRes.data || []) as RawEgreso[]).map(normalizeEgreso))
    if (metodosRes.error) alert('Error cargando métodos: ' + metodosRes.error.message)
    else setMetodosPago(((metodosRes.data || []) as RawMetodoPago[]).map(normalizeMetodoPago))
    setLoading(false)
  }

  function limpiarFiltros() {
    setSearch('')
    setEstadoFiltro('todos')
    setPrincipalFiltro('todos')
    setSubcategoriaFiltro('todos')
    setMetodoFiltro('todos')
    setProveedorFiltro('todos')
    setFechaDesdeFiltro('')
    setFechaHastaFiltro('')
  }

  function prepararNuevo(principal: CategoriaPrincipal = 'gasto', subcategoria = 'gasto_operativo') {
    resetForm(false)
    setCategoriaPrincipal(principal)
    setSubcategoriaGasto(subcategoria)
    if (principal === 'nomina') setConcepto('Pago de nómina')
    if (principal === 'liquidacion') setConcepto('Pago de liquidación')
    if (principal === 'gasto') setConcepto('')
    setShowForm(true)
  }

  function resetForm(cerrar = true) {
    setConcepto('')
    setCategoriaPrincipal('gasto')
    setSubcategoriaGasto('gasto_operativo')
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
    if (cerrar) setShowForm(false)
  }

  function startEdit(egreso: Egreso) {
    const monedaNormalizada: MonedaPago = (egreso.moneda || 'USD').toUpperCase() === 'BS' || (egreso.moneda || '').toUpperCase() === 'VES' ? 'BS' : 'USD'
    const principal = categoriaPrincipalDesdeCategoria(egreso.categoria)
    const sub = LEGACY_GASTOS.has(egreso.categoria) ? `gasto_${egreso.categoria === 'equipos' ? 'equipo' : egreso.categoria}` : egreso.categoria
    setEditingId(egreso.id)
    setFecha(egreso.fecha)
    setConcepto(egreso.concepto)
    setCategoriaPrincipal(principal)
    setSubcategoriaGasto(principal === 'gasto' ? sub || 'gasto_operativo' : 'gasto_operativo')
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
    if (!concepto.trim() || montoBaseUsd <= 0 || !metodoPagoId) { alert('Completa concepto, monto y método de pago.'); return }
    if (!metodoSeleccionado) { alert('Selecciona un método de pago válido.'); return }
    if (monedaPago === 'USD' && !metodoEsUsd(metodoSeleccionado)) { alert('El método seleccionado no corresponde a USD.'); return }
    if (monedaPago === 'BS' && !metodoEsBs(metodoSeleccionado)) { alert('El método seleccionado no corresponde a Bolívares.'); return }
    if (monedaPago === 'BS' && (!tasaBCV || tasaBCV <= 0)) { alert('Selecciona una tasa BCV válida para pagos en Bolívares.'); return }
    setSaving(true)
    try {
      const conversion = calcularMontoEgreso({ moneda: monedaPago, montoUsd: montoBaseUsd, montoBs: montoPagoBs, tasaBcv: tasaBCV })
      const payload = {
        fecha,
        concepto: concepto.trim(),
        categoria: categoriaPersistida(categoriaPrincipal, subcategoriaGasto),
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
    } finally { setSaving(false) }
  }

  async function eliminarEgreso(id: string) {
    if (!confirm('¿Eliminar este egreso?')) return
    try {
      const { error } = await supabase.from('egresos').delete().eq('id', id)
      if (error) throw error
      alert('✅ Egreso eliminado')
      await cargarDatos()
    } catch (err: any) { alert('Error: ' + (err.message || 'No se pudo eliminar')) }
  }

  if (loading) return <LoadingEgresos />

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/admin/finanzas" className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/35 transition hover:text-white/70"><ArrowLeft className="h-3.5 w-3.5" />Finanzas</Link>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-white">Egresos</h1>
            <p className="mt-0.5 text-xs text-white/35">Nómina · liquidaciones · gastos con pagos USD/Bs</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {[
              { label: 'USD', value: formatearMoneda(totales.totalUSD, 'USD'), color: 'text-rose-300' },
              { label: 'BS', value: formatearMoneda(totales.totalBS, 'BS'), color: 'text-amber-300' },
              { label: 'Ops.', value: String(totales.cantidad), color: 'text-white/70' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-right">
                <p className="text-[9px] font-semibold uppercase tracking-widest text-white/25">{kpi.label}</p>
                <p className={`mt-0.5 text-sm font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
            {!showForm && (
              <button onClick={() => prepararNuevo('gasto', 'gasto_operativo')} className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/70 transition hover:bg-white/[0.06] hover:text-white"><Plus className="h-3.5 w-3.5" />Nuevo</button>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" onClick={() => prepararNuevo('nomina')} className="rounded-2xl border border-sky-400/15 bg-sky-400/[0.04] p-3 text-left transition hover:bg-sky-400/[0.07]">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-sky-200">Nómina</span><BriefcaseBusiness className="h-4 w-4 text-sky-300/70" /></div>
            <p className="mt-1 text-sm font-bold text-white">{formatearMoneda(totales.nomina, 'USD')}</p>
            <p className="mt-0.5 text-[10px] text-white/30">Acceso directo</p>
          </button>
          <button type="button" onClick={() => prepararNuevo('liquidacion')} className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.04] p-3 text-left transition hover:bg-violet-400/[0.07]">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-violet-200">Liquidación</span><HandCoins className="h-4 w-4 text-violet-300/70" /></div>
            <p className="mt-1 text-sm font-bold text-white">{formatearMoneda(totales.liquidacion, 'USD')}</p>
            <p className="mt-0.5 text-[10px] text-white/30">Comisiones liquidadas y pagos variables</p>
          </button>
          <button type="button" onClick={() => prepararNuevo('gasto', 'gasto_operativo')} className="rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-3 text-left transition hover:bg-amber-400/[0.07]">
            <div className="flex items-center justify-between"><span className="text-xs font-semibold text-amber-200">Gastos</span><ReceiptText className="h-4 w-4 text-amber-300/70" /></div>
            <p className="mt-1 text-sm font-bold text-white">{formatearMoneda(totales.gastos, 'USD')}</p>
            <p className="mt-0.5 text-[10px] text-white/30">Operativo, alquiler, servicios...</p>
          </button>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          {showForm && (
            <div className="xl:col-span-1">
              <div className={`${panelCls} overflow-hidden`}>
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{editingId ? 'Editar egreso' : 'Nuevo egreso'}</p>
                    <p className="mt-0.5 text-[10px] text-white/30">Clasifica y registra la salida.</p>
                  </div>
                  <button type="button" onClick={() => resetForm()} className="rounded-lg border border-white/[0.07] bg-white/[0.03] p-1.5 text-white/35 transition hover:text-white/70"><X className="h-4 w-4" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 p-4">
                  <div className="grid grid-cols-2 gap-2">
                    <FieldRow label="Fecha *"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} required /></FieldRow>
                    <FieldRow label="Estado"><select value={estado} onChange={(e) => setEstado(e.target.value as 'pagado' | 'pendiente')} className={inputCls}><option value="pagado" className="bg-[#0d1120]">Pagado</option><option value="pendiente" className="bg-[#0d1120]">Pendiente</option></select></FieldRow>
                  </div>

                  <div>
                    <p className={labelCls}>Clasificación principal</p>
                    <SegmentedControl options={[{ value: 'nomina', label: 'Nómina' }, { value: 'liquidacion', label: 'Liquidación' }, { value: 'gasto', label: 'Gastos' }]} value={categoriaPrincipal} onChange={(v) => setCategoriaPrincipal(v as CategoriaPrincipal)} />
                  </div>

                  {categoriaPrincipal === 'gasto' && (
                    <FieldRow label="Subcategoría del gasto">
                      <select value={subcategoriaGasto} onChange={(e) => setSubcategoriaGasto(e.target.value)} className={inputCls}>
                        {SUBCATEGORIAS_GASTO.map((cat) => <option key={cat.value} value={cat.value} className="bg-[#0d1120]">{cat.label}</option>)}
                      </select>
                    </FieldRow>
                  )}

                  <FieldRow label="Concepto *"><input type="text" value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej: Pago de alquiler, liquidación, mantenimiento..." className={inputCls} required /></FieldRow>
                  <FieldRow label="Proveedor / persona"><input type="text" value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Nombre del proveedor, empleado o profesional" className={inputCls} /></FieldRow>
                  <FieldRow label="Monto base USD *">
                    <input type="number" step="0.01" min="0" value={montoUSD} onChange={(e) => { setMontoUSD(e.target.value); if (monedaPago === 'BS') setMontoPagoBs(null) }} placeholder="0.00" className={inputCls} required />
                    <p className="mt-1 text-[10px] text-white/30">Monto contable en USD. Si pagas en Bs, abajo se calcula el equivalente real.</p>
                  </FieldRow>

                  <div className={`${sectionCls} p-3`}>
                    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/35">Método de pago</p>
                    <div className="grid grid-cols-2 gap-2">
                      <FieldRow label="Moneda"><select value={monedaPago} onChange={(e) => { setMonedaPago(e.target.value as MonedaPago); setMetodoPagoId(''); setMontoPagoBs(null); setTasaBCV(null) }} className={inputCls}><option value="USD" className="bg-[#0d1120]">USD</option><option value="BS" className="bg-[#0d1120]">Bs</option></select></FieldRow>
                      <FieldRow label={monedaPago === 'USD' ? 'Método USD' : 'Método Bs'}>
                        <select value={metodoPagoId} onChange={(e) => setMetodoPagoId(e.target.value)} className={inputCls} required>
                          <option value="" className="bg-[#0d1120]">Seleccionar…</option>
                          {metodosPagoDisponibles.map((m) => <option key={m.id} value={m.id} className="bg-[#0d1120]">{m.nombre}{m.moneda ? ` · ${m.moneda}` : ''}{m.cartera?.nombre ? ` · ${m.cartera.nombre}` : ''}</option>)}
                        </select>
                      </FieldRow>
                    </div>

                    {monedaPago === 'BS' && estado === 'pagado' && (
                      <div className="mt-2">
                        <SelectorTasaBCV fecha={fecha} monedaPago="BS" monedaReferencia="EUR" montoUSD={Number(montoUSD || 0)} montoBs={montoPagoBs || undefined} onTasaChange={setTasaBCV} onMontoBsChange={(monto) => setMontoPagoBs(monto)} />
                      </div>
                    )}

                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2"><p className="text-[9px] text-white/30">Equiv. USD</p><p className="mt-0.5 text-xs font-bold text-white">{resumenMonto.usd > 0 ? formatearMoneda(resumenMonto.usd, 'USD') : '—'}</p></div>
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2"><p className="text-[9px] text-white/30">Monto Bs</p><p className="mt-0.5 text-xs font-bold text-amber-300">{resumenMonto.bs > 0 ? formatearMoneda(resumenMonto.bs, 'BS') : '—'}</p></div>
                    </div>
                  </div>

                  <FieldRow label="Notas"><textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Detalles adicionales..." rows={2} className={`${inputCls} resize-none`} /></FieldRow>

                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-xs font-bold text-white transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40">{saving ? 'Guardando…' : editingId ? 'Actualizar' : 'Registrar'}</button>
                    <button type="button" onClick={() => resetForm()} className={ghostBtn}>Cancelar</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className={`space-y-4 ${showForm ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
            <div className={`${panelCls} p-3`}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar concepto, proveedor, método, notas…" className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] py-2 pl-9 pr-3 text-xs text-white placeholder:text-white/25 outline-none transition focus:border-white/[0.12] focus:bg-white/[0.05]" />
                </div>
                {filtrosActivos > 0 && <button type="button" onClick={limpiarFiltros} className={`${ghostBtn} shrink-0`}>Limpiar ({filtrosActivos})</button>}
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1">
                {[{ value: 'todos', label: 'Todos' }, ...CATEGORIAS_PRINCIPALES.map((c) => ({ value: c.value, label: c.label }))].map((item) => (
                  <button key={item.value} type="button" onClick={() => { setPrincipalFiltro(item.value as PrincipalFiltro); if (item.value !== 'gasto') setSubcategoriaFiltro('todos') }} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${principalFiltro === item.value ? 'border-violet-400/30 bg-violet-500/[0.12] text-violet-200' : 'border-white/[0.07] bg-white/[0.02] text-white/40 hover:text-white/60'}`}>{item.label}</button>
                ))}
                <div className="ml-auto flex flex-wrap gap-1">
                  {(['todos', 'pagado', 'pendiente', 'anulado', 'liquidado'] as EstadoFiltro[]).map((e) => <button key={e} type="button" onClick={() => setEstadoFiltro(e)} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${estadoFiltro === e ? 'border-white/15 bg-white/[0.08] text-white' : 'border-white/[0.07] bg-white/[0.02] text-white/35 hover:text-white/55'}`}>{e === 'todos' ? 'Estado' : e.charAt(0).toUpperCase() + e.slice(1)}</button>)}
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <select value={subcategoriaFiltro} onChange={(e) => { setSubcategoriaFiltro(e.target.value); if (e.target.value !== 'todos') setPrincipalFiltro('gasto') }} className={inputCls}>
                  <option value="todos" className="bg-[#0d1120]">Todos los gastos</option>
                  {SUBCATEGORIAS_GASTO.map((cat) => <option key={cat.value} value={cat.value} className="bg-[#0d1120]">{cat.label}</option>)}
                </select>
                <select value={proveedorFiltro} onChange={(e) => setProveedorFiltro(e.target.value)} className={inputCls}>
                  <option value="todos" className="bg-[#0d1120]">Todos los proveedores</option>
                  {proveedoresFiltroOpciones.map((p) => <option key={p} value={p} className="bg-[#0d1120]">{p}</option>)}
                </select>
                <select value={metodoFiltro} onChange={(e) => setMetodoFiltro(e.target.value)} className={inputCls}>
                  <option value="todos" className="bg-[#0d1120]">Todos los métodos</option>
                  {metodosFiltroOpciones.map(([id, nombre]) => <option key={id} value={id} className="bg-[#0d1120]">{nombre}</option>)}
                </select>
                <div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" /><input type="date" value={fechaDesdeFiltro} onChange={(e) => setFechaDesdeFiltro(e.target.value)} className={`${inputCls} pl-9`} title="Desde" /></div>
                <div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" /><input type="date" value={fechaHastaFiltro} onChange={(e) => setFechaHastaFiltro(e.target.value)} className={`${inputCls} pl-9`} title="Hasta" /></div>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-white/[0.05] pt-2.5">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-white/20">Accesos</span>
                {SUBCATEGORIAS_GASTO.slice(0, 6).map((cat) => <button key={cat.value} type="button" onClick={() => { setPrincipalFiltro('gasto'); setSubcategoriaFiltro(cat.value) }} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition ${subcategoriaFiltro === cat.value ? 'border-amber-400/30 bg-amber-500/[0.10] text-amber-200' : 'border-white/[0.07] bg-white/[0.02] text-white/40 hover:text-white/60'}`}>{cat.label}</button>)}
              </div>
            </div>

            <div className="space-y-2">
              {egresosFiltrados.length === 0 ? (
                <div className={`${panelCls} flex flex-col items-center justify-center py-12`}><WalletCards className="mb-3 h-8 w-8 text-white/15" /><p className="text-sm text-white/30">Sin egresos registrados</p></div>
              ) : egresosFiltrados.map((eg) => {
                const principal = categoriaPrincipalDesdeCategoria(eg.categoria)
                return (
                  <div key={eg.id} className={`${panelCls} transition hover:border-white/[0.10]`}>
                    <div className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${eg.estado === 'pagado' || eg.estado === 'liquidado' ? 'bg-rose-400' : 'bg-amber-400'}`} />
                          <p className="truncate text-sm font-semibold text-white">{eg.concepto}</p>
                          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${principalBadge(principal)}`}>{CATEGORIAS_PRINCIPALES.find((c) => c.value === principal)?.label}</span>
                          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${estadoBadge(eg.estado)}`}>{eg.estado}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-white/30">
                          <span>{formatDateShort(eg.fecha)}</span><span>·</span><span>{labelCategoria(eg.categoria)}</span>
                          {eg.proveedor && <><span>·</span><span>{eg.proveedor}</span></>}
                          {eg.metodo_pago_v2?.nombre && <><span>·</span><span>{eg.metodo_pago_v2.nombre}</span></>}
                          {eg.metodo_pago_v2?.cartera?.nombre && <><span>·</span><span>{eg.metodo_pago_v2.cartera.nombre}</span></>}
                        </div>
                        {eg.notas && <p className="mt-2 line-clamp-2 text-[11px] text-white/35">{eg.notas}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="text-right">
                          <p className="text-sm font-bold text-white">{formatearMoneda(Number(eg.monto_equivalente_usd || 0), 'USD')}</p>
                          <p className="text-[10px] text-white/30">{formatearMoneda(Number(eg.monto_equivalente_bs || 0), 'BS')}</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(eg)} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-1.5 text-white/35 transition hover:text-white/70"><Edit2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => eliminarEgreso(eg.id)} className="rounded-lg border border-rose-400/15 bg-rose-400/[0.06] p-1.5 text-rose-300/60 transition hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
