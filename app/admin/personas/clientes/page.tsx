'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type Cliente = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  estado: string
  created_at: string
}

type ClientePlan = {
  id: string
  cliente_id: string
  sesiones_totales: number
  sesiones_usadas: number
  estado: string
  fecha_fin: string | null
  planes: {
    nombre: string
    precio: number
  } | null
}

type Pago = {
  id: string
  cliente_id: string | null
  fecha: string
  monto: number
  estado: string
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
  switch (estado) {
    case 'activo':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'inactivo':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    case 'pausado':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

export default function ClientesPage() {
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [planesActivos, setPlanesActivos] = useState<ClientePlan[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void loadClientes()
  }, [])

  async function loadClientes() {
    setLoading(true)
    setError('')

    try {
      const clientesRes = await supabase
        .from('clientes')
        .select('id, nombre, telefono, email, estado, created_at')
        .order('created_at', { ascending: false })

      if (clientesRes.error) {
        throw new Error(clientesRes.error.message)
      }

      setClientes((clientesRes.data || []) as Cliente[])

      await loadExtras()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudieron cargar los clientes.')
      setClientes([])
      setPlanesActivos([])
      setPagos([])
    } finally {
      setLoading(false)
    }
  }

  async function loadExtras() {
    try {
      const [planesRes, pagosRes] = await Promise.all([
        supabase
          .from('clientes_planes')
          .select(`
            id,
            cliente_id,
            sesiones_totales,
            sesiones_usadas,
            estado,
            fecha_fin,
            planes:plan_id (
              nombre,
              precio
            )
          `)
          .eq('estado', 'activo'),

        supabase
          .from('pagos')
          .select('id, cliente_id, fecha, monto, estado')
          .eq('estado', 'pagado')
          .order('fecha', { ascending: false }),
      ])

      if (!planesRes.error) {
        setPlanesActivos((planesRes.data || []) as unknown as ClientePlan[])
      }

      if (!pagosRes.error) {
        setPagos((pagosRes.data || []) as Pago[])
      }
    } catch (err) {
      console.error('Error cargando extras de clientes:', err)
    }
  }

  const clientesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clientes

    return clientes.filter((c) => {
      return (
        c.nombre?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.telefono?.toLowerCase().includes(q) ||
        c.estado?.toLowerCase().includes(q)
      )
    })
  }, [clientes, search])

  function getPlanActivo(clienteId: string) {
    return planesActivos.find((p) => p.cliente_id === clienteId) || null
  }

  function getUltimoPago(clienteId: string) {
    return pagos.find((p) => p.cliente_id === clienteId) || null
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Administración</p>
            <h1 className="text-2xl font-bold text-slate-900">Clientes</h1>
            <p className="mt-1 text-sm text-slate-600">
              Listado general de clientes, planes y pagos recientes.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/admin/personas/clientes/nuevo"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Nuevo cliente
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            type="text"
            placeholder="Buscar por nombre, email, teléfono o estado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                  <th className="px-4 py-3 text-left font-semibold">Contacto</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold">Plan activo</th>
                  <th className="px-4 py-3 text-left font-semibold">Sesiones</th>
                  <th className="px-4 py-3 text-left font-semibold">Último pago</th>
                  <th className="px-4 py-3 text-left font-semibold">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-slate-500">
                      Cargando clientes...
                    </td>
                  </tr>
                ) : clientesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-slate-500">
                      No hay clientes registrados.
                    </td>
                  </tr>
                ) : (
                  clientesFiltrados.map((cliente) => {
                    const plan = getPlanActivo(cliente.id)
                    const ultimoPago = getUltimoPago(cliente.id)
                    const restantes = plan
                      ? Math.max(0, Number(plan.sesiones_totales) - Number(plan.sesiones_usadas))
                      : 0

                    return (
                      <tr key={cliente.id} className="border-t border-slate-100">
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{cliente.nombre}</p>
                          <p className="text-xs text-slate-500">
                            {formatDate(cliente.created_at)}
                          </p>
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          <p>{cliente.email || 'Sin correo'}</p>
                          <p className="text-xs text-slate-500">
                            {cliente.telefono || 'Sin teléfono'}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(cliente.estado)}`}
                          >
                            {cliente.estado}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {plan ? (
                            <div>
                              <p className="font-medium text-slate-900">
                                {plan.planes?.nombre || 'Plan'}
                              </p>
                              <p className="text-xs text-slate-500">
                                Vence: {plan.fecha_fin || '—'}
                              </p>
                            </div>
                          ) : (
                            'Sin plan activo'
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {plan ? (
                            <div>
                              <p>
                                {plan.sesiones_usadas}/{plan.sesiones_totales}
                              </p>
                              <p className="text-xs text-slate-500">
                                Restantes: {restantes}
                              </p>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {ultimoPago ? (
                            <div>
                              <p className="font-medium text-slate-900">
                                {money(ultimoPago.monto)}
                              </p>
                              <p className="text-xs text-slate-500">{ultimoPago.fecha}</p>
                            </div>
                          ) : (
                            'Sin pagos'
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/admin/personas/clientes/${cliente.id}`}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Ver
                            </Link>

                            <Link
                              href={`/admin/personas/clientes/${cliente.id}/plan`}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Plan
                            </Link>

                            <Link
                              href={`/admin/personas/clientes/${cliente.id}/editar`}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Editar
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}