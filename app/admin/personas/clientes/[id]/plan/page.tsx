'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type Cliente = {
  id: string
  nombre: string
  estado: string
}

type Plan = {
  id: string
  nombre: string
  sesiones_totales: number
  vigencia_dias: number
  precio: number
  estado: string
  descripcion: string | null
}

type ClientePlan = {
  id: string
  cliente_id: string
  plan_id: string
  sesiones_totales: number
  sesiones_usadas: number
  fecha_inicio: string | null
  fecha_fin: string | null
  estado: 'activo' | 'vencido' | 'agotado' | 'cancelado'
  created_at: string
  planes: Plan | null
}

function getTodayLocal() {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString()
  } catch {
    return value
  }
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function addDaysToDate(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + Number(days || 0))

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

export default function ClientePlanPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [planes, setPlanes] = useState<Plan[]>([])
  const [planActivo, setPlanActivo] = useState<ClientePlan | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [fechaInicio, setFechaInicio] = useState(getTodayLocal())

  const fetchAll = useCallback(async () => {
    if (!id) return

    setLoading(true)
    setErrorMsg('')

    const [
      { data: clienteData, error: clienteError },
      { data: planesData, error: planesError },
      { data: clientePlanData, error: clientePlanError },
    ] = await Promise.all([
      supabase
        .from('clientes')
        .select('id, nombre, estado')
        .eq('id', id)
        .single(),

      supabase
        .from('planes')
        .select('id, nombre, sesiones_totales, vigencia_dias, precio, estado, descripcion')
        .eq('estado', 'activo')
        .order('created_at', { ascending: false }),

      supabase
        .from('clientes_planes')
        .select(`
          id,
          cliente_id,
          plan_id,
          sesiones_totales,
          sesiones_usadas,
          fecha_inicio,
          fecha_fin,
          estado,
          created_at,
          planes:plan_id (
            id,
            nombre,
            sesiones_totales,
            vigencia_dias,
            precio,
            estado,
            descripcion
          )
        `)
        .eq('cliente_id', id)
        .eq('estado', 'activo')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (clienteError || !clienteData) {
      console.error('Error cargando cliente:', clienteError?.message)
      setErrorMsg('No se pudo cargar el cliente.')
      setLoading(false)
      return
    }

    if (planesError) {
      console.error('Error cargando planes:', planesError.message)
      setErrorMsg('No se pudieron cargar los planes.')
      setLoading(false)
      return
    }

    if (clientePlanError && clientePlanError.code !== 'PGRST116') {
      console.error('Error cargando plan activo:', clientePlanError.message)
      setErrorMsg('No se pudo cargar el plan activo del cliente.')
      setLoading(false)
      return
    }

    setCliente(clienteData as Cliente)
    setPlanes((planesData as Plan[]) || [])
    setPlanActivo((clientePlanData as ClientePlan | null) || null)
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const selectedPlan = useMemo(
    () => planes.find((p) => p.id === selectedPlanId) || null,
    [planes, selectedPlanId]
  )

  const sesionesRestantes = planActivo
    ? Math.max(Number(planActivo.sesiones_totales) - Number(planActivo.sesiones_usadas), 0)
    : 0

  const progresoUso = planActivo
    ? Math.min(
        Math.round(
          (Number(planActivo.sesiones_usadas) / Math.max(Number(planActivo.sesiones_totales), 1)) *
            100
        ),
        100
      )
    : 0

  const handleAsignarPlan = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (!id) {
      setErrorMsg('No se encontró el cliente.')
      return
    }

    if (!selectedPlanId) {
      setErrorMsg('Debes seleccionar un plan.')
      return
    }

    if (!fechaInicio) {
      setErrorMsg('Debes seleccionar una fecha de inicio.')
      return
    }

    const plan = selectedPlan
    if (!plan) {
      setErrorMsg('El plan seleccionado no es válido.')
      return
    }

    setSaving(true)

    try {
      if (planActivo) {
        const { error: cerrarPlanError } = await supabase
          .from('clientes_planes')
          .update({ estado: 'cancelado' })
          .eq('id', planActivo.id)

        if (cerrarPlanError) {
          throw cerrarPlanError
        }
      }

      const payload = {
        cliente_id: id,
        plan_id: plan.id,
        sesiones_totales: Number(plan.sesiones_totales),
        sesiones_usadas: 0,
        fecha_inicio: fechaInicio,
        fecha_fin: addDaysToDate(fechaInicio, Number(plan.vigencia_dias)),
        estado: 'activo',
      }

      const { error: insertError } = await supabase
        .from('clientes_planes')
        .insert([payload])

      if (insertError) {
        throw insertError
      }

      await fetchAll()
      setSelectedPlanId('')
      setSuccessMsg('Plan asignado correctamente.')
      router.refresh()
    } catch (error: any) {
      console.error('Error asignando plan:', error)
      setErrorMsg(error?.message || 'No se pudo asignar el plan.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Plan del cliente</h1>
          <p className="mt-1 text-neutral-500">Cargando información...</p>
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <p className="text-sm text-neutral-500">Cargando plan del cliente...</p>
        </div>
      </div>
    )
  }

  if (errorMsg && !cliente) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Plan del cliente</h1>
          <p className="mt-1 text-neutral-500">No fue posible cargar el módulo.</p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <p className="text-sm font-medium text-red-700">{errorMsg}</p>

          <button
            onClick={() => router.push('/admin/clientes')}
            className="mt-4 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            Volver a clientes
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Plan del cliente</h1>
          <p className="mt-1 text-neutral-500">
            {cliente?.nombre || 'Cliente'} · Gestión de plan y sesiones
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => router.push(`/admin/personas/clientes/${id}`)}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
          >
            Volver al cliente
          </button>

          <button
            onClick={() => router.push(`/admin/operaciones/agenda/nueva?cliente=${id}`)}
            className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"
          >
            Crear cita
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-neutral-900">Asignar nuevo plan</h2>

          <form onSubmit={handleAsignarPlan} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-neutral-800">
                Seleccionar plan
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
              >
                <option value="">Seleccionar</option>
                {planes.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.nombre} · {plan.sesiones_totales} sesiones · {plan.vigencia_dias} días
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-neutral-800">
                Fecha de inicio
              </label>
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-violet-400"
              />
            </div>

            {selectedPlan ? (
              <div className="rounded-2xl bg-neutral-50 p-4">
                <p className="text-sm font-semibold text-neutral-900">{selectedPlan.nombre}</p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">Sesiones</p>
                    <p className="mt-1 text-sm text-neutral-800">{selectedPlan.sesiones_totales}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">Vigencia</p>
                    <p className="mt-1 text-sm text-neutral-800">{selectedPlan.vigencia_dias} días</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">Precio</p>
                    <p className="mt-1 text-sm text-neutral-800">{formatMoney(selectedPlan.precio)}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">Fecha fin</p>
                    <p className="mt-1 text-sm text-neutral-800">
                      {fechaInicio
                        ? formatDate(addDaysToDate(fechaInicio, selectedPlan.vigencia_dias))
                        : '—'}
                    </p>
                  </div>
                </div>

                {selectedPlan.descripcion ? (
                  <p className="mt-3 text-sm text-neutral-600">{selectedPlan.descripcion}</p>
                ) : null}
              </div>
            ) : null}

            {errorMsg ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMsg}
              </div>
            ) : null}

            {successMsg ? (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {successMsg}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Asignando...' : 'Asignar plan'}
              </button>

              <button
                type="button"
                onClick={() => router.push(`/admin/personas/clientes/${id}`)}
                className="rounded-xl border border-neutral-200 bg-white px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-neutral-900">Plan activo</h2>

            {!planActivo ? (
              <p className="mt-3 text-sm text-neutral-500">
                Este cliente no tiene un plan activo.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-500">Plan</p>
                  <p className="mt-1 text-sm font-medium text-neutral-900">
                    {planActivo.planes?.nombre || '—'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">Totales</p>
                    <p className="mt-1 text-sm text-neutral-800">{planActivo.sesiones_totales}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">Usadas</p>
                    <p className="mt-1 text-sm text-neutral-800">{planActivo.sesiones_usadas}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">Restantes</p>
                    <p className="mt-1 text-sm text-neutral-800">{sesionesRestantes}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-neutral-500">Estado</p>
                    <p className="mt-1 text-sm capitalize text-neutral-800">{planActivo.estado}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-500">Inicio</p>
                  <p className="mt-1 text-sm text-neutral-800">{formatDate(planActivo.fecha_inicio)}</p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-500">Fin</p>
                  <p className="mt-1 text-sm text-neutral-800">{formatDate(planActivo.fecha_fin)}</p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-neutral-500">Progreso de uso</p>

                  <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-neutral-200">
                    <div
                      className="h-full rounded-full bg-violet-600 transition-all"
                      style={{ width: `${progresoUso}%` }}
                    />
                  </div>

                  <p className="mt-2 text-sm text-neutral-800">{progresoUso}% usado</p>
                </div>

                <button
                  onClick={() => router.push(`/admin/operaciones/agenda/nueva?cliente=${id}`)}
                  className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  Crear cita con este cliente
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}