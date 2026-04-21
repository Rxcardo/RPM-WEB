'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { useState, useEffect, type ComponentType } from 'react'
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
type SubItem = {
  label: string
  href: string
  icon: IconType
  description?: string
}

type NavItem = {
  label: string
  href?: string
  icon: IconType
  children?: SubItem[]
}

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
    label: 'Citas',
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

const MOBILE_ALLOWED_LABELS = new Set([
  'Dashboard',
  'Personal',
  'Finanzas',
  'Reportes',
])

const MOBILE_LABELS: Record<string, string> = {
  Dashboard: 'Inicio',
  Personal: 'Personal',
  Finanzas: 'Finanzas',
  Reportes: 'Reportes',
}

function pathMatches(pathname: string, href?: string) {
  if (!href) return false
  return pathname === href || pathname.startsWith(`${href}/`)
}

function getInitials(nameOrEmail: string): string {
  const clean = nameOrEmail.split('@')[0]
  const parts = clean.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return clean.slice(0, 2).toUpperCase()
}

function formatDisplayName(nameOrEmail: string): string {
  if (!nameOrEmail) return ''
  if (!nameOrEmail.includes('@')) return nameOrEmail
  const local = nameOrEmail.split('@')[0]
  return local.charAt(0).toUpperCase() + local.slice(1)
}

function DesktopNavItem({
  item,
  pathname,
}: {
  item: NavItem
  pathname: string
}) {
  const [isHovered, setIsHovered] = useState(false)

  const active =
    (item.href && pathMatches(pathname, item.href)) ||
    item.children?.some((c) => pathMatches(pathname, c.href))

  const Icon = item.icon

  const buttonClass = `
    inline-flex h-10 items-center gap-2 rounded-2xl border px-3 text-[13px] font-medium transition-all duration-200 whitespace-nowrap
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
        <Icon className="h-4 w-4 shrink-0" />
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

function MobileNavItem({
  item,
  pathname,
}: {
  item: NavItem
  pathname: string
}) {
  const active =
    (item.href && pathMatches(pathname, item.href)) ||
    item.children?.some((c) => pathMatches(pathname, c.href))

  const Icon = item.icon
  const label = MOBILE_LABELS[item.label] || item.label

  return (
    <Link
      href={item.href || '#'}
      className={`flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-2xl border px-2 transition-all duration-200 ${
        active
          ? 'border-violet-400/20 bg-gradient-to-r from-violet-600/20 via-purple-500/15 to-fuchsia-500/10 text-white shadow-[0_0_0_1px_rgba(168,85,247,0.08),0_12px_30px_rgba(76,29,149,0.18)]'
          : 'border-white/10 bg-white/[0.03] text-white/75 hover:border-white/15 hover:bg-white/[0.05] hover:text-white'
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate text-[11px] font-semibold">{label}</span>
    </Link>
  )
}

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const [userDisplay, setUserDisplay] = useState<string>('')
  const [userInitials, setUserInitials] = useState<string>('--')
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const media = window.matchMedia('(max-width: 768px)')
    const updateMobile = () => setIsMobile(media.matches)

    updateMobile()

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', updateMobile)
      return () => media.removeEventListener('change', updateMobile)
    }

    media.addListener(updateMobile)
    return () => media.removeListener(updateMobile)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data?.user
      if (!user) return

      const raw =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email ||
        ''

      setUserDisplay(formatDisplayName(raw))
      setUserInitials(getInitials(raw))
    })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const mobileNavItems = navItems.filter((item) => MOBILE_ALLOWED_LABELS.has(item.label))

  if (mounted && isMobile) {
    return (
      <div className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0b0b12]/92 backdrop-blur-2xl">
        <div className="px-3 pb-3 pt-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Link href="/admin/dashboard" className="flex shrink-0 items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white shadow-xl">
                  <img src="/favicon.ico" alt="RPM" className="h-5 w-5 object-contain" />
                </div>
              </Link>

              <div className="min-w-0">
                <p className="text-[10px] leading-none text-white/35">RPM Admin</p>
                <p className="truncate text-sm font-semibold leading-tight text-white">
                  {userDisplay || 'Usuario'}
                </p>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              title="Cerrar sesión"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red-400/15 bg-red-500/8 text-red-300/75 transition hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          <nav className="grid grid-cols-4 gap-2">
            {mobileNavItems.map((item) => (
              <MobileNavItem key={item.label} item={item} pathname={pathname} />
            ))}
          </nav>
        </div>
      </div>
    )
  }

  return (
    <div className="sticky top-0 z-40 w-full border-b border-white/10 bg-[#0b0b12]/92 backdrop-blur-2xl">
      <div className="mx-auto flex h-[78px] max-w-[1720px] items-center justify-between gap-3 px-3 md:gap-6 md:px-6">
        {/* ── Logo ── */}
        <Link href="/admin/dashboard" className="flex shrink-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white shadow-xl md:h-12 md:w-12">
            <img src="/favicon.ico" alt="RPM" className="h-7 w-7 object-contain md:h-8 md:w-8" />
          </div>

          <div className="hidden min-w-0 sm:block">
            <p className="mb-1 text-[10px] uppercase tracking-[0.28em] leading-none text-white/28">
              RPM
            </p>
            <h2 className="truncate text-sm font-semibold leading-none text-white md:text-base">
              Admin
            </h2>
          </div>
        </Link>

        {/* ── Nav desktop original ── */}
        <nav className="flex flex-1 items-center justify-center gap-1 min-w-0">
          {navItems.map((item) => (
            <DesktopNavItem key={item.label} item={item} pathname={pathname} />
          ))}
        </nav>

        {/* ── Right: user + logout ── */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 pr-1 sm:flex">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[11px] font-bold text-white shadow-[0_0_10px_rgba(168,85,247,0.3)]">
              {userInitials}
            </div>

            {userDisplay ? (
              <span className="max-w-[100px] truncate text-sm font-medium text-white/80">
                {userDisplay}
              </span>
            ) : (
              <div className="h-3 w-16 animate-pulse rounded bg-white/10" />
            )}
          </div>

          <div className="hidden h-5 w-px bg-white/10 sm:block" />

          <button
            onClick={handleSignOut}
            title="Cerrar sesión"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-400/15 bg-red-500/8 text-red-300/70 transition hover:border-red-400/30 hover:bg-red-500/15 hover:text-red-200"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}