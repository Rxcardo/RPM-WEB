'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

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
  canal: 'whatsapp' | 'email' | 'sms' | 'interno'
  estado: 'borrador' | 'enviado' | 'cancelado'
  destino: string | null
  created_at: string
}

type FormState = {
  titulo: string
  asunto: string
  mensaje: string
  tipo: 'recordatorio' | 'promocion' | 'seguimiento' | 'aviso'
  canal: 'whatsapp' | 'email' | 'sms' | 'interno'
  cliente_id: string
  destino_manual: string
}

const INITIAL_FORM: FormState = {
  titulo: '',
  asunto: '',
  mensaje: '',
  tipo: 'recordatorio',
  canal: 'whatsapp',
  cliente_id: '',
  destino_manual: '',
}

const TIPOS = ['recordatorio', 'promocion', 'seguimiento', 'aviso'] as const
const CANALES = ['whatsapp', 'email', 'sms', 'interno'] as const

function cleanPhone(value: string) {
  return value.replace(/[^\d]/g, '')
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function canalBadge(canal: string) {
  switch (canal) {
    case 'whatsapp':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'email':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'sms':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'interno':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
  }
}

function estadoBadge(estado: string) {
  switch (estado) {
    case 'enviado':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'borrador':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'cancelado':
      return 'bg-red-50 text-red-700 border-red-200'
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200'
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

    if (form.canal === 'email') return clienteSeleccionado.email || ''
    if (form.canal === 'whatsapp' || form.canal === 'sms') {
      return clienteSeleccionado.telefono || ''
    }

    return ''
  }, [form.destino_manual, form.canal, clienteSeleccionado])

  const comunicacionesFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return comunicaciones

    return comunicaciones.filter((c) => {
      return (
        c.titulo?.toLowerCase().includes(q) ||
        c.asunto?.toLowerCase().includes(q) ||
        c.mensaje?.toLowerCase().includes(q) ||
        c.tipo?.toLowerCase().includes(q) ||
        c.canal?.toLowerCase().includes(q) ||
        c.estado?.toLowerCase().includes(q) ||
        c.destino?.toLowerCase().includes(q)
      )
    })
  }, [comunicaciones, search])

  function resetForm() {
    setForm(INITIAL_FORM)
    setErrorMsg('')
  }

  function validarDestino() {
    if (form.canal === 'interno') return ''

    if (!destinoFinal) return 'Destino requerido.'

    if (form.canal === 'email' && !isValidEmail(destinoFinal)) {
      return 'El correo no es válido.'
    }

    if ((form.canal === 'whatsapp' || form.canal === 'sms') && cleanPhone(destinoFinal).length < 8) {
      return 'El número no es válido.'
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
      asunto: form.asunto.trim() || null,
      mensaje: form.mensaje.trim(),
      tipo: form.tipo,
      canal: form.canal,
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
      setSuccessMsg('Comunicación guardada como borrador.')
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
    if (form.canal === 'interno') {
      await guardarHistorial('enviado')
      return
    }

    if (form.canal === 'email') {
      const res = await fetch('/api/comunicacion/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canal: 'email',
          to: destinoFinal,
          subject: form.asunto || form.titulo,
          title: form.titulo,
          message: form.mensaje,
          tipo: form.tipo,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo enviar el correo.')
      }

      await guardarHistorial('enviado')
      return
    }

    if (form.canal === 'whatsapp') {
      const phone = cleanPhone(destinoFinal)

      if (!phone) {
        throw new Error('Número inválido para WhatsApp.')
      }

      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(form.mensaje)}`,
        '_blank'
      )

      await guardarHistorial('enviado', destinoFinal)
      return
    }

    if (form.canal === 'sms') {
      const phone = cleanPhone(destinoFinal)

      if (!phone) {
        throw new Error('Número inválido para SMS.')
      }

      window.location.href = `sms:${phone}?body=${encodeURIComponent(form.mensaje)}`
      await guardarHistorial('enviado', destinoFinal)
    }
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
      setSuccessMsg('Comunicación enviada correctamente.')
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

      if (item.canal === 'interno') {
        setSuccessMsg('La comunicación interna no requiere reenvío externo.')
        return
      }

      if (!item.destino) {
        throw new Error('Esta comunicación no tiene destino.')
      }

      if (item.canal === 'email') {
        const res = await fetch('/api/comunicacion/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            canal: 'email',
            to: item.destino,
            subject: item.asunto || item.titulo,
            title: item.titulo,
            message: item.mensaje,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'No se pudo reenviar el correo.')
        }
      }

      if (item.canal === 'whatsapp') {
        const phone = cleanPhone(item.destino)
        window.open(
          `https://wa.me/${phone}?text=${encodeURIComponent(item.mensaje)}`,
          '_blank'
        )
      }

      if (item.canal === 'sms') {
        const phone = cleanPhone(item.destino)
        window.location.href = `sms:${phone}?body=${encodeURIComponent(item.mensaje)}`
      }

      setSuccessMsg('Comunicación reenviada.')
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo reenviar la comunicación.')
    } finally {
      setReSendingId(null)
    }
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-6">
        <p className="text-sm text-slate-500">Administración</p>
        <h1 className="text-2xl font-bold text-slate-900">Comunicación</h1>
        <p className="mt-1 text-sm text-slate-600">
          Envía mensajes por email, WhatsApp, SMS o comunicaciones internas.
        </p>
      </div>

      {errorMsg ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {successMsg ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMsg}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <form
          onSubmit={handleGuardar}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-1"
        >
          <h2 className="text-lg font-semibold text-slate-900">
            Nueva comunicación
          </h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Título
            </label>
            <input
              placeholder="Ej: Recordatorio de cita"
              value={form.titulo}
              onChange={(e) =>
                setForm((p) => ({ ...p, titulo: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Tipo
            </label>
            <select
              value={form.tipo}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  tipo: e.target.value as FormState['tipo'],
                }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Cliente
            </label>
            <select
              value={form.cliente_id}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  cliente_id: e.target.value,
                  destino_manual: '',
                }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
            >
              <option value="">Seleccionar cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          {clienteSeleccionado ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <p><span className="font-medium">Teléfono:</span> {clienteSeleccionado.telefono || '—'}</p>
              <p><span className="font-medium">Email:</span> {clienteSeleccionado.email || '—'}</p>
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Canal
            </label>
            <select
              value={form.canal}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  canal: e.target.value as FormState['canal'],
                }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
            >
              {CANALES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {form.canal === 'email' ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Asunto
              </label>
              <input
                placeholder="Asunto del correo"
                value={form.asunto}
                onChange={(e) =>
                  setForm((p) => ({ ...p, asunto: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
              />
            </div>
          ) : null}

          {form.canal !== 'interno' ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Destino manual
              </label>
              <input
                placeholder={
                  form.canal === 'email'
                    ? 'correo@ejemplo.com'
                    : '+1 555 555 5555'
                }
                value={form.destino_manual}
                onChange={(e) =>
                  setForm((p) => ({ ...p, destino_manual: e.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
              />
              <p className="mt-1 text-xs text-slate-500">
                Si lo llenas, reemplaza el teléfono o email del cliente seleccionado.
              </p>
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Destino final
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
              {form.canal === 'interno' ? 'Comunicación interna' : destinoFinal || 'Sin destino'}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Mensaje
            </label>
            <textarea
              rows={7}
              placeholder="Escribe el mensaje..."
              value={form.mensaje}
              onChange={(e) =>
                setForm((p) => ({ ...p, mensaje: e.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2.5"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              disabled={saving}
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar borrador'}
            </button>

            <button
              type="button"
              disabled={sending}
              onClick={handleEnviar}
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {sending ? 'Enviando...' : 'Enviar ahora'}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Limpiar
            </button>
          </div>
        </form>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <div className="border-b bg-slate-50 px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Historial</h2>

              <input
                type="text"
                placeholder="Buscar en historial..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm md:max-w-sm"
              />
            </div>
          </div>

          <div className="max-h-[760px] overflow-y-auto p-4">
            {loading ? (
              <p className="text-sm text-slate-500">Cargando historial...</p>
            ) : comunicacionesFiltradas.length === 0 ? (
              <p className="text-sm text-slate-500">No hay comunicaciones registradas.</p>
            ) : (
              <div className="space-y-3">
                {comunicacionesFiltradas.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${canalBadge(c.canal)}`}
                      >
                        {c.canal}
                      </span>

                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoBadge(c.estado)}`}
                      >
                        {c.estado}
                      </span>

                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {c.tipo}
                      </span>
                    </div>

                    <div className="mb-1 font-semibold text-slate-900">
                      {c.titulo}
                    </div>

                    {c.asunto ? (
                      <div className="mb-1 text-sm text-slate-600">
                        <span className="font-medium">Asunto:</span> {c.asunto}
                      </div>
                    ) : null}

                    <div className="whitespace-pre-wrap text-sm text-slate-700">
                      {c.mensaje}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                      <div>
                        <span className="font-medium">Destino:</span>{' '}
                        {c.destino || '—'} <span className="mx-1">•</span>
                        {c.created_at}
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => reenviar(c)}
                          disabled={reSendingId === c.id}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                        >
                          {reSendingId === c.id ? 'Reenviando...' : 'Reenviar'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}