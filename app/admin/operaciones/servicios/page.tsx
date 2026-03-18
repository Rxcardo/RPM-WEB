'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type Servicio = {
  id: string
  nombre: string
  descripcion: string | null
  categoria: string | null
  duracion_minutos: number
  precio: number
  estado: string
  color: string | null
  created_at: string
}

type FormState = {
  nombre: string
  descripcion: string
  categoria: string
  duracion_minutos: string
  precio: string
  estado: string
  color: string
}

const INITIAL_FORM: FormState = {
  nombre: '',
  descripcion: '',
  categoria: '',
  duracion_minutos: '60',
  precio: '',
  estado: 'activo',
  color: '#0f172a',
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0))
}

export default function ServiciosPage() {
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)

  useEffect(() => {
    cargarServicios()
  }, [])

  async function cargarServicios() {
    try {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('servicios')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setServicios((data as Servicio[]) || [])
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'No se pudieron cargar los servicios')
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm(INITIAL_FORM)
    setEditingId(null)
    setShowForm(false)
  }

  function onChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  function onEdit(servicio: Servicio) {
    setEditingId(servicio.id)
    setForm({
      nombre: servicio.nombre || '',
      descripcion: servicio.descripcion || '',
      categoria: servicio.categoria || '',
      duracion_minutos: String(servicio.duracion_minutos || 60),
      precio: String(servicio.precio ?? ''),
      estado: servicio.estado || 'activo',
      color: servicio.color || '#0f172a',
    })
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.nombre.trim()) {
      setError('El nombre del servicio es obligatorio')
      return
    }

    try {
      setSaving(true)
      setError('')

      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        categoria: form.categoria.trim() || null,
        duracion_minutos: Number(form.duracion_minutos || 0),
        precio: Number(form.precio || 0),
        estado: form.estado,
        color: form.color || null,
      }

      if (editingId) {
        const { error } = await supabase
          .from('servicios')
          .update(payload)
          .eq('id', editingId)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('servicios')
          .insert(payload)

        if (error) throw error
      }

      resetForm()
      await cargarServicios()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'No se pudo guardar el servicio')
    } finally {
      setSaving(false)
    }
  }

  async function cambiarEstado(id: string, estadoActual: string) {
    try {
      const nuevoEstado = estadoActual === 'activo' ? 'inactivo' : 'activo'

      const { error } = await supabase
        .from('servicios')
        .update({ estado: nuevoEstado })
        .eq('id', id)

      if (error) throw error
      await cargarServicios()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'No se pudo actualizar el estado')
    }
  }

  async function eliminarServicio(id: string) {
    const ok = window.confirm('¿Seguro que quieres eliminar este servicio?')
    if (!ok) return

    try {
      const { error } = await supabase
        .from('servicios')
        .delete()
        .eq('id', id)

      if (error) throw error
      await cargarServicios()
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'No se pudo eliminar el servicio')
    }
  }

  const serviciosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return servicios

    return servicios.filter((item) => {
      return (
        item.nombre?.toLowerCase().includes(q) ||
        item.categoria?.toLowerCase().includes(q) ||
        item.descripcion?.toLowerCase().includes(q) ||
        item.estado?.toLowerCase().includes(q)
      )
    })
  }, [servicios, search])

  const totalActivos = servicios.filter((s) => s.estado === 'activo').length
  const totalInactivos = servicios.filter((s) => s.estado !== 'activo').length

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Servicios</h1>
          <p className="mt-1 text-sm text-slate-500">
            Administra los servicios del centro
          </p>
        </div>

        <button
          onClick={() => {
            if (showForm && !editingId) {
              setShowForm(false)
            } else {
              setEditingId(null)
              setForm(INITIAL_FORM)
              setShowForm(true)
            }
          }}
          className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
        >
          {showForm ? 'Cerrar formulario' : 'Nuevo servicio'}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Total servicios</p>
          <p className="text-2xl font-bold">{servicios.length}</p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Activos</p>
          <p className="text-2xl font-bold">{totalActivos}</p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Inactivos</p>
          <p className="text-2xl font-bold">{totalInactivos}</p>
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : null}

      {showForm ? (
        <form onSubmit={onSubmit} className="mb-6 rounded-2xl border bg-white p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">
              {editingId ? 'Editar servicio' : 'Crear servicio'}
            </h2>
            <p className="text-sm text-slate-500">
              Completa la información principal
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Nombre
              </label>
              <input
                value={form.nombre}
                onChange={(e) => onChange('nombre', e.target.value)}
                className="w-full rounded-xl border px-3 py-3 outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Ej: Evaluación fisioterapéutica"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Categoría
              </label>
              <input
                value={form.categoria}
                onChange={(e) => onChange('categoria', e.target.value)}
                className="w-full rounded-xl border px-3 py-3 outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Ej: Terapia, evaluación, masaje"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Estado
              </label>
              <select
                value={form.estado}
                onChange={(e) => onChange('estado', e.target.value)}
                className="w-full rounded-xl border px-3 py-3 outline-none focus:ring-2 focus:ring-slate-300"
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Duración (min)
              </label>
              <input
                type="number"
                min="0"
                value={form.duracion_minutos}
                onChange={(e) => onChange('duracion_minutos', e.target.value)}
                className="w-full rounded-xl border px-3 py-3 outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="60"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Precio
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.precio}
                onChange={(e) => onChange('precio', e.target.value)}
                className="w-full rounded-xl border px-3 py-3 outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Color
              </label>
              <input
                type="color"
                value={form.color}
                onChange={(e) => onChange('color', e.target.value)}
                className="h-12 w-full rounded-xl border px-2 py-2"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Descripción
              </label>
              <textarea
                value={form.descripcion}
                onChange={(e) => onChange('descripcion', e.target.value)}
                className="min-h-[120px] w-full rounded-xl border px-3 py-3 outline-none focus:ring-2 focus:ring-slate-300"
                placeholder="Describe brevemente el servicio"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear servicio'}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border px-4 py-3 text-sm font-medium text-slate-700"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <div className="rounded-2xl border bg-white">
        <div className="border-b p-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, categoría, descripción o estado"
            className="w-full rounded-xl border px-3 py-3 outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>

        {loading ? (
          <div className="p-5">
            <p className="text-sm text-slate-500">Cargando servicios...</p>
          </div>
        ) : serviciosFiltrados.length === 0 ? (
          <div className="p-5">
            <p className="text-sm text-slate-500">No hay servicios registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Servicio</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Categoría</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Duración</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Precio</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {serviciosFiltrados.map((servicio) => (
                  <tr key={servicio.id} className="border-t">
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-1 h-3 w-3 rounded-full"
                          style={{ backgroundColor: servicio.color || '#0f172a' }}
                        />
                        <div>
                          <p className="font-medium text-slate-900">{servicio.nombre}</p>
                          <p className="text-xs text-slate-500">
                            {servicio.descripcion || 'Sin descripción'}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {servicio.categoria || '—'}
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {servicio.duracion_minutos} min
                    </td>

                    <td className="px-4 py-4 text-slate-700">
                      {money(servicio.precio)}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                          servicio.estado === 'activo'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {servicio.estado}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => onEdit(servicio)}
                          className="rounded-lg border px-3 py-2 text-xs font-medium text-slate-700"
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => cambiarEstado(servicio.id, servicio.estado)}
                          className="rounded-lg border px-3 py-2 text-xs font-medium text-slate-700"
                        >
                          {servicio.estado === 'activo' ? 'Inactivar' : 'Activar'}
                        </button>

                        <button
                          onClick={() => eliminarServicio(servicio.id)}
                          className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}