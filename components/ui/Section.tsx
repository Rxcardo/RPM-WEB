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
    <Card className={`p-4 sm:p-5 md:p-6 ${className}`}>
      <div className="mb-4 sm:mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
          {title}
        </h2>

        {description ? (
          <p className="mt-1 text-xs leading-5 text-white/55 sm:text-sm">
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