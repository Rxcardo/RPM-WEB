'use client'

import type React from 'react'
import Link from 'next/link'
import { CalendarCheck, CreditCard, MessageCircle, RefreshCcw } from 'lucide-react'
import ClienteHeader from '../_components/ClienteHeader'
import {
  formatDate,
  formatHour,
  formatMoney,
  useClienteCitas,
  useClientePagos,
  useClientePortal,
  useClienteSolicitudes,
  useProximaCita,
} from '../_components/ClienteData'

export default function ClienteDashboardPage() {
  const { cliente, loading, error } = useClientePortal()
  const citas = useClienteCitas(cliente?.id)
  const pagos = useClientePagos(cliente?.id)
  const solicitudes = useClienteSolicitudes(cliente?.id)
  const proximaCita = useProximaCita(citas.citas)

  return (
    <>
      <ClienteHeader
        chip="Inicio"
        title={`Hola${cliente?.nombre ? `, ${cliente.nombre.split(' ')[0]}` : ''}`}
        subtitle="Resumen rápido de tus citas, solicitudes, pagos y accesos del portal."
      />

      {loading ? <StateCard text="Cargando tu portal..." /> : null}
      {error ? <StateCard text={error} danger /> : null}

      <section className="cliente-grid-cards cols-4" style={{ marginBottom: 12 }}>
        <MiniCard icon={<CalendarCheck size={20} />} label="Próxima cita" value={proximaCita ? formatDate(proximaCita.fecha) : 'Sin cita'} />
        <MiniCard icon={<MessageCircle size={20} />} label="Solicitudes" value={`${solicitudes.solicitudes.filter((s) => s.estado === 'pendiente').length} pendientes`} />
        <MiniCard icon={<CreditCard size={20} />} label="Pagos" value={`${pagos.pagos.length} registros`} />
        <MiniCard icon={<RefreshCcw size={20} />} label="Estado" value={cliente?.acceso_portal ? 'Activo' : 'Pendiente'} />
      </section>

      <section className="cliente-grid-cards" style={{ marginBottom: 12 }}>
        <div className="cliente-card cliente-card-pad">
          <h3 className="cliente-section-title">Próxima sesión</h3>
          <p className="cliente-section-subtitle">Tu cita más cercana registrada en RPM.</p>

          {proximaCita ? (
            <div className="cliente-list">
              <div className="cliente-list-item">
                <span className="cliente-chip">{proximaCita.estado ?? 'programada'}</span>
                <h4 style={{ margin: '12px 0 4px', fontSize: 18 }}>{formatDate(proximaCita.fecha)}</h4>
                <p className="cliente-section-subtitle">
                  {formatHour(proximaCita.hora_inicio)} - {formatHour(proximaCita.hora_fin)} · {proximaCita.servicios?.nombre ?? 'Sesión RPM'}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                  <Link className="cliente-btn" href="/cliente/agenda">Ver agenda</Link>
                  <Link className="cliente-btn cliente-btn-secondary" href={`/cliente/comunicacion?tipo=no_asistencia&cita=${proximaCita.id}`}>No podré asistir</Link>
                </div>
              </div>
            </div>
          ) : (
            <Empty text="No tienes citas próximas registradas." />
          )}
        </div>

        <div className="cliente-card cliente-card-pad">
          <h3 className="cliente-section-title">Acciones rápidas</h3>
          <p className="cliente-section-subtitle">Envía solicitudes a recepción sin llamar ni escribir por fuera.</p>

          <div className="cliente-grid-cards" style={{ marginTop: 14 }}>
            <Link className="cliente-btn" href="/cliente/comunicacion?tipo=solicitud_cita">Solicitar cita</Link>
            <Link className="cliente-btn cliente-btn-secondary" href="/cliente/comunicacion?tipo=renovacion_plan">Renovar plan</Link>
            <Link className="cliente-btn cliente-btn-secondary" href="/cliente/comunicacion?tipo=pregunta">Hacer pregunta</Link>
            <Link className="cliente-btn cliente-btn-secondary" href="/cliente/comunicacion?tipo=cambio_horario">Cambiar horario</Link>
          </div>
        </div>
      </section>

      <section className="cliente-grid-cards">
        <div className="cliente-card cliente-card-pad">
          <h3 className="cliente-section-title">Últimas solicitudes</h3>
          <div className="cliente-list">
            {solicitudes.solicitudes.slice(0, 4).map((solicitud) => (
              <div className="cliente-list-item" key={solicitud.id}>
                <span className="cliente-chip">{solicitud.estado}</span>
                <h4 style={{ margin: '10px 0 4px', fontSize: 14 }}>{labelSolicitud(solicitud.tipo)}</h4>
                <p className="cliente-section-subtitle">{solicitud.mensaje || 'Sin mensaje adicional.'}</p>
              </div>
            ))}
            {!solicitudes.loading && solicitudes.solicitudes.length === 0 ? <Empty text="Todavía no has enviado solicitudes." /> : null}
          </div>
        </div>

        <div className="cliente-card cliente-card-pad">
          <h3 className="cliente-section-title">Pagos recientes</h3>
          <div className="cliente-list">
            {pagos.pagos.slice(0, 4).map((pago) => (
              <div className="cliente-list-item" key={pago.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 14 }}>{pago.concepto || pago.categoria || 'Pago'}</h4>
                    <p className="cliente-section-subtitle">{pago.fecha ? formatDate(pago.fecha) : 'Sin fecha'}</p>
                  </div>
                  <strong>{formatMoney(pago.monto_equivalente_usd ?? pago.monto, pago.moneda_pago ?? '$')}</strong>
                </div>
              </div>
            ))}
            {!pagos.loading && pagos.pagos.length === 0 ? <Empty text="No hay pagos registrados todavía." /> : null}
          </div>
        </div>
      </section>
    </>
  )
}

function MiniCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="cliente-card cliente-card-pad">
      <div className="cliente-chip">{icon}{label}</div>
      <h3 style={{ margin: '14px 0 0', fontSize: 19, fontWeight: 900 }}>{value}</h3>
    </div>
  )
}

function StateCard({ text, danger = false }: { text: string; danger?: boolean }) {
  return <div className="cliente-card cliente-card-pad" style={{ marginBottom: 12, color: danger ? 'var(--red)' : 'var(--muted)' }}>{text}</div>
}

function Empty({ text }: { text: string }) {
  return <div className="cliente-list-item"><p className="cliente-section-subtitle" style={{ margin: 0 }}>{text}</p></div>
}

function labelSolicitud(tipo: string) {
  const labels: Record<string, string> = {
    no_asistencia: 'Aviso de no asistencia',
    solicitud_cita: 'Solicitud de cita',
    renovacion_plan: 'Renovación de plan',
    pregunta: 'Pregunta',
    cambio_horario: 'Cambio de horario',
    comunicado: 'Comunicado',
    otro: 'Otra solicitud',
  }
  return labels[tipo] ?? tipo
}
