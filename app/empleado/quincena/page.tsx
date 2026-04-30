'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, ChevronDown, RefreshCcw, WalletCards } from 'lucide-react'

type PeriodoKey = 'actual' | 'anterior'

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

function money(n: number | string | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(n || 0))
}

function pick(row: any, keys: string[]) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return row[key]
  }
  return null
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function itemTitle(row: any) {
  return pick(row, ['concepto', 'descripcion', 'detalle', 'referencia', 'cliente_nombre', 'nombre']) || 'Movimiento'
}

function itemDate(row: any) {
  return String(pick(row, ['fecha', 'fecha_pago', 'created_at', 'periodo_inicio']) || '').slice(0, 10) || '—'
}

function itemAmount(row: any) {
  return Number(pick(row, ['monto_comision_usd', 'comision_usd', 'monto_pagado_usd', 'monto_usd', 'total_usd', 'monto', 'saldo_usd']) || 0)
}

export default function EmpleadoQuincenaPage() {
  const [periodo, setPeriodo] = useState<PeriodoKey>('actual')
  const [data, setData] = useState<ApiData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showDebug, setShowDebug] = useState(false)

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo])

  const resumen = data?.resumen || null
  const movimientos = useMemo(() => {
    const detalle = Array.isArray(data?.detalle) ? data!.detalle! : []
    const pagos = Array.isArray(data?.pagos) ? data!.pagos! : []
    return [...detalle, ...pagos].slice(0, 30)
  }, [data])

  const neto = Number(resumen?.saldo_pendiente_neto_usd || resumen?.total_pendiente_usd || 0)

  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-3 pb-5 sm:space-y-4 lg:max-w-[980px] xl:max-w-[1080px]">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="rpm-muted truncate text-[11px] font-black uppercase tracking-[0.18em]">{data?.empleado?.nombre || 'Empleado'}</p>
          <h1 className="mt-0.5 text-2xl font-black tracking-tight sm:text-3xl lg:text-[2rem]">Mi quincena</h1>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="flex shrink-0 items-center gap-2 rounded-2xl border border-[var(--line)] bg-white/10 px-3 py-2 text-xs font-black text-[var(--text)] transition hover:bg-white/20 disabled:opacity-50"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Actualizar
        </button>
      </header>

      <section className="grid gap-2 lg:grid-cols-[1fr_310px]">
        <div className="purple-card rounded-[1.35rem] p-3.5 text-white sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/15">
                <WalletCards className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">Pendiente neto</p>
                <h2 className="mt-0.5 text-2xl font-black leading-none sm:text-3xl">{money(neto)}</h2>
              </div>
            </div>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-black text-white/80">{data?.periodo?.label || 'Quincena'}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/55">{data?.periodo?.start || '—'} / {data?.periodo?.end || '—'}</p>
            </div>
          </div>
        </div>

        <label className="glass-card flex items-center gap-2 rounded-[1.15rem] px-3 py-2.5">
          <CalendarRange className="h-4 w-4 text-[var(--muted)]" />
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value as PeriodoKey)}
            className="w-full bg-transparent text-sm font-black outline-none"
          >
            <option value="actual">Quincena actual</option>
            <option value="anterior">Quincena pasada</option>
          </select>
        </label>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <div className="glass-card rounded-[1.15rem] p-3">
          <p className="rpm-muted text-[10px] font-black uppercase tracking-wide">Facturado</p>
          <p className="mt-1 text-lg font-black">{money(resumen?.total_facturado_usd)}</p>
        </div>
        <div className="glass-card rounded-[1.15rem] p-3">
          <p className="rpm-muted text-[10px] font-black uppercase tracking-wide">Pagado</p>
          <p className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-300">{money(resumen?.total_pagado_usd)}</p>
        </div>
        <div className="glass-card rounded-[1.15rem] p-3">
          <p className="rpm-muted text-[10px] font-black uppercase tracking-wide">Pendiente</p>
          <p className="mt-1 text-lg font-black text-rose-600 dark:text-rose-300">{money(resumen?.total_pendiente_usd)}</p>
        </div>
        <div className="glass-card rounded-[1.15rem] p-3">
          <p className="rpm-muted text-[10px] font-black uppercase tracking-wide">Crédito</p>
          <p className="mt-1 text-lg font-black">{money(resumen?.credito_disponible_usd)}</p>
        </div>
        <div className="glass-card rounded-[1.15rem] p-3 col-span-2 lg:col-span-1">
          <p className="rpm-muted text-[10px] font-black uppercase tracking-wide">Fuente</p>
          <p className="mt-1 truncate text-xs font-black">{data?.fuente === 'detalle_periodo' ? 'Detalle del periodo' : 'Estado global'}</p>
        </div>
      </section>

      <section className="glass-card overflow-hidden rounded-[1.25rem]">
        <button
          type="button"
          onClick={() => setShowDebug((v) => !v)}
          className="flex w-full items-center justify-between gap-3 border-b border-[var(--line)] px-3 py-3 text-left"
        >
          <div>
            <h2 className="text-sm font-black">Movimientos detectados</h2>
            <p className="rpm-muted mt-0.5 text-[11px] font-semibold">
              {movimientos.length} registros en este periodo. Si aparece 0 y sabes que hay comisión, revisa nombres de columnas de pagos_empleados_detalle.
            </p>
          </div>
          <ChevronDown className={cx('h-4 w-4 shrink-0 transition', showDebug && 'rotate-180')} />
        </button>

        {loading ? (
          <p className="p-4 text-sm font-semibold rpm-muted">Cargando quincena...</p>
        ) : movimientos.length === 0 ? (
          <div className="p-4">
            <p className="text-sm font-black">No hay movimientos por fecha en esta quincena.</p>
            <p className="rpm-muted mt-1 text-xs">
              Arriba igual se muestra el estado global si existe en tus vistas. Para quincenas exactas, la tabla de detalle debe tener fecha/periodo y monto de comisión.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--line)]">
            {movimientos.map((row, index) => (
              <div key={row?.id || index} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{itemTitle(row)}</p>
                  <p className="rpm-muted mt-0.5 text-[11px] font-semibold">{itemDate(row)} · {row?.estado || row?.tipo || 'registro'}</p>
                </div>
                <p className="text-sm font-black">{money(itemAmount(row))}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {showDebug ? (
        <section className="glass-card rounded-[1.25rem] p-3">
          <h3 className="text-sm font-black">Diagnóstico rápido</h3>
          <pre className="mt-2 max-h-[220px] overflow-auto rounded-2xl border border-[var(--line)] bg-black/10 p-3 text-[11px] rpm-muted">
            {JSON.stringify(data?.debug || {}, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  )
}
