export type PeriodoTipo = 'mensual' | 'anual' | 'personalizado'

export type FiltroPeriodo = {
  tipo: PeriodoTipo
  mes: number
  anio: number
  fechaInicio?: string
  fechaFin?: string
}

export type RangoPeriodo = {
  inicio: string
  fin: string
  anteriorInicio: string
  anteriorFin: string
  label: string
}

export type FacturacionMensual = {
  mes: string
  mes_label: string
  total_usd: number
  total_bs: number
  total_pagos: number
  planes_usd: number
  planes_bs: number
  planes_cantidad: number
  agenda_usd: number
  agenda_bs: number
  agenda_cantidad: number
}

export type BreakdownTipo = 'plan' | 'agenda'
export type BreakdownFuente = 'vendido' | 'activo'

export type BreakdownItem = {
  id: string
  nombre: string
  tipo: BreakdownTipo
  fuente?: BreakdownFuente
  cantidad: number
  total_usd: number
  total_bs: number
  porcentaje: number
}

export type ResumenGrupo = {
  tipo: BreakdownTipo
  nombre: string
  cantidad: number
  total_usd: number
  total_bs: number
  porcentaje: number
  items: BreakdownItem[]
}

export type DetalleOficioItem = {
  id: string
  nombre: string
  tipo: BreakdownTipo
  fuente?: BreakdownFuente
  cantidad: number
  total_usd: number
  total_bs: number
}

export type FacturacionPorOficio = {
  empleado_id: string
  empleado_nombre: string
  rol: string
  total_usd: number
  total_bs: number
  usuarios_activos: number
  planes_activos: number
  agenda_total: number
  planes_detalle: DetalleOficioItem[]
  agenda_detalle: DetalleOficioItem[]
  ranking_unitario: DetalleOficioItem[]
}

export type ResumenAnalitica = {
  periodo_label: string
  total_facturado_usd: number
  total_facturado_bs: number
  variacion_pct: number
  total_clientes_activos: number
  total_planes_activos: number
  servicio_mas_vendido: string
  empleado_top: string
  facturacion_mensual: FacturacionMensual[]
  grupos: ResumenGrupo[]

  // Planes vendidos = desde pagos tipo plan del período
  planes: BreakdownItem[]

  // Planes activos = desde clientes_planes estado activo
  planes_activos_breakdown: BreakdownItem[]

  // Agenda/citas vendidas = desde pagos/citas del período
  agenda: BreakdownItem[]

  // Comparativa vendida del período
  comparativa: BreakdownItem[]

  por_oficio: FacturacionPorOficio[]
}