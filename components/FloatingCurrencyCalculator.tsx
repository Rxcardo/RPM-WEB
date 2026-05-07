'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Calculator, GripHorizontal, RefreshCw, X } from 'lucide-react'
import { useTasasBCV } from '@/lib/finanzas/useTasasBCV'

type Currency = 'USD' | 'EUR' | 'BS'
type Pair = `${Currency}-${Currency}`

type Position = { x: number; y: number }

const STORAGE_POS = 'rpm_floating_currency_calculator_pos_v1'
const STORAGE_OPEN = 'rpm_floating_currency_calculator_open_v1'

const pairs: Array<{ value: Pair; label: string }> = [
  { value: 'USD-BS', label: 'USD → Bs' },
  { value: 'BS-USD', label: 'Bs → USD' },
  { value: 'EUR-BS', label: 'EUR → Bs' },
  { value: 'BS-EUR', label: 'Bs → EUR' },
  { value: 'USD-EUR', label: 'USD → EUR' },
  { value: 'EUR-USD', label: 'EUR → USD' },
]

function r2(value: number) {
  return Math.round(Number(value || 0) * 100) / 100
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function safeNumber(value: string) {
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function currencyLabel(currency: Currency) {
  if (currency === 'BS') return 'Bs'
  return currency
}

function formatAmount(value: number, currency: Currency) {
  const locale = currency === 'BS' ? 'es-VE' : 'en-US'
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: currency === 'BS' ? 2 : 2,
  }).format(Number(value || 0))
}

function clampPosition(pos: Position, isOpen: boolean): Position {
  if (typeof window === 'undefined') return pos

  const width = isOpen ? 320 : 58
  const height = isOpen ? 350 : 58
  const margin = 10

  return {
    x: Math.min(Math.max(pos.x, margin), Math.max(margin, window.innerWidth - width - margin)),
    y: Math.min(Math.max(pos.y, margin), Math.max(margin, window.innerHeight - height - margin)),
  }
}

function initialPosition(): Position {
  if (typeof window === 'undefined') return { x: 24, y: 120 }

  try {
    const raw = window.localStorage.getItem(STORAGE_POS)
    if (raw) return clampPosition(JSON.parse(raw), true)
  } catch {}

  return {
    x: Math.max(12, window.innerWidth - 340),
    y: Math.max(88, window.innerHeight - 430),
  }
}

export default function FloatingCurrencyCalculator() {
  const [open, setOpen] = useState(true)
  const [position, setPosition] = useState<Position>({ x: 24, y: 120 })
  const [pair, setPair] = useState<Pair>('USD-BS')
  const [amount, setAmount] = useState('')
  const [fecha] = useState(todayISO())

  const dragRef = useRef({ dragging: false, dx: 0, dy: 0 })
  const { usd, eur, loading, error, updatedAt, refresh } = useTasasBCV(fecha)

  useEffect(() => {
    setPosition(initialPosition())
    try {
      const savedOpen = window.localStorage.getItem(STORAGE_OPEN)
      if (savedOpen !== null) setOpen(savedOpen === '1')
    } catch {}
  }, [])

  useEffect(() => {
    const next = clampPosition(position, open)
    setPosition(next)
    try {
      window.localStorage.setItem(STORAGE_POS, JSON.stringify(next))
      window.localStorage.setItem(STORAGE_OPEN, open ? '1' : '0')
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    function onResize() {
      setPosition((prev) => clampPosition(prev, open))
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open])

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!dragRef.current.dragging) return
      const next = clampPosition({ x: e.clientX - dragRef.current.dx, y: e.clientY - dragRef.current.dy }, open)
      setPosition(next)
    }

    function onPointerUp() {
      if (!dragRef.current.dragging) return
      dragRef.current.dragging = false
      try {
        window.localStorage.setItem(STORAGE_POS, JSON.stringify(position))
      } catch {}
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [open, position])

  function startDrag(e: React.PointerEvent) {
    const target = e.target as HTMLElement
    if (target.closest('button, input, select')) return

    dragRef.current = {
      dragging: true,
      dx: e.clientX - position.x,
      dy: e.clientY - position.y,
    }
  }

  const [from, to] = pair.split('-') as [Currency, Currency]

  const result = useMemo(() => {
    const value = safeNumber(amount)
    if (value <= 0) return 0
    if (!usd || !eur) return 0

    if (pair === 'USD-BS') return r2(value * usd)
    if (pair === 'BS-USD') return r2(value / usd)
    if (pair === 'EUR-BS') return r2(value * eur)
    if (pair === 'BS-EUR') return r2(value / eur)
    if (pair === 'USD-EUR') return r2((value * usd) / eur)
    if (pair === 'EUR-USD') return r2((value * eur) / usd)

    return 0
  }, [amount, eur, pair, usd])

  const crossRate = useMemo(() => {
    if (!usd || !eur) return null
    return r2(eur / usd)
  }, [eur, usd])

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ left: position.x, top: position.y }}
        className="fixed z-[9999] flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-[#151620]/95 text-white shadow-2xl backdrop-blur-xl transition hover:bg-[#1b1d2a]"
        aria-label="Abrir calculadora de monedas"
      >
        <Calculator className="h-5 w-5 text-orange-300" />
      </button>
    )
  }

  return (
    <section
      style={{ left: position.x, top: position.y }}
      className="fixed z-[9999] w-[min(320px,calc(100vw-20px))] overflow-hidden rounded-[26px] border border-white/12 bg-[#12131c]/95 text-white shadow-2xl backdrop-blur-xl"
    >
      <div
        onPointerDown={startDrag}
        className="flex cursor-grab items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-3 py-2 active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-orange-400/15 text-orange-300">
            <Calculator className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Calculadora</p>
            <p className="mt-1 text-[10px] text-white/40">BCV automático</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <GripHorizontal className="h-4 w-4 text-white/30" />
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-xl p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
            title="Actualizar tasas"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-xl p-2 text-white/45 transition hover:bg-white/10 hover:text-white"
            title="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-2">
            <p className="text-[10px] uppercase tracking-wide text-white/35">USD BCV</p>
            <p className="mt-1 text-sm font-bold text-emerald-300">{usd ? `Bs ${usd.toFixed(4)}` : '—'}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-2">
            <p className="text-[10px] uppercase tracking-wide text-white/35">EUR BCV</p>
            <p className="mt-1 text-sm font-bold text-emerald-300">{eur ? `Bs ${eur.toFixed(4)}` : '—'}</p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/55">Conversión</label>
          <select
            value={pair}
            onChange={(e) => setPair(e.target.value as Pair)}
            className="h-10 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition focus:border-orange-300/40"
          >
            {pairs.map((p) => (
              <option key={p.value} value={p.value} className="bg-[#11131a]">
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder={`Monto en ${currencyLabel(from)}`}
            className="h-11 min-w-0 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-300/40"
          />
          <div className="flex h-11 min-w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-3 text-sm font-semibold text-white/70">
            {currencyLabel(from)}
          </div>
        </div>

        <div className="rounded-3xl border border-orange-300/20 bg-orange-300/10 p-3">
          <p className="text-[10px] uppercase tracking-wide text-orange-100/60">Resultado</p>
          <div className="mt-1 flex items-end justify-between gap-2">
            <p className="break-all text-2xl font-black tracking-tight text-orange-200">
              {loading ? '...' : formatAmount(result, to)}
            </p>
            <span className="pb-1 text-sm font-bold text-orange-100/70">{currencyLabel(to)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-[10px] text-white/35">
          <span>{crossRate ? `1 EUR ≈ ${crossRate.toFixed(4)} USD` : 'Tasa cruzada no disponible'}</span>
          <span>{updatedAt ? new Date(updatedAt).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </div>
      </div>
    </section>
  )
}
