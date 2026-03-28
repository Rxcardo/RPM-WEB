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
  const [errorMsg, setErrorMsg] = useState('')

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

  const [bloqueados, setBloqueados] = useState({
    terapeuta_id: '',
    servicio_id: '',
    recurso_id: '',
  })

  const [form, setForm] = useState({
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
  })

  useEffect(() => {
    if (!id) return
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadData() {
    setLoadingData(true)
    setErrorMsg('')

    try {
      const { data, error } = await supabase
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
          servicios:servicio_id ( nombre ),
          recursos:recurso_id ( id, nombre )
        `)
        .eq('id', id)
        .limit(1)
        .maybeSingle()

      if (error) throw new Error(error.message)
      if (!data) throw new Error('No se encontró la cita.')

      const cita = data as unknown as CitaDetalle

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

      setBloqueados({
        terapeuta_id: cita.terapeuta_id || '',
        servicio_id: cita.servicio_id || '',
        recurso_id: cita.recurso_id || '',
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

    setSaving(true)

    try {
      const horaInicioNormalizada =
        form.hora_inicio.length === 5 ? `${form.hora_inicio}:00` : form.hora_inicio

      const horaFinNormalizada =
        form.hora_fin.length === 5 ? `${form.hora_fin}:00` : form.hora_fin

      if (bloqueados.recurso_id) {
        const { data: conflictoRecurso, error: errorRecurso } = await supabase
          .from('citas')
          .select('id')
          .eq('recurso_id', bloqueados.recurso_id)
          .eq('fecha', form.fecha)
          .neq('estado', 'cancelada')
          .neq('id', id)
          .lt('hora_inicio', horaFinNormalizada)
          .gt('hora_fin', horaInicioNormalizada)
          .limit(1)

        if (errorRecurso) {
          throw new Error(`Error validando recurso: ${errorRecurso.message}`)
        }

        if (conflictoRecurso && conflictoRecurso.length > 0) {
          setErrorMsg('Ese recurso ya está ocupado en ese horario.')
          setSaving(false)
          return
        }
      }

      if (bloqueados.terapeuta_id) {
        const { data: conflictoTerapeuta, error: errorTerapeuta } = await supabase
          .from('citas')
          .select('id')
          .eq('terapeuta_id', bloqueados.terapeuta_id)
          .eq('fecha', form.fecha)
          .neq('estado', 'cancelada')
          .neq('id', id)
          .lt('hora_inicio', horaFinNormalizada)
          .gt('hora_fin', horaInicioNormalizada)
          .limit(1)

        if (errorTerapeuta) {
          throw new Error(`Error validando terapeuta: ${errorTerapeuta.message}`)
        }

        if (conflictoTerapeuta && conflictoTerapeuta.length > 0) {
          setErrorMsg('Ese terapeuta ya tiene una cita en ese horario.')
          setSaving(false)
          return
        }
      }

      const payload = {
        fecha: form.fecha,
        hora_inicio: horaInicioNormalizada,
        hora_fin: horaFinNormalizada,
        estado: 'reprogramada',
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
          <SummaryItem label="Terapeuta" value={resumen.terapeuta} />
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