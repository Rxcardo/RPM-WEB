'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import ActionCard from '@/components/ui/ActionCard'
import StatCard from '@/components/ui/StatCard'

type Plan = {
  id: string
  nombre: string
  descripcion: string | null
  sesiones_totales: number | null
  vigencia_dias: number | null
  precio: number | null
  estado: string
  created_at: string
}

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

function estadoBadge(estado: string) {
  switch ((estado || '').toLowerCase()) {
    case 'activo':
      return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
    case 'inactivo':
      return 'border-white/10 bg-white/[0.05] text-white/70'
    default:
      return 'border-white/10 bg-white/[0.05] text-white/70'
  }
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-white/45">{label}</p>
      <div className="mt-1 font-medium text-white">{value}</div>
    </Card>
  )
}

export default function PlanDetallePage() {
  const params = useParams()
  const id = params?.id as string

  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      void loadPlan()
    }
  }, [id])

  async function loadPlan() {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('planes')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        throw new Error(error.message)
      }

      setPlan(data as Plan)
    } catch (err: any) {
      console.error(err)
      setError('No se pudo cargar el plan')
      setPlan(null)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-white/55">Operaciones / Planes</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Detalle del plan</h1>
        </div>

        <Card className="p-6">
          <p className="text-sm text-white/55">Cargando plan...</p>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-white/55">Operaciones / Planes</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Detalle del plan</h1>
        </div>

        <Card className="p-6">
          <p className="text-sm text-rose-400">{error}</p>
        </Card>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm text-white/55">Operaciones / Planes</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Detalle del plan</h1>
        </div>

        <Card className="p-6">
          <p className="text-sm text-white/55">No existe el plan.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Operaciones / Planes</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            {plan.nombre}
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            title="Volver"
            description="Regresar al listado de planes."
            href="/admin/operaciones/planes"
          />
          <ActionCard
            title="Editar"
            description="Modificar la configuración del plan."
            href={`/admin/operaciones/planes/${plan.id}/editar`}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Sesiones"
          value={plan.sesiones_totales || 0}
        />

        <StatCard
          title="Vigencia"
          value={`${plan.vigencia_dias || 0} días`}
        />

        <StatCard
          title="Precio"
          value={money(plan.precio)}
          color="text-emerald-400"
        />
      </div>

      <Section
        title="Estado"
        description="Estado actual del plan."
      >
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium ${estadoBadge(
            plan.estado
          )}`}
        >
          {plan.estado}
        </span>
      </Section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section
            title="Descripción"
            description="Detalle general del plan."
          >
            <Card className="p-4">
              <p className="whitespace-pre-wrap text-white/75">
                {plan.descripcion || 'Sin descripción'}
              </p>
            </Card>
          </Section>
        </div>

        <Section
          title="Información adicional"
          description="Datos de creación del registro."
        >
          <DetailItem
            label="Fecha creación"
            value={formatDate(plan.created_at)}
          />
        </Section>
      </div>
    </div>
  )
}