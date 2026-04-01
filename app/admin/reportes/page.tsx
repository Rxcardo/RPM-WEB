'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'
import { supabase } from '@/lib/supabase/client'
import Card from '@/components/ui/Card'
import Section from '@/components/ui/Section'
import StatCard from '@/components/ui/StatCard'

type ClienteRow = {
  id: string
  nombre: string
  telefono: string | null
  email: string | null
  estado: string
  created_at: string
  terapeuta_id: string | null
  empleados: { nombre: string } | null
}

type PlanRow = {
  id: string
  fecha_inicio: string | null
  fecha_fin: string | null
  sesiones_totales: number
  sesiones_usadas: number
  estado: string
  created_at: string
  clientes: { nombre: string } | null
  planes: { nombre: string; precio: number } | null
  precio_final_usd: number | null
  monto_final_bs: number | null
  moneda_venta: string | null
}

type CitaRow = {
  id: string
  fecha: string
  hora_inicio: string
  hora_fin: string
  estado: string
  clientes: { nombre: string } | null
  empleados: { nombre: string } | null
  servicios: { nombre: string; precio?: number } | null
  recursos: { nombre: string } | null
}

type IngresoRow = {
  id: string
  fecha: string
  concepto: string
  categoria: string
  monto: number
  estado: string
  tipo_origen: string
  created_at: string
  moneda_pago: string | null
  monto_equivalente_usd: number | null
  monto_equivalente_bs: number | null
  referencia?: string | null
  clientes: { nombre: string } | null
  metodos_pago_v2: { nombre: string; moneda?: string | null } | null
}

type EgresoRow = {
  id: string
  fecha: string
  concepto: string
  categoria: string
  proveedor: string | null
  monto: number
  estado: string
  created_at: string
  moneda: string | null
  monto_equivalente_usd: number | null
  monto_equivalente_bs: number | null
  referencia?: string | null
  metodos_pago_v2: { nombre: string; moneda?: string | null } | null
  empleados?: { nombre: string } | null
}

type CobranzaRow = {
  id: string
  cliente_nombre: string
  concepto: string
  tipo_origen: string
  monto_total_usd: number
  monto_pagado_usd: number
  saldo_usd: number
  fecha_venta: string
  fecha_vencimiento: string | null
  estado: string
  created_at: string
  clientes?: { nombre: string } | null
}

type InventarioRow = {
  id: string
  inventario_id: string
  tipo: string
  cantidad: number
  cantidad_anterior: number | null
  cantidad_nueva: number | null
  concepto: string
  precio_unitario_usd: number | null
  monto_total_usd: number | null
  created_at: string
  inventario?: { nombre: string } | null
}

type NominaRow = {
  id: string
  empleado_id: string
  fecha: string
  tipo: string
  moneda_pago: string
  monto_pago: number
  tasa_bcv: number | null
  monto_equivalente_usd: number | null
  monto_equivalente_bs: number | null
  notas: string | null
  created_at: string
  referencia: string | null
  empleados?: { nombre: string } | null
  metodos_pago_v2?: { nombre: string } | null
}

type TipoReporte = 'clientes' | 'planes' | 'citas' | 'ingresos' | 'egresos' | 'financiero' | 'cobranzas' | 'inventario' | 'nomina'
type PeriodoRapido = 'hoy' | '7d' | '30d' | 'este_mes' | 'este_ano' | 'personalizado'

type ConstanciaData = {
  paciente: string
  cedula?: string
  terapeuta?: string
  ciudad?: string
  fechaEmision?: string
  sesiones: Array<{ fecha: string; terapeuta: string; tipoSesion: string }>
}

const TIPOS = [
  { value: 'clientes', label: 'Clientes' },
  { value: 'planes', label: 'Planes' },
  { value: 'citas', label: 'Citas' },
  { value: 'ingresos', label: 'Ingresos' },
  { value: 'egresos', label: 'Egresos' },
  { value: 'financiero', label: 'Financiero' },
  { value: 'cobranzas', label: 'Cobranzas' },
  { value: 'inventario', label: 'Inventario' },
  { value: 'nomina', label: 'Nómina' },
] as const

const PIE_COLORS = ['#38bdf8', '#34d399', '#f59e0b', '#f87171', '#a78bfa', '#94a3b8']

const inputClassName = `
  w-full rounded-2xl border border-white/10 bg-white/[0.03]
  px-4 py-3 text-sm text-white outline-none transition
  placeholder:text-white/35
  focus:border-white/20 focus:bg-white/[0.05]
`

function money(value: number, currency: 'USD' | 'VES' = 'USD') {
  if (currency === 'VES') {
    return new Intl.NumberFormat('es-VE', {
      style: 'currency',
      currency: 'VES',
      maximumFractionDigits: 2,
    }).format(Number(value || 0))
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function firstDayOfMonthISO() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

function firstDayOfYearISO() {
  const now = new Date()
  return new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
}

function daysAgoISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function shortDate(value: string) {
  try {
    return new Date(value).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|\s)\S/g, (l) => l.toUpperCase())
}

function formatDateLong(value: string) {
  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return value
  }
}

function getWeekLabel(dateString: string) {
  const date = new Date(dateString)
  const firstDay = new Date(date.getFullYear(), 0, 1)
  const pastDays = Math.floor((date.getTime() - firstDay.getTime()) / 86400000)
  const week = Math.ceil((pastDays + firstDay.getDay() + 1) / 7)
  return `${date.getFullYear()}-S${String(week).padStart(2, '0')}`
}

function getMonthLabel(dateString: string) {
  const d = new Date(dateString)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getYearLabel(dateString: string) {
  return String(new Date(dateString).getFullYear())
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return value
  return String(value)
}

async function fetchImageAsBase64(src: string) {
  const res = await fetch(src)
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

async function exportStyledExcel(args: {
  title: string
  subtitle?: string
  sheetName?: string
  filename: string
  rows: Record<string, unknown>[]
  logoSrc?: string
  accentColor?: string
}) {
  const { title, subtitle, sheetName = 'Reporte', filename, rows, logoSrc = '/logo-rpm.png', accentColor = '111827' } = args

  if (!rows.length) {
    alert('No hay datos para exportar.')
    return
  }

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ChatGPT'
  workbook.created = new Date()
  workbook.modified = new Date()

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }],
  })

  const headers = Object.keys(rows[0])
  const totalCols = Math.max(headers.length, 1)

  worksheet.mergeCells(1, 2, 1, Math.min(totalCols, 6))
  worksheet.getCell('B1').value = 'RPM · PREHAB CARABOBO, C.A.'
  worksheet.getCell('B1').font = { name: 'Arial', size: 18, bold: true, color: { argb: '111827' } }

  worksheet.mergeCells(2, 2, 2, Math.min(totalCols, 6))
  worksheet.getCell('B2').value = title
  worksheet.getCell('B2').font = { name: 'Arial', size: 13, bold: true, color: { argb: accentColor } }

  worksheet.mergeCells(3, 2, 3, Math.min(totalCols, 8))
  worksheet.getCell('B3').value = subtitle || `Generado el ${new Date().toLocaleString('es-VE')}`
  worksheet.getCell('B3').font = { name: 'Arial', size: 10, color: { argb: '6B7280' } }

  if (logoSrc) {
    try {
      const base64 = await fetchImageAsBase64(logoSrc)
      const imageId = workbook.addImage({ base64, extension: 'png' })
      worksheet.addImage(imageId, {
        tl: { col: 0.15, row: 0.1 },
        ext: { width: 90, height: 90 },
      })
      worksheet.getRow(1).height = 34
      worksheet.getRow(2).height = 26
      worksheet.getRow(3).height = 22
    } catch (e) {
      console.error('No se pudo cargar el logo para Excel:', e)
    }
  }

  const headerRowIndex = 5
  const headerRow = worksheet.getRow(headerRowIndex)
  headers.forEach((header, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = header
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: accentColor },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'D1D5DB' } },
      left: { style: 'thin', color: { argb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
      right: { style: 'thin', color: { argb: 'D1D5DB' } },
    }
  })
  headerRow.height = 22

  rows.forEach((row, rowIndex) => {
    const excelRow = worksheet.getRow(headerRowIndex + 1 + rowIndex)
    headers.forEach((header, colIndex) => {
      const cell = excelRow.getCell(colIndex + 1)
      cell.value = normalizeCell(row[header]) as string | number
      cell.font = { name: 'Arial', size: 10, color: { argb: '111827' } }
      cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
      cell.border = {
        top: { style: 'thin', color: { argb: 'E5E7EB' } },
        left: { style: 'thin', color: { argb: 'E5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
        right: { style: 'thin', color: { argb: 'E5E7EB' } },
      }
      if (rowIndex % 2 === 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'F9FAFB' },
        }
      }
    })
  })

  headers.forEach((header, index) => {
    const values = rows.map((r) => String(r[header] ?? ''))
    const maxContent = Math.max(header.length, ...values.map((v) => v.length), 12)
    worksheet.getColumn(index + 1).width = Math.min(Math.max(maxContent + 2, 14), 32)
  })

  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    margins: {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  }

  worksheet.headerFooter.oddFooter = '&LPrehab Carabobo, C.A.&RPágina &P de &N'

  const buffer = await workbook.xlsx.writeBuffer()
  saveAs(new Blob([buffer]), filename)
}

async function exportReportePDF(args: {
  title: string
  subtitle?: string
  rows: Record<string, unknown>[]
  filename: string
  logoSrc?: string
}) {
  const { title, subtitle, rows, filename, logoSrc = '/logo-rpm.png' } = args

  if (!rows.length) {
    alert('No hay datos para exportar.')
    return
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  try {
    const base64 = await fetchImageAsBase64(logoSrc)
    doc.addImage(base64, 'PNG', 10, 8, 24, 24)
  } catch (e) {
    console.error('No se pudo cargar el logo para PDF:', e)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('PREHAB CARABOBO, C.A.', 40, 15)
  doc.setFontSize(12)
  doc.text(title.toUpperCase(), 40, 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(subtitle || `Generado el ${new Date().toLocaleString('es-VE')}`, 40, 28)

  const headers = Object.keys(rows[0])
  const body = rows.map((row) => headers.map((header) => normalizeCell(row[header])))

  autoTable(doc, {
    startY: 35,
    head: [headers],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.2,
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [17, 24, 39],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    margin: { top: 35, right: 10, bottom: 15, left: 10 },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.getHeight()
      doc.setFontSize(8)
      doc.text('Prehab Carabobo, C.A. · Reporte generado desde RPM', 10, pageHeight - 6)
      doc.text(`Página ${doc.getCurrentPageInfo().pageNumber}`, 285, pageHeight - 6, { align: 'right' })
    },
  })

  doc.save(filename)
}

async function exportConstanciaPDF(data: ConstanciaData, logoSrc = '/logo-rpm.png') {
  if (!data.paciente || !data.sesiones.length) {
    alert('Debes indicar el paciente y al menos una sesión para emitir la constancia.')
    return
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const marginX = 15
  let cursorY = 14

  try {
    const base64 = await fetchImageAsBase64(logoSrc)
    doc.addImage(base64, 'PNG', marginX, cursorY, 28, 28)
  } catch (e) {
    console.error('No se pudo cargar el logo para constancia:', e)
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('PREHAB CARABOBO, C.A.', 105, 18, { align: 'center' })
  doc.setFontSize(11)
  doc.text('CONTROL DE ASISTENCIAS', 105, 26, { align: 'center' })
  doc.setDrawColor(190)
  doc.line(55, 30, 195, 30)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`${data.ciudad || 'VALENCIA'}: ${data.fechaEmision || shortDate(todayISO())}`, 195, 36, { align: 'right' })

  cursorY = 48
  doc.setFontSize(9)
  doc.text('Atención:', marginX, cursorY)
  doc.setFont('helvetica', 'bold')
  doc.text('A QUIEN PUEDA INTERESAR', 36, cursorY)

  cursorY += 12
  const intro = `POR MEDIO DE LA PRESENTE HACEMOS CONSTANCIA DE QUE AL PACIENTE: ${String(data.paciente).toUpperCase()}${data.cedula ? `, TITULAR DE LA CÉDULA DE IDENTIDAD N°: ${String(data.cedula).toUpperCase()}` : ''}, SE LE EFECTUÓ TRATAMIENTO EN LOS DÍAS Y HORAS A CONTINUACIÓN DETALLADOS:`
  const introLines = doc.splitTextToSize(intro, 175)
  doc.setFont('helvetica', 'bold')
  doc.text(introLines, marginX, cursorY)

  const afterIntroY = cursorY + introLines.length * 5 + 4

  autoTable(doc, {
    startY: afterIntroY,
    margin: { left: marginX, right: marginX },
    head: [['FECHA', 'TERAPEUTA', 'TIPO DE SESIÓN']],
    body: data.sesiones.map((s) => [
      titleCase(formatDateLong(s.fecha)),
      (s.terapeuta || data.terapeuta || '—').toUpperCase(),
      (s.tipoSesion || 'SESIÓN DE FISIOTERAPIA').toUpperCase(),
    ]),
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      lineColor: [210, 210, 210],
      lineWidth: 0.2,
      cellPadding: 2,
      textColor: [20, 20, 20],
    },
    headStyles: {
      fillColor: [224, 224, 224],
      textColor: [40, 40, 40],
      fontStyle: 'bold',
    },
  })

  const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 120
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const primera = data.sesiones[0]?.fecha ? shortDate(data.sesiones[0].fecha) : '—'
  const ultima = data.sesiones[data.sesiones.length - 1]?.fecha ? shortDate(data.sesiones[data.sesiones.length - 1].fecha) : '—'
  doc.text(`Sesiones atendidas desde el ${primera} hasta el ${ultima}`, marginX, finalY + 8)

  const cierre = `CONSTANCIA QUE SE EMITE A PETICIÓN DE LA PARTE INTERESADA, EN LA CIUDAD DE ${String(data.ciudad || 'VALENCIA').toUpperCase()} EL ${data.fechaEmision || shortDate(todayISO())}`
  const cierreLines = doc.splitTextToSize(cierre, 175)
  doc.text(cierreLines, marginX, finalY + 18)

  try {
    const base64 = await fetchImageAsBase64(logoSrc)
    doc.addImage(base64, 'PNG', 128, 180, 28, 28)
  } catch {}

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Prehab Carabobo, C.A.', 142, 211, { align: 'center' })
  doc.text('J-504483931', 142, 215, { align: 'center' })

  doc.text('Realizado por:', 105, 244, { align: 'center' })
  doc.line(70, 258, 140, 258)
  doc.setFont('helvetica', 'bold')
  doc.text((data.terapeuta || 'F/T. JORGE MANTILLA').toUpperCase(), 105, 263, { align: 'center' })

  doc.setDrawColor(130)
  doc.line(15, 276, 195, 276)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('DIRECCIÓN: Naguanagua, complejo Bicentenario Asociación de Tenis de Carabobo ATEC, VALENCIA - ESTADO CARABOBO', 105, 281, { align: 'center' })
  doc.text('Teléfonos:  ·  rpmcarabobo@gmail.com', 105, 285, { align: 'center' })

  doc.save(`RPM_Constancia_${String(data.paciente).replace(/\s+/g, '_')}.pdf`)
}




export default function ReportesPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [tipo, setTipo] = useState<TipoReporte>('financiero')
  const [periodo, setPeriodo] = useState<PeriodoRapido>('este_mes')
  const [fechaInicio, setFechaInicio] = useState(firstDayOfMonthISO())
  const [fechaFin, setFechaFin] = useState(todayISO())
  const [search, setSearch] = useState('')
  const [monedaVista, setMonedaVista] = useState<'USD' | 'BS'>('USD')
  const [agrupacion, setAgrupacion] = useState<'dia' | 'semana' | 'mes' | 'anio'>('dia')

  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [planes, setPlanes] = useState<PlanRow[]>([])
  const [citas, setCitas] = useState<CitaRow[]>([])
  const [ingresos, setIngresos] = useState<IngresoRow[]>([])
  const [egresos, setEgresos] = useState<EgresoRow[]>([])
  const [cobranzas, setCobranzas] = useState<CobranzaRow[]>([])
  const [inventario, setInventario] = useState<InventarioRow[]>([])
  const [nomina, setNomina] = useState<NominaRow[]>([])

  const [constanciaPaciente, setConstanciaPaciente] = useState('')
  const [constanciaCedula, setConstanciaCedula] = useState('')
  const [constanciaTerapeuta, setConstanciaTerapeuta] = useState('F/T. JORGE MANTILLA')
  const [constanciaCiudad, setConstanciaCiudad] = useState('VALENCIA')

  const [totalGlobal, setTotalGlobal] = useState({
    clientes: 0,
    clientesActivos: 0,
    planes: 0,
    planesActivos: 0,
    citas: 0,
    inventarioItems: 0,
  })

  useEffect(() => {
    aplicarPeriodo(periodo)
  }, [])

  useEffect(() => {
    if (periodo !== 'personalizado') aplicarPeriodo(periodo)
  }, [periodo])

  useEffect(() => {
    void loadTotalesGlobales()
  }, [])

  useEffect(() => {
    void loadReporte()
  }, [tipo, fechaInicio, fechaFin])

  function aplicarPeriodo(p: PeriodoRapido) {
    const hoy = todayISO()
    if (p === 'hoy') {
      setFechaInicio(hoy)
      setFechaFin(hoy)
      setAgrupacion('dia')
      return
    }
    if (p === '7d') {
      setFechaInicio(daysAgoISO(6))
      setFechaFin(hoy)
      setAgrupacion('dia')
      return
    }
    if (p === '30d') {
      setFechaInicio(daysAgoISO(29))
      setFechaFin(hoy)
      setAgrupacion('semana')
      return
    }
    if (p === 'este_mes') {
      setFechaInicio(firstDayOfMonthISO())
      setFechaFin(hoy)
      setAgrupacion('dia')
      return
    }
    if (p === 'este_ano') {
      setFechaInicio(firstDayOfYearISO())
      setFechaFin(hoy)
      setAgrupacion('mes')
    }
  }

  async function loadTotalesGlobales() {
    try {
      const [{ count: totalClientes }, { count: clientesActivos }, { count: totalPlanes }, { count: planesActivos }, { count: totalCitas }, { count: inventarioItems }] = await Promise.all([
        supabase.from('clientes').select('*', { count: 'exact', head: true }),
        supabase.from('clientes').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
        supabase.from('clientes_planes').select('*', { count: 'exact', head: true }),
        supabase.from('clientes_planes').select('*', { count: 'exact', head: true }).eq('estado', 'activo'),
        supabase.from('citas').select('*', { count: 'exact', head: true }),
        supabase.from('inventario').select('*', { count: 'exact', head: true }),
      ])

      setTotalGlobal({
        clientes: totalClientes || 0,
        clientesActivos: clientesActivos || 0,
        planes: totalPlanes || 0,
        planesActivos: planesActivos || 0,
        citas: totalCitas || 0,
        inventarioItems: inventarioItems || 0,
      })
    } catch (err) {
      console.error(err)
    }
  }

  function limpiarDatos() {
    setClientes([])
    setPlanes([])
    setCitas([])
    setIngresos([])
    setEgresos([])
    setCobranzas([])
    setInventario([])
    setNomina([])
  }

  async function loadReporte() {
    try {
      setLoading(true)
      setError('')
      limpiarDatos()

      if (tipo === 'clientes') {
        const { data, error } = await supabase
          .from('clientes')
          .select(`id,nombre,telefono,email,estado,created_at,terapeuta_id,empleados:terapeuta_id(nombre)`)
          .order('created_at', { ascending: false })
        if (error) throw error
        setClientes((data || []) as ClienteRow[])
      }

      if (tipo === 'planes') {
        const { data, error } = await supabase
          .from('clientes_planes')
          .select(`id,fecha_inicio,fecha_fin,sesiones_totales,sesiones_usadas,estado,created_at,precio_final_usd,monto_final_bs,moneda_venta,clientes:cliente_id(nombre),planes:plan_id(nombre,precio)`)
          .order('created_at', { ascending: false })
        if (error) throw error
        setPlanes((data || []) as unknown as PlanRow[])
      }

      if (tipo === 'citas') {
        let query = supabase
          .from('citas')
          .select(`id,fecha,hora_inicio,hora_fin,estado,clientes:cliente_id(nombre),empleados:terapeuta_id(nombre),servicios:servicio_id(nombre,precio),recursos:recurso_id(nombre)`)
          .order('fecha', { ascending: false })
          .order('hora_inicio', { ascending: false })
        if (fechaInicio) query = query.gte('fecha', fechaInicio)
        if (fechaFin) query = query.lte('fecha', fechaFin)
        const { data, error } = await query
        if (error) throw error
        setCitas((data || []) as unknown as CitaRow[])
      }

      if (tipo === 'ingresos' || tipo === 'financiero') {
        let query = supabase
          .from('pagos')
          .select(`id,fecha,concepto,categoria,monto,estado,tipo_origen,created_at,moneda_pago,monto_equivalente_usd,monto_equivalente_bs,referencia,clientes:cliente_id(nombre),metodos_pago_v2:metodo_pago_v2_id(nombre,moneda)`)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false })
        if (fechaInicio) query = query.gte('fecha', fechaInicio)
        if (fechaFin) query = query.lte('fecha', fechaFin)
        const { data, error } = await query
        if (error) throw error
        setIngresos((data || []) as unknown as IngresoRow[])
      }

      if (tipo === 'egresos' || tipo === 'financiero') {
        let query = supabase
          .from('egresos')
          .select(`id,fecha,concepto,categoria,proveedor,monto,estado,created_at,moneda,monto_equivalente_usd,monto_equivalente_bs,referencia,metodos_pago_v2:metodo_pago_v2_id(nombre,moneda),empleados:empleado_id(nombre)`)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false })
        if (fechaInicio) query = query.gte('fecha', fechaInicio)
        if (fechaFin) query = query.lte('fecha', fechaFin)
        const { data, error } = await query
        if (error) throw error
        setEgresos((data || []) as unknown as EgresoRow[])
      }

      if (tipo === 'cobranzas') {
        let query = supabase
          .from('cuentas_por_cobrar')
          .select(`id,cliente_nombre,concepto,tipo_origen,monto_total_usd,monto_pagado_usd,saldo_usd,fecha_venta,fecha_vencimiento,estado,created_at,clientes:cliente_id(nombre)`)
          .order('fecha_venta', { ascending: false })
          .order('created_at', { ascending: false })
        if (fechaInicio) query = query.gte('fecha_venta', fechaInicio)
        if (fechaFin) query = query.lte('fecha_venta', fechaFin)
        const { data, error } = await query
        if (error) throw error
        setCobranzas((data || []) as unknown as CobranzaRow[])
      }

      if (tipo === 'inventario') {
        let query = supabase
          .from('movimientos_inventario')
          .select(`id,inventario_id,tipo,cantidad,cantidad_anterior,cantidad_nueva,concepto,precio_unitario_usd,monto_total_usd,created_at,inventario:inventario_id(nombre)`)
          .order('created_at', { ascending: false })
        if (fechaInicio) query = query.gte('created_at', `${fechaInicio}T00:00:00`)
        if (fechaFin) query = query.lte('created_at', `${fechaFin}T23:59:59`)
        const { data, error } = await query
        if (error) throw error
        setInventario((data || []) as unknown as InventarioRow[])
      }

      if (tipo === 'nomina') {
        let query = supabase
          .from('pagos_empleados')
          .select(`id,empleado_id,fecha,tipo,moneda_pago,monto_pago,tasa_bcv,monto_equivalente_usd,monto_equivalente_bs,notas,created_at,referencia,empleados:empleado_id(nombre),metodos_pago_v2:metodo_pago_v2_id(nombre)`)
          .order('fecha', { ascending: false })
          .order('created_at', { ascending: false })
        if (fechaInicio) query = query.gte('fecha', fechaInicio)
        if (fechaFin) query = query.lte('fecha', fechaFin)
        const { data, error } = await query
        if (error) throw error
        setNomina((data || []) as unknown as NominaRow[])
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'No se pudo generar el reporte.')
      limpiarDatos()
    } finally {
      setLoading(false)
    }
  }

  const clientesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clientes
    return clientes.filter((row) => [row.nombre, row.telefono, row.email, row.estado, row.empleados?.nombre].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
  }, [clientes, search])

  const planesFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return planes
    return planes.filter((row) => [row.clientes?.nombre, row.planes?.nombre, row.estado, row.moneda_venta].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
  }, [planes, search])

  const citasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return citas
    return citas.filter((row) => [row.clientes?.nombre, row.empleados?.nombre, row.servicios?.nombre, row.recursos?.nombre, row.estado].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
  }, [citas, search])

  const ingresosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return ingresos
    return ingresos.filter((row) => [row.concepto, row.categoria, row.tipo_origen, row.clientes?.nombre, row.metodos_pago_v2?.nombre, row.estado, row.referencia].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
  }, [ingresos, search])

  const egresosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return egresos
    return egresos.filter((row) => [row.concepto, row.categoria, row.proveedor, row.empleados?.nombre, row.metodos_pago_v2?.nombre, row.estado, row.referencia].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
  }, [egresos, search])

  const cobranzasFiltradas = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return cobranzas
    return cobranzas.filter((row) => [row.cliente_nombre, row.clientes?.nombre, row.concepto, row.tipo_origen, row.estado].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
  }, [cobranzas, search])

  const inventarioFiltrado = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return inventario
    return inventario.filter((row) => [row.inventario?.nombre, row.tipo, row.concepto].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
  }, [inventario, search])

  const nominaFiltrada = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return nomina
    return nomina.filter((row) => [row.empleados?.nombre, row.tipo, row.moneda_pago, row.notas, row.referencia].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))
  }, [nomina, search])

  const resumen = useMemo(() => {
    const ingresosUsd = ingresosFiltrados.filter((x) => x.estado === 'pagado').reduce((acc, x) => acc + Number(x.monto_equivalente_usd || 0), 0)
    const ingresosBs = ingresosFiltrados.filter((x) => x.estado === 'pagado').reduce((acc, x) => acc + Number(x.monto_equivalente_bs || 0), 0)
    const egresosUsd = egresosFiltrados.filter((x) => x.estado === 'pagado' || x.estado === 'liquidado').reduce((acc, x) => acc + Number(x.monto_equivalente_usd || 0), 0)
    const egresosBs = egresosFiltrados.filter((x) => x.estado === 'pagado' || x.estado === 'liquidado').reduce((acc, x) => acc + Number(x.monto_equivalente_bs || 0), 0)
    const carteraPendienteUsd = cobranzasFiltradas.reduce((acc, x) => acc + Number(x.saldo_usd || 0), 0)
    const citasCompletadas = citasFiltradas.filter((x) => x.estado === 'completada').length
    const citasCanceladas = citasFiltradas.filter((x) => x.estado === 'cancelada').length
    return {
      ingresosUsd,
      ingresosBs,
      egresosUsd,
      egresosBs,
      balanceUsd: ingresosUsd - egresosUsd,
      balanceBs: ingresosBs - egresosBs,
      carteraPendienteUsd,
      totalCitasCompletadas: citasCompletadas,
      totalCitasCanceladas: citasCanceladas,
    }
  }, [citasFiltradas, ingresosFiltrados, egresosFiltrados, cobranzasFiltradas])

  const citasEstadoChart = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of citasFiltradas) {
      const key = row.estado || 'sin estado'
      map.set(key, (map.get(key) || 0) + 1)
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [citasFiltradas])

  const categoriaChart = useMemo(() => {
    const map = new Map<string, number>()
    if (tipo === 'ingresos') {
      for (const row of ingresosFiltrados.filter((x) => x.estado === 'pagado')) {
        const key = row.categoria || 'general'
        const valor = monedaVista === 'USD' ? Number(row.monto_equivalente_usd || 0) : Number(row.monto_equivalente_bs || 0)
        map.set(key, (map.get(key) || 0) + valor)
      }
    } else if (tipo === 'egresos') {
      for (const row of egresosFiltrados.filter((x) => x.estado === 'pagado' || x.estado === 'liquidado')) {
        const key = row.categoria || 'operativo'
        const valor = monedaVista === 'USD' ? Number(row.monto_equivalente_usd || 0) : Number(row.monto_equivalente_bs || 0)
        map.set(key, (map.get(key) || 0) + valor)
      }
    } else {
      for (const row of ingresosFiltrados.filter((x) => x.estado === 'pagado')) {
        const key = `Ingreso: ${row.categoria || 'general'}`
        const valor = monedaVista === 'USD' ? Number(row.monto_equivalente_usd || 0) : Number(row.monto_equivalente_bs || 0)
        map.set(key, (map.get(key) || 0) + valor)
      }
      for (const row of egresosFiltrados.filter((x) => x.estado === 'pagado' || x.estado === 'liquidado')) {
        const key = `Egreso: ${row.categoria || 'operativo'}`
        const valor = monedaVista === 'USD' ? Number(row.monto_equivalente_usd || 0) : Number(row.monto_equivalente_bs || 0)
        map.set(key, (map.get(key) || 0) + valor)
      }
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [tipo, ingresosFiltrados, egresosFiltrados, monedaVista])

  const financieroAgrupadoChart = useMemo(() => {
    const map = new Map<string, { label: string; ingresosUsd: number; ingresosBs: number; egresosUsd: number; egresosBs: number }>()
    const getKey = (fecha: string) => {
      if (agrupacion === 'dia') return fecha
      if (agrupacion === 'semana') return getWeekLabel(fecha)
      if (agrupacion === 'mes') return getMonthLabel(fecha)
      return getYearLabel(fecha)
    }
    for (const row of ingresosFiltrados.filter((x) => x.estado === 'pagado')) {
      const key = getKey(row.fecha)
      const prev = map.get(key) || { label: key, ingresosUsd: 0, ingresosBs: 0, egresosUsd: 0, egresosBs: 0 }
      prev.ingresosUsd += Number(row.monto_equivalente_usd || 0)
      prev.ingresosBs += Number(row.monto_equivalente_bs || 0)
      map.set(key, prev)
    }
    for (const row of egresosFiltrados.filter((x) => x.estado === 'pagado' || x.estado === 'liquidado')) {
      const key = getKey(row.fecha)
      const prev = map.get(key) || { label: key, ingresosUsd: 0, ingresosBs: 0, egresosUsd: 0, egresosBs: 0 }
      prev.egresosUsd += Number(row.monto_equivalente_usd || 0)
      prev.egresosBs += Number(row.monto_equivalente_bs || 0)
      map.set(key, prev)
    }
    return Array.from(map.values()).map((row) => ({
      ...row,
      ingresos: monedaVista === 'USD' ? row.ingresosUsd : row.ingresosBs,
      egresos: monedaVista === 'USD' ? row.egresosUsd : row.egresosBs,
    }))
  }, [ingresosFiltrados, egresosFiltrados, monedaVista, agrupacion])

  const acumuladoChart = useMemo(() => {
    let acumulado = 0
    return financieroAgrupadoChart.map((d) => {
      const saldo = d.ingresos - d.egresos
      acumulado += saldo
      return { ...d, saldo, acumulado: Math.round(acumulado * 100) / 100 }
    })
  }, [financieroAgrupadoChart])

  function buildExportRows() {
    if (tipo === 'clientes') {
      return {
        title: 'Reporte de clientes',
        filenameBase: 'RPM_Clientes',
        rows: clientesFiltrados.map((row) => ({
          ID: row.id,
          Nombre: row.nombre,
          Teléfono: row.telefono || '',
          Email: row.email || '',
          Terapeuta: row.empleados?.nombre || '',
          Estado: row.estado,
          'Fecha Creación': formatDateTime(row.created_at),
        })),
      }
    }
    if (tipo === 'planes') {
      return {
        title: 'Reporte de planes',
        filenameBase: 'RPM_Planes',
        rows: planesFiltrados.map((row) => ({
          ID: row.id,
          Cliente: row.clientes?.nombre || '',
          Plan: row.planes?.nombre || '',
          'Precio Base Plan': Number(row.planes?.precio || 0),
          'Precio Final USD': Number(row.precio_final_usd || 0),
          'Precio Final BS': Number(row.monto_final_bs || 0),
          'Moneda Venta': row.moneda_venta || '',
          'Fecha Inicio': row.fecha_inicio || '',
          'Fecha Fin': row.fecha_fin || '',
          'Sesiones Totales': row.sesiones_totales,
          'Sesiones Usadas': row.sesiones_usadas,
          'Sesiones Restantes': Number(row.sesiones_totales || 0) - Number(row.sesiones_usadas || 0),
          Estado: row.estado,
        })),
      }
    }
    if (tipo === 'citas') {
      return {
        title: 'Reporte de citas',
        filenameBase: 'RPM_Citas',
        rows: citasFiltradas.map((row) => ({
          ID: row.id,
          Fecha: row.fecha,
          'Hora Inicio': row.hora_inicio,
          'Hora Fin': row.hora_fin,
          Cliente: row.clientes?.nombre || '',
          Terapeuta: row.empleados?.nombre || '',
          Servicio: row.servicios?.nombre || '',
          Recurso: row.recursos?.nombre || '',
          Estado: row.estado,
        })),
      }
    }
    if (tipo === 'ingresos') {
      return {
        title: 'Reporte de ingresos',
        filenameBase: 'RPM_Ingresos',
        rows: ingresosFiltrados.map((row) => ({
          ID: row.id,
          Fecha: row.fecha,
          Concepto: row.concepto,
          Categoría: row.categoria,
          'Tipo Origen': row.tipo_origen,
          Cliente: row.clientes?.nombre || '',
          'Método Pago': row.metodos_pago_v2?.nombre || '',
          'Moneda Pago': row.moneda_pago || '',
          Referencia: row.referencia || '',
          'Monto Original': Number(row.monto || 0),
          'Monto USD': Number(row.monto_equivalente_usd || 0),
          'Monto BS': Number(row.monto_equivalente_bs || 0),
          Estado: row.estado,
        })),
      }
    }
    if (tipo === 'egresos') {
      return {
        title: 'Reporte de egresos',
        filenameBase: 'RPM_Egresos',
        rows: egresosFiltrados.map((row) => ({
          ID: row.id,
          Fecha: row.fecha,
          Concepto: row.concepto,
          Categoría: row.categoria,
          Proveedor: row.proveedor || '',
          Empleado: row.empleados?.nombre || '',
          'Método Pago': row.metodos_pago_v2?.nombre || '',
          Moneda: row.moneda || '',
          Referencia: row.referencia || '',
          'Monto Original': Number(row.monto || 0),
          'Monto USD': Number(row.monto_equivalente_usd || 0),
          'Monto BS': Number(row.monto_equivalente_bs || 0),
          Estado: row.estado,
        })),
      }
    }
    if (tipo === 'cobranzas') {
      return {
        title: 'Reporte de cobranzas',
        filenameBase: 'RPM_Cobranzas',
        rows: cobranzasFiltradas.map((row) => ({
          ID: row.id,
          Cliente: row.clientes?.nombre || row.cliente_nombre || '',
          Concepto: row.concepto,
          'Tipo Origen': row.tipo_origen,
          'Monto Total USD': Number(row.monto_total_usd || 0),
          'Monto Pagado USD': Number(row.monto_pagado_usd || 0),
          'Saldo USD': Number(row.saldo_usd || 0),
          'Fecha Venta': row.fecha_venta,
          'Fecha Vencimiento': row.fecha_vencimiento || '',
          Estado: row.estado,
        })),
      }
    }
    if (tipo === 'inventario') {
      return {
        title: 'Reporte de inventario',
        filenameBase: 'RPM_Inventario',
        rows: inventarioFiltrado.map((row) => ({
          ID: row.id,
          Producto: row.inventario?.nombre || '',
          Tipo: row.tipo,
          Cantidad: Number(row.cantidad || 0),
          'Cantidad Anterior': Number(row.cantidad_anterior || 0),
          'Cantidad Nueva': Number(row.cantidad_nueva || 0),
          Concepto: row.concepto,
          'Precio Unitario USD': Number(row.precio_unitario_usd || 0),
          'Monto Total USD': Number(row.monto_total_usd || 0),
          'Fecha Creación': formatDateTime(row.created_at),
        })),
      }
    }
    if (tipo === 'nomina') {
      return {
        title: 'Reporte de nómina',
        filenameBase: 'RPM_Nomina',
        rows: nominaFiltrada.map((row) => ({
          ID: row.id,
          Fecha: row.fecha,
          Empleado: row.empleados?.nombre || '',
          Tipo: row.tipo,
          'Moneda Pago': row.moneda_pago,
          'Monto Pago': Number(row.monto_pago || 0),
          'Monto USD': Number(row.monto_equivalente_usd || 0),
          'Monto BS': Number(row.monto_equivalente_bs || 0),
          'Método Pago': row.metodos_pago_v2?.nombre || '',
          Referencia: row.referencia || '',
          Notas: row.notas || '',
        })),
      }
    }
    return {
      title: 'Reporte financiero',
      filenameBase: 'RPM_Financiero',
      rows: [
        ...ingresosFiltrados.map((row) => ({
          Fecha: row.fecha,
          Tipo: 'Ingreso',
          Concepto: row.concepto,
          Categoría: row.categoria,
          Tercero: row.clientes?.nombre || '',
          'Método Pago': row.metodos_pago_v2?.nombre || '',
          Referencia: row.referencia || '',
          'Monto USD': Number(row.monto_equivalente_usd || 0),
          'Monto BS': Number(row.monto_equivalente_bs || 0),
          Estado: row.estado,
        })),
        ...egresosFiltrados.map((row) => ({
          Fecha: row.fecha,
          Tipo: 'Egreso',
          Concepto: row.concepto,
          Categoría: row.categoria,
          Tercero: row.empleados?.nombre || row.proveedor || '',
          'Método Pago': row.metodos_pago_v2?.nombre || '',
          Referencia: row.referencia || '',
          'Monto USD': Number(row.monto_equivalente_usd || 0),
          'Monto BS': Number(row.monto_equivalente_bs || 0),
          Estado: row.estado,
        })),
      ],
    }
  }

  async function handleExportExcel() {
    const data = buildExportRows()
    const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    await exportStyledExcel({
      title: data.title,
      subtitle: `Período: ${fechaInicio} a ${fechaFin}`,
      sheetName: data.title,
      filename: `${data.filenameBase}_${stamp}.xlsx`,
      rows: data.rows,
      logoSrc: '/logo-rpm.png',
      accentColor: '111827',
    })
  }

  async function handleExportPDF() {
    const data = buildExportRows()
    const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    await exportReportePDF({
      title: data.title,
      subtitle: `Período: ${fechaInicio} a ${fechaFin}`,
      rows: data.rows,
      filename: `${data.filenameBase}_${stamp}.pdf`,
      logoSrc: '/logo-rpm.png',
    })
  }

  async function handleConstanciaPDF() {
    const sesiones = citasFiltradas
      .filter((row) => (row.estado || '').toLowerCase() !== 'cancelada')
      .map((row) => ({
        fecha: row.fecha,
        terapeuta: row.empleados?.nombre || constanciaTerapeuta,
        tipoSesion: row.servicios?.nombre || 'Sesión de fisioterapia',
      }))
      .sort((a, b) => (a.fecha > b.fecha ? 1 : -1))

    await exportConstanciaPDF({
      paciente: constanciaPaciente || citasFiltradas[0]?.clientes?.nombre || '',
      cedula: constanciaCedula,
      terapeuta: constanciaTerapeuta,
      ciudad: constanciaCiudad,
      fechaEmision: shortDate(todayISO()),
      sesiones,
    })
  }

  
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-sm text-white/55">Administración</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Reportes</h1>
          <p className="mt-2 text-sm text-white/55">Estadísticas, exportación Excel/PDF y constancias.</p>
        </div>

        {(tipo === 'ingresos' || tipo === 'egresos' || tipo === 'financiero' || tipo === 'nomina') && (
          <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.02] p-1">
            <button type="button" onClick={() => setMonedaVista('USD')} className={`rounded-xl px-6 py-2.5 text-sm font-medium transition ${monedaVista === 'USD' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'text-white/45 hover:text-white/70'}`}>
              💵 USD
            </button>
            <button type="button" onClick={() => setMonedaVista('BS')} className={`rounded-xl px-6 py-2.5 text-sm font-medium transition ${monedaVista === 'BS' ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30' : 'text-white/45 hover:text-white/70'}`}>
              💰 BS
            </button>
          </div>
        )}
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm font-medium text-rose-400">Error</p>
          <p className="mt-1 text-sm text-white/55">{error}</p>
        </Card>
      ) : null}

      <Section title="Filtros del reporte" description="Configura área, período, búsqueda y exportación.">
        <div className="grid gap-3 md:grid-cols-6 xl:grid-cols-8">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/75">Área</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoReporte)} className={inputClassName}>
              {TIPOS.map((item) => (
                <option key={item.value} value={item.value} className="bg-[#11131a] text-white">{item.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/75">Período</label>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value as PeriodoRapido)} className={inputClassName}>
              <option value="hoy" className="bg-[#11131a]">Hoy</option>
              <option value="7d" className="bg-[#11131a]">7 días</option>
              <option value="30d" className="bg-[#11131a]">30 días</option>
              <option value="este_mes" className="bg-[#11131a]">Este mes</option>
              <option value="este_ano" className="bg-[#11131a]">Este año</option>
              <option value="personalizado" className="bg-[#11131a]">Personalizado</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/75">Desde</label>
            <input type="date" value={fechaInicio} onChange={(e) => { setPeriodo('personalizado'); setFechaInicio(e.target.value) }} className={inputClassName} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/75">Hasta</label>
            <input type="date" value={fechaFin} onChange={(e) => { setPeriodo('personalizado'); setFechaFin(e.target.value) }} className={inputClassName} />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/75">Agrupar</label>
            <select value={agrupacion} onChange={(e) => setAgrupacion(e.target.value as 'dia' | 'semana' | 'mes' | 'anio')} className={inputClassName}>
              <option value="dia" className="bg-[#11131a]">Día</option>
              <option value="semana" className="bg-[#11131a]">Semana</option>
              <option value="mes" className="bg-[#11131a]">Mes</option>
              <option value="anio" className="bg-[#11131a]">Año</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-2 block text-sm font-medium text-white/75">Buscar</label>
            <input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className={inputClassName} />
          </div>

          <div className="flex items-end gap-2">
            <button onClick={() => loadReporte()} disabled={loading} className="flex-1 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.12] disabled:opacity-60">
              {loading ? 'Cargando...' : '🔄 Generar'}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={handleExportExcel} disabled={loading} className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-60">📗 Excel bonito</button>
          <button onClick={handleExportPDF} disabled={loading} className="rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm font-semibold text-sky-300 transition hover:bg-sky-400/20 disabled:opacity-60">📄 PDF reporte</button>
          {tipo === 'citas' && (
            <button onClick={handleConstanciaPDF} disabled={loading || citasFiltradas.length === 0} className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-amber-400/20 disabled:opacity-60">🧾 Constancia PDF</button>
          )}
        </div>
      </Section>

      {tipo === 'citas' && (
        <Section title="Datos para la constancia" description="Estos datos alimentan el PDF con el formato de tu ejemplo.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/75">Paciente</label>
              <input value={constanciaPaciente} onChange={(e) => setConstanciaPaciente(e.target.value)} placeholder="Nombre del paciente" className={inputClassName} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-white/75">Cédula</label>
              <input value={constanciaCedula} onChange={(e) => setConstanciaCedula(e.target.value)} placeholder="V12345678" className={inputClassName} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-white/75">Terapeuta firma</label>
              <input value={constanciaTerapeuta} onChange={(e) => setConstanciaTerapeuta(e.target.value)} className={inputClassName} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-white/75">Ciudad</label>
              <input value={constanciaCiudad} onChange={(e) => setConstanciaCiudad(e.target.value)} className={inputClassName} />
            </div>
          </div>
        </Section>
      )}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Clientes" value={totalGlobal.clientes} subtitle={`Activos: ${totalGlobal.clientesActivos}`} color="text-sky-400" />
        <StatCard title="Planes" value={totalGlobal.planes} subtitle={`Activos: ${totalGlobal.planesActivos}`} color="text-violet-400" />
        <StatCard title="Citas" value={totalGlobal.citas} subtitle={`✓${resumen.totalCitasCompletadas} · ✗${resumen.totalCitasCanceladas}`} color="text-amber-300" />
        <StatCard title={`Ingresos ${monedaVista}`} value={money(monedaVista === 'USD' ? resumen.ingresosUsd : resumen.ingresosBs, monedaVista === 'USD' ? 'USD' : 'VES')} color="text-emerald-400" />
        <StatCard title={`Egresos ${monedaVista}`} value={money(monedaVista === 'USD' ? resumen.egresosUsd : resumen.egresosBs, monedaVista === 'USD' ? 'USD' : 'VES')} color="text-rose-400" />
        <StatCard title={tipo === 'cobranzas' ? 'Pendiente USD' : `Balance ${monedaVista}`} value={tipo === 'cobranzas' ? money(resumen.carteraPendienteUsd, 'USD') : money(monedaVista === 'USD' ? resumen.balanceUsd : resumen.balanceBs, monedaVista === 'USD' ? 'USD' : 'VES')} color={tipo === 'cobranzas' ? 'text-amber-400' : (monedaVista === 'USD' ? resumen.balanceUsd : resumen.balanceBs) >= 0 ? 'text-cyan-400' : 'text-rose-400'} />
      </div>

      {(tipo === 'citas' || tipo === 'ingresos' || tipo === 'egresos' || tipo === 'financiero' || tipo === 'nomina') && (
        <div className="grid gap-6 xl:grid-cols-2">
          {tipo === 'citas' && citasEstadoChart.length > 0 && (
            <Section title="Estados de citas" description="Distribución por estado.">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={citasEstadoChart} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={3}>
                      {citasEstadoChart.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Section>
          )}

          {(tipo === 'financiero' || tipo === 'ingresos' || tipo === 'egresos') && financieroAgrupadoChart.length > 0 && (
            <Section title={`Ingresos vs Egresos (${monedaVista})`} description={`Comparativo por ${agrupacion}.`}>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financieroAgrupadoChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="label" stroke="rgba(255,255,255,0.45)" />
                    <YAxis stroke="rgba(255,255,255,0.45)" />
                    <Tooltip formatter={(value) => money(Number(value), monedaVista === 'USD' ? 'USD' : 'VES')} />
                    <Legend />
                    <Bar dataKey="ingresos" fill="#34d399" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="egresos" fill="#f87171" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          )}

          {tipo === 'financiero' && acumuladoChart.length > 0 && (
            <Section title={`Flujo acumulado (${monedaVista})`} description={`Evolución del saldo por ${agrupacion}.`}>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={acumuladoChart}>
                    <defs>
                      <linearGradient id="colorAcumulado" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="label" stroke="rgba(255,255,255,0.45)" />
                    <YAxis stroke="rgba(255,255,255,0.45)" />
                    <Tooltip formatter={(v) => money(Number(v), monedaVista === 'USD' ? 'USD' : 'VES')} />
                    <Area type="monotone" dataKey="acumulado" stroke="#a78bfa" strokeWidth={2} fill="url(#colorAcumulado)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Section>
          )}

          {categoriaChart.length > 0 && (
            <Section title={`Distribución por categoría (${monedaVista})`} description="Top categorías del período.">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoriaChart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis type="number" stroke="rgba(255,255,255,0.45)" />
                    <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.45)" width={120} />
                    <Tooltip formatter={(value) => money(Number(value), monedaVista === 'USD' ? 'USD' : 'VES')} />
                    <Bar dataKey="value" fill="#60a5fa" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          )}
        </div>
      )}

      {tipo === 'clientes' && (
        <Section title="Reporte de clientes" description={`${clientesFiltrados.length} registros`} className="p-0" contentClassName="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium">Teléfono</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Terapeuta</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-left font-medium">Creado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {clientesFiltrados.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-white/55">No hay clientes.</td></tr>
                ) : (
                  clientesFiltrados.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-white">{row.nombre}</td>
                      <td className="px-4 py-3 text-white/75">{row.telefono || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.email || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.empleados?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.estado}</td>
                      <td className="px-4 py-3 text-white/75">{shortDate(row.created_at.slice(0, 10))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tipo === 'planes' && (
        <Section title="Reporte de planes" description={`${planesFiltrados.length} registros`} className="p-0" contentClassName="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Plan</th>
                  <th className="px-4 py-3 text-left font-medium">Precio Final</th>
                  <th className="px-4 py-3 text-left font-medium">Moneda</th>
                  <th className="px-4 py-3 text-left font-medium">Inicio</th>
                  <th className="px-4 py-3 text-left font-medium">Fin</th>
                  <th className="px-4 py-3 text-left font-medium">Usadas</th>
                  <th className="px-4 py-3 text-left font-medium">Restantes</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {planesFiltrados.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-6 text-center text-white/55">No hay planes.</td></tr>
                ) : (
                  planesFiltrados.map((row) => {
                    const precioFinal = row.moneda_venta === 'USD'
                      ? row.precio_final_usd || row.planes?.precio || 0
                      : row.monto_final_bs || 0
                    const sesionesRestantes = Number(row.sesiones_totales || 0) - Number(row.sesiones_usadas || 0)

                    return (
                      <tr key={row.id} className="transition hover:bg-white/[0.03]">
                        <td className="px-4 py-3 font-medium text-white">{row.clientes?.nombre || '—'}</td>
                        <td className="px-4 py-3 text-white/75">{row.planes?.nombre || '—'}</td>
                        <td className="px-4 py-3 text-white/75">
                          {row.moneda_venta === 'BS' ? money(precioFinal, 'VES') : money(precioFinal, 'USD')}
                        </td>
                        <td className="px-4 py-3 text-white/75">{row.moneda_venta || '—'}</td>
                        <td className="px-4 py-3 text-white/75">{row.fecha_inicio ? shortDate(row.fecha_inicio) : '—'}</td>
                        <td className="px-4 py-3 text-white/75">{row.fecha_fin ? shortDate(row.fecha_fin) : '—'}</td>
                        <td className="px-4 py-3 text-white/75">{row.sesiones_usadas}</td>
                        <td className="px-4 py-3 text-white/75">{sesionesRestantes}</td>
                        <td className="px-4 py-3 text-white/75">{row.estado}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tipo === 'citas' && (
        <Section title="Reporte de citas" description={`${citasFiltradas.length} registros`} className="p-0" contentClassName="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Hora</th>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Terapeuta</th>
                  <th className="px-4 py-3 text-left font-medium">Servicio</th>
                  <th className="px-4 py-3 text-left font-medium">Recurso</th>
                  <th className="px-4 py-3 text-left font-medium">Precio</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {citasFiltradas.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-white/55">No hay citas.</td></tr>
                ) : (
                  citasFiltradas.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white/75">{shortDate(row.fecha)}</td>
                      <td className="px-4 py-3 text-white/75">{row.hora_inicio} - {row.hora_fin}</td>
                      <td className="px-4 py-3 font-medium text-white">{row.clientes?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.empleados?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.servicios?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.recursos?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-emerald-400 font-semibold">{money(Number(row.servicios?.precio || 0), 'USD')}</td>
                      <td className="px-4 py-3 text-white/75">{row.estado}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tipo === 'ingresos' && (
        <Section title="Reporte de ingresos" description={`${ingresosFiltrados.length} registros`} className="p-0" contentClassName="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Concepto</th>
                  <th className="px-4 py-3 text-left font-medium">Categoría</th>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Método</th>
                  <th className="px-4 py-3 text-left font-medium">Monto USD</th>
                  <th className="px-4 py-3 text-left font-medium">Monto BS</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {ingresosFiltrados.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-white/55">No hay ingresos.</td></tr>
                ) : (
                  ingresosFiltrados.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white/75">{shortDate(row.fecha)}</td>
                      <td className="px-4 py-3 font-medium text-white">{row.concepto}</td>
                      <td className="px-4 py-3 text-white/75">{row.categoria}</td>
                      <td className="px-4 py-3 text-white/75">{row.clientes?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.metodos_pago_v2?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{money(Number(row.monto_equivalente_usd || 0), 'USD')}</td>
                      <td className="px-4 py-3 text-white/75">{money(Number(row.monto_equivalente_bs || 0), 'VES')}</td>
                      <td className="px-4 py-3 text-white/75">{row.estado}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tipo === 'egresos' && (
        <Section title="Reporte de egresos" description={`${egresosFiltrados.length} registros`} className="p-0" contentClassName="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Concepto</th>
                  <th className="px-4 py-3 text-left font-medium">Categoría</th>
                  <th className="px-4 py-3 text-left font-medium">Proveedor / Empleado</th>
                  <th className="px-4 py-3 text-left font-medium">Método</th>
                  <th className="px-4 py-3 text-left font-medium">Monto USD</th>
                  <th className="px-4 py-3 text-left font-medium">Monto BS</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {egresosFiltrados.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-white/55">No hay egresos.</td></tr>
                ) : (
                  egresosFiltrados.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white/75">{shortDate(row.fecha)}</td>
                      <td className="px-4 py-3 font-medium text-white">{row.concepto}</td>
                      <td className="px-4 py-3 text-white/75">{row.categoria}</td>
                      <td className="px-4 py-3 text-white/75">{row.empleados?.nombre || row.proveedor || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.metodos_pago_v2?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{money(Number(row.monto_equivalente_usd || 0), 'USD')}</td>
                      <td className="px-4 py-3 text-white/75">{money(Number(row.monto_equivalente_bs || 0), 'VES')}</td>
                      <td className="px-4 py-3 text-white/75">{row.estado}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tipo === 'cobranzas' && (
        <Section title="Reporte de cobranzas" description={`${cobranzasFiltradas.length} registros`} className="p-0" contentClassName="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium">Concepto</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo origen</th>
                  <th className="px-4 py-3 text-left font-medium">Total USD</th>
                  <th className="px-4 py-3 text-left font-medium">Pagado USD</th>
                  <th className="px-4 py-3 text-left font-medium">Saldo USD</th>
                  <th className="px-4 py-3 text-left font-medium">Vence</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {cobranzasFiltradas.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-white/55">No hay cobranzas.</td></tr>
                ) : (
                  cobranzasFiltradas.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-white">{row.clientes?.nombre || row.cliente_nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.concepto}</td>
                      <td className="px-4 py-3 text-white/75">{row.tipo_origen}</td>
                      <td className="px-4 py-3 text-white/75">{money(Number(row.monto_total_usd || 0), 'USD')}</td>
                      <td className="px-4 py-3 text-white/75">{money(Number(row.monto_pagado_usd || 0), 'USD')}</td>
                      <td className="px-4 py-3 text-white/75">{money(Number(row.saldo_usd || 0), 'USD')}</td>
                      <td className="px-4 py-3 text-white/75">{row.fecha_vencimiento ? shortDate(row.fecha_vencimiento) : '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.estado}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tipo === 'inventario' && (
        <Section title="Reporte de inventario" description={`${inventarioFiltrado.length} registros`} className="p-0" contentClassName="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Producto</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Cantidad</th>
                  <th className="px-4 py-3 text-left font-medium">Anterior</th>
                  <th className="px-4 py-3 text-left font-medium">Nueva</th>
                  <th className="px-4 py-3 text-left font-medium">Concepto</th>
                  <th className="px-4 py-3 text-left font-medium">Monto Total USD</th>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {inventarioFiltrado.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-white/55">No hay movimientos.</td></tr>
                ) : (
                  inventarioFiltrado.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-white">{row.inventario?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.tipo}</td>
                      <td className="px-4 py-3 text-white/75">{row.cantidad}</td>
                      <td className="px-4 py-3 text-white/75">{row.cantidad_anterior ?? '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.cantidad_nueva ?? '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.concepto}</td>
                      <td className="px-4 py-3 text-white/75">{money(Number(row.monto_total_usd || 0), 'USD')}</td>
                      <td className="px-4 py-3 text-white/75">{formatDateTime(row.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tipo === 'nomina' && (
        <Section title="Reporte de nómina" description={`${nominaFiltrada.length} registros`} className="p-0" contentClassName="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Empleado</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Moneda</th>
                  <th className="px-4 py-3 text-left font-medium">Monto USD</th>
                  <th className="px-4 py-3 text-left font-medium">Monto BS</th>
                  <th className="px-4 py-3 text-left font-medium">Método</th>
                  <th className="px-4 py-3 text-left font-medium">Referencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {nominaFiltrada.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-white/55">No hay pagos de nómina.</td></tr>
                ) : (
                  nominaFiltrada.map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white/75">{shortDate(row.fecha)}</td>
                      <td className="px-4 py-3 font-medium text-white">{row.empleados?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.tipo}</td>
                      <td className="px-4 py-3 text-white/75">{row.moneda_pago}</td>
                      <td className="px-4 py-3 text-white/75">{money(Number(row.monto_equivalente_usd || 0), 'USD')}</td>
                      <td className="px-4 py-3 text-white/75">{money(Number(row.monto_equivalente_bs || 0), 'VES')}</td>
                      <td className="px-4 py-3 text-white/75">{row.metodos_pago_v2?.nombre || '—'}</td>
                      <td className="px-4 py-3 text-white/75">{row.referencia || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tipo === 'financiero' && (
        <Section title="Reporte financiero" description={`${ingresosFiltrados.length + egresosFiltrados.length} movimientos`} className="p-0" contentClassName="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-white/55">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium">Concepto</th>
                  <th className="px-4 py-3 text-left font-medium">Categoría</th>
                  <th className="px-4 py-3 text-left font-medium">Tercero</th>
                  <th className="px-4 py-3 text-left font-medium">Método</th>
                  <th className="px-4 py-3 text-left font-medium">Monto USD</th>
                  <th className="px-4 py-3 text-left font-medium">Monto BS</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {ingresosFiltrados.length === 0 && egresosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-white/55">No hay movimientos financieros.</td>
                  </tr>
                ) : [...
                  ingresosFiltrados.map((row) => ({
                    id: `ing-${row.id}`,
                    fecha: row.fecha,
                    tipo: 'Ingreso',
                    concepto: row.concepto,
                    categoria: row.categoria,
                    tercero: row.clientes?.nombre || '—',
                    metodo: row.metodos_pago_v2?.nombre || '—',
                    montoUsd: Number(row.monto_equivalente_usd || 0),
                    montoBs: Number(row.monto_equivalente_bs || 0),
                    estado: row.estado,
                  })),
                  ...egresosFiltrados.map((row) => ({
                    id: `egr-${row.id}`,
                    fecha: row.fecha,
                    tipo: 'Egreso',
                    concepto: row.concepto,
                    categoria: row.categoria,
                    tercero: row.empleados?.nombre || row.proveedor || '—',
                    metodo: row.metodos_pago_v2?.nombre || '—',
                    montoUsd: Number(row.monto_equivalente_usd || 0),
                    montoBs: Number(row.monto_equivalente_bs || 0),
                    estado: row.estado,
                  })),
                ]
                  .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
                  .map((row) => (
                    <tr key={row.id} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white/75">{shortDate(row.fecha)}</td>
                      <td className="px-4 py-3 font-medium text-white">{row.tipo}</td>
                      <td className="px-4 py-3 text-white/75">{row.concepto}</td>
                      <td className="px-4 py-3 text-white/75">{row.categoria}</td>
                      <td className="px-4 py-3 text-white/75">{row.tercero}</td>
                      <td className="px-4 py-3 text-white/75">{row.metodo}</td>
                      <td className="px-4 py-3 text-white/75">{money(row.montoUsd, 'USD')}</td>
                      <td className="px-4 py-3 text-white/75">{money(row.montoBs, 'VES')}</td>
                      <td className="px-4 py-3 text-white/75">{row.estado}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  )
}
