'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'

type Empleado = {
  id: string
  nombre: string | null
  email?: string | null
  telefono?: string | null
  rol?: string | null
  estado?: string | null
}

type Cita = {
  id: string
  fecha: string | null
  hora_inicio: string | null
  hora_fin: string | null
  estado: string | null
  notas?: string | null
  clientes?: {
    nombre: string | null
  } | null
  servicios?: {
    nombre: string | null
  } | null
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString()
  } catch {
    return value
  }
}

function formatTime(value: string | null | undefined) {
  if (!value) return '—'
  return value.slice(0, 5)
}

function estadoBadge(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'programada':
      return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
    case 'confirmada':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'completada':
      return 'border-violet-400/20 bg-violet-400/10 text-violet-300'
    case 'cancelada':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'reprogramada':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function getTodayKey() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function sortByDateTime(a: Cita, b: Cita) {
  const aKey = `${a.fecha || ''} ${a.hora_inicio || ''}`
  const bKey = `${b.fecha || ''} ${b.hora_inicio || ''}`
  return aKey.localeCompare(bKey)
}

export default function AgendaPersonalPage() {
  const router = useRouter()
  const params = useParams()

  const id =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : ''

  const [loading, setLoading] = useState(true)
  const [empleado, setEmpleado] = useState<Empleado | null>(null)
  const [citas, setCitas] = useState<Cita[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!id) {
      setErrorMsg('No se recibió un identificador válido.')
      setLoading(false)
      return
    }

    void loadAgenda()
  }, [id])

  async function loadAgenda() {
    setLoading(true)
    setErrorMsg('')

    try {
      const empleadoRes = await supabase
        .from('empleados')
        .select('id, nombre, email, telefono, rol, estado')
        .eq('id', id)
        .limit(1)
        .maybeSingle()

      if (empleadoRes.error || !empleadoRes.data) {
        throw new Error(empleadoRes.error?.message || 'No se pudo cargar el personal.')
      }

      const citasRes = await supabase
        .from('citas')
        .select(`
          id,
          fecha,
          hora_inicio,
          hora_fin,
          estado,
          notas,
          clientes:cliente_id ( nombre ),
          servicios:servicio_id ( nombre )
        `)
        .eq('terapeuta_id', id)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })

      if (citasRes.error) {
        throw new Error(citasRes.error.message || 'No se pudieron cargar las citas.')
      }

      setEmpleado(empleadoRes.data as Empleado)
      setCitas((citasRes.data || []) as unknown as Cita[])
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err?.message || 'No se pudo cargar la agenda del personal.')
    } finally {
      setLoading(false)
    }
  }

  const hoy = useMemo(() => getTodayKey(), [])

  const citasOrdenadas = useMemo(() => {
    return [...citas].sort(sortByDateTime)
  }, [citas])

  const citasHoy = useMemo(() => {
    return citasOrdenadas.filter((cita) => cita.fecha === hoy)
  }, [citasOrdenadas, hoy])

  const proximasCitas = useMemo(() => {
    return citasOrdenadas
      .filter((cita) => {
        const fecha = cita.fecha || ''
        const hora = cita.hora_inicio || ''
        const now = new Date()
        const today = getTodayKey()
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(
          now.getMinutes()
        ).padStart(2, '0')}`

        if (!fecha) return false
        if (fecha > today) return true
        if (fecha === today && hora.slice(0, 5) >= currentTime) return true
        return false
      })
      .slice(0, 8)
  }, [citasOrdenadas])

  const stats = useMemo(() => {
    const total = citas.length
    const hoyCount = citasHoy.length
    const confirmadas = citas.filter((c) => c.estado?.toLowerCase() === 'confirmada').length
    const programadas = citas.filter((c) => c.estado?.toLowerCase() === 'programada').length
    const completadas = citas.filter((c) => c.estado?.toLowerCase() === 'completada').length

    return {
      total,
      hoy: hoyCount,
      confirmadas,
      programadas,
      completadas,
    }
  }, [citas, citasHoy])

  const disponibilidad = useMemo(() => {
    const bloques = [
      '08:00', '09:00', '10:00', '11:00',
      '12:00', '13:00', '14:00', '15:00',
      '16:00', '17:00', '18:00',
    ]

    const ocupadas = new Set(
      citasHoy.map((cita) => (cita.hora_inicio ? cita.hora_inicio.slice(0, 5) : ''))
    )

    return bloques.map((hora) => ({
      hora,
      disponible: !ocupadas.has(hora),
    }))
  }, [citasHoy])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-white/55">Personas</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Agenda del personal</h1>
        </div>

        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando agenda...</p>
        </Card>
      </div>
    )
  }

  if (errorMsg || !empleado) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-white/55">Personas</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Agenda del personal</h1>
        </div>

        <Card className="p-6">
          <p className="text-sm text-rose-400">{errorMsg || 'No se encontró el personal.'}</p>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin/personas/personal')}
              className="
                rounded-2xl border border-white/10 bg-white/[0.08]
                px-4 py-3 text-sm font-semibold text-white transition
                hover:bg-white/[0.12]
              "
            >
              Volver a personal
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Personas</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Agenda de {empleado.nombre || 'Personal'}
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Calendario operativo y disponibilidad del miembro del equipo.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            title="Ver personal"
            description="Volver al detalle del miembro del equipo."
            href={`/admin/personas/personal/${empleado.id}`}
          />

          <ActionCard
            title="Editar"
            description="Modificar datos del personal."
            href={`/admin/personas/personal/${empleado.id}/editar`}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total citas" value={stats.total} />
        <StatCard title="Citas hoy" value={stats.hoy} color="text-sky-400" />
        <StatCard title="Confirmadas" value={stats.confirmadas} color="text-emerald-400" />
        <StatCard title="Programadas" value={stats.programadas} color="text-amber-300" />
        <StatCard title="Completadas" value={stats.completadas} color="text-violet-400" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Section
          title="Disponibilidad de hoy"
          description={`Bloques rápidos para ${formatDate(hoy)}.`}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {disponibilidad.map((bloque) => (
              <Card key={bloque.hora} className="p-3">
                <p className="text-sm font-medium text-white">{bloque.hora}</p>
                <p
                  className={`mt-1 text-xs ${
                    bloque.disponible ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {bloque.disponible ? 'Disponible' : 'Ocupado'}
                </p>
              </Card>
            ))}
          </div>
        </Section>

        <div className="xl:col-span-2">
          <Section
            title="Próximas citas"
            description="Agenda inmediata del personal."
          >
            <div className="space-y-3">
              {proximasCitas.length === 0 ? (
                <Card className="p-4">
                  <p className="text-sm text-white/55">No hay citas próximas.</p>
                </Card>
              ) : (
                proximasCitas.map((cita) => (
                  <Card key={cita.id} className="p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-medium text-white">
                          {cita.clientes?.nombre || 'Sin cliente'}
                        </p>
                        <p className="mt-1 text-sm text-white/55">
                          {cita.servicios?.nombre || 'Sin servicio'}
                        </p>
                        <p className="mt-1 text-sm text-white/55">
                          {formatDate(cita.fecha)} · {formatTime(cita.hora_inicio)} -{' '}
                          {formatTime(cita.hora_fin)}
                        </p>
                        {cita.notas ? (
                          <p className="mt-2 text-xs text-white/45">{cita.notas}</p>
                        ) : null}
                      </div>

                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoBadge(
                          cita.estado
                        )}`}
                      >
                        {cita.estado || 'Sin estado'}
                      </span>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Section>
        </div>
      </div>

      <Section
        title="Calendario de citas"
        description="Historial y agenda completa del personal."
        className="p-0"
        contentClassName="overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr className="text-left text-white/55">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Hora</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Servicio</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Notas</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {citasOrdenadas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-white/55">
                    No hay citas registradas.
                  </td>
                </tr>
              ) : (
                citasOrdenadas.map((cita) => (
                  <tr key={cita.id} className="align-top transition hover:bg-white/[0.03]">
                    <td className="px-4 py-4 text-white/75">{formatDate(cita.fecha)}</td>
                    <td className="px-4 py-4 text-white/75">
                      {formatTime(cita.hora_inicio)} - {formatTime(cita.hora_fin)}
                    </td>
                    <td className="px-4 py-4 font-medium text-white">
                      {cita.clientes?.nombre || 'Sin cliente'}
                    </td>
                    <td className="px-4 py-4 text-white/75">
                      {cita.servicios?.nombre || 'Sin servicio'}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoBadge(
                          cita.estado
                        )}`}
                      >
                        {cita.estado || 'Sin estado'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-white/55">{cita.notas || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}