import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

type AsistenciaEstado = 'pendiente' | 'asistio' | 'no_asistio_aviso' | 'no_asistio_sin_aviso'

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

function normalizarEstado(value: string): AsistenciaEstado | null {
  const estado = value.trim().toLowerCase()

  if (estado === 'asistio') return 'asistio'
  if (estado === 'no_asistio_aviso') return 'no_asistio_aviso'
  if (estado === 'no_asistio_sin_aviso') return 'no_asistio_sin_aviso'
  if (estado === 'pendiente') return 'pendiente'

  // Compatibilidad con la primera versión del portal empleado.
  if (estado === 'no_asistio') return 'no_asistio_sin_aviso'

  return null
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
  const sesionId = String(body?.sesion_id || body?.entrenamiento_id || '').trim()
  const asistenciaEstado = normalizarEstado(String(body?.asistencia_estado || ''))
  const motivo = body?.motivo ? String(body.motivo) : null

  if (!sesionId) {
    return NextResponse.json({ error: 'Falta sesion_id' }, { status: 400 })
  }

  if (!asistenciaEstado) {
    return NextResponse.json({ error: 'Estado de asistencia inválido' }, { status: 400 })
  }

  const { data: empleado, error: empleadoError } = await supabase
    .from('empleados')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (empleadoError || !empleado) {
    return NextResponse.json({ error: 'Empleado no vinculado' }, { status: 403 })
  }

  const { data: sesion, error: sesionError } = await supabase
    .from('v_entrenamientos_plan_asistencia')
    .select('id, empleado_id')
    .eq('id', sesionId)
    .maybeSingle()

  if (sesionError) {
    return NextResponse.json({ error: sesionError.message }, { status: 500 })
  }

  if (!sesion || sesion.empleado_id !== empleado.id) {
    return NextResponse.json({ error: 'Esta sesión no pertenece al empleado autenticado' }, { status: 403 })
  }

  const { data, error } = await supabase.rpc('marcar_asistencia_entrenamiento', {
    p_entrenamiento_id: sesionId,
    p_asistencia_estado: asistenciaEstado,
    p_motivo: motivo,
    p_marcado_por: user.id,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, data })
}
