import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { formatTimeShort } from '@/lib/whatsapp/templates'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
  }
)

export async function POST() {
  try {
    const today = new Date().toISOString().slice(0, 10)

    const { data: citas, error } = await supabaseAdmin
      .from('citas')
      .select(`
        id,
        cliente_id,
        servicio_id,
        fecha,
        hora_inicio,
        estado,
        clientes (
          id,
          nombre,
          telefono
        ),
        servicios (
          id,
          nombre
        )
      `)
      .eq('fecha', today)
      .not('estado', 'in', '(cancelada,cancelado)')
      .order('hora_inicio', { ascending: true })
      .limit(150)

    if (error) throw error

    let creadas = 0
    let omitidas = 0

    for (const cita of citas || []) {
      const telefono = cita?.clientes?.telefono
      const nombre = cita?.clientes?.nombre || 'cliente'
      const servicio = cita?.servicios?.nombre || 'tu sesión'
      const hora = formatTimeShort(cita.hora_inicio)

      if (!telefono) {
        omitidas += 1
        continue
      }

      const { data: existente } = await supabaseAdmin
        .from('comunicaciones')
        .select('id')
        .eq('origen_tabla', 'citas')
        .eq('origen_id', cita.id)
        .eq('tipo', 'cita_hoy')
        .in('estado', ['pendiente', 'programado', 'enviado'])
        .maybeSingle()

      if (existente?.id) {
        omitidas += 1
        continue
      }

      const mensaje = `Hola ${nombre}, te recordamos que tienes una cita hoy a las ${hora} para ${servicio}. Por favor confirma tu asistencia.`

      const { error: insertError } = await supabaseAdmin
        .from('comunicaciones')
        .insert({
          cliente_id: cita.cliente_id,
          titulo: 'Cita de hoy',
          asunto: 'Recordatorio de cita',
          mensaje,
          tipo: 'cita_hoy',
          canal: 'whatsapp',
          estado: 'pendiente',
          destino: telefono,
          origen_tabla: 'citas',
          origen_id: cita.id,
          plantilla: 'cita_hoy',
          prioridad: 'normal',
        })

      if (insertError) throw insertError
      creadas += 1
    }

    return NextResponse.json({
      ok: true,
      resumen: {
        encontradas: citas?.length || 0,
        creadas,
        omitidas,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Error generando citas del día',
      },
      { status: 500 }
    )
  }
}
