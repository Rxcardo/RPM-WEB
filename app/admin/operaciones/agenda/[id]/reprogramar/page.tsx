'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

type Terapeuta = {
  id: string
  nombre: string
}

type ServicioRaw = {
  id: string
  nombre: string
  estado?: string | null
  duracion_minutos?: number | null // ✅ nombre correcto en BD
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
}

type CitaDetalle = {
  id: string
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

function getServicioDuracion(servicio: ServicioRaw | null): number | null {
  if (!servicio) return null
  const posibles = [
    servicio.duracion_minutos, // ✅ primero el nombre real
    servicio.duracion_min,
    servicio.duracion,
    servicio.tiempo,
    servicio.tiempo_min,
    servicio.tiempo_minutos,
    servicio.minutos,
  ]
  for (const valor of posibles) {
    const n = Number(valor)
    if (!Number.isNaN(n) && n > 0) return n
  }
  return null
}

function sumarMinutos(hora: string, minutos: number) {
  if (!hora) return ''
  const [h, m] = hora.split(':').map(Number)
  const total = h * 60 + m + minutos
  const hh = Math.floor(total / 60).toString().padStart(2, '0')
  const mm = (total % 60).toString().padStart(2, '0')
  return `${hh}:${mm}:00`
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
  const [autoHoraFin, setAutoHoraFin] = useState(false) // ✅ false por defecto
  const [errorMsg, setErrorMsg] = useState('')

  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [recursos, setRecursos] = useState<Recurso[]>([])

  const [resumen, setResumen] = useState({
    cliente: '',
    terapeuta: '',
    servicio: '',
    recurso: '',
    fechaOriginal: '',
    horaOriginal: '',
  })

  const [form, setForm] = useState({
    terapeuta_id: '',
    servicio_id: '',
    recurso_id: '',
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
    estado: 'reprogramada',
    notas: '',
  })

  const servicioSeleccionado = useMemo(
    () => servicios.find((s) => s.id === form.servicio_id) || null,
    [servicios, form.servicio_id]
  )

  useEffect(() => {
    if (!id) return
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!autoHoraFin || !form.hora_inicio || !servicioSeleccionado?.duracion_min) return
    setForm((prev) => ({
      ...prev,
      hora_fin: sumarMinutos(prev.hora_inicio, servicioSeleccionado.duracion_min || 0),
    }))
  }, [form.hora_inicio, servicioSeleccionado, autoHoraFin])

  async function loadData() {
    setLoadingData(true)
    setErrorMsg('')

    try {
      const [terapeutasRes, serviciosRes, recursosRes, citaRes] = await Promise.all([
        supabase
          .from('empleados')
          .select('id, nombre')
          .eq('rol', 'terapeuta')
          .eq('estado', 'activo')
          .order('nombre', { ascending: true }),

        // ✅ Sin filtro .eq para evitar que NULL o mayúsculas rompan la carga
        supabase
          .from('servicios')
          .select('id, nombre, estado, duracion_minutos')
          .order('nombre', { ascending: true }),

        supabase
          .from('recursos')
          .select('id, nombre, estado')
          .order('nombre', { ascending: true }),

        supabase
          .from('citas')
          .select(`
            id,
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

      if (terapeutasRes.error) throw new Error(terapeutasRes.error.message)
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

      setTerapeutas((terapeutasRes.data || []) as Terapeuta[])
      setServicios(serviciosData)
      setRecursos(recursosData)

      setResumen({
        cliente: cita.clientes?.nombre || 'Sin cliente',
        terapeuta: cita.empleados?.nombre || 'Sin terapeuta',
        servicio: cita.servicios?.nombre || 'Sin servicio',
        recurso: cita.recursos?.nombre || 'Sin recurso',
        fechaOriginal: cita.fecha || '—',
        horaOriginal: cita.hora_inicio ? cita.hora_inicio.slice(0, 5) : '—',
      })

      setForm({
        terapeuta_id: cita.terapeuta_id || '',
        servicio_id: cita.servicio_id || '',
        recurso_id: cita.recurso_id || '',
        fecha: cita.fecha || '',
        hora_inicio: cita.hora_inicio ? cita.hora_inicio.slice(0, 5) : '',
        hora_fin: cita.hora_fin ? cita.hora_fin.slice(0, 8) : '',
        estado: 'reprogramada',
        notas: cita.notas || '',
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

    if (!form.terapeuta_id || !form.servicio_id || !form.fecha || !form.hora_inicio) {
      setErrorMsg('Completa terapeuta, servicio, fecha y hora.')
      return
    }

    if (!form.hora_fin) {
      setErrorMsg('La hora final es obligatoria.')
      return
    }

    setSaving(true)

    try {
      const horaInicioNormalizada =
        form.hora_inicio.length === 5 ? `${form.hora_inicio}:00` : form.hora_inicio

      if (form.recurso_id) {
        const { data: conflictoRecurso, error: errorRecurso } = await supabase
          .from('citas')
          .select('id')
          .eq('recurso_id', form.recurso_id)
          .eq('fecha', form.fecha)
          .neq('estado', 'cancelada')
          .neq('id', id)
          .lt('hora_inicio', form.hora_fin)
          .gt('hora_fin', horaInicioNormalizada)
          .limit(1)

        if (errorRecurso) throw new Error(`Error validando recurso: ${errorRecurso.message}`)

        if (conflictoRecurso && conflictoRecurso.length > 0) {
          setErrorMsg('Ese recurso ya está ocupado en ese horario.')
          setSaving(false)
          return
        }
      }

      const { data: conflictoTerapeuta, error: errorTerapeuta } = await supabase
        .from('citas')
        .select('id')
        .eq('terapeuta_id', form.terapeuta_id)
        .eq('fecha', form.fecha)
        .neq('estado', 'cancelada')
        .neq('id', id)
        .lt('hora_inicio', form.hora_fin)
        .gt('hora_fin', horaInicioNormalizada)
        .limit(1)

      if (errorTerapeuta) throw new Error(`Error validando terapeuta: ${errorTerapeuta.message}`)

      if (conflictoTerapeuta && conflictoTerapeuta.length > 0) {
        setErrorMsg('Ese terapeuta ya tiene una cita en ese horario.')
        setSaving(false)
        return
      }

      const payload = {
        terapeuta_id: form.terapeuta_id,
        servicio_id: form.servicio_id,
        recurso_id: form.recurso_id || null,
        fecha: form.fecha,
        hora_inicio: horaInicioNormalizada,
        hora_fin: form.hora_fin.length === 5 ? `${form.hora_fin}:00` : form.hora_fin,
        estado: form.estado,
        notas: form.notas || null,
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
            Cambia fecha, hora, terapeuta o recurso con validación de disponibilidad.
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
        title="Resumen actual"
        description="Datos originales antes de reprogramar."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SummaryItem label="Cliente" value={resumen.cliente} />
          <SummaryItem label="Terapeuta actual" value={resumen.terapeuta} />
          <SummaryItem label="Servicio actual" value={resumen.servicio} />
          <SummaryItem label="Recurso actual" value={resumen.recurso} />
          <SummaryItem label="Fecha original" value={resumen.fechaOriginal} />
          <SummaryItem label="Hora original" value={resumen.horaOriginal} />
        </div>
      </Section>

      <Section
        title="Nueva programación"
        description="Actualiza terapeuta, servicio, recurso, fecha y horario."
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
              <Field label="Terapeuta">
                <select
                  value={form.terapeuta_id}
                  onChange={(e) => setForm({ ...form, terapeuta_id: e.target.value })}
                  className={inputClassName}
                >
                  <option value="" className="bg-[#11131a] text-white">Seleccionar terapeuta</option>
                  {terapeutas.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#11131a] text-white">
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Servicio"
                helper={
                  servicios.length === 0
                    ? 'No se encontraron servicios.'
                    : `${servicios.length} servicio(s) disponible(s).`
                }
              >
                <select
                  value={form.servicio_id}
                  onChange={(e) => {
                    setAutoHoraFin(true) // ✅ activa auto solo cuando el usuario cambia servicio
                    setForm({ ...form, servicio_id: e.target.value })
                  }}
                  className={inputClassName}
                >
                  <option value="" className="bg-[#11131a] text-white">Seleccionar servicio</option>
                  {servicios.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#11131a] text-white">
                      {s.nombre} {s.duracion_min ? `· ${s.duracion_min} min` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Recurso">
                <select
                  value={form.recurso_id}
                  onChange={(e) => setForm({ ...form, recurso_id: e.target.value })}
                  className={inputClassName}
                >
                  <option value="" className="bg-[#11131a] text-white">Sin recurso</option>
                  {recursos.map((r) => (
                    <option key={r.id} value={r.id} className="bg-[#11131a] text-white">
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Fecha">
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  className={inputClassName}
                />
              </Field>

              <Field label="Hora inicio">
                <input
                  type="time"
                  value={form.hora_inicio}
                  onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
                  className={inputClassName}
                />
              </Field>

              <Field
                label="Hora fin"
                helper={
                  autoHoraFin && servicioSeleccionado?.duracion_min
                    ? `Calculado automáticamente: ${servicioSeleccionado.duracion_min} min.`
                    : 'Puedes editarla manualmente o cambiar el servicio para recalcular.'
                }
              >
                <div className="mb-2 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setAutoHoraFin((prev) => !prev)}
                    className="text-xs font-medium text-white/45 transition hover:text-white/75"
                  >
                    {autoHoraFin ? '🔄 Auto (click para manual)' : '✏️ Manual (click para auto)'}
                  </button>
                </div>
                <input
                  type="time"
                  value={form.hora_fin ? form.hora_fin.slice(0, 5) : ''}
                  onChange={(e) => {
                    setAutoHoraFin(false)
                    setForm({ ...form, hora_fin: `${e.target.value}:00` })
                  }}
                  className={inputClassName}
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Notas / Motivo de reprogramación">
                  <textarea
                    value={form.notas}
                    onChange={(e) => setForm({ ...form, notas: e.target.value })}
                    rows={4}
                    className={`${inputClassName} resize-none`}
                    placeholder="Motivo o nota de reprogramación..."
                  />
                </Field>
              </div>

              <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
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
          </div>
        )}
      </Section>
    </div>
  )
}
