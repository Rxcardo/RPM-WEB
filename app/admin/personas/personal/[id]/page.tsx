'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

type EmpleadoDetalle = {
  id: string
  nombre: string | null
  email?: string | null
  telefono?: string | null
  rol?: string | null
  estado?: string | null
  created_at?: string | null
}

function estadoClasses(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'activo':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'inactivo':
      return 'border-white/10 bg-white/[0.05] text-white/70'
    case 'vacaciones':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    default:
      return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export default function VerPersonalPage() {
  const router = useRouter()
  const params = useParams()

  const id =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : ''

  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState<EmpleadoDetalle | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!id) {
      setErrorMsg('No se recibió un identificador válido.')
      setLoading(false)
      return
    }

    void loadPersonal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadPersonal() {
    setLoading(true)
    setErrorMsg('')

    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('id', id)
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error(error)
      setErrorMsg(error.message || 'No se pudo cargar el personal.')
      setLoading(false)
      return
    }

    if (!data) {
      setErrorMsg('No se encontró el personal.')
      setLoading(false)
      return
    }

    setItem(data as EmpleadoDetalle)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-white/55">Personas</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Detalle de personal</h1>
          <p className="mt-2 text-sm text-white/55">Cargando información...</p>
        </div>

        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando personal...</p>
        </Card>
      </div>
    )
  }

  if (errorMsg || !item) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-white/55">Personas</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Detalle de personal</h1>
          <p className="mt-2 text-sm text-white/55">No fue posible abrir el registro.</p>
        </div>

        <Card className="p-6">
          <p className="text-sm font-medium text-rose-400">
            {errorMsg || 'No se encontró el personal.'}
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
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

            <button
              type="button"
              onClick={() => void loadPersonal()}
              className="
                rounded-2xl border border-rose-400/20 bg-rose-400/10
                px-4 py-3 text-sm font-semibold text-rose-300 transition
                hover:bg-rose-400/15
              "
            >
              Reintentar
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
            Detalle de personal
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Información general del miembro del equipo.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            title="Editar"
            description="Modificar la información del personal."
            href={`/admin/personas/personal/${item.id}/editar`}
          />

          <ActionCard
            title="Ver agenda"
            description="Consultar las citas de este miembro."
            href={`/admin/personas/personal/${item.id}/agenda`}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section
            title="Información principal"
            description="Datos básicos del miembro del equipo."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-xs text-white/45">Nombre</p>
                <p className="mt-1 font-semibold text-white">{item.nombre || 'Sin nombre'}</p>
              </div>

              <div>
                <p className="text-xs text-white/45">Rol</p>
                <p className="mt-1 font-semibold text-white">{item.rol || 'Sin rol'}</p>
              </div>

              <div>
                <p className="text-xs text-white/45">Email</p>
                <p className="mt-1 font-semibold text-white">{item.email || 'Sin email'}</p>
              </div>

              <div>
                <p className="text-xs text-white/45">Teléfono</p>
                <p className="mt-1 font-semibold text-white">{item.telefono || 'Sin teléfono'}</p>
              </div>

              <div>
                <p className="text-xs text-white/45">Estado</p>
                <div className="mt-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoClasses(
                      item.estado
                    )}`}
                  >
                    {item.estado || 'Sin estado'}
                  </span>
                </div>
              </div>

              <div>
                <p className="text-xs text-white/45">Creado</p>
                <p className="mt-1 font-semibold text-white">
                  {formatDateTime(item.created_at)}
                </p>
              </div>
            </div>
          </Section>
        </div>

        <Section
          title="Accesos rápidos"
          description="Atajos del módulo de personal."
        >
          <div className="grid gap-3">
            <ActionCard
              title="Ver agenda"
              description="Revisar citas y horarios."
              href={`/admin/personas/personal/${item.id}/agenda`}
            />

            <ActionCard
              title="Ver clientes"
              description="Consultar clientes asociados."
              href={`/admin/personas/personal/${item.id}/clientes`}
            />

            <ActionCard
              title="Ver estadísticas"
              description="Abrir métricas del personal."
              href={`/admin/personas/personal/${item.id}/estadisticas`}
            />
          </div>
        </Section>
      </div>

      <div>
        <Link
          href="/admin/personas/personal"
          className="
            inline-flex rounded-2xl border border-white/10 bg-white/[0.03]
            px-4 py-3 text-sm font-semibold text-white/80 transition
            hover:bg-white/[0.06]
          "
        >
          Volver al listado
        </Link>
      </div>
    </div>
  )
}