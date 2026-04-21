'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  pagoConDeudaInitial,
  validarPagoConDeuda,
  buildCuentaPorCobrarPayload,
  buildPagosRpcPayload,
  type PagoConDeudaState,
} from '@/components/pagos/PagoConDeudaSelector'

// ─── Tipos ─────────────────────────────────────────────────────────

export type EjecutarPagoParams = {
  montoTotal: number
  fecha: string
  clienteId: string
  clienteNombre: string
  concepto: string
  citaId?: string | null
  clientePlanId?: string | null
  inventarioId?: string | null
  cuentaCobrarId?: string | null
  auditorId?: string | null
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

// ─── Hook ─────────────────────────────────────────────────────────

export function usePagoConDeuda() {
  const [pagoState, setPagoState] = useState<PagoConDeudaState>(pagoConDeudaInitial())

  const validar = useCallback(
    (montoTotal: number) => validarPagoConDeuda(pagoState, montoTotal),
    [pagoState]
  )

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

      let montoPagado = 0

      // ─── 1. REGISTRAR PAGO ─────────────────────
      if (pagoState.tipoCobro !== 'sin_pago') {
        const pagosPayload = buildPagosRpcPayload(pagoState, montoTotal)

        if (!pagosPayload) {
          return { ok: false, error: 'No se pudo construir el payload de pago.' }
        }

        const { error } = await supabase.rpc('registrar_pagos_mixtos', {
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

        if (error) {
          return { ok: false, error: error.message }
        }

        // calcular monto pagado
        montoPagado = r2(
          pagosPayload.reduce((acc, p) => {
            if (p.moneda_pago === 'USD') return acc + p.monto
            if (p.moneda_pago === 'BS' && p.tasa_bcv)
              return acc + p.monto / p.tasa_bcv
            return acc
          }, 0)
        )
      }

      // ─── 2. CUENTA POR COBRAR ─────────────────
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
        const { error } = await supabase
          .from('cuentas_por_cobrar')
          .insert(cxcPayload)

        if (error) {
          return {
            ok: true,
            error: `⚠️ Pago registrado pero falló la deuda: ${error.message}`,
          }
        }

        deudaCreada = true
        deudaGenerada = cxcPayload.saldo_usd
      }

      return {
        ok: true,
        montoPagado,
        deudaCreada,
        deudaGenerada,
      }
    },
    [pagoState]
  )

  const resetPago = useCallback(() => {
    setPagoState(pagoConDeudaInitial())
  }, [])

  return { pagoState, setPagoState, validar, ejecutarPago, resetPago }
}