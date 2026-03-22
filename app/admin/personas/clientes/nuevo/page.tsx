'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

type Terapeuta = {
  id: string
  nombre: string
  rol: string
  estado: string
}

type FormState = {
  nombre: string
  telefono: string
  email: string
  fecha_nacimiento: string
  genero: string
  direccion: string
  terapeuta_id: string
  estado: 'activo' | 'inactivo' | 'pausado'
  notas: string
}

const INITIAL_FORM: FormState = {
  nombre: '',
  telefono: '',
  email: '',
  fecha_nacimiento: '',
  genero: '',
  direccion: '',
  terapeuta_id: '',
  estado: 'activo',
  notas: '',
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

export default function NuevoClientePage() {
  const router = useRouter()

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([])
  const [loadingTerapeutas, setLoadingTerapeutas] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [createdClienteId, setCreatedClienteId] = useState<string | null>(null)
  const [createdClienteNombre, setCreatedClienteNombre] = useState<string>('')

  useEffect(() => {
    const fetchTerapeutas = async () => {
      setLoadingTerapeutas(true)

      const { data, error } = await supabase
        .from('empleados')
        .select('id, nombre, rol, estado')
        .eq('rol', 'terapeuta')
        .eq('estado', 'activo')
        .order('nombre', { ascending: true })

      if (error) {
        console.error('Error cargando terapeutas:', error.message)
        setTerapeutas([])
      } else {
        setTerapeutas((data as Terapeuta[]) || [])
      }

      setLoadingTerapeutas(false)
    }

    void fetchTerapeutas()
  }, [])

  const terapeutasOptions = useMemo(() => terapeutas || [], [terapeutas])

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const validateForm = () => {
    if (!form.nombre.trim()) {
      return 'El nombre es obligatorio.'
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return 'El correo no tiene un formato válido.'
    }

    return ''
  }

  const buildPayload = () => {
    return {
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim() || null,
      email: form.email.trim() || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      genero: form.genero || null,
      direccion: form.direccion.trim() || null,
      terapeuta_id: form.terapeuta_id || null,
      estado: form.estado,
      notas: form.notas.trim() || null,
    }
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

    const payload = buildPayload()

    const { data, error } = await supabase
      .from('clientes')
      .insert(payload)
      .select('id, nombre')
      .single()

    setSaving(false)

    if (error) {
      console.error('Error guardando cliente:', error.message)
      setErrorMsg(error.message || 'No se pudo guardar el cliente.')
      return
    }

    setCreatedClienteId(data.id)
    setCreatedClienteNombre(data.nombre || form.nombre.trim())
    setForm(INITIAL_FORM)
    setErrorMsg('')
  }

  const handleCancel = () => {
    router.push('/admin/personas/clientes')
  }

  const handleReset = () => {
    setForm(INITIAL_FORM)
    setErrorMsg('')
    setCreatedClienteId(null)
    setCreatedClienteNombre('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Clientes</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Nuevo cliente
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Crea un nuevo registro operativo dentro de RPM.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <ActionCard
            title="Volver"
            description="Regresar al listado de clientes."
            href="/admin/personas/clientes"
          />
        </div>
      </div>

      {createdClienteId ? (
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-emerald-400">
            Cliente creado correctamente
          </h2>

          <p className="mt-2 text-sm text-white/55">
            {createdClienteNombre} ya fue registrado. Ahora puedes seguir con el flujo.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ActionCard
              title="Ver cliente"
              description="Abrir el detalle del cliente."
              href={`/admin/personas/clientes/${createdClienteId}`}
            />

            <ActionCard
              title="Asignar plan"
              description="Continuar con la asignación del plan."
              href={`/admin/personas/clientes/${createdClienteId}/plan`}
            />

            <ActionCard
              title="Crear cita"
              description="Agendar una cita para este cliente."
              href={`/admin/operaciones/agenda/nueva?cliente=${createdClienteId}`}
            />

            <div>
              <button
                type="button"
                onClick={() => {
                  setCreatedClienteId(null)
                  setCreatedClienteNombre('')
                }}
                className="
                  w-full rounded-3xl border border-white/10 bg-white/[0.03]
                  p-5 text-left transition hover:bg-white/[0.06]
                "
              >
                <p className="font-medium text-white">Crear otro cliente</p>
                <p className="mt-1 text-sm text-white/55">
                  Limpiar mensaje y registrar uno nuevo.
                </p>
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      <Section
        title="Formulario de cliente"
        description="Completa la información básica, asignación y notas internas."
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Nombre completo *">
                <input
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  placeholder="Ej: Juan Pérez"
                  className={inputClassName}
                  required
                />
              </Field>
            </div>

            <Field label="Teléfono">
              <input
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                placeholder="Ej: +58 412 000 0000"
                className={inputClassName}
              />
            </Field>

            <Field label="Correo">
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="ejemplo@correo.com"
                className={inputClassName}
              />
            </Field>

            <Field label="Fecha de nacimiento">
              <input
                type="date"
                name="fecha_nacimiento"
                value={form.fecha_nacimiento}
                onChange={handleChange}
                className={inputClassName}
              />
            </Field>

            <Field label="Género">
              <select
                name="genero"
                value={form.genero}
                onChange={handleChange}
                className={inputClassName}
              >
                <option value="" className="bg-[#11131a] text-white">
                  Seleccionar
                </option>
                <option value="masculino" className="bg-[#11131a] text-white">
                  Masculino
                </option>
                <option value="femenino" className="bg-[#11131a] text-white">
                  Femenino
                </option>
                <option value="otro" className="bg-[#11131a] text-white">
                  Otro
                </option>
                <option value="prefiero_no_decir" className="bg-[#11131a] text-white">
                  Prefiero no decir
                </option>
              </select>
            </Field>

            <div className="md:col-span-2">
              <Field label="Dirección">
                <input
                  name="direccion"
                  value={form.direccion}
                  onChange={handleChange}
                  placeholder="Dirección del cliente"
                  className={inputClassName}
                />
              </Field>
            </div>

            <Field label="Terapeuta asignado">
              <select
                name="terapeuta_id"
                value={form.terapeuta_id}
                onChange={handleChange}
                className={inputClassName}
                disabled={loadingTerapeutas}
              >
                <option value="" className="bg-[#11131a] text-white">
                  {loadingTerapeutas ? 'Cargando terapeutas...' : 'Sin asignar'}
                </option>

                {terapeutasOptions.map((terapeuta) => (
                  <option
                    key={terapeuta.id}
                    value={terapeuta.id}
                    className="bg-[#11131a] text-white"
                  >
                    {terapeuta.nombre}
                  </option>
                ))}
              </select>
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
                <option value="pausado" className="bg-[#11131a] text-white">
                  Pausado
                </option>
                <option value="inactivo" className="bg-[#11131a] text-white">
                  Inactivo
                </option>
              </select>
            </Field>

            <div className="md:col-span-2">
              <Field label="Notas">
                <textarea
                  name="notas"
                  value={form.notas}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Notas internas del cliente"
                  className={`${inputClassName} resize-none`}
                />
              </Field>
            </div>
          </div>

          {errorMsg ? (
            <Card className="p-4">
              <p className="text-sm text-rose-400">{errorMsg}</p>
            </Card>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={saving}
              className="
                rounded-2xl border border-white/10 bg-white/[0.08]
                px-5 py-3 text-sm font-semibold text-white transition
                hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-60
              "
            >
              {saving ? 'Guardando...' : 'Guardar cliente'}
            </button>

            <button
              type="button"
              onClick={handleReset}
              disabled={saving}
              className="
                rounded-2xl border border-white/10 bg-white/[0.03]
                px-5 py-3 text-sm font-semibold text-white/80 transition
                hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60
              "
            >
              Limpiar formulario
            </button>

            <button
              type="button"
              onClick={handleCancel}
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