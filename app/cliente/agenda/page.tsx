'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatDate, formatHour, useClientePortal } from '../_components/ClienteData'

/* ── TYPES ─────────────────────────────────────────────────────────────── */

type MaybeArray<T> = T | T[] | null | undefined

type EmpleadoRef = {
  id: string
  nombre: string | null
  rol: string | null
}

type PlanRef = {
  id: string
  nombre: string | null
}

type ClientePlanRef = {
  id: string
  fecha_fin: string | null
  estado: string | null
  sesiones_totales: number | null
  sesiones_usadas: number | null
  planes: MaybeArray<PlanRef>
}

type ServicioRef = {
  id: string
  nombre: string | null
}

type EntrenamientoClienteRaw = Omit<EntrenamientoCliente, 'empleados' | 'clientes_planes'> & {
  empleados: MaybeArray<EmpleadoRef>
  clientes_planes: MaybeArray<ClientePlanRef>
}

type CitaClienteRaw = Omit<CitaCliente, 'empleados' | 'servicios'> & {
  empleados: MaybeArray<EmpleadoRef>
  servicios: MaybeArray<ServicioRef>
}

type EntrenamientoCliente = {
  id: string
  cliente_plan_id: string | null
  cliente_id: string | null
  empleado_id: string | null
  fecha: string | null
  hora_inicio: string | null
  hora_fin: string | null
  estado: string | null
  asistencia_estado: string | null
  aviso_previo: boolean | null
  consume_sesion: boolean | null
  reprogramable: boolean | null
  motivo_asistencia: string | null
  empleados: EmpleadoRef | null
  clientes_planes: (Omit<ClientePlanRef, 'planes'> & { planes: PlanRef | null }) | null
}

type CitaCliente = {
  id: string
  cliente_id: string | null
  terapeuta_id: string | null
  servicio_id: string | null
  fecha: string | null
  hora_inicio: string | null
  hora_fin: string | null
  estado: string | null
  notas: string | null
  empleados: EmpleadoRef | null
  servicios: ServicioRef | null
}

type SolicitudAccion =
  | 'aviso_no_asistencia_cliente'
  | 'reprogramar_cita_cliente'
  | 'cancelar_cita_cliente'

type SolicitudModal =
  | { kind: 'entrenamiento'; accion: 'aviso_no_asistencia_cliente'; item: EntrenamientoCliente }
  | { kind: 'cita'; accion: 'reprogramar_cita_cliente' | 'cancelar_cita_cliente'; item: CitaCliente }

/* ── HELPERS ───────────────────────────────────────────────────────────── */

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}


function firstOrNull<T>(value: MaybeArray<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizarEntrenamiento(row: EntrenamientoClienteRaw): EntrenamientoCliente {
  const plan = firstOrNull(row.clientes_planes)
  return {
    ...row,
    empleados: firstOrNull(row.empleados),
    clientes_planes: plan
      ? {
          ...plan,
          planes: firstOrNull(plan.planes),
        }
      : null,
  }
}

function normalizarCita(row: CitaClienteRaw): CitaCliente {
  return {
    ...row,
    empleados: firstOrNull(row.empleados),
    servicios: firstOrNull(row.servicios),
  }
}

function sesionesRestantes(plan: EntrenamientoCliente['clientes_planes']) {
  if (!plan) return 0
  return Math.max(0, Number(plan.sesiones_totales || 0) - Number(plan.sesiones_usadas || 0))
}

function estadoSesionLabel(value: string | null | undefined) {
  const v = (value || 'pendiente').toLowerCase()
  if (v === 'asistio')              return 'Asistió'
  if (v === 'no_asistio_aviso')     return 'Aviso enviado'
  if (v === 'no_asistio_sin_aviso') return 'No asistió'
  if (v === 'reprogramado')         return 'Reprogramada'
  return 'Pendiente'
}

function estadoCitaLabel(value: string | null | undefined) {
  const v = (value || 'programada').toLowerCase()
  if (v === 'completada')  return 'Completada'
  if (v === 'cancelada')   return 'Cancelada'
  if (v === 'reprogramada') return 'Reprogramada'
  if (v === 'confirmada')  return 'Confirmada'
  return 'Programada'
}

function estadoChipClass(value: string | null | undefined, tipo: 'sesion' | 'cita') {
  const v = (value || '').toLowerCase()
  if (v === 'asistio' || v === 'completada' || v === 'confirmada') return 'cliente-chip cliente-chip-green'
  if (v === 'no_asistio_aviso' || v === 'reprogramado' || v === 'reprogramada') return 'cliente-chip cliente-chip-yellow'
  if (v === 'no_asistio_sin_aviso' || v === 'cancelada') return 'cliente-chip cliente-chip-red'
  return 'cliente-chip'
}

function solicitudTitulo(accion: SolicitudAccion) {
  if (accion === 'reprogramar_cita_cliente') return 'Solicitud de reprogramación'
  if (accion === 'cancelar_cita_cliente')    return 'Solicitud de cancelación'
  return 'Aviso de no asistencia'
}

function solicitudBoton(accion: SolicitudAccion) {
  if (accion === 'reprogramar_cita_cliente') return 'Enviar solicitud'
  if (accion === 'cancelar_cita_cliente')    return 'Enviar cancelación'
  return 'Enviar aviso'
}

function solicitudPlaceholder(accion: SolicitudAccion) {
  if (accion === 'reprogramar_cita_cliente') return 'Ej: me gustaría reprogramar para mañana en la tarde...'
  if (accion === 'cancelar_cita_cliente')    return 'Ej: necesito cancelar por motivo personal...'
  return 'Ej: no podré asistir por motivo personal...'
}

/* ── COMPONENT ─────────────────────────────────────────────────────────── */

export default function ClienteAgendaPage() {
  const { cliente, loading: loadingCliente } = useClientePortal()

  const [sesiones, setSesiones]             = useState<EntrenamientoCliente[]>([])
  const [citas, setCitas]                   = useState<CitaCliente[]>([])
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState<string | null>(null)
  const [message, setMessage]               = useState<string | null>(null)
  const [savingId, setSavingId]             = useState<string | null>(null)
  const [solicitudModal, setSolicitudModal] = useState<SolicitudModal | null>(null)
  const [motivoSolicitud, setMotivoSolicitud] = useState('')
  const [fechaDeseada, setFechaDeseada]     = useState('')
  const [horaDeseada, setHoraDeseada]       = useState('')
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false)

  const hoy       = useMemo(() => todayKey(), [])
  const clienteId = cliente?.id ?? null

  async function cargarAgenda() {
    if (!clienteId) { setSesiones([]); setCitas([]); setLoading(false); return }
    setLoading(true); setError(null)

    const [sesionesRes, citasRes] = await Promise.all([
      supabase
        .from('entrenamientos')
        .select(`
          id, cliente_plan_id, cliente_id, empleado_id,
          fecha, hora_inicio, hora_fin, estado,
          asistencia_estado, aviso_previo, consume_sesion, reprogramable, motivo_asistencia,
          empleados:empleado_id(id, nombre, rol),
          clientes_planes:cliente_plan_id(
            id, fecha_fin, estado, sesiones_totales, sesiones_usadas,
            planes:plan_id(id, nombre)
          )
        `)
        .eq('cliente_id', clienteId)
        .eq('fecha', hoy)
        .neq('estado', 'cancelado')
        .order('hora_inicio', { ascending: true }),

      supabase
        .from('citas')
        .select(`
          id, cliente_id, terapeuta_id, servicio_id,
          fecha, hora_inicio, hora_fin, estado, notas,
          empleados:terapeuta_id(id, nombre, rol),
          servicios:servicio_id(id, nombre)
        `)
        .eq('cliente_id', clienteId)
        .eq('fecha', hoy)
        .neq('estado', 'cancelada')
        .order('hora_inicio', { ascending: true }),
    ])

    if (sesionesRes.error) { setError(sesionesRes.error.message); setSesiones([]) }
    else setSesiones(((sesionesRes.data ?? []) as unknown as EntrenamientoClienteRaw[]).map(normalizarEntrenamiento))

    if (citasRes.error) { setError((prev) => prev ?? citasRes.error.message); setCitas([]) }
    else setCitas(((citasRes.data ?? []) as unknown as CitaClienteRaw[]).map(normalizarCita))

    setLoading(false)
  }

  useEffect(() => { cargarAgenda() }, [clienteId]) // eslint-disable-line react-hooks/exhaustive-deps

  function cerrarModal() {
    setSolicitudModal(null); setMotivoSolicitud(''); setFechaDeseada(''); setHoraDeseada('')
  }

  async function marcarAsistio(sesion: EntrenamientoCliente) {
    setSavingId(`sesion-${sesion.id}`); setMessage(null)
    const { data, error: rpcError } = await supabase.rpc('marcar_asistencia_entrenamiento_plan', {
      p_entrenamiento_id: sesion.id,
      p_asistencia_estado: 'asistio',
      p_motivo: 'Cliente marcó asistencia desde el portal.',
      p_marcado_por: null,
    })
    if (rpcError) { setMessage(rpcError.message); setSavingId(null); return }
    if (data?.ok === false) { setMessage(data?.error || 'No se pudo marcar la asistencia.'); setSavingId(null); return }
    setMessage('Asistencia registrada correctamente.')
    setSavingId(null); cargarAgenda()
  }

  async function marcarCitaCompletada(cita: CitaCliente) {
    setSavingId(`cita-${cita.id}`); setMessage(null)
    const { error: updateError } = await supabase
      .from('citas')
      .update({ estado: 'completada', updated_at: new Date().toISOString() })
      .eq('id', cita.id)
      .eq('cliente_id', clienteId)
    if (updateError) { setMessage(updateError.message); setSavingId(null); return }
    setMessage('Cita marcada como completada.')
    setSavingId(null); cargarAgenda()
  }

  async function enviarSolicitud() {
    if (!cliente?.id || !solicitudModal) return
    const motivo = motivoSolicitud.trim()
    if (!motivo) { setMessage('Escribe el motivo de la solicitud.'); return }

    setEnviandoSolicitud(true); setMessage(null)
    const accion = solicitudModal.accion
    const itemId = solicitudModal.item.id
    const isCita = solicitudModal.kind === 'cita'

    let query = supabase
      .from('solicitudes_comunicacion')
      .select('id')
      .eq('cliente_id', cliente.id)
      .eq('tipo', accion)
      .in('estado', ['pendiente', 'en_revision'])

    query = isCita ? query.eq('cita_id', itemId) : query.eq('entrenamiento_id', itemId)
    const { data: existente, error: existenteError } = await query.maybeSingle()

    if (existenteError) { setMessage(existenteError.message); setEnviandoSolicitud(false); return }
    if (existente?.id) {
      setMessage('Ya existe una solicitud pendiente para este registro.')
      setEnviandoSolicitud(false); cerrarModal(); return
    }

    const hora        = `${formatHour(solicitudModal.item.hora_inicio)} - ${formatHour(solicitudModal.item.hora_fin)}`
    const fechaTexto  = formatDate(solicitudModal.item.fecha)
    const descripcionExtra = accion === 'reprogramar_cita_cliente'
      ? `\n\nFecha deseada: ${fechaDeseada || 'No indicada'}\nHora deseada: ${horaDeseada || 'No indicada'}`
      : ''

    const descripcion = solicitudModal.kind === 'cita'
      ? `El cliente solicita ${accion === 'cancelar_cita_cliente' ? 'cancelar' : 'reprogramar'} su cita "${solicitudModal.item.servicios?.nombre ?? 'Cita RPM'}" del ${fechaTexto} a las ${hora}.\n\nMotivo: ${motivo}${descripcionExtra}`
      : `El cliente avisa que no asistirá a su sesión del plan "${solicitudModal.item.clientes_planes?.planes?.nombre ?? 'Plan RPM'}" del ${fechaTexto} a las ${hora}.\n\nMotivo: ${motivo}`

    const fisioDestinoId = solicitudModal.kind === 'cita' ? solicitudModal.item.terapeuta_id : solicitudModal.item.empleado_id
    const solicitudBase  = {
      cliente_id: cliente.id, fisio_id: fisioDestinoId,
      cita_id: solicitudModal.kind === 'cita' ? solicitudModal.item.id : null,
      entrenamiento_id: solicitudModal.kind === 'entrenamiento' ? solicitudModal.item.id : null,
      tipo: accion, origen_tipo: 'cliente', origen_id: cliente.id,
      estado: 'pendiente', titulo: solicitudTitulo(accion), descripcion,
    }

    const solicitudesParaInsertar = [
      { ...solicitudBase, destino_tipo: 'recepcion', destino_id: null },
      ...(fisioDestinoId ? [{ ...solicitudBase, destino_tipo: 'fisio', destino_id: fisioDestinoId }] : []),
    ]

    const { error: insertError } = await supabase.from('solicitudes_comunicacion').insert(solicitudesParaInsertar)
    if (insertError) setMessage(insertError.message)
    else {
      setMessage(accion === 'aviso_no_asistencia_cliente'
        ? 'Aviso enviado a recepción correctamente.'
        : 'Solicitud enviada a recepción correctamente.')
      cerrarModal()
    }
    setEnviandoSolicitud(false); cargarAgenda()
  }

  const emptyAgenda = !loading && sesiones.length === 0 && citas.length === 0

  /* ── RENDER ─────────────────────────────────────────────────────────── */

  return (
    <>
      {/* ── Page header ── */}
      <div className="cliente-page-header">
        <div className="cliente-page-chip">📅 Agenda</div>
        <h2 className="cliente-page-title">Mi agenda de hoy</h2>
        <p className="cliente-page-subtitle">
          Confirma tu asistencia, revisa citas o envía solicitudes a recepción.
        </p>
      </div>

      {/* ── Alerts ── */}
      {message && (
        <div className="cliente-alert cliente-alert-success" style={{ marginBottom: 12 }}>
          {message}
        </div>
      )}
      {error && (
        <div className="cliente-alert cliente-alert-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* ── Date row ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="cliente-section-dot" />
          <span className="cliente-section-title">Agenda del día</span>
        </div>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: 'var(--muted)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 999,
            padding: '4px 10px',
          }}
        >
          {formatDate(hoy)}
        </span>
      </div>

      {/* ── Items ── */}
      <div className="cliente-list">
        {(loading || loadingCliente) && <EmptyCard text="Cargando agenda…" />}

        {/* SESIONES */}
        {!loading && sesiones.map((sesion) => {
          const plan     = sesion.clientes_planes
          const estado   = (sesion.asistencia_estado || 'pendiente').toLowerCase()
          const bloqueada = estado !== 'pendiente'
          const restantes = sesionesRestantes(plan)
          const isSaving  = savingId === `sesion-${sesion.id}`

          return (
            <article className="cliente-card" key={`sesion-${sesion.id}`} style={{ overflow: 'hidden' }}>
              {/* Colored top strip */}
              <div style={{
                height: 3,
                background: bloqueada
                  ? 'linear-gradient(90deg, var(--green), var(--purple2))'
                  : 'linear-gradient(90deg, var(--purple), var(--purple2))',
              }} />

              <div style={{ padding: '14px 16px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="cliente-chip cliente-chip-purple">Sesión</span>
                    <span className={estadoChipClass(estado, 'sesion')}>
                      {estadoSesionLabel(estado)}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {formatHour(sesion.hora_inicio)} – {formatHour(sesion.hora_fin)}
                  </span>
                </div>

                {/* Plan name */}
                <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                  {plan?.planes?.nombre ?? 'Sesión de plan'}
                </p>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                  Con {sesion.empleados?.nombre ?? 'profesional por asignar'}
                </p>

                {/* Stats row */}
                <div style={{
                  display: 'flex',
                  gap: 8,
                  marginBottom: 14,
                }}>
                  <StatPill label="Usadas"    value={`${plan?.sesiones_usadas ?? 0}/${plan?.sesiones_totales ?? 0}`} />
                  <StatPill label="Restantes" value={String(restantes)} accent={restantes <= 2} />
                  <StatPill label="Vence"     value={plan?.fecha_fin ? formatDate(plan.fecha_fin) : 'Sin fecha'} />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className={`cliente-btn${bloqueada ? '' : ' cliente-btn-green'}`}
                    style={{ flex: 1 }}
                    disabled={isSaving || bloqueada}
                    onClick={() => marcarAsistio(sesion)}
                  >
                    {isSaving ? 'Guardando…' : bloqueada ? '✓ Registrado' : '✓ Asistí'}
                  </button>
                  <button
                    type="button"
                    className="cliente-btn cliente-btn-secondary"
                    style={{ flex: 1 }}
                    disabled={bloqueada}
                    onClick={() => {
                      setSolicitudModal({ kind: 'entrenamiento', accion: 'aviso_no_asistencia_cliente', item: sesion })
                      setMotivoSolicitud(''); setMessage(null)
                    }}
                  >
                    Avisar ausencia
                  </button>
                </div>
              </div>
            </article>
          )
        })}

        {/* CITAS */}
        {!loading && citas.map((cita) => {
          const estado   = (cita.estado || 'programada').toLowerCase()
          const bloqueada = ['completada', 'cancelada', 'reprogramada'].includes(estado)
          const isSaving  = savingId === `cita-${cita.id}`

          return (
            <article className="cliente-card" key={`cita-${cita.id}`} style={{ overflow: 'hidden' }}>
              {/* Colored top strip */}
              <div style={{
                height: 3,
                background: bloqueada
                  ? 'linear-gradient(90deg, var(--green), var(--yellow))'
                  : 'linear-gradient(90deg, var(--orange), var(--yellow))',
              }} />

              <div style={{ padding: '14px 16px' }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="cliente-chip" style={{ borderColor: 'rgba(251,146,60,0.30)', background: 'rgba(251,146,60,0.10)', color: 'var(--orange)' }}>
                      Cita
                    </span>
                    <span className={estadoChipClass(estado, 'cita')}>
                      {estadoCitaLabel(estado)}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {formatHour(cita.hora_inicio)} – {formatHour(cita.hora_fin)}
                  </span>
                </div>

                {/* Service name */}
                <p style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                  {cita.servicios?.nombre ?? 'Cita RPM'}
                </p>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                  Con {cita.empleados?.nombre ?? 'profesional por asignar'}
                </p>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className={`cliente-btn${bloqueada ? '' : ' cliente-btn-green'}`}
                    style={{ flex: '1 1 110px' }}
                    disabled={isSaving || bloqueada}
                    onClick={() => marcarCitaCompletada(cita)}
                  >
                    {isSaving ? 'Guardando…' : bloqueada ? '✓ Registrado' : '✓ Completada'}
                  </button>
                  <button
                    type="button"
                    className="cliente-btn cliente-btn-secondary"
                    style={{ flex: '1 1 110px' }}
                    disabled={bloqueada}
                    onClick={() => {
                      setSolicitudModal({ kind: 'cita', accion: 'reprogramar_cita_cliente', item: cita })
                      setMotivoSolicitud(''); setMessage(null)
                    }}
                  >
                    Reprogramar
                  </button>
                  <button
                    type="button"
                    className="cliente-btn cliente-btn-danger"
                    style={{ flex: '1 1 110px' }}
                    disabled={bloqueada}
                    onClick={() => {
                      setSolicitudModal({ kind: 'cita', accion: 'cancelar_cita_cliente', item: cita })
                      setMotivoSolicitud(''); setMessage(null)
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </article>
          )
        })}

        {emptyAgenda && (
          <EmptyCard text="No tienes sesiones ni citas programadas para hoy." />
        )}
      </div>

      {/* ── SOLICITUD MODAL ── */}
      {solicitudModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 80,
          background: 'rgba(0,0,0,0.60)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: '0 0 16px',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          animation: 'fade-up 0.22s ease both',
        }}>
          <div
            className="cliente-card"
            style={{ width: '100%', maxWidth: 540, borderRadius: 24, overflow: 'hidden' }}
          >
            {/* Modal top strip */}
            <div style={{ height: 3, background: 'linear-gradient(90deg, var(--purple), var(--purple2))' }} />

            <div style={{ padding: 20 }}>
              {/* Drag handle */}
              <div style={{ width: 36, height: 4, borderRadius: 999, background: 'var(--border)', margin: '0 auto 16px' }} />

              <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 900, letterSpacing: '-0.03em' }}>
                {solicitudTitulo(solicitudModal.accion)}
              </h2>
              <p className="cliente-section-subtitle" style={{ marginBottom: 16 }}>
                Recepción recibirá esta solicitud y podrá gestionarla.
              </p>

              {solicitudModal.accion === 'reprogramar_cita_cliente' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <label className="cliente-label">
                    Fecha deseada
                    <input
                      type="date"
                      value={fechaDeseada}
                      onChange={(e) => setFechaDeseada(e.target.value)}
                      className="cliente-input"
                    />
                  </label>
                  <label className="cliente-label">
                    Hora deseada
                    <input
                      type="time"
                      value={horaDeseada}
                      onChange={(e) => setHoraDeseada(e.target.value)}
                      className="cliente-input"
                    />
                  </label>
                </div>
              )}

              <label className="cliente-label" style={{ marginBottom: 16 }}>
                Motivo
                <textarea
                  value={motivoSolicitud}
                  onChange={(e) => setMotivoSolicitud(e.target.value)}
                  rows={4}
                  placeholder={solicitudPlaceholder(solicitudModal.accion)}
                  className="cliente-textarea"
                />
              </label>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="cliente-btn cliente-btn-secondary"
                  style={{ flex: 1 }}
                  disabled={enviandoSolicitud}
                  onClick={cerrarModal}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="cliente-btn"
                  style={{ flex: 2 }}
                  disabled={enviandoSolicitud}
                  onClick={enviarSolicitud}
                >
                  {enviandoSolicitud ? 'Enviando…' : solicitudBoton(solicitudModal.accion)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── SUB-COMPONENTS ────────────────────────────────────────────────────── */

function EmptyCard({ text }: { text: string }) {
  return (
    <div
      className="cliente-card cliente-card-pad"
      style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, fontWeight: 600 }}
    >
      {text}
    </div>
  )
}

function StatPill({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      flex: 1,
      background: 'var(--surface2)',
      border: `1px solid ${accent ? 'rgba(251,191,36,0.24)' : 'var(--border)'}`,
      borderRadius: 12,
      padding: '7px 10px',
      textAlign: 'center',
    }}>
      <p style={{ margin: '0 0 2px', fontSize: 9.5, fontWeight: 800, color: accent ? 'var(--yellow)' : 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: accent ? 'var(--yellow)' : 'var(--text)' }}>
        {value}
      </p>
    </div>
  )
}