'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'

type Empleado = {
  id: string
  nombre: string
  rol: string | null
  estado: string | null
}

type AuditorRef = {
  id: string
  nombre: string | null
} | null

type AsistenciaEstado =
  | 'asistio'
  | 'no_asistio'
  | 'permiso'
  | 'reposo'
  | 'vacaciones'

type AsistenciaRow = {
  id: string
  empleado_id: string
  fecha: string
  estado: AsistenciaEstado
  observaciones: string | null
  created_at: string
  updated_at?: string | null
  created_by?: string | null
  updated_by?: string | null
  empleados?: {
    nombre: string
    rol: string | null
  } | null
  creado_por?: AuditorRef
  actualizado_por?: AuditorRef
}

type DisponibilidadTipo =
  | 'disponible'
  | 'no_asistira'
  | 'permiso'
  | 'vacaciones'
  | 'reposo'
  | 'bloqueo_manual'

type DisponibilidadEvento = {
  id: string
  empleado_id: string
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  tipo: DisponibilidadTipo
  motivo: string | null
  observaciones: string | null
  created_at: string
}

type AlertState = {
  type: 'error' | 'success' | 'info' | 'warning'
  title: string
  message: string
} | null

type AsistenciaForm = {
  empleado_id: string
  fecha: string
  estado: AsistenciaEstado
  observaciones: string
  bloquear_agenda: boolean
}

const INITIAL_FORM: AsistenciaForm = {
  empleado_id: '',
  fecha: new Date().toISOString().slice(0, 10),
  estado: 'asistio',
  observaciones: '',
  bloquear_agenda: false,
}

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

function Field({
  label,
  children,
  helper,
}: {
  label: string
  children: ReactNode
  helper?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/75">{label}</label>
      {children}
      {helper ? <p className="mt-2 text-xs text-white/45">{helper}</p> : null}
    </div>
  )
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function formatHora(hora: string | null | undefined) {
  if (!hora) return '—'
  return hora.slice(0, 5)
}

function formatAsistenciaEstado(estado: AsistenciaEstado) {
  switch (estado) {
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
      return estado
  }
}

function asistenciaBadge(estado: AsistenciaEstado) {
  switch (estado) {
    case 'asistio':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'no_asistio':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'permiso':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'reposo':
      return 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-300'
    case 'vacaciones':
      return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function formatDisponibilidadTipo(tipo: DisponibilidadTipo) {
  switch (tipo) {
    case 'disponible':
      return 'Disponible'
    case 'no_asistira':
      return 'No asistirá'
    case 'permiso':
      return 'Permiso'
    case 'vacaciones':
      return 'Vacaciones'
    case 'reposo':
      return 'Reposo'
    case 'bloqueo_manual':
      return 'Bloqueo manual'
    default:
      return tipo
  }
}

function roleLabel(rol: string | null | undefined) {
  const value = (rol || '').trim().toLowerCase()
  if (!value) return 'Sin rol'
  if (value === 'terapeuta' || value === 'fisioterapeuta') return 'Fisioterapeuta'
  if (value === 'entrenador') return 'Entrenador'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function getLocalToday() {
  return new Date().toISOString().slice(0, 10)
}

function getMonthStart(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`)
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function formatMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthTitle(date: Date) {
  return date.toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  })
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

function sameDay(a: string, b: string) {
  return a === b
}

function getCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)

  const startOffset = (first.getDay() + 6) % 7
  const days: Date[] = []

  for (let i = startOffset; i > 0; i--) {
    days.push(new Date(year, month, 1 - i))
  }

  for (let i = 1; i <= last.getDate(); i++) {
    days.push(new Date(year, month, i))
  }

  while (days.length % 7 !== 0) {
    days.push(new Date(year, month, last.getDate() + (days.length % 7) + 1))
  }

  return days
}

function getUltimoRegistroTexto(item: AsistenciaRow) {
  const actor = item.actualizado_por?.nombre || item.creado_por?.nombre || 'Sin registro'
  const fecha = formatDateTime(item.updated_at || item.created_at)
  return `Último registro: ${actor} · ${fecha}`
}

export default function AsistenciaPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [asistencias, setAsistencias] = useState<AsistenciaRow[]>([])
  const [eventosDisponibilidad, setEventosDisponibilidad] = useState<DisponibilidadEvento[]>([])

  const [form, setForm] = useState<AsistenciaForm>(INITIAL_FORM)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [quickSavingId, setQuickSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [empleadoActualId, setEmpleadoActualId] = useState('')

  const [search, setSearch] = useState('')
  const [alert, setAlert] = useState<AlertState>(null)

  const [monthView, setMonthView] = useState(() => formatMonthKey(new Date()))

  function showAlert(
    type: 'error' | 'success' | 'info' | 'warning',
    title: string,
    message: string
  ) {
    setAlert({ type, title, message })
  }

  function clearAlert() {
    setAlert(null)
  }

  useEffect(() => {
    void loadData()
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

  const empleadosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return empleados

    return empleados.filter((empleado) => {
      return (
        (empleado.nombre || '').toLowerCase().includes(q) ||
        (empleado.rol || '').toLowerCase().includes(q)
      )
    })
  }, [empleados, search])

  const asistenciaDelDia = useMemo(() => {
    return asistencias.filter((a) => a.fecha === form.fecha)
  }, [asistencias, form.fecha])

  const mapaAsistenciaDelDia = useMemo(() => {
    const map = new Map<string, AsistenciaRow>()
    asistenciaDelDia.forEach((item) => {
      map.set(item.empleado_id, item)
    })
    return map
  }, [asistenciaDelDia])

  const currentMonthDate = useMemo(() => {
    const [year, month] = monthView.split('-').map(Number)
    return new Date(year, (month || 1) - 1, 1)
  }, [monthView])

  const monthDays = useMemo(() => getCalendarDays(currentMonthDate), [currentMonthDate])

  const asistenciasDelMes = useMemo(() => {
    return asistencias.filter((a) => a.fecha.startsWith(monthView))
  }, [asistencias, monthView])

  const resumenPorDia = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number
        asistio: number
        no_asistio: number
        permiso: number
        reposo: number
        vacaciones: number
      }
    >()

    for (const item of asistenciasDelMes) {
      const current = map.get(item.fecha) || {
        total: 0,
        asistio: 0,
        no_asistio: 0,
        permiso: 0,
        reposo: 0,
        vacaciones: 0,
      }

      current.total += 1
      current[item.estado] += 1
      map.set(item.fecha, current)
    }

    return map
  }, [asistenciasDelMes])

  const stats = useMemo(() => {
    const delDia = asistencias.filter((a) => a.fecha === form.fecha)

    return {
      totalPersonal: empleados.length,
      registradosHoy: delDia.length,
      asistieronHoy: delDia.filter((a) => a.estado === 'asistio').length,
      bloqueadosHoy: eventosDisponibilidad.filter((e) => e.fecha === form.fecha).length,
    }
  }, [empleados, asistencias, eventosDisponibilidad, form.fecha])

  async function loadData() {
    try {
      setLoading(true)
      clearAlert()

      const [empleadosRes, asistenciasRes, eventosRes] = await Promise.all([
        supabase
          .from('empleados')
          .select('id, nombre, rol, estado')
          .neq('rol', 'admin')
          .eq('estado', 'activo')
          .order('nombre', { ascending: true }),

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
            creado_por:created_by ( id, nombre ),
            actualizado_por:updated_by ( id, nombre )
          `)
          .order('fecha', { ascending: false })
          .order('updated_at', { ascending: false })
          .order('created_at', { ascending: false }),

        supabase
          .from('empleados_disponibilidad_eventos')
          .select(`
            id,
            empleado_id,
            fecha,
            hora_inicio,
            hora_fin,
            tipo,
            motivo,
            observaciones,
            created_at
          `)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false }),
      ])

      if (empleadosRes.error) throw empleadosRes.error
      if (asistenciasRes.error) throw asistenciasRes.error
      if (eventosRes.error) throw eventosRes.error

      setEmpleados((empleadosRes.data || []) as Empleado[])
      setAsistencias((asistenciasRes.data || []) as unknown as AsistenciaRow[])
      setEventosDisponibilidad((eventosRes.data || []) as DisponibilidadEvento[])
    } catch (err: any) {
      showAlert('error', 'Error', err?.message || 'No se pudo cargar asistencia.')
      setEmpleados([])
      setAsistencias([])
      setEventosDisponibilidad([])
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm({
      ...INITIAL_FORM,
      fecha: getLocalToday(),
    })
  }

  function validateForm() {
    if (!form.empleado_id) return 'Selecciona un miembro del personal.'
    if (!form.fecha) return 'Selecciona una fecha.'
    return ''
  }

  function debeBloquearAgenda(estado: AsistenciaEstado) {
    return ['no_asistio', 'permiso', 'reposo', 'vacaciones'].includes(estado)
  }

  function mapEstadoToDisponibilidad(estado: AsistenciaEstado): DisponibilidadTipo | null {
    switch (estado) {
      case 'no_asistio':
        return 'no_asistira'
      case 'permiso':
        return 'permiso'
      case 'reposo':
        return 'reposo'
      case 'vacaciones':
        return 'vacaciones'
      default:
        return null
    }
  }

  async function upsertAsistencia(
    empleadoId: string,
    fecha: string,
    estado: AsistenciaEstado,
    observaciones: string,
    bloquearAgenda: boolean
  ) {
    let auditorId = empleadoActualId || ''

    if (!auditorId) {
      auditorId = await resolveEmpleadoActualId()
      setEmpleadoActualId(auditorId)
    }

    const observacionFinal = observaciones.trim() || null

    const existente = asistencias.find(
      (a) => a.empleado_id === empleadoId && a.fecha === fecha
    )

    if (existente) {
      const { error } = await supabase
        .from('empleados_asistencia')
        .update({
          estado,
          observaciones: observacionFinal,
          updated_by: auditorId || null,
        })
        .eq('id', existente.id)

      if (error) throw error
    } else {
      const { error } = await supabase
        .from('empleados_asistencia')
        .insert({
          empleado_id: empleadoId,
          fecha,
          estado,
          observaciones: observacionFinal,
          created_by: auditorId || null,
          updated_by: auditorId || null,
        })

      if (error) throw error
    }

    const tipoDisponibilidad = mapEstadoToDisponibilidad(estado)

    if (bloquearAgenda && tipoDisponibilidad) {
      const eventoExistente = eventosDisponibilidad.find(
        (e) =>
          e.empleado_id === empleadoId &&
          e.fecha === fecha &&
          e.tipo === tipoDisponibilidad &&
          e.hora_inicio === null &&
          e.hora_fin === null
      )

      if (!eventoExistente) {
        const { error: eventoError } = await supabase
          .from('empleados_disponibilidad_eventos')
          .insert({
            empleado_id: empleadoId,
            fecha,
            hora_inicio: null,
            hora_fin: null,
            tipo: tipoDisponibilidad,
            motivo: observacionFinal,
            observaciones: 'Creado automáticamente desde asistencia',
          })

        if (eventoError) throw eventoError
      }
    }
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    clearAlert()

    const err = validateForm()
    if (err) {
      showAlert('warning', 'Datos incompletos', err)
      return
    }

    try {
      setSaving(true)

      await upsertAsistencia(
        form.empleado_id,
        form.fecha,
        form.estado,
        form.observaciones,
        form.bloquear_agenda
      )

      showAlert('success', 'Listo', 'Asistencia guardada correctamente.')
      resetForm()
      await loadData()
    } catch (err: any) {
      showAlert('error', 'Error', err?.message || 'No se pudo guardar la asistencia.')
    } finally {
      setSaving(false)
    }
  }

  async function quickMarcar(
    empleado: Empleado,
    estado: AsistenciaEstado,
    bloquearAgenda = false
  ) {
    try {
      setQuickSavingId(empleado.id)
      clearAlert()

      await upsertAsistencia(
        empleado.id,
        form.fecha,
        estado,
        '',
        bloquearAgenda && debeBloquearAgenda(estado)
      )

      showAlert(
        'success',
        'Listo',
        `${empleado.nombre} quedó marcado como ${formatAsistenciaEstado(estado).toLowerCase()}.`
      )

      await loadData()
    } catch (err: any) {
      showAlert('error', 'Error', err?.message || 'No se pudo registrar la asistencia.')
    } finally {
      setQuickSavingId(null)
    }
  }

  async function eliminarRegistro(id: string) {
    const ok = window.confirm('¿Seguro que deseas eliminar este registro de asistencia?')
    if (!ok) return

    try {
      setDeletingId(id)
      clearAlert()

      const { error } = await supabase
        .from('empleados_asistencia')
        .delete()
        .eq('id', id)

      if (error) throw error

      showAlert('success', 'Listo', 'Registro eliminado correctamente.')
      await loadData()
    } catch (err: any) {
      showAlert('error', 'Error', err?.message || 'No se pudo eliminar el registro.')
    } finally {
      setDeletingId(null)
    }
  }

  function goPrevMonth() {
    const d = new Date(currentMonthDate)
    d.setMonth(d.getMonth() - 1)
    setMonthView(formatMonthKey(d))
  }

  function goNextMonth() {
    const d = new Date(currentMonthDate)
    d.setMonth(d.getMonth() + 1)
    setMonthView(formatMonthKey(d))
  }

  function goToday() {
    const today = new Date()
    setMonthView(formatMonthKey(today))
    setForm((prev) => ({ ...prev, fecha: dayKey(today) }))
  }

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <div>
        <p className="text-sm text-white/55">Operaciones</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          Asistencia
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Control diario de asistencia del personal con calendario mensual y último responsable del registro.
        </p>
      </div>

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
          <div className="flex items-start justify-between gap-4">
            <div>
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
            </div>

            <button
              type="button"
              onClick={clearAlert}
              className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              Cerrar
            </button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Personal activo" value={stats.totalPersonal} color="text-white" />
        <StatCard title="Registrados hoy" value={stats.registradosHoy} color="text-sky-400" />
        <StatCard title="Asistieron hoy" value={stats.asistieronHoy} color="text-emerald-400" />
        <StatCard title="Bloqueos agenda" value={stats.bloqueadosHoy} color="text-rose-400" />
      </div>

      <Section
        title="Calendario mensual de asistencia"
        description="Vista tipo calendario normal. Puedes cambiar de mes y hacer clic en cualquier día."
      >
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goPrevMonth}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06]"
            >
              ←
            </button>

            <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white">
              {monthTitle(currentMonthDate)}
            </div>

            <button
              type="button"
              onClick={goNextMonth}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/80 hover:bg-white/[0.06]"
            >
              →
            </button>

            <button
              type="button"
              onClick={goToday}
              className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-sm font-medium text-sky-300 hover:bg-sky-400/15"
            >
              Hoy
            </button>
          </div>

          <div className="text-sm text-white/50">
            Día seleccionado: <span className="text-white">{form.fecha}</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((label) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-center text-xs font-medium text-white/55"
            >
              {label}
            </div>
          ))}

          {monthDays.map((date) => {
            const key = dayKey(date)
            const resumen = resumenPorDia.get(key)
            const isCurrentMonth = date.getMonth() === currentMonthDate.getMonth()
            const isSelected = sameDay(key, form.fecha)
            const isToday = sameDay(key, getLocalToday())

            return (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    fecha: key,
                  }))
                }
                className={`min-h-[108px] rounded-2xl border p-3 text-left transition ${
                  isSelected
                    ? 'border-violet-400/40 bg-violet-500/10'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                } ${!isCurrentMonth ? 'opacity-35' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-semibold ${
                      isToday ? 'text-emerald-300' : 'text-white'
                    }`}
                  >
                    {date.getDate()}
                  </span>

                  {resumen?.total ? (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
                      {resumen.total}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 space-y-1">
                  {resumen?.asistio ? (
                    <div className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300">
                      Asistió: {resumen.asistio}
                    </div>
                  ) : null}

                  {resumen?.no_asistio ? (
                    <div className="rounded-lg bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300">
                      No asistió: {resumen.no_asistio}
                    </div>
                  ) : null}

                  {resumen?.permiso ? (
                    <div className="rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
                      Permiso: {resumen.permiso}
                    </div>
                  ) : null}

                  {resumen?.reposo ? (
                    <div className="rounded-lg bg-fuchsia-500/10 px-2 py-1 text-[11px] text-fuchsia-300">
                      Reposo: {resumen.reposo}
                    </div>
                  ) : null}

                  {resumen?.vacaciones ? (
                    <div className="rounded-lg bg-sky-500/10 px-2 py-1 text-[11px] text-sky-300">
                      Vacaciones: {resumen.vacaciones}
                    </div>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-1">
          <form onSubmit={handleGuardar}>
            <Section
              title="Registrar asistencia"
              description="Guarda la asistencia y, si aplica, bloquea la agenda."
            >
              <div className="space-y-4">
                <Field label="Personal">
                  <select
                    value={form.empleado_id}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        empleado_id: e.target.value,
                      }))
                    }
                    className={inputClassName}
                  >
                    <option value="" className="bg-[#11131a] text-white">
                      Seleccionar personal
                    </option>
                    {empleados.map((empleado) => (
                      <option key={empleado.id} value={empleado.id} className="bg-[#11131a] text-white">
                        {empleado.nombre} {empleado.rol ? `· ${roleLabel(empleado.rol)}` : ''}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Fecha">
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        fecha: e.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>

                <Field label="Estado">
                  <select
                    value={form.estado}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        estado: e.target.value as AsistenciaEstado,
                        bloquear_agenda: debeBloquearAgenda(e.target.value as AsistenciaEstado),
                      }))
                    }
                    className={inputClassName}
                  >
                    <option value="asistio" className="bg-[#11131a] text-white">
                      Asistió
                    </option>
                    <option value="no_asistio" className="bg-[#11131a] text-white">
                      No asistió
                    </option>
                    <option value="permiso" className="bg-[#11131a] text-white">
                      Permiso
                    </option>
                    <option value="reposo" className="bg-[#11131a] text-white">
                      Reposo
                    </option>
                    <option value="vacaciones" className="bg-[#11131a] text-white">
                      Vacaciones
                    </option>
                  </select>
                </Field>

                <Field label="Bloquear agenda">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm text-white/80">
                      <input
                        type="radio"
                        checked={form.bloquear_agenda}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            bloquear_agenda: true,
                          }))
                        }
                      />
                      Sí
                    </label>

                    <label className="flex items-center gap-2 text-sm text-white/80">
                      <input
                        type="radio"
                        checked={!form.bloquear_agenda}
                        onChange={() =>
                          setForm((prev) => ({
                            ...prev,
                            bloquear_agenda: false,
                          }))
                        }
                      />
                      No
                    </label>
                  </div>
                </Field>

                <Field label="Observaciones">
                  <textarea
                    rows={4}
                    value={form.observaciones}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        observaciones: e.target.value,
                      }))
                    }
                    className={`${inputClassName} resize-none`}
                    placeholder="Notas opcionales..."
                  />
                </Field>

                <div className="flex flex-wrap gap-3">
                  <button
                    disabled={saving}
                    type="submit"
                    className="
                      rounded-2xl border border-sky-400/20 bg-sky-400/10
                      px-4 py-3 text-sm font-semibold text-sky-300 transition
                      hover:bg-sky-400/15 disabled:opacity-60
                    "
                  >
                    {saving ? 'Guardando...' : 'Guardar asistencia'}
                  </button>

                  <button
                    type="button"
                    onClick={resetForm}
                    className="
                      rounded-2xl border border-white/10 bg-white/[0.03]
                      px-4 py-3 text-sm font-semibold text-white/80 transition
                      hover:bg-white/[0.06]
                    "
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </Section>
          </form>

          <Section
            title="Historial del día"
            description="Aquí se ve el último estado que quedó guardado y quién lo dejó."
          >
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-white/55">Cargando...</p>
              ) : asistenciaDelDia.length === 0 ? (
                <p className="text-sm text-white/55">No hay registros para esta fecha.</p>
              ) : (
                asistenciaDelDia.map((item) => (
                  <Card key={item.id} className="p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {item.empleados?.nombre || 'Personal'}
                        </p>
                        <p className="text-xs text-white/45">
                          {roleLabel(item.empleados?.rol)}
                        </p>
                      </div>

                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${asistenciaBadge(
                          item.estado
                        )}`}
                      >
                        {formatAsistenciaEstado(item.estado)}
                      </span>
                    </div>

                    <p className="text-sm text-white/70">
                      {item.observaciones || 'Sin observaciones'}
                    </p>

                    <div className="mt-3 space-y-1">
                      <div className="text-[11px] text-white/35">
                        {getUltimoRegistroTexto(item)}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/45">
                      <span>{formatDateTime(item.updated_at || item.created_at)}</span>

                      <button
                        type="button"
                        onClick={() => void eliminarRegistro(item.id)}
                        disabled={deletingId === item.id}
                        className="
                          rounded-xl border border-rose-400/20 bg-rose-400/10
                          px-3 py-1.5 text-xs font-semibold text-rose-300
                          transition hover:bg-rose-400/15 disabled:opacity-60
                        "
                      >
                        {deletingId === item.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Section>
        </div>

        <div className="xl:col-span-2">
          <Section
            title="Asistencia del personal"
            description="Marca rápido quién asistió, quién no asistió, permisos, reposos o vacaciones."
          >
            <div className="mb-4 grid gap-4 md:grid-cols-[1fr_220px]">
              <input
                type="text"
                placeholder="Buscar por nombre o rol..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={inputClassName}
              />

              <input
                type="date"
                value={form.fecha}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    fecha: e.target.value,
                  }))
                }
                className={inputClassName}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {loading ? (
                <p className="text-sm text-white/55">Cargando personal...</p>
              ) : empleadosFiltrados.length === 0 ? (
                <p className="text-sm text-white/55">No se encontró personal.</p>
              ) : (
                empleadosFiltrados.map((empleado) => {
                  const registro = mapaAsistenciaDelDia.get(empleado.id)
                  const bloqueosDelDia = eventosDisponibilidad.filter(
                    (e) => e.empleado_id === empleado.id && e.fecha === form.fecha
                  )

                  return (
                    <Card key={empleado.id} className="p-4">
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-white">{empleado.nombre}</p>
                        <p className="text-xs text-white/45">{roleLabel(empleado.rol)}</p>
                      </div>

                      <div className="mb-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/45">Estado actual</span>
                          {registro ? (
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${asistenciaBadge(
                                registro.estado
                              )}`}
                            >
                              {formatAsistenciaEstado(registro.estado)}
                            </span>
                          ) : (
                            <span className="text-xs text-white/40">Sin registrar</span>
                          )}
                        </div>

                        <div className="text-xs text-white/45">
                          {registro?.observaciones || 'Sin observaciones'}
                        </div>

                        {registro ? (
                          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                            <p className="text-[11px] text-white/55">
                              {getUltimoRegistroTexto(registro)}
                            </p>
                          </div>
                        ) : null}

                        {bloqueosDelDia.length > 0 ? (
                          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-2">
                            <p className="text-xs font-medium text-rose-300">Bloqueos agenda</p>
                            <div className="mt-1 space-y-1">
                              {bloqueosDelDia.map((bloqueo) => (
                                <p key={bloqueo.id} className="text-[11px] text-white/70">
                                  {formatDisponibilidadTipo(bloqueo.tipo)} ·{' '}
                                  {bloqueo.hora_inicio || bloqueo.hora_fin
                                    ? `${formatHora(bloqueo.hora_inicio)} - ${formatHora(bloqueo.hora_fin)}`
                                    : 'Todo el día'}
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={quickSavingId === empleado.id}
                          onClick={() => void quickMarcar(empleado, 'asistio', false)}
                          className="
                            rounded-xl border border-emerald-400/20 bg-emerald-400/10
                            px-3 py-2 text-xs font-semibold text-emerald-300
                            transition hover:bg-emerald-400/15 disabled:opacity-60
                          "
                        >
                          Asistió
                        </button>

                        <button
                          type="button"
                          disabled={quickSavingId === empleado.id}
                          onClick={() => void quickMarcar(empleado, 'no_asistio', true)}
                          className="
                            rounded-xl border border-rose-400/20 bg-rose-400/10
                            px-3 py-2 text-xs font-semibold text-rose-300
                            transition hover:bg-rose-400/15 disabled:opacity-60
                          "
                        >
                          No asistió
                        </button>

                        <button
                          type="button"
                          disabled={quickSavingId === empleado.id}
                          onClick={() => void quickMarcar(empleado, 'permiso', true)}
                          className="
                            rounded-xl border border-amber-400/20 bg-amber-400/10
                            px-3 py-2 text-xs font-semibold text-amber-300
                            transition hover:bg-amber-400/15 disabled:opacity-60
                          "
                        >
                          Permiso
                        </button>

                        <button
                          type="button"
                          disabled={quickSavingId === empleado.id}
                          onClick={() => void quickMarcar(empleado, 'reposo', true)}
                          className="
                            rounded-xl border border-fuchsia-400/20 bg-fuchsia-400/10
                            px-3 py-2 text-xs font-semibold text-fuchsia-300
                            transition hover:bg-fuchsia-400/15 disabled:opacity-60
                          "
                        >
                          Reposo
                        </button>

                        <button
                          type="button"
                          disabled={quickSavingId === empleado.id}
                          onClick={() => void quickMarcar(empleado, 'vacaciones', true)}
                          className="
                            col-span-2 rounded-xl border border-sky-400/20 bg-sky-400/10
                            px-3 py-2 text-xs font-semibold text-sky-300
                            transition hover:bg-sky-400/15 disabled:opacity-60
                          "
                        >
                          Vacaciones
                        </button>
                      </div>
                    </Card>
                  )
                })
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}