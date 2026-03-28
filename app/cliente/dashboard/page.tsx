// app/cliente/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Clock, Activity, AlertCircle } from 'lucide-react'

interface DashboardData {
  cliente: {
    nombre: string
    terapeuta_nombre: string | null
  } | null
  planActivo: {
    plan_nombre: string
    sesiones_totales: number
    sesiones_usadas: number
    fecha_inicio: string | null
    fecha_fin: string | null
    estado: string
  } | null
  proximasCitas: Array<{
    id: string
    fecha: string
    hora_inicio: string
    servicio_nombre: string | null
    terapeuta_nombre: string | null
    estado: string
  }>
}

export default function ClienteInicio() {
  const [data, setData] = useState<DashboardData>({
    cliente: null,
    planActivo: null,
    proximasCitas: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarDashboard()
  }, [])

  async function cargarDashboard() {
    try {
      const supabase = createClient()
      
      // Obtener el usuario autenticado
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      // Obtener datos del cliente
      const { data: cliente } = await supabase
        .from('clientes')
        .select(`
          nombre,
          empleados:terapeuta_id (nombre)
        `)
        .eq('auth_user_id', user.id)
        .single()

      // Obtener plan activo
      const { data: plan } = await supabase
        .from('clientes_planes')
        .select(`
          planes:plan_id (nombre),
          sesiones_totales,
          sesiones_usadas,
          fecha_inicio,
          fecha_fin,
          estado
        `)
        .eq('auth_user_id', user.id)
        .eq('estado', 'activo')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // Obtener próximas citas
      const { data: citas } = await supabase
        .from('citas')
        .select(`
          id,
          fecha,
          hora_inicio,
          estado,
          servicios:servicio_id (nombre),
          empleados:terapeuta_id (nombre)
        `)
        .eq('auth_user_id', user.id)
        .gte('fecha', new Date().toISOString().split('T')[0])
        .in('estado', ['programada', 'confirmada'])
        .order('fecha', { ascending: true })
        .order('hora_inicio', { ascending: true })
        .limit(5)

      setData({
        cliente: cliente ? {
          nombre: cliente.nombre,
          terapeuta_nombre: cliente.empleados?.nombre || null
        } : null,
        planActivo: plan ? {
          plan_nombre: plan.planes?.nombre || 'Plan',
          sesiones_totales: plan.sesiones_totales,
          sesiones_usadas: plan.sesiones_usadas,
          fecha_inicio: plan.fecha_inicio,
          fecha_fin: plan.fecha_fin,
          estado: plan.estado
        } : null,
        proximasCitas: citas || []
      })

    } catch (error) {
      console.error('Error cargando dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Cargando...</div>
      </div>
    )
  }

  const sesionesRestantes = data.planActivo 
    ? data.planActivo.sesiones_totales - data.planActivo.sesiones_usadas 
    : 0

  const porcentajeUsado = data.planActivo
    ? (data.planActivo.sesiones_usadas / data.planActivo.sesiones_totales) * 100
    : 0

  return (
    <div className="space-y-6">
      {/* Bienvenida */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-2xl font-bold text-gray-900">
          ¡Hola, {data.cliente?.nombre || 'Cliente'}!
        </h2>
        {data.cliente?.terapeuta_nombre && (
          <p className="text-gray-600 mt-1">
            Tu terapeuta: <span className="font-medium">{data.cliente.terapeuta_nombre}</span>
          </p>
        )}
      </div>

      {/* Resumen del Plan */}
      {data.planActivo ? (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900">Tu Plan Activo</h3>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Plan</p>
              <p className="text-lg font-medium text-gray-900">{data.planActivo.plan_nombre}</p>
            </div>

            {/* Barra de progreso de sesiones */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">Sesiones utilizadas</p>
                <p className="text-sm font-medium text-gray-900">
                  {data.planActivo.sesiones_usadas} / {data.planActivo.sesiones_totales}
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${porcentajeUsado}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Te quedan <span className="font-medium text-blue-600">{sesionesRestantes}</span> sesiones
              </p>
            </div>

            {/* Vigencia */}
            {data.planActivo.fecha_fin && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Clock className="w-4 h-4 text-gray-400" />
                <p className="text-sm text-gray-600">
                  Válido hasta: <span className="font-medium">{new Date(data.planActivo.fecha_fin).toLocaleDateString('es-VE')}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-900">No tienes un plan activo</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Contacta con tu terapeuta para adquirir un plan y comenzar tus sesiones.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Próximas Citas */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900">Próximas Citas</h3>
        </div>

        {data.proximasCitas.length > 0 ? (
          <div className="space-y-3">
            {data.proximasCitas.map((cita) => (
              <div 
                key={cita.id}
                className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-shrink-0">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {new Date(cita.fecha).getDate()}
                    </p>
                    <p className="text-xs text-gray-600 uppercase">
                      {new Date(cita.fecha).toLocaleDateString('es-VE', { month: 'short' })}
                    </p>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">
                    {cita.servicio_nombre || 'Sesión'}
                  </p>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {cita.hora_inicio}
                    </span>
                    {cita.terapeuta_nombre && (
                      <span>{cita.terapeuta_nombre}</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className={`
                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${cita.estado === 'confirmada' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                    }
                  `}>
                    {cita.estado === 'confirmada' ? 'Confirmada' : 'Programada'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            No tienes citas programadas
          </p>
        )}
      </div>
    </div>
  )
}
