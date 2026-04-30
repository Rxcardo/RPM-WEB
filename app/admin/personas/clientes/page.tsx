'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'
import ActionCard from '@/components/ui/ActionCard'
import { Trash2, X, AlertTriangle, ShieldAlert } from 'lucide-react'

type EmpleadoRef = {
  id: string
  nombre: string
  rol: string | null
} | null

type AuditorRef = {
  id: string
  nombre: string | null
} | null

type Cliente = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  estado: string
  created_at: string
  updated_at: string | null
  created_by: string | null
  updated_by: string | null
  terapeuta_id: string | null
  empleado_id: string | null
  terapeuta: EmpleadoRef
  empleado: EmpleadoRef
  creado_por: AuditorRef
  editado_por: AuditorRef
}

type ClientePlan = {
  id: string
  cliente_id: string
  sesiones_totales: number | null
  sesiones_usadas: number | null
  estado: string
  fecha_fin: string | null
  created_at?: string | null
  creado_por_empleado_id?: string | null
  creado_por_auth_user_id?: string | null
  creado_por_nombre?: string | null
  creado_por_email?: string | null
  creado_en?: string | null
  planes: {
    nombre: string
    precio: number | null
    vigencia_valor?: number | null
    vigencia_tipo?: string | null
  } | null
}

type Pago = {
  id: string
  cliente_id: string | null
  cliente_plan_id?: string | null
  fecha: string
  monto: number | null
  moneda_pago: string | null
  estado: string
  created_at?: string | null
  monto_equivalente_usd?: number | null
  monto_equivalente_bs?: number | null
}

type ClienteRow = {
  cliente: Cliente
  planActivo: ClientePlan | null
  ultimoPago: Pago | null
  sesionesRestantes: number
  empleadoNombre: string
}

type PlanEstadoFiltro = 'todos' | 'con_plan' | 'sin_plan' | 'por_vencer'

type OrdenKey =
  | 'nombre_asc'
  | 'nombre_desc'
  | 'empleado_asc'
  | 'empleado_desc'
  | 'fecha_reciente'
  | 'fecha_antigua'
  | 'estado'
  | 'sesiones_mayor'
  | 'sesiones_menor'

// ─── Motivos predefinidos ─────────────────────────────────────────────────────

const MOTIVOS = [
  'Solicitud del cliente',
  'Registro duplicado',
  'Error de registro',
  'Cliente inactivo prolongado',
  'Otro',
] as const

// ─── Modal de eliminación ─────────────────────────────────────────────────────

function ModalEliminar({
  cliente,
  onCancel,
  onConfirm,
}: {
  cliente: Cliente
  onCancel: () => void
  onConfirm: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [motivoDetalle, setMotivoDetalle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [usuarioAuth, setUsuarioAuth] = useState<{
    authId: string
    email: string
    nombre: string
  } | null>(null)
  const [loadingUsuario, setLoadingUsuario] = useState(true)

  // Cargar usuario autenticado + buscar su nombre en empleados
  useEffect(() => {
    async function cargarUsuario() {
      setLoadingUsuario(true)
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) {
          setError('No hay sesión activa. Inicia sesión para continuar.')
          setLoadingUsuario(false)
          return
        }

        // Buscar empleado con rol recepcionista vinculado a este auth_user_id
        const { data: emp } = await supabase
          .from('empleados')
          .select('id, nombre, rol, auth_user_id')
          .eq('auth_user_id', user.id)
          .eq('rol', 'recepcionista')
          .maybeSingle()

        // Si no encontró por rol recepcionista, buscar de todas formas para mostrar nombre
        let nombre = user.email || 'Usuario desconocido'
        if (emp?.nombre) {
          nombre = emp.nombre
        } else {
          // Buscar sin filtro de rol para obtener el nombre aunque no sea recepcionista
          const { data: empAny } = await supabase
            .from('empleados')
            .select('nombre, rol')
            .eq('auth_user_id', user.id)
            .maybeSingle()
          if (empAny?.nombre) nombre = empAny.nombre
        }

        setUsuarioAuth({
          authId: user.id,
          email: user.email || '',
          nombre,
        })
      } catch {
        setError('Error al verificar la sesión.')
      } finally {
        setLoadingUsuario(false)
      }
    }
    void cargarUsuario()
  }, [])

  async function handleConfirmar() {
    if (!motivo) { setError('Selecciona un motivo.'); return }
    if (motivo === 'Otro' && !motivoDetalle.trim()) {
      setError('Describe el motivo en el campo de detalle.'); return
    }
    if (!usuarioAuth) { setError('No se pudo verificar tu identidad.'); return }

    setSaving(true)
    setError('')
    try {
      // 1. Insertar registro de auditoría
      const { error: logErr } = await supabase.from('clientes_eliminaciones').insert({
        cliente_id: cliente.id,
        cliente_nombre: cliente.nombre,
        motivo,
        motivo_detalle: motivoDetalle.trim() || null,
        eliminado_por_auth_id: usuarioAuth.authId,
        eliminado_por_nombre: usuarioAuth.nombre,
        eliminado_por_email: usuarioAuth.email,
      })
      if (logErr) throw logErr

      // 2. Eliminación lógica
      const { error: delErr } = await supabase
        .from('clientes')
        .update({ estado: 'eliminado', updated_at: new Date().toISOString() })
        .eq('id', cliente.id)
      if (delErr) throw delErr

      onConfirm()
    } catch (err: any) {
      setError(err?.message || 'No se pudo eliminar el cliente.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20 focus:bg-white/[0.05]'
  const labelCls = 'mb-2 block text-sm font-medium text-white/75'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#13151e] p-6 shadow-2xl">

        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10">
              <ShieldAlert className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Eliminar cliente</h2>
              <p className="text-xs text-white/45">Esta acción queda registrada permanentemente.</p>
            </div>
          </div>
          <button type="button" onClick={onCancel}
            className="rounded-full border border-white/10 bg-white/[0.03] p-1.5 text-white/50 transition hover:bg-white/[0.06] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Info cliente */}
        <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-xs text-white/45">Cliente a eliminar</p>
          <p className="mt-1 font-semibold text-white">{cliente.nombre}</p>
          {cliente.email && <p className="mt-0.5 text-xs text-white/45">{cliente.email}</p>}
          {cliente.telefono && <p className="text-xs text-white/45">{cliente.telefono}</p>}
        </div>

        {/* Quién elimina — tomado de la cuenta autenticada */}
        <div className="mb-5 rounded-2xl border border-violet-400/20 bg-violet-500/[0.06] px-4 py-3">
          <p className="text-xs text-white/45">Registrado como eliminado por</p>
          {loadingUsuario ? (
            <p className="mt-1 text-sm text-white/50 animate-pulse">Verificando sesión...</p>
          ) : usuarioAuth ? (
            <>
              <p className="mt-1 font-semibold text-white">{usuarioAuth.nombre}</p>
              <p className="text-xs text-white/45">{usuarioAuth.email}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-rose-400">No se pudo verificar la sesión</p>
          )}
        </div>

        {/* Formulario */}
        <div className="mb-4 space-y-4">
          <div>
            <label className={labelCls}>Motivo de eliminación *</label>
            <select
              value={motivo}
              onChange={(e) => { setMotivo(e.target.value); setError('') }}
              className={inputCls}
            >
              <option value="" className="bg-[#11131a]">Selecciona un motivo...</option>
              {MOTIVOS.map((m) => (
                <option key={m} value={m} className="bg-[#11131a]">{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>
              Detalle {motivo === 'Otro' ? '*' : '(opcional)'}
            </label>
            <textarea
              value={motivoDetalle}
              onChange={(e) => { setMotivoDetalle(e.target.value); setError('') }}
              placeholder={motivo === 'Otro' ? 'Describe el motivo...' : 'Información adicional opcional...'}
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {/* Aviso */}
        <div className="mb-5 flex items-start gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-xs text-amber-200/80">
            El cliente pasará a estado <span className="font-semibold text-amber-200">eliminado</span>.
            Se guardará un registro con tu nombre, fecha y motivo que no puede deshacerse.
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-300">
            {error}
          </p>
        )}

        {/* Botones */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.06]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={saving || loadingUsuario || !usuarioAuth || !motivo}
            className="flex-1 rounded-2xl border border-rose-400/30 bg-rose-500/15 px-4 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Eliminando...' : 'Confirmar eliminación'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function money(value: number | string | null | undefined, moneda: string = 'USD') {
  const amount = Number(value || 0)
  if ((moneda || '').toUpperCase() === 'BS') {
    return `Bs ${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(amount)
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try { return new Date(value).toLocaleDateString() } catch { return value }
}

function formatAuditDate(value: string | null | undefined) {
  if (!value) return '—'
  try { return new Date(value).toLocaleString() } catch { return value }
}

function formatVigencia(valor: number | null | undefined, tipo: string | null | undefined) {
  const n = Number(valor || 0)
  const t = (tipo || '').toLowerCase()
  if (!n) return '—'
  if (t === 'dias') return `${n} ${n === 1 ? 'día' : 'días'}`
  if (t === 'semanas') return `${n} ${n === 1 ? 'semana' : 'semanas'}`
  if (t === 'meses') return `${n} ${n === 1 ? 'mes' : 'meses'}`
  return `${n} ${tipo || ''}`.trim()
}

function estadoBadge(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'activo': return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'inactivo': return 'border-white/10 bg-white/[0.05] text-white/70'
    case 'pausado': return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'vencido': return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    case 'eliminado': return 'border-rose-600/20 bg-rose-600/10 text-rose-400'
    default: return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function estadoPlanBadge(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'activo': return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'agotado': return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
    case 'vencido': return 'border-white/10 bg-white/[0.05] text-white/70'
    case 'renovado': return 'border-violet-400/20 bg-violet-400/10 text-violet-300'
    case 'cancelado': return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    default: return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function getPlanStatusLabel(estado: string | null | undefined) {
  switch ((estado || '').toLowerCase()) {
    case 'activo': return 'Activo'
    case 'agotado': return 'Agotado'
    case 'vencido': return 'Vencido'
    case 'renovado': return 'Renovado'
    case 'cancelado': return 'Cancelado'
    default: return estado || 'Sin estado'
  }
}

function getRestantes(plan: ClientePlan | null) {
  if (!plan) return 0
  return Math.max(0, Number(plan.sesiones_totales || 0) - Number(plan.sesiones_usadas || 0))
}

function getPagoTimestamp(pago: Pago) {
  const time = new Date(pago.created_at || pago.fecha).getTime()
  return Number.isNaN(time) ? 0 : time
}

function getDateTimestamp(value: string | null | undefined) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function formatEmpleadoLabel(ref: EmpleadoRef) {
  if (!ref?.nombre?.trim()) return ''
  const nombre = ref.nombre.trim()
  const rol = (ref.rol || '').trim().toLowerCase()
  if (rol === 'terapeuta' || rol === 'fisioterapeuta') return `${nombre} (Fisioterapeuta)`
  if (rol === 'entrenador') return `${nombre} (Entrenador)`
  if (rol) return `${nombre} (${rol})`
  return nombre
}

function resolveEmpleadoNombre(cliente: Cliente) {
  const fisioterapeuta = formatEmpleadoLabel(cliente.terapeuta)
  const empleado = formatEmpleadoLabel(cliente.empleado)
  if (fisioterapeuta && empleado) {
    if (fisioterapeuta.toLowerCase() === empleado.toLowerCase()) return fisioterapeuta
    return `${fisioterapeuta} / ${empleado}`
  }
  return fisioterapeuta || empleado || 'Sin asignar'
}

function getPlanCreatorLine(plan: ClientePlan | null | undefined) {
  if (!plan) return '—'

  const nombre = plan.creado_por_nombre?.trim() || 'Sistema / No registrado'
  const email = plan.creado_por_email?.trim()
  const fecha = formatAuditDate(plan.creado_en || plan.created_at || null)

  return `${nombre}${email ? ` · ${email}` : ''} · ${fecha}`
}
function getAuditLines(cliente: Cliente) {
  const creador = cliente.creado_por?.nombre || 'Sin registro'
  const editor = cliente.editado_por?.nombre || 'Sin registro'
  const createdAt = formatAuditDate(cliente.created_at)
  const updatedAt = formatAuditDate(cliente.updated_at)
  const wasEdited = !!cliente.updated_at && cliente.updated_at !== cliente.created_at && !!cliente.updated_by
  if (!wasEdited) return [`Creó: ${creador} · ${createdAt}`]
  return [`Creó: ${creador} · ${createdAt}`, `Editó: ${editor} · ${updatedAt}`]
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/75">{label}</label>
      {children}
    </div>
  )
}

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientesPage() {
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [planesActivos, setPlanesActivos] = useState<ClientePlan[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])

  const [search, setSearch] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [empleadoFiltro, setEmpleadoFiltro] = useState('todos')
  const [planEstadoFiltro, setPlanEstadoFiltro] = useState<PlanEstadoFiltro>('todos')
  const [planNombreFiltro, setPlanNombreFiltro] = useState('todos')
  const [ordenPor, setOrdenPor] = useState<OrdenKey>('nombre_asc')
  const [error, setError] = useState('')

  // Modal eliminación
  const [clienteAEliminar, setClienteAEliminar] = useState<Cliente | null>(null)

  useEffect(() => { void loadClientes() }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const planEstado = params.get('planEstado')
    if (planEstado === 'activo' || planEstado === 'con_plan') setPlanEstadoFiltro('con_plan')
    if (planEstado === 'sin_plan') setPlanEstadoFiltro('sin_plan')
    if (planEstado === 'por_vencer') setPlanEstadoFiltro('por_vencer')
  }, [])

  async function loadClientes() {
    setLoading(true)
    setError('')
    try {
      const [clientesRes, planesRes, pagosRes] = await Promise.all([
        supabase.from('clientes').select(`
          id, nombre, telefono, email, estado, created_at, updated_at,
          created_by, updated_by, terapeuta_id, empleado_id,
          terapeuta:terapeuta_id (id, nombre, rol),
          empleado:empleado_id (id, nombre, rol),
          creado_por:created_by (id, nombre),
          editado_por:updated_by (id, nombre)
        `).order('created_at', { ascending: false }),

        supabase.from('clientes_planes').select(`
          id, cliente_id, sesiones_totales, sesiones_usadas, estado, fecha_fin, created_at,
          creado_por_empleado_id, creado_por_auth_user_id, creado_por_nombre, creado_por_email, creado_en,
          planes:plan_id (nombre, precio, vigencia_valor, vigencia_tipo)
        `).eq('estado', 'activo'),

        supabase.from('pagos').select(
          'id, cliente_id, cliente_plan_id, fecha, monto, moneda_pago, estado, created_at, monto_equivalente_usd, monto_equivalente_bs'
        ).eq('estado', 'pagado').order('created_at', { ascending: false }),
      ])

      if (clientesRes.error) throw new Error(clientesRes.error.message)
      if (planesRes.error) console.error('Error cargando planes:', planesRes.error.message)
      if (pagosRes.error) console.error('Error cargando pagos:', pagosRes.error.message)

      // Excluir eliminados del listado
      const todos = ((clientesRes.data || []) as unknown as Cliente[])
        .filter((c) => c.estado !== 'eliminado')

      setClientes(todos)
      setPlanesActivos((planesRes.data || []) as unknown as ClientePlan[])
      setPagos((pagosRes.data || []) as Pago[])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudieron cargar los clientes.')
      setClientes([]); setPlanesActivos([]); setPagos([])
    } finally {
      setLoading(false)
    }
  }

  const planMap = useMemo(() => {
    const map = new Map<string, ClientePlan>()
    for (const plan of planesActivos) {
      if (!plan?.cliente_id) continue
      const current = map.get(plan.cliente_id)
      if (!current) { map.set(plan.cliente_id, plan); continue }
      const a = current.created_at ? new Date(current.created_at).getTime() : 0
      const b = plan.created_at ? new Date(plan.created_at).getTime() : 0
      if (b >= a) map.set(plan.cliente_id, plan)
    }
    return map
  }, [planesActivos])

  const planIdToClienteIdMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const plan of planesActivos) {
      if (plan?.id && plan?.cliente_id) map.set(plan.id, plan.cliente_id)
    }
    return map
  }, [planesActivos])

  const pagoMap = useMemo(() => {
    const map = new Map<string, Pago>()
    for (const pago of pagos) {
      const cid = pago.cliente_id ||
        (pago.cliente_plan_id ? planIdToClienteIdMap.get(pago.cliente_plan_id) || null : null)
      if (!cid) continue
      const current = map.get(cid)
      if (!current || getPagoTimestamp(pago) >= getPagoTimestamp(current)) map.set(cid, pago)
    }
    return map
  }, [pagos, planIdToClienteIdMap])

  const rows = useMemo<ClienteRow[]>(() => clientes.map((cliente) => ({
    cliente,
    planActivo: planMap.get(cliente.id) || null,
    ultimoPago: pagoMap.get(cliente.id) || null,
    sesionesRestantes: getRestantes(planMap.get(cliente.id) || null),
    empleadoNombre: resolveEmpleadoNombre(cliente),
  })), [clientes, planMap, pagoMap])

  const empleadosOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) {
      if (row.empleadoNombre !== 'Sin asignar') set.add(row.empleadoNombre)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [rows])

  const planOptions = useMemo(() => {
    const set = new Set<string>()
    for (const row of rows) {
      const n = row.planActivo?.planes?.nombre?.trim()
      if (n) set.add(n)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [rows])

  function isPlanPorVencer(plan: ClientePlan | null) {
    if (!plan?.fecha_fin) return false
    const fin = new Date(`${plan.fecha_fin}T00:00:00`)
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const dias = Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
    return dias >= 0 && dias <= 7
  }

  function limpiarFiltros() {
    setSearch(''); setEstadoFiltro('todos'); setEmpleadoFiltro('todos')
    setPlanEstadoFiltro('todos'); setPlanNombreFiltro('todos'); setOrdenPor('nombre_asc')
  }

  const clientesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = rows.filter(({ cliente, planActivo, empleadoNombre }) => {
      const matchSearch = !q ||
        cliente.nombre?.toLowerCase().includes(q) ||
        cliente.email?.toLowerCase().includes(q) ||
        cliente.telefono?.toLowerCase().includes(q) ||
        cliente.estado?.toLowerCase().includes(q) ||
        planActivo?.planes?.nombre?.toLowerCase().includes(q) ||
        empleadoNombre.toLowerCase().includes(q)
      const matchEstado = estadoFiltro === 'todos' || cliente.estado?.toLowerCase() === estadoFiltro.toLowerCase()
      const matchEmpleado = empleadoFiltro === 'todos' || empleadoNombre.toLowerCase() === empleadoFiltro.toLowerCase()
      const matchPlanEstado = planEstadoFiltro === 'todos' ||
        (planEstadoFiltro === 'con_plan' && !!planActivo) ||
        (planEstadoFiltro === 'sin_plan' && !planActivo) ||
        (planEstadoFiltro === 'por_vencer' && isPlanPorVencer(planActivo))
      const matchPlanNombre = planNombreFiltro === 'todos' ||
        (planActivo?.planes?.nombre || '').toLowerCase() === planNombreFiltro.toLowerCase()
      return matchSearch && matchEstado && matchEmpleado && matchPlanEstado && matchPlanNombre
    })

    filtered.sort((a, b) => {
      switch (ordenPor) {
        case 'nombre_asc': return a.cliente.nombre.localeCompare(b.cliente.nombre, 'es')
        case 'nombre_desc': return b.cliente.nombre.localeCompare(a.cliente.nombre, 'es')
        case 'empleado_asc': return a.empleadoNombre.localeCompare(b.empleadoNombre, 'es')
        case 'empleado_desc': return b.empleadoNombre.localeCompare(a.empleadoNombre, 'es')
        case 'fecha_reciente': return getDateTimestamp(b.cliente.created_at) - getDateTimestamp(a.cliente.created_at)
        case 'fecha_antigua': return getDateTimestamp(a.cliente.created_at) - getDateTimestamp(b.cliente.created_at)
        case 'estado': return (a.cliente.estado || '').localeCompare(b.cliente.estado || '', 'es')
        case 'sesiones_mayor': return b.sesionesRestantes - a.sesionesRestantes
        case 'sesiones_menor': return a.sesionesRestantes - b.sesionesRestantes
        default: return 0
      }
    })

    return filtered
  }, [rows, search, estadoFiltro, empleadoFiltro, planEstadoFiltro, planNombreFiltro, ordenPor])

  const stats = useMemo(() => ({
    total: rows.length,
    activos: rows.filter((r) => r.cliente.estado === 'activo').length,
    conPlan: rows.filter((r) => !!r.planActivo).length,
    sinPlan: rows.filter((r) => !r.planActivo).length,
    porVencer: rows.filter((r) => isPlanPorVencer(r.planActivo)).length,
  }), [rows])

  function handleEliminacionConfirmada() {
    setClienteAEliminar(null)
    void loadClientes()
  }

  return (
    <div className="space-y-6">

      {/* Modal eliminación */}
      {clienteAEliminar && (
        <ModalEliminar
          cliente={clienteAEliminar}
          onCancel={() => setClienteAEliminar(null)}
          onConfirm={handleEliminacionConfirmada}
        />
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Administración</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Clientes</h1>
          <p className="mt-2 text-sm text-white/55">Listado general de clientes, plan activo, sesiones y último pago.</p>
        </div>
        <div className="w-full max-w-sm">
          <ActionCard title="Nuevo cliente" description="Crear un nuevo cliente en el sistema." href="/admin/personas/clientes/nuevo" />
        </div>
      </div>

      {error && (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <button type="button" onClick={() => setPlanEstadoFiltro('todos')} className="text-left transition hover:-translate-y-0.5 hover:opacity-90">
          <StatCard title="Total clientes" value={stats.total} />
        </button>
        <button type="button" onClick={() => setEstadoFiltro('activo')} className="text-left transition hover:-translate-y-0.5 hover:opacity-90">
          <StatCard title="Clientes activos" value={stats.activos} color="text-emerald-400" />
        </button>
        <button type="button" onClick={() => setPlanEstadoFiltro('con_plan')} className="text-left transition hover:-translate-y-0.5 hover:opacity-90">
          <StatCard title="Con plan activo" value={stats.conPlan} />
        </button>
        <button type="button" onClick={() => setPlanEstadoFiltro('sin_plan')} className="text-left transition hover:-translate-y-0.5 hover:opacity-90">
          <StatCard title="Sin plan activo" value={stats.sinPlan} color="text-amber-300" />
        </button>
        <button type="button" onClick={() => setPlanEstadoFiltro('por_vencer')} className="text-left transition hover:-translate-y-0.5 hover:opacity-90">
          <StatCard title="Planes por vencer" value={stats.porVencer} color="text-rose-400" />
        </button>
      </div>

      <Section title="Filtros" description="Busca por nombre, correo, teléfono, estado, plan o empleado.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2">
            <Field label="Buscar">
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, correo, teléfono, estado, plan o empleado..."
                className={inputClassName} />
            </Field>
          </div>
          <div>
            <Field label="Estado">
              <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className={inputClassName}>
                <option value="todos" className="bg-[#11131a] text-white">Todos</option>
                <option value="activo" className="bg-[#11131a] text-white">Activos</option>
                <option value="inactivo" className="bg-[#11131a] text-white">Inactivos</option>
                <option value="pausado" className="bg-[#11131a] text-white">Pausados</option>
              </select>
            </Field>
          </div>
          <div>
            <Field label="Fisioterapeuta">
              <select value={empleadoFiltro} onChange={(e) => setEmpleadoFiltro(e.target.value)} className={inputClassName}>
                <option value="todos" className="bg-[#11131a] text-white">Todos</option>
                {empleadosOptions.map((emp) => (
                  <option key={emp} value={emp} className="bg-[#11131a] text-white">{emp}</option>
                ))}
              </select>
            </Field>
          </div>
          <div>
            <Field label="Plan activo">
              <select value={planEstadoFiltro} onChange={(e) => setPlanEstadoFiltro(e.target.value as PlanEstadoFiltro)} className={inputClassName}>
                <option value="todos" className="bg-[#11131a] text-white">Todos</option>
                <option value="con_plan" className="bg-[#11131a] text-white">Con plan activo</option>
                <option value="sin_plan" className="bg-[#11131a] text-white">Sin plan activo</option>
                <option value="por_vencer" className="bg-[#11131a] text-white">Por vencer</option>
              </select>
            </Field>
          </div>
          <div>
            <Field label="Tipo de plan">
              <select value={planNombreFiltro} onChange={(e) => setPlanNombreFiltro(e.target.value)} className={inputClassName}>
                <option value="todos" className="bg-[#11131a] text-white">Todos</option>
                {planOptions.map((plan) => (
                  <option key={plan} value={plan} className="bg-[#11131a] text-white">{plan}</option>
                ))}
              </select>
            </Field>
          </div>
          <div>
            <Field label="Ordenar">
              <select value={ordenPor} onChange={(e) => setOrdenPor(e.target.value as OrdenKey)} className={inputClassName}>
                <option value="nombre_asc" className="bg-[#11131a] text-white">Nombre A-Z</option>
                <option value="nombre_desc" className="bg-[#11131a] text-white">Nombre Z-A</option>
                <option value="empleado_asc" className="bg-[#11131a] text-white">Fisioterapeuta A-Z</option>
                <option value="empleado_desc" className="bg-[#11131a] text-white">Fisioterapeuta Z-A</option>
                <option value="fecha_reciente" className="bg-[#11131a] text-white">Más recientes</option>
                <option value="fecha_antigua" className="bg-[#11131a] text-white">Más antiguos</option>
                <option value="estado" className="bg-[#11131a] text-white">Estado</option>
                <option value="sesiones_mayor" className="bg-[#11131a] text-white">Más restantes</option>
                <option value="sesiones_menor" className="bg-[#11131a] text-white">Menos restantes</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/45">
            Mostrando <span className="font-semibold text-white/80">{clientesFiltrados.length}</span> de{' '}
            <span className="font-semibold text-white/80">{rows.length}</span> cliente(s)
          </p>
          <button type="button" onClick={limpiarFiltros}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/[0.06] sm:w-auto">
            Limpiar filtros
          </button>
        </div>
      </Section>

      <Section title="Listado de clientes"
        description="Vista general de clientes, plan activo, sesiones, empleado y pagos."
        className="p-0" contentClassName="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03]">
              <tr className="text-left text-white/55">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Fisioterapeuta</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Plan activo</th>
                <th className="px-4 py-3 font-medium">Sesiones</th>
                <th className="px-4 py-3 font-medium">Último pago</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-white/55">Cargando clientes...</td>
                </tr>
              ) : clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-white/55">No hay clientes registrados.</td>
                </tr>
              ) : (
                clientesFiltrados.map(({ cliente, planActivo, ultimoPago, sesionesRestantes, empleadoNombre }) => (
                  <tr key={cliente.id} className="align-top transition hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{cliente.nombre}</div>
                      <div className="mt-1 space-y-1">
                        {getAuditLines(cliente).map((line, i) => (
                          <div key={i} className="text-[11px] leading-4 text-white/35">{line}</div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-white/75">{cliente.email || 'Sin correo'}</div>
                      <div className="mt-1 text-xs text-white/45">{cliente.telefono || 'Sin teléfono'}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-white">{empleadoNombre}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${estadoBadge(cliente.estado)}`}>
                        {cliente.estado}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {planActivo ? (
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium text-white">{planActivo.planes?.nombre || 'Plan'}</div>
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${estadoPlanBadge(planActivo.estado)}`}>
                              {getPlanStatusLabel(planActivo.estado)}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-white/45">Vence: {formatDate(planActivo.fecha_fin)}</div>
                          <div className="mt-1 text-xs text-white/45">Vigencia: {formatVigencia(planActivo.planes?.vigencia_valor, planActivo.planes?.vigencia_tipo)}</div>
                          <div className="mt-1 text-xs text-white/45">Valor: {money(planActivo.planes?.precio)}</div>
                          <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[11px] leading-4 text-white/45">
                            <span className="font-semibold text-white/65">Creado por:</span> {getPlanCreatorLine(planActivo)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-white/55">Sin plan activo</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {planActivo ? (
                        <div>
                          <div className="font-medium text-white">
                            {Number(planActivo.sesiones_usadas || 0)}/{Number(planActivo.sesiones_totales || 0)}
                          </div>
                          <div className="mt-1 text-xs text-white/45">Restantes: {sesionesRestantes}</div>
                        </div>
                      ) : (
                        <span className="text-white/55">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {ultimoPago ? (
                        <div>
                          <div className="font-medium text-white">
                            {money(
                              ultimoPago.moneda_pago === 'BS'
                                ? Number(ultimoPago.monto_equivalente_bs || 0)
                                : Number(ultimoPago.monto_equivalente_usd || 0),
                              ultimoPago.moneda_pago || 'USD'
                            )}
                          </div>
                          <div className="mt-1 text-xs text-white/45">{formatDate(ultimoPago.fecha)}</div>
                        </div>
                      ) : (
                        <span className="text-white/55">Sin pagos</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/admin/personas/clientes/${cliente.id}`}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/[0.06]">
                          Ver
                        </Link>
                        <Link href={`/admin/personas/clientes/${cliente.id}/plan`}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/[0.06]">
                          Plan
                        </Link>
                        <Link href={`/admin/personas/clientes/${cliente.id}/editar`}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/[0.06]">
                          Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => setClienteAEliminar(cliente)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-400/20"
                        >
                          <Trash2 className="h-3 w-3" />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  )
}