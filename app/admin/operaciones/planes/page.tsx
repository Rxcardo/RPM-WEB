'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'

type VigenciaTipo = 'dias' | 'semanas' | 'meses'

type Plan = {
  id: string
  nombre: string
  descripcion: string | null
  sesiones_totales: number | null
  vigencia_valor: number | null
  vigencia_tipo: VigenciaTipo | null
  precio: number | null
  comision_base: number | null
  comision_rpm: number | null
  comision_entrenador: number | null
  estado: string
  created_at: string
}

type FormState = {
  nombre: string
  sesiones_totales: string
  vigencia_valor: string
  vigencia_tipo: VigenciaTipo
  precio: string
  comision_base: string
  comision_rpm_pct: string
  comision_entrenador_pct: string
  estado: 'activo' | 'inactivo'
  descripcion: string
}

type ViewMode = 'list' | 'create' | 'edit' | 'detail'

const INITIAL_FORM: FormState = {
  nombre: '',
  sesiones_totales: '',
  vigencia_valor: '',
  vigencia_tipo: 'dias',
  precio: '',
  comision_base: '',
  comision_rpm_pct: '50',
  comision_entrenador_pct: '50',
  estado: 'activo',
  descripcion: '',
}

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

function estadoBadge(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'activo':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'inactivo':
      return 'border-white/10 bg-white/[0.05] text-white/70'
    case 'borrador':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
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

function formatVigencia(valor: number | null | undefined, tipo: VigenciaTipo | null | undefined) {
  const safeValor = Number(valor || 0)
  const safeTipo = tipo || 'dias'

  if (!safeValor) return '—'

  if (safeValor === 1) {
    if (safeTipo === 'dias') return '1 día'
    if (safeTipo === 'semanas') return '1 semana'
    return '1 mes'
  }

  if (safeTipo === 'dias') return `${safeValor} días`
  if (safeTipo === 'semanas') return `${safeValor} semanas`
  return `${safeValor} meses`
}

function clampPercent(value: number) {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function round2(value: number) {
  return Number(value.toFixed(2))
}

export default function PlanesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [loading, setLoading] = useState(true)
  const [planes, setPlanes] = useState<Plan[]>([])
  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [error, setError] = useState('')

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)

  useEffect(() => {
    void loadPlanes()
  }, [])

  async function loadPlanes() {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('planes')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(error.message)
      }

      setPlanes((data || []) as Plan[])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudieron cargar los planes.')
      setPlanes([])
    } finally {
      setLoading(false)
    }
  }

  const planesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()

    return planes.filter((plan) => {
      const vigenciaTexto = formatVigencia(plan.vigencia_valor, plan.vigencia_tipo).toLowerCase()

      const matchSearch =
        !q ||
        plan.nombre.toLowerCase().includes(q) ||
        plan.descripcion?.toLowerCase().includes(q) ||
        plan.estado?.toLowerCase().includes(q) ||
        String(plan.sesiones_totales || '').includes(q) ||
        String(plan.vigencia_valor || '').includes(q) ||
        String(plan.vigencia_tipo || '').includes(q) ||
        vigenciaTexto.includes(q) ||
        String(plan.precio || '').includes(q) ||
        String(plan.comision_base || '').includes(q) ||
        String(plan.comision_rpm || '').includes(q) ||
        String(plan.comision_entrenador || '').includes(q)

      const matchEstado =
        estadoFiltro === 'todos' || plan.estado?.toLowerCase() === estadoFiltro.toLowerCase()

      return matchSearch && matchEstado
    })
  }, [planes, search, estadoFiltro])

  const stats = useMemo(() => {
    const total = planes.length
    const activos = planes.filter((p) => p.estado?.toLowerCase() === 'activo').length
    const inactivos = planes.filter((p) => p.estado?.toLowerCase() === 'inactivo').length
    const precioPromedio =
      total > 0
        ? planes.reduce((acc, plan) => acc + Number(plan.precio || 0), 0) / total
        : 0
    const sesionesPromedio =
      total > 0
        ? planes.reduce((acc, plan) => acc + Number(plan.sesiones_totales || 0), 0) / total
        : 0

    return {
      total,
      activos,
      inactivos,
      precioPromedio,
      sesionesPromedio,
    }
  }, [planes])

  const precioNum = Number(form.precio || 0)
  const comisionBaseNum = Number(form.comision_base || 0)
  const porcentajeRpm = clampPercent(Number(form.comision_rpm_pct || 0))
  const porcentajeEntrenador = clampPercent(Number(form.comision_entrenador_pct || 0))

  const comisionRpmNum = round2((comisionBaseNum * porcentajeRpm) / 100)
  const comisionEntrenadorNum = round2((comisionBaseNum * porcentajeEntrenador) / 100)
  const porcentajeTotal = round2(porcentajeRpm + porcentajeEntrenador)
  const porcentajeRestante = round2(Math.max(100 - porcentajeTotal, 0))
  const comisionRestante = round2(Math.max(comisionBaseNum - comisionRpmNum - comisionEntrenadorNum, 0))

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target

    if (name === 'precio') {
      setForm((prev) => ({
        ...prev,
        precio: value,
        comision_base: value,
      }))
      return
    }

    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleRpmPercentChange = (value: string) => {
    if (value === '') {
      setForm((prev) => ({
        ...prev,
        comision_rpm_pct: '',
        comision_entrenador_pct: '100',
      }))
      return
    }

    const rpmPct = clampPercent(Number(value))
    const entrenadorPct = round2(100 - rpmPct)

    setForm((prev) => ({
      ...prev,
      comision_rpm_pct: String(rpmPct),
      comision_entrenador_pct: String(entrenadorPct),
    }))
  }

  const handleEntrenadorPercentChange = (value: string) => {
    if (value === '') {
      setForm((prev) => ({
        ...prev,
        comision_entrenador_pct: '',
        comision_rpm_pct: '100',
      }))
      return
    }

    const entrenadorPct = clampPercent(Number(value))
    const rpmPct = round2(100 - entrenadorPct)

    setForm((prev) => ({
      ...prev,
      comision_entrenador_pct: String(entrenadorPct),
      comision_rpm_pct: String(rpmPct),
    }))
  }

  const validateForm = () => {
    if (!form.nombre.trim()) return 'El nombre es obligatorio.'
    if (!form.sesiones_totales || Number(form.sesiones_totales) <= 0) {
      return 'Las sesiones totales deben ser mayores que 0.'
    }
    if (!form.vigencia_valor || Number(form.vigencia_valor) <= 0) {
      return 'La vigencia debe ser mayor que 0.'
    }
    if (form.precio === '' || Number(form.precio) < 0) {
      return 'El precio no es válido.'
    }
    if (form.comision_base === '' || Number(form.comision_base) < 0) {
      return 'La base de comisión no es válida.'
    }
    if (Number(form.comision_rpm_pct || 0) < 0 || Number(form.comision_rpm_pct || 0) > 100) {
      return 'El porcentaje de RPM no es válido.'
    }
    if (Number(form.comision_entrenador_pct || 0) < 0 || Number(form.comision_entrenador_pct || 0) > 100) {
      return 'El porcentaje del entrenador no es válido.'
    }
    if (round2(Number(form.comision_rpm_pct || 0) + Number(form.comision_entrenador_pct || 0)) !== 100) {
      return 'RPM y entrenador deben sumar 100%.'
    }
    return ''
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)

    const base = Number(form.comision_base || 0)
    const rpmPct = clampPercent(Number(form.comision_rpm_pct || 0))
    const entrenadorPct = clampPercent(Number(form.comision_entrenador_pct || 0))

    const payload = {
      nombre: form.nombre.trim(),
      sesiones_totales: Number(form.sesiones_totales),
      vigencia_valor: Number(form.vigencia_valor),
      vigencia_tipo: form.vigencia_tipo,
      precio: Number(form.precio),
      comision_base: base,
      comision_rpm: round2((base * rpmPct) / 100),
      comision_entrenador: round2((base * entrenadorPct) / 100),
      estado: form.estado,
      descripcion: form.descripcion.trim() || null,
    }

    try {
      if (editingId) {
        const { error } = await supabase
          .from('planes')
          .update(payload)
          .eq('id', editingId)

        if (error) throw error
      } else {
        const { error } = await supabase.from('planes').insert(payload)
        if (error) throw error
      }

      await loadPlanes()
      resetForm()
      setViewMode('list')
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'No se pudo guardar el plan.')
    } finally {
      setSaving(false)
    }
  }

  function resetForm() {
    setForm(INITIAL_FORM)
    setEditingId(null)
    setSelectedPlan(null)
  }

  function handleCreate() {
    resetForm()
    setViewMode('create')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleEdit(plan: Plan) {
    const base = Number(plan.comision_base ?? plan.precio ?? 0)
    const rpm = Number(plan.comision_rpm ?? 0)
    const entrenador = Number(plan.comision_entrenador ?? 0)

    const rpmPct = base > 0 ? round2((rpm / base) * 100) : 50
    const entrenadorPct = base > 0 ? round2((entrenador / base) * 100) : 50

    setEditingId(plan.id)
    setForm({
      nombre: plan.nombre || '',
      sesiones_totales: String(plan.sesiones_totales ?? ''),
      vigencia_valor: String(plan.vigencia_valor ?? ''),
      vigencia_tipo: (plan.vigencia_tipo as VigenciaTipo) || 'dias',
      precio: String(plan.precio ?? ''),
      comision_base: String(plan.comision_base ?? plan.precio ?? ''),
      comision_rpm_pct: String(rpmPct),
      comision_entrenador_pct: String(entrenadorPct),
      estado: (plan.estado as 'activo' | 'inactivo') || 'activo',
      descripcion: plan.descripcion || '',
    })
    setViewMode('edit')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleViewDetail(plan: Plan) {
    setSelectedPlan(plan)
    setViewMode('detail')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancel() {
    resetForm()
    setViewMode('list')
  }

  async function handleDelete(plan: Plan) {
    const confirmed = window.confirm(
      `¿Estás seguro de eliminar el plan "${plan.nombre}"?\n\nEsta acción no se puede deshacer.`
    )

    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('planes')
        .delete()
        .eq('id', plan.id)

      if (error) throw error

      await loadPlanes()

      if (viewMode === 'detail' && selectedPlan?.id === plan.id) {
        setViewMode('list')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'No se pudo eliminar el plan.')
    }
  }

  if (viewMode === 'list') {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                Operaciones
              </p>
              <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-white">
                Planes
              </h1>
              <p className="mt-2 text-sm text-white/60">
                Catálogo de planes, sesiones, vigencia, precio y comisión.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCreate}
              className="
                flex items-center gap-2 rounded-2xl border border-white/10
                bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white
                transition-all hover:bg-white/[0.12] hover:border-white/20
              "
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo plan
            </button>
          </div>
        </div>

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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <StatCard title="Total" value={stats.total} />
          <StatCard title="Activos" value={stats.activos} color="text-emerald-400" />
          <StatCard title="Inactivos" value={stats.inactivos} color="text-white/60" />
          <StatCard title="Precio promedio" value={money(stats.precioPromedio)} />
          <StatCard title="Sesiones promedio" value={Math.round(stats.sesionesPromedio)} />
        </div>

        <Section
          title="Filtros"
          description="Busca por nombre, descripción, estado, vigencia, precio o comisión."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Field label="Buscar">
                <div className="relative">
                  <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar planes..."
                    className={`${inputClassName} pl-11`}
                  />
                </div>
              </Field>
            </div>

            <Field label="Estado">
              <select
                value={estadoFiltro}
                onChange={(e) => setEstadoFiltro(e.target.value)}
                className={inputClassName}
              >
                <option value="todos" className="bg-[#11131a] text-white">Todos</option>
                <option value="activo" className="bg-[#11131a] text-white">Activos</option>
                <option value="inactivo" className="bg-[#11131a] text-white">Inactivos</option>
                <option value="borrador" className="bg-[#11131a] text-white">Borrador</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section
          title="Listado de planes"
          description="Vista general del catálogo de planes."
          className="p-0"
          contentClassName="overflow-hidden"
        >
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <svg className="mx-auto h-8 w-8 animate-spin text-white/40" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="mt-3 text-sm text-white/55">Cargando planes...</p>
              </div>
            </div>
          ) : planesFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="mx-auto h-12 w-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="mt-4 font-medium text-white/75">No hay planes</p>
              <p className="mt-1 text-sm text-white/45">
                {search ? 'Intenta con otro término de búsqueda' : 'Comienza creando tu primer plan'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/40">Plan</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/40">Sesiones</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/40">Vigencia</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/40">Precio</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/40">Comisión</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-white/40">Estado</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-white/40">Acciones</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {planesFiltrados.map((plan) => {
                    const base = Number(plan.comision_base || 0)
                    const rpm = Number(plan.comision_rpm || 0)
                    const entrenador = Number(plan.comision_entrenador || 0)
                    const rpmPct = base > 0 ? round2((rpm / base) * 100) : 0
                    const entrenadorPct = base > 0 ? round2((entrenador / base) * 100) : 0

                    return (
                      <tr key={plan.id} className="transition hover:bg-white/[0.03]">
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-semibold text-white">{plan.nombre}</p>
                            <p className="mt-0.5 text-xs text-white/45 line-clamp-1">
                              {plan.descripcion || 'Sin descripción'}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span className="font-medium text-white">{plan.sesiones_totales || 0}</span>
                        </td>

                        <td className="px-4 py-4">
                          <span className="text-white/75">
                            {formatVigencia(plan.vigencia_valor, plan.vigencia_tipo)}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span className="font-semibold text-white">{money(plan.precio)}</span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <p className="text-xs text-white/45">Base: {money(plan.comision_base)}</p>
                            <p className="text-xs text-violet-300">
                              RPM: {money(plan.comision_rpm)} · {rpmPct}%
                            </p>
                            <p className="text-xs text-emerald-300">
                              Entrenador: {money(plan.comision_entrenador)} · {entrenadorPct}%
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${estadoBadge(plan.estado)}`}>
                            {plan.estado}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewDetail(plan)}
                              className="
                                rounded-xl border border-white/10 bg-white/[0.03]
                                px-3 py-2 text-xs font-medium text-white/80 transition
                                hover:bg-white/[0.08] hover:border-white/20
                              "
                            >
                              Ver
                            </button>

                            <button
                              type="button"
                              onClick={() => handleEdit(plan)}
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
                              onClick={() => handleDelete(plan)}
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
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    )
  }

  if (viewMode === 'create' || viewMode === 'edit') {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                Operaciones / Planes
              </p>
              <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-white">
                {viewMode === 'edit' ? 'Editar plan' : 'Nuevo plan'}
              </h1>
              <p className="mt-2 text-sm text-white/60">
                {viewMode === 'edit' ? 'Actualiza la configuración del plan.' : 'Crea un nuevo paquete de sesiones.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleCancel}
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
        </div>

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

        <Section
          title={viewMode === 'edit' ? 'Formulario de edición' : 'Formulario de creación'}
          description="Completa la información principal del plan."
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/40">
                Información básica
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Field label="Nombre del plan">
                    <input
                      name="nombre"
                      value={form.nombre}
                      onChange={handleChange}
                      placeholder="Ej: Recovery 10 sesiones"
                      className={inputClassName}
                      required
                    />
                  </Field>
                </div>

                <Field label="Sesiones totales">
                  <input
                    type="number"
                    name="sesiones_totales"
                    value={form.sesiones_totales}
                    onChange={handleChange}
                    min="1"
                    className={inputClassName}
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
                  <Field label="Vigencia">
                    <input
                      type="number"
                      name="vigencia_valor"
                      value={form.vigencia_valor}
                      onChange={handleChange}
                      min="1"
                      className={inputClassName}
                    />
                  </Field>

                  <Field label="Tipo de vigencia">
                    <select
                      name="vigencia_tipo"
                      value={form.vigencia_tipo}
                      onChange={handleChange}
                      className={inputClassName}
                    >
                      <option value="dias" className="bg-[#11131a] text-white">Días</option>
                      <option value="semanas" className="bg-[#11131a] text-white">Semanas</option>
                      <option value="meses" className="bg-[#11131a] text-white">Meses</option>
                    </select>
                  </Field>
                </div>

                <Field label="Precio (USD)" helper="Al cambiarlo, actualiza automáticamente la base de comisión.">
                  <input
                    type="number"
                    step="0.01"
                    name="precio"
                    value={form.precio}
                    onChange={handleChange}
                    min="0"
                    className={inputClassName}
                  />
                </Field>

                <Field label="Estado">
                  <select
                    name="estado"
                    value={form.estado}
                    onChange={handleChange}
                    className={inputClassName}
                  >
                    <option value="activo" className="bg-[#11131a] text-white">Activo</option>
                    <option value="inactivo" className="bg-[#11131a] text-white">Inactivo</option>
                  </select>
                </Field>
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white/40">
                Configuración de comisión
              </h3>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 md:p-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field
                    label="Base comisión"
                    helper="Se toma automáticamente del precio."
                  >
                    <input
                      type="number"
                      step="0.01"
                      name="comision_base"
                      value={form.comision_base}
                      readOnly
                      className={`${inputClassName} cursor-not-allowed opacity-80`}
                      placeholder="0.00"
                    />
                  </Field>

                  <Field
                    label="RPM recibe"
                    helper="Al editar, ajusta el del entrenador."
                  >
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        name="comision_rpm_pct"
                        value={form.comision_rpm_pct}
                        onChange={(e) => handleRpmPercentChange(e.target.value)}
                        min="0"
                        max="100"
                        className={`${inputClassName} pr-10`}
                        placeholder="0"
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/45">
                        %
                      </span>
                    </div>
                  </Field>

                  <Field
                    label="Entrenador recibe"
                    helper="Al editar, ajusta el de RPM."
                  >
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        name="comision_entrenador_pct"
                        value={form.comision_entrenador_pct}
                        onChange={(e) => handleEntrenadorPercentChange(e.target.value)}
                        min="0"
                        max="100"
                        className={`${inputClassName} pr-10`}
                        placeholder="0"
                      />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-white/45">
                        %
                      </span>
                    </div>
                  </Field>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5">
                    <p className="text-sm text-white/60">Base</p>
                    <p className="mt-2 text-3xl font-bold text-white">{money(comisionBaseNum)}</p>
                    <p className="mt-2 text-xs text-white/40">
                      Precio del plan: {money(precioNum)}
                    </p>
                  </div>

                  <div className="rounded-[28px] border border-violet-400/15 bg-white/[0.05] p-5">
                    <p className="text-sm text-white/60">RPM recibe</p>
                    <p className="mt-2 text-3xl font-bold text-violet-400">{money(comisionRpmNum)}</p>
                    <p className="mt-2 text-sm text-white/50">{porcentajeRpm}%</p>
                  </div>

                  <div className="rounded-[28px] border border-emerald-400/15 bg-white/[0.05] p-5">
                    <p className="text-sm text-white/60">Entrenador recibe</p>
                    <p className="mt-2 text-3xl font-bold text-emerald-400">{money(comisionEntrenadorNum)}</p>
                    <p className="mt-2 text-sm text-white/50">{porcentajeEntrenador}%</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/40">Resumen</p>
                    <p className="mt-1 text-sm text-white/70">
                      RPM y entrenador deben sumar 100% del total de comisión.
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/40">Restante</p>
                    <p className="text-sm font-semibold text-white">
                      {porcentajeRestante}% · {money(comisionRestante)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <Field label="Descripción">
                <textarea
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Descripción interna del plan"
                  className={`${inputClassName} resize-none`}
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-white/10 pt-6">
              <button
                type="submit"
                disabled={saving}
                className="
                  flex items-center gap-2 rounded-2xl border border-white/10
                  bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white
                  transition-all hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-60
                "
              >
                {saving ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {viewMode === 'edit' ? 'Guardando cambios...' : 'Guardando...'}
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {viewMode === 'edit' ? 'Guardar cambios' : 'Crear plan'}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCancel}
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
      </div>
    )
  }

  if (viewMode === 'detail' && selectedPlan) {
    const base = Number(selectedPlan.comision_base || 0)
    const rpm = Number(selectedPlan.comision_rpm || 0)
    const entrenador = Number(selectedPlan.comision_entrenador || 0)
    const rpmPct = base > 0 ? round2((rpm / base) * 100) : 0
    const entrenadorPct = base > 0 ? round2((entrenador / base) * 100) : 0

    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-white/40">
                Operaciones / Planes
              </p>
              <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-white">
                {selectedPlan.nombre}
              </h1>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleEdit(selectedPlan)}
                className="
                  flex items-center gap-2 rounded-2xl border border-white/10
                  bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white
                  transition-all hover:bg-white/[0.12] hover:border-white/20
                "
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar
              </button>

              <button
                type="button"
                onClick={() => handleDelete(selectedPlan)}
                className="
                  flex items-center gap-2 rounded-2xl border border-rose-400/20
                  bg-rose-400/10 px-5 py-3 text-sm font-semibold text-rose-300
                  transition-all hover:bg-rose-400/20 hover:border-rose-400/30
                "
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Eliminar
              </button>

              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="
                  flex items-center gap-2 rounded-2xl border border-white/10
                  bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80
                  transition-all hover:bg-white/[0.06]
                "
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Volver
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="Sesiones" value={selectedPlan.sesiones_totales || 0} />
          <StatCard title="Vigencia" value={formatVigencia(selectedPlan.vigencia_valor, selectedPlan.vigencia_tipo)} />
          <StatCard title="Precio" value={money(selectedPlan.precio)} color="text-emerald-400" />
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-medium text-white/55">Estado</p>
            <div className="mt-2">
              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${estadoBadge(selectedPlan.estado)}`}>
                {selectedPlan.estado}
              </span>
            </div>
          </div>
        </div>

        <Section title="Comisión" description="Distribución configurada para este plan.">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <p className="text-sm text-white/55">Base</p>
              <p className="mt-2 text-3xl font-bold text-white">{money(selectedPlan.comision_base)}</p>
            </Card>

            <Card className="p-5">
              <p className="text-sm text-white/55">RPM recibe</p>
              <p className="mt-2 text-3xl font-bold text-violet-400">{money(selectedPlan.comision_rpm)}</p>
              <p className="mt-2 text-sm text-white/45">{rpmPct}% de la base</p>
            </Card>

            <Card className="p-5">
              <p className="text-sm text-white/55">Entrenador recibe</p>
              <p className="mt-2 text-3xl font-bold text-emerald-400">{money(selectedPlan.comision_entrenador)}</p>
              <p className="mt-2 text-sm text-white/45">{entrenadorPct}% de la base</p>
            </Card>
          </div>
        </Section>

        <Section title="Descripción" description="Detalle general del plan.">
          <Card className="p-5">
            <p className="whitespace-pre-wrap text-white/75">
              {selectedPlan.descripcion || 'Sin descripción'}
            </p>
          </Card>
        </Section>

        <Section title="Información adicional" description="Datos de creación del registro.">
          <Card className="p-4">
            <p className="text-xs text-white/45">Fecha de creación</p>
            <div className="mt-1 font-medium text-white">{formatDate(selectedPlan.created_at)}</div>
          </Card>
        </Section>
      </div>
    )
  }

  return null
}