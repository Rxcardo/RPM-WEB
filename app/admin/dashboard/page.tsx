'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'

type Cliente = {
  id: string
  estado?: string | null
  created_at?: string | null
}

type CitaRaw = {
  id: string
  fecha?: string | null
  estado?: string | null
  [key: string]: any
}

type Pago = {
  id: string
  fecha?: string | null
  monto?: number | null
  monto_equivalente_usd?: number | null
  estado?: string | null
}

type Empleado = {
  id: string
  nombre?: string | null
  estado?: string | null
  rol?: string | null
}

type PlanCliente = {
  id: string
  fecha_fin?: string | null
  estado?: string | null
  sesiones_totales?: number | null
  sesiones_usadas?: number | null
}

type EntrenamientoPlanRow = {
  id: string
  cliente_plan_id: string | null
  cliente_id: string | null
  empleado_id: string | null
  recurso_id: string | null
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
  marcado_por?: string | null
  actualizado_por?: {
    id: string
    nombre: string | null
  } | null
  clientes?: { nombre: string } | { nombre: string }[] | null
  empleados?: { nombre: string; rol?: string | null } | { nombre: string; rol?: string | null }[] | null
  clientes_planes?: {
    id: string
    fecha_fin?: string | null
    estado?: string | null
    planes?: { nombre?: string | null } | { nombre?: string | null }[] | null
  } | {
    id: string
    fecha_fin?: string | null
    estado?: string | null
    planes?: { nombre?: string | null } | { nombre?: string | null }[] | null
  }[] | null
}

type EmpleadoAsistenciaRow = {
  id: string
  empleado_id: string
  fecha: string
  estado: 'asistio' | 'no_asistio' | 'permiso' | 'reposo' | 'vacaciones'
  observaciones: string | null
  created_at?: string | null
  updated_at?: string | null
  created_by?: string | null
  updated_by?: string | null
  empleados?: { nombre: string; rol?: string | null } | { nombre: string; rol?: string | null }[] | null
  actualizado_por?: { id: string; nombre: string | null } | { id: string; nombre: string | null }[] | null
}

type AlertType = 'error' | 'success' | 'warning' | 'info'

type ReprogramacionDraft = {
  fecha: string
  hora_inicio: string
  hora_fin: string
  motivo: string
}

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function sameMonth(dateStr: string | null | undefined, today: Date) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()
}

function sameDay(dateStr: string | null | undefined, todayStr: string) {
  if (!dateStr) return false
  return dateStr === todayStr
}

function getFirstExistingKey(obj: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    if (key in obj) return key
  }
  return null
}

function getDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  try {
    return new Date(`${dateStr}T00:00:00`).toLocaleDateString('es-ES')
  } catch {
    return dateStr
  }
}

function formatTime(timeStr: string | null | undefined) {
  if (!timeStr) return '—'
  return String(timeStr).slice(0, 5)
}

function addMinutesToTime(timeStr: string | null | undefined, minutes: number) {
  if (!timeStr) return ''
  const [h, m] = String(timeStr).slice(0, 5).split(':').map(Number)
  const total = h * 60 + m + minutes
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function asistenciaPlanDotClass(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'asistio':
      return 'bg-emerald-400'
    case 'no_asistio_aviso':
      return 'bg-amber-400'
    case 'no_asistio_sin_aviso':
      return 'bg-rose-400'
    case 'reprogramado':
      return 'bg-violet-400'
    default:
      return 'bg-white/30'
  }
}

function asistenciaPersonalDotClass(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'asistio':
      return 'bg-emerald-400'
    case 'no_asistio':
      return 'bg-rose-400'
    case 'permiso':
      return 'bg-amber-400'
    case 'reposo':
      return 'bg-fuchsia-400'
    case 'vacaciones':
      return 'bg-sky-400'
    default:
      return 'bg-white/30'
  }
}

function asistenciaLabel(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'pendiente':
      return 'Pendiente'
    case 'asistio':
      return 'Asistió'
    case 'no_asistio_aviso':
      return 'Avisó'
    case 'no_asistio_sin_aviso':
      return 'Sin aviso'
    case 'reprogramado':
      return 'Reprog.'
    default:
      return estado || '—'
  }
}

function asistenciaPersonalLabel(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'asistio':
      return 'Asistió'
    case 'no_asistio':
      return 'No asistió'
    case 'permiso':
      return 'Permiso'
    case 'reposo':
      return 'Reposo'
    case 'vacaciones':
      return 'Vacaciones'
    default:
      return 'Sin marcar'
  }
}

function roleLabel(rol: string | null | undefined) {
  const r = (rol || '').toLowerCase().trim()
  if (!r) return 'Sin rol'
  if (r === 'terapeuta' || r === 'fisioterapeuta') return 'Fisioterapeuta'
  if (r === 'entrenador') return 'Entrenador'
  return r.charAt(0).toUpperCase() + r.slice(1)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [alert, setAlert] = useState<{ type: AlertType; title: string; message: string } | null>(null)

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [citas, setCitas] = useState<CitaRaw[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [clientesPlanes, setClientesPlanes] = useState<PlanCliente[]>([])
  const [entrenamientosPlan, setEntrenamientosPlan] = useState<EntrenamientoPlanRow[]>([])
  const [empleadosAsistencia, setEmpleadosAsistencia] = useState<EmpleadoAsistenciaRow[]>([])

  const [empleadoActualId, setEmpleadoActualId] = useState<string>('')

  const [asistenciaFilterFecha, setAsistenciaFilterFecha] = useState(getDateKey(new Date()))
  const [savingAsistenciaId, setSavingAsistenciaId] = useState<string | null>(null)
  const [openReprogramacionId, setOpenReprogramacionId] = useState<string | null>(null)
  const [reprogramandoId, setReprogramandoId] = useState<string | null>(null)
  const [reprogramacionDrafts, setReprogramacionDrafts] = useState<Record<string, ReprogramacionDraft>>({})
  const [savingEmpleadoAsistenciaId, setSavingEmpleadoAsistenciaId] = useState<string | null>(null)

  useEffect(() => {
    void loadDashboard()
    void loadEmpleadoActual()
  }, [])

  async function resolveEmpleadoActualId(): Promise<string> {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) return ''

      const authUserId = authData.user?.id
      if (!authUserId) return ''

      const { data: empleadoPorAuth, error: errorPorAuth } = await supabase
        .from('empleados')
        .select('id, nombre, auth_user_id')
        .eq('auth_user_id', authUserId)
        .maybeSingle()

      if (!errorPorAuth && empleadoPorAuth?.id) {
        return String(empleadoPorAuth.id)
      }

      const { data: empleadoPorId, error: errorPorId } = await supabase
        .from('empleados')
        .select('id, nombre')
        .eq('id', authUserId)
        .maybeSingle()

      if (!errorPorId && empleadoPorId?.id) {
        return String(empleadoPorId.id)
      }

      return ''
    } catch {
      return ''
    }
  }

  async function loadEmpleadoActual() {
    const empleadoId = await resolveEmpleadoActualId()
    setEmpleadoActualId(empleadoId)
  }

  function showAlert(type: AlertType, title: string, message: string) {
    setAlert({ type, title, message })
  }

  async function loadDashboard() {
    setLoading(true)
    setError('')

    try {
      const [
        clientesRes,
        citasRes,
        pagosRes,
        empleadosRes,
        clientesPlanesRes,
        entrenamientosPlanRes,
        empleadosAsistenciaRes,
      ] = await Promise.all([
        supabase.from('clientes').select('id, estado, created_at'),
        supabase.from('citas').select('*'),
        supabase.from('pagos').select('id, fecha, monto, monto_equivalente_usd, estado'),
        supabase.from('empleados').select('id, nombre, estado, rol'),
        supabase.from('clientes_planes').select('id, fecha_fin, estado, sesiones_totales, sesiones_usadas'),
        supabase
          .from('entrenamientos')
          .select(`
            id,
            cliente_plan_id,
            cliente_id,
            empleado_id,
            recurso_id,
            fecha,
            hora_inicio,
            hora_fin,
            estado,
            asistencia_estado,
            aviso_previo,
            consume_sesion,
            reprogramable,
            motivo_asistencia,
            fecha_asistencia,
            reprogramado_de_entrenamiento_id,
            marcado_por,
            actualizado_por:marcado_por ( id, nombre ),
            clientes:cliente_id ( nombre ),
            empleados:empleado_id ( nombre, rol ),
            clientes_planes:cliente_plan_id (
              id,
              fecha_fin,
              estado,
              planes:plan_id ( nombre )
            )
          `)
          .not('cliente_plan_id', 'is', null)
          .neq('estado', 'cancelado')
          .order('fecha', { ascending: true })
          .order('hora_inicio', { ascending: true }),
        supabase
          .from('empleados_asistencia')
          .select(`
            id,
            empleado_id,
            fecha,
            estado,
            observaciones,
            created_at,
            updated_at,
            created_by,
            updated_by,
            empleados:empleado_id ( nombre, rol ),
            actualizado_por:updated_by ( id, nombre )
          `)
          .order('fecha', { ascending: false }),
      ])

      if (clientesRes.error) throw new Error(clientesRes.error.message)
      if (citasRes.error) throw new Error(citasRes.error.message)
      if (pagosRes.error) throw new Error(pagosRes.error.message)
      if (empleadosRes.error) throw new Error(empleadosRes.error.message)
      if (clientesPlanesRes.error) throw new Error(clientesPlanesRes.error.message)
      if (entrenamientosPlanRes.error) throw new Error(entrenamientosPlanRes.error.message)
      if (empleadosAsistenciaRes.error) throw new Error(empleadosAsistenciaRes.error.message)

      setClientes((clientesRes.data || []) as Cliente[])
      setCitas((citasRes.data || []) as CitaRaw[])
      setPagos((pagosRes.data || []) as Pago[])
      setEmpleados((empleadosRes.data || []) as Empleado[])
      setClientesPlanes((clientesPlanesRes.data || []) as PlanCliente[])
      setEntrenamientosPlan((entrenamientosPlanRes.data || []) as unknown as EntrenamientoPlanRow[])
      setEmpleadosAsistencia((empleadosAsistenciaRes.data || []) as unknown as EmpleadoAsistenciaRow[])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo cargar el dashboard.')
      setClientes([])
      setCitas([])
      setPagos([])
      setEmpleados([])
      setClientesPlanes([])
      setEntrenamientosPlan([])
      setEmpleadosAsistencia([])
    } finally {
      setLoading(false)
    }
  }

  const today = useMemo(() => new Date(), [])
  const hoy = useMemo(() => getDateKey(today), [today])

  const stats = useMemo(() => {
    const clientesActivos = clientes.filter((c) => c.estado?.toLowerCase() === 'activo').length
    const clientesNuevosMes = clientes.filter((c) => sameMonth(c.created_at, today)).length
    const citasHoy = citas.filter((c) => sameDay(c.fecha, hoy)).length
    const programadasHoy = citas.filter(
      (c) => sameDay(c.fecha, hoy) && c.estado?.toLowerCase() === 'programada'
    ).length
    const completadasMes = citas.filter(
      (c) => sameMonth(c.fecha, today) && c.estado?.toLowerCase() === 'completada'
    ).length
    const canceladasMes = citas.filter(
      (c) => sameMonth(c.fecha, today) && c.estado?.toLowerCase() === 'cancelada'
    ).length

    const ingresosMes = pagos
      .filter((p) => p.estado?.toLowerCase() === 'pagado' && sameMonth(p.fecha, today))
      .reduce((acc, pago) => acc + Number(pago.monto_equivalente_usd || pago.monto || 0), 0)

    const pagosHoy = pagos
      .filter((p) => p.estado?.toLowerCase() === 'pagado' && sameDay(p.fecha, hoy))
      .reduce((acc, pago) => acc + Number(pago.monto_equivalente_usd || pago.monto || 0), 0)

    const personalActivo = empleados.filter((e) => e.estado?.toLowerCase() === 'activo').length

    const planesPorVencer = clientesPlanes.filter((cp) => {
      if (cp.estado?.toLowerCase() !== 'activo' || !cp.fecha_fin) return false
      const fin = new Date(cp.fecha_fin)
      const diff = fin.getTime() - today.getTime()
      const dias = Math.ceil(diff / (1000 * 60 * 60 * 24))
      return dias >= 0 && dias <= 7
    }).length

    const planesActivos = clientesPlanes.filter((cp) => cp.estado?.toLowerCase() === 'activo').length

    const totalSesionesDisponibles = clientesPlanes
      .filter((cp) => cp.estado?.toLowerCase() === 'activo')
      .reduce(
        (acc, cp) => acc + (Number(cp.sesiones_totales || 0) - Number(cp.sesiones_usadas || 0)),
        0
      )

    const sesionesPlanPendientes = entrenamientosPlan.filter((e) => {
      if (e.fecha !== asistenciaFilterFecha) return false
      if ((e.estado || '').toLowerCase() === 'cancelado') return false
      const cp = firstOrNull(e.clientes_planes)
      if (!cp || (cp.estado || '').toLowerCase() === 'cancelado') return false
      return (e.asistencia_estado || 'pendiente') === 'pendiente'
    }).length

    return {
      clientesActivos,
      clientesNuevosMes,
      citasHoy,
      programadasHoy,
      completadasMes,
      canceladasMes,
      ingresosMes,
      pagosHoy,
      personalActivo,
      planesPorVencer,
      planesActivos,
      totalSesionesDisponibles,
      sesionesPlanPendientes,
    }
  }, [clientes, citas, pagos, empleados, clientesPlanes, entrenamientosPlan, today, hoy, asistenciaFilterFecha])

  const topPersonal = useMemo(() => {
    const counts = new Map<string, number>()

    for (const cita of citas) {
      if (!sameMonth(cita.fecha, today)) continue

      const empleadoKey = getFirstExistingKey(cita, [
        'empleado_id',
        'personal_id',
        'staff_id',
        'terapeuta_id',
        'trainer_id',
        'empleadoId',
        'personalId',
      ])

      const empleadoId = empleadoKey ? cita[empleadoKey] : null
      if (!empleadoId) continue

      counts.set(empleadoId, (counts.get(empleadoId) || 0) + 1)
    }

    return empleados
      .map((empleado) => ({
        id: empleado.id,
        nombre: empleado.nombre || 'Sin nombre',
        total: counts.get(empleado.id) || 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [citas, empleados, today])

  const sesionesPlanHoyCompactas = useMemo(() => {
    return entrenamientosPlan
      .filter((row) => {
        if (row.fecha !== asistenciaFilterFecha) return false
        if ((row.estado || '').toLowerCase() === 'cancelado') return false
        const cp = firstOrNull(row.clientes_planes)
        if (!cp) return false
        if ((cp.estado || '').toLowerCase() === 'cancelado') return false
        return true
      })
      .slice(0, 5)
  }, [entrenamientosPlan, asistenciaFilterFecha])

  const empleadosActivosNoAdmin = useMemo(() => {
    return empleados.filter((e) => e.estado?.toLowerCase() === 'activo' && (e.rol || '').toLowerCase() !== 'admin')
  }, [empleados])

  const mapaAsistenciaPersonalHoy = useMemo(() => {
    const map = new Map<string, EmpleadoAsistenciaRow>()
    empleadosAsistencia
      .filter((row) => row.fecha === asistenciaFilterFecha)
      .forEach((row) => map.set(row.empleado_id, row))
    return map
  }, [empleadosAsistencia, asistenciaFilterFecha])

  const alertas = useMemo(() => {
    const items: { titulo: string; detalle: string; tipo: 'warning' | 'info' | 'success' }[] = []

    if (stats.planesPorVencer > 0) {
      items.push({
        titulo: '⚠️ Planes por vencer',
        detalle: `${stats.planesPorVencer} plan(es) vencen en los próximos 7 días.`,
        tipo: 'warning',
      })
    }

    if (stats.canceladasMes > 5) {
      items.push({
        titulo: '⚠️ Citas canceladas',
        detalle: `${stats.canceladasMes} cita(s) canceladas este mes.`,
        tipo: 'warning',
      })
    }

    if (stats.totalSesionesDisponibles < 20) {
      items.push({
        titulo: '⚠️ Sesiones disponibles bajas',
        detalle: `Solo quedan ${stats.totalSesionesDisponibles} sesiones disponibles en total.`,
        tipo: 'warning',
      })
    }

    if (stats.sesionesPlanPendientes > 0) {
      items.push({
        titulo: '📋 Asistencia de planes pendiente',
        detalle: `${stats.sesionesPlanPendientes} sesión(es) del día siguen pendientes.`,
        tipo: 'info',
      })
    }

    if (items.length === 0) {
      items.push({
        titulo: '✓ Todo en orden',
        detalle: 'No hay alertas críticas por el momento.',
        tipo: 'success',
      })
    }

    return items
  }, [stats])

  async function marcarAsistenciaPlan(
    entrenamientoId: string,
    estado: 'asistio' | 'no_asistio_aviso' | 'no_asistio_sin_aviso'
  ) {
    try {
      setSavingAsistenciaId(entrenamientoId)
      setAlert(null)

      let auditorId = empleadoActualId || ''
      if (!auditorId) {
        auditorId = await resolveEmpleadoActualId()
        setEmpleadoActualId(auditorId)
      }

      const { data, error } = await supabase.rpc('marcar_asistencia_entrenamiento_plan', {
        p_entrenamiento_id: entrenamientoId,
        p_asistencia_estado: estado,
        p_motivo: null,
        p_marcado_por: auditorId || null,
      })

      if (error) throw new Error(error.message)
      if (data?.ok === false) throw new Error(data?.error || 'No se pudo marcar la asistencia.')

      showAlert('success', 'Listo', 'Asistencia del plan actualizada.')
      await loadDashboard()
    } catch (err: any) {
      showAlert('error', 'Error', err?.message || 'No se pudo marcar la asistencia.')
    } finally {
      setSavingAsistenciaId(null)
    }
  }

  function initReprogramacionDraft(row: EntrenamientoPlanRow): ReprogramacionDraft {
    return {
      fecha: row.fecha || '',
      hora_inicio: formatTime(row.hora_inicio),
      hora_fin: formatTime(row.hora_fin),
      motivo: row.motivo_asistencia || 'Reprogramación por inasistencia con aviso',
    }
  }

  function handleOpenReprogramacion(row: EntrenamientoPlanRow) {
    setOpenReprogramacionId((current) => (current === row.id ? null : row.id))
    setReprogramacionDrafts((prev) => {
      if (prev[row.id]) return prev
      return { ...prev, [row.id]: initReprogramacionDraft(row) }
    })
  }

  async function reprogramarSesion(row: EntrenamientoPlanRow) {
    const draft = reprogramacionDrafts[row.id]
    if (!draft) return

    if (!draft.fecha || !draft.hora_inicio || !draft.hora_fin) {
      showAlert('warning', 'Faltan datos', 'Completa fecha y horas.')
      return
    }

    if (draft.hora_fin <= draft.hora_inicio) {
      showAlert('warning', 'Horario inválido', 'La hora final debe ser mayor que la inicial.')
      return
    }

    try {
      setReprogramandoId(row.id)
      setAlert(null)

      let auditorId = empleadoActualId || ''
      if (!auditorId) {
        auditorId = await resolveEmpleadoActualId()
        setEmpleadoActualId(auditorId)
      }

      const horaInicioNormalizada =
        draft.hora_inicio.length === 5 ? `${draft.hora_inicio}:00` : draft.hora_inicio
      const horaFinNormalizada =
        draft.hora_fin.length === 5 ? `${draft.hora_fin}:00` : draft.hora_fin

      const { data, error } = await supabase.rpc('reprogramar_entrenamiento_plan', {
        p_entrenamiento_id: row.id,
        p_nueva_fecha: draft.fecha,
        p_nueva_hora_inicio: horaInicioNormalizada,
        p_nueva_hora_fin: horaFinNormalizada,
        p_motivo: draft.motivo || null,
        p_marcado_por: auditorId || null,
      })

      if (error) throw new Error(error.message)
      if (data?.ok === false) throw new Error(data?.error || 'No se pudo reprogramar.')

      setOpenReprogramacionId(null)
      showAlert('success', 'Reprogramado', 'La sesión fue reprogramada correctamente.')
      await loadDashboard()
    } catch (err: any) {
      showAlert('error', 'Error', err?.message || 'No se pudo reprogramar la sesión.')
    } finally {
      setReprogramandoId(null)
    }
  }

  async function marcarAsistenciaEmpleado(
    empleadoId: string,
    estado: 'asistio' | 'no_asistio' | 'permiso' | 'reposo' | 'vacaciones'
  ) {
    try {
      setSavingEmpleadoAsistenciaId(empleadoId)
      setAlert(null)

      let auditorId = empleadoActualId || ''
      if (!auditorId) {
        auditorId = await resolveEmpleadoActualId()
        setEmpleadoActualId(auditorId)
      }

      const existente = empleadosAsistencia.find(
        (a) => a.empleado_id === empleadoId && a.fecha === asistenciaFilterFecha
      )

      if (existente) {
        const { error } = await supabase
          .from('empleados_asistencia')
          .update({
            estado,
            observaciones: null,
            updated_by: auditorId || null,
          })
          .eq('id', existente.id)

        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase.from('empleados_asistencia').insert({
          empleado_id: empleadoId,
          fecha: asistenciaFilterFecha,
          estado,
          observaciones: null,
          created_by: auditorId || null,
          updated_by: auditorId || null,
        })

        if (error) throw new Error(error.message)
      }

      showAlert('success', 'Listo', 'Asistencia del personal actualizada.')
      await loadDashboard()
    } catch (err: any) {
      showAlert('error', 'Error', err?.message || 'No se pudo marcar la asistencia del personal.')
    } finally {
      setSavingEmpleadoAsistenciaId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 px-3 pb-4 sm:px-4 md:px-0">
        <div>
          <p className="text-xs text-white/55 sm:text-sm">Administración</p>
          <h1 className="mt-1 text-xl font-semibold text-white sm:text-2xl">Dashboard</h1>
        </div>

        <Card className="p-4 sm:p-6">
          <p className="text-sm text-white/55 sm:text-base">Cargando dashboard...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5 px-3 pb-4 sm:px-4 md:space-y-6 md:px-0">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-white/55 sm:text-sm">Administración</p>

          <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Dashboard
          </h1>

          <p className="mt-2 text-xs leading-5 text-white/55 sm:text-sm">
            Vista general ·{' '}
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ActionCard
            title="Nueva cita"
            description="Registrar una cita."
            href="/admin/operaciones/agenda/nueva"
          />
          <ActionCard
            title="Nuevo cliente"
            description="Crear perfil de cliente."
            href="/admin/personas/clientes/nuevo"
          />
          <ActionCard
            title="Reportes"
            description="Ver reportes financieros."
            href="/admin/reportes"
          />
        </div>
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error al cargar</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      {alert ? (
        <Card
          className={`p-4 ${
            alert.type === 'error'
              ? 'border-rose-400/30 bg-rose-400/10'
              : alert.type === 'success'
              ? 'border-emerald-400/30 bg-emerald-400/10'
              : alert.type === 'warning'
              ? 'border-amber-400/30 bg-amber-400/10'
              : 'border-sky-400/30 bg-sky-400/10'
          }`}
        >
          <p
            className={`text-sm font-medium ${
              alert.type === 'error'
                ? 'text-rose-300'
                : alert.type === 'success'
                ? 'text-emerald-300'
                : alert.type === 'warning'
                ? 'text-amber-300'
                : 'text-sky-300'
            }`}
          >
            {alert.title}
          </p>
          <p className="mt-1 text-sm text-white/75">{alert.message}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Clientes activos"
          value={stats.clientesActivos}
          subtitle={`+${stats.clientesNuevosMes} este mes`}
          color="text-sky-400"
        />
        <StatCard
          title="Planes activos"
          value={stats.planesActivos}
          subtitle={`${stats.totalSesionesDisponibles} sesiones disponibles`}
          color="text-violet-400"
        />
        <StatCard
          title="Citas hoy"
          value={stats.citasHoy}
          subtitle={`${stats.programadasHoy} programadas`}
          color="text-amber-400"
        />
        <StatCard
          title="Ingresos del mes"
          value={money(stats.ingresosMes)}
          subtitle={`Hoy: ${money(stats.pagosHoy)}`}
          color="text-emerald-400"
        />
        <StatCard
          title="Personal activo"
          value={stats.personalActivo}
          subtitle="Acción rápida abajo"
        />
        <StatCard
          title="Asistencia planes"
          value={stats.sesionesPlanPendientes}
          subtitle="Pendientes del día"
          color={stats.sesionesPlanPendientes > 0 ? 'text-amber-400' : 'text-white/75'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <Section title="Sesiones del plan de hoy" description="Acción rápida compacta.">
            <div className="mb-3 flex items-center justify-between">
              <input
                type="date"
                value={asistenciaFilterFecha}
                onChange={(e) => setAsistenciaFilterFecha(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none"
              />

              <div className="flex items-center gap-3 text-xs text-white/55">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  {sesionesPlanHoyCompactas.filter((x) => (x.asistencia_estado || 'pendiente') === 'pendiente').length}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {sesionesPlanHoyCompactas.filter((x) => (x.asistencia_estado || '') === 'asistio').length}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-400" />
                  {sesionesPlanHoyCompactas.filter((x) => (x.asistencia_estado || '') === 'no_asistio_sin_aviso').length}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {sesionesPlanHoyCompactas.length === 0 ? (
                <Card className="p-4">
                  <p className="text-sm text-white/55">No hay sesiones del plan hoy.</p>
                </Card>
              ) : (
                sesionesPlanHoyCompactas.map((row) => {
                  const cliente = firstOrNull(row.clientes)
                  const empleado = firstOrNull(row.empleados)
                  const clientePlan = firstOrNull(row.clientes_planes)
                  const plan = firstOrNull(clientePlan?.planes)
                  const actor = firstOrNull(row.actualizado_por)
                  const reprogramacionAbierta = openReprogramacionId === row.id
                  const draft = reprogramacionDrafts[row.id] || initReprogramacionDraft(row)

                  return (
                    <Card key={row.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-white">
                            {cliente?.nombre || 'Cliente'}
                            <span className={`ml-2 inline-block h-2.5 w-2.5 rounded-full ${asistenciaPlanDotClass(row.asistencia_estado)}`} />
                          </p>

                          <p className="mt-1 text-sm text-white/55">
                            {formatTime(row.hora_inicio)} - {formatTime(row.hora_fin)} · {empleado?.nombre || 'Empleado'}
                          </p>

                          <p className="mt-1 text-xs text-white/40">
                            {plan?.nombre || 'Plan'} · {roleLabel(empleado?.rol)}
                          </p>

                          <p className="mt-1 text-xs text-white/45">
                            Estado: {asistenciaLabel(row.asistencia_estado)}
                          </p>

                          {actor?.nombre ? (
                            <p className="mt-1 text-[11px] text-white/35">
                              Último registro: {actor.nombre}
                              {row.fecha_asistencia ? ` · ${formatDateTime(row.fecha_asistencia)}` : ''}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            disabled={savingAsistenciaId === row.id}
                            onClick={() => void marcarAsistenciaPlan(row.id, 'asistio')}
                            className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-60"
                          >
                            ✓
                          </button>

                          <button
                            type="button"
                            disabled={savingAsistenciaId === row.id}
                            onClick={() => void marcarAsistenciaPlan(row.id, 'no_asistio_aviso')}
                            className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/15 disabled:opacity-60"
                          >
                            A
                          </button>

                          <button
                            type="button"
                            disabled={savingAsistenciaId === row.id}
                            onClick={() => void marcarAsistenciaPlan(row.id, 'no_asistio_sin_aviso')}
                            className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/15 disabled:opacity-60"
                          >
                            X
                          </button>
                        </div>
                      </div>

                      {(row.asistencia_estado || '').toLowerCase() === 'no_asistio_aviso' ? (
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => handleOpenReprogramacion(row)}
                            className="rounded-xl border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-400/15"
                          >
                            {reprogramacionAbierta ? 'Ocultar reprogramación' : 'Reprogramar'}
                          </button>
                        </div>
                      ) : null}

                      {reprogramacionAbierta ? (
                        <div className="mt-3 grid gap-3 rounded-2xl border border-violet-400/20 bg-violet-400/5 p-3 sm:grid-cols-2">
                          <input
                            type="date"
                            value={draft.fecha}
                            onChange={(e) =>
                              setReprogramacionDrafts((prev) => ({
                                ...prev,
                                [row.id]: { ...draft, fecha: e.target.value },
                              }))
                            }
                            className={inputClassName}
                          />

                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="time"
                              value={draft.hora_inicio}
                              onChange={(e) =>
                                setReprogramacionDrafts((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    ...draft,
                                    hora_inicio: e.target.value,
                                    hora_fin: draft.hora_fin || addMinutesToTime(e.target.value, 60),
                                  },
                                }))
                              }
                              className={inputClassName}
                            />

                            <input
                              type="time"
                              value={draft.hora_fin}
                              onChange={(e) =>
                                setReprogramacionDrafts((prev) => ({
                                  ...prev,
                                  [row.id]: { ...draft, hora_fin: e.target.value },
                                }))
                              }
                              className={inputClassName}
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              value={draft.motivo}
                              onChange={(e) =>
                                setReprogramacionDrafts((prev) => ({
                                  ...prev,
                                  [row.id]: { ...draft, motivo: e.target.value },
                                }))
                              }
                              placeholder="Motivo"
                              className={inputClassName}
                            />
                          </div>

                          <div className="sm:col-span-2 flex gap-2">
                            <button
                              type="button"
                              disabled={reprogramandoId === row.id}
                              onClick={() => void reprogramarSesion(row)}
                              className="rounded-xl border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-400/15 disabled:opacity-60"
                            >
                              {reprogramandoId === row.id ? 'Guardando...' : 'Guardar'}
                            </button>

                            <button
                              type="button"
                              onClick={() => setOpenReprogramacionId(null)}
                              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06]"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </Card>
                  )
                })
              )}
            </div>
          </Section>
        </div>

        <div className="xl:col-span-1">
          <Section title="Asistencia del personal hoy" description="Acción rápida del día.">
            <div className="mb-3 flex items-center justify-between">
              <input
                type="date"
                value={asistenciaFilterFecha}
                onChange={(e) => setAsistenciaFilterFecha(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white outline-none"
              />

              <span className="text-xs text-white/45">
                {empleadosActivosNoAdmin.length} activo(s)
              </span>
            </div>

            <div className="space-y-3">
              {empleadosActivosNoAdmin.length === 0 ? (
                <Card className="p-4">
                  <p className="text-sm text-white/55">No hay personal activo.</p>
                </Card>
              ) : (
                empleadosActivosNoAdmin.slice(0, 5).map((empleado) => {
                  const registro = mapaAsistenciaPersonalHoy.get(empleado.id)
                  const actor = firstOrNull(registro?.actualizado_por)

                  return (
                    <Card key={empleado.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-white">
                            {empleado.nombre || 'Empleado'}
                            <span
                              className={`ml-2 inline-block h-2.5 w-2.5 rounded-full ${asistenciaPersonalDotClass(
                                registro?.estado
                              )}`}
                            />
                          </p>

                          <p className="mt-1 text-sm text-white/55">
                            {roleLabel(empleado.rol)}
                          </p>

                          <p className="mt-1 text-xs text-white/45">
                            {asistenciaPersonalLabel(registro?.estado)}
                          </p>

                          {actor?.nombre ? (
                            <p className="mt-1 text-[11px] text-white/35">
                              Último registro: {actor.nombre}
                              {registro?.updated_at || registro?.created_at
                                ? ` · ${formatDateTime(registro?.updated_at || registro?.created_at)}`
                                : ''}
                            </p>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            disabled={savingEmpleadoAsistenciaId === empleado.id}
                            onClick={() => void marcarAsistenciaEmpleado(empleado.id, 'asistio')}
                            className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-2 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-60"
                          >
                            ✓
                          </button>

                          <button
                            type="button"
                            disabled={savingEmpleadoAsistenciaId === empleado.id}
                            onClick={() => void marcarAsistenciaEmpleado(empleado.id, 'permiso')}
                            className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-2 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/15 disabled:opacity-60"
                          >
                            P
                          </button>

                          <button
                            type="button"
                            disabled={savingEmpleadoAsistenciaId === empleado.id}
                            onClick={() => void marcarAsistenciaEmpleado(empleado.id, 'no_asistio')}
                            className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-2 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/15 disabled:opacity-60"
                          >
                            X
                          </button>

                          <button
                            type="button"
                            disabled={savingEmpleadoAsistenciaId === empleado.id}
                            onClick={() => void marcarAsistenciaEmpleado(empleado.id, 'reposo')}
                            className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/10 px-2 py-2 text-xs font-semibold text-fuchsia-300 transition hover:bg-fuchsia-400/15 disabled:opacity-60"
                          >
                            R
                          </button>

                          <button
                            type="button"
                            disabled={savingEmpleadoAsistenciaId === empleado.id}
                            onClick={() => void marcarAsistenciaEmpleado(empleado.id, 'vacaciones')}
                            className="col-span-2 rounded-xl border border-sky-400/20 bg-sky-400/10 px-2 py-2 text-xs font-semibold text-sky-300 transition hover:bg-sky-400/15 disabled:opacity-60"
                          >
                            Vacaciones
                          </button>
                        </div>
                      </div>
                    </Card>
                  )
                })
              )}
            </div>
          </Section>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title="Personal con más citas" description="Top 5 del mes.">
          <div className="space-y-3">
            {topPersonal.length === 0 ? (
              <Card className="p-4">
                <p className="text-sm text-white/55">
                  No hay datos de personal para mostrar.
                </p>
              </Card>
            ) : (
              topPersonal.map((item, index) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 sm:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          index === 0
                            ? 'bg-amber-400/20 text-amber-300'
                            : index === 1
                            ? 'bg-gray-400/20 text-gray-300'
                            : index === 2
                            ? 'bg-orange-400/20 text-orange-300'
                            : 'bg-white/10 text-white/75'
                        }`}
                      >
                        {index + 1}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{item.nombre}</p>
                        <p className="text-xs text-white/55">Citas completadas</p>
                      </div>
                    </div>

                    <p className="shrink-0 text-lg font-semibold text-white sm:text-xl">
                      {item.total}
                    </p>
                  </div>
                </Card>
              ))
            )}
          </div>
        </Section>

        <Section title="Acciones rápidas" description="Atajos principales.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ActionCard
              title="Clientes"
              description="Ver listado completo."
              href="/admin/personas/clientes"
            />
            <ActionCard
              title="Agenda"
              description="Revisar citas."
              href="/admin/operaciones/agenda"
            />
            <ActionCard
              title="Finanzas"
              description="Ver ingresos/egresos."
              href="/admin/finanzas"
            />
            <ActionCard
              title="Personal"
              description="Ver empleados."
              href="/admin/personas/personal"
            />
          </div>
        </Section>
      </div>
    </div>
  )
}