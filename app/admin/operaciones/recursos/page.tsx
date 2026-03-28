'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'

type Recurso = {
  id: string
  nombre: string
  tipo: string | null
  descripcion: string | null
  capacidad: number | null
  color: string | null
  estado: string | null
  hora_inicio: string | null
  hora_fin: string | null
  created_at: string | null
}

type RecursoForm = {
  nombre: string
  tipo: string
  descripcion: string
  capacidad: number
  color: string
  estado: string
  hora_inicio: string
  hora_fin: string
}

const INITIAL_FORM: RecursoForm = {
  nombre: '',
  tipo: '',
  descripcion: '',
  capacidad: 1,
  color: '#8b5cf6',
  estado: 'activo',
  hora_inicio: '',
  hora_fin: '',
}

function Field({
  label,
  children,
  helper,
}: {
  label: string
  children: ReactNode
  helper?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/75">
        {label}
      </label>
      {children}
      {helper ? <p className="mt-2 text-xs text-white/45">{helper}</p> : null}
    </div>
  )
}

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

function estadoBadgeClasses(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'activo':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'inactivo':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'mantenimiento':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function formatTipo(tipo?: string | null) {
  if (!tipo) return '—'

  const map: Record<string, string> = {
    sala: 'Sala',
    cabina: 'Cabina',
    cancha: 'Cancha',
    consultorio: 'Consultorio',
    equipo: 'Equipo',
    camilla: 'Camilla',
    otro: 'Otro',
    therapy: 'Terapia',
    recovery: 'Recovery',
    training: 'Entrenamiento',
    evaluation: 'Evaluación',
    other: 'Otro',
  }

  return map[tipo] || tipo
}

function formatHora(hora?: string | null) {
  if (!hora) return '—'
  return hora.slice(0, 5)
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function buildFormFromRecurso(recurso: Recurso): RecursoForm {
  return {
    nombre: recurso.nombre || '',
    tipo: recurso.tipo || '',
    descripcion: recurso.descripcion || '',
    capacidad: Number(recurso.capacidad ?? 1),
    color: recurso.color || '#8b5cf6',
    estado: recurso.estado || 'activo',
    hora_inicio: recurso.hora_inicio ? recurso.hora_inicio.slice(0, 5) : '',
    hora_fin: recurso.hora_fin ? recurso.hora_fin.slice(0, 5) : '',
  }
}

export default function RecursosPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<RecursoForm>(INITIAL_FORM)

  async function load() {
    try {
      setLoading(true)
      setError('')

      const { data, error } = await supabase
        .from('recursos')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setRecursos((data || []) as Recurso[])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudieron cargar los recursos.')
      setRecursos([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const recursosFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase()

    if (!q) return recursos

    return recursos.filter((r) => {
      const texto = [
        r.nombre,
        r.tipo,
        r.descripcion,
        r.estado,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return texto.includes(q)
    })
  }, [recursos, query])

  const recursoSeleccionado = useMemo(() => {
    if (!selectedId) return null
    return recursos.find((r) => r.id === selectedId) || null
  }, [recursos, selectedId])

  const totalRecursos = recursos.length
  const totalActivos = recursos.filter((r) => (r.estado || '').toLowerCase() === 'activo').length
  const totalInactivos = recursos.filter((r) => (r.estado || '').toLowerCase() === 'inactivo').length
  const totalMantenimiento = recursos.filter((r) => (r.estado || '').toLowerCase() === 'mantenimiento').length

  function resetForm() {
    setForm(INITIAL_FORM)
    setEditingId(null)
  }

  function abrirCrear() {
    resetForm()
    setIsFormOpen(true)
  }

  function abrirEditar(recurso: Recurso) {
    setEditingId(recurso.id)
    setForm(buildFormFromRecurso(recurso))
    setIsFormOpen(true)
  }

  function cerrarPanel() {
    setIsFormOpen(false)
    resetForm()
  }

  async function guardar() {
    if (!form.nombre.trim()) {
      alert('El nombre es obligatorio.')
      return
    }

    if (Number(form.capacidad) <= 0) {
      alert('La capacidad debe ser mayor a 0.')
      return
    }

    if (form.hora_inicio && form.hora_fin && form.hora_inicio >= form.hora_fin) {
      alert('La hora de fin debe ser mayor que la hora de inicio.')
      return
    }

    try {
      setSaving(true)
      setError('')

      const payload = {
        nombre: form.nombre.trim(),
        tipo: form.tipo || null,
        descripcion: form.descripcion.trim() || null,
        capacidad: Number(form.capacidad || 1),
        color: form.color || null,
        estado: form.estado || 'activo',
        hora_inicio: form.hora_inicio || null,
        hora_fin: form.hora_fin || null,
      }

      if (editingId) {
        const { error } = await supabase
          .from('recursos')
          .update(payload)
          .eq('id', editingId)

        if (error) throw error
      } else {
        const { error } = await supabase.from('recursos').insert(payload)
        if (error) throw error
      }

      await load()
      cerrarPanel()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo guardar el recurso.')
    } finally {
      setSaving(false)
    }
  }

  async function eliminar(id: string) {
    const ok = window.confirm('¿Seguro que quieres eliminar este recurso?')
    if (!ok) return

    try {
      setError('')

      const { error } = await supabase
        .from('recursos')
        .delete()
        .eq('id', id)

      if (error) throw error

      if (selectedId === id) {
        setSelectedId(null)
      }

      await load()
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo eliminar el recurso.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Operaciones</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Recursos
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Todo unido en una sola vista: listar, crear, ver, editar y eliminar.
          </p>
        </div>

        <div className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={inputClassName}
            placeholder="Buscar por nombre, tipo, estado..."
          />

          <button
            type="button"
            onClick={abrirCrear}
            className="
              rounded-2xl border border-white/10 bg-white/[0.08]
              px-5 py-3 text-sm font-semibold text-white transition
              hover:bg-white/[0.12]
            "
          >
            Nuevo recurso
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total recursos" value={totalRecursos} />
        <StatCard title="Activos" value={totalActivos} color="text-emerald-400" />
        <StatCard title="Inactivos" value={totalInactivos} color="text-rose-400" />
        <StatCard title="Mantenimiento" value={totalMantenimiento} color="text-amber-400" />
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.5fr_.95fr]">
        <Section
          title="Listado de recursos"
          description="Selecciona uno para ver el detalle o editarlo sin salir de la página."
          className="p-0"
          contentClassName="overflow-hidden"
        >
          {loading ? (
            <div className="p-6">
              <p className="text-sm text-white/55">Cargando recursos...</p>
            </div>
          ) : recursosFiltrados.length === 0 ? (
            <div className="p-6">
              <p className="text-sm text-white/55">No hay recursos registrados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03]">
                  <tr>
                    <th className="p-4 text-left font-medium text-white/55">Nombre</th>
                    <th className="p-4 text-left font-medium text-white/55">Tipo</th>
                    <th className="p-4 text-left font-medium text-white/55">Capacidad</th>
                    <th className="p-4 text-left font-medium text-white/55">Horario</th>
                    <th className="p-4 text-left font-medium text-white/55">Estado</th>
                    <th className="p-4 text-right font-medium text-white/55">Acciones</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {recursosFiltrados.map((r) => {
                    const selected = r.id === selectedId

                    return (
                      <tr
                        key={r.id}
                        className={`transition hover:bg-white/[0.03] ${
                          selected ? 'bg-white/[0.05]' : ''
                        }`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <span
                              className="h-3 w-3 rounded-full border border-white/20"
                              style={{ backgroundColor: r.color || '#64748b' }}
                            />
                            <button
                              type="button"
                              onClick={() => setSelectedId(r.id)}
                              className="text-left"
                            >
                              <p className="font-medium text-white">
                                {r.nombre || 'Sin nombre'}
                              </p>
                              <p className="text-xs text-white/45">
                                {r.descripcion?.slice(0, 60) || 'Sin descripción'}
                              </p>
                            </button>
                          </div>
                        </td>

                        <td className="p-4 text-white/75">
                          {formatTipo(r.tipo)}
                        </td>

                        <td className="p-4 text-white/75">
                          {r.capacidad ?? '—'}
                        </td>

                        <td className="p-4 text-white/75">
                          {r.hora_inicio || r.hora_fin
                            ? `${formatHora(r.hora_inicio)} - ${formatHora(r.hora_fin)}`
                            : '—'}
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${estadoBadgeClasses(
                              r.estado || ''
                            )}`}
                          >
                            {r.estado || 'sin estado'}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedId(r.id)}
                              className="
                                rounded-xl border border-white/10 bg-white/[0.03]
                                px-3 py-2 text-xs font-medium text-white/80 transition
                                hover:bg-white/[0.06]
                              "
                            >
                              Ver
                            </button>

                            <button
                              type="button"
                              onClick={() => abrirEditar(r)}
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
                              onClick={() => eliminar(r.id)}
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
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <div className="space-y-6">
          <Section
            title={isFormOpen ? (editingId ? 'Editar recurso' : 'Nuevo recurso') : 'Detalle del recurso'}
            description={
              isFormOpen
                ? 'Crea o modifica el recurso desde aquí mismo.'
                : 'Selecciona un recurso en la tabla para ver su información.'
            }
          >
            {isFormOpen ? (
              <div className="space-y-4">
                <Field label="Nombre">
                  <input
                    value={form.nombre}
                    className={inputClassName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, nombre: e.target.value }))
                    }
                    placeholder="Ej: Sala 1"
                  />
                </Field>

                <Field label="Tipo">
                  <select
                    value={form.tipo}
                    className={inputClassName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, tipo: e.target.value }))
                    }
                  >
                    <option value="" className="bg-[#11131a] text-white">
                      Seleccionar tipo
                    </option>
                    <option value="sala" className="bg-[#11131a] text-white">
                      Sala
                    </option>
                    <option value="cabina" className="bg-[#11131a] text-white">
                      Cabina
                    </option>
                    <option value="cancha" className="bg-[#11131a] text-white">
                      Cancha
                    </option>
                    <option value="consultorio" className="bg-[#11131a] text-white">
                      Consultorio
                    </option>
                    <option value="equipo" className="bg-[#11131a] text-white">
                      Equipo
                    </option>
                    <option value="camilla" className="bg-[#11131a] text-white">
                      Camilla
                    </option>
                    <option value="otro" className="bg-[#11131a] text-white">
                      Otro
                    </option>
                  </select>
                </Field>

                <Field
                  label="Capacidad"
                  helper="Cantidad máxima de personas o uso simultáneo."
                >
                  <input
                    type="number"
                    min="1"
                    value={form.capacidad}
                    className={inputClassName}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        capacidad: Number(e.target.value),
                      }))
                    }
                  />
                </Field>

                <Field label="Color">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.color || '#8b5cf6'}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, color: e.target.value }))
                      }
                      className="h-12 w-16 cursor-pointer rounded-xl border border-white/10 bg-transparent p-1"
                    />
                    <input
                      value={form.color}
                      className={inputClassName}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, color: e.target.value }))
                      }
                      placeholder="#8b5cf6"
                    />
                  </div>
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Hora inicio">
                    <input
                      type="time"
                      value={form.hora_inicio}
                      className={inputClassName}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, hora_inicio: e.target.value }))
                      }
                    />
                  </Field>

                  <Field label="Hora fin">
                    <input
                      type="time"
                      value={form.hora_fin}
                      className={inputClassName}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, hora_fin: e.target.value }))
                      }
                    />
                  </Field>
                </div>

                <Field label="Estado">
                  <select
                    value={form.estado}
                    className={inputClassName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, estado: e.target.value }))
                    }
                  >
                    <option value="activo" className="bg-[#11131a] text-white">
                      Activo
                    </option>
                    <option value="inactivo" className="bg-[#11131a] text-white">
                      Inactivo
                    </option>
                    <option value="mantenimiento" className="bg-[#11131a] text-white">
                      Mantenimiento
                    </option>
                  </select>
                </Field>

                <Field label="Descripción">
                  <textarea
                    value={form.descripcion}
                    className={`${inputClassName} min-h-[120px] resize-none`}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, descripcion: e.target.value }))
                    }
                    placeholder="Describe el recurso"
                  />
                </Field>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={guardar}
                    disabled={saving}
                    className="
                      rounded-2xl border border-white/10 bg-white/[0.08]
                      px-5 py-3 text-sm font-semibold text-white transition
                      hover:bg-white/[0.12] disabled:opacity-60
                    "
                  >
                    {saving
                      ? 'Guardando...'
                      : editingId
                      ? 'Guardar cambios'
                      : 'Crear recurso'}
                  </button>

                  <button
                    type="button"
                    onClick={cerrarPanel}
                    className="
                      rounded-2xl border border-white/10 bg-white/[0.03]
                      px-5 py-3 text-sm font-semibold text-white/80 transition
                      hover:bg-white/[0.06]
                    "
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : !recursoSeleccionado ? (
              <Card className="p-4">
                <p className="text-sm text-white/55">
                  No has seleccionado ningún recurso.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                <Card className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span
                          className="h-4 w-4 rounded-full border border-white/20"
                          style={{
                            backgroundColor: recursoSeleccionado.color || '#64748b',
                          }}
                        />
                        <h3 className="text-lg font-semibold text-white">
                          {recursoSeleccionado.nombre}
                        </h3>
                      </div>

                      <p className="mt-2 text-sm text-white/55">
                        {recursoSeleccionado.descripcion || 'Sin descripción registrada.'}
                      </p>
                    </div>

                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${estadoBadgeClasses(
                        recursoSeleccionado.estado || ''
                      )}`}
                    >
                      {recursoSeleccionado.estado || 'sin estado'}
                    </span>
                  </div>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="p-4">
                    <p className="text-xs text-white/45">Tipo</p>
                    <p className="mt-1 font-medium text-white">
                      {formatTipo(recursoSeleccionado.tipo)}
                    </p>
                  </Card>

                  <Card className="p-4">
                    <p className="text-xs text-white/45">Capacidad</p>
                    <p className="mt-1 font-medium text-white">
                      {recursoSeleccionado.capacidad ?? '—'}
                    </p>
                  </Card>

                  <Card className="p-4">
                    <p className="text-xs text-white/45">Horario</p>
                    <p className="mt-1 font-medium text-white">
                      {recursoSeleccionado.hora_inicio || recursoSeleccionado.hora_fin
                        ? `${formatHora(recursoSeleccionado.hora_inicio)} - ${formatHora(
                            recursoSeleccionado.hora_fin
                          )}`
                        : '—'}
                    </p>
                  </Card>

                  <Card className="p-4">
                    <p className="text-xs text-white/45">Creado</p>
                    <p className="mt-1 font-medium text-white">
                      {formatDateTime(recursoSeleccionado.created_at)}
                    </p>
                  </Card>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => abrirEditar(recursoSeleccionado)}
                    className="
                      rounded-2xl border border-white/10 bg-white/[0.08]
                      px-5 py-3 text-sm font-semibold text-white transition
                      hover:bg-white/[0.12]
                    "
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => eliminar(recursoSeleccionado.id)}
                    className="
                      rounded-2xl border border-rose-400/20 bg-rose-400/10
                      px-5 py-3 text-sm font-semibold text-rose-300 transition
                      hover:bg-rose-400/15
                    "
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}