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
  sesiones_totales: number | null
  sesiones_usadas: number | null
  estado: string
  fecha_fin: string | null
  created_at?: string | null
  planes: {
    nombre: string
    precio: number | null
    vigencia_dias?: number | null
  } | null
}

type Pago = {
  id: string
  cliente_id: string | null
  fecha: string
  monto: number | null
  estado: string
}

type ClienteRow = {
  cliente: Cliente
  planActivo: ClientePlan | null
  ultimoPago: Pago | null
  sesionesRestantes: number
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
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'inactivo':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    case 'pausado':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'vencido':
      return 'bg-rose-50 text-rose-700 border-rose-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function getRestantes(plan: ClientePlan | null) {
  if (!plan) return 0
  const total = Number(plan.sesiones_totales || 0)
  const usadas = Number(plan.sesiones_usadas || 0)
  return Math.max(0, total - usadas)
}

export default function ClientesPage() {
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [planesActivos, setPlanesActivos] = useState<ClientePlan[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [error, setError] = useState('')

  useEffect(() => {
    void loadClientes()
  }, [])

  async function loadClientes() {
    setLoading(true)
    setError('')

    try {
      const [clientesRes, planesRes, pagosRes] = await Promise.all([
        supabase
          .from('clientes')
          .select('id, nombre, telefono, email, estado, created_at')
          .order('created_at', { ascending: false }),

        supabase
          .from('clientes_planes')
          .select(`
            id,
            cliente_id,
            sesiones_totales,
            sesiones_usadas,
            estado,
            fecha_fin,
            created_at,
            planes:plan_id (
              nombre,
              precio,
              vigencia_dias
            )
          `)
          .eq('estado', 'activo'),

        supabase
          .from('pagos')
          .select('id, cliente_id, fecha, monto, estado')
          .eq('estado', 'pagado')
          .order('fecha', { ascending: false }),
      ])

      if (clientesRes.error) {
        throw new Error(clientesRes.error.message)
      }

      if (planesRes.error) {
        console.error('Error cargando planes activos:', planesRes.error.message)
      }

      if (pagosRes.error) {
        console.error('Error cargando pagos:', pagosRes.error.message)
      }

      setClientes((clientesRes.data || []) as Cliente[])
      setPlanesActivos((planesRes.data || []) as unknown as ClientePlan[])
      setPagos((pagosRes.data || []) as Pago[])
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

  const planMap = useMemo(() => {
    const map = new Map<string, ClientePlan>()

    for (const plan of planesActivos) {
      if (!plan?.cliente_id) continue

      const current = map.get(plan.cliente_id)

      if (!current) {
        map.set(plan.cliente_id, plan)
        continue
      }

      const currentDate = current.created_at ? new Date(current.created_at).getTime() : 0
      const nextDate = plan.created_at ? new Date(plan.created_at).getTime() : 0

      if (nextDate >= currentDate) {
        map.set(plan.cliente_id, plan)
      }
    }

    return map
  }, [planesActivos])

  const pagoMap = useMemo(() => {
    const map = new Map<string, Pago>()

    for (const pago of pagos) {
      if (!pago?.cliente_id) continue
      if (!map.has(pago.cliente_id)) {
        map.set(pago.cliente_id, pago)
      }
    }

    return map
  }, [pagos])

  const rows = useMemo<ClienteRow[]>(() => {
    return clientes.map((cliente) => {
      const planActivo = planMap.get(cliente.id) || null
      const ultimoPago = pagoMap.get(cliente.id) || null

      return {
        cliente,
        planActivo,
        ultimoPago,
        sesionesRestantes: getRestantes(planActivo),
      }
    })
  }, [clientes, planMap, pagoMap])

  const clientesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()

    return rows.filter(({ cliente, planActivo }) => {
      const matchSearch =
        !q ||
        cliente.nombre?.toLowerCase().includes(q) ||
        cliente.email?.toLowerCase().includes(q) ||
        cliente.telefono?.toLowerCase().includes(q) ||
        cliente.estado?.toLowerCase().includes(q) ||
        planActivo?.planes?.nombre?.toLowerCase().includes(q)

      const matchEstado =
        estadoFiltro === 'todos' ||
        cliente.estado?.toLowerCase() === estadoFiltro.toLowerCase()

      return matchSearch && matchEstado
    })
  }, [rows, search, estadoFiltro])

  const stats = useMemo(() => {
    const total = rows.length
    const activos = rows.filter((r) => r.cliente.estado === 'activo').length
    const conPlan = rows.filter((r) => !!r.planActivo).length
    const sinPlan = rows.filter((r) => !r.planActivo).length
    const porVencer = rows.filter((r) => {
      if (!r.planActivo?.fecha_fin) return false
      const fin = new Date(r.planActivo.fecha_fin)
      const hoy = new Date()
      const diff = fin.getTime() - hoy.getTime()
      const dias = Math.ceil(diff / (1000 * 60 * 60 * 24))
      return dias >= 0 && dias <= 7
    }).length

    return { total, activos, conPlan, sinPlan, porVencer }
  }, [rows])

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Administración</p>
        <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Clientes</h1>
            <p className="text-sm text-slate-600">
              Listado general de clientes, plan activo, sesiones y último pago.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/personas/clientes/nuevo"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Nuevo cliente
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total clientes</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.total}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Clientes activos</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{stats.activos}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Con plan activo</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.conPlan}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Sin plan activo</p>
          <p className="mt-2 text-2xl font-semibold text-amber-600">{stats.sinPlan}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Planes por vencer</p>
          <p className="mt-2 text-2xl font-semibold text-rose-600">{stats.porVencer}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Buscar</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, correo, teléfono, estado o plan..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none transition focus:border-slate-500"
            >
              <option value="todos">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
              <option value="pausado">Pausados</option>
            </select>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-sm text-slate-600">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Plan activo</th>
                <th className="px-4 py-3 font-medium">Sesiones</th>
                <th className="px-4 py-3 font-medium">Último pago</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    Cargando clientes...
                  </td>
                </tr>
              ) : clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No hay clientes registrados.
                  </td>
                </tr>
              ) : (
                clientesFiltrados.map(({ cliente, planActivo, ultimoPago, sesionesRestantes }) => (
                  <tr key={cliente.id} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{cliente.nombre}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        Registro: {formatDate(cliente.created_at)}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="text-slate-700">{cliente.email || 'Sin correo'}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {cliente.telefono || 'Sin teléfono'}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoBadge(
                          cliente.estado
                        )}`}
                      >
                        {cliente.estado}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {planActivo ? (
                        <div>
                          <div className="font-medium text-slate-900">
                            {planActivo.planes?.nombre || 'Plan'}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Vence: {formatDate(planActivo.fecha_fin)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Valor: {money(planActivo.planes?.precio)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">Sin plan activo</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {planActivo ? (
                        <div>
                          <div className="font-medium text-slate-900">
                            {Number(planActivo.sesiones_usadas || 0)}/
                            {Number(planActivo.sesiones_totales || 0)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Restantes: {sesionesRestantes}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {ultimoPago ? (
                        <div>
                          <div className="font-medium text-slate-900">{money(ultimoPago.monto)}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatDate(ultimoPago.fecha)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">Sin pagos</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/personas/clientes/${cliente.id}`}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Ver
                        </Link>

                        <Link
                          href={`/admin/personas/clientes/${cliente.id}/plan`}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Plan
                        </Link>

                        <Link
                          href={`/admin/personas/clientes/${cliente.id}/editar`}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
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
      </section>
    </div>
  )
}