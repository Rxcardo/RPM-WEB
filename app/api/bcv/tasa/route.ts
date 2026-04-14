import { NextRequest, NextResponse } from 'next/server'
import { obtenerTasaBCVEuro } from '@/lib/finanzas/tasas'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const fecha = searchParams.get('fecha')

  if (!fecha) {
    return NextResponse.json(
      { error: 'Se requiere parámetro fecha (YYYY-MM-DD)' },
      { status: 400 }
    )
  }

  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json(
        { error: 'Formato de fecha inválido. Usa YYYY-MM-DD' },
        { status: 400 }
      )
    }

    const tasa = await obtenerTasaBCVEuro()

    if (tasa) {
      return NextResponse.json({
        success: true,
        fecha,
        tasa,
        moneda: 'EUR',
      })
    }

    return NextResponse.json(
      { success: false, error: 'No se pudo obtener la tasa', fecha },
      { status: 404 }
    )
  } catch (error) {
    console.error('Error en API /bcv/tasa:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'Guardar tasa manual no está disponible todavía.' },
    { status: 501 }
  )
}