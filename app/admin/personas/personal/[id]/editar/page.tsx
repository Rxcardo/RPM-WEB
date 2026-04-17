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
  cedula: string
  email: string
  telefono: string
  rol: string
  especialidad: string
  estado: string
  comision_plan_porcentaje: string
  comision_cita_porcentaje: string
}

const INITIAL_FORM: FormState = {
  nombre: '',
  cedula: '',
  email: '',
  telefono: '',
  rol: 'fisioterapeuta',
  especialidad: '',
  estado: 'activo',
  comision_plan_porcentaje: '40',
  comision_cita_porcentaje: '40',
}

const inputCls = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]
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
      <label className="mb-2 block text-sm font-medium text-white/75">{label}</label>
      {children}
      {helper ? <p className="mt-2 text-xs text-white/45">{helper}</p> : null}
    </div>
  )
}

function limpiarCedula(value: string) {
  return value.trim().toUpperCase()
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
      setBootError('ID inválido.')
      setLoadingData(false)
      return
    }
    void loadPersonal()
  }, [id])

  async function loadPersonal() {
    setLoadingData(true)
    setBootError('')

    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('id', id)
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      setBootError(error?.message || 'No se pudo cargar el personal.')
      setLoadingData(false)
      return
    }

    setForm({
      nombre: data.nombre || '',
      cedula: data.cedula || '',
      email: data.email || '',
      telefono: data.telefono || '',
      rol: data.rol || 'fisioterapeuta',
      especialidad: data.especialidad || '',
      estado: data.estado || 'activo',
      comision_plan_porcentaje: String(data.comision_plan_porcentaje ?? 40),
      comision_cita_porcentaje: String(data.comision_cita_porcentaje ?? 40),
    })

    setLoadingData(false)
  }

  async function guardarCambios() {
    setErrorMsg('')

    if (!form.nombre.trim()) {
      setErrorMsg('El nombre es obligatorio.')
      return
    }

    const planNum = Number(form.comision_plan_porcentaje)
    const citaNum = Number(form.comision_cita_porcentaje)
    const cedulaLimpia = limpiarCedula(form.cedula)

    if (isNaN(planNum) || planNum < 0 || planNum > 100) {
      setErrorMsg('Comisión por plan debe ser entre 0 y 100.')
      return
    }

    if (isNaN(citaNum) || citaNum < 0 || citaNum > 100) {
      setErrorMsg('Comisión por cita debe ser entre 0 y 100.')
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from('empleados')
      .update({
        nombre: form.nombre.trim(),
        cedula: cedulaLimpia || null,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        rol: form.rol,
        especialidad: form.especialidad.trim() || null,
        estado: form.estado,
        comision_plan_porcentaje: planNum,
        comision_cita_porcentaje: citaNum,
      })
      .eq('id', id)

    if (error) {
      setErrorMsg(error.message || 'No se pudo actualizar.')
      setSaving(false)
      return
    }

    router.push(`/admin/personas/personal/${id}`)
  }

  if (loadingData) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/55">Personal</p>
        <h1 className="text-2xl font-semibold text-white">Editar personal</h1>
        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando...</p>
        </Card>
      </div>
    )
  }

  if (bootError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/55">Personal</p>
        <h1 className="text-2xl font-semibold text-white">Editar personal</h1>
        <Card className="p-6">
          <p className="text-sm text-rose-400">{bootError}</p>
          <button
            type="button"
            onClick={() => router.push('/admin/personas/personal')}
            className="mt-4 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
          >
            Volver
          </button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Personal</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Editar personal
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Actualiza la información del miembro del equipo.
          </p>
        </div>

        <ActionCard
          title="Cancelar"
          description="Volver al perfil."
          href={`/admin/personas/personal/${id}`}
        />
      </div>

      {errorMsg && (
        <Card className="p-4">
          <p className="text-sm text-rose-400">{errorMsg}</p>
        </Card>
      )}

      <div className="grid gap-6">
        <div className="space-y-6">
          <Section title="Datos generales" description="Información de contacto y rol.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Nombre completo *">
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    placeholder="Nombre completo"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Cédula" helper="Opcional. Debe ser única si la colocas.">
                <input
                  type="text"
                  value={form.cedula}
                  onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                  placeholder="Ej: V-12345678"
                  className={inputCls}
                />
              </Field>

              <Field label="Email">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                  className={inputCls}
                />
              </Field>

              <Field label="Teléfono">
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="+58 412..."
                  className={inputCls}
                />
              </Field>

              <Field label="Especialidad">
                <input
                  type="text"
                  value={form.especialidad}
                  onChange={(e) => setForm({ ...form, especialidad: e.target.value })}
                  placeholder="Ej: Fisioterapia, Entrenamiento funcional..."
                  className={inputCls}
                />
              </Field>

              <Field label="Rol">
                <select
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value })}
                  className={inputCls}
                >
                  <option value="terapeuta" className="bg-[#11131a]">
                    Fisioterapeuta
                  </option>
                  <option value="fisioterapeuta" className="bg-[#11131a]">
                    Fisioterapeuta
                  </option>
                  <option value="recepcion" className="bg-[#11131a]">
                    Recepción
                  </option>
                  <option value="admin" className="bg-[#11131a]">
                    Admin
                  </option>
                </select>
              </Field>

              <Field label="Estado">
                <select
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value })}
                  className={inputCls}
                >
                  <option value="activo" className="bg-[#11131a]">
                    Activo
                  </option>
                  <option value="inactivo" className="bg-[#11131a]">
                    Inactivo
                  </option>
                  <option value="suspendido" className="bg-[#11131a]">
                    Suspendido
                  </option>
                </select>
              </Field>

              <Field label="Comisión por plan (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.comision_plan_porcentaje}
                  onChange={(e) =>
                    setForm({ ...form, comision_plan_porcentaje: e.target.value })
                  }
                  placeholder="40"
                  className={inputCls}
                />
              </Field>

              <Field label="Comisión por cita (%)">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.comision_cita_porcentaje}
                  onChange={(e) =>
                    setForm({ ...form, comision_cita_porcentaje: e.target.value })
                  }
                  placeholder="40"
                  className={inputCls}
                />
              </Field>
            </div>
          </Section>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={guardarCambios}
          disabled={saving}
          className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-60"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>

        <button
          type="button"
          onClick={() => router.push(`/admin/personas/personal/${id}`)}
          className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}