'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

type FormState = {
  nombre: string
  email: string
  telefono: string
  rol: string
  estado: string
}

const INITIAL_FORM: FormState = {
  nombre: '',
  email: '',
  telefono: '',
  rol: 'terapeuta',
  estado: 'activo',
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

export default function EditarPersonalPage() {
  const router = useRouter()
  const params = useParams()

  const id =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
      ? params.id[0]
      : ''

  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bootError, setBootError] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [form, setForm] = useState<FormState>(INITIAL_FORM)

  useEffect(() => {
    if (!id) {
      setBootError('No se recibió un identificador válido.')
      setLoadingData(false)
      return
    }

    void loadPersonal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadPersonal() {
    setLoadingData(true)
    setBootError('')
    setErrorMsg('')

    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('id', id)
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      console.error(error)
      setBootError(error?.message || 'No se pudo cargar el personal.')
      setLoadingData(false)
      return
    }

    setForm({
      nombre: data.nombre || '',
      email: data.email || '',
      telefono: data.telefono || '',
      rol: data.rol || 'terapeuta',
      estado: data.estado || 'activo',
    })

    setLoadingData(false)
  }

  async function guardarCambios() {
    setErrorMsg('')

    if (!form.nombre.trim()) {
      setErrorMsg('El nombre es obligatorio.')
      return
    }

    setSaving(true)

    const payload = {
      nombre: form.nombre.trim(),
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      rol: form.rol,
      estado: form.estado,
    }

    const { error } = await supabase.from('empleados').update(payload).eq('id', id)

    if (error) {
      console.error(error)
      setErrorMsg(error.message || 'No se pudo actualizar el personal.')
      setSaving(false)
      return
    }

    router.push(`/admin/personas/personal/${id}`)
  }

  if (loadingData) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-white/55">Personas</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Editar personal</h1>
          <p className="mt-2 text-sm text-white/55">Cargando información...</p>
        </div>

        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando personal...</p>
        </Card>
      </div>
    )
  }

  if (bootError) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-white/55">Personas</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Editar personal</h1>
          <p className="mt-2 text-sm text-white/55">No fue posible abrir el registro.</p>
        </div>

        <Card className="p-6">
          <p className="text-sm font-medium text-rose-400">{bootError}</p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin/personas/personal')}
              className="
                rounded-2xl border border-white/10 bg-white/[0.08]
                px-4 py-3 text-sm font-semibold text-white transition
                hover:bg-white/[0.12]
              "
            >
              Volver a personal
            </button>

            <button
              type="button"
              onClick={() => void loadPersonal()}
              className="
                rounded-2xl border border-rose-400/20 bg-rose-400/10
                px-4 py-3 text-sm font-semibold text-rose-300 transition
                hover:bg-rose-400/15
              "
            >
              Reintentar
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Personas</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Editar personal
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Actualiza la información del miembro del equipo.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <ActionCard
            title="Cancelar"
            description="Volver al detalle del personal."
            href={`/admin/personas/personal/${id}`}
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
        description="Modifica nombre, contacto, rol y estado."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre">
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Nombre completo"
              className={inputClassName}
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="correo@ejemplo.com"
              className={inputClassName}
            />
          </Field>

          <Field label="Teléfono">
            <input
              type="text"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              placeholder="809..."
              className={inputClassName}
            />
          </Field>

          <Field label="Rol">
            <select
              value={form.rol}
              onChange={(e) => setForm({ ...form, rol: e.target.value })}
              className={inputClassName}
            >
              <option value="terapeuta" className="bg-[#11131a] text-white">
                Terapeuta
              </option>
              <option value="entrenador" className="bg-[#11131a] text-white">
                Entrenador
              </option>
              <option value="recepcion" className="bg-[#11131a] text-white">
                Recepción
              </option>
              <option value="admin" className="bg-[#11131a] text-white">
                Admin
              </option>
            </select>
          </Field>

          <Field label="Estado">
            <select
              value={form.estado}
              onChange={(e) => setForm({ ...form, estado: e.target.value })}
              className={inputClassName}
            >
              <option value="activo" className="bg-[#11131a] text-white">
                Activo
              </option>
              <option value="inactivo" className="bg-[#11131a] text-white">
                Inactivo
              </option>
              <option value="vacaciones" className="bg-[#11131a] text-white">
                Vacaciones
              </option>
            </select>
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={guardarCambios}
            disabled={saving}
            className="
              rounded-2xl border border-white/10 bg-white/[0.08]
              px-5 py-3 text-sm font-semibold text-white transition
              hover:bg-white/[0.12] disabled:opacity-60
            "
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>

          <button
            type="button"
            onClick={() => router.push(`/admin/personas/personal/${id}`)}
            className="
              rounded-2xl border border-white/10 bg-white/[0.03]
              px-5 py-3 text-sm font-semibold text-white/80 transition
              hover:bg-white/[0.06]
            "
          >
            Cancelar
          </button>
        </div>
      </Section>
    </div>
  )
}