'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'

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

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0))
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/75">{label}</label>
      {children}
    </div>
  )
}

function estadoBadgeClasses(estado: string) {
  return estado === 'activo'
    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    : 'border-white/10 bg-white/[0.05] text-white/70'
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
    void cargarServicios()
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

  async function onSubmit(e: FormEvent) {
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Operaciones</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Servicios
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Administra los servicios del centro.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <ActionCard
            title={showForm ? 'Cerrar formulario' : 'Nuevo servicio'}
            description={
              showForm
                ? 'Ocultar el formulario actual.'
                : 'Crear un nuevo servicio en el catálogo.'
            }
            href="#"
            className="pointer-events-none"
          />
        </div>
      </div>

      <div className="-mt-3">
        <button
          type="button"
          onClick={() => {
            if (showForm && !editingId) {
              setShowForm(false)
            } else {
              setEditingId(null)
              setForm(INITIAL_FORM)
              setShowForm(true)
            }
          }}
          className="
            rounded-2xl border border-white/10 bg-white/[0.08]
            px-4 py-3 text-sm font-semibold text-white transition
            hover:bg-white/[0.12]
          "
        >
          {showForm ? 'Cerrar formulario' : 'Nuevo servicio'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total servicios"
          value={servicios.length}
        />
        <StatCard
          title="Activos"
          value={totalActivos}
          color="text-emerald-400"
        />
        <StatCard
          title="Inactivos"
          value={totalInactivos}
          color="text-white/80"
        />
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      {showForm ? (
        <Section
          title={editingId ? 'Editar servicio' : 'Crear servicio'}
          description="Completa la información principal del servicio."
        >
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Nombre">
                <input
                  value={form.nombre}
                  onChange={(e) => onChange('nombre', e.target.value)}
                  className={inputClassName}
                  placeholder="Ej: Evaluación fisioterapéutica"
                />
              </Field>
            </div>

            <Field label="Categoría">
              <input
                value={form.categoria}
                onChange={(e) => onChange('categoria', e.target.value)}
                className={inputClassName}
                placeholder="Ej: Terapia, evaluación, masaje"
              />
            </Field>

            <Field label="Estado">
              <select
                value={form.estado}
                onChange={(e) => onChange('estado', e.target.value)}
                className={inputClassName}
              >
                <option value="activo" className="bg-[#11131a] text-white">
                  Activo
                </option>
                <option value="inactivo" className="bg-[#11131a] text-white">
                  Inactivo
                </option>
              </select>
            </Field>

            <Field label="Duración (min)">
              <input
                type="number"
                min="0"
                value={form.duracion_minutos}
                onChange={(e) => onChange('duracion_minutos', e.target.value)}
                className={inputClassName}
                placeholder="60"
              />
            </Field>

            <Field label="Precio">
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.precio}
                onChange={(e) => onChange('precio', e.target.value)}
                className={inputClassName}
                placeholder="0.00"
              />
            </Field>

            <Field label="Color">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => onChange('color', e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                />
                <span className="text-sm text-white/55">{form.color}</span>
              </div>
            </Field>

            <div className="md:col-span-2">
              <Field label="Descripción">
                <textarea
                  value={form.descripcion}
                  onChange={(e) => onChange('descripcion', e.target.value)}
                  className={`${inputClassName} min-h-[120px] resize-none`}
                  placeholder="Describe brevemente el servicio"
                />
              </Field>
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="
                  rounded-2xl border border-white/10 bg-white/[0.08]
                  px-4 py-3 text-sm font-semibold text-white transition
                  hover:bg-white/[0.12] disabled:opacity-60
                "
              >
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear servicio'}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="
                  rounded-2xl border border-white/10 bg-white/[0.03]
                  px-4 py-3 text-sm font-semibold text-white/80 transition
                  hover:bg-white/[0.06]
                "
              >
                Cancelar
              </button>
            </div>
          </form>
        </Section>
      ) : null}

      <Section
        title="Listado de servicios"
        description="Busca por nombre, categoría, descripción o estado."
        className="p-0"
        contentClassName="overflow-hidden"
      >
        <div className="border-b border-white/10 p-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, categoría, descripción o estado"
            className={inputClassName}
          />
        </div>

        {loading ? (
          <div className="p-5">
            <p className="text-sm text-white/55">Cargando servicios...</p>
          </div>
        ) : serviciosFiltrados.length === 0 ? (
          <div className="p-5">
            <p className="text-sm text-white/55">No hay servicios registrados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03]">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-white/55">Servicio</th>
                  <th className="px-4 py-3 text-left font-medium text-white/55">Categoría</th>
                  <th className="px-4 py-3 text-left font-medium text-white/55">Duración</th>
                  <th className="px-4 py-3 text-left font-medium text-white/55">Precio</th>
                  <th className="px-4 py-3 text-left font-medium text-white/55">Estado</th>
                  <th className="px-4 py-3 text-right font-medium text-white/55">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {serviciosFiltrados.map((servicio) => (
                  <tr key={servicio.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <span
                          className="mt-1 h-3 w-3 rounded-full"
                          style={{ backgroundColor: servicio.color || '#0f172a' }}
                        />
                        <div>
                          <p className="font-medium text-white">{servicio.nombre}</p>
                          <p className="text-xs text-white/45">
                            {servicio.descripcion || 'Sin descripción'}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4 text-white/75">
                      {servicio.categoria || '—'}
                    </td>

                    <td className="px-4 py-4 text-white/75">
                      {servicio.duracion_minutos} min
                    </td>

                    <td className="px-4 py-4 text-white/75">
                      {money(servicio.precio)}
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${estadoBadgeClasses(
                          servicio.estado
                        )}`}
                      >
                        {servicio.estado}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(servicio)}
                          className="
                            rounded-xl border border-white/10 bg-white/[0.03]
                            px-3 py-2 text-xs font-medium text-white/80 transition
                            hover:bg-white/[0.06]
                          "
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => cambiarEstado(servicio.id, servicio.estado)}
                          className="
                            rounded-xl border border-white/10 bg-white/[0.03]
                            px-3 py-2 text-xs font-medium text-white/80 transition
                            hover:bg-white/[0.06]
                          "
                        >
                          {servicio.estado === 'activo' ? 'Inactivar' : 'Activar'}
                        </button>

                        <button
                          type="button"
                          onClick={() => eliminarServicio(servicio.id)}
                          className="
                            rounded-xl border border-rose-400/20 bg-rose-400/10
                            px-3 py-2 text-xs font-medium text-rose-300 transition
                            hover:bg-rose-400/15
                          "
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
      </Section>
    </div>
  )
}