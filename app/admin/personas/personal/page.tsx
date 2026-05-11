'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'

// ─── Types ────────────────────────────────────────────────────────────────────

type Empleado = {
  id: string
  nombre: string
  cedula: string | null
  telefono: string | null
  email: string | null
  rol: string | null
  auth_user_id: string | null
  estado: string
  created_at: string
}

type CitaRaw = {
  id: string
  estado?: string | null
  fecha?: string | null
  [key: string]: any
}

type PersonalRow = {
  empleado: Empleado
  citasTotal: number
  citasHoy: number
  programadas: number
  confirmadas: number
  completadas: number
  canceladas: number
}

type RolUI = 'admin' | 'recepcionista' | 'terapeuta'

type CuentaFormState = {
  empleadoId: string
  nombre: string
  email: string
  password: string
  role: string
}

type FormState = {
  nombre: string
  cedula: string
  email: string
  telefono: string
  rol: RolUI
  estado: string
}

type ComisionResumen = {
  empleado_id: string
  nombre: string
  total_base_usd: number
  total_base_bs: number
  total_profesional_usd: number
  total_profesional_bs: number
  total_rpm_usd: number
  total_rpm_bs: number
  cantidad: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INITIAL_CUENTA_FORM: CuentaFormState = {
  empleadoId: '',
  nombre: '',
  email: '',
  password: '',
  role: 'terapeuta',
}

const INITIAL_FORM: FormState = {
  nombre: '',
  cedula: '',
  email: '',
  telefono: '',
  rol: 'terapeuta',
  estado: 'activo',
}

function generarPasswordTemporal() {
  const token = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `RPM-${token}-2026`
}

function firstOrNull<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

function money(v: number, currency: 'USD' | 'VES' = 'USD') {
  if (currency === 'VES') {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'VES',
      maximumFractionDigits: 2,
    }).format(Number(v || 0))
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(v || 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

function limpiarCedula(value: string) {
  return value.trim().toUpperCase()
}

function normalizarRol(value: string | null | undefined): RolUI {
  const rol = (value || '').trim().toLowerCase()
  if (rol === 'admin') return 'admin'
  if (rol === 'recepcionista' || rol === 'recepcion') return 'recepcionista'
  return 'terapeuta'
}

function mostrarRol(rol: string | null | undefined) {
  const value = normalizarRol(rol)
  if (value === 'terapeuta') return 'Terapeuta'
  if (value === 'recepcionista') return 'Recepcionista'
  if (value === 'admin') return 'Admin'
  return 'Sin rol'
}

function mapearRolCatalogo(rolUI: RolUI): 'admin' | 'recepcionista' | 'terapeuta' {
  return normalizarRol(rolUI)
}

function estadoBadge(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'activo':     return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
    case 'inactivo':   return 'border-white/10 bg-white/[0.05] text-white/70'
    case 'suspendido': return 'border-rose-400/25 bg-rose-400/10 text-rose-300'
    default:           return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function cargaBadge(citasHoy: number) {
  if (citasHoy <= 3) return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
  if (citasHoy <= 6) return 'border-amber-400/25 bg-amber-400/10 text-amber-300'
  return 'border-rose-400/25 bg-rose-400/10 text-rose-300'
}

function cargaLabel(citasHoy: number) {
  if (citasHoy <= 3) return 'Baja'
  if (citasHoy <= 6) return 'Media'
  return 'Alta'
}

function getFirstExistingKey(obj: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    if (key in obj) return key
  }
  return null
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const inputClassName = `
  w-full rounded-xl border border-white/10 bg-white/[0.04]
  px-4 py-2.5 text-sm text-white outline-none transition
  placeholder:text-white/25 focus:border-white/20 focus:bg-white/[0.07]
`

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
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/35">
        {label}
      </label>
      {children}
      {helper ? <p className="mt-1.5 text-[11px] text-white/35">{helper}</p> : null}
    </div>
  )
}

// Tab igual al de Agenda
function RolTab({
  label,
  count,
  active,
  color,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  color: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex flex-col items-start gap-1 rounded-2xl border px-5 py-4 text-left
        transition-all duration-200 cursor-pointer
        ${active
          ? 'border-white/20 bg-white/[0.08] shadow-lg shadow-black/20'
          : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'
        }
      `}
    >
      <span className={`text-2xl font-bold tracking-tight ${active ? color : 'text-white/80'}`}>
        {count}
      </span>
      <span className={`text-xs font-medium ${active ? 'text-white/80' : 'text-white/40'}`}>
        {label}
      </span>
      {active && (
        <span className={`mt-0.5 h-0.5 w-6 rounded-full ${color.replace('text-', 'bg-')}`} />
      )}
    </button>
  )
}

// Bloque de comisiones pendientes
function ComisionesPendientesBlock({ comisiones }: { comisiones: ComisionResumen[] }) {
  if (comisiones.length === 0) return null

  const totales = comisiones.reduce(
    (acc, c) => ({
      profUsd: acc.profUsd + c.total_profesional_usd,
      profBs: acc.profBs + c.total_profesional_bs,
      rpmUsd: acc.rpmUsd + c.total_rpm_usd,
      rpmBs: acc.rpmBs + c.total_rpm_bs,
      registros: acc.registros + c.cantidad,
    }),
    { profUsd: 0, profBs: 0, rpmUsd: 0, rpmBs: 0, registros: 0 }
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-400/15">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-amber-400/10 bg-amber-400/[0.04] px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span className="text-sm font-semibold text-white">Comisiones pendientes</span>
          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
            {totales.registros} registros
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-white/40">
          <span>
            Prof. <span className="font-semibold text-emerald-400">{money(totales.profUsd)}</span>
          </span>
          <span>
            RPM <span className="font-semibold text-white/60">{money(totales.rpmUsd)}</span>
          </span>
        </div>
      </div>

      {/* Cards de cada profesional */}
      <div className="grid gap-px bg-white/[0.04] sm:grid-cols-2 xl:grid-cols-4">
        {comisiones.map((c) => {
          const puedeAbrirPerfil = Boolean(c.empleado_id && !c.empleado_id.startsWith('sin-empleado-'))
          const cardClassName = `
            block bg-[#0b0f17] p-4 transition
            ${puedeAbrirPerfil ? 'cursor-pointer hover:bg-[#101722] focus:outline-none focus:ring-2 focus:ring-amber-400/30' : ''}
          `
          const contenido = (
            <>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{c.nombre}</p>
                  {puedeAbrirPerfil ? (
                    <p className="mt-0.5 text-[10px] font-medium text-amber-300/80">Click para abrir perfil</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/35">
                  {c.cantidad} reg.
                </span>
              </div>

              <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-white/35">Base USD</span>
                <span className="text-white/55">{money(c.total_base_usd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/35">Base Bs</span>
                <span className="text-white/55">{money(c.total_base_bs, 'VES')}</span>
              </div>

              <div className="my-2 h-px bg-white/[0.06]" />

              <div className="flex justify-between">
                <span className="font-semibold text-emerald-400">Prof. USD</span>
                <span className="font-bold text-emerald-400">{money(c.total_profesional_usd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-amber-400">Prof. Bs</span>
                <span className="font-bold text-amber-400">{money(c.total_profesional_bs, 'VES')}</span>
              </div>

              <div className="my-2 h-px bg-white/[0.06]" />

              <div className="flex justify-between">
                <span className="text-white/35">RPM USD</span>
                <span className="text-white/50">{money(c.total_rpm_usd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/35">RPM Bs</span>
                <span className="text-white/50">{money(c.total_rpm_bs, 'VES')}</span>
              </div>
              </div>
            </>
          )

          if (!puedeAbrirPerfil) {
            return (
              <div key={c.empleado_id} className={cardClassName}>
                {contenido}
              </div>
            )
          }

          return (
            <Link
              key={c.empleado_id}
              href={`/admin/personas/personal/${c.empleado_id}`}
              className={cardClassName}
              title={`Abrir perfil de ${c.nombre}`}
            >
              {contenido}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PersonalPage() {
  const [loading, setLoading] = useState(true)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [citas, setCitas] = useState<CitaRaw[]>([])
  const [search, setSearch] = useState('')
  const [rolFiltro, setRolFiltro] = useState('todos')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [error, setError] = useState('')

  // Comisiones
  const [comisiones, setComisiones] = useState<ComisionResumen[]>([])
  const [loadingComisiones, setLoadingComisiones] = useState(false)
  const [fechaComisionInicio, setFechaComisionInicio] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [fechaComisionFin, setFechaComisionFin] = useState(() => {
    const now = new Date()
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  })

  // Paneles
  const [showNuevoPanel, setShowNuevoPanel] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [form, setForm] = useState<FormState>(INITIAL_FORM)

  const [showCuentaPanel, setShowCuentaPanel] = useState(false)
  const [cuentaSaving, setCuentaSaving] = useState(false)
  const [cuentaError, setCuentaError] = useState('')
  const [cuentaSuccess, setCuentaSuccess] = useState('')
  const [cuentaForm, setCuentaForm] = useState<CuentaFormState>(INITIAL_CUENTA_FORM)

  const rolCatalogo = useMemo(() => mapearRolCatalogo(form.rol), [form.rol])

  const hoy = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])

  useEffect(() => {
    void loadPersonal()
  }, [])

  useEffect(() => {
    void loadComisiones()
  }, [fechaComisionInicio, fechaComisionFin])

  async function loadComisiones() {
    setLoadingComisiones(true)
    try {
      const { data, error } = await supabase
        .from('comisiones_detalle')
        .select(`
          empleado_id,
          monto_base_usd,
          monto_base_bs,
          monto_profesional_usd,
          monto_profesional_bs,
          monto_rpm_usd,
          monto_rpm_bs,
          empleados:empleado_id(nombre)
        `)
        .gte('fecha', fechaComisionInicio)
        .lte('fecha', fechaComisionFin)
        .eq('estado', 'pendiente')

      if (error) throw error

      const rows = (data || []) as any[]
      const grouped = new Map<string, ComisionResumen>()

      rows.forEach((c) => {
        const nombre = firstOrNull(c?.empleados)?.nombre || 'Sin profesional'
        const key = String(c.empleado_id || `sin-empleado-${nombre}`)
        const ex = grouped.get(key)

        if (ex) {
          ex.total_base_usd += Number(c.monto_base_usd || 0)
          ex.total_base_bs += Number(c.monto_base_bs || 0)
          ex.total_profesional_usd += Number(c.monto_profesional_usd || 0)
          ex.total_profesional_bs += Number(c.monto_profesional_bs || 0)
          ex.total_rpm_usd += Number(c.monto_rpm_usd || 0)
          ex.total_rpm_bs += Number(c.monto_rpm_bs || 0)
          ex.cantidad += 1
          return
        }

        grouped.set(key, {
          empleado_id: key,
          nombre,
          total_base_usd: Number(c.monto_base_usd || 0),
          total_base_bs: Number(c.monto_base_bs || 0),
          total_profesional_usd: Number(c.monto_profesional_usd || 0),
          total_profesional_bs: Number(c.monto_profesional_bs || 0),
          total_rpm_usd: Number(c.monto_rpm_usd || 0),
          total_rpm_bs: Number(c.monto_rpm_bs || 0),
          cantidad: 1,
        })
      })

      setComisiones(
        Array.from(grouped.values()).sort((a, b) =>
          a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
        )
      )
    } catch (err) {
      console.error('Error comisiones:', err)
    } finally {
      setLoadingComisiones(false)
    }
  }

  async function loadPersonal() {
    setLoading(true)
    setError('')
    try {
      const [empleadosRes, citasRes] = await Promise.all([
        supabase
          .from('empleados')
          .select(`id, nombre, cedula, telefono, email, rol, auth_user_id, estado, created_at, comision_plan_porcentaje, comision_cita_porcentaje`)
          .order('nombre', { ascending: true }),
        supabase.from('citas').select('*'),
      ])

      if (empleadosRes.error) throw new Error(empleadosRes.error.message)

      setEmpleados((empleadosRes.data || []) as Empleado[])
      setCitas((citasRes.data || []) as CitaRaw[])
    } catch (err: any) {
      console.error(err)
      setError(err?.message || 'No se pudo cargar el personal.')
      setEmpleados([])
      setCitas([])
    } finally {
      setLoading(false)
    }
  }

  async function cambiarEstadoEmpleado(empleadoId: string, nuevoEstado: string) {
    try {
      const { error } = await supabase
        .from('empleados')
        .update({ estado: nuevoEstado })
        .eq('id', empleadoId)
      if (error) throw new Error(error.message)
      setEmpleados((prev) =>
        prev.map((e) => (e.id === empleadoId ? { ...e, estado: nuevoEstado } : e))
      )
    } catch (err) {
      console.error(err)
      alert('No se pudo actualizar el estado del empleado.')
    }
  }

  function resetForm() {
    setForm(INITIAL_FORM)
    setErrorMsg('')
    setSuccessMsg('')
  }

  function cerrarPanelNuevo() {
    setShowNuevoPanel(false)
    resetForm()
  }

  function abrirCrearCuenta(empleado: Empleado) {
    setCuentaError('')
    setCuentaSuccess('')
    setCuentaForm({
      empleadoId: empleado.id,
      nombre: empleado.nombre || '',
      email: empleado.email || '',
      password: generarPasswordTemporal(),
      role: empleado.rol === 'terapeuta' ? 'terapeuta' : empleado.rol || 'terapeuta',
    })
    setShowCuentaPanel(true)
  }

  function cerrarPanelCuenta() {
    setShowCuentaPanel(false)
    setCuentaError('')
    setCuentaSuccess('')
    setCuentaForm(INITIAL_CUENTA_FORM)
  }

  async function crearCuentaEmpleado() {
    setCuentaError('')
    setCuentaSuccess('')

    if (!cuentaForm.empleadoId) return setCuentaError('No se pudo identificar el empleado.')
    if (!cuentaForm.email.trim()) return setCuentaError('El correo es obligatorio.')
    if (!cuentaForm.password.trim() || cuentaForm.password.trim().length < 6)
      return setCuentaError('La contraseña debe tener mínimo 6 caracteres.')

    setCuentaSaving(true)
    try {
      const res = await fetch('/api/admin/empleados/crear-cuenta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleadoId: cuentaForm.empleadoId,
          empleado_id: cuentaForm.empleadoId,
          email: cuentaForm.email.trim().toLowerCase(),
          password: cuentaForm.password.trim(),
          fullName: cuentaForm.nombre.trim(),
          nombre: cuentaForm.nombre.trim(),
          role: normalizarRol(cuentaForm.role),
        }),
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'No se pudo crear la cuenta.')

      setCuentaSuccess('Cuenta creada y vinculada correctamente.')
      await loadPersonal()
      setTimeout(() => cerrarPanelCuenta(), 900)
    } catch (error: any) {
      console.error(error)
      setCuentaError(error?.message || 'No se pudo crear la cuenta.')
    } finally {
      setCuentaSaving(false)
    }
  }

  async function guardarNuevoPersonal() {
    setErrorMsg('')
    setSuccessMsg('')
    if (!form.nombre.trim()) return setErrorMsg('El nombre es obligatorio.')
    setSaving(true)

    try {
      const nombre = form.nombre.trim()
      const cedula = limpiarCedula(form.cedula) || null
      const email = form.email.trim().toLowerCase() || null
      const telefono = form.telefono.trim() || null

      const { data: rolData, error: rolError } = await supabase
        .from('roles')
        .select('id, nombre')
        .eq('nombre', rolCatalogo)
        .single()

      if (rolError && rolError.code !== 'PGRST116') throw rolError

      let rolId = rolData?.id ?? null

      if (!rolId) {
        const { data: newRol, error: newRolError } = await supabase
          .from('roles')
          .insert({ nombre: rolCatalogo, descripcion: 'Auto creado' })
          .select('id, nombre')
          .single()
        if (newRolError || !newRol) throw new Error(newRolError?.message || 'No se pudo crear el rol.')
        rolId = newRol.id
      }

      if (!rolId) throw new Error('No se pudo resolver el rol del personal.')

      const { error } = await supabase.from('empleados').insert({
        nombre,
        cedula,
        email,
        telefono,
        rol: rolCatalogo,
        rol_id: rolId,
        estado: form.estado,
        especialidad: rolCatalogo === 'terapeuta' ? '' : null,
      })

      if (error) throw error

      setSuccessMsg('Personal creado correctamente.')
      await loadPersonal()
      setTimeout(() => cerrarPanelNuevo(), 600)
    } catch (error: any) {
      console.error(error)
      setErrorMsg(error?.message || 'No se pudo crear el personal.')
    } finally {
      setSaving(false)
    }
  }

  // ─── Stats & filtrado ─────────────────────────────────────────────────────

  const citasPorEmpleado = useMemo(() => {
    const map = new Map<string, CitaRaw[]>()
    for (const cita of citas) {
      const empleadoKey = getFirstExistingKey(cita, [
        'empleado_id', 'personal_id', 'staff_id', 'terapeuta_id',
        'trainer_id', 'empleadoId', 'personalId',
      ])
      const empleadoId = empleadoKey ? cita[empleadoKey] : null
      if (!empleadoId) continue
      const current = map.get(empleadoId) || []
      current.push(cita)
      map.set(empleadoId, current)
    }
    return map
  }, [citas])

  const rows = useMemo<PersonalRow[]>(() => {
    return empleados.map((empleado) => {
      const citasEmpleado = citasPorEmpleado.get(empleado.id) || []
      const citasHoy = citasEmpleado.filter((c) => c.fecha === hoy).length
      return {
        empleado,
        citasTotal: citasEmpleado.length,
        citasHoy,
        programadas: citasEmpleado.filter((c) => c.estado?.toLowerCase() === 'programada').length,
        confirmadas: citasEmpleado.filter((c) => c.estado?.toLowerCase() === 'confirmada').length,
        completadas: citasEmpleado.filter((c) => c.estado?.toLowerCase() === 'completada').length,
        canceladas: citasEmpleado.filter((c) => c.estado?.toLowerCase() === 'cancelada').length,
      }
    })
  }, [empleados, citasPorEmpleado, hoy])

  const stats = useMemo(() => ({
    total: empleados.length,
    activos: empleados.filter((e) => e.estado?.toLowerCase() === 'activo').length,
    terapeutas: empleados.filter((e) => normalizarRol(e.rol) === 'terapeuta').length,
    recepcion: empleados.filter((e) => normalizarRol(e.rol) === 'recepcionista').length,
    admins: empleados.filter((e) => normalizarRol(e.rol) === 'admin').length,
    citasHoy: citas.filter((c) => c.fecha === hoy).length,
  }), [empleados, citas, hoy])

  const personalFiltrado = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(({ empleado }) => {
      const rolNormalizado = normalizarRol(empleado.rol)
      const rolTexto = mostrarRol(empleado.rol).toLowerCase()
      const matchSearch =
        !q ||
        empleado.nombre.toLowerCase().includes(q) ||
        empleado.cedula?.toLowerCase().includes(q) ||
        empleado.email?.toLowerCase().includes(q) ||
        empleado.telefono?.toLowerCase().includes(q) ||
        rolNormalizado.includes(q) ||
        rolTexto.includes(q) ||
        empleado.estado?.toLowerCase().includes(q)
      const matchRol = rolFiltro === 'todos' || rolNormalizado === rolFiltro.toLowerCase()
      const matchEstado =
        estadoFiltro === 'todos' || empleado.estado?.toLowerCase() === estadoFiltro.toLowerCase()
      return matchSearch && matchRol && matchEstado
    }).sort((a, b) =>
      a.empleado.nombre.localeCompare(b.empleado.nombre, 'es', { sensitivity: 'base' })
    )
  }, [rows, search, rolFiltro, estadoFiltro])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-7">

        {/* ── Header ── */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-white/30">Personas</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Personal</h1>
            <p className="mt-1.5 text-sm text-white/45">
              Gestión de empleados, roles, estado y carga operativa.
            </p>
          </div>

          <div className="w-full max-w-xs">
            <button
              type="button"
              onClick={() => { resetForm(); setShowNuevoPanel(true) }}
              className="
                w-full rounded-2xl border border-white/10 bg-white/[0.03]
                p-5 text-left transition hover:bg-white/[0.06] hover:border-white/15
              "
            >
              <p className="font-semibold text-white">Nuevo personal</p>
              <p className="mt-1 text-xs text-white/40">Registrar un nuevo miembro del equipo.</p>
            </button>
          </div>
        </div>

        {/* ── Error ── */}
        {error ? (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3">
            <span className="mt-0.5 text-rose-400">⚠</span>
            <div>
              <p className="text-sm font-medium text-rose-300">Error al cargar</p>
              <p className="mt-0.5 text-xs text-white/45">{error}</p>
            </div>
          </div>
        ) : null}

        {/* ── Tabs de rol (clickeables) ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <RolTab label="Total" count={stats.total} active={rolFiltro === 'todos'} color="text-white" onClick={() => setRolFiltro('todos')} />
          <RolTab label="Activos" count={stats.activos} active={estadoFiltro === 'activo'} color="text-emerald-400" onClick={() => { setRolFiltro('todos'); setEstadoFiltro(estadoFiltro === 'activo' ? 'todos' : 'activo') }} />
          <RolTab label="Terapeutas" count={stats.terapeutas} active={rolFiltro === 'terapeuta'} color="text-violet-400" onClick={() => setRolFiltro(rolFiltro === 'terapeuta' ? 'todos' : 'terapeuta')} />
          <RolTab label="Recepción" count={stats.recepcion} active={rolFiltro === 'recepcionista'} color="text-amber-300" onClick={() => setRolFiltro(rolFiltro === 'recepcionista' ? 'todos' : 'recepcionista')} />
          <RolTab label="Admins" count={stats.admins} active={rolFiltro === 'admin'} color="text-sky-400" onClick={() => setRolFiltro(rolFiltro === 'admin' ? 'todos' : 'admin')} />
          <RolTab label="Citas hoy" count={stats.citasHoy} active={false} color="text-white/60" onClick={() => {}} />
        </div>

        {/* ── Comisiones pendientes ── */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] bg-white/[0.02] px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-white">Comisiones pendientes</span>
              {loadingComisiones && (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border border-white/10 border-t-white/40" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/35">Período</span>
              <input
                type="date"
                value={fechaComisionInicio}
                onChange={(e) => setFechaComisionInicio(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white outline-none focus:border-white/20"
              />
              <span className="text-xs text-white/25">→</span>
              <input
                type="date"
                value={fechaComisionFin}
                onChange={(e) => setFechaComisionFin(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white outline-none focus:border-white/20"
              />
            </div>
          </div>

          <div className="p-5">
            {loadingComisiones ? (
              <p className="text-xs text-white/35">Cargando comisiones...</p>
            ) : comisiones.length === 0 ? (
              <p className="text-xs text-white/25">No hay comisiones pendientes en este período.</p>
            ) : (
              <ComisionesPendientesBlock comisiones={comisiones} />
            )}
          </div>
        </div>

        {/* ── Filtros ── */}
        <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/35">Buscar</label>
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nombre, cédula, correo, teléfono, rol o estado..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-9 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/20 focus:bg-white/[0.07]"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 transition hover:text-white/60">✕</button>
              )}
            </div>
          </div>

          <div className="w-full md:w-40">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/35">Rol</label>
            <select value={rolFiltro} onChange={(e) => setRolFiltro(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/20 focus:bg-white/[0.07]">
              <option value="todos" className="bg-[#0e101a]">Todos</option>
              <option value="terapeuta" className="bg-[#0e101a]">Terapeuta</option>
              <option value="admin" className="bg-[#0e101a]">Admin</option>
              <option value="recepcionista" className="bg-[#0e101a]">Recepcionista</option>
            </select>
          </div>

          <div className="w-full md:w-40">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/35">Estado</label>
            <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/20 focus:bg-white/[0.07]">
              <option value="todos" className="bg-[#0e101a]">Todos</option>
              <option value="activo" className="bg-[#0e101a]">Activos</option>
              <option value="inactivo" className="bg-[#0e101a]">Inactivos</option>
              <option value="suspendido" className="bg-[#0e101a]">Suspendidos</option>
            </select>
          </div>
        </div>

        {/* ── Tabla ── */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
          <div className="flex items-center justify-between border-b border-white/[0.07] bg-white/[0.02] px-5 py-3.5">
            <div>
              <span className="text-sm font-semibold text-white">Listado de personal</span>
              {!loading && (
                <span className="ml-2 rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-xs text-white/50">
                  {personalFiltrado.length} {personalFiltrado.length === 1 ? 'persona' : 'personas'}
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.01] text-left">
                  {['Personal', 'Cédula', 'Contacto', 'Rol', 'Estado', 'Cuenta', 'Carga hoy', 'Registro', 'Acciones'].map((col) => (
                    <th key={col} className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-white/30">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.05] text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-14 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-white/50" />
                        <span className="text-xs text-white/35">Cargando personal...</span>
                      </div>
                    </td>
                  </tr>
                ) : personalFiltrado.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-14 text-center">
                      <p className="text-sm text-white/30">No hay personal que coincida con los filtros.</p>
                    </td>
                  </tr>
                ) : (
                  personalFiltrado.map(({ empleado, citasHoy }) => (
                    <tr key={empleado.id} className="group align-top transition-colors duration-100 hover:bg-white/[0.025]">

                      <td className="px-5 py-4">
                        <div className="font-medium text-white">{empleado.nombre}</div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-sm text-white/60">{empleado.cedula || <span className="text-white/25">Sin cédula</span>}</div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-sm text-white/60">{empleado.email || <span className="text-white/25">Sin correo</span>}</div>
                        <div className="mt-0.5 text-xs text-white/35">{empleado.telefono || 'Sin teléfono'}</div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-white">{mostrarRol(empleado.rol)}</div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-2">
                          <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-[11px] font-medium ${estadoBadge(empleado.estado)}`}>
                            {empleado.estado}
                          </span>
                          <select
                            value={empleado.estado}
                            onChange={(e) => void cambiarEstadoEmpleado(empleado.id, e.target.value)}
                            className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white outline-none transition focus:border-white/20"
                          >
                            <option value="activo" className="bg-[#0e101a]">Activo</option>
                            <option value="inactivo" className="bg-[#0e101a]">Inactivo</option>
                            <option value="suspendido" className="bg-[#0e101a]">Suspendido</option>
                          </select>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        {empleado.auth_user_id ? (
                          <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                            Cuenta creada
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
                            Interno
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${cargaBadge(citasHoy)}`}>
                          {cargaLabel(citasHoy)} · {citasHoy}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-xs text-white/50">{formatDate(empleado.created_at)}</div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <Link
                            href={`/admin/personas/personal/${empleado.id}`}
                            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/70 transition hover:bg-white/[0.07]"
                          >
                            Ver
                          </Link>
                          <Link
                            href={`/admin/personas/personal/${empleado.id}/editar`}
                            className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/70 transition hover:bg-white/[0.07]"
                          >
                            Editar
                          </Link>
                          {empleado.auth_user_id ? (
                            <span className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-medium text-emerald-300">
                              Con cuenta
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => abrirCrearCuenta(empleado)}
                              className="rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-[11px] font-medium text-sky-300 transition hover:bg-sky-400/20"
                            >
                              Crear cuenta
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Panel: Nuevo personal ── */}
      {showNuevoPanel && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={cerrarPanelNuevo} />
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl border-l border-white/10 bg-[#0b0f17] shadow-[-20px_0_60px_rgba(0,0,0,0.45)]">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-white/30">Personas</p>
                  <h2 className="mt-1.5 text-xl font-bold text-white">Nuevo personal</h2>
                  <p className="mt-1 text-sm text-white/45">Crea un terapeuta o miembro del equipo.</p>
                </div>
                <button type="button" onClick={cerrarPanelNuevo} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.07]">
                  Cerrar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="space-y-5">
                  {errorMsg && (
                    <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3">
                      <span className="text-rose-400">⚠</span>
                      <p className="text-sm text-rose-300">{errorMsg}</p>
                    </div>
                  )}
                  {successMsg && (
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3">
                      <span className="text-emerald-400">✓</span>
                      <p className="text-sm text-emerald-300">{successMsg}</p>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nombre">
                      <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Nombre completo" className={inputClassName} />
                    </Field>
                    <Field label="Cédula" helper="Opcional. Debe ser única si la colocas.">
                      <input type="text" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} placeholder="Ej: V-12345678" className={inputClassName} />
                    </Field>
                    <Field label="Email" helper="Opcional. No se enviará invitación.">
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="correo@ejemplo.com" className={inputClassName} />
                    </Field>
                    <Field label="Teléfono">
                      <input type="text" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="0424..." className={inputClassName} />
                    </Field>
                    <Field label="Rol" helper={`Rol real: ${rolCatalogo}`}>
                      <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as RolUI })} className={inputClassName}>
                        <option value="terapeuta" className="bg-[#0e101a]">Terapeuta</option>
                        <option value="recepcionista" className="bg-[#0e101a]">Recepcionista</option>
                        <option value="admin" className="bg-[#0e101a]">Admin</option>
                      </select>
                    </Field>
                    <Field label="Estado">
                      <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className={inputClassName}>
                        <option value="activo" className="bg-[#0e101a]">Activo</option>
                        <option value="inactivo" className="bg-[#0e101a]">Inactivo</option>
                        <option value="suspendido" className="bg-[#0e101a]">Suspendido</option>
                      </select>
                    </Field>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button type="button" onClick={guardarNuevoPersonal} disabled={saving} className="rounded-xl border border-white/15 bg-white/[0.08] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-50">
                      {saving ? 'Guardando...' : 'Guardar personal'}
                    </button>
                    <button type="button" onClick={cerrarPanelNuevo} className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/[0.06]">
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Panel: Crear cuenta ── */}
      {showCuentaPanel && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={cerrarPanelCuenta} />
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl border-l border-white/10 bg-[#0b0f17] shadow-[-20px_0_60px_rgba(0,0,0,0.45)]">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-white/30">Personal</p>
                  <h2 className="mt-1.5 text-xl font-bold text-white">Crear cuenta de acceso</h2>
                  <p className="mt-1 text-sm text-white/45">Convierte este empleado en usuario con login.</p>
                </div>
                <button type="button" onClick={cerrarPanelCuenta} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/70 transition hover:bg-white/[0.07]">
                  Cerrar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="space-y-5">
                  {cuentaError && (
                    <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3">
                      <span className="text-rose-400">⚠</span>
                      <p className="text-sm text-rose-300">{cuentaError}</p>
                    </div>
                  )}
                  {cuentaSuccess && (
                    <div className="flex items-start gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-4 py-3">
                      <span className="text-emerald-400">✓</span>
                      <p className="text-sm text-emerald-300">{cuentaSuccess}</p>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nombre">
                      <input type="text" value={cuentaForm.nombre} onChange={(e) => setCuentaForm({ ...cuentaForm, nombre: e.target.value })} placeholder="Nombre completo" className={inputClassName} />
                    </Field>
                    <Field label="Rol de acceso">
                      <select value={cuentaForm.role} onChange={(e) => setCuentaForm({ ...cuentaForm, role: e.target.value })} className={inputClassName}>
                        <option value="terapeuta" className="bg-[#0e101a]">Terapeuta</option>
                        <option value="recepcionista" className="bg-[#0e101a]">Recepcionista</option>
                        <option value="admin" className="bg-[#0e101a]">Admin</option>
                      </select>
                    </Field>
                    <Field label="Correo de acceso" helper="Este será el correo para iniciar sesión.">
                      <input type="email" value={cuentaForm.email} onChange={(e) => setCuentaForm({ ...cuentaForm, email: e.target.value })} placeholder="correo@ejemplo.com" className={inputClassName} />
                    </Field>
                    <Field label="Contraseña temporal" helper="Entrégala al empleado para que la cambie.">
                      <input type="text" value={cuentaForm.password} onChange={(e) => setCuentaForm({ ...cuentaForm, password: e.target.value })} placeholder="Contraseña temporal" className={inputClassName} />
                    </Field>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button type="button" onClick={crearCuentaEmpleado} disabled={cuentaSaving} className="rounded-xl border border-sky-400/20 bg-sky-400/10 px-5 py-2.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-400/15 disabled:opacity-50">
                      {cuentaSaving ? 'Creando cuenta...' : 'Crear cuenta'}
                    </button>
                    <button type="button" onClick={() => setCuentaForm({ ...cuentaForm, password: generarPasswordTemporal() })} className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/[0.06]">
                      Generar otra contraseña
                    </button>
                    <button type="button" onClick={cerrarPanelCuenta} className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/[0.06]">
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}