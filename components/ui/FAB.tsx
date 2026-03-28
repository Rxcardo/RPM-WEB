'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePermisos } from '@/lib/auth/PermisosContext'
import { PERMISOS } from '@/lib/auth/permisos'

type Action = {
  href: string
  label: string
  icon: string
  permiso?: string
}

const ACTIONS: Action[] = [
  { href: '/admin/operaciones/agenda/nueva', label: 'Nueva cita', icon: '📅', permiso: PERMISOS.CITAS_VER },
  { href: '/admin/personas/clientes/nuevo', label: 'Nuevo cliente', icon: '👤', permiso: PERMISOS.CLIENTES_VER },
]

export default function FAB() {
  const [isOpen, setIsOpen] = useState(false)
  const { tienePermiso } = usePermisos()

  const actions = useMemo(() => {
    return ACTIONS.filter((action) => {
      if (!action.permiso) return true
      return tienePermiso(action.permiso as any)
    })
  }, [tienePermiso])

  if (!actions.length) return null

  return (
    <div
      className="fixed bottom-20 right-4 z-40 lg:hidden"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 5rem)' }}
    >
      {isOpen && (
        <div className="mb-3 space-y-2">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              onClick={() => setIsOpen(false)}
              className="flex min-h-[48px] items-center gap-3 rounded-full border border-white/10 bg-[#11131a] px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-white/[0.08]"
            >
              <span>{action.icon}</span>
              <span>{action.label}</span>
            </Link>
          ))}
        </div>
      )}

      <button
        type="button"
        aria-label={isOpen ? 'Cerrar acciones rápidas' : 'Abrir acciones rápidas'}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl text-white shadow-lg transition hover:bg-emerald-600 active:scale-[0.98]"
      >
        {isOpen ? '✕' : '+'}
      </button>
    </div>
  )
}
