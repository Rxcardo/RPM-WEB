'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'

type Recurso = {
  id: string
  nombre: string
  tipo?: string | null
  capacidad?: number | null
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

export default function RecursosPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    try {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('recursos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setRecursos((data || []) as Recurso[])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudieron cargar los recursos.')
      setRecursos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function eliminar(id: string) {
    const ok = window.confirm('¿Seguro que quieres eliminar este recurso?')
    if (!ok) return

    try {
      const { error } = await supabase
        .from('recursos')
        .delete()
        .eq('id', id)

      if (error) throw error

      await load()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo eliminar el recurso.')
    }
  }

  const totalRecursos = recursos.length
  const totalActivos = recursos.filter((r) => r.estado?.toLowerCase() === 'activo').length
  const totalInactivos = recursos.filter((r) => r.estado?.toLowerCase() === 'inactivo').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Operaciones</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Recursos
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Gestión de espacios y recursos.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <ActionCard
            title="Nuevo recurso"
            description="Crear un nuevo espacio o recurso."
            href="/admin/operaciones/recursos/nuevo"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total recursos"
          value={totalRecursos}
        />
        <StatCard
          title="Activos"
          value={totalActivos}
          color="text-emerald-400"
        />
        <StatCard
          title="Inactivos"
          value={totalInactivos}
          color="text-rose-400"
        />
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      <Section
        title="Listado de recursos"
        description="Administra recursos, capacidad, estado y accesos rápidos."
        className="p-0"
        contentClassName="overflow-hidden"
      >
        {loading ? (
          <div className="p-6">
            <p className="text-sm text-white/55">Cargando recursos...</p>
          </div>
        ) : recursos.length === 0 ? (
          <div className="p-6">
            <p className="text-sm text-white/55">No hay recursos registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03]">
                <tr>
                  <th className="p-4 text-left font-medium text-white/55">Nombre</th>
                  <th className="p-4 text-left font-medium text-white/55">Tipo</th>
                  <th className="p-4 text-left font-medium text-white/55">Capacidad</th>
                  <th className="p-4 text-left font-medium text-white/55">Estado</th>
                  <th className="p-4 text-right font-medium text-white/55">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {recursos.map((r) => (
                  <tr key={r.id} className="transition hover:bg-white/[0.03]">
                    <td className="p-4">
                      <p className="font-medium text-white">
                        {r.nombre || 'Sin nombre'}
                      </p>
                    </td>

                    <td className="p-4 text-white/75 capitalize">
                      {r.tipo || '—'}
                    </td>

                    <td className="p-4 text-white/75">
                      {r.capacidad ?? '—'}
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${estadoBadgeClasses(
                          r.estado || ''
                        )}`}
                      >
                        {r.estado || 'sin estado'}
                      </span>
                    </td>

                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/operaciones/recursos/${r.id}`}
                          className="
                            rounded-xl border border-white/10 bg-white/[0.03]
                            px-3 py-2 text-xs font-medium text-white/80 transition
                            hover:bg-white/[0.06]
                          "
                        >
                          Ver
                        </Link>

                        <Link
                          href={`/admin/operaciones/recursos/${r.id}/editar`}
                          className="
                            rounded-xl border border-white/10 bg-white/[0.03]
                            px-3 py-2 text-xs font-medium text-white/80 transition
                            hover:bg-white/[0.06]
                          "
                        >
                          Editar
                        </Link>

                        <button
                          type="button"
                          onClick={() => eliminar(r.id)}
                          className="
                            rounded-xl border border-rose-400/20 bg-rose-400/10
                            px-3 py-2 text-xs font-medium text-rose-300 transition
                            hover:bg-rose-400/15
                          "
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}