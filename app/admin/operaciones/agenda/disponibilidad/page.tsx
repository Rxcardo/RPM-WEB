'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type Empleado = {
  id: string
  nombre: string
}

type Cita = {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: 'programada' | 'confirmada' | 'cancelada' | 'completada' | 'reprogramada'
  clientes: {
    id: string
    nombre: string
  } | null
  servicios: {
    id: string
    nombre: string
  } | null
  empleados: {
    id: string
    nombre: string
  } | null
}

type Slot = {
  label: string
  start: string
  end: string
}

function getTodayLocal() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatHour(value: string) {
  return value.slice(0, 5)
}

function timeToMinutes(value: string) {
  const [h, m] = value.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function buildSlots(startHour = 7, endHour = 20, stepMinutes = 30): Slot[] {
  const slots: Slot[] = []

  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += stepMinutes) {
      const start = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
      const endMinutes = hour * 60 + minute + stepMinutes
      const endHourValue = Math.floor(endMinutes / 60)
      const endMinuteValue = endMinutes % 60
      const end = `${String(endHourValue).padStart(2, '0')}:${String(endMinuteValue).padStart(2, '0')}`

      slots.push({
        label: `${start} - ${end}`,
        start,
        end,
      })
    }
  }

  return slots
}

function overlaps(slotStart: string, slotEnd: string, citaStart: string, citaEnd: string) {
  const aStart = timeToMinutes(slotStart)
  const aEnd = timeToMinutes(slotEnd)
  const bStart = timeToMinutes(citaStart)
  const bEnd = timeToMinutes(citaEnd)

  return aStart < bEnd && aEnd > bStart
}

function getHeatClass(count: number) {
  if (count >= 4) return 'bg-red-100 text-red-700 border-red-200'
  if (count >= 3) return 'bg-orange-100 text-orange-700 border-orange-200'
  if (count >= 2) return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  if (count >= 1) return 'bg-blue-100 text-blue-700 border-blue-200'
  return 'bg-green-100 text-green-700 border-green-200'
}

function getSlotStateClass(isBusy: boolean) {
  return isBusy
    ? 'border-red-200 bg-red-50 text-red-700'
    : 'border-green-200 bg-green-50 text-green-700'
}

export default function AgendaDisponibilidadPage() {
  const [fecha, setFecha] = useState(getTodayLocal())
  const [terapeutas, setTerapeutas] = useState<Empleado[]>([])
  const [terapeutaId, setTerapeutaId] = useState('')
  const [citas, setCitas] = useState<Cita[]>([])
  const [loading, setLoading] = useState(true)

  const slots = useMemo(() => buildSlots(7, 20, 30), [])

  const fetchData = async () => {
    setLoading(true)

    const [empleadosRes, citasRes] = await Promise.all([
      supabase
        .from('empleados')
        .select('id, nombre')
        .eq('rol', 'terapeuta')
        .eq('estado', 'activo')
        .order('nombre', { ascending: true }),

      supabase
        .from('citas')
        .select(`
          id,
          fecha,
          hora_inicio,
          hora_fin,
          estado,
          clientes:cliente_id (
            id,
            nombre
          ),
          servicios:servicio_id (
            id,
            nombre
          ),
          empleados:terapeuta_id (
            id,
            nombre
          )
        `)
        .eq('fecha', fecha)
        .neq('estado', 'cancelada')
        .order('hora_inicio', { ascending: true }),
    ])

    if (empleadosRes.error) {
      console.error('Error cargando terapeutas:', empleadosRes.error.message)
      setTerapeutas([])
    } else {
      setTerapeutas((empleadosRes.data as Empleado[]) || [])
    }

    if (citasRes.error) {
      console.error('Error cargando disponibilidad:', citasRes.error.message)
      setCitas([])
    } else {
      setCitas((citasRes.data as Cita[]) || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [fecha])

  const citasDelTerapeuta = useMemo(() => {
    if (!terapeutaId) return []
    return citas.filter((cita) => cita.empleados?.id === terapeutaId)
  }, [citas, terapeutaId])

  const terapeutaSeleccionado = useMemo(() => {
    return terapeutas.find((t) => t.id === terapeutaId) || null
  }, [terapeutas, terapeutaId])

  const resumenFranja = useMemo(() => {
    return slots.map((slot) => {
      const ocupadas = citas.filter((cita) =>
        overlaps(slot.start, slot.end, cita.hora_inicio, cita.hora_fin)
      ).length

      return {
        ...slot,
        ocupadas,
      }
    })
  }, [slots, citas])

  const resumenTerapeutas = useMemo(() => {
    return terapeutas.map((terapeuta) => {
      const citasTerapeuta = citas.filter((cita) => cita.empleados?.id === terapeuta.id)
      const minutos = citasTerapeuta.reduce((acc, cita) => {
        return acc + (timeToMinutes(cita.hora_fin) - timeToMinutes(cita.hora_inicio))
      }, 0)

      return {
        ...terapeuta,
        citas: citasTerapeuta.length,
        horas: (minutos / 60).toFixed(1),
      }
    })
  }, [terapeutas, citas])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Agenda · Disponibilidad</h1>
          <p className="mt-1 text-neutral-500">
            Consulta horarios libres y ocupados por terapeuta
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/operaciones/agenda"
            className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            Volver a agenda
          </Link>

          <Link
            href="/admin/operaciones/agenda/calendario"
            className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            Ver calendario
          </Link>

          <Link
            href="/admin/operaciones/agenda/nueva"
            className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            + Nueva cita
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Terapeuta
            </label>
            <select
              value={terapeutaId}
              onChange={(e) => setTerapeutaId(e.target.value)}
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

          <div className="flex items-end">
            <button
              type="button"
              onClick={fetchData}
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              Recargar disponibilidad
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {resumenTerapeutas.map((terapeuta) => (
          <button
            key={terapeuta.id}
            type="button"
            onClick={() => setTerapeutaId(terapeuta.id)}
            className={`rounded-2xl border p-5 text-left shadow-sm transition ${
              terapeutaId === terapeuta.id
                ? 'border-violet-300 bg-violet-50'
                : 'border-black/5 bg-white hover:bg-neutral-50'
            }`}
          >
            <p className="text-sm text-neutral-500">Terapeuta</p>
            <p className="mt-1 text-lg font-bold text-neutral-900">{terapeuta.nombre}</p>
            <div className="mt-4 flex items-center gap-4 text-sm text-neutral-600">
              <span>{terapeuta.citas} citas</span>
              <span>{terapeuta.horas} h ocupadas</span>
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">Calor de ocupación general</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Mide cuántos terapeutas están ocupados en cada franja
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {resumenFranja.map((slot) => (
            <div
              key={slot.label}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${getHeatClass(
                slot.ocupadas
              )}`}
            >
              <div>{slot.label}</div>
              <div className="mt-1 text-xs font-medium">
                {slot.ocupadas === 0
                  ? 'Libre'
                  : `${slot.ocupadas} terapeuta${slot.ocupadas > 1 ? 's' : ''} ocupado${slot.ocupadas > 1 ? 's' : ''}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-900">Disponibilidad por terapeuta</h2>

          {!terapeutaSeleccionado ? (
            <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              Selecciona un terapeuta para ver su disponibilidad detallada.
            </div>
          ) : loading ? (
            <div className="mt-4 text-sm text-neutral-500">Cargando disponibilidad...</div>
          ) : (
            <div className="mt-5 space-y-3">
              <div className="rounded-xl bg-neutral-50 px-4 py-3 text-sm font-medium text-neutral-800">
                {terapeutaSeleccionado.nombre} · {fecha}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {slots.map((slot) => {
                  const citaEnSlot = citasDelTerapeuta.find((cita) =>
                    overlaps(slot.start, slot.end, cita.hora_inicio, cita.hora_fin)
                  )

                  const busy = Boolean(citaEnSlot)

                  return (
                    <div
                      key={slot.label}
                      className={`rounded-xl border px-4 py-3 ${getSlotStateClass(busy)}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold">{slot.label}</p>
                        <span className="text-xs font-semibold uppercase">
                          {busy ? 'Ocupado' : 'Libre'}
                        </span>
                      </div>

                      {citaEnSlot ? (
                        <div className="mt-2 text-xs">
                          <p>{citaEnSlot.clientes?.nombre || 'Sin cliente'}</p>
                          <p>
                            {formatHour(citaEnSlot.hora_inicio)} - {formatHour(citaEnSlot.hora_fin)}
                          </p>
                          <p>{citaEnSlot.servicios?.nombre || 'Sin servicio'}</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs">Disponible para agendar</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-900">Citas del terapeuta</h2>

          {!terapeutaSeleccionado ? (
            <div className="mt-4 text-sm text-neutral-500">
              Selecciona un terapeuta para ver sus citas del día.
            </div>
          ) : citasDelTerapeuta.length === 0 ? (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              No tiene citas activas ese día. Está libre.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {citasDelTerapeuta.map((cita) => (
                <Link
                  key={cita.id}
                  href={`/admin/operaciones/agenda/${cita.id}`}
                  className="block rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 transition hover:bg-neutral-100"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-neutral-900">
                      {cita.clientes?.nombre || 'Sin cliente'}
                    </p>
                    <span className="text-xs font-semibold uppercase text-neutral-500">
                      {cita.estado}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-neutral-700">
                    {formatHour(cita.hora_inicio)} - {formatHour(cita.hora_fin)}
                  </p>

                  <p className="mt-1 text-sm text-neutral-500">
                    {cita.servicios?.nombre || 'Sin servicio'}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}