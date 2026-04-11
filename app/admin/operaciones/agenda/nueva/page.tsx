'use client'

export const dynamic = 'force-dynamic'

import {
  Suspense,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'
import SelectorTasaBCV from '@/components/finanzas/SelectorTasaBCV'
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
  comision_base?: number | null
  comision_rpm?: number | null
  comision_entrenador?: number | null
  [key: string]: any
}

type Servicio = {
  id: string
  nombre: string
  precio: number | null
  duracion_min: number | null
  estado?: string | null
  color?: string | null
  comision_base: number | null
  comision_rpm: number | null
  comision_entrenador: number | null
}

type Recurso = {
  id: string
  nombre: string
  estado: string | null
  capacidad: number | null
  hora_inicio: string | null
  hora_fin: string | null
}

type MetodoPago = {
  id: string
  nombre: string
  tipo?: string | null
  moneda?: string | null
  color?: string | null
  icono?: string | null
  cartera?: {
    nombre: string
    codigo: string
  } | null
}

type ClientePlan = {
  id: string
  cliente_id: string
  plan_id: string
  sesiones_totales: number
  sesiones_usadas: number
  estado: string
  fecha_inicio: string | null
  fecha_fin: string | null
  planes?: {
    nombre: string
  } | null
}

type ValidacionCita = {
  disponible: boolean
  motivo: string
  conflicto_terapeuta?: boolean
  conflicto_cliente?: boolean
  conflictos_recurso?: number
  capacidad_recurso?: number
  recurso_estado?: string | null
  recurso_hora_inicio?: string | null
  recurso_hora_fin?: string | null
  detalle?: {
    tipo?: string
    motivo?: string
    detalle?: string
    hora_inicio?: string | null
    hora_fin?: string | null
  } | null
}

type PagoMixtoItem = {
  id_local: string
  moneda_pago: 'USD' | 'BS'
  metodo_pago_v2_id: string
  monto_usd: string
  monto_bs: number | null
  tasa_bcv: number | null
  referencia: string
  notas: string
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeMetodoPago(row: any): MetodoPago {
  const cartera = firstOrNull(row?.cartera)

  return {
    id: String(row?.id ?? ''),
    nombre: String(row?.nombre ?? ''),
    tipo: row?.tipo ?? null,
    moneda: row?.moneda ?? null,
    color: row?.color ?? null,
    icono: row?.icono ?? null,
    cartera: cartera
      ? {
          nombre: String(cartera?.nombre ?? ''),
          codigo: String(cartera?.codigo ?? ''),
        }
      : null,
  }
}

function normalizeClientePlan(row: any): ClientePlan {
  const plan = firstOrNull(row?.planes)

  return {
    id: String(row?.id ?? ''),
    cliente_id: String(row?.cliente_id ?? ''),
    plan_id: String(row?.plan_id ?? ''),
    sesiones_totales: Number(row?.sesiones_totales || 0),
    sesiones_usadas: Number(row?.sesiones_usadas || 0),
    estado: String(row?.estado ?? ''),
    fecha_inicio: row?.fecha_inicio ?? null,
    fecha_fin: row?.fecha_fin ?? null,
    planes: plan
      ? {
          nombre: String(plan?.nombre ?? ''),
        }
      : null,
  }
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

function toMinutes(hora: string | null | undefined) {
  if (!hora) return null
  const limpia = hora.slice(0, 5)
  const [h, m] = limpia.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}

function formatHoraCorta(hora: string | null | undefined) {
  if (!hora) return '—'
  return hora.slice(0, 5)
}

function buildErrorFromValidacion(validacion: ValidacionCita | null | undefined) {
  if (!validacion) return 'No se pudo validar la disponibilidad.'

  switch (validacion.motivo) {
    case 'ok':
      return ''
    case 'empleado_bloqueado':
      return (
        validacion.detalle?.detalle ||
        validacion.detalle?.motivo ||
        'El fisioterapeuta no está disponible en ese horario.'
      )
    case 'conflicto_terapeuta':
      return 'Ese fisioterapeuta ya tiene una cita en ese horario.'
    case 'conflicto_cliente':
      return 'Ese cliente ya tiene una cita en ese horario.'
    case 'conflicto_recurso':
      return validacion.capacidad_recurso && validacion.capacidad_recurso > 1
        ? `Ese recurso ya alcanzó su capacidad máxima (${validacion.capacidad_recurso}) en ese horario.`
        : 'Ese recurso ya está ocupado en ese horario.'
    case 'recurso_inactivo':
      return 'Ese recurso está inactivo.'
    case 'recurso_mantenimiento':
      return 'Ese recurso está en mantenimiento.'
    case 'fuera_horario_recurso_inicio':
      return `Ese recurso solo está disponible desde las ${formatHoraCorta(validacion.recurso_hora_inicio)}.`
    case 'fuera_horario_recurso_fin':
      return `Ese recurso solo está disponible hasta las ${formatHoraCorta(validacion.recurso_hora_fin)}.`
    case 'recurso_no_existe':
      return 'El recurso seleccionado no existe.'
    case 'hora_fin_invalida':
      return 'La hora final debe ser mayor que la hora inicial.'
    default:
      return `No se puede guardar la cita (${validacion.motivo}).`
  }
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

const r2 = (v: number | null | undefined) =>
  Math.round(Number(v || 0) * 100) / 100

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

function monedaMetodoEsBs(metodo: MetodoPago | null) {
  if (!metodo) return false

  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const tipo = (metodo.tipo || '').toLowerCase()
  const carteraCodigo = (metodo.cartera?.codigo || '').toLowerCase()

  return (
    moneda === 'BS' ||
    moneda === 'VES' ||
    moneda === 'BOLIVARES' ||
    nombre.includes('bs') ||
    nombre.includes('bolívar') ||
    nombre.includes('bolivar') ||
    nombre.includes('pago movil') ||
    nombre.includes('pago móvil') ||
    nombre.includes('movil') ||
    nombre.includes('móvil') ||
    tipo.includes('pago_movil') ||
    (tipo.includes('transferencia') && moneda === 'VES') ||
    carteraCodigo.includes('bs') ||
    carteraCodigo.includes('ves')
  )
}

function monedaMetodoEsUsd(metodo: MetodoPago | null) {
  if (!metodo) return false

  const moneda = (metodo.moneda || '').toUpperCase()
  const nombre = (metodo.nombre || '').toLowerCase()
  const carteraCodigo = (metodo.cartera?.codigo || '').toLowerCase()

  return (
    moneda === 'USD' ||
    nombre.includes('usd') ||
    nombre.includes('zelle') ||
    nombre.includes('efectivo $') ||
    nombre.includes('efectivo usd') ||
    carteraCodigo.includes('usd')
  )
}

function getPlanDisponible(plan: ClientePlan) {
  const total = Number(plan.sesiones_totales || 0)
  const usadas = Number(plan.sesiones_usadas || 0)
  return Math.max(total - usadas, 0)
}

function getPlanLabel(plan: ClientePlan) {
  const nombre = plan.planes?.nombre || 'Plan'
  const disponibles = getPlanDisponible(plan)
  return `${nombre} · ${disponibles}/${plan.sesiones_totales} disponibles`
}

function makePagoItem(moneda: 'USD' | 'BS' = 'USD'): PagoMixtoItem {
  return {
    id_local: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    moneda_pago: moneda,
    metodo_pago_v2_id: '',
    monto_usd: '',
    monto_bs: null,
    tasa_bcv: null,
    referencia: '',
    notas: '',
  }
}

const PagoBsSelector = memo(function PagoBsSelector({
  fecha,
  montoUsd,
  montoBs,
  onChangeTasa,
  onChangeMontoBs,
}: {
  fecha: string
  montoUsd: number
  montoBs: number | null
  onChangeTasa: (tasa: number | null) => void
  onChangeMontoBs: (monto: number) => void
}) {
  return (
    <SelectorTasaBCV
      fecha={fecha}
      monedaPago="BS"
      monedaReferencia="EUR"
      montoUSD={montoUsd}
      montoBs={montoBs || undefined}
      onTasaChange={onChangeTasa}
      onMontoBsChange={onChangeMontoBs}
    />
  )
})

function NuevaCitaPageFallback() {
  return (
    <div className="space-y-6">
      <Section title="Formulario de cita" description="Cargando vista...">
        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando formulario...</p>
        </Card>
      </Section>
    </div>
  )
}

function NuevaCitaPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clienteInicial = searchParams.get('cliente') || ''

  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [loadingPlanes, setLoadingPlanes] = useState(false)
  const [error, setError] = useState('')
  const [empleadoActualId, setEmpleadoActualId] = useState<string>('')

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])
  const [planesCliente, setPlanesCliente] = useState<ClientePlan[]>([])

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
    tipo_cita: 'recovery',
    cliente_plan_id: '',
  })

  const [usarPrecioServicio, setUsarPrecioServicio] = useState(true)
  const [montoPersonalizado, setMontoPersonalizado] = useState('')
  const [notasPagoGenerales, setNotasPagoGenerales] = useState('')
  const [pagosMixtos, setPagosMixtos] = useState<PagoMixtoItem[]>([makePagoItem('USD')])

  useEffect(() => {
    void loadData()
    void loadEmpleadoActual()
  }, [])

  useEffect(() => {
    setForm((prev) => {
      if (prev.cliente_id || !clienteInicial) return prev
      return {
        ...prev,
        cliente_id: clienteInicial,
      }
    })
  }, [clienteInicial])

  useEffect(() => {
    if (form.cliente_id) {
      void loadPlanesCliente(form.cliente_id)
    } else {
      setPlanesCliente([])
      setForm((prev) => ({
        ...prev,
        cliente_plan_id: '',
        tipo_cita: prev.tipo_cita === 'plan' ? 'independiente' : prev.tipo_cita,
      }))
    }
  }, [form.cliente_id])

  const servicioSeleccionado = useMemo(
    () => servicios.find((s) => s.id === form.servicio_id) || null,
    [servicios, form.servicio_id]
  )

  const planSeleccionado = useMemo(
    () => planesCliente.find((p) => p.id === form.cliente_plan_id) || null,
    [planesCliente, form.cliente_plan_id]
  )

  const recursoSeleccionado = useMemo(
    () => recursos.find((r) => r.id === form.recurso_id) || null,
    [recursos, form.recurso_id]
  )

  useEffect(() => {
    if (!form.hora_inicio || !servicioSeleccionado?.duracion_min) return

    setForm((prev) => ({
      ...prev,
      hora_fin: sumarMinutos(prev.hora_inicio, servicioSeleccionado.duracion_min || 0),
    }))
  }, [form.hora_inicio, servicioSeleccionado])

  useEffect(() => {
    if (form.tipo_cita !== 'plan' && form.cliente_plan_id) {
      setForm((prev) => ({
        ...prev,
        cliente_plan_id: '',
      }))
    }
  }, [form.tipo_cita, form.cliente_plan_id])

  async function resolveEmpleadoActualId(): Promise<string> {
    try {
      const { data, error } = await supabase.auth.getUser()

      if (error) {
        console.warn('No se pudo obtener el usuario auth:', error.message)
        return ''
      }

      const authUserId = data.user?.id
      if (!authUserId) return ''

      const { data: empleadoPorAuth, error: errorPorAuth } = await supabase
        .from('empleados')
        .select('id, nombre, auth_user_id')
        .eq('auth_user_id', authUserId)
        .maybeSingle()

      if (!errorPorAuth && empleadoPorAuth?.id) {
        return String(empleadoPorAuth.id)
      }

      const { data: empleadoPorId, error: errorPorId } = await supabase
        .from('empleados')
        .select('id, nombre')
        .eq('id', authUserId)
        .maybeSingle()

      if (!errorPorId && empleadoPorId?.id) {
        return String(empleadoPorId.id)
      }

      return ''
    } catch {
      return ''
    }
  }

  async function loadEmpleadoActual() {
    const empleadoId = await resolveEmpleadoActualId()
    setEmpleadoActualId(empleadoId)
  }

  async function loadData() {
    setLoadingData(true)
    setError('')

    try {
      const [
        clientesRes,
        terapeutasRes,
        serviciosRes,
        recursosRes,
        metodosPagoRes,
      ] = await Promise.all([
        supabase.from('clientes').select('id, nombre').order('nombre', { ascending: true }),

        supabase
          .from('empleados')
          .select('id, nombre, comision_cita_porcentaje')
          .in('rol', ['terapeuta', 'fisioterapeuta'])
          .eq('estado', 'activo')
          .order('nombre', { ascending: true }),

        supabase
          .from('servicios')
          .select('*')
          .eq('estado', 'activo')
          .order('nombre', { ascending: true }),

        supabase
          .from('recursos')
          .select('id, nombre, estado, capacidad, hora_inicio, hora_fin')
          .order('nombre', { ascending: true }),

        supabase
          .from('metodos_pago_v2')
          .select(`
            id,
            nombre,
            tipo,
            moneda,
            color,
            icono,
            cartera:carteras(nombre, codigo)
          `)
          .eq('activo', true)
          .eq('permite_recibir', true)
          .order('orden', { ascending: true })
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
      const recursosData = ((recursosRes.data || []) as Recurso[]).filter(
        (r) => r.estado !== 'inactivo'
      )
      const metodosPagoData = ((metodosPagoRes.data || []) as any[]).map(normalizeMetodoPago)

      const serviciosData: Servicio[] = serviciosRaw
        .filter((s) => s.estado !== 'inactivo')
        .map((s) => ({
          id: s.id,
          nombre: s.nombre,
          precio: s.precio ?? null,
          estado: s.estado ?? null,
          color: s.color ?? null,
          duracion_min: getServicioDuracion(s),
          comision_base: s.comision_base ?? s.precio ?? 0,
          comision_rpm: s.comision_rpm ?? 0,
          comision_entrenador: s.comision_entrenador ?? 0,
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

  async function loadPlanesCliente(clienteId: string) {
    setLoadingPlanes(true)

    try {
      const { data, error } = await supabase
        .from('clientes_planes')
        .select(`
          id,
          cliente_id,
          plan_id,
          sesiones_totales,
          sesiones_usadas,
          estado,
          fecha_inicio,
          fecha_fin,
          planes(nombre)
        `)
        .eq('cliente_id', clienteId)
        .in('estado', ['activo', 'agotado'])
        .order('created_at', { ascending: false })

      if (error) throw error

      const planes = ((data || []) as any[]).map(normalizeClientePlan)
      const conDisponibles = planes.filter((p) => getPlanDisponible(p) > 0)

      setPlanesCliente(conDisponibles)

      setForm((prev) => {
        const planExiste = conDisponibles.some((p) => p.id === prev.cliente_plan_id)

        return {
          ...prev,
          cliente_plan_id: planExiste ? prev.cliente_plan_id : '',
          tipo_cita:
            prev.tipo_cita === 'plan' && conDisponibles.length === 0
              ? 'independiente'
              : prev.tipo_cita,
        }
      })
    } catch (err) {
      console.error('Error cargando planes del cliente:', err)
      setPlanesCliente([])
      setForm((prev) => ({
        ...prev,
        cliente_plan_id: '',
        tipo_cita: prev.tipo_cita === 'plan' ? 'independiente' : prev.tipo_cita,
      }))
    } finally {
      setLoadingPlanes(false)
    }
  }

  const precioServicioUsd = useMemo(
    () => r2(servicioSeleccionado?.precio || 0),
    [servicioSeleccionado]
  )

  const montoObjetivoUsd = useMemo(() => {
    return usarPrecioServicio
      ? precioServicioUsd
      : r2(Number(montoPersonalizado || 0))
  }, [usarPrecioServicio, precioServicioUsd, montoPersonalizado])

  const baseComisionOriginal = useMemo(() => {
    return r2(servicioSeleccionado?.comision_base ?? servicioSeleccionado?.precio ?? 0)
  }, [servicioSeleccionado])

  const porcentajeRpmServicio = useMemo(() => {
    const base = Number(servicioSeleccionado?.comision_base ?? servicioSeleccionado?.precio ?? 0)
    const rpm = Number(servicioSeleccionado?.comision_rpm ?? 0)
    if (!base) return 0
    return r2((rpm / base) * 100)
  }, [servicioSeleccionado])

  const porcentajeTerapeutaServicio = useMemo(() => {
    const base = Number(servicioSeleccionado?.comision_base ?? servicioSeleccionado?.precio ?? 0)
    const profesional = Number(servicioSeleccionado?.comision_entrenador ?? 0)
    if (!base) return 0
    return r2((profesional / base) * 100)
  }, [servicioSeleccionado])

  const baseComisionAplicada = useMemo(() => {
    return usarPrecioServicio ? baseComisionOriginal : montoObjetivoUsd
  }, [usarPrecioServicio, baseComisionOriginal, montoObjetivoUsd])

  const rpmMonto = useMemo(
    () => r2((baseComisionAplicada * porcentajeRpmServicio) / 100),
    [baseComisionAplicada, porcentajeRpmServicio]
  )

  const terapeutaMonto = useMemo(
    () => r2((baseComisionAplicada * porcentajeTerapeutaServicio) / 100),
    [baseComisionAplicada, porcentajeTerapeutaServicio]
  )

  const comisionBalanceOk = useMemo(() => {
    return Math.abs(r2(rpmMonto + terapeutaMonto) - baseComisionAplicada) < 0.01
  }, [rpmMonto, terapeutaMonto, baseComisionAplicada])

  const comisionEquivalentes = useMemo(() => {
    const tasaReferenciaBs =
      pagosMixtos.find((p) => p.moneda_pago === 'BS' && (p.tasa_bcv || 0) > 0)?.tasa_bcv || null

    if (!tasaReferenciaBs || tasaReferenciaBs <= 0) {
      return {
        monto_base_usd: baseComisionAplicada,
        monto_base_bs: null,
        monto_rpm_usd: rpmMonto,
        monto_rpm_bs: null,
        monto_profesional_usd: terapeutaMonto,
        monto_profesional_bs: null,
      }
    }

    return {
      monto_base_usd: baseComisionAplicada,
      monto_base_bs: r2(baseComisionAplicada * tasaReferenciaBs),
      monto_rpm_usd: rpmMonto,
      monto_rpm_bs: r2(rpmMonto * tasaReferenciaBs),
      monto_profesional_usd: terapeutaMonto,
      monto_profesional_bs: r2(terapeutaMonto * tasaReferenciaBs),
    }
  }, [baseComisionAplicada, rpmMonto, terapeutaMonto, pagosMixtos])

  function getMetodosForMoneda(moneda: 'USD' | 'BS') {
    return moneda === 'USD'
      ? metodosPago.filter((m) => monedaMetodoEsUsd(m))
      : metodosPago.filter((m) => monedaMetodoEsBs(m))
  }

  function updatePagoItem(idLocal: string, patch: Partial<PagoMixtoItem>) {
    setPagosMixtos((prev) =>
      prev.map((item) => (item.id_local === idLocal ? { ...item, ...patch } : item))
    )
  }

  function addPagoItem(moneda: 'USD' | 'BS' = 'USD') {
    setPagosMixtos((prev) => [...prev, makePagoItem(moneda)])
  }

  function removePagoItem(idLocal: string) {
    setPagosMixtos((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((item) => item.id_local !== idLocal)
    })
  }

  const handlePagoBsTasaChange = useCallback((idLocal: string, tasa: number | null) => {
    setPagosMixtos((prev) =>
      prev.map((item) =>
        item.id_local === idLocal
          ? {
              ...item,
              tasa_bcv: tasa,
            }
          : item
      )
    )
  }, [])

  const handlePagoBsMontoChange = useCallback((idLocal: string, monto: number) => {
    setPagosMixtos((prev) =>
      prev.map((item) =>
        item.id_local === idLocal
          ? {
              ...item,
              monto_bs: monto,
            }
          : item
      )
    )
  }, [])

  const resumenPagos = useMemo(() => {
    const items = pagosMixtos.map((item) => {
      const montoUsdEq =
        item.moneda_pago === 'USD'
          ? r2(Number(item.monto_usd || 0))
          : r2(Number(item.monto_usd || 0))

      const montoBs =
        item.moneda_pago === 'BS'
          ? r2(Number(item.monto_bs || 0))
          : item.tasa_bcv && item.tasa_bcv > 0 && Number(item.monto_usd || 0) > 0
            ? r2(Number(item.monto_usd || 0) * item.tasa_bcv)
            : 0

      return {
        ...item,
        monto_equivalente_usd: montoUsdEq,
        monto_equivalente_bs: montoBs > 0 ? montoBs : null,
        monto_insertar:
          item.moneda_pago === 'BS'
            ? r2(Number(item.monto_bs || 0))
            : r2(Number(item.monto_usd || 0)),
        valido:
          !!item.metodo_pago_v2_id &&
          (
            item.moneda_pago === 'USD'
              ? Number(item.monto_usd || 0) > 0
              : Number(item.monto_usd || 0) > 0 &&
                Number(item.monto_bs || 0) > 0 &&
                Number(item.tasa_bcv || 0) > 0
          ),
      }
    })

    const totalUsd = r2(items.reduce((acc, item) => acc + Number(item.monto_equivalente_usd || 0), 0))
    const totalBs = r2(items.reduce((acc, item) => acc + Number(item.monto_equivalente_bs || 0), 0))
    const diferenciaUsd = r2(montoObjetivoUsd - totalUsd)

    return {
      items,
      totalUsd,
      totalBs,
      diferenciaUsd,
      cuadra: Math.abs(diferenciaUsd) < 0.01 && montoObjetivoUsd > 0,
      todosValidos: items.every((item) => item.valido),
    }
  }, [pagosMixtos, montoObjetivoUsd])

  async function guardar() {
    if (
      !form.cliente_id ||
      !form.terapeuta_id ||
      !form.servicio_id ||
      !form.fecha ||
      !form.hora_inicio
    ) {
      alert(
        'Completa cliente, fisioterapeuta, servicio, fecha y selecciona una hora en el calendario.'
      )
      return
    }

    if (!form.hora_fin) {
      alert('No se pudo calcular la hora final.')
      return
    }

    if (toMinutes(form.hora_inicio) === null || toMinutes(form.hora_fin) === null) {
      alert('La hora seleccionada no es válida.')
      return
    }

    if ((toMinutes(form.hora_fin) || 0) <= (toMinutes(form.hora_inicio) || 0)) {
      alert('La hora final debe ser mayor que la hora inicial.')
      return
    }

    if (form.tipo_cita === 'plan' && !form.cliente_plan_id) {
      alert('Debes seleccionar el plan del cliente.')
      return
    }

    if (form.tipo_cita === 'plan' && planSeleccionado && getPlanDisponible(planSeleccionado) <= 0) {
      alert('Ese plan ya no tiene sesiones disponibles.')
      return
    }

    if (form.estado === 'cancelada') {
      alert('No se puede cobrar una cita cancelada.')
      return
    }

    if (montoObjetivoUsd <= 0) {
      alert('El monto objetivo de la cita debe ser mayor a 0.')
      return
    }

    if (!resumenPagos.todosValidos) {
      alert('Completa correctamente todos los fragmentos del pago mixto.')
      return
    }

    if (!resumenPagos.cuadra) {
      alert(
        `La suma de pagos no cuadra. Objetivo: ${formatMoney(montoObjetivoUsd)} | Registrado: ${formatMoney(
          resumenPagos.totalUsd
        )} | Diferencia: ${formatMoney(resumenPagos.diferenciaUsd)}`
      )
      return
    }

    if (baseComisionAplicada <= 0) {
      alert('La base de comisión debe ser mayor a 0.')
      return
    }

    if (!comisionBalanceOk) {
      alert('La distribución de comisión no cuadra correctamente.')
      return
    }

    setLoading(true)

    try {
      const horaInicioNormalizada =
        form.hora_inicio.length === 5 ? `${form.hora_inicio}:00` : form.hora_inicio

      const horaFinNormalizada =
        form.hora_fin.length === 5 ? `${form.hora_fin}:00` : form.hora_fin

      const { data: validacion, error: validacionError } = await supabase.rpc(
        'validar_disponibilidad_cita',
        {
          p_cliente_id: form.cliente_id,
          p_terapeuta_id: form.terapeuta_id,
          p_recurso_id: form.recurso_id || null,
          p_fecha: form.fecha,
          p_hora_inicio: horaInicioNormalizada,
          p_hora_fin: horaFinNormalizada,
        }
      )

      if (validacionError) {
        throw new Error(`Error validando disponibilidad: ${validacionError.message}`)
      }

      const validacionParsed = validacion as ValidacionCita

      if (!validacionParsed?.disponible) {
        alert(buildErrorFromValidacion(validacionParsed))
        setLoading(false)
        return
      }

      let auditorId = empleadoActualId || ''

      if (!auditorId) {
        auditorId = await resolveEmpleadoActualId()
        setEmpleadoActualId(auditorId)
      }

      const payload = {
        cliente_id: form.cliente_id,
        terapeuta_id: form.terapeuta_id,
        servicio_id: form.servicio_id,
        recurso_id: form.recurso_id || null,
        fecha: form.fecha,
        hora_inicio: horaInicioNormalizada,
        hora_fin: horaFinNormalizada,
        estado: form.estado,
        notas: form.notas || null,
        cliente_plan_id: form.tipo_cita === 'plan' ? form.cliente_plan_id : null,
        created_by: auditorId || null,
        updated_by: auditorId || null,
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
      const cliente = clientes.find((c) => c.id === form.cliente_id)
      const conceptoBase = `${servicioSeleccionado?.nombre || 'Servicio'} - ${cliente?.nombre || 'Cliente'}`
      const conceptoTipo =
        form.tipo_cita === 'plan'
          ? `${conceptoBase} [Plan]`
          : form.tipo_cita === 'recovery'
            ? `${conceptoBase} [Recovery]`
            : `${conceptoBase} [Independiente]`

      const pagosRpcPayload = resumenPagos.items.map((item) => ({
        metodo_pago_v2_id: item.metodo_pago_v2_id,
        moneda_pago: item.moneda_pago,
        monto: item.monto_insertar,
        tasa_bcv: item.moneda_pago === 'BS' ? item.tasa_bcv : item.tasa_bcv || null,
        referencia: item.referencia || null,
        notas: item.notas || null,
      }))

      const { error: pagosMixtosError } = await supabase.rpc('registrar_pagos_mixtos', {
        p_fecha: form.fecha,
        p_tipo_origen: 'cita',
        p_categoria: 'cita',
        p_concepto: conceptoTipo,
        p_cliente_id: form.cliente_id,
        p_cita_id: citaId,
        p_cliente_plan_id: form.tipo_cita === 'plan' ? form.cliente_plan_id : null,
        p_cuenta_cobrar_id: null,
        p_inventario_id: null,
        p_registrado_por: auditorId || null,
        p_notas_generales: notasPagoGenerales || null,
        p_pagos: pagosRpcPayload,
      })

      if (pagosMixtosError) {
        throw new Error(`Error creando pagos mixtos: ${pagosMixtosError.message}`)
      }

      const tasaReferencia =
        resumenPagos.items.find((item) => item.moneda_pago === 'BS' && (item.tasa_bcv || 0) > 0)?.tasa_bcv || null

      const { error: comisionError } = await supabase
        .from('comisiones_detalle')
        .insert({
          empleado_id: form.terapeuta_id,
          cliente_id: form.cliente_id,
          cita_id: citaId,
          servicio_id: form.servicio_id,
          fecha: form.fecha,
          tipo: 'cita',
          estado: 'pendiente',
          pagado: false,
          base: baseComisionAplicada,
          rpm: rpmMonto,
          profesional: terapeutaMonto,
          moneda: tasaReferencia ? 'BS' : 'USD',
          tasa_bcv: tasaReferencia,
          porcentaje_rpm: porcentajeRpmServicio,
          monto_base_usd: comisionEquivalentes.monto_base_usd,
          monto_base_bs: comisionEquivalentes.monto_base_bs,
          monto_rpm_usd: comisionEquivalentes.monto_rpm_usd,
          monto_rpm_bs: comisionEquivalentes.monto_rpm_bs,
          monto_profesional_usd: comisionEquivalentes.monto_profesional_usd,
          monto_profesional_bs: comisionEquivalentes.monto_profesional_bs,
        })

      if (comisionError) {
        if (comisionError.code === '23505') {
          throw new Error('Ya existe una comisión registrada para esta cita.')
        }
        throw new Error(`Error creando comisión: ${comisionError.message}`)
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
            Crear una cita y registrar el pago/comisión en el mismo flujo.
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
        description="Selecciona cliente, fisioterapeuta, servicio, horario, tipo y notas."
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
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    cliente_id: e.target.value,
                    cliente_plan_id: '',
                    hora_inicio: '',
                    hora_fin: '',
                  }))
                }
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

            {form.tipo_cita === 'plan' && (
              <Field
                label="Plan del cliente"
                helper={
                  loadingPlanes
                    ? 'Cargando planes...'
                    : planesCliente.length === 0
                      ? 'Este cliente no tiene planes activos con sesiones disponibles.'
                      : 'Selecciona el plan exacto que debe consumir la sesión.'
                }
              >
                <select
                  value={form.cliente_plan_id}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      cliente_plan_id: e.target.value,
                    }))
                  }
                  className={inputClassName}
                >
                  <option value="" className="bg-[#11131a] text-white">
                    Seleccionar plan
                  </option>
                  {planesCliente.map((plan) => (
                    <option key={plan.id} value={plan.id} className="bg-[#11131a] text-white">
                      {getPlanLabel(plan)}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Fisioterapeuta">
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
                  Seleccionar fisioterapeuta
                </option>
                {terapeutas.map((t) => (
                  <option key={t.id} value={t.id} className="bg-[#11131a] text-white">
                    {t.nombre}
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
                }}
                className={inputClassName}
              >
                <option value="" className="bg-[#11131a] text-white">
                  Seleccionar servicio
                </option>
                {servicios.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#11131a] text-white">
                    {s.nombre}
                    {s.duracion_min ? ` · ${s.duracion_min} min` : ''}
                    {s.precio ? ` · $${s.precio}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Recurso"
              helper={
                recursoSeleccionado
                  ? `Capacidad: ${Number(recursoSeleccionado.capacidad || 1)} · Horario: ${formatHoraCorta(
                      recursoSeleccionado.hora_inicio
                    )} - ${formatHoraCorta(recursoSeleccionado.hora_fin)}`
                  : 'Selecciona un recurso si la cita debe reservar cubículo/equipo.'
              }
            >
              <select
                value={form.recurso_id}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    recurso_id: e.target.value,
                    hora_inicio: '',
                    hora_fin: '',
                  }))
                }
                className={inputClassName}
              >
                <option value="" className="bg-[#11131a] text-white">
                  Sin recurso
                </option>
                {recursos.map((r) => (
                  <option key={r.id} value={r.id} className="bg-[#11131a] text-white">
                    {r.nombre}
                    {r.estado ? ` · ${r.estado}` : ''}
                    {r.capacidad ? ` · cap. ${r.capacidad}` : ''}
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
              helper="Solo la cita completada debe consumir sesión si está ligada a un plan."
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
                clienteId={form.cliente_id}
                recursoId={form.recurso_id}
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
        title="Pago mixto de la cita"
        description="Puedes registrar uno o varios métodos de pago para la misma cita."
      >
        <Card className="p-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Monto objetivo USD" helper={usarPrecioServicio ? 'Usando precio del servicio.' : 'Monto personalizado.'}>
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

            <Field label="Total registrado USD">
              <input
                type="text"
                value={formatMoney(resumenPagos.totalUsd)}
                readOnly
                className={`${inputClassName} cursor-not-allowed opacity-70`}
              />
            </Field>

            <Field label="Diferencia USD">
              <input
                type="text"
                value={formatMoney(resumenPagos.diferenciaUsd)}
                readOnly
                className={`${inputClassName} cursor-not-allowed opacity-70 ${
                  resumenPagos.cuadra ? 'text-emerald-300' : 'text-amber-300'
                }`}
              />
            </Field>

            <div className="md:col-span-3">
              <Field label="Notas generales del pago (opcional)">
                <textarea
                  value={notasPagoGenerales}
                  onChange={(e) => setNotasPagoGenerales(e.target.value)}
                  rows={3}
                  className={`${inputClassName} resize-none`}
                  placeholder="Notas generales que aplican a toda la operación..."
                />
              </Field>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {pagosMixtos.map((item, index) => {
              const metodosDisponibles = getMetodosForMoneda(item.moneda_pago)
              const montoUsdEq = r2(Number(item.monto_usd || 0))

              return (
                <div
                  key={item.id_local}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Fragmento #{index + 1}
                      </p>
                      <p className="text-xs text-white/45">
                        Equivalente USD: {formatMoney(montoUsdEq)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removePagoItem(item.id_local)}
                      disabled={pagosMixtos.length <= 1}
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/70 hover:bg-white/[0.06] disabled:opacity-40"
                    >
                      Quitar
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Moneda">
                      <select
                        value={item.moneda_pago}
                        onChange={(e) =>
                          updatePagoItem(item.id_local, {
                            moneda_pago: e.target.value as 'USD' | 'BS',
                            metodo_pago_v2_id: '',
                            monto_usd: '',
                            monto_bs: null,
                            tasa_bcv: null,
                          })
                        }
                        className={inputClassName}
                      >
                        <option value="USD" className="bg-[#11131a] text-white">
                          USD
                        </option>
                        <option value="BS" className="bg-[#11131a] text-white">
                          Bs
                        </option>
                      </select>
                    </Field>

                    <Field label={item.moneda_pago === 'USD' ? 'Método USD' : 'Método Bs'}>
                      <select
                        value={item.metodo_pago_v2_id}
                        onChange={(e) =>
                          updatePagoItem(item.id_local, {
                            metodo_pago_v2_id: e.target.value,
                          })
                        }
                        className={inputClassName}
                      >
                        <option value="" className="bg-[#11131a] text-white">
                          Seleccionar método
                        </option>
                        {metodosDisponibles.map((mp) => (
                          <option key={mp.id} value={mp.id} className="bg-[#11131a] text-white">
                            {mp.nombre}
                            {mp.moneda ? ` · ${mp.moneda}` : ''}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label={item.moneda_pago === 'USD' ? 'Monto USD' : 'Equivalente USD'}>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.monto_usd}
                        onChange={(e) =>
                          updatePagoItem(item.id_local, {
                            monto_usd: e.target.value,
                          })
                        }
                        className={inputClassName}
                        placeholder="0.00"
                      />
                    </Field>

                    {item.moneda_pago === 'BS' && (
                      <div className="md:col-span-3">
                        <PagoBsSelector
                          fecha={form.fecha}
                          montoUsd={Number(item.monto_usd || 0)}
                          montoBs={item.monto_bs}
                          onChangeTasa={(tasa) => handlePagoBsTasaChange(item.id_local, tasa)}
                          onChangeMontoBs={(monto) => handlePagoBsMontoChange(item.id_local, monto)}
                        />
                      </div>
                    )}

                    <Field label="Referencia (opcional)">
                      <input
                        type="text"
                        value={item.referencia}
                        onChange={(e) =>
                          updatePagoItem(item.id_local, {
                            referencia: e.target.value,
                          })
                        }
                        className={inputClassName}
                        placeholder="N° de referencia"
                      />
                    </Field>

                    <div className="md:col-span-2">
                      <Field label="Notas del fragmento (opcional)">
                        <input
                          type="text"
                          value={item.notas}
                          onChange={(e) =>
                            updatePagoItem(item.id_local, {
                              notas: e.target.value,
                            })
                          }
                          className={inputClassName}
                          placeholder="Notas del fragmento"
                        />
                      </Field>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => addPagoItem('USD')}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
            >
              + Agregar pago USD
            </button>

            <button
              type="button"
              onClick={() => addPagoItem('BS')}
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]"
            >
              + Agregar pago Bs
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm">
            <div className="grid gap-2 md:grid-cols-3">
              <div>
                <span className="text-white/55">Objetivo USD: </span>
                <span className="text-white">{formatMoney(montoObjetivoUsd)}</span>
              </div>
              <div>
                <span className="text-white/55">Total USD: </span>
                <span className="text-white">{formatMoney(resumenPagos.totalUsd)}</span>
              </div>
              <div>
                <span className="text-white/55">Total Bs: </span>
                <span className="text-white">{formatBs(resumenPagos.totalBs)}</span>
              </div>
            </div>

            <p className={`mt-3 text-sm font-medium ${resumenPagos.cuadra ? 'text-emerald-400' : 'text-amber-400'}`}>
              {resumenPagos.cuadra
                ? 'La suma de pagos cuadra correctamente.'
                : `La suma todavía no cuadra. Diferencia: ${formatMoney(resumenPagos.diferenciaUsd)}`}
            </p>
          </div>
        </Card>
      </Section>

      <Section
        title="Configuración de comisión"
        description="La comisión toma el porcentaje fijo del servicio. Si cambias el precio, cambian los montos, no los porcentajes."
      >
        <Card className="p-6">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-4">
              <Field
                label="Precio / base aplicada"
                helper={usarPrecioServicio ? 'Usando base del servicio.' : 'Usando precio editado de la cita.'}
              >
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={String(baseComisionAplicada || '')}
                  readOnly
                  className={`${inputClassName} cursor-not-allowed opacity-80`}
                  placeholder="0.00"
                />
              </Field>

              <Field label="Base original del servicio">
                <input
                  type="text"
                  value={formatMoney(baseComisionOriginal)}
                  readOnly
                  className={`${inputClassName} cursor-not-allowed opacity-80`}
                />
              </Field>

              <Field label="RPM recibe">
                <input
                  type="text"
                  value={`${formatMoney(rpmMonto)} · ${porcentajeRpmServicio}%`}
                  readOnly
                  className={`${inputClassName} cursor-not-allowed opacity-80`}
                />
              </Field>

              <Field label="Fisioterapeuta recibe">
                <input
                  type="text"
                  value={`${formatMoney(terapeutaMonto)} · ${porcentajeTerapeutaServicio}%`}
                  readOnly
                  className={`${inputClassName} cursor-not-allowed opacity-80`}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5">
                <p className="text-sm text-white/60">Base</p>
                <p className="mt-2 text-3xl font-bold text-white">{formatMoney(baseComisionAplicada)}</p>
                <p className="mt-2 text-xs text-white/40">
                  Precio de la cita: {formatMoney(montoObjetivoUsd)}
                </p>
              </div>

              <div className="rounded-[28px] border border-violet-400/15 bg-white/[0.05] p-5">
                <p className="text-sm text-white/60">RPM recibe</p>
                <p className="mt-2 text-3xl font-bold text-violet-400">{formatMoney(rpmMonto)}</p>
                <p className="mt-2 text-sm text-white/50">{porcentajeRpmServicio}%</p>
              </div>

              <div className="rounded-[28px] border border-emerald-400/15 bg-white/[0.05] p-5">
                <p className="text-sm text-white/60">Fisioterapeuta recibe</p>
                <p className="mt-2 text-3xl font-bold text-emerald-400">{formatMoney(terapeutaMonto)}</p>
                <p className="mt-2 text-sm text-white/50">{porcentajeTerapeutaServicio}%</p>
              </div>
            </div>

            {!comisionBalanceOk && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                <p className="text-sm text-rose-400">
                  La suma de la comisión no coincide con la base.
                </p>
              </div>
            )}

            {comisionEquivalentes.monto_base_bs ? (
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
                  <span className="text-white/55">Fisioterapeuta en Bs: </span>
                  <span className="text-white/75">
                    {formatBs(comisionEquivalentes.monto_profesional_bs || 0)}
                  </span>
                </div>
              </div>
            ) : null}
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
            (form.tipo_cita === 'plan' && !form.cliente_plan_id) ||
            !comisionBalanceOk ||
            baseComisionAplicada <= 0
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

export default function NuevaCitaPage() {
  return (
    <Suspense fallback={<NuevaCitaPageFallback />}>
      <NuevaCitaPageContent />
    </Suspense>
  )
}
