'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode, useEffect, useState } from 'react'
import { Home, CalendarDays, WalletCards, MessageCircle, UserRound } from 'lucide-react'

const navItems = [
  { href: '/empleado', label: 'Inicio', icon: Home },
  { href: '/empleado/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/empleado/quincena', label: 'Quincena', icon: WalletCards },
  { href: '/empleado/chat', label: 'Chat', icon: MessageCircle },
  { href: '/empleado/perfil', label: 'Perfil', icon: UserRound },
]

export default function EmpleadoLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('rpm-empleado-theme') as 'dark' | 'light' | null
    if (saved === 'light' || saved === 'dark') setTheme(saved)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.empleadoTheme = theme
  }, [theme])

  return (
    <div className={theme === 'dark' ? 'rpm-dark min-h-screen' : 'rpm-light min-h-screen'}>
      <style jsx global>{`
        .rpm-dark {
          --bg: #1b1b21;
          --bg2: #25252d;
          --card: rgba(52,52,61,.82);
          --card2: rgba(68,67,78,.72);
          --text: #ffffff;
          --muted: rgba(255,255,255,.58);
          --line: rgba(255,255,255,.11);
          --purple: #7c5cff;
          --purple2: #4f3a86;
          --purple3: #a78bfa;
          --shadow: 0 24px 80px rgba(0,0,0,.35);
        }
        .rpm-light {
          --bg: #f7f4ff;
          --bg2: #ffffff;
          --card: rgba(255,255,255,.9);
          --card2: rgba(244,240,255,.95);
          --text: #17141f;
          --muted: rgba(23,20,31,.58);
          --line: rgba(80,58,130,.13);
          --purple: #7c5cff;
          --purple2: #ede7ff;
          --purple3: #5e3ee8;
          --shadow: 0 22px 70px rgba(93,63,211,.16);
        }
        .empleado-shell {
          color: var(--text);
          background:
            radial-gradient(circle at 18% 0%, rgba(124,92,255,.24), transparent 32%),
            radial-gradient(circle at 90% 8%, rgba(167,139,250,.15), transparent 28%),
            linear-gradient(180deg, var(--bg), var(--bg2));
        }
        .glass-card {
          background: linear-gradient(145deg, var(--card), var(--card2));
          border: 1px solid var(--line);
          box-shadow: var(--shadow);
          backdrop-filter: blur(18px);
        }
        .purple-card {
          background:
            radial-gradient(circle at 85% 12%, rgba(167,139,250,.38), transparent 30%),
            linear-gradient(135deg, rgba(124,92,255,.72), rgba(60,50,81,.82));
          border: 1px solid rgba(255,255,255,.16);
          box-shadow: 0 24px 64px rgba(80,55,170,.26);
        }
        .rpm-input {
          background: rgba(255,255,255,.06);
          border: 1px solid var(--line);
          color: var(--text);
        }
        .rpm-muted { color: var(--muted); }
        .rpm-line { border-color: var(--line); }
      `}</style>

      <div className="empleado-shell min-h-screen px-4 py-5 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-[520px] flex-col rounded-[2.2rem] border border-white/10 bg-black/10 p-3 shadow-2xl backdrop-blur-xl sm:max-w-[980px] lg:max-w-[1180px]">
          <main className="flex-1 overflow-hidden rounded-[1.7rem] px-4 py-4 sm:px-6 sm:py-6">
            {children}
          </main>

          <nav className="glass-card mx-auto mb-1 grid w-full grid-cols-5 gap-2 rounded-[1.6rem] p-2 sm:max-w-[620px]">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold transition',
                    active
                      ? 'bg-[var(--purple)] text-white shadow-lg shadow-purple-900/25'
                      : 'text-[var(--muted)] hover:bg-white/8 hover:text-[var(--text)]',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </div>
  )
}
