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
}

type Liquidacion = {
  id: string
  fecha_inicio: string
  fecha_fin: string
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
  pago_empleado_id: string | null
  egreso_id: string | null
}

type Tab = 'info' | 'agenda' | 'comisiones'

function getTodayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`
}

function getQuincenas() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const dia = now.getDate()
  const lastDay = new Date(y, now.getMonth() + 1, 0).getDate()

  const actual =
    dia <= 15
      ? {
          label: `1–15 de ${now.toLocaleDateString('es', { month: 'long' })}`,
          inicio: `${y}-${m}-01`,
          fin: `${y}-${m}-15`,
        }
      : {
          label: `16–${lastDay} de ${now.toLocaleDateString('es', { month: 'long' })}`,
          inicio: `${y}-${m}-16`,
          fin: `${y}-${m}-${String(lastDay).padStart(2, '0')}`,
        }

  let anteriorInicio: string
  let anteriorFin: string
  let anteriorLabel: string

  if (dia <= 15) {
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
    const prevYear = now.getMonth() === 0 ? y - 1 : y
    const prevLastDay = new Date(prevYear, prevMonth, 0).getDate()
    const pm = String(prevMonth).padStart(2, '0')
    anteriorInicio = `${prevYear}-${pm}-16`
    anteriorFin = `${prevYear}-${pm}-${String(prevLastDay).padStart(2, '0')}`
    anteriorLabel = `16–${prevLastDay} anterior`
  } else {
    anteriorInicio = `${y}-${m}-01`
    anteriorFin = `${y}-${m}-15`
    anteriorLabel = `1–15 de ${now.toLocaleDateString('es', { month: 'long' })}`
  }

  return {
    actual,
    anterior: {
      label: anteriorLabel,
      inicio: anteriorInicio,
      fin: anteriorFin,
    },
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

function formatDate(v: string | null) {
  if (!v) return '—'
  try {
    return new Date(`${v}T00:00:00`).toLocaleDateString('es')
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
  const [comisionesActual, setComisionesActual] = useState<ComisionDetalle[]>([])
  const [comisionesAnterior, setComisionesAnterior] = useState<ComisionDetalle[]>([])
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [facturando, setFacturando] = useState(false)
  const [agendaFiltro, setAgendaFiltro] = useState<'hoy' | 'proximos' | 'todos'>('hoy')
  const [agendaTipo, setAgendaTipo] = useState<'todos' | 'entrenamientos' | 'citas'>('todos')

  const [monedaPago, setMonedaPago] = useState<'USD' | 'BS'>('USD')

  useEffect(() => {
    setMounted(true)
  }, [])

  const hoy = useMemo(() => (mounted ? getTodayLocal() : ''), [mounted])

  const quincenas = useMemo(
    () =>
      mounted
        ? getQuincenas()
        : {
            actual: { label: '', inicio: '', fin: '' },
            anterior: { label: '', inicio: '', fin: '' },
          },
    [mounted]
  )

  useEffect(() => {
    if (!mounted || !id) return
    void loadAll()
  }, [id, mounted])

  async function loadAll() {
    if (!quincenas.actual.inicio || !quincenas.anterior.inicio) return

    setLoading(true)
    setErrorMsg('')

    const [empRes, clientesRes, entRes, citasRes, comActRes, comAntRes, liqRes] =
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

        supabase
          .from('comisiones_detalle')
          .select(`
            id,
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
            liquidacion_id,
            pago_empleado_id
          `)
          .eq('empleado_id', id)
          .gte('fecha', quincenas.actual.inicio)
          .lte('fecha', quincenas.actual.fin)
          .order('fecha', { ascending: false }),

        supabase
          .from('comisiones_detalle')
          .select(`
            id,
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
            liquidacion_id,
            pago_empleado_id
          `)
          .eq('empleado_id', id)
          .gte('fecha', quincenas.anterior.inicio)
          .lte('fecha', quincenas.anterior.fin)
          .order('fecha', { ascending: false }),

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
            pago_empleado_id,
            egreso_id
          `)
          .eq('empleado_id', id)
          .order('fecha_inicio', { ascending: false })
          .limit(12),
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

    setAgenda(
      [...ents, ...cts].sort((a, b) =>
        `${a.fecha} ${a.hora_inicio}`.localeCompare(`${b.fecha} ${b.hora_inicio}`)
      )
    )
    setComisionesActual((comActRes.data || []) as ComisionDetalle[])
    setComisionesAnterior((comAntRes.data || []) as ComisionDetalle[])
    setLiquidaciones((liqRes.data || []) as Liquidacion[])
    setLoading(false)
  }

  const agendaFiltrada = useMemo(() => {
    let items = agenda
    if (agendaTipo === 'entrenamientos') items = items.filter((x) => x.tipo === 'entrenamiento')
    if (agendaTipo === 'citas') items = items.filter((x) => x.tipo === 'cita')
    if (agendaFiltro === 'hoy') return items.filter((x) => x.fecha === hoy)
    if (agendaFiltro === 'proximos') return items.filter((x) => x.fecha >= hoy).slice(0, 20)
    return items
  }, [agenda, agendaFiltro, agendaTipo, hoy])

  const comisionesPendientesActual = useMemo(
    () => comisionesActual.filter((c) => isPendienteEstado(c.estado)),
    [comisionesActual]
  )

  const comisionesFacturadasActual = useMemo(
    () => comisionesActual.filter((c) => isFacturadaEstado(c.estado)),
    [comisionesActual]
  )

  const comisionesVisiblesActual = useMemo(
    () => comisionesActual.filter((c) => isPendienteEstado(c.estado)),
    [comisionesActual]
  )

  const resActual = useMemo(() => {
    const baseUsd = comisionesPendientesActual.reduce(
      (a, c) => a + Number(c.monto_base_usd ?? c.base ?? 0),
      0
    )
    const baseBs = comisionesPendientesActual.reduce((a, c) => a + Number(c.monto_base_bs ?? 0), 0)
    const profesionalUsd = comisionesPendientesActual.reduce(
      (a, c) => a + Number(c.monto_profesional_usd ?? c.profesional ?? 0),
      0
    )
    const profesionalBs = comisionesPendientesActual.reduce(
      (a, c) => a + Number(c.monto_profesional_bs ?? 0),
      0
    )
    const rpmUsd = comisionesPendientesActual.reduce(
      (a, c) => a + Number(c.monto_rpm_usd ?? c.rpm ?? 0),
      0
    )
    const rpmBs = comisionesPendientesActual.reduce((a, c) => a + Number(c.monto_rpm_bs ?? 0), 0)

    return {
      baseUsd: r2(baseUsd),
      baseBs: r2(baseBs),
      profesionalUsd: r2(profesionalUsd),
      profesionalBs: r2(profesionalBs),
      rpmUsd: r2(rpmUsd),
      rpmBs: r2(rpmBs),
      pendientes: comisionesPendientesActual.length,
      facturadas: comisionesFacturadasActual.length,
    }
  }, [comisionesPendientesActual, comisionesFacturadasActual])

  const resAnterior = useMemo(() => {
    const baseUsd = comisionesAnterior.reduce(
      (a, c) => a + Number(c.monto_base_usd ?? c.base ?? 0),
      0
    )
    const baseBs = comisionesAnterior.reduce((a, c) => a + Number(c.monto_base_bs ?? 0), 0)
    const profesionalUsd = comisionesAnterior.reduce(
      (a, c) => a + Number(c.monto_profesional_usd ?? c.profesional ?? 0),
      0
    )
    const profesionalBs = comisionesAnterior.reduce(
      (a, c) => a + Number(c.monto_profesional_bs ?? 0),
      0
    )
    const rpmUsd = comisionesAnterior.reduce(
      (a, c) => a + Number(c.monto_rpm_usd ?? c.rpm ?? 0),
      0
    )
    const rpmBs = comisionesAnterior.reduce((a, c) => a + Number(c.monto_rpm_bs ?? 0), 0)

    return {
      baseUsd: r2(baseUsd),
      baseBs: r2(baseBs),
      profesionalUsd: r2(profesionalUsd),
      profesionalBs: r2(profesionalBs),
      rpmUsd: r2(rpmUsd),
      rpmBs: r2(rpmBs),
    }
  }, [comisionesAnterior])

  const stats = useMemo(
    () => ({
      hoyTotal: agenda.filter((x) => x.fecha === hoy).length,
      comisionPendienteUsd: resActual.profesionalUsd,
      comisionPendienteBs: resActual.profesionalBs,
      registrosPendientes: resActual.pendientes,
    }),
    [agenda, hoy, resActual]
  )

  const montoFacturar = useMemo(() => {
    return monedaPago === 'USD'
      ? r2(resActual.profesionalUsd)
      : r2(resActual.profesionalBs)
  }, [monedaPago, resActual.profesionalUsd, resActual.profesionalBs])

  async function facturarQuincena() {
    const pendientes = comisionesPendientesActual

    if (pendientes.length === 0) {
      alert('No hay comisiones pendientes.')
      return
    }

    const montoPagoNum = montoFacturar

    const montoEquivalenteUsd =
      monedaPago === 'USD' ? r2(montoPagoNum) : r2(resActual.profesionalUsd)

    const montoEquivalenteBs =
      monedaPago === 'BS' ? r2(montoPagoNum) : r2(resActual.profesionalBs)

    const ok = window.confirm(
      `¿Facturar quincena ${quincenas.actual.label}?\n\n` +
        `Registros: ${pendientes.length}\n` +
        `Facturado: ${monedaPago === 'BS' ? formatBs(montoPagoNum) : formatMoney(montoPagoNum)}\n` +
        `Esto se agregará al historial y se restará de finanzas.`
    )

    if (!ok) return

    setFacturando(true)

    try {
      const { data: liquidacionExistente } = await supabase
        .from('comisiones_liquidaciones')
        .select('id')
        .eq('empleado_id', id)
        .eq('fecha_inicio', quincenas.actual.inicio)
        .eq('fecha_fin', quincenas.actual.fin)
        .maybeSingle()

      if (liquidacionExistente) {
        alert('Ya existe una liquidación para esta quincena. No se puede duplicar.')
        setFacturando(false)
        return
      }

      const fechaFacturacion = getTodayLocal()

      const { data: liquidacion, error: liqError } = await supabase
        .from('comisiones_liquidaciones')
        .insert({
          empleado_id: id,
          fecha_inicio: quincenas.actual.inicio,
          fecha_fin: quincenas.actual.fin,
          total_base: resActual.baseUsd,
          total_rpm: resActual.rpmUsd,
          total_profesional: resActual.profesionalUsd,
          cantidad_citas: pendientes.length,
          porcentaje_rpm: 100 - (empleado?.comision_plan_porcentaje ?? 40),
          porcentaje_profesional: empleado?.comision_plan_porcentaje ?? 40,
          estado: 'liquidado',
          pagado_at: new Date().toISOString(),
          notas: `Quincena ${quincenas.actual.label}`,
          moneda_pago: monedaPago,
          monto_pago: montoPagoNum,
          tasa_bcv: null,
          monto_equivalente_usd: montoEquivalenteUsd,
          monto_equivalente_bs: montoEquivalenteBs,
          metodo_pago_id: null,
          referencia: null,
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
          tipo: 'quincena',
          moneda_pago: monedaPago,
          monto_pago: montoPagoNum,
          tasa_bcv: null,
          monto_equivalente_usd: montoEquivalenteUsd,
          monto_equivalente_bs: montoEquivalenteBs,
          metodo_pago_id: null,
          referencia: null,
          liquidacion_id: liquidacion.id,
          notas: `Quincena ${quincenas.actual.label}`,
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
        throw new Error(detalleError.message || 'No se pudo crear el detalle de la facturación.')
      }

      const concepto = `Facturación quincena - ${empleado?.nombre || 'Profesional'} - ${quincenas.actual.label}`

      const { data: egreso, error: egresoError } = await supabase
        .from('egresos')
        .insert({
          fecha: fechaFacturacion,
          categoria: 'nomina',
          concepto,
          proveedor: empleado?.nombre || null,
          monto: montoPagoNum,
          metodo_pago_id: null,
          estado: 'liquidado',
          notas: `Quincena ${quincenas.actual.label}`,
          moneda: monedaPago,
          tasa_bcv: null,
          monto_equivalente_usd: montoEquivalenteUsd,
          monto_equivalente_bs: montoEquivalenteBs,
          empleado_id: id,
        })
        .select('id')
        .single()

      if (egresoError || !egreso) {
        throw new Error(egresoError?.message || 'No se pudo crear el egreso en finanzas.')
      }

      const { error: liqUpdateError } = await supabase
        .from('comisiones_liquidaciones')
        .update({
          pago_empleado_id: pagoEmpleado.id,
          egreso_id: egreso.id,
        })
        .eq('id', liquidacion.id)

      if (liqUpdateError) {
        throw new Error(liqUpdateError.message || 'No se pudo enlazar la liquidación.')
      }

      const { error: updError } = await supabase
        .from('comisiones_detalle')
        .update({
          estado: 'liquidado' ,
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
        `✅ Quincena facturada.\n\n` +
          `Monto: ${monedaPago === 'BS' ? formatBs(montoPagoNum) : formatMoney(montoPagoNum)}\n` +
          `Se agregó al historial y se restó de finanzas.`
      )

      setMonedaPago('USD')
      await loadAll()
    } catch (err: any) {
      console.error(err)
      alert(err?.message || 'Error al facturar la quincena.')
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

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Clientes" value={clientes.length} color="text-sky-400" />
        <StatCard title="Actividad hoy" value={stats.hoyTotal} color="text-violet-400" />
        <StatCard
          title="Pendiente USD"
          value={formatMoney(stats.comisionPendienteUsd)}
          color="text-emerald-400"
        />
        <StatCard
          title="Pendiente Bs"
          value={formatBs(stats.comisionPendienteBs)}
          color="text-amber-300"
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
            <Section title="Comisiones" description="Resumen de la quincena actual.">
              <div className="grid grid-cols-1 gap-3">
                <Card className="p-4 border-emerald-400/20 bg-emerald-400/5">
                  <p className="text-xs text-white/45">Profesional pendiente USD</p>
                  <p className="mt-1 text-xl font-bold text-emerald-400">
                    {formatMoney(resActual.profesionalUsd)}
                  </p>
                </Card>
                <Card className="p-4 border-amber-400/20 bg-amber-400/5">
                  <p className="text-xs text-white/45">Profesional pendiente Bs</p>
                  <p className="mt-1 text-xl font-bold text-amber-300">
                    {formatBs(resActual.profesionalBs)}
                  </p>
                </Card>
              </div>

              <button
                type="button"
                onClick={() => setTab('comisiones')}
                className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/[0.06]"
              >
                Ver comisiones completas →
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
          </div>

          {agendaFiltrada.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-sm text-white/45">
                {agendaFiltro === 'hoy' ? 'Sin actividad para hoy.' : 'Sin registros.'}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {agendaFiltrada.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${
                    item.tipo === 'entrenamiento'
                      ? 'border-violet-400/15 bg-violet-400/5'
                      : 'border-sky-400/15 bg-sky-400/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                        item.tipo === 'entrenamiento'
                          ? 'bg-violet-500/20 text-violet-300'
                          : 'bg-sky-500/20 text-sky-300'
                      }`}
                    >
                      {item.tipo === 'entrenamiento' ? 'E' : 'C'}
                    </div>
                    <div>
                      <p className="font-medium text-white">{item.nombre}</p>
                      <p className="text-xs text-white/45">
                        {formatDate(item.fecha)} · {item.hora_inicio.slice(0, 5)} –{' '}
                        {item.hora_fin.slice(0, 5)} · {item.subtitulo}
                      </p>
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
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'comisiones' && (
        <div className="space-y-6">
          <Section
            title={`Quincena actual · ${quincenas.actual.label}`}
            description="Todo lo de esta quincena se factura en la moneda que elijas y se resta de finanzas."
          >
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              <Card className="p-4">
                <p className="text-xs text-white/45">Base USD</p>
                <p className="mt-1 font-semibold text-white">{formatMoney(resActual.baseUsd)}</p>
                <p className="text-xs text-white/35">{formatBs(resActual.baseBs)}</p>
              </Card>

              <Card className="border-emerald-400/20 bg-emerald-400/5 p-4">
                <p className="text-xs text-white/45">Profesional</p>
                <p className="mt-1 font-semibold text-emerald-400">
                  {formatMoney(resActual.profesionalUsd)}
                </p>
                <p className="text-xs text-white/35">{formatBs(resActual.profesionalBs)}</p>
              </Card>

              <Card className="border-violet-400/20 bg-violet-400/5 p-4">
                <p className="text-xs text-white/45">RPM</p>
                <p className="mt-1 font-semibold text-violet-400">
                  {formatMoney(resActual.rpmUsd)}
                </p>
                <p className="text-xs text-white/35">{formatBs(resActual.rpmBs)}</p>
              </Card>
            </div>

            <Card className="mb-4 border-amber-400/20 bg-amber-400/5 p-4">
              <p className="text-sm font-medium text-amber-300">Facturar quincena</p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">Moneda</label>
                  <select
                    value={monedaPago}
                    onChange={(e) => setMonedaPago(e.target.value as 'USD' | 'BS')}
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

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">
                    Monto facturado
                  </label>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white">
                    {monedaPago === 'USD' ? formatMoney(montoFacturar) : formatBs(montoFacturar)}
                  </div>
                  <p className="mt-2 text-xs text-white/45">
                    El monto sale de la comisión congelada del profesional.
                  </p>
                </div>
              </div>

              {resActual.pendientes > 0 && (
                <button
                  type="button"
                  onClick={facturarQuincena}
                  disabled={facturando}
                  className="mt-4 w-full rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-60"
                >
                  {facturando
                    ? 'Facturando quincena...'
                    : `✓ Facturar quincena (${resActual.pendientes} registros)`}
                </button>
              )}

              {resActual.facturadas > 0 && (
                <p className="mt-3 text-xs text-white/35">
                  ✓ {resActual.facturadas} registro(s) ya facturado(s) en esta quincena
                </p>
              )}
            </Card>

            {comisionesVisiblesActual.length === 0 ? (
              <p className="text-sm text-white/45">
                Sin comisiones pendientes en esta quincena.
              </p>
            ) : (
              <div className="space-y-2">
                {comisionesVisiblesActual.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.tipo === 'plan'
                            ? 'bg-violet-500/10 text-violet-400'
                            : 'bg-sky-500/10 text-sky-400'
                        }`}
                      >
                        {c.tipo}
                      </span>
                      <span className="text-white/55">{formatDate(c.fecha)}</span>
                      <span className="text-xs text-amber-300/70">pendiente</span>
                    </div>

                    <div className="flex gap-4 text-right">
                      <div>
                        <p className="text-xs text-white/35">Prof. USD</p>
                        <p className="text-emerald-400">
                          {formatMoney(c.monto_profesional_usd ?? c.profesional)}
                        </p>
                        <p className="text-xs text-white/35">{formatBs(c.monto_profesional_bs)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section
            title={`Quincena anterior · ${quincenas.anterior.label}`}
            description="Período anterior."
          >
            {comisionesAnterior.length === 0 ? (
              <p className="text-sm text-white/45">Sin comisiones en la quincena anterior.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Card className="p-4">
                  <p className="text-xs text-white/45">Base</p>
                  <p className="mt-1 font-semibold text-white/70">
                    {formatMoney(resAnterior.baseUsd)}
                  </p>
                  <p className="text-xs text-white/35">{formatBs(resAnterior.baseBs)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-white/45">Profesional</p>
                  <p className="mt-1 font-semibold text-white/70">
                    {formatMoney(resAnterior.profesionalUsd)}
                  </p>
                  <p className="text-xs text-white/35">
                    {formatBs(resAnterior.profesionalBs)}
                  </p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-white/45">RPM</p>
                  <p className="mt-1 font-semibold text-white/70">
                    {formatMoney(resAnterior.rpmUsd)}
                  </p>
                  <p className="text-xs text-white/35">{formatBs(resAnterior.rpmBs)}</p>
                </Card>
              </div>
            )}
          </Section>

          {liquidaciones.length > 0 && (
            <Section title="Historial de quincenas" description="Quincenas facturadas.">
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
                          <p className="text-xs text-white/35">Facturado</p>
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
                            {liq.pagado_at
                              ? `Fecha: ${new Date(liq.pagado_at).toLocaleString()}`
                              : '—'}
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