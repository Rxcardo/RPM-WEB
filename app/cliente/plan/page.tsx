// app/cliente/plan/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Calendar, Clock, CheckCircle, XCircle, AlertCircle, Activity } from 'lucide-react'

interface PlanData {
  id: string
  plan_nombre: string
  sesiones_totales: number
  sesiones_usadas: number
  fecha_inicio: string | null
  fecha_fin: string | null
  estado: string
  origen: string
  terapeuta_nombre: string | null
}

interface HistorialSesion {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  servicio_nombre: string | null
  terapeuta_nombre: string | null
  estado: string
  notas: string | null
}

export default function ClientePlan() {
  const [planActivo, setPlanActivo] = useState<PlanData | null>(null)
  const [historialSesiones, setHistorialSesiones] = useState<HistorialSesion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    cargarPlan()
  }, [])

  async function cargarPlan() {
    try {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      // Obtener cliente_id
      const { data: cliente } = await supabase
        .from('clientes')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()

      if (!cliente) throw new Error('Cliente no encontrado')

      // Obtener plan activo
      const { data: plan } = await supabase
        .from('clientes_planes')
        .select(`
          id,
          planes:plan_id (nombre),
          sesiones_totales,
          sesiones_usadas,
          fecha_inicio,
          fecha_fin,
          estado,
          origen,
          empleados:terapeuta_id (nombre)
        `)
        .eq('cliente_id', cliente.id)
        .eq('estado', 'activo')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (plan) {
        setPlanActivo({
          id: plan.id,
          plan_nombre: plan.planes?.nombre || 'Plan',
          sesiones_totales: plan.sesiones_totales,
          sesiones_usadas: plan.sesiones_usadas,
          fecha_inicio: plan.fecha_inicio,
          fecha_fin: plan.fecha_fin,
          estado: plan.estado,
          origen: plan.origen,
          terapeuta_nombre: plan.empleados?.nombre || null
        })

        // Obtener historial de sesiones completadas
        const { data: sesiones } = await supabase
          .from('citas')
          .select(`
            id,
            fecha,
            hora_inicio,
            hora_fin,
            estado,
            notas,
            servicios:servicio_id (nombre),
            empleados:terapeuta_id (nombre)
          `)
          .eq('cliente_id', cliente.id)
          .eq('estado', 'completada')
          .order('fecha', { ascending: false })
          .order('hora_inicio', { ascending: false })

        setHistorialSesiones(sesiones || [])
      }

    } catch (error) {
      console.error('Error cargando plan:', error)
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

  if (!planActivo) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No tienes un plan activo
          </h3>
          <p className="text-gray-600">
            Contacta con tu terapeuta para adquirir un plan y comenzar tus sesiones.
          </p>
        </div>
      </div>
    )
  }

  const sesionesRestantes = planActivo.sesiones_totales - planActivo.sesiones_usadas
  const porcentajeUsado = (planActivo.sesiones_usadas / planActivo.sesiones_totales) * 100
  
  // Calcular días restantes
  let diasRestantes: number | null = null
  if (planActivo.fecha_fin) {
    const hoy = new Date()
    const fin = new Date(planActivo.fecha_fin)
    diasRestantes = Math.ceil((fin.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  }

  const estadoColor = {
    activo: 'bg-green-100 text-green-800',
    vencido: 'bg-red-100 text-red-800',
    agotado: 'bg-orange-100 text-orange-800',
    cancelado: 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-6">
      {/* Información del Plan */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{planActivo.plan_nombre}</h2>
            {planActivo.terapeuta_nombre && (
              <p className="text-gray-600 mt-1">
                Terapeuta: <span className="font-medium">{planActivo.terapeuta_nombre}</span>
              </p>
            )}
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${estadoColor[planActivo.estado as keyof typeof estadoColor]}`}>
            {planActivo.estado.charAt(0).toUpperCase() + planActivo.estado.slice(1)}
          </span>
        </div>

        {/* Progreso de Sesiones */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Progreso de Sesiones</h3>
            <p className="text-2xl font-bold text-gray-900">
              {planActivo.sesiones_usadas} / {planActivo.sesiones_totales}
            </p>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div 
              className="bg-blue-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${porcentajeUsado}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <p className="text-gray-600">
              Sesiones restantes: <span className="font-semibold text-blue-600">{sesionesRestantes}</span>
            </p>
            <p className="text-gray-600">
              {porcentajeUsado.toFixed(0)}% completado
            </p>
          </div>
        </div>

        {/* Vigencia */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm text-gray-600 mb-1">Fecha de Inicio</p>
            <p className="font-medium text-gray-900">
              {planActivo.fecha_inicio 
                ? new Date(planActivo.fecha_inicio).toLocaleDateString('es-VE', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })
                : 'No definida'
              }
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600 mb-1">Fecha de Vencimiento</p>
            <p className="font-medium text-gray-900">
              {planActivo.fecha_fin 
                ? new Date(planActivo.fecha_fin).toLocaleDateString('es-VE', { 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })
                : 'Sin vencimiento'
              }
            </p>
          </div>

          {diasRestantes !== null && (
            <div>
              <p className="text-sm text-gray-600 mb-1">Días Restantes</p>
              <p className={`font-medium ${diasRestantes <= 7 ? 'text-red-600' : diasRestantes <= 30 ? 'text-yellow-600' : 'text-gray-900'}`}>
                {diasRestantes > 0 ? `${diasRestantes} días` : 'Vencido'}
              </p>
            </div>
          )}
        </div>

        {/* Origen del plan */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-gray-600">
            Origen: <span className="font-medium text-gray-900">
              {planActivo.origen === 'rpm' ? 'RPM' : 'Entrenador'}
            </span>
          </p>
        </div>
      </div>

      {/* Historial de Sesiones */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900">Historial de Sesiones</h3>
        </div>

        {historialSesiones.length > 0 ? (
          <div className="space-y-3">
            {historialSesiones.map((sesion) => (
              <div 
                key={sesion.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">
                        {sesion.servicio_nombre || 'Sesión'}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {new Date(sesion.fecha).toLocaleDateString('es-VE', { 
                          day: 'numeric', 
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {sesion.hora_inicio} - {sesion.hora_fin}
                      </span>
                      {sesion.terapeuta_nombre && (
                        <span>{sesion.terapeuta_nombre}</span>
                      )}
                    </div>

                    {sesion.notas && (
                      <div className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2">
                        <p className="font-medium text-gray-700 mb-1">Notas:</p>
                        <p>{sesion.notas}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Aún no has completado ninguna sesión</p>
          </div>
        )}
      </div>
    </div>
  )
}
