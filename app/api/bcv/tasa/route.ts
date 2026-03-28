// app/api/bcv/tasa/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { obtenerTasaBCV, obtenerTasaDia, guardarTasaDia } from '@/lib/finanzas/tasas'

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

    const tasa = await obtenerTasaDia(fecha, 'USD')
    
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
        error: 'No se pudo obtener la tasa para la fecha especificada',
        fecha 
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

// POST para guardar tasa manual
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fecha, tasa, moneda = 'USD' } = body

    if (!fecha || !tasa) {
      return NextResponse.json(
        { error: 'Se requiere fecha y tasa' },
        { status: 400 }
      )
    }

    await guardarTasaDia(fecha, Number(tasa), moneda, 'manual')

    return NextResponse.json({
      success: true,
      message: 'Tasa guardada correctamente',
    })
  } catch (error) {
    console.error('Error guardando tasa:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}