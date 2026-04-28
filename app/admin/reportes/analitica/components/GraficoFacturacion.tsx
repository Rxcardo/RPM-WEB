'use client'

import { useMemo, useRef, useState } from 'react'
import type { FacturacionMensual, FiltroPeriodo } from '../types'

interface Props { data: FacturacionMensual[]; filtro: FiltroPeriodo }
type MonedaView = 'usd' | 'bs'
type ChartType = 'barras' | 'area'

function moneyFull(n: number, prefix = '$') {
  return `${prefix}${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function num(v: unknown) { const p = Number(v); return Number.isFinite(p) ? p : 0 }

export default function GraficoFacturacion({ data, filtro }: Props) {
  const [moneda, setMoneda] = useState<MonedaView>('usd')
  const [chartType, setChartType] = useState<ChartType>('barras')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const rows = useMemo(() => (data || []).map((d) => ({
    ...d, total_usd: num(d.total_usd), total_bs: num(d.total_bs), total_pagos: num(d.total_pagos),
  })), [data])

  const vals = rows.map((r) => moneda === 'usd' ? r.total_usd : r.total_bs)
  const maxVal = Math.max(...vals, 1)
  const totalUsd = rows.reduce((s, d) => s + d.total_usd, 0)
  const totalBs = rows.reduce((s, d) => s + d.total_bs, 0)
  const totalPagos = rows.reduce((s, d) => s + d.total_pagos, 0)
  const selectedMonth = filtro.tipo === 'mensual' ? filtro.mes : null

  const CHART_H = 140
  const TOP_PAD = 12

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-white/[0.06] px-5 pt-5 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">
            {filtro.tipo === 'mensual' ? 'Mensual' : filtro.tipo === 'anual' ? 'Anual' : 'Período'}
          </p>
          <p className="mt-1 text-3xl font-black text-white">
            {moneda === 'usd' ? moneyFull(totalUsd) : moneyFull(totalBs, 'Bs. ')}
          </p>
          <p className="mt-1 text-xs text-white/40">{totalPagos} pagos registrados</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
            {(['usd', 'bs'] as MonedaView[]).map((m) => (
              <button key={m} onClick={() => setMoneda(m)}
                className={['rounded-[10px] px-4 py-1.5 text-xs font-bold transition',
                  moneda === m ? 'bg-emerald-500/20 text-emerald-200' : 'text-white/45 hover:text-white/75'].join(' ')}>
                {m === 'usd' ? 'USD' : 'Bs'}
              </button>
            ))}
          </div>
          <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
            {(['barras', 'area'] as ChartType[]).map((t) => (
              <button key={t} onClick={() => setChartType(t)}
                className={['rounded-[10px] px-3 py-1 text-[10px] font-bold transition',
                  chartType === t ? 'bg-white/10 text-white' : 'text-white/35 hover:text-white/60'].join(' ')}>
                {t === 'barras' ? '▐▌ Barras' : '∿ Área'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart — pure CSS grid so labels and bars share exact same columns */}
      <div className="px-4 pt-4 pb-0" onMouseLeave={() => setHoveredIdx(null)}>
        {rows.length === 0 ? (
          <div className="flex h-36 items-center justify-center text-sm text-white/25">Sin datos</div>
        ) : (
          <>
            {/* Grid container — N equal columns */}
            <div
              className="relative border-b border-white/[0.05]"
              style={{ display: 'grid', gridTemplateColumns: `repeat(${rows.length}, 1fr)`, height: CHART_H }}
            >
              {rows.map((r, i) => {
                const val = moneda === 'usd' ? r.total_usd : r.total_bs
                const pct = val > 0 ? Math.max(3, (val / maxVal) * 100) : 0
                const isHov = hoveredIdx === i
                const isSel = selectedMonth != null && (() => {
                  const mesNum = parseInt((r.mes || '').split('-')[1] || '0')
                  return mesNum === selectedMonth
                })()

                return (
                  <div
                    key={r.mes}
                    className="relative flex h-full items-end justify-center pb-0"
                    onMouseEnter={() => setHoveredIdx(i)}
                    style={{ cursor: 'default' }}
                  >
                    {/* hover highlight column */}
                    {isHov && (
                      <div className="absolute inset-0 bg-white/[0.03] rounded" />
                    )}

                    {chartType === 'barras' ? (
                      val > 0 ? (
                        <div
                          className="relative z-10 w-[60%] rounded-t-sm transition-all"
                          style={{
                            height: `${pct}%`,
                            background: isHov || isSel
                              ? '#34d399'
                              : 'rgba(52,211,153,0.55)',
                          }}
                        />
                      ) : (
                        <div className="relative z-10 mb-0.5 h-1 w-1 rounded-full bg-white/20" />
                      )
                    ) : (
                      /* Area: dot only, SVG overlay handles the line */
                      val > 0 ? (
                        <div
                          className="relative z-10 mb-0 rounded-full border-2 border-[#0b0b12] bg-emerald-400 transition-all"
                          style={{
                            width: isHov || isSel ? 10 : 6,
                            height: isHov || isSel ? 10 : 6,
                            marginBottom: `calc(${pct}% - ${isHov || isSel ? 5 : 3}px)`,
                          }}
                        />
                      ) : (
                        <div className="relative z-10 mb-0.5 h-1.5 w-1.5 rounded-full bg-white/15" />
                      )
                    )}

                    {/* Tooltip */}
                    {isHov && (
                      <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap rounded-xl border border-white/10 bg-[#0b0b12] px-3 py-2 text-xs shadow-xl">
                        <p className="font-bold text-white">{r.mes_label}</p>
                        <p className="text-emerald-400">{moneda === 'usd' ? moneyFull(val) : moneyFull(val, 'Bs. ')}</p>
                        <p className="text-white/40">{r.total_pagos} pagos</p>
                      </div>
                    )}
                  </div>
                )
              })}

              {/* SVG overlay for area line — rendered on top of dots */}
              {chartType === 'area' && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  preserveAspectRatio="none"
                  viewBox={`0 0 ${rows.length * 100} 100`}
                >
                  <defs>
                    <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#34d399" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>
                  {(() => {
                    const pts = rows.map((r, i) => {
                      const val = moneda === 'usd' ? r.total_usd : r.total_bs
                      const x = i * 100 + 50  // center of each 100-unit column
                      const y = val > 0 ? (1 - val / maxVal) * 100 : 100
                      return { x, y, hasValue: val > 0 }
                    })
                    const line = pts.reduce((acc, p, i) => {
                      if (!p.hasValue) return acc
                      const prev = pts[i - 1]?.hasValue ?? false
                      return acc + (prev ? `L${p.x},${p.y}` : `M${p.x},${p.y}`)
                    }, '')
                    const area = pts.reduce((acc, p, i) => {
                      if (!p.hasValue) return acc
                      const prev = pts[i - 1]?.hasValue ?? false
                      const next = pts[i + 1]?.hasValue ?? false
                      let s = acc
                      if (!prev) s += `M${p.x},100L${p.x},${p.y}`
                      else s += `L${p.x},${p.y}`
                      if (!next) s += `L${p.x},100Z`
                      return s
                    }, '')
                    return (
                      <>
                        <path d={area} fill="url(#areaG)" />
                        <path d={line} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                      </>
                    )
                  })()}
                </svg>
              )}
            </div>

            {/* X Labels — same grid, perfectly aligned */}
            <div
              className="pb-2 pt-1"
              style={{ display: 'grid', gridTemplateColumns: `repeat(${rows.length}, 1fr)` }}
            >
              {rows.map((r, i) => {
                const mesNum = parseInt((r.mes || '').split('-')[1] || '0')
                const isSel = selectedMonth === mesNum
                const isHov = hoveredIdx === i
                const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
                return (
                  <div key={r.mes} className="text-center">
                    <span className={`text-[10px] font-semibold transition ${isSel ? 'text-emerald-300 font-black' : isHov ? 'text-white/70' : 'text-white/30'}`}>
                      {MESES[mesNum - 1] ?? r.mes_label?.slice(0, 3)}
                    </span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-t border-white/[0.06]">
        {[
          { label: 'Total USD', value: moneyFull(totalUsd) },
          { label: 'Total Bs', value: moneyFull(totalBs, 'Bs. ') },
          { label: 'Pagos', value: String(totalPagos) },
        ].map((item) => (
          <div key={item.label} className="px-4 py-3 text-center">
            <p className="text-[10px] font-semibold uppercase text-white/35">{item.label}</p>
            <p className="mt-0.5 text-xs font-bold text-white/75">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}