export const dynamic = 'force-dynamic'

import Link from 'next/link'
import Card from '@/components/ui/Card'

export default function SinAccesoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-xl p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-red-500/20 bg-red-500/10">
            <span className="text-2xl">⛔</span>
          </div>

          <h1 className="text-3xl font-bold text-white">Sin acceso</h1>

          <p className="mt-3 text-sm text-white/65">
            Tu cuenta inició sesión, pero no tiene permisos para entrar a esta sección.
          </p>

          <p className="mt-2 text-sm text-white/45">
            Revisa el rol asignado a este usuario o entra con una cuenta autorizada.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex min-w-[150px] items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
            >
              Ir al login
            </Link>

            <Link
              href="/"
              className="inline-flex min-w-[150px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/[0.08]"
            >
              Ir al inicio
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}