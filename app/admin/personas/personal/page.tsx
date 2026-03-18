'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type Empleado = {
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

export default function PersonalPage() {
  const [loading, setLoading] = useState(true)
  const [personal, setPersonal] = useState<Empleado[]>([])

  const [search, setSearch] = useState('')
  const [rol, setRol] = useState('todos')
  const [estado, setEstado] = useState('todos')

  useEffect(() => {
    loadPersonal()
  }, [])

  async function loadPersonal() {
    setLoading(true)

    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .order('nombre', { ascending: true })

    if (error) {
      console.error(error)
      setPersonal([])
      setLoading(false)
      return
    }

    setPersonal((data || []) as Empleado[])
    setLoading(false)
  }

  const filtrado = useMemo(() => {
    return personal.filter((item) => {
      const q = search.trim().toLowerCase()

      const matchSearch =
        !q ||
        item.nombre?.toLowerCase().includes(q) ||
        item.email?.toLowerCase().includes(q) ||
        item.telefono?.toLowerCase().includes(q) ||
        item.rol?.toLowerCase().includes(q)

      const matchRol = rol === 'todos' ? true : item.rol === rol
      const matchEstado = estado === 'todos' ? true : item.estado === estado

      return matchSearch && matchRol && matchEstado
    })
  }, [personal, search, rol, estado])

  const resumen = useMemo(() => {
    return {
      total: filtrado.length,
      activos: filtrado.filter((x) => x.estado === 'activo').length,
      terapeutas: filtrado.filter((x) => x.rol === 'terapeuta').length,
      entrenadores: filtrado.filter((x) => x.rol === 'entrenador').length,
    }
  }, [filtrado])

  async function cambiarEstado(id: string, nuevoEstado: string) {
    const { error } = await supabase.from('empleados').update({ estado: nuevoEstado }).eq('id', id)

    if (error) {
      console.error(error)
      alert('No se pudo actualizar el estado.')
      return
    }

    setPersonal((prev) =>
      prev.map((item) => (item.id === id ? { ...item, estado: nuevoEstado } : item))
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Personas</p>
          <h1 className="text-2xl font-bold text-slate-900">Personal</h1>
          <p className="mt-1 text-sm text-slate-600">
            Gestión de terapeutas, entrenadores y personal del centro.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/admin/personas/personal/nuevo"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Nuevo personal
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.total}</p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Activos</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.activos}</p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Terapeutas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.terapeutas}</p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Entrenadores</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.entrenadores}</p>
        </div>
      </div>

      <section className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3">
          <input
            type="text"
            placeholder="Buscar nombre, email, teléfono, rol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />

          <select
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          >
            <option value="todos">Todos los roles</option>
            <option value="terapeuta">Terapeuta</option>
            <option value="entrenador">Entrenador</option>
            <option value="recepcion">Recepción</option>
            <option value="admin">Admin</option>
          </select>

          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          >
            <option value="todos">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="vacaciones">Vacaciones</option>
          </select>
        </div>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                <th className="px-4 py-3 text-left font-semibold">Rol</th>
                <th className="px-4 py-3 text-left font-semibold">Contacto</th>
                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                <th className="px-4 py-3 text-left font-semibold">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    Cargando personal...
                  </td>
                </tr>
              ) : filtrado.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    No hay personal para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filtrado.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{item.nombre || 'Sin nombre'}</div>
                      <div className="text-xs text-slate-500">{item.id}</div>
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {item.rol || 'Sin rol'}
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      <div>{item.email || 'Sin email'}</div>
                      <div className="text-xs text-slate-500">{item.telefono || 'Sin teléfono'}</div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoClasses(item.estado)}`}
                      >
                        {item.estado || 'Sin estado'}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => cambiarEstado(item.id, 'activo')}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                          Activar
                        </button>

                        <button
                          onClick={() => cambiarEstado(item.id, 'inactivo')}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          Inactivar
                        </button>

                        <Link
                          href={`/admin/personas/personal/${item.id}`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Ver
                        </Link>

                        <Link
                          href={`/admin/personas/personal/${item.id}/editar`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Editar
                        </Link>

                        <Link
                          href={`/admin/personas/personal/${item.id}/agenda`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Agenda
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}