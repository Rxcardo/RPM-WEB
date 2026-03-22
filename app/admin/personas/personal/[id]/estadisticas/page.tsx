'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
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
  LineChart,
  Line,
} from 'recharts'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'

type CitaStats = {
  id: string
  fecha: string
  estado: string
  cliente_id: string | null
  servicios: { id: string; nombre: string } | null
}

const PIE_COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#94a3b8']

function monthLabel(value: string) {
  if (!value) return '—'
  try {
    const [year, month] = value.split('-')
    const date = new Date(Number(year), Number(month) - 1, 1)
    return date.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
  } catch {
    return value
  }
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`
}

function getEstadoColor(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'programada':
      return '#38bdf8'
    case 'confirmada':
      return '#34d399'
    case 'completada':
      return '#a78bfa'
    case 'cancelada':
      return '#f87171'
    case 'reprogramada':
      return '#f59e0b'
    default:
      return '#94a3b8'
  }
}

export default function PersonalEstadisticasPage() {
  const params = useParams()
  const id =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : ''

  const [loading, setLoading] = useState(true)
  const [nombrePersonal, setNombrePersonal] = useState('')
  const [citas, setCitas] = useState<CitaStats[]>([])
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!id) {
      setErrorMsg('No se recibió un identificador válido.')
      setLoading(false)
      return
    }

    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadData() {
    setLoading(true)
    setErrorMsg('')

    const [empleadoRes, citasRes] = await Promise.all([
      supabase.from('empleados').select('id, nombre').eq('id', id).limit(1).maybeSingle(),
      supabase
        .from('citas')
        .select(`
          id,
          fecha,
          estado,
          cliente_id,
          servicios:servicio_id ( id, nombre )
        `)
        .eq('terapeuta_id', id)
        .order('fecha', { ascending: true }),
    ])

    if (empleadoRes.error || !empleadoRes.data) {
      console.error(empleadoRes.error)
      setErrorMsg(empleadoRes.error?.message || 'No se pudo cargar el personal.')
      setLoading(false)
      return
    }

    setNombrePersonal(empleadoRes.data.nombre || 'Personal')

    if (citasRes.error) {
      console.error(citasRes.error)
      setErrorMsg(citasRes.error.message || 'No se pudieron cargar las estadísticas.')
      setCitas([])
      setLoading(false)
      return
    }

    setCitas((citasRes.data || []) as unknown as CitaStats[])
    setLoading(false)
  }

  const resumen = useMemo(() => {
    const total = citas.length
    const programadas = citas.filter((x) => x.estado === 'programada').length
    const confirmadas = citas.filter((x) => x.estado === 'confirmada').length
    const completadas = citas.filter((x) => x.estado === 'completada').length
    const canceladas = citas.filter((x) => x.estado === 'cancelada').length
    const reprogramadas = citas.filter((x) => x.estado === 'reprogramada').length
    const clientesUnicos = new Set(citas.map((x) => x.cliente_id).filter(Boolean)).size
    const ratioCompletadas = total > 0 ? (completadas / total) * 100 : 0
    const ratioCanceladas = total > 0 ? (canceladas / total) * 100 : 0

    return {
      total,
      programadas,
      confirmadas,
      completadas,
      canceladas,
      reprogramadas,
      clientesUnicos,
      ratioCompletadas,
      ratioCanceladas,
    }
  }, [citas])

  const serviciosTop = useMemo(() => {
    const conteo = new Map<string, { nombre: string; total: number }>()

    for (const cita of citas) {
      const nombre = cita.servicios?.nombre || 'Sin servicio'
      if (!conteo.has(nombre)) {
        conteo.set(nombre, { nombre, total: 0 })
      }
      conteo.get(nombre)!.total += 1
    }

    return Array.from(conteo.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
  }, [citas])

  const actividadMensual = useMemo(() => {
    const conteo = new Map<string, number>()

    for (const cita of citas) {
      const mes = cita.fecha?.slice(0, 7) || 'Sin fecha'
      conteo.set(mes, (conteo.get(mes) || 0) + 1)
    }

    return Array.from(conteo.entries())
      .map(([mes, total]) => ({
        mes,
        total,
        label: monthLabel(mes),
      }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-6)
  }, [citas])

  const estadosChart = useMemo(() => {
    return [
      { name: 'Programadas', value: resumen.programadas, fill: '#38bdf8' },
      { name: 'Confirmadas', value: resumen.confirmadas, fill: '#34d399' },
      { name: 'Completadas', value: resumen.completadas, fill: '#a78bfa' },
      { name: 'Canceladas', value: resumen.canceladas, fill: '#f87171' },
      { name: 'Reprogramadas', value: resumen.reprogramadas, fill: '#f59e0b' },
    ].filter((item) => item.value > 0)
  }, [resumen])

  const actividadSemanal = useMemo(() => {
    const dias = new Map<string, number>()

    for (const cita of citas) {
      const fecha = cita.fecha
      if (!fecha) continue
      dias.set(fecha, (dias.get(fecha) || 0) + 1)
    }

    return Array.from(dias.entries())
      .map(([fecha, total]) => ({
        fecha,
        total,
        label: new Date(`${fecha}T00:00:00`).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
        }),
      }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(-10)
  }, [citas])

  const rendimiento = useMemo(() => {
    if (resumen.total === 0) {
      return {
        nivel: 'Sin datos',
        color: 'text-white/70',
        descripcion: 'Todavía no hay suficientes citas para evaluar rendimiento.',
      }
    }

    if (resumen.ratioCompletadas >= 70 && resumen.ratioCanceladas <= 15) {
      return {
        nivel: 'Alto',
        color: 'text-emerald-400',
        descripcion: 'Buen nivel de cumplimiento y baja cancelación.',
      }
    }

    if (resumen.ratioCompletadas >= 45) {
      return {
        nivel: 'Medio',
        color: 'text-amber-300',
        descripcion: 'Rendimiento aceptable con margen de mejora.',
      }
    }

    return {
      nivel: 'Bajo',
      color: 'text-rose-400',
      descripcion: 'Conviene revisar cancelaciones, seguimiento y confirmación.',
    }
  }, [resumen])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-white/55">Personas</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Estadísticas de personal</h1>
          <p className="mt-2 text-sm text-white/55">Cargando estadísticas...</p>
        </div>

        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando datos...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Personas</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Estadísticas de personal
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Rendimiento operativo de {nombrePersonal || 'este miembro del equipo'}.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            title="Volver al perfil"
            description="Regresar al detalle del personal."
            href={`/admin/personas/personal/${id}`}
          />
          <ActionCard
            title="Ver agenda"
            description="Abrir calendario y disponibilidad."
            href={`/admin/personas/personal/${id}/agenda`}
          />
        </div>
      </div>

      {errorMsg ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{errorMsg}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total citas" value={resumen.total} color="text-white" />
        <StatCard title="Completadas" value={resumen.completadas} color="text-violet-400" />
        <StatCard title="Canceladas" value={resumen.canceladas} color="text-rose-400" />
        <StatCard title="Clientes únicos" value={resumen.clientesUnicos} color="text-sky-400" />
        <StatCard
          title="Cumplimiento"
          value={formatPercent(resumen.ratioCompletadas)}
          color="text-emerald-400"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Section
          title="Resumen de rendimiento"
          description="Lectura rápida del desempeño."
        >
          <div className="space-y-4">
            <Card className="p-4">
              <p className="text-sm text-white/55">Nivel actual</p>
              <p className={`mt-2 text-2xl font-semibold ${rendimiento.color}`}>
                {rendimiento.nivel}
              </p>
              <p className="mt-2 text-sm text-white/55">{rendimiento.descripcion}</p>
            </Card>

            <Card className="p-4">
              <p className="text-sm text-white/55">Estados relevantes</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-white/45">Programadas</p>
                  <p className="mt-1 font-semibold text-sky-400">{resumen.programadas}</p>
                </div>
                <div>
                  <p className="text-white/45">Confirmadas</p>
                  <p className="mt-1 font-semibold text-emerald-400">{resumen.confirmadas}</p>
                </div>
                <div>
                  <p className="text-white/45">Reprogramadas</p>
                  <p className="mt-1 font-semibold text-amber-300">{resumen.reprogramadas}</p>
                </div>
                <div>
                  <p className="text-white/45">Canceladas</p>
                  <p className="mt-1 font-semibold text-rose-400">{resumen.canceladas}</p>
                </div>
              </div>
            </Card>
          </div>
        </Section>

        <div className="xl:col-span-2">
          <Section
            title="Distribución por estado"
            description="Comportamiento de las citas según su estado."
          >
            <div className="h-80">
              {estadosChart.length === 0 ? (
                <Card className="flex h-full items-center justify-center p-4">
                  <p className="text-sm text-white/55">Sin datos suficientes.</p>
                </Card>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={estadosChart}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={3}
                    >
                      {estadosChart.map((entry, index) => (
                        <Cell
                          key={`${entry.name}-${index}`}
                          fill={entry.fill || PIE_COLORS[index % PIE_COLORS.length]}
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
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Servicios más usados"
          description="Top de servicios trabajados por este personal."
        >
          {serviciosTop.length === 0 ? (
            <p className="text-sm text-white/55">Sin datos suficientes.</p>
          ) : (
            <div className="space-y-4">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serviciosTop}>
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
                    <Bar dataKey="total" radius={[8, 8, 0, 0]} fill="#38bdf8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {serviciosTop.map((item, index) => (
                  <Card key={item.nombre} className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">
                          {index + 1}. {item.nombre}
                        </p>
                      </div>
                      <div className="text-sm font-semibold text-sky-400">{item.total}</div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section
          title="Actividad últimos meses"
          description="Tendencia mensual de citas."
        >
          {actividadMensual.length === 0 ? (
            <p className="text-sm text-white/55">Sin datos suficientes.</p>
          ) : (
            <div className="space-y-4">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={actividadMensual}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="label" stroke="rgba(255,255,255,0.45)" />
                    <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.45)" />
                    <Tooltip
                      contentStyle={{
                        background: '#11131a',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 16,
                        color: '#fff',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#a78bfa"
                      strokeWidth={3}
                      dot={{ fill: '#a78bfa' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {actividadMensual.map((item) => (
                  <Card key={item.mes} className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-white">{item.label}</div>
                      <div className="text-sm font-semibold text-violet-400">{item.total}</div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </Section>
      </div>

      <Section
        title="Actividad reciente"
        description="Últimos días con movimiento de citas."
      >
        {actividadSemanal.length === 0 ? (
          <p className="text-sm text-white/55">Sin datos suficientes.</p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={actividadSemanal}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.45)" />
                <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.45)" />
                <Tooltip
                  contentStyle={{
                    background: '#11131a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    color: '#fff',
                  }}
                />
                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                  {actividadSemanal.map((item, index) => (
                    <Cell
                      key={`${item.fecha}-${index}`}
                      fill={getEstadoColor(index % 2 === 0 ? 'confirmada' : 'programada')}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Section>

      <Section
        title="Indicadores operativos"
        description="Lectura ejecutiva del desempeño."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4">
            <p className="text-sm text-white/55">Tasa de cancelación</p>
            <p className="mt-2 text-2xl font-semibold text-rose-400">
              {formatPercent(resumen.ratioCanceladas)}
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-sm text-white/55">Estados activos</p>
            <p className="mt-2 text-2xl font-semibold text-amber-300">
              {resumen.programadas + resumen.confirmadas}
            </p>
          </Card>

          <Card className="p-4">
            <p className="text-sm text-white/55">Carga por cliente</p>
            <p className="mt-2 text-2xl font-semibold text-cyan-400">
              {resumen.clientesUnicos > 0
                ? (resumen.total / resumen.clientesUnicos).toFixed(1)
                : '0.0'}
            </p>
          </Card>
        </div>
      </Section>

      <div>
        <Link
          href={`/admin/personas/personal/${id}`}
          className="
            inline-flex rounded-2xl border border-white/10 bg-white/[0.03]
            px-4 py-3 text-sm font-semibold text-white/80 transition
            hover:bg-white/[0.06]
          "
        >
          Volver al perfil
        </Link>
      </div>
    </div>
  )
}