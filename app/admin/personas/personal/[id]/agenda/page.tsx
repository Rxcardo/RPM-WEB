'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function EditarPersonalPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    email: '',
    telefono: '',
    rol: 'terapeuta',
    estado: 'activo',
  })

  useEffect(() => {
    loadPersonal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadPersonal() {
    setLoadingData(true)

    const { data, error } = await supabase
      .from('empleados')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      console.error(error)
      alert('No se pudo cargar el personal.')
      router.push('/admin/personas/personal')
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
    if (!form.nombre.trim()) {
      alert('El nombre es obligatorio.')
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
      alert('No se pudo actualizar el personal.')
      setSaving(false)
      return
    }

    router.push(`/admin/personas/personal/${id}`)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <p className="text-sm text-slate-500">Personas</p>
        <h1 className="text-2xl font-bold text-slate-900">Editar personal</h1>
        <p className="mt-1 text-sm text-slate-600">
          Actualiza la información del miembro del equipo.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        {loadingData ? (
          <div className="text-sm text-slate-500">Cargando personal...</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">Nombre</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Nombre completo"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="correo@ejemplo.com"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">Teléfono</label>
                <input
                  type="text"
                  value={form.telefono}
                  onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                  placeholder="809..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">Rol</label>
                <select
                  value={form.rol}
                  onChange={(e) => setForm({ ...form, rol: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                >
                  <option value="terapeuta">Terapeuta</option>
                  <option value="entrenador">Entrenador</option>
                  <option value="recepcion">Recepción</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-800">Estado</label>
                <select
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                  <option value="vacaciones">Vacaciones</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={guardarCambios}
                disabled={saving}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>

              <button
                type="button"
                onClick={() => router.push(`/admin/personas/personal/${id}`)}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}