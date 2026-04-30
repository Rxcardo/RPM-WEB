'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'

type Empleado = {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  rol: string
  especialidad: string | null
  estado: string
  comision_plan_porcentaje: number
  comision_cita_porcentaje: number
  created_at: string
}

type ClienteAsignado = {
  id: string
  nombre: string
  telefono: string | null
  estado: string
}

type AgendaItem = {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: string
  nombre: string
  subtitulo: string
  tipo: 'entrenamiento' | 'cita'
  notas: string | null
}

type ComisionDetalle = {
  id: string
  base: number
  profesional: number
  rpm: number
  fecha: string
  tipo: string
  estado: string
  moneda: 'USD' | 'BS' | string | null
  tasa_bcv: number | null
  monto_base_usd: number | null
  monto_base_bs: number | null
  monto_rpm_usd: number | null
  monto_rpm_bs: number | null
  monto_profesional_usd: number | null
  monto_profesional_bs: number | null
  pagado: boolean | null
  fecha_pago: string | null
  liquidacion_id?: string | null
  pago_empleado_id?: string | null
  cliente_id?: string | null
  cita_id?: string | null
  servicio_id?: string | null
  concepto?: string | null
  descripcion?: string | null
  cliente_nombre?: string | null
  servicio_nombre?: string | null
  cita_fecha?: string | null
  cita_hora_inicio?: string | null
}

type Liquidacion = {
  id: string
  fecha_inicio: string | null
  fecha_fin: string | null
  total_base: number
  total_profesional: number
  total_rpm: number
  cantidad_citas: number
  estado: string
  pagado_at: string | null
  moneda_pago: 'USD' | 'BS' | string | null
  monto_pago: number | null
  tasa_bcv: number | null
  monto_equivalente_usd: number | null
  monto_equivalente_bs: number | null
  referencia: string | null
  notas: string | null
  metodo_pago_id: string | null
  metodo_pago_v2_id?: string | null
  pago_empleado_id: string | null
  egreso_id: string | null
}


type EstadoCuentaEmpleado = {
  empleado_id: string
  nombre: string | null
  rol: string | null
  total_facturado_usd: number | null
  total_pagado_usd: number | null
  total_pendiente_usd: number | null
  credito_disponible_usd: number | null
  saldo_pendiente_neto_usd: number | null
  saldo_favor_neto_usd: number | null
}

type CuentaPendienteEmpleado = {
  id: string
  empleado_id: string | null
  empleado_nombre: string
  concepto: string
  monto_total_usd: number | null
  monto_pagado_usd: number | null
  saldo_usd: number | null
  fecha_venta: string
  fecha_vencimiento: string | null
  estado: string
}

type MetodoPago = {
  id: string
  nombre: string
  tipo?: string | null
  moneda?: string | null
  color?: string | null
  icono?: string | null
  cartera?: {
    id?: string
    nombre: string
    codigo: string
    saldo_actual?: number | string | null
    moneda?: string | null
  } | null
}

type SplitPago = {
  id: string
  metodoPagoId: string
  monto: string
}

type TipoCambioRow = {
  fecha?: string | null
  tasa?: number | string | null
  valor?: number | string | null
  monto?: number | string | null
  bcv?: number | string | null
  precio?: number | string | null
}

type Moneda = 'USD' | 'BS'
type Tab = 'info' | 'agenda' | 'comisiones'

function getTodayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`
}

function getCurrentQuincenaRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const dia = now.getDate()
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()

  if (dia <= 15) {
    return {
      label: `1–15 de ${now.toLocaleDateString('es', { month: 'long' })}`,
      inicio: `${y}-${m}-01`,
      fin: `${y}-${m}-15`,
    }
  }

  return {
    label: `16–${lastDay} de ${now.toLocaleDateString('es', { month: 'long' })}`,
    inicio: `${y}-${m}-16`,
    fin: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
  }
}

function formatMoney(v: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(v || 0))
}

function formatBs(v: number | null | undefined) {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(v || 0))
}

function formatMontoByMoneda(v: number | null | undefined, moneda: Moneda) {
  return moneda === 'USD' ? formatMoney(v) : formatBs(v)
}

function formatDate(v: string | null) {
  if (!v) return '—'
  try {
    return new Date(`${v}T00:00:00`).toLocaleDateString('es')
  } catch {
    return v
  }
}

function formatDateLong(v: string | null) {
  if (!v) return '—'
  try {
    return new Date(`${v}T00:00:00`).toLocaleDateString('es', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  } catch {
    return v
  }
}

function estadoBadge(e: string) {
  switch ((e || '').toLowerCase()) {
    case 'activo':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'inactivo':
      return 'border-white/10 bg-white/[0.05] text-white/50'
    case 'suspendido':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    default:
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
  }
}

function citaBadge(e: string) {
  switch ((e || '').toLowerCase()) {
    case 'confirmada':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'completada':
      return 'border-violet-400/20 bg-violet-400/10 text-violet-300'
    case 'cancelada':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'reprogramada':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    default:
      return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
  }
}

function inputCls(disabled = false) {
  return `
    w-full rounded-2xl border border-white/10 bg-white/[0.03]
    px-4 py-3 text-sm text-white outline-none transition
    placeholder:text-white/35
    focus:border-white/20 focus:bg-white/[0.05]
    ${disabled ? 'cursor-not-allowed opacity-60' : ''}
  `
}

function r2(v: number) {
  return Math.round(v * 100) / 100
}

function normalizeEstado(value: string | null | undefined) {
  return (value || '').trim().toLowerCase()
}

function isPendienteEstado(value: string | null | undefined) {
  return normalizeEstado(value) === 'pendiente'
}

function isFacturadaEstado(value: string | null | undefined) {
  const estado = normalizeEstado(value)
  return ['liquidado', 'liquidada', 'pagado', 'pagada'].includes(estado)
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeMetodoPago(row: any): MetodoPago {
  const cartera = firstOrNull(row?.cartera)

  return {
    id: String(row?.id ?? ''),
    nombre: String(row?.nombre ?? ''),
    tipo: row?.tipo ?? null,
    moneda: row?.moneda ?? null,
    color: row?.color ?? null,
    icono: row?.icono ?? null,
    cartera: cartera
      ? {
          id: cartera?.id ? String(cartera.id) : undefined,
          nombre: String(cartera?.nombre ?? ''),
          codigo: String(cartera?.codigo ?? ''),
          saldo_actual: cartera?.saldo_actual ?? null,
          moneda: cartera?.moneda ?? null,
        }
      : null,
  }
}

function monedaMetodoEsBs(metodo: MetodoPago | null) {
  if (!metodo) return false

  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const tipo = (metodo.tipo || '').toLowerCase()
  const carteraCodigo = (metodo.cartera?.codigo || '').toLowerCase()
  const carteraMoneda = (metodo.cartera?.moneda || '').toUpperCase()

  return (
    moneda === 'BS' ||
    moneda === 'VES' ||
    carteraMoneda === 'BS' ||
    carteraMoneda === 'VES' ||
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

function getMetodoMoneda(metodo: MetodoPago | null): Moneda {
  return monedaMetodoEsBs(metodo) ? 'BS' : 'USD'
}

function getMetodoSaldo(metodo: MetodoPago | null) {
  const raw = metodo?.cartera?.saldo_actual
  const n = Number(raw || 0)
  return Number.isFinite(n) ? n : 0
}

function getComisionMontoByMoneda(c: ComisionDetalle, moneda: Moneda) {
  return moneda === 'USD'
    ? Number(c.monto_profesional_usd ?? c.profesional ?? 0)
    : Number(c.monto_profesional_bs ?? 0)
}

function convertirMonto(
  monto: number,
  from: Moneda,
  to: Moneda,
  tasa: number | null | undefined
): number | null {
  const montoNum = Number(monto || 0)

  if (!Number.isFinite(montoNum)) return null
  if (from === to) return r2(montoNum)
  if (!tasa || tasa <= 0) return null

  if (from === 'USD' && to === 'BS') return r2(montoNum * tasa)
  if (from === 'BS' && to === 'USD') return r2(montoNum / tasa)

  return null
}


function normalizeComisionDetalle(row: any): ComisionDetalle {
  const cita = firstOrNull(row?.citas)
  const clienteDirecto = firstOrNull(row?.clientes)
  const servicioDirecto = firstOrNull(row?.servicios)
  const clienteCita = firstOrNull(cita?.clientes)
  const servicioCita = firstOrNull(cita?.servicios)

  return {
    ...(row as ComisionDetalle),
    cliente_nombre: row?.cliente_nombre ?? clienteDirecto?.nombre ?? clienteCita?.nombre ?? null,
    servicio_nombre: row?.servicio_nombre ?? servicioDirecto?.nombre ?? servicioCita?.nombre ?? null,
    cita_fecha: row?.cita_fecha ?? cita?.fecha ?? null,
    cita_hora_inicio: row?.cita_hora_inicio ?? cita?.hora_inicio ?? null,
    concepto: row?.concepto ?? row?.descripcion ?? null,
  }
}

function getComisionConcepto(c: ComisionDetalle) {
  if (c.concepto?.trim()) return c.concepto.trim()

  const tipo = (c.tipo || '').toLowerCase()
  const servicio = c.servicio_nombre?.trim()
  const cliente = c.cliente_nombre?.trim()

  if (servicio && cliente) return `${servicio} · ${cliente}`
  if (servicio) return servicio
  if (cliente) return `Comisión de ${cliente}`
  if (tipo === 'plan') return 'Comisión por plan'
  if (tipo === 'cita') return 'Comisión por cita'
  return 'Comisión'
}

function getComisionSubtitulo(c: ComisionDetalle) {
  const partes = [
    c.cliente_nombre ? `Cliente: ${c.cliente_nombre}` : null,
    c.servicio_nombre ? `Servicio: ${c.servicio_nombre}` : null,
    c.cita_hora_inicio ? `Hora: ${String(c.cita_hora_inicio).slice(0, 5)}` : null,
  ].filter(Boolean)

  return partes.length ? partes.join(' · ') : 'Sin detalle de cliente registrado'
}

function chunkAgendaByCliente(items: AgendaItem[]) {
  const map = new Map<string, { cliente: string; items: AgendaItem[] }>()

  for (const item of items) {
    const key = item.nombre || 'Sin cliente'
    if (!map.has(key)) {
      map.set(key, { cliente: key, items: [] })
    }
    map.get(key)!.items.push(item)
  }

  return [...map.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) =>
        `${a.fecha} ${a.hora_inicio}`.localeCompare(`${b.fecha} ${b.hora_inicio}`)
      ),
    }))
    .sort((a, b) => a.cliente.localeCompare(b.cliente))
}

export default function VerPersonalPage() {
  const params = useParams()
  const id =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : ''

  const [mounted, setMounted] = useState(false)

  const [tab, setTab] = useState<Tab>('info')
  const [loading, setLoading] = useState(true)
  const [empleado, setEmpleado] = useState<Empleado | null>(null)
  const [clientes, setClientes] = useState<ClienteAsignado[]>([])
  const [agenda, setAgenda] = useState<AgendaItem[]>([])
  const [comisiones, setComisiones] = useState<ComisionDetalle[]>([])
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])
  const [estadoCuentaEmpleado, setEstadoCuentaEmpleado] = useState<EstadoCuentaEmpleado | null>(null)
  const [cuentasPendientesEmpleado, setCuentasPendientesEmpleado] = useState<CuentaPendienteEmpleado[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [facturando, setFacturando] = useState(false)
  const [agendaFiltro, setAgendaFiltro] = useState<'hoy' | 'proximos' | 'todos'>('hoy')
  const [agendaTipo, setAgendaTipo] = useState<'todos' | 'entrenamientos' | 'citas'>('todos')
  const [agendaClienteFiltro, setAgendaClienteFiltro] = useState('todos')

  const [monedaPago, setMonedaPago] = useState<Moneda>('USD')
  const [referencia, setReferencia] = useState('')
  const [notasLiquidacion, setNotasLiquidacion] = useState('')
  const [tasaBCV, setTasaBCV] = useState<number | null>(null)
  const [tasaBCVAuto, setTasaBCVAuto] = useState<number | null>(null)
  const [cargandoTasa, setCargandoTasa] = useState(false)
  const [selectedComisionIds, setSelectedComisionIds] = useState<string[]>([])
  const [splitsPago, setSplitsPago] = useState<SplitPago[]>([
    { id: crypto.randomUUID(), metodoPagoId: '', monto: '' },
  ])

  useEffect(() => {
    setMounted(true)
  }, [])

  const hoy = useMemo(() => (mounted ? getTodayLocal() : ''), [mounted])
  const quincenaActual = useMemo(
    () =>
      mounted
        ? getCurrentQuincenaRange()
        : { label: '', inicio: '', fin: '' },
    [mounted]
  )

  useEffect(() => {
    if (!mounted || !id) return
    void loadAll()
  }, [id, mounted])

  useEffect(() => {
    setSelectedComisionIds([])
    setSplitsPago([{ id: crypto.randomUUID(), metodoPagoId: '', monto: '' }])
    setReferencia('')
    setNotasLiquidacion('')
    setTasaBCV(null)
    setTasaBCVAuto(null)
  }, [monedaPago])

  async function fetchComisionesDetalladas(empleadoId: string) {
    // IMPORTANTE:
    // En tu BD, comisiones_detalle SÍ tiene cliente_id, cita_id y servicio_id,
    // pero no tiene FK directa declarada hacia clientes/servicios. Por eso Supabase
    // no puede hacer clientes:cliente_id ni servicios:servicio_id desde esta tabla.
    // La solución estable es cargar la comisión base y luego resolver cliente/servicio
    // manualmente por IDs y por cita_id.
    const baseSelect = `
      id,
      liquidacion_id,
      cita_id,
      empleado_id,
      cliente_id,
      servicio_id,
      cliente_plan_id,
      base,
      profesional,
      rpm,
      fecha,
      tipo,
      estado,
      moneda,
      tasa_bcv,
      monto_base_usd,
      monto_base_bs,
      monto_rpm_usd,
      monto_rpm_bs,
      monto_profesional_usd,
      monto_profesional_bs,
      pagado,
      fecha_pago,
      pago_empleado_id,
      porcentaje_rpm
    `

    const comRes = await supabase
      .from('comisiones_detalle')
      .select(baseSelect)
      .eq('empleado_id', empleadoId)
      .order('fecha', { ascending: false })

    if (comRes.error) return comRes

    const rows = ((comRes.data || []) as any[])

    const citaIds = [...new Set(rows.map((r) => r.cita_id).filter(Boolean))]
    const clienteIdsDirectos = [...new Set(rows.map((r) => r.cliente_id).filter(Boolean))]
    const servicioIdsDirectos = [...new Set(rows.map((r) => r.servicio_id).filter(Boolean))]

    const [citasSettled, clientesSettled, serviciosSettled] = await Promise.allSettled([
      citaIds.length
        ? supabase
            .from('citas')
            .select('id, fecha, hora_inicio, cliente_id, servicio_id, clientes:cliente_id ( nombre ), servicios:servicio_id ( nombre )')
            .in('id', citaIds)
        : Promise.resolve({ data: [], error: null }),
      clienteIdsDirectos.length
        ? supabase.from('clientes').select('id, nombre').in('id', clienteIdsDirectos)
        : Promise.resolve({ data: [], error: null }),
      servicioIdsDirectos.length
        ? supabase.from('servicios').select('id, nombre').in('id', servicioIdsDirectos)
        : Promise.resolve({ data: [], error: null }),
    ])

    const citasData = citasSettled.status === 'fulfilled' && !citasSettled.value.error
      ? ((citasSettled.value.data || []) as any[])
      : []

    const clientesData = clientesSettled.status === 'fulfilled' && !clientesSettled.value.error
      ? ((clientesSettled.value.data || []) as any[])
      : []

    const serviciosData = serviciosSettled.status === 'fulfilled' && !serviciosSettled.value.error
      ? ((serviciosSettled.value.data || []) as any[])
      : []

    const citasMap = new Map(citasData.map((c) => [String(c.id), c]))
    const clientesMap = new Map(clientesData.map((c) => [String(c.id), c]))
    const serviciosMap = new Map(serviciosData.map((s) => [String(s.id), s]))

    const data = rows.map((row) => {
      const cita = row.cita_id ? citasMap.get(String(row.cita_id)) : null
      const clienteDirecto = row.cliente_id ? clientesMap.get(String(row.cliente_id)) : null
      const servicioDirecto = row.servicio_id ? serviciosMap.get(String(row.servicio_id)) : null

      const clienteNombre =
        clienteDirecto?.nombre ||
        firstOrNull(cita?.clientes)?.nombre ||
        null

      const servicioNombre =
        servicioDirecto?.nombre ||
        firstOrNull(cita?.servicios)?.nombre ||
        null

      return normalizeComisionDetalle({
        ...row,
        citas: cita,
        cliente_nombre: clienteNombre,
        servicio_nombre: servicioNombre,
        cita_fecha: cita?.fecha ?? null,
        cita_hora_inicio: cita?.hora_inicio ?? null,
        // Este concepto es calculado para UI porque comisiones_detalle no tiene columna concepto.
        concepto: servicioNombre && clienteNombre
          ? `${servicioNombre} · ${clienteNombre}`
          : servicioNombre
            ? servicioNombre
            : clienteNombre
              ? `Comisión de ${clienteNombre}`
              : null,
      })
    })

    return { ...comRes, data }
  }

  async function loadAll() {
    setLoading(true)
    setErrorMsg('')

    const [empRes, clientesRes, entRes, citasRes, comRes, liqRes, metodosRes, estadoCuentaRes, cuentasEmpleadoRes] =
      await Promise.all([
        supabase
          .from('empleados')
          .select(
            'id, nombre, email, telefono, rol, especialidad, estado, comision_plan_porcentaje, comision_cita_porcentaje, created_at'
          )
          .eq('id', id)
          .single(),

        supabase
          .from('clientes')
          .select('id, nombre, telefono, estado')
          .eq('terapeuta_id', id)
          .eq('estado', 'activo')
          .order('nombre'),

        supabase
          .from('entrenamientos')
          .select('id, fecha, hora_inicio, hora_fin, estado, clientes:cliente_id ( nombre )')
          .eq('empleado_id', id)
          .order('fecha')
          .order('hora_inicio'),

        supabase
          .from('citas')
          .select(
            'id, fecha, hora_inicio, hora_fin, estado, notas, clientes:cliente_id ( nombre ), servicios:servicio_id ( nombre )'
          )
          .eq('terapeuta_id', id)
          .order('fecha')
          .order('hora_inicio'),

        fetchComisionesDetalladas(id),

        supabase
          .from('comisiones_liquidaciones')
          .select(`
            id,
            fecha_inicio,
            fecha_fin,
            total_base,
            total_profesional,
            total_rpm,
            cantidad_citas,
            estado,
            pagado_at,
            moneda_pago,
            monto_pago,
            tasa_bcv,
            monto_equivalente_usd,
            monto_equivalente_bs,
            referencia,
            notas,
            metodo_pago_id,
            metodo_pago_v2_id,
            pago_empleado_id,
            egreso_id
          `)
          .eq('empleado_id', id)
          .order('pagado_at', { ascending: false })
          .limit(30),

        supabase
          .from('metodos_pago_v2')
          .select(`
            id,
            nombre,
            tipo,
            moneda,
            color,
            icono,
            cartera:cartera_id (
              id,
              nombre,
              codigo,
              saldo_actual,
              moneda
            )
          `)
          .eq('activo', true)
          .eq('permite_pagar', true)
          .order('orden', { ascending: true })
          .order('nombre', { ascending: true }),

        supabase
          .from('v_empleados_estado_cuenta')
          .select('empleado_id, nombre, rol, total_facturado_usd, total_pagado_usd, total_pendiente_usd, credito_disponible_usd, saldo_pendiente_neto_usd, saldo_favor_neto_usd')
          .eq('empleado_id', id)
          .maybeSingle(),

        supabase
          .from('v_empleados_cuentas_por_cobrar_resumen')
          .select('id, empleado_id, empleado_nombre, concepto, monto_total_usd, monto_pagado_usd, saldo_usd, fecha_venta, fecha_vencimiento, estado')
          .eq('empleado_id', id)
          .in('estado', ['pendiente', 'parcial', 'vencida'])
          .order('fecha_venta', { ascending: true }),
      ])

    if (empRes.error || !empRes.data) {
      setErrorMsg('No se pudo cargar.')
      setLoading(false)
      return
    }

    setEmpleado(empRes.data as Empleado)
    setClientes((clientesRes.data || []) as ClienteAsignado[])

    const ents = ((entRes.data || []) as any[]).map((e) => ({
      id: e.id,
      fecha: e.fecha,
      hora_inicio: e.hora_inicio,
      hora_fin: e.hora_fin,
      estado: e.estado,
      nombre: e.clientes?.nombre || '—',
      subtitulo: 'Entrenamiento',
      tipo: 'entrenamiento' as const,
      notas: null,
    }))

    const cts = ((citasRes.data || []) as any[]).map((c) => ({
      id: c.id,
      fecha: c.fecha,
      hora_inicio: c.hora_inicio,
      hora_fin: c.hora_fin,
      estado: c.estado,
      nombre: c.clientes?.nombre || '—',
      subtitulo: c.servicios?.nombre || 'Cita',
      tipo: 'cita' as const,
      notas: c.notas,
    }))

    const metodosNormalizados: MetodoPago[] = ((metodosRes.data || []) as any[]).map(
      normalizeMetodoPago
    )

    setAgenda(
      [...ents, ...cts].sort((a, b) =>
        `${a.fecha} ${a.hora_inicio}`.localeCompare(`${b.fecha} ${b.hora_inicio}`)
      )
    )

    setComisiones(((comRes.data || []) as any[]).map(normalizeComisionDetalle))
    setLiquidaciones((liqRes.data || []) as Liquidacion[])
    setMetodosPago(metodosNormalizados)
    setEstadoCuentaEmpleado((estadoCuentaRes.data as EstadoCuentaEmpleado | null) ?? null)
    setCuentasPendientesEmpleado((cuentasEmpleadoRes.data || []) as CuentaPendienteEmpleado[])
    setLoading(false)
  }

  async function resolverTasaBCVActual() {
    const hoyFecha = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('tipos_cambio')
      .select('*')
      .lte('fecha', hoyFecha)
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

    return r2(posibleTasa)
  }

  async function cargarTasaBCVAutomatica() {
    setCargandoTasa(true)

    try {
      const tasa = await resolverTasaBCVActual()
      setTasaBCVAuto(tasa)
      setTasaBCV((prev) => (prev && prev > 0 ? prev : tasa))
    } catch {
      setTasaBCVAuto(null)
    } finally {
      setCargandoTasa(false)
    }
  }

  const agendaFiltrada = useMemo(() => {
    let items = agenda

    if (agendaTipo === 'entrenamientos') items = items.filter((x) => x.tipo === 'entrenamiento')
    if (agendaTipo === 'citas') items = items.filter((x) => x.tipo === 'cita')
    if (agendaFiltro === 'hoy') items = items.filter((x) => x.fecha === hoy)
    if (agendaFiltro === 'proximos') items = items.filter((x) => x.fecha >= hoy).slice(0, 100)

    if (agendaClienteFiltro !== 'todos') {
      items = items.filter((x) => x.nombre === agendaClienteFiltro)
    }

    return items
  }, [agenda, agendaFiltro, agendaTipo, agendaClienteFiltro, hoy])

  const agendaAgrupadaPorCliente = useMemo(
    () => chunkAgendaByCliente(agendaFiltrada),
    [agendaFiltrada]
  )

  const comisionesPendientes = useMemo(
    () => comisiones.filter((c) => isPendienteEstado(c.estado)),
    [comisiones]
  )

  const comisionesLiquidadaHoyQuincena = useMemo(
    () =>
      comisiones.filter((c) => {
        if (!isFacturadaEstado(c.estado)) return false
        return c.fecha >= quincenaActual.inicio && c.fecha <= quincenaActual.fin
      }),
    [comisiones, quincenaActual]
  )

  const comisionesDisponibles = useMemo(
    () => comisiones.filter((c) => isPendienteEstado(c.estado)),
    [comisiones]
  )

  const resumenDisponible = useMemo(() => {
    const baseUsd = comisionesDisponibles.reduce(
      (a, c) => a + Number(c.monto_base_usd ?? c.base ?? 0),
      0
    )
    const baseBs = comisionesDisponibles.reduce(
      (a, c) => a + Number(c.monto_base_bs ?? 0),
      0
    )
    const profesionalUsd = comisionesDisponibles.reduce(
      (a, c) => a + Number(c.monto_profesional_usd ?? c.profesional ?? 0),
      0
    )
    const profesionalBs = comisionesDisponibles.reduce(
      (a, c) => a + Number(c.monto_profesional_bs ?? 0),
      0
    )
    const rpmUsd = comisionesDisponibles.reduce(
      (a, c) => a + Number(c.monto_rpm_usd ?? c.rpm ?? 0),
      0
    )
    const rpmBs = comisionesDisponibles.reduce(
      (a, c) => a + Number(c.monto_rpm_bs ?? 0),
      0
    )

    return {
      baseUsd: r2(baseUsd),
      baseBs: r2(baseBs),
      profesionalUsd: r2(profesionalUsd),
      profesionalBs: r2(profesionalBs),
      rpmUsd: r2(rpmUsd),
      rpmBs: r2(rpmBs),
      pendientes: comisionesDisponibles.length,
    }
  }, [comisionesDisponibles])

  const stats = useMemo(
    () => ({
      hoyTotal: agenda.filter((x) => x.fecha === hoy).length,
      comisionPendienteUsd: resumenDisponible.profesionalUsd,
      comisionPendienteBs: resumenDisponible.profesionalBs,
      registrosPendientes: resumenDisponible.pendientes,
    }),
    [agenda, hoy, resumenDisponible]
  )

  const comisionesPendientesMoneda = useMemo(() => {
    return comisionesPendientes.filter((c) => getComisionMontoByMoneda(c, monedaPago) > 0)
  }, [comisionesPendientes, monedaPago])

  const allCurrentCurrencySelected = useMemo(() => {
    if (comisionesPendientesMoneda.length === 0) return false
    return comisionesPendientesMoneda.every((c) => selectedComisionIds.includes(c.id))
  }, [comisionesPendientesMoneda, selectedComisionIds])

  const comisionesSeleccionadas = useMemo(() => {
    const ids = new Set(selectedComisionIds)
    return comisionesPendientesMoneda.filter((c) => ids.has(c.id))
  }, [comisionesPendientesMoneda, selectedComisionIds])

  const resumenSeleccionado = useMemo(() => {
    const baseUsd = comisionesSeleccionadas.reduce(
      (a, c) => a + Number(c.monto_base_usd ?? c.base ?? 0),
      0
    )
    const baseBs = comisionesSeleccionadas.reduce(
      (a, c) => a + Number(c.monto_base_bs ?? 0),
      0
    )
    const profesionalUsd = comisionesSeleccionadas.reduce(
      (a, c) => a + Number(c.monto_profesional_usd ?? c.profesional ?? 0),
      0
    )
    const profesionalBs = comisionesSeleccionadas.reduce(
      (a, c) => a + Number(c.monto_profesional_bs ?? 0),
      0
    )
    const rpmUsd = comisionesSeleccionadas.reduce(
      (a, c) => a + Number(c.monto_rpm_usd ?? c.rpm ?? 0),
      0
    )
    const rpmBs = comisionesSeleccionadas.reduce(
      (a, c) => a + Number(c.monto_rpm_bs ?? 0),
      0
    )

    return {
      baseUsd: r2(baseUsd),
      baseBs: r2(baseBs),
      profesionalUsd: r2(profesionalUsd),
      profesionalBs: r2(profesionalBs),
      rpmUsd: r2(rpmUsd),
      rpmBs: r2(rpmBs),
      pendientes: comisionesSeleccionadas.length,
    }
  }, [comisionesSeleccionadas])

  const totalSplits = useMemo(() => {
    return r2(
      splitsPago.reduce((acc, split) => {
        const monto = Number(split.monto || 0)
        return acc + (Number.isFinite(monto) ? monto : 0)
      }, 0)
    )
  }, [splitsPago])

  const montoFacturar = useMemo(() => {
    return monedaPago === 'USD'
      ? r2(resumenSeleccionado.profesionalUsd)
      : r2(resumenSeleccionado.profesionalBs)
  }, [monedaPago, resumenSeleccionado])

  const restantePorAsignar = useMemo(
    () => r2(montoFacturar - totalSplits),
    [montoFacturar, totalSplits]
  )

  const splitsConMetodo = useMemo(() => {
    return splitsPago.map((split) => {
      const metodo = metodosPago.find((m) => m.id === split.metodoPagoId) || null
      const metodoMoneda = getMetodoMoneda(metodo)
      const montoLiquidacion = r2(Number(split.monto || 0))
      const montoDescontar = convertirMonto(montoLiquidacion, monedaPago, metodoMoneda, tasaBCV)
      const requiereConversion = !!metodo && metodoMoneda !== monedaPago
      const saldo = getMetodoSaldo(metodo)

      return {
        ...split,
        metodo,
        metodoMoneda,
        montoLiquidacion,
        montoDescontar,
        requiereConversion,
        saldo,
      }
    })
  }, [splitsPago, metodosPago, monedaPago, tasaBCV])

  const requiereTasa = useMemo(() => {
    return splitsConMetodo.some((split) => split.metodo && split.requiereConversion)
  }, [splitsConMetodo])

  useEffect(() => {
    if (!requiereTasa) return
    if (tasaBCV && tasaBCV > 0) return
    void cargarTasaBCVAutomatica()
  }, [requiereTasa, tasaBCV])

  function toggleComision(idComision: string) {
    setSelectedComisionIds((prev) =>
      prev.includes(idComision) ? prev.filter((id) => id !== idComision) : [...prev, idComision]
    )
  }

  function selectAllCurrentCurrency() {
    if (allCurrentCurrencySelected) {
      setSelectedComisionIds([])
      return
    }
    setSelectedComisionIds(comisionesPendientesMoneda.map((c) => c.id))
  }

  function addSplit() {
    setSplitsPago((prev) => [...prev, { id: crypto.randomUUID(), metodoPagoId: '', monto: '' }])
  }

  function removeSplit(idSplit: string) {
    setSplitsPago((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((x) => x.id !== idSplit)
    })
  }

  function updateSplit(idSplit: string, patch: Partial<SplitPago>) {
    setSplitsPago((prev) => prev.map((x) => (x.id === idSplit ? { ...x, ...patch } : x)))
  }

  function fillRemainingOnSplit(idSplit: string) {
    const otros = splitsPago
      .filter((x) => x.id !== idSplit)
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const restante = r2(Math.max(montoFacturar - otros, 0))
    updateSplit(idSplit, { monto: String(restante) })
  }

  async function liquidarSaldoDisponible() {
    const pendientes = comisionesSeleccionadas

    if (pendientes.length === 0) {
      alert('Selecciona al menos una comisión pendiente.')
      return
    }

    const splitsValidos = splitsPago
      .map((s) => {
        const metodo = metodosPago.find((m) => m.id === s.metodoPagoId) || null
        const metodoMoneda = getMetodoMoneda(metodo)
        const montoNum = r2(Number(s.monto || 0))
        const montoDescontarMetodo = convertirMonto(montoNum, monedaPago, metodoMoneda, tasaBCV)

        return {
          ...s,
          montoNum,
          metodo,
          metodoMoneda,
          montoDescontarMetodo,
          requiereConversion: !!metodo && metodoMoneda !== monedaPago,
        }
      })
      .filter((s) => s.metodoPagoId && s.montoNum > 0)

    if (splitsValidos.length === 0) {
      alert('Debes indicar al menos un método de pago con monto.')
      return
    }

    const requiereConversion = splitsValidos.some((s) => s.requiereConversion)

    if (requiereConversion && (!tasaBCV || tasaBCV <= 0)) {
      alert('No se pudo obtener la tasa automática. Indícala manualmente para hacer la conversión.')
      return
    }

    const metodoIds = new Set<string>()
    for (const split of splitsValidos) {
      if (metodoIds.has(split.metodoPagoId)) {
        alert('No repitas el mismo método en dos líneas. Usa una sola línea por método.')
        return
      }
      metodoIds.add(split.metodoPagoId)
    }

    const sumaSplits = r2(splitsValidos.reduce((acc, x) => acc + x.montoNum, 0))
    if (sumaSplits !== montoFacturar) {
      alert(
        `La suma de métodos (${formatMontoByMoneda(sumaSplits, monedaPago)}) debe ser igual al monto a liquidar (${formatMontoByMoneda(montoFacturar, monedaPago)}).`
      )
      return
    }

    for (const split of splitsValidos) {
      if (!split.metodo) {
        alert('Uno de los métodos seleccionados no es válido.')
        return
      }

      if (split.requiereConversion && (split.montoDescontarMetodo === null || split.montoDescontarMetodo <= 0)) {
        alert(`No se pudo calcular la conversión para el método "${split.metodo.nombre}".`)
        return
      }

      const saldo = getMetodoSaldo(split.metodo)
      const montoContraMetodo = split.requiereConversion
        ? Number(split.montoDescontarMetodo || 0)
        : split.montoNum

      if (saldo > 0 && montoContraMetodo > saldo) {
        alert(
          `El método "${split.metodo.nombre}" no tiene saldo suficiente.\nSaldo: ${formatMontoByMoneda(
            saldo,
            split.metodoMoneda
          )}\nIntentas usar: ${formatMontoByMoneda(montoContraMetodo, split.metodoMoneda)}`
        )
        return
      }
    }

    const montoPagoNum = montoFacturar

    const montoEquivalenteUsd =
      monedaPago === 'USD'
        ? r2(montoPagoNum)
        : tasaBCV && tasaBCV > 0
          ? r2(montoPagoNum / tasaBCV)
          : r2(resumenSeleccionado.profesionalUsd)

    const montoEquivalenteBs =
      monedaPago === 'BS'
        ? r2(montoPagoNum)
        : tasaBCV && tasaBCV > 0
          ? r2(montoPagoNum * tasaBCV)
          : r2(resumenSeleccionado.profesionalBs)

    const fechaFacturacion = getTodayLocal()
    const fechaInicioRango = [...pendientes].map((c) => c.fecha).sort()[0]
    const fechaFinRango = [...pendientes]
      .map((c) => c.fecha)
      .sort()
      .slice(-1)[0]

    const resumenMetodos = splitsValidos
      .map((s) => {
        const nombre = s.metodo?.nombre || 'Método'
        const cartera = s.metodo?.cartera?.nombre ? ` / ${s.metodo.cartera.nombre}` : ''
        const baseTxt = formatMontoByMoneda(s.montoNum, monedaPago)

        if (!s.requiereConversion) {
          return `• ${nombre}${cartera}: ${baseTxt}`
        }

        const convertidoTxt = formatMontoByMoneda(s.montoDescontarMetodo, s.metodoMoneda)
        return `• ${nombre}${cartera}: ${baseTxt} → se descuenta ${convertidoTxt}`
      })
      .join('\n')

    const ok = window.confirm(
      `¿Liquidar comisiones seleccionadas?\n\n` +
        `Registros: ${pendientes.length}\n` +
        `Moneda liquidación: ${monedaPago}\n` +
        `Monto total: ${formatMontoByMoneda(montoPagoNum, monedaPago)}\n` +
        `${requiereConversion && tasaBCV ? `Tasa BCV: ${tasaBCV}\n` : ''}\n` +
        `Métodos:\n${resumenMetodos}`
    )

    if (!ok) return

    setFacturando(true)

    try {
      const notasFinales = [
        notasLiquidacion.trim() ||
          `Liquidación manual de saldo disponible - ${empleado?.nombre || 'Profesional'}`,
        '',
        `Moneda liquidación: ${monedaPago}`,
        ...(requiereConversion && tasaBCV ? [`Tasa BCV aplicada: ${tasaBCV}`] : []),
        '',
        'Desglose de pago:',
        ...splitsValidos.map((s) => {
          const nombre = s.metodo?.nombre || 'Método'
          const cartera = s.metodo?.cartera?.nombre ? ` (${s.metodo.cartera.nombre})` : ''
          const montoTxt = formatMontoByMoneda(s.montoNum, monedaPago)

          if (!s.requiereConversion) {
            return `- ${nombre}${cartera}: ${montoTxt}`
          }

          const convertidoTxt = formatMontoByMoneda(s.montoDescontarMetodo, s.metodoMoneda)
          return `- ${nombre}${cartera}: ${montoTxt} -> descontado ${convertidoTxt}`
        }),
      ].join('\n')

      const { data: liquidacion, error: liqError } = await supabase
        .from('comisiones_liquidaciones')
        .insert({
          empleado_id: id,
          fecha_inicio: fechaInicioRango,
          fecha_fin: fechaFinRango,
          total_base: resumenSeleccionado.baseUsd,
          total_rpm: resumenSeleccionado.rpmUsd,
          total_profesional: resumenSeleccionado.profesionalUsd,
          cantidad_citas: pendientes.length,
          porcentaje_rpm: 100 - (empleado?.comision_plan_porcentaje ?? 40),
          porcentaje_profesional: empleado?.comision_plan_porcentaje ?? 40,
          estado: 'liquidado',
          pagado_at: new Date().toISOString(),
          notas: notasFinales,
          moneda_pago: monedaPago,
          monto_pago: montoPagoNum,
          tasa_bcv: requiereConversion ? tasaBCV : null,
          monto_equivalente_usd: montoEquivalenteUsd,
          monto_equivalente_bs: montoEquivalenteBs,
          metodo_pago_id: null,
          metodo_pago_v2_id: splitsValidos[0]?.metodoPagoId || null,
          referencia: referencia.trim() || null,
        })
        .select('id')
        .single()

      if (liqError || !liquidacion) {
        throw new Error(liqError?.message || 'No se pudo crear la liquidación.')
      }

      const { data: pagoEmpleado, error: pagoEmpleadoError } = await supabase
        .from('pagos_empleados')
        .insert({
          empleado_id: id,
          fecha: fechaFacturacion,
          tipo: 'liquidacion_manual',
          moneda_pago: monedaPago,
          monto_pago: montoPagoNum,
          tasa_bcv: requiereConversion ? tasaBCV : null,
          monto_equivalente_usd: montoEquivalenteUsd,
          monto_equivalente_bs: montoEquivalenteBs,
          metodo_pago_id: null,
          metodo_pago_v2_id: splitsValidos[0]?.metodoPagoId || null,
          referencia: referencia.trim() || null,
          liquidacion_id: liquidacion.id,
          notas: notasFinales,
        })
        .select('id')
        .single()

      if (pagoEmpleadoError || !pagoEmpleado) {
        throw new Error(pagoEmpleadoError?.message || 'No se pudo crear el pago al empleado.')
      }

      const detalleRows = pendientes.map((c) => ({
        pago_empleado_id: pagoEmpleado.id,
        comision_id: c.id,
        monto_usd: Number(c.monto_profesional_usd ?? c.profesional ?? 0),
        monto_bs: Number(c.monto_profesional_bs ?? 0),
      }))

      const { error: detalleError } = await supabase
        .from('pagos_empleados_detalle')
        .insert(detalleRows)

      if (detalleError) {
        throw new Error(detalleError.message || 'No se pudo crear el detalle de la liquidación.')
      }

      const egresoIds: string[] = []

      for (let i = 0; i < splitsValidos.length; i++) {
        const split = splitsValidos[i]
        const concepto = `Liquidación comisión - ${empleado?.nombre || 'Profesional'} - ${fechaFacturacion} - Parte ${i + 1}/${splitsValidos.length}`

        const monedaMetodo = split.metodoMoneda
        const montoContraMetodo = split.requiereConversion
          ? Number(split.montoDescontarMetodo || 0)
          : split.montoNum

        const montoSplitUsd =
          monedaMetodo === 'USD'
            ? r2(montoContraMetodo)
            : tasaBCV && tasaBCV > 0
              ? r2(montoContraMetodo / tasaBCV)
              : 0

        const montoSplitBs =
          monedaMetodo === 'BS'
            ? r2(montoContraMetodo)
            : tasaBCV && tasaBCV > 0
              ? r2(montoContraMetodo * tasaBCV)
              : 0

        const { data: egreso, error: egresoError } = await supabase
          .from('egresos')
          .insert({
            fecha: fechaFacturacion,
            categoria: 'nomina',
            concepto,
            proveedor: empleado?.nombre || null,
            monto: montoContraMetodo,
            metodo_pago_id: null,
            metodo_pago_v2_id: split.metodoPagoId,
            estado: 'pagado',
            notas:
              `Liquidación parcial ${i + 1} de ${splitsValidos.length}\n` +
              `Liquidación total: ${formatMontoByMoneda(montoPagoNum, monedaPago)}\n` +
              `Parte aplicada a liquidación: ${formatMontoByMoneda(split.montoNum, monedaPago)}\n` +
              `Monto descontado del método: ${formatMontoByMoneda(montoContraMetodo, monedaMetodo)}\n` +
              notasFinales,
            moneda: monedaMetodo,
            tasa_bcv: split.requiereConversion ? tasaBCV : null,
            monto_equivalente_usd: montoSplitUsd,
            monto_equivalente_bs: montoSplitBs,
            empleado_id: id,
            referencia: referencia.trim() || null,
          })
          .select('id')
          .single()

        if (egresoError || !egreso) {
          throw new Error(egresoError?.message || 'No se pudo crear uno de los egresos en finanzas.')
        }

        egresoIds.push(egreso.id)
      }

      const { error: liqUpdateError } = await supabase
        .from('comisiones_liquidaciones')
        .update({
          pago_empleado_id: pagoEmpleado.id,
          egreso_id: egresoIds[0] || null,
        })
        .eq('id', liquidacion.id)

      if (liqUpdateError) {
        throw new Error(liqUpdateError.message || 'No se pudo enlazar la liquidación.')
      }

      const { error: updError } = await supabase
        .from('comisiones_detalle')
        .update({
          estado: 'liquidado',
          liquidacion_id: liquidacion.id,
          pagado: true,
          fecha_pago: fechaFacturacion,
          pago_empleado_id: pagoEmpleado.id,
        })
        .in(
          'id',
          pendientes.map((c) => c.id)
        )

      if (updError) {
        throw new Error(updError.message || 'No se pudieron actualizar las comisiones.')
      }

      alert(
        `✅ Liquidación realizada.\n\n` +
          `Moneda: ${monedaPago}\n` +
          `Monto: ${formatMontoByMoneda(montoPagoNum, monedaPago)}\n` +
          `Registros liquidados: ${pendientes.length}\n` +
          `Métodos usados: ${splitsValidos.length}`
      )

      setSelectedComisionIds([])
      setSplitsPago([{ id: crypto.randomUUID(), metodoPagoId: '', monto: '' }])
      setReferencia('')
      setNotasLiquidacion('')
      setTasaBCV(null)
      setTasaBCVAuto(null)
      await loadAll()
    } catch (err: any) {
      console.error(err)
      alert(err?.message || 'Error al liquidar el saldo disponible.')
    } finally {
      setFacturando(false)
    }
  }

  if (!mounted || loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/55">Personal</p>
        <h1 className="text-2xl font-semibold text-white">Perfil</h1>
        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando...</p>
        </Card>
      </div>
    )
  }

  if (!empleado) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/55">Personal</p>
        <h1 className="text-2xl font-semibold text-white">Perfil</h1>
        <Card className="p-6">
          <p className="text-sm text-rose-400">{errorMsg || 'No encontrado.'}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Personal</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            {empleado.nombre}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm text-white/55 capitalize">{empleado.rol}</span>
            {empleado.especialidad && (
              <span className="text-sm text-white/35">· {empleado.especialidad}</span>
            )}
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${estadoBadge(
                empleado.estado
              )}`}
            >
              {empleado.estado}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ActionCard
            title="Editar"
            description="Modificar información."
            href={`/admin/personas/personal/${id}/editar`}
          />
          <ActionCard
            title="Estadísticas"
            description="Ver métricas."
            href={`/admin/personas/personal/${id}/estadisticas`}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <StatCard title="Clientes" value={clientes.length} color="text-sky-400" />
        <StatCard title="Actividad hoy" value={stats.hoyTotal} color="text-violet-400" />
        <StatCard
          title="Disponible USD"
          value={formatMoney(stats.comisionPendienteUsd)}
          color="text-emerald-400"
        />
        <StatCard
          title="Disponible Bs"
          value={formatBs(stats.comisionPendienteBs)}
          color="text-amber-300"
        />
        <StatCard
          title="Debe"
          value={formatMoney(estadoCuentaEmpleado?.saldo_pendiente_neto_usd || 0)}
          color="text-rose-300"
        />
        <StatCard
          title="Crédito"
          value={formatMoney(estadoCuentaEmpleado?.saldo_favor_neto_usd || 0)}
          color="text-cyan-300"
        />
      </div>

      <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.02] p-1">
        {([
          { key: 'info', label: 'Información' },
          { key: 'agenda', label: `Agenda (${agendaFiltrada.length})` },
          { key: 'comisiones', label: 'Comisiones' },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              tab === t.key ? 'bg-white/[0.08] text-white' : 'text-white/45 hover:text-white/70'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <Section title="Información" description="Datos de contacto.">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-white/45">Email</p>
                  <p className="mt-1 text-sm text-white">{empleado.email || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/45">Teléfono</p>
                  <p className="mt-1 text-sm text-white">{empleado.telefono || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-white/45">Rol</p>
                  <p className="mt-1 text-sm capitalize text-white">{empleado.rol}</p>
                </div>
                <div>
                  <p className="text-xs text-white/45">Miembro desde</p>
                  <p className="mt-1 text-sm text-white">
                    {formatDate(empleado.created_at.slice(0, 10))}
                  </p>
                </div>
              </div>
            </Section>

            <Section title="Estado de cuenta" description="Deuda, crédito y consumos registrados al empleado.">
              <div className="grid gap-3 sm:grid-cols-4">
                <Card className="border-rose-400/20 bg-rose-400/5 p-4">
                  <p className="text-xs text-white/45">Deuda total</p>
                  <p className="mt-1 text-lg font-bold text-rose-300">
                    {formatMoney(estadoCuentaEmpleado?.total_pendiente_usd || 0)}
                  </p>
                </Card>
                <Card className="border-cyan-400/20 bg-cyan-400/5 p-4">
                  <p className="text-xs text-white/45">Crédito disponible</p>
                  <p className="mt-1 text-lg font-bold text-cyan-300">
                    {formatMoney(estadoCuentaEmpleado?.credito_disponible_usd || 0)}
                  </p>
                </Card>
                <Card className="border-amber-400/20 bg-amber-400/5 p-4">
                  <p className="text-xs text-white/45">Neto pendiente</p>
                  <p className="mt-1 text-lg font-bold text-amber-300">
                    {formatMoney(estadoCuentaEmpleado?.saldo_pendiente_neto_usd || 0)}
                  </p>
                </Card>
                <Card className="border-emerald-400/20 bg-emerald-400/5 p-4">
                  <p className="text-xs text-white/45">Saldo a favor neto</p>
                  <p className="mt-1 text-lg font-bold text-emerald-300">
                    {formatMoney(estadoCuentaEmpleado?.saldo_favor_neto_usd || 0)}
                  </p>
                </Card>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Link
                  href={`/admin/finanzas/ingresos?empleado=${id}&tipoIngreso=producto`}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
                >
                  Registrar consumo
                </Link>
                <Link
                  href={`/admin/finanzas/ingresos?empleado=${id}&tipoIngreso=saldo&destino=deuda`}
                  className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-400/15"
                >
                  Abonar deuda
                </Link>
                <Link
                  href={`/admin/finanzas/ingresos?empleado=${id}&tipoIngreso=saldo&destino=credito`}
                  className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/15"
                >
                  Agregar crédito
                </Link>
              </div>

              {cuentasPendientesEmpleado.length === 0 ? (
                <p className="mt-4 text-sm text-white/45">Sin deudas pendientes.</p>
              ) : (
                <div className="mt-4 space-y-2">
                  {cuentasPendientesEmpleado.map((cuenta) => (
                    <div key={cuenta.id} className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-medium text-white">{cuenta.concepto}</p>
                          <p className="text-xs text-white/45">
                            {formatDate(cuenta.fecha_venta)} · {cuenta.estado}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-white/35">Saldo</p>
                          <p className="font-semibold text-rose-300">{formatMoney(cuenta.saldo_usd)}</p>
                          <p className="text-xs text-white/35">
                            Pagado {formatMoney(cuenta.monto_pagado_usd)} de {formatMoney(cuenta.monto_total_usd)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section
              title={`Clientes (${clientes.length})`}
              description="Clientes activos asignados."
            >
              {clientes.length === 0 ? (
                <p className="text-sm text-white/45">Sin clientes asignados.</p>
              ) : (
                <div className="space-y-2">
                  {clientes.map((c) => (
                    <Link
                      key={c.id}
                      href={`/admin/personas/clientes/${c.id}`}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 transition hover:bg-white/[0.05]"
                    >
                      <div>
                        <p className="font-medium text-white">{c.nombre}</p>
                        {c.telefono && <p className="text-xs text-white/45">{c.telefono}</p>}
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${estadoBadge(
                          c.estado
                        )}`}
                      >
                        {c.estado}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </Section>
          </div>

          <div className="space-y-4">
            <Section title="Saldo disponible" description="Comisiones listas para liquidar.">
              <div className="grid grid-cols-1 gap-3">
                <Card className="border-emerald-400/20 bg-emerald-400/5 p-4">
                  <p className="text-xs text-white/45">Profesional disponible USD</p>
                  <p className="mt-1 text-xl font-bold text-emerald-400">
                    {formatMoney(resumenDisponible.profesionalUsd)}
                  </p>
                </Card>
                <Card className="border-amber-400/20 bg-amber-400/5 p-4">
                  <p className="text-xs text-white/45">Profesional disponible Bs</p>
                  <p className="mt-1 text-xl font-bold text-amber-300">
                    {formatBs(resumenDisponible.profesionalBs)}
                  </p>
                </Card>
              </div>

              <button
                type="button"
                onClick={() => setTab('comisiones')}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.06]"
              >
                Ver liquidación →
              </button>
            </Section>
          </div>
        </div>
      )}

      {tab === 'agenda' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.02] p-1">
              {([
                { key: 'hoy', label: 'Hoy' },
                { key: 'proximos', label: 'Próximos' },
                { key: 'todos', label: 'Todos' },
              ] as { key: typeof agendaFiltro; label: string }[]).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setAgendaFiltro(f.key)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    agendaFiltro === f.key
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/45 hover:text-white/70'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.02] p-1">
              {([
                { key: 'todos', label: 'Todos' },
                { key: 'entrenamientos', label: 'Entrenamientos' },
                { key: 'citas', label: 'Citas' },
              ] as { key: typeof agendaTipo; label: string }[]).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setAgendaTipo(f.key)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                    agendaTipo === f.key
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/45 hover:text-white/70'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="min-w-[240px]">
              <select
                value={agendaClienteFiltro}
                onChange={(e) => setAgendaClienteFiltro(e.target.value)}
                className={inputCls()}
              >
                <option value="todos" className="bg-[#11131a] text-white">
                  Todos los clientes
                </option>
                {[...new Set(agenda.map((a) => a.nombre))]
                  .sort()
                  .map((nombre) => (
                    <option key={nombre} value={nombre} className="bg-[#11131a] text-white">
                      {nombre}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {agendaAgrupadaPorCliente.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-white/45">
                {agendaFiltro === 'hoy' ? 'Sin actividad para hoy.' : 'Sin registros.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-4">
              {agendaAgrupadaPorCliente.map((group) => (
                <Card key={group.cliente} className="overflow-hidden p-0">
                  <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">{group.cliente}</p>
                        <p className="text-xs text-white/45">
                          {group.items.length} bloque(s) en agenda
                        </p>
                      </div>
                      <span className="rounded-xl border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs font-medium text-violet-300">
                        Cliente
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className={`rounded-2xl border px-4 py-3 ${
                          item.tipo === 'entrenamiento'
                            ? 'border-violet-400/15 bg-violet-400/5'
                            : 'border-sky-400/15 bg-sky-400/5'
                        }`}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                                item.tipo === 'entrenamiento'
                                  ? 'bg-violet-500/20 text-violet-300'
                                  : 'bg-sky-500/20 text-sky-300'
                              }`}
                            >
                              {item.tipo === 'entrenamiento' ? 'E' : 'C'}
                            </div>

                            <div>
                              <p className="font-medium text-white">{item.subtitulo}</p>
                              <p className="text-xs text-white/45">
                                {formatDateLong(item.fecha)} · {item.hora_inicio.slice(0, 5)} –{' '}
                                {item.hora_fin.slice(0, 5)}
                              </p>
                              {item.notas && (
                                <p className="mt-1 text-xs text-white/35">{item.notas}</p>
                              )}
                            </div>
                          </div>

                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${citaBadge(
                              item.estado
                            )}`}
                          >
                            {item.estado}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'comisiones' && (
        <div className="space-y-6">
          <Section
            title="Liquidación de comisiones"
            description="Selecciona las comisiones, la moneda y reparte el pago entre una o varias carteras/métodos."
          >
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              <Card className="p-4">
                <p className="text-xs text-white/45">Base USD</p>
                <p className="mt-1 font-semibold text-white">{formatMoney(resumenDisponible.baseUsd)}</p>
                <p className="text-xs text-white/35">{formatBs(resumenDisponible.baseBs)}</p>
              </Card>

              <Card className="border-emerald-400/20 bg-emerald-400/5 p-4">
                <p className="text-xs text-white/45">Profesional disponible</p>
                <p className="mt-1 font-semibold text-emerald-400">
                  {formatMoney(resumenDisponible.profesionalUsd)}
                </p>
                <p className="text-xs text-white/35">{formatBs(resumenDisponible.profesionalBs)}</p>
              </Card>

              <Card className="border-violet-400/20 bg-violet-400/5 p-4">
                <p className="text-xs text-white/45">RPM</p>
                <p className="mt-1 font-semibold text-violet-400">
                  {formatMoney(resumenDisponible.rpmUsd)}
                </p>
                <p className="text-xs text-white/35">{formatBs(resumenDisponible.rpmBs)}</p>
              </Card>
            </div>

            <Card className="mb-4 border-white/10 bg-white/[0.02] p-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">Moneda</label>
                  <select
                    value={monedaPago}
                    onChange={(e) => setMonedaPago(e.target.value as Moneda)}
                    className={inputCls()}
                  >
                    <option value="USD" className="bg-[#11131a] text-white">
                      USD
                    </option>
                    <option value="BS" className="bg-[#11131a] text-white">
                      BS
                    </option>
                  </select>
                </div>

                {requiereTasa && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-white/75">Tasa BCV</label>
                    <div className="space-y-2">
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        value={tasaBCV ?? ''}
                        onChange={(e) => setTasaBCV(e.target.value ? Number(e.target.value) : null)}
                        className={inputCls()}
                        placeholder="Ej: 36.52"
                      />

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void cargarTasaBCVAutomatica()}
                          disabled={cargandoTasa}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/75 hover:bg-white/[0.06] disabled:opacity-60"
                        >
                          {cargandoTasa ? 'Cargando tasa...' : 'Recargar tasa automática'}
                        </button>

                        {tasaBCVAuto && (
                          <span className="text-xs text-emerald-300">
                            Automática: {tasaBCVAuto}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-amber-300">
                        Solo se usa cuando el método está en una moneda distinta a la liquidación.
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">Seleccionadas</label>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white">
                    {resumenSeleccionado.pendientes} comisión(es)
                  </div>
                </div>
              </div>
            </Card>

            <Card className="mb-4 border-sky-400/20 bg-sky-400/5 p-4">
              <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-sky-300">
                    Comisiones pendientes para {monedaPago}
                  </p>
                  <p className="text-xs text-white/45">
                    Aquí eliges exactamente cuáles quieres liquidar en este momento.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={selectAllCurrentCurrency}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/[0.06]"
                >
                  {allCurrentCurrencySelected ? 'Quitar selección' : 'Seleccionar todas'}
                </button>
              </div>

              {comisionesPendientesMoneda.length === 0 ? (
                <p className="text-sm text-white/45">
                  No hay comisiones pendientes con monto para {monedaPago}.
                </p>
              ) : (
                <div className="grid gap-3">
                  {comisionesPendientesMoneda.map((c) => {
                    const checked = selectedComisionIds.includes(c.id)
                    const monto = getComisionMontoByMoneda(c, monedaPago)
                    const concepto = getComisionConcepto(c)
                    const subtitulo = getComisionSubtitulo(c)

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleComision(c.id)}
                        aria-pressed={checked}
                        className={`group w-full rounded-3xl border p-4 text-left transition ${
                          checked
                            ? 'border-emerald-400/40 bg-emerald-400/[0.10] shadow-[0_0_0_1px_rgba(52,211,153,0.08)]'
                            : 'border-white/10 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.045]'
                        }`}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  c.tipo === 'plan'
                                    ? 'bg-violet-500/10 text-violet-300'
                                    : 'bg-sky-500/10 text-sky-300'
                                }`}
                              >
                                {c.tipo || 'comisión'}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-white/55">
                                {formatDate(c.fecha)}
                              </span>
                              {checked && (
                                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                                  Seleccionada
                                </span>
                              )}
                            </div>

                            <p className="truncate text-sm font-semibold text-white md:text-base">
                              {concepto}
                            </p>
                            <p className="mt-1 text-xs text-white/45">{subtitulo}</p>

                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-white/55">
                                USD {formatMoney(c.monto_profesional_usd ?? c.profesional)}
                              </span>
                              <span className="rounded-full bg-white/[0.04] px-2.5 py-1 text-white/55">
                                Bs {formatBs(c.monto_profesional_bs)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 md:block md:text-right">
                            <div>
                              <p className="text-xs text-white/35">Monto a liquidar</p>
                              <p className="text-lg font-bold text-emerald-300">
                                {formatMontoByMoneda(monto, monedaPago)}
                              </p>
                            </div>
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-bold transition ${
                                checked
                                  ? 'border-emerald-400/40 bg-emerald-400/20 text-emerald-200'
                                  : 'border-white/10 bg-white/[0.03] text-white/25 group-hover:text-white/50'
                              }`}
                            >
                              {checked ? '✓' : '+'}
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </Card>

            <Card className="mb-4 border-amber-400/20 bg-amber-400/5 p-4">
              <p className="text-sm font-medium text-amber-300">Métodos de pago / carteras</p>
              <p className="mt-1 text-xs text-white/45">
                Puedes pagar con una sola cartera o dividir entre varias. Si el monto pendiente está en USD y eliges un método en Bs, aquí se calcula el equivalente con BCV para pagar la diferencia en bolívares.
              </p>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Card className="p-4">
                  <p className="text-xs text-white/45">Monto seleccionado</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {formatMontoByMoneda(montoFacturar, monedaPago)}
                  </p>
                </Card>

                <Card className="border-violet-400/20 bg-violet-400/5 p-4">
                  <p className="text-xs text-white/45">Asignado en métodos</p>
                  <p className="mt-1 text-lg font-semibold text-violet-300">
                    {formatMontoByMoneda(totalSplits, monedaPago)}
                  </p>
                </Card>

                <Card className="border-emerald-400/20 bg-emerald-400/5 p-4">
                  <p className="text-xs text-white/45">Restante por asignar</p>
                  <p
                    className={`mt-1 text-lg font-semibold ${
                      restantePorAsignar === 0 ? 'text-emerald-400' : 'text-amber-300'
                    }`}
                  >
                    {formatMontoByMoneda(restantePorAsignar, monedaPago)}
                  </p>
                </Card>
              </div>

              <div className="mt-4 space-y-3">
                {splitsConMetodo.map((split, index) => {
                  const metodo = split.metodo
                  const saldo = split.saldo
                  const monedaMetodo = split.metodoMoneda
                  const montoContraMetodo = split.requiereConversion
                    ? split.montoDescontar
                    : split.montoLiquidacion

                  return (
                    <div
                      key={split.id}
                      className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 md:grid-cols-[1.3fr_0.8fr_auto_auto]"
                    >
                      <div>
                        <label className="mb-2 block text-xs text-white/45">
                          Método #{index + 1}
                        </label>
                        <select
                          value={split.metodoPagoId}
                          onChange={(e) => updateSplit(split.id, { metodoPagoId: e.target.value })}
                          className={inputCls()}
                        >
                          <option value="" className="bg-[#11131a] text-white">
                            Seleccionar método
                          </option>
                          {metodosPago.map((m) => {
                            const saldoMetodo = getMetodoSaldo(m)
                            const monedaM = getMetodoMoneda(m)

                            return (
                              <option key={m.id} value={m.id} className="bg-[#11131a] text-white">
                                {m.nombre}
                                {m.cartera?.nombre ? ` · ${m.cartera.nombre}` : ''}
                                {` · ${monedaM}`}
                                {saldoMetodo > 0
                                  ? ` · Saldo ${formatMontoByMoneda(saldoMetodo, monedaM)}`
                                  : ''}
                              </option>
                            )
                          })}
                        </select>

                        {metodo && (
                          <div className="mt-2 space-y-1 text-xs text-white/40">
                            <p>
                              Cartera: {metodo.cartera?.nombre || '—'} · Moneda método: {monedaMetodo} ·
                              Saldo: {formatMontoByMoneda(saldo, monedaMetodo)}
                            </p>

                            {split.requiereConversion && (
                              <p className="text-amber-300">
                                Para cubrir {formatMontoByMoneda(split.montoLiquidacion, monedaPago)} en{' '}
                                {monedaPago}, se descontarán{' '}
                                {montoContraMetodo !== null
                                  ? formatMontoByMoneda(montoContraMetodo, monedaMetodo)
                                  : '—'}{' '}
                                de esta cartera.
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="mb-2 block text-xs text-white/45">
                          Monto en {monedaPago}
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={split.monto}
                          onChange={(e) => updateSplit(split.id, { monto: e.target.value })}
                          className={inputCls()}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => fillRemainingOnSplit(split.id)}
                          className="h-[50px] rounded-2xl border border-white/10 bg-white/[0.03] px-4 text-xs font-medium text-white/70 hover:bg-white/[0.06]"
                        >
                          Completar
                        </button>
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeSplit(split.id)}
                          className="h-[50px] rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 text-xs font-medium text-rose-300 hover:bg-rose-400/15"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={addSplit}
                className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.06]"
              >
                + Agregar otro método
              </button>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">
                    Referencia
                  </label>
                  <input
                    type="text"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    className={inputCls()}
                    placeholder="N° referencia"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">Notas</label>
                  <input
                    type="text"
                    value={notasLiquidacion}
                    onChange={(e) => setNotasLiquidacion(e.target.value)}
                    className={inputCls()}
                    placeholder="Notas de la liquidación"
                  />
                </div>
              </div>

              {resumenSeleccionado.pendientes > 0 && (
                <button
                  type="button"
                  onClick={liquidarSaldoDisponible}
                  disabled={facturando}
                  className="mt-4 w-full rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-60"
                >
                  {facturando
                    ? 'Liquidando saldo...'
                    : `✓ Liquidar ${resumenSeleccionado.pendientes} comisión(es) en ${monedaPago}`}
                </button>
              )}

              {comisionesLiquidadaHoyQuincena.length > 0 && (
                <p className="mt-3 text-xs text-white/35">
                  ✓ {comisionesLiquidadaHoyQuincena.length} registro(s) ya liquidados dentro de esta
                  quincena calendario, pero puedes seguir liquidando nuevos ingresos.
                </p>
              )}
            </Card>
          </Section>

          <Section
            title={`Quincena calendario actual · ${quincenaActual.label}`}
            description="Referencia visual. Ya no bloquea la liquidación."
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Card className="p-4">
                <p className="text-xs text-white/45">Pendiente dentro de quincena</p>
                <p className="mt-1 font-semibold text-white">
                  {
                    comisiones.filter(
                      (c) =>
                        isPendienteEstado(c.estado) &&
                        c.fecha >= quincenaActual.inicio &&
                        c.fecha <= quincenaActual.fin
                    ).length
                  }{' '}
                  registros
                </p>
              </Card>

              <Card className="p-4">
                <p className="text-xs text-white/45">Liquidado dentro de quincena</p>
                <p className="mt-1 font-semibold text-white">
                  {comisionesLiquidadaHoyQuincena.length} registros
                </p>
              </Card>

              <Card className="p-4">
                <p className="text-xs text-white/45">Rango</p>
                <p className="mt-1 font-semibold text-white">
                  {formatDate(quincenaActual.inicio)} – {formatDate(quincenaActual.fin)}
                </p>
              </Card>
            </div>
          </Section>

          {liquidaciones.length > 0 && (
            <Section title="Historial de liquidaciones" description="Pagos realizados al profesional.">
              <div className="space-y-3">
                {liquidaciones.map((liq) => (
                  <div
                    key={liq.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-medium text-white">
                          {formatDate(liq.fecha_inicio)} – {formatDate(liq.fecha_fin)}
                        </p>
                        <p className="text-xs text-white/45">
                          {liq.cantidad_citas} registros · Base USD: {formatMoney(liq.total_base)}
                        </p>
                        <p className="mt-1 text-xs text-white/35">
                          Moneda: {liq.moneda_pago || '—'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-right">
                        <div>
                          <p className="text-xs text-white/35">Liquidado</p>
                          <p className="font-semibold text-emerald-400">
                            {liq.moneda_pago === 'BS'
                              ? formatBs(liq.monto_pago)
                              : formatMoney(liq.monto_pago)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-white/35">Equivalente</p>
                          <p className="font-semibold text-white">
                            {formatMoney(liq.monto_equivalente_usd)}
                          </p>
                          <p className="text-xs text-white/35">
                            {formatBs(liq.monto_equivalente_bs)}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <span
                            className={`inline-flex rounded-xl border px-3 py-1.5 text-xs font-medium ${
                              isFacturadaEstado(liq.estado)
                                ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                                : 'border-amber-400/20 bg-amber-400/10 text-amber-300'
                            }`}
                          >
                            {isFacturadaEstado(liq.estado) ? '✓ Liquidado' : liq.estado}
                          </span>
                          <p className="mt-1 text-xs text-white/35">
                            {liq.pagado_at ? `Fecha: ${new Date(liq.pagado_at).toLocaleString()}` : '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      <Link
        href="/admin/personas/personal"
        className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
      >
        Volver al listado
      </Link>
    </div>
  )
}