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
      {/* Header - Más limpio */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">
              Operaciones
            </p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-white">
              Servicios
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Administra los servicios del centro.
            </p>
          </div>

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
              flex items-center gap-2 rounded-2xl border border-white/10 
              bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white 
              transition-all hover:bg-white/[0.12] hover:border-white/20
            "
          >
            {showForm ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cerrar
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo servicio
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats - Más compactos y ordenados */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          title="Total"
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
          color="text-white/60"
        />
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-medium text-white/55">Categorías</p>
          <p className="mt-1.5 text-2xl font-bold text-white">
            {new Set(servicios.map(s => s.categoria).filter(Boolean)).size}
          </p>
        </div>
      </div>

      {/* Error - Más visible */}
      {error && (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-rose-300">Error</p>
              <p className="mt-1 text-sm text-rose-200/80">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="flex-shrink-0 text-rose-400 transition hover:text-rose-300"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Form - Más estructurado */}
      {showForm && (
        <Section
          title={editingId ? 'Editar servicio' : 'Crear servicio'}
          description="Completa la información principal del servicio."
        >
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Información básica */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/40">
                Información básica
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Field label="Nombre del servicio">
                    <input
                      value={form.nombre}
                      onChange={(e) => onChange('nombre', e.target.value)}
                      className={inputClassName}
                      placeholder="Ej: Evaluación fisioterapéutica"
                      required
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
              </div>
            </div>

            {/* Detalles del servicio */}
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/40">
                Detalles del servicio
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Duración (minutos)">
                  <input
                    type="number"
                    min="0"
                    value={form.duracion_minutos}
                    onChange={(e) => onChange('duracion_minutos', e.target.value)}
                    className={inputClassName}
                    placeholder="60"
                  />
                </Field>

                <Field label="Precio (USD)">
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
                      className="h-8 w-12 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                    />
                    <span className="text-xs text-white/55">{form.color}</span>
                  </div>
                </Field>
              </div>
            </div>

            {/* Descripción */}
            <div>
              <Field label="Descripción">
                <textarea
                  value={form.descripcion}
                  onChange={(e) => onChange('descripcion', e.target.value)}
                  className={`${inputClassName} min-h-[100px] resize-none`}
                  placeholder="Describe brevemente el servicio"
                />
              </Field>
            </div>

            {/* Botones */}
            <div className="flex flex-wrap gap-3 border-t border-white/10 pt-6">
              <button
                type="submit"
                disabled={saving}
                className="
                  flex items-center gap-2 rounded-2xl border border-white/10 
                  bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white 
                  transition-all hover:bg-white/[0.12] disabled:opacity-60 
                  disabled:cursor-not-allowed
                "
              >
                {saving ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {editingId ? 'Guardar cambios' : 'Crear servicio'}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="
                  flex items-center gap-2 rounded-2xl border border-white/10 
                  bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 
                  transition-all hover:bg-white/[0.06]
                "
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancelar
              </button>
            </div>
          </form>
        </Section>
      )}

      {/* Listado - Mejor organizado */}
      <Section
        title="Listado de servicios"
        description="Busca por nombre, categoría, descripción o estado."
        className="p-0"
        contentClassName="overflow-hidden"
      >
        <div className="border-b border-white/10 p-4">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar servicios..."
              className={`${inputClassName} pl-11`}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="text-center">
              <svg className="mx-auto h-8 w-8 animate-spin text-white/40" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="mt-3 text-sm text-white/55">Cargando servicios...</p>
            </div>
          </div>
        ) : serviciosFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="mt-4 font-medium text-white/75">No hay servicios</p>
            <p className="mt-1 text-sm text-white/45">
              {search ? 'Intenta con otro término de búsqueda' : 'Comienza creando tu primer servicio'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/40">
                    Servicio
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/40">
                    Categoría
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/40">
                    Duración
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/40">
                    Precio
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/40">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white/40">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {serviciosFiltrados.map((servicio) => (
                  <tr key={servicio.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-10 w-10 flex-shrink-0 rounded-xl"
                          style={{ backgroundColor: servicio.color || '#0f172a' }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-white">{servicio.nombre}</p>
                          <p className="mt-0.5 truncate text-xs text-white/45">
                            {servicio.descripcion || 'Sin descripción'}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      {servicio.categoria ? (
                        <span className="inline-flex rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-medium text-white/75">
                          {servicio.categoria}
                        </span>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <span className="text-white/75">{servicio.duracion_minutos} min</span>
                    </td>

                    <td className="px-4 py-4">
                      <span className="font-semibold text-white">{money(servicio.precio)}</span>
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
                            hover:bg-white/[0.08] hover:border-white/20
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
                            hover:bg-white/[0.08] hover:border-white/20
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
                            hover:bg-rose-400/20 hover:border-rose-400/30
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
