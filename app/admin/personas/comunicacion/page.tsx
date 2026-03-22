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
  created_at: string
}

type FormState = {
  titulo: string
  mensaje: string
  tipo: 'recordatorio' | 'promocion' | 'seguimiento' | 'aviso'
  cliente_id: string
  destino_manual: string
}

const INITIAL_FORM: FormState = {
  titulo: '',
  mensaje: '',
  tipo: 'recordatorio',
  cliente_id: '',
  destino_manual: '',
}

const TIPOS = ['recordatorio', 'promocion', 'seguimiento', 'aviso'] as const

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

function cleanPhone(value: string) {
  return value.replace(/[^\d]/g, '')
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

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      setErrorMsg('')

      const [cliRes, comRes] = await Promise.all([
        supabase
          .from('clientes')
          .select('id, nombre, telefono, email, estado')
          .eq('estado', 'activo')
          .order('nombre', { ascending: true }),

        supabase
          .from('comunicaciones')
          .select('*')
          .eq('canal', 'whatsapp')
          .order('created_at', { ascending: false }),
      ])

      if (cliRes.error) throw cliRes.error
      if (comRes.error) throw comRes.error

      setClientes((cliRes.data || []) as Cliente[])
      setComunicaciones((comRes.data || []) as Comunicacion[])
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo cargar la comunicación.')
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
    setErrorMsg('')
  }

  function validarDestino() {
    if (!destinoFinal) return 'Destino requerido.'
    if (cleanPhone(destinoFinal).length < 8) {
      return 'El número no es válido para WhatsApp.'
    }
    return ''
  }

  function validateForm() {
    if (!form.titulo.trim()) return 'Título requerido.'
    if (!form.mensaje.trim()) return 'Mensaje requerido.'
    return validarDestino()
  }

  async function guardarHistorial(estado: 'borrador' | 'enviado', destinoOverride?: string) {
    const { error } = await supabase.from('comunicaciones').insert({
      titulo: form.titulo.trim(),
      asunto: null,
      mensaje: form.mensaje.trim(),
      tipo: form.tipo,
      canal: 'whatsapp',
      estado,
      destino: destinoOverride || destinoFinal || null,
    })

    if (error) throw new Error(error.message)
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const err = validateForm()
    if (err) {
      setErrorMsg(err)
      return
    }

    try {
      setSaving(true)
      await guardarHistorial('borrador')
      setSuccessMsg('Mensaje guardado como borrador.')
      resetForm()
      await loadData()
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo guardar la comunicación.')
    } finally {
      setSaving(false)
    }
  }

  async function enviarActual() {
    const phone = cleanPhone(destinoFinal)

    if (!phone) {
      throw new Error('Número inválido para WhatsApp.')
    }

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(form.mensaje)}`,
      '_blank'
    )

    await guardarHistorial('enviado', destinoFinal)
  }

  async function handleEnviar() {
    setErrorMsg('')
    setSuccessMsg('')

    const err = validateForm()
    if (err) {
      setErrorMsg(err)
      return
    }

    try {
      setSending(true)
      await enviarActual()
      setSuccessMsg('Mensaje enviado correctamente por WhatsApp.')
      resetForm()
      await loadData()
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo enviar la comunicación.')
    } finally {
      setSending(false)
    }
  }

  async function reenviar(item: Comunicacion) {
    try {
      setReSendingId(item.id)
      setErrorMsg('')
      setSuccessMsg('')

      if (!item.destino) {
        throw new Error('Esta comunicación no tiene destino.')
      }

      const phone = cleanPhone(item.destino)

      if (!phone) {
        throw new Error('Número inválido para WhatsApp.')
      }

      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(item.mensaje)}`,
        '_blank'
      )

      setSuccessMsg('Mensaje reenviado por WhatsApp.')
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo reenviar la comunicación.')
    } finally {
      setReSendingId(null)
    }
  }

  return (
    <div className="space-y-6 px-4 py-6 lg:px-6">
      <div>
        <p className="text-sm text-white/55">Administración</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Comunicación</h1>
        <p className="mt-2 text-sm text-white/55">
          Gestión de mensajes solo por WhatsApp.
        </p>
      </div>

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total" value={stats.total} color="text-white" />
        <StatCard title="Enviadas" value={stats.enviadas} color="text-emerald-400" />
        <StatCard title="Borradores" value={stats.borradores} color="text-amber-300" />
        <StatCard title="Recordatorios" value={stats.recordatorios} color="text-sky-400" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <form onSubmit={handleGuardar} className="xl:col-span-1">
          <Section
            title="Nuevo mensaje"
            description="Solo se enviará por WhatsApp."
          >
            <div className="space-y-4">
              <Field label="Título">
                <input
                  placeholder="Ej: Recordatorio de cita"
                  value={form.titulo}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, titulo: e.target.value }))
                  }
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

              <Field label="Cliente">
                <select
                  value={form.cliente_id}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      cliente_id: e.target.value,
                      destino_manual: '',
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

              <Field
                label="Destino manual"
                helper="Si lo llenas, reemplaza el teléfono del cliente seleccionado."
              >
                <input
                  placeholder="+58 412 000 0000"
                  value={form.destino_manual}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, destino_manual: e.target.value }))
                  }
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
                  rows={7}
                  placeholder="Escribe el mensaje..."
                  value={form.mensaje}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, mensaje: e.target.value }))
                  }
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
                        {c.destino || '—'} <span className="mx-1">•</span>
                        {formatDateTime(c.created_at)}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => reenviar(c)}
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