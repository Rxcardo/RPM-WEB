'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type FormState = {
  nombre: string
  sesiones_totales: string
  vigencia_dias: string
  precio: string
  estado: 'activo' | 'inactivo'
  descripcion: string
}

const INITIAL_FORM: FormState = {
  nombre: '',
  sesiones_totales: '',
  vigencia_dias: '',
  precio: '',
  estado: 'activo',
  descripcion: '',
}

export default function EditarPlanPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!id) return

    const fetchPlan = async () => {
      setLoading(true)
      setErrorMsg('')

      const { data, error } = await supabase
        .from('planes')
        .select('id, nombre, sesiones_totales, vigencia_dias, precio, estado, descripcion')
        .eq('id', id)
        .single()

      if (error || !data) {
        console.error('Error cargando plan:', error?.message)
        setErrorMsg('No se pudo cargar el plan.')
        setLoading(false)
        return
      }

      setForm({
        nombre: data.nombre || '',
        sesiones_totales: String(data.sesiones_totales ?? ''),
        vigencia_dias: String(data.vigencia_dias ?? ''),
        precio: String(data.precio ?? ''),
        estado: data.estado || 'activo',
        descripcion: data.descripcion || '',
      })

      setLoading(false)
    }

    fetchPlan()
  }, [id])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const validateForm = () => {
    if (!form.nombre.trim()) return 'El nombre es obligatorio.'
    if (!form.sesiones_totales || Number(form.sesiones_totales) <= 0) {
      return 'Las sesiones totales deben ser mayores que 0.'
    }
    if (!form.vigencia_dias || Number(form.vigencia_dias) <= 0) {
      return 'La vigencia debe ser mayor que 0.'
    }
    if (form.precio === '' || Number(form.precio) < 0) {
      return 'El precio no es válido.'
    }
    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    const validationError = validateForm()
    if (validationError) {
      setErrorMsg(validationError)
      return
    }

    setSaving(true)

    const payload = {
      nombre: form.nombre.trim(),
      sesiones_totales: Number(form.sesiones_totales),
      vigencia_dias: Number(form.vigencia_dias),
      precio: Number(form.precio),
      estado: form.estado,
      descripcion: form.descripcion.trim() || null,
    }

    const { error } = await supabase
      .from('planes')
      .update(payload)
      .eq('id', id)

    setSaving(false)

    if (error) {
      console.error('Error actualizando plan:', error.message)
      setErrorMsg(error.message || 'No se pudo actualizar el plan.')
      return
    }

    router.push('/admin/operaciones/planes')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Editar plan</h1>
          <p className="mt-1 text-neutral-500">Cargando información...</p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-500">Cargando plan...</p>
        </div>
      </div>
    )
  }

  if (errorMsg && !form.nombre) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Editar plan</h1>
          <p className="mt-1 text-neutral-500">No fue posible abrir el registro.</p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <p className="text-sm font-medium text-red-700">{errorMsg}</p>

          <button
            onClick={() => router.push('/admin/planes')}
            className="mt-4 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            Volver a planes
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Editar plan</h1>
          <p className="mt-1 text-neutral-500">
            Actualiza la configuración del plan
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push('/admin/planes')}
          className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
        >
          Volver
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Nombre del plan
            </label>
            <input
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Sesiones totales
            </label>
            <input
              type="number"
              name="sesiones_totales"
              value={form.sesiones_totales}
              onChange={handleChange}
              min="1"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Vigencia en días
            </label>
            <input
              type="number"
              name="vigencia_dias"
              value={form.vigencia_dias}
              onChange={handleChange}
              min="1"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Precio
            </label>
            <input
              type="number"
              step="0.01"
              name="precio"
              value={form.precio}
              onChange={handleChange}
              min="0"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Estado
            </label>
            <select
              name="estado"
              value={form.estado}
              onChange={handleChange}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
            >
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Descripción
            </label>
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              rows={5}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
            />
          </div>
        </div>

        {errorMsg ? (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando cambios...' : 'Guardar cambios'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/admin/planes')}
            disabled={saving}
            className="rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}