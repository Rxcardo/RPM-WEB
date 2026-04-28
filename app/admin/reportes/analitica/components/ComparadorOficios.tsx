'use client'

import { useMemo, useState } from 'react'
import type { FacturacionPorOficio } from '../types'

interface Props { data: FacturacionPorOficio[] }
type MetricKey = 'total_usd' | 'usuarios_activos' | 'planes_activos' | 'agenda_total'

function num(n: unknown) { const p = Number(n); return Number.isFinite(p) ? p : 0 }
function moneyUsd(n: number) { return `$${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
function valueLabel(key: MetricKey, value: number) { return key === 'total_usd' ? moneyUsd(value) : value.toLocaleString('es-VE') }
function safePercent(value: number, max: number) { if (max <= 0 || value <= 0) return 0; return Math.max(5, Math.min(100, (value / max) * 100)) }

export default function ComparadorOficios({ data }: Props) {
  const empleados = useMemo(() => data || [], [data])
  const [a, setA] = useState(empleados[0]?.empleado_id ?? '')
  const [b, setB] = useState(empleados.find((x) => x.empleado_id !== empleados[0]?.empleado_id)?.empleado_id ?? '')
  const empA = empleados.find((x) => x.empleado_id === a) ?? null
  const empB = empleados.find((x) => x.empleado_id === b) ?? null
  const metrics = useMemo(() => [
    { key: 'total_usd' as MetricKey, label: 'Facturación USD', a: num(empA?.total_usd), b: num(empB?.total_usd) },
    { key: 'usuarios_activos' as MetricKey, label: 'Clientes activos', a: num(empA?.usuarios_activos), b: num(empB?.usuarios_activos) },
    { key: 'planes_activos' as MetricKey, label: 'Planes activos', a: num(empA?.planes_activos), b: num(empB?.planes_activos) },
    { key: 'agenda_total' as MetricKey, label: 'Agenda / citas', a: num(empA?.agenda_total), b: num(empB?.agenda_total) },
  ], [empA, empB])
  const scoreA = metrics.reduce((s, m) => s + (m.a > m.b ? 1 : 0), 0)
  const scoreB = metrics.reduce((s, m) => s + (m.b > m.a ? 1 : 0), 0)
  function changeA(next: string) { setA(next); if (next === b) setB(empleados.find((x) => x.empleado_id !== next)?.empleado_id ?? '') }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/[0.06] px-5 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Comparar fisios</p>
        <p className="mt-0.5 text-xs text-white/40">Duelo visual entre dos empleados</p>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-2">
          <select value={a} onChange={(e) => changeA(e.target.value)}
            className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2 text-xs font-semibold text-emerald-300 outline-none">
            {empleados.map((e) => <option key={e.empleado_id} value={e.empleado_id} className="bg-[#0b0b12] text-white">{e.empleado_nombre}</option>)}
          </select>
          <select value={b} onChange={(e) => setB(e.target.value)}
            className="rounded-xl border border-sky-400/20 bg-sky-400/[0.06] px-3 py-2 text-xs font-semibold text-sky-300 outline-none">
            {empleados.filter((e) => e.empleado_id !== a).map((e) => <option key={e.empleado_id} value={e.empleado_id} className="bg-[#0b0b12] text-white">{e.empleado_nombre}</option>)}
          </select>
        </div>
        {!empA || !empB ? (
          <p className="py-8 text-center text-sm text-white/25">Necesitas al menos dos fisios</p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3">
              <div>
                <p className="truncate text-sm font-black text-emerald-300">{empA.empleado_nombre}</p>
                <p className="text-[10px] text-white/35">{scoreA} métricas</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">VS</p>
                <p className="text-xl font-black text-white">{scoreA}–{scoreB}</p>
              </div>
              <div className="text-right">
                <p className="truncate text-sm font-black text-sky-300">{empB.empleado_nombre}</p>
                <p className="text-[10px] text-white/35">{scoreB} métricas</p>
              </div>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {metrics.map((m) => {
                const max = Math.max(m.a, m.b, 1)
                const aWins = m.a > m.b; const bWins = m.b > m.a
                return (
                  <div key={m.key} className="py-3">
                    <div className="mb-2 flex items-center justify-between text-[10px] text-white/40">
                      <span className="font-semibold">{m.label}</span>
                      <span>{valueLabel(m.key, m.a)} · {valueLabel(m.key, m.b)}</span>
                    </div>
                    <div className="grid grid-cols-[1fr_20px_1fr] items-center gap-2">
                      <div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${safePercent(m.a, max)}%` }} />
                        </div>
                        {aWins && <p className="mt-0.5 text-[9px] font-bold text-emerald-400">Gana ▲</p>}
                      </div>
                      <div />
                      <div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                          <div className="ml-auto h-full rounded-full bg-sky-400" style={{ width: `${safePercent(m.b, max)}%` }} />
                        </div>
                        {bWins && <p className="mt-0.5 text-right text-[9px] font-bold text-sky-400">▲ Gana</p>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}