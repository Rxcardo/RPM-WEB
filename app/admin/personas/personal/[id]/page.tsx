'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

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
  switch (estado) {
    case 'activo':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'inactivo':
      return 'bg-slate-50 text-slate-700 border-slate-200'
    case 'vacaciones':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    default:
      return 'bg-blue-50 text-blue-700 border-blue-200'
  }
}

export default function VerPersonalPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [item, setItem] = useState<EmpleadoDetalle | null>(null)

  useEffect(() => {
    loadPersonal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadPersonal() {
    setLoading(true)

    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error(error)
      alert('No se pudo cargar el personal.')
      router.push('/admin/personas/personal')
      return
    }

    setItem(data as EmpleadoDetalle)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando personal...</p>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">No se encontró el personal.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Personas</p>
          <h1 className="text-2xl font-bold text-slate-900">Detalle de personal</h1>
          <p className="mt-1 text-sm text-slate-600">
            Información general del miembro del equipo.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/personas/personal/${item.id}/editar`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Editar
          </Link>

          <Link
            href={`/admin/personas/personal/${item.id}/agenda`}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Ver agenda
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
              <p className="text-xs text-slate-500">Nombre</p>
              <p className="mt-1 font-semibold text-slate-900">{item.nombre || 'Sin nombre'}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Rol</p>
              <p className="mt-1 font-semibold text-slate-900">{item.rol || 'Sin rol'}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Email</p>
              <p className="mt-1 font-semibold text-slate-900">{item.email || 'Sin email'}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Teléfono</p>
              <p className="mt-1 font-semibold text-slate-900">{item.telefono || 'Sin teléfono'}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Estado</p>
              <div className="mt-2">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoClasses(item.estado)}`}
                >
                  {item.estado || 'Sin estado'}
                </span>
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500">Creado</p>
              <p className="mt-1 font-semibold text-slate-900">
                {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Accesos rápidos
          </h2>

          <div className="flex flex-col gap-3">
            <Link
              href={`/admin/personas/personal/${item.id}/agenda`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Ver agenda
            </Link>

            <Link
              href={`/admin/personas/personal/${item.id}/clientes`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Ver clientes
            </Link>

            <Link
              href={`/admin/personas/personal/${item.id}/estadisticas`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Ver estadísticas
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}