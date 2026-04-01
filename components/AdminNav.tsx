'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  BarChart3,
  Briefcase,
  Calendar,
  ChevronDown,
  DollarSign,
  FileText,
  Megaphone,
  Package,
  PlusCircle,
  Receipt,
  Settings2,
  Shield,
  UserPlus,
  Users,
  Wallet,
  LogOut,
  LayoutDashboard,
} from 'lucide-react'

type SubItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  description?: string
}

type NavItem = {
  label: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  children?: SubItem[]
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    children: [
      {
        label: 'Clientes',
        href: '/admin/personas/clientes',
        icon: Users,
        description: 'Ir al módulo de clientes',
      },
      {
        label: 'Agenda',
        href: '/admin/operaciones/agenda',
        icon: Calendar,
        description: 'Ver agenda general',
      },
      {
        label: 'Finanzas',
        href: '/admin/finanzas',
        icon: DollarSign,
        description: 'Ir al resumen financiero',
      },
      {
        label: 'Personal',
        href: '/admin/personas/personal',
        icon: Shield,
        description: 'Gestionar personal',
      },
    ],
  },
  {
    label: 'Agenda',
    href: '/admin/operaciones/agenda',
    icon: Calendar,
    children: [
      {
        label: 'Nueva',
        href: '/admin/operaciones/agenda/nueva',
        icon: PlusCircle,
        description: 'Crear una nueva cita o bloque',
      },
    ],
  },
  {
    label: 'Operaciones',
    icon: Settings2,
    children: [
      {
        label: 'Servicios',
        href: '/admin/operaciones/servicios',
        icon: Briefcase,
        description: 'Gestionar servicios',
      },
      {
        label: 'Planes',
        href: '/admin/operaciones/planes',
        icon: Package,
        description: 'Gestionar planes',
      },
      {
        label: 'Recursos',
        href: '/admin/operaciones/recursos',
        icon: Settings2,
        description: 'Gestionar recursos',
      },
    ],
  },
  {
    label: 'Clientes',
    href: '/admin/personas/clientes',
    icon: Users,
    children: [
      {
        label: 'Nuevo',
        href: '/admin/personas/clientes/nuevo',
        icon: UserPlus,
        description: 'Registrar nuevo cliente',
      },
    ],
  },
  {
    label: 'Personal',
    href: '/admin/personas/personal',
    icon: Shield,
  },
  {
    label: 'Comunicación',
    href: '/admin/personas/comunicacion',
    icon: Megaphone,
  },
  {
    label: 'Finanzas',
    href: '/admin/finanzas',
    icon: Wallet,
    children: [
      {
        label: 'Ingresos',
        href: '/admin/finanzas/ingresos',
        icon: DollarSign,
        description: 'Registrar y ver ingresos',
      },
      {
        label: 'Egresos',
        href: '/admin/finanzas/egresos',
        icon: Receipt,
        description: 'Registrar y ver egresos',
      },
      {
        label: 'Inventario',
        href: '/admin/finanzas/inventario',
        icon: Package,
        description: 'Control de inventario',
      },
      {
        label: 'Cobranzas',
        href: '/admin/cobranzas',
        icon: BarChart3,
        description: 'Seguimiento de cobranzas',
      },
    ],
  },
  {
    label: 'Reportes',
    href: '/admin/reportes',
    icon: FileText,
  },
]

const mobileItems = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Agenda', href: '/admin/operaciones/agenda' },
  { label: 'Clientes', href: '/admin/personas/clientes' },
  { label: 'Finanzas', href: '/admin/finanzas' },
  { label: 'Reportes', href: '/admin/reportes' },
]

function pathMatches(pathname: string, href?: string) {
  if (!href) return false
  return pathname === href || pathname.startsWith(href + '/')
}

function itemIsActive(pathname: string, item: NavItem) {
  if (item.href && pathMatches(pathname, item.href)) return true
  if (item.children?.some((child) => pathMatches(pathname, child.href))) return true
  return false
}

function DesktopNavItem({
  item,
  pathname,
}: {
  item: NavItem
  pathname: string
}) {
  const active = itemIsActive(pathname, item)
  const Icon = item.icon
  const hasChildren = Boolean(item.children?.length)

  if (!hasChildren && item.href) {
    return (
      <Link
        href={item.href}
        className={[
          'group relative inline-flex h-11 items-center gap-2.5 rounded-2xl border px-4 text-sm font-medium transition-all duration-200',
          active
            ? 'border-violet-400/20 bg-gradient-to-r from-violet-600/20 via-purple-500/15 to-fuchsia-500/10 text-white shadow-[0_0_0_1px_rgba(168,85,247,0.08),0_12px_30px_rgba(76,29,149,0.18)]'
            : 'border-white/10 bg-white/[0.03] text-white/72 hover:border-white/15 hover:bg-white/[0.05] hover:text-white',
        ].join(' ')}
      >
        <Icon className="h-4 w-4" />
        <span>{item.label}</span>
      </Link>
    )
  }

  return (
    <div className="group relative">
      {item.href ? (
        <Link
          href={item.href}
          className={[
            'inline-flex h-11 items-center gap-2.5 rounded-2xl border px-4 text-sm font-medium transition-all duration-200',
            active
              ? 'border-violet-400/20 bg-gradient-to-r from-violet-600/20 via-purple-500/15 to-fuchsia-500/10 text-white shadow-[0_0_0_1px_rgba(168,85,247,0.08),0_12px_30px_rgba(76,29,149,0.18)]'
              : 'border-white/10 bg-white/[0.03] text-white/72 hover:border-white/15 hover:bg-white/[0.05] hover:text-white',
          ].join(' ')}
        >
          <Icon className="h-4 w-4" />
          <span>{item.label}</span>
          <ChevronDown className="h-4 w-4 text-white/45 transition group-hover:text-white/75" />
        </Link>
      ) : (
        <button
          type="button"
          className={[
            'inline-flex h-11 items-center gap-2.5 rounded-2xl border px-4 text-sm font-medium transition-all duration-200',
            active
              ? 'border-violet-400/20 bg-gradient-to-r from-violet-600/20 via-purple-500/15 to-fuchsia-500/10 text-white shadow-[0_0_0_1px_rgba(168,85,247,0.08),0_12px_30px_rgba(76,29,149,0.18)]'
              : 'border-white/10 bg-white/[0.03] text-white/72 hover:border-white/15 hover:bg-white/[0.05] hover:text-white',
          ].join(' ')}
        >
          <Icon className="h-4 w-4" />
          <span>{item.label}</span>
          <ChevronDown className="h-4 w-4 text-white/45 transition group-hover:text-white/75" />
        </button>
      )}

      <div className="pointer-events-none absolute left-0 top-full z-50 pt-3 opacity-0 translate-y-2 transition-all duration-200 group-hover:pointer-events-auto group-hover:opacity-100 group-hover:translate-y-0">
        <div className="w-[320px] rounded-3xl border border-white/10 bg-[#101019]/95 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
          <div className="mb-2 px-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/30">
              {item.label}
            </p>
          </div>

          <div className="space-y-1.5">
            {item.children?.map((child) => {
              const ChildIcon = child.icon
              const childActive = pathMatches(pathname, child.href)

              return (
                <Link
                  key={child.href}
                  href={child.href}
                  className={[
                    'flex items-start gap-3 rounded-2xl border px-3 py-3 transition-all duration-200',
                    childActive
                      ? 'border-violet-400/20 bg-gradient-to-r from-violet-600/20 via-purple-500/10 to-fuchsia-500/10 text-white'
                      : 'border-transparent bg-white/[0.02] text-white/75 hover:border-white/10 hover:bg-white/[0.05] hover:text-white',
                  ].join(' ')}
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                    <ChildIcon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {child.label}
                    </p>
                    {child.description && (
                      <p className="mt-0.5 text-xs text-white/45">
                        {child.description}
                      </p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <>
      {/* MOBILE */}
      <div className="lg:hidden border-b border-white/10 bg-[#0b0b12]/95 backdrop-blur-xl">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.28)]">
                <img
                  src="/favicon.ico"
                  alt="RPM"
                  className="h-7 w-7 object-contain"
                />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.28em] text-white/30">
                  RPM
                </p>
                <p className="truncate text-sm font-semibold text-white">
                  Admin
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-10 items-center justify-center rounded-2xl border border-red-400/15 bg-red-500/10 px-3 text-sm font-semibold text-red-200 transition hover:border-red-400/25 hover:bg-red-500/15 hover:text-white"
            >
              Salir
            </button>
          </div>

          <div className="mt-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-2">
              {mobileItems.map((item) => {
                const active = pathMatches(pathname, item.href)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'whitespace-nowrap rounded-2xl border px-4 py-2.5 text-sm font-medium transition-all duration-200',
                      active
                        ? 'border-violet-400/20 bg-gradient-to-r from-violet-600/20 via-purple-500/15 to-fuchsia-500/10 text-white shadow-[0_0_0_1px_rgba(168,85,247,0.08),0_12px_30px_rgba(76,29,149,0.18)]'
                        : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.05] hover:text-white',
                    ].join(' ')}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP */}
      <div className="sticky top-0 z-40 hidden border-b border-white/10 bg-[#0b0b12]/88 backdrop-blur-2xl lg:block">
        <div className="px-4 py-3 md:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <Link
                href="/admin/dashboard"
                className="group flex min-w-0 items-center gap-3"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition group-hover:scale-[1.02]">
                  <img
                    src="/favicon.ico"
                    alt="RPM"
                    className="h-8 w-8 object-contain"
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-white/28">
                    RPM
                  </p>
                  <h2 className="truncate text-base font-semibold text-white">
                    Admin
                  </h2>
                </div>
              </Link>

              <div className="hidden h-8 w-px bg-white/10 xl:block" />

              <nav className="hidden xl:flex xl:items-center xl:gap-2">
                {navItems.map((item) => (
                  <DesktopNavItem
                    key={item.label}
                    item={item}
                    pathname={pathname}
                  />
                ))}
              </nav>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-red-400/15 bg-red-500/10 px-4 text-sm font-semibold text-red-200 transition hover:border-red-400/25 hover:bg-red-500/15 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </button>
          </div>

          <div className="mt-3 overflow-x-auto xl:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-2">
              {navItems.map((item) => {
                const active = itemIsActive(pathname, item)

                if (!item.href) {
                  return (
                    <div
                      key={item.label}
                      className={[
                        'inline-flex h-10 items-center gap-2 rounded-2xl border px-4 text-sm font-medium',
                        active
                          ? 'border-violet-400/20 bg-gradient-to-r from-violet-600/20 via-purple-500/15 to-fuchsia-500/10 text-white'
                          : 'border-white/10 bg-white/[0.03] text-white/65',
                      ].join(' ')}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                  )
                }

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={[
                      'inline-flex h-10 items-center gap-2 rounded-2xl border px-4 text-sm font-medium transition-all',
                      active
                        ? 'border-violet-400/20 bg-gradient-to-r from-violet-600/20 via-purple-500/15 to-fuchsia-500/10 text-white'
                        : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/[0.05] hover:text-white',
                    ].join(' ')}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}