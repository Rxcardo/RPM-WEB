import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatDateShort } from '@/lib/whatsapp/templates'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
  }
)

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

export async function POST() {
  try {
    const hoy = new Date()
    const limite = new Date()
    limite.setDate(limite.getDate() + 5)

    const { data: planes, error } = await supabaseAdmin
      .from('clientes_planes')
      .select(`
        id,
        cliente_id,
        plan_id,
        sesiones_totales,
        sesiones_usadas,
        fecha_fin,
        estado,
        clientes (
          id,
          nombre,
          telefono
        ),
        planes (
          id,
          nombre
        )
      `)
      .gte('fecha_fin', isoDate(hoy))
      .lte('fecha_fin', isoDate(limite))
      .in('estado', ['activo', 'vigente', 'pendiente'])
      .order('fecha_fin', { ascending: true })
      .limit(100)

    if (error) throw error

    let creadas = 0
    let omitidas = 0

    for (const item of planes || []) {
      const telefono = item?.clientes?.telefono
      const nombre = item?.clientes?.nombre || 'cliente'
      const plan = item?.planes?.nombre || 'tu plan'
      const restantes = Math.max(0, Number(item.sesiones_totales || 0) - Number(item.sesiones_usadas || 0))

      if (!telefono) {
        omitidas += 1
        continue
      }

      const { data: existente } = await supabaseAdmin
        .from('comunicaciones')
        .select('id')
        .eq('origen_tabla', 'clientes_planes')
        .eq('origen_id', item.id)
        .eq('tipo', 'plan_por_vencer')
        .in('estado', ['pendiente', 'programado', 'enviado'])
        .maybeSingle()

      if (existente?.id) {
        omitidas += 1
        continue
      }

      const mensaje = `Hola ${nombre}, tu plan ${plan} vence el ${formatDateShort(item.fecha_fin)}. Te quedan ${restantes} sesiones disponibles. Escríbenos para renovar o coordinar tus próximas sesiones.`

      const { error: insertError } = await supabaseAdmin
        .from('comunicaciones')
        .insert({
          cliente_id: item.cliente_id,
          titulo: 'Plan por vencer',
          asunto: 'Plan próximo a vencer',
          mensaje,
          tipo: 'plan_por_vencer',
          canal: 'whatsapp',
          estado: 'pendiente',
          destino: telefono,
          origen_tabla: 'clientes_planes',
          origen_id: item.id,
          plantilla: 'plan_por_vencer',
          prioridad: 'normal',
        })

      if (insertError) throw insertError
      creadas += 1
    }

    return NextResponse.json({
      ok: true,
      resumen: {
        encontradas: planes?.length || 0,
        creadas,
        omitidas,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Error generando planes por vencer',
      },
      { status: 500 }
    )
  }
}
