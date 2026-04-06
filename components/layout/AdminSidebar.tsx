'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useState, type ComponentType } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  BarChart3,
  Briefcase,
  Calendar,
  ChevronDown,
  DollarSign,
  FileText,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  PlusCircle,
  Receipt,
  Settings2,
  Shield,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'

type IconType = ComponentType<{ className?: string }>
type SubItem = { label: string; href: string; icon: IconType; description?: string }
type NavItem = { label: string; href?: string; icon: IconType; children?: SubItem[] }

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    children: [
      { label: 'Clientes', href: '/admin/personas/clientes', icon: Users, description: 'Ir a clientes' },
      { label: 'Agenda', href: '/admin/operaciones/agenda', icon: Calendar, description: 'Ver agenda general' },
      { label: 'Finanzas', href: '/admin/finanzas', icon: DollarSign, description: 'Ir a finanzas' },
      { label: 'Personal', href: '/admin/personas/personal', icon: Shield, description: 'Gestionar personal' },
    ],
  },
  {
    label: 'Agenda',
    href: '/admin/operaciones/agenda',
    icon: Calendar,
    children: [
      { label: 'Nueva', href: '/admin/operaciones/agenda/nueva', icon: PlusCircle, description: 'Crear nueva agenda' },
    ],
  },
  {
    label: 'Operaciones',
    icon: Settings2,
    children: [
      { label: 'Servicios', href: '/admin/operaciones/servicios', icon: Briefcase, description: 'Gestionar servicios' },
      { label: 'Planes', href: '/admin/operaciones/planes', icon: Package, description: 'Gestionar planes' },
      { label: 'Recursos', href: '/admin/operaciones/recursos', icon: Settings2, description: 'Gestionar recursos' },
    ],
  },
  {
    label: 'Clientes',
    href: '/admin/personas/clientes',
    icon: Users,
    children: [
      { label: 'Nuevo', href: '/admin/personas/clientes/nuevo', icon: UserPlus, description: 'Registrar nuevo cliente' },
    ],
  },
  {
    label: 'Personal',
    href: '/admin/personas/personal',
    icon: Shield,
    children: [
      { label: 'Nuevo', href: '/admin/personas/personal/nuevo', icon: UserPlus, description: 'Registrar nuevo personal' },
    ],
  },
  {
    label: 'Comunicación',
    href: '/admin/personas/comunicacion',
    icon: Megaphone,
  },
  {
    label: 'Asistencia',
    href: '/admin/operaciones/asistencia',
    icon: Activity,
  },
  {
    label: 'Finanzas',
    href: '/admin/finanzas',
    icon: Wallet,
    children: [
      { label: 'Ingresos', href: '/admin/finanzas/ingresos', icon: DollarSign, description: 'Registrar y ver ingresos' },
      { label: 'Egresos', href: '/admin/finanzas/egresos', icon: Receipt, description: 'Registrar y ver egresos' },
      { label: 'Inventario', href: '/admin/finanzas/inventario', icon: Package, description: 'Control de inventario' },
      { label: 'Cobranzas', href: '/admin/cobranzas', icon: BarChart3, description: 'Seguimiento de cobranzas' },
    ],
  },
  { label: 'Reportes', href: '/admin/reportes', icon: FileText },
]

function pathMatches(pathname: string, href?: string) {
  if (!href) return false
  return pathname === href || pathname.startsWith(`${href}/`)
}

function DesktopNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const [isHovered, setIsHovered] = useState(false)
  const active =
    (item.href && pathMatches(pathname, item.href)) ||
    item.children?.some((c) => pathMatches(pathname, c.href))
  const Icon = item.icon

  const buttonClass = `
    inline-flex h-11 items-center gap-2.5 rounded-2xl border px-4 text-sm font-medium transition-all duration-200
    ${
      active || isHovered
        ? 'border-violet-400/20 bg-gradient-to-r from-violet-600/20 via-purple-500/15 to-fuchsia-500/10 text-white shadow-[0_0_0_1px_rgba(168,85,247,0.08),0_12px_30px_rgba(76,29,149,0.18)]'
        : 'border-white/10 bg-white/[0.03] text-white/70 hover:border-white/15 hover:bg-white/[0.05] hover:text-white'
    }
  `

  return (
    <div
      className="relative py-4"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={item.href || '#'} className={buttonClass}>
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
        {item.children && (
          <ChevronDown className={`h-4 w-4 transition-transform ${isHovered ? 'rotate-180' : ''}`} />
        )}
      </Link>

      <AnimatePresence>
        {item.children && isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute left-0 top-full z-[120] pt-2"
          >
            <div className="w-[340px] rounded-3xl border border-white/10 bg-[#101019]/96 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
              <div className="mb-2 px-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/30">
                  {item.label}
                </p>
              </div>

              <div className="space-y-1.5">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={`flex items-start gap-3 rounded-2xl border px-3 py-3 transition-all duration-200 ${
                      pathMatches(pathname, child.href)
                        ? 'border-violet-400/20 bg-gradient-to-r from-violet-600/20 via-purple-500/10 to-fuchsia-500/10 text-white'
                        : 'border-transparent bg-white/[0.02] text-white/75 hover:border-white/10 hover:bg-white/[0.05] hover:text-white'
                    }`}
                  >
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                      <child.icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{child.label}</p>
                      {child.description ? (
                        <p className="mt-0.5 text-xs text-white/45">{child.description}</p>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <div className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0b0b12]/92 backdrop-blur-2xl">
      <div className="mx-auto flex h-[78px] max-w-[1720px] items-center justify-between gap-6 px-6">
        <Link href="/admin/dashboard" className="flex shrink-0 items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white shadow-xl">
            <img src="/favicon.ico" alt="RPM" className="h-8 w-8 object-contain" />
          </div>

          <div className="min-w-0">
            <p className="mb-1 text-[10px] uppercase tracking-[0.28em] text-white/28 leading-none">
              RPM
            </p>
            <h2 className="truncate text-base font-semibold text-white leading-none">Admin</h2>
          </div>
        </Link>

        <nav className="flex flex-1 items-center justify-center gap-2">
          {navItems.map((item) => (
            <DesktopNavItem key={item.label} item={item} pathname={pathname} />
          ))}
        </nav>

        <div className="shrink-0">
          <button
            onClick={handleSignOut}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-red-400/15 bg-red-500/10 px-4 text-sm font-semibold text-red-200 transition hover:border-red-400/25 hover:bg-red-500/15 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </div>
  )
}