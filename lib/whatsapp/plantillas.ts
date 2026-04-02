export type PlantillaWhatsApp =
  | 'recordatorio_cita'
  | 'confirmacion_cita'
  | 'bienvenida_cliente'
  | 'recordatorio_pago'
  | 'plan_por_vencer'
  | 'confirmacion_pago'
  | 'recordatorio_entrenamiento'
  | 'cancelacion_cita'

type DatosPlantilla = {
  nombre: string
  fecha?: string
  hora?: string
  servicio?: string
  terapeuta?: string
  entrenador?: string
  monto?: string
  concepto?: string
  plan?: string
  sesiones?: number
  telefono?: string
  motivo?: string
}

const PLANTILLAS: Record<PlantillaWhatsApp, (datos: DatosPlantilla) => string> = {
  recordatorio_cita: (datos) =>
    `Hola *${datos.nombre}*, te recordamos tu cita de *${datos.servicio}* mañana ${datos.fecha} a las *${datos.hora}* en RPM . ¡Te esperamos! 🏥`,

  confirmacion_cita: (datos) =>
    `Hola *${datos.nombre}*, tu cita ha sido agendada para el *${datos.fecha}* a las *${datos.hora}*.

📋 Servicio: ${datos.servicio}
👨‍⚕️ Terapeuta: ${datos.terapeuta}

¿Confirmas tu asistencia? Responde SÍ para confirmar.`,

  bienvenida_cliente: (datos) =>
    `¡Bienvenido/a a RPM, *${datos.nombre}*! 🎉

Estamos emocionados de acompañarte en tu proceso de recuperación y bienestar.

👨‍⚕️ Tu terapeuta asignado es: *${datos.terapeuta}*

Cualquier duda, estamos a tu disposición.`,

  recordatorio_pago: (datos) =>
    `Hola *${datos.nombre}*, te recordamos que tienes un pago pendiente:

💰 Monto: *${datos.monto}*
📝 Concepto: ${datos.concepto}

Puedes realizar el pago en recepción o mediante transferencia. ¡Gracias!`,

  plan_por_vencer: (datos) =>
    `Hola *${datos.nombre}*, tu plan *${datos.plan}* vence el *${datos.fecha}*.

📊 Te quedan *${datos.sesiones} sesiones* disponibles.

¿Deseas renovar tu plan? Contáctanos para conocer nuestras opciones. 💪`,

  confirmacion_pago: (datos) =>
    `Hola *${datos.nombre}*, confirmamos el pago de *${datos.monto}* por ${datos.concepto}.

✅ Pago registrado exitosamente.

¡Gracias por tu confianza en RPM ! 🙏`,

  recordatorio_entrenamiento: (datos) =>
    `Hola *${datos.nombre}*, te recordamos tu sesión de entrenamiento mañana ${datos.fecha} a las *${datos.hora}*.

🏋️ Entrenador: ${datos.entrenador}

¡Nos vemos mañana! 💪`,

  cancelacion_cita: (datos) =>
    `Hola *${datos.nombre}*, tu cita del ${datos.fecha} a las ${datos.hora} ha sido cancelada.

${datos.motivo ? `Motivo: ${datos.motivo}` : ''}

Si deseas reagendar, contáctanos. Estamos a tu disposición.`,
}

/**
 * Genera el mensaje de WhatsApp según la plantilla y los datos
 */
export function generarMensaje(
  plantilla: PlantillaWhatsApp,
  datos: DatosPlantilla
): string {
  const generador = PLANTILLAS[plantilla]
  if (!generador) {
    throw new Error(`Plantilla no encontrada: ${plantilla}`)
  }
  return generador(datos)
}

/**
 * Abre WhatsApp con el mensaje pre-cargado
 */
export function enviarWhatsApp(telefono: string, mensaje: string) {
  // Limpiar el teléfono (solo números)
  const telefonoLimpio = telefono.replace(/\D/g, '')

  // Asegurarse de que tenga código de país (58 para Venezuela)
  const telefonoCompleto = telefonoLimpio.startsWith('58')
    ? telefonoLimpio
    : `58${telefonoLimpio}`

  // Encodear el mensaje para URL
  const mensajeCodificado = encodeURIComponent(mensaje)

  // Generar URL de WhatsApp
  const url = `https://wa.me/${telefonoCompleto}?text=${mensajeCodificado}`

  // Abrir en nueva pestaña
  window.open(url, '_blank')
}

/**
 * Formatea fecha para mostrar en mensajes
 */
export function formatearFechaWhatsApp(fecha: string): string {
  const date = new Date(fecha)
  const opciones: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }
  return date.toLocaleDateString('es-ES', opciones)
}

/**
 * Formatea hora para mostrar en mensajes (HH:MM AM/PM)
 */
export function formatearHoraWhatsApp(hora: string): string {
  const [hours, minutes] = hora.split(':')
  const date = new Date()
  date.setHours(parseInt(hours), parseInt(minutes))

  return date.toLocaleTimeString('es-ES', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}