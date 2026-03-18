'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type Pago = {
  id: string
  fecha: string
  concepto: string
  categoria: string
  monto: number
  estado: string
  tipo_origen: string
  created_at?: string
  clientes: { nombre: string } | null
  metodos_pago: { nombre: string } | null
}

type Egreso = {
  id: string
  fecha: string
  concepto: string
  categoria: string
  monto: number
  estado: string
  proveedor: string | null
  created_at?: string
  metodos_pago: { nombre: string } | null
}

type Movimiento = {
  id: string
  fecha: string
  tipo: 'ingreso' | 'egreso'
  concepto: string
  categoria: string
  tercero: string
  metodo: string
  estado: string
  monto: number
  created_at?: string
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

function firstDayOfMonthISO() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function estadoBadge(estado: string) {
  if (estado === 'pagado') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (estado === 'anulado') return 'bg-red-50 text-red-700 border-red-200'
  if (estado === 'pendiente') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

function tipoBadge(tipo: 'ingreso' | 'egreso') {
  if (tipo === 'ingreso') return 'bg-blue-50 text-blue-700 border-blue-200'
  return 'bg-amber-50 text-amber-700 border-amber-200'
}

export default function FinanzasResumenPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [fechaInicio, setFechaInicio] = useState(firstDayOfMonthISO())
  const [fechaFin, setFechaFin] = useState(todayISO())
  const [search, setSearch] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'ingreso' | 'egreso'>('todos')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos')

  const [pagos, setPagos] = useState<Pago[]>([])
  const [egresos, setEgresos] = useState<Egreso[]>([])

  useEffect(() => {
    void loadFinanzas()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadFinanzas() {
    try {
      setLoading(true)
      setError('')

      const [pagosRes, egresosRes] = await Promise.all([
        supabase
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
            clientes:cliente_id ( nombre ),
            metodos_pago:metodo_pago_id ( nombre )
          `)
          .gte('fecha', fechaInicio)
          .lte('fecha', fechaFin)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false }),

        supabase
          .from('egresos')
          .select(`
            id,
            fecha,
            concepto,
            categoria,
            monto,
            estado,
            proveedor,
            created_at,
            metodos_pago:metodo_pago_id ( nombre )
          `)
          .gte('fecha', fechaInicio)
          .lte('fecha', fechaFin)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false }),
      ])

      if (pagosRes.error) throw pagosRes.error
      if (egresosRes.error) throw egresosRes.error

      setPagos((pagosRes.data || []) as unknown as Pago[])
      setEgresos((egresosRes.data || []) as unknown as Egreso[])
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'No se pudo cargar finanzas.')
      setPagos([])
      setEgresos([])
    } finally {
      setLoading(false)
    }
  }

  const movimientos = useMemo<Movimiento[]>(() => {
    const ingresos: Movimiento[] = pagos.map((row) => ({
      id: row.id,
      fecha: row.fecha,
      tipo: 'ingreso',
      concepto: row.concepto,
      categoria: row.categoria || 'general',
      tercero: row.clientes?.nombre || 'Sin cliente',
      metodo: row.metodos_pago?.nombre || 'Sin método',
      estado: row.estado,
      monto: Number(row.monto || 0),
      created_at: row.created_at,
    }))

    const salidas: Movimiento[] = egresos.map((row) => ({
      id: row.id,
      fecha: row.fecha,
      tipo: 'egreso',
      concepto: row.concepto,
      categoria: row.categoria || 'operativo',
      tercero: row.proveedor || 'Sin proveedor',
      metodo: row.metodos_pago?.nombre || 'Sin método',
      estado: row.estado,
      monto: Number(row.monto || 0),
      created_at: row.created_at,
    }))

    return [...ingresos, ...salidas].sort((a, b) => {
      const dateA = `${a.fecha} ${a.created_at || ''}`
      const dateB = `${b.fecha} ${b.created_at || ''}`
      return dateA < dateB ? 1 : -1
    })
  }, [pagos, egresos])

  const categoriasDisponibles = useMemo(() => {
    const set = new Set<string>()

    for (const row of movimientos) {
      if (row.categoria?.trim()) set.add(row.categoria.trim())
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [movimientos])

  const movimientosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()

    return movimientos.filter((row) => {
      const matchSearch =
        !q ||
        row.concepto.toLowerCase().includes(q) ||
        row.categoria.toLowerCase().includes(q) ||
        row.tercero.toLowerCase().includes(q) ||
        row.metodo.toLowerCase().includes(q) ||
        row.tipo.toLowerCase().includes(q) ||
        row.estado.toLowerCase().includes(q)

      const matchTipo = tipoFiltro === 'todos' ? true : row.tipo === tipoFiltro
      const matchEstado = estadoFiltro === 'todos' ? true : row.estado === estadoFiltro
      const matchCategoria = categoriaFiltro === 'todos' ? true : row.categoria === categoriaFiltro

      return matchSearch && matchTipo && matchEstado && matchCategoria
    })
  }, [movimientos, search, tipoFiltro, estadoFiltro, categoriaFiltro])

  const resumen = useMemo(() => {
    const ingresosPagados = pagos
      .filter((x) => x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const egresosPagados = egresos
      .filter((x) => x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const ingresosPendientes = pagos
      .filter((x) => x.estado === 'pendiente')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const egresosPendientes = egresos
      .filter((x) => x.estado === 'pendiente')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const ingresosAnulados = pagos
      .filter((x) => x.estado === 'anulado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const egresosAnulados = egresos
      .filter((x) => x.estado === 'anulado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    return {
      ingresos: ingresosPagados,
      egresos: egresosPagados,
      balance: ingresosPagados - egresosPagados,
      ingresosCount: pagos.filter((x) => x.estado === 'pagado').length,
      egresosCount: egresos.filter((x) => x.estado === 'pagado').length,
      ingresosPendientes,
      egresosPendientes,
      ingresosAnulados,
      egresosAnulados,
    }
  }, [pagos, egresos])

  const cajaDia = useMemo(() => {
    const hoy = todayISO()

    const ingresosHoy = pagos
      .filter((x) => x.fecha === hoy && x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    const egresosHoy = egresos
      .filter((x) => x.fecha === hoy && x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)

    return {
      ingresosHoy,
      egresosHoy,
      balanceHoy: ingresosHoy - egresosHoy,
    }
  }, [pagos, egresos])

  const porCategoria = useMemo(() => {
    const map = new Map<string, { categoria: string; ingresos: number; egresos: number }>()

    for (const row of pagos.filter((x) => x.estado === 'pagado')) {
      const key = row.categoria || 'general'
      const prev = map.get(key) || { categoria: key, ingresos: 0, egresos: 0 }
      prev.ingresos += Number(row.monto || 0)
      map.set(key, prev)
    }

    for (const row of egresos.filter((x) => x.estado === 'pagado')) {
      const key = row.categoria || 'operativo'
      const prev = map.get(key) || { categoria: key, ingresos: 0, egresos: 0 }
      prev.egresos += Number(row.monto || 0)
      map.set(key, prev)
    }

    return Array.from(map.values()).sort((a, b) => {
      const totalA = a.ingresos + a.egresos
      const totalB = b.ingresos + b.egresos
      return totalB - totalA
    })
  }, [pagos, egresos])

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Finanzas</p>
          <h1 className="text-2xl font-bold text-slate-900">Resumen financiero</h1>
          <p className="mt-1 text-sm text-slate-600">
            Control de ingresos, egresos, caja, balance y movimientos del período.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/finanzas/ingresos"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Ingresos
          </Link>
          <Link
            href="/admin/finanzas/egresos"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Egresos
          </Link>
          <Link
            href="/admin/finanzas/comisiones"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Comisiones
          </Link>
          <Link
            href="/admin/finanzas/cuentas-por-cobrar"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Cuentas por cobrar
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Desde</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Hasta</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value as 'todos' | 'ingreso' | 'egreso')}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="todos">Todos</option>
              <option value="ingreso">Ingresos</option>
              <option value="egreso">Egresos</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="todos">Todos</option>
              <option value="pagado">Pagado</option>
              <option value="pendiente">Pendiente</option>
              <option value="anulado">Anulado</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Categoría</label>
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="todos">Todas</option>
              {categoriasDisponibles.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Buscar</label>
            <input
              type="text"
              placeholder="Concepto, categoría, cliente, proveedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={loadFinanzas}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Actualizar
          </button>

          <button
            onClick={() => {
              setFechaInicio(firstDayOfMonthISO())
              setFechaFin(todayISO())
              setSearch('')
              setTipoFiltro('todos')
              setEstadoFiltro('todos')
              setCategoriaFiltro('todos')
            }}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Limpiar filtros
          </button>
        </div>
      </section>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Ingresos del período</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">
            {loading ? '...' : money(resumen.ingresos)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{resumen.ingresosCount} movimiento(s)</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Egresos del período</p>
          <p className="mt-2 text-3xl font-bold text-red-700">
            {loading ? '...' : money(resumen.egresos)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{resumen.egresosCount} movimiento(s)</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Balance</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? '...' : money(resumen.balance)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Ingresos - egresos</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pendiente por cobrar</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">
            {loading ? '...' : money(resumen.ingresosPendientes)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Pagos pendientes</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pendiente por pagar</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">
            {loading ? '...' : money(resumen.egresosPendientes)}
          </p>
          <p className="mt-1 text-xs text-slate-500">Egresos pendientes</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Movimientos anulados</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? '...' : money(resumen.ingresosAnulados + resumen.egresosAnulados)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Ing. {money(resumen.ingresosAnulados)} · Egr. {money(resumen.egresosAnulados)}
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Ingresos de hoy</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">
            {loading ? '...' : money(cajaDia.ingresosHoy)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Egresos de hoy</p>
          <p className="mt-2 text-3xl font-bold text-red-700">
            {loading ? '...' : money(cajaDia.egresosHoy)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Caja de hoy</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? '...' : money(cajaDia.balanceHoy)}
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Resumen por categoría</h2>

          <div className="space-y-3">
            {porCategoria.length === 0 ? (
              <p className="text-sm text-slate-500">No hay datos para el período seleccionado.</p>
            ) : (
              porCategoria.map((row) => (
                <div key={row.categoria} className="rounded-xl border border-slate-200 p-3">
                  <p className="font-medium text-slate-900">{row.categoria}</p>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-emerald-700">Ingresos</span>
                    <span className="font-medium">{money(row.ingresos)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="text-red-700">Egresos</span>
                    <span className="font-medium">{money(row.egresos)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <div className="border-b bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-semibold text-slate-900">Movimientos</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                  <th className="px-4 py-3 text-left font-semibold">Concepto</th>
                  <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                  <th className="px-4 py-3 text-left font-semibold">Cliente / Proveedor</th>
                  <th className="px-4 py-3 text-left font-semibold">Método</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold">Monto</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-slate-500">
                      Cargando movimientos...
                    </td>
                  </tr>
                ) : movimientosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-slate-500">
                      No hay movimientos para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  movimientosFiltrados.map((row) => (
                    <tr key={`${row.tipo}-${row.id}`} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-700">{row.fecha}</td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tipoBadge(row.tipo)}`}
                        >
                          {row.tipo}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{row.concepto}</p>
                      </td>

                      <td className="px-4 py-3 text-slate-700">{row.categoria}</td>

                      <td className="px-4 py-3 text-slate-700">{row.tercero}</td>

                      <td className="px-4 py-3 text-slate-700">{row.metodo}</td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(row.estado)}`}
                        >
                          {row.estado}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`font-semibold ${row.tipo === 'ingreso' ? 'text-emerald-700' : 'text-red-700'}`}
                        >
                          {row.tipo === 'ingreso' ? '+' : '-'}
                          {money(row.monto)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}