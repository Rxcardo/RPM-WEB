'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePermisos } from '@/lib/auth/PermisosContext'
import { PERMISOS } from '@/lib/auth/permisos'

type NavItem = {
  href: string
  label: string
  icon: string
  permiso?: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Inicio', icon: '🏠' },
  { href: '/admin/operaciones/agenda', label: 'Agenda', icon: '📅', permiso: PERMISOS.CITAS_VER },
  { href: '/admin/personas/clientes', label: 'Clientes', icon: '👥', permiso: PERMISOS.CLIENTES_VER },
  { href: '/admin/finanzas', label: 'Finanzas', icon: '💰', permiso: PERMISOS.FINANZAS_VER },
]

function isRouteActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function BottomNav() {
  const pathname = usePathname()
  const { tienePermiso } = usePermisos()

  const items = useMemo(() => {
    return NAV_ITEMS.filter((item) => {
      if (!item.permiso) return true
      return tienePermiso(item.permiso as any)
    })
  }, [tienePermiso])

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#11131a]/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-4">
        {items.map((item) => {
          const active = isRouteActive(pathname, item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-[60px] flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] transition ${
                active ? 'text-white' : 'text-white/45'
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="truncate font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}