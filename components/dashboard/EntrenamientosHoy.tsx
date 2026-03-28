'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'

type EntrenamientoHoy = {
  id: string
  hora_inicio: string
  hora_fin: string
  estado: string
  cliente: string
  entrenador: string
}

export default function EntrenamientosHoy() {
  const [entrenamientos, setEntrenamientos] = useState<EntrenamientoHoy[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadEntrenamientos()
  }, [])

  async function loadEntrenamientos() {
    try {
      const hoy = new Date().toISOString().slice(0, 10)

      const { data, error } = await supabase
        .from('entrenamientos')
        .select(`
          id,
          hora_inicio,
          hora_fin,
          estado,
          clientes:cliente_id ( nombre ),
          empleados:empleado_id ( nombre )
        `)
        .eq('fecha', hoy)
        .order('hora_inicio', { ascending: true })

      if (error) throw error

      setEntrenamientos(
        (data || []).map((e: any) => ({
          id: e.id,
          hora_inicio: e.hora_inicio,
          hora_fin: e.hora_fin,
          estado: e.estado,
          cliente: e.clientes?.nombre || 'Sin cliente',
          entrenador: e.empleados?.nombre || 'Sin entrenador',
        }))
      )
    } catch (err) {
      console.error('Error cargando entrenamientos:', err)
    } finally {
      setLoading(false)
    }
  }

  async function marcarCompletado(id: string) {
    try {
      const { error } = await supabase
        .from('entrenamientos')
        .update({ estado: 'completado' })
        .eq('id', id)

      if (error) throw error
      await loadEntrenamientos()
    } catch (err) {
      console.error('Error:', err)
      alert('Error al marcar como completado')
    }
  }

  if (loading) {
    return (
      <Card className="p-4">
        <p className="text-sm text-white/55">Cargando entrenamientos...</p>
      </Card>
    )
  }

  if (entrenamientos.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-white">🏋️ Entrenamientos de hoy</h3>
        <p className="mt-2 text-sm text-white/55">No hay entrenamientos programados para hoy.</p>
      </Card>
    )
  }

  const programados = entrenamientos.filter((e) => e.estado === 'programado').length
  const completados = entrenamientos.filter((e) => e.estado === 'completado').length
  const cancelados = entrenamientos.filter((e) => e.estado === 'cancelado').length

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">🏋️ Entrenamientos de hoy</h3>
        <div className="flex gap-2 text-xs">
          <span className="text-amber-300">●{programados}</span>
          <span className="text-emerald-300">●{completados}</span>
          <span className="text-rose-300">●{cancelados}</span>
        </div>
      </div>

      <div className="space-y-2">
        {entrenamientos.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 transition hover:bg-white/[0.05]"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{e.cliente}</span>
                <span
                  className={`inline-flex h-2 w-2 rounded-full ${
                    e.estado === 'completado'
                      ? 'bg-emerald-400'
                      : e.estado === 'cancelado'
                      ? 'bg-rose-400'
                      : 'bg-amber-400'
                  }`}
                />
              </div>
              <p className="mt-0.5 text-xs text-white/55">
                {e.hora_inicio.slice(0, 5)} - {e.hora_fin.slice(0, 5)} · {e.entrenador}
              </p>
            </div>

            {e.estado === 'programado' && (
              <button
                onClick={() => marcarCompletado(e.id)}
                className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/20"
              >
                ✓
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}