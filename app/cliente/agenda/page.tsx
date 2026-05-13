'use client'

import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import ClienteHeader from '../_components/ClienteHeader'
import { formatDate, formatHour, useClienteCitas, useClientePortal } from '../_components/ClienteData'

export default function ClienteAgendaPage() {
  const { cliente, loading: loadingCliente } = useClientePortal()
  const { citas, loading, error, reload } = useClienteCitas(cliente?.id)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function avisarNoAsistencia(citaId: string) {
    if (!cliente?.id) return
    setSendingId(citaId)
    setMessage(null)

    const { data: existente } = await supabase
      .from('solicitudes_cliente')
      .select('id')
      .eq('cliente_id', cliente.id)
      .eq('cita_id', citaId)
      .eq('tipo', 'no_asistencia')
      .in('estado', ['pendiente', 'en_revision'])
      .maybeSingle()

    if (existente?.id) {
      setMessage('Ya enviaste un aviso para esta cita. Recepción debe revisarlo.')
      setSendingId(null)
      return
    }

    const { error: insertError } = await supabase.from('solicitudes_cliente').insert({
      cliente_id: cliente.id,
      cita_id: citaId,
      tipo: 'no_asistencia',
      mensaje: 'El cliente avisa desde el portal que no podrá asistir a esta sesión.',
      estado: 'pendiente',
    })

    if (insertError) setMessage(insertError.message)
    else setMessage('Aviso enviado a recepción correctamente.')

    setSendingId(null)
    reload()
  }

  return (
    <>
      <ClienteHeader
        chip="Agenda"
        title="Mis citas"
        subtitle="Consulta tus sesiones y avisa a recepción si no podrás asistir. El cliente no cancela directo: recepción revisa la solicitud."
      />

      {message ? <div className="cliente-card cliente-card-pad" style={{ marginBottom: 12 }}>{message}</div> : null}
      {error ? <div className="cliente-card cliente-card-pad" style={{ marginBottom: 12, color: 'var(--red)' }}>{error}</div> : null}

      <section className="cliente-card cliente-card-pad">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h2 className="cliente-section-title">Sesiones registradas</h2>
            <p className="cliente-section-subtitle">Se muestran las próximas y recientes citas asociadas a tu usuario.</p>
          </div>
          <Link className="cliente-btn cliente-btn-secondary" href="/cliente/comunicacion?tipo=solicitud_cita">Solicitar cita</Link>
        </div>

        <div className="cliente-list">
          {(loading || loadingCliente) ? <Empty text="Cargando citas..." /> : null}

          {citas.map((cita) => (
            <article className="cliente-list-item" key={cita.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div>
                  <span className="cliente-chip">{cita.estado ?? 'programada'}</span>
                  <h3 style={{ margin: '12px 0 4px', fontSize: 18 }}>{formatDate(cita.fecha)}</h3>
                  <p className="cliente-section-subtitle">
                    {formatHour(cita.hora_inicio)} - {formatHour(cita.hora_fin)} · {cita.servicios?.nombre ?? 'Sesión RPM'}
                  </p>
                  <p className="cliente-section-subtitle">Profesional: {cita.empleados?.nombre ?? 'Por asignar'}</p>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="cliente-btn cliente-btn-secondary"
                    disabled={sendingId === cita.id || cita.estado === 'cancelada'}
                    onClick={() => avisarNoAsistencia(cita.id)}
                  >
                    {sendingId === cita.id ? 'Enviando...' : 'No asistiré'}
                  </button>
                </div>
              </div>
            </article>
          ))}

          {!loading && citas.length === 0 ? <Empty text="No hay citas registradas todavía." /> : null}
        </div>
      </section>
    </>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="cliente-list-item"><p className="cliente-section-subtitle" style={{ margin: 0 }}>{text}</p></div>
}
