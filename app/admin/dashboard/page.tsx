'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'
import EntrenamientosHoy from '@/components/dashboard/EntrenamientosHoy'

type Cliente = {
  id: string
  estado?: string | null
  created_at?: string | null
}

type CitaRaw = {
  id: string
  fecha?: string | null
  estado?: string | null
  [key: string]: any
}

type Pago = {
  id: string
  fecha?: string | null
  monto?: number | null
  monto_equivalente_usd?: number | null
  estado?: string | null
}

type Empleado = {
  id: string
  nombre?: string | null
  estado?: string | null
}

type PlanCliente = {
  id: string
  fecha_fin?: string | null
  estado?: string | null
  sesiones_totales?: number | null
  sesiones_usadas?: number | null
}

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function sameMonth(dateStr: string | null | undefined, today: Date) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth()
}

function sameDay(dateStr: string | null | undefined, todayStr: string) {
  if (!dateStr) return false
  return dateStr === todayStr
}

function getFirstExistingKey(obj: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    if (key in obj) return key
  }
  return null
}

function getDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [citas, setCitas] = useState<CitaRaw[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [clientesPlanes, setClientesPlanes] = useState<PlanCliente[]>([])

  useEffect(() => {
    void loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    setError('')

    try {
      const [clientesRes, citasRes, pagosRes, empleadosRes, clientesPlanesRes] =
        await Promise.all([
          supabase.from('clientes').select('id, estado, created_at'),
          supabase.from('citas').select('*'),
          supabase
            .from('pagos')
            .select('id, fecha, monto, monto_equivalente_usd, estado'),
          supabase.from('empleados').select('id, nombre, estado'),
          supabase
            .from('clientes_planes')
            .select('id, fecha_fin, estado, sesiones_totales, sesiones_usadas'),
        ])

      if (clientesRes.error) throw new Error(clientesRes.error.message)
      if (citasRes.error) throw new Error(citasRes.error.message)
      if (pagosRes.error) throw new Error(pagosRes.error.message)
      if (empleadosRes.error) throw new Error(empleadosRes.error.message)
      if (clientesPlanesRes.error) throw new Error(clientesPlanesRes.error.message)

      setClientes((clientesRes.data || []) as Cliente[])
      setCitas((citasRes.data || []) as CitaRaw[])
      setPagos((pagosRes.data || []) as Pago[])
      setEmpleados((empleadosRes.data || []) as Empleado[])
      setClientesPlanes((clientesPlanesRes.data || []) as PlanCliente[])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo cargar el dashboard.')
      setClientes([])
      setCitas([])
      setPagos([])
      setEmpleados([])
      setClientesPlanes([])
    } finally {
      setLoading(false)
    }
  }

  const today = useMemo(() => new Date(), [])
  const hoy = useMemo(() => getDateKey(today), [today])

  const stats = useMemo(() => {
    const clientesActivos = clientes.filter(
      (c) => c.estado?.toLowerCase() === 'activo'
    ).length

    const clientesNuevosMes = clientes.filter((c) =>
      sameMonth(c.created_at, today)
    ).length

    const citasHoy = citas.filter((c) => sameDay(c.fecha, hoy)).length

    const programadasHoy = citas.filter(
      (c) => sameDay(c.fecha, hoy) && c.estado?.toLowerCase() === 'programada'
    ).length

    const confirmadasHoy = citas.filter(
      (c) => sameDay(c.fecha, hoy) && c.estado?.toLowerCase() === 'confirmada'
    ).length

    const completadasMes = citas.filter(
      (c) => sameMonth(c.fecha, today) && c.estado?.toLowerCase() === 'completada'
    ).length

    const canceladasMes = citas.filter(
      (c) => sameMonth(c.fecha, today) && c.estado?.toLowerCase() === 'cancelada'
    ).length

    const ingresosMes = pagos
      .filter((p) => p.estado?.toLowerCase() === 'pagado' && sameMonth(p.fecha, today))
      .reduce(
        (acc, pago) => acc + Number(pago.monto_equivalente_usd || pago.monto || 0),
        0
      )

    const pagosHoy = pagos
      .filter((p) => p.estado?.toLowerCase() === 'pagado' && sameDay(p.fecha, hoy))
      .reduce(
        (acc, pago) => acc + Number(pago.monto_equivalente_usd || pago.monto || 0),
        0
      )

    const personalActivo = empleados.filter(
      (e) => e.estado?.toLowerCase() === 'activo'
    ).length

    const planesPorVencer = clientesPlanes.filter((cp) => {
      if (cp.estado?.toLowerCase() !== 'activo' || !cp.fecha_fin) return false

      const fin = new Date(cp.fecha_fin)
      const diff = fin.getTime() - today.getTime()
      const dias = Math.ceil(diff / (1000 * 60 * 60 * 24))

      return dias >= 0 && dias <= 7
    }).length

    const planesActivos = clientesPlanes.filter(
      (cp) => cp.estado?.toLowerCase() === 'activo'
    ).length

    const totalSesionesDisponibles = clientesPlanes
      .filter((cp) => cp.estado?.toLowerCase() === 'activo')
      .reduce(
        (acc, cp) =>
          acc + (Number(cp.sesiones_totales || 0) - Number(cp.sesiones_usadas || 0)),
        0
      )

    return {
      clientesActivos,
      clientesNuevosMes,
      citasHoy,
      programadasHoy,
      confirmadasHoy,
      completadasMes,
      canceladasMes,
      ingresosMes,
      pagosHoy,
      personalActivo,
      planesPorVencer,
      planesActivos,
      totalSesionesDisponibles,
    }
  }, [clientes, citas, pagos, empleados, clientesPlanes, today, hoy])

  const topPersonal = useMemo(() => {
    const counts = new Map<string, number>()

    for (const cita of citas) {
      if (!sameMonth(cita.fecha, today)) continue

      const empleadoKey = getFirstExistingKey(cita, [
        'empleado_id',
        'personal_id',
        'staff_id',
        'terapeuta_id',
        'trainer_id',
        'empleadoId',
        'personalId',
      ])

      const empleadoId = empleadoKey ? cita[empleadoKey] : null
      if (!empleadoId) continue

      counts.set(empleadoId, (counts.get(empleadoId) || 0) + 1)
    }

    return empleados
      .map((empleado) => ({
        id: empleado.id,
        nombre: empleado.nombre || 'Sin nombre',
        total: counts.get(empleado.id) || 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
  }, [citas, empleados, today])

  const alertas = useMemo(() => {
    const items: { titulo: string; detalle: string; tipo: 'warning' | 'info' | 'success' }[] =
      []

    if (stats.planesPorVencer > 0) {
      items.push({
        titulo: '⚠️ Planes por vencer',
        detalle: `${stats.planesPorVencer} plan(es) vencen en los próximos 7 días.`,
        tipo: 'warning',
      })
    }

    if (stats.canceladasMes > 5) {
      items.push({
        titulo: '⚠️ Citas canceladas',
        detalle: `${stats.canceladasMes} cita(s) canceladas este mes.`,
        tipo: 'warning',
      })
    }

    if (stats.totalSesionesDisponibles < 20) {
      items.push({
        titulo: '⚠️ Sesiones disponibles bajas',
        detalle: `Solo quedan ${stats.totalSesionesDisponibles} sesiones disponibles en total.`,
        tipo: 'warning',
      })
    }

    if (items.length === 0) {
      items.push({
        titulo: '✓ Todo en orden',
        detalle: 'No hay alertas críticas por el momento.',
        tipo: 'success',
      })
    }

    return items
  }, [stats])

  if (loading) {
    return (
      <div className="space-y-4 px-3 pb-4 sm:px-4 md:px-0">
        <div>
          <p className="text-xs text-white/55 sm:text-sm">Administración</p>
          <h1 className="mt-1 text-xl font-semibold text-white sm:text-2xl">
            Dashboard
          </h1>
        </div>

        <Card className="p-4 sm:p-6">
          <p className="text-sm text-white/55 sm:text-base">Cargando dashboard...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5 px-3 pb-4 sm:px-4 md:space-y-6 md:px-0">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs text-white/55 sm:text-sm">Administración</p>

          <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            Dashboard
          </h1>

          <p className="mt-2 text-xs leading-5 text-white/55 sm:text-sm">
            Vista general ·{' '}
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ActionCard
            title="Nueva cita"
            description="Registrar una cita."
            href="/admin/operaciones/agenda/nueva"
          />

          <ActionCard
            title="Nuevo cliente"
            description="Crear perfil de cliente."
            href="/admin/personas/clientes/nuevo"
          />

          <ActionCard
            title="Reportes"
            description="Ver reportes financieros."
            href="/admin/reportes"
          />
        </div>
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error al cargar</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Clientes activos"
          value={stats.clientesActivos}
          subtitle={`+${stats.clientesNuevosMes} este mes`}
          color="text-sky-400"
        />

        <StatCard
          title="Planes activos"
          value={stats.planesActivos}
          subtitle={`${stats.totalSesionesDisponibles} sesiones disponibles`}
          color="text-violet-400"
        />

        <StatCard
          title="Citas hoy"
          value={stats.citasHoy}
          subtitle={`${stats.programadasHoy} programadas`}
          color="text-amber-400"
        />

        <StatCard
          title="Ingresos del mes"
          value={money(stats.ingresosMes)}
          subtitle={`Hoy: ${money(stats.pagosHoy)}`}
          color="text-emerald-400"
        />

        <StatCard
          title="Personal activo"
          value={stats.personalActivo}
          subtitle="Ver carga abajo"
        />

        <StatCard
          title="Planes por vencer"
          value={stats.planesPorVencer}
          subtitle="Próximos 7 días"
          color={stats.planesPorVencer > 0 ? 'text-rose-400' : 'text-white/75'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-1">
          <EntrenamientosHoy />
        </div>

        <div className="xl:col-span-1">
          <Section
            title="Resumen del mes"
            description="Estadísticas operativas."
          >
            <div className="space-y-3">
              <StatCard
                title="Citas completadas"
                value={stats.completadasMes}
                color="text-emerald-400"
              />

              <StatCard
                title="Citas canceladas"
                value={stats.canceladasMes}
                color="text-rose-400"
              />

              <StatCard
                title="Clientes nuevos"
                value={stats.clientesNuevosMes}
                color="text-sky-400"
              />
            </div>
          </Section>
        </div>

        <div className="xl:col-span-1">
          <Section title="Alertas" description="Puntos de atención.">
            <div className="space-y-3">
              {alertas.map((alerta, index) => (
                <Card
                  key={`${alerta.titulo}-${index}`}
                  className={`p-4 ${
                    alerta.tipo === 'warning'
                      ? 'border-amber-400/30 bg-amber-400/5'
                      : alerta.tipo === 'success'
                      ? 'border-emerald-400/30 bg-emerald-400/5'
                      : ''
                  }`}
                >
                  <p className="font-medium text-white">{alerta.titulo}</p>
                  <p className="mt-1 text-sm text-white/55">{alerta.detalle}</p>
                </Card>
              ))}
            </div>
          </Section>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title="Personal con más citas" description="Top 5 del mes.">
          <div className="space-y-3">
            {topPersonal.length === 0 ? (
              <Card className="p-4">
                <p className="text-sm text-white/55">
                  No hay datos de personal para mostrar.
                </p>
              </Card>
            ) : (
              topPersonal.map((item, index) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 sm:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          index === 0
                            ? 'bg-amber-400/20 text-amber-300'
                            : index === 1
                            ? 'bg-gray-400/20 text-gray-300'
                            : index === 2
                            ? 'bg-orange-400/20 text-orange-300'
                            : 'bg-white/10 text-white/75'
                        }`}
                      >
                        {index + 1}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">{item.nombre}</p>
                        <p className="text-xs text-white/55">Citas completadas</p>
                      </div>
                    </div>

                    <p className="shrink-0 text-lg font-semibold text-white sm:text-xl">
                      {item.total}
                    </p>
                  </div>
                </Card>
              ))
            )}
          </div>
        </Section>

        <Section title="Acciones rápidas" description="Atajos principales.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ActionCard
              title="Clientes"
              description="Ver listado completo."
              href="/admin/personas/clientes"
            />

            <ActionCard
              title="Agenda"
              description="Revisar citas."
              href="/admin/operaciones/agenda"
            />

            <ActionCard
              title="Finanzas"
              description="Ver ingresos/egresos."
              href="/admin/finanzas"
            />

            <ActionCard
              title="Personal"
              description="Ver empleados."
              href="/admin/personas/personal"
            />
          </div>
        </Section>
      </div>
    </div>
  )
}