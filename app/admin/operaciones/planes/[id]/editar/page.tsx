'use client'

import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

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

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

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

    void fetchPlan()
  }, [id])

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
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

  const handleSubmit = async (e: FormEvent) => {
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
          <p className="text-sm text-white/55">Operaciones / Planes</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Editar plan</h1>
          <p className="mt-2 text-white/55">Cargando información...</p>
        </div>

        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando plan...</p>
        </Card>
      </div>
    )
  }

  if (errorMsg && !form.nombre) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-white/55">Operaciones / Planes</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Editar plan</h1>
          <p className="mt-2 text-white/55">No fue posible abrir el registro.</p>
        </div>

        <Card className="p-6">
          <p className="text-sm font-medium text-rose-400">{errorMsg}</p>

          <button
            type="button"
            onClick={() => router.push('/admin/operaciones/planes')}
            className="
              mt-4 rounded-2xl border border-white/10 bg-white/[0.08]
              px-4 py-3 text-sm font-semibold text-white transition
              hover:bg-white/[0.12]
            "
          >
            Volver a planes
          </button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Operaciones / Planes</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Editar plan
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Actualiza la configuración del plan.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            title="Ver plan"
            description="Abrir el detalle del plan."
            href={`/admin/operaciones/planes/${id}`}
          />
          <ActionCard
            title="Volver"
            description="Regresar al listado de planes."
            href="/admin/operaciones/planes"
          />
        </div>
      </div>

      {errorMsg ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{errorMsg}</p>
        </Card>
      ) : null}

      <Section
        title="Formulario de edición"
        description="Actualiza nombre, sesiones, vigencia, precio, estado y descripción."
      >
        <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Nombre del plan">
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                className={inputClassName}
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

          <Field label="Vigencia en días">
            <input
              type="number"
              name="vigencia_dias"
              value={form.vigencia_dias}
              onChange={handleChange}
              min="1"
              className={inputClassName}
            />
          </Field>

          <Field label="Precio">
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
              <option value="activo" className="bg-[#11131a] text-white">
                Activo
              </option>
              <option value="inactivo" className="bg-[#11131a] text-white">
                Inactivo
              </option>
            </select>
          </Field>

          <div className="md:col-span-2">
            <Field label="Descripción">
              <textarea
                name="descripcion"
                value={form.descripcion}
                onChange={handleChange}
                rows={5}
                className={`${inputClassName} resize-none`}
              />
            </Field>
          </div>

          <div className="md:col-span-2 flex flex-col gap-3 pt-2 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="
                rounded-2xl border border-white/10 bg-white/[0.08]
                px-5 py-3 text-sm font-semibold text-white transition
                hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-60
              "
            >
              {saving ? 'Guardando cambios...' : 'Guardar cambios'}
            </button>

            <button
              type="button"
              onClick={() => router.push('/admin/operaciones/planes')}
              disabled={saving}
              className="
                rounded-2xl border border-white/10 bg-white/[0.03]
                px-5 py-3 text-sm font-semibold text-white/80 transition
                hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60
              "
            >
              Cancelar
            </button>
          </div>
        </form>
      </Section>
    </div>
  )
}