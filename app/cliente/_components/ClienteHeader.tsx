'use client'

export default function ClienteHeader({
  title,
  subtitle,
  chip,
}: {
  title: string
  subtitle?: string
  chip?: string
}) {
  return (
    <section className="cliente-card cliente-card-pad" style={{ marginBottom: 14 }}>
      {chip ? <span className="cliente-chip">{chip}</span> : null}
      <h2 className="cliente-title" style={{ marginTop: chip ? 12 : 0 }}>{title}</h2>
      {subtitle ? <p className="cliente-subtitle">{subtitle}</p> : null}
    </section>
  )
}
