'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const sections = [
  {
    title: 'General',
    items: [
      { label: 'Dashboard', href: '/admin/dashboard' },
    ],
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
    items: [
      { label: 'Resumen', href: '/admin/finanzas' },
    ],
  },
  {
    title: 'Análisis',
    items: [
      { label: 'Reportes', href: '/admin/reportes' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { label: 'Configuración', href: '/admin/configuracion' },
    ],
  },
]

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <aside className="w-full h-full bg-[#0f0f17] text-white">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-700 shadow-lg" />

          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">
              RPM
            </p>
            <h2 className="text-xl font-semibold text-white">
              Admin
            </h2>
            <p className="text-sm text-white/45">
              Panel de gestión
            </p>
          </div>
        </div>
      </div>

      <nav className="px-4 py-5 space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/30">
              {section.title}
            </p>

            <div className="space-y-1.5">
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + '/')

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'group flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200',
                      active
                        ? 'bg-gradient-to-r from-purple-600/25 to-violet-600/20 text-white border border-purple-400/20 shadow-[0_0_0_1px_rgba(168,85,247,0.08)]'
                        : 'text-white/65 hover:text-white hover:bg-white/[0.04] border border-transparent hover:border-white/10',
                    ].join(' ')}
                  >
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}