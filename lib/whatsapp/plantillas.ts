export type PlantillaWhatsApp =
  | 'pago_deuda'
  | 'bienvenida_cliente'
  | 'plan_por_vencer'
  // compatibilidad con nombres viejos usados en otros componentes
  | 'recordatorio_pago'
  | 'bienvenida'
  | 'plan_vencer'

type DatosWhatsApp = {
  nombre?: string
  fecha?: string
  hora?: string
  servicio?: string
  terapeuta?: string
  entrenador?: string
  monto?: string | number
  saldo?: string | number
  concepto?: string
  plan?: string
  sesiones?: number
  sesiones_restantes?: number
  motivo?: string
}

function normalizarTelefono(telefono: string) {
  const limpio = String(telefono || '').replace(/[^0-9+]/g, '')

  if (!limpio) return ''

  // Si ya viene con código internacional, se respeta.
  if (limpio.startsWith('+')) return limpio.replace('+', '')

  // Venezuela: si viene 0412 / 0424 / 0414 / 0416 / 0426, lo convierte a 58412...
  if (limpio.startsWith('0') && limpio.length >= 11) {
    return `58${limpio.slice(1)}`
  }

  return limpio
}

function valor(v: unknown, fallback = '') {
  if (v === null || v === undefined || v === '') return fallback
  return String(v)
}

export function generarMensaje(plantilla: PlantillaWhatsApp, datos: DatosWhatsApp = {}) {
  const nombre = valor(datos.nombre, 'cliente')
  const monto = valor(datos.monto ?? datos.saldo, '0')
  const concepto = valor(datos.concepto, 'saldo pendiente')
  const plan = valor(datos.plan, 'tu plan')
  const fecha = valor(datos.fecha, 'próximamente')
  const hora = valor(datos.hora, '')
  const servicio = valor(datos.servicio, 'tu sesión')
  const terapeuta = valor(datos.terapeuta ?? datos.entrenador, 'nuestro equipo')
  const sesiones = valor(datos.sesiones ?? datos.sesiones_restantes, '0')

  switch (plantilla) {
    case 'pago_deuda':
    case 'recordatorio_pago':
      return `Hola ${nombre}, te escribimos de Recovery RPM. Actualmente tienes un saldo pendiente de ${monto} USD por ${concepto}. Puedes confirmar tu pago por este medio. Gracias.`

    case 'bienvenida_cliente':
    case 'bienvenida':
      return `Hola ${nombre}, bienvenido/a a Recovery RPM. Tu proceso ya quedó registrado y nuestro equipo estará pendiente de tu evolución. Terapeuta asignado: ${terapeuta}.`

    case 'plan_por_vencer':
    case 'plan_vencer':
      return `Hola ${nombre}, te recordamos que ${plan} vence el ${fecha}. Te quedan ${sesiones} sesiones disponibles. Escríbenos para renovar o coordinar tus próximas sesiones.`

    default:
      return `Hola ${nombre}, te escribimos de Recovery RPM.`
  }
}

export function generarUrlWhatsApp(telefono: string, mensaje: string) {
  const phone = normalizarTelefono(telefono)
  const text = encodeURIComponent(mensaje)
  return `https://wa.me/${phone}?text=${text}`
}

export function enviarWhatsApp(telefono: string, mensaje: string) {
  const url = generarUrlWhatsApp(telefono, mensaje)

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return url
}
