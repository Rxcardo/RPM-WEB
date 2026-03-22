'use client'

export const dynamic = 'force-dynamic'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

type RecursoForm = {
  nombre: string
  tipo: string
  capacidad: number
  descripcion: string
  estado: string
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

export default function NuevoRecursoPage() {
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState<RecursoForm>({
    nombre: '',
    tipo: '',
    capacidad: 1,
    descripcion: '',
    estado: 'activo',
  })

  async function crear() {
    if (!form.nombre.trim()) {
      alert('Nombre requerido')
      return
    }

    try {
      setSaving(true)
      setError('')

      const payload = {
        nombre: form.nombre.trim(),
        tipo: form.tipo || null,
        capacidad: Number(form.capacidad || 0),
        descripcion: form.descripcion.trim() || null,
        estado: form.estado || 'activo',
      }

      const { error } = await supabase.from('recursos').insert(payload)

      if (error) throw error

      router.push('/admin/operaciones/recursos')
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo crear el recurso.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Operaciones</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Nuevo recurso
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Crear un nuevo espacio o recurso del sistema.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            title="Ver recursos"
            description="Ir al listado general."
            href="/admin/operaciones/recursos"
          />
          <ActionCard
            title="Cancelar"
            description="Salir sin guardar cambios."
            href="/admin/operaciones/recursos"
          />
        </div>
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      <Section
        title="Formulario de creación"
        description="Completa nombre, tipo, capacidad, descripción y estado."
      >
        <div className="grid max-w-3xl gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Nombre">
              <input
                value={form.nombre}
                className={inputClassName}
                onChange={(e) =>
                  setForm({
                    ...form,
                    nombre: e.target.value,
                  })
                }
                placeholder="Ej: Sala 1"
              />
            </Field>
          </div>

          <Field label="Tipo">
            <select
              value={form.tipo}
              className={inputClassName}
              onChange={(e) =>
                setForm({
                  ...form,
                  tipo: e.target.value,
                })
              }
            >
              <option value="" className="bg-[#11131a] text-white">
                Seleccionar tipo
              </option>
              <option value="therapy" className="bg-[#11131a] text-white">
                Terapia
              </option>
              <option value="recovery" className="bg-[#11131a] text-white">
                Recovery
              </option>
              <option value="training" className="bg-[#11131a] text-white">
                Entrenamiento
              </option>
              <option value="evaluation" className="bg-[#11131a] text-white">
                Evaluación
              </option>
              <option value="other" className="bg-[#11131a] text-white">
                Otro
              </option>
            </select>
          </Field>

          <Field label="Capacidad" helper="Cantidad máxima de personas o uso simultáneo.">
            <input
              type="number"
              min="1"
              value={form.capacidad}
              className={inputClassName}
              onChange={(e) =>
                setForm({
                  ...form,
                  capacidad: Number(e.target.value),
                })
              }
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="Descripción">
              <textarea
                value={form.descripcion}
                className={`${inputClassName} min-h-[120px] resize-none`}
                onChange={(e) =>
                  setForm({
                    ...form,
                    descripcion: e.target.value,
                  })
                }
                placeholder="Describe el recurso"
              />
            </Field>
          </div>

          <Field label="Estado">
            <select
              value={form.estado}
              className={inputClassName}
              onChange={(e) =>
                setForm({
                  ...form,
                  estado: e.target.value,
                })
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

          <div className="md:col-span-2 flex gap-3 pt-3">
            <button
              type="button"
              onClick={crear}
              disabled={saving}
              className="
                rounded-2xl border border-white/10 bg-white/[0.08]
                px-5 py-3 text-sm font-semibold text-white transition
                hover:bg-white/[0.12] disabled:opacity-60
              "
            >
              {saving ? 'Guardando...' : 'Crear recurso'}
            </button>

            <button
              type="button"
              onClick={() => router.push('/admin/operaciones/recursos')}
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
      </Section>
    </div>
  )
}