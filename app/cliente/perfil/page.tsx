// app/cliente/perfil/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Mail, Phone, MapPin, Calendar, Users, Edit2, Save, X } from 'lucide-react'

interface ClientePerfil {
  nombre: string
  email: string | null
  telefono: string | null
  fecha_nacimiento: string | null
  genero: string | null
  direccion: string | null
  terapeuta_nombre: string | null
  estado: string
  created_at: string
}

export default function ClientePerfilPage() {
  const [perfil, setPerfil] = useState<ClientePerfil | null>(null)
  const [editando, setEditando] = useState(false)
  const [formData, setFormData] = useState<Partial<ClientePerfil>>({})
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarPerfil()
  }, [])

  async function cargarPerfil() {
    try {
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: cliente, error } = await supabase
        .from('clientes')
        .select(`
          nombre,
          email,
          telefono,
          fecha_nacimiento,
          genero,
          direccion,
          estado,
          created_at,
          empleados:terapeuta_id (nombre)
        `)
        .eq('auth_user_id', user.id)
        .single()

      if (error) throw error

      const perfilData: ClientePerfil = {
        nombre: cliente.nombre,
        email: cliente.email,
        telefono: cliente.telefono,
        fecha_nacimiento: cliente.fecha_nacimiento,
        genero: cliente.genero,
        direccion: cliente.direccion,
        terapeuta_nombre: cliente.empleados?.nombre || null,
        estado: cliente.estado,
        created_at: cliente.created_at
      }

      setPerfil(perfilData)
      setFormData(perfilData)

    } catch (error) {
      console.error('Error cargando perfil:', error)
    } finally {
      setLoading(false)
    }
  }

  async function guardarCambios() {
    try {
      setGuardando(true)
      const supabase = createClient()
      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { error } = await supabase
        .from('clientes')
        .update({
          telefono: formData.telefono,
          fecha_nacimiento: formData.fecha_nacimiento,
          genero: formData.genero,
          direccion: formData.direccion
        })
        .eq('auth_user_id', user.id)

      if (error) throw error

      await cargarPerfil()
      setEditando(false)

    } catch (error) {
      console.error('Error guardando perfil:', error)
      alert('Error al guardar los cambios')
    } finally {
      setGuardando(false)
    }
  }

  function cancelarEdicion() {
    setFormData(perfil || {})
    setEditando(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Cargando...</div>
      </div>
    )
  }

  if (!perfil) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <p className="text-gray-500 text-center">No se pudo cargar el perfil</p>
      </div>
    )
  }

  const estadoColor = {
    activo: 'bg-green-100 text-green-800',
    inactivo: 'bg-red-100 text-red-800',
    pausado: 'bg-yellow-100 text-yellow-800'
  }

  return (
    <div className="space-y-6">
      {/* Header con botón de editar */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{perfil.nombre}</h2>
              <p className="text-gray-600">Cliente RPM</p>
            </div>
          </div>

          {!editando ? (
            <button
              onClick={() => setEditando(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              Editar Perfil
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={guardarCambios}
                disabled={guardando}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={cancelarEdicion}
                disabled={guardando}
                className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Información Personal */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Información Personal</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Email (no editable) */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Mail className="w-4 h-4" />
              Correo Electrónico
            </label>
            <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
              {perfil.email || 'No registrado'}
            </div>
          </div>

          {/* Teléfono (editable) */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Phone className="w-4 h-4" />
              Teléfono
            </label>
            {editando ? (
              <input
                type="tel"
                value={formData.telefono || ''}
                onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: 0412-1234567"
              />
            ) : (
              <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                {perfil.telefono || 'No registrado'}
              </div>
            )}
          </div>

          {/* Fecha de Nacimiento (editable) */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4" />
              Fecha de Nacimiento
            </label>
            {editando ? (
              <input
                type="date"
                value={formData.fecha_nacimiento || ''}
                onChange={(e) => setFormData({ ...formData, fecha_nacimiento: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                {perfil.fecha_nacimiento 
                  ? new Date(perfil.fecha_nacimiento).toLocaleDateString('es-VE', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })
                  : 'No registrada'
                }
              </div>
            )}
          </div>

          {/* Género (editable) */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4" />
              Género
            </label>
            {editando ? (
              <select
                value={formData.genero || ''}
                onChange={(e) => setFormData({ ...formData, genero: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccionar...</option>
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="otro">Otro</option>
              </select>
            ) : (
              <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                {perfil.genero 
                  ? perfil.genero.charAt(0).toUpperCase() + perfil.genero.slice(1)
                  : 'No registrado'
                }
              </div>
            )}
          </div>

          {/* Dirección (editable, columna completa) */}
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <MapPin className="w-4 h-4" />
              Dirección
            </label>
            {editando ? (
              <textarea
                value={formData.direccion || ''}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Dirección completa"
              />
            ) : (
              <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                {perfil.direccion || 'No registrada'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Información de la Cuenta */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Información de la Cuenta</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Terapeuta Asignado */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Users className="w-4 h-4" />
              Terapeuta Asignado
            </label>
            <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
              {perfil.terapeuta_nombre || 'Sin asignar'}
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              Estado de la Cuenta
            </label>
            <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoColor[perfil.estado as keyof typeof estadoColor]}`}>
                {perfil.estado.charAt(0).toUpperCase() + perfil.estado.slice(1)}
              </span>
            </div>
          </div>

          {/* Fecha de Registro */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4" />
              Miembro Desde
            </label>
            <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
              {new Date(perfil.created_at).toLocaleDateString('es-VE', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
