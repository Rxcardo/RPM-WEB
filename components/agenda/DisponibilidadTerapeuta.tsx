'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type Cita = {
  id: string
  hora_inicio: string
  hora_fin: string
  estado: string | null
  clientes?: {
    nombre: string
  } | null
  servicios?: {
    nombre: string
  } | null
}

function toMinutes(hora: string) {
  const limpio = hora.slice(0, 5)
  const [h, m] = limpio.split(':').map(Number)
  return h * 60 + m
}

function fromMinutes(total: number) {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function formatDisplayDate(fecha: string) {
  if (!fecha) return ''
  const d = new Date(`${fecha}T00:00:00`)
  return d.toLocaleDateString('es-VE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default function DisponibilidadTerapeuta({
  terapeutaId,
  fecha,
  duracion,
  horaSeleccionada,
  onSelect,
}: {
  terapeutaId: string
  fecha: string
  duracion: number | null
  horaSeleccionada?: string
  onSelect: (inicio: string, fin: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [citas, setCitas] = useState<Cita[]>([])

  useEffect(() => {
    async function load() {
      if (!terapeutaId || !fecha) {
        setCitas([])
        return
      }

      setLoading(true)

      try {
        const { data, error } = await supabase
          .from('citas')
          .select(`
            id,
            hora_inicio,
            hora_fin,
            estado,
            clientes(nombre),
            servicios(nombre)
          `)
          .eq('terapeuta_id', terapeutaId)
          .eq('fecha', fecha)
          .neq('estado', 'cancelada')
          .order('hora_inicio', { ascending: true })

        if (error) throw error

        setCitas((data || []) as Cita[])
      } catch (err) {
        console.error('Error cargando disponibilidad del terapeuta:', err)
        setCitas([])
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [terapeutaId, fecha])

  const slots = useMemo(() => {
    const items: string[] = []
    for (let min = 0; min < 24 * 60; min += 30) {
      items.push(fromMinutes(min))
    }
    return items
  }, [])

  function getEstadoSlot(hora: string) {
    const inicioSlot = toMinutes(hora)
    const finSlot = inicioSlot + (duracion || 0)

    const conflicto = citas.find((cita) => {
      const citaInicio = toMinutes(cita.hora_inicio)
      const citaFin = toMinutes(cita.hora_fin)
      return inicioSlot < citaFin && finSlot > citaInicio
    })

    return conflicto || null
  }

  function handleSelect(hora: string) {
    if (!duracion || duracion <= 0) return

    const inicio = hora
    const fin = fromMinutes(toMinutes(hora) + duracion)

    if (toMinutes(fin) > 24 * 60) return

    const conflicto = getEstadoSlot(hora)
    if (conflicto) return

    onSelect(`${inicio}:00`, `${fin}:00`)
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">Disponibilidad del terapeuta</h3>
          <p className="mt-1 text-sm text-white/50">
            {fecha ? formatDisplayDate(fecha) : 'Selecciona una fecha'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-white/55">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span>Ocupado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
            <span>Nueva sesión</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>Disponible</span>
          </div>
        </div>
      </div>

      {!terapeutaId ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/45">
          Selecciona un terapeuta para ver su agenda.
        </div>
      ) : !duracion ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/45">
          Selecciona un servicio con duración para habilitar el calendario.
        </div>
      ) : loading ? (
        <div className="mt-4 rounded-2xl border border-white/10 p-5 text-sm text-white/45">
          Cargando disponibilidad...
        </div>
      ) : (
        <div className="mt-4 max-h-[560px] overflow-y-auto rounded-2xl border border-white/10">
          <div className="grid grid-cols-[88px_minmax(0,1fr)]">
            {slots.map((hora) => {
              const conflicto = getEstadoSlot(hora)
              const selected = horaSeleccionada?.slice(0, 5) === hora
              const horaFin = duracion ? fromMinutes(toMinutes(hora) + duracion) : ''

              return (
                <div key={hora} className="contents">
                  <div className="border-b border-white/5 px-4 py-3 text-sm text-white/35">
                    {hora}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelect(hora)}
                    disabled={!!conflicto || !duracion || toMinutes(horaFin) > 24 * 60}
                    className={`
                      min-h-[56px] border-b border-l border-white/5 px-4 py-3 text-left transition
                      ${conflicto ? 'cursor-not-allowed bg-rose-500/10' : 'bg-transparent hover:bg-white/[0.03]'}
                      ${selected ? '!bg-violet-500/15 ring-1 ring-violet-500/40' : ''}
                    `}
                  >
                    {conflicto ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-rose-300">
                          Ocupado · {conflicto.hora_inicio.slice(0, 5)} - {conflicto.hora_fin.slice(0, 5)}
                        </span>
                        <span className="text-xs text-white/45">
                          {conflicto.clientes?.nombre || 'Cliente'} · {conflicto.servicios?.nombre || 'Servicio'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className={`text-sm ${selected ? 'text-violet-300' : 'text-emerald-300'}`}>
                            {selected ? 'Nueva sesión seleccionada' : 'Disponible'}
                          </p>
                          <p className="mt-1 text-xs text-white/40">
                            {hora} - {horaFin}
                          </p>
                        </div>

                        {selected ? (
                          <span className="rounded-full bg-violet-500/20 px-2.5 py-1 text-[11px] font-medium text-violet-300">
                            Seleccionado
                          </span>
                        ) : null}
                      </div>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-white/35">
        Haz clic en una hora disponible para seleccionar el inicio. La hora final se calcula con la duración del servicio.
      </p>
    </div>
  )
}