import Link from 'next/link'

const items = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Clientes', href: '/admin/clientes' },
  { label: 'Agenda', href: '/admin/agenda' },
  { label: 'Personal', href: '/admin/personal' },
  { label: 'Servicios', href: '/admin/servicios' },
  { label: 'Planes', href: '/admin/planes' },
  { label: 'Reportes', href: '/admin/reportes' },
  { label: 'Comunicación', href: '/admin/comunicacion' },
]

export default function AdminSidebar() {
  return (
    <aside className="w-64 border-r border-black/10 bg-white p-4 hidden md:block">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900">RPM</h2>
        <p className="text-sm text-neutral-500">Panel administrativo</p>
      </div>

      <nav className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-xl px-4 py-3 text-sm font-medium text-neutral-700 hover:bg-violet-50 hover:text-violet-700 transition"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}