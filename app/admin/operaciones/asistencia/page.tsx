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
  empleados?: {
    nombre: string
    rol: string | null
  } | null
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

export default function AsistenciaPage() {
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [asistencias, setAsistencias] = useState<AsistenciaRow[]>([])
  const [eventosDisponibilidad, setEventosDisponibilidad] = useState<DisponibilidadEvento[]>([])

  const [form, setForm] = useState<AsistenciaForm>(INITIAL_FORM)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [quickSavingId, setQuickSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [alert, setAlert] = useState<AlertState>(null)

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
  }, [])

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
            empleados:empleado_id ( nombre, rol )
          `)
          .order('fecha', { ascending: false })
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
      fecha: new Date().toISOString().slice(0, 10),
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
        `${empleado.nombre} marcado como ${formatAsistenciaEstado(estado).toLowerCase()}.`
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

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <div>
        <p className="text-sm text-white/55">Operaciones</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          Asistencia
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Control diario de asistencia del personal con integración a bloqueo de agenda.
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

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-1">
          <form onSubmit={handleGuardar}>
            <Section
              title="Registrar asistencia"
              description="Guarda la asistencia de un miembro del personal y opcionalmente bloquea la agenda."
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
                        {empleado.nombre} {empleado.rol ? `· ${empleado.rol}` : ''}
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
            description="Resumen rápido de quién asistió y quién no en la fecha seleccionada."
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
                          {item.empleados?.rol || 'Sin rol'}
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

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-white/45">
                      <span>{formatDateTime(item.created_at)}</span>

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
                        <p className="text-xs text-white/45">{empleado.rol || 'Sin rol'}</p>
                      </div>

                      <div className="mb-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-white/45">Estado</span>
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