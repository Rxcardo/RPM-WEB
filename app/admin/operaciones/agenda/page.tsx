'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type Cita = {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: string
  notas: string | null
  cliente_id: string
  terapeuta_id: string | null
  servicio_id: string | null
  recurso_id: string | null
  clientes: { id: string; nombre: string } | null
  empleados: { id: string; nombre: string } | null
  servicios: { id: string; nombre: string } | null
  recursos: { id: string; nombre: string } | null
}

type Terapeuta = {
  id: string
  nombre: string
}

const ESTADOS = ['todas', 'programada', 'confirmada', 'cancelada', 'completada', 'reprogramada']

function estadoClasses(estado: string) {
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
      return 'bg-slate-50 text-slate-700 border-slate-200'
  }
}

export default function AgendaPage() {
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [citas, setCitas] = useState<Cita[]>([])
  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([])

  const [search, setSearch] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [estado, setEstado] = useState('todas')
  const [terapeutaId, setTerapeutaId] = useState('todos')

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    loadCitas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha])

  async function loadAll() {
    setLoading(true)

    const [citasRes, terapeutasRes] = await Promise.all([
      supabase
        .from('citas')
        .select(`
          id,
          fecha,
          hora_inicio,
          hora_fin,
          estado,
          notas,
          cliente_id,
          terapeuta_id,
          servicio_id,
          recurso_id,
          clientes:cliente_id ( id, nombre ),
          empleados:terapeuta_id ( id, nombre ),
          servicios:servicio_id ( id, nombre ),
          recursos:recurso_id ( id, nombre )
        `)
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true }),
      supabase
        .from('empleados')
        .select('id, nombre')
        .eq('rol', 'terapeuta')
        .eq('estado', 'activo')
        .order('nombre', { ascending: true }),
    ])

    setCitas((citasRes.data || []) as unknown as Cita[])
    setTerapeutas((terapeutasRes.data || []) as Terapeuta[])
    setLoading(false)
  }

  async function loadCitas() {
    setLoading(true)

    let query = supabase
      .from('citas')
      .select(`
        id,
        fecha,
        hora_inicio,
        hora_fin,
        estado,
        notas,
        cliente_id,
        terapeuta_id,
        servicio_id,
        recurso_id,
        clientes:cliente_id ( id, nombre ),
        empleados:terapeuta_id ( id, nombre ),
        servicios:servicio_id ( id, nombre ),
        recursos:recurso_id ( id, nombre )
      `)
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true })

    if (fecha) query = query.eq('fecha', fecha)

    const { data } = await query
    setCitas((data || []) as unknown as Cita[])
    setLoading(false)
  }

  const filtradas = useMemo(() => {
    return citas.filter((c) => {
      const matchSearch =
        !search.trim() ||
        c.clientes?.nombre?.toLowerCase().includes(search.toLowerCase()) ||
        c.empleados?.nombre?.toLowerCase().includes(search.toLowerCase()) ||
        c.servicios?.nombre?.toLowerCase().includes(search.toLowerCase()) ||
        c.recursos?.nombre?.toLowerCase().includes(search.toLowerCase()) ||
        c.notas?.toLowerCase().includes(search.toLowerCase())

      const matchEstado = estado === 'todas' ? true : c.estado === estado
      const matchTerapeuta = terapeutaId === 'todos' ? true : c.terapeuta_id === terapeutaId

      return matchSearch && matchEstado && matchTerapeuta
    })
  }, [citas, search, estado, terapeutaId])

  const resumen = useMemo(() => {
    return {
      total: filtradas.length,
      programadas: filtradas.filter((x) => x.estado === 'programada').length,
      confirmadas: filtradas.filter((x) => x.estado === 'confirmada').length,
      completadas: filtradas.filter((x) => x.estado === 'completada').length,
      canceladas: filtradas.filter((x) => x.estado === 'cancelada').length,
    }
  }, [filtradas])

  async function cambiarEstado(id: string, nuevoEstado: string) {
    setUpdatingId(id)
    const { error } = await supabase.from('citas').update({ estado: nuevoEstado }).eq('id', id)

    if (!error) {
      setCitas((prev) => prev.map((c) => (c.id === id ? { ...c, estado: nuevoEstado } : c)))
    }

    setUpdatingId(null)
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Administración</p>
          <h1 className="text-2xl font-bold text-slate-900">Agenda</h1>
          <p className="mt-1 text-sm text-slate-600">
            Gestión diaria de citas, cambios de estado y reprogramaciones.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/admin/operaciones/agenda/nueva"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Nueva cita
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-5">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Total</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.total}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Programadas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.programadas}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Confirmadas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.confirmadas}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Completadas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.completadas}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Canceladas</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{resumen.canceladas}</p>
        </div>
      </div>

      <section className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <input
            type="text"
            placeholder="Buscar cliente, terapeuta, servicio o recurso..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />

          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />

          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          >
            {ESTADOS.map((item) => (
              <option key={item} value={item}>
                {item === 'todas' ? 'Todos los estados' : item}
              </option>
            ))}
          </select>

          <select
            value={terapeutaId}
            onChange={(e) => setTerapeutaId(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          >
            <option value="todos">Todos los terapeutas</option>
            {terapeutas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Hora</th>
                <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                <th className="px-4 py-3 text-left font-semibold">Terapeuta</th>
                <th className="px-4 py-3 text-left font-semibold">Servicio</th>
                <th className="px-4 py-3 text-left font-semibold">Recurso</th>
                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                <th className="px-4 py-3 text-left font-semibold">Acciones rápidas</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    Cargando agenda...
                  </td>
                </tr>
              ) : filtradas.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    No hay citas para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filtradas.map((cita) => (
                  <tr key={cita.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-4 text-slate-700">
                      <div className="font-medium">{cita.hora_inicio.slice(0, 5)}</div>
                      <div className="text-xs text-slate-500">{cita.hora_fin.slice(0, 5)}</div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900">{cita.clientes?.nombre || 'Sin cliente'}</div>
                      <div className="text-xs text-slate-500">{cita.fecha}</div>
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {cita.empleados?.nombre || 'Sin terapeuta'}
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {cita.servicios?.nombre || 'Sin servicio'}
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {cita.recursos?.nombre || 'Sin recurso'}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoClasses(cita.estado)}`}
                      >
                        {cita.estado}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => cambiarEstado(cita.id, 'confirmada')}
                          disabled={updatingId === cita.id}
                          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                        >
                          Confirmar
                        </button>

                        <button
                          onClick={() => cambiarEstado(cita.id, 'completada')}
                          disabled={updatingId === cita.id}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                        >
                          Completar
                        </button>

                        <button
                          onClick={() => cambiarEstado(cita.id, 'cancelada')}
                          disabled={updatingId === cita.id}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                        >
                          Cancelar
                        </button>

                        <Link
                          href={`/admin/operaciones/agenda/${cita.id}/reprogramar`}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                        >
                          Reprogramar
                        </Link>

                        <Link
                          href={`/admin/operaciones/agenda/${cita.id}/editar`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Editar
                        </Link>

                        <Link
                          href={`/admin/operaciones/agenda/${cita.id}`}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          Ver
                        </Link>
                      </div>

                      {cita.notas && (
                        <p className="mt-2 max-w-md text-xs text-slate-500">{cita.notas}</p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}