'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type CitaStats = {
  id: string
  fecha: string
  estado: string
  cliente_id: string | null
  servicios: { id: string; nombre: string } | null
}

export default function PersonalEstadisticasPage() {
  const params = useParams()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [nombrePersonal, setNombrePersonal] = useState('')
  const [citas, setCitas] = useState<CitaStats[]>([])

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadData() {
    setLoading(true)

    const [empleadoRes, citasRes] = await Promise.all([
      supabase.from('empleados').select('id, nombre').eq('id', id).single(),
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

    if (empleadoRes.data) {
      setNombrePersonal(empleadoRes.data.nombre || 'Personal')
    }

    if (citasRes.error) {
      console.error(citasRes.error)
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

    return {
      total,
      programadas,
      confirmadas,
      completadas,
      canceladas,
      reprogramadas,
      clientesUnicos,
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
      .slice(0, 5)
  }, [citas])

  const actividadMensual = useMemo(() => {
    const conteo = new Map<string, number>()

    for (const cita of citas) {
      const mes = cita.fecha?.slice(0, 7) || 'Sin fecha'
      conteo.set(mes, (conteo.get(mes) || 0) + 1)
    }

    return Array.from(conteo.entries())
      .map(([mes, total]) => ({ mes, total }))
      .sort((a, b) => a.mes.localeCompare(b.mes))
      .slice(-6)
  }, [citas])

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Personas</p>
          <h1 className="text-2xl font-bold text-slate-900">Estadísticas de personal</h1>
          <p className="mt-1 text-sm text-slate-600">
            Rendimiento operativo de {nombrePersonal || 'este miembro del equipo'}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/personas/personal/${id}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Volver al perfil
          </Link>

          <Link
            href={`/admin/personas/personal/${id}/agenda`}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Ver agenda
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Cargando estadísticas...</p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Total citas</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.total}</p>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Completadas</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.completadas}</p>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Canceladas</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.canceladas}</p>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Clientes únicos</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.clientesUnicos}</p>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Programadas</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.programadas}</p>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Confirmadas</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.confirmadas}</p>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Reprogramadas</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.reprogramadas}</p>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">Ratio completadas</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">
                {resumen.total > 0 ? `${Math.round((resumen.completadas / resumen.total) * 100)}%` : '0%'}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Servicios más usados
              </h2>

              {serviciosTop.length === 0 ? (
                <p className="text-sm text-slate-500">Sin datos suficientes.</p>
              ) : (
                <div className="space-y-3">
                  {serviciosTop.map((item) => (
                    <div
                      key={item.nombre}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                    >
                      <div className="font-medium text-slate-900">{item.nombre}</div>
                      <div className="text-sm font-semibold text-slate-700">{item.total}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Actividad últimos meses
              </h2>

              {actividadMensual.length === 0 ? (
                <p className="text-sm text-slate-500">Sin datos suficientes.</p>
              ) : (
                <div className="space-y-3">
                  {actividadMensual.map((item) => (
                    <div
                      key={item.mes}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                    >
                      <div className="font-medium text-slate-900">{item.mes}</div>
                      <div className="text-sm font-semibold text-slate-700">{item.total}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}