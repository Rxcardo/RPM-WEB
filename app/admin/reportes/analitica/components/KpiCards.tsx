'use client'

import type { ResumenAnalitica } from '../types'

interface Props { resumen: ResumenAnalitica }

function money(n: number, prefix = '$') {
  return `${prefix}${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function KpiCards({ resumen }: Props) {
  const positive = resumen.variacion_pct >= 0

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <div className="col-span-2 xl:col-span-1 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Facturación USD</p>
        <p className="mt-2 text-3xl font-black leading-none text-white">{money(resumen.total_facturado_usd)}</p>
        <div className="mt-3 flex items-center gap-2">
          <span className={`inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] font-bold ${positive ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-rose-400/20 bg-rose-400/10 text-rose-300'}`}>
            {positive ? '▲' : '▼'} {Math.abs(resumen.variacion_pct).toFixed(1)}%
          </span>
          <span className="text-[11px] text-white/40">vs período anterior</span>
        </div>
      </div>

      <div className="col-span-2 xl:col-span-1 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Facturación Bs</p>
        <p className="mt-2 text-3xl font-black leading-none text-white truncate">{money(resumen.total_facturado_bs, 'Bs. ')}</p>
        <p className="mt-3 text-[11px] text-white/40">equivalente bolívares</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Clientes activos</p>
        <p className="mt-2 text-4xl font-black text-white">{resumen.total_clientes_activos}</p>
        <p className="mt-3 text-[11px] text-white/40">con plan activo</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Planes activos</p>
        <p className="mt-2 text-4xl font-black text-white">{resumen.total_planes_activos}</p>
        <p className="mt-3 text-[11px] text-white/40">planes de clientes</p>
      </div>
    </div>
  )
}