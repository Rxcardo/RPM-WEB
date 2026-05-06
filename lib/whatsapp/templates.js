export function applyTemplate(template, variables = {}) {
  let text = String(template || '')

  Object.entries(variables).forEach(([key, value]) => {
    text = text.replaceAll(`{{${key}}}`, value == null ? '' : String(value))
  })

  return text
}

export function formatDateShort(value) {
  if (!value) return ''

  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) return String(value)

  return date.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function formatTimeShort(value) {
  if (!value) return ''
  return String(value).slice(0, 5)
}
