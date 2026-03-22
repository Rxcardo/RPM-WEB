import Link from 'next/link'
import type { ReactNode } from 'react'

type ButtonProps = {
  children: ReactNode
  href?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  className?: string
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
}

function getVariantClasses(variant: ButtonProps['variant'] = 'primary') {
  switch (variant) {
    case 'secondary':
      return 'border border-white/10 bg-white/[0.03] text-white/85 hover:bg-white/[0.06]'
    case 'ghost':
      return 'border border-transparent bg-transparent text-white/70 hover:bg-white/[0.05] hover:text-white'
    case 'primary':
    default:
      return 'bg-gradient-to-r from-purple-600 to-violet-700 text-white hover:opacity-90'
  }
}

export default function Button({
  children,
  href,
  variant = 'primary',
  className = '',
  type = 'button',
  onClick,
}: ButtonProps) {
  const classes = `
    inline-flex items-center justify-center
    rounded-2xl px-4 py-2.5
    text-sm font-medium
    transition-all duration-200
    ${getVariantClasses(variant)}
    ${className}
  `

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} onClick={onClick} className={classes}>
      {children}
    </button>
  )
}