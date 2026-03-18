'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'

export default function ConfiguracionPage() {
  const items = [
    {
      title: 'Parámetros del sistema',
      description: 'Nombre de clínica, moneda y porcentajes por defecto.',
      href: '/admin/configuracion/sistemas',
    },
    {
      title: 'Métodos de pago',
      description: 'Administra los métodos de pago disponibles.',
      href: '/admin/configuracion/metodos-pago',
    },
    {
      title: 'Categorías financieras',
      description: 'Organiza ingresos y egresos por categorías.',
      href: '/admin/configuracion/categorias-financieras',
    },
    {
      title: 'Automatismos',
      description: 'Ejecuta procesos internos como planes vencidos y agotados.',
      href: '/admin/configuracion/automatismos',
    },
  ]

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-6">
        <p className="text-sm text-slate-500">Configuración</p>
        <h1 className="text-2xl font-bold text-slate-900">Configuración RPM</h1>
        <p className="mt-1 text-sm text-slate-600">
          Módulos internos para administrar reglas y catálogos del sistema.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}