'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type Empleado = {
  id: string
  nombre: string
}

type AgendaEvent = {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: 'programada' | 'confirmada' | 'cancelada' | 'completada' | 'reprogramada'
  cliente: {
    id: string
    nombre: string
  } | null
  terapeuta: {
    id: string
    nombre: string
  } | null
  servicio: {
    id: string
    nombre: string
    duracion_min: number
  } | null
}

function getTodayLocal() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(dateString: string, amount: number) {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + amount)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateLabel(value: string) {
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

function formatHour(value: string) {
  return value.slice(0, 5)
}

function timeToMinutes(value: string) {
  const [h, m] = value.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function getEstadoBadgeClasses(estado: AgendaEvent['estado']) {
  if (estado === 'confirmada') return 'bg-blue-100 text-blue-700'
  if (estado === 'programada') return 'bg-amber-100 text-amber-700'
  if (estado === 'completada') return 'bg-emerald-100 text-emerald-700'
  if (estado === 'cancelada') return 'bg-rose-100 text-rose-700'
  return 'bg-neutral-200 text-neutral-700'
}

function getEstadoCardClasses(estado: AgendaEvent['estado']) {
  if (estado === 'confirmada') {
    return 'border-blue-200 bg-gradient-to-b from-blue-50 to-white text-blue-900'
  }
  if (estado === 'programada') {
    return 'border-amber-200 bg-gradient-to-b from-amber-50 to-white text-amber-900'
  }
  if (estado === 'completada') {
    return 'border-emerald-200 bg-gradient-to-b from-emerald-50 to-white text-emerald-900'
  }
  if (estado === 'cancelada') {
    return 'border-rose-200 bg-gradient-to-b from-rose-50 to-white text-rose-900 opacity-80'
  }
  return 'border-neutral-200 bg-gradient-to-b from-neutral-50 to-white text-neutral-900'
}

const HOUR_START = 5
const HOUR_END = 23
const PX_PER_HOUR = 96

export default function AgendaCalendarioPage() {
  const [fecha, setFecha] = useState(getTodayLocal())
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [terapeutas, setTerapeutas] = useState<Empleado[]>([])
  const [terapeutaFiltro, setTerapeutaFiltro] = useState('')
  const [loading, setLoading] = useState(true)

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
          empleados:terapeuta_id (
            id,
            nombre
          ),
          servicios:servicio_id (
            id,
            nombre,
            duracion_min
          )
        `)
        .eq('fecha', fecha)
        .order('hora_inicio', { ascending: true }),
    ])

    if (empleadosRes.error) {
      console.error('Error cargando terapeutas:', empleadosRes.error.message)
      setTerapeutas([])
    } else {
      setTerapeutas((empleadosRes.data as Empleado[]) || [])
    }

    if (citasRes.error) {
      console.error('Error cargando citas calendario:', citasRes.error.message)
      setEvents([])
    } else {
      const mapped =
        (citasRes.data as any[])?.map((item) => ({
          id: item.id,
          fecha: item.fecha,
          hora_inicio: item.hora_inicio,
          hora_fin: item.hora_fin,
          estado: item.estado,
          cliente: item.clientes,
          terapeuta: item.empleados,
          servicio: item.servicios,
        })) || []

      setEvents(mapped)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [fecha])

  const terapeutasVisibles = useMemo(() => {
    if (terapeutaFiltro) {
      return terapeutas.filter((t) => t.id === terapeutaFiltro)
    }

    const therapistMap = new Map<string, Empleado>()

    terapeutas.forEach((t) => therapistMap.set(t.id, t))
    events.forEach((event) => {
      if (event.terapeuta?.id && event.terapeuta?.nombre) {
        therapistMap.set(event.terapeuta.id, {
          id: event.terapeuta.id,
          nombre: event.terapeuta.nombre,
        })
      }
    })

    return Array.from(therapistMap.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    )
  }, [terapeutas, events, terapeutaFiltro])

  const citasActivas = useMemo(() => {
    return events.filter((e) => e.estado !== 'cancelada')
  }, [events])

  const totalMinutosOcupados = useMemo(() => {
    return citasActivas.reduce((acc, event) => {
      return acc + (timeToMinutes(event.hora_fin) - timeToMinutes(event.hora_inicio))
    }, 0)
  }, [citasActivas])

  const capacidadTotal = useMemo(() => {
    const totalTerapeutas = Math.max(terapeutasVisibles.length, 1)
    return totalTerapeutas * (HOUR_END - HOUR_START) * 60
  }, [terapeutasVisibles])

  const ocupacion = useMemo(() => {
    if (!capacidadTotal) return 0
    return Math.round((totalMinutosOcupados / capacidadTotal) * 100)
  }, [totalMinutosOcupados, capacidadTotal])

  const totalHoras = HOUR_END - HOUR_START
  const totalHeight = totalHoras * PX_PER_HOUR

  const hourLabels = Array.from({ length: totalHoras }, (_, i) => HOUR_START + i)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Agenda · Calendario</h1>
          <p className="mt-1 text-neutral-500">
            Vista diaria visual tipo planner por terapeuta
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
            href="/admin/operaciones/agenda/disponibilidad"
            className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            Ver disponibilidad
          </Link>

          <Link
            href="/admin/operaciones/agenda/nueva"
            className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            + Nueva cita
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Citas del día</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">{events.length}</p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Citas activas</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">{citasActivas.length}</p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Terapeutas visibles</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">{terapeutasVisibles.length}</p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <p className="text-sm text-neutral-500">Ocupación estimada</p>
          <p className="mt-2 text-3xl font-bold text-neutral-900">{ocupacion}%</p>
        </div>
      </div>

    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
        <div className="grid gap-4 lg:grid-cols-4">
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
              value={terapeutaFiltro}
              onChange={(e) => setTerapeutaFiltro(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
            >
              <option value="">Todos</option>
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
              onClick={() => setFecha(addDays(fecha, -1))}
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              ← Día anterior
            </button>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setFecha(addDays(fecha, 1))}
              className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              Día siguiente →
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-neutral-50 px-4 py-3">
          <p className="text-sm font-semibold capitalize text-neutral-800">
            {formatDateLabel(fecha)}
          </p>

          <button
            type="button"
            onClick={fetchData}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
          >
            Recargar
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-black/5 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-neutral-500">Cargando calendario...</div>
        ) : terapeutasVisibles.length === 0 ? (
          <div className="p-8 text-center text-neutral-500">
            No hay terapeutas para mostrar en esta vista.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[1200px]"
              style={{
                gridTemplateColumns: `88px repeat(${terapeutasVisibles.length}, minmax(260px, 1fr))`,
              }}
            >
              <div className="sticky left-0 z-30 border-b border-r border-neutral-200 bg-white/95 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Hora
                </p>
              </div>

              {terapeutasVisibles.map((terapeuta) => (
                <div
                  key={terapeuta.id}
                  className="border-b border-r border-neutral-200 bg-white/95 p-4 backdrop-blur"
                >
                  <p className="text-sm text-neutral-500">Terapeuta</p>
                  <p className="mt-1 font-bold text-neutral-900">{terapeuta.nombre}</p>
                </div>
              ))}

              <div className="sticky left-0 z-20 border-r border-neutral-200 bg-neutral-50">
                {hourLabels.map((hour) => (
                  <div
                    key={hour}
                    className="relative border-b border-dashed border-neutral-200 px-3"
                    style={{ height: `${PX_PER_HOUR}px` }}
                  >
                    <span className="absolute top-2 text-xs font-semibold text-neutral-500">
                      {`${String(hour).padStart(2, '0')}:00`}
                    </span>
                  </div>
                ))}
              </div>

              {terapeutasVisibles.map((terapeuta) => {
                const eventsByTerapeuta = events.filter(
                  (event) => event.terapeuta?.id === terapeuta.id
                )

                return (
                  <div
                    key={terapeuta.id}
                    className="relative border-r border-neutral-200 bg-[#fcfcfd]"
                    style={{ height: `${totalHeight}px` }}
                  >
                    {hourLabels.map((hour, index) => (
                      <div
                        key={`${terapeuta.id}-${hour}`}
                        className={`border-b ${index % 2 === 0 ? 'bg-white/70' : 'bg-neutral-50/70'} border-dashed border-neutral-200`}
                        style={{ height: `${PX_PER_HOUR}px` }}
                      />
                    ))}

                    {eventsByTerapeuta.map((event) => {
                      const startMinutes = timeToMinutes(event.hora_inicio)
                      const endMinutes = timeToMinutes(event.hora_fin)

                      const top = ((startMinutes - HOUR_START * 60) / 60) * PX_PER_HOUR
                      const height = ((endMinutes - startMinutes) / 60) * PX_PER_HOUR

                      const safeTop = Math.max(top, 0)
                      const safeHeight = Math.max(height, 72)

                      return (
                        <Link
                          key={event.id}
                          href={`/admin/operaciones/agenda/${event.id}`}
                          className={`absolute left-2 right-2 rounded-2xl border p-3 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md ${getEstadoCardClasses(
                            event.estado
                          )}`}
                          style={{
                            top: `${safeTop}px`,
                            height: `${safeHeight}px`,
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${getEstadoBadgeClasses(
                                event.estado
                              )}`}
                            >
                              {event.estado}
                            </span>

                            <span className="text-[11px] font-semibold text-neutral-500">
                              {formatHour(event.hora_inicio)}
                            </span>
                          </div>

                          <div className="mt-2">
                            <p className="line-clamp-2 text-sm font-bold leading-tight text-neutral-900">
                              {event.cliente?.nombre || 'Sin cliente'}
                            </p>

                            <p className="mt-1 text-xs font-medium text-neutral-600">
                              {formatHour(event.hora_inicio)} - {formatHour(event.hora_fin)}
                            </p>

                            <p className="mt-2 line-clamp-2 text-xs text-neutral-600">
                              {event.servicio?.nombre || 'Sin servicio'}
                            </p>

                            {event.servicio?.duracion_min ? (
                              <p className="mt-1 text-[11px] text-neutral-400">
                                {event.servicio.duracion_min} min
                              </p>
                            ) : null}
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}