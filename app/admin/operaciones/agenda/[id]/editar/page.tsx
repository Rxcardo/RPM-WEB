'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

type ServicioRaw = {
  id: string
  nombre: string
  estado?: string | null
  duracion_minutos?: number | null
  [key: string]: any
}

type Servicio = {
  id: string
  nombre: string
  duracion_min: number | null
  estado?: string | null
}

type Recurso = {
  id: string
  nombre: string
  estado: string | null
  capacidad: number | null
  hora_inicio: string | null
  hora_fin: string | null
}

type CitaDetalle = {
  id: string
  cliente_id: string
  terapeuta_id: string | null
  servicio_id: string | null
  recurso_id: string | null
  fecha: string | null
  hora_inicio: string | null
  hora_fin: string | null
  estado: string | null
  notas: string | null
  clientes: { nombre: string } | null
  empleados: { nombre: string } | null
  servicios: ServicioRaw | null
  recursos: { id: string; nombre: string } | null
}

type ValidacionCita = {
  disponible: boolean
  motivo: string
  conflicto_terapeuta?: boolean
  conflicto_cliente?: boolean
  conflictos_recurso?: number
  capacidad_recurso?: number
  recurso_estado?: string | null
  recurso_hora_inicio?: string | null
  recurso_hora_fin?: string | null
  detalle?: {
    tipo?: string
    motivo?: string
    detalle?: string
    hora_inicio?: string | null
    hora_fin?: string | null
  } | null
}

function getServicioDuracion(servicio: ServicioRaw | null): number | null {
  if (!servicio) return null

  const posibles = [
    servicio.duracion_minutos,
    (servicio as any).duracion_min,
    (servicio as any).duracion,
    (servicio as any).tiempo,
    (servicio as any).tiempo_min,
    (servicio as any).tiempo_minutos,
    (servicio as any).minutos,
  ]

  for (const valor of posibles) {
    const n = Number(valor)
    if (!Number.isNaN(n) && n > 0) return n
  }

  return null
}

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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-white/45">{label}</p>
      <p className="mt-1 font-medium text-white">{value}</p>
    </Card>
  )
}

function formatHora(hora?: string | null) {
  if (!hora) return '—'
  return hora.slice(0, 5)
}

function buildErrorFromValidacion(validacion: ValidacionCita | null | undefined) {
  if (!validacion) return 'No se pudo validar la disponibilidad.'

  switch (validacion.motivo) {
    case 'ok':
      return ''
    case 'empleado_bloqueado':
      return (
        validacion.detalle?.detalle ||
        validacion.detalle?.motivo ||
        'El fisioterapeuta no está disponible en ese horario.'
      )
    case 'conflicto_terapeuta':
      return 'Ese fisioterapeuta ya tiene una cita en ese horario.'
    case 'conflicto_cliente':
      return 'Ese cliente ya tiene una cita en ese horario.'
    case 'conflicto_recurso':
      return validacion.capacidad_recurso && validacion.capacidad_recurso > 1
        ? `Ese recurso ya alcanzó su capacidad máxima (${validacion.capacidad_recurso}) en ese horario.`
        : 'Ese recurso ya está ocupado en ese horario.'
    case 'recurso_inactivo':
      return 'Ese recurso está inactivo.'
    case 'recurso_mantenimiento':
      return 'Ese recurso está en mantenimiento.'
    case 'fuera_horario_recurso_inicio':
      return `Ese recurso solo está disponible desde las ${formatHora(validacion.recurso_hora_inicio)}.`
    case 'fuera_horario_recurso_fin':
      return `Ese recurso solo está disponible hasta las ${formatHora(validacion.recurso_hora_fin)}.`
    case 'recurso_no_existe':
      return 'El recurso seleccionado no existe.'
    case 'hora_fin_invalida':
      return 'La hora final debe ser mayor que la hora inicial.'
    default:
      return `No se puede guardar la cita (${validacion.motivo}).`
  }
}

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

export default function EditarCitaPage() {
  const router = useRouter()
  const params = useParams()
  const rawId = params?.id
  const id = Array.isArray(rawId) ? rawId[0] : (rawId as string)

  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [empleadoActualId, setEmpleadoActualId] = useState('')

  const [servicios, setServicios] = useState<Servicio[]>([])
  const [recursos, setRecursos] = useState<Recurso[]>([])

  const [citaActual, setCitaActual] = useState<CitaDetalle | null>(null)

  const [resumen, setResumen] = useState({
    cliente: '',
    terapeuta: '',
    fecha: '',
    horaInicio: '',
    horaFin: '',
    estado: '',
    notas: '',
    servicioActual: '',
    recursoActual: '',
  })

  const [form, setForm] = useState({
    servicio_id: '',
    recurso_id: '',
  })

  const servicioSeleccionado = useMemo(
    () => servicios.find((s) => s.id === form.servicio_id) || null,
    [servicios, form.servicio_id]
  )

  const recursoSeleccionado = useMemo(
    () => recursos.find((r) => r.id === form.recurso_id) || null,
    [recursos, form.recurso_id]
  )

  useEffect(() => {
    if (!id) return
    void loadData()
    void loadEmpleadoActual()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

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

  async function loadData() {
    setLoadingData(true)
    setErrorMsg('')

    try {
      const [serviciosRes, recursosRes, citaRes] = await Promise.all([
        supabase
          .from('servicios')
          .select('id, nombre, estado, duracion_minutos')
          .order('nombre', { ascending: true }),

        supabase
          .from('recursos')
          .select('id, nombre, estado, capacidad, hora_inicio, hora_fin')
          .order('nombre', { ascending: true }),

        supabase
          .from('citas')
          .select(`
            id,
            cliente_id,
            terapeuta_id,
            servicio_id,
            recurso_id,
            fecha,
            hora_inicio,
            hora_fin,
            estado,
            notas,
            clientes:cliente_id ( nombre ),
            empleados:terapeuta_id ( nombre ),
            servicios:servicio_id ( * ),
            recursos:recurso_id ( id, nombre )
          `)
          .eq('id', id)
          .limit(1)
          .maybeSingle(),
      ])

      if (serviciosRes.error) throw new Error(serviciosRes.error.message)
      if (recursosRes.error) throw new Error(recursosRes.error.message)
      if (citaRes.error) throw new Error(citaRes.error.message)
      if (!citaRes.data) throw new Error('No se encontró la cita.')

      const serviciosRaw = (serviciosRes.data || []) as ServicioRaw[]
      const serviciosData: Servicio[] = serviciosRaw
        .filter((s) => (s.estado || '').toLowerCase() !== 'inactivo')
        .map((s) => ({
          id: s.id,
          nombre: s.nombre,
          estado: s.estado ?? null,
          duracion_min: getServicioDuracion(s),
        }))

      const recursosData = ((recursosRes.data || []) as Recurso[]).filter(
        (r) => (r.estado || '').toLowerCase() !== 'inactivo'
      )

      const cita = citaRes.data as unknown as CitaDetalle

      setCitaActual(cita)
      setServicios(serviciosData)
      setRecursos(recursosData)

      setResumen({
        cliente: cita.clientes?.nombre || 'Sin cliente',
        terapeuta: cita.empleados?.nombre || 'Sin terapeuta',
        fecha: cita.fecha || '—',
        horaInicio: cita.hora_inicio ? cita.hora_inicio.slice(0, 5) : '—',
        horaFin: cita.hora_fin ? cita.hora_fin.slice(0, 5) : '—',
        estado: cita.estado || '—',
        notas: cita.notas || 'Sin notas',
        servicioActual: cita.servicios?.nombre || 'Sin servicio',
        recursoActual: cita.recursos?.nombre || 'Sin recurso',
      })

      setForm({
        servicio_id: cita.servicio_id || '',
        recurso_id: cita.recurso_id || '',
      })
    } catch (err: any) {
      console.error('Error al cargar edición:', err)
      setErrorMsg(err?.message || 'No se pudo cargar la cita.')
    } finally {
      setLoadingData(false)
    }
  }

  async function guardarCambios() {
    setErrorMsg('')

    if (!form.servicio_id) {
      setErrorMsg('Selecciona un servicio.')
      return
    }

    if (!citaActual?.fecha || !citaActual?.hora_inicio || !citaActual?.hora_fin) {
      setErrorMsg('La cita actual no tiene fecha u horario válidos.')
      return
    }

    setSaving(true)

    try {
      const { data: validacion, error: validacionError } = await supabase.rpc(
        'validar_disponibilidad_cita_edicion',
        {
          p_cita_id: id,
          p_cliente_id: citaActual.cliente_id,
          p_terapeuta_id: citaActual.terapeuta_id,
          p_recurso_id: form.recurso_id || null,
          p_fecha: citaActual.fecha,
          p_hora_inicio: citaActual.hora_inicio,
          p_hora_fin: citaActual.hora_fin,
        }
      )

      if (validacionError) {
        throw new Error(`Error validando disponibilidad: ${validacionError.message}`)
      }

      const validacionParsed = validacion as ValidacionCita

      if (!validacionParsed?.disponible) {
        setErrorMsg(buildErrorFromValidacion(validacionParsed))
        setSaving(false)
        return
      }

      let auditorId = empleadoActualId || ''
      if (!auditorId) {
        auditorId = await resolveEmpleadoActualId()
        setEmpleadoActualId(auditorId)
      }

      const payload = {
        servicio_id: form.servicio_id,
        recurso_id: form.recurso_id || null,
        updated_by: auditorId || null,
      }

      const { error } = await supabase.from('citas').update(payload).eq('id', id)

      if (error) throw new Error(error.message || 'No se pudo actualizar la cita.')

      router.push('/admin/operaciones/agenda')
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err?.message || 'No se pudo actualizar la cita.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Agenda</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Editar cita
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Solo puedes cambiar servicio y recurso. El resto queda bloqueado.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            title="Ver cita"
            description="Ir al detalle de la cita."
            href={`/admin/operaciones/agenda/${id}`}
          />
          <ActionCard
            title="Volver a agenda"
            description="Regresar al listado general."
            href="/admin/operaciones/agenda"
          />
        </div>
      </div>

      <Section
        title="Datos bloqueados"
        description="Estos datos se muestran solo como referencia."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SummaryItem label="Cliente" value={resumen.cliente} />
          <SummaryItem label="Fisioterapeuta" value={resumen.terapeuta} />
          <SummaryItem label="Fecha" value={resumen.fecha} />
          <SummaryItem label="Hora inicio" value={resumen.horaInicio} />
          <SummaryItem label="Hora fin" value={resumen.horaFin} />
          <SummaryItem label="Estado" value={resumen.estado} />
          <SummaryItem label="Servicio actual" value={resumen.servicioActual} />
          <SummaryItem label="Recurso actual" value={resumen.recursoActual} />
          <SummaryItem label="Notas" value={resumen.notas} />
        </div>
      </Section>

      <Section
        title="Campos editables"
        description="Aquí solo puedes actualizar servicio y recurso."
      >
        {loadingData ? (
          <Card className="p-6">
            <p className="text-sm text-white/55">Cargando cita...</p>
          </Card>
        ) : (
          <div className="space-y-6">
            {errorMsg ? (
              <Card className="p-4">
                <p className="text-sm text-rose-400">{errorMsg}</p>
              </Card>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Servicio"
                helper={
                  servicioSeleccionado?.duracion_min
                    ? `Duración referencial: ${servicioSeleccionado.duracion_min} min. El horario no se modifica aquí.`
                    : 'Cambiar servicio no altera fecha ni horas en esta pantalla.'
                }
              >
                <select
                  value={form.servicio_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, servicio_id: e.target.value }))}
                  className={inputClassName}
                >
                  <option value="" className="bg-[#11131a] text-white">
                    Seleccionar servicio
                  </option>
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#11131a] text-white">
                      {s.nombre} {s.duracion_min ? `· ${s.duracion_min} min` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Recurso"
                helper={
                  recursoSeleccionado
                    ? `Capacidad: ${Number(recursoSeleccionado.capacidad || 1)} · Horario: ${formatHora(
                        recursoSeleccionado.hora_inicio
                      )} - ${formatHora(recursoSeleccionado.hora_fin)}`
                    : 'Sin recurso'
                }
              >
                <select
                  value={form.recurso_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, recurso_id: e.target.value }))}
                  className={inputClassName}
                >
                  <option value="" className="bg-[#11131a] text-white">
                    Sin recurso
                  </option>
                  {recursos.map((r) => (
                    <option key={r.id} value={r.id} className="bg-[#11131a] text-white">
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={guardarCambios}
                disabled={saving}
                className="
                  rounded-2xl border border-white/10 bg-white/[0.08]
                  px-5 py-3 text-sm font-semibold text-white transition
                  hover:bg-white/[0.12] disabled:opacity-60
                "
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>

              <button
                type="button"
                onClick={() => router.push('/admin/operaciones/agenda')}
                className="
                  rounded-2xl border border-white/10 bg-white/[0.03]
                  px-5 py-3 text-sm font-semibold text-white/80 transition
                  hover:bg-white/[0.06]
                "
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}