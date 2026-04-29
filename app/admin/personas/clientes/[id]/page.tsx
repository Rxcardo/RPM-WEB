'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'

type AuditorRef = {
  id: string
  nombre: string | null
} | null

type Cliente = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  estado: string
  created_at: string
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
  creado_por: AuditorRef
  editado_por: AuditorRef
}

type Plan = {
  id: string
  nombre: string
  sesiones_totales: number
  vigencia_valor: number
  vigencia_tipo: 'dias' | 'semanas' | 'meses' | string
  precio: number
  estado: string
  descripcion: string | null
}

type ClientePlanEstado = 'activo' | 'vencido' | 'agotado' | 'cancelado' | 'renovado'

type ClientePlan = {
  id: string
  cliente_id: string
  plan_id: string
  sesiones_totales: number
  sesiones_usadas: number
  fecha_inicio: string | null
  fecha_fin: string | null
  estado: ClientePlanEstado
  created_at: string
  planes: Plan | null
}

type Pago = {
  id: string
  fecha: string
  concepto: string
  categoria: string
  monto: number
  monto_pago: number | null
  monto_equivalente_usd: number | null
  monto_equivalente_bs: number | null
  moneda_pago: string | null
  estado: string
  tipo_origen: string
  notas: string | null
  metodos_pago: { nombre: string } | null
}

type Cita = {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: string
  notas: string | null
  empleados: { nombre: string } | null
  servicios: { nombre: string } | null
}

type EventoPlan = {
  id: string
  cliente_plan_id: string
  cliente_id: string
  tipo: 'asignado' | 'renovado' | 'cancelado' | 'agotado' | 'vencido'
  detalle: string | null
  created_at: string
}

type SesionPlan = {
  id: string
  cliente_plan_id: string | null
  cliente_id: string | null
  empleado_id: string | null
  fecha: string | null
  hora_inicio: string | null
  hora_fin: string | null
  estado: string | null
  asistencia_estado: string | null
  aviso_previo: boolean | null
  consume_sesion: boolean | null
  reprogramable: boolean | null
  motivo_asistencia: string | null
  fecha_asistencia: string | null
  reprogramado_de_entrenamiento_id: string | null
  empleados?: { nombre: string; rol?: string | null } | null
  clientes_planes?: {
    id: string
    fecha_fin?: string | null
    estado?: string | null
    planes?: { nombre?: string | null } | null
  } | null
}

type EstadoCuentaCliente = {
  cliente_id: string
  total_facturado_usd?: number | null
  total_pagado_usd?: number | null
  total_pendiente_usd?: number | null
  credito_disponible_usd?: number | null
  saldo_pendiente_neto_usd?: number | null
  saldo_favor_neto_usd?: number | null
}

type ReagendarForm = {
  fecha: string
  hora_inicio: string
  hora_fin: string
  motivo: string
}


type AsistenciaEstado = 'pendiente' | 'asistio' | 'no_asistio_aviso' | 'no_asistio_sin_aviso'

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function money(value: number | string | null | undefined, moneda: string | null | undefined = 'USD') {
  const amount = Number(value || 0)
  const monedaNormalizada = (moneda || 'USD').toUpperCase()

  if (monedaNormalizada === 'BS') {
    return `Bs ${amount.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount)
}

function truncateText(value: string | null | undefined, max = 24) {
  const text = (value || '').trim()
  if (!text) return 'Sin plan activo'
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}

function formatVigencia(valor: number | null | undefined, tipo: string | null | undefined) {
  const n = Number(valor || 0)
  const t = (tipo || '').toLowerCase()
  if (!n) return '—'
  if (t === 'dias') return `${n} ${n === 1 ? 'día' : 'días'}`
  if (t === 'semanas') return `${n} ${n === 1 ? 'semana' : 'semanas'}`
  if (t === 'meses') return `${n} ${n === 1 ? 'mes' : 'meses'}`
  return `${n} ${tipo || ''}`.trim()
}

function formatAuditDate(value: string | null | undefined) {
  if (!value) return '—'
  try { return new Date(value).toLocaleString() } catch { return value }
}

function getAuditLines(cliente: Cliente) {
  const creador = cliente.creado_por?.nombre || 'Sin registro'
  const editor = cliente.editado_por?.nombre || 'Sin registro'
  const createdAt = formatAuditDate(cliente.created_at)
  const updatedAt = formatAuditDate(cliente.updated_at)
  const wasEdited = !!cliente.updated_at && cliente.updated_at !== cliente.created_at && !!cliente.updated_by
  if (!wasEdited) return [`Creó: ${creador} · ${createdAt}`]
  return [`Creó: ${creador} · ${createdAt}`, `Editó: ${editor} · ${updatedAt}`]
}

function estadoPlanBadge(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'activo': return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'cancelado': return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'agotado': return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'vencido': return 'border-white/10 bg-white/[0.05] text-white/70'
    case 'renovado': return 'border-violet-400/20 bg-violet-400/10 text-violet-300'
    default: return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function estadoPagoBadge(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'pagado': return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'anulado': return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'pendiente': return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    default: return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function estadoCitaBadge(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'confirmada': return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
    case 'completada': return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'cancelada': return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'reprogramada': return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    default: return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function tipoEventoBadge(tipo: string) {
  switch ((tipo || '').toLowerCase()) {
    case 'asignado': return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
    case 'renovado': return 'border-violet-400/20 bg-violet-400/10 text-violet-300'
    case 'cancelado': return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'agotado': return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'vencido': return 'border-white/10 bg-white/[0.05] text-white/70'
    default: return 'border-white/10 bg-white/[0.05] text-white/70'
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
  return 'border-white/10 bg-white/[0.05] text-white/70'
}

function getPlanPriority(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'activo': return 5
    case 'agotado': return 4
    case 'vencido': return 3
    case 'renovado': return 2
    case 'cancelado': return 1
    default: return 0
  }
}

function getPlanStatusLabel(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'activo': return 'Activo'
    case 'agotado': return 'Agotado'
    case 'vencido': return 'Vencido'
    case 'renovado': return 'Renovado'
    case 'cancelado': return 'Cancelado'
    default: return estado || 'Sin estado'
  }
}


function getTodayKey() {
  return new Date().toISOString().slice(0, 10)
}

function isPlanOperativo(plan: ClientePlan | null | undefined, hoy = getTodayKey()) {
  if (!plan) return false
  const estado = (plan.estado || '').toLowerCase()
  if (estado !== 'activo') return false
  if (plan.fecha_fin && plan.fecha_fin < hoy) return false
  return true
}

function isSesionDePlanOperativo(sesion: SesionPlan, activePlanIds: Set<string>) {
  if (!sesion.cliente_plan_id || !activePlanIds.has(sesion.cliente_plan_id)) return false
  const estadoPlan = (sesion.clientes_planes?.estado || '').toLowerCase()
  if (estadoPlan && estadoPlan !== 'activo') return false
  const fechaFin = sesion.clientes_planes?.fecha_fin || null
  if (fechaFin && fechaFin < getTodayKey()) return false
  return true
}

type SesionesGrupoPlan = {
  plan: ClientePlan | null
  planId: string
  nombre: string
  estado: string
  fechaInicio: string | null
  fechaFin: string | null
  operativo: boolean
  sesiones: SesionPlan[]
  resumen: {
    asistio: number
    aviso: number
    sinAviso: number
    pendientes: number
    reprogramables: number
  }
}

function onlyHour(value: string | null | undefined) {
  return (value || '').slice(0, 5)
}

function normalizeTimeForDb(value: string) {
  const clean = (value || '').trim()
  if (!clean) return null
  return clean.length === 5 ? `${clean}:00` : clean
}

function dateTimeMs(fecha: string, hora: string) {
  return new Date(`${fecha}T${hora || '00:00'}`).getTime()
}

function addDaysToDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function getDurationMinutes(inicio: string | null | undefined, fin: string | null | undefined) {
  const hi = onlyHour(inicio)
  const hf = onlyHour(fin)
  if (!hi || !hf) return 60
  const diff = dateTimeMs('2000-01-01', hf) - dateTimeMs('2000-01-01', hi)
  const minutes = Math.round(diff / 60000)
  return minutes > 0 ? minutes : 60
}

function addMinutesToHour(hour: string, minutes: number) {
  const base = new Date(`2000-01-01T${hour || '00:00'}`)
  base.setMinutes(base.getMinutes() + minutes)
  return `${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`
}

function asistenciaLabel(value: string | null | undefined) {
  switch ((value || 'pendiente').toLowerCase()) {
    case 'asistio': return 'Asistió'
    case 'no_asistio_aviso': return 'Avisó / congelada'
    case 'no_asistio_sin_aviso': return 'Sin aviso'
    default: return 'Pendiente'
  }
}

function asistenciaBadge(value: string | null | undefined) {
  switch ((value || 'pendiente').toLowerCase()) {
    case 'asistio': return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'no_asistio_aviso': return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'no_asistio_sin_aviso': return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    default: return 'border-white/10 bg-white/[0.05] text-white/65'
  }
}

function asistenciaToUpdate(nuevoEstado: AsistenciaEstado) {
  const consumeSesion = nuevoEstado === 'asistio' || nuevoEstado === 'no_asistio_sin_aviso'

  return {
    asistencia_estado: nuevoEstado,
    fecha_asistencia: nuevoEstado === 'pendiente' ? null : new Date().toISOString(),
    aviso_previo: nuevoEstado === 'no_asistio_aviso',
    consume_sesion: consumeSesion,
    reprogramable: nuevoEstado === 'no_asistio_aviso',
    estado:
      nuevoEstado === 'asistio'
        ? 'completado'
        : nuevoEstado === 'no_asistio_aviso' || nuevoEstado === 'no_asistio_sin_aviso'
          ? 'no_asistio'
          : 'programado',
  }
}

function canReagendarSesion(sesion: SesionPlan) {
  const asistenciaActual = (sesion.asistencia_estado || 'pendiente') as AsistenciaEstado
  return (
    asistenciaActual === 'pendiente' ||
    (asistenciaActual === 'no_asistio_aviso' && sesion.reprogramable === true)
  ) && (sesion.estado || '').toLowerCase() !== 'completado'
}

export default function ClienteDetallePage() {
  const params = useParams()
  const clienteId = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [loading, setLoading] = useState(true)
  const [loadingExtras, setLoadingExtras] = useState(true)

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [historialPlanes, setHistorialPlanes] = useState<ClientePlan[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [citas, setCitas] = useState<Cita[]>([])
  const [eventosPlan, setEventosPlan] = useState<EventoPlan[]>([])
  const [sesionesPlan, setSesionesPlan] = useState<SesionPlan[]>([])
  const [estadoCuenta, setEstadoCuenta] = useState<EstadoCuentaCliente | null>(null)

  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [toast, setToast] = useState('')

  const [sesionesAbiertas, setSesionesAbiertas] = useState(false)
  const [sesionesPlanesAbiertos, setSesionesPlanesAbiertos] = useState<Record<string, boolean>>({})
  const [sesionReagendar, setSesionReagendar] = useState<SesionPlan | null>(null)
  const [reagendarForm, setReagendarForm] = useState<ReagendarForm>({ fecha: '', hora_inicio: '', hora_fin: '', motivo: '' })
  const [guardandoReagenda, setGuardandoReagenda] = useState(false)
  const [errorReagenda, setErrorReagenda] = useState('')
  const [actualizandoAsistenciaId, setActualizandoAsistenciaId] = useState<string | null>(null)


  useEffect(() => {
    if (!clienteId) return
    void loadClienteBase(clienteId)
  }, [clienteId])

  async function loadClienteBase(id: string) {
    setLoading(true)
    setLoadingExtras(true)
    setError('')
    setWarning('')
    setToast('')
    setCliente(null)
    setHistorialPlanes([])
    setPagos([])
    setCitas([])
    setEventosPlan([])
    setSesionesPlan([])
    setSesionesPlanesAbiertos({})
    setEstadoCuenta(null)

    try {
      const clienteRes = await supabase
        .from('clientes')
        .select(`
          id, nombre, telefono, email, estado, created_at, updated_at,
          created_by, updated_by,
          creado_por:created_by ( id, nombre ),
          editado_por:updated_by ( id, nombre )
        `)
        .eq('id', id)
        .single()

      if (clienteRes.error) throw new Error(clienteRes.error.message)

      setCliente(clienteRes.data as unknown as Cliente)
      setLoading(false)
      void loadClienteExtras(id)
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar el cliente.')
      setLoading(false)
      setLoadingExtras(false)
    }
  }

  async function loadClienteExtras(id: string) {
    const hoy = new Date().toISOString().slice(0, 10)
    const warnings: string[] = []

    try {
      const planesRes = await supabase
        .from('clientes_planes')
        .select(`
          id, cliente_id, plan_id, sesiones_totales, sesiones_usadas,
          fecha_inicio, fecha_fin, estado, created_at,
          planes:plan_id (
            id, nombre, sesiones_totales, vigencia_valor, vigencia_tipo,
            precio, estado, descripcion
          )
        `)
        .eq('cliente_id', id)
        .order('created_at', { ascending: false })

      if (planesRes.error) warnings.push(`Planes: ${planesRes.error.message}`)
      else setHistorialPlanes((planesRes.data || []) as unknown as ClientePlan[])
    } catch { warnings.push('Planes: no se pudieron cargar.') }

    try {
      const pagosRes = await supabase
        .from('pagos')
        .select(`
          id, fecha, concepto, categoria, monto, monto_pago,
          monto_equivalente_usd, monto_equivalente_bs, moneda_pago,
          estado, tipo_origen, notas,
          metodos_pago:metodo_pago_id ( nombre )
        `)
        .eq('cliente_id', id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (pagosRes.error) warnings.push(`Pagos: ${pagosRes.error.message}`)
      else setPagos((pagosRes.data || []) as unknown as Pago[])
    } catch { warnings.push('Pagos: no se pudieron cargar.') }

    try {
      const citasRes = await supabase
        .from('citas')
        .select(`
          id, fecha, hora_inicio, hora_fin, estado, notas,
          empleados:terapeuta_id ( nombre ),
          servicios:servicio_id ( nombre )
        `)
        .eq('cliente_id', id)
        .gte('fecha', hoy)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })
        .limit(10)

      if (citasRes.error) warnings.push(`Citas: ${citasRes.error.message}`)
      else setCitas((citasRes.data || []) as unknown as Cita[])
    } catch { warnings.push('Citas: no se pudieron cargar.') }

    try {
      const eventosRes = await supabase
        .from('clientes_planes_eventos')
        .select('id, cliente_plan_id, cliente_id, tipo, detalle, created_at')
        .eq('cliente_id', id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (eventosRes.error) warnings.push(`Eventos: ${eventosRes.error.message}`)
      else setEventosPlan((eventosRes.data || []) as EventoPlan[])
    } catch { warnings.push('Eventos: no se pudieron cargar.') }

    try {
      const sesionesRes = await supabase
        .from('entrenamientos')
        .select(`
          id, cliente_plan_id, cliente_id, empleado_id, fecha,
          hora_inicio, hora_fin, estado, asistencia_estado, aviso_previo,
          consume_sesion, reprogramable, motivo_asistencia, fecha_asistencia,
          reprogramado_de_entrenamiento_id,
          empleados:empleado_id ( nombre, rol ),
          clientes_planes:cliente_plan_id (
            id, fecha_fin, estado,
            planes:plan_id ( nombre )
          )
        `)
        .eq('cliente_id', id)
        .not('cliente_plan_id', 'is', null)
        .neq('estado', 'cancelado')
        .order('fecha', { ascending: false })
        .order('hora_inicio', { ascending: false })
        .limit(50)

      if (sesionesRes.error) {
        warnings.push(`Sesiones plan: ${sesionesRes.error.message}`)
      } else {
        const normalizadas = ((sesionesRes.data || []) as any[])
          .map((row) => ({
            ...row,
            empleados: firstOrNull(row?.empleados),
            clientes_planes: firstOrNull(row?.clientes_planes)
              ? {
                  ...firstOrNull(row?.clientes_planes),
                  planes: firstOrNull(firstOrNull(row?.clientes_planes)?.planes),
                }
              : null,
          }))
          .filter((row) => {
            const estadoPlan = (row.clientes_planes?.estado || '').toLowerCase()
            return estadoPlan !== 'cancelado'
          })

        setSesionesPlan(normalizadas as SesionPlan[])
      }
    } catch { warnings.push('Sesiones plan: no se pudieron cargar.') }

    try {
      const estadoCuentaRes = await supabase
        .from('v_clientes_estado_cuenta')
        .select(`
          cliente_id, total_facturado_usd, total_pagado_usd, total_pendiente_usd,
          credito_disponible_usd, saldo_pendiente_neto_usd, saldo_favor_neto_usd
        `)
        .eq('cliente_id', id)
        .maybeSingle()

      if (estadoCuentaRes.error) warnings.push(`Estado de cuenta: ${estadoCuentaRes.error.message}`)
      else setEstadoCuenta((estadoCuentaRes.data || null) as EstadoCuentaCliente | null)
    } catch { warnings.push('Estado de cuenta: no se pudo cargar.') }

    if (warnings.length > 0) setWarning(warnings.join(' | '))
    setLoadingExtras(false)
  }

  async function actualizarAsistenciaSesion(sesionId: string, nuevoEstado: AsistenciaEstado) {
    setActualizandoAsistenciaId(sesionId)
    setToast('')
    setWarning('')

    const hoy = getTodayKey()
    const activePlanIds = new Set(historialPlanes.filter((plan) => isPlanOperativo(plan, hoy)).map((plan) => plan.id))
    const sesionActual = sesionesPlan.find((s) => s.id === sesionId) || null

    if (!sesionActual || !isSesionDePlanOperativo(sesionActual, activePlanIds)) {
      setWarning('Esta sesión pertenece a un plan vencido, renovado, agotado o cancelado. Queda solo como historial y no puede modificarse.')
      setActualizandoAsistenciaId(null)
      return
    }
    const updateLocal = asistenciaToUpdate(nuevoEstado)
    const consumiaAntes = sesionActual?.consume_sesion === true
    const consumeAhora = updateLocal.consume_sesion === true
    const deltaUsoPlan = consumeAhora === consumiaAntes ? 0 : consumeAhora ? 1 : -1

    try {
      const { error } = await supabase.rpc('marcar_asistencia_entrenamiento', {
        p_entrenamiento_id: sesionId,
        p_asistencia_estado: nuevoEstado,
        p_motivo: null,
        p_marcado_por: null,
      })

      if (error) throw new Error(error.message)

      setSesionesPlan((prev) =>
        prev.map((s) =>
          s.id === sesionId
            ? { ...s, ...updateLocal }
            : s
        )
      )

      ajustarUsoPlanLocal(sesionActual?.cliente_plan_id, deltaUsoPlan)

      setToast(
        nuevoEstado === 'no_asistio_aviso'
          ? 'Sesión congelada. No consume sesión y queda disponible para reagendar.'
          : nuevoEstado === 'no_asistio_sin_aviso'
            ? 'No asistió sin aviso. La sesión fue consumida.'
            : nuevoEstado === 'asistio'
              ? 'Asistencia marcada. La sesión fue consumida.'
              : 'Sesión devuelta a pendiente.'
      )
    } catch (err: any) {
      setWarning(err?.message || 'No se pudo actualizar la asistencia.')
    } finally {
      setActualizandoAsistenciaId(null)
    }
  }

  function abrirReagendarSesion(sesion: SesionPlan) {
    const inicio = onlyHour(sesion.hora_inicio) || '08:00'
    const duracion = getDurationMinutes(sesion.hora_inicio, sesion.hora_fin)
    const fin = onlyHour(sesion.hora_fin) || addMinutesToHour(inicio, duracion)

    setToast('')
    setErrorReagenda('')
    setSesionReagendar(sesion)
    setReagendarForm({
      fecha: sesion.fecha || new Date().toISOString().slice(0, 10),
      hora_inicio: inicio,
      hora_fin: fin,
      motivo: '',
    })
  }

  function cerrarReagendarSesion() {
    if (guardandoReagenda) return
    setSesionReagendar(null)
    setErrorReagenda('')
  }

  function ajustarUsoPlanLocal(clientePlanId: string | null | undefined, delta: number) {
    if (!clientePlanId || delta === 0) return

    setHistorialPlanes((prev) =>
      prev.map((plan) => {
        if (plan.id !== clientePlanId) return plan

        const total = Number(plan.sesiones_totales || 0)
        const usadasActuales = Number(plan.sesiones_usadas || 0)
        const nuevasUsadas = Math.min(total, Math.max(0, usadasActuales + delta))

        return { ...plan, sesiones_usadas: nuevasUsadas }
      })
    )
  }

  async function extenderPlanSiHaceFalta(clientePlanId: string | null | undefined, fechaNueva: string, fechaFinActual: string | null | undefined) {
    if (!clientePlanId || !fechaFinActual || fechaNueva <= fechaFinActual) return false

    const { error } = await supabase
      .from('clientes_planes')
      .update({ fecha_fin: fechaNueva, updated_at: new Date().toISOString() })
      .eq('id', clientePlanId)

    if (error) throw new Error(`No se pudo extender vencimiento del plan: ${error.message}`)

    setHistorialPlanes((prev) =>
      prev.map((plan) =>
        plan.id === clientePlanId
          ? { ...plan, fecha_fin: fechaNueva }
          : plan
      )
    )

    setSesionesPlan((prev) =>
      prev.map((sesion) =>
        sesion.cliente_plan_id === clientePlanId
          ? {
              ...sesion,
              clientes_planes: sesion.clientes_planes
                ? { ...sesion.clientes_planes, fecha_fin: fechaNueva }
                : sesion.clientes_planes,
            }
          : sesion
      )
    )

    return true
  }

  async function guardarReagendaSesion() {
    if (!sesionReagendar) return

    const fecha = reagendarForm.fecha.trim()
    const horaInicio = reagendarForm.hora_inicio.trim()
    const horaFin = reagendarForm.hora_fin.trim()
    const motivo = reagendarForm.motivo.trim()

    if (!fecha) {
      setErrorReagenda('Selecciona la nueva fecha.')
      return
    }

    if (!horaInicio || !horaFin) {
      setErrorReagenda('Selecciona hora inicio y hora fin.')
      return
    }

    if (dateTimeMs(fecha, horaFin) <= dateTimeMs(fecha, horaInicio)) {
      setErrorReagenda('La hora fin debe ser mayor a la hora inicio.')
      return
    }

    const asistenciaActual = (sesionReagendar.asistencia_estado || 'pendiente').toLowerCase()
    const fechaFinPlan = sesionReagendar.clientes_planes?.fecha_fin || null
    const puedeExtenderVencimiento = asistenciaActual === 'no_asistio_aviso'

    if (fechaFinPlan && fecha > fechaFinPlan && !puedeExtenderVencimiento) {
      setErrorReagenda(`Solo las sesiones en estado Avisó pueden reagendarse después del vencimiento del plan (${fechaFinPlan}).`)
      return
    }

    setGuardandoReagenda(true)
    setErrorReagenda('')
    setToast('')

    const anteriorFecha = sesionReagendar.fecha || 'sin fecha'
    const anteriorInicio = onlyHour(sesionReagendar.hora_inicio) || '—'
    const anteriorFin = onlyHour(sesionReagendar.hora_fin) || '—'
    const notaReagenda = `Reagendada desde ${anteriorFecha} ${anteriorInicio}-${anteriorFin} hacia ${fecha} ${horaInicio}-${horaFin}${motivo ? `. Motivo: ${motivo}` : ''}`

    try {
      const rpcRes = await supabase.rpc('reprogramar_entrenamiento_plan_seguro', {
        p_entrenamiento_id: sesionReagendar.id,
        p_nueva_fecha: fecha,
        p_nueva_hora_inicio: normalizeTimeForDb(horaInicio),
        p_nueva_hora_fin: normalizeTimeForDb(horaFin),
        p_motivo: notaReagenda,
        p_marcado_por: null,
      })

      if (rpcRes.error) throw new Error(rpcRes.error.message)

      const rpcData = rpcRes.data as { ok?: boolean; error?: string; extendio_plan?: boolean } | null
      if (rpcData && rpcData.ok === false) {
        throw new Error(rpcData.error || 'No se pudo reagendar la sesión.')
      }

      const extendioPlan = !!rpcData?.extendio_plan

      const updateRes = await supabase
        .from('entrenamientos')
        .select(`
          id, cliente_plan_id, cliente_id, empleado_id, fecha,
          hora_inicio, hora_fin, estado, asistencia_estado, aviso_previo,
          consume_sesion, reprogramable, motivo_asistencia, fecha_asistencia,
          reprogramado_de_entrenamiento_id,
          empleados:empleado_id ( nombre, rol ),
          clientes_planes:cliente_plan_id (
            id, fecha_fin, estado,
            planes:plan_id ( nombre )
          )
        `)
        .eq('id', sesionReagendar.id)
        .single()

      if (updateRes.error) throw new Error(updateRes.error.message)

      if (sesionReagendar.consume_sesion === true) {
        ajustarUsoPlanLocal(sesionReagendar.cliente_plan_id, -1)
      }

      const row: any = updateRes.data
      const normalizada: SesionPlan = {
        ...row,
        empleados: firstOrNull(row?.empleados),
        clientes_planes: firstOrNull(row?.clientes_planes)
          ? {
              ...firstOrNull(row?.clientes_planes),
              planes: firstOrNull(firstOrNull(row?.clientes_planes)?.planes),
            }
          : null,
      }

      setSesionesPlan((prev) =>
        prev
          .map((s) => (s.id === normalizada.id ? normalizada : s))
          .sort((a, b) => {
            const fechaA = `${a.fecha || ''} ${a.hora_inicio || ''}`
            const fechaB = `${b.fecha || ''} ${b.hora_inicio || ''}`
            return fechaB.localeCompare(fechaA)
          })
      )

      setCitas((prev) =>
        prev.map((c) =>
          c.id === normalizada.id
            ? { ...c, fecha, hora_inicio: normalizeTimeForDb(horaInicio) || horaInicio, hora_fin: normalizeTimeForDb(horaFin) || horaFin, estado: 'programada', notas: notaReagenda }
            : c
        )
      )

      setToast(extendioPlan ? 'Sesión reagendada y vencimiento del plan extendido correctamente.' : 'Sesión reagendada correctamente.')
      setSesionReagendar(null)
    } catch (err: any) {
      setErrorReagenda(err?.message || 'No se pudo reagendar la sesión.')
    } finally {
      setGuardandoReagenda(false)
    }
  }


  const hoyKey = useMemo(() => getTodayKey(), [])

  const planesActivosOperativos = useMemo(
    () => historialPlanes.filter((plan) => isPlanOperativo(plan, hoyKey)),
    [historialPlanes, hoyKey]
  )

  const activePlanIds = useMemo(
    () => new Set(planesActivosOperativos.map((plan) => plan.id)),
    [planesActivosOperativos]
  )

  const planActivo = useMemo(() => {
    if (!planesActivosOperativos.length) return null
    return [...planesActivosOperativos].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null
  }, [planesActivosOperativos])

  const planPrincipal = useMemo(() => {
    if (planActivo) return planActivo
    if (!historialPlanes.length) return null
    const sorted = [...historialPlanes].sort((a, b) => {
      const priorityDiff = getPlanPriority(b.estado) - getPlanPriority(a.estado)
      if (priorityDiff !== 0) return priorityDiff
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return sorted[0] || null
  }, [historialPlanes, planActivo])

  const sesionesActivasPlan = useMemo(
    () => sesionesPlan.filter((sesion) => isSesionDePlanOperativo(sesion, activePlanIds)),
    [sesionesPlan, activePlanIds]
  )

  const resumenPlan = useMemo(() => {
    const planBase = planActivo
    if (!planBase) {
      return {
        usadas: 0,
        restantes: 0,
        total: 0,
        estado: null as string | null,
        nombre: 'Sin plan activo',
        subtitle: planPrincipal ? `Último plan: ${getPlanStatusLabel(planActivo.estado)}` : 'Sin plan registrado',
      }
    }

    const total = Number(planBase.sesiones_totales || 0)
    const usadas = Number(planBase.sesiones_usadas || 0)
    return {
      usadas,
      restantes: Math.max(0, total - usadas),
      total,
      estado: planBase.estado || null,
      nombre: planBase.planes?.nombre || 'Plan activo',
      subtitle: 'Solo cuenta sesiones de planes activos no vencidos',
    }
  }, [planActivo, planPrincipal])

  const resumenPagos = useMemo(() => {
    const pagosPagados = pagos.filter((p) => (p.estado || '').toLowerCase() === 'pagado')
    const monedas = Array.from(new Set(pagosPagados.map((p) => (p.moneda_pago || '').toUpperCase().trim()).filter(Boolean)))
    const todosBS = monedas.length === 1 && monedas[0] === 'BS'
    const monedaResumen: 'BS' | 'USD' = todosBS ? 'BS' : 'USD'
    const totalPagado = pagosPagados.reduce((acc, p) => acc + Number(todosBS ? (p.monto_equivalente_bs || 0) : (p.monto_equivalente_usd ?? 0)), 0)
    return { totalPagado, cantidad: pagosPagados.length, monedaResumen }
  }, [pagos])

  const calcularResumenSesiones = (lista: SesionPlan[]) => ({
    asistio: lista.filter((s) => s.asistencia_estado === 'asistio').length,
    aviso: lista.filter((s) => s.asistencia_estado === 'no_asistio_aviso').length,
    sinAviso: lista.filter((s) => s.asistencia_estado === 'no_asistio_sin_aviso').length,
    pendientes: lista.filter((s) => (s.asistencia_estado || 'pendiente') === 'pendiente').length,
    reprogramables: lista.filter((s) => s.reprogramable === true).length,
  })

  const resumenAsistenciaPlan = useMemo(() => calcularResumenSesiones(sesionesActivasPlan), [sesionesActivasPlan])

  const sesionesAgrupadasPorPlan = useMemo<SesionesGrupoPlan[]>(() => {
    const planesMap = new Map(historialPlanes.map((plan) => [plan.id, plan]))
    const grupos = new Map<string, SesionesGrupoPlan>()

    sesionesPlan.forEach((sesion) => {
      const planId = sesion.cliente_plan_id || 'sin-plan'
      const plan = planesMap.get(planId) || null
      const fechaFin = plan?.fecha_fin || sesion.clientes_planes?.fecha_fin || null
      const estado = plan?.estado || sesion.clientes_planes?.estado || 'sin_estado'
      const nombre = plan?.planes?.nombre || sesion.clientes_planes?.planes?.nombre || 'Sesiones sin plan asociado'
      const operativo = plan ? isPlanOperativo(plan, hoyKey) : isSesionDePlanOperativo(sesion, activePlanIds)

      if (!grupos.has(planId)) {
        grupos.set(planId, {
          plan,
          planId,
          nombre,
          estado,
          fechaInicio: plan?.fecha_inicio || null,
          fechaFin,
          operativo,
          sesiones: [],
          resumen: calcularResumenSesiones([]),
        })
      }

      grupos.get(planId)!.sesiones.push(sesion)
    })

    return Array.from(grupos.values())
      .map((grupo) => ({
        ...grupo,
        sesiones: [...grupo.sesiones].sort((a, b) => `${b.fecha || ''} ${b.hora_inicio || ''}`.localeCompare(`${a.fecha || ''} ${a.hora_inicio || ''}`)),
        resumen: calcularResumenSesiones(grupo.operativo ? grupo.sesiones : grupo.sesiones.filter((s) => (s.asistencia_estado || 'pendiente') !== 'pendiente')),
      }))
      .sort((a, b) => {
        if (a.operativo !== b.operativo) return a.operativo ? -1 : 1
        const dateA = a.plan?.created_at || a.fechaFin || ''
        const dateB = b.plan?.created_at || b.fechaFin || ''
        return dateB.localeCompare(dateA)
      })
  }, [sesionesPlan, historialPlanes, hoyKey, activePlanIds])

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-white/55">Clientes</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Detalle del cliente</h1>
        </div>
        <Card className="p-6"><p className="text-white/55">Cargando cliente...</p></Card>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-white/55">Clientes</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Detalle del cliente</h1>
        </div>
        <Card className="p-6"><p className="text-rose-400">{error || 'No se encontró el cliente.'}</p></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Clientes</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{cliente.nombre}</h1>
          <p className="mt-2 text-sm text-white/55">
            {cliente.email || 'Sin correo'} · {cliente.telefono || 'Sin teléfono'} · {cliente.estado}
          </p>
        </div>

        <div className="w-full xl:w-auto">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl xl:min-w-[340px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-white/45">Menú rápido</p>
                <p className="mt-1 text-sm font-medium text-white">Estado financiero</p>
              </div>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoFinancieroBadge(estadoCuenta)}`}>
                {estadoFinancieroLabel(estadoCuenta)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[11px] uppercase tracking-wide text-white/45">Pendiente</p>
                <p className="mt-1 text-sm font-semibold text-rose-300">{money(estadoCuenta?.saldo_pendiente_neto_usd || 0, 'USD')}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[11px] uppercase tracking-wide text-white/45">Saldo a favor</p>
                <p className="mt-1 text-sm font-semibold text-emerald-300">{money(estadoCuenta?.saldo_favor_neto_usd || 0, 'USD')}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href={`/admin/finanzas/ingresos?cliente=${cliente.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-sm font-medium text-white/85 transition hover:bg-white/[0.06]">Ir a ingresos</Link>
              <Link href={`/admin/finanzas/ingresos?cliente=${cliente.id}&tipoIngreso=saldo`} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-sm font-medium text-white/85 transition hover:bg-white/[0.06]">Agregar saldo</Link>
              <Link href={`/admin/personas/clientes/${cliente.id}/plan`} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-sm font-medium text-white/85 transition hover:bg-white/[0.06]">Gestionar plan</Link>
              <Link href={`/admin/operaciones/agenda?cliente=${cliente.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-sm font-medium text-white/85 transition hover:bg-white/[0.06]">Ver agenda</Link>
            </div>
          </div>
        </div>
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      {warning ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-amber-300">Aviso</p>
          <p className="mt-1 text-sm text-white/55">Algunas secciones no cargaron completo: {warning}</p>
        </Card>
      ) : null}

      {toast ? (
        <Card className="border-emerald-400/20 bg-emerald-400/10 p-4">
          <p className="text-sm font-medium text-emerald-300">{toast}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard title="Plan activo" value={truncateText(resumenPlan.nombre, 22)} subtitle={resumenPlan.subtitle} />
        <StatCard title="Estado activo" value={getPlanStatusLabel(resumenPlan.estado)} subtitle={resumenPlan.estado ? 'No cuenta vencidos' : 'Sin plan vigente'} />
        <StatCard title="Sesiones usadas" value={resumenPlan.usadas} />
        <StatCard title="Sesiones restantes" value={resumenPlan.restantes} />
        <StatCard title="Pagado" value={money(resumenPagos.totalPagado, resumenPagos.monedaResumen)} color="text-emerald-400" />
        <StatCard title="Próximas citas" value={citas.length} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Asistió" value={resumenAsistenciaPlan.asistio} color="text-emerald-400" />
        <StatCard title="Avisó" value={resumenAsistenciaPlan.aviso} color="text-amber-400" />
        <StatCard title="Sin aviso" value={resumenAsistenciaPlan.sinAviso} color="text-rose-400" />
        <StatCard title="Pendientes" value={resumenAsistenciaPlan.pendientes} />
        <StatCard title="Reprogramables" value={resumenAsistenciaPlan.reprogramables} color="text-violet-400" />
      </div>

      {loadingExtras ? (
        <Card className="p-4">
          <p className="text-sm text-white/55">Cargando planes, pagos, citas, eventos y asistencia del plan...</p>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section
            title="Historial de planes"
            description="Registro de planes asignados, renovados, agotados, vencidos o cancelados."
            className="p-0"
            contentClassName="overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Plan</th>
                    <th className="px-4 py-3 text-left font-medium">Vigencia</th>
                    <th className="px-4 py-3 text-left font-medium">Precio</th>
                    <th className="px-4 py-3 text-left font-medium">Inicio</th>
                    <th className="px-4 py-3 text-left font-medium">Fin</th>
                    <th className="px-4 py-3 text-left font-medium">Uso</th>
                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {historialPlanes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-white/55">Este cliente no tiene planes registrados.</td>
                    </tr>
                  ) : (
                    historialPlanes.map((item) => {
                      const restantes = Math.max(0, Number(item.sesiones_totales || 0) - Number(item.sesiones_usadas || 0))
                      return (
                        <tr key={item.id} className="transition hover:bg-white/[0.03]">
                          <td className="px-4 py-3">
                            <div className="max-w-[260px]">
                              <p className="font-medium text-white break-words whitespace-normal">{item.planes?.nombre || 'Plan'}</p>
                              {item.planes?.descripcion ? <p className="text-xs text-white/45 break-words whitespace-normal">{item.planes.descripcion}</p> : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-white/75">{formatVigencia(item.planes?.vigencia_valor, item.planes?.vigencia_tipo)}</td>
                          <td className="px-4 py-3 text-white/75">{money(item.planes?.precio || 0, 'USD')}</td>
                          <td className="px-4 py-3 text-white/75">{item.fecha_inicio || '—'}</td>
                          <td className="px-4 py-3 text-white/75">{item.fecha_fin || '—'}</td>
                          <td className="px-4 py-3 text-white/75">{item.sesiones_usadas}/{item.sesiones_totales} · Rest. {restantes}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoPlanBadge(item.estado)}`}>
                              {getPlanStatusLabel(item.estado)}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <div className="rounded-3xl border border-white/10 bg-white/[0.02]">
            <button
              type="button"
              onClick={() => setSesionesAbiertas((v) => !v)}
              className="flex w-full items-center justify-between gap-4 rounded-3xl px-6 py-4 text-left transition hover:bg-white/[0.03]"
            >
              <div>
                <p className="font-semibold text-white">Sesiones y asistencia por plan</p>
                <p className="mt-0.5 text-sm text-white/45">
                  Activas: {sesionesActivasPlan.length} · Historial: {Math.max(0, sesionesPlan.length - sesionesActivasPlan.length)} ·{' '}
                  Pendientes activas: {resumenAsistenciaPlan.pendientes}
                </p>
              </div>
              <span className="shrink-0 text-lg text-white/40 transition-transform duration-200" style={{ transform: sesionesAbiertas ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                ▾
              </span>
            </button>

            {sesionesAbiertas ? (
              <div className="space-y-3 border-t border-white/10 p-4">
                <div className="rounded-3xl border border-white/10 bg-black/10 px-4 py-3">
                  <p className="text-sm font-semibold text-white">Asistencia y registro histórico</p>
                  <p className="mt-1 text-xs text-white/45">
                    Los planes vencidos, renovados, agotados o cancelados quedan visibles solo para consulta. No suman pendientes activas y no permiten marcar asistencia.
                  </p>
                </div>

                {sesionesAgrupadasPorPlan.length === 0 ? (
                  <p className="rounded-3xl border border-white/10 bg-black/10 px-4 py-6 text-sm text-white/55">No hay sesiones del plan registradas.</p>
                ) : (
                  sesionesAgrupadasPorPlan.map((grupo) => {
                    const abierto = sesionesPlanesAbiertos[grupo.planId] ?? grupo.operativo
                    return (
                      <div key={grupo.planId} className="overflow-hidden rounded-3xl border border-white/10 bg-black/10">
                        <button
                          type="button"
                          onClick={() => setSesionesPlanesAbiertos((prev) => ({ ...prev, [grupo.planId]: !(prev[grupo.planId] ?? grupo.operativo) }))}
                          className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-white break-words">{grupo.nombre}</p>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoPlanBadge(grupo.estado)}`}>
                                {getPlanStatusLabel(grupo.estado)}
                              </span>
                              {grupo.operativo ? (
                                <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">Cuenta activo</span>
                              ) : (
                                <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-white/50">Solo historial</span>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-white/45">
                              {grupo.sesiones.length} sesión{grupo.sesiones.length !== 1 ? 'es' : ''} · {grupo.resumen.pendientes} pendiente{grupo.resumen.pendientes !== 1 ? 's' : ''} · {grupo.resumen.asistio} asistió · Fin: {grupo.fechaFin || '—'}
                            </p>
                          </div>
                          <span className="shrink-0 text-lg text-white/40 transition-transform duration-200" style={{ transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                            ▾
                          </span>
                        </button>

                        {abierto ? (
                          <div className="overflow-x-auto border-t border-white/10">
                            <table className="min-w-full text-sm">
                              <thead className="border-b border-white/10 bg-white/[0.03] text-white/50">
                                <tr>
                                  <th className="px-4 py-3 text-left font-medium">Sesión</th>
                                  <th className="px-4 py-3 text-left font-medium">Fecha / hora</th>
                                  <th className="px-4 py-3 text-left font-medium">Asistencia</th>
                                  <th className="px-4 py-3 text-left font-medium">Acciones</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/10">
                                {grupo.sesiones.map((sesion) => {
                                  const asistenciaActual = (sesion.asistencia_estado || 'pendiente') as AsistenciaEstado
                                  const sesionOperativa = grupo.operativo && isSesionDePlanOperativo(sesion, activePlanIds)
                                  const puedeReagendar = sesionOperativa && canReagendarSesion(sesion)
                                  const actualizando = actualizandoAsistenciaId === sesion.id
                                  return (
                                    <tr key={sesion.id} className="transition hover:bg-white/[0.03]">
                                      <td className="px-4 py-3 align-top">
                                        <p className="max-w-[240px] truncate font-medium text-white">{grupo.nombre}</p>
                                        <p className="mt-1 text-xs text-white/40">{sesion.empleados?.nombre || 'Sin terapeuta'}</p>
                                        {sesion.consume_sesion ? <p className="mt-1 text-xs text-rose-300">Consume sesión</p> : null}
                                        {sesion.reprogramable ? <p className="mt-1 text-xs text-violet-300">Reprogramable</p> : null}
                                      </td>
                                      <td className="px-4 py-3 align-top text-white/70">
                                        <p>{sesion.fecha || 'Sin fecha'}</p>
                                        <p className="mt-1 text-xs text-white/45">{onlyHour(sesion.hora_inicio) || '—'} - {onlyHour(sesion.hora_fin) || '—'}</p>
                                        {grupo.fechaFin ? <p className="mt-1 text-xs text-white/35">Vence: {grupo.fechaFin}</p> : null}
                                      </td>
                                      <td className="px-4 py-3 align-top">
                                        <div className="flex flex-col gap-2">
                                          <span className={`w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${asistenciaBadge(asistenciaActual)}`}>
                                            {asistenciaLabel(asistenciaActual)}
                                          </span>

                                          {sesionOperativa ? (
                                            <div className="flex flex-wrap gap-1.5">
                                              {([
                                                ['asistio', 'Asistió'],
                                                ['no_asistio_aviso', 'Avisó'],
                                                ['no_asistio_sin_aviso', 'Sin aviso'],
                                                ['pendiente', 'Pendiente'],
                                              ] as [AsistenciaEstado, string][]).map(([estado, label]) => (
                                                <button
                                                  key={estado}
                                                  type="button"
                                                  disabled={actualizando || asistenciaActual === estado}
                                                  onClick={() => actualizarAsistenciaSesion(sesion.id, estado)}
                                                  className="rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-white/70 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                  {label}
                                                </button>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="text-xs text-white/40">Bloqueada: pertenece a un plan no vigente.</p>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 align-top">
                                        {sesionOperativa ? (
                                          <button
                                            type="button"
                                            disabled={!puedeReagendar}
                                            onClick={() => abrirReagendarSesion(sesion)}
                                            className="rounded-xl border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-violet-200 transition hover:bg-violet-400/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-white/30"
                                          >
                                            Reagendar
                                          </button>
                                        ) : (
                                          <span className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/40">Ver registro</span>
                                        )}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            ) : null}
          </div>

          <Section
            title="Pagos del cliente"
            description="Últimos pagos registrados y método utilizado."
            className="p-0"
            contentClassName="overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium">Concepto</th>
                    <th className="px-4 py-3 text-left font-medium">Método</th>
                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                    <th className="px-4 py-3 text-left font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {pagos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-white/55">Este cliente no tiene pagos registrados.</td>
                    </tr>
                  ) : (
                    pagos.map((pago) => (
                      <tr key={pago.id} className="transition hover:bg-white/[0.03]">
                        <td className="px-4 py-3 text-white/75">{pago.fecha}</td>
                        <td className="px-4 py-3">
                          <div className="max-w-[380px]">
                            <p className="font-medium text-white break-words whitespace-normal">{pago.concepto}</p>
                            <p className="text-xs text-white/45">{pago.categoria} · {pago.tipo_origen}</p>
                            {pago.notas ? <p className="mt-1 text-xs text-white/45 break-words whitespace-normal">{pago.notas}</p> : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/75">{pago.metodos_pago?.nombre || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoPagoBadge(pago.estado)}`}>
                            {pago.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-400">
                          {money(
                            pago.moneda_pago === 'BS' ? Number(pago.monto_equivalente_bs || 0) : Number(pago.monto_equivalente_usd || 0),
                            pago.moneda_pago || 'USD'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <div className="space-y-6 xl:col-span-1">
          <Section title="Saldo del cliente" description="Resumen corto de deuda y crédito.">
            <div className="space-y-3">
              <Card className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-white/45">Pendiente neto</p>
                    <p className="mt-1 text-sm font-semibold text-rose-300">{money(estadoCuenta?.saldo_pendiente_neto_usd || 0, 'USD')}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoFinancieroBadge(estadoCuenta)}`}>
                    {estadoFinancieroLabel(estadoCuenta)}
                  </span>
                </div>
              </Card>
              <Card className="p-3">
                <p className="text-xs uppercase tracking-wide text-white/45">Crédito disponible</p>
                <p className="mt-1 text-sm font-semibold text-emerald-300">{money(estadoCuenta?.credito_disponible_usd || 0, 'USD')}</p>
              </Card>
            </div>
          </Section>

          <Section title="Auditoría del cliente" description="Quién lo creó y quién lo editó.">
            <div className="space-y-2">
              {getAuditLines(cliente).map((line, index) => (
                <Card key={index} className="p-3">
                  <p className="text-sm text-white/75">{line}</p>
                </Card>
              ))}
            </div>
          </Section>

          <Section title="Resumen del plan activo" description="Solo muestra planes activos no vencidos. Los vencidos quedan en historial.">
            {!planActivo ? (
              <p className="text-sm text-white/55">No tiene plan activo vigente. Revisa el historial para ver planes vencidos, agotados o renovados.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white break-words whitespace-normal">{planActivo.planes?.nombre || 'Plan'}</p>
                    <p className="text-sm text-white/55">{money(planActivo.planes?.precio || 0, 'USD')}</p>
                    <p className="text-xs text-white/45">Vigencia: {formatVigencia(planActivo.planes?.vigencia_valor, planActivo.planes?.vigencia_tipo)}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoPlanBadge(planActivo.estado)}`}>
                    {getPlanStatusLabel(planActivo.estado)}
                  </span>
                </div>
                <Card className="p-3">
                  <div className="space-y-1 text-sm text-white/75">
                    <p>Inicio: {planActivo.fecha_inicio || '—'}</p>
                    <p>Fin: {planActivo.fecha_fin || '—'}</p>
                    <p>Total sesiones: {planActivo.sesiones_totales}</p>
                    <p>Usadas: {planActivo.sesiones_usadas}</p>
                    <p>Restantes: {Math.max(0, Number(planActivo.sesiones_totales || 0) - Number(planActivo.sesiones_usadas || 0))}</p>
                  </div>
                </Card>
                <Link href={`/admin/personas/clientes/${cliente.id}/plan`} className="block rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-white/[0.12]">
                  Gestionar plan
                </Link>
              </div>
            )}
          </Section>

          <Section title="Próximas citas" description="Próximas citas agendadas del cliente.">
            <div className="space-y-3">
              {citas.length === 0 ? (
                <p className="text-sm text-white/55">No tiene citas próximas.</p>
              ) : (
                citas.map((cita) => (
                  <Card key={cita.id} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{cita.servicios?.nombre || 'Servicio'}</p>
                        <p className="text-sm text-white/55">{cita.fecha} · {cita.hora_inicio.slice(0, 5)} - {cita.hora_fin.slice(0, 5)}</p>
                        <p className="text-xs text-white/40">{cita.empleados?.nombre || 'Sin terapeuta'}</p>
                        {cita.notas ? <p className="mt-1 text-xs text-white/45">{cita.notas}</p> : null}
                      </div>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoCitaBadge(cita.estado)}`}>
                        {cita.estado}
                      </span>
                    </div>
                  </Card>
                ))
              )}
            </div>
            <div className="mt-4">
              <Link href={`/admin/operaciones/agenda?cliente=${cliente.id}`} className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]">
                Ver más
              </Link>
            </div>
          </Section>

          <Section title="Eventos del plan" description="Historial de cambios y eventos del plan.">
            <div className="space-y-3">
              {eventosPlan.length === 0 ? (
                <p className="text-sm text-white/55">Sin eventos todavía.</p>
              ) : (
                eventosPlan.map((evento) => (
                  <Card key={evento.id} className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${tipoEventoBadge(evento.tipo)}`}>
                        {evento.tipo}
                      </span>
                      <span className="text-xs text-white/45">{new Date(evento.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-2 text-sm text-white/75">{evento.detalle || 'Sin detalle'}</p>
                  </Card>
                ))
              )}
            </div>
          </Section>
        </div>
      </div>

      {sesionReagendar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0f1117] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-white">Reagendar sesión</p>
                <p className="mt-1 text-sm text-white/50">
                  {sesionReagendar.clientes_planes?.planes?.nombre || 'Sesión del plan'} · {sesionReagendar.empleados?.nombre || 'Sin terapeuta'}
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarReagendarSesion}
                className="rounded-full border border-white/10 px-3 py-1 text-sm text-white/60 transition hover:bg-white/[0.06]"
              >
                ×
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/65">
              <p>Actual: {sesionReagendar.fecha || 'Sin fecha'} · {onlyHour(sesionReagendar.hora_inicio) || '—'} - {onlyHour(sesionReagendar.hora_fin) || '—'}</p>
              {sesionReagendar.clientes_planes?.fecha_fin && (
  <p className="mt-1 text-xs text-white/40">
    Vencimiento del plan: {sesionReagendar.clientes_planes.fecha_fin}
  </p>
)}

{((sesionReagendar.asistencia_estado || '').toLowerCase() === 'no_asistio_aviso') && (
  <p className="mt-1 text-xs text-violet-300">
    Si eliges una fecha mayor al vencimiento, el plan se extenderá automáticamente.
  </p>
)}
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-white/45">Nueva fecha</span>
                <input
                  type="date"
                  value={reagendarForm.fecha}
                  onChange={(e) => setReagendarForm((prev) => ({ ...prev, fecha: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-violet-400/40"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-white/45">Hora inicio</span>
                  <input
                    type="time"
                    value={reagendarForm.hora_inicio}
                    onChange={(e) => {
                      const nextInicio = e.target.value
                      const duracion = getDurationMinutes(sesionReagendar.hora_inicio, sesionReagendar.hora_fin)
                      setReagendarForm((prev) => ({ ...prev, hora_inicio: nextInicio, hora_fin: addMinutesToHour(nextInicio, duracion) }))
                    }}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-violet-400/40"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-wide text-white/45">Hora fin</span>
                  <input
                    type="time"
                    value={reagendarForm.hora_fin}
                    onChange={(e) => setReagendarForm((prev) => ({ ...prev, hora_fin: e.target.value }))}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition focus:border-violet-400/40"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-white/45">Motivo opcional</span>
                <textarea
                  value={reagendarForm.motivo}
                  onChange={(e) => setReagendarForm((prev) => ({ ...prev, motivo: e.target.value }))}
                  rows={3}
                  placeholder="Ej: cliente pidió cambiar la fecha"
                  className="mt-1 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-violet-400/40"
                />
              </label>
            </div>

            {errorReagenda ? (
              <p className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-300">{errorReagenda}</p>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cerrarReagendarSesion}
                disabled={guardandoReagenda}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/75 transition hover:bg-white/[0.06] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarReagendaSesion}
                disabled={guardandoReagenda}
                className="rounded-2xl border border-violet-400/20 bg-violet-400/15 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/20 disabled:opacity-50"
              >
                {guardandoReagenda ? 'Guardando...' : 'Guardar cambio'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  )
}
