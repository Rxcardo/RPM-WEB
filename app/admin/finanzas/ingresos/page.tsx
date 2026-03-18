'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type MetodoPago = {
  id: string
  nombre: string
}

type Cliente = {
  id: string
  nombre: string
}

type Pago = {
  id: string
  fecha: string
  tipo_origen: string
  concepto: string
  categoria: string
  monto: number
  estado: string
  notas: string | null
  cliente_id: string | null
  metodo_pago_id: string | null
  clientes: { nombre: string } | null
  metodos_pago: { nombre: string } | null
}

const initialForm = {
  id: '',
  fecha: new Date().toISOString().slice(0, 10),
  tipo_origen: 'otro_ingreso',
  cliente_id: '',
  concepto: '',
  categoria: 'general',
  monto: '',
  metodo_pago_id: '',
  notas: '',
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

export default function IngresosPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [metodos, setMetodos] = useState<MetodoPago[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])

  const [search, setSearch] = useState('')
  const [form, setForm] = useState(initialForm)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const [metodosRes, clientesRes, pagosRes] = await Promise.all([
      supabase
        .from('metodos_pago')
        .select('id, nombre')
        .eq('estado', 'activo')
        .order('nombre', { ascending: true }),

      supabase
        .from('clientes')
        .select('id, nombre')
        .order('nombre', { ascending: true }),

      supabase
        .from('pagos')
        .select(`
          id,
          fecha,
          tipo_origen,
          concepto,
          categoria,
          monto,
          estado,
          notas,
          cliente_id,
          metodo_pago_id,
          clientes:cliente_id ( nombre ),
          metodos_pago:metodo_pago_id ( nombre )
        `)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false }),
    ])

    setMetodos((metodosRes.data || []) as MetodoPago[])
    setClientes((clientesRes.data || []) as Cliente[])
    setPagos((pagosRes.data || []) as unknown as Pago[])
    setLoading(false)
  }

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const payload = {
      fecha: form.fecha,
      tipo_origen: form.tipo_origen,
      cliente_id: form.cliente_id || null,
      concepto: form.concepto.trim(),
      categoria: form.categoria.trim() || 'general',
      monto: Number(form.monto || 0),
      metodo_pago_id: form.metodo_pago_id || null,
      notas: form.notas.trim() || null,
    }

    if (editingId) {
      const { error } = await supabase.from('pagos').update(payload).eq('id', editingId)
      if (!error) {
        await loadData()
        resetForm()
      }
    } else {
      const { error } = await supabase.from('pagos').insert(payload)
      if (!error) {
        await loadData()
        resetForm()
      }
    }

    setSaving(false)
  }

  function startEdit(row: Pago) {
    setEditingId(row.id)
    setForm({
      id: row.id,
      fecha: row.fecha,
      tipo_origen: row.tipo_origen,
      cliente_id: row.cliente_id || '',
      concepto: row.concepto,
      categoria: row.categoria,
      monto: String(row.monto),
      metodo_pago_id: row.metodo_pago_id || '',
      notas: row.notas || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function anularPago(id: string) {
    await supabase.from('pagos').update({ estado: 'anulado' }).eq('id', id)
    await loadData()
  }

  const filtrados = useMemo(() => {
    return pagos.filter((row) => {
      const q = search.toLowerCase().trim()
      if (!q) return true
      return (
        row.concepto?.toLowerCase().includes(q) ||
        row.categoria?.toLowerCase().includes(q) ||
        row.clientes?.nombre?.toLowerCase().includes(q) ||
        row.metodos_pago?.nombre?.toLowerCase().includes(q)
      )
    })
  }, [pagos, search])

  const total = useMemo(() => {
    return filtrados
      .filter((x) => x.estado === 'pagado')
      .reduce((acc, x) => acc + Number(x.monto || 0), 0)
  }, [filtrados])

  return (
    <div className="min-h-screen bg-slate-50">


      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <p className="text-sm text-slate-500">Finanzas</p>
          <h1 className="text-2xl font-bold text-slate-900">Ingresos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Registra y administra cobros reales.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <section className="rounded-2xl border bg-white p-6 shadow-sm xl:col-span-1">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {editingId ? 'Editar ingreso' : 'Nuevo ingreso'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                required
              />

              <select
                value={form.tipo_origen}
                onChange={(e) => setForm({ ...form, tipo_origen: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="otro_ingreso">Otro ingreso</option>
                <option value="cita">Cita</option>
                <option value="plan">Plan</option>
              </select>

              <select
                value={form.cliente_id}
                onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="">Sin cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Concepto"
                value={form.concepto}
                onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                required
              />

              <input
                type="text"
                placeholder="Categoría"
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                required
              />

              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Monto"
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                required
              />

              <select
                value={form.metodo_pago_id}
                onChange={(e) => setForm({ ...form, metodo_pago_id: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="">Sin método de pago</option>
                {metodos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>

              <textarea
                placeholder="Notas"
                rows={4}
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              />

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar'}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="rounded-2xl border bg-white shadow-sm xl:col-span-2 overflow-hidden">
            <div className="border-b bg-slate-50 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Listado de ingresos</h2>
                  <p className="text-sm text-slate-500">
                    Total pagado: {money(total)}
                  </p>
                </div>

                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                    <th className="px-4 py-3 text-left font-semibold">Concepto</th>
                    <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                    <th className="px-4 py-3 text-left font-semibold">Método</th>
                    <th className="px-4 py-3 text-left font-semibold">Estado</th>
                    <th className="px-4 py-3 text-left font-semibold">Monto</th>
                    <th className="px-4 py-3 text-left font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-slate-500">
                        Cargando ingresos...
                      </td>
                    </tr>
                  ) : filtrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-slate-500">
                        No hay ingresos registrados.
                      </td>
                    </tr>
                  ) : (
                    filtrados.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-4 py-3 text-slate-700">{row.fecha}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{row.concepto}</p>
                          <p className="text-xs text-slate-500">{row.categoria} · {row.tipo_origen}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{row.clientes?.nombre || '—'}</td>
                        <td className="px-4 py-3 text-slate-700">{row.metodos_pago?.nombre || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            row.estado === 'pagado'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}>
                            {row.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-emerald-700">{money(row.monto)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEdit(row)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Editar
                            </button>

                            {row.estado !== 'anulado' && (
                              <button
                                onClick={() => anularPago(row.id)}
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                              >
                                Anular
                              </button>
                            )}
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
      </main>
    </div>
  )
}