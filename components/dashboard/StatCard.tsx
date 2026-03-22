import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
}

export default function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`
        rounded-3xl
        border border-white/10
        bg-white/[0.04]
        backdrop-blur-xl
        shadow-[0_8px_30px_rgba(0,0,0,0.35)]
        ${className}
      `}
    >
      {children}
    </div>
  )
}