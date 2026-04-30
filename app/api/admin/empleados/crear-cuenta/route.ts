import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizarRole(role: string | undefined) {
  const value = (role || 'terapeuta').trim().toLowerCase()

  if (value === 'fisioterapeuta') return 'terapeuta'
  if (value === 'fisio') return 'terapeuta'
  if (value === 'terapeuta') return 'terapeuta'
  if (value === 'recepcion') return 'recepcionista'
  if (value === 'recepcionista') return 'recepcionista'
  if (value === 'admin') return 'admin'
  if (value === 'cliente') return 'cliente'

  return 'terapeuta'
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      empleado_id,
      email,
      password,
      nombre,
      role,
    } = body

    const roleFinal = normalizarRole(role)

    // 1. Crear usuario en Auth
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 400 })
    }

    const userId = userData.user.id

    // 2. Crear profile (YA NORMALIZADO)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        full_name: nombre,
        role: roleFinal,
      })

    if (profileError) {
      return NextResponse.json(
        { error: 'Error profiles: ' + profileError.message },
        { status: 400 }
      )
    }

    // 3. Vincular con empleados
    const { error: empleadoError } = await supabaseAdmin
      .from('empleados')
      .update({
        auth_user_id: userId,
        email: email,
        rol: roleFinal,
      })
      .eq('id', empleado_id)

    if (empleadoError) {
      return NextResponse.json(
        { error: 'Error empleado: ' + empleadoError.message },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    )
  }
}