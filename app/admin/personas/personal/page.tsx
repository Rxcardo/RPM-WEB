'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'

type Empleado = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  rol: string | null
  estado: string
  created_at: string
}

type CitaRaw = {
  id: string
  estado?: string | null
  fecha?: string | null
  [key: string]: any
}

type PersonalRow = {
  empleado: Empleado
  citasTotal: number
  citasHoy: number
  programadas: number
  confirmadas: number
  completadas: number
  canceladas: number
}

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

const PIE_COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#94a3b8']

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
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'inactivo':
      return 'border-white/10 bg-white/[0.05] text-white/70'
    case 'vacaciones':
      return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
    case 'suspendido':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function cargaBadge(citasHoy: number) {
  if (citasHoy <= 3) return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
  if (citasHoy <= 6) return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
  return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
}

function cargaLabel(citasHoy: number) {
  if (citasHoy <= 3) return 'Baja'
  if (citasHoy <= 6) return 'Media'
  return 'Alta'
}

function getFirstExistingKey(obj: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    if (key in obj) return key
  }
  return null
}

export default function PersonalPage() {
  const [loading, setLoading] = useState(true)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [citas, setCitas] = useState<CitaRaw[]>([])
  const [search, setSearch] = useState('')
  const [rolFiltro, setRolFiltro] = useState('todos')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [error, setError] = useState('')

  useEffect(() => {
    void loadPersonal()
  }, [])

  async function loadPersonal() {
    setLoading(true)
    setError('')

    try {
      const [empleadosRes, citasRes] = await Promise.all([
        supabase
          .from('empleados')
          .select('id, nombre, telefono, email, rol, estado, created_at')
          .order('created_at', { ascending: false }),

        supabase
          .from('citas')
          .select('*'),
      ])

      if (empleadosRes.error) {
        throw new Error(empleadosRes.error.message)
      }

      if (citasRes.error) {
        console.error('Error cargando citas del personal:', citasRes.error.message)
      }

      setEmpleados((empleadosRes.data || []) as Empleado[])
      setCitas((citasRes.data || []) as CitaRaw[])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo cargar el personal.')
      setEmpleados([])
      setCitas([])
    } finally {
      setLoading(false)
    }
  }

  async function cambiarEstadoEmpleado(empleadoId: string, nuevoEstado: string) {
    try {
      const { error } = await supabase
        .from('empleados')
        .update({ estado: nuevoEstado })
        .eq('id', empleadoId)

      if (error) {
        throw new Error(error.message)
      }

      setEmpleados((prev) =>
        prev.map((empleado) =>
          empleado.id === empleadoId ? { ...empleado, estado: nuevoEstado } : empleado
        )
      )
    } catch (err) {
      console.error(err)
      alert('No se pudo actualizar el estado del empleado.')
    }
  }

  const hoy = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const citasPorEmpleado = useMemo(() => {
    const map = new Map<string, CitaRaw[]>()

    for (const cita of citas) {
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

      const current = map.get(empleadoId) || []
      current.push(cita)
      map.set(empleadoId, current)
    }

    return map
  }, [citas])

  const rows = useMemo<PersonalRow[]>(() => {
    return empleados.map((empleado) => {
      const citasEmpleado = citasPorEmpleado.get(empleado.id) || []

      const citasHoy = citasEmpleado.filter((cita) => cita.fecha === hoy).length
      const programadas = citasEmpleado.filter(
        (cita) => cita.estado?.toLowerCase() === 'programada'
      ).length
      const confirmadas = citasEmpleado.filter(
        (cita) => cita.estado?.toLowerCase() === 'confirmada'
      ).length
      const completadas = citasEmpleado.filter(
        (cita) => cita.estado?.toLowerCase() === 'completada'
      ).length
      const canceladas = citasEmpleado.filter(
        (cita) => cita.estado?.toLowerCase() === 'cancelada'
      ).length

      return {
        empleado,
        citasTotal: citasEmpleado.length,
        citasHoy,
        programadas,
        confirmadas,
        completadas,
        canceladas,
      }
    })
  }, [empleados, citasPorEmpleado, hoy])

  const personalFiltrado = useMemo(() => {
    const q = search.trim().toLowerCase()

    return rows.filter(({ empleado }) => {
      const matchSearch =
        !q ||
        empleado.nombre.toLowerCase().includes(q) ||
        empleado.email?.toLowerCase().includes(q) ||
        empleado.telefono?.toLowerCase().includes(q) ||
        empleado.rol?.toLowerCase().includes(q) ||
        empleado.estado?.toLowerCase().includes(q)

      const matchRol =
        rolFiltro === 'todos' || empleado.rol?.toLowerCase() === rolFiltro.toLowerCase()

      const matchEstado =
        estadoFiltro === 'todos' || empleado.estado?.toLowerCase() === estadoFiltro.toLowerCase()

      return matchSearch && matchRol && matchEstado
    })
  }, [rows, search, rolFiltro, estadoFiltro])

  const stats = useMemo(() => {
    const total = empleados.length
    const activos = empleados.filter((e) => e.estado?.toLowerCase() === 'activo').length
    const terapeutas = empleados.filter((e) => e.rol?.toLowerCase() === 'terapeuta').length
    const entrenadores = empleados.filter((e) => e.rol?.toLowerCase() === 'entrenador').length
    const citasHoy = citas.filter((c) => c.fecha === hoy).length

    return {
      total,
      activos,
      terapeutas,
      entrenadores,
      citasHoy,
    }
  }, [empleados, citas, hoy])

  const topCitasChart = useMemo(() => {
    return [...rows]
      .sort((a, b) => b.citasTotal - a.citasTotal)
      .slice(0, 6)
      .map((row) => ({
        nombre: row.empleado.nombre,
        total: row.citasTotal,
        hoy: row.citasHoy,
      }))
  }, [rows])

  const estadosEquipoChart = useMemo(() => {
    const programadas = rows.reduce((acc, row) => acc + row.programadas, 0)
    const confirmadas = rows.reduce((acc, row) => acc + row.confirmadas, 0)
    const completadas = rows.reduce((acc, row) => acc + row.completadas, 0)
    const canceladas = rows.reduce((acc, row) => acc + row.canceladas, 0)

    return [
      { name: 'Programadas', value: programadas },
      { name: 'Confirmadas', value: confirmadas },
      { name: 'Completadas', value: completadas },
      { name: 'Canceladas', value: canceladas },
    ]
  }, [rows])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Personas</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Personal
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Gestión de empleados, roles, estado y carga operativa.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <ActionCard
            title="Nuevo personal"
            description="Registrar un nuevo miembro del equipo."
            href="/admin/personas/personal/nuevo"
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
        <StatCard
          title="Total personal"
          value={stats.total}
          color="text-white"
        />

        <StatCard
          title="Activos"
          value={stats.activos}
          color="text-emerald-400"
        />

        <StatCard
          title="Terapeutas"
          value={stats.terapeutas}
          color="text-violet-400"
        />

        <StatCard
          title="Entrenadores"
          value={stats.entrenadores}
          color="text-amber-300"
        />

        <StatCard
          title="Citas hoy"
          value={stats.citasHoy}
          color="text-sky-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section
          title="Citas por personal"
          description="Top del equipo por carga total y actividad de hoy."
        >
          <div className="h-80">
            {topCitasChart.length === 0 ? (
              <Card className="flex h-full items-center justify-center p-4">
                <p className="text-sm text-white/55">No hay datos para mostrar.</p>
              </Card>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCitasChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="nombre" stroke="rgba(255,255,255,0.45)" />
                  <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.45)" />
                  <Tooltip
                    contentStyle={{
                      background: '#11131a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 16,
                      color: '#fff',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="total" fill="#a78bfa" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="hoy" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>

        <Section
          title="Estados de citas del equipo"
          description="Distribución general del estado de las citas."
        >
          <div className="h-80">
            {estadosEquipoChart.every((x) => x.value === 0) ? (
              <Card className="flex h-full items-center justify-center p-4">
                <p className="text-sm text-white/55">No hay datos para mostrar.</p>
              </Card>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={estadosEquipoChart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                  >
                    {estadosEquipoChart.map((entry, index) => (
                      <Cell
                        key={`${entry.name}-${index}`}
                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#11131a',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 16,
                      color: '#fff',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Section>
      </div>

      <Section
        title="Filtros"
        description="Busca por nombre, correo, teléfono, rol o estado."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Field label="Buscar">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, correo, teléfono, rol o estado..."
                className={inputClassName}
              />
            </Field>
          </div>

          <div>
            <Field label="Rol">
              <select
                value={rolFiltro}
                onChange={(e) => setRolFiltro(e.target.value)}
                className={inputClassName}
              >
                <option value="todos" className="bg-[#11131a] text-white">
                  Todos
                </option>
                <option value="terapeuta" className="bg-[#11131a] text-white">
                  Terapeutas
                </option>
                <option value="entrenador" className="bg-[#11131a] text-white">
                  Entrenadores
                </option>
                <option value="admin" className="bg-[#11131a] text-white">
                  Admin
                </option>
                <option value="recepcion" className="bg-[#11131a] text-white">
                  Recepción
                </option>
              </select>
            </Field>
          </div>

          <div>
            <Field label="Estado">
              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className={inputClassName}
              >
                <option value="todos" className="bg-[#11131a] text-white">
                  Todos
                </option>
                <option value="activo" className="bg-[#11131a] text-white">
                  Activos
                </option>
                <option value="inactivo" className="bg-[#11131a] text-white">
                  Inactivos
                </option>
                <option value="vacaciones" className="bg-[#11131a] text-white">
                  Vacaciones
                </option>
                <option value="suspendido" className="bg-[#11131a] text-white">
                  Suspendidos
                </option>
              </select>
            </Field>
          </div>
        </div>
      </Section>

      <Section
        title="Listado de personal"
        description="Vista general del equipo, estado, carga y citas."
        className="p-0"
        contentClassName="overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr className="text-left text-white/55">
                <th className="px-4 py-3 font-medium">Personal</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Carga hoy</th>
                <th className="px-4 py-3 font-medium">Citas</th>
                <th className="px-4 py-3 font-medium">Registro</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-white/55">
                    Cargando personal...
                  </td>
                </tr>
              ) : personalFiltrado.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-white/55">
                    No hay personal registrado.
                  </td>
                </tr>
              ) : (
                personalFiltrado.map(
                  ({
                    empleado,
                    citasTotal,
                    citasHoy,
                    programadas,
                    confirmadas,
                    completadas,
                    canceladas,
                  }) => (
                    <tr key={empleado.id} className="align-top transition hover:bg-white/[0.03]">
                      <td className="px-4 py-4">
                        <div className="font-medium text-white">{empleado.nombre}</div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-white/75">{empleado.email || 'Sin correo'}</div>
                        <div className="mt-1 text-xs text-white/45">
                          {empleado.telefono || 'Sin teléfono'}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium capitalize text-white">
                          {empleado.rol || 'Sin rol'}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-2">
                          <span
                            className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${estadoBadge(
                              empleado.estado
                            )}`}
                          >
                            {empleado.estado}
                          </span>

                          <select
                            value={empleado.estado}
                            onChange={(e) => void cambiarEstadoEmpleado(empleado.id, e.target.value)}
                            className="
                              rounded-xl border border-white/10 bg-white/[0.03]
                              px-3 py-2 text-xs text-white outline-none transition
                              focus:border-white/20 focus:bg-white/[0.05]
                            "
                          >
                            <option value="activo" className="bg-[#11131a] text-white">
                              Activo
                            </option>
                            <option value="inactivo" className="bg-[#11131a] text-white">
                              Inactivo
                            </option>
                            <option value="vacaciones" className="bg-[#11131a] text-white">
                              Vacaciones
                            </option>
                            <option value="suspendido" className="bg-[#11131a] text-white">
                              Suspendido
                            </option>
                          </select>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${cargaBadge(
                            citasHoy
                          )}`}
                        >
                          {cargaLabel(citasHoy)} · {citasHoy}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-white">Total: {citasTotal}</div>
                        <div className="mt-1 text-xs text-white/45">
                          Prog: {programadas} · Conf: {confirmadas}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          Comp: {completadas} · Canc: {canceladas}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="text-white/75">{formatDate(empleado.created_at)}</div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/admin/personas/personal/${empleado.id}`}
                            className="
                              rounded-xl border border-white/10 bg-white/[0.03]
                              px-3 py-1.5 text-xs font-medium text-white/80
                              transition hover:bg-white/[0.06]
                            "
                          >
                            Ver
                          </Link>

                          <Link
                            href={`/admin/personas/personal/${empleado.id}/editar`}
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
                )
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}