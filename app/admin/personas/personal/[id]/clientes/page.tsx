'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'

type ClienteBase = {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  estado: string | null
}

type ClientePlanRow = {
  id: string
  cliente_id: string
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
  sesiones_totales: number | null
  sesiones_usadas: number | null
  created_at: string | null
  planes: {
    nombre: string | null
    precio: number | null
    vigencia_dias: number | null
  } | null
}

type ClienteRelacionado = {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  estado: string | null
  plan_activo_nombre: string | null
  plan_precio: number | null
  plan_estado: string | null
  fecha_inicio_plan: string | null
  fecha_fin_plan: string | null
  sesiones_totales: number
  sesiones_usadas: number
  sesiones_restantes: number
  quincena: string
}

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

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

function money(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatFecha(fecha: string | null) {
  if (!fecha) return '—'
  try {
    return new Date(`${fecha}T00:00:00`).toLocaleDateString()
  } catch {
    return fecha
  }
}

function planBadge(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'activo':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'vencido':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'agotado':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'cancelado':
      return 'border-white/10 bg-white/[0.05] text-white/70'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function clienteBadge(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'activo':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'inactivo':
      return 'border-white/10 bg-white/[0.05] text-white/70'
    case 'nuevo':
      return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
    case 'pausado':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function calcularQuincena(fechaInicio: string | null, fechaFin: string | null) {
  if (!fechaInicio || !fechaFin) return 'Sin rango'

  try {
    const inicio = new Date(`${fechaInicio}T00:00:00`)
    const fin = new Date(`${fechaFin}T00:00:00`)
    const hoy = new Date()

    const inicioMs = inicio.getTime()
    const finMs = fin.getTime()
    const hoyMs = hoy.getTime()

    if (hoyMs < inicioMs) return 'Pendiente'
    if (hoyMs > finMs) return 'Finalizada'

    const mitad = inicioMs + (finMs - inicioMs) / 2

    return hoyMs <= mitad ? '1ra quincena' : '2da quincena'
  } catch {
    return 'Sin rango'
  }
}

export default function PersonalClientesPage() {
  const router = useRouter()
  const params = useParams()

  const id =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : ''

  const [loading, setLoading] = useState(true)
  const [nombrePersonal, setNombrePersonal] = useState('')
  const [clientes, setClientes] = useState<ClienteRelacionado[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  const [search, setSearch] = useState('')
  const [estado, setEstado] = useState('todos')

  useEffect(() => {
    if (!id) {
      setErrorMsg('No se recibió un identificador válido.')
      setLoading(false)
      return
    }

    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadData() {
    setLoading(true)
    setErrorMsg('')

    try {
      const [empleadoRes, clientesRes, planesRes] = await Promise.all([
        supabase
          .from('empleados')
          .select('id, nombre')
          .eq('id', id)
          .limit(1)
          .maybeSingle(),

        supabase
          .from('clientes')
          .select('id, nombre, email, telefono, estado, terapeuta_id')
          .eq('terapeuta_id', id)
          .order('nombre', { ascending: true }),

        supabase
          .from('clientes_planes')
          .select(`
            id,
            cliente_id,
            estado,
            fecha_inicio,
            fecha_fin,
            sesiones_totales,
            sesiones_usadas,
            created_at,
            planes:plan_id (
              nombre,
              precio,
              vigencia_dias
            )
          `)
          .order('created_at', { ascending: false }),
      ])

      if (empleadoRes.error || !empleadoRes.data) {
        throw new Error(empleadoRes.error?.message || 'No se pudo cargar el personal.')
      }

      if (clientesRes.error) {
        throw new Error(clientesRes.error.message || 'No se pudieron cargar los clientes.')
      }

      if (planesRes.error) {
        throw new Error(planesRes.error.message || 'No se pudieron cargar los planes.')
      }

      setNombrePersonal(empleadoRes.data.nombre || 'Personal')

      const planesMap = new Map<string, ClientePlanRow>()

      for (const plan of (planesRes.data || []) as unknown as ClientePlanRow[]) {
        if (!plan?.cliente_id) continue
        if (planesMap.has(plan.cliente_id)) continue
        planesMap.set(plan.cliente_id, plan)
      }

      const rows: ClienteRelacionado[] = ((clientesRes.data || []) as any[]).map((cliente) => {
        const plan = planesMap.get(cliente.id) || null
        const sesionesTotales = Number(plan?.sesiones_totales || 0)
        const sesionesUsadas = Number(plan?.sesiones_usadas || 0)

        return {
          id: cliente.id,
          nombre: cliente.nombre || 'Sin nombre',
          email: cliente.email || null,
          telefono: cliente.telefono || null,
          estado: cliente.estado || null,
          plan_activo_nombre: plan?.planes?.nombre || null,
          plan_precio: plan?.planes?.precio || null,
          plan_estado: plan?.estado || null,
          fecha_inicio_plan: plan?.fecha_inicio || null,
          fecha_fin_plan: plan?.fecha_fin || null,
          sesiones_totales: sesionesTotales,
          sesiones_usadas: sesionesUsadas,
          sesiones_restantes: Math.max(0, sesionesTotales - sesionesUsadas),
          quincena: calcularQuincena(plan?.fecha_inicio || null, plan?.fecha_fin || null),
        }
      })

      setClientes(rows)
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err?.message || 'No se pudieron cargar los clientes del personal.')
      setClientes([])
    } finally {
      setLoading(false)
    }
  }

  const filtrados = useMemo(() => {
    return clientes.filter((c) => {
      const q = search.trim().toLowerCase()

      const matchSearch =
        !q ||
        c.nombre?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.telefono?.toLowerCase().includes(q) ||
        c.plan_activo_nombre?.toLowerCase().includes(q)

      const matchEstado = estado === 'todos' ? true : (c.estado || '').toLowerCase() === estado

      return matchSearch && matchEstado
    })
  }, [clientes, search, estado])

  const resumen = useMemo(() => {
    return {
      total: filtrados.length,
      activos: filtrados.filter((x) => x.estado === 'activo').length,
      conPlan: filtrados.filter((x) => !!x.plan_activo_nombre).length,
      primeraQuincena: filtrados.filter((x) => x.quincena === '1ra quincena').length,
      segundaQuincena: filtrados.filter((x) => x.quincena === '2da quincena').length,
    }
  }, [filtrados])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-white/55">Personas</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Clientes del personal</h1>
          <p className="mt-2 text-sm text-white/55">Cargando información...</p>
        </div>

        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando clientes...</p>
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
            Clientes del personal
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Clientes relacionados con {nombrePersonal || 'este miembro del equipo'}.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            title="Volver al perfil"
            description="Regresar al detalle del personal."
            href={`/admin/personas/personal/${id}`}
          />

          <div>
            <button
              type="button"
              onClick={() => router.push('/admin/personas/clientes')}
              className="
                w-full rounded-3xl border border-white/10 bg-white/[0.03]
                p-5 text-left transition hover:bg-white/[0.06]
              "
            >
              <p className="font-medium text-white">Ver todos los clientes</p>
              <p className="mt-1 text-sm text-white/55">
                Ir al listado general de clientes.
              </p>
            </button>
          </div>
        </div>
      </div>

      {errorMsg ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{errorMsg}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total" value={resumen.total} />
        <StatCard title="Activos" value={resumen.activos} color="text-emerald-400" />
        <StatCard title="Con plan" value={resumen.conPlan} color="text-sky-400" />
        <StatCard title="1ra quincena" value={resumen.primeraQuincena} color="text-amber-300" />
        <StatCard title="2da quincena" value={resumen.segundaQuincena} color="text-violet-400" />
      </div>

      <Section
        title="Filtros"
        description="Busca por nombre, email, teléfono o plan."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Buscar">
            <input
              type="text"
              placeholder="Buscar nombre, email, teléfono o plan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputClassName}
            />
          </Field>

          <Field label="Estado">
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className={inputClassName}
            >
              <option value="todos" className="bg-[#11131a] text-white">
                Todos los estados
              </option>
              <option value="activo" className="bg-[#11131a] text-white">
                Activo
              </option>
              <option value="inactivo" className="bg-[#11131a] text-white">
                Inactivo
              </option>
              <option value="nuevo" className="bg-[#11131a] text-white">
                Nuevo
              </option>
              <option value="pausado" className="bg-[#11131a] text-white">
                Pausado
              </option>
            </select>
          </Field>
        </div>
      </Section>

      <Section
        title="Listado de clientes"
        description="Datos del cliente, plan y avance de quincena."
        className="p-0"
        contentClassName="overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr className="text-left text-white/55">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Rango</th>
                <th className="px-4 py-3 font-medium">Sesiones</th>
                <th className="px-4 py-3 font-medium">Quincena</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {filtrados.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-white/55" colSpan={8}>
                    No hay clientes relacionados para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filtrados.map((cliente) => (
                  <tr key={cliente.id} className="align-top transition hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{cliente.nombre}</div>
                      <div className="text-xs text-white/40">{cliente.id}</div>
                    </td>

                    <td className="px-4 py-4 text-white/75">
                      <div>{cliente.email || 'Sin email'}</div>
                      <div className="text-xs text-white/45">
                        {cliente.telefono || 'Sin teléfono'}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${clienteBadge(
                          cliente.estado
                        )}`}
                      >
                        {cliente.estado || 'Sin estado'}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {cliente.plan_activo_nombre ? (
                        <div>
                          <div className="font-medium text-white">{cliente.plan_activo_nombre}</div>
                          <div className="mt-1 text-xs text-white/45">
                            {money(cliente.plan_precio)}
                          </div>
                          <div className="mt-2">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${planBadge(
                                cliente.plan_estado
                              )}`}
                            >
                              {cliente.plan_estado || 'Sin estado'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-white/55">Sin plan</span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-white/75">
                      <div>Inicio: {formatFecha(cliente.fecha_inicio_plan)}</div>
                      <div className="mt-1 text-xs text-white/45">
                        Fin: {formatFecha(cliente.fecha_fin_plan)}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-white/75">
                      {cliente.plan_activo_nombre ? (
                        <div>
                          <div>
                            {cliente.sesiones_usadas}/{cliente.sesiones_totales}
                          </div>
                          <div className="mt-1 text-xs text-white/45">
                            Restantes: {cliente.sesiones_restantes}
                          </div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="px-4 py-4 text-white/75">
                      {cliente.quincena}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/personas/clientes/${cliente.id}`}
                          className="
                            rounded-xl border border-white/10 bg-white/[0.03]
                            px-3 py-1.5 text-xs font-semibold text-white/80
                            transition hover:bg-white/[0.06]
                          "
                        >
                          Ver cliente
                        </Link>

                        <Link
                          href={`/admin/personas/clientes/${cliente.id}/plan`}
                          className="
                            rounded-xl border border-white/10 bg-white/[0.03]
                            px-3 py-1.5 text-xs font-semibold text-white/80
                            transition hover:bg-white/[0.06]
                          "
                        >
                          Ver plan
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