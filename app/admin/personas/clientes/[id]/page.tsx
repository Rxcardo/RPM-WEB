'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type Cliente = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  estado: string
  created_at: string
}

type Plan = {
  id: string
  nombre: string
  sesiones_totales: number
  vigencia_dias: number
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

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function estadoPlanBadge(estado: string) {
  switch (estado) {
    case 'activo':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'cancelado':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'agotado':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'vencido':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    case 'renovado':
      return 'bg-violet-50 text-violet-700 border-violet-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function estadoPagoBadge(estado: string) {
  switch (estado) {
    case 'pagado':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'anulado':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'pendiente':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function estadoCitaBadge(estado: string) {
  switch (estado) {
    case 'confirmada':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'completada':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'cancelada':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'reprogramada':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function tipoEventoBadge(tipo: string) {
  switch (tipo) {
    case 'asignado':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'renovado':
      return 'bg-violet-50 text-violet-700 border-violet-200'
    case 'cancelado':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'agotado':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'vencido':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

export default function ClienteDetallePage() {
  const params = useParams()
  const clienteId = Array.isArray(params?.id) ? params.id[0] : params?.id

  const [loading, setLoading] = useState(true)
  const [loadingExtras, setLoadingExtras] = useState(true)
  const [cancelandoPlanId, setCancelandoPlanId] = useState<string | null>(null)

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [historialPlanes, setHistorialPlanes] = useState<ClientePlan[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [citas, setCitas] = useState<Cita[]>([])
  const [eventosPlan, setEventosPlan] = useState<EventoPlan[]>([])

  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (!clienteId) return
    void loadClienteBase(clienteId)
  }, [clienteId])

  async function loadClienteBase(id: string) {
    setLoading(true)
    setLoadingExtras(true)
    setError('')
    setWarning('')
    setSuccessMsg('')
    setCliente(null)
    setHistorialPlanes([])
    setPagos([])
    setCitas([])
    setEventosPlan([])

    try {
      const clienteRes = await supabase
        .from('clientes')
        .select('id, nombre, telefono, email, estado, created_at')
        .eq('id', id)
        .single()

      if (clienteRes.error) {
        throw new Error(clienteRes.error.message)
      }

      setCliente(clienteRes.data as Cliente)
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
            vigencia_dias,
            precio,
            estado,
            descripcion
          )
        `)
        .eq('cliente_id', id)
        .order('created_at', { ascending: false })

      if (planesRes.error) {
        warnings.push(`Planes: ${planesRes.error.message}`)
      } else {
        setHistorialPlanes((planesRes.data || []) as unknown as ClientePlan[])
      }
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
          estado,
          tipo_origen,
          notas,
          metodos_pago:metodo_pago_id ( nombre )
        `)
        .eq('cliente_id', id)
        .order('fecha', { ascending: false })
        .limit(20)

      if (pagosRes.error) {
        warnings.push(`Pagos: ${pagosRes.error.message}`)
      } else {
        setPagos((pagosRes.data || []) as unknown as Pago[])
      }
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

      if (citasRes.error) {
        warnings.push(`Citas: ${citasRes.error.message}`)
      } else {
        setCitas((citasRes.data || []) as unknown as Cita[])
      }
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

      if (eventosRes.error) {
        warnings.push(`Eventos: ${eventosRes.error.message}`)
      } else {
        setEventosPlan((eventosRes.data || []) as EventoPlan[])
      }
    } catch {
      warnings.push('Eventos: no se pudieron cargar.')
    }

    if (warnings.length > 0) {
      setWarning(warnings.join(' | '))
    }

    setLoadingExtras(false)
  }

  const planActivo = useMemo(() => {
    return historialPlanes.find((p) => p.estado === 'activo') || null
  }, [historialPlanes])

  const resumenPlan = useMemo(() => {
    if (!planActivo) {
      return { usadas: 0, restantes: 0, total: 0 }
    }

    const total = Number(planActivo.sesiones_totales || 0)
    const usadas = Number(planActivo.sesiones_usadas || 0)
    const restantes = Math.max(0, total - usadas)

    return { usadas, restantes, total }
  }, [planActivo])

  const resumenPagos = useMemo(() => {
    const totalPagado = pagos
      .filter((p) => p.estado === 'pagado')
      .reduce((acc, p) => acc + Number(p.monto || 0), 0)

    return {
      totalPagado,
      cantidad: pagos.length,
    }
  }, [pagos])

  async function cancelarPlan(planId: string) {
    if (!clienteId) return

    const motivo = window.prompt('Motivo de cancelación del plan')
    if (!motivo || !motivo.trim()) return

    try {
      setCancelandoPlanId(planId)
      setError('')
      setSuccessMsg('')

      const userRes = await supabase.auth.getUser()
      const userId = userRes.data?.user?.id || null

      const { data, error } = await supabase.rpc('cancelar_plan_cliente', {
        p_cliente_plan_id: planId,
        p_motivo: motivo.trim(),
        p_user: userId,
      })

      if (error) throw error
      if (data?.ok === false) throw new Error(data?.error || 'No se pudo cancelar el plan.')

      setSuccessMsg('Plan cancelado correctamente.')
      await loadClienteExtras(clienteId)
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo cancelar el plan.')
    } finally {
      setCancelandoPlanId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="mx-auto max-w-7xl px-4 py-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            Cargando cliente...
          </div>
        </main>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="mx-auto max-w-7xl px-4 py-6">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
            {error || 'No se encontró el cliente.'}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Clientes</p>
            <h1 className="text-2xl font-bold text-slate-900">{cliente.nombre}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {cliente.email || 'Sin correo'} · {cliente.telefono || 'Sin teléfono'} · {cliente.estado}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/personas/clientes/${cliente.id}/editar`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Editar cliente
            </Link>

            <Link
              href={`/admin/personas/clientes/${cliente.id}/plan`}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Gestionar plan
            </Link>

            <Link
              href={`/admin/operaciones/agenda?cliente=${cliente.id}`}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Ver agenda
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {successMsg ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMsg}
          </div>
        ) : null}

        {warning ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Algunas secciones no cargaron completo: {warning}
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Plan activo</p>
            <p className="mt-2 text-lg font-bold text-slate-900">
              {planActivo?.planes?.nombre || 'Sin plan activo'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Sesiones usadas</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{resumenPlan.usadas}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Sesiones restantes</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{resumenPlan.restantes}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Pagado</p>
            <p className="mt-2 text-3xl font-bold text-emerald-700">
              {money(resumenPagos.totalPagado)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Próximas citas</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{citas.length}</p>
          </div>
        </div>

        {loadingExtras ? (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Cargando planes, pagos, citas y eventos...
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="space-y-6 xl:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b bg-slate-50 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Historial de planes</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Plan</th>
                      <th className="px-4 py-3 text-left font-semibold">Precio</th>
                      <th className="px-4 py-3 text-left font-semibold">Inicio</th>
                      <th className="px-4 py-3 text-left font-semibold">Fin</th>
                      <th className="px-4 py-3 text-left font-semibold">Uso</th>
                      <th className="px-4 py-3 text-left font-semibold">Estado</th>
                      <th className="px-4 py-3 text-left font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialPlanes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-slate-500">
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
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-900">
                                {item.planes?.nombre || 'Plan'}
                              </p>
                              {item.planes?.descripcion ? (
                                <p className="text-xs text-slate-500">{item.planes.descripcion}</p>
                              ) : null}
                            </td>

                            <td className="px-4 py-3 text-slate-700">
                              {money(item.planes?.precio || 0)}
                            </td>

                            <td className="px-4 py-3 text-slate-700">{item.fecha_inicio || '—'}</td>
                            <td className="px-4 py-3 text-slate-700">{item.fecha_fin || '—'}</td>

                            <td className="px-4 py-3 text-slate-700">
                              {item.sesiones_usadas}/{item.sesiones_totales} · Rest. {restantes}
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoPlanBadge(item.estado)}`}
                              >
                                {item.estado}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              {item.estado === 'activo' ? (
                                <button
                                  onClick={() => cancelarPlan(item.id)}
                                  disabled={cancelandoPlanId === item.id}
                                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                                >
                                  {cancelandoPlanId === item.id ? 'Cancelando...' : 'Cancelar plan'}
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b bg-slate-50 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Pagos del cliente</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                      <th className="px-4 py-3 text-left font-semibold">Concepto</th>
                      <th className="px-4 py-3 text-left font-semibold">Método</th>
                      <th className="px-4 py-3 text-left font-semibold">Estado</th>
                      <th className="px-4 py-3 text-left font-semibold">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagos.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-slate-500">
                          Este cliente no tiene pagos registrados.
                        </td>
                      </tr>
                    ) : (
                      pagos.map((pago) => (
                        <tr key={pago.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-slate-700">{pago.fecha}</td>

                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{pago.concepto}</p>
                            <p className="text-xs text-slate-500">
                              {pago.categoria} · {pago.tipo_origen}
                            </p>
                            {pago.notas ? (
                              <p className="mt-1 text-xs text-slate-500">{pago.notas}</p>
                            ) : null}
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            {pago.metodos_pago?.nombre || '—'}
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoPagoBadge(pago.estado)}`}
                            >
                              {pago.estado}
                            </span>
                          </td>

                          <td className="px-4 py-3 font-semibold text-emerald-700">
                            {money(pago.monto)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <aside className="space-y-6 xl:col-span-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Plan actual</h2>

              {!planActivo ? (
                <p className="text-sm text-slate-500">No tiene plan activo.</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-slate-900">{planActivo.planes?.nombre}</p>
                    <p className="text-sm text-slate-500">
                      {money(planActivo.planes?.precio || 0)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <p>Inicio: {planActivo.fecha_inicio || '—'}</p>
                    <p>Fin: {planActivo.fecha_fin || '—'}</p>
                    <p>Total sesiones: {planActivo.sesiones_totales}</p>
                    <p>Usadas: {planActivo.sesiones_usadas}</p>
                    <p>Restantes: {resumenPlan.restantes}</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/admin/personas/clientes/${cliente.id}/plan`}
                      className="block rounded-xl bg-slate-900 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Gestionar plan
                    </Link>

                    <button
                      onClick={() => cancelarPlan(planActivo.id)}
                      disabled={cancelandoPlanId === planActivo.id}
                      className="block rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-center text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      {cancelandoPlanId === planActivo.id ? 'Cancelando...' : 'Cancelar plan'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Próximas citas</h2>
                <Link
                  href={`/admin/operaciones/agenda?cliente=${cliente.id}`}
                  className="text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  Ver más
                </Link>
              </div>

              <div className="space-y-3">
                {citas.length === 0 ? (
                  <p className="text-sm text-slate-500">No tiene citas próximas.</p>
                ) : (
                  citas.map((cita) => (
                    <div key={cita.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">
                            {cita.servicios?.nombre || 'Servicio'}
                          </p>
                          <p className="text-sm text-slate-500">
                            {cita.fecha} · {cita.hora_inicio.slice(0, 5)} - {cita.hora_fin.slice(0, 5)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {cita.empleados?.nombre || 'Sin terapeuta'}
                          </p>
                          {cita.notas ? (
                            <p className="mt-1 text-xs text-slate-500">{cita.notas}</p>
                          ) : null}
                        </div>

                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoCitaBadge(cita.estado)}`}
                        >
                          {cita.estado}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Eventos del plan</h2>

              <div className="space-y-3">
                {eventosPlan.length === 0 ? (
                  <p className="text-sm text-slate-500">Sin eventos todavía.</p>
                ) : (
                  eventosPlan.map((evento) => (
                    <div key={evento.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tipoEventoBadge(evento.tipo)}`}
                        >
                          {evento.tipo}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(evento.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-700">
                        {evento.detalle || 'Sin detalle'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}