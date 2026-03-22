'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'

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
          supabase.from('pagos').select('id, fecha, monto, estado'),
          supabase.from('empleados').select('id, nombre, estado'),
          supabase.from('clientes_planes').select('id, fecha_fin, estado'),
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
      .reduce((acc, pago) => acc + Number(pago.monto || 0), 0)

    const pagosHoy = pagos
      .filter((p) => p.estado?.toLowerCase() === 'pagado' && sameDay(p.fecha, hoy))
      .reduce((acc, pago) => acc + Number(pago.monto || 0), 0)

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
    const items: { titulo: string; detalle: string }[] = []

    if (stats.planesPorVencer > 0) {
      items.push({
        titulo: 'Planes por vencer',
        detalle: `${stats.planesPorVencer} plan(es) vencen en los próximos 7 días.`,
      })
    }

    if (stats.canceladasMes > 0) {
      items.push({
        titulo: 'Citas canceladas',
        detalle: `${stats.canceladasMes} cita(s) canceladas este mes.`,
      })
    }

    if (stats.programadasHoy > stats.confirmadasHoy) {
      items.push({
        titulo: 'Citas pendientes por confirmar',
        detalle: `${stats.programadasHoy} programadas hoy y ${stats.confirmadasHoy} confirmadas.`,
      })
    }

    if (items.length === 0) {
      items.push({
        titulo: 'Todo en orden',
        detalle: 'No hay alertas críticas por el momento.',
      })
    }

    return items
  }, [stats])

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-white/55">Administración</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Dashboard</h1>
        </div>

        <Card className="p-6">
          <p className="text-white/55">Cargando dashboard...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Administración</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Dashboard
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Resumen general de clientes, agenda, ingresos y personal.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ActionCard
            title="Nueva cita"
            description="Registrar una cita rápidamente."
            href="/admin/operaciones/agenda/nueva"
          />
          <ActionCard
            title="Nuevo cliente"
            description="Crear un cliente y activar su perfil."
            href="/admin/personas/clientes/nuevo"
          />
          <ActionCard
            title="Finanzas"
            description="Ir al módulo financiero."
            href="/admin/finanzas"
          />
        </div>
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error al cargar</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          title="Clientes activos"
          value={stats.clientesActivos}
          subtitle={`Nuevos este mes: ${stats.clientesNuevosMes}`}
        />

        <StatCard
          title="Citas hoy"
          value={stats.citasHoy}
          subtitle={`Programadas: ${stats.programadasHoy} · Confirmadas: ${stats.confirmadasHoy}`}
          color="text-sky-400"
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
          subtitle="Carga mensual abajo"
        />

        <StatCard
          title="Planes por vencer"
          value={stats.planesPorVencer}
          subtitle="Próximos 7 días"
          color="text-rose-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Section
            title="Resumen operativo"
            description="Vista rápida del comportamiento del mes y del día."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <StatCard
                title="Citas completadas este mes"
                value={stats.completadasMes}
                color="text-violet-400"
              />

              <StatCard
                title="Citas canceladas este mes"
                value={stats.canceladasMes}
                color="text-rose-400"
              />

              <StatCard
                title="Pagos recibidos hoy"
                value={money(stats.pagosHoy)}
                color="text-emerald-400"
              />

              <StatCard
                title="Clientes nuevos este mes"
                value={stats.clientesNuevosMes}
              />
            </div>
          </Section>
        </div>

        <Section
          title="Alertas"
          description="Puntos que requieren atención."
        >
          <div className="space-y-3">
            {alertas.map((alerta, index) => (
              <Card key={`${alerta.titulo}-${index}`} className="p-4">
                <p className="font-medium text-white">{alerta.titulo}</p>
                <p className="mt-1 text-sm text-white/55">{alerta.detalle}</p>
              </Card>
            ))}
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section
          title="Personal con más citas"
          description="Top 5 del mes actual."
        >
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
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-white">
                        {index + 1}. {item.nombre}
                      </p>
                      <p className="text-sm text-white/55">Citas este mes</p>
                    </div>

                    <p className="text-xl font-semibold text-white">{item.total}</p>
                  </div>
                </Card>
              ))
            )}
          </div>
        </Section>

        <Section
          title="Acciones rápidas"
          description="Atajos a los módulos principales."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ActionCard
              title="Clientes"
              description="Ver listado y planes activos."
              href="/admin/personas/clientes"
            />

            <ActionCard
              title="Agenda"
              description="Revisar citas y estados."
              href="/admin/operaciones/agenda"
            />

            <ActionCard
              title="Personal"
              description="Ver carga y disponibilidad."
              href="/admin/personas/personal"
            />

            <ActionCard
              title="Planes"
              description="Administrar catálogo."
              href="/admin/operaciones/planes"
            />
          </div>
        </Section>
      </div>
    </div>
  )
}