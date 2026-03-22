import type { ReactNode } from 'react'
import Card from './Card'

type SectionProps = {
  title: string
  description?: string
  children: ReactNode
  className?: string
  contentClassName?: string
}

export default function Section({
  title,
  description,
  children,
  className = '',
  contentClassName = '',
}: SectionProps) {
  return (
    <Card className={`p-6 ${className}`}>
      <div className="mb-5">
        <h2 className="text-xl font-semibold tracking-tight text-white">
          {title}
        </h2>

        {description ? (
          <p className="mt-1 text-sm text-white/55">
            {description}
          </p>
        ) : null}
      </div>

      <div className={contentClassName}>
        {children}
      </div>
    </Card>
  )
}