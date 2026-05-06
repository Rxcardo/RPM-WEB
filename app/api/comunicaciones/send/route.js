import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp } from '@/lib/whatsapp/sendWhatsApp'

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
    const now = new Date().toISOString()

    const { data: comunicaciones, error } = await supabaseAdmin
      .from('comunicaciones')
      .select('*')
      .eq('canal', 'whatsapp')
      .in('estado', ['pendiente', 'programado'])
      .or(`programado_para.is.null,programado_para.lte.${now}`)
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) throw error

    const resumen = {
      procesadas: comunicaciones?.length || 0,
      enviadas: 0,
      fallidas: 0,
    }

    for (const item of comunicaciones || []) {
      if (!item.destino || !item.mensaje) {
        await supabaseAdmin
          .from('comunicaciones')
          .update({
            estado: 'fallido',
            error_envio: 'Falta destino o mensaje',
          })
          .eq('id', item.id)

        resumen.fallidas += 1
        continue
      }

      const result = await sendWhatsApp({
        to: item.destino,
        body: item.mensaje,
      })

      if (result.ok) {
        await supabaseAdmin
          .from('comunicaciones')
          .update({
            estado: 'enviado',
            enviado_at: new Date().toISOString(),
            error_envio: null,
          })
          .eq('id', item.id)

        resumen.enviadas += 1
      } else {
        await supabaseAdmin
          .from('comunicaciones')
          .update({
            estado: 'fallido',
            error_envio: result.error || JSON.stringify(result.data || result),
          })
          .eq('id', item.id)

        resumen.fallidas += 1
      }
    }

    return NextResponse.json({ ok: true, resumen })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Error enviando comunicaciones',
      },
      { status: 500 }
    )
  }
}
