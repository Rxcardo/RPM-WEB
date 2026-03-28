import Card from './Card'

type StatCardProps = {
  title: string
  value: number | string
  subtitle?: string
  color?: string
  className?: string
}

export default function StatCard({
  title,
  value,
  subtitle,
  color = 'text-white',
  className = '',
}: StatCardProps) {
  return (
    <Card className={`p-4 sm:p-5 ${className}`}>
      <p className="text-xs text-white/55 sm:text-sm">
        {title}
      </p>

      <p
        className={`mt-2 text-2xl font-semibold tracking-tight sm:mt-3 sm:text-3xl ${color}`}
      >
        {value}
      </p>

      {subtitle ? (
        <p className="mt-1 text-xs leading-5 text-white/45 sm:text-sm">
          {subtitle}
        </p>
      ) : null}
    </Card>
  )
}