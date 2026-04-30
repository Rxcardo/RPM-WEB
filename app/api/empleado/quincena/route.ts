import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

type PeriodoKey = 'actual' | 'anterior'

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function getPeriodo(key: PeriodoKey) {
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth()
  let primera = now.getDate() <= 15

  if (key === 'anterior') {
    if (!primera) {
      primera = true
    } else {
      month -= 1
      if (month < 0) {
        month = 11
        year -= 1
      }
      primera = false
    }
  }

  const start = primera ? new Date(year, month, 1) : new Date(year, month, 16)
  const end = primera ? new Date(year, month, 15) : new Date(year, month + 1, 0)

  return {
    key,
    start: dateKey(start),
    end: dateKey(end),
    label: primera ? 'Primera quincena' : 'Segunda quincena',
  }
}

function num(value: any) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? n : 0
}

function pickAmount(row: any, keys: string[]) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null) return num(row[key])
  }
  return 0
}

function rowDate(row: any) {
  return String(row?.fecha || row?.fecha_pago || row?.created_at || row?.created_at || row?.periodo_inicio || '').slice(0, 10)
}

function inRange(date: string, start: string, end: string) {
  if (!date) return false
  return date >= start && date <= end
}

export async function GET(req: NextRequest) {
  try {
    let res = NextResponse.next()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value
          },
          set(name: string, value: string, options: Record<string, any>) {
            res.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: Record<string, any>) {
            res.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 })

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: empleado, error: empleadoError } = await supabaseAdmin
      .from('empleados')
      .select('id,nombre,rol,email,auth_user_id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (empleadoError || !empleado) {
      return NextResponse.json({ error: empleadoError?.message || 'No se encontró empleado vinculado.' }, { status: 404 })
    }

    const periodoParam = req.nextUrl.searchParams.get('periodo') === 'anterior' ? 'anterior' : 'actual'
    const periodo = getPeriodo(periodoParam)

    const [estadoRes, resumenCxCRes, pagosRes, detalleRes] = await Promise.all([
      supabaseAdmin.from('v_empleados_estado_cuenta').select('*').eq('empleado_id', empleado.id).maybeSingle(),
      supabaseAdmin.from('v_empleados_cuentas_por_cobrar_resumen').select('*').eq('empleado_id', empleado.id).maybeSingle(),
      supabaseAdmin.from('pagos_empleados').select('*').eq('empleado_id', empleado.id).order('created_at', { ascending: false }).limit(200),
      supabaseAdmin.from('pagos_empleados_detalle').select('*').eq('empleado_id', empleado.id).order('created_at', { ascending: false }).limit(500),
    ])

    const estado: any = estadoRes.data || {}
    const resumenCxC: any = resumenCxCRes.data || {}
    const pagosRows = Array.isArray(pagosRes.data) ? pagosRes.data : []
    const detalleRows = Array.isArray(detalleRes.data) ? detalleRes.data : []

    const pagosPeriodo = pagosRows.filter((row: any) => {
      const d = rowDate(row)
      const pi = String(row?.periodo_inicio || '').slice(0, 10)
      const pf = String(row?.periodo_fin || '').slice(0, 10)
      if (pi && pf) return !(pf < periodo.start || pi > periodo.end)
      return inRange(d, periodo.start, periodo.end)
    })

    const detallePeriodo = detalleRows.filter((row: any) => {
      const d = rowDate(row)
      const pi = String(row?.periodo_inicio || '').slice(0, 10)
      const pf = String(row?.periodo_fin || '').slice(0, 10)
      if (pi && pf) return !(pf < periodo.start || pi > periodo.end)
      return inRange(d, periodo.start, periodo.end)
    })

    const totalPagadoPeriodo = pagosPeriodo.reduce((acc: number, row: any) => acc + pickAmount(row, [
      'monto_pagado_usd', 'total_pagado_usd', 'monto_usd', 'monto', 'total_usd', 'neto_usd', 'monto_total_usd'
    ]), 0)

    const totalFacturadoDetalle = detallePeriodo.reduce((acc: number, row: any) => acc + pickAmount(row, [
      'monto_facturado_usd', 'monto_comision_usd', 'comision_usd', 'monto_usd', 'total_usd', 'monto_total_usd', 'subtotal_usd'
    ]), 0)

    const totalPendienteDetalle = detallePeriodo
      .filter((row: any) => !['pagado', 'pagada', 'anulado', 'anulada', 'cancelado', 'cancelada'].includes(String(row?.estado || '').toLowerCase()))
      .reduce((acc: number, row: any) => acc + pickAmount(row, [
        'saldo_usd', 'pendiente_usd', 'monto_pendiente_usd', 'monto_comision_usd', 'comision_usd', 'monto_usd', 'total_usd'
      ]), 0)

    const facturadoGlobal = pickAmount(estado, ['total_facturado_usd']) || pickAmount(resumenCxC, ['total_facturado_usd', 'total_usd', 'monto_total_usd'])
    const pagadoGlobal = pickAmount(estado, ['total_pagado_usd']) || pickAmount(resumenCxC, ['total_pagado_usd', 'pagado_usd'])
    const pendienteGlobal = pickAmount(estado, ['saldo_pendiente_neto_usd', 'total_pendiente_usd']) || pickAmount(resumenCxC, ['saldo_pendiente_neto_usd', 'total_pendiente_usd', 'pendiente_usd'])
    const creditoGlobal = pickAmount(estado, ['credito_disponible_usd', 'saldo_favor_neto_usd']) || pickAmount(resumenCxC, ['credito_disponible_usd', 'saldo_favor_neto_usd'])

    const facturadoPeriodo = totalFacturadoDetalle || pagosPeriodo.reduce((acc: number, row: any) => acc + pickAmount(row, [
      'total_facturado_usd', 'monto_facturado_usd', 'monto_total_usd', 'total_usd', 'monto_usd', 'monto'
    ]), 0)

    const pagadoPeriodo = totalPagadoPeriodo
    const pendientePeriodo = totalPendienteDetalle || Math.max(0, facturadoPeriodo - pagadoPeriodo)

    const usarGlobalComoFallback = facturadoPeriodo === 0 && pagadoPeriodo === 0 && pendientePeriodo === 0

    return NextResponse.json({
      empleado,
      periodo,
      resumen: {
        total_facturado_usd: usarGlobalComoFallback ? facturadoGlobal : facturadoPeriodo,
        total_pagado_usd: usarGlobalComoFallback ? pagadoGlobal : pagadoPeriodo,
        total_pendiente_usd: usarGlobalComoFallback ? pendienteGlobal : pendientePeriodo,
        credito_disponible_usd: creditoGlobal,
        saldo_favor_neto_usd: pickAmount(estado, ['saldo_favor_neto_usd']) || pickAmount(resumenCxC, ['saldo_favor_neto_usd']),
        saldo_pendiente_neto_usd: usarGlobalComoFallback ? pendienteGlobal : Math.max(0, pendientePeriodo - creditoGlobal),
      },
      fuente: usarGlobalComoFallback ? 'estado_cuenta_global' : 'detalle_periodo',
      pagos: pagosPeriodo.slice(0, 20),
      detalle: detallePeriodo.slice(0, 40),
      debug: {
        estado_error: estadoRes.error?.message || null,
        resumen_cxc_error: resumenCxCRes.error?.message || null,
        pagos_error: pagosRes.error?.message || null,
        detalle_error: detalleRes.error?.message || null,
        pagos_count: pagosRows.length,
        detalle_count: detalleRows.length,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Error cargando quincena.' }, { status: 500 })
  }
}
