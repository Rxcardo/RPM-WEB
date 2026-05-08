'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Home, MessageCircle, UserRound, WalletCards } from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: typeof Home
}

const navItems: NavItem[] = [
  { href: '/empleado',          label: 'Inicio',   icon: Home },
  { href: '/empleado/agenda',   label: 'Agenda',   icon: CalendarDays },
  { href: '/empleado/quincena', label: 'Quincena', icon: WalletCards },
  { href: '/empleado/chat',     label: 'Chat',     icon: MessageCircle },
  { href: '/empleado/perfil',   label: 'Perfil',   icon: UserRound },
]

export default function EmpleadoFloatNav() {
  const pathname = usePathname()

  return (
    <nav className="empleado-float-nav">
      {navItems.map((item) => {
        const Icon = item.icon
        const active =
          pathname === item.href ||
          (item.href !== '/empleado' && pathname.startsWith(`${item.href}/`))

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`empleado-nav-item${active ? ' active' : ''}`}
          >
            <Icon size={17} strokeWidth={active ? 2.5 : 1.9} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}