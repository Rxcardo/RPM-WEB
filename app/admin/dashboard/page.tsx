'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type Pago = {
  id: string
  fecha: string
  concepto: string
  monto: number
  estado: string
  clientes: {
    nombre: string
  } | null
  metodos_pago: {
    nombre: string
  } | null
}

type Cita = {
  id: string
  fecha: string
  hora_inicio: string
  estado: string
  clientes: {
    nombre: string
  } | null
}

type PlanProximo = {
  id: string
  fecha_fin: string | null
  sesiones_totales: number
  sesiones_usadas: number
  clientes: {
    nombre: string
  } | null
  planes: {
    nombre: string
    precio: number
  } | null
}

type CuentaVencida = {
  id: string
  fecha: string
  monto: number
  concepto: string
  clientes: {
    nombre: string
  } | null
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(base: string, days: number) {
  const date = new Date(`${base}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatDate(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString()
  } catch {
    return value
  }
}

export default function DashboardPage() {
  const [ingresosHoy, setIngresosHoy] = useState(0)
  const [ingresosMes, setIngresosMes] = useState(0)
  const [cuentasPorCobrar, setCuentasPorCobrar] = useState(0)
  const [cuentasVencidasTotal, setCuentasVencidasTotal] = useState(0)

  const [citasHoy, setCitasHoy] = useState(0)
  const [clientesActivos, setClientesActivos] = useState(0)
  const [planesActivos, setPlanesActivos] = useState(0)
  const [serviciosActivos, setServiciosActivos] = useState(0)
  const [personalActivo, setPersonalActivo] = useState(0)

  const [ultimosPagos, setUltimosPagos] = useState<Pago[]>([])
  const [proximasCitas, setProximasCitas] = useState<Cita[]>([])
  const [planesPorVencer, setPlanesPorVencer] = useState<PlanProximo[]>([])
  const [clientesSinSesiones, setClientesSinSesiones] = useState<PlanProximo[]>([])
  const [cuentasVencidas, setCuentasVencidas] = useState<CuentaVencida[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    void cargarDashboard()
  }, [])

  async function cargarDashboard() {
    try {
      setLoading(true)
      setError('')

      const hoy = todayISO()
      const mes = new Date().toISOString().slice(0, 7)
      const proximaSemana = addDays(hoy, 7)
      const hace7 = addDays(hoy, -7)

      const [
        pagosHoy,
        pagosMes,
        pagosPendientes,
        pagosVencidos,
        citas,
        clientes,
        planes,
        pagos,
        citasProx,
        servicios,
        empleados,
        planesVencen,
      ] = await Promise.all([
        supabase
          .from('pagos')
          .select('monto')
          .eq('fecha', hoy)
          .eq('estado', 'pagado'),

        supabase
          .from('pagos')
          .select('monto, fecha')
          .gte('fecha', `${mes}-01`)
          .eq('estado', 'pagado'),

        supabase
          .from('pagos')
          .select('monto')
          .eq('estado', 'pendiente'),

        supabase
          .from('pagos')
          .select(`
            id,
            fecha,
            monto,
            concepto,
            clientes:cliente_id (
              nombre
            )
          `)
          .eq('estado', 'pendiente')
          .lt('fecha', hace7)
          .order('fecha', { ascending: true })
          .limit(8),

        supabase
          .from('citas')
          .select('id')
          .eq('fecha', hoy)
          .neq('estado', 'cancelada'),

        supabase
          .from('clientes')
          .select('id')
          .eq('estado', 'activo'),

        supabase
          .from('clientes_planes')
          .select('id')
          .eq('estado', 'activo'),

        supabase
          .from('pagos')
          .select(`
            id,
            fecha,
            concepto,
            monto,
            estado,
            clientes:cliente_id (
              nombre
            ),
            metodos_pago:metodo_pago_id (
              nombre
            )
          `)
          .order('created_at', { ascending: false })
          .limit(8),

        supabase
          .from('citas')
          .select(`
            id,
            fecha,
            hora_inicio,
            estado,
            clientes:cliente_id (
              nombre
            )
          `)
          .gte('fecha', hoy)
          .neq('estado', 'cancelada')
          .order('fecha', { ascending: true })
          .order('hora_inicio', { ascending: true })
          .limit(8),

        supabase
          .from('servicios')
          .select('id')
          .eq('estado', 'activo'),

        supabase
          .from('empleados')
          .select('id')
          .eq('estado', 'activo'),

        supabase
          .from('clientes_planes')
          .select(`
            id,
            fecha_fin,
            sesiones_totales,
            sesiones_usadas,
            clientes:cliente_id (
              nombre
            ),
            planes:plan_id (
              nombre,
              precio
            )
          `)
          .eq('estado', 'activo')
          .lte('fecha_fin', proximaSemana)
          .gte('fecha_fin', hoy)
          .order('fecha_fin', { ascending: true }),
      ])

      if (pagosHoy.error) throw pagosHoy.error
      if (pagosMes.error) throw pagosMes.error
      if (pagosPendientes.error) throw pagosPendientes.error
      if (pagosVencidos.error) throw pagosVencidos.error
      if (citas.error) throw citas.error
      if (clientes.error) throw clientes.error
      if (planes.error) throw planes.error
      if (pagos.error) throw pagos.error
      if (citasProx.error) throw citasProx.error
      if (servicios.error) throw servicios.error
      if (empleados.error) throw empleados.error
      if (planesVencen.error) throw planesVencen.error

      const totalHoy =
        pagosHoy.data?.reduce((acc, item) => acc + Number(item.monto), 0) || 0

      const totalMes =
        pagosMes.data?.reduce((acc, item) => acc + Number(item.monto), 0) || 0

      const totalPendiente =
        pagosPendientes.data?.reduce((acc, item) => acc + Number(item.monto), 0) || 0

      const totalVencido =
        pagosVencidos.data?.reduce((acc, item) => acc + Number(item.monto), 0) || 0

      const planesVencer = ((planesVencen.data as unknown as PlanProximo[]) || []).filter(
        (item) => {
          const restantes =
            Number(item.sesiones_totales || 0) - Number(item.sesiones_usadas || 0)
          return restantes > 0
        }
      )

      const sinSesiones = ((planesVencen.data as unknown as PlanProximo[]) || []).filter(
        (item) => {
          const restantes =
            Number(item.sesiones_totales || 0) - Number(item.sesiones_usadas || 0)
          return restantes <= 0
        }
      )

      setIngresosHoy(totalHoy)
      setIngresosMes(totalMes)
      setCuentasPorCobrar(totalPendiente)
      setCuentasVencidasTotal(totalVencido)
      setCitasHoy(citas.data?.length || 0)
      setClientesActivos(clientes.data?.length || 0)
      setPlanesActivos(planes.data?.length || 0)
      setServiciosActivos(servicios.data?.length || 0)
      setPersonalActivo(empleados.data?.length || 0)
      setUltimosPagos((pagos.data as Pago[]) || [])
      setProximasCitas((citasProx.data as Cita[]) || [])
      setPlanesPorVencer(planesVencer)
      setClientesSinSesiones(sinSesiones)
      setCuentasVencidas((pagosVencidos.data as unknown as CuentaVencida[]) || [])
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'No se pudo cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }

  const cards = [
    {
      label: 'Ingresos hoy',
      value: money(ingresosHoy),
      href: '/admin/finanzas/resumen',
    },
    {
      label: 'Ingresos mes',
      value: money(ingresosMes),
      href: '/admin/finanzas/resumen',
    },
    {
      label: 'Cuentas por cobrar',
      value: money(cuentasPorCobrar),
      href: '/admin/finanzas/cuentas-por-cobrar',
    },
    {
      label: 'Cuentas vencidas',
      value: money(cuentasVencidasTotal),
      href: '/admin/finanzas/cuentas-por-cobrar',
    },
    {
      label: 'Citas hoy',
      value: String(citasHoy),
      href: '/admin/operaciones/agenda',
    },
    {
      label: 'Clientes activos',
      value: String(clientesActivos),
      href: '/admin/personas/clientes',
    },
    {
      label: 'Planes activos',
      value: String(planesActivos),
      href: '/admin/operaciones/planes',
    },
    {
      label: 'Personal activo',
      value: String(personalActivo),
      href: '/admin/personas/personal',
    },
  ]

  const alertas = useMemo(() => {
    const items: string[] = []

    if (planesPorVencer.length > 0) {
      items.push(`${planesPorVencer.length} planes vencen en los próximos 7 días`)
    }

    if (clientesSinSesiones.length > 0) {
      items.push(`${clientesSinSesiones.length} clientes ya no tienen sesiones disponibles`)
    }

    if (cuentasPorCobrar > 0) {
      items.push(`Hay ${money(cuentasPorCobrar)} pendientes por cobrar`)
    }

    if (cuentasVencidasTotal > 0) {
      items.push(`Hay ${money(cuentasVencidasTotal)} en cuentas vencidas`)
    }

    if (citasHoy === 0) {
      items.push('No hay citas programadas para hoy')
    }

    return items
  }, [planesPorVencer, clientesSinSesiones, cuentasPorCobrar, cuentasVencidasTotal, citasHoy])

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Resumen ejecutivo del centro</p>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-white p-6">
          <p className="text-sm text-slate-500">Cargando dashboard...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <p className="text-sm text-slate-500">{card.label}</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{card.value}</p>
              </Link>
            ))}
          </div>

          <div className="mb-6 grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Alertas ejecutivas</h2>
                <Link
                  href="/admin/reportes"
                  className="text-sm font-medium text-slate-700 hover:text-slate-900"
                >
                  Ver reportes
                </Link>
              </div>

              {alertas.length === 0 ? (
                <p className="text-sm text-slate-500">Sin alertas importantes por ahora.</p>
              ) : (
                <div className="space-y-3">
                  {alertas.map((alerta, index) => (
                    <div
                      key={index}
                      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                    >
                      {alerta}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">Acciones rápidas</h2>

              <div className="space-y-3">
                <Link
                  href="/admin/operaciones/agenda/nueva"
                  className="block rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Nueva cita
                </Link>

                <Link
                  href="/admin/personas/clientes/nuevo"
                  className="block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Nuevo cliente
                </Link>

                <Link
                  href="/admin/finanzas/ingresos"
                  className="block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Registrar ingreso
                </Link>

                <Link
                  href="/admin/finanzas/egresos"
                  className="block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Registrar egreso
                </Link>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b bg-slate-50 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Próximas citas</h2>
              </div>

              <div className="divide-y divide-slate-100">
                {proximasCitas.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-slate-500">
                    No hay próximas citas registradas.
                  </div>
                ) : (
                  proximasCitas.map((item) => (
                    <div key={item.id} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-900">
                            {item.clientes?.nombre || 'Sin cliente'}
                          </p>
                          <p className="text-sm text-slate-500">
                            {item.fecha} · {item.hora_inicio?.slice(0, 5)} · {item.estado}
                          </p>
                        </div>

                        <Link
                          href={`/admin/operaciones/agenda/${item.id}`}
                          className="text-sm font-medium text-slate-700 hover:text-slate-900"
                        >
                          Ver
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b bg-slate-50 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Últimos pagos</h2>
              </div>

              <div className="divide-y divide-slate-100">
                {ultimosPagos.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-slate-500">
                    No hay pagos recientes.
                  </div>
                ) : (
                  ultimosPagos.map((item) => (
                    <div key={item.id} className="px-5 py-4">
                      <p className="font-medium text-slate-900">{item.concepto}</p>
                      <p className="text-sm text-slate-500">
                        {item.clientes?.nombre || 'Sin cliente'} · {item.fecha}
                      </p>
                      <p className="text-xs text-slate-500">
                        Método: {item.metodos_pago?.nombre || '—'}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-emerald-700">
                        {money(item.monto)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b bg-slate-50 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Planes por vencer</h2>
              </div>

              <div className="divide-y divide-slate-100">
                {planesPorVencer.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-slate-500">
                    No hay planes por vencer en los próximos 7 días.
                  </div>
                ) : (
                  planesPorVencer.map((item) => {
                    const restantes =
                      Number(item.sesiones_totales || 0) - Number(item.sesiones_usadas || 0)

                    return (
                      <div key={item.id} className="px-5 py-4">
                        <p className="font-medium text-slate-900">
                          {item.clientes?.nombre || 'Sin cliente'}
                        </p>
                        <p className="text-sm text-slate-500">
                          {item.planes?.nombre || 'Plan'} · vence {formatDate(item.fecha_fin)}
                        </p>
                        <p className="mt-1 text-sm text-slate-700">Restantes: {restantes}</p>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b bg-slate-50 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Clientes sin sesiones</h2>
              </div>

              <div className="divide-y divide-slate-100">
                {clientesSinSesiones.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-slate-500">
                    No hay clientes sin sesiones en alertas actuales.
                  </div>
                ) : (
                  clientesSinSesiones.map((item) => (
                    <div key={item.id} className="px-5 py-4">
                      <p className="font-medium text-slate-900">
                        {item.clientes?.nombre || 'Sin cliente'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {item.planes?.nombre || 'Plan'} · vence {formatDate(item.fecha_fin)}
                      </p>
                      <p className="mt-1 text-sm font-medium text-red-700">
                        Sin sesiones disponibles
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="border-b bg-slate-50 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">Cuentas vencidas</h2>
              </div>

              <div className="divide-y divide-slate-100">
                {cuentasVencidas.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-slate-500">
                    No hay cuentas vencidas.
                  </div>
                ) : (
                  cuentasVencidas.map((item) => (
                    <div key={item.id} className="px-5 py-4">
                      <p className="font-medium text-slate-900">
                        {item.clientes?.nombre || 'Sin cliente'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {item.concepto} · {item.fecha}
                      </p>
                      <p className="mt-1 text-sm font-medium text-red-700">
                        {money(item.monto)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}