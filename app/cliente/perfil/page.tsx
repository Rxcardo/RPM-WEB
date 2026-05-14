'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit3, LogOut, RefreshCcw, Save, X } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import ClienteHeader from '../_components/ClienteHeader'
import { formatDate, formatMoney, useClientePortal } from '../_components/ClienteData'

/* ── TYPES ─────────────────────────────────────────────────────────────── */

type ClienteForm = {
  nombre: string
  telefono: string
  email: string
  cedula: string
  fecha_nacimiento: string
  genero: string
  direccion: string
}

type CuentaPorCobrar = {
  id: string
  cliente_id: string | null
  cliente_nombre: string | null
  concepto: string | null
  tipo_origen: string | null
  monto_total_usd: number | null
  monto_pagado_usd: number | null
  saldo_usd: number | null
  fecha_venta: string | null
  fecha_vencimiento: string | null
  estado: string | null
  notas: string | null
  moneda: string | null
  tasa_bcv: number | null
  monto_total_bs: number | null
  monto_pagado_bs: number | null
  saldo_bs: number | null
  es_ajuste: boolean | null
  operacion_origen: string | null
  observacion_ajuste: string | null
  created_at: string | null
  updated_at: string | null
}

type PagoCliente = {
  id: string
  cliente_id: string | null
  cliente_nombre?: string | null
  concepto?: string | null
  categoria?: string | null
  tipo_origen?: string | null
  cuenta_cobrar_id?: string | null
  cliente_plan_id?: string | null
  cita_id?: string | null
  estado?: string | null
  fecha?: string | null
  created_at?: string | null
  moneda_pago?: string | null
  moneda?: string | null
  metodo_pago?: string | null
  monto?: number | null
  monto_equivalente_usd?: number | null
  monto_usd?: number | null
  monto_bs?: number | null
  monto_total_usd?: number | null
  monto_pagado_usd?: number | null
  saldo_usd?: number | null
  monto_total_bs?: number | null
  monto_pagado_bs?: number | null
  saldo_bs?: number | null
  tasa_bcv?: number | null
}

/* ── HELPERS ───────────────────────────────────────────────────────────── */

function toNumber(value: unknown) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function safeText(value: unknown, fallback = '—') {
  const text = String(value ?? '').trim()
  return text || fallback
}

function moneyUsd(value: unknown) {
  return formatMoney(toNumber(value), '$')
}

function moneyBs(value: unknown) {
  return `Bs ${toNumber(value).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function cuentaAbierta(cuenta: CuentaPorCobrar) {
  const estado = String(cuenta.estado ?? '').toLowerCase()
  const saldoUsd = toNumber(cuenta.saldo_usd)
  const saldoBs = toNumber(cuenta.saldo_bs)
  return (
    !['cobrada', 'anulado', 'anulada', 'cancelado', 'cancelada'].includes(estado) &&
    (saldoUsd > 0 || saldoBs > 0 || estado === 'pendiente' || estado === 'parcial' || estado === 'vencida')
  )
}

function pagoFecha(pago: PagoCliente) {
  return pago.fecha ?? pago.created_at ?? null
}

function pagoMontoPrincipal(pago: PagoCliente) {
  return (
    pago.monto_equivalente_usd ??
    pago.monto_usd ??
    pago.monto ??
    pago.monto_pagado_usd ??
    pago.monto_total_usd ??
    0
  )
}

function estadoCuentaChip(estado: string) {
  const v = estado.toLowerCase()
  if (v === 'vencida')  return 'cliente-chip cliente-chip-red'
  if (v === 'parcial')  return 'cliente-chip cliente-chip-yellow'
  if (v === 'pendiente') return 'cliente-chip cliente-chip-yellow'
  return 'cliente-chip'
}

/* ── PAGE ──────────────────────────────────────────────────────────────── */

export default function ClientePerfilPage() {
  const router = useRouter()

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  const { cliente, loading, error } = useClientePortal()

  const [form, setForm] = useState<ClienteForm>({
    nombre: '', telefono: '', email: '',
    cedula: '', fecha_nacimiento: '', genero: '', direccion: '',
  })

  const [editing, setEditing]         = useState(false)
  const [savingPerfil, setSavingPerfil] = useState(false)
  const [toast, setToast]             = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)

  const [cuentas, setCuentas]         = useState<CuentaPorCobrar[]>([])
  const [pagos, setPagos]             = useState<PagoCliente[]>([])
  const [loadingFinanzas, setLoadingFinanzas] = useState(false)
  const [finanzasError, setFinanzasError]     = useState<string | null>(null)

  const clienteId = cliente?.id ?? null

  useEffect(() => {
    if (!cliente) return
    setForm({
      nombre: cliente.nombre ?? '',
      telefono: cliente.telefono ?? '',
      email: cliente.email ?? '',
      cedula: cliente.cedula ?? '',
      fecha_nacimiento: cliente.fecha_nacimiento ?? '',
      genero: cliente.genero ?? '',
      direccion: cliente.direccion ?? '',
    })
  }, [cliente])

  useEffect(() => {
    if (!clienteId) return
    void cargarFinanzas(clienteId)
  }, [clienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  const cuentasAbiertas = useMemo(() => cuentas.filter(cuentaAbierta), [cuentas])

  const totalDeudaUsd = useMemo(
    () => cuentasAbiertas.reduce((acc, c) => acc + toNumber(c.saldo_usd), 0),
    [cuentasAbiertas]
  )
  const totalDeudaBs = useMemo(
    () => cuentasAbiertas.reduce((acc, c) => acc + toNumber(c.saldo_bs), 0),
    [cuentasAbiertas]
  )
  const totalPagadoUsd = useMemo(
    () => pagos.reduce((acc, p) => acc + toNumber(p.monto_equivalente_usd ?? p.monto_usd ?? p.monto_pagado_usd), 0),
    [pagos]
  )

  const ultimoPago = pagos[0] ?? null

  async function cargarFinanzas(id: string) {
    setLoadingFinanzas(true); setFinanzasError(null)
    const [cuentasRes, pagosRes] = await Promise.all([
      supabase
        .from('cuentas_por_cobrar')
        .select(`id,cliente_id,cliente_nombre,concepto,tipo_origen,monto_total_usd,monto_pagado_usd,saldo_usd,fecha_venta,fecha_vencimiento,estado,notas,moneda,tasa_bcv,monto_total_bs,monto_pagado_bs,saldo_bs,es_ajuste,operacion_origen,observacion_ajuste,created_at,updated_at`)
        .eq('cliente_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('pagos')
        .select('*')
        .eq('cliente_id', id)
        .order('created_at', { ascending: false }),
    ])
    if (cuentasRes.error) { setFinanzasError(cuentasRes.error.message); setCuentas([]) }
    else setCuentas((cuentasRes.data ?? []) as CuentaPorCobrar[])
    if (pagosRes.error) { setFinanzasError((prev) => prev ?? pagosRes.error.message); setPagos([]) }
    else setPagos((pagosRes.data ?? []) as PagoCliente[])
    setLoadingFinanzas(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login'); router.refresh()
  }

  async function guardarPerfil() {
    if (!clienteId) return
    const nombre = form.nombre.trim()
    if (!nombre) { setToast({ msg: 'El nombre no puede quedar vacío.', kind: 'err' }); return }
    setSavingPerfil(true); setToast(null)
    const { error: updateError } = await supabase
      .from('clientes')
      .update({
        nombre,
        telefono: form.telefono.trim() || null,
        email: form.email.trim() || null,
        cedula: form.cedula.trim() || null,
        fecha_nacimiento: form.fecha_nacimiento || null,
        genero: form.genero.trim() || null,
        direccion: form.direccion.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clienteId)
    if (updateError) { setToast({ msg: updateError.message, kind: 'err' }); setSavingPerfil(false); return }
    setToast({ msg: 'Datos actualizados correctamente.', kind: 'ok' })
    setEditing(false); setSavingPerfil(false); router.refresh()
  }

  function cancelarEdicion() {
    if (!cliente) return
    setForm({
      nombre: cliente.nombre ?? '', telefono: cliente.telefono ?? '',
      email: cliente.email ?? '', cedula: cliente.cedula ?? '',
      fecha_nacimiento: cliente.fecha_nacimiento ?? '',
      genero: cliente.genero ?? '', direccion: cliente.direccion ?? '',
    })
    setEditing(false)
  }

  /* ── AVATAR INITIALS ── */
  const initials = (cliente?.nombre ?? 'U')
    .split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()

  /* ── RENDER ─────────────────────────────────────────────────────────── */
  return (
    <>
      {/* ── Page header ── */}
      <div className="cliente-page-header">
        <div className="cliente-page-chip">👤 Perfil</div>
        <h2 className="cliente-page-title">Mi cuenta</h2>
        <p className="cliente-page-subtitle">
          Datos personales, deudas, cuentas abiertas y movimientos en RPM.
        </p>
      </div>

      {/* ── Quick actions row ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          className="cliente-btn cliente-btn-secondary"
          style={{ flex: 1, fontSize: 12 }}
          onClick={() => clienteId && cargarFinanzas(clienteId)}
        >
          <RefreshCcw size={14} />
          Actualizar
        </button>
        <button
          type="button"
          className="cliente-btn cliente-btn-secondary"
          style={{ flex: 1, fontSize: 12, color: 'var(--red)', borderColor: 'rgba(248,113,113,0.20)' }}
          onClick={handleLogout}
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>
      </div>

      {/* ── Alerts ── */}
      {toast && (
        <div className={`cliente-alert ${toast.kind === 'ok' ? 'cliente-alert-success' : 'cliente-alert-error'}`}
          style={{ marginBottom: 12 }}>
          {toast.msg}
        </div>
      )}
      {error && (
        <div className="cliente-alert cliente-alert-error" style={{ marginBottom: 12 }}>{error}</div>
      )}
      {finanzasError && (
        <div className="cliente-alert cliente-alert-error" style={{ marginBottom: 12 }}>{finanzasError}</div>
      )}

      {/* ── AVATAR + NAME HERO ── */}
      <div className="cliente-card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--purple), var(--purple2))' }} />
        <div style={{ padding: '20px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Avatar */}
          <div style={{
            width: 64, height: 64, borderRadius: 22, flexShrink: 0,
            background: 'linear-gradient(145deg, var(--purple), var(--purple2))',
            display: 'grid', placeItems: 'center',
            fontSize: 22, fontWeight: 900, color: 'white',
            boxShadow: '0 8px 28px rgba(124,58,237,0.36)',
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 800, color: 'var(--purple2)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Cliente RPM
            </p>
            <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {loading ? 'Cargando…' : (cliente?.nombre ?? 'Sin nombre')}
            </h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className={`cliente-chip ${cliente?.estado === 'activo' ? 'cliente-chip-green' : ''}`}>
                {cliente?.estado ?? 'activo'}
              </span>
              {cliente?.acceso_portal && (
                <span className="cliente-chip cliente-chip-purple">Portal activo</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── DATOS PERSONALES ── */}
      <div className="cliente-card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--purple), var(--purple2))' }} />
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div className="cliente-section-dot" />
                <span className="cliente-section-title">Datos personales</span>
              </div>
              <p className="cliente-section-subtitle">Actualiza tu información básica desde aquí.</p>
            </div>
            {!editing && (
              <button
                type="button"
                className="cliente-btn cliente-btn-secondary"
                style={{ fontSize: 12, padding: '8px 12px' }}
                onClick={() => setEditing(true)}
              >
                <Edit3 size={13} /> Editar
              </button>
            )}
          </div>

          {editing ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                { label: 'Nombre', key: 'nombre', type: 'text' },
                { label: 'Teléfono', key: 'telefono', type: 'tel' },
                { label: 'Correo', key: 'email', type: 'email' },
                { label: 'Cédula', key: 'cedula', type: 'text' },
                { label: 'Fecha de nacimiento', key: 'fecha_nacimiento', type: 'date' },
                { label: 'Género', key: 'genero', type: 'text' },
              ].map(({ label, key, type }) => (
                <label key={key} className="cliente-label">
                  {label}
                  <input
                    type={type}
                    value={form[key as keyof ClienteForm]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="cliente-input"
                  />
                </label>
              ))}

              <label className="cliente-label">
                Dirección
                <textarea
                  value={form.direccion}
                  onChange={(e) => setForm((prev) => ({ ...prev, direccion: e.target.value }))}
                  rows={3}
                  className="cliente-textarea"
                  style={{ minHeight: 72 }}
                />
              </label>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  className="cliente-btn cliente-btn-secondary"
                  style={{ flex: 1, fontSize: 12 }}
                  disabled={savingPerfil}
                  onClick={cancelarEdicion}
                >
                  <X size={13} /> Cancelar
                </button>
                <button
                  type="button"
                  className="cliente-btn"
                  style={{ flex: 2, fontSize: 12 }}
                  disabled={savingPerfil}
                  onClick={guardarPerfil}
                >
                  <Save size={13} />
                  {savingPerfil ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {[
                { label: 'Correo',      value: cliente?.email           || '—' },
                { label: 'Teléfono',    value: cliente?.telefono        || '—' },
                { label: 'Cédula',      value: cliente?.cedula          || '—' },
                { label: 'Nacimiento',  value: cliente?.fecha_nacimiento ? formatDate(cliente.fecha_nacimiento) : '—' },
                { label: 'Género',      value: cliente?.genero          || '—' },
                { label: 'Dirección',   value: cliente?.direccion       || '—' },
              ].map(({ label, value }) => (
                <InfoRow key={label} label={label} value={value} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RESUMEN FINANCIERO ── */}
      <div className="cliente-card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--red), var(--orange))' }} />
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div className="cliente-section-dot" style={{ background: 'var(--red)', boxShadow: '0 0 8px var(--red)' }} />
            <span className="cliente-section-title">Resumen financiero</span>
          </div>
          <p className="cliente-section-subtitle" style={{ marginBottom: 14 }}>
            Deudas, cuentas abiertas y pagos registrados.
          </p>

          {/* Stat pills 2×2 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <FinStat
              label="Deuda USD"
              value={moneyUsd(totalDeudaUsd)}
              accent={totalDeudaUsd > 0}
              color="var(--red)"
            />
            <FinStat
              label="Deuda Bs"
              value={moneyBs(totalDeudaBs)}
              accent={totalDeudaBs > 0}
              color="var(--orange)"
            />
            <FinStat
              label="Cuentas abiertas"
              value={String(cuentasAbiertas.length)}
              accent={cuentasAbiertas.length > 0}
              color="var(--yellow)"
            />
            <FinStat
              label="Pagos registrados"
              value={String(pagos.length)}
              color="var(--purple2)"
            />
          </div>

          {/* Summary rows */}
          <InfoRow label="Total pagado (aprox.)" value={moneyUsd(totalPagadoUsd)} />
          <InfoRow
            label="Último pago"
            value={ultimoPago ? formatDate(pagoFecha(ultimoPago)) : 'Sin pagos'}
            last
          />
        </div>
      </div>

      {/* ── CUENTAS ABIERTAS ── */}
      <div className="cliente-card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--yellow), var(--orange))' }} />
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div className="cliente-section-dot" style={{ background: 'var(--yellow)', boxShadow: '0 0 8px var(--yellow)' }} />
            <span className="cliente-section-title">Mis deudas y cuentas abiertas</span>
          </div>
          <p className="cliente-section-subtitle" style={{ marginBottom: 14 }}>
            Lo pendiente, parcial o vencido con saldo activo.
          </p>

          <div className="cliente-list">
            {loadingFinanzas && <EmptyCard text="Cargando cuentas…" />}
            {!loadingFinanzas && cuentasAbiertas.map((cuenta) => (
              <CuentaCard key={cuenta.id} cuenta={cuenta} />
            ))}
            {!loadingFinanzas && cuentasAbiertas.length === 0 && (
              <EmptyCard text="No tienes cuentas abiertas ni deudas pendientes. ✓" />
            )}
          </div>
        </div>
      </div>

      {/* ── PAGOS / MOVIMIENTOS ── */}
      <div className="cliente-card" style={{ overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--green), var(--purple2))' }} />
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div className="cliente-section-dot" style={{ background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} />
            <span className="cliente-section-title">Pagos, abonos y movimientos</span>
          </div>
          <p className="cliente-section-subtitle" style={{ marginBottom: 14 }}>
            Historial de movimientos asociados a tu cuenta.
          </p>

          <div className="cliente-list">
            {loadingFinanzas && <EmptyCard text="Cargando pagos…" />}
            {!loadingFinanzas && pagos.map((pago) => (
              <PagoCard key={pago.id} pago={pago} />
            ))}
            {!loadingFinanzas && pagos.length === 0 && (
              <EmptyCard text="No tienes pagos registrados todavía." />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/* ── SUB-COMPONENTS ────────────────────────────────────────────────────── */

function InfoRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 10,
      padding: '10px 0',
      borderBottom: last ? 'none' : '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700, textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}

function FinStat({ label, value, accent = false, color }: { label: string; value: string; accent?: boolean; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface2)',
      border: `1px solid ${accent && color ? color + '28' : 'var(--border)'}`,
      borderRadius: 14,
      padding: '10px 12px',
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 9.5, fontWeight: 800, color: accent && color ? color : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 900, color: accent && color ? color : 'var(--text)', letterSpacing: '-0.02em' }}>
        {value}
      </p>
    </div>
  )
}

function CuentaCard({ cuenta }: { cuenta: CuentaPorCobrar }) {
  const estado   = safeText(cuenta.estado, 'pendiente')
  const concepto = safeText(cuenta.concepto || cuenta.tipo_origen, 'Cuenta por cobrar')

  return (
    <article style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '13px 14px',
      overflow: 'hidden',
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <span className={estadoCuentaChip(estado)}>{estado}</span>
        <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--red)', letterSpacing: '-0.02em' }}>
          {moneyUsd(cuenta.saldo_usd)}
        </span>
      </div>

      {/* Name */}
      <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
        {concepto}
      </p>

      {/* Dates */}
      <p style={{ margin: '0 0 8px', fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>
        Venta: {cuenta.fecha_venta ? formatDate(cuenta.fecha_venta) : '—'}
        {' · '}
        Vence: {cuenta.fecha_vencimiento ? formatDate(cuenta.fecha_vencimiento) : '—'}
      </p>

      {/* Progress bar */}
      {toNumber(cuenta.monto_total_usd) > 0 && (() => {
        const pct = Math.min(100, (toNumber(cuenta.monto_pagado_usd) / toNumber(cuenta.monto_total_usd)) * 100)
        return (
          <div>
            <div style={{ height: 4, borderRadius: 999, background: 'var(--border)', overflow: 'hidden', marginBottom: 5 }}>
              <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: 'linear-gradient(90deg, var(--purple), var(--green))', transition: 'width .4s ease' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
              <span>Pagado: {moneyUsd(cuenta.monto_pagado_usd)}</span>
              <span>Total: {moneyUsd(cuenta.monto_total_usd)}</span>
            </div>
          </div>
        )
      })()}

      {toNumber(cuenta.saldo_bs) > 0 && (
        <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>
          Saldo Bs: {moneyBs(cuenta.saldo_bs)}
        </p>
      )}

      {cuenta.notas && (
        <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--muted)', fontStyle: 'italic' }}>
          {cuenta.notas}
        </p>
      )}
    </article>
  )
}

function PagoCard({ pago }: { pago: PagoCliente }) {
  const fecha   = pagoFecha(pago)
  const concepto = safeText(pago.concepto || pago.categoria || pago.tipo_origen, 'Pago')
  const estado  = safeText(pago.estado, 'registrado')
  const moneda  = safeText(pago.moneda_pago || pago.moneda, '$')
  const montoPpal = pagoMontoPrincipal(pago)

  return (
    <article style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '13px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      {/* Icon dot */}
      <div style={{
        width: 40, height: 40, borderRadius: 14, flexShrink: 0,
        background: 'var(--green-soft)',
        border: '1px solid rgba(52,211,153,0.20)',
        display: 'grid', placeItems: 'center',
        fontSize: 16,
      }}>
        💳
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 2px', fontSize: 13.5, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {concepto}
        </p>
        <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>
          {fecha ? formatDate(fecha) : '—'}
          {pago.metodo_pago ? ` · ${pago.metodo_pago}` : ''}
        </p>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 900, color: 'var(--green)' }}>
          {formatMoney(montoPpal, moneda)}
        </p>
        {toNumber(pago.monto_bs) > 0 && (
          <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
            {moneyBs(pago.monto_bs)}
          </p>
        )}
      </div>
    </article>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div style={{
      padding: '14px',
      borderRadius: 14,
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      fontSize: 13,
      color: 'var(--muted)',
      fontWeight: 600,
      textAlign: 'center',
    }}>
      {text}
    </div>
  )
}