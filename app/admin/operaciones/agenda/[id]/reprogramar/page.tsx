'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

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
  servicios: { nombre: string } | null
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

export default function ReprogramarCitaPage() {
  const router = useRouter()
  const params = useParams()
  const rawId = params?.id
  const id = Array.isArray(rawId) ? rawId[0] : (rawId as string)

  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [empleadoActualId, setEmpleadoActualId] = useState('')

  const [citaActual, setCitaActual] = useState<CitaDetalle | null>(null)

  const [resumen, setResumen] = useState({
    cliente: '',
    terapeuta: '',
    servicio: '',
    recurso: '',
    fechaOriginal: '',
    horaInicioOriginal: '',
    horaFinOriginal: '',
    estadoOriginal: '',
    notas: '',
  })

  const [form, setForm] = useState({
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
  })

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
      const { data, error } = await supabase
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
          servicios:servicio_id ( nombre ),
          recursos:recurso_id ( id, nombre )
        `)
        .eq('id', id)
        .limit(1)
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!data) throw new Error('No se encontró la cita.')

      const cita = data as unknown as CitaDetalle

      setCitaActual(cita)

      setResumen({
        cliente: cita.clientes?.nombre || 'Sin cliente',
        terapeuta: cita.empleados?.nombre || 'Sin terapeuta',
        servicio: cita.servicios?.nombre || 'Sin servicio',
        recurso: cita.recursos?.nombre || 'Sin recurso',
        fechaOriginal: cita.fecha || '—',
        horaInicioOriginal: cita.hora_inicio ? cita.hora_inicio.slice(0, 5) : '—',
        horaFinOriginal: cita.hora_fin ? cita.hora_fin.slice(0, 5) : '—',
        estadoOriginal: cita.estado || '—',
        notas: cita.notas || 'Sin notas',
      })

      setForm({
        fecha: cita.fecha || '',
        hora_inicio: cita.hora_inicio ? cita.hora_inicio.slice(0, 5) : '',
        hora_fin: cita.hora_fin ? cita.hora_fin.slice(0, 5) : '',
      })
    } catch (err: any) {
      console.error('Error al cargar reprogramación:', err)
      setErrorMsg(err?.message || 'No se pudo cargar la cita.')
    } finally {
      setLoadingData(false)
    }
  }

  async function guardarReprogramacion() {
    setErrorMsg('')

    if (!form.fecha || !form.hora_inicio || !form.hora_fin) {
      setErrorMsg('Completa fecha, hora inicio y hora fin.')
      return
    }

    if (form.hora_fin <= form.hora_inicio) {
      setErrorMsg('La hora final debe ser mayor que la hora inicial.')
      return
    }

    if (!citaActual?.cliente_id || !citaActual?.terapeuta_id) {
      setErrorMsg('La cita no tiene cliente o fisioterapeuta válidos.')
      return
    }

    setSaving(true)

    try {
      const horaInicioNormalizada =
        form.hora_inicio.length === 5 ? `${form.hora_inicio}:00` : form.hora_inicio

      const horaFinNormalizada =
        form.hora_fin.length === 5 ? `${form.hora_fin}:00` : form.hora_fin

      const { data: validacion, error: validacionError } = await supabase.rpc(
        'validar_disponibilidad_cita_edicion',
        {
          p_cita_id: id,
          p_cliente_id: citaActual.cliente_id,
          p_terapeuta_id: citaActual.terapeuta_id,
          p_recurso_id: citaActual.recurso_id || null,
          p_fecha: form.fecha,
          p_hora_inicio: horaInicioNormalizada,
          p_hora_fin: horaFinNormalizada,
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
        fecha: form.fecha,
        hora_inicio: horaInicioNormalizada,
        hora_fin: horaFinNormalizada,
        estado: 'reprogramada',
        updated_by: auditorId || null,
      }

      const { error } = await supabase.from('citas').update(payload).eq('id', id)

      if (error) throw new Error(error.message || 'No se pudo reprogramar la cita.')

      router.push('/admin/operaciones/agenda')
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err?.message || 'No se pudo reprogramar la cita.')
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
            Reprogramar cita
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Aquí solo puedes cambiar fecha y horario. El resto queda bloqueado.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            title="Ver cita"
            description="Ir al detalle actual de la cita."
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
          <SummaryItem label="Servicio" value={resumen.servicio} />
          <SummaryItem label="Recurso" value={resumen.recurso} />
          <SummaryItem label="Fecha original" value={resumen.fechaOriginal} />
          <SummaryItem label="Hora inicio original" value={resumen.horaInicioOriginal} />
          <SummaryItem label="Hora fin original" value={resumen.horaFinOriginal} />
          <SummaryItem label="Estado original" value={resumen.estadoOriginal} />
          <SummaryItem label="Notas" value={resumen.notas} />
        </div>
      </Section>

      <Section
        title="Nueva programación"
        description="Actualiza solo fecha y horario."
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

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Fecha">
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm((prev) => ({ ...prev, fecha: e.target.value }))}
                  className={inputClassName}
                />
              </Field>

              <Field label="Hora inicio">
                <input
                  type="time"
                  value={form.hora_inicio}
                  onChange={(e) => setForm((prev) => ({ ...prev, hora_inicio: e.target.value }))}
                  className={inputClassName}
                />
              </Field>

              <Field label="Hora fin">
                <input
                  type="time"
                  value={form.hora_fin}
                  onChange={(e) => setForm((prev) => ({ ...prev, hora_fin: e.target.value }))}
                  className={inputClassName}
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={guardarReprogramacion}
                disabled={saving}
                className="
                  rounded-2xl border border-white/10 bg-white/[0.08]
                  px-5 py-3 text-sm font-semibold text-white transition
                  hover:bg-white/[0.12] disabled:opacity-60
                "
              >
                {saving ? 'Guardando...' : 'Guardar reprogramación'}
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