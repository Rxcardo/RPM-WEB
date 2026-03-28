'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'

type CitaRow = {
  id: string
  fecha: string | null
  hora_inicio: string | null
  hora_fin: string | null
  estado: string
  notas: string | null
  created_at: string | null
  clientes: {
    id: string
    nombre: string | null
    telefono: string | null
    email: string | null
  } | null
  empleados: {
    id: string
    nombre: string | null
    rol: string | null
  } | null
  servicios: {
    id: string
    nombre: string | null
    duracion_minutos: number | null
  } | null
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString()
  } catch {
    return value
  }
}

function formatDateTime(fecha: string | null | undefined, hora?: string | null) {
  if (!fecha) return '—'
  const fechaStr = formatDate(fecha)
  return hora ? `${fechaStr} · ${hora.slice(0, 5)}` : fechaStr
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
    case 'reprogramada':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'no_asistio':
    case 'no asistio':
      return 'border-orange-400/20 bg-orange-400/10 text-orange-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  tone = 'default',
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  tone?: 'default' | 'confirm' | 'complete' | 'cancel'
}) {
  const toneCls =
    tone === 'confirm'
      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15'
      : tone === 'complete'
        ? 'border-violet-400/20 bg-violet-400/10 text-violet-300 hover:bg-violet-400/15'
        : tone === 'cancel'
          ? 'border-rose-400/20 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15'
          : 'border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`
        rounded-xl border px-3 py-1.5 text-xs font-medium transition
        disabled:cursor-not-allowed disabled:opacity-40
        ${toneCls}
      `}
    >
      {children}
    </button>
  )
}

export default function AgendaPage() {
  const [loading, setLoading] = useState(true)
  const [citas, setCitas] = useState<CitaRow[]>([])
  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [fechaFiltro, setFechaFiltro] = useState('')
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    void loadAgenda()
  }, [])

  async function loadAgenda() {
    setLoading(true)
    setError('')

    try {
      const { data, error: err } = await supabase
        .from('citas')
        .select(`
          id,
          fecha,
          hora_inicio,
          hora_fin,
          estado,
          notas,
          created_at,
          clientes:cliente_id ( id, nombre, telefono, email ),
          empleados:terapeuta_id ( id, nombre, rol ),
          servicios:servicio_id ( id, nombre, duracion_minutos )
        `)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })

      if (err) throw new Error(err.message)

      setCitas((data || []) as unknown as CitaRow[])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo cargar la agenda.')
      setCitas([])
    } finally {
      setLoading(false)
    }
  }

  async function cambiarEstado(cita: CitaRow, nuevoEstado: 'confirmada' | 'completada' | 'cancelada') {
    setActionError('')

    const estadoActual = (cita.estado || '').toLowerCase()

    if (estadoActual === nuevoEstado) return

    if (
      nuevoEstado === 'cancelada' &&
      !window.confirm(
        `¿Seguro que deseas cancelar la cita de ${cita.clientes?.nombre || 'este cliente'}?\n\nSi esta cita tenía una sesión reservada, se liberará automáticamente.`
      )
    ) {
      return
    }

    if (
      nuevoEstado === 'completada' &&
      !window.confirm(
        `¿Seguro que deseas completar esta cita?\n\nLa sesión ya debió quedar reservada desde que la cita fue creada o puesta en un estado válido.`
      )
    ) {
      return
    }

    setUpdatingId(cita.id)

    try {
      const { error: updateError } = await supabase
        .from('citas')
        .update({ estado: nuevoEstado })
        .eq('id', cita.id)

      if (updateError) throw new Error(updateError.message)

      setCitas((prev) =>
        prev.map((item) => (item.id === cita.id ? { ...item, estado: nuevoEstado } : item))
      )
    } catch (err: any) {
      console.error(err)
      setActionError(err?.message || 'No se pudo cambiar el estado de la cita.')
    } finally {
      setUpdatingId(null)
    }
  }

  const citasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase()

    return citas.filter((cita) => {
      const matchSearch =
        !q ||
        cita.clientes?.nombre?.toLowerCase().includes(q) ||
        cita.clientes?.telefono?.toLowerCase().includes(q) ||
        cita.clientes?.email?.toLowerCase().includes(q) ||
        cita.empleados?.nombre?.toLowerCase().includes(q) ||
        cita.empleados?.rol?.toLowerCase().includes(q) ||
        cita.servicios?.nombre?.toLowerCase().includes(q) ||
        cita.estado?.toLowerCase().includes(q) ||
        cita.notas?.toLowerCase().includes(q)

      const matchEstado =
        estadoFiltro === 'todos' ||
        cita.estado?.toLowerCase() === estadoFiltro.toLowerCase()

      const matchFecha = !fechaFiltro || cita.fecha === fechaFiltro

      return Boolean(matchSearch && matchEstado && matchFecha)
    })
  }, [citas, search, estadoFiltro, fechaFiltro])

  const stats = useMemo(
    () => ({
      total: citas.length,
      programadas: citas.filter((c) => c.estado?.toLowerCase() === 'programada').length,
      confirmadas: citas.filter((c) => c.estado?.toLowerCase() === 'confirmada').length,
      completadas: citas.filter((c) => c.estado?.toLowerCase() === 'completada').length,
      canceladas: citas.filter((c) => c.estado?.toLowerCase() === 'cancelada').length,
    }),
    [citas]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Operaciones</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Agenda</h1>
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

      {actionError ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error en acción</p>
          <p className="mt-1 text-sm text-white/55">{actionError}</p>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total citas" value={stats.total} />
        <StatCard title="Programadas" value={stats.programadas} color="text-sky-400" />
        <StatCard title="Confirmadas" value={stats.confirmadas} color="text-emerald-400" />
        <StatCard title="Completadas" value={stats.completadas} color="text-violet-400" />
        <StatCard title="Canceladas" value={stats.canceladas} color="text-rose-400" />
      </div>

      <Section
        title="Filtros"
        description="Busca por cliente, personal, servicio, estado o filtra por fecha."
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-white/75">Buscar</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cliente, personal, servicio, estado..."
              className="
                w-full rounded-2xl border border-white/10 bg-white/[0.03]
                px-4 py-3 text-sm text-white outline-none transition
                placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]
              "
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/75">Estado</label>
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
              <option value="reprogramada" className="bg-[#11131a] text-white">Reprogramadas</option>
              <option value="no_asistio" className="bg-[#11131a] text-white">No asistió</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/75">Fecha</label>
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
                  const duracion = cita.servicios?.duracion_minutos || 0
                  const estado = (cita.estado || '').toLowerCase()
                  const disabled = updatingId === cita.id

                  const puedeConfirmar = ['programada', 'reprogramada'].includes(estado)
                  const puedeCompletar = ['programada', 'confirmada', 'reprogramada'].includes(estado)
                  const puedeCancelar = ['programada', 'confirmada', 'reprogramada'].includes(estado)
                  const puedeEditar = !['completada', 'cancelada'].includes(estado)
                  const puedeReprogramar = !['completada', 'cancelada'].includes(estado)

                  return (
                    <tr key={cita.id} className="align-top transition hover:bg-white/[0.03]">
                      <td className="px-4 py-4">
                        <div className="font-medium text-white">
                          {formatDateTime(cita.fecha, cita.hora_inicio)}
                        </div>
                        {cita.hora_fin ? (
                          <div className="mt-0.5 text-xs text-white/45">
                            hasta {cita.hora_fin.slice(0, 5)}
                          </div>
                        ) : null}
                        <div className="mt-1 text-xs text-white/35">
                          Registro: {cita.created_at ? new Date(cita.created_at).toLocaleDateString() : '—'}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-white">
                          {cita.clientes?.nombre || 'Sin cliente'}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          {cita.clientes?.telefono || cita.clientes?.email || 'Sin contacto'}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-white">
                          {cita.empleados?.nombre || 'Sin asignar'}
                        </div>
                        <div className="mt-1 text-xs text-white/45">
                          {cita.empleados?.rol || 'Sin rol'}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-white">
                          {cita.servicios?.nombre || 'Sin servicio'}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-white">
                          {duracion > 0 ? `${duracion} min` : '—'}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoBadge(cita.estado)}`}
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
                            className={`
                              rounded-xl border px-3 py-1.5 text-xs font-medium transition
                              ${puedeEditar
                                ? 'border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06]'
                                : 'cursor-not-allowed border-white/10 bg-white/[0.02] text-white/35 pointer-events-none'
                              }
                            `}
                          >
                            Editar
                          </Link>

                          <Link
                            href={`/admin/operaciones/agenda/${cita.id}/reprogramar`}
                            className={`
                              rounded-xl border px-3 py-1.5 text-xs font-medium transition
                              ${puedeReprogramar
                                ? 'border-amber-400/20 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15'
                                : 'cursor-not-allowed border-white/10 bg-white/[0.02] text-white/35 pointer-events-none'
                              }
                            `}
                          >
                            Reprogramar
                          </Link>

                          <ActionButton
                            tone="confirm"
                            disabled={!puedeConfirmar || disabled}
                            onClick={() => cambiarEstado(cita, 'confirmada')}
                          >
                            {disabled && updatingId === cita.id ? 'Procesando...' : 'Confirmar'}
                          </ActionButton>

                          <ActionButton
                            tone="complete"
                            disabled={!puedeCompletar || disabled}
                            onClick={() => cambiarEstado(cita, 'completada')}
                          >
                            {disabled && updatingId === cita.id ? 'Procesando...' : 'Completar'}
                          </ActionButton>

                          <ActionButton
                            tone="cancel"
                            disabled={!puedeCancelar || disabled}
                            onClick={() => cambiarEstado(cita, 'cancelada')}
                          >
                            {disabled && updatingId === cita.id ? 'Procesando...' : 'Cancelar'}
                          </ActionButton>
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