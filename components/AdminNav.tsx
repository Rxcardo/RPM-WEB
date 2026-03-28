'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

const sections = [
  {
    title: 'General',
    items: [{ label: 'Dashboard', href: '/admin/dashboard' }],
  },
  {
    title: 'Operaciones',
    items: [
      { label: 'Agenda', href: '/admin/operaciones/agenda' },
      { label: 'Servicios', href: '/admin/operaciones/servicios' },
      { label: 'Recursos', href: '/admin/operaciones/recursos' },
      { label: 'Planes', href: '/admin/operaciones/planes' },
    ],
  },
  {
    title: 'Personas',
    items: [
      { label: 'Clientes', href: '/admin/personas/clientes' },
      { label: 'Personal', href: '/admin/personas/personal' },
      { label: 'Comunicación', href: '/admin/personas/comunicacion' },
    ],
  },
  {
    title: 'Finanzas',
    items: [{ label: 'Resumen', href: '/admin/finanzas' }],
  },
  {
    title: 'Análisis',
    items: [{ label: 'Reportes', href: '/admin/reportes' }],
  },
]

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-white/10 bg-[#0b0b12] text-white">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#171726] to-[#11111a] shadow-lg">
            <img
              src="/favicon.ico"
              alt="RPM"
              className="h-10 w-10 object-contain"
            />
          </div>

          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/35">
              RPM
            </p>
            <h2 className="truncate text-xl font-semibold text-white">
              Admin
            </h2>
            <p className="text-sm text-white/45">
              Panel de gestión
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/28">
              {section.title}
            </p>

            <div className="space-y-2">
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + '/')

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'group relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200',
                      active
                        ? 'border border-violet-400/20 bg-gradient-to-r from-violet-600/20 via-purple-500/15 to-fuchsia-500/10 text-white shadow-[0_0_0_1px_rgba(168,85,247,0.08),0_12px_30px_rgba(76,29,149,0.18)]'
                        : 'border border-transparent text-white/65 hover:border-white/10 hover:bg-white/[0.04] hover:text-white',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'h-2.5 w-2.5 rounded-full transition-all duration-200',
                        active
                          ? 'bg-violet-400 shadow-[0_0_16px_rgba(167,139,250,0.95)]'
                          : 'bg-white/20 group-hover:bg-white/45',
                      ].join(' ')}
                    />

                    <span className="truncate">{item.label}</span>

                    {active && (
                      <span className="absolute right-3 h-2 w-2 rounded-full bg-fuchsia-400 shadow-[0_0_14px_rgba(232,121,249,0.95)]" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-3">
            <p className="text-xs uppercase tracking-[0.22em] text-white/30">
              Sesión
            </p>
            <p className="mt-1 text-sm text-white/55">
              Gestiona tu acceso al panel.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center justify-center rounded-2xl border border-red-400/15 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-400/25 hover:bg-red-500/15 hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  )
}