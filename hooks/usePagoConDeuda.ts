/**
 * usePagoConDeuda + ejecutarPagoConDeuda
 * ─────────────────────────────────────────────────────────────────
 * Hook y función utilitaria para integrar PagoConDeudaSelector
 * en los flujos de:
 *   - /admin/operaciones/agenda/nueva         (nueva cita)
 *   - /admin/personas/clientes/nuevo          (nuevo cliente, paso 3)
 *   - /admin/personas/clientes/[id]/plan      (gestión de plan)
 *
 * Cómo usar en cada página:
 * ─────────────────────────────────────────────────────────────────
 *
 * 1. Importar y usar el hook:
 *    const { pagoState, setPagoState, ejecutarPago } = usePagoConDeuda()
 *
 * 2. Reemplazar la sección de pago actual por:
 *    <PagoConDeudaSelector
 *      montoTotal={montoBase}
 *      fecha={form.fecha}
 *      metodosPago={metodosPago}
 *      value={pagoState}
 *      onChange={setPagoState}
 *      concepto="..."
 *      clienteNombre="..."
 *    />
 *
 * 3. En el guardar(), reemplazar el bloque de pago por:
 *    await ejecutarPago({
 *      montoTotal: montoBase,
 *      fecha: form.fecha,
 *      clienteId: form.cliente_id,
 *      clienteNombre: clienteNombreStr,
 *      concepto: conceptoStr,
 *      citaId: citaId,             // null si es plan
 *      clientePlanId: planId,      // null si es cita
 *      auditorId: auditorId,
 *      notasGenerales: '',
 *    })
 *
 * ─────────────────────────────────────────────────────────────────
 */

'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  pagoConDeudaInitial,
  validarPagoConDeuda,
  buildCuentaPorCobrarPayload,
  buildPagosRpcPayload,
  type PagoConDeudaState,
} from './PagoConDeudaSelector'

// ─── Tipos ─────────────────────────────────────────────────────────

export type EjecutarPagoParams = {
  montoTotal: number
  fecha: string
  clienteId: string
  clienteNombre: string
  concepto: string
  // Origen del pago (uno de los dos tendrá valor)
  citaId?: string | null
  clientePlanId?: string | null
  inventarioId?: string | null
  cuentaCobrarId?: string | null
  // Auditor
  auditorId?: string | null
  // Tipo para el RPC
  tipoOrigen?: 'cita' | 'plan' | 'otro'
  categoria?: string
  notasGenerales?: string | null
}

export type EjecutarPagoResult = {
  ok: boolean
  error?: string
  deudaCreada?: boolean
  montoPagado?: number
  deudaGenerada?: number
}

// ─── Hook principal ─────────────────────────────────────────────────

export function usePagoConDeuda() {
  const [pagoState, setPagoState] = useState<PagoConDeudaState>(pagoConDeudaInitial())

  /**
   * Valida el estado del pago.
   * Retorna null si está OK, o un string con el error.
   */
  const validar = useCallback(
    (montoTotal: number): string | null => {
      return validarPagoConDeuda(pagoState, montoTotal)
    },
    [pagoState]
  )

  /**
   * Ejecuta el pago: llama al RPC de pagos (si aplica) y crea la
   * cuenta por cobrar (si hay deuda). Retorna { ok, error }.
   */
  const ejecutarPago = useCallback(
    async (params: EjecutarPagoParams): Promise<EjecutarPagoResult> => {
      const {
        montoTotal,
        fecha,
        clienteId,
        clienteNombre,
        concepto,
        citaId = null,
        clientePlanId = null,
        inventarioId = null,
        cuentaCobrarId = null,
        auditorId = null,
        tipoOrigen = citaId ? 'cita' : 'plan',
        categoria = citaId ? 'cita' : 'plan',
        notasGenerales = null,
      } = params

      const r2 = (v: number) => Math.round(v * 100) / 100

      // 1. Registrar pago si aplica (no es sin_pago)
      if (pagoState.tipoCobro !== 'sin_pago') {
        const pagosPayload = buildPagosRpcPayload(pagoState, montoTotal)
        if (!pagosPayload) {
          return { ok: false, error: 'No se pudo construir el payload de pago.' }
        }

        const { error: pagoError } = await supabase.rpc('registrar_pagos_mixtos', {
          p_fecha: fecha,
          p_tipo_origen: tipoOrigen,
          p_categoria: categoria,
          p_concepto: concepto,
          p_cliente_id: clienteId,
          p_cita_id: citaId,
          p_cliente_plan_id: clientePlanId,
          p_cuenta_cobrar_id: cuentaCobrarId,
          p_inventario_id: inventarioId,
          p_registrado_por: auditorId,
          p_notas_generales: notasGenerales,
          p_pagos: pagosPayload,
        })

        if (pagoError) {
          return { ok: false, error: `Error registrando pago: ${pagoError.message}` }
        }
      }

      // 2. Crear cuenta por cobrar si hay deuda
      const cxcPayload = buildCuentaPorCobrarPayload({
        state: pagoState,
        montoTotal,
        clienteId,
        clienteNombre,
        concepto,
        fecha,
        registradoPor: auditorId,
      })

      let deudaCreada = false
      let deudaGenerada = 0

      if (cxcPayload) {
        const { error: cxcError } = await supabase
          .from('cuentas_por_cobrar')
          .insert(cxcPayload)

        if (cxcError) {
          // Pago ya se registró, pero la deuda falló — retornar warning pero no fallar total
          return {
            ok: true,
            deudaCreada: false,
            error: `⚠️ Pago registrado, pero no se pudo crear la cuenta por cobrar: ${cxcError.message}`,
          }
        }

        deudaCreada = true
        deudaGenerada = cxcPayload.saldo_usd
      }

      // Calcular monto efectivamente pagado
      const montoAbono = parseFloat(pagoState.montoAbono) || 0
      const montoAbonoUsd =
        pagoState.moneda === 'BS' && pagoState.tasaBcv && pagoState.tasaBcv > 0
          ? r2(montoAbono / pagoState.tasaBcv)
          : r2(montoAbono)

      const montoPagado =
        pagoState.tipoCobro === 'sin_pago'
          ? 0
          : pagoState.tipoCobro === 'completo'
            ? montoTotal
            : montoAbonoUsd

      return { ok: true, deudaCreada, montoPagado, deudaGenerada }
    },
    [pagoState]
  )

  /**
   * Resetea el estado del pago al inicial.
   */
  const resetPago = useCallback(() => {
    setPagoState(pagoConDeudaInitial())
  }, [])

  return { pagoState, setPagoState, validar, ejecutarPago, resetPago }
}