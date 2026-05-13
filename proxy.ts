import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type NombreRol = 'admin' | 'recepcionista' | 'terapeuta' | 'cliente'

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function getRolNombre(empleado: any): NombreRol | undefined {
  const rolRelacionado = firstOrNull(empleado?.roles)
  const nombre = rolRelacionado?.nombre ?? empleado?.rol

  if (
    nombre === 'admin' ||
    nombre === 'recepcionista' ||
    nombre === 'terapeuta' ||
    nombre === 'cliente'
  ) {
    return nombre
  }

  return undefined
}

export async function proxy(req: NextRequest) {
  let res = NextResponse.next()

  const supabase = createServerClient(
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

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = req.nextUrl.pathname

  const isAdminArea = pathname.startsWith('/admin')
  const isClienteArea = pathname.startsWith('/cliente')
  const isEmpleadoArea = pathname.startsWith('/empleado')
  const isLogin = pathname === '/login'

  if (!user && (isAdminArea || isClienteArea || isEmpleadoArea)) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }

  if (!user) return res

  const { data: empleado } = await supabase
    .from('empleados')
    .select('id, auth_user_id, rol, roles:rol_id(nombre)')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  let rol = getRolNombre(empleado)

  if (!rol) {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, auth_user_id, acceso_portal, estado')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (
      cliente &&
      cliente.acceso_portal === true &&
      cliente.estado !== 'eliminado'
    ) {
      rol = 'cliente'
    }
  }

  if (!rol && (isAdminArea || isClienteArea || isEmpleadoArea)) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/sin-acceso'
    return NextResponse.redirect(redirectUrl)
  }

  if (isLogin && rol) {
    const redirectUrl = req.nextUrl.clone()

    if (rol === 'cliente') {
      redirectUrl.pathname = '/cliente'
      return NextResponse.redirect(redirectUrl)
    }

    if (rol === 'terapeuta') {
      redirectUrl.pathname = '/empleado'
      return NextResponse.redirect(redirectUrl)
    }

    redirectUrl.pathname = '/admin'
    return NextResponse.redirect(redirectUrl)
  }

  if (isAdminArea) {
    if (rol === 'admin' || rol === 'recepcionista') return res

    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = rol === 'terapeuta' ? '/empleado' : '/sin-acceso'
    return NextResponse.redirect(redirectUrl)
  }

  if (isEmpleadoArea) {
    if (rol === 'terapeuta' || rol === 'admin' || rol === 'recepcionista') {
      return res
    }

    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/sin-acceso'
    return NextResponse.redirect(redirectUrl)
  }

  if (isClienteArea) {
    if (rol === 'cliente') return res

    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/sin-acceso'
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*', '/cliente/:path*', '/empleado/:path*', '/login'],
}