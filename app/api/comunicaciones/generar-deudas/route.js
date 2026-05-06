import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
    },
  }
)

function money(value) {
  const n = Number(value || 0)
  return n.toFixed(2)
}

export async function POST() {
  try {
    const { data: deudas, error } = await supabaseAdmin
      .from('cuentas_por_cobrar')
      .select(`
        id,
        cliente_id,
        concepto,
        saldo_usd,
        estado,
        clientes (
          id,
          nombre,
          telefono
        )
      `)
      .gt('saldo_usd', 0)
      .neq('estado', 'pagado')
      .order('fecha_vencimiento', { ascending: true })
      .limit(100)

    if (error) throw error

    let creadas = 0
    let omitidas = 0

    for (const deuda of deudas || []) {
      const telefono = deuda?.clientes?.telefono
      const nombre = deuda?.clientes?.nombre || 'cliente'
      const concepto = deuda?.concepto || 'saldo pendiente'

      if (!telefono) {
        omitidas += 1
        continue
      }

      const { data: existente } = await supabaseAdmin
        .from('comunicaciones')
        .select('id')
        .eq('origen_tabla', 'cuentas_por_cobrar')
        .eq('origen_id', deuda.id)
        .eq('tipo', 'deuda')
        .in('estado', ['pendiente', 'programado', 'enviado'])
        .maybeSingle()

      if (existente?.id) {
        omitidas += 1
        continue
      }

      const mensaje = `Hola ${nombre}, te escribimos de Recovery RPM. Actualmente tienes un saldo pendiente de ${money(deuda.saldo_usd)} USD correspondiente a ${concepto}. Puedes realizar tu pago y confirmarlo por este medio.`

      const { error: insertError } = await supabaseAdmin
        .from('comunicaciones')
        .insert({
          cliente_id: deuda.cliente_id,
          titulo: 'Deuda pendiente',
          asunto: 'Saldo pendiente',
          mensaje,
          tipo: 'deuda',
          canal: 'whatsapp',
          estado: 'pendiente',
          destino: telefono,
          origen_tabla: 'cuentas_por_cobrar',
          origen_id: deuda.id,
          plantilla: 'deuda_pendiente',
          prioridad: 'alta',
        })

      if (insertError) throw insertError
      creadas += 1
    }

    return NextResponse.json({
      ok: true,
      resumen: {
        encontradas: deudas?.length || 0,
        creadas,
        omitidas,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Error generando deudas',
      },
      { status: 500 }
    )
  }
}
