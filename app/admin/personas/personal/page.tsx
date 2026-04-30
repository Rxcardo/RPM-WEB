'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'

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

const INITIAL_CUENTA_FORM: CuentaFormState = {
  empleadoId: '',
  nombre: '',
  email: '',
  password: '',
  role: 'terapeuta',
}

function generarPasswordTemporal() {
  const token = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `RPM-${token}-2026`
}

const INITIAL_FORM: FormState = {
  nombre: '',
  cedula: '',
  email: '',
  telefono: '',
  rol: 'terapeuta',
  estado: 'activo',
}

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
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
      <label className="mb-2 block text-sm font-medium text-white/75">{label}</label>
      {children}
      {helper ? <p className="mt-2 text-xs text-white/45">{helper}</p> : null}
    </div>
  )
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString()
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

  // Legacy: cualquier rol operativo anterior se muestra y guarda como terapeuta.
  return 'terapeuta'
}

function mostrarRol(rol: string | null | undefined) {
  const value = normalizarRol(rol)

  if (value === 'terapeuta') return 'Terapeuta'
  if (value === 'recepcionista') return 'Recepcionista'
  if (value === 'admin') return 'Admin'

  return 'Sin rol'
}
function estadoBadge(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'activo':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'inactivo':
      return 'border-white/10 bg-white/[0.05] text-white/70'
    case 'suspendido':
      return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function cargaBadge(citasHoy: number) {
  if (citasHoy <= 3) return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
  if (citasHoy <= 6) return 'border-amber-400/20 bg-amber-400/10 text-amber-300'
  return 'border-rose-400/20 bg-rose-400/10 text-rose-300'
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

function mapearRolCatalogo(rolUI: RolUI): 'admin' | 'recepcionista' | 'terapeuta' {
  return normalizarRol(rolUI)
}


export default function PersonalPage() {
  const [loading, setLoading] = useState(true)
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [citas, setCitas] = useState<CitaRaw[]>([])
  const [search, setSearch] = useState('')
  const [rolFiltro, setRolFiltro] = useState('todos')
  const [estadoFiltro, setEstadoFiltro] = useState('todos')
  const [error, setError] = useState('')

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

  useEffect(() => {
    void loadPersonal()
  }, [])

  async function loadPersonal() {
    setLoading(true)
    setError('')

    try {
      const [empleadosRes, citasRes] = await Promise.all([
        supabase
          .from('empleados')
          .select(`
            id,
            nombre,
            cedula,
            telefono,
            email,
            rol,
            auth_user_id,
            estado,
            created_at,
            comision_plan_porcentaje,
            comision_cita_porcentaje
          `)
          .order('created_at', { ascending: false }),

        supabase
          .from('citas')
          .select('*'),
      ])

      if (empleadosRes.error) {
        throw new Error(empleadosRes.error.message)
      }

      if (citasRes.error) {
        console.error('Error cargando citas del personal:', citasRes.error.message)
      }

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

      if (error) {
        throw new Error(error.message)
      }

      setEmpleados((prev) =>
        prev.map((empleado) =>
          empleado.id === empleadoId ? { ...empleado, estado: nuevoEstado } : empleado
        )
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

    if (!cuentaForm.empleadoId) {
      setCuentaError('No se pudo identificar el empleado.')
      return
    }

    if (!cuentaForm.email.trim()) {
      setCuentaError('El correo es obligatorio para crear la cuenta.')
      return
    }

    if (!cuentaForm.password.trim() || cuentaForm.password.trim().length < 6) {
      setCuentaError('La contraseña temporal debe tener mínimo 6 caracteres.')
      return
    }

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

      if (!res.ok) {
        throw new Error(json?.error || 'No se pudo crear la cuenta.')
      }

      setCuentaSuccess('Cuenta creada y vinculada correctamente.')
      await loadPersonal()

      setTimeout(() => {
        cerrarPanelCuenta()
      }, 900)
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

    if (!form.nombre.trim()) {
      setErrorMsg('El nombre es obligatorio.')
      return
    }

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

      if (rolError && rolError.code !== 'PGRST116') {
        throw rolError
      }

      let rolId = rolData?.id ?? null

      if (!rolId) {
        const { data: newRol, error: newRolError } = await supabase
          .from('roles')
          .insert({
            nombre: rolCatalogo,
            descripcion: 'Auto creado',
          })
          .select('id, nombre')
          .single()

        if (newRolError || !newRol) {
          throw new Error(newRolError?.message || 'No se pudo crear el rol.')
        }

        rolId = newRol.id
      }

      if (!rolId) {
        throw new Error('No se pudo resolver el rol del personal.')
      }

      const payload = {
        nombre,
        cedula,
        email,
        telefono,
        rol: rolCatalogo,
        rol_id: rolId,
        estado: form.estado,
        especialidad: rolCatalogo === 'terapeuta' ? '' : null,
      }

      const { error } = await supabase.from('empleados').insert(payload)

      if (error) throw error

      setSuccessMsg('Personal creado correctamente.')
      await loadPersonal()

      setTimeout(() => {
        cerrarPanelNuevo()
      }, 600)
    } catch (error: any) {
      console.error(error)
      setErrorMsg(error?.message || 'No se pudo crear el personal.')
    } finally {
      setSaving(false)
    }
  }

  const hoy = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }, [])

  const citasPorEmpleado = useMemo(() => {
    const map = new Map<string, CitaRaw[]>()

    for (const cita of citas) {
      const empleadoKey = getFirstExistingKey(cita, [
        'empleado_id',
        'personal_id',
        'staff_id',
        'terapeuta_id',
        'trainer_id',
        'empleadoId',
        'personalId',
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

      const citasHoy = citasEmpleado.filter((cita) => cita.fecha === hoy).length
      const programadas = citasEmpleado.filter(
        (cita) => cita.estado?.toLowerCase() === 'programada'
      ).length
      const confirmadas = citasEmpleado.filter(
        (cita) => cita.estado?.toLowerCase() === 'confirmada'
      ).length
      const completadas = citasEmpleado.filter(
        (cita) => cita.estado?.toLowerCase() === 'completada'
      ).length
      const canceladas = citasEmpleado.filter(
        (cita) => cita.estado?.toLowerCase() === 'cancelada'
      ).length

      return {
        empleado,
        citasTotal: citasEmpleado.length,
        citasHoy,
        programadas,
        confirmadas,
        completadas,
        canceladas,
      }
    })
  }, [empleados, citasPorEmpleado, hoy])

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
        empleado.rol?.toLowerCase().includes(q) ||
        rolNormalizado.includes(q) ||
        rolTexto.includes(q) ||
        empleado.estado?.toLowerCase().includes(q)

      const matchRol = rolFiltro === 'todos' || rolNormalizado === rolFiltro.toLowerCase()

      const matchEstado =
        estadoFiltro === 'todos' || empleado.estado?.toLowerCase() === estadoFiltro.toLowerCase()

      return matchSearch && matchRol && matchEstado
    })
  }, [rows, search, rolFiltro, estadoFiltro])

  const stats = useMemo(() => {
    const total = empleados.length
    const activos = empleados.filter((e) => e.estado?.toLowerCase() === 'activo').length
    const terapeutas = empleados.filter((e) => normalizarRol(e.rol) === 'terapeuta').length
    const recepcion = empleados.filter((e) => normalizarRol(e.rol) === 'recepcionista').length
    const admins = empleados.filter((e) => normalizarRol(e.rol) === 'admin').length
    const citasHoy = citas.filter((c) => c.fecha === hoy).length

    return {
      total,
      activos,
      terapeutas,
      recepcion,
      admins,
      citasHoy,
    }
  }, [empleados, citas, hoy])

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-sm text-white/55">Personas</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
              Personal
            </h1>
            <p className="mt-2 text-sm text-white/55">
              Gestión de empleados, roles, estado y carga operativa.
            </p>
          </div>

          <div className="flex w-full max-w-sm justify-end">
            <button
              type="button"
              onClick={() => {
                resetForm()
                setShowNuevoPanel(true)
              }}
              className="
                w-full rounded-3xl border border-white/10 bg-white/[0.04]
                p-5 text-left shadow-[0_8px_30px_rgba(0,0,0,0.35)]
                backdrop-blur-xl transition hover:bg-white/[0.06] hover:border-white/15
              "
            >
              <p className="font-medium text-white">Nuevo personal</p>
              <p className="mt-1 text-sm text-white/55">
                Registrar un nuevo miembro del equipo.
              </p>
            </button>
          </div>
        </div>

        {error ? (
          <Card className="p-4">
            <p className="text-sm font-medium text-rose-400">Error</p>
            <p className="mt-1 text-sm text-white/55">{error}</p>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Total personal" value={stats.total} color="text-white" />
          <StatCard title="Activos" value={stats.activos} color="text-emerald-400" />
          <StatCard title="Terapeutas" value={stats.terapeutas} color="text-violet-400" />
          <StatCard title="Recepción" value={stats.recepcion} color="text-amber-300" />
          <StatCard title="Citas hoy" value={stats.citasHoy} color="text-sky-400" />
        </div>

        <Section
          title="Filtros"
          description="Busca por nombre, cédula, correo, teléfono, rol o estado."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Field label="Buscar">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nombre, cédula, correo, teléfono, rol o estado..."
                  className={inputClassName}
                />
              </Field>
            </div>

            <div>
              <Field label="Rol">
                <select
                  value={rolFiltro}
                  onChange={(e) => setRolFiltro(e.target.value)}
                  className={inputClassName}
                >
                  <option value="todos" className="bg-[#11131a] text-white">
                    Todos
                  </option>
                  <option value="terapeuta" className="bg-[#11131a] text-white">
                    Terapeuta
                  </option>
                  <option value="admin" className="bg-[#11131a] text-white">
                    Admin
                  </option>
                  <option value="recepcionista" className="bg-[#11131a] text-white">
                    Recepcionista
                  </option>
                </select>
              </Field>
            </div>

            <div>
              <Field label="Estado">
                <select
                  value={estadoFiltro}
                  onChange={(e) => setEstadoFiltro(e.target.value)}
                  className={inputClassName}
                >
                  <option value="todos" className="bg-[#11131a] text-white">
                    Todos
                  </option>
                  <option value="activo" className="bg-[#11131a] text-white">
                    Activos
                  </option>
                  <option value="inactivo" className="bg-[#11131a] text-white">
                    Inactivos
                  </option>
                  <option value="suspendido" className="bg-[#11131a] text-white">
                    Suspendidos
                  </option>
                </select>
              </Field>
            </div>
          </div>
        </Section>

        <Section
          title="Listado de personal"
          description="Vista general del equipo, estado, carga y citas."
          className="p-0"
          contentClassName="overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03]">
                <tr className="text-left text-white/55">
                  <th className="px-4 py-3 font-medium">Personal</th>
                  <th className="px-4 py-3 font-medium">Cédula</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Cuenta</th>
                  <th className="px-4 py-3 font-medium">Carga hoy</th>
                  
                  <th className="px-4 py-3 font-medium">Registro</th>
                  <th className="px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-white/55">
                      Cargando personal...
                    </td>
                  </tr>
                ) : personalFiltrado.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-white/55">
                      No hay personal registrado.
                    </td>
                  </tr>
                ) : (
                  personalFiltrado.map(
                    ({
                      empleado,
                      citasTotal,
                      citasHoy,
                      programadas,
                      confirmadas,
                      completadas,
                      canceladas,
                    }) => (
                      <tr key={empleado.id} className="align-top transition hover:bg-white/[0.03]">
                        <td className="px-4 py-4">
                          <div className="font-medium text-white">{empleado.nombre}</div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="text-white/75">{empleado.cedula || 'Sin cédula'}</div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="text-white/75">{empleado.email || 'Sin correo'}</div>
                          <div className="mt-1 text-xs text-white/45">
                            {empleado.telefono || 'Sin teléfono'}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="font-medium text-white">
                            {mostrarRol(empleado.rol)}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-col gap-2">
                            <span
                              className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${estadoBadge(
                                empleado.estado
                              )}`}
                            >
                              {empleado.estado}
                            </span>

                            <select
                              value={empleado.estado}
                              onChange={(e) => void cambiarEstadoEmpleado(empleado.id, e.target.value)}
                              className="
                                rounded-xl border border-white/10 bg-white/[0.03]
                                px-3 py-2 text-xs text-white outline-none transition
                                focus:border-white/20 focus:bg-white/[0.05]
                              "
                            >
                              <option value="activo" className="bg-[#11131a] text-white">
                                Activo
                              </option>
                              <option value="inactivo" className="bg-[#11131a] text-white">
                                Inactivo
                              </option>
                              <option value="suspendido" className="bg-[#11131a] text-white">
                                Suspendido
                              </option>
                            </select>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          {empleado.auth_user_id ? (
                            <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                              Cuenta creada
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                              Interno
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${cargaBadge(
                              citasHoy
                            )}`}
                          >
                            {cargaLabel(citasHoy)} · {citasHoy}
                          </span>
                        </td>

                        

                        <td className="px-4 py-4">
                          <div className="text-white/75">{formatDate(empleado.created_at)}</div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/admin/personas/personal/${empleado.id}`}
                              className="
                                rounded-xl border border-white/10 bg-white/[0.03]
                                px-3 py-1.5 text-xs font-medium text-white/80
                                transition hover:bg-white/[0.06]
                              "
                            >
                              Ver
                            </Link>

                            <Link
                              href={`/admin/personas/personal/${empleado.id}/editar`}
                              className="
                                rounded-xl border border-white/10 bg-white/[0.03]
                                px-3 py-1.5 text-xs font-medium text-white/80
                                transition hover:bg-white/[0.06]
                              "
                            >
                              Editar
                            </Link>

                            {empleado.auth_user_id ? (
                              <span className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                                Con cuenta
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => abrirCrearCuenta(empleado)}
                                className="
                                  rounded-xl border border-sky-400/20 bg-sky-400/10
                                  px-3 py-1.5 text-xs font-medium text-sky-300
                                  transition hover:bg-sky-400/15
                                "
                              >
                                Crear cuenta
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      {showNuevoPanel ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={cerrarPanelNuevo}
          />

          <div
            className="
              absolute right-0 top-0 h-full w-full max-w-2xl
              border-l border-white/10 bg-[#0b0f17]
              shadow-[-20px_0_60px_rgba(0,0,0,0.45)]
            "
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
                <div>
                  <p className="text-sm text-white/45">Personas</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">Nuevo personal</h2>
                  <p className="mt-1 text-sm text-white/55">
                    Crea un terapeuta o miembro del equipo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={cerrarPanelNuevo}
                  className="
                    rounded-2xl border border-white/10 bg-white/[0.04]
                    px-4 py-2 text-sm font-medium text-white/80 transition
                    hover:bg-white/[0.07]
                  "
                >
                  Cerrar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="space-y-6">
                  {errorMsg ? (
                    <Card className="p-4">
                      <p className="text-sm font-medium text-rose-400">Error</p>
                      <p className="mt-1 text-sm text-white/55">{errorMsg}</p>
                    </Card>
                  ) : null}

                  {successMsg ? (
                    <Card className="p-4">
                      <p className="text-sm font-medium text-emerald-400">Listo</p>
                      <p className="mt-1 text-sm text-white/55">{successMsg}</p>
                    </Card>
                  ) : null}

                  <Section
                    title="Formulario de personal"
                    description="Completa nombre, cédula, contacto, rol y estado."
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Nombre">
                        <input
                          type="text"
                          value={form.nombre}
                          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                          placeholder="Nombre completo"
                          className={inputClassName}
                        />
                      </Field>

                      <Field label="Cédula" helper="Opcional. Debe ser única si la colocas.">
                        <input
                          type="text"
                          value={form.cedula}
                          onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                          placeholder="Ej: V-12345678"
                          className={inputClassName}
                        />
                      </Field>

                      <Field label="Email" helper="Opcional. No se enviará invitación.">
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          placeholder="correo@ejemplo.com"
                          className={inputClassName}
                        />
                      </Field>

                      <Field label="Teléfono">
                        <input
                          type="text"
                          value={form.telefono}
                          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                          placeholder="0424..."
                          className={inputClassName}
                        />
                      </Field>

                      <Field
                        label="Rol"
                        helper={`Rol de permisos real: ${rolCatalogo}`}
                      >
                        <select
                          value={form.rol}
                          onChange={(e) => setForm({ ...form, rol: e.target.value as RolUI })}
                          className={inputClassName}
                        >
                          <option value="terapeuta" className="bg-[#11131a] text-white">
                            Terapeuta
                          </option>
                          <option value="recepcionista" className="bg-[#11131a] text-white">
                            Recepcionista
                          </option>
                          <option value="admin" className="bg-[#11131a] text-white">
                            Admin
                          </option>
                        </select>
                      </Field>

                      <Field label="Estado">
                        <select
                          value={form.estado}
                          onChange={(e) => setForm({ ...form, estado: e.target.value })}
                          className={inputClassName}
                        >
                          <option value="activo" className="bg-[#11131a] text-white">
                            Activo
                          </option>
                          <option value="inactivo" className="bg-[#11131a] text-white">
                            Inactivo
                          </option>
                          <option value="suspendido" className="bg-[#11131a] text-white">
                            Suspendido
                          </option>
                        </select>
                      </Field>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={guardarNuevoPersonal}
                        disabled={saving}
                        className="
                          rounded-2xl border border-white/10 bg-white/[0.08]
                          px-5 py-3 text-sm font-semibold text-white transition
                          hover:bg-white/[0.12] disabled:opacity-60
                        "
                      >
                        {saving ? 'Guardando...' : 'Guardar personal'}
                      </button>

                      <button
                        type="button"
                        onClick={cerrarPanelNuevo}
                        className="
                          rounded-2xl border border-white/10 bg-white/[0.03]
                          px-5 py-3 text-sm font-semibold text-white/80 transition
                          hover:bg-white/[0.06]
                        "
                      >
                        Cancelar
                      </button>
                    </div>
                  </Section>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showCuentaPanel ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={cerrarPanelCuenta} />
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl border-l border-white/10 bg-[#0b0f17] shadow-[-20px_0_60px_rgba(0,0,0,0.45)]">
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
                <div>
                  <p className="text-sm text-white/45">Personal</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">Crear cuenta de acceso</h2>
                  <p className="mt-1 text-sm text-white/55">Convierte este empleado interno en usuario con login.</p>
                </div>
                <button type="button" onClick={cerrarPanelCuenta} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/80 transition hover:bg-white/[0.07]">Cerrar</button>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="space-y-6">
                  {cuentaError ? <Card className="p-4"><p className="text-sm font-medium text-rose-400">Error</p><p className="mt-1 text-sm text-white/55">{cuentaError}</p></Card> : null}
                  {cuentaSuccess ? <Card className="p-4"><p className="text-sm font-medium text-emerald-400">Listo</p><p className="mt-1 text-sm text-white/55">{cuentaSuccess}</p></Card> : null}
                  <Section title="Datos de acceso" description="Se creará un usuario en Auth, un profile y se vinculará con empleados.auth_user_id.">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Nombre"><input type="text" value={cuentaForm.nombre} onChange={(e) => setCuentaForm({ ...cuentaForm, nombre: e.target.value })} placeholder="Nombre completo" className={inputClassName} /></Field>
                      <Field label="Rol de acceso"><select value={cuentaForm.role} onChange={(e) => setCuentaForm({ ...cuentaForm, role: e.target.value })} className={inputClassName}><option value="terapeuta" className="bg-[#11131a] text-white">Terapeuta</option><option value="recepcionista" className="bg-[#11131a] text-white">Recepcionista</option><option value="admin" className="bg-[#11131a] text-white">Admin</option></select></Field>
                      <Field label="Correo de acceso" helper="Este será el correo para iniciar sesión."><input type="email" value={cuentaForm.email} onChange={(e) => setCuentaForm({ ...cuentaForm, email: e.target.value })} placeholder="correo@ejemplo.com" className={inputClassName} /></Field>
                      <Field label="Contraseña temporal" helper="Entrégala al empleado y luego podrá cambiarla."><input type="text" value={cuentaForm.password} onChange={(e) => setCuentaForm({ ...cuentaForm, password: e.target.value })} placeholder="Contraseña temporal" className={inputClassName} /></Field>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button type="button" onClick={crearCuentaEmpleado} disabled={cuentaSaving} className="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-5 py-3 text-sm font-semibold text-sky-200 transition hover:bg-sky-400/15 disabled:opacity-60">{cuentaSaving ? 'Creando cuenta...' : 'Crear cuenta'}</button>
                      <button type="button" onClick={() => setCuentaForm({ ...cuentaForm, password: generarPasswordTemporal() })} className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]">Generar otra contraseña</button>
                      <button type="button" onClick={cerrarPanelCuenta} className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]">Cancelar</button>
                    </div>
                  </Section>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </>
  )
}