'use client'

import type { ResumenGrupo } from '../types'

interface Props { grupos: ResumenGrupo[] }
function money(n: number) { return `$${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

export default function GraficoComparativo({ grupos }: Props) {
  const max = Math.max(...grupos.map((g) => g.total_usd), 1)

  return (
    <div className="rounded-3xl border border-white/[0.07] bg-white/[0.045] p-6">
      <div className="mb-6">
        <h2 className="text-sm font-bold text-white/85">Comparativa principal</h2>
        <p className="mt-1 text-xs text-white/35">Planes vs Agenda / Citas</p>
      </div>
      <div className="space-y-4">
        {grupos.map((g) => (
          <div key={g.tipo} className="rounded-2xl border border-white/5 bg-black/10 p-4">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-white/80">{g.tipo === 'plan' ? '📦' : '📅'} {g.nombre}</p>
                <p className="text-xs text-white/35">{g.cantidad} ventas · {g.porcentaje.toFixed(1)}%</p>
              </div>
              <p className="text-right font-black text-white">{money(g.total_usd)}</p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/5">
              <div className="h-full rounded-full bg-emerald-500/65" style={{ width: `${Math.max(2, (g.total_usd / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
