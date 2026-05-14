'use client'

import type React from 'react'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CalendarCheck,
  CreditCard,
  MessageCircle,
  WalletCards,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
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

/* ── TYPES ─────────────────────────────────────────────────────────────── */

type CuentaPorCobrarDashboard = {
  id: string
  cliente_id: string | null
  concepto: string | null
  tipo_origen: string | null
  estado: string | null
  moneda: string | null
  monto_total_usd: number | null
  monto_pagado_usd: number | null
  saldo_usd: number | null
  monto_total_bs: number | null
  monto_pagado_bs: number | null
  saldo_bs: number | null
  fecha_venta: string | null
  fecha_vencimiento: string | null
  created_at: string | null
}

type CitaHoyDashboard = {
  id: string
  fecha: string | null
  hora_inicio: string | null
  hora_fin: string | null
  estado: string | null
  servicio_id: string | null
  terapeuta_id: string | null
  servicios: { nombre: string | null } | null
  empleados: { nombre: string | null } | null
}

type SesionHoyDashboard = {
  id: string
  fecha: string | null
  hora_inicio: string | null
  hora_fin: string | null
  estado: string | null
  asistencia_estado: string | null
  empleado_id: string | null
  cliente_plan_id: string | null
  empleados: { nombre: string | null } | null
  clientes_planes: {
    id: string
    estado: string | null
    sesiones_totales: number | null
    sesiones_usadas: number | null
    fecha_fin: string | null
    planes: { nombre: string | null } | null
  } | null
}

/* ── HELPERS ───────────────────────────────────────────────────────────── */

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function toNumber(value: unknown) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function moneyBs(value: unknown) {
  return `Bs ${toNumber(value).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function cuentaAbierta(cuenta: CuentaPorCobrarDashboard) {
  const estado = String(cuenta.estado ?? '').toLowerCase()
  const saldoUsd = toNumber(cuenta.saldo_usd)
  const saldoBs  = toNumber(cuenta.saldo_bs)
  return (
    !['cobrada', 'anulado', 'anulada', 'cancelado', 'cancelada'].includes(estado) &&
    (saldoUsd > 0 || saldoBs > 0 || estado === 'pendiente' || estado === 'parcial' || estado === 'vencida')
  )
}

function getSolicitudTexto(solicitud: any) {
  return solicitud?.descripcion || solicitud?.mensaje || solicitud?.titulo || 'Sin mensaje adicional.'
}

function getPagoFecha(pago: any) {
  return pago?.fecha || pago?.created_at || null
}

function getPagoMonto(pago: any) {
  return pago?.monto_equivalente_usd ?? pago?.monto_usd ?? pago?.monto ?? pago?.monto_pagado_usd ?? pago?.monto_total_usd ?? 0
}

function estadoSesionLabel(value: string | null | undefined) {
  const v = String(value || 'pendiente').toLowerCase()
  if (v === 'asistio')              return 'Asistió'
  if (v === 'no_asistio_aviso')     return 'Aviso enviado'
  if (v === 'no_asistio_sin_aviso') return 'No asistió'
  if (v === 'reprogramado')         return 'Reprogramada'
  return 'Pendiente'
}

function estadoCitaLabel(value: string | null | undefined) {
  const v = String(value || 'programada').toLowerCase()
  if (v === 'completada')   return 'Completada'
  if (v === 'cancelada')    return 'Cancelada'
  if (v === 'reprogramada') return 'Reprogramada'
  if (v === 'confirmada')   return 'Confirmada'
  return 'Programada'
}

function labelSolicitud(tipo: string) {
  const labels: Record<string, string> = {
    aviso_no_asistencia_cliente: 'Aviso de no asistencia',
    no_asistencia: 'Aviso de no asistencia',
    solicitar_cita: 'Solicitud de cita',
    solicitud_cita: 'Solicitud de cita',
    solicitar_plan: 'Solicitar plan',
    renovar_plan: 'Renovar plan',
    renovacion_plan: 'Renovación de plan',
    reagendar_cita: 'Reagendar cita',
    reprogramar_cita_cliente: 'Reprogramar cita',
    cancelar_cita_cliente: 'Cancelar cita',
    cancelar_cita: 'Cancelar cita',
    pregunta: 'Pregunta',
    cambio_horario: 'Cambio de horario',
    cambio_fisio: 'Cambio de fisio',
    consulta_pago: 'Consulta de pago',
    consulta_clinica: 'Consulta clínica',
    comunicado: 'Comunicado',
    otro: 'Otra solicitud',
  }
  return labels[tipo] ?? tipo
}

/* ── PAGE ──────────────────────────────────────────────────────────────── */

export default function ClienteDashboardPage() {
  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  const { cliente, loading, error }  = useClientePortal()
  const citas                         = useClienteCitas(cliente?.id)
  const pagos                         = useClientePagos(cliente?.id)
  const solicitudes                   = useClienteSolicitudes(cliente?.id)
  const proximaCita                   = useProximaCita(citas.citas)

  const [cuentas, setCuentas]               = useState<CuentaPorCobrarDashboard[]>([])
  const [citasHoy, setCitasHoy]             = useState<CitaHoyDashboard[]>([])
  const [sesionesHoy, setSesionesHoy]       = useState<SesionHoyDashboard[]>([])
  const [loadingCuentas, setLoadingCuentas] = useState(false)
  const [loadingHoy, setLoadingHoy]         = useState(false)
  const [cuentasError, setCuentasError]     = useState<string | null>(null)
  const [hoyError, setHoyError]             = useState<string | null>(null)

  const clienteId = cliente?.id ?? null
  const hoy       = useMemo(() => todayKey(), [])

  useEffect(() => {
    if (!clienteId) return
    void cargarCuentas(clienteId)
    void cargarAgendaHoy(clienteId)
  }, [clienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function cargarCuentas(id: string) {
    setLoadingCuentas(true); setCuentasError(null)
    const { data, error: e } = await supabase
      .from('cuentas_por_cobrar')
      .select('id,cliente_id,concepto,tipo_origen,estado,moneda,monto_total_usd,monto_pagado_usd,saldo_usd,monto_total_bs,monto_pagado_bs,saldo_bs,fecha_venta,fecha_vencimiento,created_at')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false })
    if (e) { setCuentasError(e.message); setCuentas([]) } else setCuentas((data ?? []) as CuentaPorCobrarDashboard[])
    setLoadingCuentas(false)
  }

  async function cargarAgendaHoy(id: string) {
    setLoadingHoy(true); setHoyError(null)
    const [citasRes, sesionesRes] = await Promise.all([
      supabase
        .from('citas')
        .select('id,fecha,hora_inicio,hora_fin,estado,servicio_id,terapeuta_id,servicios:servicio_id(nombre),empleados:terapeuta_id(nombre)')
        .eq('cliente_id', id).eq('fecha', hoy).neq('estado', 'cancelada')
        .order('hora_inicio', { ascending: true }),
      supabase
        .from('entrenamientos')
        .select('id,fecha,hora_inicio,hora_fin,estado,asistencia_estado,empleado_id,cliente_plan_id,empleados:empleado_id(nombre),clientes_planes:cliente_plan_id(id,estado,sesiones_totales,sesiones_usadas,fecha_fin,planes:plan_id(nombre))')
        .eq('cliente_id', id).eq('fecha', hoy).neq('estado', 'cancelado')
        .order('hora_inicio', { ascending: true }),
    ])
    if (citasRes.error)    { setHoyError(citasRes.error.message); setCitasHoy([]) }
    else setCitasHoy((citasRes.data ?? []) as CitaHoyDashboard[])
    if (sesionesRes.error) { setHoyError((p) => p ?? sesionesRes.error.message); setSesionesHoy([]) }
    else setSesionesHoy((sesionesRes.data ?? []) as SesionHoyDashboard[])
    setLoadingHoy(false)
  }

  const cuentasAbiertas       = useMemo(() => cuentas.filter(cuentaAbierta), [cuentas])
  const deudaUsd              = useMemo(() => cuentasAbiertas.reduce((t, c) => t + toNumber(c.saldo_usd), 0), [cuentasAbiertas])
  const deudaBs               = useMemo(() => cuentasAbiertas.reduce((t, c) => t + toNumber(c.saldo_bs), 0), [cuentasAbiertas])
  const solicitudesPendientes = useMemo(() => solicitudes.solicitudes.filter((s: any) => s.estado === 'pendiente'), [solicitudes.solicitudes])
  const totalHoy              = citasHoy.length + sesionesHoy.length
  const pagosCount            = pagos.pagos.length

  const firstName = cliente?.nombre ? cliente.nombre.split(' ')[0] : null

  /* ── RENDER ─────────────────────────────────────────────────────────── */
  return (
    <>
      {/* ── Greeting header ── */}
      <div className="cliente-page-header">
        <div className="cliente-page-chip">🏠 Inicio</div>
        <h2 className="cliente-page-title">
          {loading ? 'Cargando…' : `Hola${firstName ? `, ${firstName}` : ''}  👋`}
        </h2>
        <p className="cliente-page-subtitle">
          Tu resumen de agenda, solicitudes, deudas y pagos.
        </p>
      </div>

      {/* ── Errors ── */}
      {error      && <div className="cliente-alert cliente-alert-error" style={{ marginBottom: 10 }}>{error}</div>}
      {cuentasError && <div className="cliente-alert cliente-alert-error" style={{ marginBottom: 10 }}>{cuentasError}</div>}
      {hoyError   && <div className="cliente-alert cliente-alert-error" style={{ marginBottom: 10 }}>{hoyError}</div>}

      {/* ── STAT CARDS 2×2 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        <StatCard
          icon={<CalendarCheck size={18} />}
          label="Hoy"
          value={`${totalHoy}`}
          sub={`actividad${totalHoy === 1 ? '' : 'es'}`}
          href="/cliente/agenda"
          color="var(--purple)"
          glow="rgba(124,58,237,0.22)"
        />
        <StatCard
          icon={<MessageCircle size={18} />}
          label="Solicitudes"
          value={`${solicitudesPendientes.length}`}
          sub="pendientes"
          href="/cliente/comunicacion"
          color="var(--purple2)"
          glow="rgba(167,139,250,0.18)"
        />
        <StatCard
          icon={<WalletCards size={18} />}
          label="Deuda abierta"
          value={deudaUsd > 0 ? formatMoney(deudaUsd, '$') : deudaBs > 0 ? moneyBs(deudaBs) : '—'}
          sub={deudaUsd === 0 && deudaBs === 0 ? 'Sin deuda ✓' : 'saldo pendiente'}
          href="/cliente/perfil"
          color={deudaUsd > 0 || deudaBs > 0 ? 'var(--red)' : 'var(--green)'}
          glow={deudaUsd > 0 || deudaBs > 0 ? 'rgba(248,113,113,0.16)' : 'rgba(52,211,153,0.14)'}
        />
        <StatCard
          icon={<CreditCard size={18} />}
          label="Pagos"
          value={`${pagosCount}`}
          sub="registros"
          href="/cliente/perfil"
          color="var(--green)"
          glow="rgba(52,211,153,0.14)"
        />
      </div>

      {/* ── AGENDA HOY ── */}
      <div className="cliente-card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--purple), var(--purple2))' }} />
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="cliente-section-dot" />
              <div>
                <p className="cliente-section-title" style={{ marginBottom: 1 }}>Agenda de hoy</p>
                <p className="cliente-section-subtitle" style={{ margin: 0 }}>{formatDate(hoy)}</p>
              </div>
            </div>
            <Link
              href="/cliente/agenda"
              style={{
                fontSize: 11.5, fontWeight: 700, color: 'var(--purple2)',
                textDecoration: 'none', padding: '5px 10px',
                borderRadius: 999, border: '1px solid var(--border-strong)',
                background: 'var(--purple-glow)',
              }}
            >
              Ver todo →
            </Link>
          </div>

          <div className="cliente-list">
            {loadingHoy && <EmptyCard text="Cargando agenda de hoy…" />}

            {!loadingHoy && sesionesHoy.map((sesion) => (
              <AgendaRow
                key={`sesion-${sesion.id}`}
                type="sesion"
                title={sesion.clientes_planes?.planes?.nombre ?? 'Sesión de plan'}
                subtitle={sesion.empleados?.nombre ?? 'Profesional por asignar'}
                hora={`${formatHour(sesion.hora_inicio)} – ${formatHour(sesion.hora_fin)}`}
                chip={estadoSesionLabel(sesion.asistencia_estado)}
                href="/cliente/agenda"
              />
            ))}

            {!loadingHoy && citasHoy.map((cita) => (
              <AgendaRow
                key={`cita-${cita.id}`}
                type="cita"
                title={cita.servicios?.nombre ?? 'Cita RPM'}
                subtitle={cita.empleados?.nombre ?? 'Profesional por asignar'}
                hora={`${formatHour(cita.hora_inicio)} – ${formatHour(cita.hora_fin)}`}
                chip={estadoCitaLabel(cita.estado)}
                href="/cliente/agenda"
              />
            ))}

            {!loadingHoy && totalHoy === 0 && (
              <EmptyCard text="No tienes sesiones ni citas para hoy." />
            )}
          </div>
        </div>
      </div>

      {/* ── ACCIONES RÁPIDAS ── */}
      <div className="cliente-card" style={{ marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--purple2), var(--orange))' }} />
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div className="cliente-section-dot" style={{ background: 'var(--purple2)', boxShadow: '0 0 8px var(--purple2)' }} />
            <p className="cliente-section-title">Acciones rápidas</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Link className="cliente-btn" href="/cliente/comunicacion?tipo=solicitar_cita" style={{ fontSize: 12 }}>
              📅 Solicitar cita
            </Link>
            <Link className="cliente-btn cliente-btn-secondary" href="/cliente/comunicacion?tipo=solicitar_plan" style={{ fontSize: 12 }}>
              📋 Solicitar plan
            </Link>
            <Link className="cliente-btn cliente-btn-secondary" href="/cliente/comunicacion?tipo=renovar_plan" style={{ fontSize: 12 }}>
              🔄 Renovar plan
            </Link>
            <Link className="cliente-btn cliente-btn-secondary" href="/cliente/comunicacion?tipo=cambio_horario" style={{ fontSize: 12 }}>
              🕐 Cambiar horario
            </Link>
          </div>
        </div>
      </div>

      {/* ── DEUDAS + SOLICITUDES row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 12 }}>

        {/* Deudas */}
        <div className="cliente-card" style={{ overflow: 'hidden' }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg, var(--red), var(--orange))' }} />
          <div style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="cliente-section-dot" style={{ background: 'var(--red)', boxShadow: '0 0 8px var(--red)' }} />
                <p className="cliente-section-title">Deudas abiertas</p>
              </div>
              <Link
                href="/cliente/perfil"
                style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--red)', textDecoration: 'none', padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(248,113,113,0.22)', background: 'var(--red-soft)' }}
              >
                Ver todo →
              </Link>
            </div>

            {/* Mini metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
              <MiniStat label="Cuentas" value={String(cuentasAbiertas.length)} accent={cuentasAbiertas.length > 0} color="var(--red)" />
              <MiniStat label="USD" value={formatMoney(deudaUsd, '$')} accent={deudaUsd > 0} color="var(--orange)" />
              <MiniStat label="Bs" value={moneyBs(deudaBs)} accent={deudaBs > 0} color="var(--yellow)" />
            </div>

            <div className="cliente-list">
              {loadingCuentas && <EmptyCard text="Cargando deudas…" />}
              {!loadingCuentas && cuentasAbiertas.slice(0, 3).map((cuenta) => (
                <div key={cuenta.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 10, padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cuenta.concepto || cuenta.tipo_origen || 'Cuenta por cobrar'}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
                      Vence: {cuenta.fecha_vencimiento ? formatDate(cuenta.fecha_vencimiento) : '—'}
                    </p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--red)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {toNumber(cuenta.saldo_usd) > 0 ? formatMoney(cuenta.saldo_usd, '$') : moneyBs(cuenta.saldo_bs)}
                  </span>
                </div>
              ))}
              {!loadingCuentas && cuentasAbiertas.length === 0 && (
                <EmptyCard text="No tienes deudas abiertas. ✓" />
              )}
            </div>
          </div>
        </div>

        {/* Solicitudes */}
        <div className="cliente-card" style={{ overflow: 'hidden' }}>
          <div style={{ height: 3, background: 'linear-gradient(90deg, var(--purple2), var(--purple))' }} />
          <div style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="cliente-section-dot" />
                <p className="cliente-section-title">Últimas solicitudes</p>
              </div>
              <Link
                href="/cliente/comunicacion"
                style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--purple2)', textDecoration: 'none', padding: '5px 10px', borderRadius: 999, border: '1px solid var(--border-strong)', background: 'var(--purple-glow)' }}
              >
                Ver todo →
              </Link>
            </div>

            <div className="cliente-list">
              {solicitudes.loading && <EmptyCard text="Cargando solicitudes…" />}
              {!solicitudes.loading && solicitudes.solicitudes.slice(0, 4).map((solicitud: any) => (
                <div key={solicitud.id} style={{
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>
                      {labelSolicitud(solicitud.tipo)}
                    </p>
                    <span className={`cliente-chip ${solicitud.estado === 'pendiente' ? 'cliente-chip-yellow' : solicitud.estado === 'resuelta' ? 'cliente-chip-green' : ''}`}>
                      {solicitud.estado}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {getSolicitudTexto(solicitud)}
                  </p>
                </div>
              ))}
              {!solicitudes.loading && solicitudes.solicitudes.length === 0 && (
                <EmptyCard text="Todavía no has enviado solicitudes." />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── PAGOS RECIENTES ── */}
      <div className="cliente-card" style={{ overflow: 'hidden' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, var(--green), var(--purple2))' }} />
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="cliente-section-dot" style={{ background: 'var(--green)', boxShadow: '0 0 8px var(--green)' }} />
              <p className="cliente-section-title">Pagos recientes</p>
            </div>
            <Link
              href="/cliente/perfil"
              style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--green)', textDecoration: 'none', padding: '5px 10px', borderRadius: 999, border: '1px solid rgba(52,211,153,0.22)', background: 'var(--green-soft)' }}
            >
              Ver todo →
            </Link>
          </div>

          <div className="cliente-list">
            {pagos.loading && <EmptyCard text="Cargando pagos…" />}
            {!pagos.loading && pagos.pagos.slice(0, 4).map((pago: any) => (
              <div key={pago.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                  background: 'var(--green-soft)', border: '1px solid rgba(52,211,153,0.18)',
                  display: 'grid', placeItems: 'center', fontSize: 14,
                }}>
                  💳
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pago.concepto || pago.categoria || pago.tipo_origen || 'Pago'}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
                    {getPagoFecha(pago) ? formatDate(getPagoFecha(pago)) : '—'}
                  </p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 900, color: 'var(--green)', flexShrink: 0 }}>
                  {formatMoney(getPagoMonto(pago), pago.moneda_pago ?? pago.moneda ?? '$')}
                </span>
              </div>
            ))}
            {!pagos.loading && pagos.pagos.length === 0 && (
              <EmptyCard text="No hay pagos registrados todavía." />
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/* ── SUB-COMPONENTS ────────────────────────────────────────────────────── */

function StatCard({
  icon, label, value, sub, href, color, glow,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  href: string
  color: string
  glow: string
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'block', textDecoration: 'none',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 18,
        padding: '14px 14px 12px',
        boxShadow: `var(--shadow-sm), 0 0 0 0 ${glow}`,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        transition: 'border-color .2s',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Accent glow blob */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: glow, filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, color }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'var(--muted)' }}>
          {label}
        </span>
      </div>
      <p style={{ margin: '0 0 2px', fontSize: 20, fontWeight: 900, color, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
        {sub}
      </p>
    </Link>
  )
}

function AgendaRow({
  type, title, subtitle, hora, chip, href,
}: {
  type: 'sesion' | 'cita'
  title: string
  subtitle: string
  hora: string
  chip: string
  href: string
}) {
  const isCita = type === 'cita'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 0', borderBottom: '1px solid var(--border)',
    }}>
      {/* Type dot */}
      <div style={{
        width: 36, height: 36, borderRadius: 12, flexShrink: 0,
        background: isCita ? 'rgba(251,146,60,0.12)' : 'var(--purple-glow)',
        border: `1px solid ${isCita ? 'rgba(251,146,60,0.22)' : 'var(--border-strong)'}`,
        display: 'grid', placeItems: 'center', fontSize: 14,
      }}>
        {isCita ? '📋' : '💪'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 1px', fontSize: 13, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </p>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
          {hora} · {subtitle}
        </p>
      </div>

      <Link
        href={href}
        style={{
          fontSize: 11, fontWeight: 700, color: 'var(--purple2)', textDecoration: 'none',
          padding: '5px 10px', borderRadius: 999,
          border: '1px solid var(--border-strong)', background: 'var(--purple-glow)',
          flexShrink: 0,
        }}
      >
        Ir →
      </Link>
    </div>
  )
}

function MiniStat({ label, value, accent = false, color }: { label: string; value: string; accent?: boolean; color?: string }) {
  return (
    <div style={{
      background: 'var(--surface2)',
      border: `1px solid ${accent && color ? color + '28' : 'var(--border)'}`,
      borderRadius: 12, padding: '8px 10px', textAlign: 'center',
    }}>
      <p style={{ margin: '0 0 3px', fontSize: 9, fontWeight: 800, color: accent && color ? color : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 900, color: accent && color ? color : 'var(--text)', letterSpacing: '-0.02em' }}>
        {value}
      </p>
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div style={{
      padding: '12px', borderRadius: 12,
      background: 'var(--surface2)', border: '1px solid var(--border)',
      fontSize: 13, color: 'var(--muted)', fontWeight: 600, textAlign: 'center',
    }}>
      {text}
    </div>
  )
}