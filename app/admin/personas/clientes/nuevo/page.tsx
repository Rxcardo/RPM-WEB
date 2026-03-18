'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

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

    fetchTerapeutas()
  }, [])

  const terapeutasOptions = useMemo(() => terapeutas || [], [terapeutas])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
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

  const handleSubmit = async (e: React.FormEvent) => {
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
    router.push('/admin/clientes')
  }

  const handleReset = () => {
    setForm(INITIAL_FORM)
    setErrorMsg('')
    setCreatedClienteId(null)
    setCreatedClienteNombre('')
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Nuevo cliente</h1>
          <p className="mt-1 text-neutral-500">
            Crea un nuevo registro operativo dentro de RPM
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            Volver
          </button>
        </div>
      </div>

      {createdClienteId ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-green-800">Cliente creado correctamente</h2>
          <p className="mt-2 text-sm text-green-700">
            {createdClienteNombre} ya fue registrado. Ahora puedes seguir con el flujo.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => router.push(`/admin/personas/clientes/${createdClienteId}`)}
              className="rounded-xl border border-green-300 bg-white px-5 py-3 text-sm font-semibold text-green-800 transition hover:bg-green-100"
            >
              Ver cliente
            </button>

            <button
              type="button"
              onClick={() => router.push(`/admin/personas/clientes/${createdClienteId}/plan`)}
              className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              Asignar plan
            </button>

            <button
              type="button"
              onClick={() => router.push(`/admin/operaciones/agenda/nueva?cliente=${createdClienteId}`)}
              className="rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              Crear cita
            </button>

            <button
              type="button"
              onClick={() => {
                setCreatedClienteId(null)
                setCreatedClienteNombre('')
              }}
              className="rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              Crear otro cliente
            </button>
          </div>
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Nombre completo *
            </label>
            <input
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              placeholder="Ej: Juan Pérez"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Teléfono
            </label>
            <input
              name="telefono"
              value={form.telefono}
              onChange={handleChange}
              placeholder="Ej: +58 412 000 0000"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Correo
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="ejemplo@correo.com"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Fecha de nacimiento
            </label>
            <input
              type="date"
              name="fecha_nacimiento"
              value={form.fecha_nacimiento}
              onChange={handleChange}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Género
            </label>
            <select
              name="genero"
              value={form.genero}
              onChange={handleChange}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
            >
              <option value="">Seleccionar</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
              <option value="otro">Otro</option>
              <option value="prefiero_no_decir">Prefiero no decir</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Dirección
            </label>
            <input
              name="direccion"
              value={form.direccion}
              onChange={handleChange}
              placeholder="Dirección del cliente"
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Terapeuta asignado
            </label>
            <select
              name="terapeuta_id"
              value={form.terapeuta_id}
              onChange={handleChange}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
              disabled={loadingTerapeutas}
            >
              <option value="">
                {loadingTerapeutas ? 'Cargando terapeutas...' : 'Sin asignar'}
              </option>

              {terapeutasOptions.map((terapeuta) => (
                <option key={terapeuta.id} value={terapeuta.id}>
                  {terapeuta.nombre}
                </option>
              ))}
            </select>
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
              <option value="pausado">Pausado</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-neutral-800">
              Notas
            </label>
            <textarea
              name="notas"
              value={form.notas}
              onChange={handleChange}
              rows={5}
              placeholder="Notas internas del cliente"
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
            {saving ? 'Guardando...' : 'Guardar cliente'}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Limpiar formulario
          </button>

          <button
            type="button"
            onClick={handleCancel}
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