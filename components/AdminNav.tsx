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
      { label: 'Resumen', href: '/admin/finanzas/resumen' },
      { label: 'Ingresos', href: '/admin/finanzas/ingresos' },
      { label: 'Egresos', href: '/admin/finanzas/egresos' },
      { label: 'Comisiones', href: '/admin/finanzas/comisiones' },
      { label: 'Cuentas por cobrar', href: '/admin/finanzas/cuentas-por-cobrar' },
      { label: 'Cierres', href: '/admin/finanzas/cierres' },
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
    <aside className="w-full lg:w-72 shrink-0 border-r border-slate-200 bg-white min-h-screen">
      <div className="border-b border-slate-200 px-5 py-5">
        <h2 className="text-xl font-bold text-slate-900">Admin RPM</h2>
        <p className="mt-1 text-sm text-slate-500">Panel de gestión</p>
      </div>

      <nav className="p-3 space-y-5">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {section.title}
            </p>

            <div className="space-y-1">
              {section.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + '/')

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
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