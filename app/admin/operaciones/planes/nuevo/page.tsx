'use client'

import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
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

export default function NuevoPlanPage() {
  const router = useRouter()

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

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

    const { error } = await supabase.from('planes').insert(payload)

    setSaving(false)

    if (error) {
      console.error('Error creando plan:', error.message)
      setErrorMsg(error.message || 'No se pudo crear el plan.')
      return
    }

    router.push('/admin/operaciones/planes')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Operaciones</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Nuevo plan
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Crea un nuevo paquete de sesiones.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            title="Ver planes"
            description="Ir al listado general de planes."
            href="/admin/operaciones/planes"
          />
          <ActionCard
            title="Cancelar"
            description="Salir sin guardar cambios."
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
        title="Formulario de creación"
        description="Completa la información principal del plan."
      >
        <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Nombre del plan">
              <input
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Ej: Recovery 10 sesiones"
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
                placeholder="Descripción interna del plan"
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
                hover:bg-white/[0.12]
                disabled:cursor-not-allowed disabled:opacity-60
              "
            >
              {saving ? 'Guardando...' : 'Guardar plan'}
            </button>

            <button
              type="button"
              onClick={() => router.push('/admin/operaciones/planes')}
              disabled={saving}
              className="
                rounded-2xl border border-white/10 bg-white/[0.03]
                px-5 py-3 text-sm font-semibold text-white/80 transition
                hover:bg-white/[0.06]
                disabled:cursor-not-allowed disabled:opacity-60
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