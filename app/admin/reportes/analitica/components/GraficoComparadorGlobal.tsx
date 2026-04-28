'use client'

import { useMemo, useState } from 'react'
import type { BreakdownItem, ResumenGrupo } from '../types'

type Modo = 'resumen' | 'unitario'
interface Props { grupos: ResumenGrupo[]; comparativa: BreakdownItem[] }
function money(n: number) { return `$${n.toLocaleString('es-VE', { maximumFractionDigits: 0 })}` }

export default function GraficoComparadorGlobal({ grupos, comparativa }: Props) {
  const [modo, setModo] = useState<Modo>('resumen')
  const rows = useMemo(() => {
    if (modo === 'resumen') {
      return grupos.map((g) => ({ id: g.tipo, nombre: g.nombre, tipo: g.tipo, cantidad: g.cantidad, total_usd: g.total_usd, total_bs: g.total_bs }))
    }
    return comparativa
  }, [modo, grupos, comparativa])
  const max = Math.max(...rows.map((r) => r.total_usd), ...rows.map((r) => r.cantidad), 1)

  return (
    <div className="rounded-3xl border border-white/[0.07] bg-white/[0.045] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white/85">Comparar Planes vs Agenda</h2>
          <p className="mt-1 text-xs text-white/35">Vista global o unitario todo junto</p>
        </div>
        <div className="flex rounded-full bg-black/20 p-1">
          <button onClick={() => setModo('resumen')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${modo === 'resumen' ? 'bg-emerald-500/25 text-emerald-100' : 'text-white/38'}`}>Global</button>
          <button onClick={() => setModo('unitario')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${modo === 'unitario' ? 'bg-emerald-500/25 text-emerald-100' : 'text-white/38'}`}>Unitario</button>
        </div>
      </div>
      <div className="space-y-3">
        {rows.length === 0 ? <p className="py-10 text-center text-sm text-white/25">Sin datos para comparar</p> : rows.map((r) => (
          <div key={`${r.tipo}-${r.id}`} className="rounded-2xl border border-white/[0.05] bg-black/10 p-3">
            <div className="mb-2 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white/75">{r.tipo === 'plan' ? '📦' : '📅'} {r.nombre}</p>
                <p className="text-xs text-white/32">{r.cantidad} registros · Bs. {Math.round(r.total_bs).toLocaleString('es-VE')}</p>
              </div>
              <p className="shrink-0 text-sm font-black text-white/80">{money(r.total_usd)}</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
              <div className={r.tipo === 'plan' ? 'h-full rounded-full bg-emerald-400/70' : 'h-full rounded-full bg-cyan-300/70'} style={{ width: `${Math.max(3, (Math.max(r.total_usd, r.cantidad) / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
