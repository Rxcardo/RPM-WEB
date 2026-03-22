'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

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

type MonedaPago = 'USD' | 'EUR' | 'BS'
type ReferenciaTasa = 'USD' | 'EUR'

type MetodoPagoOption = {
  value: string
  label: string
  moneda: MonedaPago
}

const METODOS_PAGO: MetodoPagoOption[] = [
  { value: 'efectivo_usd', label: 'Efectivo USD', moneda: 'USD' },
  { value: 'zelle', label: 'Zelle', moneda: 'USD' },
  { value: 'binance_usdt', label: 'Binance USDT', moneda: 'USD' },
  { value: 'transferencia_eur', label: 'Transferencia EUR', moneda: 'EUR' },
  { value: 'efectivo_bs', label: 'Efectivo Bs', moneda: 'BS' },
  { value: 'pago_movil_bs', label: 'Pago móvil Bs', moneda: 'BS' },
  { value: 'transferencia_bs', label: 'Transferencia Bs', moneda: 'BS' },
  { value: 'tarjeta_bs', label: 'Tarjeta Bs', moneda: 'BS' },
]

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

function formatMoney(value: number | null | undefined, currency: 'USD' | 'EUR' = 'USD') {
  if (value == null) return '—'
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value))
}

function formatBs(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
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

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

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

  const [metodoPago, setMetodoPago] = useState('')
  const [monedaPago, setMonedaPago] = useState<MonedaPago>('USD')
  const [referenciaTasa, setReferenciaTasa] = useState<ReferenciaTasa>('USD')
  const [tasaBCV, setTasaBCV] = useState('')
  const [montoReferencia, setMontoReferencia] = useState('')

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
    void fetchAll()
  }, [fetchAll])

  const selectedPlan = useMemo(
    () => planes.find((p) => p.id === selectedPlanId) || null,
    [planes, selectedPlanId]
  )

  const metodoSeleccionado = useMemo(
    () => METODOS_PAGO.find((item) => item.value === metodoPago) || null,
    [metodoPago]
  )

  useEffect(() => {
    if (selectedPlan?.precio != null) {
      setMontoReferencia(String(selectedPlan.precio))
    } else {
      setMontoReferencia('')
    }
  }, [selectedPlanId, selectedPlan?.precio])

  useEffect(() => {
    if (metodoSeleccionado) {
      setMonedaPago(metodoSeleccionado.moneda)
    }
  }, [metodoSeleccionado])

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

  const montoReferenciaNumero = Number(montoReferencia || 0)
  const tasaBCVNumero = Number(tasaBCV || 0)

  const montoCalculadoBs =
    monedaPago === 'BS' && montoReferenciaNumero > 0 && tasaBCVNumero > 0
      ? montoReferenciaNumero * tasaBCVNumero
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

    if (!metodoPago) {
      setErrorMsg('Debes seleccionar un método de pago.')
      return
    }

    if (monedaPago === 'BS') {
      if (!referenciaTasa) {
        setErrorMsg('Debes elegir si trabajarás con tasa dólar o euro.')
        return
      }

      if (!tasaBCV || Number(tasaBCV) <= 0) {
        setErrorMsg('Debes indicar la tasa BCV para pagos en Bs.')
        return
      }

      if (!montoReferencia || Number(montoReferencia) <= 0) {
        setErrorMsg('Debes indicar el monto de referencia para calcular en Bs.')
        return
      }
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
      setMetodoPago('')
      setMonedaPago('USD')
      setReferenciaTasa('USD')
      setTasaBCV('')
      setMontoReferencia('')
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
          <p className="text-sm text-white/55">Clientes / Plan</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Plan del cliente</h1>
          <p className="mt-2 text-white/55">Cargando información...</p>
        </div>

        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando plan del cliente...</p>
        </Card>
      </div>
    )
  }

  if (errorMsg && !cliente) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-white/55">Clientes / Plan</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Plan del cliente</h1>
          <p className="mt-2 text-white/55">No fue posible cargar el módulo.</p>
        </div>

        <Card className="p-6">
          <p className="text-sm font-medium text-rose-400">{errorMsg}</p>

          <button
            type="button"
            onClick={() => router.push('/admin/personas/clientes')}
            className="
              mt-4 rounded-2xl border border-white/10 bg-white/[0.08]
              px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12]
            "
          >
            Volver a clientes
          </button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Clientes / Plan</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Plan del cliente
          </h1>
          <p className="mt-2 text-sm text-white/55">
            {cliente?.nombre || 'Cliente'} · Gestión de plan, sesiones y pago.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            title="Volver al cliente"
            description="Regresar al detalle del cliente."
            href={`/admin/personas/clientes/${id}`}
          />
          <ActionCard
            title="Crear cita"
            description="Abrir agenda con este cliente."
            href={`/admin/operaciones/agenda/nueva?cliente=${id}`}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Section
            title="Asignar nuevo plan"
            description="Selecciona el plan, la fecha de inicio y el método de pago."
          >
            <form onSubmit={handleAsignarPlan} className="space-y-5">
              <Field label="Seleccionar plan">
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className={inputClassName}
                >
                  <option value="" className="bg-[#11131a] text-white">
                    Seleccionar
                  </option>
                  {planes.map((plan) => (
                    <option key={plan.id} value={plan.id} className="bg-[#11131a] text-white">
                      {plan.nombre} · {plan.sesiones_totales} sesiones · {plan.vigencia_dias} días
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Fecha de inicio">
                <input
                  type="date"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className={inputClassName}
                />
              </Field>

              {selectedPlan ? (
                <Card className="p-4">
                  <p className="text-sm font-semibold text-white">{selectedPlan.nombre}</p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/45">Sesiones</p>
                      <p className="mt-1 text-sm text-white/80">{selectedPlan.sesiones_totales}</p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/45">Vigencia</p>
                      <p className="mt-1 text-sm text-white/80">{selectedPlan.vigencia_dias} días</p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/45">Precio</p>
                      <p className="mt-1 text-sm text-white/80">{formatMoney(selectedPlan.precio)}</p>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-wide text-white/45">Fecha fin</p>
                      <p className="mt-1 text-sm text-white/80">
                        {fechaInicio
                          ? formatDate(addDaysToDate(fechaInicio, selectedPlan.vigencia_dias))
                          : '—'}
                      </p>
                    </div>
                  </div>

                  {selectedPlan.descripcion ? (
                    <p className="mt-3 text-sm text-white/55">{selectedPlan.descripcion}</p>
                  ) : null}
                </Card>
              ) : null}

              <Section
                title="Método de pago"
                description="Selecciona cómo se pagará el plan. Si es en Bs, se activa el cálculo por tasa."
                className="p-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Método de pago">
                    <select
                      value={metodoPago}
                      onChange={(e) => setMetodoPago(e.target.value)}
                      className={inputClassName}
                    >
                      <option value="" className="bg-[#11131a] text-white">
                        Seleccionar método
                      </option>
                      {METODOS_PAGO.map((item) => (
                        <option key={item.value} value={item.value} className="bg-[#11131a] text-white">
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Moneda del pago">
                    <input
                      value={monedaPago}
                      readOnly
                      className={`${inputClassName} cursor-not-allowed opacity-80`}
                    />
                  </Field>

                  {monedaPago === 'BS' ? (
                    <>
                      <div className="md:col-span-2">
                        <Card className="border-dashed p-4">
                          <p className="text-sm font-medium text-white">agg api/bcv</p>
                          <p className="mt-1 text-sm text-white/55">
                            Aquí conectaremos la tasa BCV de dólar o euro según la opción elegida.
                          </p>
                        </Card>
                      </div>

                      <Field label="Trabajar con tasa">
                        <select
                          value={referenciaTasa}
                          onChange={(e) => setReferenciaTasa(e.target.value as ReferenciaTasa)}
                          className={inputClassName}
                        >
                          <option value="USD" className="bg-[#11131a] text-white">
                            Dólar
                          </option>
                          <option value="EUR" className="bg-[#11131a] text-white">
                            Euro
                          </option>
                        </select>
                      </Field>

                      <Field label={`Tasa BCV ${referenciaTasa}`} helper="Por ahora se carga manual hasta conectar la API BCV.">
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          value={tasaBCV}
                          onChange={(e) => setTasaBCV(e.target.value)}
                          placeholder="Ej: 36.52"
                          className={inputClassName}
                        />
                      </Field>

                      <Field
                        label={`Monto de referencia en ${referenciaTasa}`}
                        helper="Puedes dejar el precio del plan o ajustarlo manualmente."
                      >
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={montoReferencia}
                          onChange={(e) => setMontoReferencia(e.target.value)}
                          className={inputClassName}
                        />
                      </Field>

                      <Field label="Total calculado en Bs">
                        <input
                          readOnly
                          value={montoCalculadoBs > 0 ? formatBs(montoCalculadoBs) : '—'}
                          className={`${inputClassName} cursor-not-allowed opacity-80`}
                        />
                      </Field>
                    </>
                  ) : null}
                </div>
              </Section>

              {errorMsg ? (
                <Card className="p-4">
                  <p className="text-sm text-rose-400">{errorMsg}</p>
                </Card>
              ) : null}

              {successMsg ? (
                <Card className="p-4">
                  <p className="text-sm text-emerald-400">{successMsg}</p>
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
                  {saving ? 'Asignando...' : 'Asignar plan'}
                </button>

                <button
                  type="button"
                  onClick={() => router.push(`/admin/personas/clientes/${id}`)}
                  className="
                    rounded-2xl border border-white/10 bg-white/[0.03]
                    px-5 py-3 text-sm font-semibold text-white/80 transition
                    hover:bg-white/[0.06]
                  "
                >
                  Cancelar
                </button>
              </div>
            </form>
          </Section>
        </div>

        <div className="space-y-6">
          <Section
            title="Plan activo"
            description="Resumen del plan actual del cliente."
          >
            {!planActivo ? (
              <p className="text-sm text-white/55">
                Este cliente no tiene un plan activo.
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/45">Plan</p>
                  <p className="mt-1 text-sm font-medium text-white">
                    {planActivo.planes?.nombre || '—'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-white/45">Totales</p>
                    <p className="mt-1 text-sm text-white/80">{planActivo.sesiones_totales}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-white/45">Usadas</p>
                    <p className="mt-1 text-sm text-white/80">{planActivo.sesiones_usadas}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-white/45">Restantes</p>
                    <p className="mt-1 text-sm text-white/80">{sesionesRestantes}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-white/45">Estado</p>
                    <p className="mt-1 text-sm capitalize text-white/80">{planActivo.estado}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-white/45">Inicio</p>
                  <p className="mt-1 text-sm text-white/80">{formatDate(planActivo.fecha_inicio)}</p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-white/45">Fin</p>
                  <p className="mt-1 text-sm text-white/80">{formatDate(planActivo.fecha_fin)}</p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-white/45">Progreso de uso</p>

                  <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-white/60 transition-all"
                      style={{ width: `${progresoUso}%` }}
                    />
                  </div>

                  <p className="mt-2 text-sm text-white/80">{progresoUso}% usado</p>
                </div>

                <button
                  type="button"
                  onClick={() => router.push(`/admin/operaciones/agenda/nueva?cliente=${id}`)}
                  className="
                    w-full rounded-2xl border border-white/10 bg-white/[0.03]
                    px-4 py-3 text-sm font-semibold text-white/80 transition
                    hover:bg-white/[0.06]
                  "
                >
                  Crear cita con este cliente
                </button>
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}