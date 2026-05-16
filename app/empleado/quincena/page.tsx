'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, ChevronDown, RotateCcw } from 'lucide-react'

type PeriodoKey = 'actual' | 'anterior'
type Moneda = 'USD' | 'BS'
type EstadoFiltro = 'todos' | 'pendiente' | 'liquidada'

const ESTADOS_EXCLUIDOS = new Set(['retenida', 'cancelada', 'cancelado'])
type MonedaFiltro = 'todas' | Moneda

type ApiData = {
  empleado?: { id: string; nombre: string | null; rol: string | null }
  periodo?: { key: PeriodoKey; start: string; end: string; label: string }
  resumen?: {
    total_facturado_usd: number | null
    total_pagado_usd: number | null
    total_pendiente_usd: number | null
    credito_disponible_usd: number | null
    saldo_favor_neto_usd: number | null
    saldo_pendiente_neto_usd: number | null
  }
  fuente?: string
  pagos?: any[]
  detalle?: any[]
  debug?: Record<string, any>
}

type ComisionVista = {
  id: string
  raw: any
  tipo: string
  estado: string
  estadoNormalizado: string
  pagado: boolean
  moneda: Moneda
  fecha: string
  cliente: string
  servicio: string
  concepto: string
  subtitulo: string
  baseUsd: number
  baseBs: number
  rpmUsd: number
  rpmBs: number
  profesionalUsd: number
  profesionalBs: number
  descuentoUsd: number
  descuentoBs: number
  netoUsd: number
  netoBs: number
}

function r2(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

function num(value: any) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function money(n: number | string | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(n || 0))
}

function bs(n: number | string | null | undefined) {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'VES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0))
}

function monto(n: number | string | null | undefined, moneda: Moneda) {
  return moneda === 'USD' ? money(n) : bs(n)
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function normalizarEstado(value: any) {
  return String(value || '').trim().toLowerCase()
}

function isFacturadaEstado(value: any) {
  return ['liquidado', 'liquidada', 'pagado', 'pagada', 'cobrada'].includes(normalizarEstado(value))
}

function esPendiente(row: any) {
  const estado = normalizarEstado(row?.estado || row?.status || '')
  const pagado = row?.pagado ?? row?.paid

  if (pagado === true) return false
  if (isFacturadaEstado(estado)) return false

  return pagado === false || estado === 'pendiente' || estado === 'parcial' || estado === 'vencida'
}

function esPagado(row: any) {
  if (row?.pagado === true || row?.paid === true) return true
  return isFacturadaEstado(row?.estado || row?.status)
}

function esExcluido(row: any) {
  return ESTADOS_EXCLUIDOS.has(normalizarEstado(row?.estado || row?.status || ''))
}

function formatDate(v: string | null | undefined) {
  if (!v || v === '—') return '—'

  try {
    return new Date(`${String(v).slice(0, 10)}T12:00:00`).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return String(v)
  }
}

function getComisionConcepto(row: any): string {
  const concepto = String(row?.concepto || row?.descripcion || '').trim()
  if (concepto) return concepto

  const tipo = String(row?.tipo || '').toLowerCase()
  const servicio = String(row?.servicio_nombre || '').trim()
  const cliente = String(row?.cliente_nombre || row?.pago_cliente_nombre || '').trim()

  if (tipo === 'plan') {
    if (servicio && cliente) return `Plan · ${servicio} · ${cliente}`
    if (servicio) return `Plan · ${servicio}`
    if (cliente) return `Plan · ${cliente}`
    return 'Comisión por plan'
  }

  if (tipo === 'cita') {
    if (servicio && cliente) return `Cita · ${servicio} · ${cliente}`
    if (servicio) return `Cita · ${servicio}`
    if (cliente) return `Cita · ${cliente}`
    return 'Comisión por cita'
  }

  if (servicio && cliente) return `${servicio} · ${cliente}`
  if (servicio) return servicio
  if (cliente) return `Comisión · ${cliente}`

  return `Comisión · ${formatDate(row?.cita_fecha || row?.fecha)}`
}

function getComisionSubtitulo(row: any): string {
  const partes: string[] = []

  const cliente = String(row?.cliente_nombre || row?.pago_cliente_nombre || '').trim()
  if (cliente && cliente !== 'Cliente desconocido') partes.push(cliente)

  const fecha = row?.cita_fecha || row?.fecha
  if (fecha) partes.push(formatDate(fecha))

  const hora = String(row?.cita_hora_inicio || '').slice(0, 5)
  if (hora) partes.push(hora)

  const servicio = String(row?.servicio_nombre || '').trim()
  if (servicio) partes.push(servicio)

  return partes.length ? partes.join(' · ') : String(row?.concepto || 'Comisión registrada')
}

function getComisionBrutoByMoneda(row: any, moneda: Moneda): number {
  return moneda === 'USD'
    ? num(row?.monto_profesional_usd ?? row?.profesional_usd ?? row?.profesional ?? 0)
    : num(row?.monto_profesional_bs ?? row?.profesional_bs ?? 0)
}

function getComisionDescuentoByMoneda(row: any, moneda: Moneda): number {
  return moneda === 'USD'
    ? num(row?.descuento_deuda_usd ?? row?.monto_descuento_usd ?? 0)
    : num(row?.descuento_deuda_bs ?? row?.monto_descuento_bs ?? 0)
}

function getComisionNetoByMoneda(row: any, moneda: Moneda): number {
  const netoPersistido =
    moneda === 'USD'
      ? Number(row?.monto_profesional_neto_usd ?? NaN)
      : Number(row?.monto_profesional_neto_bs ?? NaN)

  if (Number.isFinite(netoPersistido)) return r2(Math.max(netoPersistido, 0))

  return r2(
    Math.max(
      getComisionBrutoByMoneda(row, moneda) - getComisionDescuentoByMoneda(row, moneda),
      0
    )
  )
}

function inferirMoneda(row: any): Moneda {
  const raw = String(row?.moneda || row?.moneda_pago || row?.currency || '').toUpperCase()

  if (raw === 'BS' || raw === 'VES' || raw === 'VEF') return 'BS'
  if (raw === 'USD' || raw === '$') return 'USD'

  const bsAmt = num(row?.monto_profesional_bs ?? row?.profesional_bs ?? row?.monto_bs ?? 0)
  const usdAmt = num(row?.monto_profesional_usd ?? row?.profesional_usd ?? row?.monto_usd ?? 0)

  if (bsAmt > 0 && usdAmt <= 0) return 'BS'

  return 'USD'
}

function normalizarComision(row: any, index: number): ComisionVista {
  const moneda = inferirMoneda(row)
  const estadoRaw = String(row?.estado || row?.status || (esPagado(row) ? 'pagado' : 'pendiente'))
  const estadoNormalizado = normalizarEstado(estadoRaw)
  const pagado = esPagado(row)

  const profesionalUsd = getComisionBrutoByMoneda(row, 'USD')
  const profesionalBs = getComisionBrutoByMoneda(row, 'BS')
  const descuentoUsd = getComisionDescuentoByMoneda(row, 'USD')
  const descuentoBs = getComisionDescuentoByMoneda(row, 'BS')

  return {
    id: String(row?.id || row?.comision_id || row?.pago_id || `row-${index}`),
    raw: row,
    tipo: String(row?.tipo || 'comisión'),
    estado: estadoRaw,
    estadoNormalizado,
    pagado,
    moneda,
    fecha: String(row?.cita_fecha || row?.fecha || row?.fecha_pago || row?.created_at || '').slice(0, 10) || '—',
    cliente: String(row?.cliente_nombre || row?.pago_cliente_nombre || row?.paciente_nombre || 'Cliente'),
    servicio: String(row?.servicio_nombre || row?.servicio || ''),
    concepto: getComisionConcepto(row),
    subtitulo: getComisionSubtitulo(row),
    baseUsd: num(row?.monto_base_usd ?? row?.base_usd ?? (moneda === 'USD' ? row?.base ?? 0 : 0)),
    baseBs: num(row?.monto_base_bs ?? row?.base_bs ?? (moneda === 'BS' ? row?.base ?? 0 : 0)),
    rpmUsd: num(row?.monto_rpm_usd ?? row?.rpm_usd ?? (moneda === 'USD' ? row?.rpm ?? 0 : 0)),
    rpmBs: num(row?.monto_rpm_bs ?? row?.rpm_bs ?? (moneda === 'BS' ? row?.rpm ?? 0 : 0)),
    profesionalUsd: r2(profesionalUsd),
    profesionalBs: r2(profesionalBs),
    descuentoUsd: r2(descuentoUsd),
    descuentoBs: r2(descuentoBs),
    netoUsd: getComisionNetoByMoneda(row, 'USD'),
    netoBs: getComisionNetoByMoneda(row, 'BS'),
  }
}

function estadoBadgeStyle(c: ComisionVista): React.CSSProperties {
  if (c.pagado) {
    return {
      background: 'rgba(52,211,153,0.1)',
      border: '1px solid rgba(52,211,153,0.22)',
      color: 'var(--green)',
    }
  }

  if (esPendiente(c.raw)) {
    return {
      background: 'rgba(251,191,36,0.1)',
      border: '1px solid rgba(251,191,36,0.22)',
      color: '#d97706',
    }
  }

  return {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    color: 'var(--text-sub)',
  }
}

function estadoLabel(c: ComisionVista): string {
  if (c.pagado) return 'Liquidada'
  if (esPendiente(c.raw)) return 'Pendiente'
  return c.estado || 'Pendiente'
}

function tipoBadgeStyle(tipo: string): React.CSSProperties {
  const t = tipo.toLowerCase()

  if (t === 'plan') {
    return {
      background: 'rgba(139,92,246,0.1)',
      border: '1px solid rgba(139,92,246,0.2)',
      color: 'var(--accent)',
    }
  }

  if (t === 'cita') {
    return {
      background: 'rgba(56,189,248,0.1)',
      border: '1px solid rgba(56,189,248,0.2)',
      color: '#0284c7',
    }
  }

  return {
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    color: 'var(--text-sub)',
  }
}

function Pill({ label, style }: { label: string; style: React.CSSProperties }) {
  return (
    <span
      style={{
        ...style,
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '100px',
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase' as const,
      }}
    >
      {label}
    </span>
  )
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="glass-card rounded-[1.1rem] p-3">
      <p className="rpm-label" style={{ fontSize: '9px' }}>
        {label}
      </p>

      <p className="mt-1.5 text-base font-black tabular-nums" style={color ? { color } : {}}>
        {value}
      </p>

      {sub && <p className="rpm-muted mt-0.5 text-[10px] font-semibold tabular-nums">{sub}</p>}
    </div>
  )
}

function NativeSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer rounded-xl px-3 py-2 text-xs font-bold outline-none"
      style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export default function EmpleadoQuincenaPage() {
  const [periodo, setPeriodo] = useState<PeriodoKey>('actual')
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showDebug, setShowDebug] = useState(false)
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>('todos')

  const [monedaFiltro, setMonedaFiltro] = useState<MonedaFiltro>('todas')

  async function load(nextPeriodo = periodo) {
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/empleado/quincena?periodo=${nextPeriodo}`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) throw new Error(json?.error || 'No se pudo cargar la quincena.')

      setData(json)
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar la quincena.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(periodo)
  }, [periodo])

  const comisiones = useMemo(() => {
    const detalle = Array.isArray(data?.detalle) ? data!.detalle! : []
    const pagos = Array.isArray(data?.pagos) ? data!.pagos! : []
    const map = new Map<string, ComisionVista>()

    ;[...detalle, ...pagos].forEach((row, i) => {
      if (esExcluido(row)) return
      const item = normalizarComision(row, i)
      if (!map.has(item.id)) map.set(item.id, item)
    })

    return [...map.values()].sort((a, b) => {
      if (a.pagado !== b.pagado) return a.pagado ? 1 : -1
      return String(b.fecha).localeCompare(String(a.fecha))
    })
  }, [data])

  const pendientes = useMemo(
    () => comisiones.filter((c) => !c.pagado && esPendiente(c.raw)),
    [comisiones]
  )

  const liquidadas = useMemo(() => comisiones.filter((c) => c.pagado), [comisiones])

  const res = useMemo(() => {
    const sum = (items: ComisionVista[], key: keyof ComisionVista) =>
      r2(items.reduce((acc, item) => acc + num(item[key] as any), 0))

    return {
      pendienteProfesionalUsd: sum(pendientes, 'netoUsd'),
      pendienteProfesionalBs: sum(pendientes, 'netoBs'),
      pagadoProfesionalUsd: sum(liquidadas, 'netoUsd'),
      pagadoProfesionalBs: sum(liquidadas, 'netoBs'),
      deduccionesUsd: sum(comisiones, 'descuentoUsd'),
      deduccionesBs: sum(comisiones, 'descuentoBs'),
    }
  }, [comisiones, pendientes, liquidadas])

  const resumen = data?.resumen || null

  const deudaUsd = r2(
    num(
      resumen?.saldo_pendiente_neto_usd ??
        resumen?.total_pendiente_usd ??
        0
    )
  )

  const comisionesFiltradas = useMemo(
    () =>
      comisiones.filter((c) => {
        if (estadoFiltro === 'pendiente' && !esPendiente(c.raw)) return false
        if (estadoFiltro === 'liquidada' && !c.pagado) return false
        if (monedaFiltro !== 'todas' && c.moneda !== monedaFiltro) return false
        return true
      }),
    [comisiones, estadoFiltro, monedaFiltro]
  )

  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-3 pb-5 sm:space-y-4 lg:max-w-[980px] xl:max-w-[1080px]">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="rpm-label truncate">{data?.empleado?.nombre || 'Empleado'}</p>

          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl lg:text-[1.9rem]">
            Mi quincena
          </h1>

          {data?.periodo && (
            <p className="rpm-muted mt-1 text-xs font-semibold">
              {data.periodo.label} · {data.periodo.start} — {data.periodo.end}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="glass-card flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-bold transition disabled:opacity-40"
          style={{ color: 'var(--accent)' }}
        >
          <RotateCcw className={cx('h-3.5 w-3.5', loading && 'animate-spin')} />
          Actualizar
        </button>
      </header>

      <section className="glass-card flex cursor-pointer items-center gap-2.5 rounded-[1.15rem] px-4 py-3">
        <CalendarRange className="h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />

        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as PeriodoKey)}
          className="w-full cursor-pointer bg-transparent text-sm font-bold outline-none"
          style={{ color: 'var(--text)' }}
        >
          <option value="actual">Quincena actual</option>
          <option value="anterior">Quincena pasada</option>
        </select>
      </section>

      {error && (
        <div
          className="rounded-2xl px-4 py-2.5 text-xs font-bold"
          style={{
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.2)',
            color: 'var(--red)',
          }}
        >
          {error}
        </div>
      )}

      <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Deuda"
          value={money(deudaUsd)}
          color={deudaUsd > 0 ? 'var(--red)' : undefined}
        />

        <StatCard
          label="Deducciones"
          value={money(res.deduccionesUsd)}
          sub={bs(res.deduccionesBs)}
          color="#d97706"
        />

        <StatCard
          label="Pendiente empleado"
          value={money(res.pendienteProfesionalUsd)}
          sub={bs(res.pendienteProfesionalBs)}
          color={
            res.pendienteProfesionalUsd > 0 || res.pendienteProfesionalBs > 0
              ? '#d97706'
              : undefined
          }
        />

        <StatCard
          label="Pagado"
          value={money(res.pagadoProfesionalUsd)}
          sub={bs(res.pagadoProfesionalBs)}
          color="var(--green)"
        />

        <StatCard
          label="Registro"
          value={String(comisiones.length)}
          sub={`${pendientes.length} pendiente(s) · ${liquidadas.length} liquidada(s)`}
        />
      </section>

      <section className="glass-card overflow-hidden rounded-[1.25rem]">
        <div
          className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <button
            type="button"
            onClick={() => setShowDebug((v) => !v)}
            className="flex min-w-0 items-center justify-between gap-3 text-left"
          >
            <div>
              <h2 className="text-sm font-black">Comisiones</h2>

              <p className="rpm-muted mt-0.5 text-[11px] font-semibold">
                {comisionesFiltradas.length} de {comisiones.length} registro(s)
              </p>
            </div>

            <ChevronDown
              className={cx('h-4 w-4 shrink-0 transition sm:hidden', showDebug && 'rotate-180')}
              style={{ color: 'var(--text-sub)' }}
            />
          </button>

          <div className="flex gap-2">
            <NativeSelect
              value={estadoFiltro}
              onChange={(v) => setEstadoFiltro(v as EstadoFiltro)}
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'pendiente', label: 'Pendientes' },
                { value: 'liquidada', label: 'Liquidadas' },
              ]}
            />

            <NativeSelect
              value={monedaFiltro}
              onChange={(v) => setMonedaFiltro(v as MonedaFiltro)}
              options={[
                { value: 'todas', label: 'Todas' },
                { value: 'USD', label: 'USD' },
                { value: 'BS', label: 'Bs' },
              ]}
            />
          </div>
        </div>

        {loading ? (
          <p className="p-4 text-sm font-semibold rpm-muted">Cargando quincena...</p>
        ) : comisionesFiltradas.length === 0 ? (
          <div className="p-4">
            <p className="text-sm font-black">Sin registros con estos filtros.</p>

            <p className="rpm-muted mt-1 text-xs">
              La API debe enviar datos desde comisiones_detalle o pagos_empleados_detalle.
            </p>
          </div>
        ) : (
          <div>
            {comisionesFiltradas.map((item, idx) => {
              const netoAmt = item.moneda === 'USD' ? item.netoUsd : item.netoBs

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_auto] items-start gap-4 px-4 py-3.5"
                  style={idx > 0 ? { borderTop: '1px solid var(--border)' } : {}}
                >
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <Pill label={item.tipo} style={tipoBadgeStyle(item.tipo)} />

                      <Pill
                        label={estadoLabel(item)}
                        style={estadoBadgeStyle(item)}
                      />

                      <Pill
                        label={item.moneda === 'USD' ? 'USD' : 'Bs'}
                        style={{
                          background: 'var(--surface2)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-sub)',
                        }}
                      />
                    </div>

                    <p className="truncate text-sm font-black">{item.concepto}</p>

                    <p className="rpm-muted mt-0.5 text-[11px] font-semibold">
                      {item.subtitulo}
                    </p>

                    {(item.descuentoUsd > 0 || item.descuentoBs > 0) && (
                      <p className="mt-0.5 text-[10px] font-bold" style={{ color: 'var(--red)' }}>
                        Desc. deuda:{' '}
                        {item.moneda === 'USD' ? money(item.descuentoUsd) : bs(item.descuentoBs)}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className="text-lg font-black tabular-nums"
                      style={{ color: item.pagado ? 'var(--green)' : '#d97706' }}
                    >
                      {monto(netoAmt, item.moneda)}
                    </p>

                    <p className="rpm-muted mt-1 text-[10px] font-semibold tabular-nums">
                      Neto profesional
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {showDebug && (
        <section className="glass-card rounded-[1.25rem] p-4">
          <h3 className="text-sm font-black">Diagnóstico</h3>

          <p className="rpm-muted mt-0.5 text-xs">
            Revisar nombres de columnas cuando algo no cuadre.
          </p>

          <pre
            className="mt-3 max-h-[220px] overflow-auto rounded-xl p-3 text-[11px]"
            style={{
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              color: 'var(--text-sub)',
            }}
          >
            {JSON.stringify(
              {
                debug: data?.debug || {},
                primer_registro: comisiones[0]?.raw || null,
              },
              null,
              2
            )}
          </pre>
        </section>
      )}
    </div>
  )
}