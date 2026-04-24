 'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'

type EmpleadoRef = {
  id: string
  nombre: string
  rol: string | null
} | null

type AuditorRef = {
  id: string
  nombre: string | null
} | null

type Cliente = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  estado: string
  created_at: string
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
  terapeuta_id: string | null
  empleado_id: string | null
  terapeuta: EmpleadoRef
  empleado: EmpleadoRef
  creado_por: AuditorRef
  editado_por: AuditorRef
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
    vigencia_valor?: number | null
    vigencia_tipo?: string | null
  } | null
}

type Pago = {
  id: string
  cliente_id: string | null
  cliente_plan_id?: string | null
  fecha: string
  monto: number | null
  moneda_pago: string | null
  estado: string
  created_at?: string | null
  monto_equivalente_usd?: number | null
  monto_equivalente_bs?: number | null
}

type ClienteRow = {
  cliente: Cliente
  planActivo: ClientePlan | null
  ultimoPago: Pago | null
  sesionesRestantes: number
  empleadoNombre: string
}

type PlanEstadoFiltro = 'todos' | 'con_plan' | 'sin_plan' | 'por_vencer'

type OrdenKey =
  | 'nombre_asc'
  | 'nombre_desc'
  | 'empleado_asc'
  | 'empleado_desc'
  | 'fecha_reciente'
  | 'fecha_antigua'
  | 'estado'
  | 'sesiones_mayor'
  | 'sesiones_menor'

function money(
  value: number | string | null | undefined,
  moneda: string = 'USD'
) {
  const amount = Number(value || 0)

  if ((moneda || '').toUpperCase() === 'BS') {
    return `Bs ${amount.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

function formatAuditDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function formatVigencia(
  valor: number | null | undefined,
  tipo: string | null | undefined
) {
  const n = Number(valor || 0)
  const t = (tipo || '').toLowerCase()

  if (!n) return '—'

  if (t === 'dias') return `${n} ${n === 1 ? 'día' : 'días'}`
  if (t === 'semanas') return `${n} ${n === 1 ? 'semana' : 'semanas'}`
  if (t === 'meses') return `${n} ${n === 1 ? 'mes' : 'meses'}`

  return `${n} ${tipo || ''}`.trim()
}

function estadoBadge(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'activo':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'inactivo':
      return 'border-white/10 bg-white/[0.05] text-white/70'
    case 'pausado':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'vencido':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function estadoPlanBadge(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'activo':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'agotado':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'vencido':
      return 'border-white/10 bg-white/[0.05] text-white/70'
    case 'renovado':
      return 'border-violet-400/20 bg-violet-400/10 text-violet-300'
    case 'cancelado':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function getPlanStatusLabel(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'activo':
      return 'Activo'
    case 'agotado':
      return 'Agotado'
    case 'vencido':
      return 'Vencido'
    case 'renovado':
      return 'Renovado'
    case 'cancelado':
      return 'Cancelado'
    default:
      return estado || 'Sin estado'
  }
}

function getRestantes(plan: ClientePlan | null) {
  if (!plan) return 0
  const total = Number(plan.sesiones_totales || 0)
  const usadas = Number(plan.sesiones_usadas || 0)
  return Math.max(0, total - usadas)
}

function getPagoTimestamp(pago: Pago) {
  const primary = pago.created_at || pago.fecha
  const time = new Date(primary).getTime()
  return Number.isNaN(time) ? 0 : time
}

function getDateTimestamp(value: string | null | undefined) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function formatEmpleadoLabel(ref: EmpleadoRef) {
  if (!ref?.nombre?.trim()) return ''

  const nombre = ref.nombre.trim()
  const rol = (ref.rol || '').trim().toLowerCase()

  if (rol === 'terapeuta' || rol === 'fisioterapeuta') {
    return `${nombre} (Fisioterapeuta)`
  }

  if (rol === 'entrenador') {
    return `${nombre} (Entrenador)`
  }

  if (rol) {
    return `${nombre} (${rol})`
  }

  return nombre
}

function resolveEmpleadoNombre(cliente: Cliente) {
  const fisioterapeuta = formatEmpleadoLabel(cliente.terapeuta)
  const empleado = formatEmpleadoLabel(cliente.empleado)

  if (fisioterapeuta && empleado) {
    if (fisioterapeuta.toLowerCase() === empleado.toLowerCase()) {
      return fisioterapeuta
    }
    return `${fisioterapeuta} / ${empleado}`
  }

  return fisioterapeuta || empleado || 'Sin asignar'
}

function getAuditLines(cliente: Cliente) {
  const creador = cliente.creado_por?.nombre || 'Sin registro'
  const editor = cliente.editado_por?.nombre || 'Sin registro'

  const createdAt = formatAuditDate(cliente.created_at)
  const updatedAt = formatAuditDate(cliente.updated_at)

  const wasEdited =
    !!cliente.updated_at &&
    cliente.updated_at !== cliente.created_at &&
    !!cliente.updated_by

  if (!wasEdited) {
    return [`Creó: ${creador} · ${createdAt}`]
  }

  return [
    `Creó: ${creador} · ${createdAt}`,
    `Editó: ${editor} · ${updatedAt}`,
  ]
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

export default function ClientesPage() {
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [planesActivos, setPlanesActivos] = useState<ClientePlan[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])

  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [empleadoFiltro, setEmpleadoFiltro] = useState('todos')
  const [planEstadoFiltro, setPlanEstadoFiltro] = useState<PlanEstadoFiltro>('todos')
  const [planNombreFiltro, setPlanNombreFiltro] = useState('todos')
  const [ordenPor, setOrdenPor] = useState<OrdenKey>('nombre_asc')
  const [error, setError] = useState('')

  useEffect(() => {
    void loadClientes()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const planEstado = params.get('planEstado')

    if (planEstado === 'activo' || planEstado === 'con_plan') {
      setPlanEstadoFiltro('con_plan')
    }

    if (planEstado === 'sin_plan') {
      setPlanEstadoFiltro('sin_plan')
    }

    if (planEstado === 'por_vencer') {
      setPlanEstadoFiltro('por_vencer')
    }
  }, [])

  async function loadClientes() {
    setLoading(true)
    setError('')

    try {
      const [clientesRes, planesRes, pagosRes] = await Promise.all([
        supabase
          .from('clientes')
          .select(`
            id,
            nombre,
            telefono,
            email,
            estado,
            created_at,
            updated_at,
            created_by,
            updated_by,
            terapeuta_id,
            empleado_id,
            terapeuta:terapeuta_id (
              id,
              nombre,
              rol
            ),
            empleado:empleado_id (
              id,
              nombre,
              rol
            ),
            creado_por:created_by (
              id,
              nombre
            ),
            editado_por:updated_by (
              id,
              nombre
            )
          `)
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
              vigencia_valor,
              vigencia_tipo
            )
          `)
          .eq('estado', 'activo'),

        supabase
          .from('pagos')
          .select(
            'id, cliente_id, cliente_plan_id, fecha, monto, moneda_pago, estado, created_at, monto_equivalente_usd, monto_equivalente_bs'
          )
          .eq('estado', 'pagado')
          .order('created_at', { ascending: false }),
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

      setClientes((clientesRes.data || []) as unknown as Cliente[])
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

  const planIdToClienteIdMap = useMemo(() => {
    const map = new Map<string, string>()

    for (const plan of planesActivos) {
      if (!plan?.id || !plan?.cliente_id) continue
      map.set(plan.id, plan.cliente_id)
    }

    return map
  }, [planesActivos])

  const pagoMap = useMemo(() => {
    const map = new Map<string, Pago>()

    for (const pago of pagos) {
      const resolvedClienteId =
        pago.cliente_id ||
        (pago.cliente_plan_id ? planIdToClienteIdMap.get(pago.cliente_plan_id) || null : null)

      if (!resolvedClienteId) continue

      const current = map.get(resolvedClienteId)

      if (!current) {
        map.set(resolvedClienteId, pago)
        continue
      }

      const currentTime = getPagoTimestamp(current)
      const nextTime = getPagoTimestamp(pago)

      if (nextTime >= currentTime) {
        map.set(resolvedClienteId, pago)
      }
    }

    return map
  }, [pagos, planIdToClienteIdMap])

  const rows = useMemo<ClienteRow[]>(() => {
    return clientes.map((cliente) => {
      const planActivo = planMap.get(cliente.id) || null
      const ultimoPago = pagoMap.get(cliente.id) || null
      const empleadoNombre = resolveEmpleadoNombre(cliente)

      return {
        cliente,
        planActivo,
        ultimoPago,
        sesionesRestantes: getRestantes(planActivo),
        empleadoNombre,
      }
    })
  }, [clientes, planMap, pagoMap])

  const empleadosOptions = useMemo(() => {
    const set = new Set<string>()

    for (const row of rows) {
      if (row.empleadoNombre !== 'Sin asignar') {
        set.add(row.empleadoNombre)
      }
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [rows])

  const planOptions = useMemo(() => {
    const set = new Set<string>()

    for (const row of rows) {
      const nombrePlan = row.planActivo?.planes?.nombre?.trim()
      if (nombrePlan) set.add(nombrePlan)
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [rows])

  function isPlanPorVencer(plan: ClientePlan | null) {
    if (!plan?.fecha_fin) return false
    const fin = new Date(`${plan.fecha_fin}T00:00:00`)
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const diff = fin.getTime() - hoy.getTime()
    const dias = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return dias >= 0 && dias <= 7
  }

  function limpiarFiltros() {
    setSearch('')
    setEstadoFiltro('todos')
    setEmpleadoFiltro('todos')
    setPlanEstadoFiltro('todos')
    setPlanNombreFiltro('todos')
    setOrdenPor('nombre_asc')
  }

  const clientesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()

    const filtered = rows.filter(({ cliente, planActivo, empleadoNombre }) => {
      const matchSearch =
        !q ||
        cliente.nombre?.toLowerCase().includes(q) ||
        cliente.email?.toLowerCase().includes(q) ||
        cliente.telefono?.toLowerCase().includes(q) ||
        cliente.estado?.toLowerCase().includes(q) ||
        planActivo?.planes?.nombre?.toLowerCase().includes(q) ||
        empleadoNombre.toLowerCase().includes(q)

      const matchEstado =
        estadoFiltro === 'todos' ||
        cliente.estado?.toLowerCase() === estadoFiltro.toLowerCase()

      const matchEmpleado =
        empleadoFiltro === 'todos' ||
        empleadoNombre.toLowerCase() === empleadoFiltro.toLowerCase()

      const matchPlanEstado =
        planEstadoFiltro === 'todos' ||
        (planEstadoFiltro === 'con_plan' && !!planActivo) ||
        (planEstadoFiltro === 'sin_plan' && !planActivo) ||
        (planEstadoFiltro === 'por_vencer' && isPlanPorVencer(planActivo))

      const matchPlanNombre =
        planNombreFiltro === 'todos' ||
        (planActivo?.planes?.nombre || '').toLowerCase() === planNombreFiltro.toLowerCase()

      return matchSearch && matchEstado && matchEmpleado && matchPlanEstado && matchPlanNombre
    })

    filtered.sort((a, b) => {
      switch (ordenPor) {
        case 'nombre_asc':
          return a.cliente.nombre.localeCompare(b.cliente.nombre, 'es')
        case 'nombre_desc':
          return b.cliente.nombre.localeCompare(a.cliente.nombre, 'es')
        case 'empleado_asc':
          return a.empleadoNombre.localeCompare(b.empleadoNombre, 'es')
        case 'empleado_desc':
          return b.empleadoNombre.localeCompare(a.empleadoNombre, 'es')
        case 'fecha_reciente':
          return getDateTimestamp(b.cliente.created_at) - getDateTimestamp(a.cliente.created_at)
        case 'fecha_antigua':
          return getDateTimestamp(a.cliente.created_at) - getDateTimestamp(b.cliente.created_at)
        case 'estado':
          return (a.cliente.estado || '').localeCompare(b.cliente.estado || '', 'es')
        case 'sesiones_mayor':
          return b.sesionesRestantes - a.sesionesRestantes
        case 'sesiones_menor':
          return a.sesionesRestantes - b.sesionesRestantes
        default:
          return 0
      }
    })

    return filtered
  }, [rows, search, estadoFiltro, empleadoFiltro, planEstadoFiltro, planNombreFiltro, ordenPor])

  const stats = useMemo(() => {
    const total = rows.length
    const activos = rows.filter((r) => r.cliente.estado === 'activo').length
    const conPlan = rows.filter((r) => !!r.planActivo).length
    const sinPlan = rows.filter((r) => !r.planActivo).length
    const porVencer = rows.filter((r) => isPlanPorVencer(r.planActivo)).length

    return { total, activos, conPlan, sinPlan, porVencer }
  }, [rows])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Administración</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Clientes
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Listado general de clientes, plan activo, sesiones y último pago.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <ActionCard
            title="Nuevo cliente"
            description="Crear un nuevo cliente en el sistema."
            href="/admin/personas/clientes/nuevo"
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
        <button type="button" onClick={() => setPlanEstadoFiltro('todos')} className="text-left transition hover:-translate-y-0.5 hover:opacity-90">
          <StatCard title="Total clientes" value={stats.total} />
        </button>
        <button type="button" onClick={() => setEstadoFiltro('activo')} className="text-left transition hover:-translate-y-0.5 hover:opacity-90">
          <StatCard title="Clientes activos" value={stats.activos} color="text-emerald-400" />
        </button>
        <button type="button" onClick={() => setPlanEstadoFiltro('con_plan')} className="text-left transition hover:-translate-y-0.5 hover:opacity-90">
          <StatCard title="Con plan activo" value={stats.conPlan} />
        </button>
        <button type="button" onClick={() => setPlanEstadoFiltro('sin_plan')} className="text-left transition hover:-translate-y-0.5 hover:opacity-90">
          <StatCard title="Sin plan activo" value={stats.sinPlan} color="text-amber-300" />
        </button>
        <button type="button" onClick={() => setPlanEstadoFiltro('por_vencer')} className="text-left transition hover:-translate-y-0.5 hover:opacity-90">
          <StatCard title="Planes por vencer" value={stats.porVencer} color="text-rose-400" />
        </button>
      </div>

      <Section
        title="Filtros"
        description="Busca por nombre, correo, teléfono, estado, plan o empleado."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <Field label="Buscar">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, correo, teléfono, estado, plan o empleado..."
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
                <option value="todos" className="bg-[#11131a] text-white">Todos</option>
                <option value="activo" className="bg-[#11131a] text-white">Activos</option>
                <option value="inactivo" className="bg-[#11131a] text-white">Inactivos</option>
                <option value="pausado" className="bg-[#11131a] text-white">Pausados</option>
              </select>
            </Field>
          </div>

          <div>
            <Field label="Fisioterapeuta">
              <select
                value={empleadoFiltro}
                onChange={(e) => setEmpleadoFiltro(e.target.value)}
                className={inputClassName}
              >
                <option value="todos" className="bg-[#11131a] text-white">Todos</option>
                {empleadosOptions.map((empleado) => (
                  <option
                    key={empleado}
                    value={empleado}
                    className="bg-[#11131a] text-white"
                  >
                    {empleado}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <Field label="Plan activo">
              <select
                value={planEstadoFiltro}
                onChange={(e) => setPlanEstadoFiltro(e.target.value as PlanEstadoFiltro)}
                className={inputClassName}
              >
                <option value="todos" className="bg-[#11131a] text-white">Todos</option>
                <option value="con_plan" className="bg-[#11131a] text-white">Con plan activo</option>
                <option value="sin_plan" className="bg-[#11131a] text-white">Sin plan activo</option>
                <option value="por_vencer" className="bg-[#11131a] text-white">Por vencer</option>
              </select>
            </Field>
          </div>

          <div>
            <Field label="Tipo de plan">
              <select
                value={planNombreFiltro}
                onChange={(e) => setPlanNombreFiltro(e.target.value)}
                className={inputClassName}
              >
                <option value="todos" className="bg-[#11131a] text-white">Todos</option>
                {planOptions.map((plan) => (
                  <option key={plan} value={plan} className="bg-[#11131a] text-white">
                    {plan}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div>
            <Field label="Ordenar">
              <select
                value={ordenPor}
                onChange={(e) => setOrdenPor(e.target.value as OrdenKey)}
                className={inputClassName}
              >
                <option value="nombre_asc" className="bg-[#11131a] text-white">Nombre A-Z</option>
                <option value="nombre_desc" className="bg-[#11131a] text-white">Nombre Z-A</option>
                <option value="empleado_asc" className="bg-[#11131a] text-white">Fisioterapeuta A-Z</option>
                <option value="empleado_desc" className="bg-[#11131a] text-white">Fisioterapeuta Z-A</option>
                <option value="fecha_reciente" className="bg-[#11131a] text-white">Más recientes</option>
                <option value="fecha_antigua" className="bg-[#11131a] text-white">Más antiguos</option>
                <option value="estado" className="bg-[#11131a] text-white">Estado</option>
                <option value="sesiones_mayor" className="bg-[#11131a] text-white">Más restantes</option>
                <option value="sesiones_menor" className="bg-[#11131a] text-white">Menos restantes</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/45">
            Mostrando <span className="font-semibold text-white/80">{clientesFiltrados.length}</span> de{' '}
            <span className="font-semibold text-white/80">{rows.length}</span> cliente(s)
          </p>

          <button
            type="button"
            onClick={limpiarFiltros}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06] sm:w-auto"
          >
            Limpiar filtros
          </button>
        </div>
      </Section>

      <Section
        title="Listado de clientes"
        description="Vista general de clientes, plan activo, sesiones, empleado y pagos."
        className="p-0"
        contentClassName="overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr className="text-left text-white/55">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Fisioterapeuta</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Plan activo</th>
                <th className="px-4 py-3 font-medium">Sesiones</th>
                <th className="px-4 py-3 font-medium">Último pago</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-white/55">
                    Cargando clientes...
                  </td>
                </tr>
              ) : clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-white/55">
                    No hay clientes registrados.
                  </td>
                </tr>
              ) : (
                clientesFiltrados.map(({ cliente, planActivo, ultimoPago, sesionesRestantes, empleadoNombre }) => (
                  <tr key={cliente.id} className="align-top transition hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{cliente.nombre}</div>

                      <div className="mt-1 space-y-1">
                        {getAuditLines(cliente).map((line, index) => (
                          <div key={index} className="text-[11px] leading-4 text-white/35">
                            {line}
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="text-white/75">{cliente.email || 'Sin correo'}</div>
                      <div className="mt-1 text-xs text-white/45">
                        {cliente.telefono || 'Sin teléfono'}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{empleadoNombre}</div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoBadge(cliente.estado)}`}
                      >
                        {cliente.estado}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {planActivo ? (
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium text-white">
                              {planActivo.planes?.nombre || 'Plan'}
                            </div>
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${estadoPlanBadge(planActivo.estado)}`}
                            >
                              {getPlanStatusLabel(planActivo.estado)}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-white/45">
                            Vence: {formatDate(planActivo.fecha_fin)}
                          </div>
                          <div className="mt-1 text-xs text-white/45">
                            Vigencia:{' '}
                            {formatVigencia(
                              planActivo.planes?.vigencia_valor,
                              planActivo.planes?.vigencia_tipo
                            )}
                          </div>
                          <div className="mt-1 text-xs text-white/45">
                            Valor: {money(planActivo.planes?.precio)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-white/55">Sin plan activo</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {planActivo ? (
                        <div>
                          <div className="font-medium text-white">
                            {Number(planActivo.sesiones_usadas || 0)}/
                            {Number(planActivo.sesiones_totales || 0)}
                          </div>
                          <div className="mt-1 text-xs text-white/45">
                            Restantes: {sesionesRestantes}
                          </div>
                        </div>
                      ) : (
                        <span className="text-white/55">—</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      {ultimoPago ? (
                        <div>
                          <div className="font-medium text-white">
                            {money(
                              ultimoPago.moneda_pago === 'BS'
                                ? Number(ultimoPago.monto_equivalente_bs || 0)
                                : Number(ultimoPago.monto_equivalente_usd || 0),
                              ultimoPago.moneda_pago || 'USD'
                            )}
                          </div>
                          <div className="mt-1 text-xs text-white/45">
                            {formatDate(ultimoPago.fecha)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-white/55">Sin pagos</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/admin/personas/clientes/${cliente.id}`}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/[0.06]"
                        >
                          Ver
                        </Link>

                        <Link
                          href={`/admin/personas/clientes/${cliente.id}/plan`}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/[0.06]"
                        >
                          Plan
                        </Link>

                        <Link
                          href={`/admin/personas/clientes/${cliente.id}/editar`}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/[0.06]"
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
