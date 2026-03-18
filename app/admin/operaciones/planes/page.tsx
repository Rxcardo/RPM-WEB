'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type Plan = {
  id: string
  nombre: string
  sesiones_totales: number
  vigencia_dias: number
  precio: number
  estado: 'activo' | 'inactivo'
  descripcion: string | null
  created_at: string
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value))
}

export default function PlanesPage() {
  const router = useRouter()

  const [planes, setPlanes] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')

  const fetchPlanes = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from('planes')
      .select('id, nombre, sesiones_totales, vigencia_dias, precio, estado, descripcion, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error cargando planes:', error.message)
      setPlanes([])
    } else {
      setPlanes((data as Plan[]) || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchPlanes()
  }, [])

  const planesFiltrados = useMemo(() => {
    return planes.filter((plan) => {
      const q = busqueda.trim().toLowerCase()

      const matchBusqueda =
        !q ||
        plan.nombre.toLowerCase().includes(q) ||
        plan.descripcion?.toLowerCase().includes(q)

      const matchEstado = !estadoFiltro || plan.estado === estadoFiltro

      return matchBusqueda && matchEstado
    })
  }, [planes, busqueda, estadoFiltro])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Planes</h1>
          <p className="mt-1 text-neutral-500">
            Gestión de planes y paquetes de sesiones
          </p>
        </div>

        <button
          onClick={() => router.push('/admin/operaciones/planes/nuevo')}
          className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          + Nuevo plan
        </button>
      </div>

      <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Buscar
            </label>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Nombre o descripción..."
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Estado
            </label>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
            >
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-neutral-500">Cargando planes...</div>
        ) : planesFiltrados.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-neutral-500">No hay planes registrados.</p>

            <button
              onClick={() => router.push('/admin/operaciones/planes/nuevo')}
              className="mt-4 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              Crear primer plan
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-sm">
              <thead className="bg-neutral-50">
                <tr className="text-left text-neutral-600">
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Sesiones</th>
                  <th className="px-4 py-3 font-semibold">Vigencia</th>
                  <th className="px-4 py-3 font-semibold">Precio</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {planesFiltrados.map((plan) => (
                  <tr
                    key={plan.id}
                    className="border-t border-black/5 transition hover:bg-violet-50/40"
                  >
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-neutral-900">{plan.nombre}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {plan.descripcion || 'Sin descripción'}
                        </p>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-neutral-800">{plan.sesiones_totales}</td>
                    <td className="px-4 py-4 text-neutral-800">{plan.vigencia_dias} días</td>
                    <td className="px-4 py-4 text-neutral-800">{formatMoney(plan.precio)}</td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          plan.estado === 'activo'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-neutral-200 text-neutral-700'
                        }`}
                      >
                        {plan.estado}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => router.push(`/admin/operaciones/planes/${plan.id}/editar`)}
                          className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}