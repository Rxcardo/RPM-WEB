'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CalendarDays, Home, MessageCircle, UserRound, WalletCards } from 'lucide-react'

type ThemeMode = 'dark' | 'light'

type NavItem = {
  href: string
  label: string
  icon: typeof Home
}

const navItems: NavItem[] = [
  { href: '/empleado', label: 'Inicio', icon: Home },
  { href: '/empleado/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/empleado/quincena', label: 'Quincena', icon: WalletCards },
  { href: '/empleado/chat', label: 'Chat', icon: MessageCircle },
  { href: '/empleado/perfil', label: 'Perfil', icon: UserRound },
]

export default function EmpleadoLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [theme, setTheme] = useState<ThemeMode>('dark')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('rpm-empleado-theme')
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved)
      }
    } catch {
      setTheme('dark')
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.empleadoTheme = theme
  }, [theme])

  const isDark = theme === 'dark'

  return (
    <div className={isDark ? 'rpm-dark' : 'rpm-light'}>
      <style jsx global>{`
        html,
        body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
          overscroll-behavior: none;
        }

        html[data-empleado-theme='dark'] {
          background-color: #1b1b21;
        }

        html[data-empleado-theme='light'] {
          background-color: #f7f4ff;
        }

        .rpm-dark {
          --bg: #1b1b21;
          --bg2: #25252d;
          --card: rgba(52, 52, 61, 0.82);
          --card2: rgba(68, 67, 78, 0.72);
          --text: #ffffff;
          --muted: rgba(255, 255, 255, 0.58);
          --line: rgba(255, 255, 255, 0.11);
          --purple: #7c5cff;
          --purple2: #4f3a86;
          --purple3: #a78bfa;
          --shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
        }

        .rpm-light {
          --bg: #f7f4ff;
          --bg2: #ffffff;
          --card: rgba(255, 255, 255, 0.9);
          --card2: rgba(244, 240, 255, 0.95);
          --text: #17141f;
          --muted: rgba(23, 20, 31, 0.58);
          --line: rgba(80, 58, 130, 0.13);
          --purple: #7c5cff;
          --purple2: #ede7ff;
          --purple3: #5e3ee8;
          --shadow: 0 22px 70px rgba(93, 63, 211, 0.16);
        }

        .empleado-shell {
          min-height: 100dvh;
          overflow-x: hidden;
          overscroll-behavior: none;
          color: var(--text);
          background:
            radial-gradient(circle at 18% 0%, rgba(124, 92, 255, 0.24), transparent 32%),
            radial-gradient(circle at 90% 8%, rgba(167, 139, 250, 0.15), transparent 28%),
            linear-gradient(180deg, var(--bg), var(--bg2));
        }

        .glass-card {
          background: linear-gradient(145deg, var(--card), var(--card2));
          border: 1px solid var(--line);
          box-shadow: var(--shadow);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .purple-card {
          background:
            radial-gradient(circle at 85% 12%, rgba(167, 139, 250, 0.38), transparent 30%),
            linear-gradient(135deg, rgba(124, 92, 255, 0.72), rgba(60, 50, 81, 0.82));
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 24px 64px rgba(80, 55, 170, 0.26);
        }

        .rpm-input {
          color: var(--text);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--line);
        }

        .rpm-muted {
          color: var(--muted);
        }

        .rpm-line {
          border-color: var(--line);
        }
      `}</style>

      <div className="empleado-shell">
        <div className="flex min-h-dvh flex-col px-3 py-4 sm:hidden">
          <main className="flex-1 overflow-hidden">{children}</main>

          <EmpleadoNav pathname={pathname} className="glass-card mt-3 grid w-full grid-cols-5 gap-1.5 rounded-[1.5rem] p-2" />
        </div>

        <div className="hidden min-h-dvh items-start justify-center px-6 py-5 sm:flex lg:px-8">
          <div className="flex w-full max-w-[980px] flex-col rounded-[2.2rem] border border-white/10 bg-black/10 p-3 shadow-2xl backdrop-blur-xl lg:max-w-[1180px]">
            <main className="flex-1 overflow-hidden rounded-[1.7rem] px-4 py-4 sm:px-6 sm:py-6">{children}</main>

            <EmpleadoNav pathname={pathname} className="glass-card mx-auto mb-1 mt-3 grid w-full grid-cols-5 gap-2 rounded-[1.6rem] p-2 sm:max-w-[620px]" />
          </div>
        </div>
      </div>
    </div>
  )
}

function EmpleadoNav({ pathname, className }: { pathname: string; className: string }) {
  return (
    <nav className={className}>
      {navItems.map((item) => {
        const Icon = item.icon
        const active = pathname === item.href || (item.href !== '/empleado' && pathname.startsWith(`${item.href}/`))

        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              'flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition',
              active
                ? 'bg-[var(--purple)] text-white shadow-lg shadow-purple-900/25'
                : 'text-[var(--muted)] hover:bg-white/10 hover:text-[var(--text)]',
            ].join(' ')}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
