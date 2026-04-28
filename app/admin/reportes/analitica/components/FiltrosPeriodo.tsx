'use client'

import { useState } from 'react'
import type { FiltroPeriodo, PeriodoTipo } from '../types'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const ANIOS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)

interface Props { filtroActual: FiltroPeriodo; onChange: (filtro: FiltroPeriodo) => void }

export default function FiltrosPeriodo({ filtroActual, onChange }: Props) {
  const hoy = new Date()
  const defaultInicio = `${filtroActual.anio}-${String(filtroActual.mes).padStart(2, '0')}-01`
  const lastDay = new Date(filtroActual.anio, filtroActual.mes, 0).getDate()
  const defaultFin = `${filtroActual.anio}-${String(filtroActual.mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const [desde, setDesde] = useState(filtroActual.fechaInicio || defaultInicio)
  const [hasta, setHasta] = useState(filtroActual.fechaFin || defaultFin)

  function changeTipo(tipo: PeriodoTipo) {
    if (tipo === 'personalizado') { onChange({ ...filtroActual, tipo, fechaInicio: desde, fechaFin: hasta }); return }
    onChange({ ...filtroActual, tipo, fechaInicio: undefined, fechaFin: undefined })
  }

  const selectCls = "rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-white/80 outline-none focus:border-white/20"

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
        {(['mensual', 'anual', 'personalizado'] as PeriodoTipo[]).map((tipo) => (
          <button key={tipo} type="button" onClick={() => changeTipo(tipo)}
            className={['rounded-[10px] px-3 py-1.5 text-xs font-bold transition',
              filtroActual.tipo === tipo ? 'bg-emerald-500/20 text-emerald-200' : 'text-white/45 hover:text-white/75'].join(' ')}>
            {tipo === 'mensual' ? 'Mensual' : tipo === 'anual' ? 'Anual' : 'Custom'}
          </button>
        ))}
      </div>

      {filtroActual.tipo === 'mensual' && (
        <>
          <select value={filtroActual.mes || hoy.getMonth() + 1} onChange={(e) => onChange({ ...filtroActual, mes: Number(e.target.value) })} className={selectCls}>
            {MESES.map((m, i) => <option key={m} value={i + 1} className="bg-[#0b0b12]">{m}</option>)}
          </select>
          <select value={filtroActual.anio || hoy.getFullYear()} onChange={(e) => onChange({ ...filtroActual, anio: Number(e.target.value) })} className={selectCls}>
            {ANIOS.map((a) => <option key={a} value={a} className="bg-[#0b0b12]">{a}</option>)}
          </select>
        </>
      )}

      {filtroActual.tipo === 'anual' && (
        <select value={filtroActual.anio || hoy.getFullYear()} onChange={(e) => onChange({ ...filtroActual, anio: Number(e.target.value) })} className={selectCls}>
          {ANIOS.map((a) => <option key={a} value={a} className="bg-[#0b0b12]">{a}</option>)}
        </select>
      )}

      {filtroActual.tipo === 'personalizado' && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white/80 outline-none" />
          <span className="text-white/20 text-xs">→</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-white/80 outline-none" />
          <button type="button" onClick={() => onChange({ ...filtroActual, tipo: 'personalizado', fechaInicio: desde, fechaFin: hasta })}
            className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300 hover:bg-emerald-400/15">
            Aplicar
          </button>
        </div>
      )}
    </div>
  )
}