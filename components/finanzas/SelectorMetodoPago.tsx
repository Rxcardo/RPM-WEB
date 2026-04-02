'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'

type MetodoPagoV2 = {
  id: string
  nombre: string
  moneda: string
  tipo: string
  cartera: {
    nombre: string
    codigo: string
    color: string
    icono: string
  } | null
}

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function normalizeMetodoPagoV2(row: any): MetodoPagoV2 {
  const cartera = firstOrNull(row?.cartera)

  return {
    id: String(row?.id ?? ''),
    nombre: String(row?.nombre ?? ''),
    moneda: String(row?.moneda ?? ''),
    tipo: String(row?.tipo ?? ''),
    cartera: cartera
      ? {
          nombre: String(cartera?.nombre ?? ''),
          codigo: String(cartera?.codigo ?? ''),
          color: String(cartera?.color ?? ''),
          icono: String(cartera?.icono ?? ''),
        }
      : null,
  }
}

export default function SelectorMetodoPago({
  metodoPagoId,
  onMetodoPagoChange,
  onTasaChange,
  tasaActual,
  monto,
}: {
  metodoPagoId: string
  onMetodoPagoChange: (id: string) => void
  onTasaChange?: (tasa: number) => void
  tasaActual?: number
  monto?: number
}) {
  const [metodos, setMetodos] = useState<MetodoPagoV2[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void cargarMetodos()
  }, [])

  async function cargarMetodos() {
    const { data, error } = await supabase
      .from('metodos_pago_v2')
      .select(`
        id,
        nombre,
        moneda,
        tipo,
        cartera:carteras(nombre, codigo, color, icono)
      `)
      .eq('activo', true)
      .eq('permite_recibir', true)
      .order('orden')

    if (!error && data) {
      const metodosNormalizados: MetodoPagoV2[] = ((data || []) as any[]).map(
        normalizeMetodoPagoV2
      )
      setMetodos(metodosNormalizados)
    } else {
      setMetodos([])
    }

    setLoading(false)
  }

  const grouped = useMemo(() => {
    return metodos.reduce((acc, metodo) => {
      const carteraId = metodo.cartera?.codigo || 'sin-cartera'
      if (!acc[carteraId]) acc[carteraId] = []
      acc[carteraId].push(metodo)
      return acc
    }, {} as Record<string, MetodoPagoV2[]>)
  }, [metodos])

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <p className="text-sm text-white/55">Cargando métodos de pago...</p>
      </div>
    )
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-white/70">
        Método de pago *
      </label>
      <select
        value={metodoPagoId}
        onChange={(e) => onMetodoPagoChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-emerald-500/40 focus:bg-white/[0.07]"
        required
      >
        <option value="" className="bg-[#11131a]">
          Seleccionar método de pago
        </option>

        {Object.entries(grouped).map(([carteraId, metodosGrupo]) => {
          const cartera = metodosGrupo[0]?.cartera

          return (
            <optgroup
              key={carteraId}
              label={
                cartera
                  ? `${cartera.icono} ${cartera.nombre}`
                  : 'Sin cartera'
              }
              className="bg-[#11131a]"
            >
              {metodosGrupo.map((metodo) => (
                <option
                  key={metodo.id}
                  value={metodo.id}
                  className="bg-[#11131a]"
                >
                  {metodo.nombre}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
    </div>
  )
}