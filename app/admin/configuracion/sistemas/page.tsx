'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type ConfiguracionSistema = {
  id: string
  nombre_clinica: string | null
  email: string | null
  telefono: string | null
  direccion: string | null
  moneda: string | null
  porcentaje_rpm_default: number
  porcentaje_profesional_default: number
}

type FormState = {
  nombre_clinica: string
  email: string
  telefono: string
  direccion: string
  moneda: string
  porcentaje_rpm_default: string
  porcentaje_profesional_default: string
}

const INITIAL_FORM: FormState = {
  nombre_clinica: '',
  email: '',
  telefono: '',
  direccion: '',
  moneda: 'USD',
  porcentaje_rpm_default: '40',
  porcentaje_profesional_default: '60',
}

export default function SistemaConfigPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configId, setConfigId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    void loadConfig()
  }, [])

  async function loadConfig() {
    try {
      setLoading(true)
      setErrorMsg('')
      setSuccessMsg('')

      const { data, error } = await supabase
        .from('configuracion_sistema')
        .select(`
          id,
          nombre_clinica,
          email,
          telefono,
          direccion,
          moneda,
          porcentaje_rpm_default,
          porcentaje_profesional_default
        `)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (error) throw error

      if (data) {
        const config = data as ConfiguracionSistema
        setConfigId(config.id)
        setForm({
          nombre_clinica: config.nombre_clinica || '',
          email: config.email || '',
          telefono: config.telefono || '',
          direccion: config.direccion || '',
          moneda: config.moneda || 'USD',
          porcentaje_rpm_default: String(config.porcentaje_rpm_default ?? 40),
          porcentaje_profesional_default: String(config.porcentaje_profesional_default ?? 60),
        })
      }
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo cargar la configuración del sistema.')
    } finally {
      setLoading(false)
    }
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function validateForm() {
    const rpm = Number(form.porcentaje_rpm_default || 0)
    const profesional = Number(form.porcentaje_profesional_default || 0)

    if (rpm < 0 || profesional < 0) {
      return 'Los porcentajes no pueden ser negativos.'
    }

    if (Number((rpm + profesional).toFixed(2)) !== 100) {
      return 'La suma de porcentaje RPM y profesional debe ser 100.'
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return 'El email no tiene un formato válido.'
    }

    return ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const validationError = validateForm()
    if (validationError) {
      setErrorMsg(validationError)
      return
    }

    try {
      setSaving(true)

      const payload = {
        nombre_clinica: form.nombre_clinica.trim() || null,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        direccion: form.direccion.trim() || null,
        moneda: form.moneda.trim() || 'USD',
        porcentaje_rpm_default: Number(form.porcentaje_rpm_default || 0),
        porcentaje_profesional_default: Number(form.porcentaje_profesional_default || 0),
        updated_at: new Date().toISOString(),
      }

      if (configId) {
        const { error } = await supabase
          .from('configuracion_sistema')
          .update(payload)
          .eq('id', configId)

        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('configuracion_sistema')
          .insert(payload)
          .select('id')
          .single()

        if (error) throw error
        setConfigId(data.id)
      }

      setSuccessMsg('Configuración guardada correctamente.')
      await loadConfig()
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo guardar la configuración.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6 lg:px-6">
        <h1 className="text-2xl font-bold text-slate-900">Parámetros del sistema</h1>
        <p className="mt-2 text-sm text-slate-600">Cargando configuración...</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Configuración</p>
          <h1 className="text-2xl font-bold text-slate-900">Parámetros del sistema</h1>
          <p className="mt-1 text-sm text-slate-600">
            Configuración general del negocio y porcentajes por defecto.
          </p>
        </div>

        <Link
          href="/admin/configuracion"
          className="rounded-xl border border-slate-200bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Volver a configuración
        </Link>
      </div>

      {errorMsg ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {successMsg ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMsg}
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="max-w-4xl rounded-2xl border border-slate-200 bg-white/[0.04] p-6 shadow-sm"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-800">
              Nombre de la clínica
            </label>
            <input
              value={form.nombre_clinica}
              onChange={(e) => updateField('nombre_clinica', e.target.value)}
              placeholder="Ej: RPM Recovery Center"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="correo@clinica.com"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800">
              Teléfono
            </label>
            <input
              value={form.telefono}
              onChange={(e) => updateField('telefono', e.target.value)}
              placeholder="+1 000 000 0000"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-semibold text-slate-800">
              Dirección
            </label>
            <textarea
              value={form.direccion}
              onChange={(e) => updateField('direccion', e.target.value)}
              rows={3}
              placeholder="Dirección de la clínica"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800">
              Moneda
            </label>
            <select
              value={form.moneda}
              onChange={(e) => updateField('moneda', e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="DOP">DOP</option>
              <option value="MXN">MXN</option>
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                % RPM default
              </label>
              <input
                type="number"
                step="0.01"
                value={form.porcentaje_rpm_default}
                onChange={(e) => updateField('porcentaje_rpm_default', e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-800">
                % Profesional default
              </label>
              <input
                type="number"
                step="0.01"
                value={form.porcentaje_profesional_default}
                onChange={(e) => updateField('porcentaje_profesional_default', e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-500"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>

          <Link
            href="/admin/configuracion"
            className="rounded-xl border border-slate-200 bg-white/[0.04] px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}