import { NextRequest, NextResponse } from 'next/server'
import { obtenerTasaBCV } from '@/lib/finanzas/tasas'

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
    // Validar formato de fecha
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json(
        { error: 'Formato de fecha inválido. Usa YYYY-MM-DD' },
        { status: 400 }
      )
    }

    // Si tu helper no recibe argumentos, solo llámalo sin args
    const tasa = await obtenerTasaBCV()

    if (tasa) {
      return NextResponse.json({
        success: true,
        fecha,
        tasa,
        moneda: 'USD',
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'No se pudo obtener la tasa',
        fecha,
      },
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

// POST deshabilitado hasta tener una función real para guardar tasa manual
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Guardar tasa manual no está disponible todavía. Debes crear una función específica en lib/finanzas/tasas para guardar la tasa.',
    },
    { status: 501 }
  )
}