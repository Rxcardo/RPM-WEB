import { createClient } from '@/lib/supabase/server'
import type {
  BreakdownItem,
  DetalleOficioItem,
  FacturacionMensual,
  FacturacionPorOficio,
  FiltroPeriodo,
  RangoPeriodo,
  ResumenAnalitica,
  ResumenGrupo,
} from './types'

const ROLES_OFICIO = ['fisioterapeuta', 'terapeuta']
const ESTADOS_CANCELADOS = ['cancelado', 'cancelada', 'anulado', 'anulada', 'eliminado', 'eliminada']
const ESTADOS_PLAN_ACTIVO = ['activo']

const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function num(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function ymd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

function monthRange(anio: number, mes: number) {
  const start = new Date(anio, mes - 1, 1)
  const end = new Date(anio, mes, 0)
  return { inicio: ymd(start), fin: ymd(end) }
}

export function buildDateRange(filtro: FiltroPeriodo): RangoPeriodo {
  const hoy = new Date()
  const anio = filtro.anio || hoy.getFullYear()
  const mes = filtro.mes || hoy.getMonth() + 1

  if (filtro.tipo === 'anual') {
    return {
      inicio: `${anio}-01-01`,
      fin: `${anio}-12-31`,
      anteriorInicio: `${anio - 1}-01-01`,
      anteriorFin: `${anio - 1}-12-31`,
      label: `Año ${anio}`,
    }
  }

  if (filtro.tipo === 'personalizado' && filtro.fechaInicio && filtro.fechaFin) {
    const inicio = filtro.fechaInicio
    const fin = filtro.fechaFin
    const start = new Date(`${inicio}T00:00:00`)
    const end = new Date(`${fin}T00:00:00`)
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
    const anteriorFin = addDays(start, -1)
    const anteriorInicio = addDays(anteriorFin, -(days - 1))

    return {
      inicio,
      fin,
      anteriorInicio: ymd(anteriorInicio),
      anteriorFin: ymd(anteriorFin),
      label: `${inicio} — ${fin}`,
    }
  }

  const actual = monthRange(anio, mes)
  const prevDate = new Date(anio, mes - 2, 1)
  const anterior = monthRange(prevDate.getFullYear(), prevDate.getMonth() + 1)

  return {
    ...actual,
    anteriorInicio: anterior.inicio,
    anteriorFin: anterior.fin,
    label: `${MESES_LARGOS[mes - 1]} ${anio}`,
  }
}

function pagoUsd(pago: any): number {
  return num(pago?.monto_equivalente_usd ?? pago?.monto_usd ?? pago?.total_usd ?? pago?.monto)
}

function pagoBs(pago: any): number {
  return num(
    pago?.monto_equivalente_bs ??
      pago?.monto_bs ??
      pago?.monto_final_bs ??
      pago?.clientes_planes?.monto_final_bs ??
      0,
  )
}

function pagoCancelado(pago: any): boolean {
  const estado = String(pago?.estado ?? '').toLowerCase()
  return ESTADOS_CANCELADOS.includes(estado)
}

function planEstaActivo(plan: any): boolean {
  const estado = String(plan?.estado ?? '').toLowerCase()
  return ESTADOS_PLAN_ACTIVO.includes(estado)
}

function isPlanPago(pago: any): boolean {
  const tipo = String(pago?.tipo_origen ?? pago?.categoria ?? '').toLowerCase()
  return Boolean(pago?.cliente_plan_id || pago?.clientes_planes?.id || tipo === 'plan')
}

function isAgendaPago(pago: any): boolean {
  const tipo = String(pago?.tipo_origen ?? pago?.categoria ?? '').toLowerCase()
  return Boolean(pago?.cita_id || pago?.citas?.id || tipo === 'cita')
}

function planNombreFromPago(pago: any): string {
  return String(pago?.clientes_planes?.planes?.nombre ?? pago?.concepto ?? 'Plan sin nombre').trim()
}

function agendaNombreFromPago(pago: any): string {
  return String(pago?.citas?.servicios?.nombre ?? pago?.concepto ?? 'Agenda sin servicio').trim()
}

function planNombreFromClientePlan(cp: any): string {
  return String(cp?.planes?.nombre ?? 'Plan sin nombre').trim()
}

function addDetalle(map: Map<string, DetalleOficioItem>, item: DetalleOficioItem) {
  const current = map.get(item.id)

  if (!current) {
    map.set(item.id, { ...item })
    return
  }

  current.cantidad += item.cantidad
  current.total_usd += item.total_usd
  current.total_bs += item.total_bs
}

function addBreakdown(
  map: Map<string, { id: string; nombre: string; cantidad: number; total_usd: number; total_bs: number }>,
  item: { id: string; nombre: string; total_usd: number; total_bs: number },
) {
  const current = map.get(item.id)

  if (!current) {
    map.set(item.id, {
      id: item.id,
      nombre: item.nombre,
      cantidad: 1,
      total_usd: item.total_usd,
      total_bs: item.total_bs,
    })
    return
  }

  current.cantidad += 1
  current.total_usd += item.total_usd
  current.total_bs += item.total_bs
}

function toBreakdownItems(
  tipo: 'plan' | 'agenda',
  mapa: Map<string, { id: string; nombre: string; cantidad: number; total_usd: number; total_bs: number }>,
  totalUsdGlobal: number,
): BreakdownItem[] {
  return Array.from(mapa.values())
    .map((x) => ({
      ...x,
      tipo,
      fuente: 'vendido' as const,
      porcentaje: totalUsdGlobal > 0 ? (x.total_usd / totalUsdGlobal) * 100 : 0,
    }))
    .sort((a, b) => b.total_usd - a.total_usd || b.cantidad - a.cantidad)
}

async function getPagos(inicio: string, fin: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('pagos')
    .select(`
      *,
      clientes:cliente_id (
        id,
        nombre,
        estado,
        terapeuta_id,
        empleado_id
      ),
      clientes_planes:cliente_plan_id (
        id,
        cliente_id,
        terapeuta_id,
        plan_id,
        estado,
        fecha_inicio,
        fecha_fin,
        monto_final_bs,
        precio_final_usd,
        planes:plan_id (
          id,
          nombre
        )
      ),
      citas:cita_id (
        id,
        cliente_id,
        terapeuta_id,
        servicio_id,
        estado,
        servicios:servicio_id (
          id,
          nombre,
          categoria
        )
      )
    `)
    .gte('fecha', inicio)
    .lte('fecha', fin)

  if (error) {
    console.error('[analitica] pagos:', error.message)
    return []
  }

  return (data ?? []).filter((p: any) => !pagoCancelado(p))
}

async function getEmpleadosOficio() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('empleados')
    .select('id, nombre, rol, estado')
    .in('rol', ROLES_OFICIO)
    .order('nombre', { ascending: true })

  if (error) {
    console.error('[analitica] empleados:', error.message)
    return []
  }

  return data ?? []
}

async function getClientesPlanes() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('clientes_planes')
    .select(`
      id,
      cliente_id,
      terapeuta_id,
      plan_id,
      estado,
      fecha_inicio,
      fecha_fin,
      precio_final_usd,
      monto_final_bs,
      clientes:cliente_id (
        id,
        nombre,
        terapeuta_id,
        empleado_id
      ),
      planes:plan_id (
        id,
        nombre
      )
    `)

  if (error) {
    console.error('[analitica] clientes_planes:', error.message)
    return []
  }

  return data ?? []
}

async function getComisionesDetalle() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('comisiones_detalle')
    .select(`
      id,
      empleado_id,
      cliente_plan_id,
      pago_empleado_id
    `)
    .not('cliente_plan_id', 'is', null)
    .not('empleado_id', 'is', null)

  if (error) {
    console.error('[analitica] comisiones_detalle:', error.message)
    return []
  }

  return data ?? []
}

export async function getFacturacionMensual(anio: number): Promise<FacturacionMensual[]> {
  const pagos = await getPagos(`${anio}-01-01`, `${anio}-12-31`)

  const meses: FacturacionMensual[] = Array.from({ length: 12 }, (_, idx) => {
    const mes = idx + 1

    return {
      mes: `${anio}-${String(mes).padStart(2, '0')}`,
      mes_label: `${MESES_CORTOS[idx]} ${anio}`,
      total_usd: 0,
      total_bs: 0,
      total_pagos: 0,
      planes_usd: 0,
      planes_bs: 0,
      planes_cantidad: 0,
      agenda_usd: 0,
      agenda_bs: 0,
      agenda_cantidad: 0,
    }
  })

  for (const pago of pagos as any[]) {
    const fecha = String(pago?.fecha ?? '').slice(0, 10)
    const mesIndex = Number(fecha.slice(5, 7)) - 1
    if (mesIndex < 0 || mesIndex > 11) continue

    const usd = pagoUsd(pago)
    const bs = pagoBs(pago)

    meses[mesIndex].total_usd += usd
    meses[mesIndex].total_bs += bs
    meses[mesIndex].total_pagos += 1

    if (isPlanPago(pago)) {
      meses[mesIndex].planes_usd += usd
      meses[mesIndex].planes_bs += bs
      meses[mesIndex].planes_cantidad += 1
    }

    if (isAgendaPago(pago)) {
      meses[mesIndex].agenda_usd += usd
      meses[mesIndex].agenda_bs += bs
      meses[mesIndex].agenda_cantidad += 1
    }
  }

  return meses
}

function buildBreakdowns(pagos: any[]) {
  const totalUsd = pagos.reduce((s, p) => s + pagoUsd(p), 0)

  const planesMap = new Map<string, { id: string; nombre: string; cantidad: number; total_usd: number; total_bs: number }>()
  const agendaMap = new Map<string, { id: string; nombre: string; cantidad: number; total_usd: number; total_bs: number }>()

  for (const pago of pagos) {
    const usd = pagoUsd(pago)
    const bs = pagoBs(pago)

    if (isPlanPago(pago)) {
      const id = String(pago?.clientes_planes?.planes?.id ?? pago?.cliente_plan_id ?? pago?.id)

      addBreakdown(planesMap, {
        id,
        nombre: planNombreFromPago(pago),
        total_usd: usd,
        total_bs: bs,
      })
    }

    if (isAgendaPago(pago)) {
      const id = String(pago?.citas?.servicios?.id ?? pago?.cita_id ?? pago?.id)

      addBreakdown(agendaMap, {
        id,
        nombre: agendaNombreFromPago(pago),
        total_usd: usd,
        total_bs: bs,
      })
    }
  }

  return {
    planes: toBreakdownItems('plan', planesMap, totalUsd),
    agenda: toBreakdownItems('agenda', agendaMap, totalUsd),
  }
}

function buildPlanesActivosBreakdown(clientesPlanes: any[]): BreakdownItem[] {
  const activos = clientesPlanes.filter((cp) => planEstaActivo(cp))
  const total = activos.length || 1

  const map = new Map<string, BreakdownItem>()

  for (const cp of activos) {
    const id = String(cp?.planes?.id ?? cp?.plan_id ?? cp?.id)
    const current = map.get(id)

    if (!current) {
      map.set(id, {
        id,
        nombre: planNombreFromClientePlan(cp),
        tipo: 'plan',
        fuente: 'activo',
        cantidad: 1,
        total_usd: num(cp?.precio_final_usd),
        total_bs: num(cp?.monto_final_bs),
        porcentaje: (1 / total) * 100,
      })
    } else {
      current.cantidad += 1
      current.total_usd += num(cp?.precio_final_usd)
      current.total_bs += num(cp?.monto_final_bs)
      current.porcentaje = (current.cantidad / total) * 100
    }
  }

  return Array.from(map.values()).sort((a, b) => b.cantidad - a.cantidad || b.total_usd - a.total_usd)
}

function buildGrupos(planes: BreakdownItem[], agenda: BreakdownItem[], totalUsd: number): ResumenGrupo[] {
  const planesUsd = planes.reduce((s, x) => s + x.total_usd, 0)
  const planesBs = planes.reduce((s, x) => s + x.total_bs, 0)
  const planesCantidad = planes.reduce((s, x) => s + x.cantidad, 0)

  const agendaUsd = agenda.reduce((s, x) => s + x.total_usd, 0)
  const agendaBs = agenda.reduce((s, x) => s + x.total_bs, 0)
  const agendaCantidad = agenda.reduce((s, x) => s + x.cantidad, 0)

  return [
    {
      tipo: 'plan',
      nombre: 'Planes vendidos',
      cantidad: planesCantidad,
      total_usd: planesUsd,
      total_bs: planesBs,
      porcentaje: totalUsd > 0 ? (planesUsd / totalUsd) * 100 : 0,
      items: planes,
    },
    {
      tipo: 'agenda',
      nombre: 'Agenda / Citas',
      cantidad: agendaCantidad,
      total_usd: agendaUsd,
      total_bs: agendaBs,
      porcentaje: totalUsd > 0 ? (agendaUsd / totalUsd) * 100 : 0,
      items: agenda,
    },
  ]
}

function buildPlanEmpleadoMap(comisiones: any[]) {
  const map = new Map<string, string>()

  for (const cd of comisiones) {
    if (cd?.cliente_plan_id && cd?.empleado_id) {
      map.set(String(cd.cliente_plan_id), String(cd.empleado_id))
    }
  }

  return map
}

function buildPorOficio(
  empleados: any[],
  pagos: any[],
  clientesPlanes: any[],
  comisiones: any[],
): FacturacionPorOficio[] {

  const byEmpleado = new Map<string, FacturacionPorOficio>()
  const clientesActivosPorEmpleado = new Map<string, Set<string>>()
  const planesDetalleMap = new Map<string, Map<string, DetalleOficioItem>>()
  const agendaDetalleMap = new Map<string, Map<string, DetalleOficioItem>>()

  // 🔥 MAP REAL: PLAN → EMPLEADO (DESDE COMISIONES)
  const planEmpleadoMap = new Map<string, string>()

  for (const cd of comisiones) {
    if (cd?.cliente_plan_id && cd?.empleado_id) {
      planEmpleadoMap.set(cd.cliente_plan_id, cd.empleado_id)
    }
  }

  // Crear empleados base
  for (const emp of empleados) {
    byEmpleado.set(emp.id, {
      empleado_id: emp.id,
      empleado_nombre: emp.nombre ?? 'Sin nombre',
      rol: emp.rol ?? '',
      total_usd: 0,
      total_bs: 0,
      usuarios_activos: 0,
      planes_activos: 0,
      agenda_total: 0,
      planes_detalle: [],
      agenda_detalle: [],
      ranking_unitario: [],
    })

    clientesActivosPorEmpleado.set(emp.id, new Set())
  }

  function ensureMap(container: Map<string, Map<string, DetalleOficioItem>>, empId: string) {
    let map = container.get(empId)
    if (!map) {
      map = new Map()
      container.set(empId, map)
    }
    return map
  }

  function getEmpleadoFromPlan(cp: any): string | null {
    return planEmpleadoMap.get(cp.id) ?? null
  }

  function getEmpleadoFromPago(pago: any): string | null {
    if (isPlanPago(pago)) {
      return planEmpleadoMap.get(pago?.cliente_plan_id) ?? null
    }

    if (isAgendaPago(pago)) {
      return pago?.citas?.terapeuta_id ?? null
    }

    return null
  }

  // 🔥 PLANES (ACTIVOS + HISTÓRICO BIEN ASIGNADOS)
  for (const cp of clientesPlanes) {
    const empId = getEmpleadoFromPlan(cp)
    if (!empId) continue

    const empleado = byEmpleado.get(empId)
    if (!empleado) continue

    const estado = String(cp?.estado ?? '').toLowerCase()
    const esActivo = ESTADOS_PLAN_ACTIVO.includes(estado)

    if (esActivo) {
      empleado.planes_activos += 1

      if (cp?.cliente_id) {
        clientesActivosPorEmpleado.get(empId)?.add(cp.cliente_id)
      }
    }

    const planId = String(cp?.planes?.id ?? cp?.plan_id ?? cp?.id)

    addDetalle(ensureMap(planesDetalleMap, empId), {
      id: `${planId}-${estado}`,
      nombre: `${planNombreFromClientePlan(cp)} · ${estado}`,
      tipo: 'plan',
      fuente: esActivo ? 'activo' : 'vendido',
      cantidad: 1,
      total_usd: num(cp?.precio_final_usd),
      total_bs: num(cp?.monto_final_bs),
    })
  }

  // 🔥 PAGOS (FACTURACIÓN REAL)
  for (const pago of pagos) {
    const empId = getEmpleadoFromPago(pago)
    if (!empId) continue

    const empleado = byEmpleado.get(empId)
    if (!empleado) continue

    const usd = pagoUsd(pago)
    const bs = pagoBs(pago)

    empleado.total_usd += usd
    empleado.total_bs += bs

    // AGENDA
    if (isAgendaPago(pago)) {
      empleado.agenda_total += 1

      const agendaId = String(pago?.citas?.servicios?.id ?? pago?.id)

      addDetalle(ensureMap(agendaDetalleMap, empId), {
        id: agendaId,
        nombre: agendaNombreFromPago(pago),
        tipo: 'agenda',
        fuente: 'vendido',
        cantidad: 1,
        total_usd: usd,
        total_bs: bs,
      })
    }

    // PLANES (FACTURACIÓN)
    if (isPlanPago(pago)) {
      const planId = String(pago?.clientes_planes?.planes?.id ?? pago?.id)

      addDetalle(ensureMap(planesDetalleMap, empId), {
        id: `${planId}-facturacion`,
        nombre: `${planNombreFromPago(pago)} · facturación`,
        tipo: 'plan',
        fuente: 'vendido',
        cantidad: 1,
        total_usd: usd,
        total_bs: bs,
      })
    }
  }

  // 🔥 FINALIZAR
  for (const [empId, empleado] of byEmpleado.entries()) {
    empleado.usuarios_activos = clientesActivosPorEmpleado.get(empId)?.size ?? 0

    empleado.planes_detalle = Array.from((planesDetalleMap.get(empId) ?? new Map()).values())
      .sort((a, b) => b.cantidad - a.cantidad || b.total_usd - a.total_usd)

    empleado.agenda_detalle = Array.from((agendaDetalleMap.get(empId) ?? new Map()).values())
      .sort((a, b) => b.cantidad - a.cantidad || b.total_usd - a.total_usd)

    empleado.ranking_unitario = [...empleado.planes_detalle, ...empleado.agenda_detalle]
      .sort((a, b) => b.total_usd - a.total_usd || b.cantidad - a.cantidad)
  }

  // 🔥 CLAVE: eliminar completamente “Sin asignar”
  return Array.from(byEmpleado.values())
    .filter(e =>
      e.total_usd > 0 ||
      e.planes_activos > 0 ||
      e.usuarios_activos > 0 ||
      e.agenda_total > 0
    )
    .sort((a, b) =>
      b.total_usd - a.total_usd ||
      b.usuarios_activos - a.usuarios_activos ||
      b.planes_activos - a.planes_activos
    )
}

export async function getResumenAnalitica(filtro: FiltroPeriodo): Promise<ResumenAnalitica> {
  const rango = buildDateRange(filtro)
  const anio = filtro.anio || new Date().getFullYear()

  const [
    pagosActuales,
    pagosAnteriores,
    empleados,
    clientesPlanes,
    comisiones,
    facturacionMensual,
  ] = await Promise.all([
    getPagos(rango.inicio, rango.fin),
    getPagos(rango.anteriorInicio, rango.anteriorFin),
    getEmpleadosOficio(),
    getClientesPlanes(),
    getComisionesDetalle(),
    getFacturacionMensual(anio),
  ])

  const totalUsd = pagosActuales.reduce((s, p) => s + pagoUsd(p), 0)
  const totalBs = pagosActuales.reduce((s, p) => s + pagoBs(p), 0)
  const totalAnteriorUsd = pagosAnteriores.reduce((s, p) => s + pagoUsd(p), 0)

  const variacionPct =
    totalAnteriorUsd > 0 ? ((totalUsd - totalAnteriorUsd) / totalAnteriorUsd) * 100 : 0

  const { planes, agenda } = buildBreakdowns(pagosActuales)
  const grupos = buildGrupos(planes, agenda, totalUsd)
  const comparativa = [...planes, ...agenda].sort((a, b) => b.total_usd - a.total_usd)

  const clientesPlanesActivos = clientesPlanes.filter((cp: any) => planEstaActivo(cp))
  const planesActivosBreakdown = buildPlanesActivosBreakdown(clientesPlanes)

  const porOficio = buildPorOficio(empleados, pagosActuales, clientesPlanes, comisiones)

  const clientesActivosGlobal = new Set(
    clientesPlanesActivos.map((cp: any) => cp?.cliente_id).filter(Boolean),
  ).size

  const totalPlanesActivos = clientesPlanesActivos.length

  const topItem = comparativa[0]
  const empleadoTop = porOficio[0]

  return {
    periodo_label: rango.label,
    total_facturado_usd: totalUsd,
    total_facturado_bs: totalBs,
    variacion_pct: variacionPct,
    total_clientes_activos: clientesActivosGlobal,
    total_planes_activos: totalPlanesActivos,
    servicio_mas_vendido: topItem?.nombre ?? '—',
    empleado_top: empleadoTop?.empleado_nombre ?? '—',
    facturacion_mensual: facturacionMensual,
    grupos,
    planes,
    planes_activos_breakdown: planesActivosBreakdown,
    agenda,
    comparativa,
    por_oficio: porOficio,
  }
}