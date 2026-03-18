'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type CuentaRow = {
  id: string
  fecha: string
  concepto: string
  categoria: string
  monto: number
  estado: 'pagado' | 'pendiente' | 'anulado'
  tipo_origen: string
  created_at?: string
  notas: string | null
  cliente_id: string | null
  clientes: { nombre: string } | null
  metodos_pago: { nombre: string } | null
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(base: string, days: number) {
  const date = new Date(`${base}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function estadoBadge(estado: string) {
  if (estado === 'pagado') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (estado === 'anulado') return 'bg-red-50 text-red-700 border-red-200'
  if (estado === 'pendiente') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

function antiguedadLabel(fecha: string) {
  const hoy = new Date(`${todayISO()}T00:00:00`)
  const base = new Date(`${fecha}T00:00:00`)
  const diff = Math.floor((hoy.getTime() - base.getTime()) / (1000 * 60 * 60 * 24))

  if (diff <= 0) return 'Hoy'
  if (diff === 1) return '1 día'
  return `${diff} días`
}

export default function CuentasPorCobrarPage() {
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'pendiente' | 'pagado' | 'anulado'>('pendiente')
  const [origenFiltro, setOrigenFiltro] = useState('todos')
  const [antiguedadFiltro, setAntiguedadFiltro] = useState<'todos' | 'hoy' | '7' | '30' | 'vencido'>('todos')

  const [rows, setRows] = useState<CuentaRow[]>([])

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setError('')
      setSuccess('')

      const { data, error } = await supabase
        .from('pagos')
        .select(`
          id,
          fecha,
          concepto,
          categoria,
          monto,
          estado,
          tipo_origen,
          created_at,
          notas,
          cliente_id,
          clientes:cliente_id ( nombre ),
          metodos_pago:metodo_pago_id ( nombre )
        `)
        .order('fecha', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error

      setRows((data || []) as unknown as CuentaRow[])
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'No se pudieron cargar las cuentas por cobrar.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  async function marcarComoPagado(row: CuentaRow) {
    try {
      setSavingId(row.id)
      setError('')
      setSuccess('')

      const { error } = await supabase
        .from('pagos')
        .update({
          estado: 'pagado',
          fecha: todayISO(),
        })
        .eq('id', row.id)

      if (error) throw error

      setSuccess('Cuenta marcada como pagada.')
      await loadData()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'No se pudo actualizar el pago.')
    } finally {
      setSavingId(null)
    }
  }

  async function anularCuenta(row: CuentaRow) {
    const ok = window.confirm('¿Seguro que quieres anular esta cuenta?')
    if (!ok) return

    try {
      setSavingId(row.id)
      setError('')
      setSuccess('')

      const { error } = await supabase
        .from('pagos')
        .update({ estado: 'anulado' })
        .eq('id', row.id)

      if (error) throw error

      setSuccess('Cuenta anulada correctamente.')
      await loadData()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'No se pudo anular la cuenta.')
    } finally {
      setSavingId(null)
    }
  }

  const filas = useMemo(() => {
    const hoy = todayISO()
    const hace7 = addDays(hoy, -7)
    const hace30 = addDays(hoy, -30)
    const q = search.trim().toLowerCase()

    return rows.filter((row) => {
      const matchSearch =
        !q ||
        row.concepto?.toLowerCase().includes(q) ||
        row.categoria?.toLowerCase().includes(q) ||
        row.tipo_origen?.toLowerCase().includes(q) ||
        row.clientes?.nombre?.toLowerCase().includes(q) ||
        row.metodos_pago?.nombre?.toLowerCase().includes(q) ||
        row.estado?.toLowerCase().includes(q)

      const matchEstado = estadoFiltro === 'todos' ? true : row.estado === estadoFiltro
      const matchOrigen = origenFiltro === 'todos' ? true : row.tipo_origen === origenFiltro

      let matchAntiguedad = true
      if (antiguedadFiltro === 'hoy') {
        matchAntiguedad = row.fecha === hoy
      } else if (antiguedadFiltro === '7') {
        matchAntiguedad = row.fecha >= hace7 && row.fecha <= hoy
      } else if (antiguedadFiltro === '30') {
        matchAntiguedad = row.fecha >= hace30 && row.fecha <= hoy
      } else if (antiguedadFiltro === 'vencido') {
        matchAntiguedad = row.estado === 'pendiente' && row.fecha < hace7
      }

      return matchSearch && matchEstado && matchOrigen && matchAntiguedad
    })
  }, [rows, search, estadoFiltro, origenFiltro, antiguedadFiltro])

  const origenes = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((row) => {
      if (row.tipo_origen?.trim()) set.add(row.tipo_origen.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rows])

  const resumen = useMemo(() => {
    const pendientes = filas
      .filter((x) => x.estado === 'pendiente')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const vencidas = filas
      .filter((x) => x.estado === 'pendiente' && x.fecha < addDays(todayISO(), -7))
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const cobradas = filas
      .filter((x) => x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const anuladas = filas
      .filter((x) => x.estado === 'anulado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    return {
      pendientes,
      vencidas,
      cobradas,
      anuladas,
      cantidadPendientes: filas.filter((x) => x.estado === 'pendiente').length,
    }
  }, [filas])

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Finanzas</p>
          <h1 className="text-2xl font-bold text-slate-900">Cuentas por cobrar</h1>
          <p className="mt-1 text-sm text-slate-600">
            Seguimiento de pagos pendientes, vencidos y cobrados.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/finanzas/ingresos"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Ir a ingresos
          </Link>
          <Link
            href="/admin/finanzas/resumen"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Volver a resumen
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pendiente total</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">{money(resumen.pendientes)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Vencido</p>
          <p className="mt-2 text-3xl font-bold text-red-700">{money(resumen.vencidas)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Cobrado</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{money(resumen.cobradas)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Anulado</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{money(resumen.anuladas)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pendientes</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{resumen.cantidadPendientes}</p>
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-5">
          <input
            type="text"
            placeholder="Buscar cliente, concepto, categoría..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2"
          />

          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value as 'todos' | 'pendiente' | 'pagado' | 'anulado')}
            className="rounded-xl border border-slate-300 px-3 py-2"
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
            <option value="anulado">Anulado</option>
          </select>

          <select
            value={origenFiltro}
            onChange={(e) => setOrigenFiltro(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2"
          >
            <option value="todos">Todos los orígenes</option>
            {origenes.map((origen) => (
              <option key={origen} value={origen}>
                {origen}
              </option>
            ))}
          </select>

          <select
            value={antiguedadFiltro}
            onChange={(e) => setAntiguedadFiltro(e.target.value as 'todos' | 'hoy' | '7' | '30' | 'vencido')}
            className="rounded-xl border border-slate-300 px-3 py-2"
          >
            <option value="todos">Toda antigüedad</option>
            <option value="hoy">De hoy</option>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="vencido">Vencidos</option>
          </select>

          <button
            onClick={loadData}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Actualizar
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b bg-slate-50 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Listado de cuentas</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                <th className="px-4 py-3 text-left font-semibold">Concepto</th>
                <th className="px-4 py-3 text-left font-semibold">Origen</th>
                <th className="px-4 py-3 text-left font-semibold">Antigüedad</th>
                <th className="px-4 py-3 text-left font-semibold">Método</th>
                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                <th className="px-4 py-3 text-left font-semibold">Monto</th>
                <th className="px-4 py-3 text-left font-semibold">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-slate-500">
                    Cargando cuentas por cobrar...
                  </td>
                </tr>
              ) : filas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-slate-500">
                    No hay cuentas para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filas.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-700">{row.fecha}</td>
                    <td className="px-4 py-3 text-slate-700">{row.clientes?.nombre || 'Sin cliente'}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.concepto}</p>
                      <p className="text-xs text-slate-500">{row.categoria}</p>
                      {row.notas ? <p className="mt-1 text-xs text-slate-500">{row.notas}</p> : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.tipo_origen}</td>
                    <td className="px-4 py-3 text-slate-700">{antiguedadLabel(row.fecha)}</td>
                    <td className="px-4 py-3 text-slate-700">{row.metodos_pago?.nombre || '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(row.estado)}`}
                      >
                        {row.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-amber-700">{money(row.monto)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {row.estado === 'pendiente' ? (
                          <button
                            onClick={() => marcarComoPagado(row)}
                            disabled={savingId === row.id}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                          >
                            {savingId === row.id ? 'Guardando...' : 'Marcar pagado'}
                          </button>
                        ) : null}

                        {row.estado !== 'anulado' ? (
                          <button
                            onClick={() => anularCuenta(row)}
                            disabled={savingId === row.id}
                            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                          >
                            {savingId === row.id ? 'Guardando...' : 'Anular'}
                          </button>
                        ) : null}
                      </div>
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