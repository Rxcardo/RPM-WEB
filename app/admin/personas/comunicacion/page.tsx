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

type AuditorRef = {
  id: string
  nombre: string | null
} | null

type Comunicacion = {
  id: string
  titulo: string
  asunto: string | null
  mensaje: string
  tipo: string
  canal: 'whatsapp'
  estado: string
  destino: string | null
  cliente_id: string | null
  created_at: string
  updated_at: string | null
  enviado_at: string | null
  created_by: string | null
  updated_by: string | null
  sent_by: string | null
  creado_por: AuditorRef
  editado_por: AuditorRef
  enviado_por: AuditorRef
}

type PlantillaWhatsApp = 'pago_deuda' | 'bienvenida_cliente' | 'plan_por_vencer'

type FormState = {
  titulo: string
  mensaje: string
  tipo: string
  cliente_id: string
  destino_manual: string
  plantilla: PlantillaWhatsApp | ''
}

type DatosPlantilla = {
  nombre: string
  telefono?: string
  terapeuta?: string
  saldo?: string
  concepto?: string
  plan?: string
  fecha?: string
  sesiones?: number
}

type EmpleadoRow = { id: string; nombre: string }

type DeudaReal = {
  id: string
  cliente_id: string | null
  cliente_nombre: string | null
  concepto: string | null
  saldo_usd: number | string | null
  saldo_bs: number | string | null
  moneda: string | null
  estado: string | null
  fecha_vencimiento: string | null
  clientes: Cliente | Cliente[] | null
}

type PlanReal = {
  id: string
  cliente_id: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  sesiones_totales: number | null
  sesiones_usadas: number | null
  estado: string | null
  clientes: Cliente | Cliente[] | null
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

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

const PLANTILLA_LABELS: Record<PlantillaWhatsApp, string> = {
  pago_deuda: 'Pago deuda',
  bienvenida_cliente: 'Bienvenida',
  plan_por_vencer: 'Plan por vencer',
}

const PLANTILLAS: Record<PlantillaWhatsApp, (datos: DatosPlantilla) => string> = {
  pago_deuda: (datos) =>
    `Hola *${datos.nombre}*, te escribimos de Recovery RPM para recordarte que tienes una deuda pendiente.\n\n💰 Saldo: *${datos.saldo || 'Pendiente'}*\n📝 Concepto: ${datos.concepto || 'Cuenta por cobrar'}\n\nPuedes confirmar tu pago por este medio. Gracias.`,

  bienvenida_cliente: (datos) =>
    `¡Bienvenido/a a Recovery RPM, *${datos.nombre}*! 🎉\n\nEstamos felices de acompañarte en tu proceso de recuperación y bienestar.\n\n👨‍⚕️ Terapeuta asignado: *${datos.terapeuta || 'Recovery RPM'}*\n\nCualquier duda, estamos a tu disposición.`,

  plan_por_vencer: (datos) =>
    `Hola *${datos.nombre}*, tu plan *${datos.plan || 'activo'}* está próximo a vencer${datos.fecha ? ` el *${datos.fecha}*` : ''}.\n\n📊 Sesiones restantes: *${datos.sesiones ?? 0}*\n\n¿Deseas renovar o coordinar tus próximas sesiones?`,
}

const QUICK_ACTIONS: { id: string; titulo: string; descripcion: string; plantilla: PlantillaWhatsApp }[] = [
  { id: 'pago_deuda', titulo: '💰 Pago deuda', descripcion: 'Carga la deuda real desde cuentas_por_cobrar', plantilla: 'pago_deuda' },
  { id: 'bienvenida', titulo: '👋 Bienvenida', descripcion: 'Mensaje de bienvenida con terapeuta asignado', plantilla: 'bienvenida_cliente' },
  { id: 'plan_vencer', titulo: '📉 Plan por vencer', descripcion: 'Carga el plan real próximo a vencer', plantilla: 'plan_por_vencer' },
]

function Field({ label, children, helper }: { label: string; children: ReactNode; helper?: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/75">{label}</label>
      {children}
      {helper ? <p className="mt-2 text-xs text-white/45">{helper}</p> : null}
    </div>
  )
}

function asSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
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

function formatFechaLarga(fecha: string | null | undefined) {
  if (!fecha) return ''
  const date = new Date(`${fecha}T12:00:00`)
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatUsd(value: number | string | null | undefined) {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return 'USD 0.00'
  return `USD ${n.toFixed(2)}`
}

function getTipoFromPlantilla(plantilla: PlantillaWhatsApp) {
  if (plantilla === 'bienvenida_cliente') return 'aviso'
  return 'recordatorio'
}

function generarMensaje(plantilla: PlantillaWhatsApp, datos: DatosPlantilla) {
  const generador = PLANTILLAS[plantilla]
  if (!generador) throw new Error(`Plantilla no encontrada: ${plantilla}`)
  return generador(datos)
}

function canalBadge() {
  return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
}

function estadoBadge(estado: string) {
  switch (estado) {
    case 'enviado': return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'borrador': return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'cancelado': return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    default: return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function tipoBadge(tipo: string) {
  switch (tipo) {
    case 'recordatorio': return 'border-sky-400/20 bg-sky-400/10 text-sky-300'
    case 'aviso': return 'border-white/10 bg-white/[0.05] text-white/70'
    default: return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  try { return new Date(value).toLocaleString() } catch { return value }
}

function getAuditLines(item: Comunicacion) {
  const creador = item.creado_por?.nombre || 'Sin registro'
  const editor = item.editado_por?.nombre || 'Sin registro'
  const sender = item.enviado_por?.nombre || 'Sin registro'
  const lines = [`Creó: ${creador} · ${formatDateTime(item.created_at)}`]

  if (item.updated_at && item.updated_at !== item.created_at && item.updated_by) {
    lines.push(`Editó: ${editor} · ${formatDateTime(item.updated_at)}`)
  }

  if (item.estado === 'enviado' || item.enviado_at || item.sent_by) {
    lines.push(`Envió: ${sender} · ${formatDateTime(item.enviado_at)}`)
  }

  return lines
}

export default function ComunicacionPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [comunicaciones, setComunicaciones] = useState<Comunicacion[]>([])
  const [deudas, setDeudas] = useState<DeudaReal[]>([])
  const [planesPorVencer, setPlanesPorVencer] = useState<PlanReal[]>([])
  const [form, setForm] = useState<FormState>(INITIAL_FORM)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [reSendingId, setReSendingId] = useState<string | null>(null)
  const [plantillaLoading, setPlantillaLoading] = useState(false)
  const [empleadoActualId, setEmpleadoActualId] = useState('')

  const [alert, setAlert] = useState<AlertState>(null)
  const [search, setSearch] = useState('')
  const [clienteSearch, setClienteSearch] = useState('')
  const [ultimoContexto, setUltimoContexto] = useState<string>('')

  function showAlert(type: 'error' | 'success' | 'info' | 'warning', title: string, message: string) {
    setAlert({ type, title, message })
  }

  function clearAlert() {
    setAlert(null)
  }

  useEffect(() => {
    void loadData()
    void loadEmpleadoActual()
  }, [])

  async function resolveEmpleadoActualId(): Promise<string> {
    try {
      const { data: authData } = await supabase.auth.getUser()
      const authUserId = authData.user?.id
      if (!authUserId) return ''

      const { data: empleadoPorAuth } = await supabase
        .from('empleados')
        .select('id')
        .eq('auth_user_id', authUserId)
        .maybeSingle()

      if (empleadoPorAuth?.id) return String(empleadoPorAuth.id)

      const { data: empleadoPorId } = await supabase
        .from('empleados')
        .select('id')
        .eq('id', authUserId)
        .maybeSingle()

      return empleadoPorId?.id ? String(empleadoPorId.id) : ''
    } catch {
      return ''
    }
  }

  async function loadEmpleadoActual() {
    const empleadoId = await resolveEmpleadoActualId()
    setEmpleadoActualId(empleadoId)
  }

  async function loadData() {
    try {
      setLoading(true)
      clearAlert()

      const hoy = new Date().toISOString().slice(0, 10)
      const limite = new Date()
      limite.setDate(limite.getDate() + 7)
      const limiteIso = limite.toISOString().slice(0, 10)

      const [cliRes, comRes, deudasRes, planesRes] = await Promise.all([
        supabase
          .from('clientes')
          .select('id, nombre, telefono, email, estado, terapeuta_id')
          .eq('estado', 'activo')
          .order('nombre', { ascending: true }),

        supabase
          .from('comunicaciones')
          .select(`
            id,
            titulo,
            asunto,
            mensaje,
            tipo,
            canal,
            estado,
            destino,
            cliente_id,
            created_at,
            updated_at,
            enviado_at,
            created_by,
            updated_by,
            sent_by,
            creado_por:created_by (id, nombre),
            editado_por:updated_by (id, nombre),
            enviado_por:sent_by (id, nombre)
          `)
          .eq('canal', 'whatsapp')
          .order('created_at', { ascending: false }),

        supabase
          .from('cuentas_por_cobrar')
          .select(`
            id,
            cliente_id,
            cliente_nombre,
            concepto,
            saldo_usd,
            saldo_bs,
            moneda,
            estado,
            fecha_vencimiento,
            clientes (id, nombre, telefono, email, estado, terapeuta_id)
          `)
          .gt('saldo_usd', 0)
          .neq('estado', 'pagado')
          .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
          .order('created_at', { ascending: false }),

        supabase
          .from('clientes_planes')
          .select(`
            id,
            cliente_id,
            fecha_inicio,
            fecha_fin,
            sesiones_totales,
            sesiones_usadas,
            estado,
            clientes (id, nombre, telefono, email, estado, terapeuta_id),
            plan:planes (id, nombre)
          `)
          .in('estado', ['activo', 'vigente', 'por_vencer'])
          .gte('fecha_fin', hoy)
          .lte('fecha_fin', limiteIso)
          .order('fecha_fin', { ascending: true }),
      ])

      if (cliRes.error) throw cliRes.error
      if (comRes.error) throw comRes.error
      if (deudasRes.error) throw deudasRes.error
      if (planesRes.error) throw planesRes.error

      setClientes((cliRes.data || []) as Cliente[])
      setComunicaciones((comRes.data || []) as unknown as Comunicacion[])
      setDeudas((deudasRes.data || []) as unknown as DeudaReal[])
      setPlanesPorVencer((planesRes.data || []) as unknown as PlanReal[])
    } catch (err: any) {
      showAlert('error', 'Error', err?.message || 'No se pudo cargar comunicación.')
      setClientes([])
      setComunicaciones([])
      setDeudas([])
      setPlanesPorVencer([])
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

  const clientesFiltrados = useMemo(() => {
    const q = clienteSearch.trim().toLowerCase()
    if (!q) return clientes.slice(0, 12)
    return clientes
      .filter((c) => `${c.nombre} ${c.telefono || ''} ${c.email || ''}`.toLowerCase().includes(q))
      .slice(0, 20)
  }, [clientes, clienteSearch])

  const comunicacionesFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return comunicaciones
    return comunicaciones.filter((c) => {
      return (
        c.titulo?.toLowerCase().includes(q) ||
        c.mensaje?.toLowerCase().includes(q) ||
        c.tipo?.toLowerCase().includes(q) ||
        c.estado?.toLowerCase().includes(q) ||
        c.destino?.toLowerCase().includes(q) ||
        c.creado_por?.nombre?.toLowerCase().includes(q) ||
        c.enviado_por?.nombre?.toLowerCase().includes(q) ||
        c.editado_por?.nombre?.toLowerCase().includes(q)
      )
    })
  }, [comunicaciones, search])

  const stats = useMemo(() => {
    return {
      total: comunicaciones.length,
      enviadas: comunicaciones.filter((x) => x.estado === 'enviado').length,
      borradores: comunicaciones.filter((x) => x.estado === 'borrador').length,
      deudas: deudas.length,
      planes: planesPorVencer.length,
    }
  }, [comunicaciones, deudas, planesPorVencer])

  function seleccionarCliente(cliente: Cliente) {
    setForm((p) => ({ ...p, cliente_id: cliente.id, destino_manual: '', plantilla: '' }))
    setClienteSearch(cliente.nombre)
    setUltimoContexto('')
    clearAlert()
  }

  function resetForm() {
    setForm(INITIAL_FORM)
    setClienteSearch('')
    setUltimoContexto('')
    clearAlert()
  }

  function validarDestino() {
    if (!destinoFinal) return 'Destino requerido.'
    if (formatWhatsAppPhone(destinoFinal).length < 10) return 'El número no es válido para WhatsApp.'
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

  async function getDeudaPendiente(clienteId: string) {
    const { data, error } = await supabase
      .from('cuentas_por_cobrar')
      .select(`
        id,
        cliente_id,
        cliente_nombre,
        concepto,
        saldo_usd,
        saldo_bs,
        moneda,
        estado,
        fecha_vencimiento,
        clientes (id, nombre, telefono, email, estado, terapeuta_id)
      `)
      .eq('cliente_id', clienteId)
      .gt('saldo_usd', 0)
      .neq('estado', 'pagado')
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return (data || null) as unknown as DeudaReal | null
  }

  async function getPlanPorVencerCliente(clienteId: string) {
    const hoy = new Date().toISOString().slice(0, 10)
    const limite = new Date()
    limite.setDate(limite.getDate() + 7)
    const limiteIso = limite.toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('clientes_planes')
      .select(`
        id,
        cliente_id,
        fecha_inicio,
        fecha_fin,
        sesiones_totales,
        sesiones_usadas,
        estado,
        clientes (id, nombre, telefono, email, estado, terapeuta_id),
        plan:planes (id, nombre)
      `)
      .eq('cliente_id', clienteId)
      .in('estado', ['activo', 'vigente', 'por_vencer'])
      .gte('fecha_fin', hoy)
      .lte('fecha_fin', limiteIso)
      .order('fecha_fin', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return (data || null) as unknown as PlanReal | null
  }

  async function construirDatosReales(cliente: Cliente, plantilla: PlantillaWhatsApp): Promise<{ datos: DatosPlantilla; contexto: string }> {
    const base: DatosPlantilla = { nombre: cliente.nombre, telefono: cliente.telefono || '' }

    switch (plantilla) {
      case 'bienvenida_cliente': {
        const terapeuta = await getTerapeutaCliente(cliente)
        return {
          datos: { ...base, terapeuta: terapeuta?.nombre || 'Recovery RPM' },
          contexto: terapeuta?.nombre ? `Terapeuta cargado: ${terapeuta.nombre}.` : 'Cliente sin terapeuta asignado. Se dejó Recovery RPM.',
        }
      }

      case 'pago_deuda': {
        const deuda = await getDeudaPendiente(cliente.id)
        if (!deuda) throw new Error('Este cliente no tiene deuda pendiente en cuentas_por_cobrar.')
        return {
          datos: { ...base, saldo: formatUsd(deuda.saldo_usd), concepto: deuda.concepto || 'Cuenta por cobrar' },
          contexto: `Usando deuda real de cuentas_por_cobrar. Saldo: ${formatUsd(deuda.saldo_usd)}.`,
        }
      }

      case 'plan_por_vencer': {
        const plan = await getPlanPorVencerCliente(cliente.id)
        if (!plan) throw new Error('Este cliente no tiene un plan que venza en los próximos 7 días.')
        const planRow = asSingle(plan.plan)
        const restantes = Math.max(0, Number(plan.sesiones_totales || 0) - Number(plan.sesiones_usadas || 0))
        return {
          datos: {
            ...base,
            fecha: plan.fecha_fin ? formatFechaLarga(plan.fecha_fin) : 'próximamente',
            plan: planRow?.nombre || 'Plan activo',
            sesiones: restantes,
          },
          contexto: `Usando plan por vencer. Fecha fin: ${plan.fecha_fin || 'sin fecha fin'}.`,
        }
      }

      default:
        return { datos: base, contexto: 'Se usaron datos base del cliente.' }
    }
  }

  async function aplicarPlantilla(plantilla: PlantillaWhatsApp) {
    clearAlert()
    setUltimoContexto('')

    if (!clienteSeleccionado) {
      showAlert('warning', 'Atención', 'Primero busca y selecciona un cliente.')
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
      showAlert('warning', 'No se pudo cargar la plantilla', err?.message || 'No se pudo cargar con datos reales.')
    } finally {
      setPlantillaLoading(false)
    }
  }

  async function guardarHistorial(estado: 'borrador' | 'enviado', destinoOverride?: string) {
    let auditorId = empleadoActualId || ''
    if (!auditorId) {
      auditorId = await resolveEmpleadoActualId()
      setEmpleadoActualId(auditorId)
    }

    const payload: Record<string, any> = {
      titulo: form.titulo.trim(),
      asunto: null,
      mensaje: form.mensaje.trim(),
      tipo: form.tipo,
      canal: 'whatsapp',
      estado,
      destino: destinoOverride || destinoFinal || null,
      cliente_id: form.cliente_id || null,
      created_by: auditorId || null,
      updated_by: auditorId || null,
    }

    if (estado === 'enviado') {
      payload.enviado_at = new Date().toISOString()
      payload.sent_by = auditorId || null
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
    if (!telefono) throw new Error('Número inválido para WhatsApp.')
    window.open(`https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`, '_blank')
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
      abrirWhatsApp(destinoFinal, form.mensaje)
      await guardarHistorial('enviado', destinoFinal)
      showAlert('success', 'Listo', 'Mensaje abierto en WhatsApp y guardado como enviado.')
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
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Comunicación</h1>
        <p className="mt-2 text-sm text-white/55">WhatsApp sin IA, conectado a clientes, cuentas por cobrar y planes reales.</p>
      </div>

      {alert ? (
        <Card className={`p-4 ${alert.type === 'error' ? 'border-rose-400/30 bg-rose-400/10' : alert.type === 'success' ? 'border-emerald-400/30 bg-emerald-400/10' : alert.type === 'warning' ? 'border-amber-400/30 bg-amber-400/10' : 'border-sky-400/30 bg-sky-400/10'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={`text-sm font-medium ${alert.type === 'error' ? 'text-rose-300' : alert.type === 'success' ? 'text-emerald-300' : alert.type === 'warning' ? 'text-amber-300' : 'text-sky-300'}`}>{alert.title}</p>
              <p className="mt-1 text-sm text-white/75">{alert.message}</p>
              {ultimoContexto ? <p className="mt-2 text-xs text-white/45">{ultimoContexto}</p> : null}
            </div>
            <button type="button" onClick={clearAlert} className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white">Cerrar</button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total" value={stats.total} color="text-white" />
        <StatCard title="Enviadas" value={stats.enviadas} color="text-emerald-400" />
        <StatCard title="Borradores" value={stats.borradores} color="text-amber-300" />
        <StatCard title="Deudas reales" value={stats.deudas} color="text-rose-300" />
        <StatCard title="Planes por vencer" value={stats.planes} color="text-sky-400" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-1">
          <form onSubmit={handleGuardar}>
            <Section title="Nuevo mensaje" description="Busca el cliente escribiendo y usa solo una de las 3 plantillas activas.">
              <div className="space-y-4">
                <Field label="Buscar cliente">
                  <input
                    value={clienteSearch}
                    onChange={(e) => {
                      setClienteSearch(e.target.value)
                      setForm((p) => ({ ...p, cliente_id: '', destino_manual: '', plantilla: '' }))
                    }}
                    placeholder="Escribe nombre, teléfono o email..."
                    className={inputClassName}
                  />

                  <div className="mt-2 max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-2">
                    {clientesFiltrados.length === 0 ? (
                      <p className="px-2 py-2 text-sm text-white/45">No hay clientes encontrados.</p>
                    ) : (
                      clientesFiltrados.map((cliente) => (
                        <button
                          key={cliente.id}
                          type="button"
                          onClick={() => seleccionarCliente(cliente)}
                          className={`mb-1 w-full rounded-xl px-3 py-2 text-left transition last:mb-0 ${form.cliente_id === cliente.id ? 'bg-emerald-400/15 text-emerald-200' : 'text-white/75 hover:bg-white/[0.06]'}`}
                        >
                          <div className="text-sm font-semibold">{cliente.nombre}</div>
                          <div className="text-xs text-white/45">{cliente.telefono || 'Sin teléfono'} · {cliente.email || 'Sin email'}</div>
                        </button>
                      ))
                    )}
                  </div>
                </Field>

                {clienteSeleccionado ? (
                  <Card className="p-3">
                    <p className="text-sm text-white/75"><span className="font-medium text-white">Cliente:</span> {clienteSeleccionado.nombre}</p>
                    <p className="mt-1 text-sm text-white/75"><span className="font-medium text-white">Teléfono:</span> {clienteSeleccionado.telefono || '—'}</p>
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
                    <option value="" className="bg-[#11131a] text-white">Seleccionar plantilla</option>
                    {Object.entries(PLANTILLA_LABELS).map(([value, label]) => (
                      <option key={value} value={value} className="bg-[#11131a] text-white">{label}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Título">
                  <input placeholder="Ej: Pago deuda" value={form.titulo} onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))} className={inputClassName} />
                </Field>

                <Field label="Destino manual" helper="Si lo llenas, reemplaza el teléfono del cliente seleccionado.">
                  <input placeholder="+58 412 000 0000" value={form.destino_manual} onChange={(e) => setForm((p) => ({ ...p, destino_manual: e.target.value }))} className={inputClassName} />
                </Field>

                <Field label="Destino final">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80">{destinoFinal || 'Sin destino'}</div>
                </Field>

                <Field label="Mensaje">
                  <textarea rows={8} placeholder="Escribe el mensaje..." value={form.mensaje} onChange={(e) => setForm((p) => ({ ...p, mensaje: e.target.value }))} className={`${inputClassName} resize-none`} />
                </Field>

                <div className="flex flex-wrap gap-3">
                  <button disabled={saving} type="submit" className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-60">
                    {saving ? 'Guardando...' : 'Guardar borrador'}
                  </button>

                  <button type="button" disabled={sending} onClick={handleEnviar} className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-60">
                    {sending ? 'Enviando...' : 'Enviar por WhatsApp'}
                  </button>

                  <button type="button" onClick={resetForm} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]">Limpiar</button>
                </div>
              </div>
            </Section>
          </form>

          <Section title="Acciones rápidas" description="Solo quedan las 3 acciones reales solicitadas.">
            <div className="space-y-2">
              {QUICK_ACTIONS.map((accion) => (
                <div key={accion.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div>
                    <p className="text-sm font-medium text-white">{accion.titulo}</p>
                    <p className="text-xs text-white/50">{accion.descripcion}</p>
                  </div>
                  <button type="button" disabled={plantillaLoading} onClick={() => void aplicarPlantilla(accion.plantilla)} className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-60">
                    {plantillaLoading && form.plantilla === accion.plantilla ? 'Cargando...' : 'Usar'}
                  </button>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="space-y-6 xl:col-span-2">
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Deudas reales" description="Clientes con saldo_usd > 0 en cuentas_por_cobrar.">
              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {loading ? <p className="text-sm text-white/55">Cargando...</p> : deudas.length === 0 ? <p className="text-sm text-white/55">No hay deudas pendientes.</p> : deudas.map((deuda) => {
                  const cliente = asSingle(deuda.clientes)
                  return (
                    <Card key={deuda.id} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{cliente?.nombre || deuda.cliente_nombre || 'Cliente sin nombre'}</p>
                          <p className="mt-1 text-xs text-white/55">{deuda.concepto || 'Cuenta por cobrar'}</p>
                          <p className="mt-1 text-sm font-semibold text-rose-300">{formatUsd(deuda.saldo_usd)}</p>
                        </div>
                        {cliente ? (
                          <button type="button" onClick={() => { seleccionarCliente(cliente); void aplicarPlantilla('pago_deuda') }} className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-400/15">Usar</button>
                        ) : null}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </Section>

            <Section title="Planes por vencer" description="Clientes con plan que vence en los próximos 7 días.">
              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {loading ? <p className="text-sm text-white/55">Cargando...</p> : planesPorVencer.length === 0 ? <p className="text-sm text-white/55">No hay planes por vencer.</p> : planesPorVencer.map((plan) => {
                  const cliente = asSingle(plan.clientes)
                  const planRow = asSingle(plan.plan)
                  const restantes = Math.max(0, Number(plan.sesiones_totales || 0) - Number(plan.sesiones_usadas || 0))
                  return (
                    <Card key={plan.id} className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{cliente?.nombre || 'Cliente sin nombre'}</p>
                          <p className="mt-1 text-xs text-white/55">{planRow?.nombre || 'Plan activo'} · vence {plan.fecha_fin ? formatFechaLarga(plan.fecha_fin) : 'sin fecha'}</p>
                          <p className="mt-1 text-sm font-semibold text-sky-300">{restantes} sesiones restantes</p>
                        </div>
                        {cliente ? (
                          <button type="button" onClick={() => { seleccionarCliente(cliente); void aplicarPlantilla('plan_por_vencer') }} className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-200 transition hover:bg-sky-400/15">Usar</button>
                        ) : null}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </Section>
          </div>

          <Section title="Historial" description="Mensajes registrados por WhatsApp.">
            <div className="mb-4">
              <input type="text" placeholder="Buscar en historial..." value={search} onChange={(e) => setSearch(e.target.value)} className={inputClassName} />
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
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${canalBadge()}`}>whatsapp</span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(c.estado)}`}>{c.estado}</span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tipoBadge(c.tipo)}`}>{c.tipo}</span>
                    </div>

                    <div className="mb-1 font-semibold text-white">{c.titulo}</div>
                    <div className="whitespace-pre-wrap text-sm text-white/75">{c.mensaje}</div>

                    <div className="mt-3 space-y-1">
                      {getAuditLines(c).map((line, index) => (
                        <div key={index} className="text-[11px] leading-4 text-white/35">{line}</div>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-white/45">
                      <div><span className="font-medium text-white/70">Destino:</span> {c.destino || '—'}</div>
                      <button type="button" onClick={() => void reenviar(c)} disabled={reSendingId === c.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06] disabled:opacity-60">
                        {reSendingId === c.id ? 'Reenviando...' : 'Reenviar'}
                      </button>
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
