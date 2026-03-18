'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type ClienteRelacionado = {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  estado: string | null
  total_citas: number
  ultima_cita: string | null
  proxima_cita: string | null
}

export default function PersonalClientesPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [nombrePersonal, setNombrePersonal] = useState('')
  const [clientes, setClientes] = useState<ClienteRelacionado[]>([])

  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState('todos')

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadData() {
    setLoading(true)

    const [empleadoRes, citasRes] = await Promise.all([
      supabase.from('empleados').select('id, nombre').eq('id', id).single(),
      supabase
        .from('citas')
        .select(`
          id,
          fecha,
          estado,
          cliente_id,
          clientes:cliente_id (
            id,
            nombre,
            email,
            telefono,
            estado
          )
        `)
        .eq('terapeuta_id', id)
        .neq('estado', 'cancelada')
        .order('fecha', { ascending: true }),
    ])

    if (empleadoRes.data) {
      setNombrePersonal(empleadoRes.data.nombre || 'Personal')
    }

    if (citasRes.error) {
      console.error(citasRes.error)
      setClientes([])
      setLoading(false)
      return
    }

    const hoy = new Date().toISOString().slice(0, 10)
    const map = new Map<string, ClienteRelacionado>()

    for (const row of (citasRes.data || []) as any[]) {
      const cliente = row.clientes
      if (!cliente?.id) continue

      if (!map.has(cliente.id)) {
        map.set(cliente.id, {
          id: cliente.id,
          nombre: cliente.nombre || 'Sin nombre',
          email: cliente.email || null,
          telefono: cliente.telefono || null,
          estado: cliente.estado || null,
          total_citas: 0,
          ultima_cita: null,
          proxima_cita: null,
        })
      }

      const actual = map.get(cliente.id)!
      actual.total_citas += 1

      if (!actual.ultima_cita || row.fecha > actual.ultima_cita) {
        if (row.fecha <= hoy) actual.ultima_cita = row.fecha
      }

      if (row.fecha >= hoy) {
        if (!actual.proxima_cita || row.fecha < actual.proxima_cita) {
          actual.proxima_cita = row.fecha
        }
      }
    }

    setClientes(Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)))
    setLoading(false)
  }

  const filtrados = useMemo(() => {
    return clientes.filter((c) => {
      const q = search.trim().toLowerCase()

      const matchSearch =
        !q ||
        c.nombre?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.telefono?.toLowerCase().includes(q)

      const matchEstado = estado === 'todos' ? true : c.estado === estado

      return matchSearch && matchEstado
    })
  }, [clientes, search, estado])

  const resumen = useMemo(() => {
    return {
      total: filtrados.length,
      activos: filtrados.filter((x) => x.estado === 'activo').length,
      conProxima: filtrados.filter((x) => !!x.proxima_cita).length,
      sinProxima: filtrados.filter((x) => !x.proxima_cita).length,
    }
  }, [filtrados])

  function formatFecha(fecha: string | null) {
    if (!fecha) return '—'
    try {
      return new Date(`${fecha}T00:00:00`).toLocaleDateString()
    } catch {
      return fecha
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Personas</p>
          <h1 className="text-2xl font-bold text-slate-900">Clientes del personal</h1>
          <p className="mt-1 text-sm text-slate-600">
            Clientes relacionados con {nombrePersonal || 'este miembro del equipo'}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/personas/personal/${id}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Volver al perfil
          </Link>

          <button
            onClick={() => router.push('/admin/personas/clientes')}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Ver todos los clientes
          </button>
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
          <p className="text-sm text-slate-500">Con próxima cita</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.conProxima}</p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Sin próxima cita</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.sinProxima}</p>
        </div>
      </div>

      <section className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="text"
            placeholder="Buscar nombre, email o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />

          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          >
            <option value="todos">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="nuevo">Nuevo</option>
          </select>
        </div>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                <th className="px-4 py-3 text-left font-semibold">Contacto</th>
                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                <th className="px-4 py-3 text-left font-semibold">Total citas</th>
                <th className="px-4 py-3 text-left font-semibold">Última cita</th>
                <th className="px-4 py-3 text-left font-semibold">Próxima cita</th>
                <th className="px-4 py-3 text-left font-semibold">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    Cargando clientes...
                  </td>
                </tr>
              ) : filtrados.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    No hay clientes relacionados para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filtrados.map((cliente) => (
                  <tr key={cliente.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{cliente.nombre}</div>
                      <div className="text-xs text-slate-500">{cliente.id}</div>
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      <div>{cliente.email || 'Sin email'}</div>
                      <div className="text-xs text-slate-500">{cliente.telefono || 'Sin teléfono'}</div>
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {cliente.estado || 'Sin estado'}
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {cliente.total_citas}
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {formatFecha(cliente.ultima_cita)}
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {formatFecha(cliente.proxima_cita)}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/personas/clientes/${cliente.id}`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Ver cliente
                        </Link>

                        <Link
                          href={`/admin/operaciones/agenda/nueva?cliente=${cliente.id}`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Nueva cita
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