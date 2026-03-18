import { Resend } from 'resend'

export const runtime = 'nodejs'

type Canal = 'email' | 'whatsapp' | 'sms' | 'interno'
type Tipo = 'recordatorio' | 'promocion' | 'seguimiento' | 'aviso'

type SendBody = {
  canal: Canal
  to?: string
  subject?: string
  title?: string
  message?: string
  html?: string
  cliente_id?: string | null
  comunicacion_id?: string | null
  tipo?: Tipo
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildHtml(title: string, message: string) {
  const safeTitle = escapeHtml(title)
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br />')

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; max-width: 640px; margin: 0 auto; padding: 24px;">
      <div style="border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px;">
        <h2 style="margin: 0 0 16px; font-size: 22px; color: #0f172a;">${safeTitle}</h2>
        <div style="font-size: 14px; color: #334155;">${safeMessage}</div>
      </div>
    </div>
  `
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: Request) {
  try {
    const resendKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL

    if (!resendKey) {
      return json(
        {
          ok: false,
          error: 'Falta RESEND_API_KEY en variables de entorno.',
        },
        { status: 500 }
      )
    }

    if (!fromEmail) {
      return json(
        {
          ok: false,
          error: 'Falta RESEND_FROM_EMAIL en variables de entorno.',
        },
        { status: 500 }
      )
    }

    const body = (await request.json()) as SendBody

    const canal = body.canal
    const to = body.to?.trim() || ''
    const subject = body.subject?.trim() || body.title?.trim() || 'Comunicación'
    const message = body.message?.trim() || ''
    const html = body.html?.trim() || buildHtml(subject, message)

    if (!canal) {
      return json(
        { ok: false, error: 'El canal es obligatorio.' },
        { status: 400 }
      )
    }

    if (canal !== 'email') {
      return json(
        {
          ok: false,
          error: `Este endpoint envía email real. El canal "${canal}" no está implementado en backend todavía.`,
        },
        { status: 400 }
      )
    }

    if (!to) {
      return json(
        { ok: false, error: 'El destinatario "to" es obligatorio.' },
        { status: 400 }
      )
    }

    if (!isValidEmail(to)) {
      return json(
        { ok: false, error: 'El correo destinatario no es válido.' },
        { status: 400 }
      )
    }

    if (!message) {
      return json(
        { ok: false, error: 'El mensaje es obligatorio.' },
        { status: 400 }
      )
    }

    const resend = new Resend(resendKey)

    const result = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
      text: message,
    })

    if (result.error) {
      return json(
        {
          ok: false,
          error: result.error.message || 'Resend no pudo enviar el correo.',
          details: result.error,
        },
        { status: 502 }
      )
    }

    return json({
      ok: true,
      message: 'Correo enviado correctamente.',
      data: result.data,
    })
  } catch (error: any) {
    return json(
      {
        ok: false,
        error: error?.message || 'Error inesperado enviando comunicación.',
      },
      { status: 500 }
    )
  }
}