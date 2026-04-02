'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { usePermisos } from '@/lib/auth/PermisosContext'
import { PERMISOS } from '@/lib/auth/permisos'

type SidebarLink = {
  href: string
  label: string
  icon: string
  permiso?: string
}

const LINKS: SidebarLink[] = [
  { href: '/admin', label: 'Dashboard', icon: '📊' },
  { href: '/admin/personas/clientes', label: 'Clientes', icon: '👥', permiso: PERMISOS.CLIENTES_VER },
  { href: '/admin/operaciones/agenda', label: 'Agenda', icon: '📅', permiso: PERMISOS.CITAS_VER },
  { href: '/admin/finanzas', label: 'Finanzas', icon: '💰', permiso: PERMISOS.FINANZAS_VER },
  { href: '/admin/reportes', label: 'Reportes', icon: '📈', permiso: PERMISOS.REPORTES_VER },
  { href: '/admin/personas/personal', label: 'Personal', icon: '👨‍💼', permiso: PERMISOS.PERSONAL_VER },
]

function isRouteActive(pathname: string, href: string) {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function MobileSidebar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const { tienePermiso } = usePermisos()

  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!isOpen) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const linksVisibles = useMemo(() => {
    return LINKS.filter((link) => {
      if (!link.permiso) return true
      return tienePermiso(link.permiso as any)
    })
  }, [tienePermiso])

  return (
    <>
      <button
        type="button"
        aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed left-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#11131a]/95 text-white shadow-lg backdrop-blur lg:hidden"
      >
        <span className="text-lg">{isOpen ? '✕' : '☰'}</span>
      </button>

      {isOpen && (
        <button
          type="button"
          aria-label="Cerrar menú lateral"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-dvh w-[82%] max-w-72 border-r border-white/10 bg-[#11131a] shadow-2xl transition-transform duration-300 lg:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!isOpen}
      >
        <div className="border-b border-white/10 px-5 pb-4 pt-6">
          <h2 className="text-lg font-bold text-white">RPM </h2>
          <p className="mt-1 text-xs text-white/55">Sistema de gestión</p>
        </div>

        <nav className="px-3 py-4">
          {linksVisibles.map((link) => {
            const active = isRouteActive(pathname, link.href)

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`mb-1 flex min-h-[48px] items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="text-lg">{link.icon}</span>
                <span>{link.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}