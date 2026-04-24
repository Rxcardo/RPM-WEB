'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

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

type AsistenciaEstado = 'asistio' | 'no_asistio_aviso' | 'no_asistio_sin_aviso'

const OPCIONES: {
  value: AsistenciaEstado
  label: string
  icon: string
  color: string
  hoverColor: string
}[] = [
  {
    value: 'asistio',
    label: 'Asistió',
    icon: '✓',
    color: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    hoverColor: 'hover:bg-emerald-400/20 hover:border-emerald-400/50',
  },
  {
    value: 'no_asistio_aviso',
    label: 'Avisó',
    icon: 'A',
    color: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    hoverColor: 'hover:bg-amber-400/20 hover:border-amber-400/50',
  },
  {
    value: 'no_asistio_sin_aviso',
    label: 'Sin aviso',
    icon: 'X',
    color: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
    hoverColor: 'hover:bg-rose-400/20 hover:border-rose-400/50',
  },
]

function estadoBadgeClass(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'asistio': return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'no_asistio_aviso': return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'no_asistio_sin_aviso': return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'reprogramado': return 'border-violet-400/20 bg-violet-400/10 text-violet-300'
    default: return 'border-white/10 bg-white/[0.05] text-white/50'
  }
}

function estadoLabel(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'asistio': return 'Asistió'
    case 'no_asistio_aviso': return 'Avisó'
    case 'no_asistio_sin_aviso': return 'Sin aviso'
    case 'reprogramado': return 'Reprogramado'
    default: return 'Pendiente'
  }
}

function estadoPlanBadge(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'activo': return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'agotado': return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'vencido': return 'border-white/10 bg-white/[0.05] text-white/70'
    case 'renovado': return 'border-violet-400/20 bg-violet-400/10 text-violet-300'
    case 'cancelado': return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    default: return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function formatFecha(v: string | null | undefined) {
  if (!v) return '—'
  try {
    return new Date(`${v}T00:00:00`).toLocaleDateString('es-VE', {
      day: '2-digit', month: 'short', year: '2-digit',
    })
  } catch { return v }
}

function formatHora(v: string | null | undefined) {
  if (!v) return '—'
  return String(v).slice(0, 5)
}

function roleLabel(rol: string | null | undefined) {
  const v = (rol || '').toLowerCase()
  if (v === 'terapeuta' || v === 'fisioterapeuta') return 'Fisioterapeuta'
  if (v === 'entrenador') return 'Entrenador'
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : 'Sin rol'
}

async function resolveEmpleadoActualId(): Promise<string> {
  try {
    const { data: authData } = await supabase.auth.getUser()
    const authUserId = authData.user?.id
    if (!authUserId) return ''

    const { data } = await supabase
      .from('empleados')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle()

    if (data?.id) return String(data.id)

    const { data: data2 } = await supabase
      .from('empleados')
      .select('id')
      .eq('id', authUserId)
      .maybeSingle()

    return data2?.id ? String(data2.id) : ''
  } catch {
    return ''
  }
}

type Props = {
  sesiones: SesionPlan[]
  onActualizar?: (sesionId: string, nuevoEstado: AsistenciaEstado) => void
}

export default function AsistenciaRapidaTable({ sesiones, onActualizar }: Props) {
  const [savingId, setSavingId] = useState<string | null>(null)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [estadosLocales, setEstadosLocales] = useState<Record<string, AsistenciaEstado | 'pendiente'>>({})

  async function marcar(sesionId: string, nuevoEstado: AsistenciaEstado) {
    if (savingId) return

    const estadoActual = estadosLocales[sesionId] ?? sesiones.find((s) => s.id === sesionId)?.asistencia_estado
    if (estadoActual === nuevoEstado) return

    setSavingId(sesionId)
    setErrores((prev) => ({ ...prev, [sesionId]: '' }))

    try {
      const auditorId = await resolveEmpleadoActualId()

      const { data, error } = await supabase.rpc('marcar_asistencia_entrenamiento_plan', {
        p_entrenamiento_id: sesionId,
        p_asistencia_estado: nuevoEstado,
        p_motivo: null,
        p_marcado_por: auditorId || null,
      })

      if (error) throw new Error(error.message)
      if (data?.ok === false) throw new Error(data?.error || 'No se pudo marcar la asistencia.')

      setEstadosLocales((prev) => ({ ...prev, [sesionId]: nuevoEstado }))
      onActualizar?.(sesionId, nuevoEstado)
    } catch (err: any) {
      setErrores((prev) => ({ ...prev, [sesionId]: err?.message || 'Error al guardar' }))
    } finally {
      setSavingId(null)
    }
  }

  if (sesiones.length === 0) {
    return <p className="text-sm text-white/55">Este cliente no tiene sesiones de plan registradas.</p>
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="min-w-full text-sm">
        <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
          <tr>
            <th className="px-4 py-3 text-left font-medium">Fecha</th>
            <th className="px-4 py-3 text-left font-medium">Hora</th>
            <th className="px-4 py-3 text-left font-medium">Empleado</th>
            <th className="px-4 py-3 text-left font-medium">Plan</th>
            <th className="px-4 py-3 text-left font-medium">Estado</th>
            <th className="px-4 py-3 text-left font-medium">Marcar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {sesiones.map((sesion) => {
            const estadoActual = estadosLocales[sesion.id] ?? (sesion.asistencia_estado || 'pendiente')
            const isLoading = savingId === sesion.id
            const errorMsg = errores[sesion.id]

            return (
              <tr
                key={sesion.id}
                className={`transition hover:bg-white/[0.02] ${isLoading ? 'opacity-60' : ''}`}
              >
                <td className="px-4 py-3 text-white/75 whitespace-nowrap">
                  {formatFecha(sesion.fecha)}
                </td>
                <td className="px-4 py-3 text-white/55 whitespace-nowrap text-xs">
                  {formatHora(sesion.hora_inicio)} – {formatHora(sesion.hora_fin)}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{sesion.empleados?.nombre || 'Sin empleado'}</p>
                  <p className="text-xs text-white/40">{roleLabel(sesion.empleados?.rol)}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-white/75 text-xs max-w-[140px] break-words whitespace-normal">
                    {sesion.clientes_planes?.planes?.nombre || 'Plan'}
                  </p>
                  <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${estadoPlanBadge(sesion.clientes_planes?.estado)}`}>
                    {sesion.clientes_planes?.estado || '—'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoBadgeClass(estadoActual)}`}>
                    {estadoLabel(estadoActual)}
                  </span>
                  {errorMsg ? (
                    <p className="mt-1 text-xs text-rose-400">{errorMsg}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    {OPCIONES.map((op) => {
                      const isActive = estadoActual === op.value
                      return (
                        <button
                          key={op.value}
                          type="button"
                          disabled={isLoading}
                          onClick={() => void marcar(sesion.id, op.value)}
                          title={op.label}
                          className={`
                            inline-flex items-center justify-center rounded-xl border
                            px-3 py-2 text-xs font-semibold transition-all duration-150
                            cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed
                            ${isActive
                              ? `${op.color} ring-1 ring-offset-1 ring-offset-transparent`
                              : `border-white/10 bg-white/[0.03] text-white/50 ${op.hoverColor}`
                            }
                          `}
                        >
                          {isLoading && isActive
                            ? <span className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                            : op.icon
                          }
                        </button>
                      )
                    })}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}