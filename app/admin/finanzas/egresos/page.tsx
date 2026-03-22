'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'

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

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

const textareaClassName = `
  min-h-[110px] w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition resize-none
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function estadoBadge(estado: string) {
  if (estado === 'pagado') {
    return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
  }
  if (estado === 'anulado') {
    return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
  }
  if (estado === 'pendiente') {
    return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
  }
  return 'border-white/10 bg-white/[0.03] text-white/75'
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
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-white/55">Finanzas</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Egresos</h1>
          <p className="mt-2 text-sm text-white/55">
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
          className="
            rounded-2xl border border-white/10 bg-white/[0.08]
            px-4 py-3 text-sm font-semibold text-white transition
            hover:bg-white/[0.12]
          "
        >
          {showForm && !editingId ? 'Cerrar formulario' : 'Nuevo egreso'}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total registros" value={resumen.total} color="text-white" />
        <StatCard title="Pagados" value={money(resumen.pagados)} color="text-rose-300" />
        <StatCard title="Pendientes" value={money(resumen.pendientes)} color="text-amber-300" />
        <StatCard title="Anulados" value={money(resumen.anulados)} color="text-white" />
      </div>

      {errorMsg ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{errorMsg}</p>
        </Card>
      ) : null}

      {successMsg ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-emerald-400">Listo</p>
          <p className="mt-1 text-sm text-white/55">{successMsg}</p>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        {showForm ? (
          <div className="xl:col-span-1">
            <Section
              title={editingId ? 'Editar egreso' : 'Nuevo egreso'}
              description="Completa la información del gasto y su estado."
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">Fecha</label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm((prev) => ({ ...prev, fecha: e.target.value }))}
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">Concepto</label>
                  <input
                    type="text"
                    value={form.concepto}
                    onChange={(e) => setForm((prev) => ({ ...prev, concepto: e.target.value }))}
                    placeholder="Ej: Pago de alquiler"
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">Categoría</label>
                  <select
                    value={form.categoria}
                    onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))}
                    className={inputClassName}
                  >
                    {CATEGORIAS.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#11131a] text-white">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">Proveedor</label>
                  <input
                    type="text"
                    value={form.proveedor}
                    onChange={(e) => setForm((prev) => ({ ...prev, proveedor: e.target.value }))}
                    placeholder="Nombre del proveedor"
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">Monto</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.monto}
                    onChange={(e) => setForm((prev) => ({ ...prev, monto: e.target.value }))}
                    placeholder="0.00"
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">Estado</label>
                  <select
                    value={form.estado}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        estado: e.target.value as 'pagado' | 'pendiente' | 'anulado',
                      }))
                    }
                    className={inputClassName}
                  >
                    <option value="pagado" className="bg-[#11131a] text-white">
                      Pagado
                    </option>
                    <option value="pendiente" className="bg-[#11131a] text-white">
                      Pendiente
                    </option>
                    <option value="anulado" className="bg-[#11131a] text-white">
                      Anulado
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">
                    Método de pago
                  </label>
                  <select
                    value={form.metodo_pago_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, metodo_pago_id: e.target.value }))}
                    className={inputClassName}
                  >
                    <option value="" className="bg-[#11131a] text-white">
                      Sin método
                    </option>
                    {metodosPago.map((metodo) => (
                      <option key={metodo.id} value={metodo.id} className="bg-[#11131a] text-white">
                        {metodo.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">
                    URL comprobante
                  </label>
                  <input
                    type="text"
                    value={form.comprobante_url}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, comprobante_url: e.target.value }))
                    }
                    placeholder="https://..."
                    className={inputClassName}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-white/75">Notas</label>
                  <textarea
                    value={form.notas}
                    onChange={(e) => setForm((prev) => ({ ...prev, notas: e.target.value }))}
                    className={textareaClassName}
                    placeholder="Notas adicionales"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="submit"
                    disabled={saving}
                    className="
                      rounded-2xl border border-white/10 bg-white/[0.08]
                      px-5 py-3 text-sm font-semibold text-white transition
                      hover:bg-white/[0.12] disabled:opacity-60
                    "
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
                    className="
                      rounded-2xl border border-white/10 bg-white/[0.03]
                      px-5 py-3 text-sm font-semibold text-white/80 transition
                      hover:bg-white/[0.06]
                    "
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </Section>
          </div>
        ) : null}

        <div className={showForm ? 'xl:col-span-2' : 'xl:col-span-3'}>
          <Section
            title="Listado de egresos"
            description="Filtra, edita, elimina o cambia el estado de cada registro."
            className="p-0"
            contentClassName="overflow-hidden"
          >
            <div className="border-b border-white/10 bg-white/[0.03] px-5 py-4">
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  type="text"
                  placeholder="Buscar por concepto, categoría, proveedor..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={inputClassName}
                />

                <select
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value)}
                  className={inputClassName}
                >
                  <option value="todos" className="bg-[#11131a] text-white">
                    Todos los estados
                  </option>
                  <option value="pagado" className="bg-[#11131a] text-white">
                    Pagado
                  </option>
                  <option value="pendiente" className="bg-[#11131a] text-white">
                    Pendiente
                  </option>
                  <option value="anulado" className="bg-[#11131a] text-white">
                    Anulado
                  </option>
                </select>

                <select
                  value={categoriaFiltro}
                  onChange={(e) => setCategoriaFiltro(e.target.value)}
                  className={inputClassName}
                >
                  <option value="todos" className="bg-[#11131a] text-white">
                    Todas las categorías
                  </option>
                  {CATEGORIAS.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#11131a] text-white">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03]">
                  <tr className="text-left text-white/55">
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Concepto</th>
                    <th className="px-4 py-3 font-medium">Proveedor</th>
                    <th className="px-4 py-3 font-medium">Categoría</th>
                    <th className="px-4 py-3 font-medium">Método</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Monto</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-white/55">
                        Cargando egresos...
                      </td>
                    </tr>
                  ) : egresosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-white/55">
                        No hay egresos registrados.
                      </td>
                    </tr>
                  ) : (
                    egresosFiltrados.map((row) => (
                      <tr key={row.id} className="transition hover:bg-white/[0.03]">
                        <td className="px-4 py-3 text-white/75">{row.fecha}</td>

                        <td className="px-4 py-3">
                          <p className="font-medium text-white">{row.concepto}</p>
                          {row.notas ? (
                            <p className="line-clamp-1 text-xs text-white/45">{row.notas}</p>
                          ) : null}
                        </td>

                        <td className="px-4 py-3 text-white/75">{row.proveedor || '—'}</td>
                        <td className="px-4 py-3 text-white/75">{row.categoria}</td>
                        <td className="px-4 py-3 text-white/75">{row.metodos_pago?.nombre || '—'}</td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(row.estado)}`}
                          >
                            {row.estado}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-semibold text-rose-300">
                          {money(row.monto)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => startEdit(row)}
                              className="
                                rounded-xl border border-white/10 bg-white/[0.03]
                                px-3 py-1.5 text-xs font-semibold text-white/80 transition
                                hover:bg-white/[0.06]
                              "
                            >
                              Editar
                            </button>

                            <button
                              onClick={() => toggleEstado(row)}
                              disabled={updatingId === row.id}
                              className="
                                rounded-xl border border-white/10 bg-white/[0.03]
                                px-3 py-1.5 text-xs font-semibold text-white/80 transition
                                hover:bg-white/[0.06] disabled:opacity-60
                              "
                            >
                              {updatingId === row.id ? 'Actualizando...' : 'Cambiar estado'}
                            </button>

                            <button
                              onClick={() => eliminarEgreso(row.id)}
                              disabled={deletingId === row.id}
                              className="
                                rounded-xl border border-rose-400/20 bg-rose-400/10
                                px-3 py-1.5 text-xs font-semibold text-rose-300 transition
                                hover:bg-rose-400/15 disabled:opacity-60
                              "
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
          </Section>
        </div>
      </div>
    </div>
  )
}