'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export type ClientePortal = {
  id: string
  nombre: string | null
  telefono: string | null
  email: string | null
  cedula?: string | null
  estado?: string | null
  acceso_portal?: boolean | null
}

export type CitaCliente = {
  id: string
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  estado: string | null
  notas: string | null
  servicio?: { nombre?: string | null } | null
  servicios?: { nombre?: string | null } | null
  terapeuta?: { nombre?: string | null } | null
  empleados?: { nombre?: string | null } | null
}

export type PagoCliente = {
  id: string
  fecha?: string | null
  created_at?: string | null
  concepto?: string | null
  categoria?: string | null
  monto?: number | string | null
  moneda_pago?: string | null
  monto_equivalente_usd?: number | string | null
  estado?: string | null
}

export type SolicitudCliente = {
  id: string
  tipo: string
  mensaje: string | null
  estado: string
  respuesta_recepcion: string | null
  created_at: string
}

export function useClientePortal() {
  const [cliente, setCliente] = useState<ClientePortal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData.user) {
      setError('No hay sesión activa.')
      setLoading(false)
      return
    }

    const { data, error: clienteError } = await supabase
      .from('clientes')
      .select('id,nombre,telefono,email,cedula,estado,acceso_portal')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle()

    if (clienteError) setError(clienteError.message)
    setCliente(data as ClientePortal | null)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { cliente, loading, error, reload: load }
}

export function useClienteCitas(clienteId?: string | null) {
  const [citas, setCitas] = useState<CitaCliente[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clienteId) return
    setLoading(true)
    setError(null)

    const { data, error: citasError } = await supabase
      .from('citas')
      .select('id,fecha,hora_inicio,hora_fin,estado,notas,servicios(nombre),empleados(nombre)')
      .eq('cliente_id', clienteId)
      .order('fecha', { ascending: true })
      .order('hora_inicio', { ascending: true })
      .limit(30)

    if (citasError) setError(citasError.message)
    setCitas((data ?? []) as CitaCliente[])
    setLoading(false)
  }, [clienteId])

  useEffect(() => {
    load()
  }, [load])

  return { citas, loading, error, reload: load }
}

export function useClientePagos(clienteId?: string | null) {
  const [pagos, setPagos] = useState<PagoCliente[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clienteId) return
    setLoading(true)
    setError(null)

    const { data, error: pagosError } = await supabase
      .from('pagos')
      .select('id,fecha,created_at,concepto,categoria,monto,moneda_pago,monto_equivalente_usd,estado')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (pagosError) setError(pagosError.message)
    setPagos((data ?? []) as PagoCliente[])
    setLoading(false)
  }, [clienteId])

  useEffect(() => {
    load()
  }, [load])

  return { pagos, loading, error, reload: load }
}

export function useClienteSolicitudes(clienteId?: string | null) {
  const [solicitudes, setSolicitudes] = useState<SolicitudCliente[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!clienteId) return
    setLoading(true)
    setError(null)

    const { data, error: solicitudesError } = await supabase
      .from('solicitudes_cliente')
      .select('id,tipo,mensaje,estado,respuesta_recepcion,created_at')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })
      .limit(25)

    if (solicitudesError) setError(solicitudesError.message)
    setSolicitudes((data ?? []) as SolicitudCliente[])
    setLoading(false)
  }, [clienteId])

  useEffect(() => {
    load()
  }, [load])

  return { solicitudes, loading, error, reload: load }
}

export function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-VE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

export function formatHour(value?: string | null) {
  if (!value) return '--:--'
  return value.slice(0, 5)
}

export function formatMoney(value?: number | string | null, moneda?: string | null) {
  const n = Number(value ?? 0)
  if (!Number.isFinite(n)) return `${moneda ?? ''} 0.00`.trim()
  return `${moneda ?? '$'} ${n.toFixed(2)}`
}

export function useProximaCita(citas: CitaCliente[]) {
  return useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return citas.find((cita) => {
      if (!cita.fecha) return false
      const d = new Date(`${cita.fecha}T00:00:00`)
      return d >= today && cita.estado !== 'cancelada'
    }) ?? null
  }, [citas])
}
