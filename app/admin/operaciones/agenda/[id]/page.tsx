'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

type ServicioDetalle = {
  id: string
  nombre: string
  estado?: string | null
  categoria?: string | null
  precio?: number | null
  duracion_min?: number | null
  duracion?: number | null
  tiempo?: number | null
  tiempo_min?: number | null
  tiempo_minutos?: number | null
  minutos?: number | null
  [key: string]: any
}

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
  servicios: ServicioDetalle | null
  recursos: { id: string; nombre: string } | null
}

function getServicioDuracion(servicio: ServicioDetalle | null) {
  if (!servicio) return null

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

function estadoClasses(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'confirmada':
      return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
    case 'completada':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'cancelada':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'reprogramada':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'programada':
      return 'border-violet-400/20 bg-violet-400/10 text-violet-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
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

function formatDateTime(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-white/45">{label}</p>
      <div className="mt-1 font-medium text-white">{value}</div>
    </Card>
  )
}

export default function VerCitaPage() {
  const router = useRouter()
  const params = useParams()
  const rawId = params?.id
  const id = Array.isArray(rawId) ? rawId[0] : (rawId as string)

  const [loading, setLoading] = useState(true)
  const [cita, setCita] = useState<CitaDetalle | null>(null)

  const duracionServicio = useMemo(() => getServicioDuracion(cita?.servicios || null), [cita])

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    void loadCita()
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
        servicios:servicio_id ( * ),
        recursos:recurso_id ( id, nombre )
      `)
      .eq('id', id)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error(error)
      alert('No se pudo cargar la cita.')
      router.push('/admin/operaciones/agenda')
      return
    }

    if (!data) {
      alert('No se encontró la cita.')
      router.push('/admin/operaciones/agenda')
      return
    }

    setCita(data as unknown as CitaDetalle)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-white/55">Agenda</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Detalle de cita</h1>
        </div>

        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando cita...</p>
        </Card>
      </div>
    )
  }

  if (!cita) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-white/55">Agenda</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Detalle de cita</h1>
        </div>

        <Card className="p-6">
          <p className="text-sm text-white/55">No se encontró la cita.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Agenda</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Detalle de cita
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Consulta toda la información de la cita.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            title="Editar"
            description="Modificar datos de la cita."
            href={`/admin/operaciones/agenda/${cita.id}/editar`}
          />

          <ActionCard
            title="Reprogramar"
            description="Cambiar fecha y horario."
            href={`/admin/operaciones/agenda/${cita.id}/reprogramar`}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section
            title="Información principal"
            description="Datos base de la cita, cliente, personal y servicio."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <DetailItem
                label="Cliente"
                value={cita.clientes?.nombre || 'Sin cliente'}
              />

              <DetailItem
                label="Terapeuta"
                value={cita.empleados?.nombre || 'Sin terapeuta'}
              />

              <DetailItem
                label="Servicio"
                value={cita.servicios?.nombre || 'Sin servicio'}
              />

              <DetailItem
                label="Recurso"
                value={cita.recursos?.nombre || 'Sin recurso'}
              />

              <DetailItem
                label="Fecha"
                value={formatFecha(cita.fecha)}
              />

              <DetailItem
                label="Horario"
                value={`${cita.hora_inicio?.slice(0, 5) || '—'} - ${cita.hora_fin?.slice(0, 5) || '—'}`}
              />

              <DetailItem
                label="Estado"
                value={
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoClasses(
                      cita.estado
                    )}`}
                  >
                    {cita.estado}
                  </span>
                }
              />

              <DetailItem
                label="Duración"
                value={duracionServicio ? `${duracionServicio} min` : '—'}
              />
            </div>
          </Section>
        </div>

        <Section
          title="Notas"
          description="Observaciones registradas para esta cita."
        >
          <Card className="p-4">
            <p className="whitespace-pre-wrap text-sm text-white/75">
              {cita.notas || 'Sin notas registradas.'}
            </p>
          </Card>

          <Card className="mt-4 p-4">
            <p className="text-xs text-white/45">Creada</p>
            <p className="mt-1 text-sm font-medium text-white">
              {formatDateTime(cita.created_at)}
            </p>
          </Card>

          <div className="mt-4">
            <Link
              href="/admin/operaciones/agenda"
              className="
                inline-flex rounded-2xl border border-white/10 bg-white/[0.03]
                px-4 py-2 text-sm font-medium text-white/80
                transition hover:bg-white/[0.06]
              "
            >
              Volver a agenda
            </Link>
          </div>
        </Section>
      </div>
    </div>
  )
}