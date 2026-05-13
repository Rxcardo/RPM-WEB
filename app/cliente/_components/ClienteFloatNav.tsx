'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Home, MessageCircle, UserRound } from 'lucide-react'

const items = [
  { href: '/cliente/dashboard', label: 'Inicio', icon: Home },
  { href: '/cliente/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/cliente/comunicacion', label: 'Chat', icon: MessageCircle },
  { href: '/cliente/perfil', label: 'Perfil', icon: UserRound },
]

export default function ClienteFloatNav() {
  const pathname = usePathname()

  return (
    <nav className="cliente-float-nav" aria-label="Navegación del portal cliente">
      {items.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`cliente-nav-item ${active ? 'active' : ''}`}
          >
            <Icon size={19} strokeWidth={2.4} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
