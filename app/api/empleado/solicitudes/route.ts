import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

function supabaseFromRequest(req: NextRequest, res: NextResponse) {
  return createServerClient(
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
}

export async function POST(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = supabaseFromRequest(req, res)

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const tipo = String(body?.tipo ?? 'general').trim() || 'general'
  const mensaje = String(body?.mensaje ?? '').trim()
  const clienteId = body?.cliente_id ? String(body.cliente_id) : null

  if (!mensaje) {
    return NextResponse.json({ error: 'Falta el mensaje' }, { status: 400 })
  }

  const { data: empleado, error: empleadoError } = await supabase
    .from('empleados')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (empleadoError || !empleado) {
    return NextResponse.json({ error: 'Empleado no vinculado' }, { status: 403 })
  }

  if (clienteId) {
    const { data: relacionado, error: relError } = await supabase
      .from('clientes')
      .select('id')
      .eq('id', clienteId)
      .or(`terapeuta_id.eq.${empleado.id},empleado_id.eq.${empleado.id}`)
      .maybeSingle()

    if (relError) {
      return NextResponse.json({ error: relError.message }, { status: 500 })
    }

    if (!relacionado) {
      return NextResponse.json({ error: 'Cliente no relacionado al empleado' }, { status: 403 })
    }
  }

  const { data, error } = await supabase
    .from('empleados_solicitudes')
    .insert({
      empleado_id: empleado.id,
      cliente_id: clienteId,
      tipo,
      mensaje,
      estado: 'pendiente',
      created_by: user.id,
    })
    .select('*')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, data })
}
