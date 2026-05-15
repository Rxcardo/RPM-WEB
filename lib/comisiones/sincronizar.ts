import { supabase } from '@/lib/supabase/client'

function r2(v: number) {
  return Math.round(v * 100) / 100
}

export type SincronizarComisionesParams = {
  tipo: 'plan' | 'cita'
  clienteId: string
  empleadoId: string
  clientePlanId?: string | null
  citaIds?: string[]
  pagoId?: string | null
  cuentaPorCobrarId?: string | null
  base: number
  profesional: number
  rpm: number
  pagoCompleto: boolean
  fecha: string
  tasaBcv?: number | null
  porcentajeRpm?: number
  montoBaseUsd?: number | null
  montoBaseBs?: number | null
  montoRpmUsd?: number | null
  montoRpmBs?: number | null
  montoProfesionalUsd?: number | null
  montoProfesionalBs?: number | null
}

/**
 * Regla global de estado de comisión:
 * - fisio <= 50% → pendiente siempre
 * - fisio > 50% con pago completo → pendiente
 * - fisio > 50% sin pago completo → retenida
 */
export function calcularEstadoComision(base: number, profesional: number, pagoCompleto: boolean): 'pendiente' | 'retenida' {
  const porcentajeFisio = base > 0 ? (profesional / base) * 100 : 0
  return porcentajeFisio <= 50 || pagoCompleto ? 'pendiente' : 'retenida'
}

/**
 * Inserta comisiones en comisiones_detalle con los enlaces correctos a pago y/o deuda.
 * Para planes: crea una sola comisión con cliente_plan_id.
 * Para citas: crea una comisión por cada citaId, todas con el mismo pago/deuda.
 */
export async function sincronizarComisiones(params: SincronizarComisionesParams): Promise<void> {
  const {
    tipo, clienteId, empleadoId, clientePlanId, citaIds,
    pagoId, cuentaPorCobrarId, base, profesional, rpm,
    pagoCompleto, fecha, tasaBcv, porcentajeRpm,
    montoBaseUsd, montoBaseBs, montoRpmUsd, montoRpmBs,
    montoProfesionalUsd, montoProfesionalBs,
  } = params

  const estadoComision = calcularEstadoComision(base, profesional, pagoCompleto)
  const moneda = tasaBcv && tasaBcv > 0 ? 'BS' : 'USD'

  const camposComunes = {
    empleado_id: empleadoId,
    cliente_id: clienteId,
    tipo,
    estado: estadoComision,
    pagado: false,
    pago_id: pagoId ?? null,
    cuenta_por_cobrar_id: cuentaPorCobrarId ?? null,
    base,
    profesional,
    rpm,
    fecha,
    moneda,
    tasa_bcv: tasaBcv ?? null,
    porcentaje_rpm: porcentajeRpm ?? null,
    monto_base_usd: montoBaseUsd ?? null,
    monto_base_bs: montoBaseBs ?? null,
    monto_rpm_usd: montoRpmUsd ?? null,
    monto_rpm_bs: montoRpmBs ?? null,
    monto_profesional_usd: montoProfesionalUsd ?? null,
    monto_profesional_bs: montoProfesionalBs ?? null,
  }

  if (tipo === 'plan' && clientePlanId) {
    const { data: existente } = await supabase
      .from('comisiones_detalle')
      .select('id')
      .eq('cliente_plan_id', clientePlanId)
      .eq('empleado_id', empleadoId)
      .eq('tipo', 'plan')
      .limit(1)
      .maybeSingle()
    if (existente?.id) return

    const { error } = await supabase.from('comisiones_detalle').insert({
      ...camposComunes,
      cliente_plan_id: clientePlanId,
    })
    if (error) throw new Error(`Comisión plan: ${error.message}`)
    return
  }

  if (tipo === 'cita' && citaIds && citaIds.length > 0) {
    const payload = citaIds.map((citaId) => ({
      ...camposComunes,
      cita_id: citaId,
    }))
    const { error } = await supabase.from('comisiones_detalle').insert(payload)
    if (error) throw new Error(`Comisiones citas: ${error.message}`)
  }
}

/**
 * Cuando una cuenta por cobrar queda completamente pagada (cobrada),
 * libera todas las comisiones retenidas enlazadas a ella → estado pendiente.
 */
export async function liberarComisionesRetenidasPorCuenta(cuentaId: string): Promise<void> {
  const { data: cuenta } = await supabase
    .from('cuentas_por_cobrar')
    .select('saldo_usd, estado')
    .eq('id', cuentaId)
    .maybeSingle()

  if (!cuenta) return

  const cobrada =
    String(cuenta.estado || '').toLowerCase() === 'cobrada' ||
    r2(Number(cuenta.saldo_usd || 0)) <= 0.01

  if (!cobrada) return

  await supabase
    .from('comisiones_detalle')
    .update({ cuenta_por_cobrar_id: cuentaId, estado: 'pendiente' })
    .eq('cuenta_por_cobrar_id', cuentaId)
    .eq('estado', 'retenida')
    .eq('pagado', false)
    .is('liquidacion_id', null)
    .is('pago_empleado_id', null)
}
