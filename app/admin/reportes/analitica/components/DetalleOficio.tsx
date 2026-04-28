'use client'

import type { DetalleOficioItem, FacturacionPorOficio } from '../types'

interface Props { empleado: FacturacionPorOficio; onCerrar: () => void }
function money(n: number) { return `$${n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }

function Listado({ titulo, items, vacio }: { titulo: string; items: DetalleOficioItem[]; vacio: string }) {
  const max = Math.max(...items.map((i) => Math.max(i.total_usd, i.cantidad)), 1)
  return (
    <div className="rounded-2xl border border-white/5 bg-black/10 p-4">
      <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-white/38">{titulo}</h4>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/22">{vacio}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={`${item.tipo}-${item.id}`}>
              <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-white/68">{item.tipo === 'plan' ? '📦' : '📅'} {item.nombre}</span>
                <span className="text-xs text-white/38">{item.cantidad} · {money(item.total_usd)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-emerald-500/65" style={{ width: `${Math.max(3, (Math.max(item.total_usd, item.cantidad) / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function DetalleOficio({ empleado, onCerrar }: Props) {
  return (
    <div className="overflow-hidden rounded-3xl border border-emerald-300/20 bg-white/[0.045]">
      <div className="flex items-center justify-between gap-4 border-b border-white/5 bg-emerald-500/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/18 text-lg font-black text-emerald-200/80">
            {empleado.empleado_nombre.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-white">{empleado.empleado_nombre}</h3>
            <p className="text-sm text-white/38">{empleado.rol}</p>
          </div>
        </div>
        <button type="button" onClick={onCerrar} className="rounded-full bg-white/5 px-3 py-1 text-xl leading-none text-white/35 hover:text-white/75">×</button>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[0.75fr_1fr_1fr]">
        <div className="rounded-2xl border border-white/5 bg-black/10 p-4">
          <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-white/38">Resumen</h4>
          <div className="space-y-4">
            <div><p className="text-xs text-white/30">Facturación USD</p><p className="text-2xl font-black text-white">{money(empleado.total_usd)}</p></div>
            <div><p className="text-xs text-white/30">Facturación Bs</p><p className="text-lg font-bold text-white/65">Bs. {empleado.total_bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="rounded-xl bg-white/5 p-3"><p className="text-[10px] text-white/30">Clientes</p><p className="text-lg font-bold text-white/75">{empleado.usuarios_activos}</p></div>
              <div className="rounded-xl bg-white/5 p-3"><p className="text-[10px] text-white/30">Planes</p><p className="text-lg font-bold text-white/75">{empleado.planes_activos}</p></div>
              <div className="rounded-xl bg-white/5 p-3"><p className="text-[10px] text-white/30">Agenda</p><p className="text-lg font-bold text-white/75">{empleado.agenda_total}</p></div>
            </div>
          </div>
        </div>

        <Listado titulo="Planes activos del cliente" items={empleado.planes_detalle} vacio="Sin planes activos" />
        <Listado titulo="Agenda / servicios realizados" items={empleado.agenda_detalle} vacio="Sin citas pagadas" />
      </div>

      <div className="px-5 pb-5">
        <Listado titulo="Comparativa unitaria: planes + agenda" items={empleado.ranking_unitario} vacio="Sin datos para comparar" />
      </div>
    </div>
  )
}
