'use client'

import { useState } from 'react'
import Card from '@/components/ui/Card'
import WhatsAppButton from './WhatsAppButton'

type Cliente = {
  id: string
  nombre: string
  telefono: string | null
}

type QuickAction = {
  id: string
  titulo: string
  descripcion: string
  plantilla: any
  getDatos: (cliente: Cliente) => any
}

const ACCIONES: QuickAction[] = [
  {
    id: 'bienvenida',
    titulo: '👋 Bienvenida',
    descripcion: 'Enviar mensaje de bienvenida',
    plantilla: 'bienvenida_cliente',
    getDatos: (cliente) => ({
      nombre: cliente.nombre,
      terapeuta: 'Tu terapeuta asignado',
    }),
  },
  {
    id: 'recordatorio_general',
    titulo: '📅 Recordatorio',
    descripcion: 'Recordar próxima cita',
    plantilla: 'recordatorio_cita',
    getDatos: (cliente) => ({
      nombre: cliente.nombre,
      fecha: 'mañana',
      hora: '10:00 AM',
      servicio: 'tu cita',
    }),
  },
]

type Props = {
  clientes?: Cliente[]
}

export default function WhatsAppQuickActions({ clientes = [] }: Props) {
  const [clienteSeleccionado, setClienteSeleccionado] = useState<string>('')

  const cliente = clientes.find((c) => c.id === clienteSeleccionado) || null
  const telefonoCliente = cliente?.telefono ?? ''

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-white">💬 Mensajes rápidos</h3>
      <p className="mt-1 text-sm text-white/55">Envía plantillas de WhatsApp</p>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-white/75">
          Seleccionar cliente
        </label>
        <select
          value={clienteSeleccionado}
          onChange={(e) => setClienteSeleccionado(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition focus:border-white/20 focus:bg-white/[0.05]"
        >
          <option value="" className="bg-[#11131a]">
            -- Selecciona un cliente --
          </option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id} className="bg-[#11131a]">
              {c.nombre} {c.telefono ? `(${c.telefono})` : '(Sin teléfono)'}
            </option>
          ))}
        </select>
      </div>

      {cliente && telefonoCliente && (
        <div className="mt-4 space-y-2">
          {ACCIONES.map((accion) => (
            <div
              key={accion.id}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3"
            >
              <div>
                <p className="text-sm font-medium text-white">{accion.titulo}</p>
                <p className="text-xs text-white/55">{accion.descripcion}</p>
              </div>

              <WhatsAppButton
                telefono={telefonoCliente}
                plantilla={accion.plantilla}
                datos={accion.getDatos(cliente)}
                variant="small"
              />
            </div>
          ))}
        </div>
      )}

      {cliente && !telefonoCliente && (
        <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3">
          <p className="text-sm text-rose-300">
            Este cliente no tiene teléfono registrado.
          </p>
        </div>
      )}
    </Card>
  )
}