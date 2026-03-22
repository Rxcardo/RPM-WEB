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
    <Card className={`p-5 ${className}`}>
      <p className="text-sm text-white/55">
        {title}
      </p>

      <p className={`mt-3 text-3xl font-semibold tracking-tight ${color}`}>
        {value}
      </p>

      {subtitle ? (
        <p className="mt-1 text-xs text-white/45">
          {subtitle}
        </p>
      ) : null}
    </Card>
  )
}