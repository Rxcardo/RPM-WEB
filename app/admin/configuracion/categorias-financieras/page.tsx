'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type MetodoPago = {
  id: string
  nombre: string
  tipo: string | null
  estado: string
  created_at: string
}

type FormState = {
  nombre: string
  tipo: string
  estado: string
}

const INITIAL_FORM: FormState = {
  nombre: '',
  tipo: '',
  estado: 'activo',
}

export default function MetodosPagoConfigPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [rows, setRows] = useState<MetodoPago[]>([])
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [search, setSearch] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setErrorMsg('')
      setSuccessMsg('')

      const { data, error } = await supabase
        .from('metodos_pago')
        .select('id, nombre, tipo, estado, created_at')
        .order('nombre', { ascending: true })

      if (error) throw error
      setRows((data || []) as MetodoPago[])
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudieron cargar los métodos de pago.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm(INITIAL_FORM)
    setEditingId(null)
  }

  function startEdit(row: MetodoPago) {
    setEditingId(row.id)
    setForm({
      nombre: row.nombre || '',
      tipo: row.tipo || '',
      estado: row.estado || 'activo',
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!form.nombre.trim()) {
      setErrorMsg('El nombre es obligatorio.')
      return
    }

    try {
      setSaving(true)

      const payload = {
        nombre: form.nombre.trim(),
        tipo: form.tipo.trim() || null,
        estado: form.estado || 'activo',
      }

      if (editingId) {
        const { error } = await supabase
          .from('metodos_pago')
          .update(payload)
          .eq('id', editingId)

        if (error) throw error
        setSuccessMsg('Método actualizado correctamente.')
      } else {
        const { error } = await supabase
          .from('metodos_pago')
          .insert(payload)

        if (error) throw error
        setSuccessMsg('Método creado correctamente.')
      }

      resetForm()
      await loadData()
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo guardar el método de pago.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleEstado(row: MetodoPago) {
    try {
      setErrorMsg('')
      setSuccessMsg('')

      const nuevoEstado = row.estado === 'activo' ? 'inactivo' : 'activo'

      const { error } = await supabase
        .from('metodos_pago')
        .update({ estado: nuevoEstado })
        .eq('id', row.id)

      if (error) throw error

      setSuccessMsg(`Método actualizado a "${nuevoEstado}".`)
      await loadData()
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo actualizar el estado.')
    }
  }

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows

    return rows.filter((row) => {
      return (
        row.nombre?.toLowerCase().includes(q) ||
        row.tipo?.toLowerCase().includes(q) ||
        row.estado?.toLowerCase().includes(q)
      )
    })
  }, [rows, search])

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Configuración</p>
          <h1 className="text-2xl font-bold text-slate-900">Métodos de pago</h1>
          <p className="mt-1 text-sm text-slate-600">
            Administra los métodos de pago del sistema.
          </p>
        </div>

        <Link
          href="/admin/configuracion"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Volver a configuración
        </Link>
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
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-1">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">
            {editingId ? 'Editar método' : 'Nuevo método'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                placeholder="Ej: Efectivo"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
              <input
                value={form.tipo}
                onChange={(e) => setForm((prev) => ({ ...prev, tipo: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                placeholder="Ej: cash, card, transfer"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Estado</label>
              <select
                value={form.estado}
                onChange={(e) => setForm((prev) => ({ ...prev, estado: e.target.value }))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2"
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
              </button>

              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2 overflow-hidden">
          <div className="border-b bg-slate-50 px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Listado</h2>

              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar método..."
                className="w-full max-w-sm rounded-xl border border-slate-300 px-3 py-2"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Nombre</th>
                  <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                  <th className="px-4 py-3 text-left font-semibold">Estado</th>
                  <th className="px-4 py-3 text-left font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-slate-500">
                      Cargando métodos...
                    </td>
                  </tr>
                ) : filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-slate-500">
                      No hay métodos registrados.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-900">{row.nombre}</td>
                      <td className="px-4 py-3 text-slate-700">{row.tipo || '—'}</td>
                      <td className="px-4 py-3 text-slate-700">{row.estado}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => startEdit(row)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => toggleEstado(row)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {row.estado === 'activo' ? 'Desactivar' : 'Activar'}
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