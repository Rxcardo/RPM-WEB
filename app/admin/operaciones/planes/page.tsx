'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'

type Plan = {
  id: string
  nombre: string
  descripcion: string | null
  sesiones_totales: number | null
  vigencia_dias: number | null
  precio: number | null
  estado: string
  created_at: string
}

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

function estadoBadge(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'activo':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'inactivo':
      return 'border-white/10 bg-white/[0.05] text-white/70'
    case 'borrador':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/75">{label}</label>
      {children}
    </div>
  )
}

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

export default function PlanesPage() {
  const [loading, setLoading] = useState(true)
  const [planes, setPlanes] = useState<Plan[]>([])
  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [error, setError] = useState('')

  useEffect(() => {
    void loadPlanes()
  }, [])

  async function loadPlanes() {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('planes')
        .select(
          'id, nombre, descripcion, sesiones_totales, vigencia_dias, precio, estado, created_at'
        )
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(error.message)
      }

      setPlanes((data || []) as Plan[])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudieron cargar los planes.')
      setPlanes([])
    } finally {
      setLoading(false)
    }
  }

  const planesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()

    return planes.filter((plan) => {
      const matchSearch =
        !q ||
        plan.nombre.toLowerCase().includes(q) ||
        plan.descripcion?.toLowerCase().includes(q) ||
        plan.estado?.toLowerCase().includes(q) ||
        String(plan.sesiones_totales || '').includes(q) ||
        String(plan.vigencia_dias || '').includes(q) ||
        String(plan.precio || '').includes(q)

      const matchEstado =
        estadoFiltro === 'todos' || plan.estado?.toLowerCase() === estadoFiltro.toLowerCase()

      return matchSearch && matchEstado
    })
  }, [planes, search, estadoFiltro])

  const stats = useMemo(() => {
    const total = planes.length
    const activos = planes.filter((p) => p.estado?.toLowerCase() === 'activo').length
    const inactivos = planes.filter((p) => p.estado?.toLowerCase() === 'inactivo').length
    const precioPromedio =
      total > 0
        ? planes.reduce((acc, plan) => acc + Number(plan.precio || 0), 0) / total
        : 0
    const sesionesPromedio =
      total > 0
        ? planes.reduce((acc, plan) => acc + Number(plan.sesiones_totales || 0), 0) / total
        : 0

    return {
      total,
      activos,
      inactivos,
      precioPromedio,
      sesionesPromedio,
    }
  }, [planes])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Operaciones</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Planes
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Catálogo de planes, sesiones, vigencia y precio.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <ActionCard
            title="Nuevo plan"
            description="Crear un nuevo plan en el catálogo."
            href="/admin/operaciones/planes/nuevo"
          />
        </div>
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Total planes"
          value={stats.total}
        />

        <StatCard
          title="Activos"
          value={stats.activos}
          color="text-emerald-400"
        />

        <StatCard
          title="Inactivos"
          value={stats.inactivos}
          color="text-white/80"
        />

        <StatCard
          title="Precio promedio"
          value={money(stats.precioPromedio)}
        />

        <StatCard
          title="Sesiones promedio"
          value={Math.round(stats.sesionesPromedio)}
        />
      </div>

      <Section
        title="Filtros"
        description="Busca por nombre, descripción, estado, precio o filtra por estado."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <Field label="Buscar">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, descripción, estado, precio..."
                className={inputClassName}
              />
            </Field>
          </div>

          <div>
            <Field label="Estado">
              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className={inputClassName}
              >
                <option value="todos" className="bg-[#11131a] text-white">
                  Todos
                </option>
                <option value="activo" className="bg-[#11131a] text-white">
                  Activos
                </option>
                <option value="inactivo" className="bg-[#11131a] text-white">
                  Inactivos
                </option>
                <option value="borrador" className="bg-[#11131a] text-white">
                  Borrador
                </option>
              </select>
            </Field>
          </div>
        </div>
      </Section>

      <Section
        title="Listado de planes"
        description="Vista general del catálogo de planes."
        className="p-0"
        contentClassName="overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr className="text-left text-white/55">
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Descripción</th>
                <th className="px-4 py-3 font-medium">Sesiones</th>
                <th className="px-4 py-3 font-medium">Vigencia</th>
                <th className="px-4 py-3 font-medium">Precio</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Creado</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-white/55">
                    Cargando planes...
                  </td>
                </tr>
              ) : planesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-white/55">
                    No hay planes registrados.
                  </td>
                </tr>
              ) : (
                planesFiltrados.map((plan) => (
                  <tr key={plan.id} className="align-top transition hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{plan.nombre}</div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="max-w-xs text-white/75">
                        {plan.descripcion?.trim() || 'Sin descripción'}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium text-white">
                        {Number(plan.sesiones_totales || 0)}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium text-white">
                        {Number(plan.vigencia_dias || 0)} días
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{money(plan.precio)}</div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoBadge(
                          plan.estado
                        )}`}
                      >
                        {plan.estado}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="text-white/75">{formatDate(plan.created_at)}</div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/operaciones/planes/${plan.id}`}
                          className="
                            rounded-xl border border-white/10 bg-white/[0.03]
                            px-3 py-1.5 text-xs font-medium text-white/80
                            transition hover:bg-white/[0.06]
                          "
                        >
                          Ver
                        </Link>

                        <Link
                          href={`/admin/operaciones/planes/${plan.id}/editar`}
                          className="
                            rounded-xl border border-white/10 bg-white/[0.03]
                            px-3 py-1.5 text-xs font-medium text-white/80
                            transition hover:bg-white/[0.06]
                          "
                        >
                          Editar
                        </Link>
                      </div>
                    </td>
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