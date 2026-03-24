'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Terapeuta = { id: string; nombre: string; especialidad: string | null; comision_plan_porcentaje: number; comision_cita_porcentaje: number }
type Plan = { id: string; nombre: string; sesiones_totales: number; vigencia_dias: number; precio: number; descripcion: string | null }
type Recurso = { id: string; nombre: string; tipo: string | null }
type MetodoPago = { id: string; nombre: string; tipo: string | null }
type EntrenamientoExistente = { id: string; hora_inicio: string; hora_fin: string; fecha: string; clientes: { nombre: string } | null }

// ─── Constantes ───────────────────────────────────────────────────────────────

const DIAS_SEMANA = [
  { key: 1, label: 'L', nombre: 'Lunes' },
  { key: 2, label: 'M', nombre: 'Martes' },
  { key: 3, label: 'X', nombre: 'Miércoles' },
  { key: 4, label: 'J', nombre: 'Jueves' },
  { key: 5, label: 'V', nombre: 'Viernes' },
  { key: 6, label: 'S', nombre: 'Sábado' },
  { key: 0, label: 'D', nombre: 'Domingo' },
]

const HOUR_HEIGHT = 40
const TOTAL_HOURS = 24

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTodayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function addDaysToDate(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDate(v: string | null) {
  if (!v) return '—'
  try { return new Date(`${v}T00:00:00`).toLocaleDateString('es') } catch { return v }
}

function formatMoney(v: number | null | undefined) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(v || 0))
}

function formatBs(v: number) {
  return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'VES', maximumFractionDigits: 2 }).format(v)
}

function timeToMinutes(t: string) {
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function sumarMinutos(hora: string, minutos: number) {
  return `${minutesToTime(timeToMinutes(hora) + minutos)}:00`
}

function generarFechasSesiones(fechaInicio: string, diasSemana: number[], totalSesiones: number): string[] {
  if (!diasSemana.length || !totalSesiones) return []
  const fechas: string[] = []
  const current = new Date(`${fechaInicio}T00:00:00`)
  let guard = 0
  while (fechas.length < totalSesiones && guard < 1000) {
    if (diasSemana.includes(current.getDay())) {
      fechas.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`)
    }
    current.setDate(current.getDate() + 1)
    guard++
  }
  return fechas
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function Field({ label, children, helper }: { label: string; children: ReactNode; helper?: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/75">{label}</label>
      {children}
      {helper ? <p className="mt-2 text-xs text-white/45">{helper}</p> : null}
    </div>
  )
}

const inputCls = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35 focus:border-white/20 focus:bg-white/[0.05]
`

// ─── Paso indicator ───────────────────────────────────────────────────────────

function PasoIndicator({ paso, actual }: { paso: number; actual: number }) {
  const pasos = [
    { n: 1, label: 'Datos del cliente' },
    { n: 2, label: 'Plan y entrenamientos' },
    { n: 3, label: 'Pago' },
  ]

  return (
    <div className="flex items-center gap-2">
      {pasos.map((p, i) => (
        <div key={p.n} className="flex items-center gap-2">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition ${
            p.n < actual ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-400'
            : p.n === actual ? 'border-violet-400/40 bg-violet-500/20 text-violet-300'
            : 'border-white/10 bg-white/[0.03] text-white/30'
          }`}>
            {p.n < actual ? '✓' : p.n}
          </div>
          <span className={`hidden text-sm sm:block ${p.n === actual ? 'text-white' : 'text-white/35'}`}>
            {p.label}
          </span>
          {i < pasos.length - 1 && (
            <div className={`h-px w-8 ${p.n < actual ? 'bg-emerald-400/30' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Calendario disponibilidad ────────────────────────────────────────────────

function CalendarioDisponibilidad({
  fechaVista, horaInicio, horaFin, entrenamientosExistentes, onSelectHora,
}: {
  fechaVista: string
  horaInicio: string
  horaFin: string
  entrenamientosExistentes: EntrenamientoExistente[]
  onSelectHora: (hora: string) => void
}) {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i)

  function getTop(minutes: number) { return (minutes / 60) * HOUR_HEIGHT }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const relY = Math.max(0, Math.min(e.clientY - rect.top, HOUR_HEIGHT * TOTAL_HOURS))
    const raw = (relY / (HOUR_HEIGHT * TOTAL_HOURS)) * TOTAL_HOURS * 60
    onSelectHora(minutesToTime(Math.round(raw / 30) * 30))
  }

  const inicioPx = horaInicio ? getTop(timeToMinutes(horaInicio)) : null
  const finPx = horaFin ? getTop(timeToMinutes(horaFin)) : null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-white/40">
        <span>
          {fechaVista
            ? new Date(`${fechaVista}T00:00:00`).toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
            : '—'}
        </span>
        <div className="flex gap-3">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-rose-500/70" />Ocupado</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-violet-500/70" />Nueva sesión</span>
        </div>
      </div>

      <div className="relative cursor-pointer overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02]" style={{ height: 380 }}>
        <div className="relative select-none" style={{ height: HOUR_HEIGHT * TOTAL_HOURS }} onClick={handleClick}>
          {hours.map((h) => (
            <div key={h} className="pointer-events-none absolute left-0 right-0 flex items-start" style={{ top: h * HOUR_HEIGHT }}>
              <span className="w-12 shrink-0 pr-2 text-right text-xs text-white/25 -translate-y-2">
                {h < 24 ? `${String(h).padStart(2, '0')}:00` : ''}
              </span>
              <div className="flex-1 border-t border-white/[0.06]" />
            </div>
          ))}
          {Array.from({ length: TOTAL_HOURS }, (_, h) => (
            <div key={`hh-${h}`} className="pointer-events-none absolute left-12 right-0 border-t border-white/[0.03]" style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
          ))}
          {entrenamientosExistentes.map((ent) => {
            const top = getTop(timeToMinutes(ent.hora_inicio))
            const height = Math.max(20, getTop(timeToMinutes(ent.hora_fin)) - top)
            return (
              <div key={ent.id} className="pointer-events-none absolute left-12 right-2 overflow-hidden rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-1" style={{ top, height }}>
                <p className="truncate text-xs font-medium text-rose-300">{ent.clientes?.nombre || 'Cliente'}</p>
                <p className="text-xs text-rose-400/70">{ent.hora_inicio.slice(0, 5)} – {ent.hora_fin.slice(0, 5)}</p>
              </div>
            )
          })}
          {inicioPx !== null && finPx !== null && (
            <div className="pointer-events-none absolute left-12 right-2 overflow-hidden rounded-lg border border-violet-400/30 bg-violet-500/15 px-2 py-1" style={{ top: inicioPx, height: Math.max(20, finPx - inicioPx) }}>
              <p className="text-xs font-semibold text-violet-300">Nueva sesión</p>
              <p className="text-xs text-violet-400/70">{horaInicio} – {horaFin?.slice(0, 5)}</p>
            </div>
          )}
          {fechaVista === getTodayLocal() && (
            <div className="pointer-events-none absolute left-0 right-0" style={{ top: getTop(new Date().getHours() * 60 + new Date().getMinutes()) }}>
              <div className="ml-12 flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <div className="flex-1 border-t border-emerald-400/60" />
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="text-center text-xs text-white/30">Haz clic para seleccionar la hora de inicio</p>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function NuevoClientePage() {
  const router = useRouter()
  const [paso, setPaso] = useState(1)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Data
  const [terapeutas, setTerapeutas] = useState<Terapeuta[]>([])
  const [planes, setPlanes] = useState<Plan[]>([])
  const [recursos, setRecursos] = useState<Recurso[]>([])
  const [metodosPago, setMetodosPago] = useState<MetodoPago[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [entrenamientosEmpleado, setEntrenamientosEmpleado] = useState<EntrenamientoExistente[]>([])

  // ID del cliente creado (entre pasos)
  const [clienteId, setClienteId] = useState<string | null>(null)

  // ── Paso 1: Datos cliente ──────────────────────────────────────────────────
  const [formCliente, setFormCliente] = useState({
    nombre: '',
    telefono: '',
    email: '',
    fecha_nacimiento: '',
    genero: '',
    direccion: '',
    terapeuta_id: '',
    estado: 'activo' as 'activo' | 'inactivo' | 'pausado',
    notas: '',
  })

  // ── Paso 2: Plan y entrenamientos ─────────────────────────────────────────
  const [saltarPlan, setSaltarPlan] = useState(false)
  const [planId, setPlanId] = useState('')
  const [fechaInicio, setFechaInicio] = useState(getTodayLocal())
  const [empleadoId, setEmpleadoId] = useState('')
  const [recursoId, setRecursoId] = useState('')
  const [diasSemana, setDiasSemana] = useState<number[]>([])
  const [horaInicio, setHoraInicio] = useState('')
  const [duracionMin, setDuracionMin] = useState(60)
  const [fechaVistaCal, setFechaVistaCal] = useState(getTodayLocal())

  // ── Paso 3: Pago ───────────────────────────────────────────────────────────
  const [saltarPago, setSaltarPago] = useState(false)
  const [metodoPagoId, setMetodoPagoId] = useState('')
  const [usarPrecioPlan, setUsarPrecioPlan] = useState(true)
  const [montoPersonalizado, setMontoPersonalizado] = useState('')
  const [esBs, setEsBs] = useState(false)
  const [referenciaTasa, setReferenciaTasa] = useState<'USD' | 'EUR'>('USD')
  const [tasaBCV, setTasaBCV] = useState('')
  const [notasPago, setNotasPago] = useState('')
  const [origenCliente, setOrigenCliente] = useState<'rpm' | 'entrenador'>('rpm')
  const [porcentajeRpm, setPorcentajeRpm] = useState(35)
  const [montoBaseComision, setMontoBaseComision] = useState('')
  const [mostrarCrearPlan, setMostrarCrearPlan] = useState(false)
  const [nuevoPlanNombre, setNuevoPlanNombre] = useState('')
  const [nuevoPlanSesiones, setNuevoPlanSesiones] = useState(12)
  const [nuevoPlanVigencia, setNuevoPlanVigencia] = useState(30)
  const [nuevoPlanPrecio, setNuevoPlanPrecio] = useState('')
  const [creandoPlan, setCreandoPlan] = useState(false)

  // ── Carga inicial ──────────────────────────────────────────────────────────

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    setLoadingData(true)
    const [tRes, pRes, rRes, mRes] = await Promise.all([
      supabase.from('empleados').select('id, nombre, especialidad, comision_plan_porcentaje, comision_cita_porcentaje').eq('rol', 'terapeuta').eq('estado', 'activo').order('nombre'),
      supabase.from('planes').select('id, nombre, sesiones_totales, vigencia_dias, precio, descripcion').eq('estado', 'activo').order('nombre'),
      supabase.from('recursos').select('id, nombre, tipo').order('nombre'),
      supabase.from('metodos_pago').select('id, nombre, tipo').eq('estado', 'activo').order('nombre'),
    ])
    setTerapeutas((tRes.data || []) as Terapeuta[])
    setPlanes((pRes.data || []) as Plan[])
    setRecursos((rRes.data || []) as Recurso[])
    setMetodosPago((mRes.data || []) as MetodoPago[])
    setLoadingData(false)
  }

  // Cargar entrenamientos cuando cambia entrenador o fecha vista
  useEffect(() => {
    if (!empleadoId || !fechaVistaCal) { setEntrenamientosEmpleado([]); return }
    void supabase
      .from('entrenamientos')
      .select('id, hora_inicio, hora_fin, fecha, clientes:cliente_id ( nombre )')
      .eq('empleado_id', empleadoId)
      .eq('fecha', fechaVistaCal)
      .neq('estado', 'cancelado')
      .order('hora_inicio')
      .then(({ data }) => setEntrenamientosEmpleado((data || []) as unknown as EntrenamientoExistente[]))
  }, [empleadoId, fechaVistaCal])

  // Detectar método Bs
  useEffect(() => {
    const m = metodosPago.find((x) => x.id === metodoPagoId)
    const n = (m?.nombre || '').toLowerCase()
    setEsBs(n.includes('bs') || n.includes('bolívar') || n.includes('bolivar') || n.includes('pago móvil'))
  }, [metodoPagoId, metodosPago])

  // ── Cálculos ──────────────────────────────────────────────────────────────

  const planSeleccionado = useMemo(() => planes.find((p) => p.id === planId) || null, [planes, planId])

  const horaFin = useMemo(() => {
    if (!horaInicio) return ''
    return sumarMinutos(horaInicio, duracionMin)
  }, [horaInicio, duracionMin])

  const montoBase = usarPrecioPlan ? (planSeleccionado?.precio || 0) : Number(montoPersonalizado || 0)
  const tasaBCVNum = Number(tasaBCV || 0)
  const montoCalculadoBs = esBs && montoBase > 0 && tasaBCVNum > 0 ? montoBase * tasaBCVNum : 0

  const fechasPreview = useMemo(() => {
    if (!fechaInicio || !diasSemana.length || !planSeleccionado) return []
    return generarFechasSesiones(fechaInicio, diasSemana, planSeleccionado.sesiones_totales)
  }, [fechaInicio, diasSemana, planSeleccionado])

  function toggleDia(dia: number) {
    setDiasSemana((prev) => prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia])
  }

  function handleClienteChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target
    setFormCliente((prev) => ({ ...prev, [name]: value }))
  }


  async function crearPlanInline() {
    if (!nuevoPlanNombre.trim()) { alert('Ingresa el nombre del plan.'); return }
    if (!nuevoPlanPrecio || Number(nuevoPlanPrecio) <= 0) { alert('Ingresa un precio válido.'); return }
    setCreandoPlan(true)
    try {
      const { data: plan, error } = await supabase.from('planes').insert({
        nombre: nuevoPlanNombre.trim(),
        sesiones_totales: nuevoPlanSesiones,
        vigencia_dias: nuevoPlanVigencia,
        precio: Number(nuevoPlanPrecio),
        estado: 'activo',
      }).select('id, nombre, sesiones_totales, vigencia_dias, precio, descripcion').single()
      if (error) throw new Error(error.message)
      setPlanes((prev) => [...prev, plan as Plan].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setPlanId(plan.id)
      setMontoBaseComision(String(plan.precio))
      setMostrarCrearPlan(false)
      setNuevoPlanNombre(''); setNuevoPlanSesiones(12); setNuevoPlanVigencia(30); setNuevoPlanPrecio('')
    } catch (err: any) {
      alert(err?.message || 'Error al crear el plan.')
    } finally { setCreandoPlan(false) }
  }

  // ✅ Comisión con lógica de origen
  // Cliente RPM: RPM registra todo, le paga al profesional su parte
  // Cliente entrenador: RPM solo registra SU parte (rpm), profesional = 0
  async function registrarComision(
    clientePlanId: string, empId: string, clienteId: string,
    montoFinal: number, montoBase: number, fecha: string,
    porcRpm: number, origen: 'rpm' | 'entrenador'
  ) {
    try {
      const rpm = Math.round((montoBase * porcRpm) / 100 * 100) / 100
      const profesional = origen === 'rpm'
        ? Math.round((montoBase - rpm) * 100) / 100
        : 0
      const base = origen === 'rpm' ? montoBase : rpm // ✅ entrenador: solo suma lo de RPM
      const { error } = await supabase.from('comisiones_detalle').insert({
        empleado_id: empId,
        cliente_id: clienteId,
        cliente_plan_id: clientePlanId,
        fecha,
        base,
        profesional,
        rpm,
        tipo: 'plan',
        estado: 'pendiente',
      })
      if (error) console.error('❌ Error comisión:', error.message)
      else console.log('✅ Comisión registrada:', { origen, montoFinal, montoBase, rpm, profesional })
    } catch (err) {
      console.error('❌ Error registrando comisión:', err)
    }
  }

  // ── PASO 1: Guardar cliente ───────────────────────────────────────────────

  async function handleGuardarCliente(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')

    if (!formCliente.nombre.trim()) { setErrorMsg('El nombre es obligatorio.'); return }
    if (formCliente.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formCliente.email)) {
      setErrorMsg('El correo no tiene formato válido.'); return
    }

    setSaving(true)
    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nombre: formCliente.nombre.trim(),
        telefono: formCliente.telefono.trim() || null,
        email: formCliente.email.trim() || null,
        fecha_nacimiento: formCliente.fecha_nacimiento || null,
        genero: formCliente.genero || null,
        direccion: formCliente.direccion.trim() || null,
        terapeuta_id: formCliente.terapeuta_id || null,
        estado: formCliente.estado,
        notas: formCliente.notas.trim() || null,
      })
      .select('id')
      .single()

    setSaving(false)

    if (error || !data) { setErrorMsg(error?.message || 'No se pudo guardar el cliente.'); return }

    setClienteId(data.id)
    if (formCliente.terapeuta_id) {
      setEmpleadoId(formCliente.terapeuta_id)
      setFechaVistaCal(fechaInicio)
    }
    setPaso(2)
    setErrorMsg('')
  }

  // ── PASO 2: Guardar plan + entrenamientos ─────────────────────────────────

  async function handleGuardarPlan(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')

    if (saltarPlan) { setPaso(3); return }

    if (!planId) { setErrorMsg('Selecciona un plan.'); return }
    if (!empleadoId) { setErrorMsg('Selecciona un entrenador.'); return }
    if (!diasSemana.length) { setErrorMsg('Selecciona al menos un día.'); return }
    if (!horaInicio) { setErrorMsg('Selecciona la hora de entrenamiento.'); return }
    if (!clienteId) { setErrorMsg('Error: cliente no encontrado.'); return }

    const plan = planSeleccionado!
    setSaving(true)

    try {
      const fechaFin = addDaysToDate(fechaInicio, plan.vigencia_dias)
      const { data: nuevoPlan, error: cpError } = await supabase
        .from('clientes_planes')
        .insert({
          cliente_id: clienteId,
          plan_id: plan.id,
          sesiones_totales: plan.sesiones_totales,
          sesiones_usadas: 0,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          estado: 'activo',
        })
        .select('id')
        .single()

      if (cpError) throw new Error(cpError.message)

      const fechas = generarFechasSesiones(fechaInicio, diasSemana, plan.sesiones_totales)
      const horaInicioNorm = horaInicio.length === 5 ? `${horaInicio}:00` : horaInicio
      const horaFinNorm = horaFin.length === 5 ? `${horaFin}:00` : horaFin

      if (fechas.length > 0) {
        const { error: entError } = await supabase.from('entrenamientos').insert(
          fechas.map((fecha) => ({
            cliente_plan_id: nuevoPlan.id,
            cliente_id: clienteId,
            empleado_id: empleadoId,
            recurso_id: recursoId || null,
            fecha,
            hora_inicio: horaInicioNorm,
            hora_fin: horaFinNorm,
            estado: 'programado',
          }))
        )
        if (entError) throw new Error(`Plan creado pero error en entrenamientos: ${entError.message}`)
      }

      setPaso(3)
      setErrorMsg('')
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar el plan.')
    } finally {
      setSaving(false)
    }
  }

  // ── PASO 3: Registrar pago y finalizar ────────────────────────────────────

  async function handleGuardarPago(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')

    if (!saltarPago) {
      if (!metodoPagoId) { setErrorMsg('Selecciona un método de pago.'); return }
      if (esBs && (!tasaBCV || tasaBCVNum <= 0)) { setErrorMsg('Ingresa la tasa BCV.'); return }

      if (clienteId && planSeleccionado && montoBase > 0) {
        setSaving(true)
        try {
          // Buscar el cliente_plan recién creado
          const { data: cp } = await supabase
            .from('clientes_planes')
            .select('id')
            .eq('cliente_id', clienteId)
            .eq('estado', 'activo')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          const montoFinal = esBs ? montoCalculadoBs : montoBase
          const concepto = esBs
            ? `Plan: ${planSeleccionado.nombre} — ${formCliente.nombre} (${formatMoney(montoBase)} × ${tasaBCV} = ${formatBs(montoCalculadoBs)})`
            : `Plan: ${planSeleccionado.nombre} — ${formCliente.nombre}`

          const { error: pagoError } = await supabase.from('pagos').insert({
            fecha: fechaInicio,
            tipo_origen: 'plan',
            cliente_id: clienteId,
            cliente_plan_id: cp?.id || null,
            concepto,
            categoria: 'plan',
            monto: montoFinal,
            metodo_pago_id: metodoPagoId,
            estado: 'pagado',
            notas: notasPago || null,
          })

          if (pagoError) throw new Error(pagoError.message)

          // ✅ Registrar comisión del entrenador con lógica de origen
          if (empleadoId && cp?.id) {
            const baseComision = Number(montoBaseComision) > 0 ? Number(montoBaseComision) : (planSeleccionado?.precio || montoFinal)
            await registrarComision(cp.id, empleadoId, clienteId, montoFinal, baseComision, fechaInicio, porcentajeRpm, origenCliente)
            // Actualizar clientes_planes con origen y porcentaje
            await supabase.from('clientes_planes').update({
              origen: origenCliente,
              porcentaje_rpm: porcentajeRpm,
              monto_base_comision: baseComision,
            }).eq('id', cp.id)
          }
        } catch (err: any) {
          setErrorMsg(err?.message || 'Error registrando el pago.')
          setSaving(false)
          return
        } finally {
          setSaving(false)
        }
      }
    }

    // Todo listo → ir a la ficha del cliente
    router.push(`/admin/personas/clientes/${clienteId}`)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadingData) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/55">Clientes</p>
        <h1 className="text-2xl font-semibold text-white">Nuevo cliente</h1>
        <Card className="p-6"><p className="text-sm text-white/55">Cargando...</p></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Clientes</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Nuevo cliente</h1>
          <p className="mt-2 text-sm text-white/55">Registro completo en un solo flujo.</p>
        </div>
        <ActionCard title="Volver" description="Regresar al listado." href="/admin/personas/clientes" />
      </div>

      {/* Paso indicator */}
      <Card className="p-4">
        <PasoIndicator paso={paso} actual={paso} />
      </Card>

      {/* ── PASO 1: Datos del cliente ── */}
      {paso === 1 && (
        <Section title="Datos del cliente" description="Completa la información básica del cliente.">
          <form onSubmit={handleGuardarCliente} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Field label="Nombre completo *">
                  <input name="nombre" value={formCliente.nombre} onChange={handleClienteChange}
                    placeholder="Ej: Juan Pérez" className={inputCls} required />
                </Field>
              </div>

              <Field label="Teléfono">
                <input name="telefono" value={formCliente.telefono} onChange={handleClienteChange}
                  placeholder="+58 412 000 0000" className={inputCls} />
              </Field>

              <Field label="Correo">
                <input type="email" name="email" value={formCliente.email} onChange={handleClienteChange}
                  placeholder="ejemplo@correo.com" className={inputCls} />
              </Field>

              <Field label="Fecha de nacimiento">
                <input type="date" name="fecha_nacimiento" value={formCliente.fecha_nacimiento}
                  onChange={handleClienteChange} className={inputCls} />
              </Field>

              <Field label="Género">
                <select name="genero" value={formCliente.genero} onChange={handleClienteChange} className={inputCls}>
                  <option value="" className="bg-[#11131a]">Seleccionar</option>
                  <option value="masculino" className="bg-[#11131a]">Masculino</option>
                  <option value="femenino" className="bg-[#11131a]">Femenino</option>
                  <option value="otro" className="bg-[#11131a]">Otro</option>
                  <option value="prefiero_no_decir" className="bg-[#11131a]">Prefiero no decir</option>
                </select>
              </Field>

              <div className="md:col-span-2">
                <Field label="Dirección">
                  <input name="direccion" value={formCliente.direccion} onChange={handleClienteChange}
                    placeholder="Dirección del cliente" className={inputCls} />
                </Field>
              </div>

<Field label="Entrenador principal" helper="Se pre-seleccionará en el paso de entrenamientos">
                <select name="terapeuta_id" value={formCliente.terapeuta_id} onChange={handleClienteChange} className={inputCls}>
                  <option value="" className="bg-[#11131a]">Sin asignar</option>
                  {terapeutas.map((t) => (
                    <option key={t.id} value={t.id} className="bg-[#11131a]">
                      {t.nombre}{t.especialidad ? ` · ${t.especialidad}` : ''}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Estado">
                <select name="estado" value={formCliente.estado} onChange={handleClienteChange} className={inputCls}>
                  <option value="activo" className="bg-[#11131a]">Activo</option>
                  <option value="pausado" className="bg-[#11131a]">Pausado</option>
                  <option value="inactivo" className="bg-[#11131a]">Inactivo</option>
                </select>
              </Field>

              <div className="md:col-span-2">
                <Field label="Notas">
                  <textarea name="notas" value={formCliente.notas} onChange={handleClienteChange}
                    rows={3} placeholder="Notas internas..." className={`${inputCls} resize-none`} />
                </Field>
              </div>
            </div>

            {errorMsg && <Card className="p-4"><p className="text-sm text-rose-400">{errorMsg}</p></Card>}

            <div className="flex gap-3">
              <button type="submit" disabled={saving}
                className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-60">
                {saving ? 'Guardando...' : 'Guardar y continuar →'}
              </button>
            </div>
          </form>
        </Section>
      )}

      {/* ── PASO 2: Plan y entrenamientos ── */}
      {paso === 2 && (
        <Section title="Plan y entrenamientos" description="Asigna un plan y configura los días de entrenamiento.">
          <form onSubmit={handleGuardarPlan} className="space-y-6">

            {/* Toggle saltar */}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSaltarPlan((p) => !p)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${saltarPlan ? 'bg-white/20' : 'bg-violet-500'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${saltarPlan ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <span className="text-sm text-white/75">
                {saltarPlan ? 'Saltar este paso (asignar plan después)' : 'Asignar plan ahora'}
              </span>
            </div>

            {!saltarPlan && (
              <>
                {/* Plan y fecha */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Plan">
                    <div className="flex gap-2">
                      <select value={planId} onChange={(e) => { setPlanId(e.target.value); const p = planes.find(x => x.id === e.target.value); if (p && !montoBaseComision) setMontoBaseComision(String(p.precio)) }} className={inputCls}>
                        <option value="" className="bg-[#11131a]">Seleccionar plan</option>
                        {planes.map((p) => (
                          <option key={p.id} value={p.id} className="bg-[#11131a]">
                            {p.nombre} · {p.sesiones_totales} ses. · {formatMoney(p.precio)}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setMostrarCrearPlan((v) => !v)}
                        className="shrink-0 rounded-2xl border border-violet-400/20 bg-violet-400/10 px-3 text-xs font-medium text-violet-300 hover:bg-violet-400/20 transition">
                        + Plan
                      </button>
                    </div>
                    {mostrarCrearPlan && (
                      <div className="mt-3 space-y-3 rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4">
                        <p className="text-xs font-medium text-violet-300">Crear nuevo plan</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs text-white/55">Nombre</label>
                            <input value={nuevoPlanNombre} onChange={(e) => setNuevoPlanNombre(e.target.value)} placeholder="Ej: Plan Básico" className={inputCls} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-white/55">Precio ($)</label>
                            <input type="number" min={0} step="0.01" value={nuevoPlanPrecio} onChange={(e) => setNuevoPlanPrecio(e.target.value)} placeholder="0.00" className={inputCls} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-white/55">Sesiones</label>
                            <input type="number" min={1} value={nuevoPlanSesiones} onChange={(e) => setNuevoPlanSesiones(Number(e.target.value))} className={inputCls} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-white/55">Vigencia (días)</label>
                            <input type="number" min={1} value={nuevoPlanVigencia} onChange={(e) => setNuevoPlanVigencia(Number(e.target.value))} className={inputCls} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={crearPlanInline} disabled={creandoPlan}
                            className="rounded-2xl border border-violet-400/20 bg-violet-400/15 px-4 py-2 text-xs font-semibold text-violet-300 transition hover:bg-violet-400/25 disabled:opacity-60">
                            {creandoPlan ? 'Creando...' : 'Crear y seleccionar'}
                          </button>
                          <button type="button" onClick={() => setMostrarCrearPlan(false)}
                            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-white/60 hover:bg-white/[0.06]">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </Field>

                  <Field label="Fecha de inicio">
                    <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className={inputCls} />
                  </Field>
                </div>

                {/* Info plan */}
                {planSeleccionado && (
                  <Card className="p-4 border-white/10 bg-white/[0.02]">
                    <p className="font-medium text-white">{planSeleccionado.nombre}</p>
                    {planSeleccionado.descripcion && <p className="mt-1 text-sm text-white/55">{planSeleccionado.descripcion}</p>}
                    <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                      <div><p className="text-xs text-white/45">Sesiones</p><p className="font-medium text-white">{planSeleccionado.sesiones_totales}</p></div>
                      <div><p className="text-xs text-white/45">Vigencia</p><p className="font-medium text-white">{planSeleccionado.vigencia_dias} días</p></div>
                      <div><p className="text-xs text-white/45">Vence</p><p className="font-medium text-white">{formatDate(addDaysToDate(fechaInicio, planSeleccionado.vigencia_dias))}</p></div>
                    </div>
                  </Card>
                )}

                {/* Entrenador y recurso */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Entrenador" helper="Pre-seleccionado del paso anterior, puedes cambiarlo">
                    <select value={empleadoId} onChange={(e) => { setEmpleadoId(e.target.value); setFechaVistaCal(fechaInicio) }} className={inputCls}>
                      <option value="" className="bg-[#11131a]">Seleccionar entrenador</option>
                      {terapeutas.map((t) => (
                        <option key={t.id} value={t.id} className="bg-[#11131a]">
                          {t.nombre}{t.especialidad ? ` · ${t.especialidad}` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Recurso / Espacio">
                    <select value={recursoId} onChange={(e) => setRecursoId(e.target.value)} className={inputCls}>
                      <option value="" className="bg-[#11131a]">Sin recurso</option>
                      {recursos.map((r) => (
                        <option key={r.id} value={r.id} className="bg-[#11131a]">{r.nombre}{r.tipo ? ` · ${r.tipo}` : ''}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* Días */}
                <Field label="Días de entrenamiento" helper="Selecciona los días de la semana">
                  <div className="flex flex-wrap gap-2 mt-1">
                    {DIAS_SEMANA.map((dia) => (
                      <button key={dia.key} type="button" onClick={() => toggleDia(dia.key)}
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-semibold transition ${
                          diasSemana.includes(dia.key)
                            ? 'border-violet-400/40 bg-violet-500/20 text-violet-300'
                            : 'border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06]'
                        }`}>
                        {dia.label}
                      </button>
                    ))}
                  </div>
                  {diasSemana.length > 0 && (
                    <p className="mt-2 text-xs text-white/45">
                      {diasSemana.map((d) => DIAS_SEMANA.find((x) => x.key === d)?.nombre).join(', ')}
                    </p>
                  )}
                </Field>

                {/* Hora y duración */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Hora de inicio" helper="O haz clic en el calendario →">
                    <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Duración">
                    <select value={duracionMin} onChange={(e) => setDuracionMin(Number(e.target.value))} className={inputCls}>
                      {[30, 45, 60, 75, 90, 120].map((m) => (
                        <option key={m} value={m} className="bg-[#11131a]">{m} minutos</option>
                      ))}
                    </select>
                  </Field>
                </div>

                {/* Calendario */}
                {empleadoId && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white/75">Disponibilidad del entrenador</p>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => {
                          const d = new Date(`${fechaVistaCal}T00:00:00`)
                          d.setDate(d.getDate() - 1)
                          setFechaVistaCal(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
                        }} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.06]">←</button>
                        <input type="date" value={fechaVistaCal} onChange={(e) => setFechaVistaCal(e.target.value)}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white outline-none" />
                        <button type="button" onClick={() => {
                          const d = new Date(`${fechaVistaCal}T00:00:00`)
                          d.setDate(d.getDate() + 1)
                          setFechaVistaCal(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
                        }} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 hover:bg-white/[0.06]">→</button>
                      </div>
                    </div>
                    <CalendarioDisponibilidad
                      fechaVista={fechaVistaCal}
                      horaInicio={horaInicio}
                      horaFin={horaFin}
                      entrenamientosExistentes={entrenamientosEmpleado}
                      onSelectHora={(hora) => setHoraInicio(hora)}
                    />
                  </div>
                )}

                {/* Preview fechas */}
                {fechasPreview.length > 0 && (
                  <Card className="p-4 border-violet-400/20 bg-violet-400/5">
                    <p className="text-sm font-medium text-violet-300">Se generarán {fechasPreview.length} entrenamientos</p>
                    <div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                      {fechasPreview.slice(0, 24).map((f, i) => (
                        <span key={i} className="rounded-lg bg-violet-500/10 px-2 py-0.5 text-xs text-violet-400">
                          {new Date(`${f}T00:00:00`).toLocaleDateString('es', { day: 'numeric', month: 'short' })}
                        </span>
                      ))}
                      {fechasPreview.length > 24 && <span className="text-xs text-violet-400/60">+{fechasPreview.length - 24} más</span>}
                    </div>
                  </Card>
                )}
              </>
            )}

            {errorMsg && <Card className="p-4"><p className="text-sm text-rose-400">{errorMsg}</p></Card>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setPaso(1)}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]">
                ← Atrás
              </button>
              <button type="submit" disabled={saving}
                className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-60">
                {saving ? 'Guardando...' : saltarPlan ? 'Saltar →' : 'Guardar y continuar →'}
              </button>
            </div>
          </form>
        </Section>
      )}

      {/* ── PASO 3: Pago ── */}
      {paso === 3 && (
        <Section title="Pago" description="Registra el pago del plan en finanzas.">
          <form onSubmit={handleGuardarPago} className="space-y-5">

            {/* Toggle saltar */}
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setSaltarPago((p) => !p)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${saltarPago ? 'bg-white/20' : 'bg-emerald-500'}`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${saltarPago ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
              <span className="text-sm text-white/75">
                {saltarPago ? 'Saltar pago (registrar después)' : 'Registrar pago ahora'}
              </span>
            </div>

            {!saltarPago && planSeleccionado && (
              <div className="space-y-4">

                {/* ✅ Configuración de comisión */}
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
                  <p className="text-sm font-medium text-white/75">Configuración de comisión</p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Precio oficial (base comisión)" helper={`Plan: $${planSeleccionado.precio}`}>
                      <input type="number" min={0} step="0.01"
                        value={montoBaseComision || planSeleccionado.precio}
                        onChange={(e) => setMontoBaseComision(e.target.value)}
                        className={inputCls} placeholder="0.00" />
                    </Field>
                    <Field label="% RPM sobre precio oficial">
                      <input type="number" min={0} max={100} step={1}
                        value={porcentajeRpm}
                        onChange={(e) => setPorcentajeRpm(Number(e.target.value))}
                        className={inputCls} />
                    </Field>
                  </div>
                  {(() => {
                    const base = Number(montoBaseComision) || planSeleccionado.precio || 0
                    const porcNum = Number(porcentajeRpm) || 0
                    const rpm = Math.round(base * porcNum / 100 * 100) / 100
                    const prof = Math.round((base - rpm) * 100) / 100
                    const advertencia = porcNum > 70 ? `⚠️ El % RPM es muy alto (${porcNum}%). ¿Seguro?` : prof < 0 ? '⚠️ El entrenador quedaría en negativo. Revisa los valores.' : base <= 0 ? '⚠️ Ingresa el precio oficial del plan.' : null
                    return (
                      <div className="space-y-2">
                        {advertencia && <p className="text-xs text-amber-400 font-medium">{advertencia}</p>}
                        <div className="grid grid-cols-2 gap-3 text-sm rounded-xl bg-white/[0.03] p-3">
                          <div>
                            <p className="text-xs text-white/35">RPM recibe</p>
                            <p className="font-semibold text-violet-400">${rpm.toFixed(2)}</p>
                            <p className="text-xs text-white/25">{porcNum}% de ${base.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-white/35">Entrenador recibe</p>
                            <p className={`font-semibold ${prof < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>${prof.toFixed(2)}</p>
                            <p className="text-xs text-white/25">{100 - porcNum}% de ${base.toFixed(2)}</p>
                          </div>
                        </div>
                        {base > 0 && (
                          <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/10">
                            <div className="bg-violet-500/70 transition-all" style={{ width: `${Math.min(porcNum, 100)}%` }} />
                            <div className="flex-1 bg-emerald-500/70" />
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Método de pago">
                    <select value={metodoPagoId} onChange={(e) => setMetodoPagoId(e.target.value)} className={inputCls}>
                      <option value="" className="bg-[#11131a]">Seleccionar</option>
                      {metodosPago.map((m) => (
                        <option key={m.id} value={m.id} className="bg-[#11131a]">{m.nombre}{m.tipo ? ` · ${m.tipo}` : ''}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Monto" helper={usarPrecioPlan ? 'Precio del plan' : 'Monto personalizado'}>
                    <div className="flex gap-2">
                      <input type="number" min={0} step="0.01"
                        value={usarPrecioPlan ? (planSeleccionado.precio ?? '') : montoPersonalizado}
                        readOnly={usarPrecioPlan}
                        onChange={(e) => setMontoPersonalizado(e.target.value)}
                        className={`${inputCls} ${usarPrecioPlan ? 'opacity-60 cursor-not-allowed' : ''}`}
                        placeholder="0.00" />
                      <button type="button" onClick={() => setUsarPrecioPlan((p) => !p)}
                        className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] px-3 text-xs text-white/60 hover:bg-white/[0.06]">
                        {usarPrecioPlan ? 'Editar' : 'Plan'}
                      </button>
                    </div>
                  </Field>
                </div>

                {esBs && (
                  <div className="space-y-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
                    <p className="text-sm font-medium text-amber-300">Pago en bolívares</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Tasa de referencia">
                        <select value={referenciaTasa} onChange={(e) => setReferenciaTasa(e.target.value as 'USD' | 'EUR')} className={inputCls}>
                          <option value="USD" className="bg-[#11131a]">Dólar (USD)</option>
                          <option value="EUR" className="bg-[#11131a]">Euro (EUR)</option>
                        </select>
                      </Field>
                      <Field label={`Tasa BCV ${referenciaTasa}`}>
                        <input type="number" step="0.0001" min="0" value={tasaBCV}
                          onChange={(e) => setTasaBCV(e.target.value)} placeholder="Ej: 36.52" className={inputCls} />
                      </Field>
                      <Field label="Total en Bs">
                        <input readOnly value={montoCalculadoBs > 0 ? formatBs(montoCalculadoBs) : '—'}
                          className={`${inputCls} opacity-60 cursor-not-allowed`} />
                      </Field>
                    </div>
                  </div>
                )}

                <Field label="Notas del pago">
                  <textarea value={notasPago} onChange={(e) => setNotasPago(e.target.value)}
                    rows={2} className={`${inputCls} resize-none`} placeholder="Notas opcionales..." />
                </Field>

                {/* Resumen final */}
                <Card className="p-4 border-emerald-400/20 bg-emerald-400/5">
                  <p className="text-sm font-medium text-emerald-300">Resumen del registro</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div><p className="text-xs text-white/45">Cliente</p><p className="text-white">{formCliente.nombre}</p></div>
                    <div><p className="text-xs text-white/45">Plan</p><p className="text-white">{planSeleccionado.nombre}</p></div>
                    <div><p className="text-xs text-white/45">Sesiones</p><p className="text-white">{planSeleccionado.sesiones_totales}</p></div>
                    <div><p className="text-xs text-white/45">Monto</p><p className="text-emerald-400 font-semibold">{esBs ? formatBs(montoCalculadoBs) : formatMoney(montoBase)}</p></div>
                  </div>
                </Card>
              </div>
            )}

            {!planSeleccionado && !saltarPlan && (
              <Card className="p-4 border-white/10">
                <p className="text-sm text-white/55">No se asignó plan, no hay pago que registrar.</p>
              </Card>
            )}

            {errorMsg && <Card className="p-4"><p className="text-sm text-rose-400">{errorMsg}</p></Card>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setPaso(2)}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]">
                ← Atrás
              </button>
              <button type="submit" disabled={saving}
                className="rounded-2xl border border-white/10 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-60">
                {saving ? 'Finalizando...' : 'Finalizar registro →'}
              </button>
            </div>
          </form>
        </Section>
      )}

    </div>
  )
}
