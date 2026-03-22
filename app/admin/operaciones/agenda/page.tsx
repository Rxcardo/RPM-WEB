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
  nombre?: string | null
  telefono?: string | null
  email?: string | null
  [key: string]: any
}

type Empleado = {
  id: string
  nombre?: string | null
  rol?: string | null
  [key: string]: any
}

type Servicio = {
  id: string
  nombre?: string | null
  precio?: number | null
  [key: string]: any
}

type CitaRaw = {
  id: string
  fecha?: string | null
  hora?: string | null
  duracion_minutos?: number | null
  estado?: string | null
  notas?: string | null
  created_at?: string | null
  [key: string]: any
}

type CitaView = {
  id: string
  fecha: string | null
  hora: string | null
  duracion_minutos: number | null
  estado: string
  notas: string | null
  created_at: string | null
  cliente: Cliente | null
  empleado: Empleado | null
  servicio: Servicio | null
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

function formatDateTime(fecha: string | null | undefined, hora?: string | null) {
  if (!fecha) return '—'
  return hora ? `${formatDate(fecha)} · ${hora}` : formatDate(fecha)
}

function estadoBadge(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'programada':
      return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
    case 'confirmada':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'completada':
      return 'border-violet-400/20 bg-violet-400/10 text-violet-300'
    case 'cancelada':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'no_asistio':
    case 'no asistio':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function getFirstExistingKey(obj: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    if (key in obj) return key
  }
  return null
}

function getDurationFromServicio(servicio: Servicio | null) {
  if (!servicio) return 0

  const possibleKeys = [
    'duracion_minutos',
    'duracion',
    'tiempo',
    'tiempo_minutos',
    'minutos',
    'duracionMinutos',
  ]

  for (const key of possibleKeys) {
    if (key in servicio && servicio[key] != null) {
      const value = Number(servicio[key])
      if (!Number.isNaN(value) && value > 0) return value
    }
  }

  return 0
}

export default function AgendaPage() {
  const [loading, setLoading] = useState(true)
  const [citas, setCitas] = useState<CitaRaw[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [fechaFiltro, setFechaFiltro] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    void loadAgenda()
  }, [])

  async function loadAgenda() {
    setLoading(true)
    setError('')

    try {
      const [citasRes, clientesRes, empleadosRes, serviciosRes] = await Promise.all([
        supabase.from('citas').select('*').order('fecha', { ascending: true }),
        supabase.from('clientes').select('*'),
        supabase.from('empleados').select('*'),
        supabase.from('servicios').select('*'),
      ])

      if (citasRes.error) throw new Error(citasRes.error.message)
      if (clientesRes.error) throw new Error(clientesRes.error.message)
      if (empleadosRes.error) throw new Error(empleadosRes.error.message)
      if (serviciosRes.error) throw new Error(serviciosRes.error.message)

      setCitas((citasRes.data || []) as CitaRaw[])
      setClientes((clientesRes.data || []) as Cliente[])
      setEmpleados((empleadosRes.data || []) as Empleado[])
      setServicios((serviciosRes.data || []) as Servicio[])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo cargar la agenda.')
      setCitas([])
      setClientes([])
      setEmpleados([])
      setServicios([])
    } finally {
      setLoading(false)
    }
  }

  const citasView = useMemo<CitaView[]>(() => {
    const clienteMap = new Map(clientes.map((item) => [item.id, item]))
    const empleadoMap = new Map(empleados.map((item) => [item.id, item]))
    const servicioMap = new Map(servicios.map((item) => [item.id, item]))

    return citas.map((cita) => {
      const clienteKey = getFirstExistingKey(cita, [
        'cliente_id',
        'id_cliente',
        'clienteId',
      ])

      const empleadoKey = getFirstExistingKey(cita, [
        'empleado_id',
        'personal_id',
        'staff_id',
        'terapeuta_id',
        'trainer_id',
        'empleadoId',
        'personalId',
      ])

      const servicioKey = getFirstExistingKey(cita, [
        'servicio_id',
        'id_servicio',
        'servicioId',
      ])

      const clienteId = clienteKey ? cita[clienteKey] : null
      const empleadoId = empleadoKey ? cita[empleadoKey] : null
      const servicioId = servicioKey ? cita[servicioKey] : null

      return {
        id: cita.id,
        fecha: cita.fecha || null,
        hora: cita.hora || null,
        duracion_minutos: cita.duracion_minutos ?? null,
        estado: cita.estado || 'sin estado',
        notas: cita.notas || null,
        created_at: cita.created_at || null,
        cliente: clienteId ? clienteMap.get(clienteId) || null : null,
        empleado: empleadoId ? empleadoMap.get(empleadoId) || null : null,
        servicio: servicioId ? servicioMap.get(servicioId) || null : null,
      }
    })
  }, [citas, clientes, empleados, servicios])

  const citasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase()

    return citasView.filter((cita) => {
      const matchSearch =
        !q ||
        cita.cliente?.nombre?.toLowerCase().includes(q) ||
        cita.cliente?.telefono?.toLowerCase().includes(q) ||
        cita.cliente?.email?.toLowerCase().includes(q) ||
        cita.empleado?.nombre?.toLowerCase().includes(q) ||
        cita.empleado?.rol?.toLowerCase().includes(q) ||
        cita.servicio?.nombre?.toLowerCase().includes(q) ||
        cita.estado?.toLowerCase().includes(q) ||
        cita.notas?.toLowerCase().includes(q)

      const matchEstado =
        estadoFiltro === 'todos' ||
        cita.estado?.toLowerCase() === estadoFiltro.toLowerCase()

      const matchFecha = !fechaFiltro || cita.fecha === fechaFiltro

      return Boolean(matchSearch && matchEstado && matchFecha)
    })
  }, [citasView, search, estadoFiltro, fechaFiltro])

  const stats = useMemo(() => {
    const total = citasView.length
    const programadas = citasView.filter((c) => c.estado?.toLowerCase() === 'programada').length
    const confirmadas = citasView.filter((c) => c.estado?.toLowerCase() === 'confirmada').length
    const completadas = citasView.filter((c) => c.estado?.toLowerCase() === 'completada').length
    const canceladas = citasView.filter((c) => c.estado?.toLowerCase() === 'cancelada').length

    return {
      total,
      programadas,
      confirmadas,
      completadas,
      canceladas,
    }
  }, [citasView])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Operaciones</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Agenda
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Gestión de citas, estados, clientes, personal y servicios.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <ActionCard
            title="Nueva cita"
            description="Crear y registrar una nueva cita."
            href="/admin/operaciones/agenda/nueva"
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
          title="Total citas"
          value={stats.total}
        />
        <StatCard
          title="Programadas"
          value={stats.programadas}
          color="text-sky-400"
        />
        <StatCard
          title="Confirmadas"
          value={stats.confirmadas}
          color="text-emerald-400"
        />
        <StatCard
          title="Completadas"
          value={stats.completadas}
          color="text-violet-400"
        />
        <StatCard
          title="Canceladas"
          value={stats.canceladas}
          color="text-rose-400"
        />
      </div>

      <Section
        title="Filtros"
        description="Busca por cliente, personal, servicio, estado o filtra por fecha."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-white/75">
              Buscar
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cliente, personal, servicio, estado..."
              className="
                w-full rounded-2xl border border-white/10 bg-white/[0.03]
                px-4 py-3 text-sm text-white outline-none transition
                placeholder:text-white/35
                focus:border-white/20 focus:bg-white/[0.05]
              "
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/75">
              Estado
            </label>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="
                w-full rounded-2xl border border-white/10 bg-white/[0.03]
                px-4 py-3 text-sm text-white outline-none transition
                focus:border-white/20 focus:bg-white/[0.05]
              "
            >
              <option value="todos" className="bg-[#11131a] text-white">Todos</option>
              <option value="programada" className="bg-[#11131a] text-white">Programadas</option>
              <option value="confirmada" className="bg-[#11131a] text-white">Confirmadas</option>
              <option value="completada" className="bg-[#11131a] text-white">Completadas</option>
              <option value="cancelada" className="bg-[#11131a] text-white">Canceladas</option>
              <option value="no_asistio" className="bg-[#11131a] text-white">No asistió</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/75">
              Fecha
            </label>
            <input
              type="date"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
              className="
                w-full rounded-2xl border border-white/10 bg-white/[0.03]
                px-4 py-3 text-sm text-white outline-none transition
                focus:border-white/20 focus:bg-white/[0.05]
              "
            />
          </div>
        </div>
      </Section>

      <Section
        title="Listado de citas"
        description="Vista general de todas las citas registradas."
        className="p-0"
        contentClassName="overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr className="text-left text-sm text-white/55">
                <th className="px-4 py-4 font-medium">Fecha / Hora</th>
                <th className="px-4 py-4 font-medium">Cliente</th>
                <th className="px-4 py-4 font-medium">Personal</th>
                <th className="px-4 py-4 font-medium">Servicio</th>
                <th className="px-4 py-4 font-medium">Duración</th>
                <th className="px-4 py-4 font-medium">Estado</th>
                <th className="px-4 py-4 font-medium">Notas</th>
                <th className="px-4 py-4 font-medium">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-white/55">
                    Cargando agenda...
                  </td>
                </tr>
              ) : citasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-white/55">
                    No hay citas registradas.
                  </td>
                </tr>
              ) : (
                citasFiltradas.map((cita) => {
                  const duracion =
                    Number(cita.duracion_minutos || 0) || getDurationFromServicio(cita.servicio)

                  return (
                    <tr key={cita.id} className="align-top transition hover:bg-white/[0.03]">
                      <td className="px-4 py-4">
                        <div className="font-medium text-white">
                          {formatDateTime(cita.fecha, cita.hora)}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          Registro: {formatDate(cita.created_at)}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-white">
                          {cita.cliente?.nombre || 'Sin cliente'}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          {cita.cliente?.telefono || cita.cliente?.email || 'Sin contacto'}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-white">
                          {cita.empleado?.nombre || 'Sin asignar'}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          {cita.empleado?.rol || 'Sin rol'}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-white">
                          {cita.servicio?.nombre || 'Sin servicio'}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-white">
                          {duracion > 0 ? `${duracion} min` : '—'}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoBadge(
                            cita.estado
                          )}`}
                        >
                          {cita.estado}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="max-w-xs text-white/75">
                          {cita.notas?.trim() || 'Sin notas'}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/admin/operaciones/agenda/${cita.id}`}
                            className="
                              rounded-xl border border-white/10 bg-white/[0.03]
                              px-3 py-1.5 text-xs font-medium text-white/80
                              transition hover:bg-white/[0.06]
                            "
                          >
                            Ver
                          </Link>

                          <Link
                            href={`/admin/operaciones/agenda/${cita.id}/editar`}
                            className="
                              rounded-xl border border-white/10 bg-white/[0.03]
                              px-3 py-1.5 text-xs font-medium text-white/80
                              transition hover:bg-white/[0.06]
                            "
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
      </Section>
    </div>
  )
}