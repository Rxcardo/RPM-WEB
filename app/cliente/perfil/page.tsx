'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import ClienteHeader from '../_components/ClienteHeader'
import { formatDate, formatMoney, useClientePagos, useClientePortal } from '../_components/ClienteData'
import { createBrowserClient } from '@supabase/ssr'

export default function ClientePerfilPage() {
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { cliente, loading, error } = useClientePortal()
  const pagos = useClientePagos(cliente?.id)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <>
      <ClienteHeader
        chip="Perfil"
        title="Mi cuenta"
        subtitle="Datos personales del cliente e historial de pagos asociados a RPM."
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button
          onClick={handleLogout}
          className="cliente-btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid rgba(255,255,255,.08)',
            background: 'rgba(255,255,255,.04)',
            color: '#fff',
            borderRadius: 12,
            padding: '10px 14px',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600
          }}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </div>

      {error ? (
        <div
          className="cliente-card cliente-card-pad"
          style={{ marginBottom: 12, color: 'var(--red)' }}
        >
          {error}
        </div>
      ) : null}

      <section className="cliente-grid-cards" style={{ marginBottom: 12 }}>
        <div className="cliente-card cliente-card-pad">
          <h2 className="cliente-section-title">Datos personales</h2>
          <p className="cliente-section-subtitle">
            Información vinculada a tu acceso al portal.
          </p>

          <div className="cliente-list">
            {loading ? <InfoRow label="Estado" value="Cargando..." /> : null}

            <InfoRow label="Nombre" value={cliente?.nombre || 'Sin nombre'} />
            <InfoRow label="Correo" value={cliente?.email || 'Sin correo'} />
            <InfoRow label="Teléfono" value={cliente?.telefono || 'Sin teléfono'} />
            <InfoRow label="Cédula" value={cliente?.cedula || 'Sin cédula'} />
            <InfoRow label="Estado" value={cliente?.estado || 'activo'} />
            <InfoRow
              label="Portal"
              value={cliente?.acceso_portal ? 'Activo' : 'Sin acceso'}
            />
          </div>
        </div>

        <div className="cliente-card cliente-card-pad">
          <h2 className="cliente-section-title">Resumen financiero</h2>
          <p className="cliente-section-subtitle">
            Vista rápida de pagos registrados.
          </p>

          <div className="cliente-grid-cards" style={{ marginTop: 14 }}>
            <div className="cliente-list-item">
              <span className="cliente-chip">Pagos</span>
              <h3 style={{ margin: '12px 0 0', fontSize: 24 }}>
                {pagos.pagos.length}
              </h3>
            </div>

            <div className="cliente-list-item">
              <span className="cliente-chip">Último pago</span>

              <h3 style={{ margin: '12px 0 0', fontSize: 18 }}>
                {pagos.pagos[0]?.fecha
                  ? formatDate(pagos.pagos[0].fecha)
                  : 'Sin pagos'}
              </h3>
            </div>
          </div>
        </div>
      </section>

      <section className="cliente-card cliente-card-pad">
        <h2 className="cliente-section-title">Historial de pagos</h2>

        <p className="cliente-section-subtitle">
          Pagos, abonos y movimientos relacionados al cliente.
        </p>

        <div className="cliente-list">
          {pagos.loading ? <Empty text="Cargando pagos..." /> : null}

          {pagos.pagos.map((pago) => (
            <article className="cliente-list-item" key={pago.id}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'flex-start',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <span className="cliente-chip">
                    {pago.estado || 'registrado'}
                  </span>

                  <h3 style={{ margin: '10px 0 4px', fontSize: 15 }}>
                    {pago.concepto || pago.categoria || 'Pago'}
                  </h3>

                  <p className="cliente-section-subtitle">
                    {pago.fecha
                      ? formatDate(pago.fecha)
                      : 'Sin fecha'}
                  </p>
                </div>

                <strong style={{ fontSize: 15 }}>
                  {formatMoney(
                    pago.monto_equivalente_usd ?? pago.monto,
                    pago.moneda_pago ?? '$'
                  )}
                </strong>
              </div>
            </article>
          ))}

          {!pagos.loading && pagos.pagos.length === 0 ? (
            <Empty text="No tienes pagos registrados todavía." />
          ) : null}
        </div>
      </section>
    </>
  )
}

function InfoRow({
  label,
  value
}: {
  label: string
  value: string
}) {
  return (
    <div
      className="cliente-list-item"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12
      }}
    >
      <span
        className="cliente-section-subtitle"
        style={{ margin: 0 }}
      >
        {label}
      </span>

      <strong
        style={{
          fontSize: 13,
          textAlign: 'right'
        }}
      >
        {value}
      </strong>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="cliente-list-item">
      <p
        className="cliente-section-subtitle"
        style={{ margin: 0 }}
      >
        {text}
      </p>
    </div>
  )
}