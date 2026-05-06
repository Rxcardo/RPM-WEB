export function normalizePhone(phone) {
  const raw = String(phone || '').trim()

  if (!raw) return ''

  const only = raw.replace(/[^0-9+]/g, '')

  if (only.startsWith('+')) return only

  // Venezuela default si viene tipo 0412xxxxxxx
  if (only.startsWith('0') && only.length >= 10) {
    return `+58${only.slice(1)}`
  }

  // Si viene 412xxxxxxx
  if (only.length === 10 && only.startsWith('4')) {
    return `+58${only}`
  }

  return only
}

export async function sendWhatsApp({ to, body }) {
  const phone = normalizePhone(to)

  if (!phone) {
    return {
      ok: false,
      error: 'Teléfono vacío o inválido',
    }
  }

  if (!process.env.ULTRAMSG_INSTANCE_ID || !process.env.ULTRAMSG_TOKEN) {
    return {
      ok: false,
      error: 'Faltan ULTRAMSG_INSTANCE_ID o ULTRAMSG_TOKEN en .env.local',
    }
  }

  try {
    const response = await fetch(
      `https://api.ultramsg.com/${process.env.ULTRAMSG_INSTANCE_ID}/messages/chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: process.env.ULTRAMSG_TOKEN,
          to: phone,
          body,
        }),
      }
    )

    const text = await response.text()
    let data = null

    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }

    return {
      ok: response.ok,
      status: response.status,
      data,
    }
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'Error enviando WhatsApp',
    }
  }
}
