'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

type RecursoDetalle = {
  id: string
  nombre: string
  tipo?: string | null
  capacidad?: number | null
  descripcion?: string | null
  estado?: string | null
  created_at?: string | null
}

function estadoBadgeClasses(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'activo':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'inactivo':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'mantenimiento':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function formatTipo(tipo?: string | null) {
  if (!tipo) return '—'

  const map: Record<string, string> = {
    therapy: 'Terapia',
    recovery: 'Recovery',
    training: 'Entrenamiento',
    evaluation: 'Evaluación',
    other: 'Otro',
  }

  return map[tipo] || tipo
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function DetailCard({
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

export default function RecursoDetallePage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recurso, setRecurso] = useState<RecursoDetalle | null>(null)

  async function load() {
    try {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('recursos')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      setRecurso((data as RecursoDetalle) || null)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo cargar el recurso.')
      setRecurso(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function eliminar() {
    const ok = window.confirm('¿Seguro que quieres eliminar este recurso?')
    if (!ok) return

    try {
      const { error } = await supabase
        .from('recursos')
        .delete()
        .eq('id', id)

      if (error) throw error

      router.push('/admin/operaciones/recursos')
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo eliminar el recurso.')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-white/55">Operaciones</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            Detalle de recurso
          </h1>
        </div>

        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando recurso...</p>
        </Card>
      </div>
    )
  }

  if (!recurso) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-white/55">Operaciones</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            Detalle de recurso
          </h1>
        </div>

        <Card className="p-6">
          <p className="text-sm text-white/55">
            No se encontró el recurso.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Operaciones</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Detalle de recurso
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Consulta la información completa del recurso.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ActionCard
            title="Editar"
            description="Modificar los datos del recurso."
            href={`/admin/operaciones/recursos/${id}/editar`}
          />
          <ActionCard
            title="Volver"
            description="Regresar al listado general."
            href="/admin/operaciones/recursos"
          />
          <div>
            <button
              type="button"
              onClick={eliminar}
              className="
                w-full rounded-3xl border border-rose-400/20 bg-rose-400/10
                p-5 text-left transition hover:bg-rose-400/15
              "
            >
              <p className="font-medium text-rose-300">Eliminar</p>
              <p className="mt-1 text-sm text-rose-300/80">
                Borrar este recurso del sistema.
              </p>
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section
            title="Información principal"
            description="Datos generales del recurso."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <DetailCard label="Nombre" value={recurso.nombre || '—'} />
              <DetailCard label="Tipo" value={formatTipo(recurso.tipo)} />
              <DetailCard
                label="Capacidad"
                value={recurso.capacidad ?? '—'}
              />
              <DetailCard
                label="Estado"
                value={
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${estadoBadgeClasses(
                      recurso.estado || ''
                    )}`}
                  >
                    {recurso.estado || 'sin estado'}
                  </span>
                }
              />
            </div>
          </Section>
        </div>

        <Section
          title="Descripción"
          description="Detalle adicional del recurso."
        >
          <Card className="p-4">
            <p className="whitespace-pre-wrap text-sm text-white/75">
              {recurso.descripcion || 'Sin descripción registrada.'}
            </p>
          </Card>

          <Card className="mt-4 p-4">
            <p className="text-xs text-white/45">Creado</p>
            <p className="mt-1 text-sm font-medium text-white">
              {formatDateTime(recurso.created_at)}
            </p>
          </Card>

          <div className="mt-4">
            <Link
              href="/admin/operaciones/recursos"
              className="
                inline-flex rounded-2xl border border-white/10 bg-white/[0.03]
                px-4 py-2 text-sm font-medium text-white/80
                transition hover:bg-white/[0.06]
              "
            >
              Volver a recursos
            </Link>
          </div>
        </Section>
      </div>
    </div>
  )
}