'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { FacturacionPorOficio, FiltroPeriodo, ResumenAnalitica, BreakdownItem } from './types'
import FiltrosPeriodo from './components/FiltrosPeriodo'
import KpiCards from './components/KpiCards'
import GraficoFacturacion from './components/GraficoFacturacion'
import ComparadorOficios from './components/ComparadorOficios'
import GraficoServicios from './components/GraficoServicios'
import GraficoPlanes from './components/GraficoPlanes'
import TablaOficios from './components/TablaOficios'
import DetalleOficio from './components/DetalleOficio'

interface Props { filtroInicial: FiltroPeriodo; resumen: ResumenAnalitica }
type VistaServicios = 'global' | 'unitario'

export default function AnaliticaClient({ filtroInicial, resumen }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [seleccionado, setSeleccionado] = useState<FacturacionPorOficio | null>(null)
  const [vistaServicios, setVistaServicios] = useState<VistaServicios>('global')
  const filtro = useMemo(() => filtroInicial, [filtroInicial])

  const rankingUnitario = useMemo<BreakdownItem[]>(() => {
    const planes = (resumen.planes || []).map((item) => ({ ...item, id: `plan-${item.id}`, nombre: `Plan · ${item.nombre}`, tipo: 'plan' as any }))
    const agenda = (resumen.agenda || []).map((item) => ({ ...item, id: `agenda-${item.id}`, nombre: `Agenda · ${item.nombre}`, tipo: 'agenda' as any }))
    return [...planes, ...agenda].sort((a, b) => b.total_usd - a.total_usd)
  }, [resumen.planes, resumen.agenda])

  function updateFiltro(next: FiltroPeriodo) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tipo', next.tipo); params.set('mes', String(next.mes)); params.set('anio', String(next.anio))
    if (next.tipo === 'personalizado') {
      if (next.fechaInicio) params.set('fechaInicio', next.fechaInicio)
      if (next.fechaFin) params.set('fechaFin', next.fechaFin)
    } else { params.delete('fechaInicio'); params.delete('fechaFin') }
    startTransition(() => { router.push(`/admin/reportes/analitica?${params.toString()}`) })
  }

  return (
    <main className="text-white">

      {/* ── Sticky top bar — mismo estilo que el resto del admin ── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#0b0b12]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <p className="text-xs text-white/55">Reportes</p>
              <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-white">Analítica general</h1>
            </div>
            {isPending && (
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-white/55">
                Actualizando…
              </span>
            )}
          </div>
          <FiltrosPeriodo filtroActual={filtro} onChange={updateFiltro} />
        </div>
      </div>

      {/* ── Content ── */}
      <div className="mx-auto max-w-[1600px] space-y-4 px-4 py-5 md:px-8">

        <p className="text-sm text-white/55">{resumen.periodo_label}</p>

        {/* KPIs */}
        <KpiCards resumen={resumen} />

        {/* Gráfico facturación */}
        <GraficoFacturacion data={resumen.facturacion_mensual} filtro={filtro} />

        {/* Planes vs Agenda */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/45">Planes vs Agenda</p>
              <p className="mt-0.5 text-xs text-white/40">Comparación global o ranking unitario</p>
            </div>
            <div className="flex rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
              <button type="button" onClick={() => setVistaServicios('global')}
                className={['rounded-[10px] px-4 py-1.5 text-xs font-bold transition', vistaServicios === 'global' ? 'bg-emerald-500/20 text-emerald-200' : 'text-white/45 hover:text-white/75'].join(' ')}>
                Global
              </button>
              <button type="button" onClick={() => setVistaServicios('unitario')}
                className={['rounded-[10px] px-4 py-1.5 text-xs font-bold transition', vistaServicios === 'unitario' ? 'bg-emerald-500/20 text-emerald-200' : 'text-white/45 hover:text-white/75'].join(' ')}>
                Unitario
              </button>
            </div>
          </div>
          <div className="p-4">
            {vistaServicios === 'global' ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <GraficoPlanes data={resumen.planes} />
                <GraficoServicios data={resumen.agenda} />
              </div>
            ) : (
              <GraficoServicios data={rankingUnitario} titulo="Ranking unitario" emptyText="Sin planes ni citas en este período" modo="unitario" />
            )}
          </div>
        </div>

        {/* Tabla + comparador */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
          <TablaOficios
            data={resumen.por_oficio}
            seleccionado={seleccionado}
            onSeleccionar={(emp) => setSeleccionado((a) => a?.empleado_id === emp.empleado_id ? null : emp)}
          />
          <ComparadorOficios data={resumen.por_oficio} />
        </div>

        {/* Detalle fisio */}
        {seleccionado && <DetalleOficio empleado={seleccionado} onCerrar={() => setSeleccionado(null)} />}

        <div className="h-8" />
      </div>
    </main>
  )
}