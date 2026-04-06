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

type RecursoInfo = {
  id: string
  nombre: string
  estado: string | null
  capacidad: number | null
  hora_inicio: string | null
  hora_fin: string | null
}

type EventoDisponibilidad = {
  id: string
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  tipo:
    | 'disponible'
    | 'no_asistira'
    | 'permiso'
    | 'vacaciones'
    | 'reposo'
    | 'bloqueo_manual'
  motivo: string | null
  observaciones: string | null
}

type SlotStatus =
  | {
      tipo: 'disponible'
      label: string
      detalle: string
    }
  | {
      tipo: 'ocupado_terapeuta'
      label: string
      detalle: string
    }
  | {
      tipo: 'ocupado_cliente'
      label: string
      detalle: string
    }
  | {
      tipo: 'ocupado_recurso'
      label: string
      detalle: string
    }
  | {
      tipo: 'fuera_horario_recurso'
      label: string
      detalle: string
    }
  | {
      tipo: 'recurso_inactivo'
      label: string
      detalle: string
    }
  | {
      tipo: 'recurso_mantenimiento'
      label: string
      detalle: string
    }
  | {
      tipo: 'bloqueado_asistencia'
      label: string
      detalle: string
    }

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeCita(row: any): Cita {
  const cliente = firstOrNull(row?.clientes)
  const servicio = firstOrNull(row?.servicios)

  return {
    id: String(row?.id ?? ''),
    hora_inicio: String(row?.hora_inicio ?? ''),
    hora_fin: String(row?.hora_fin ?? ''),
    estado: row?.estado ?? null,
    clientes: cliente
      ? {
          nombre: String(cliente?.nombre ?? ''),
        }
      : null,
    servicios: servicio
      ? {
          nombre: String(servicio?.nombre ?? ''),
        }
      : null,
  }
}

function normalizeEvento(row: any): EventoDisponibilidad {
  return {
    id: String(row?.id ?? ''),
    fecha: String(row?.fecha ?? ''),
    hora_inicio: row?.hora_inicio ?? null,
    hora_fin: row?.hora_fin ?? null,
    tipo: row?.tipo ?? 'bloqueo_manual',
    motivo: row?.motivo ?? null,
    observaciones: row?.observaciones ?? null,
  }
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

function formatHora(hora?: string | null) {
  if (!hora) return '—'
  return hora.slice(0, 5)
}

function solapa(inicioA: number, finA: number, inicioB: number, finB: number) {
  return inicioA < finB && finA > inicioB
}

function formatTipoEvento(tipo: EventoDisponibilidad['tipo']) {
  switch (tipo) {
    case 'no_asistira':
      return 'No asistirá'
    case 'permiso':
      return 'Permiso'
    case 'vacaciones':
      return 'Vacaciones'
    case 'reposo':
      return 'Reposo'
    case 'bloqueo_manual':
      return 'Bloqueo manual'
    case 'disponible':
      return 'Disponible'
    default:
      return 'Bloqueado'
  }
}

function badgeClassByType(tipo: SlotStatus['tipo'], selected: boolean) {
  if (selected) {
    return '!bg-violet-500/15 ring-1 ring-violet-500/40'
  }

  switch (tipo) {
    case 'ocupado_terapeuta':
      return 'cursor-not-allowed bg-rose-500/10'
    case 'ocupado_cliente':
      return 'cursor-not-allowed bg-amber-500/10'
    case 'ocupado_recurso':
      return 'cursor-not-allowed bg-sky-500/10'
    case 'bloqueado_asistencia':
      return 'cursor-not-allowed bg-fuchsia-500/10'
    case 'fuera_horario_recurso':
      return 'cursor-not-allowed bg-white/[0.04]'
    case 'recurso_inactivo':
    case 'recurso_mantenimiento':
      return 'cursor-not-allowed bg-white/[0.04]'
    default:
      return 'bg-transparent hover:bg-white/[0.03]'
  }
}

function titleClassByType(tipo: SlotStatus['tipo'], selected: boolean) {
  if (selected) return 'text-violet-300'

  switch (tipo) {
    case 'ocupado_terapeuta':
      return 'text-rose-300'
    case 'ocupado_cliente':
      return 'text-amber-300'
    case 'ocupado_recurso':
      return 'text-sky-300'
    case 'bloqueado_asistencia':
      return 'text-fuchsia-300'
    case 'fuera_horario_recurso':
    case 'recurso_inactivo':
    case 'recurso_mantenimiento':
      return 'text-white/55'
    default:
      return 'text-emerald-300'
  }
}

export default function DisponibilidadTerapeuta({
  terapeutaId,
  clienteId,
  recursoId,
  fecha,
  duracion,
  horaSeleccionada,
  onSelect,
}: {
  terapeutaId: string
  clienteId?: string
  recursoId?: string
  fecha: string
  duracion: number | null
  horaSeleccionada?: string
  onSelect: (inicio: string, fin: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const [citasTerapeuta, setCitasTerapeuta] = useState<Cita[]>([])
  const [citasCliente, setCitasCliente] = useState<Cita[]>([])
  const [citasRecurso, setCitasRecurso] = useState<Cita[]>([])
  const [recurso, setRecurso] = useState<RecursoInfo | null>(null)
  const [eventosDisponibilidad, setEventosDisponibilidad] = useState<EventoDisponibilidad[]>([])

  useEffect(() => {
    async function load() {
      if (!fecha) {
        setCitasTerapeuta([])
        setCitasCliente([])
        setCitasRecurso([])
        setRecurso(null)
        setEventosDisponibilidad([])
        return
      }

      setLoading(true)

      try {
        const queries: Promise<any>[] = []

        if (terapeutaId) {
          queries.push(
            supabase
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
          )

          queries.push(
            supabase
              .from('empleados_disponibilidad_eventos')
              .select(`
                id,
                fecha,
                hora_inicio,
                hora_fin,
                tipo,
                motivo,
                observaciones
              `)
              .eq('empleado_id', terapeutaId)
              .eq('fecha', fecha)
              .in('tipo', ['no_asistira', 'permiso', 'vacaciones', 'reposo', 'bloqueo_manual'])
              .order('created_at', { ascending: false })
          )
        } else {
          queries.push(Promise.resolve({ data: [], error: null }))
          queries.push(Promise.resolve({ data: [], error: null }))
        }

        if (clienteId) {
          queries.push(
            supabase
              .from('citas')
              .select(`
                id,
                hora_inicio,
                hora_fin,
                estado,
                clientes(nombre),
                servicios(nombre)
              `)
              .eq('cliente_id', clienteId)
              .eq('fecha', fecha)
              .neq('estado', 'cancelada')
              .order('hora_inicio', { ascending: true })
          )
        } else {
          queries.push(Promise.resolve({ data: [], error: null }))
        }

        if (recursoId) {
          queries.push(
            supabase
              .from('citas')
              .select(`
                id,
                hora_inicio,
                hora_fin,
                estado,
                clientes(nombre),
                servicios(nombre)
              `)
              .eq('recurso_id', recursoId)
              .eq('fecha', fecha)
              .neq('estado', 'cancelada')
              .order('hora_inicio', { ascending: true })
          )

          queries.push(
            supabase
              .from('recursos')
              .select('id, nombre, estado, capacidad, hora_inicio, hora_fin')
              .eq('id', recursoId)
              .maybeSingle()
          )
        } else {
          queries.push(Promise.resolve({ data: [], error: null }))
          queries.push(Promise.resolve({ data: null, error: null }))
        }

        const [
          terapeutaRes,
          eventosRes,
          clienteRes,
          recursoCitasRes,
          recursoRes,
        ] = await Promise.all(queries)

        if (terapeutaRes.error) throw terapeutaRes.error
        if (eventosRes.error) throw eventosRes.error
        if (clienteRes.error) throw clienteRes.error
        if (recursoCitasRes.error) throw recursoCitasRes.error
        if (recursoRes.error) throw recursoRes.error

        setCitasTerapeuta(((terapeutaRes.data || []) as any[]).map(normalizeCita))
        setEventosDisponibilidad(((eventosRes.data || []) as any[]).map(normalizeEvento))
        setCitasCliente(((clienteRes.data || []) as any[]).map(normalizeCita))
        setCitasRecurso(((recursoCitasRes.data || []) as any[]).map(normalizeCita))
        setRecurso((recursoRes.data as RecursoInfo | null) || null)
      } catch (err) {
        console.error('Error cargando disponibilidad:', err)
        setCitasTerapeuta([])
        setEventosDisponibilidad([])
        setCitasCliente([])
        setCitasRecurso([])
        setRecurso(null)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [terapeutaId, clienteId, recursoId, fecha])

  const slots = useMemo(() => {
    const items: string[] = []
    for (let min = 0; min < 24 * 60; min += 30) {
      items.push(fromMinutes(min))
    }
    return items
  }, [])

  function getSlotStatus(hora: string): SlotStatus {
    if (!duracion || duracion <= 0) {
      return {
        tipo: 'fuera_horario_recurso',
        label: 'Selecciona un servicio',
        detalle: 'Primero selecciona un servicio con duración.',
      }
    }

    const inicioSlot = toMinutes(hora)
    const finSlot = inicioSlot + duracion

    if (finSlot > 24 * 60) {
      return {
        tipo: 'fuera_horario_recurso',
        label: 'Fuera de horario',
        detalle: 'La cita termina fuera del mismo día.',
      }
    }

    const bloqueoAsistencia = eventosDisponibilidad.find((evento) => {
      if (!evento.hora_inicio && !evento.hora_fin) {
        return true
      }

      if (evento.hora_inicio && evento.hora_fin) {
        return solapa(
          inicioSlot,
          finSlot,
          toMinutes(evento.hora_inicio),
          toMinutes(evento.hora_fin)
        )
      }

      return false
    })

    if (bloqueoAsistencia) {
      return {
        tipo: 'bloqueado_asistencia',
        label: `${formatTipoEvento(bloqueoAsistencia.tipo)} · bloqueado`,
        detalle:
          bloqueoAsistencia.motivo ||
          bloqueoAsistencia.observaciones ||
          (!bloqueoAsistencia.hora_inicio && !bloqueoAsistencia.hora_fin
            ? 'Bloqueo de día completo.'
            : `${formatHora(bloqueoAsistencia.hora_inicio)} - ${formatHora(
                bloqueoAsistencia.hora_fin
              )}`),
      }
    }

    if (recurso) {
      const estado = (recurso.estado || '').toLowerCase()

      if (estado === 'inactivo') {
        return {
          tipo: 'recurso_inactivo',
          label: 'Recurso inactivo',
          detalle: `${recurso.nombre} está inactivo.`,
        }
      }

      if (estado === 'mantenimiento') {
        return {
          tipo: 'recurso_mantenimiento',
          label: 'Recurso en mantenimiento',
          detalle: `${recurso.nombre} está en mantenimiento.`,
        }
      }

      const recursoInicio = recurso.hora_inicio ? toMinutes(recurso.hora_inicio) : null
      const recursoFin = recurso.hora_fin ? toMinutes(recurso.hora_fin) : null

      if (recursoInicio !== null && inicioSlot < recursoInicio) {
        return {
          tipo: 'fuera_horario_recurso',
          label: 'Fuera del horario del recurso',
          detalle: `Disponible desde ${formatHora(recurso.hora_inicio)}.`,
        }
      }

      if (recursoFin !== null && finSlot > recursoFin) {
        return {
          tipo: 'fuera_horario_recurso',
          label: 'Fuera del horario del recurso',
          detalle: `Disponible hasta ${formatHora(recurso.hora_fin)}.`,
        }
      }
    }

    const conflictoTerapeuta = citasTerapeuta.find((cita) => {
      const citaInicio = toMinutes(cita.hora_inicio)
      const citaFin = toMinutes(cita.hora_fin)
      return solapa(inicioSlot, finSlot, citaInicio, citaFin)
    })

    if (conflictoTerapeuta) {
      return {
        tipo: 'ocupado_terapeuta',
        label: `Fisio ocupado · ${formatHora(conflictoTerapeuta.hora_inicio)} - ${formatHora(conflictoTerapeuta.hora_fin)}`,
        detalle: `${conflictoTerapeuta.clientes?.nombre || 'Cliente'} · ${conflictoTerapeuta.servicios?.nombre || 'Servicio'}`,
      }
    }

    const conflictoCliente = citasCliente.find((cita) => {
      const citaInicio = toMinutes(cita.hora_inicio)
      const citaFin = toMinutes(cita.hora_fin)
      return solapa(inicioSlot, finSlot, citaInicio, citaFin)
    })

    if (conflictoCliente) {
      return {
        tipo: 'ocupado_cliente',
        label: `Cliente ocupado · ${formatHora(conflictoCliente.hora_inicio)} - ${formatHora(conflictoCliente.hora_fin)}`,
        detalle: `${conflictoCliente.servicios?.nombre || 'Otra cita'} ya reservada.`,
      }
    }

    if (recursoId) {
      const capacidad = Math.max(Number(recurso?.capacidad || 1), 1)

      const conflictosRecurso = citasRecurso.filter((cita) => {
        const citaInicio = toMinutes(cita.hora_inicio)
        const citaFin = toMinutes(cita.hora_fin)
        return solapa(inicioSlot, finSlot, citaInicio, citaFin)
      })

      if (conflictosRecurso.length >= capacidad) {
        return {
          tipo: 'ocupado_recurso',
          label:
            capacidad > 1
              ? `Recurso lleno · ${conflictosRecurso.length}/${capacidad}`
              : `Recurso ocupado · ${formatHora(conflictosRecurso[0]?.hora_inicio)} - ${formatHora(conflictosRecurso[0]?.hora_fin)}`,
          detalle:
            capacidad > 1
              ? `${recurso?.nombre || 'Recurso'} alcanzó su capacidad.`
              : `${conflictosRecurso[0]?.clientes?.nombre || 'Cliente'} · ${conflictosRecurso[0]?.servicios?.nombre || 'Servicio'}`,
        }
      }
    }

    return {
      tipo: 'disponible',
      label: 'Disponible',
      detalle: `${hora} - ${fromMinutes(finSlot)}`,
    }
  }

  function handleSelect(hora: string) {
    if (!duracion || duracion <= 0) return

    const status = getSlotStatus(hora)
    if (status.tipo !== 'disponible') return

    const inicio = hora
    const fin = fromMinutes(toMinutes(hora) + duracion)

    if (toMinutes(fin) > 24 * 60) return

    onSelect(`${inicio}:00`, `${fin}:00`)
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">Disponibilidad del fisioterapeuta</h3>
          <p className="mt-1 text-sm text-white/50">
            {fecha ? formatDisplayDate(fecha) : 'Selecciona una fecha'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-white/55">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span>Fisio ocupado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span>Cliente ocupado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
            <span>Recurso ocupado</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-fuchsia-500" />
            <span>Bloqueo asistencia</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>Disponible</span>
          </div>
        </div>
      </div>

      {!terapeutaId ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/45">
          Selecciona un fisioterapeuta para ver su agenda.
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
              const status = getSlotStatus(hora)
              const selected = horaSeleccionada?.slice(0, 5) === hora
              const horaFin = duracion ? fromMinutes(toMinutes(hora) + duracion) : ''
              const disabled =
                status.tipo !== 'disponible' || !duracion || toMinutes(horaFin) > 24 * 60

              return (
                <div key={hora} className="contents">
                  <div className="border-b border-white/5 px-4 py-3 text-sm text-white/35">
                    {hora}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelect(hora)}
                    disabled={disabled}
                    className={`
                      min-h-[56px] border-b border-l border-white/5 px-4 py-3 text-left transition
                      ${badgeClassByType(status.tipo, selected)}
                    `}
                  >
                    <div className="flex flex-col gap-1">
                      <span className={`text-sm font-medium ${titleClassByType(status.tipo, selected)}`}>
                        {selected ? 'Nueva sesión seleccionada' : status.label}
                      </span>

                      <span className="text-xs text-white/45">
                        {selected ? `${hora} - ${horaFin}` : status.detalle}
                      </span>

                      {selected ? (
                        <div className="pt-1">
                          <span className="rounded-full bg-violet-500/20 px-2.5 py-1 text-[11px] font-medium text-violet-300">
                            Seleccionado
                          </span>
                        </div>
                      ) : null}
                    </div>
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