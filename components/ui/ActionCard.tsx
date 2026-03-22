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
    <Link href={href} className="block">
      <Card
        className={`
          cursor-pointer
          p-5
          transition
          duration-200
          hover:bg-white/[0.06]
          hover:border-white/15
          ${className}
        `}
      >
        <p className="font-medium text-white">
          {title}
        </p>

        <p className="mt-1 text-sm text-white/55">
          {description}
        </p>
      </Card>
    </Link>
  )
}