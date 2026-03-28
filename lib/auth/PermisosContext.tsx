'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import {
  EmpleadoConRol,
  obtenerEmpleadoActual,
  Permiso,
  tienePermiso as validarPermiso,
} from '@/lib/auth/permisos'

type PermisosContextType = {
  empleado: EmpleadoConRol | null
  loading: boolean
  tienePermiso: (permiso: Permiso) => boolean
  esAdmin: boolean
  esRecepcionista: boolean
  esTerapeuta: boolean
  esCliente: boolean
  esStaffInterno: boolean
}

const PermisosContext = createContext<PermisosContextType>({
  empleado: null,
  loading: true,
  tienePermiso: () => false,
  esAdmin: false,
  esRecepcionista: false,
  esTerapeuta: false,
  esCliente: false,
  esStaffInterno: false,
})

export function PermisosProvider({ children }: { children: React.ReactNode }) {
  const [empleado, setEmpleado] = useState<EmpleadoConRol | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void loadEmpleado()
  }, [])

  async function loadEmpleado() {
    try {
      const emp = await obtenerEmpleadoActual()
      setEmpleado(emp)
    } catch (error) {
      console.error('Error cargando empleado:', error)
      setEmpleado(null)
    } finally {
      setLoading(false)
    }
  }

  const rol = empleado?.rol?.nombre

  const value: PermisosContextType = {
    empleado,
    loading,
    tienePermiso: (permiso: Permiso) =>
      empleado ? validarPermiso(empleado.permisos, permiso) : false,
    esAdmin: rol === 'admin',
    esRecepcionista: rol === 'recepcionista',
    esTerapeuta: rol === 'terapeuta',
    esCliente: rol === 'cliente',
    esStaffInterno: rol === 'admin' || rol === 'recepcionista',
  }

  return <PermisosContext.Provider value={value}>{children}</PermisosContext.Provider>
}

export function usePermisos() {
  return useContext(PermisosContext)
}