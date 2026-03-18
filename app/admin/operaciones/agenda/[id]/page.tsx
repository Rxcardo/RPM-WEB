'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type CitaDetalle = {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: string
  notas: string | null
  created_at: string | null
  clientes: { id: string; nombre: string } | null
  empleados: { id: string; nombre: string } | null
  servicios: { id: string; nombre: string; duracion_min?: number | null } | null
  recursos: { id: string; nombre: string } | null
}

function estadoClasses(estado: string) {
  switch (estado) {
    case 'confirmada':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'completada':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'cancelada':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'reprogramada':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200'
  }
}

function formatFecha(fecha: string) {
  if (!fecha) return '—'
  try {
    return new Date(`${fecha}T00:00:00`).toLocaleDateString()
  } catch {
    return fecha
  }
}

export default function VerCitaPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [cita, setCita] = useState<CitaDetalle | null>(null)

  useEffect(() => {
    loadCita()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadCita() {
    setLoading(true)

    const { data, error } = await supabase
      .from('citas')
      .select(`
        id,
        fecha,
        hora_inicio,
        hora_fin,
        estado,
        notas,
        created_at,
        clientes:cliente_id ( id, nombre ),
        empleados:terapeuta_id ( id, nombre ),
        servicios:servicio_id ( id, nombre, duracion_min ),
        recursos:recurso_id ( id, nombre )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error(error)
      alert('No se pudo cargar la cita.')
      router.push('/admin/operaciones/agenda')
      return
    }

    setCita(data as unknown as CitaDetalle)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando cita...</p>
        </div>
      </div>
    )
  }

  if (!cita) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">No se encontró la cita.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Agenda</p>
          <h1 className="text-2xl font-bold text-slate-900">Detalle de cita</h1>
          <p className="mt-1 text-sm text-slate-600">
            Consulta toda la información de la cita.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/operaciones/agenda/${cita.id}/editar`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Editar
          </Link>

          <Link
            href={`/admin/operaciones/agenda/${cita.id}/reprogramar`}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Reprogramar
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Información principal
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-xs text-slate-500">Cliente</p>
              <p className="mt-1 font-semibold text-slate-900">
                {cita.clientes?.nombre || 'Sin cliente'}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Terapeuta</p>
              <p className="mt-1 font-semibold text-slate-900">
                {cita.empleados?.nombre || 'Sin terapeuta'}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Servicio</p>
              <p className="mt-1 font-semibold text-slate-900">
                {cita.servicios?.nombre || 'Sin servicio'}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Recurso</p>
              <p className="mt-1 font-semibold text-slate-900">
                {cita.recursos?.nombre || 'Sin recurso'}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Fecha</p>
              <p className="mt-1 font-semibold text-slate-900">
                {formatFecha(cita.fecha)}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Horario</p>
              <p className="mt-1 font-semibold text-slate-900">
                {cita.hora_inicio?.slice(0, 5)} - {cita.hora_fin?.slice(0, 5)}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Estado</p>
              <div className="mt-2">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoClasses(cita.estado)}`}
                >
                  {cita.estado}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500">Duración</p>
              <p className="mt-1 font-semibold text-slate-900">
                {cita.servicios?.duracion_min ? `${cita.servicios.duracion_min} min` : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Notas
          </h2>

          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {cita.notas || 'Sin notas registradas.'}
          </p>

          <div className="mt-6 border-t pt-4">
            <p className="text-xs text-slate-500">Creada</p>
            <p className="mt-1 text-sm font-medium text-slate-900">
              {cita.created_at ? new Date(cita.created_at).toLocaleString() : '—'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}