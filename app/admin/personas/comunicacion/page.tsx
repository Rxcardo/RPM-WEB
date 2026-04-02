'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'

type Cliente = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  estado: string
  terapeuta_id?: string | null
}

type Comunicacion = {
  id: string
  titulo: string
  asunto: string | null
  mensaje: string
  tipo: 'recordatorio' | 'promocion' | 'seguimiento' | 'aviso'
  canal: 'whatsapp'
  estado: 'borrador' | 'enviado' | 'cancelado'
  destino: string | null
  cliente_id: string | null
  created_at: string
  enviado_at: string | null
}

type FormState = {
  titulo: string
  mensaje: string
  tipo: 'recordatorio' | 'promocion' | 'seguimiento' | 'aviso'
  cliente_id: string
  destino_manual: string
  plantilla: PlantillaWhatsApp | ''
}

type PlantillaWhatsApp =
  | 'recordatorio_cita'
  | 'confirmacion_cita'
  | 'bienvenida_cliente'
  | 'recordatorio_pago'
  | 'plan_por_vencer'
  | 'confirmacion_pago'
  | 'recordatorio_entrenamiento'
  | 'cancelacion_cita'

type DatosPlantilla = {
  nombre: string
  fecha?: string
  hora?: string
  servicio?: string
  terapeuta?: string
  entrenador?: string
  monto?: string
  concepto?: string
  plan?: string
  sesiones?: number
  telefono?: string
  motivo?: string
}

type ServicioRow = {
  id: string
  nombre: string
}

type EmpleadoRow = {
  id: string
  nombre: string
}

type CitaReal = {
  id: string
  fecha: string
  hora_inicio: string
  estado: string
  notas: string | null
  servicio: ServicioRow | ServicioRow[] | null
  terapeuta: EmpleadoRow | EmpleadoRow[] | null
}

type PagoReal = {
  id: string
  concepto: string | null
  monto: number | string | null
  moneda_pago: string | null
  monto_equivalente_usd: number | string | null
  monto_equivalente_bs: number | string | null
  estado: string
  created_at: string
}

type EntrenamientoReal = {
  id: string
  fecha: string
  hora_inicio: string
  estado: string
  entrenador: EmpleadoRow | EmpleadoRow[] | null
}

type PlanReal = {
  id: string
  fecha_inicio: string | null
  fecha_fin: string | null
  sesiones_totales: number
  sesiones_usadas: number
  estado: string
  plan: { id: string; nombre?: string | null } | { id: string; nombre?: string | null }[] | null
}

type AlertState = {
  type: 'error' | 'success' | 'info' | 'warning'
  title: string
  message: string
} | null

const INITIAL_FORM: FormState = {
  titulo: '',
  mensaje: '',
  tipo: 'recordatorio',
  cliente_id: '',
  destino_manual: '',
  plantilla: '',
}

const TIPOS = ['recordatorio', 'promocion', 'seguimiento', 'aviso'] as const

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

const PLANTILLA_LABELS: Record<PlantillaWhatsApp, string> = {
  recordatorio_cita: 'Recordatorio de cita',
  confirmacion_cita: 'Confirmación de cita',
  bienvenida_cliente: 'Bienvenida cliente',
  recordatorio_pago: 'Recordatorio de pago',
  plan_por_vencer: 'Plan por vencer',
  confirmacion_pago: 'Confirmación de pago',
  recordatorio_entrenamiento: 'Recordatorio de entrenamiento',
  cancelacion_cita: 'Cancelación de cita',
}

const PLANTILLAS: Record<PlantillaWhatsApp, (datos: DatosPlantilla) => string> = {
  recordatorio_cita: (datos) =>
    `Hola *${datos.nombre}*, te recordamos tu cita de *${datos.servicio || 'servicio'}* el ${datos.fecha || 'día indicado'} a las *${datos.hora || 'hora indicada'}* en RPM. ¡Te esperamos! 🏥`,

  confirmacion_cita: (datos) =>
    `Hola *${datos.nombre}*, tu cita ha sido agendada para el *${datos.fecha || 'día indicado'}* a las *${datos.hora || 'hora indicada'}*.

📋 Servicio: ${datos.servicio || 'Servicio'}
👨‍⚕️ Terapeuta: ${datos.terapeuta || 'Por confirmar'}

¿Confirmas tu asistencia? Responde SÍ para confirmar.`,

  bienvenida_cliente: (datos) =>
    `¡Bienvenido/a a RPM, *${datos.nombre}*! 🎉

Estamos emocionados de acompañarte en tu proceso de recuperación y bienestar.

👨‍⚕️ Tu terapeuta asignado es: *${datos.terapeuta || 'RPM'}*

Cualquier duda, estamos a tu disposición.`,

  recordatorio_pago: (datos) =>
    `Hola *${datos.nombre}*, te recordamos que tienes un pago pendiente:

💰 Monto: *${datos.monto || 'Monto pendiente'}*
📝 Concepto: ${datos.concepto || 'Pago pendiente'}

Puedes realizar el pago en recepción o mediante transferencia. ¡Gracias!`,

  plan_por_vencer: (datos) =>
    `Hola *${datos.nombre}*, tu plan *${datos.plan || 'activo'}* vence el *${datos.fecha || 'próximamente'}*.

📊 Te quedan *${datos.sesiones ?? 0} sesiones* disponibles.

¿Deseas renovar tu plan? Contáctanos para conocer nuestras opciones. 💪`,

  confirmacion_pago: (datos) =>
    `Hola *${datos.nombre}*, confirmamos el pago de *${datos.monto || 'monto recibido'}* por ${datos.concepto || 'tu concepto registrado'}.

✅ Pago registrado exitosamente.

¡Gracias por tu confianza en RPM! 🙏`,

  recordatorio_entrenamiento: (datos) =>
    `Hola *${datos.nombre}*, te recordamos tu sesión de entrenamiento el ${datos.fecha || 'día indicado'} a las *${datos.hora || 'hora indicada'}*.

🏋️ Entrenador: ${datos.entrenador || 'Tu entrenador'}

¡Nos vemos pronto! 💪`,

  cancelacion_cita: (datos) =>
    `Hola *${datos.nombre}*, tu cita del ${datos.fecha || 'día indicado'} a las ${datos.hora || 'hora indicada'} ha sido cancelada.

${datos.motivo ? `Motivo: ${datos.motivo}` : ''}

Si deseas reagendar, contáctanos. Estamos a tu disposición.`,
}

type QuickAction = {
  id: string
  titulo: string
  descripcion: string
  plantilla: PlantillaWhatsApp
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'bienvenida', titulo: '👋 Bienvenida', descripcion: 'Carga terapeuta real del cliente', plantilla: 'bienvenida_cliente' },
  { id: 'confirmacion_cita', titulo: '✅ Confirmación cita', descripcion: 'Carga la cita más reciente', plantilla: 'confirmacion_cita' },
  { id: 'recordatorio_cita', titulo: '📅 Recordatorio cita', descripcion: 'Carga la próxima cita futura', plantilla: 'recordatorio_cita' },
  { id: 'recordatorio_pago', titulo: '💰 Recordatorio pago', descripcion: 'Carga el pago pendiente más reciente', plantilla: 'recordatorio_pago' },
  { id: 'plan_vencer', titulo: '📉 Plan por vencer', descripcion: 'Carga el plan activo/próximo a vencer', plantilla: 'plan_por_vencer' },
  { id: 'confirmacion_pago', titulo: '🧾 Confirmación pago', descripcion: 'Carga el último pago registrado', plantilla: 'confirmacion_pago' },
  { id: 'recordatorio_entrenamiento', titulo: '🏋️ Entrenamiento', descripcion: 'Carga el próximo entrenamiento', plantilla: 'recordatorio_entrenamiento' },
  { id: 'cancelacion_cita', titulo: '❌ Cancelación cita', descripcion: 'Carga la última cita del cliente', plantilla: 'cancelacion_cita' },
]

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

function cleanPhone(value: string) {
  return value.replace(/\D/g, '')
}

function formatWhatsAppPhone(value: string) {
  const limpio = cleanPhone(value)
  if (!limpio) return ''
  if (limpio.startsWith('58')) return limpio
  if (limpio.startsWith('0')) return `58${limpio.slice(1)}`
  if (limpio.length === 10) return `58${limpio}`
  return limpio
}

function generarMensaje(plantilla: PlantillaWhatsApp, datos: DatosPlantilla) {
  const generador = PLANTILLAS[plantilla]
  if (!generador) throw new Error(`Plantilla no encontrada: ${plantilla}`)
  return generador(datos)
}

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function formatFechaLarga(fecha: string) {
  if (!fecha) return ''
  const date = new Date(`${fecha}T12:00:00`)
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatHoraAmPm(hora: string) {
  if (!hora) return ''
  const safe = hora.slice(0, 5)
  const [hours, minutes] = safe.split(':').map(Number)
  const date = new Date()
  date.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0)

  return date.toLocaleTimeString('es-ES', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatMoneyFromPago(pago: PagoReal | null) {
  if (!pago) return ''
  const moneda = (pago.moneda_pago || '').toUpperCase()

  if (moneda === 'USD' && pago.monto_equivalente_usd != null) {
    return `USD ${Number(pago.monto_equivalente_usd).toFixed(2)}`
  }

  if (moneda === 'BS' && pago.monto_equivalente_bs != null) {
    return `BS ${Number(pago.monto_equivalente_bs).toFixed(2)}`
  }

  if (pago.monto != null) {
    return `${moneda || ''} ${Number(pago.monto).toFixed(2)}`.trim()
  }

  return ''
}

function getTipoFromPlantilla(plantilla: PlantillaWhatsApp): FormState['tipo'] {
  switch (plantilla) {
    case 'recordatorio_cita':
    case 'recordatorio_pago':
    case 'plan_por_vencer':
    case 'recordatorio_entrenamiento':
      return 'recordatorio'
    case 'confirmacion_cita':
    case 'confirmacion_pago':
      return 'seguimiento'
    case 'bienvenida_cliente':
    case 'cancelacion_cita':
      return 'aviso'
    default:
      return 'recordatorio'
  }
}

function canalBadge() {
  return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
}

function estadoBadge(estado: string) {
  switch (estado) {
    case 'enviado':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'borrador':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'cancelado':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function tipoBadge(tipo: string) {
  switch (tipo) {
    case 'recordatorio':
      return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
    case 'promocion':
      return 'border-violet-400/20 bg-violet-400/10 text-violet-300'
    case 'seguimiento':
      return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'aviso':
      return 'border-white/10 bg-white/[0.05] text-white/70'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export default function ComunicacionPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [comunicaciones, setComunicaciones] = useState<Comunicacion[]>([])
  const [form, setForm] = useState<FormState>(INITIAL_FORM)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [reSendingId, setReSendingId] = useState<string | null>(null)
  const [plantillaLoading, setPlantillaLoading] = useState(false)

  const [alert, setAlert] = useState<AlertState>(null)
  const [search, setSearch] = useState('')
  const [ultimoContexto, setUltimoContexto] = useState<string>('')

  function showAlert(
    type: 'error' | 'success' | 'info' | 'warning',
    title: string,
    message: string
  ) {
    setAlert({ type, title, message })
  }

  function clearAlert() {
    setAlert(null)
  }

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      clearAlert()

      const [cliRes, comRes] = await Promise.all([
        supabase
          .from('clientes')
          .select('id, nombre, telefono, email, estado, terapeuta_id')
          .eq('estado', 'activo')
          .order('nombre', { ascending: true }),

        supabase
          .from('comunicaciones')
          .select('id, titulo, asunto, mensaje, tipo, canal, estado, destino, cliente_id, created_at, enviado_at')
          .eq('canal', 'whatsapp')
          .order('created_at', { ascending: false }),
      ])

      if (cliRes.error) throw cliRes.error
      if (comRes.error) throw comRes.error

      setClientes((cliRes.data || []) as Cliente[])
      setComunicaciones((comRes.data || []) as Comunicacion[])
    } catch (err: any) {
      showAlert('error', 'Error', err?.message || 'No se pudo cargar la comunicación.')
      setClientes([])
      setComunicaciones([])
    } finally {
      setLoading(false)
    }
  }

  const clienteSeleccionado = useMemo(() => {
    return clientes.find((c) => c.id === form.cliente_id) || null
  }, [form.cliente_id, clientes])

  const destinoFinal = useMemo(() => {
    if (form.destino_manual.trim()) return form.destino_manual.trim()
    if (!clienteSeleccionado) return ''
    return clienteSeleccionado.telefono || ''
  }, [form.destino_manual, clienteSeleccionado])

  const comunicacionesFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return comunicaciones

    return comunicaciones.filter((c) => {
      return (
        c.titulo?.toLowerCase().includes(q) ||
        c.mensaje?.toLowerCase().includes(q) ||
        c.tipo?.toLowerCase().includes(q) ||
        c.canal?.toLowerCase().includes(q) ||
        c.estado?.toLowerCase().includes(q) ||
        c.destino?.toLowerCase().includes(q)
      )
    })
  }, [comunicaciones, search])

  const stats = useMemo(() => {
    return {
      total: comunicaciones.length,
      enviadas: comunicaciones.filter((x) => x.estado === 'enviado').length,
      borradores: comunicaciones.filter((x) => x.estado === 'borrador').length,
      recordatorios: comunicaciones.filter((x) => x.tipo === 'recordatorio').length,
    }
  }, [comunicaciones])

  function resetForm() {
    setForm(INITIAL_FORM)
    setUltimoContexto('')
    clearAlert()
  }

  function validarDestino() {
    if (!destinoFinal) return 'Destino requerido.'
    if (formatWhatsAppPhone(destinoFinal).length < 10) {
      return 'El número no es válido para WhatsApp.'
    }
    return ''
  }

  function validateForm() {
    if (!form.titulo.trim()) return 'Título requerido.'
    if (!form.mensaje.trim()) return 'Mensaje requerido.'
    return validarDestino()
  }

  async function getTerapeutaCliente(cliente: Cliente) {
    if (!cliente.terapeuta_id) return null

    const { data, error } = await supabase
      .from('empleados')
      .select('id, nombre')
      .eq('id', cliente.terapeuta_id)
      .maybeSingle()

    if (error) throw error
    return data as EmpleadoRow | null
  }

  async function getProximaCita(clienteId: string) {
    const hoy = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('citas')
      .select(`
        id,
        fecha,
        hora_inicio,
        estado,
        notas,
        servicio:servicios(id, nombre),
        terapeuta:empleados(id, nombre)
      `)
      .eq('cliente_id', clienteId)
      .gte('fecha', hoy)
      .in('estado', ['programado', 'pendiente', 'confirmado'])
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return (data || null) as CitaReal | null
  }

  async function getUltimaCita(clienteId: string) {
    const { data, error } = await supabase
      .from('citas')
      .select(`
        id,
        fecha,
        hora_inicio,
        estado,
        notas,
        servicio:servicios(id, nombre),
        terapeuta:empleados(id, nombre)
      `)
      .eq('cliente_id', clienteId)
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return (data || null) as CitaReal | null
  }

  async function getPagoPendiente(clienteId: string) {
    const { data, error } = await supabase
      .from('pagos')
      .select(`
        id,
        concepto,
        monto,
        moneda_pago,
        monto_equivalente_usd,
        monto_equivalente_bs,
        estado,
        created_at
      `)
      .eq('cliente_id', clienteId)
      .in('estado', ['pendiente', 'por_pagar'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return (data || null) as PagoReal | null
  }

  async function getUltimoPago(clienteId: string) {
    const { data, error } = await supabase
      .from('pagos')
      .select(`
        id,
        concepto,
        monto,
        moneda_pago,
        monto_equivalente_usd,
        monto_equivalente_bs,
        estado,
        created_at
      `)
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return (data || null) as PagoReal | null
  }

  async function getProximoEntrenamiento(clienteId: string) {
    const hoy = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('entrenamientos')
      .select(`
        id,
        fecha,
        hora_inicio,
        estado,
        entrenador:empleados(id, nombre)
      `)
      .eq('cliente_id', clienteId)
      .gte('fecha', hoy)
      .in('estado', ['programado', 'pendiente', 'confirmado'])
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return (data || null) as EntrenamientoReal | null
  }

  async function getPlanActivoOVencer(clienteId: string) {
    const hoy = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('clientes_planes')
      .select(`
        id,
        fecha_inicio,
        fecha_fin,
        sesiones_totales,
        sesiones_usadas,
        estado,
        plan:planes(id, nombre)
      `)
      .eq('cliente_id', clienteId)
      .in('estado', ['activo', 'vigente', 'por_vencer'])
      .order('fecha_fin', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) {
      const fallback = await supabase
        .from('clientes_planes')
        .select('id, fecha_inicio, fecha_fin, sesiones_totales, sesiones_usadas, estado')
        .eq('cliente_id', clienteId)
        .in('estado', ['activo', 'vigente', 'por_vencer'])
        .gte('fecha_fin', hoy)
        .order('fecha_fin', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (fallback.error) throw fallback.error
      return (fallback.data || null) as PlanReal | null
    }

    return (data || null) as PlanReal | null
  }

  async function construirDatosReales(
    cliente: Cliente,
    plantilla: PlantillaWhatsApp
  ): Promise<{ datos: DatosPlantilla; contexto: string }> {
    const base: DatosPlantilla = {
      nombre: cliente.nombre,
      telefono: cliente.telefono || '',
    }

    switch (plantilla) {
      case 'bienvenida_cliente': {
        const terapeuta = await getTerapeutaCliente(cliente)

        return {
          datos: {
            ...base,
            terapeuta: terapeuta?.nombre || 'RPM',
          },
          contexto: terapeuta?.nombre
            ? `Terapeuta cargado: ${terapeuta.nombre}`
            : 'Cliente sin terapeuta asignado. Se dejó RPM .',
        }
      }

      case 'confirmacion_cita': {
        const cita = await getUltimaCita(cliente.id)
        if (!cita) throw new Error('Este cliente no tiene citas registradas.')

        const servicio = asSingle(cita.servicio)
        const terapeuta = asSingle(cita.terapeuta)

        return {
          datos: {
            ...base,
            fecha: formatFechaLarga(cita.fecha),
            hora: formatHoraAmPm(cita.hora_inicio),
            servicio: servicio?.nombre || 'Servicio',
            terapeuta: terapeuta?.nombre || 'Por confirmar',
          },
          contexto: `Usando última cita del cliente: ${cita.fecha} ${cita.hora_inicio}.`,
        }
      }

      case 'recordatorio_cita': {
        const cita = await getProximaCita(cliente.id)
        if (!cita) throw new Error('Este cliente no tiene una próxima cita futura.')

        const servicio = asSingle(cita.servicio)
        const terapeuta = asSingle(cita.terapeuta)

        return {
          datos: {
            ...base,
            fecha: formatFechaLarga(cita.fecha),
            hora: formatHoraAmPm(cita.hora_inicio),
            servicio: servicio?.nombre || 'Servicio',
            terapeuta: terapeuta?.nombre || 'Por confirmar',
          },
          contexto: `Usando próxima cita futura: ${cita.fecha} ${cita.hora_inicio}.`,
        }
      }

      case 'cancelacion_cita': {
        const cita = await getUltimaCita(cliente.id)
        if (!cita) throw new Error('Este cliente no tiene citas registradas para cancelar.')

        return {
          datos: {
            ...base,
            fecha: formatFechaLarga(cita.fecha),
            hora: formatHoraAmPm(cita.hora_inicio),
            motivo: cita.notas || 'Por motivos operativos',
          },
          contexto: 'Usando última cita registrada para la cancelación.',
        }
      }

      case 'recordatorio_pago': {
        const pago = await getPagoPendiente(cliente.id)
        if (!pago) throw new Error('Este cliente no tiene pagos pendientes.')

        return {
          datos: {
            ...base,
            monto: formatMoneyFromPago(pago) || 'Monto pendiente',
            concepto: pago.concepto || 'Pago pendiente',
          },
          contexto: 'Usando pago pendiente más reciente.',
        }
      }

      case 'confirmacion_pago': {
        const pago = await getUltimoPago(cliente.id)
        if (!pago) throw new Error('Este cliente no tiene pagos registrados.')

        return {
          datos: {
            ...base,
            monto: formatMoneyFromPago(pago) || 'Monto registrado',
            concepto: pago.concepto || 'tu pago',
          },
          contexto: 'Usando último pago registrado.',
        }
      }

      case 'recordatorio_entrenamiento': {
        const entrenamiento = await getProximoEntrenamiento(cliente.id)
        if (!entrenamiento) throw new Error('Este cliente no tiene un próximo entrenamiento futuro.')

        const entrenador = asSingle(entrenamiento.entrenador)

        return {
          datos: {
            ...base,
            fecha: formatFechaLarga(entrenamiento.fecha),
            hora: formatHoraAmPm(entrenamiento.hora_inicio),
            entrenador: entrenador?.nombre || 'Tu entrenador',
          },
          contexto: `Usando próximo entrenamiento: ${entrenamiento.fecha} ${entrenamiento.hora_inicio}.`,
        }
      }

      case 'plan_por_vencer': {
        const plan = await getPlanActivoOVencer(cliente.id)
        if (!plan) throw new Error('Este cliente no tiene un plan activo o próximo a vencer.')

        const planRow = asSingle(plan.plan)
        const sesionesRestantes = Math.max(
          0,
          Number(plan.sesiones_totales || 0) - Number(plan.sesiones_usadas || 0)
        )

        return {
          datos: {
            ...base,
            fecha: plan.fecha_fin ? formatFechaLarga(plan.fecha_fin) : 'próximamente',
            plan: planRow?.nombre || 'Plan activo',
            sesiones: sesionesRestantes,
          },
          contexto: `Usando plan activo/próximo a vencer. Fecha fin: ${plan.fecha_fin || 'sin fecha fin'}.`,
        }
      }

      default:
        return {
          datos: base,
          contexto: 'Se usaron datos base del cliente.',
        }
    }
  }

  async function aplicarPlantilla(plantilla: PlantillaWhatsApp) {
    clearAlert()
    setUltimoContexto('')

    if (!clienteSeleccionado) {
      showAlert('warning', 'Atención', 'Primero selecciona un cliente.')
      return
    }

    try {
      setPlantillaLoading(true)

      const { datos, contexto } = await construirDatosReales(clienteSeleccionado, plantilla)
      const mensaje = generarMensaje(plantilla, datos)

      setForm((prev) => ({
        ...prev,
        plantilla,
        titulo: PLANTILLA_LABELS[plantilla],
        tipo: getTipoFromPlantilla(plantilla),
        mensaje,
      }))

      setUltimoContexto(contexto)
      showAlert('success', 'Listo', 'Plantilla cargada con datos reales.')
    } catch (err: any) {
      showAlert(
        'warning',
        'No se pudo cargar la plantilla',
        err?.message || 'No se pudo cargar la plantilla con datos reales.'
      )
    } finally {
      setPlantillaLoading(false)
    }
  }

  async function guardarHistorial(estado: 'borrador' | 'enviado', destinoOverride?: string) {
    const payload: Record<string, any> = {
      titulo: form.titulo.trim(),
      asunto: null,
      mensaje: form.mensaje.trim(),
      tipo: form.tipo,
      canal: 'whatsapp',
      estado,
      destino: destinoOverride || destinoFinal || null,
      cliente_id: form.cliente_id || null,
    }

    if (estado === 'enviado') {
      payload.enviado_at = new Date().toISOString()
    }

    const { error } = await supabase.from('comunicaciones').insert(payload)
    if (error) throw new Error(error.message)
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    clearAlert()

    const err = validateForm()
    if (err) {
      showAlert('warning', 'Datos incompletos', err)
      return
    }

    try {
      setSaving(true)
      await guardarHistorial('borrador')
      showAlert('success', 'Listo', 'Mensaje guardado como borrador.')
      resetForm()
      await loadData()
    } catch (err: any) {
      showAlert('error', 'Error', err?.message || 'No se pudo guardar la comunicación.')
    } finally {
      setSaving(false)
    }
  }

  function abrirWhatsApp(destino: string, mensaje: string) {
    const telefono = formatWhatsAppPhone(destino)

    if (!telefono) {
      throw new Error('Número inválido para WhatsApp.')
    }

    window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`, '_blank')
  }

  async function enviarActual() {
    abrirWhatsApp(destinoFinal, form.mensaje)
    await guardarHistorial('enviado', destinoFinal)
  }

  async function handleEnviar() {
    clearAlert()

    const err = validateForm()
    if (err) {
      showAlert('warning', 'Datos incompletos', err)
      return
    }

    try {
      setSending(true)
      await enviarActual()
      showAlert('success', 'Listo', 'Mensaje enviado correctamente por WhatsApp.')
      resetForm()
      await loadData()
    } catch (err: any) {
      showAlert('error', 'Error', err?.message || 'No se pudo enviar la comunicación.')
    } finally {
      setSending(false)
    }
  }

  async function reenviar(item: Comunicacion) {
    try {
      setReSendingId(item.id)
      clearAlert()

      if (!item.destino) {
        showAlert('warning', 'Atención', 'Esta comunicación no tiene destino.')
        return
      }

      abrirWhatsApp(item.destino, item.mensaje)
      showAlert('success', 'Listo', 'Mensaje reenviado por WhatsApp.')
    } catch (err: any) {
      showAlert('error', 'Error', err?.message || 'No se pudo reenviar la comunicación.')
    } finally {
      setReSendingId(null)
    }
  }

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <div>
        <p className="text-sm text-white/55">Administración</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          Comunicación
        </h1>
        <p className="mt-2 text-sm text-white/55">
          WhatsApp conectado con datos reales de citas, pagos, entrenamientos y planes.
        </p>
      </div>

      {alert ? (
        <Card
          className={`p-4 ${
            alert.type === 'error'
              ? 'border-rose-400/30 bg-rose-400/10'
              : alert.type === 'success'
                ? 'border-emerald-400/30 bg-emerald-400/10'
                : alert.type === 'warning'
                  ? 'border-amber-400/30 bg-amber-400/10'
                  : 'border-sky-400/30 bg-sky-400/10'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className={`text-sm font-medium ${
                  alert.type === 'error'
                    ? 'text-rose-300'
                    : alert.type === 'success'
                      ? 'text-emerald-300'
                      : alert.type === 'warning'
                        ? 'text-amber-300'
                        : 'text-sky-300'
                }`}
              >
                {alert.title}
              </p>

              <p className="mt-1 text-sm text-white/75">{alert.message}</p>

              {ultimoContexto ? (
                <p className="mt-2 text-xs text-white/45">{ultimoContexto}</p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={clearAlert}
              className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              Cerrar
            </button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total" value={stats.total} color="text-white" />
        <StatCard title="Enviadas" value={stats.enviadas} color="text-emerald-400" />
        <StatCard title="Borradores" value={stats.borradores} color="text-amber-300" />
        <StatCard title="Recordatorios" value={stats.recordatorios} color="text-sky-400" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-1">
          <form onSubmit={handleGuardar}>
            <Section
              title="Nuevo mensaje"
              description="Puedes escribir manualmente o cargar una plantilla con datos reales."
            >
              <div className="space-y-4">
                <Field label="Cliente">
                  <select
                    value={form.cliente_id}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        cliente_id: e.target.value,
                        destino_manual: '',
                        plantilla: '',
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

                {clienteSeleccionado ? (
                  <Card className="p-3">
                    <p className="text-sm text-white/75">
                      <span className="font-medium text-white">Teléfono:</span>{' '}
                      {clienteSeleccionado.telefono || '—'}
                    </p>
                    <p className="mt-1 text-sm text-white/55">
                      <span className="font-medium text-white/75">Email:</span>{' '}
                      {clienteSeleccionado.email || '—'}
                    </p>
                  </Card>
                ) : null}

                <Field label="Plantilla">
                  <select
                    value={form.plantilla}
                    onChange={(e) => {
                      const value = e.target.value as PlantillaWhatsApp | ''
                      if (!value) {
                        setForm((p) => ({ ...p, plantilla: '' }))
                        return
                      }
                      void aplicarPlantilla(value)
                    }}
                    className={inputClassName}
                  >
                    <option value="" className="bg-[#11131a] text-white">
                      Seleccionar plantilla
                    </option>
                    {Object.entries(PLANTILLA_LABELS).map(([value, label]) => (
                      <option key={value} value={value} className="bg-[#11131a] text-white">
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Título">
                  <input
                    placeholder="Ej: Recordatorio de cita"
                    value={form.titulo}
                    onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
                    className={inputClassName}
                  />
                </Field>

                <Field label="Tipo">
                  <select
                    value={form.tipo}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        tipo: e.target.value as FormState['tipo'],
                      }))
                    }
                    className={inputClassName}
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t} className="bg-[#11131a] text-white">
                        {t}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  label="Destino manual"
                  helper="Si lo llenas, reemplaza el teléfono del cliente seleccionado."
                >
                  <input
                    placeholder="+58 412 000 0000"
                    value={form.destino_manual}
                    onChange={(e) => setForm((p) => ({ ...p, destino_manual: e.target.value }))}
                    className={inputClassName}
                  />
                </Field>

                <Field label="Canal">
                  <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-300">
                    WhatsApp
                  </div>
                </Field>

                <Field label="Destino final">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80">
                    {destinoFinal || 'Sin destino'}
                  </div>
                </Field>

                <Field label="Mensaje">
                  <textarea
                    rows={8}
                    placeholder="Escribe el mensaje..."
                    value={form.mensaje}
                    onChange={(e) => setForm((p) => ({ ...p, mensaje: e.target.value }))}
                    className={`${inputClassName} resize-none`}
                  />
                </Field>

                <div className="flex flex-wrap gap-3">
                  <button
                    disabled={saving}
                    type="submit"
                    className="
                      rounded-2xl border border-white/10 bg-white/[0.08]
                      px-4 py-3 text-sm font-semibold text-white transition
                      hover:bg-white/[0.12] disabled:opacity-60
                    "
                  >
                    {saving ? 'Guardando...' : 'Guardar borrador'}
                  </button>

                  <button
                    type="button"
                    disabled={sending}
                    onClick={handleEnviar}
                    className="
                      rounded-2xl border border-emerald-400/20 bg-emerald-400/10
                      px-4 py-3 text-sm font-semibold text-emerald-300 transition
                      hover:bg-emerald-400/15 disabled:opacity-60
                    "
                  >
                    {sending ? 'Enviando...' : 'Enviar por WhatsApp'}
                  </button>

                  <button
                    type="button"
                    onClick={resetForm}
                    className="
                      rounded-2xl border border-white/10 bg-white/[0.03]
                      px-4 py-3 text-sm font-semibold text-white/80 transition
                      hover:bg-white/[0.06]
                    "
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </Section>
          </form>

          <Section
            title="Acciones rápidas"
            description="Cada acción consulta la base y llena el mensaje con datos reales."
          >
            <div className="space-y-2">
              {QUICK_ACTIONS.map((accion) => (
                <div
                  key={accion.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{accion.titulo}</p>
                    <p className="text-xs text-white/50">{accion.descripcion}</p>
                  </div>

                  <button
                    type="button"
                    disabled={plantillaLoading}
                    onClick={() => void aplicarPlantilla(accion.plantilla)}
                    className="
                      rounded-xl border border-emerald-400/20 bg-emerald-400/10
                      px-3 py-2 text-xs font-semibold text-emerald-300 transition
                      hover:bg-emerald-400/15 disabled:opacity-60
                    "
                  >
                    {plantillaLoading && form.plantilla === accion.plantilla ? 'Cargando...' : 'Usar'}
                  </button>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="xl:col-span-2">
          <Section
            title="Historial"
            description="Mensajes registrados por WhatsApp."
          >
            <div className="mb-4">
              <input
                type="text"
                placeholder="Buscar en historial..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={inputClassName}
              />
            </div>

            <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
              {loading ? (
                <p className="text-sm text-white/55">Cargando historial...</p>
              ) : comunicacionesFiltradas.length === 0 ? (
                <p className="text-sm text-white/55">No hay comunicaciones registradas.</p>
              ) : (
                comunicacionesFiltradas.map((c) => (
                  <Card key={c.id} className="p-4">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${canalBadge()}`}
                      >
                        whatsapp
                      </span>

                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(c.estado)}`}
                      >
                        {c.estado}
                      </span>

                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tipoBadge(c.tipo)}`}
                      >
                        {c.tipo}
                      </span>
                    </div>

                    <div className="mb-1 font-semibold text-white">{c.titulo}</div>

                    <div className="whitespace-pre-wrap text-sm text-white/75">
                      {c.mensaje}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-white/45">
                      <div>
                        <span className="font-medium text-white/70">Destino:</span>{' '}
                        {c.destino || '—'}
                        <span className="mx-1">•</span>
                        {formatDateTime(c.created_at)}
                        {c.enviado_at ? (
                          <>
                            <span className="mx-1">•</span>
                            Enviado: {formatDateTime(c.enviado_at)}
                          </>
                        ) : null}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void reenviar(c)}
                          disabled={reSendingId === c.id}
                          className="
                            rounded-xl border border-white/10 bg-white/[0.03]
                            px-3 py-1.5 text-xs font-semibold text-white/80
                            transition hover:bg-white/[0.06] disabled:opacity-60
                          "
                        >
                          {reSendingId === c.id ? 'Reenviando...' : 'Reenviar'}
                        </button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}