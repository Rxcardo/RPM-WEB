'use client'

import type { FacturacionPorOficio } from '../types'
interface Props { data: FacturacionPorOficio[]; seleccionado: FacturacionPorOficio | null; onSeleccionar: (emp: FacturacionPorOficio) => void }
function money(n: number) { return `$${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

const AVATAR_COLORS = [
  'bg-emerald-500/20 text-emerald-300',
  'bg-sky-500/20 text-sky-300',
  'bg-violet-500/20 text-violet-300',
  'bg-amber-500/20 text-amber-300',
  'bg-rose-500/20 text-rose-300',
]

export default function TablaOficios({ data, seleccionado, onSeleccionar }: Props) {
  const maxUsd = Math.max(...data.map((d) => d.total_usd), 1)
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Rendimiento por oficio</p>
          <p className="mt-0.5 text-xs text-white/40">Clic en un empleado para ver detalle</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-bold text-white/50">{data.length} fisios</span>
      </div>
      {data.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-white/25">Sin empleados con datos</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.05] text-left text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
                <th className="px-5 py-3 w-8">#</th>
                <th className="px-5 py-3">Empleado</th>
                <th className="px-5 py-3">Facturación</th>
                <th className="px-4 py-3 text-center">Clientes</th>
                <th className="px-4 py-3 text-center">Planes</th>
                <th className="px-4 py-3 text-center">Agenda</th>
                <th className="px-4 py-3 w-6" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {data.map((emp, idx) => {
                const selected = seleccionado?.empleado_id === emp.empleado_id
                const av = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                const barPct = Math.max(2, (emp.total_usd / maxUsd) * 100)
                return (
                  <tr key={emp.empleado_id} onClick={() => onSeleccionar(emp)}
                    className={`cursor-pointer transition ${selected ? 'bg-emerald-500/[0.08]' : 'hover:bg-white/[0.03]'}`}>
                    <td className="px-5 py-4">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-[10px] font-bold text-white/40">{idx + 1}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${av}`}>
                          {emp.empleado_nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white/90">{emp.empleado_nombre}</p>
                          <p className="text-[11px] text-white/40">{emp.rol}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-white">{money(emp.total_usd)}</p>
                      <div className="mt-1.5 h-1 w-28 overflow-hidden rounded-full bg-white/[0.07]">
                        <div className="h-full rounded-full bg-emerald-400" style={{ width: `${barPct}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center text-white/70">{emp.usuarios_activos}</td>
                    <td className="px-4 py-4 text-center text-white/70">{emp.planes_activos}</td>
                    <td className="px-4 py-4 text-center text-white/70">{emp.agenda_total}</td>
                    <td className="px-4 py-4 text-right text-white/25 text-xs">{selected ? '▾' : '▸'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}