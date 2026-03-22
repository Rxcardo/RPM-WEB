'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'

type RpcResponse = {
  ok?: boolean
  planes_actualizados?: number
}

export default function AutomatismosPage() {
  const [loadingVencidos, setLoadingVencidos] = useState(false)
  const [loadingAgotados, setLoadingAgotados] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  async function ejecutarVencidos() {
    try {
      setLoadingVencidos(true)
      setErrorMsg('')
      setSuccessMsg('')

      const { data, error } = await supabase.rpc('actualizar_planes_vencidos')
      if (error) throw error

      const result = (data || {}) as RpcResponse
      setSuccessMsg(
        `Proceso completado. Planes vencidos actualizados: ${result.planes_actualizados ?? 0}.`
      )
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo ejecutar el automatismo de planes vencidos.')
    } finally {
      setLoadingVencidos(false)
    }
  }

  async function ejecutarAgotados() {
    try {
      setLoadingAgotados(true)
      setErrorMsg('')
      setSuccessMsg('')

      const { data, error } = await supabase.rpc('actualizar_planes_agotados')
      if (error) throw error

      const result = (data || {}) as RpcResponse
      setSuccessMsg(
        `Proceso completado. Planes agotados actualizados: ${result.planes_actualizados ?? 0}.`
      )
    } catch (err: any) {
      console.error(err)
      setErrorMsg(err.message || 'No se pudo ejecutar el automatismo de planes agotados.')
    } finally {
      setLoadingAgotados(false)
    }
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Configuración</p>
          <h1 className="text-2xl font-bold text-slate-900">Automatismos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Ejecuta procesos automáticos administrativos del sistema.
          </p>
        </div>

        <Link
          href="/admin/configuracion"
          className="rounded-xl border border-slate-200 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Volver a configuración
        </Link>
      </div>

      {errorMsg ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {successMsg ? (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMsg}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white/[0.04] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Actualizar planes vencidos</h2>
          <p className="mt-2 text-sm text-slate-600">
            Marca como vencidos los planes activos cuya fecha final ya pasó.
          </p>

          <div className="mt-5">
            <button
              onClick={ejecutarVencidos}
              disabled={loadingVencidos}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {loadingVencidos ? 'Ejecutando...' : 'Ejecutar automatismo'}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white/[0.04] p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Actualizar planes agotados</h2>
          <p className="mt-2 text-sm text-slate-600">
            Marca como agotados los planes activos que ya consumieron sus sesiones.
          </p>

          <div className="mt-5">
            <button
              onClick={ejecutarAgotados}
              disabled={loadingAgotados}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {loadingAgotados ? 'Ejecutando...' : 'Ejecutar automatismo'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}