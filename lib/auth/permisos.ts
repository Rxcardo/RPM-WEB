import { supabase } from '@/lib/supabase/client'

export const PERMISOS = {
  DASHBOARD_VER: 'dashboard.ver',

  CLIENTES_VER: 'clientes.ver',
  CLIENTES_CREAR: 'clientes.crear',
  CLIENTES_EDITAR: 'clientes.editar',
  CLIENTES_ELIMINAR: 'clientes.eliminar',

  PLANES_VER: 'planes.ver',
  PLANES_CREAR: 'planes.crear',
  PLANES_EDITAR: 'planes.editar',

  CITAS_VER: 'citas.ver',
  CITAS_CREAR: 'citas.crear',
  CITAS_EDITAR: 'citas.editar',
  CITAS_CANCELAR: 'citas.cancelar',

  FINANZAS_VER: 'finanzas.ver',
  FINANZAS_INGRESOS: 'finanzas.ingresos',
  FINANZAS_EGRESOS: 'finanzas.egresos',

  REPORTES_VER: 'reportes.ver',
  PERSONAL_VER: 'personal.ver',
  PERSONAL_GESTIONAR: 'personal.gestionar',

  COMISIONES_VER_PROPIAS: 'comisiones.ver_propias',
  COMISIONES_VER_TODAS: 'comisiones.ver_todas',

  CONFIGURACION_ACCEDER: 'configuracion.acceder',

  CLIENTE_INICIO: 'cliente.inicio',
  CLIENTE_PLAN: 'cliente.plan',
  CLIENTE_PERFIL: 'cliente.perfil',
} as const

export type Permiso = (typeof PERMISOS)[keyof typeof PERMISOS]

export type NombreRol = 'admin' | 'recepcionista' | 'terapeuta' | 'cliente'

export type EmpleadoConRol = {
  id: string
  nombre: string
  email: string
  rol: {
    id: string
    nombre: NombreRol
    descripcion: string | null
  } | null
  permisos: string[]
}

export async function obtenerEmpleadoActual(): Promise<EmpleadoConRol | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const { data: empleado, error } = await supabase
      .from('empleados')
      .select(
        `
        id,
        nombre,
        email,
        roles:rol_id (
          id,
          nombre,
          descripcion
        )
      `
      )
      .eq('id', user.id)
      .single()

    if (error || !empleado) return null

    const rolId = empleado.roles?.id
    let permisos: string[] = []

    if (rolId) {
      const { data: permisosData } = await supabase
        .from('roles_permisos')
        .select(
          `
          permisos:permiso_id (
            nombre
          )
        `
        )
        .eq('rol_id', rolId)

      permisos = permisosData?.map((p: any) => p.permisos?.nombre).filter(Boolean) || []
    }

    return {
      id: empleado.id,
      nombre: empleado.nombre,
      email: empleado.email,
      rol: empleado.roles,
      permisos,
    }
  } catch (error) {
    console.error('Error obteniendo empleado actual:', error)
    return null
  }
}

export function tienePermiso(permisos: string[], permiso: Permiso): boolean {
  return permisos.includes(permiso)
}

export function tieneAlgunPermiso(permisos: string[], permisosRequeridos: Permiso[]): boolean {
  return permisosRequeridos.some((permiso) => permisos.includes(permiso))
}

export function tieneTodosLosPermisos(permisos: string[], permisosRequeridos: Permiso[]): boolean {
  return permisosRequeridos.every((permiso) => permisos.includes(permiso))
}

export function esAdmin(rol: string | null | undefined): boolean {
  return rol === 'admin'
}

export function esRecepcionista(rol: string | null | undefined): boolean {
  return rol === 'recepcionista'
}

export function esTerapeuta(rol: string | null | undefined): boolean {
  return rol === 'terapeuta'
}

export function esCliente(rol: string | null | undefined): boolean {
  return rol === 'cliente'
}

export function esStaffInterno(rol: string | null | undefined): boolean {
  return rol === 'admin' || rol === 'recepcionista'
}