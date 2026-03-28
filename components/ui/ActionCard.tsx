import Link from 'next/link'
import Card from './Card'

type ActionCardProps = {
  title: string
  description: string
  href: string
  className?: string
}

export default function ActionCard({
  title,
  description,
  href,
  className = '',
}: ActionCardProps) {
  return (
    <Link href={href} className="block h-full">
      <Card
        className={`
          h-full
          min-h-[96px]
          cursor-pointer
          p-4
          transition
          duration-200
          hover:border-white/15
          hover:bg-white/[0.06]
          sm:min-h-[110px]
          sm:p-5
          ${className}
        `}
      >
        <div className="flex h-full flex-col justify-between">
          <p className="text-sm font-medium leading-5 text-white sm:text-base">
            {title}
          </p>

          <p className="mt-2 text-xs leading-5 text-white/55 sm:text-sm">
            {description}
          </p>
        </div>
      </Card>
    </Link>
  )
}