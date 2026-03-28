'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'
import { SelectorTasaBCV } from '@/components/finanzas/SelectorTasaBCV'
import DisponibilidadTerapeuta from '@/components/agenda/DisponibilidadTerapeuta'

type Cliente = {
  id: string
  nombre: string
}

type Terapeuta = {
  id: string
  nombre: string
  comision_cita_porcentaje: number
}

type ServicioRaw = {
  id: string
  nombre: string
  estado?: string | null
  precio?: number | null
  duracion_minutos?: number | null
  categoria?: string | null
  descripcion?: string | null
  color?: string | null
  [key: string]: any
}

type Servicio = {
  id: string
  nombre: string
  precio: number | null
  duracion_min: number | null
  estado?: string | null
  color?: string | null
}

type Recurso = {
  id: string
  nombre: string
  estado: string | null
}

type MetodoPago = {
  id: string
  nombre: string
  tipo?: string | null
}

function sumarMinutos(hora: string, minutos: number) {
  if (!hora) return ''

  const limpia = hora.slice(0, 5)
  const [h, m] = limpia.split(':').map(Number)
  const total = h * 60 + m + minutos
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, '0')
  const mm = (total % 60).toString().padStart(2, '0')

  return `${hh}:${mm}:00`
}

function getServicioDuracion(servicio: ServicioRaw) {
  const n = Number(servicio.duracion_minutos)
  if (!Number.isNaN(n) && n > 0) return n
  return null
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

const r2 = (v: number | null | undefined) => Math.round(Number(v || 0) * 100) / 100

function formatMoney(v: number | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(v || 0))
}

function formatBs(v: number | null | undefined) {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    maximumFractionDigits: 2,
  }).format(Number(v || 0))
}

export default function NuevaCitaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clienteInicial = searchParams.get('cliente') || ''

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])

  const [form, setForm] = useState({
    cliente_id: clienteInicial,
    terapeuta_id: '',
    servicio_id: '',
    recurso_id: '',
    fecha: new Date().toISOString().slice(0, 10),
    hora_inicio: '',
    hora_fin: '',
    estado: 'programada',
    notas: '',
  })

  const [cobrarAhora, setCobrarAhora] = useState(false)

  const [metodoPagoId, setMetodoPagoId] = useState('')
  const [usarPrecioServicio, setUsarPrecioServicio] = useState(true)
  const [montoPersonalizado, setMontoPersonalizado] = useState('')
  const [referenciaPago, setReferenciaPago] = useState('')
  const [notasPago, setNotasPago] = useState('')

  const [tasaCongelada, setTasaCongelada] = useState<number | null>(null)
  const [montoBsPersonalizado, setMontoBsPersonalizado] = useState<number | null>(null)
  const [esBs, setEsBs] = useState(false)

  const [montoBaseComision, setMontoBaseComision] = useState('')
  const [porcentajeRpm, setPorcentajeRpm] = useState(35)

  useEffect(() => {
    void loadData()
  }, [])

  const servicioSeleccionado = useMemo(
    () => servicios.find((s) => s.id === form.servicio_id) || null,
    [servicios, form.servicio_id]
  )

  const terapeutaSeleccionado = useMemo(
    () => terapeutas.find((t) => t.id === form.terapeuta_id) || null,
    [terapeutas, form.terapeuta_id]
  )

  useEffect(() => {
    if (!form.hora_inicio || !servicioSeleccionado?.duracion_min) return

    setForm((prev) => ({
      ...prev,
      hora_fin: sumarMinutos(prev.hora_inicio, servicioSeleccionado.duracion_min || 0),
    }))
  }, [form.hora_inicio, servicioSeleccionado])

  useEffect(() => {
    const metodo = metodosPago.find((x) => x.id === metodoPagoId)
    const nombre = (metodo?.nombre || '').toLowerCase()
    const tipo = (metodo?.tipo || '').toLowerCase()

    const detectadoBs =
      nombre.includes('bs') ||
      nombre.includes('bolívar') ||
      nombre.includes('bolivar') ||
      nombre.includes('pago móvil') ||
      tipo.includes('bs') ||
      tipo.includes('bolívar') ||
      tipo.includes('bolivar')

    setEsBs(detectadoBs)
  }, [metodoPagoId, metodosPago])

  useEffect(() => {
    if (terapeutaSeleccionado?.comision_cita_porcentaje && !montoBaseComision) {
      setPorcentajeRpm(r2(100 - terapeutaSeleccionado.comision_cita_porcentaje))
    }
  }, [terapeutaSeleccionado, montoBaseComision])

  async function loadData() {
    setLoadingData(true)
    setError('')

    try {
      const [clientesRes, terapeutasRes, serviciosRes, recursosRes, metodosPagoRes] = await Promise.all([
        supabase.from('clientes').select('id, nombre').order('nombre', { ascending: true }),

        supabase
          .from('empleados')
          .select('id, nombre, comision_cita_porcentaje')
          .eq('rol', 'terapeuta')
          .eq('estado', 'activo')
          .order('nombre', { ascending: true }),

        supabase.from('servicios').select('*').eq('estado', 'activo').order('nombre', { ascending: true }),

        supabase.from('recursos').select('id, nombre, estado').order('nombre', { ascending: true }),

        supabase
          .from('metodos_pago')
          .select('id, nombre, tipo')
          .eq('estado', 'activo')
          .order('nombre', { ascending: true }),
      ])

      if (clientesRes.error) throw new Error(`Clientes: ${clientesRes.error.message}`)
      if (terapeutasRes.error) throw new Error(`Terapeutas: ${terapeutasRes.error.message}`)
      if (serviciosRes.error) throw new Error(`Servicios: ${serviciosRes.error.message}`)
      if (recursosRes.error) throw new Error(`Recursos: ${recursosRes.error.message}`)
      if (metodosPagoRes.error) throw new Error(`Métodos de pago: ${metodosPagoRes.error.message}`)

      const clientesData = (clientesRes.data || []) as Cliente[]
      const terapeutasData = (terapeutasRes.data || []) as Terapeuta[]
      const serviciosRaw = (serviciosRes.data || []) as ServicioRaw[]
      const recursosData = ((recursosRes.data || []) as Recurso[]).filter((r) => r.estado !== 'inactivo')
      const metodosPagoData = (metodosPagoRes.data || []) as MetodoPago[]

      const serviciosData: Servicio[] = serviciosRaw
        .filter((s) => s.estado !== 'inactivo')
        .map((s) => ({
          id: s.id,
          nombre: s.nombre,
          precio: s.precio ?? null,
          estado: s.estado ?? null,
          duracion_min: getServicioDuracion(s),
        }))

      setClientes(clientesData)
      setTerapeutas(terapeutasData)
      setServicios(serviciosData)
      setRecursos(recursosData)
      setMetodosPago(metodosPagoData)
    } catch (err: any) {
      console.error('Error cargando formulario de cita:', err)
      setError(err?.message || 'No se pudo cargar el formulario.')
      setClientes([])
      setTerapeutas([])
      setServicios([])
      setRecursos([])
      setMetodosPago([])
    } finally {
      setLoadingData(false)
    }
  }

  const montoCobroUSD = useMemo(() => {
    if (esBs) {
      if (montoBsPersonalizado && tasaCongelada && tasaCongelada > 0) {
        return r2(montoBsPersonalizado / tasaCongelada)
      }
      return r2(Number(montoPersonalizado || 0))
    }

    return usarPrecioServicio
      ? r2(servicioSeleccionado?.precio || 0)
      : r2(Number(montoPersonalizado || 0))
  }, [esBs, montoBsPersonalizado, tasaCongelada, montoPersonalizado, usarPrecioServicio, servicioSeleccionado])

  const montoCobroBs = useMemo(() => {
    if (esBs) {
      if (montoBsPersonalizado) return r2(montoBsPersonalizado)
      if (tasaCongelada && montoCobroUSD > 0) return r2(montoCobroUSD * tasaCongelada)
      return 0
    }

    if (tasaCongelada && montoCobroUSD > 0) {
      return r2(montoCobroUSD * tasaCongelada)
    }

    return 0
  }, [esBs, montoBsPersonalizado, tasaCongelada, montoCobroUSD])

  const monedaPago = esBs ? 'BS' : 'USD'
  const montoPagoFinal = esBs ? montoCobroBs : montoCobroUSD

  const baseComision = useMemo(() => {
    if (Number(montoBaseComision) > 0) return r2(Number(montoBaseComision))
    return r2(servicioSeleccionado?.precio || montoCobroUSD || 0)
  }, [montoBaseComision, servicioSeleccionado, montoCobroUSD])

  const rpmMonto = useMemo(() => r2((baseComision * porcentajeRpm) / 100), [baseComision, porcentajeRpm])
  const terapeutaMonto = useMemo(() => r2(baseComision - rpmMonto), [baseComision, rpmMonto])

  const comisionBalanceOk = useMemo(() => {
    return Math.abs(r2(rpmMonto + terapeutaMonto) - baseComision) < 0.01
  }, [rpmMonto, terapeutaMonto, baseComision])

  const equivalentesPago = useMemo(() => {
    if (!montoPagoFinal || montoPagoFinal <= 0) return null

    if (monedaPago === 'USD') {
      return {
        monto_equivalente_usd: montoPagoFinal,
        monto_equivalente_bs: tasaCongelada ? r2(montoPagoFinal * tasaCongelada) : null,
      }
    }

    return {
      monto_equivalente_usd: tasaCongelada ? r2(montoPagoFinal / tasaCongelada) : null,
      monto_equivalente_bs: montoPagoFinal,
    }
  }, [montoPagoFinal, monedaPago, tasaCongelada])

  const comisionEquivalentes = useMemo(() => {
    if (!tasaCongelada || tasaCongelada <= 0) {
      return {
        monto_base_usd: baseComision,
        monto_base_bs: null,
        monto_rpm_usd: rpmMonto,
        monto_rpm_bs: null,
        monto_profesional_usd: terapeutaMonto,
        monto_profesional_bs: null,
      }
    }

    return {
      monto_base_usd: baseComision,
      monto_base_bs: r2(baseComision * tasaCongelada),
      monto_rpm_usd: rpmMonto,
      monto_rpm_bs: r2(rpmMonto * tasaCongelada),
      monto_profesional_usd: terapeutaMonto,
      monto_profesional_bs: r2(terapeutaMonto * tasaCongelada),
    }
  }, [baseComision, rpmMonto, terapeutaMonto, tasaCongelada])

  async function guardar() {
    if (!form.cliente_id || !form.terapeuta_id || !form.servicio_id || !form.fecha || !form.hora_inicio) {
      alert('Completa cliente, terapeuta, servicio, fecha y selecciona una hora en el calendario.')
      return
    }

    if (!form.hora_fin) {
      alert('No se pudo calcular la hora final.')
      return
    }

    if (cobrarAhora && form.estado === 'cancelada') {
      alert('No se puede cobrar una cita cancelada.')
      return
    }

    if (cobrarAhora) {
      if (!metodoPagoId) {
        alert('Selecciona un método de pago.')
        return
      }

      if (!montoPagoFinal || montoPagoFinal <= 0) {
        alert('El monto debe ser mayor a 0.')
        return
      }

      if (esBs && (!tasaCongelada || tasaCongelada <= 0)) {
        alert('Debes seleccionar una tasa BCV para pagos en Bolívares.')
        return
      }

      if (baseComision <= 0) {
        alert('La base de comisión debe ser mayor a 0.')
        return
      }

      if (porcentajeRpm < 0 || porcentajeRpm > 100) {
        alert('El % RPM debe estar entre 0 y 100.')
        return
      }

      if (!comisionBalanceOk) {
        alert('La distribución de comisión no cuadra correctamente.')
        return
      }
    }

    setLoading(true)

    try {
      if (form.recurso_id) {
        const { data: conflictoRecurso, error: errorRecurso } = await supabase
          .from('citas')
          .select('id')
          .eq('recurso_id', form.recurso_id)
          .eq('fecha', form.fecha)
          .neq('estado', 'cancelada')
          .lt('hora_inicio', form.hora_fin)
          .gt('hora_fin', form.hora_inicio)
          .limit(1)

        if (errorRecurso) throw new Error(`Error validando recurso: ${errorRecurso.message}`)
        if (conflictoRecurso && conflictoRecurso.length > 0) {
          alert('Ese recurso ya está ocupado en ese horario.')
          setLoading(false)
          return
        }
      }

      const { data: conflictoTerapeuta, error: errorTerapeuta } = await supabase
        .from('citas')
        .select('id')
        .eq('terapeuta_id', form.terapeuta_id)
        .eq('fecha', form.fecha)
        .neq('estado', 'cancelada')
        .lt('hora_inicio', form.hora_fin)
        .gt('hora_fin', form.hora_inicio)
        .limit(1)

      if (errorTerapeuta) throw new Error(`Error validando terapeuta: ${errorTerapeuta.message}`)
      if (conflictoTerapeuta && conflictoTerapeuta.length > 0) {
        alert('Ese terapeuta ya tiene una cita en ese horario.')
        setLoading(false)
        return
      }

      const payload = {
        cliente_id: form.cliente_id,
        terapeuta_id: form.terapeuta_id,
        servicio_id: form.servicio_id,
        recurso_id: form.recurso_id || null,
        fecha: form.fecha,
        hora_inicio: form.hora_inicio.length === 5 ? `${form.hora_inicio}:00` : form.hora_inicio,
        hora_fin: form.hora_fin,
        estado: form.estado,
        notas: form.notas || null,
      }

      const { data: citaData, error: citaError } = await supabase
        .from('citas')
        .insert(payload)
        .select('id')
        .single()

      if (citaError) {
        if (citaError.code === '23505') {
          throw new Error('Ya existe un registro duplicado. Verifica los datos.')
        }
        throw new Error(citaError.message || 'No se pudo crear la cita.')
      }

      const citaId = citaData.id

      if (cobrarAhora && servicioSeleccionado) {
        const cliente = clientes.find((c) => c.id === form.cliente_id)

        const pagoPayload = {
          fecha: form.fecha,
          tipo_origen: 'cita',
          cliente_id: form.cliente_id,
          cita_id: citaId,
          concepto: esBs
            ? `${servicioSeleccionado.nombre} - ${cliente?.nombre || 'Cliente'} (${formatMoney(
                equivalentesPago?.monto_equivalente_usd || 0
              )} × ${tasaCongelada} = ${formatBs(montoPagoFinal)})`
            : `${servicioSeleccionado.nombre} - ${cliente?.nombre || 'Cliente'}`,
          categoria: 'cita',
          monto: montoPagoFinal,
          monto_pago: montoPagoFinal,
          moneda_pago: monedaPago,
          tasa_bcv: tasaCongelada,
          monto_equivalente_usd: equivalentesPago?.monto_equivalente_usd || null,
          monto_equivalente_bs: equivalentesPago?.monto_equivalente_bs || null,
          metodo_pago_id: metodoPagoId,
          estado: 'pagado',
          referencia: referenciaPago || null,
          notas: notasPago || null,
        }

        const { error: pagoError } = await supabase.from('pagos').insert(pagoPayload)
        if (pagoError) {
          if (pagoError.code === '23505') {
            throw new Error('Ya existe un pago registrado para esta cita.')
          }
          throw new Error(`Error creando pago: ${pagoError.message}`)
        }

        const comisionPayload = {
          empleado_id: form.terapeuta_id,
          cliente_id: form.cliente_id,
          cita_id: citaId,
          servicio_id: form.servicio_id,
          fecha: form.fecha,
          tipo: 'cita',
          estado: 'pendiente',
          pagado: false,
          base: baseComision,
          rpm: rpmMonto,
          profesional: terapeutaMonto,
          moneda: monedaPago,
          tasa_bcv: tasaCongelada,
          porcentaje_rpm: porcentajeRpm,
          monto_base_usd: comisionEquivalentes.monto_base_usd,
          monto_base_bs: comisionEquivalentes.monto_base_bs,
          monto_rpm_usd: comisionEquivalentes.monto_rpm_usd,
          monto_rpm_bs: comisionEquivalentes.monto_rpm_bs,
          monto_profesional_usd: comisionEquivalentes.monto_profesional_usd,
          monto_profesional_bs: comisionEquivalentes.monto_profesional_bs,
        }

        const { error: comisionError } = await supabase.from('comisiones_detalle').insert(comisionPayload)
        if (comisionError) {
          if (comisionError.code === '23505') {
            throw new Error('Ya existe una comisión registrada para esta cita.')
          }
          throw new Error(`Error creando comisión: ${comisionError.message}`)
        }
      }

      router.push('/admin/operaciones/agenda')
    } catch (err: any) {
      console.error(err)
      alert(err?.message || 'No se pudo crear la cita.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Agenda</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Nueva cita
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Crear una cita y registrar cobro/comisión en el mismo flujo.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            title="Ver agenda"
            description="Volver al listado general de citas."
            href="/admin/operaciones/agenda"
          />
          <ActionCard
            title="Cancelar"
            description="Salir sin guardar cambios."
            href="/admin/operaciones/agenda"
          />
        </div>
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      <Section
        title="Formulario de cita"
        description="Selecciona cliente, terapeuta, servicio, horario, estado y notas."
      >
        {loadingData ? (
          <Card className="p-6">
            <p className="text-sm text-white/55">Cargando formulario...</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Cliente">
              <select
                value={form.cliente_id}
                onChange={(e) => setForm({ ...form, cliente_id: e.target.value })}
                className={inputClassName}
              >
                <option value="" className="bg-[#11131a] text-white">
                  Seleccionar cliente
                </option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#11131a] text-white">
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Terapeuta">
              <select
                value={form.terapeuta_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    terapeuta_id: e.target.value,
                    hora_inicio: '',
                    hora_fin: '',
                  })
                }
                className={inputClassName}
              >
                <option value="" className="bg-[#11131a] text-white">
                  Seleccionar terapeuta
                </option>
                {terapeutas.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#11131a] text-white">
                    {t.nombre} {t.comision_cita_porcentaje ? `(${t.comision_cita_porcentaje}% terapeuta)` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Servicio"
              helper={
                servicios.length === 0
                  ? 'No se encontraron servicios activos.'
                  : `${servicios.length} servicio(s) disponible(s).`
              }
            >
              <select
                value={form.servicio_id}
                onChange={(e) => {
                  const servicioId = e.target.value
                  const servicio = servicios.find((s) => s.id === servicioId) || null

                  setForm((prev) => ({
                    ...prev,
                    servicio_id: servicioId,
                    hora_inicio: '',
                    hora_fin: '',
                  }))

                  if (servicio?.precio && usarPrecioServicio) {
                    setMontoPersonalizado(String(servicio.precio))
                  }

                  if (servicio?.precio && !montoBaseComision) {
                    setMontoBaseComision(String(servicio.precio))
                  }
                }}
                className={inputClassName}
              >
                <option value="" className="bg-[#11131a] text-white">
                  Seleccionar servicio
                </option>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#11131a] text-white">
                    {s.nombre} {s.duracion_min ? `· ${s.duracion_min} min` : ''} {s.precio ? `· $${s.precio}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Recurso">
              <select
                value={form.recurso_id}
                onChange={(e) => setForm({ ...form, recurso_id: e.target.value })}
                className={inputClassName}
              >
                <option value="" className="bg-[#11131a] text-white">
                  Sin recurso
                </option>
                {recursos.map((r) => (
                  <option key={r.id} value={r.id} className="bg-[#11131a] text-white">
                    {r.nombre}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Fecha">
              <input
                type="date"
                value={form.fecha}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    fecha: e.target.value,
                    hora_inicio: '',
                    hora_fin: '',
                  }))
                }
                className={inputClassName}
              />
            </Field>

            <Field
              label="Estado"
              helper="Programada, confirmada, reprogramada y completada reservan sesión. Cancelada no."
            >
              <select
                value={form.estado}
                onChange={(e) => setForm({ ...form, estado: e.target.value })}
                className={inputClassName}
              >
                <option value="programada" className="bg-[#11131a] text-white">
                  Programada
                </option>
                <option value="confirmada" className="bg-[#11131a] text-white">
                  Confirmada
                </option>
                <option value="reprogramada" className="bg-[#11131a] text-white">
                  Reprogramada
                </option>
                <option value="completada" className="bg-[#11131a] text-white">
                  Completada
                </option>
                <option value="cancelada" className="bg-[#11131a] text-white">
                  Cancelada
                </option>
              </select>
            </Field>

            <div className="md:col-span-2">
              <DisponibilidadTerapeuta
                terapeutaId={form.terapeuta_id}
                fecha={form.fecha}
                duracion={servicioSeleccionado?.duracion_min || null}
                horaSeleccionada={form.hora_inicio}
                onSelect={(inicio, fin) => {
                  setForm((prev) => ({
                    ...prev,
                    hora_inicio: inicio,
                    hora_fin: fin,
                  }))
                }}
              />
            </div>

            <Field label="Hora inicio">
              <input
                type="text"
                value={form.hora_inicio ? form.hora_inicio.slice(0, 5) : ''}
                readOnly
                className={`${inputClassName} cursor-not-allowed opacity-70`}
                placeholder="Selecciona en el calendario"
              />
            </Field>

            <Field
              label="Hora fin"
              helper={
                servicioSeleccionado?.duracion_min
                  ? `Se calcula en base a ${servicioSeleccionado.duracion_min} min.`
                  : 'Selecciona un servicio para calcular la duración.'
              }
            >
              <input
                type="text"
                value={form.hora_fin ? form.hora_fin.slice(0, 5) : ''}
                readOnly
                className={`${inputClassName} cursor-not-allowed opacity-70`}
                placeholder="Automático"
              />
            </Field>

            <div className="md:col-span-2">
              <Field label="Notas">
                <textarea
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={4}
                  className={`${inputClassName} resize-none`}
                  placeholder="Notas opcionales..."
                />
              </Field>
            </div>
          </div>
        )}
      </Section>

      <Section
        title="Cobro de cita"
        description="Configura el pago de la cita si se realizará ahora."
      >
        <Card className="p-6">
          <div className="space-y-4">
            <Field label="Cobrar ahora">
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={!cobrarAhora}
                    onChange={() => setCobrarAhora(false)}
                    className="h-4 w-4"
                  />
                  <span className="text-white/75">No</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={cobrarAhora}
                    onChange={() => setCobrarAhora(true)}
                    className="h-4 w-4"
                  />
                  <span className="text-white/75">Sí</span>
                </label>
              </div>
            </Field>

            {cobrarAhora && (
              <div className="grid gap-4 border-t border-white/10 pt-4 md:grid-cols-2">
                <Field label="Método de pago">
                  <select
                    value={metodoPagoId}
                    onChange={(e) => setMetodoPagoId(e.target.value)}
                    className={inputClassName}
                  >
                    <option value="" className="bg-[#11131a] text-white">
                      Seleccionar método
                    </option>
                    {metodosPago.map((mp) => (
                      <option key={mp.id} value={mp.id} className="bg-[#11131a] text-white">
                        {mp.nombre}{mp.tipo ? ` · ${mp.tipo}` : ''}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Monto" helper={usarPrecioServicio ? 'Precio del servicio' : 'Monto personalizado'}>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={usarPrecioServicio ? (servicioSeleccionado?.precio ?? '') : montoPersonalizado}
                      readOnly={usarPrecioServicio}
                      onChange={(e) => setMontoPersonalizado(e.target.value)}
                      className={`${inputClassName} ${usarPrecioServicio ? 'cursor-not-allowed opacity-60' : ''}`}
                      placeholder="0.00"
                    />
                    <button
                      type="button"
                      onClick={() => setUsarPrecioServicio((p) => !p)}
                      className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white/60 hover:bg-white/[0.06]"
                    >
                      {usarPrecioServicio ? 'Editar' : 'Servicio'}
                    </button>
                  </div>
                </Field>

                {esBs && (
                  <div className="md:col-span-2">
                    <SelectorTasaBCV
                      fecha={form.fecha}
                      monedaPago="BS"
                      montoUSD={usarPrecioServicio ? Number(servicioSeleccionado?.precio || 0) : Number(montoPersonalizado || 0)}
                      montoBs={montoBsPersonalizado || undefined}
                      onTasaChange={setTasaCongelada}
                      onMontoBsChange={(monto) => {
                        setMontoBsPersonalizado(monto)
                        if (monto > 0 && tasaCongelada) {
                          setUsarPrecioServicio(false)
                          setMontoPersonalizado(String(r2(monto / tasaCongelada)))
                        }
                      }}
                    />
                  </div>
                )}

                <Field label="Referencia (opcional)">
                  <input
                    type="text"
                    value={referenciaPago}
                    onChange={(e) => setReferenciaPago(e.target.value)}
                    className={inputClassName}
                    placeholder="N° de referencia o comprobante"
                  />
                </Field>

                <div className="md:col-span-2">
                  <Field label="Notas de pago (opcional)">
                    <textarea
                      value={notasPago}
                      onChange={(e) => setNotasPago(e.target.value)}
                      rows={3}
                      className={`${inputClassName} resize-none`}
                      placeholder="Notas adicionales sobre el pago..."
                    />
                  </Field>
                </div>

                <div className="md:col-span-2 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-sm font-medium text-white/75">Resumen de cobro</p>
                  <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-white/45">Moneda</p>
                      <p className="text-white">{monedaPago}</p>
                    </div>
                    <div>
                      <p className="text-xs text-white/45">Monto cobrado</p>
                      <p className="text-white">
                        {esBs ? formatBs(montoPagoFinal) : formatMoney(montoPagoFinal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/45">Equivalente USD</p>
                      <p className="text-white">{formatMoney(equivalentesPago?.monto_equivalente_usd || 0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </Section>

      {cobrarAhora && (
        <Section
          title="Configuración de comisión"
          description="Más alineado al flujo de Clientes nuevo."
        >
          <Card className="p-6">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Precio oficial / base comisión"
                  helper={`Servicio: ${servicioSeleccionado?.precio ? `$${servicioSeleccionado.precio}` : '$0.00'}`}
                >
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={montoBaseComision || servicioSeleccionado?.precio || ''}
                    onChange={(e) => setMontoBaseComision(e.target.value)}
                    className={inputClassName}
                    placeholder="0.00"
                  />
                </Field>

                <Field label="% RPM sobre precio oficial">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="1"
                    value={porcentajeRpm}
                    onChange={(e) => setPorcentajeRpm(Number(e.target.value))}
                    className={inputClassName}
                  />
                </Field>
              </div>

              {(() => {
                const advertencia =
                  porcentajeRpm > 70
                    ? `⚠️ El % RPM es muy alto (${porcentajeRpm}%). ¿Seguro?`
                    : terapeutaMonto < 0
                    ? '⚠️ El terapeuta quedaría en negativo. Revisa los valores.'
                    : baseComision <= 0
                    ? '⚠️ Ingresa una base de comisión válida.'
                    : null

                return (
                  <div className="space-y-3">
                    {advertencia && (
                      <p className="text-xs font-medium text-amber-400">{advertencia}</p>
                    )}

                    <div className="grid grid-cols-2 gap-3 rounded-xl bg-white/[0.03] p-3 text-sm">
                      <div>
                        <p className="text-xs text-white/35">RPM recibe</p>
                        <p className="font-semibold text-violet-400">${rpmMonto.toFixed(2)}</p>
                        <p className="text-xs text-white/25">{porcentajeRpm}% de ${baseComision.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/35">Terapeuta recibe</p>
                        <p className={`font-semibold ${terapeutaMonto < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          ${terapeutaMonto.toFixed(2)}
                        </p>
                        <p className="text-xs text-white/25">{(100 - porcentajeRpm).toFixed(0)}% de ${baseComision.toFixed(2)}</p>
                      </div>
                    </div>

                    {baseComision > 0 && (
                      <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="bg-violet-500/70 transition-all"
                          style={{ width: `${Math.min(porcentajeRpm, 100)}%` }}
                        />
                        <div className="flex-1 bg-emerald-500/70" />
                      </div>
                    )}

                    {!comisionBalanceOk && (
                      <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                        <p className="text-sm text-rose-400">
                          La suma de la comisión no coincide con la base.
                        </p>
                      </div>
                    )}

                    {tasaCongelada ? (
                      <div className="grid gap-2 border-t border-white/10 pt-4 text-sm md:grid-cols-3">
                        <div>
                          <span className="text-white/55">Base en Bs: </span>
                          <span className="text-white/75">
                            {formatBs(comisionEquivalentes.monto_base_bs || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/55">RPM en Bs: </span>
                          <span className="text-white/75">
                            {formatBs(comisionEquivalentes.monto_rpm_bs || 0)}
                          </span>
                        </div>
                        <div>
                          <span className="text-white/55">Terapeuta en Bs: </span>
                          <span className="text-white/75">
                            {formatBs(comisionEquivalentes.monto_profesional_bs || 0)}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })()}
            </div>
          </Card>
        </Section>
      )}

      <Section
        title="Resumen"
        description="Verifica los datos antes de guardar."
      >
        <Card className="p-6">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/55">Cliente:</span>
              <span className="text-white/75">{clientes.find((c) => c.id === form.cliente_id)?.nombre || 'No seleccionado'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/55">Terapeuta:</span>
              <span className="text-white/75">{terapeutas.find((t) => t.id === form.terapeuta_id)?.nombre || 'No seleccionado'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/55">Servicio:</span>
              <span className="text-white/75">{servicioSeleccionado?.nombre || 'No seleccionado'}</span>
            </div>
            {servicioSeleccionado?.precio ? (
              <div className="flex justify-between">
                <span className="text-white/55">Precio base:</span>
                <span className="text-white/75">${servicioSeleccionado.precio}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-white/55">Fecha:</span>
              <span className="text-white/75">{form.fecha || 'No seleccionada'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/55">Hora:</span>
              <span className="text-white/75">
                {form.hora_inicio ? `${form.hora_inicio.slice(0, 5)} - ${form.hora_fin?.slice(0, 5)}` : 'No seleccionada'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/55">Estado:</span>
              <span className="text-white/75">{form.estado || 'No seleccionado'}</span>
            </div>

            {cobrarAhora && (
              <>
                <div className="my-2 border-t border-white/10"></div>
                <div className="flex justify-between">
                  <span className="text-white/55">Cobro:</span>
                  <span className="text-white/75">Sí</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Moneda:</span>
                  <span className="text-white/75">{monedaPago}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Monto cobrado:</span>
                  <span className="text-white/75">
                    {esBs ? formatBs(montoPagoFinal) : formatMoney(montoPagoFinal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Base comisión (USD):</span>
                  <span className="text-white/75">${baseComision.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">RPM recibe (USD):</span>
                  <span className="text-white/75">${rpmMonto.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Terapeuta recibe (USD):</span>
                  <span className="text-white/75">${terapeutaMonto.toFixed(2)}</span>
                </div>
                {tasaCongelada ? (
                  <>
                    <div className="flex justify-between text-xs text-white/45">
                      <span className="text-white/55">Tasa BCV:</span>
                      <span className="text-white/55">Bs. {tasaCongelada.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-white/45">
                      <span className="text-white/55">Equivalente Bs base comisión:</span>
                      <span className="text-white/55">{formatBs(comisionEquivalentes.monto_base_bs || 0)}</span>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>
        </Card>
      </Section>

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={guardar}
          disabled={
            loading ||
            servicios.length === 0 ||
            !form.hora_inicio ||
            (cobrarAhora && (!comisionBalanceOk || baseComision <= 0 || porcentajeRpm < 0 || porcentajeRpm > 100))
          }
          className="
            rounded-2xl border border-white/10 bg-white/[0.08]
            px-5 py-3 text-sm font-semibold text-white transition
            hover:bg-white/[0.12] disabled:opacity-60
          "
        >
          {loading ? 'Guardando...' : 'Guardar cita'}
        </button>

        <button
          type="button"
          onClick={() => router.push('/admin/operaciones/agenda')}
          className="
            rounded-2xl border border-white/10 bg-white/[0.03]
            px-5 py-3 text-sm font-semibold text-white/80 transition
            hover:bg-white/[0.06]
          "
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}