'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type Cliente = {
  id: string
  nombre: string
}

type Terapeuta = {
  id: string
  nombre: string
}

type Servicio = {
  id: string
  nombre: string
  duracion_min: number | null
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

export default function NuevaCitaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clienteInicial = searchParams.get('cliente') || ''

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

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
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const servicioSeleccionado = useMemo(
    () => servicios.find((s) => s.id === form.servicio_id) || null,
    [servicios, form.servicio_id]
  )

  useEffect(() => {
    if (form.hora_inicio && servicioSeleccionado?.duracion_min) {
      setForm((prev) => ({
        ...prev,
        hora_fin: sumarMinutos(prev.hora_inicio, servicioSeleccionado.duracion_min || 0),
      }))
    }
  }, [form.hora_inicio, servicioSeleccionado])

  async function loadData() {
    setLoadingData(true)

    const [clientesRes, terapeutasRes, serviciosRes, recursosRes] = await Promise.all([
      supabase.from('clientes').select('id, nombre').order('nombre', { ascending: true }),
      supabase
        .from('empleados')
        .select('id, nombre')
        .eq('rol', 'terapeuta')
        .eq('estado', 'activo')
        .order('nombre', { ascending: true }),
      supabase.from('servicios').select('id, nombre, duracion_min').order('nombre', { ascending: true }),
      supabase.from('recursos').select('id, nombre, estado').order('nombre', { ascending: true }),
    ])

    setClientes((clientesRes.data || []) as Cliente[])
    setTerapeutas((terapeutasRes.data || []) as Terapeuta[])
    setServicios((serviciosRes.data || []) as Servicio[])
    setRecursos(((recursosRes.data || []) as Recurso[]).filter((r) => r.estado !== 'inactivo'))

    setLoadingData(false)
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
        console.error(errorRecurso)
        alert('Error validando recurso.')
        setLoading(false)
        return
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
      console.error(errorTerapeuta)
      alert('Error validando terapeuta.')
      setLoading(false)
      return
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
      console.error(error)
      alert('No se pudo crear la cita.')
      setLoading(false)
      return
    }

    router.push('/admin/operaciones/agenda')
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Nueva cita</h1>
        <p className="mt-1 text-sm text-slate-600">
          Crear una cita y validar disponibilidad de terapeuta y recurso.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        {loadingData ? (
          <div className="text-sm text-slate-500">Cargando formulario...</div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">Cliente</label>
              <select
                value={form.cliente_id}
                onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              >
                <option value="">Seleccionar cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">Terapeuta</label>
              <select
                value={form.terapeuta_id}
                onChange={(e) => setForm({ ...form, terapeuta_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              >
                <option value="">Seleccionar terapeuta</option>
                {terapeutas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">Servicio</label>
              <select
                value={form.servicio_id}
                onChange={(e) => setForm({ ...form, servicio_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              >
                <option value="">Seleccionar servicio</option>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">Recurso</label>
              <select
                value={form.recurso_id}
                onChange={(e) => setForm({ ...form, recurso_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              >
                <option value="">Sin recurso</option>
                {recursos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">Estado</label>
              <select
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              >
                <option value="programada">Programada</option>
                <option value="confirmada">Confirmada</option>
                <option value="reprogramada">Reprogramada</option>
                <option value="completada">Completada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">Hora inicio</label>
              <input
                type="time"
                value={form.hora_inicio}
                onChange={(e) => setForm({ ...form, hora_inicio: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">Hora fin</label>
              <input
                type="time"
                value={form.hora_fin ? form.hora_fin.slice(0, 5) : ''}
                onChange={(e) => setForm({ ...form, hora_fin: `${e.target.value}:00` })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              />
              <p className="mt-1 text-xs text-slate-500">
                {servicioSeleccionado?.duracion_min
                  ? `Se calcula en base a ${servicioSeleccionado.duracion_min} min.`
                  : 'Selecciona un servicio para calcular la duración.'}
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-800">Notas</label>
              <textarea
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                rows={4}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                placeholder="Notas opcionales..."
              />
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={guardar}
                disabled={loading}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? 'Guardando...' : 'Guardar cita'}
              </button>

              <button
                type="button"
                onClick={() => router.push('/admin/operaciones/agenda')}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}