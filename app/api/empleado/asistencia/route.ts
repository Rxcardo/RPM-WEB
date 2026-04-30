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

function hoyLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
  const estado = String(body?.estado ?? '').trim()
  const fecha = String(body?.fecha ?? hoyLocal()).trim()
  const observaciones = body?.observaciones ? String(body.observaciones) : null

  if (!['presente', 'ausente', 'tarde'].includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 })
  }

  const { data: empleado, error: empleadoError } = await supabase
    .from('empleados')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (empleadoError || !empleado) {
    return NextResponse.json({ error: 'Empleado no vinculado' }, { status: 403 })
  }

  const payload = {
    empleado_id: empleado.id,
    fecha,
    estado,
    observaciones,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
    created_by: user.id,
  }

  const { data, error } = await supabase
    .from('empleados_asistencia')
    .upsert(payload, { onConflict: 'empleado_id,fecha' })
    .select('*')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, data })
}
