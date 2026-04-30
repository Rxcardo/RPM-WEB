'use client'

import { useEffect, useMemo, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { MessageCircle, Send, UsersRound } from 'lucide-react'

type Cliente = { id: string; nombre: string; telefono: string | null }
function wa(phone?: string | null) {
  const clean = (phone || '').replace(/[^0-9]/g, '')
  return clean ? `https://wa.me/${clean}` : '#'
}

export default function EmpleadoChatPage() {
  const supabase = useMemo(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!), [])
  const [empleadoId, setEmpleadoId] = useState<string | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [tipo, setTipo] = useState('cita')
  const [mensaje, setMensaje] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) return
      const { data: emp } = await supabase.from('empleados').select('id').eq('auth_user_id', auth.user.id).maybeSingle()
      if (!emp) return
      setEmpleadoId(emp.id)
      const { data } = await supabase.from('clientes').select('id,nombre,telefono').eq('terapeuta_id', emp.id).order('nombre')
      setClientes((data || []) as Cliente[])
    }
    load()
  }, [supabase])

  async function enviarSolicitud() {
    setOk('')
    if (!empleadoId || !mensaje.trim()) return
    const res = await fetch('/api/empleado/solicitudes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cliente_id: clienteId || null, tipo, mensaje }),
    })
    if (res.ok) {
      setMensaje('')
      setClienteId('')
      setOk('Solicitud enviada a recepción.')
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="rpm-muted text-sm font-semibold">Recepción y clientes</p>
        <h1 className="mt-1 text-3xl font-black">Chat y WhatsApp</h1>
      </header>

      <section className="purple-card rounded-[2rem] p-5 text-white">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-6 w-6" />
          <div>
            <p className="text-sm text-white/60">Solicitudes internas</p>
            <h2 className="text-2xl font-black">Escribe a recepción</h2>
          </div>
        </div>
      </section>

      <section className="glass-card rounded-[1.8rem] p-4 space-y-3">
        <h2 className="text-lg font-black">Nueva solicitud</h2>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rpm-input w-full rounded-2xl px-4 py-3 outline-none">
          <option value="cita">Nueva cita</option>
          <option value="renovacion">Renovación</option>
          <option value="pago">Pago o deuda</option>
          <option value="general">General</option>
        </select>
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="rpm-input w-full rounded-2xl px-4 py-3 outline-none">
          <option value="">Sin cliente específico</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Ej: Este cliente quiere renovar el plan..." className="rpm-input min-h-[110px] w-full resize-none rounded-2xl px-4 py-3 outline-none" />
        <button onClick={enviarSolicitud} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--purple)] px-4 py-3 font-black text-white">
          <Send className="h-4 w-4" /> Enviar a recepción
        </button>
        {ok && <p className="text-sm font-bold text-emerald-400">{ok}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-black">WhatsApp clientes</h2>
        {clientes.length === 0 && <div className="glass-card rounded-3xl p-4 rpm-muted">No hay clientes asignados.</div>}
        {clientes.map((c) => (
          <article key={c.id} className="glass-card flex items-center justify-between gap-3 rounded-3xl p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10"><UsersRound className="h-5 w-5" /></div>
              <div>
                <p className="font-black">{c.nombre}</p>
                <p className="rpm-muted text-sm">{c.telefono || 'Sin teléfono'}</p>
              </div>
            </div>
            <a href={wa(c.telefono)} target="_blank" className="rounded-2xl bg-[var(--purple)] px-4 py-3 text-sm font-black text-white">WhatsApp</a>
          </article>
        ))}
      </section>
    </div>
  )
}
