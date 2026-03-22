'use client'

export const dynamic = 'force-dynamic'

import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

type ClienteDB = {
  id: string
  nombre: string | null
  telefono: string | null
  email: string | null
  genero: string | null
  direccion: string | null
  fecha_nacimiento: string | null
  estado: string | null
  notas: string | null
  terapeuta_id: string | null
}

type Empleado = {
  id: string
  nombre: string
  rol: string
  estado: string
}

type FormState = {
  nombre: string
  telefono: string
  email: string
  genero: string
  direccion: string
  fecha_nacimiento: string
  estado: string
  notas: string
  terapeuta_id: string
}

const INITIAL_FORM: FormState = {
  nombre: '',
  telefono: '',
  email: '',
  genero: '',
  direccion: '',
  fecha_nacimiento: '',
  estado: 'activo',
  notas: '',
  terapeuta_id: '',
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

function isUUID(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
}

export default function EditarClientePage() {
  const params = useParams()
  const router = useRouter()

  const rawId = params?.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId ?? ''

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [terapeutas, setTerapeutas] = useState<Empleado[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [bootError, setBootError] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!id) {
      setBootError('No se recibió un identificador de cliente válido.')
      setLoading(false)
      return
    }

    if (!isUUID(id)) {
      setBootError('El identificador del cliente no es válido.')
      setLoading(false)
      return
    }

    void fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function fetchAll() {
    setLoading(true)
    setBootError('')
    setErrorMsg('')

    try {
      const [clienteRes, terapeutasRes] = await Promise.all([
        supabase
          .from('clientes')
          .select(`
            id,
            nombre,
            telefono,
            email,
            genero,
            direccion,
            fecha_nacimiento,
            estado,
            notas,
            terapeuta_id
          `)
          .eq('id', id)
          .limit(1)
          .maybeSingle(),

        supabase
          .from('empleados')
          .select('id, nombre, rol, estado')
          .eq('rol', 'terapeuta')
          .eq('estado', 'activo')
          .order('nombre', { ascending: true }),
      ])

      if (clienteRes.error) {
        throw new Error(clienteRes.error.message || 'No se pudo cargar el cliente.')
      }

      if (!clienteRes.data) {
        throw new Error('No se encontró el cliente.')
      }

      if (terapeutasRes.error) {
        throw new Error(terapeutasRes.error.message || 'No se pudieron cargar los terapeutas.')
      }

      const cliente = clienteRes.data as ClienteDB

      setTerapeutas((terapeutasRes.data || []) as Empleado[])

      setForm({
        nombre: cliente.nombre || '',
        telefono: cliente.telefono || '',
        email: cliente.email || '',
        genero: cliente.genero || '',
        direccion: cliente.direccion || '',
        fecha_nacimiento: cliente.fecha_nacimiento || '',
        estado: cliente.estado || 'activo',
        notas: cliente.notas || '',
        terapeuta_id: cliente.terapeuta_id || '',
      })
    } catch (err: any) {
      console.error('Error al cargar edición de cliente:', err)
      setBootError(err?.message || 'No se pudo cargar el cliente.')
    } finally {
      setLoading(false)
    }
  }

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    const { name, value } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  function validateForm() {
    if (!form.nombre.trim()) return 'Debes indicar el nombre del cliente.'
    return ''
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMsg('')

    const validationError = validateForm()
    if (validationError) {
      setErrorMsg(validationError)
      return
    }

    setSaving(true)

    try {
      const payload = {
        nombre: form.nombre.trim(),
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        genero: form.genero || null,
        direccion: form.direccion.trim() || null,
        fecha_nacimiento: form.fecha_nacimiento || null,
        estado: form.estado || 'activo',
        notas: form.notas.trim() || null,
        terapeuta_id: form.terapeuta_id || null,
      }

      const { error } = await supabase
        .from('clientes')
        .update(payload)
        .eq('id', id)

      if (error) {
        throw new Error(error.message || 'No se pudo actualizar el cliente.')
      }

      router.push(`/admin/personas/clientes/${id}`)
      router.refresh()
    } catch (err: any) {
      console.error('Error al actualizar cliente:', err)
      setErrorMsg(err?.message || 'No se pudo actualizar el cliente.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-white/55">Clientes</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Editar cliente</h1>
          <p className="mt-2 text-white/55">Cargando información...</p>
        </div>

        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando formulario...</p>
        </Card>
      </div>
    )
  }

  if (bootError) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-white/55">Clientes</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Editar cliente</h1>
          <p className="mt-2 text-white/55">No fue posible abrir el registro.</p>
        </div>

        <Card className="p-6">
          <p className="text-sm font-medium text-rose-400">{bootError}</p>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => router.push('/admin/personas/clientes')}
              className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
            >
              Volver a clientes
            </button>

            <button
              type="button"
              onClick={() => void fetchAll()}
              className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-400/15"
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
          <p className="text-sm text-white/55">Clientes</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Editar cliente
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Actualiza los datos personales y de contacto del cliente.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <ActionCard
            title="Volver"
            description="Regresar al detalle del cliente."
            href={`/admin/personas/clientes/${id}`}
          />
        </div>
      </div>

      <Section
        title="Formulario de edición"
        description="Actualiza los datos principales del cliente."
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <Field label="Nombre">
                <input
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleChange}
                  placeholder="Nombre completo"
                  className={inputClassName}
                />
              </Field>
            </div>

            <Field label="Teléfono">
              <input
                type="text"
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                placeholder="Teléfono"
                className={inputClassName}
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Correo electrónico"
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
                  Seleccionar género
                </option>
                <option value="femenino" className="bg-[#11131a] text-white">
                  Femenino
                </option>
                <option value="masculino" className="bg-[#11131a] text-white">
                  Masculino
                </option>
                <option value="otro" className="bg-[#11131a] text-white">
                  Otro
                </option>
              </select>
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
                <option value="pausado" className="bg-[#11131a] text-white">
                  Pausado
                </option>
              </select>
            </Field>

            <Field label="Terapeuta asignado">
              <select
                name="terapeuta_id"
                value={form.terapeuta_id}
                onChange={handleChange}
                className={inputClassName}
              >
                <option value="" className="bg-[#11131a] text-white">
                  Sin asignar
                </option>
                {terapeutas.map((terapeuta) => (
                  <option key={terapeuta.id} value={terapeuta.id} className="bg-[#11131a] text-white">
                    {terapeuta.nombre}
                  </option>
                ))}
              </select>
            </Field>

            <div className="md:col-span-2">
              <Field label="Dirección">
                <textarea
                  name="direccion"
                  value={form.direccion}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Dirección"
                  className={`${inputClassName} resize-none`}
                />
              </Field>
            </div>

            <div className="md:col-span-2">
              <Field label="Notas">
                <textarea
                  name="notas"
                  value={form.notas}
                  onChange={handleChange}
                  rows={5}
                  placeholder="Notas del cliente"
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
              className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Guardando cambios...' : 'Guardar cambios'}
            </button>

            <button
              type="button"
              onClick={() => router.push(`/admin/personas/clientes/${id}`)}
              disabled={saving}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </form>
      </Section>
    </div>
  )
}