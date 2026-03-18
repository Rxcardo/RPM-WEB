'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type Cliente = {
  id: string
  nombre: string
  estado: string
}

type Empleado = {
  id: string
  nombre: string
  rol: string
  estado: string
}

type Servicio = {
  id: string
  nombre: string
  categoria: string | null
  duracion_min: number
  precio: number
  estado: string
}

type CitaDB = {
  id: string
  cliente_id: string | null
  terapeuta_id: string | null
  servicio_id: string | null
  fecha: string | null
  hora_inicio: string | null
  hora_fin: string | null
  estado: 'programada' | 'confirmada' | 'cancelada' | 'completada' | 'reprogramada'
  notas: string | null
}

type FormState = {
  cliente_id: string
  terapeuta_id: string
  servicio_id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: 'programada' | 'confirmada' | 'cancelada' | 'completada' | 'reprogramada'
  notas: string
}

const INITIAL_FORM: FormState = {
  cliente_id: '',
  terapeuta_id: '',
  servicio_id: '',
  fecha: '',
  hora_inicio: '',
  hora_fin: '',
  estado: 'programada',
  notas: '',
}

function normalizeTime(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 5)
}

function addMinutesToTime(time: string, minutesToAdd: number) {
  if (!time) return ''

  const [hours, minutes] = time.split(':').map(Number)
  const totalMinutes = hours * 60 + minutes + minutesToAdd

  const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60)
  const newHours = Math.floor(normalized / 60)
  const newMinutes = normalized % 60

  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`
}

function toDbTime(time: string) {
  if (!time) return null
  return `${time}:00`
}

export default function EditarCitaPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [terapeutas, setTerapeutas] = useState<Empleado[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bootError, setBootError] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!id) return
    void fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function fetchAll() {
    setLoading(true)
    setBootError('')
    setErrorMsg('')

    try {
      const [
        citaRes,
        clientesRes,
        terapeutasRes,
        serviciosRes,
      ] = await Promise.all([
        supabase
          .from('citas')
          .select(`
            id,
            cliente_id,
            terapeuta_id,
            servicio_id,
            fecha,
            hora_inicio,
            hora_fin,
            estado,
            notas
          `)
          .eq('id', id)
          .single(),
        supabase
          .from('clientes')
          .select('id, nombre, estado')
          .eq('estado', 'activo')
          .order('nombre', { ascending: true }),
        supabase
          .from('empleados')
          .select('id, nombre, rol, estado')
          .eq('rol', 'terapeuta')
          .eq('estado', 'activo')
          .order('nombre', { ascending: true }),
        supabase
          .from('servicios')
          .select('id, nombre, categoria, duracion_min, precio, estado')
          .eq('estado', 'activo')
          .order('nombre', { ascending: true }),
      ])

      if (citaRes.error || !citaRes.data) {
        throw new Error(citaRes.error?.message || 'No se pudo cargar la cita.')
      }

      setClientes((clientesRes.data || []) as Cliente[])
      setTerapeutas((terapeutasRes.data || []) as Empleado[])
      setServicios((serviciosRes.data || []) as Servicio[])

      const cita = citaRes.data as CitaDB

      setForm({
        cliente_id: cita.cliente_id || '',
        terapeuta_id: cita.terapeuta_id || '',
        servicio_id: cita.servicio_id || '',
        fecha: cita.fecha || '',
        hora_inicio: normalizeTime(cita.hora_inicio),
        hora_fin: normalizeTime(cita.hora_fin),
        estado: cita.estado || 'programada',
        notas: cita.notas || '',
      })
    } catch (err: any) {
      setBootError(err?.message || 'No se pudo cargar la cita.')
    } finally {
      setLoading(false)
    }
  }

  const selectedServicio = useMemo(() => {
    return servicios.find((s) => s.id === form.servicio_id) || null
  }, [servicios, form.servicio_id])

  useEffect(() => {
    if (!selectedServicio || !form.hora_inicio) return

    const autoHoraFin = addMinutesToTime(form.hora_inicio, selectedServicio.duracion_min)

    setForm((prev) => {
      if (!prev.hora_fin) {
        return { ...prev, hora_fin: autoHoraFin }
      }

      const previousService = servicios.find((s) => s.id === prev.servicio_id)
      const oldAuto = previousService
        ? addMinutesToTime(prev.hora_inicio, previousService.duracion_min)
        : ''

      if (prev.hora_fin === oldAuto || prev.hora_fin === '') {
        return { ...prev, hora_fin: autoHoraFin }
      }

      return prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServicio?.id, form.hora_inicio])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target

    setForm((prev) => {
      const next = {
        ...prev,
        [name]: value,
      }

      if (name === 'servicio_id') {
        const servicio = servicios.find((s) => s.id === value)
        if (servicio && next.hora_inicio) {
          next.hora_fin = addMinutesToTime(next.hora_inicio, servicio.duracion_min)
        }
      }

      if (name === 'hora_inicio') {
        const servicio = servicios.find((s) => s.id === next.servicio_id)
        if (servicio) {
          next.hora_fin = addMinutesToTime(value, servicio.duracion_min)
        }
      }

      return next
    })
  }

  function validateForm() {
    if (!form.cliente_id) return 'Debes seleccionar un cliente.'
    if (!form.terapeuta_id) return 'Debes seleccionar un terapeuta.'
    if (!form.servicio_id) return 'Debes seleccionar un servicio.'
    if (!form.fecha) return 'Debes seleccionar una fecha.'
    if (!form.hora_inicio) return 'Debes indicar la hora de inicio.'
    if (!form.hora_fin) return 'Debes indicar la hora de fin.'
    if (form.hora_fin <= form.hora_inicio) return 'La hora final debe ser mayor que la inicial.'
    return ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')

    const validationError = validateForm()
    if (validationError) {
      setErrorMsg(validationError)
      return
    }

    setSaving(true)

    try {
      const payload = {
        cliente_id: form.cliente_id,
        terapeuta_id: form.terapeuta_id,
        servicio_id: form.servicio_id,
        fecha: form.fecha,
        hora_inicio: toDbTime(form.hora_inicio),
        hora_fin: toDbTime(form.hora_fin),
        estado: form.estado,
        notas: form.notas.trim() || null,
      }

      const { error } = await supabase
        .from('citas')
        .update(payload)
        .eq('id', id)

      if (error) {
        throw new Error(error.message || 'No se pudo actualizar la cita.')
      }

      router.push(`/admin/operaciones/agenda/${id}`)
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo actualizar la cita.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">

        <main className="mx-auto max-w-5xl px-4 py-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">Editar cita</h1>
              <p className="mt-1 text-neutral-500">Cargando información...</p>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
              <p className="text-sm text-neutral-500">Cargando formulario...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (bootError) {
    return (
      <div className="min-h-screen bg-slate-50">

        <main className="mx-auto max-w-5xl px-4 py-6">
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">Editar cita</h1>
              <p className="mt-1 text-neutral-500">No fue posible abrir el registro.</p>
            </div>

            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
              <p className="text-sm font-medium text-red-700">{bootError}</p>

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => router.push('/admin/operaciones/agenda')}
                  className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  Volver a agenda
                </button>

                <button
                  onClick={() => void fetchAll()}
                  className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                >
                  Reintentar
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">


      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">Editar cita</h1>
              <p className="mt-1 text-neutral-500">
                Ajusta cliente, terapeuta, servicio, horario y estado
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/admin/operaciones/agenda/${id}`}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Volver
              </Link>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-neutral-800">
                  Cliente
                </label>
                <select
                  name="cliente_id"
                  value={form.cliente_id}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
                >
                  <option value="">Seleccionar cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-800">
                  Terapeuta
                </label>
                <select
                  name="terapeuta_id"
                  value={form.terapeuta_id}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
                >
                  <option value="">Seleccionar terapeuta</option>
                  {terapeutas.map((terapeuta) => (
                    <option key={terapeuta.id} value={terapeuta.id}>
                      {terapeuta.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-800">
                  Servicio
                </label>
                <select
                  name="servicio_id"
                  value={form.servicio_id}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
                >
                  <option value="">Seleccionar servicio</option>
                  {servicios.map((servicio) => (
                    <option key={servicio.id} value={servicio.id}>
                      {servicio.nombre} · {servicio.duracion_min} min
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-800">
                  Fecha
                </label>
                <input
                  type="date"
                  name="fecha"
                  value={form.fecha}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-800">
                  Hora inicio
                </label>
                <input
                  type="time"
                  name="hora_inicio"
                  value={form.hora_inicio}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-800">
                  Hora fin
                </label>
                <input
                  type="time"
                  name="hora_fin"
                  value={form.hora_fin}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-neutral-800">
                  Estado
                </label>
                <select
                  name="estado"
                  value={form.estado}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
                >
                  <option value="programada">Programada</option>
                  <option value="confirmada">Confirmada</option>
                  <option value="cancelada">Cancelada</option>
                  <option value="completada">Completada</option>
                  <option value="reprogramada">Reprogramada</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-neutral-800">
                  Notas
                </label>
                <textarea
                  name="notas"
                  value={form.notas}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Notas de la cita"
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
                />
              </div>
            </div>

            {selectedServicio ? (
              <div className="mt-5 rounded-2xl bg-neutral-50 p-4">
                <p className="text-sm font-semibold text-neutral-900">{selectedServicio.nombre}</p>

                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">Categoría</p>
                    <p className="mt-1 text-sm text-neutral-800">{selectedServicio.categoria || '—'}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">Duración</p>
                    <p className="mt-1 text-sm text-neutral-800">{selectedServicio.duracion_min} min</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">Precio</p>
                    <p className="mt-1 text-sm text-neutral-800">
                      {new Intl.NumberFormat('es-ES', {
                        style: 'currency',
                        currency: 'USD',
                        maximumFractionDigits: 2,
                      }).format(Number(selectedServicio.precio || 0))}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {errorMsg ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMsg}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Guardando cambios...' : 'Guardar cambios'}
              </button>

              <button
                type="button"
                onClick={() => router.push(`/admin/operaciones/agenda/${id}`)}
                disabled={saving}
                className="rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}