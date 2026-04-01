import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type NombreRol = 'admin' | 'recepcionista' | 'terapeuta' | 'cliente'

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
          res.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: Record<string, any>) {
          res.cookies.set({
            name,
            value: '',
            ...options,
          })
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
  const isLogin = pathname === '/login'

  if (!user && (isAdminArea || isClienteArea)) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }

  if (!user) return res

  const { data: empleado } = await supabase
    .from('empleados')
    .select('id, roles:rol_id(nombre)')
    .eq('id', user.id)
    .single()

  const rol = empleado?.roles?.nombre as NombreRol | undefined

  if (!rol && (isAdminArea || isClienteArea)) {
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

    redirectUrl.pathname = '/admin'
    return NextResponse.redirect(redirectUrl)
  }

  if (isAdminArea) {
    if (rol === 'admin' || rol === 'recepcionista' || rol === 'terapeuta') {
      return res
    }

    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/sin-acceso'
    return NextResponse.redirect(redirectUrl)
  }

  if (isClienteArea) {
    if (rol === 'cliente') {
      return res
    }

    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/sin-acceso'
    return NextResponse.redirect(redirectUrl)
  }

  return res
}

export const config = {
  matcher: ['/admin/:path*', '/cliente/:path*', '/login'],
}