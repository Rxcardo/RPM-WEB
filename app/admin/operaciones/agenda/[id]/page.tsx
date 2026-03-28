'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

type ServicioDetalle = {
  id: string
  nombre: string
  estado?: string | null
  categoria?: string | null
  precio?: number | null
  duracion_min?: number | null
  duracion?: number | null
  tiempo?: number | null
  tiempo_min?: number | null
  tiempo_minutos?: number | null
  minutos?: number | null
  [key: string]: any
}

type CitaDetalle = {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: string
  notas: string | null
  created_at: string | null
  clientes: { id: string; nombre: string } | null
  empleados: { id: string; nombre: string } | null
  servicios: ServicioDetalle | null
  recursos: { id: string; nombre: string } | null
}

type PagoDetalle = {
  id: string
  fecha: string | null
  tipo_origen: string | null
  concepto: string | null
  categoria: string | null
  monto: number | null
  monto_pago: number | null
  moneda_pago: 'USD' | 'BS' | string | null
  tasa_bcv: number | null
  monto_equivalente_usd: number | null
  monto_equivalente_bs: number | null
  referencia: string | null
  estado: string | null
  notas: string | null
  metodos_pago: { id: string; nombre: string } | null
}

type ComisionDetalle = {
  id: string
  fecha: string | null
  base: number | null
  rpm: number | null
  profesional: number | null
  tipo: string | null
  estado: string | null
  moneda: 'USD' | 'BS' | string | null
  tasa_bcv: number | null
  monto_base_usd: number | null
  monto_base_bs: number | null
  monto_rpm_usd: number | null
  monto_rpm_bs: number | null
  monto_profesional_usd: number | null
  monto_profesional_bs: number | null
  pagado: boolean | null
  fecha_pago: string | null
}

function getServicioDuracion(servicio: ServicioDetalle | null) {
  if (!servicio) return null

  const posibles = [
    servicio.duracion_min,
    servicio.duracion,
    servicio.tiempo,
    servicio.tiempo_min,
    servicio.tiempo_minutos,
    servicio.minutos,
  ]

  for (const valor of posibles) {
    const n = Number(valor)
    if (!Number.isNaN(n) && n > 0) return n
  }

  return null
}

function estadoClasses(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'confirmada':
      return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
    case 'completada':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'cancelada':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'reprogramada':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'programada':
      return 'border-violet-400/20 bg-violet-400/10 text-violet-300'
    case 'pendiente':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'pagado':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'anulado':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function formatFecha(fecha: string | null | undefined) {
  if (!fecha) return '—'
  try {
    return new Date(`${fecha}T00:00:00`).toLocaleDateString()
  } catch {
    return fecha
  }
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

function formatUSD(value: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatBs(value: number | null | undefined) {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-white/45">{label}</p>
      <div className="mt-1 font-medium text-white">{value}</div>
    </Card>
  )
}

export default function VerCitaPage() {
  const router = useRouter()
  const params = useParams()
  const rawId = params?.id
  const id = Array.isArray(rawId) ? rawId[0] : (rawId as string)

  const [loading, setLoading] = useState(true)
  const [updatingEstado, setUpdatingEstado] = useState(false)
  const [cita, setCita] = useState<CitaDetalle | null>(null)
  const [pago, setPago] = useState<PagoDetalle | null>(null)
  const [comision, setComision] = useState<ComisionDetalle | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const duracionServicio = useMemo(() => getServicioDuracion(cita?.servicios || null), [cita])

  const puedeConfirmar = useMemo(() => {
    const estado = (cita?.estado || '').toLowerCase()
    return ['programada', 'reprogramada'].includes(estado)
  }, [cita])

  const puedeCompletar = useMemo(() => {
    const estado = (cita?.estado || '').toLowerCase()
    return ['programada', 'confirmada', 'reprogramada'].includes(estado)
  }, [cita])

  const puedeCancelar = useMemo(() => {
    const estado = (cita?.estado || '').toLowerCase()
    return ['programada', 'confirmada', 'reprogramada'].includes(estado)
  }, [cita])

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    void loadCita()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function loadCita() {
    setLoading(true)
    setErrorMsg('')

    try {
      const [citaRes, pagoRes, comisionRes] = await Promise.all([
        supabase
          .from('citas')
          .select(`
            id,
            fecha,
            hora_inicio,
            hora_fin,
            estado,
            notas,
            created_at,
            clientes:cliente_id ( id, nombre ),
            empleados:terapeuta_id ( id, nombre ),
            servicios:servicio_id ( * ),
            recursos:recurso_id ( id, nombre )
          `)
          .eq('id', id)
          .limit(1)
          .maybeSingle(),

        supabase
          .from('pagos')
          .select(`
            id,
            fecha,
            tipo_origen,
            concepto,
            categoria,
            monto,
            monto_pago,
            moneda_pago,
            tasa_bcv,
            monto_equivalente_usd,
            monto_equivalente_bs,
            referencia,
            estado,
            notas,
            metodos_pago:metodo_pago_id ( id, nombre )
          `)
          .eq('cita_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from('comisiones_detalle')
          .select(`
            id,
            fecha,
            base,
            rpm,
            profesional,
            tipo,
            estado,
            moneda,
            tasa_bcv,
            monto_base_usd,
            monto_base_bs,
            monto_rpm_usd,
            monto_rpm_bs,
            monto_profesional_usd,
            monto_profesional_bs,
            pagado,
            fecha_pago
          `)
          .eq('cita_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (citaRes.error) throw new Error(citaRes.error.message)
      if (!citaRes.data) throw new Error('No se encontró la cita.')

      if (pagoRes.error) throw new Error(pagoRes.error.message)
      if (comisionRes.error) throw new Error(comisionRes.error.message)

      setCita(citaRes.data as unknown as CitaDetalle)
      setPago((pagoRes.data as unknown as PagoDetalle) || null)
      setComision((comisionRes.data as unknown as ComisionDetalle) || null)
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err?.message || 'No se pudo cargar la cita.')
    } finally {
      setLoading(false)
    }
  }

  async function cambiarEstado(nuevoEstado: 'confirmada' | 'completada' | 'cancelada') {
    if (!cita?.id) return

    setErrorMsg('')

    if (nuevoEstado === 'cancelada') {
      const ok = window.confirm('¿Seguro que deseas cancelar esta cita?')
      if (!ok) return
    }

    if (nuevoEstado === 'completada') {
      const ok = window.confirm(
        '¿Seguro que deseas completar esta cita?\n\nAl completar, la cita consumirá una sesión del plan si el cliente tiene un plan activo.'
      )
      if (!ok) return
    }

    setUpdatingEstado(true)

    try {
      const { error } = await supabase
        .from('citas')
        .update({ estado: nuevoEstado })
        .eq('id', cita.id)

      if (error) throw new Error(error.message)

      setCita((prev) => (prev ? { ...prev, estado: nuevoEstado } : prev))
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err?.message || 'No se pudo actualizar el estado.')
    } finally {
      setUpdatingEstado(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-white/55">Agenda</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Detalle de cita</h1>
        </div>

        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando cita...</p>
        </Card>
      </div>
    )
  }

  if (!cita) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-white/55">Agenda</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Detalle de cita</h1>
        </div>

        <Card className="p-6">
          <p className="text-sm text-rose-400">{errorMsg || 'No se encontró la cita.'}</p>
          <div className="mt-4">
            <Link
              href="/admin/operaciones/agenda"
              className="
                inline-flex rounded-2xl border border-white/10 bg-white/[0.03]
                px-4 py-2 text-sm font-medium text-white/80
                transition hover:bg-white/[0.06]
              "
            >
              Volver a agenda
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Agenda</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Detalle de cita
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Consulta la cita, su pago, su comisión y cambia el estado desde aquí.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ActionCard
            title="Editar"
            description="Modificar servicio y recurso."
            href={`/admin/operaciones/agenda/${cita.id}/editar`}
          />

          <ActionCard
            title="Reprogramar"
            description="Cambiar fecha y horario."
            href={`/admin/operaciones/agenda/${cita.id}/reprogramar`}
          />

          <ActionCard
            title="Volver"
            description="Regresar al listado."
            href="/admin/operaciones/agenda"
          />
        </div>
      </div>

      {errorMsg ? (
        <Card className="p-4">
          <p className="text-sm text-rose-400">{errorMsg}</p>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section
            title="Información principal"
            description="Datos base de la cita, cliente, personal y servicio."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <DetailItem
                label="Cliente"
                value={cita.clientes?.nombre || 'Sin cliente'}
              />

              <DetailItem
                label="Terapeuta"
                value={cita.empleados?.nombre || 'Sin terapeuta'}
              />

              <DetailItem
                label="Servicio"
                value={cita.servicios?.nombre || 'Sin servicio'}
              />

              <DetailItem
                label="Recurso"
                value={cita.recursos?.nombre || 'Sin recurso'}
              />

              <DetailItem
                label="Fecha"
                value={formatFecha(cita.fecha)}
              />

              <DetailItem
                label="Horario"
                value={`${cita.hora_inicio?.slice(0, 5) || '—'} - ${cita.hora_fin?.slice(0, 5) || '—'}`}
              />

              <DetailItem
                label="Estado"
                value={
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoClasses(
                      cita.estado
                    )}`}
                  >
                    {cita.estado}
                  </span>
                }
              />

              <DetailItem
                label="Duración"
                value={duracionServicio ? `${duracionServicio} min` : '—'}
              />
            </div>
          </Section>

          <Section
            title="Pago relacionado"
            description="Ingreso generado por esta cita en finanzas."
          >
            {!pago ? (
              <Card className="p-4">
                <p className="text-sm text-white/55">Esta cita no tiene pago registrado.</p>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <DetailItem label="Concepto" value={pago.concepto || '—'} />
                <DetailItem label="Método de pago" value={pago.metodos_pago?.nombre || '—'} />
                <DetailItem label="Fecha de pago" value={formatFecha(pago.fecha)} />
                <DetailItem
                  label="Estado del pago"
                  value={
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoClasses(
                        pago.estado || ''
                      )}`}
                    >
                      {pago.estado || '—'}
                    </span>
                  }
                />
                <DetailItem label="Moneda" value={pago.moneda_pago || '—'} />
                <DetailItem
                  label="Monto cobrado"
                  value={
                    pago.moneda_pago === 'BS'
                      ? formatBs(pago.monto_pago ?? pago.monto)
                      : formatUSD(pago.monto_pago ?? pago.monto)
                  }
                />
                <DetailItem label="Equivalente USD" value={formatUSD(pago.monto_equivalente_usd)} />
                <DetailItem label="Equivalente Bs" value={formatBs(pago.monto_equivalente_bs)} />
                <DetailItem
                  label="Tasa BCV"
                  value={pago.tasa_bcv ? `Bs ${Number(pago.tasa_bcv).toFixed(4)}` : '—'}
                />
                <DetailItem label="Referencia" value={pago.referencia || 'Sin referencia'} />
              </div>
            )}
          </Section>

          <Section
            title="Comisión relacionada"
            description="Comisión generada para esta cita."
          >
            {!comision ? (
              <Card className="p-4">
                <p className="text-sm text-white/55">Esta cita no tiene comisión registrada.</p>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <DetailItem label="Tipo" value={comision.tipo || '—'} />
                  <DetailItem
                    label="Estado comisión"
                    value={
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoClasses(
                          comision.estado || ''
                        )}`}
                      >
                        {comision.estado || '—'}
                      </span>
                    }
                  />
                  <DetailItem label="Base" value={formatUSD(comision.base)} />
                  <DetailItem label="RPM recibe" value={formatUSD(comision.rpm)} />
                  <DetailItem label="Profesional recibe" value={formatUSD(comision.profesional)} />
                  <DetailItem label="Moneda origen" value={comision.moneda || '—'} />
                  <DetailItem
                    label="Pagada"
                    value={comision.pagado ? 'Sí' : 'No'}
                  />
                  <DetailItem label="Fecha pago comisión" value={formatFecha(comision.fecha_pago)} />
                </div>

                <Card className="p-4">
                  <p className="mb-3 text-sm font-medium text-white/75">Montos congelados</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-white/[0.03] p-3">
                      <p className="text-xs text-white/45">Base</p>
                      <p className="mt-1 text-sm font-semibold text-white">{formatUSD(comision.monto_base_usd)}</p>
                      <p className="text-xs text-white/35">{formatBs(comision.monto_base_bs)}</p>
                    </div>
                    <div className="rounded-2xl bg-violet-400/5 p-3">
                      <p className="text-xs text-white/45">RPM</p>
                      <p className="mt-1 text-sm font-semibold text-violet-300">{formatUSD(comision.monto_rpm_usd)}</p>
                      <p className="text-xs text-white/35">{formatBs(comision.monto_rpm_bs)}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-400/5 p-3">
                      <p className="text-xs text-white/45">Profesional</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-300">{formatUSD(comision.monto_profesional_usd)}</p>
                      <p className="text-xs text-white/35">{formatBs(comision.monto_profesional_bs)}</p>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section
            title="Acciones de estado"
            description="Solo completar consume sesión. Cancelar no consume."
          >
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => cambiarEstado('confirmada')}
                disabled={!puedeConfirmar || updatingEstado}
                className={`
                  w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition
                  ${puedeConfirmar && !updatingEstado
                    ? 'border-sky-400/20 bg-sky-400/10 text-sky-300 hover:bg-sky-400/15'
                    : 'cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35'
                  }
                `}
              >
                Confirmar cita
              </button>

              <button
                type="button"
                onClick={() => cambiarEstado('completada')}
                disabled={!puedeCompletar || updatingEstado}
                className={`
                  w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition
                  ${puedeCompletar && !updatingEstado
                    ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15'
                    : 'cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35'
                  }
                `}
              >
                Completar cita
              </button>

              <button
                type="button"
                onClick={() => cambiarEstado('cancelada')}
                disabled={!puedeCancelar || updatingEstado}
                className={`
                  w-full rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition
                  ${puedeCancelar && !updatingEstado
                    ? 'border-rose-400/20 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15'
                    : 'cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35'
                  }
                `}
              >
                Cancelar cita
              </button>
            </div>

            <Card className="mt-4 p-4">
              <p className="text-xs text-white/45">Regla de consumo</p>
              <p className="mt-1 text-sm text-white/75">
                La cita solo consume una sesión del plan cuando cambia a <span className="font-semibold text-emerald-300">completada</span>.
              </p>
            </Card>
          </Section>

          <Section
            title="Notas"
            description="Observaciones registradas para esta cita."
          >
            <Card className="p-4">
              <p className="whitespace-pre-wrap text-sm text-white/75">
                {cita.notas || 'Sin notas registradas.'}
              </p>
            </Card>

            <Card className="mt-4 p-4">
              <p className="text-xs text-white/45">Creada</p>
              <p className="mt-1 text-sm font-medium text-white">
                {formatDateTime(cita.created_at)}
              </p>
            </Card>

            <div className="mt-4">
              <Link
                href="/admin/operaciones/agenda"
                className="
                  inline-flex rounded-2xl border border-white/10 bg-white/[0.03]
                  px-4 py-2 text-sm font-medium text-white/80
                  transition hover:bg-white/[0.06]
                "
              >
                Volver a agenda
              </Link>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}