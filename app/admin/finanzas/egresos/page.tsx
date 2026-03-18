'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type MetodoPago = {
  id: string
  nombre: string
}

type Egreso = {
  id: string
  fecha: string
  concepto: string
  categoria: string
  proveedor: string | null
  monto: number
  estado: 'pagado' | 'pendiente' | 'anulado'
  metodo_pago_id: string | null
  comprobante_url: string | null
  notas: string | null
  created_at?: string
  metodos_pago?: { nombre: string } | null
}

type FormState = {
  fecha: string
  concepto: string
  categoria: string
  proveedor: string
  monto: string
  estado: 'pagado' | 'pendiente' | 'anulado'
  metodo_pago_id: string
  comprobante_url: string
  notas: string
}

const INITIAL_FORM: FormState = {
  fecha: new Date().toISOString().slice(0, 10),
  concepto: '',
  categoria: 'operativo',
  proveedor: '',
  monto: '',
  estado: 'pagado',
  metodo_pago_id: '',
  comprobante_url: '',
  notas: '',
}

const CATEGORIAS = [
  'operativo',
  'nomina',
  'alquiler',
  'servicios',
  'equipos',
  'mantenimiento',
  'marketing',
  'insumos',
  'transporte',
  'otros',
]

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function estadoBadge(estado: string) {
  if (estado === 'pagado') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (estado === 'anulado') return 'bg-red-50 text-red-700 border-red-200'
  if (estado === 'pendiente') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

export default function EgresosPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])

  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setErrorMsg('')

      const [egresosRes, metodosRes] = await Promise.all([
        supabase
          .from('egresos')
          .select(`
            id,
            fecha,
            concepto,
            categoria,
            proveedor,
            monto,
            estado,
            metodo_pago_id,
            comprobante_url,
            notas,
            created_at,
            metodos_pago:metodo_pago_id ( nombre )
          `)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false }),

        supabase
          .from('metodos_pago')
          .select('id, nombre')
          .order('nombre', { ascending: true }),
      ])

      if (egresosRes.error) throw egresosRes.error
      if (metodosRes.error) throw metodosRes.error

      setEgresos((egresosRes.data || []) as unknown as Egreso[])
      setMetodosPago((metodosRes.data || []) as MetodoPago[])
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudieron cargar los egresos.')
      setEgresos([])
      setMetodosPago([])
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm(INITIAL_FORM)
    setEditingId(null)
    setShowForm(false)
  }

  function startCreate() {
    setEditingId(null)
    setForm(INITIAL_FORM)
    setShowForm(true)
    setErrorMsg('')
    setSuccessMsg('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function startEdit(row: Egreso) {
    setEditingId(row.id)
    setForm({
      fecha: row.fecha || new Date().toISOString().slice(0, 10),
      concepto: row.concepto || '',
      categoria: row.categoria || 'operativo',
      proveedor: row.proveedor || '',
      monto: String(row.monto ?? ''),
      estado: row.estado || 'pagado',
      metodo_pago_id: row.metodo_pago_id || '',
      comprobante_url: row.comprobante_url || '',
      notas: row.notas || '',
    })
    setShowForm(true)
    setErrorMsg('')
    setSuccessMsg('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function validateForm() {
    if (!form.fecha) return 'Debes indicar la fecha.'
    if (!form.concepto.trim()) return 'Debes indicar el concepto.'
    if (!form.categoria.trim()) return 'Debes seleccionar la categoría.'
    if (!form.monto || Number(form.monto) <= 0) return 'Debes indicar un monto válido.'
    return ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const validationError = validateForm()
    if (validationError) {
      setErrorMsg(validationError)
      return
    }

    try {
      setSaving(true)

      const payload = {
        fecha: form.fecha,
        concepto: form.concepto.trim(),
        categoria: form.categoria,
        proveedor: form.proveedor.trim() || null,
        monto: Number(form.monto || 0),
        estado: form.estado,
        metodo_pago_id: form.metodo_pago_id || null,
        comprobante_url: form.comprobante_url.trim() || null,
        notas: form.notas.trim() || null,
      }

      if (editingId) {
        const { error } = await supabase
          .from('egresos')
          .update(payload)
          .eq('id', editingId)

        if (error) throw error
        setSuccessMsg('Egreso actualizado correctamente.')
      } else {
        const { error } = await supabase
          .from('egresos')
          .insert(payload)

        if (error) throw error
        setSuccessMsg('Egreso creado correctamente.')
      }

      resetForm()
      await loadData()
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo guardar el egreso.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleEstado(row: Egreso) {
    try {
      setUpdatingId(row.id)
      setErrorMsg('')
      setSuccessMsg('')

      const nuevoEstado =
        row.estado === 'pagado'
          ? 'pendiente'
          : row.estado === 'pendiente'
          ? 'anulado'
          : 'pagado'

      const { error } = await supabase
        .from('egresos')
        .update({ estado: nuevoEstado })
        .eq('id', row.id)

      if (error) throw error

      setSuccessMsg(`Egreso actualizado a "${nuevoEstado}".`)
      await loadData()
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo actualizar el estado.')
    } finally {
      setUpdatingId(null)
    }
  }

  async function eliminarEgreso(id: string) {
    const ok = window.confirm('¿Seguro que quieres eliminar este egreso?')
    if (!ok) return

    try {
      setDeletingId(id)
      setErrorMsg('')
      setSuccessMsg('')

      const { error } = await supabase
        .from('egresos')
        .delete()
        .eq('id', id)

      if (error) throw error

      setSuccessMsg('Egreso eliminado correctamente.')
      if (editingId === id) resetForm()
      await loadData()
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo eliminar el egreso.')
    } finally {
      setDeletingId(null)
    }
  }

  const egresosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()

    return egresos.filter((row) => {
      const matchSearch =
        !q ||
        row.concepto?.toLowerCase().includes(q) ||
        row.categoria?.toLowerCase().includes(q) ||
        row.proveedor?.toLowerCase().includes(q) ||
        row.estado?.toLowerCase().includes(q) ||
        row.metodos_pago?.nombre?.toLowerCase().includes(q)

      const matchEstado =
        estadoFiltro === 'todos' ? true : row.estado === estadoFiltro

      const matchCategoria =
        categoriaFiltro === 'todos' ? true : row.categoria === categoriaFiltro

      return matchSearch && matchEstado && matchCategoria
    })
  }, [egresos, search, estadoFiltro, categoriaFiltro])

  const resumen = useMemo(() => {
    return {
      total: egresos.length,
      pagados: egresos
        .filter((x) => x.estado === 'pagado')
        .reduce((acc, x) => acc + Number(x.monto || 0), 0),
      pendientes: egresos
        .filter((x) => x.estado === 'pendiente')
        .reduce((acc, x) => acc + Number(x.monto || 0), 0),
      anulados: egresos
        .filter((x) => x.estado === 'anulado')
        .reduce((acc, x) => acc + Number(x.monto || 0), 0),
    }
  }, [egresos])

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-slate-500">Finanzas</p>
          <h1 className="text-2xl font-bold text-slate-900">Egresos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Registra y administra gastos, proveedores y salidas de dinero.
          </p>
        </div>

        <button
          onClick={() => {
            if (showForm && !editingId) {
              setShowForm(false)
            } else {
              startCreate()
            }
          }}
          className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          {showForm && !editingId ? 'Cerrar formulario' : 'Nuevo egreso'}
        </button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total registros</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{resumen.total}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pagados</p>
          <p className="mt-2 text-3xl font-bold text-red-700">{money(resumen.pagados)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pendientes</p>
          <p className="mt-2 text-3xl font-bold text-amber-700">{money(resumen.pendientes)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Anulados</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{money(resumen.anulados)}</p>
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

      <div className="grid gap-6 xl:grid-cols-3">
        {showForm ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-1">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {editingId ? 'Editar egreso' : 'Nuevo egreso'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Fecha</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm((prev) => ({ ...prev, fecha: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Concepto</label>
                <input
                  type="text"
                  value={form.concepto}
                  onChange={(e) => setForm((prev) => ({ ...prev, concepto: e.target.value }))}
                  placeholder="Ej: Pago de alquiler"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Categoría</label>
                <select
                  value={form.categoria}
                  onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                >
                  {CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Proveedor</label>
                <input
                  type="text"
                  value={form.proveedor}
                  onChange={(e) => setForm((prev) => ({ ...prev, proveedor: e.target.value }))}
                  placeholder="Nombre del proveedor"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Monto</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monto}
                  onChange={(e) => setForm((prev) => ({ ...prev, monto: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
                <select
                  value={form.estado}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      estado: e.target.value as 'pagado' | 'pendiente' | 'anulado',
                    }))
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                >
                  <option value="pagado">Pagado</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="anulado">Anulado</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Método de pago
                </label>
                <select
                  value={form.metodo_pago_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, metodo_pago_id: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                >
                  <option value="">Sin método</option>
                  {metodosPago.map((metodo) => (
                    <option key={metodo.id} value={metodo.id}>
                      {metodo.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  URL comprobante
                </label>
                <input
                  type="text"
                  value={form.comprobante_url}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, comprobante_url: e.target.value }))
                  }
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Notas</label>
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm((prev) => ({ ...prev, notas: e.target.value }))}
                  className="min-h-[100px] w-full rounded-xl border border-slate-300 px-3 py-2.5"
                  placeholder="Notas adicionales"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving
                    ? editingId
                      ? 'Actualizando...'
                      : 'Guardando...'
                    : editingId
                    ? 'Guardar cambios'
                    : 'Crear egreso'}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section
          className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${
            showForm ? 'xl:col-span-2' : 'xl:col-span-3'
          }`}
        >
          <div className="border-b bg-slate-50 px-5 py-4">
            <div className="grid gap-3 md:grid-cols-3">
              <input
                type="text"
                placeholder="Buscar por concepto, categoría, proveedor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />

              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="todos">Todos los estados</option>
                <option value="pagado">Pagado</option>
                <option value="pendiente">Pendiente</option>
                <option value="anulado">Anulado</option>
              </select>

              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="todos">Todas las categorías</option>
                {CATEGORIAS.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                  <th className="px-4 py-3 text-left font-semibold">Concepto</th>
                  <th className="px-4 py-3 text-left font-semibold">Proveedor</th>
                  <th className="px-4 py-3 text-left font-semibold">Categoría</th>
                  <th className="px-4 py-3 text-left font-semibold">Método</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold">Monto</th>
                  <th className="px-4 py-3 text-left font-semibold">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-slate-500">
                      Cargando egresos...
                    </td>
                  </tr>
                ) : egresosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-slate-500">
                      No hay egresos registrados.
                    </td>
                  </tr>
                ) : (
                  egresosFiltrados.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 text-slate-700">{row.fecha}</td>

                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{row.concepto}</p>
                        {row.notas ? (
                          <p className="text-xs text-slate-500 line-clamp-1">{row.notas}</p>
                        ) : null}
                      </td>

                      <td className="px-4 py-3 text-slate-700">{row.proveedor || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{row.categoria}</td>
                      <td className="px-4 py-3 text-slate-700">{row.metodos_pago?.nombre || '—'}</td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(row.estado)}`}
                        >
                          {row.estado}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-semibold text-red-700">
                        {money(row.monto)}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => startEdit(row)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => toggleEstado(row)}
                            disabled={updatingId === row.id}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                          >
                            {updatingId === row.id ? 'Actualizando...' : 'Cambiar estado'}
                          </button>

                          <button
                            onClick={() => eliminarEgreso(row.id)}
                            disabled={deletingId === row.id}
                            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                          >
                            {deletingId === row.id ? 'Eliminando...' : 'Eliminar'}
                          </button>
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
    </div>
  )
}