'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type Empleado = {
  id: string
  nombre: string
  rol: string
  estado: string
}

type ResumenTerapeuta = {
  empleado_id: string
  empleado_nombre: string
  citas: number
  base: number
  rpm: number
  profesional: number
}

type Liquidacion = {
  id: string
  empleado_id: string
  fecha_inicio: string
  fecha_fin: string
  total_base: number
  total_rpm: number
  total_profesional: number
  porcentaje_rpm: number
  porcentaje_profesional: number
  cantidad_citas: number
  estado: 'pendiente' | 'pagado'
  notas: string | null
  created_at: string
  pagado_at: string | null
  egreso_id: string | null
  empleados: { nombre: string } | null
}

type CitaComision = {
  id: string
  fecha: string
  estado: string
  terapeuta_id: string | null
  cliente_id: string | null
  servicio_id: string | null
  empleados: { nombre: string } | null
  clientes: { nombre: string } | null
  servicios: { nombre: string; precio: number | null } | null
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function firstDayOfMonthISO() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function estadoBadge(estado: string) {
  if (estado === 'pagado') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

export default function ComisionesPage() {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [citas, setCitas] = useState<CitaComision[]>([])
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([])

  const [fechaInicio, setFechaInicio] = useState(firstDayOfMonthISO())
  const [fechaFin, setFechaFin] = useState(todayISO())
  const [empleadoId, setEmpleadoId] = useState('')
  const [porcentajeRpm, setPorcentajeRpm] = useState('40')
  const [porcentajeProfesional, setPorcentajeProfesional] = useState('60')
  const [notas, setNotas] = useState('')

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setErrorMsg('')
      setSuccessMsg('')

      const [empleadosRes, citasRes, liquidacionesRes] = await Promise.all([
        supabase
          .from('empleados')
          .select('id, nombre, rol, estado')
          .eq('estado', 'activo')
          .in('rol', ['terapeuta', 'fisioterapeuta', 'coach', 'entrenador'])
          .order('nombre', { ascending: true }),

        supabase
          .from('citas')
          .select(`
            id,
            fecha,
            estado,
            terapeuta_id,
            cliente_id,
            servicio_id,
            empleados:terapeuta_id ( nombre ),
            clientes:cliente_id ( nombre ),
            servicios:servicio_id ( nombre, precio )
          `)
          .in('estado', ['completada', 'confirmada'])
          .order('fecha', { ascending: false }),

        supabase
          .from('comisiones_liquidaciones')
          .select(`
            id,
            empleado_id,
            fecha_inicio,
            fecha_fin,
            total_base,
            total_rpm,
            total_profesional,
            porcentaje_rpm,
            porcentaje_profesional,
            cantidad_citas,
            estado,
            notas,
            created_at,
            pagado_at,
            egreso_id,
            empleados:empleado_id ( nombre )
          `)
          .order('created_at', { ascending: false }),
      ])

      if (empleadosRes.error) throw empleadosRes.error
      if (citasRes.error) throw citasRes.error
      if (liquidacionesRes.error) throw liquidacionesRes.error

      setEmpleados((empleadosRes.data || []) as Empleado[])
      setCitas((citasRes.data || []) as unknown as CitaComision[])
      setLiquidaciones((liquidacionesRes.data || []) as unknown as Liquidacion[])
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudieron cargar las comisiones.')
      setEmpleados([])
      setCitas([])
      setLiquidaciones([])
    } finally {
      setLoading(false)
    }
  }

  const citasFiltradas = useMemo(() => {
    return citas.filter((c) => {
      const matchEmpleado = !empleadoId || c.terapeuta_id === empleadoId
      const matchFecha = c.fecha >= fechaInicio && c.fecha <= fechaFin
      return matchEmpleado && matchFecha
    })
  }, [citas, empleadoId, fechaInicio, fechaFin])

  const resumenTerapeutas = useMemo<ResumenTerapeuta[]>(() => {
    const rpmPct = Number(porcentajeRpm || 0)
    const profPct = Number(porcentajeProfesional || 0)

    const map = new Map<string, ResumenTerapeuta>()

    for (const row of citasFiltradas) {
      if (!row.terapeuta_id) continue

      const base = Number(row.servicios?.precio || 0)
      const rpm = (base * rpmPct) / 100
      const profesional = (base * profPct) / 100

      const prev = map.get(row.terapeuta_id) || {
        empleado_id: row.terapeuta_id,
        empleado_nombre: row.empleados?.nombre || 'Sin terapeuta',
        citas: 0,
        base: 0,
        rpm: 0,
        profesional: 0,
      }

      prev.citas += 1
      prev.base += base
      prev.rpm += rpm
      prev.profesional += profesional

      map.set(row.terapeuta_id, prev)
    }

    return Array.from(map.values()).sort((a, b) =>
      a.empleado_nombre.localeCompare(b.empleado_nombre)
    )
  }, [citasFiltradas, porcentajeRpm, porcentajeProfesional])

  const resumenGeneral = useMemo(() => {
    const pendientes = liquidaciones
      .filter((x) => x.estado === 'pendiente')
      .reduce((acc, x) => acc + Number(x.total_profesional || 0), 0)

    const pagadas = liquidaciones
      .filter((x) => x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.total_profesional || 0), 0)

    const basePeriodo = resumenTerapeutas.reduce((acc, x) => acc + x.base, 0)
    const rpmPeriodo = resumenTerapeutas.reduce((acc, x) => acc + x.rpm, 0)
    const profesionalPeriodo = resumenTerapeutas.reduce((acc, x) => acc + x.profesional, 0)
    const citasPeriodo = resumenTerapeutas.reduce((acc, x) => acc + x.citas, 0)

    return {
      pendientes,
      pagadas,
      basePeriodo,
      rpmPeriodo,
      profesionalPeriodo,
      citasPeriodo,
    }
  }, [liquidaciones, resumenTerapeutas])

  async function handleGenerarLiquidacion(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!empleadoId) {
      setErrorMsg('Debes seleccionar un terapeuta.')
      return
    }

    const rpm = Number(porcentajeRpm || 0)
    const profesional = Number(porcentajeProfesional || 0)

    if (rpm < 0 || profesional < 0) {
      setErrorMsg('Los porcentajes no pueden ser negativos.')
      return
    }

    if (Number((rpm + profesional).toFixed(2)) !== 100) {
      setErrorMsg('La suma de porcentajes debe ser 100.')
      return
    }

    try {
      setGenerating(true)

      const { data, error } = await supabase.rpc('generar_liquidacion_comision', {
        p_empleado_id: empleadoId,
        p_fecha_inicio: fechaInicio,
        p_fecha_fin: fechaFin,
        p_porcentaje_rpm: rpm,
        p_porcentaje_profesional: profesional,
        p_notas: notas.trim() || null,
      })

      if (error) throw error

      await loadData()
      setSuccessMsg(
        `Liquidación creada. ${data?.cantidad_citas || 0} citas incluidas, total profesional ${money(
          data?.total_profesional || 0
        )}.`
      )
      setNotas('')
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo generar la liquidación.')
    } finally {
      setGenerating(false)
    }
  }

  async function marcarPagada(liquidacionId: string) {
    try {
      setPayingId(liquidacionId)
      setErrorMsg('')
      setSuccessMsg('')

      const { data, error } = await supabase.rpc('marcar_liquidacion_comision_pagada', {
        p_liquidacion_id: liquidacionId,
        p_metodo_pago_id: null,
        p_notas: null,
      })

      if (error) throw error

      await loadData()
      setSuccessMsg(
        data?.already_paid
          ? 'La liquidación ya estaba pagada.'
          : 'Liquidación marcada como pagada y egreso creado correctamente.'
      )
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo marcar como pagada.')
    } finally {
      setPayingId(null)
    }
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Finanzas</p>
          <h1 className="text-2xl font-bold text-slate-900">Comisiones Pro</h1>
          <p className="mt-1 text-sm text-slate-600">
            Liquidaciones reales por terapeuta, período y estado de pago.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/finanzas/resumen"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Volver a resumen
          </Link>
          <Link
            href="/admin/finanzas/cuentas-por-cobrar"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Cuentas por cobrar
          </Link>
        </div>
      </div>

      {errorMsg ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {successMsg ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMsg}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Base período</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{money(resumenGeneral.basePeriodo)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">RPM período</p>
          <p className="mt-2 text-3xl font-bold text-blue-700">{money(resumenGeneral.rpmPeriodo)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Profesional período</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">
            {money(resumenGeneral.profesionalPeriodo)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pendiente pagar</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">{money(resumenGeneral.pendientes)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Citas período</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{resumenGeneral.citasPeriodo}</p>
        </div>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <section className="xl:col-span-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Generar liquidación</h2>

          <form onSubmit={handleGenerarLiquidacion} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Terapeuta
              </label>
              <select
                value={empleadoId}
                onChange={(e) => setEmpleadoId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="">Seleccionar</option>
                {empleados.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nombre} · {emp.rol}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Fecha inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Fecha fin
              </label>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  % RPM
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={porcentajeRpm}
                  onChange={(e) => setPorcentajeRpm(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  % Profesional
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={porcentajeProfesional}
                  onChange={(e) => setPorcentajeProfesional(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Notas
              </label>
              <textarea
                rows={3}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Observación opcional de la liquidación..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>

            <button
              type="submit"
              disabled={generating}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {generating ? 'Generando...' : 'Generar liquidación'}
            </button>
          </form>
        </section>

        <section className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Resumen estimado del período</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Terapeuta</th>
                  <th className="px-4 py-3 text-left font-semibold">Citas</th>
                  <th className="px-4 py-3 text-left font-semibold">Base</th>
                  <th className="px-4 py-3 text-left font-semibold">RPM</th>
                  <th className="px-4 py-3 text-left font-semibold">Profesional</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-slate-500">
                      Cargando resumen...
                    </td>
                  </tr>
                ) : resumenTerapeutas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-slate-500">
                      No hay citas para el filtro actual.
                    </td>
                  </tr>
                ) : (
                  resumenTerapeutas.map((row) => (
                    <tr key={row.empleado_id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-900">{row.empleado_nombre}</td>
                      <td className="px-4 py-3 text-slate-700">{row.citas}</td>
                      <td className="px-4 py-3 text-slate-700">{money(row.base)}</td>
                      <td className="px-4 py-3 text-blue-700 font-semibold">{money(row.rpm)}</td>
                      <td className="px-4 py-3 text-emerald-700 font-semibold">
                        {money(row.profesional)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b bg-slate-50 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Liquidaciones generadas</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Terapeuta</th>
                <th className="px-4 py-3 text-left font-semibold">Período</th>
                <th className="px-4 py-3 text-left font-semibold">Citas</th>
                <th className="px-4 py-3 text-left font-semibold">Base</th>
                <th className="px-4 py-3 text-left font-semibold">RPM</th>
                <th className="px-4 py-3 text-left font-semibold">Profesional</th>
                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                <th className="px-4 py-3 text-left font-semibold">Egreso</th>
                <th className="px-4 py-3 text-left font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-slate-500">
                    Cargando liquidaciones...
                  </td>
                </tr>
              ) : liquidaciones.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-slate-500">
                    No hay liquidaciones todavía.
                  </td>
                </tr>
              ) : (
                liquidaciones.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {row.empleados?.nombre || 'Sin terapeuta'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.fecha_inicio} → {row.fecha_fin}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.cantidad_citas}</td>
                    <td className="px-4 py-3 text-slate-700">{money(row.total_base)}</td>
                    <td className="px-4 py-3 text-blue-700 font-semibold">{money(row.total_rpm)}</td>
                    <td className="px-4 py-3 text-emerald-700 font-semibold">
                      {money(row.total_profesional)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(row.estado)}`}
                      >
                        {row.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.egreso_id ? 'Generado' : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {row.estado === 'pendiente' ? (
                        <button
                          onClick={() => marcarPagada(row.id)}
                          disabled={payingId === row.id}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                        >
                          {payingId === row.id ? 'Guardando...' : 'Marcar pagada'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">
                          {row.pagado_at ? `Pagada ${new Date(row.pagado_at).toLocaleDateString()}` : 'Pagada'}
                        </span>
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