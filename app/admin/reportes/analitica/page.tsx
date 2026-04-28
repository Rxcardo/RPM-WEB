import { Suspense } from 'react'
import AnaliticaClient from './AnaliticaClient'
import AnaliticaSkeleton from './AnaliticaSkeleton'
import { getResumenAnalitica } from './queries'
import type { FiltroPeriodo, PeriodoTipo } from './types'

export const dynamic = 'force-dynamic'

function toInt(value: string | string[] | undefined, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function parseFiltro(searchParams: Record<string, string | string[] | undefined>): FiltroPeriodo {
  const now = new Date()
  const tipoRaw = Array.isArray(searchParams.tipo) ? searchParams.tipo[0] : searchParams.tipo
  const tipo: PeriodoTipo = tipoRaw === 'anual' || tipoRaw === 'personalizado' ? tipoRaw : 'mensual'

  return {
    tipo,
    mes: toInt(searchParams.mes, now.getMonth() + 1),
    anio: toInt(searchParams.anio, now.getFullYear()),
    fechaInicio: Array.isArray(searchParams.fechaInicio) ? searchParams.fechaInicio[0] : searchParams.fechaInicio,
    fechaFin: Array.isArray(searchParams.fechaFin) ? searchParams.fechaFin[0] : searchParams.fechaFin,
  }
}

async function AnaliticaPageContent({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const filtro = parseFiltro(searchParams)
  const resumen = await getResumenAnalitica(filtro)
  return <AnaliticaClient filtroInicial={filtro} resumen={resumen} />
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  return (
    <Suspense fallback={<AnaliticaSkeleton />}>
      <AnaliticaPageContent searchParams={params} />
    </Suspense>
  )
}
