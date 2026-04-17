'use client'
export const dynamic = 'force-dynamic'

import { useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

type RolUI = 'admin' | 'recepcionista' | 'fisioterapeuta'

type FormState = {
  nombre: string
  cedula: string
  email: string
  telefono: string
  rol: RolUI
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
  estado: 'activo',
  comision_plan_porcentaje: '0',
  comision_cita_porcentaje: '0',
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

function parsePorcentaje(value: string): number {
  const cleaned = value.replace(',', '.').trim()
  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return parsed
}

function limpiarCedula(value: string) {
  return value.trim().toUpperCase()
}

function mapearRolCatalogo(rolUI: RolUI): 'admin' | 'recepcionista' | 'terapeuta' {
  if (rolUI === 'fisioterapeuta') return 'terapeuta'
  return rolUI
}

export default function NuevoPersonalPage() {
  const router = useRouter()

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [form, setForm] = useState<FormState>(INITIAL_FORM)

  const rolCatalogo = useMemo(() => mapearRolCatalogo(form.rol), [form.rol])

  async function guardar() {
    setErrorMsg('')
    setSuccessMsg('')

    if (!form.nombre.trim()) {
      setErrorMsg('El nombre es obligatorio.')
      return
    }

    setSaving(true)

    try {
      const nombre = form.nombre.trim()
      const cedula = limpiarCedula(form.cedula) || null
      const email = form.email.trim().toLowerCase() || null
      const telefono = form.telefono.trim() || null
      const comisionPlan = parsePorcentaje(form.comision_plan_porcentaje)
      const comisionCita = parsePorcentaje(form.comision_cita_porcentaje)

      const { data: rolData, error: rolError } = await supabase
        .from('roles')
        .select('id, nombre')
        .eq('nombre', rolCatalogo)
        .single()

      if (rolError || !rolData) {
        throw new Error('No se pudo encontrar el rol seleccionado en la tabla roles.')
      }

      const payload = {
        nombre,
        cedula,
        email,
        telefono,
        rol: form.rol,
        rol_id: rolData.id,
        estado: form.estado,
        especialidad: form.rol === 'fisioterapeuta' ? '' : null,
        comision_plan_porcentaje: comisionPlan,
        comision_cita_porcentaje: comisionCita,
      }

      const { error } = await supabase.from('empleados').insert(payload)

      if (error) throw error

      setSuccessMsg('Personal creado correctamente.')
      router.push('/admin/personas/personal')
    } catch (error: any) {
      console.error(error)
      setErrorMsg(error?.message || 'No se pudo crear el personal.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Personas</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Nuevo personal
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Crea un terapeuta, entrenador o miembro del equipo.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <ActionCard
            title="Volver"
            description="Regresar al listado del personal."
            href="/admin/personas/personal"
          />
        </div>
      </div>

      {errorMsg ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{errorMsg}</p>
        </Card>
      ) : null}

      {successMsg ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-emerald-400">Listo</p>
          <p className="mt-1 text-sm text-white/55">{successMsg}</p>
        </Card>
      ) : null}

      <Section
        title="Formulario de personal"
        description="Completa nombre, contacto, rol, estado y comisiones."
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

          <Field label="Cédula" helper="Opcional. Debe ser única si la colocas.">
            <input
              type="text"
              value={form.cedula}
              onChange={(e) => setForm({ ...form, cedula: e.target.value })}
              placeholder="Ej: V-12345678"
              className={inputClassName}
            />
          </Field>

          <Field label="Email" helper="Opcional. No se enviará invitación.">
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
              placeholder="0424..."
              className={inputClassName}
            />
          </Field>

          <Field
            label="Rol"
            helper={`Rol de permisos real: ${rolCatalogo}`}
          >
            <select
              value={form.rol}
              onChange={(e) => setForm({ ...form, rol: e.target.value as RolUI })}
              className={inputClassName}
            >
              <option value="fisioterapeuta" className="bg-[#11131a] text-white">
                Fisioterapeuta
              </option>
              <option value="recepcionista" className="bg-[#11131a] text-white">
                Recepcionista
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
              <option value="suspendido" className="bg-[#11131a] text-white">
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
              placeholder="0"
              className={inputClassName}
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
              placeholder="0"
              className={inputClassName}
            />
          </Field>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={guardar}
            disabled={saving}
            className="
              rounded-2xl border border-white/10 bg-white/[0.08]
              px-5 py-3 text-sm font-semibold text-white transition
              hover:bg-white/[0.12] disabled:opacity-60
            "
          >
            {saving ? 'Guardando...' : 'Guardar personal'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/admin/personas/personal')}
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