'use client'

import type { BreakdownItem } from '../types'
interface Props { data: BreakdownItem[] }
function money(n: number) { return `$${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

export default function GraficoPlanes({ data }: Props) {
  const max = Math.max(...data.map((d) => Number(d.total_usd || 0)), 1)
  const totalUsd = data.reduce((s, d) => s + Number(d.total_usd || 0), 0)
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Planes</p>
          <p className="mt-0.5 text-xl font-black text-white">{money(totalUsd)}</p>
        </div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">{data.length} tipos</span>
      </div>
      {data.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-white/25">Sin planes en este período</div>
      ) : (
        <div className="divide-y divide-white/[0.05]">
          {data.map((item, index) => {
            const total = Number(item.total_usd || 0)
            const cantidad = Number(item.cantidad || 0)
            const pct = Math.max(4, (total / max) * 100)
            return (
              <div key={item.id} className="flex items-center gap-4 px-5 py-3 transition hover:bg-white/[0.03]">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-white/40">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white/85">📦 {item.nombre}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-white">{money(total)}</p>
                  <p className="text-[10px] text-white/40">{cantidad} ventas</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}