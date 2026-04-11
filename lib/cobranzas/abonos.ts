import { supabase } from '@/lib/supabase/client'

export type Abono = {
  id: string
  cuenta_cobrar_id: string
  pago_id: string | null
  monto_usd: number
  metodo_pago_id: string | null
  metodo_pago_v2_id?: string | null
  referencia: string | null
  fecha: string
  notas: string | null
  registrado_por: string | null
  created_at: string
  metodo_pago?: {
    nombre: string
  } | null
  operacion_pago_id?: string | null
  abono_item_no?: number | null
  abono_items_total?: number | null
  es_pago_mixto?: boolean
  moneda_pago?: 'USD' | 'BS' | string | null
  tasa_bcv?: number | null
  monto_bs?: number | null
}

export type NuevoAbono = {
  cuenta_cobrar_id: string
  monto_usd: number
  metodo_pago_id?: string | null
  metodo_pago_v2_id?: string | null
  referencia?: string | null
  fecha: string
  notas?: string | null
  registrado_por?: string | null
}

export type AbonoMixtoItem = {
  metodo_pago_v2_id: string
  moneda_pago: 'USD' | 'BS'
  monto: number
  tasa_bcv?: number | null
  referencia?: string | null
  notas?: string | null
}

export type NuevoAbonoMixto = {
  cuenta_cobrar_id: string
  fecha: string
  registrado_por?: string | null
  notas_generales?: string | null
  pagos: AbonoMixtoItem[]
}

function r2(v: number) {
  return Math.round(Number(v || 0) * 100) / 100
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

// Mantener compatibilidad con flujo simple
export async function registrarAbono(abono: NuevoAbono) {
  const montoAbono = r2(Number(abono.monto_usd || 0))

  if (montoAbono <= 0) {
    throw new Error('El abono debe ser mayor a 0.')
  }

  return registrarAbonoMixto({
    cuenta_cobrar_id: abono.cuenta_cobrar_id,
    fecha: abono.fecha,
    registrado_por: abono.registrado_por || null,
    notas_generales: abono.notas || null,
    pagos: [
      {
        metodo_pago_v2_id: String(abono.metodo_pago_v2_id || abono.metodo_pago_id || ''),
        moneda_pago: 'USD',
        monto: montoAbono,
        referencia: abono.referencia || null,
        notas: abono.notas || null,
      },
    ],
  })
}

export async function registrarAbonoMixto(abono: NuevoAbonoMixto) {
  if (!abono.cuenta_cobrar_id) {
    throw new Error('Debes indicar la cuenta por cobrar.')
  }

  if (!abono.fecha) {
    throw new Error('Debes indicar la fecha del abono.')
  }

  if (!Array.isArray(abono.pagos) || abono.pagos.length === 0) {
    throw new Error('Debes agregar al menos un fragmento de pago.')
  }

  for (const item of abono.pagos) {
    if (!item.metodo_pago_v2_id) {
      throw new Error('Cada fragmento debe tener método de pago.')
    }

    if (!item.moneda_pago || !['USD', 'BS'].includes(item.moneda_pago)) {
      throw new Error('Cada fragmento debe tener moneda válida: USD o BS.')
    }

    if (Number(item.monto || 0) <= 0) {
      throw new Error('Cada fragmento debe tener monto mayor a 0.')
    }

    if (item.moneda_pago === 'BS' && Number(item.tasa_bcv || 0) <= 0) {
      throw new Error('Cada fragmento en bolívares debe tener tasa BCV válida.')
    }
  }

  const { data, error } = await supabase.rpc('registrar_abono_mixto', {
    p_cuenta_cobrar_id: abono.cuenta_cobrar_id,
    p_fecha: abono.fecha,
    p_registrado_por: abono.registrado_por || null,
    p_notas_generales: abono.notas_generales || null,
    p_pagos: abono.pagos.map((item) => ({
      metodo_pago_v2_id: item.metodo_pago_v2_id,
      moneda_pago: item.moneda_pago,
      monto: r2(Number(item.monto || 0)),
      tasa_bcv: item.moneda_pago === 'BS' ? Number(item.tasa_bcv || 0) : item.tasa_bcv ?? null,
      referencia: item.referencia || null,
      notas: item.notas || null,
    })),
  })

  if (error) throw error
  return data
}

// Obtener abonos de una cuenta
export async function obtenerAbonosCuenta(cuentaId: string) {
  const { data, error } = await supabase
    .from('abonos_cobranza')
    .select(`
      *,
      metodo_pago:metodo_pago_v2_id(nombre)
    `)
    .eq('cuenta_cobrar_id', cuentaId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as Abono[]
}

// Obtener historial agrupable
export async function obtenerHistorialAbonos(limite = 100) {
  const { data, error } = await supabase
    .from('abonos_cobranza')
    .select(`
      *,
      metodo_pago:metodo_pago_v2_id(nombre),
      cuenta:cuenta_cobrar_id(concepto, cliente_nombre)
    `)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limite)

  if (error) throw error
  return data || []
}

export type GrupoAbonoOperacion = {
  operacion_pago_id: string
  cuenta_cobrar_id: string
  fecha: string
  total_usd: number
  total_bs: number
  items_total: number
  es_pago_mixto: boolean
  referencias: string[]
  notas: string[]
  items: Abono[]
}

export function agruparAbonosPorOperacion(abonos: Abono[]): GrupoAbonoOperacion[] {
  const map = new Map<string, GrupoAbonoOperacion>()

  for (const row of abonos || []) {
    const key = String(row.operacion_pago_id || row.id)

    if (!map.has(key)) {
      map.set(key, {
        operacion_pago_id: key,
        cuenta_cobrar_id: row.cuenta_cobrar_id,
        fecha: row.fecha,
        total_usd: 0,
        total_bs: 0,
        items_total: Number(row.abono_items_total || 1),
        es_pago_mixto: Boolean(row.es_pago_mixto),
        referencias: [],
        notas: [],
        items: [],
      })
    }

    const group = map.get(key)!
    group.items.push(row)
    group.total_usd = r2(group.total_usd + Number(row.monto_usd || 0))
    group.total_bs = r2(group.total_bs + Number(row.monto_bs || 0))

    if (row.referencia) group.referencias.push(String(row.referencia))
    if (row.notas) group.notas.push(String(row.notas))
  }

  return Array.from(map.values()).sort((a, b) => {
    const fa = new Date(a.fecha).getTime()
    const fb = new Date(b.fecha).getTime()
    return fb - fa
  })
}