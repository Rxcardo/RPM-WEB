'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

type Cliente = {
  id: string
  nombre: string
}

type Terapeuta = {
  id: string
  nombre: string
}

type ServicioRaw = {
  id: string
  nombre: string
  estado?: string | null
  duracion_min?: number | null
  duracion?: number | null
  tiempo?: number | null
  tiempo_min?: number | null
  tiempo_minutos?: number | null
  minutos?: number | null
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

function sumarMinutos(hora: string, minutos: number) {
  if (!hora) return ''

  const [h, m] = hora.split(':').map(Number)
  const total = h * 60 + m + minutos
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, '0')
  const mm = (total % 60).toString().padStart(2, '0')

  return `${hh}:${mm}:00`
}

function getServicioDuracion(servicio: ServicioRaw) {
  const posibles = [
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

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

export default function NuevaCitaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clienteInicial = searchParams.get('cliente') || ''

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [recursos, setRecursos] = useState<Recurso[]>([])

  const [form, setForm] = useState({
    cliente_id: clienteInicial,
    terapeuta_id: '',
    servicio_id: '',
    recurso_id: '',
    fecha: new Date().toISOString().slice(0, 10),
    hora_inicio: '',
    hora_fin: '',
    estado: 'programada',
    notas: '',
  })

  useEffect(() => {
    void loadData()
  }, [])

  const servicioSeleccionado = useMemo(
    () => servicios.find((s) => s.id === form.servicio_id) || null,
    [servicios, form.servicio_id]
  )

  useEffect(() => {
    if (!form.hora_inicio || !servicioSeleccionado?.duracion_min) return

    setForm((prev) => ({
      ...prev,
      hora_fin: sumarMinutos(prev.hora_inicio, servicioSeleccionado.duracion_min || 0),
    }))
  }, [form.hora_inicio, servicioSeleccionado])

  async function loadData() {
    setLoadingData(true)
    setError('')

    try {
      const [clientesRes, terapeutasRes, serviciosRes, recursosRes] = await Promise.all([
        supabase
          .from('clientes')
          .select('id, nombre')
          .order('nombre', { ascending: true }),

        supabase
          .from('empleados')
          .select('id, nombre')
          .eq('rol', 'terapeuta')
          .eq('estado', 'activo')
          .order('nombre', { ascending: true }),

        supabase
          .from('servicios')
          .select('*')
          .eq('estado', 'activo')
          .order('nombre', { ascending: true }),

        supabase
          .from('recursos')
          .select('id, nombre, estado')
          .order('nombre', { ascending: true }),
      ])

      if (clientesRes.error) {
        throw new Error(`Clientes: ${clientesRes.error.message}`)
      }

      if (terapeutasRes.error) {
        throw new Error(`Terapeutas: ${terapeutasRes.error.message}`)
      }

      if (serviciosRes.error) {
        throw new Error(`Servicios: ${serviciosRes.error.message}`)
      }

      if (recursosRes.error) {
        throw new Error(`Recursos: ${recursosRes.error.message}`)
      }

      const clientesData = (clientesRes.data || []) as Cliente[]
      const terapeutasData = (terapeutasRes.data || []) as Terapeuta[]
      const serviciosRaw = (serviciosRes.data || []) as ServicioRaw[]
      const recursosData = ((recursosRes.data || []) as Recurso[]).filter(
        (r) => r.estado !== 'inactivo'
      )

      const serviciosData: Servicio[] = serviciosRaw
        .filter((s) => s.estado !== 'inactivo')
        .map((s) => ({
          id: s.id,
          nombre: s.nombre,
          estado: s.estado ?? null,
          duracion_min: getServicioDuracion(s),
        }))

      console.log('servicios raw:', serviciosRaw)
      console.log('servicios mapeados:', serviciosData)

      setClientes(clientesData)
      setTerapeutas(terapeutasData)
      setServicios(serviciosData)
      setRecursos(recursosData)
    } catch (err: any) {
      console.error('Error cargando formulario de cita:', err)
      setError(err?.message || 'No se pudo cargar el formulario.')
      setClientes([])
      setTerapeutas([])
      setServicios([])
      setRecursos([])
    } finally {
      setLoadingData(false)
    }
  }

  async function guardar() {
    if (!form.cliente_id || !form.terapeuta_id || !form.servicio_id || !form.fecha || !form.hora_inicio) {
      alert('Completa cliente, terapeuta, servicio, fecha y hora.')
      return
    }

    if (!form.hora_fin) {
      alert('No se pudo calcular la hora final.')
      return
    }

    setLoading(true)

    try {
      if (form.recurso_id) {
        const { data: conflictoRecurso, error: errorRecurso } = await supabase
          .from('citas')
          .select('id')
          .eq('recurso_id', form.recurso_id)
          .eq('fecha', form.fecha)
          .neq('estado', 'cancelada')
          .lt('hora_inicio', form.hora_fin)
          .gt('hora_fin', form.hora_inicio)
          .limit(1)

        if (errorRecurso) {
          throw new Error(`Error validando recurso: ${errorRecurso.message}`)
        }

        if (conflictoRecurso && conflictoRecurso.length > 0) {
          alert('Ese recurso ya está ocupado en ese horario.')
          setLoading(false)
          return
        }
      }

      const { data: conflictoTerapeuta, error: errorTerapeuta } = await supabase
        .from('citas')
        .select('id')
        .eq('terapeuta_id', form.terapeuta_id)
        .eq('fecha', form.fecha)
        .neq('estado', 'cancelada')
        .lt('hora_inicio', form.hora_fin)
        .gt('hora_fin', form.hora_inicio)
        .limit(1)

      if (errorTerapeuta) {
        throw new Error(`Error validando terapeuta: ${errorTerapeuta.message}`)
      }

      if (conflictoTerapeuta && conflictoTerapeuta.length > 0) {
        alert('Ese terapeuta ya tiene una cita en ese horario.')
        setLoading(false)
        return
      }

      const payload = {
        cliente_id: form.cliente_id,
        terapeuta_id: form.terapeuta_id,
        servicio_id: form.servicio_id,
        recurso_id: form.recurso_id || null,
        fecha: form.fecha,
        hora_inicio: form.hora_inicio.length === 5 ? `${form.hora_inicio}:00` : form.hora_inicio,
        hora_fin: form.hora_fin,
        estado: form.estado,
        notas: form.notas || null,
      }

      const { error } = await supabase.from('citas').insert(payload)

      if (error) {
        throw new Error(error.message || 'No se pudo crear la cita.')
      }

      router.push('/admin/operaciones/agenda')
    } catch (err: any) {
      console.error(err)
      alert(err?.message || 'No se pudo crear la cita.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Agenda</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Nueva cita
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Crear una cita y validar disponibilidad de terapeuta y recurso.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            title="Ver agenda"
            description="Volver al listado general de citas."
            href="/admin/operaciones/agenda"
          />
          <ActionCard
            title="Cancelar"
            description="Salir sin guardar cambios."
            href="/admin/operaciones/agenda"
          />
        </div>
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      <Section
        title="Formulario de cita"
        description="Selecciona cliente, terapeuta, servicio, horario, estado y notas."
      >
        {loadingData ? (
          <Card className="p-6">
            <p className="text-sm text-white/55">Cargando formulario...</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Cliente">
              <select
                value={form.cliente_id}
                onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                className={inputClassName}
              >
                <option value="" className="bg-[#11131a] text-white">
                  Seleccionar cliente
                </option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#11131a] text-white">
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Terapeuta">
              <select
                value={form.terapeuta_id}
                onChange={(e) => setForm({ ...form, terapeuta_id: e.target.value })}
                className={inputClassName}
              >
                <option value="" className="bg-[#11131a] text-white">
                  Seleccionar terapeuta
                </option>
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
                  ? 'No se encontraron servicios activos.'
                  : `${servicios.length} servicio(s) disponible(s).`
              }
            >
              <select
                value={form.servicio_id}
                onChange={(e) => setForm({ ...form, servicio_id: e.target.value })}
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

            <Field label="Recurso">
              <select
                value={form.recurso_id}
                onChange={(e) => setForm({ ...form, recurso_id: e.target.value })}
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

            <Field label="Fecha">
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className={inputClassName}
              />
            </Field>

            <Field label="Estado">
              <select
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
                className={inputClassName}
              >
                <option value="programada" className="bg-[#11131a] text-white">
                  Programada
                </option>
                <option value="confirmada" className="bg-[#11131a] text-white">
                  Confirmada
                </option>
                <option value="reprogramada" className="bg-[#11131a] text-white">
                  Reprogramada
                </option>
                <option value="completada" className="bg-[#11131a] text-white">
                  Completada
                </option>
                <option value="cancelada" className="bg-[#11131a] text-white">
                  Cancelada
                </option>
              </select>
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
                servicioSeleccionado?.duracion_min
                  ? `Se calcula en base a ${servicioSeleccionado.duracion_min} min.`
                  : 'Selecciona un servicio para calcular la duración.'
              }
            >
              <input
                type="time"
                value={form.hora_fin ? form.hora_fin.slice(0, 5) : ''}
                onChange={(e) => setForm({ ...form, hora_fin: `${e.target.value}:00` })}
                className={inputClassName}
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Notas">
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={4}
                  className={`${inputClassName} resize-none`}
                  placeholder="Notas opcionales..."
                />
              </Field>
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={guardar}
                disabled={loading || servicios.length === 0}
                className="
                  rounded-2xl border border-white/10 bg-white/[0.08]
                  px-5 py-3 text-sm font-semibold text-white transition
                  hover:bg-white/[0.12] disabled:opacity-60
                "
              >
                {loading ? 'Guardando...' : 'Guardar cita'}
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