'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'

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
  creado_por: AuditorRef
  editado_por: AuditorRef
}

type Plan = {
  id: string
  nombre: string
  sesiones_totales: number
  vigencia_valor: number
  vigencia_tipo: 'dias' | 'semanas' | 'meses' | string
  precio: number
  estado: string
  descripcion: string | null
}

type ClientePlan = {
  id: string
  cliente_id: string
  plan_id: string
  sesiones_totales: number
  sesiones_usadas: number
  fecha_inicio: string | null
  fecha_fin: string | null
  estado: 'activo' | 'vencido' | 'agotado' | 'cancelado' | 'renovado'
  created_at: string
  planes: Plan | null
}

type Pago = {
  id: string
  fecha: string
  concepto: string
  categoria: string
  monto: number
  monto_pago: number | null
  monto_equivalente_usd: number | null
  monto_equivalente_bs: number | null
  moneda_pago: string | null
  estado: string
  tipo_origen: string
  notas: string | null
  metodos_pago: { nombre: string } | null
}

type Cita = {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: string
  notas: string | null
  empleados: { nombre: string } | null
  servicios: { nombre: string } | null
}

type EventoPlan = {
  id: string
  cliente_plan_id: string
  cliente_id: string
  tipo: 'asignado' | 'renovado' | 'cancelado' | 'agotado' | 'vencido'
  detalle: string | null
  created_at: string
}

type SesionPlan = {
  id: string
  cliente_plan_id: string | null
  cliente_id: string | null
  empleado_id: string | null
  fecha: string | null
  hora_inicio: string | null
  hora_fin: string | null
  estado: string | null
  asistencia_estado: string | null
  aviso_previo: boolean | null
  consume_sesion: boolean | null
  reprogramable: boolean | null
  motivo_asistencia: string | null
  fecha_asistencia: string | null
  reprogramado_de_entrenamiento_id: string | null
  empleados?: { nombre: string; rol?: string | null } | null
  clientes_planes?: {
    id: string
    fecha_fin?: string | null
    estado?: string | null
    planes?: { nombre?: string | null } | null
  } | null
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function money(
  value: number | string | null | undefined,
  moneda: string | null | undefined = 'USD'
) {
  const amount = Number(value || 0)
  const monedaNormalizada = (moneda || 'USD').toUpperCase()

  if (monedaNormalizada === 'BS') {
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

function truncateText(value: string | null | undefined, max = 24) {
  const text = (value || '').trim()
  if (!text) return 'Sin plan activo'
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function formatTime(value: string | null | undefined) {
  if (!value) return '—'
  return String(value).slice(0, 5)
}

function formatAuditDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function formatVigencia(valor: number | null | undefined, tipo: string | null | undefined) {
  const n = Number(valor || 0)
  const t = (tipo || '').toLowerCase()

  if (!n) return '—'

  if (t === 'dias') return `${n} ${n === 1 ? 'día' : 'días'}`
  if (t === 'semanas') return `${n} ${n === 1 ? 'semana' : 'semanas'}`
  if (t === 'meses') return `${n} ${n === 1 ? 'mes' : 'meses'}`

  return `${n} ${tipo || ''}`.trim()
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

function estadoPlanBadge(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'activo':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'cancelado':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'agotado':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'vencido':
      return 'border-white/10 bg-white/[0.05] text-white/70'
    case 'renovado':
      return 'border-violet-400/20 bg-violet-400/10 text-violet-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function estadoPagoBadge(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'pagado':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'anulado':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'pendiente':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function estadoCitaBadge(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'confirmada':
      return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
    case 'completada':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'cancelada':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'reprogramada':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function tipoEventoBadge(tipo: string) {
  switch ((tipo || '').toLowerCase()) {
    case 'asignado':
      return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
    case 'renovado':
      return 'border-violet-400/20 bg-violet-400/10 text-violet-300'
    case 'cancelado':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'agotado':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'vencido':
      return 'border-white/10 bg-white/[0.05] text-white/70'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function asistenciaPlanBadge(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'asistio':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'no_asistio_aviso':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'no_asistio_sin_aviso':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'reprogramado':
      return 'border-violet-400/20 bg-violet-400/10 text-violet-300'
    case 'pendiente':
      return 'border-white/10 bg-white/[0.05] text-white/70'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function asistenciaPlanLabel(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'pendiente':
      return 'Pendiente'
    case 'asistio':
      return 'Asistió'
    case 'no_asistio_aviso':
      return 'No asistió pero avisó'
    case 'no_asistio_sin_aviso':
      return 'No asistió sin aviso'
    case 'reprogramado':
      return 'Reprogramado'
    default:
      return estado || '—'
  }
}

function roleLabel(rol: string | null | undefined) {
  const value = (rol || '').trim().toLowerCase()
  if (!value) return 'Sin rol'
  if (value === 'terapeuta' || value === 'fisioterapeuta') return 'Fisioterapeuta'
  if (value === 'entrenador') return 'Entrenador'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export default function ClienteDetallePage() {
  const params = useParams()
  const clienteId = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [loading, setLoading] = useState(true)
  const [loadingExtras, setLoadingExtras] = useState(true)

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [historialPlanes, setHistorialPlanes] = useState<ClientePlan[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [citas, setCitas] = useState<Cita[]>([])
  const [eventosPlan, setEventosPlan] = useState<EventoPlan[]>([])
  const [sesionesPlan, setSesionesPlan] = useState<SesionPlan[]>([])

  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')

  useEffect(() => {
    if (!clienteId) return
    void loadClienteBase(clienteId)
  }, [clienteId])

  async function loadClienteBase(id: string) {
    setLoading(true)
    setLoadingExtras(true)
    setError('')
    setWarning('')
    setCliente(null)
    setHistorialPlanes([])
    setPagos([])
    setCitas([])
    setEventosPlan([])
    setSesionesPlan([])

    try {
      const clienteRes = await supabase
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
          creado_por:created_by (
            id,
            nombre
          ),
          editado_por:updated_by (
            id,
            nombre
          )
        `)
        .eq('id', id)
        .single()

      if (clienteRes.error) throw new Error(clienteRes.error.message)

      setCliente(clienteRes.data as unknown as Cliente)
      setLoading(false)
      void loadClienteExtras(id)
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar el cliente.')
      setLoading(false)
      setLoadingExtras(false)
    }
  }

  async function loadClienteExtras(id: string) {
    const hoy = new Date().toISOString().slice(0, 10)
    const warnings: string[] = []

    try {
      const planesRes = await supabase
        .from('clientes_planes')
        .select(`
          id,
          cliente_id,
          plan_id,
          sesiones_totales,
          sesiones_usadas,
          fecha_inicio,
          fecha_fin,
          estado,
          created_at,
          planes:plan_id (
            id,
            nombre,
            sesiones_totales,
            vigencia_valor,
            vigencia_tipo,
            precio,
            estado,
            descripcion
          )
        `)
        .eq('cliente_id', id)
        .order('created_at', { ascending: false })

      if (planesRes.error) warnings.push(`Planes: ${planesRes.error.message}`)
      else setHistorialPlanes((planesRes.data || []) as unknown as ClientePlan[])
    } catch {
      warnings.push('Planes: no se pudieron cargar.')
    }

    try {
      const pagosRes = await supabase
        .from('pagos')
        .select(`
          id,
          fecha,
          concepto,
          categoria,
          monto,
          monto_pago,
          monto_equivalente_usd,
          monto_equivalente_bs,
          moneda_pago,
          estado,
          tipo_origen,
          notas,
          metodos_pago:metodo_pago_id ( nombre )
        `)
        .eq('cliente_id', id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (pagosRes.error) warnings.push(`Pagos: ${pagosRes.error.message}`)
      else setPagos((pagosRes.data || []) as unknown as Pago[])
    } catch {
      warnings.push('Pagos: no se pudieron cargar.')
    }

    try {
      const citasRes = await supabase
        .from('citas')
        .select(`
          id,
          fecha,
          hora_inicio,
          hora_fin,
          estado,
          notas,
          empleados:terapeuta_id ( nombre ),
          servicios:servicio_id ( nombre )
        `)
        .eq('cliente_id', id)
        .gte('fecha', hoy)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })
        .limit(10)

      if (citasRes.error) warnings.push(`Citas: ${citasRes.error.message}`)
      else setCitas((citasRes.data || []) as unknown as Cita[])
    } catch {
      warnings.push('Citas: no se pudieron cargar.')
    }

    try {
      const eventosRes = await supabase
        .from('clientes_planes_eventos')
        .select('id, cliente_plan_id, cliente_id, tipo, detalle, created_at')
        .eq('cliente_id', id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (eventosRes.error) warnings.push(`Eventos: ${eventosRes.error.message}`)
      else setEventosPlan((eventosRes.data || []) as EventoPlan[])
    } catch {
      warnings.push('Eventos: no se pudieron cargar.')
    }

    try {
      const sesionesRes = await supabase
        .from('entrenamientos')
        .select(`
          id,
          cliente_plan_id,
          cliente_id,
          empleado_id,
          fecha,
          hora_inicio,
          hora_fin,
          estado,
          asistencia_estado,
          aviso_previo,
          consume_sesion,
          reprogramable,
          motivo_asistencia,
          fecha_asistencia,
          reprogramado_de_entrenamiento_id,
          empleados:empleado_id ( nombre, rol ),
          clientes_planes:cliente_plan_id (
            id,
            fecha_fin,
            estado,
            planes:plan_id ( nombre )
          )
        `)
        .eq('cliente_id', id)
        .not('cliente_plan_id', 'is', null)
        .neq('estado', 'cancelado')
        .order('fecha', { ascending: false })
        .order('hora_inicio', { ascending: false })
        .limit(50)

      if (sesionesRes.error) {
        warnings.push(`Sesiones plan: ${sesionesRes.error.message}`)
      } else {
        const normalizadas = ((sesionesRes.data || []) as any[])
          .map((row) => ({
            ...row,
            empleados: firstOrNull(row?.empleados),
            clientes_planes: firstOrNull(row?.clientes_planes)
              ? {
                  ...firstOrNull(row?.clientes_planes),
                  planes: firstOrNull(firstOrNull(row?.clientes_planes)?.planes),
                }
              : null,
          }))
          .filter((row) => {
            const estadoPlan = (row.clientes_planes?.estado || '').toLowerCase()
            return estadoPlan !== 'cancelado'
          })

        setSesionesPlan(normalizadas as SesionPlan[])
      }
    } catch {
      warnings.push('Sesiones plan: no se pudieron cargar.')
    }

    if (warnings.length > 0) setWarning(warnings.join(' | '))
    setLoadingExtras(false)
  }

  const planActivo = useMemo(() => {
    return historialPlanes.find((p) => p.estado === 'activo') || null
  }, [historialPlanes])

  const resumenPlan = useMemo(() => {
    if (!planActivo) return { usadas: 0, restantes: 0, total: 0 }
    const total = Number(planActivo.sesiones_totales || 0)
    const usadas = Number(planActivo.sesiones_usadas || 0)
    return { usadas, restantes: Math.max(0, total - usadas), total }
  }, [planActivo])

  const resumenPagos = useMemo(() => {
    const pagosPagados = pagos.filter((p) => (p.estado || '').toLowerCase() === 'pagado')
    const monedas = Array.from(
      new Set(pagosPagados.map((p) => (p.moneda_pago || '').toUpperCase().trim()).filter(Boolean))
    )
    const todosBS = monedas.length === 1 && monedas[0] === 'BS'
    const monedaResumen: 'BS' | 'USD' = todosBS ? 'BS' : 'USD'
    const totalPagado = pagosPagados.reduce((acc, p) => {
      return acc + Number(todosBS ? (p.monto_equivalente_bs || 0) : (p.monto_equivalente_usd ?? 0))
    }, 0)
    return { totalPagado, cantidad: pagosPagados.length, monedaResumen }
  }, [pagos])

  const resumenAsistenciaPlan = useMemo(() => {
    return {
      asistio: sesionesPlan.filter((s) => s.asistencia_estado === 'asistio').length,
      aviso: sesionesPlan.filter((s) => s.asistencia_estado === 'no_asistio_aviso').length,
      sinAviso: sesionesPlan.filter((s) => s.asistencia_estado === 'no_asistio_sin_aviso').length,
      pendientes: sesionesPlan.filter((s) => (s.asistencia_estado || 'pendiente') === 'pendiente').length,
      reprogramables: sesionesPlan.filter((s) => s.reprogramable === true).length,
    }
  }, [sesionesPlan])

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-white/55">Clientes</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Detalle del cliente</h1>
        </div>
        <Card className="p-6">
          <p className="text-white/55">Cargando cliente...</p>
        </Card>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-white/55">Clientes</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Detalle del cliente</h1>
        </div>
        <Card className="p-6">
          <p className="text-rose-400">{error || 'No se encontró el cliente.'}</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Clientes</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            {cliente.nombre}
          </h1>
          <p className="mt-2 text-sm text-white/55">
            {cliente.email || 'Sin correo'} · {cliente.telefono || 'Sin teléfono'} · {cliente.estado}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ActionCard
            title="Editar cliente"
            description="Modificar la información del cliente."
            href={`/admin/personas/clientes/${cliente.id}/editar`}
          />
          <ActionCard
            title="Gestionar plan"
            description="Asignar, renovar o cambiar el plan."
            href={`/admin/personas/clientes/${cliente.id}/plan`}
          />
          <ActionCard
            title="Ver agenda"
            description="Consultar citas de este cliente."
            href={`/admin/operaciones/agenda?cliente=${cliente.id}`}
          />
        </div>
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      {warning ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-amber-300">Aviso</p>
          <p className="mt-1 text-sm text-white/55">
            Algunas secciones no cargaron completo: {warning}
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Plan activo"
          value={truncateText(planActivo?.planes?.nombre, 22)}
          subtitle={planActivo?.planes?.nombre || 'Resumen actual del cliente'}
        />
        <StatCard title="Sesiones usadas" value={resumenPlan.usadas} />
        <StatCard title="Sesiones restantes" value={resumenPlan.restantes} />
        <StatCard
          title="Pagado"
          value={money(resumenPagos.totalPagado, resumenPagos.monedaResumen)}
          color="text-emerald-400"
        />
        <StatCard title="Próximas citas" value={citas.length} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Asistió" value={resumenAsistenciaPlan.asistio} color="text-emerald-400" />
        <StatCard title="Avisó" value={resumenAsistenciaPlan.aviso} color="text-amber-400" />
        <StatCard title="Sin aviso" value={resumenAsistenciaPlan.sinAviso} color="text-rose-400" />
        <StatCard title="Pendientes" value={resumenAsistenciaPlan.pendientes} />
        <StatCard title="Reprogramables" value={resumenAsistenciaPlan.reprogramables} color="text-violet-400" />
      </div>

      {loadingExtras ? (
        <Card className="p-4">
          <p className="text-sm text-white/55">
            Cargando planes, pagos, citas, eventos y asistencia del plan...
          </p>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section
            title="Historial de planes"
            description="Registro de planes asignados, renovados y cancelados."
            className="p-0"
            contentClassName="overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Plan</th>
                    <th className="px-4 py-3 text-left font-medium">Vigencia</th>
                    <th className="px-4 py-3 text-left font-medium">Precio</th>
                    <th className="px-4 py-3 text-left font-medium">Inicio</th>
                    <th className="px-4 py-3 text-left font-medium">Fin</th>
                    <th className="px-4 py-3 text-left font-medium">Uso</th>
                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {historialPlanes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-white/55">
                        Este cliente no tiene planes registrados.
                      </td>
                    </tr>
                  ) : (
                    historialPlanes.map((item) => {
                      const restantes = Math.max(
                        0,
                        Number(item.sesiones_totales || 0) - Number(item.sesiones_usadas || 0)
                      )
                      return (
                        <tr key={item.id} className="transition hover:bg-white/[0.03]">
                          <td className="px-4 py-3">
                            <div className="max-w-[260px]">
                              <p className="font-medium text-white break-words whitespace-normal">
                                {item.planes?.nombre || 'Plan'}
                              </p>
                              {item.planes?.descripcion ? (
                                <p className="text-xs text-white/45 break-words whitespace-normal">
                                  {item.planes.descripcion}
                                </p>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-white/75">
                            {formatVigencia(item.planes?.vigencia_valor, item.planes?.vigencia_tipo)}
                          </td>
                          <td className="px-4 py-3 text-white/75">
                            {money(item.planes?.precio || 0, 'USD')}
                          </td>
                          <td className="px-4 py-3 text-white/75">{item.fecha_inicio || '—'}</td>
                          <td className="px-4 py-3 text-white/75">{item.fecha_fin || '—'}</td>
                          <td className="px-4 py-3 text-white/75">
                            {item.sesiones_usadas}/{item.sesiones_totales} · Rest. {restantes}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoPlanBadge(item.estado)}`}
                            >
                              {item.estado}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="Sesiones y asistencia del plan"
            description="Historial de sesiones del plan, asistencia y consumo real."
            className="p-0"
            contentClassName="overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium">Hora</th>
                    <th className="px-4 py-3 text-left font-medium">Empleado</th>
                    <th className="px-4 py-3 text-left font-medium">Plan</th>
                    <th className="px-4 py-3 text-left font-medium">Asistencia</th>
                    <th className="px-4 py-3 text-left font-medium">Consume</th>
                    <th className="px-4 py-3 text-left font-medium">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {sesionesPlan.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-white/55">
                        Este cliente no tiene sesiones de plan registradas.
                      </td>
                    </tr>
                  ) : (
                    sesionesPlan.map((sesion) => (
                      <tr key={sesion.id} className="transition hover:bg-white/[0.03]">
                        <td className="px-4 py-3 text-white/75">{formatDate(sesion.fecha)}</td>
                        <td className="px-4 py-3 text-white/75">
                          {formatTime(sesion.hora_inicio)} - {formatTime(sesion.hora_fin)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-[240px]">
                            <p className="font-medium text-white break-words whitespace-normal">
                              {sesion.empleados?.nombre || 'Sin empleado'}
                            </p>
                            <p className="text-xs text-white/45">
                              {roleLabel(sesion.empleados?.rol)}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/75">
                          {sesion.clientes_planes?.planes?.nombre || 'Plan'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${asistenciaPlanBadge(sesion.asistencia_estado)}`}
                          >
                            {asistenciaPlanLabel(sesion.asistencia_estado)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {sesion.consume_sesion ? (
                            <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                              Sí
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-white/70">
                              No
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-[320px]">
                            <p className="text-white/75 break-words whitespace-normal">
                              {sesion.motivo_asistencia || '—'}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/45">
                              {sesion.reprogramable ? <span>Reprogramable</span> : null}
                              {sesion.aviso_previo ? <span>Avisó</span> : null}
                              {sesion.fecha_asistencia ? (
                                <span>Marcada: {formatDateTime(sesion.fecha_asistencia)}</span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="Pagos del cliente"
            description="Últimos pagos registrados y método utilizado."
            className="p-0"
            contentClassName="overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Fecha</th>
                    <th className="px-4 py-3 text-left font-medium">Concepto</th>
                    <th className="px-4 py-3 text-left font-medium">Método</th>
                    <th className="px-4 py-3 text-left font-medium">Estado</th>
                    <th className="px-4 py-3 text-left font-medium">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {pagos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-white/55">
                        Este cliente no tiene pagos registrados.
                      </td>
                    </tr>
                  ) : (
                    pagos.map((pago) => (
                      <tr key={pago.id} className="transition hover:bg-white/[0.03]">
                        <td className="px-4 py-3 text-white/75">{pago.fecha}</td>
                        <td className="px-4 py-3">
                          <div className="max-w-[380px]">
                            <p className="font-medium text-white break-words whitespace-normal">
                              {pago.concepto}
                            </p>
                            <p className="text-xs text-white/45">
                              {pago.categoria} · {pago.tipo_origen}
                            </p>
                            {pago.notas ? (
                              <p className="mt-1 text-xs text-white/45 break-words whitespace-normal">
                                {pago.notas}
                              </p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/75">
                          {pago.metodos_pago?.nombre || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoPagoBadge(pago.estado)}`}
                          >
                            {pago.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-400">
                          {money(
                            pago.moneda_pago === 'BS'
                              ? Number(pago.monto_equivalente_bs || 0)
                              : Number(pago.monto_equivalente_usd || 0),
                            pago.moneda_pago || 'USD'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <div className="space-y-6 xl:col-span-1">
          <Section title="Auditoría del cliente" description="Quién lo creó y quién lo editó.">
            <div className="space-y-2">
              {getAuditLines(cliente).map((line, index) => (
                <Card key={index} className="p-3">
                  <p className="text-sm text-white/75">{line}</p>
                </Card>
              ))}
            </div>
          </Section>

          <Section title="Plan actual" description="Resumen del plan activo y acceso rápido.">
            {!planActivo ? (
              <p className="text-sm text-white/55">No tiene plan activo.</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-white break-words whitespace-normal">
                    {planActivo.planes?.nombre}
                  </p>
                  <p className="text-sm text-white/55">
                    {money(planActivo.planes?.precio || 0, 'USD')}
                  </p>
                  <p className="text-xs text-white/45">
                    Vigencia: {formatVigencia(planActivo.planes?.vigencia_valor, planActivo.planes?.vigencia_tipo)}
                  </p>
                </div>

                <Card className="p-3">
                  <div className="space-y-1 text-sm text-white/75">
                    <p>Inicio: {planActivo.fecha_inicio || '—'}</p>
                    <p>Fin: {planActivo.fecha_fin || '—'}</p>
                    <p>Total sesiones: {planActivo.sesiones_totales}</p>
                    <p>Usadas: {planActivo.sesiones_usadas}</p>
                    <p>Restantes: {resumenPlan.restantes}</p>
                  </div>
                </Card>

                <Link
                  href={`/admin/personas/clientes/${cliente.id}/plan`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-white/[0.12]"
                >
                  Gestionar plan
                </Link>
              </div>
            )}
          </Section>

          <Section title="Próximas citas" description="Próximas citas agendadas del cliente.">
            <div className="space-y-3">
              {citas.length === 0 ? (
                <p className="text-sm text-white/55">No tiene citas próximas.</p>
              ) : (
                citas.map((cita) => (
                  <Card key={cita.id} className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">
                          {cita.servicios?.nombre || 'Servicio'}
                        </p>
                        <p className="text-sm text-white/55">
                          {cita.fecha} · {cita.hora_inicio.slice(0, 5)} - {cita.hora_fin.slice(0, 5)}
                        </p>
                        <p className="text-xs text-white/40">
                          {cita.empleados?.nombre || 'Sin terapeuta'}
                        </p>
                        {cita.notas ? (
                          <p className="mt-1 text-xs text-white/45">{cita.notas}</p>
                        ) : null}
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoCitaBadge(cita.estado)}`}
                      >
                        {cita.estado}
                      </span>
                    </div>
                  </Card>
                ))
              )}
            </div>

            <div className="mt-4">
              <Link
                href={`/admin/operaciones/agenda?cliente=${cliente.id}`}
                className="inline-flex rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]"
              >
                Ver más
              </Link>
            </div>
          </Section>

          <Section title="Eventos del plan" description="Historial de cambios y eventos del plan.">
            <div className="space-y-3">
              {eventosPlan.length === 0 ? (
                <p className="text-sm text-white/55">Sin eventos todavía.</p>
              ) : (
                eventosPlan.map((evento) => (
                  <Card key={evento.id} className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${tipoEventoBadge(evento.tipo)}`}
                      >
                        {evento.tipo}
                      </span>
                      <span className="text-xs text-white/45">
                        {new Date(evento.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-white/75">
                      {evento.detalle || 'Sin detalle'}
                    </p>
                  </Card>
                ))
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}