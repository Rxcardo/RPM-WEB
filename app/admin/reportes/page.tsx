'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
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

// ─── Types ───────────────────────────────────────────────────────────────────

type ClienteRow = {
  id: string; nombre: string; telefono: string | null; email: string | null
  fecha_nacimiento: string | null; genero: string | null; direccion: string | null
  cedula: string | null; estado: string; created_at: string; terapeuta_id: string | null
  empleados: { nombre: string } | null
}
type PlanRow = {
  id: string; fecha_inicio: string | null; fecha_fin: string | null
  sesiones_totales: number; sesiones_usadas: number; estado: string; created_at: string
  clientes: { nombre: string } | null; planes: { nombre: string; precio: number } | null
  precio_final_usd: number | null; monto_final_bs: number | null; moneda_venta: string | null
}
type CitaRow = {
  id: string; fecha: string; hora_inicio: string; hora_fin: string; estado: string
  clientes: { nombre: string } | null; empleados: { nombre: string } | null
  servicios: { nombre: string; precio?: number } | null; recursos: { nombre: string } | null
}
type IngresoRow = {
  id: string; fecha: string; concepto: string; categoria: string; monto: number
  estado: string; tipo_origen: string; created_at: string; moneda_pago: string | null
  monto_equivalente_usd: number | null; monto_equivalente_bs: number | null
  referencia?: string | null; clientes: { nombre: string } | null
  metodos_pago_v2: { nombre: string; moneda?: string | null } | null
}
type EgresoRow = {
  id: string; fecha: string; concepto: string; categoria: string; proveedor: string | null
  monto: number; estado: string; created_at: string; moneda: string | null
  monto_equivalente_usd: number | null; monto_equivalente_bs: number | null
  referencia?: string | null; metodos_pago_v2: { nombre: string; moneda?: string | null } | null
  empleados?: { nombre: string } | null
}
type CobranzaRow = {
  id: string; cliente_nombre: string; concepto: string; tipo_origen: string
  monto_total_usd: number; monto_pagado_usd: number; saldo_usd: number
  fecha_venta: string; fecha_vencimiento: string | null; estado: string; created_at: string
  clientes?: { nombre: string } | null
}
type InventarioRow = {
  id: string; inventario_id: string; tipo: string; cantidad: number
  cantidad_anterior: number | null; cantidad_nueva: number | null; concepto: string
  precio_unitario_usd: number | null; monto_total_usd: number | null; created_at: string
  inventario?: { nombre: string } | null
}
type NominaRow = {
  id: string; empleado_id: string; fecha: string; tipo: string; moneda_pago: string
  monto_pago: number; tasa_bcv: number | null; monto_equivalente_usd: number | null
  monto_equivalente_bs: number | null; notas: string | null; created_at: string
  referencia: string | null; empleados?: { nombre: string } | null
  metodos_pago_v2?: { nombre: string } | null
}
type TipoReporte = 'clientes'|'planes'|'citas'|'ingresos'|'egresos'|'financiero'|'cobranzas'|'inventario'|'nomina'|'liquidacion'
type PeriodoRapido = 'hoy'|'7d'|'30d'|'este_mes'|'este_ano'|'personalizado'
type TurnoReporte = 'todo'|'manana'|'tarde'|'personalizado'
type DocumentoGeneradoItem = { id: string; tipo: 'constancia'|'informe_sesiones'|'presupuesto'; paciente: string; fecha: string; detalle: string }
type DocumentoClienteOption = { id: string; nombre: string; cedula?: string|null; telefono?: string|null; direccion?: string|null; fechaNacimiento?: string|null; terapeuta?: string|null }
type LineaPresupuestoPDF = { cantidad: number; tipoSesion: string; precio: number }
type PresupuestoPDFData = { numero: number; fecha: string; atencion: string; direccion: string; rif: string; telefono: string; lineas: LineaPresupuestoPDF[]; observaciones?: string; realizadoPor?: string }

const TIPOS = [
  { value: 'clientes', label: 'Clientes', icon: '👤' },
  { value: 'planes', label: 'Planes', icon: '📋' },
  { value: 'citas', label: 'Citas', icon: '📅' },
  { value: 'ingresos', label: 'Ingresos', icon: '💵' },
  { value: 'egresos', label: 'Egresos', icon: '💸' },
  { value: 'financiero', label: 'Financiero', icon: '📊' },
  { value: 'cobranzas', label: 'Cobranzas', icon: '🧾' },
  { value: 'inventario', label: 'Inventario', icon: '📦' },
  { value: 'nomina', label: 'Nómina', icon: '👥' },
  { value: 'liquidacion', label: 'Liquidación', icon: '🧾' },
] as const

const PIE_COLORS = ['#38bdf8','#34d399','#f59e0b','#f87171','#a78bfa','#94a3b8']
const tooltipStyle = { background:'#070a14', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, color:'#fff', fontSize:11 }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function firstOrNull<T>(value: T | T[] | null | undefined): T | null { if (Array.isArray(value)) return value[0] ?? null; return value ?? null }
function money(value: number, currency: 'USD'|'VES' = 'USD') { if (currency === 'VES') return new Intl.NumberFormat('es-VE',{style:'currency',currency:'VES',maximumFractionDigits:2}).format(Number(value||0)); return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(value||0)) }
function todayISO() { return new Date().toISOString().slice(0,10) }
function firstDayOfMonthISO() { const n=new Date(); return new Date(n.getFullYear(),n.getMonth(),1).toISOString().slice(0,10) }
function firstDayOfYearISO() { const n=new Date(); return new Date(n.getFullYear(),0,1).toISOString().slice(0,10) }
function daysAgoISO(days: number) { const d=new Date(); d.setDate(d.getDate()-days); return d.toISOString().slice(0,10) }
function shortDate(value: string) { try { return new Date(`${value.slice(0,10)}T12:00:00`).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'}) } catch { return value } }
function formatDateTime(value: string) { try { return new Date(value).toLocaleString('es-ES',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) } catch { return value } }
function titleCase(value: string) { return value.toLowerCase().replace(/(^|\s)\S/g,(l)=>l.toUpperCase()) }
function formatDateLong(value: string) { try { return new Date(`${value}T12:00:00`).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) } catch { return value } }
function getWeekLabel(dateString: string) { const date=new Date(dateString); const firstDay=new Date(date.getFullYear(),0,1); const pastDays=Math.floor((date.getTime()-firstDay.getTime())/86400000); const week=Math.ceil((pastDays+firstDay.getDay()+1)/7); return `${date.getFullYear()}-S${String(week).padStart(2,'0')}` }
function getMonthLabel(dateString: string) { const d=new Date(dateString); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
function getYearLabel(dateString: string) { return String(new Date(dateString).getFullYear()) }
function normalizeCell(value: unknown) { if (value===null||value===undefined) return ''; if (typeof value==='number') return value; return String(value) }
function sanitizeFilePart(value: string) { return String(value||'').trim().replace(/[\\/:*?"<>|]+/g,'').replace(/\s+/g,'_').slice(0,80) }
function calcularEdadDesdeFecha(fechaNacimiento?: string|null) { if (!fechaNacimiento) return ''; const birth=new Date(`${fechaNacimiento}T12:00:00`); if (Number.isNaN(birth.getTime())) return ''; const today=new Date(); let edad=today.getFullYear()-birth.getFullYear(); const monthDiff=today.getMonth()-birth.getMonth(); if (monthDiff<0||(monthDiff===0&&today.getDate()<birth.getDate())) edad-=1; return edad>0?String(edad):'' }
function formatBudgetDate(value: string) { try { return new Date(`${value}T12:00:00`).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'2-digit'}) } catch { return value } }
function timeToMinutes(value: string) { const [h,m]=String(value||'00:00').slice(0,5).split(':').map(Number); return (h||0)*60+(m||0) }
function inTimeRange(time: string, from: string, to: string) { if (!from||!to) return true; const t=timeToMinutes(time||'00:00'); return t>=timeToMinutes(from)&&t<=timeToMinutes(to) }
function createdAtInTurno(created_at: string|undefined, horaInicio: string, horaFin: string): boolean { if (horaInicio==='00:00'&&horaFin==='23:59') return true; if (!created_at) return true; const d=new Date(created_at); const veHoras=d.getUTCHours()-4; const horasVE=((veHoras%24)+24)%24; const minutosVE=d.getUTCMinutes(); const totalMinutos=horasVE*60+minutosVE; return totalMinutos>=timeToMinutes(horaInicio)&&totalMinutos<=timeToMinutes(horaFin) }
function getPeriodoTexto(fechaInicio: string, fechaFin: string, horaInicio: string, horaFin: string) { return `${shortDate(fechaInicio)} → ${shortDate(fechaFin)} · ${horaInicio} a ${horaFin}` }

function normalizeClienteRow(row: any): ClienteRow { const empleado=firstOrNull(row?.empleados); return {id:String(row?.id??''),nombre:String(row?.nombre??''),telefono:row?.telefono??null,email:row?.email??null,fecha_nacimiento:row?.fecha_nacimiento??null,genero:row?.genero??null,direccion:row?.direccion??null,cedula:row?.cedula??null,estado:String(row?.estado??''),created_at:String(row?.created_at??''),terapeuta_id:row?.terapeuta_id??null,empleados:empleado?{nombre:String(empleado?.nombre??'')}:null} }
function normalizePlanRow(row: any): PlanRow { const cliente=firstOrNull(row?.clientes); const plan=firstOrNull(row?.planes); return {id:String(row?.id??''),fecha_inicio:row?.fecha_inicio??null,fecha_fin:row?.fecha_fin??null,sesiones_totales:Number(row?.sesiones_totales||0),sesiones_usadas:Number(row?.sesiones_usadas||0),estado:String(row?.estado??''),created_at:String(row?.created_at??''),clientes:cliente?{nombre:String(cliente?.nombre??'')}:null,planes:plan?{nombre:String(plan?.nombre??''),precio:Number(plan?.precio||0)}:null,precio_final_usd:row?.precio_final_usd!=null?Number(row.precio_final_usd):null,monto_final_bs:row?.monto_final_bs!=null?Number(row.monto_final_bs):null,moneda_venta:row?.moneda_venta??null} }
function normalizeCitaRow(row: any): CitaRow { const cliente=firstOrNull(row?.clientes); const empleado=firstOrNull(row?.empleados); const servicio=firstOrNull(row?.servicios); const recurso=firstOrNull(row?.recursos); return {id:String(row?.id??''),fecha:String(row?.fecha??''),hora_inicio:String(row?.hora_inicio??''),hora_fin:String(row?.hora_fin??''),estado:String(row?.estado??''),clientes:cliente?{nombre:String(cliente?.nombre??'')}:null,empleados:empleado?{nombre:String(empleado?.nombre??'')}:null,servicios:servicio?{nombre:String(servicio?.nombre??''),precio:servicio?.precio!=null?Number(servicio.precio):undefined}:null,recursos:recurso?{nombre:String(recurso?.nombre??'')}:null} }
function normalizeIngresoRow(row: any): IngresoRow { const cliente=firstOrNull(row?.clientes); const metodo=firstOrNull(row?.metodos_pago_v2); return {id:String(row?.id??''),fecha:String(row?.fecha??''),concepto:String(row?.concepto??''),categoria:String(row?.categoria??''),monto:Number(row?.monto||0),estado:String(row?.estado??''),tipo_origen:String(row?.tipo_origen??''),created_at:String(row?.created_at??''),moneda_pago:row?.moneda_pago??null,monto_equivalente_usd:row?.monto_equivalente_usd!=null?Number(row.monto_equivalente_usd):null,monto_equivalente_bs:row?.monto_equivalente_bs!=null?Number(row.monto_equivalente_bs):null,referencia:row?.referencia??null,clientes:cliente?{nombre:String(cliente?.nombre??'')}:null,metodos_pago_v2:metodo?{nombre:String(metodo?.nombre??''),moneda:metodo?.moneda??null}:null} }
function normalizeEgresoRow(row: any): EgresoRow { const empleado=firstOrNull(row?.empleados); const metodo=firstOrNull(row?.metodos_pago_v2); return {id:String(row?.id??''),fecha:String(row?.fecha??''),concepto:String(row?.concepto??''),categoria:String(row?.categoria??''),proveedor:row?.proveedor??null,monto:Number(row?.monto||0),estado:String(row?.estado??''),created_at:String(row?.created_at??''),moneda:row?.moneda??null,monto_equivalente_usd:row?.monto_equivalente_usd!=null?Number(row.monto_equivalente_usd):null,monto_equivalente_bs:row?.monto_equivalente_bs!=null?Number(row.monto_equivalente_bs):null,referencia:row?.referencia??null,metodos_pago_v2:metodo?{nombre:String(metodo?.nombre??''),moneda:metodo?.moneda??null}:null,empleados:empleado?{nombre:String(empleado?.nombre??'')}:null} }
function normalizeCobranzaRow(row: any): CobranzaRow { const cliente=firstOrNull(row?.clientes); return {id:String(row?.id??''),cliente_nombre:String(row?.cliente_nombre??''),concepto:String(row?.concepto??''),tipo_origen:String(row?.tipo_origen??''),monto_total_usd:Number(row?.monto_total_usd||0),monto_pagado_usd:Number(row?.monto_pagado_usd||0),saldo_usd:Number(row?.saldo_usd||0),fecha_venta:String(row?.fecha_venta??''),fecha_vencimiento:row?.fecha_vencimiento??null,estado:String(row?.estado??''),created_at:String(row?.created_at??''),clientes:cliente?{nombre:String(cliente?.nombre??'')}:null} }
function normalizeInventarioRow(row: any): InventarioRow { const inventario=firstOrNull(row?.inventario); return {id:String(row?.id??''),inventario_id:String(row?.inventario_id??''),tipo:String(row?.tipo??''),cantidad:Number(row?.cantidad||0),cantidad_anterior:row?.cantidad_anterior!=null?Number(row.cantidad_anterior):null,cantidad_nueva:row?.cantidad_nueva!=null?Number(row.cantidad_nueva):null,concepto:String(row?.concepto??''),precio_unitario_usd:row?.precio_unitario_usd!=null?Number(row.precio_unitario_usd):null,monto_total_usd:row?.monto_total_usd!=null?Number(row.monto_total_usd):null,created_at:String(row?.created_at??''),inventario:inventario?{nombre:String(inventario?.nombre??'')}:null} }
function normalizeNominaRow(row: any): NominaRow { const empleado=firstOrNull(row?.empleados); const metodo=firstOrNull(row?.metodos_pago_v2); return {id:String(row?.id??''),empleado_id:String(row?.empleado_id??''),fecha:String(row?.fecha??''),tipo:String(row?.tipo??''),moneda_pago:String(row?.moneda_pago??''),monto_pago:Number(row?.monto_pago||0),tasa_bcv:row?.tasa_bcv!=null?Number(row.tasa_bcv):null,monto_equivalente_usd:row?.monto_equivalente_usd!=null?Number(row.monto_equivalente_usd):null,monto_equivalente_bs:row?.monto_equivalente_bs!=null?Number(row.monto_equivalente_bs):null,notas:row?.notas??null,created_at:String(row?.created_at??''),referencia:row?.referencia??null,empleados:empleado?{nombre:String(empleado?.nombre??'')}:null,metodos_pago_v2:metodo?{nombre:String(metodo?.nombre??'')}:null} }

function normalizeTxt(value: string | null | undefined) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function isLiquidacionPagoEmpleado(row: Pick<NominaRow, 'tipo' | 'notas'>) {
  const raw = normalizeTxt(`${row.tipo || ''} ${row.notas || ''}`)
  return raw.includes('liquidacion') || raw.includes('comision') || raw.includes('commission')
}

function isLiquidacionEgreso(row: Pick<EgresoRow, 'categoria' | 'concepto'>) {
  const raw = normalizeTxt(`${row.categoria || ''} ${row.concepto || ''}`)
  return raw.includes('liquidacion') || raw.includes('comision')
}

function categoriaEgresoLabel(row: Pick<EgresoRow, 'categoria' | 'concepto'>) {
  if (isLiquidacionEgreso(row)) return 'Liquidación'
  const cat = normalizeTxt(row.categoria)
  if (cat === 'nomina') return 'Nómina'
  if (!cat) return 'Gastos'
  return titleCase(String(row.categoria || 'Gastos').replace(/_/g, ' '))
}

function tipoNominaLabel(row: Pick<NominaRow, 'tipo' | 'notas'>) {
  return isLiquidacionPagoEmpleado(row) ? 'Liquidación' : titleCase(String(row.tipo || 'Nómina').replace(/_/g, ' '))
}

// ─── PDF/Excel helpers (sin cambios) ─────────────────────────────────────────

async function fetchImageAsBase64(src: string) { const res=await fetch(src); const blob=await res.blob(); return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onloadend=()=>resolve(String(reader.result||''));reader.onerror=reject;reader.readAsDataURL(blob)}) }
async function addPdfDocumentWatermark(doc: jsPDF,logoSrc: string,options?:{x?:number;y?:number;w?:number;h?:number;opacity?:number}) { try{const base64=await fetchImageAsBase64(logoSrc);const x=options?.x??46;const y=options?.y??70;const w=options?.w??118;const h=options?.h??118;const opacity=options?.opacity??0.05;doc.setGState?.(new (doc as any).GState({opacity}));doc.addImage(base64,'PNG',x,y,w,h);doc.setGState?.(new (doc as any).GState({opacity:1}))}catch{} }
async function addStrongCenteredWatermark(doc: jsPDF,logoSrc: string) { await addPdfDocumentWatermark(doc,logoSrc,{x:30,y:55,w:150,h:150,opacity:0.06});await addPdfDocumentWatermark(doc,logoSrc,{x:42,y:68,w:126,h:126,opacity:0.035}) }
async function applyCorporateBackground(doc: jsPDF,logoSrc: string) { const totalPages=(doc as any).internal.getNumberOfPages?.()||1;for(let i=1;i<=totalPages;i++){doc.setPage(i);await addStrongCenteredWatermark(doc,logoSrc)} }
async function drawCorporateHeader(args:{doc:jsPDF;logoSrc:string;title:string;subtitle?:string;dateText?:string;generatedBy?:string}) { const{doc,logoSrc,title,subtitle,dateText,generatedBy}=args;try{const base64=await fetchImageAsBase64(logoSrc);doc.addImage(base64,'PNG',15,10,28,28)}catch{};doc.setFont('helvetica','bold');doc.setFontSize(12);doc.setTextColor(20);doc.text('Prehab Carabobo C.A.',15,42);doc.setFontSize(10);doc.text('J-504483931',15,49);doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(title.toUpperCase(),105,18,{align:'center'});if(subtitle){doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(75);doc.text(doc.splitTextToSize(subtitle,95),105,25,{align:'center'})};if(dateText){doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(40);doc.text(dateText,188,24,{align:'right'})};if(generatedBy){doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(70);doc.text(`Generado por: ${generatedBy}`,188,31,{align:'right'})};doc.setDrawColor(120);doc.setLineWidth(0.35);doc.line(15,54,195,54) }
function drawCorporateFooter(doc: jsPDF) { const pageWidth=doc.internal.pageSize.getWidth();const pageHeight=doc.internal.pageSize.getHeight();const footerTop=pageHeight-34;doc.setFillColor(112,112,112);doc.rect(0,footerTop,pageWidth,34,'F');doc.setTextColor(255);doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.text('Información de contacto',20,footerTop+9);doc.setFont('helvetica','normal');doc.setFontSize(8);doc.text('Complejo Bicentenario, Naguanagua',20,footerTop+18);doc.text('Redes sociales: @RPM.VZLA',80,footerTop+18);doc.text('Teléfono: 0412-2405745',145,footerTop+18) }
async function finalizeCorporatePdf(doc: jsPDF,logoSrc: string) { const totalPages=(doc as any).internal.getNumberOfPages?.()||1;await applyCorporateBackground(doc,logoSrc);for(let i=1;i<=totalPages;i++){doc.setPage(i);drawCorporateFooter(doc);doc.setTextColor(255);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text(`Página ${i} de ${totalPages}`,188,doc.internal.pageSize.getHeight()-6,{align:'right'})} }

async function exportCierrePDF(args:{ingresos:IngresoRow[];egresos:EgresoRow[];fechaInicio:string;fechaFin:string;horaInicio:string;horaFin:string;monedaVista:'USD'|'BS';generadoPor?:string;logoSrc?:string}) {
  const{ingresos,egresos,fechaInicio,fechaFin,horaInicio,horaFin,generadoPor,logoSrc='/logo-imprimir.png'}=args
  const ingresosValidos=ingresos.filter((x)=>x.estado==='pagado')
  const egresosValidos=egresos.filter((x)=>x.estado==='pagado'||x.estado==='liquidado')
  if(!ingresosValidos.length&&!egresosValidos.length){alert('No hay movimientos pagados/liquidados para generar el cierre.');return}
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const marginX=15;let cursorY=62
  await drawCorporateHeader({doc,logoSrc,title:'Cierre de caja',subtitle:getPeriodoTexto(fechaInicio,fechaFin,horaInicio,horaFin),dateText:`Fecha: ${shortDate(todayISO())}`,generatedBy:generadoPor})
  const totalIngUsd=ingresosValidos.reduce((a,r)=>a+Number(r.monto_equivalente_usd||0),0)
  const totalIngBs=ingresosValidos.reduce((a,r)=>a+Number(r.monto_equivalente_bs||0),0)
  const totalEgrUsd=egresosValidos.reduce((a,r)=>a+Number(r.monto_equivalente_usd||0),0)
  const totalEgrBs=egresosValidos.reduce((a,r)=>a+Number(r.monto_equivalente_bs||0),0)
  const fmtUsd=(n:number)=>`$ ${n.toFixed(2)}`;const fmtBs=(n:number)=>`Bs. ${n.toFixed(2)}`
  const normalizeCurrency=(value?:string|null)=>{const raw=String(value||'').trim().toUpperCase();if(['BS','VES','BOLIVARES','BOLÍVARES','BOLIVAR','BOLÍVAR'].includes(raw))return'BS';if(['USD','$','DOLAR','DÓLAR','DOLARES','DÓLARES'].includes(raw))return'USD';return raw||'SIN MONEDA'}
  const formatOriginalMoney=(amount:number,currency:string)=>{const cur=normalizeCurrency(currency);if(cur==='BS')return fmtBs(amount);if(cur==='USD')return fmtUsd(amount);return`${amount.toFixed(2)} ${cur}`}
  const totalByCurrency=<T extends{monto:number}>(rows:T[],getCurrency:(row:T)=>string|null|undefined)=>{const map=new Map<string,number>();for(const row of rows){const currency=normalizeCurrency(getCurrency(row));map.set(currency,(map.get(currency)||0)+Number(row.monto||0))}return Array.from(map.entries()).map(([moneda,total])=>({moneda,total})).sort((a,b)=>a.moneda.localeCompare(b.moneda))}
  const totalByMethod=<T extends{monto:number;metodos_pago_v2?:{nombre:string;moneda?:string|null}|null}>(rows:T[],getCurrency:(row:T)=>string|null|undefined)=>{const map=new Map<string,{metodo:string;moneda:string;total:number}>();for(const row of rows){const metodo=row.metodos_pago_v2?.nombre||'Sin método';const moneda=normalizeCurrency(getCurrency(row)||row.metodos_pago_v2?.moneda);const key=`${metodo}__${moneda}`;const prev=map.get(key)||{metodo,moneda,total:0};prev.total+=Number(row.monto||0);map.set(key,prev)}return Array.from(map.values()).sort((a,b)=>`${a.metodo} ${a.moneda}`.localeCompare(`${b.metodo} ${b.moneda}`))}
  const ingresosPorMoneda=totalByCurrency(ingresosValidos,(row)=>row.moneda_pago||row.metodos_pago_v2?.moneda)
  const egresosPorMoneda=totalByCurrency(egresosValidos,(row)=>row.moneda||row.metodos_pago_v2?.moneda)
  const ingresosPorMetodo=totalByMethod(ingresosValidos,(row)=>row.moneda_pago||row.metodos_pago_v2?.moneda)
  const egresosPorMetodo=totalByMethod(egresosValidos,(row)=>row.moneda||row.metodos_pago_v2?.moneda)
  doc.setFillColor(246,246,246);doc.roundedRect(marginX,cursorY,180,24,2,2,'F');doc.setDrawColor(205);doc.roundedRect(marginX,cursorY,180,24,2,2,'S')
  doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(60);doc.text('INGRESOS CONVERTIDOS',35,cursorY+7,{align:'center'});doc.text('EGRESOS CONVERTIDOS',90,cursorY+7,{align:'center'});doc.text('BALANCE CONVERTIDO',145,cursorY+7,{align:'center'})
  doc.setFontSize(10);doc.setTextColor(20);doc.text(fmtUsd(totalIngUsd),35,cursorY+14,{align:'center'});doc.text(fmtUsd(totalEgrUsd),90,cursorY+14,{align:'center'});doc.text(fmtUsd(totalIngUsd-totalEgrUsd),145,cursorY+14,{align:'center'})
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(95);doc.text(fmtBs(totalIngBs),35,cursorY+20,{align:'center'});doc.text(fmtBs(totalEgrBs),90,cursorY+20,{align:'center'});doc.text(fmtBs(totalIngBs-totalEgrBs),145,cursorY+20,{align:'center'})
  cursorY+=32
  doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(25);doc.text('Resumen real por moneda',marginX,cursorY)
  autoTable(doc,{startY:cursorY+4,margin:{left:marginX,right:marginX,bottom:40},head:[['Tipo','Moneda','Total original']],body:[...ingresosPorMoneda.map((r)=>['Ingreso',r.moneda,formatOriginalMoney(r.total,r.moneda)]),...egresosPorMoneda.map((r)=>['Egreso',r.moneda,formatOriginalMoney(r.total,r.moneda)])],theme:'grid',styles:{font:'helvetica',fontSize:8,cellPadding:2.4,lineColor:[210,210,210],lineWidth:0.2},headStyles:{fillColor:[65,65,65],textColor:[255,255,255],fontStyle:'bold'},alternateRowStyles:{fillColor:[248,248,248]},columnStyles:{2:{halign:'right'}}})
  cursorY=((doc as any).lastAutoTable?.finalY||cursorY)+8
  const detalleMetodos=[...ingresosPorMetodo.map((r)=>['Ingreso',r.metodo,r.moneda,formatOriginalMoney(r.total,r.moneda)]),...egresosPorMetodo.map((r)=>['Egreso',r.metodo,r.moneda,formatOriginalMoney(r.total,r.moneda)])]
  if(detalleMetodos.length>0){doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(25);doc.text('Resumen por método de pago',marginX,cursorY);autoTable(doc,{startY:cursorY+4,margin:{left:marginX,right:marginX,bottom:40},head:[['Tipo','Método','Moneda','Total original']],body:detalleMetodos,theme:'grid',styles:{font:'helvetica',fontSize:8,cellPadding:2.4,lineColor:[210,210,210],lineWidth:0.2},headStyles:{fillColor:[65,65,65],textColor:[255,255,255],fontStyle:'bold'},alternateRowStyles:{fillColor:[248,248,248]},columnStyles:{3:{halign:'right'}}});cursorY=((doc as any).lastAutoTable?.finalY||cursorY)+8}
  if(ingresosValidos.length>0){doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(25);doc.text('Detalles del cierre · Ingresos',marginX,cursorY);autoTable(doc,{startY:cursorY+4,margin:{left:marginX,right:marginX,bottom:40},head:[['Fecha','Hora','Concepto','Cliente','Método','USD','Bs']],body:ingresosValidos.map((r)=>[shortDate(r.fecha),r.created_at?new Date(r.created_at).toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}):'—',r.concepto,r.clientes?.nombre||'—',r.metodos_pago_v2?.nombre||'—',fmtUsd(Number(r.monto_equivalente_usd||0)),fmtBs(Number(r.monto_equivalente_bs||0))]),theme:'grid',styles:{font:'helvetica',fontSize:8,cellPadding:2.4,lineColor:[210,210,210],lineWidth:0.2},headStyles:{fillColor:[65,65,65],textColor:[255,255,255],fontStyle:'bold'},alternateRowStyles:{fillColor:[248,248,248]},columnStyles:{5:{halign:'right'},6:{halign:'right'}}});cursorY=((doc as any).lastAutoTable?.finalY||cursorY)+8}
  if(egresosValidos.length>0){if(cursorY>215){doc.addPage();await drawCorporateHeader({doc,logoSrc,title:'Cierre de caja',subtitle:getPeriodoTexto(fechaInicio,fechaFin,horaInicio,horaFin),dateText:`Fecha: ${shortDate(todayISO())}`,generatedBy:generadoPor});cursorY=62};doc.setFont('helvetica','bold');doc.setFontSize(9);doc.setTextColor(25);doc.text('Detalles del cierre · Egresos',marginX,cursorY);autoTable(doc,{startY:cursorY+4,margin:{left:marginX,right:marginX,bottom:40},head:[['Fecha','Hora','Concepto','Categoría','Proveedor/Empleado','USD','Bs']],body:egresosValidos.map((r)=>[shortDate(r.fecha),r.created_at?new Date(r.created_at).toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}):'—',r.concepto,r.categoria,r.empleados?.nombre||r.proveedor||'—',fmtUsd(Number(r.monto_equivalente_usd||0)),fmtBs(Number(r.monto_equivalente_bs||0))]),theme:'grid',styles:{font:'helvetica',fontSize:8,cellPadding:2.4,lineColor:[210,210,210],lineWidth:0.2},headStyles:{fillColor:[65,65,65],textColor:[255,255,255],fontStyle:'bold'},alternateRowStyles:{fillColor:[248,248,248]},columnStyles:{5:{halign:'right'},6:{halign:'right'}}})}
  await finalizeCorporatePdf(doc,logoSrc)
  doc.save(`RPM_Cierre_${sanitizeFilePart(fechaInicio)}_${sanitizeFilePart(fechaFin)}_${sanitizeFilePart(horaInicio)}-${sanitizeFilePart(horaFin)}.pdf`)
}

async function exportPresupuestoPDF(data: PresupuestoPDFData,logoSrc='/logo-imprimir.png') {
  if(!data.atencion||!data.lineas.length){alert('Completa el nombre del cliente y al menos una línea de presupuesto.');return}
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const marginX=15;let cursorY=60;const fmtMoney=(n:number)=>`$ ${n.toFixed(2)}`;const total=data.lineas.reduce((acc,l)=>acc+l.cantidad*l.precio,0)
  await drawCorporateHeader({doc,logoSrc,title:'Presupuesto',subtitle:`Nº de Presupuesto: ${data.numero}`,dateText:`Fecha: ${data.fecha}`,generatedBy:data.realizadoPor})
  doc.setFillColor(248,248,248);doc.roundedRect(marginX,cursorY,180,31,2,2,'F');doc.setDrawColor(205);doc.roundedRect(marginX,cursorY,180,31,2,2,'S')
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(70);doc.text('Atención:',marginX+3,cursorY+7);doc.text('Dirección:',marginX+3,cursorY+14);doc.text('RIF/Cédula:',marginX+3,cursorY+21);doc.text('Teléfono:',120,cursorY+21)
  doc.setFont('helvetica','bold');doc.setTextColor(20);doc.text(String(data.atencion||'').toUpperCase(),marginX+25,cursorY+7);doc.text(String(data.direccion||'—'),marginX+25,cursorY+14);doc.text(String(data.rif||'—'),marginX+25,cursorY+21);doc.text(String(data.telefono||'—'),138,cursorY+21)
  cursorY+=39
  doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('Detalles del presupuesto',105,cursorY,{align:'center'})
  autoTable(doc,{startY:cursorY+4,margin:{left:marginX,right:marginX,bottom:42},head:[['CANT.','TIPO DE SESIÓN','PRECIO','SUBTOTAL']],body:data.lineas.map((l)=>[l.cantidad,l.tipoSesion.toUpperCase(),fmtMoney(l.precio),fmtMoney(l.cantidad*l.precio)]),theme:'grid',styles:{font:'helvetica',fontSize:8.8,cellPadding:2.8,lineColor:[205,205,205],lineWidth:0.2},headStyles:{fillColor:[65,65,65],textColor:[255,255,255],fontStyle:'bold'},alternateRowStyles:{fillColor:[248,248,248]},columnStyles:{0:{halign:'center',cellWidth:22},2:{halign:'right',cellWidth:34},3:{halign:'right',cellWidth:38}},foot:[['','',{content:'TOTAL:',styles:{halign:'right',fontStyle:'bold'}},{content:fmtMoney(total),styles:{halign:'right',fontStyle:'bold'}}]],footStyles:{fillColor:[255,255,255],textColor:[20,20,20]}})
  cursorY=((doc as any).lastAutoTable?.finalY||cursorY)+10
  if(data.observaciones){doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(70);doc.text('Observaciones:',marginX,cursorY);doc.setTextColor(20);const lines=doc.splitTextToSize(data.observaciones,145);doc.text(lines,marginX+26,cursorY);cursorY+=lines.length*5+4}
  const firmaY=Math.max(cursorY+10,212)
  doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(20);doc.text('Realizado por:',105,firmaY,{align:'center'});doc.line(70,firmaY+14,140,firmaY+14)
  if(data.realizadoPor){doc.setFont('helvetica','bold');doc.text(String(data.realizadoPor).toUpperCase(),105,firmaY+19,{align:'center'})}
  await finalizeCorporatePdf(doc,logoSrc)
  doc.save(`RPM_Presupuesto_${sanitizeFilePart(data.atencion)}.pdf`)
}

async function exportInformeSesionesPDF(args:{citas:CitaRow[];paciente:string;cedula:string;terapeuta:string;ciudad:string;generadoPor?:string;logoSrc?:string}) {
  const{citas,paciente,cedula,terapeuta,ciudad,generadoPor,logoSrc='/logo-imprimir.png'}=args
  const sesionesValidas=citas.filter((r)=>(r.estado||'').toLowerCase()!=='cancelada').sort((a,b)=>(a.fecha>b.fecha?1:-1))
  if(!paciente||!sesionesValidas.length){alert('Indica el paciente y asegúrate de tener citas no canceladas en el período.');return}
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});let cursorY=62
  await drawCorporateHeader({doc,logoSrc,title:'Informe de sesiones',subtitle:ciudad||'Valencia',dateText:`Fecha: ${shortDate(todayISO())}`,generatedBy:generadoPor})
  doc.setFont('times','bold');doc.setFontSize(11);doc.setTextColor(20);doc.text(`Paciente: ${paciente}`,25,cursorY);if(cedula)doc.text(`Cédula: ${cedula}`,120,cursorY)
  cursorY+=10;doc.text(`Terapeuta: ${terapeuta||'—'}`,25,cursorY);doc.text(`Total sesiones: ${sesionesValidas.length}`,120,cursorY)
  autoTable(doc,{startY:cursorY+8,margin:{left:15,right:15,bottom:42},head:[['N°','FECHA','HORA','TERAPEUTA','TIPO DE SESIÓN','ESTADO']],body:sesionesValidas.map((r,i)=>[i+1,shortDate(r.fecha),`${r.hora_inicio} - ${r.hora_fin}`,(r.empleados?.nombre||terapeuta||'—').toUpperCase(),(r.servicios?.nombre||'SESIÓN DE FISIOTERAPIA').toUpperCase(),r.estado.toUpperCase()]),theme:'grid',styles:{font:'helvetica',fontSize:8,cellPadding:2.4,lineColor:[205,205,205],lineWidth:0.2},headStyles:{fillColor:[65,65,65],textColor:[255,255,255],fontStyle:'bold'},alternateRowStyles:{fillColor:[248,248,248]},columnStyles:{0:{halign:'center',cellWidth:10},1:{cellWidth:22},5:{halign:'center',cellWidth:24}}})
  await finalizeCorporatePdf(doc,logoSrc)
  doc.save(`RPM_Informe_Sesiones_${sanitizeFilePart(paciente)}.pdf`)
}

async function exportConstanciaPDF(data:{paciente:string;cedula?:string;terapeuta?:string;ciudad?:string;fechaEmision?:string;sesiones:Array<{fecha:string;terapeuta:string;tipoSesion:string}>;generadoPor?:string},logoSrc='/logo-rpm.png') {
  if(!data.paciente||!data.sesiones.length){alert('Debes indicar el paciente y al menos una sesión para emitir la constancia.');return}
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});let cursorY=62
  await drawCorporateHeader({doc,logoSrc,title:'Constancia de asistencia',subtitle:data.ciudad||'Valencia',dateText:`Fecha: ${data.fechaEmision||shortDate(todayISO())}`,generatedBy:data.generadoPor})
  doc.setFont('times','bold');doc.setFontSize(11);doc.text(`Paciente: ${String(data.paciente)}`,25,cursorY);if(data.cedula)doc.text(`Cédula: ${String(data.cedula)}`,120,cursorY)
  cursorY+=12
  const intro=`Por medio de la presente se hace constar que el paciente ${String(data.paciente).toUpperCase()}${data.cedula?`, titular de la cédula de identidad Nº ${String(data.cedula).toUpperCase()}`:''},\nrecibió tratamiento en las fechas que se indican a continuación:`
  const introLines=doc.splitTextToSize(intro,158);doc.text(introLines,25,cursorY)
  autoTable(doc,{startY:cursorY+introLines.length*6+4,margin:{left:15,right:15,bottom:42},head:[['FECHA','TERAPEUTA','TIPO DE SESIÓN']],body:data.sesiones.map((s)=>[titleCase(formatDateLong(s.fecha)),(s.terapeuta||data.terapeuta||'—').toUpperCase(),(s.tipoSesion||'SESIÓN DE FISIOTERAPIA').toUpperCase()]),theme:'grid',styles:{font:'helvetica',fontSize:8.5,lineColor:[210,210,210],lineWidth:0.2,cellPadding:2.2,textColor:[20,20,20]},headStyles:{fillColor:[65,65,65],textColor:[255,255,255],fontStyle:'bold'},alternateRowStyles:{fillColor:[248,248,248]}})
  const finalY=(doc as any).lastAutoTable?.finalY||120
  const primera=data.sesiones[0]?.fecha?shortDate(data.sesiones[0].fecha):'—';const ultima=data.sesiones[data.sesiones.length-1]?.fecha?shortDate(data.sesiones[data.sesiones.length-1].fecha):'—'
  doc.setFont('times','normal');doc.setFontSize(11);const cierre=`Constancia que se emite a petición de la parte interesada, dejando registro de sesiones atendidas desde ${primera} hasta ${ultima}.`;const cierreLines=doc.splitTextToSize(cierre,158);doc.text(cierreLines,25,Math.max(finalY+12,208))
  const firmaY=Math.max(finalY+cierreLines.length*6+24,240);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text('Realizado por:',105,firmaY,{align:'center'});doc.line(70,firmaY+14,140,firmaY+14);doc.setFont('helvetica','bold');doc.text((data.terapeuta||'F/T. JORGE MANTILLA').toUpperCase(),105,firmaY+19,{align:'center'})
  await finalizeCorporatePdf(doc,logoSrc)
  doc.save(`RPM_Constancia_${sanitizeFilePart(String(data.paciente))}.pdf`)
}

async function exportStyledExcel(args:{title:string;subtitle?:string;sheetName?:string;filename:string;rows:Record<string,unknown>[];logoSrc?:string;accentColor?:string}) {
  const{title,subtitle,sheetName='Reporte',filename,rows,logoSrc='/logo-rpm.png',accentColor='111827'}=args
  if(!rows.length){alert('No hay datos para exportar.');return}
  const workbook=new ExcelJS.Workbook();workbook.creator='RPM';workbook.created=new Date()
  const worksheet=workbook.addWorksheet(sheetName,{views:[{state:'frozen',xSplit:0,ySplit:5}]})
  const headers=Object.keys(rows[0]);const totalCols=Math.max(headers.length,1)
  worksheet.mergeCells(1,2,1,Math.min(totalCols,6));worksheet.getCell('B1').value='RPM · PREHAB CARABOBO, C.A.';worksheet.getCell('B1').font={name:'Arial',size:18,bold:true,color:{argb:'111827'}}
  worksheet.mergeCells(2,2,2,Math.min(totalCols,6));worksheet.getCell('B2').value=title;worksheet.getCell('B2').font={name:'Arial',size:13,bold:true,color:{argb:accentColor}}
  worksheet.mergeCells(3,2,3,Math.min(totalCols,8));worksheet.getCell('B3').value=subtitle||`Generado el ${new Date().toLocaleString('es-VE')}`;worksheet.getCell('B3').font={name:'Arial',size:10,color:{argb:'6B7280'}}
  if(logoSrc){try{const base64=await fetchImageAsBase64(logoSrc);const imageId=workbook.addImage({base64,extension:'png'});worksheet.addImage(imageId,{tl:{col:0.15,row:0.1},ext:{width:90,height:90}});worksheet.getRow(1).height=34;worksheet.getRow(2).height=26;worksheet.getRow(3).height=22}catch(e){console.error('Logo Excel:',e)}}
  const headerRowIndex=5;const headerRow=worksheet.getRow(headerRowIndex)
  headers.forEach((header,i)=>{const cell=headerRow.getCell(i+1);cell.value=header;cell.font={name:'Arial',size:10,bold:true,color:{argb:'FFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:accentColor}};cell.alignment={vertical:'middle',horizontal:'center',wrapText:true};cell.border={top:{style:'thin',color:{argb:'D1D5DB'}},left:{style:'thin',color:{argb:'D1D5DB'}},bottom:{style:'thin',color:{argb:'D1D5DB'}},right:{style:'thin',color:{argb:'D1D5DB'}}}})
  headerRow.height=22
  rows.forEach((row,rowIndex)=>{const excelRow=worksheet.getRow(headerRowIndex+1+rowIndex);headers.forEach((header,colIndex)=>{const cell=excelRow.getCell(colIndex+1);cell.value=normalizeCell(row[header]) as string|number;cell.font={name:'Arial',size:10,color:{argb:'111827'}};cell.alignment={vertical:'middle',horizontal:'left',wrapText:true};cell.border={top:{style:'thin',color:{argb:'E5E7EB'}},left:{style:'thin',color:{argb:'E5E7EB'}},bottom:{style:'thin',color:{argb:'E5E7EB'}},right:{style:'thin',color:{argb:'E5E7EB'}}};if(rowIndex%2===0)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'F9FAFB'}}})})
  headers.forEach((header,index)=>{const values=rows.map((r)=>String(r[header]??''));const maxContent=Math.max(header.length,...values.map((v)=>v.length),12);worksheet.getColumn(index+1).width=Math.min(Math.max(maxContent+2,14),32)})
  worksheet.pageSetup={orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,paperSize:9,margins:{left:0.3,right:0.3,top:0.5,bottom:0.5,header:0.2,footer:0.2}}
  worksheet.headerFooter.oddFooter='&LPrehab Carabobo, C.A.&RPágina &P de &N'
  const buffer=await workbook.xlsx.writeBuffer();saveAs(new Blob([buffer]),filename)
}

async function exportReportePDF(args:{title:string;subtitle?:string;rows:Record<string,unknown>[];filename:string;generadoPor?:string;logoSrc?:string}) {
  const{title,subtitle,rows,filename,generadoPor,logoSrc='/logo-imprimir.png'}=args
  if(!rows.length){alert('No hay datos para exportar.');return}
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'})
  const marginX=15;let cursorY=62
  await drawCorporateHeader({doc,logoSrc,title,subtitle:subtitle||`Generado el ${new Date().toLocaleString('es-VE')}`,dateText:`Fecha: ${shortDate(todayISO())}`,generatedBy:generadoPor})
  const headers=Object.keys(rows[0]).filter((h)=>h.toLowerCase()!=='id')
  const body=rows.map((row)=>headers.map((header)=>normalizeCell(row[header])))
  doc.setFillColor(246,246,246);doc.roundedRect(marginX,cursorY,180,16,2,2,'F');doc.setDrawColor(205);doc.roundedRect(marginX,cursorY,180,16,2,2,'S')
  doc.setFont('helvetica','bold');doc.setFontSize(8.5);doc.setTextColor(60);doc.text('REPORTE GENERAL',105,cursorY+6.5,{align:'center'})
  doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(95);doc.text(`Total de registros: ${rows.length}`,105,cursorY+12,{align:'center'})
  cursorY+=24
  autoTable(doc,{startY:cursorY+4,margin:{left:marginX,right:marginX,bottom:40},head:[headers],body,theme:'grid',styles:{font:'helvetica',fontSize:8,cellPadding:2.4,lineColor:[210,210,210],lineWidth:0.2,overflow:'linebreak',textColor:[20,20,20],valign:'middle'},headStyles:{fillColor:[65,65,65],textColor:[255,255,255],fontStyle:'bold'},alternateRowStyles:{fillColor:[248,248,248]},didParseCell:(data)=>{if(data.section==='body'&&typeof data.cell.raw==='number')data.cell.styles.halign='right'}})
  await finalizeCorporatePdf(doc,logoSrc)
  doc.save(filename)
}

// ─── Design System (mismo que FinanzasResumenPage) ────────────────────────────

function Panel({ children, className='' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#080b18] ${className}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-white/30">{children}</p>
}

function GhostBtn({ children, onClick, disabled, className='' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/65 transition hover:bg-white/[0.07] hover:text-white/90 disabled:opacity-40 ${className}`}>
      {children}
    </button>
  )
}

function Divider() { return <div className="h-px w-full bg-white/[0.06]" /> }

function Pill({ children, color='white' }: { children: ReactNode; color?: string }) {
  const map: Record<string,string> = {
    white:'border-white/10 bg-white/[0.06] text-white/60',
    emerald:'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    rose:'border-rose-400/20 bg-rose-400/10 text-rose-300',
    amber:'border-amber-400/20 bg-amber-400/10 text-amber-300',
    violet:'border-violet-400/20 bg-violet-400/10 text-violet-300',
    sky:'border-sky-400/20 bg-sky-400/10 text-sky-300',
    teal:'border-teal-400/20 bg-teal-400/10 text-teal-300',
    indigo:'border-indigo-400/20 bg-indigo-400/10 text-indigo-300',
  }
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[color]??map.white}`}>{children}</span>
}

function MetricTile({ label, value, sub, accent, active, onClick }: { label: string; value: string; sub?: string; accent?: string; active?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex min-h-[100px] flex-col gap-1.5 rounded-2xl border p-4 text-left transition ${active?'border-sky-400/30 bg-sky-400/[0.07] shadow-[0_0_0_1px_rgba(56,189,248,0.08)]':'border-white/[0.06] bg-white/[0.025] hover:border-white/[0.12] hover:bg-white/[0.04]'}`}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-white/35">{label}</p>
      <p className={`text-xl font-bold tabular-nums tracking-tight ${accent??'text-white'}`}>{value}</p>
      {sub && <p className="text-[11px] text-white/40">{sub}</p>}
    </button>
  )
}

function MonedaToggle({ value, onChange }: { value: 'USD'|'BS'; onChange: (v: 'USD'|'BS') => void }) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
      {(['USD','BS'] as const).map((m) => (
        <button key={m} type="button" onClick={() => onChange(m)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${value===m?m==='USD'?'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25':'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/25':'text-white/35 hover:text-white/60'}`}>
          {m==='USD'?'💵':'💰'} {m}
        </button>
      ))}
    </div>
  )
}

const inputCls = 'w-full rounded-xl border border-white/[0.08] bg-[#050714] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/20 focus:bg-white/[0.04]'
const selectCls = 'w-full rounded-xl border border-white/[0.08] bg-[#050714] px-3 py-2.5 text-sm text-white outline-none transition focus:border-white/20'

// ─── DataTable ────────────────────────────────────────────────────────────────

function DataTable({ headers, rows, empty }: { headers: string[]; rows: Array<Array<ReactNode>>; empty: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06]">
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-white/30">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-xs text-white/25">{empty}</td></tr>
            : rows.map((r, i) => (
              <tr key={i} className="border-b border-white/[0.04] transition hover:bg-white/[0.025]">
                {r.map((c, j) => (
                  <td key={j} className={`px-4 py-3 ${j===0?'font-medium text-white':'text-white/65'} text-xs`}>{c}</td>
                ))}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  )
}


type MultiFilterOption = { value: string; label?: string }

function MultiFilterDropdown({
  label,
  values,
  options,
  onChange,
  placeholder = 'Todas',
  emptyLabel = 'Sin opciones',
}: {
  label: string
  values: string[]
  options: MultiFilterOption[]
  onChange: (values: string[]) => void
  placeholder?: string
  emptyLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const selectedSet = useMemo(() => new Set(values), [values])
  const selectedLabels = useMemo(() => {
    const labelMap = new Map(options.map((option) => [option.value, option.label || option.value]))
    return values.map((value) => labelMap.get(value) || value).filter(Boolean)
  }, [options, values])

  function toggleValue(value: string) {
    if (selectedSet.has(value)) onChange(values.filter((item) => item !== value))
    else onChange([...values, value])
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-2.5">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left transition hover:bg-white/[0.03]"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{label}</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {selectedLabels.length === 0 ? (
              <span className="text-xs text-white/35">{placeholder}</span>
            ) : (
              selectedLabels.slice(0, 3).map((item) => (
                <span key={item} className="max-w-[140px] truncate rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                  {item}
                </span>
              ))
            )}
            {selectedLabels.length > 3 && (
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-white/45">
                +{selectedLabels.length - 3}
              </span>
            )}
          </div>
        </div>
        <span className={`shrink-0 text-xs text-white/35 transition ${open ? 'rotate-180' : ''}`}>⌄</span>
      </button>

      {open && (
        <div className="mt-2 rounded-2xl border border-white/[0.07] bg-[#050714] p-2 shadow-[0_14px_40px_rgba(0,0,0,0.35)]">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <span className="text-[10px] text-white/30">{values.length ? `${values.length} seleccionado(s)` : 'Sin filtro activo'}</span>
            {values.length > 0 && (
              <button type="button" onClick={() => onChange([])} className="text-[10px] font-semibold text-amber-300/80 transition hover:text-amber-200">
                Limpiar
              </button>
            )}
          </div>

          <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
            {options.length === 0 ? (
              <p className="px-2 py-3 text-center text-[11px] text-white/25">{emptyLabel}</p>
            ) : (
              options.map((option) => {
                const active = selectedSet.has(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleValue(option.value)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left text-xs transition ${active ? 'bg-sky-400/12 text-sky-200 ring-1 ring-sky-400/20' : 'text-white/55 hover:bg-white/[0.05] hover:text-white/80'}`}
                  >
                    <span className="min-w-0 truncate">{option.label || option.value}</span>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border text-[9px] ${active ? 'border-sky-300/40 bg-sky-300/20 text-sky-100' : 'border-white/10 text-transparent'}`}>
                      ✓
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Presupuesto Drawer ───────────────────────────────────────────────────────

function PresupuestoDrawer({
  open, onClose,
  presupNumero, setPresupNumero,
  presupFecha, setPresupFecha,
  presupAtencion, setPresupAtencion,
  presupDireccion, setPresupDireccion,
  presupRif, setPresupRif,
  presupTelefono, setPresupTelefono,
  presupObservaciones, setPresupObservaciones,
  presupRealizadoPor, setPresupRealizadoPor,
  presupLineas, updateLinea, addLinea, removeLinea,
  documentoClientes, documentoClienteId,
  presupuestoClienteSearch, setPresupuestoClienteSearch,
  handleSelectPresupuestoCliente,
  handlePresupuestoPDF,
}: any) {
  const total = presupLineas.reduce((a: number, l: LineaPresupuestoPDF) => a + l.cantidad * l.precio, 0)
  const clientesFiltrados = useMemo(() => {
    const q = presupuestoClienteSearch.trim().toLowerCase()
    const base = q ? documentoClientes.filter((row: DocumentoClienteOption) =>
      [row.nombre,row.cedula,row.telefono,row.direccion,row.terapeuta].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    ) : documentoClientes
    return base.slice(0, 10)
  }, [documentoClientes, presupuestoClienteSearch])

  return (
    <>
      <div onClick={onClose} className={`fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] transition-all duration-300 ${open?'pointer-events-auto opacity-100':'pointer-events-none opacity-0'}`} />
      <aside className={`fixed bottom-4 right-4 top-4 z-50 flex w-[460px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-3xl border border-white/[0.08] bg-[#080b18]/95 shadow-[0_24px_90px_rgba(0,0,0,0.65)] backdrop-blur-xl transition-all duration-300 ease-out ${open?'translate-x-0 opacity-100':'translate-x-[115%] opacity-0'}`}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-400/[0.04] via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/25 to-transparent" />

        {/* Header */}
        <div className="relative z-10 flex items-start justify-between gap-3 border-b border-white/[0.06] bg-[#080b18]/90 px-5 py-4 backdrop-blur-xl">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-violet-300/80">Documento · Prehab Carabobo</p>
            <h2 className="mt-1 text-lg font-bold text-white">Presupuesto</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-sm text-white/45 transition hover:bg-white/[0.08] hover:text-white">✕</button>
        </div>

        {/* Body */}
        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Buscar cliente */}
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Buscar cliente</p>
            <input value={presupuestoClienteSearch} onChange={(e) => setPresupuestoClienteSearch(e.target.value)} placeholder="Nombre, cédula, teléfono…" className={inputCls} />
            {clientesFiltrados.length > 0 && (
              <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#050714]">
                {clientesFiltrados.map((c: DocumentoClienteOption) => (
                  <button key={c.id} type="button" onClick={() => handleSelectPresupuestoCliente(c.id)}
                    className={`flex w-full items-start justify-between gap-3 border-b border-white/[0.04] px-3 py-2.5 text-left transition last:border-b-0 hover:bg-white/[0.04] ${documentoClienteId===c.id?'bg-white/[0.06]':''}`}>
                    <div>
                      <p className="text-xs font-semibold text-white">{c.nombre}</p>
                      <p className="text-[10px] text-white/35">{[c.cedula,c.telefono].filter(Boolean).join(' · ')||'Sin datos'}</p>
                    </div>
                    <p className="text-[10px] text-white/30">{c.terapeuta||'—'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Divider />

          {/* Datos */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">N°</p>
              <input type="number" value={presupNumero} onChange={(e) => setPresupNumero(Number(e.target.value))} className={inputCls} />
            </label>
            <label className="block">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Fecha</p>
              <input type="date" value={presupFecha} onChange={(e) => setPresupFecha(e.target.value)} className={inputCls} />
            </label>
            <label className="block col-span-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Cliente</p>
              <input value={presupAtencion} onChange={(e) => setPresupAtencion(e.target.value)} className={inputCls} />
            </label>
            <label className="block col-span-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Dirección</p>
              <input value={presupDireccion} onChange={(e) => setPresupDireccion(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">RIF / Cédula</p>
              <input value={presupRif} onChange={(e) => setPresupRif(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Teléfono</p>
              <input value={presupTelefono} onChange={(e) => setPresupTelefono(e.target.value)} className={inputCls} />
            </label>
            <label className="block col-span-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Observaciones</p>
              <input value={presupObservaciones} onChange={(e) => setPresupObservaciones(e.target.value)} className={inputCls} />
            </label>
            <label className="block col-span-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Realizado por</p>
              <input value={presupRealizadoPor} onChange={(e) => setPresupRealizadoPor(e.target.value)} className={inputCls} />
            </label>
          </div>

          <Divider />

          {/* Líneas */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">Líneas del presupuesto</p>
            <div className="space-y-2">
              {presupLineas.map((linea: LineaPresupuestoPDF, i: number) => (
                <div key={i} className="grid grid-cols-[52px_1fr_80px_60px] gap-2 items-center">
                  <input type="number" min={1} value={linea.cantidad} onChange={(e) => updateLinea(i,'cantidad',e.target.value)} className={inputCls} placeholder="Cant." />
                  <input value={linea.tipoSesion} onChange={(e) => updateLinea(i,'tipoSesion',e.target.value)} placeholder="Tipo de sesión" className={inputCls} />
                  <input type="number" min={0} step={0.01} value={linea.precio} onChange={(e) => updateLinea(i,'precio',e.target.value)} placeholder="$" className={inputCls} />
                  <button onClick={() => removeLinea(i)} disabled={presupLineas.length===1} className="rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2.5 text-[11px] text-white/35 transition hover:border-rose-400/20 hover:text-rose-400 disabled:opacity-30">✕</button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <GhostBtn onClick={addLinea}>+ Línea</GhostBtn>
              <p className="text-sm text-white/40">Total: <span className="font-bold text-emerald-300">${total.toFixed(2)}</span></p>
            </div>
          </div>

          <button type="button" onClick={handlePresupuestoPDF}
            className="mt-2 w-full rounded-xl bg-violet-400 py-3 text-sm font-black text-slate-950 transition hover:bg-violet-300">
            Descargar PDF
          </button>
        </div>
      </aside>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tipo, setTipo] = useState<TipoReporte>('financiero')
  const [periodo, setPeriodo] = useState<PeriodoRapido>('este_mes')
  const [fechaInicio, setFechaInicio] = useState(firstDayOfMonthISO())
  const [fechaFin, setFechaFin] = useState(todayISO())
  const [turnoReporte, setTurnoReporte] = useState<TurnoReporte>('todo')
  const [horaInicio, setHoraInicio] = useState('00:00')
  const [horaFin, setHoraFin] = useState('23:59')
  const [generadoPor, setGeneradoPor] = useState('')
  const [search, setSearch] = useState('')
  const [filtroExportMonedas, setFiltroExportMonedas] = useState<string[]>([])
  const [filtroExportMetodos, setFiltroExportMetodos] = useState<string[]>([])
  const [filtroExportCategorias, setFiltroExportCategorias] = useState<string[]>([])
  const [filtroExportEstados, setFiltroExportEstados] = useState<string[]>([])
  const [monedaVista, setMonedaVista] = useState<'USD'|'BS'>('USD')
  const [agrupacion, setAgrupacion] = useState<'dia'|'semana'|'mes'|'anio'>('dia')
  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [planes, setPlanes] = useState<PlanRow[]>([])
  const [citas, setCitas] = useState<CitaRow[]>([])
  const [ingresos, setIngresos] = useState<IngresoRow[]>([])
  const [egresos, setEgresos] = useState<EgresoRow[]>([])
  const [cobranzas, setCobranzas] = useState<CobranzaRow[]>([])
  const [inventario, setInventario] = useState<InventarioRow[]>([])
  const [nomina, setNomina] = useState<NominaRow[]>([])
  const [liquidacion, setLiquidacion] = useState<NominaRow[]>([])
  const [constanciaPaciente, setConstanciaPaciente] = useState('')
  const [constanciaCedula, setConstanciaCedula] = useState('')
  const [constanciaTerapeuta, setConstanciaTerapeuta] = useState('F/T. JORGE MANTILLA')
  const [constanciaCiudad, setConstanciaCiudad] = useState('VALENCIA')
  const [presupNumero, setPresupNumero] = useState(1)
  const [presupFecha, setPresupFecha] = useState(todayISO())
  const [presupAtencion, setPresupAtencion] = useState('')
  const [presupDireccion, setPresupDireccion] = useState('')
  const [presupRif, setPresupRif] = useState('')
  const [presupTelefono, setPresupTelefono] = useState('')
  const [presupObservaciones, setPresupObservaciones] = useState('')
  const [presupRealizadoPor, setPresupRealizadoPor] = useState('')
  const [presupLineas, setPresupLineas] = useState<LineaPresupuestoPDF[]>([{ cantidad: 1, tipoSesion: '', precio: 0 }])
  const [historialDocumentos, setHistorialDocumentos] = useState<DocumentoGeneradoItem[]>([])
  const [documentoClientes, setDocumentoClientes] = useState<DocumentoClienteOption[]>([])
  const [documentoClienteId, setDocumentoClienteId] = useState('')
  const [presupuestoPanelOpen, setPresupuestoPanelOpen] = useState(false)
  const [presupuestoClienteSearch, setPresupuestoClienteSearch] = useState('')
  const [totalGlobal, setTotalGlobal] = useState({ clientes: 0, clientesActivos: 0, planes: 0, planesActivos: 0, citas: 0, inventarioItems: 0 })
  const [filtrosOpen, setFiltrosOpen] = useState(false)

  useEffect(() => { aplicarPeriodo(periodo) }, [])
  useEffect(() => { if (periodo !== 'personalizado') aplicarPeriodo(periodo) }, [periodo])
  useEffect(() => { if(turnoReporte==='todo'){setHoraInicio('00:00');setHoraFin('23:59')} if(turnoReporte==='manana'){setHoraInicio('07:00');setHoraFin('12:59')} if(turnoReporte==='tarde'){setHoraInicio('13:00');setHoraFin('20:00')} }, [turnoReporte])
  useEffect(() => { void loadGeneradoPor(); void loadTotalesGlobales(); void loadDocumentoClientes() }, [])
  useEffect(() => { void loadReporte() }, [tipo, fechaInicio, fechaFin, horaInicio, horaFin])
  useEffect(() => { try{const raw=window.localStorage.getItem('rpm-reportes-historial');if(raw)setHistorialDocumentos(JSON.parse(raw))}catch{} }, [])
  useEffect(() => { try{window.localStorage.setItem('rpm-reportes-historial',JSON.stringify(historialDocumentos.slice(0,20)))}catch{} }, [historialDocumentos])

  async function loadGeneradoPor() { try{const{data:authData}=await supabase.auth.getUser();const user=authData?.user;if(!user)return;const{data}=await supabase.from('empleados').select('nombre').eq('auth_user_id',user.id).maybeSingle();setGeneradoPor(data?.nombre||user.email||'');setPresupRealizadoPor((prev)=>prev||data?.nombre||user.email||'')}catch{setGeneradoPor('')} }

  async function loadDocumentoClientes() {
    try {
      const{data,error}=await supabase.from('clientes').select('id,nombre,cedula,telefono,direccion,fecha_nacimiento,terapeuta_id,empleados:terapeuta_id(nombre)').order('nombre',{ascending:true})
      if(error)throw error
      const mapped=((data||[]) as any[]).map((row)=>{const empleado=firstOrNull(row?.empleados);return{id:String(row?.id??''),nombre:String(row?.nombre??''),cedula:row?.cedula??null,telefono:row?.telefono??null,direccion:row?.direccion??null,fechaNacimiento:row?.fecha_nacimiento??null,terapeuta:empleado?String(empleado?.nombre??''):null} satisfies DocumentoClienteOption})
      setDocumentoClientes(mapped.filter((item)=>item.id&&item.nombre))
    } catch(err){console.error('No se pudieron cargar clientes para documentos:',err);setDocumentoClientes([])}
  }

  function syncDocumentoConCliente(clienteId: string) {
    setDocumentoClienteId(clienteId)
    const cliente=documentoClientes.find((item)=>item.id===clienteId)
    if(!cliente)return
    setConstanciaPaciente(cliente.nombre);setConstanciaCedula(cliente.cedula||'');setPresupAtencion(cliente.nombre);setPresupRif(cliente.cedula||'');setPresupTelefono(cliente.telefono||'');setPresupDireccion(cliente.direccion||'')
    if(cliente.terapeuta){setConstanciaTerapeuta(cliente.terapeuta);setPresupRealizadoPor(cliente.terapeuta)}
  }

  function aplicarPeriodo(p: PeriodoRapido) { const hoy=todayISO();if(p==='hoy'){setFechaInicio(hoy);setFechaFin(hoy);setAgrupacion('dia');return}if(p==='7d'){setFechaInicio(daysAgoISO(6));setFechaFin(hoy);setAgrupacion('dia');return}if(p==='30d'){setFechaInicio(daysAgoISO(29));setFechaFin(hoy);setAgrupacion('semana');return}if(p==='este_mes'){setFechaInicio(firstDayOfMonthISO());setFechaFin(hoy);setAgrupacion('dia');return}if(p==='este_ano'){setFechaInicio(firstDayOfYearISO());setFechaFin(hoy);setAgrupacion('mes')} }

  async function loadTotalesGlobales() {
    try {
      const[{count:totalClientes},{count:clientesActivos},{count:totalPlanes},{count:planesActivos},{count:totalCitas},{count:inventarioItems}]=await Promise.all([supabase.from('clientes').select('*',{count:'exact',head:true}),supabase.from('clientes').select('*',{count:'exact',head:true}).eq('estado','activo'),supabase.from('clientes_planes').select('*',{count:'exact',head:true}),supabase.from('clientes_planes').select('*',{count:'exact',head:true}).eq('estado','activo'),supabase.from('citas').select('*',{count:'exact',head:true}),supabase.from('inventario').select('*',{count:'exact',head:true})])
      setTotalGlobal({clientes:totalClientes||0,clientesActivos:clientesActivos||0,planes:totalPlanes||0,planesActivos:planesActivos||0,citas:totalCitas||0,inventarioItems:inventarioItems||0})
    } catch(err){console.error(err)}
  }

  function limpiarDatos() { setClientes([]);setPlanes([]);setCitas([]);setIngresos([]);setEgresos([]);setCobranzas([]);setInventario([]);setNomina([]);setLiquidacion([]) }

  async function loadReporte() {
    try {
      setLoading(true);setError('');limpiarDatos()
      if(tipo==='clientes'){const{data,error}=await supabase.from('clientes').select('id,nombre,telefono,email,fecha_nacimiento,genero,direccion,cedula,estado,created_at,terapeuta_id,empleados:terapeuta_id(nombre)').order('created_at',{ascending:false});if(error)throw error;setClientes(((data||[]) as any[]).map(normalizeClienteRow))}
      if(tipo==='planes'){const{data,error}=await supabase.from('clientes_planes').select('id,fecha_inicio,fecha_fin,sesiones_totales,sesiones_usadas,estado,created_at,precio_final_usd,monto_final_bs,moneda_venta,clientes:cliente_id(nombre),planes:plan_id(nombre,precio)').order('created_at',{ascending:false});if(error)throw error;setPlanes(((data||[]) as any[]).map(normalizePlanRow))}
      if(tipo==='citas'){let query=supabase.from('citas').select('id,fecha,hora_inicio,hora_fin,estado,clientes:cliente_id(nombre),empleados:terapeuta_id(nombre),servicios:servicio_id(nombre,precio),recursos:recurso_id(nombre)').order('fecha',{ascending:false}).order('hora_inicio',{ascending:false});if(fechaInicio)query=query.gte('fecha',fechaInicio);if(fechaFin)query=query.lte('fecha',fechaFin);const{data,error}=await query;if(error)throw error;setCitas(((data||[]) as any[]).map(normalizeCitaRow).filter((row)=>inTimeRange(row.hora_inicio,horaInicio,horaFin)))}
      if(tipo==='ingresos'||tipo==='financiero'){const{data,error}=await supabase.from('pagos').select('id,fecha,concepto,categoria,monto,estado,tipo_origen,created_at,moneda_pago,monto_equivalente_usd,monto_equivalente_bs,referencia,clientes:cliente_id(nombre),metodos_pago_v2:metodo_pago_v2_id(nombre,moneda)').gte('fecha',fechaInicio).lte('fecha',fechaFin).order('fecha',{ascending:false}).order('created_at',{ascending:false});if(error)throw error;setIngresos(((data||[]) as any[]).map(normalizeIngresoRow).filter((row)=>createdAtInTurno(row.created_at,horaInicio,horaFin)))}
      if(tipo==='egresos'||tipo==='financiero'){const{data,error}=await supabase.from('egresos').select('id,fecha,concepto,categoria,proveedor,monto,estado,created_at,moneda,monto_equivalente_usd,monto_equivalente_bs,referencia,metodos_pago_v2:metodo_pago_v2_id(nombre,moneda),empleados:empleado_id(nombre)').gte('fecha',fechaInicio).lte('fecha',fechaFin).order('fecha',{ascending:false}).order('created_at',{ascending:false});if(error)throw error;setEgresos(((data||[]) as any[]).map(normalizeEgresoRow).filter((row)=>createdAtInTurno(row.created_at,horaInicio,horaFin)))}
      if(tipo==='cobranzas'){const{data,error}=await supabase.from('cuentas_por_cobrar').select('id,cliente_nombre,concepto,tipo_origen,monto_total_usd,monto_pagado_usd,saldo_usd,fecha_venta,fecha_vencimiento,estado,created_at,clientes:cliente_id(nombre)').gte('fecha_venta',fechaInicio).lte('fecha_venta',fechaFin).order('fecha_venta',{ascending:false});if(error)throw error;setCobranzas(((data||[]) as any[]).map(normalizeCobranzaRow))}
      if(tipo==='inventario'){const{data,error}=await supabase.from('movimientos_inventario').select('id,inventario_id,tipo,cantidad,cantidad_anterior,cantidad_nueva,concepto,precio_unitario_usd,monto_total_usd,created_at,inventario:inventario_id(nombre)').order('created_at',{ascending:false});if(error)throw error;setInventario(((data||[]) as any[]).map(normalizeInventarioRow))}
      if(tipo==='nomina'||tipo==='liquidacion'){const{data,error}=await supabase.from('pagos_empleados').select('id,empleado_id,fecha,tipo,moneda_pago,monto_pago,tasa_bcv,monto_equivalente_usd,monto_equivalente_bs,notas,created_at,referencia,empleados:empleado_id(nombre),metodos_pago_v2:metodo_pago_v2_id(nombre)').gte('fecha',fechaInicio).lte('fecha',fechaFin).order('fecha',{ascending:false}).order('created_at',{ascending:false});if(error)throw error;const rows=((data||[]) as any[]).map(normalizeNominaRow).filter((row)=>createdAtInTurno(row.created_at,horaInicio,horaFin));setNomina(rows.filter((row)=>!isLiquidacionPagoEmpleado(row)));setLiquidacion(rows.filter((row)=>isLiquidacionPagoEmpleado(row)))}
    } catch(err:any){console.error(err);setError(err.message||'No se pudo generar el reporte.');limpiarDatos()}
    finally{setLoading(false)}
  }

  const matchSearch=(values: any[])=>{const q=search.trim().toLowerCase();if(!q)return true;return values.filter(Boolean).some((v)=>String(v).toLowerCase().includes(q))}
  const clientesFiltrados=useMemo(()=>clientes.filter((r)=>matchSearch([r.nombre,r.telefono,r.email,r.estado,r.empleados?.nombre])),[clientes,search])
  const planesFiltrados=useMemo(()=>planes.filter((r)=>matchSearch([r.clientes?.nombre,r.planes?.nombre,r.estado,r.moneda_venta])),[planes,search])
  const citasFiltradas=useMemo(()=>citas.filter((r)=>matchSearch([r.clientes?.nombre,r.empleados?.nombre,r.servicios?.nombre,r.recursos?.nombre,r.estado])),[citas,search])
  const ingresosBaseFiltrados=useMemo(()=>ingresos.filter((r)=>matchSearch([r.concepto,r.categoria,r.tipo_origen,r.clientes?.nombre,r.metodos_pago_v2?.nombre,r.estado,r.referencia])),[ingresos,search])
  const egresosBaseFiltrados=useMemo(()=>egresos.filter((r)=>matchSearch([r.concepto,r.categoria,r.proveedor,r.empleados?.nombre,r.metodos_pago_v2?.nombre,r.estado,r.referencia])),[egresos,search])
  const cobranzasFiltradas=useMemo(()=>cobranzas.filter((r)=>matchSearch([r.cliente_nombre,r.clientes?.nombre,r.concepto,r.tipo_origen,r.estado])),[cobranzas,search])
  const inventarioFiltrado=useMemo(()=>inventario.filter((r)=>matchSearch([r.inventario?.nombre,r.tipo,r.concepto])),[inventario,search])
  const nominaBaseFiltrada=useMemo(()=>nomina.filter((r)=>matchSearch([r.empleados?.nombre,r.tipo,r.moneda_pago,r.notas,r.referencia])),[nomina,search])
  const liquidacionBaseFiltrada=useMemo(()=>liquidacion.filter((r)=>matchSearch([r.empleados?.nombre,r.tipo,r.moneda_pago,r.notas,r.referencia])),[liquidacion,search])

  const ingresosFiltrados = useMemo(() => applyExportFilters(
    ingresosBaseFiltrados,
    (r) => r.moneda_pago || r.metodos_pago_v2?.moneda,
    (r) => r.metodos_pago_v2?.nombre,
    (r) => r.categoria,
    (r) => r.estado,
  ), [ingresosBaseFiltrados, filtroExportMonedas, filtroExportMetodos, filtroExportCategorias, filtroExportEstados])

  const egresosFiltrados = useMemo(() => applyExportFilters(
    egresosBaseFiltrados,
    (r) => r.moneda || r.metodos_pago_v2?.moneda,
    (r) => r.metodos_pago_v2?.nombre,
    (r) => categoriaEgresoLabel(r),
    (r) => r.estado,
  ), [egresosBaseFiltrados, filtroExportMonedas, filtroExportMetodos, filtroExportCategorias, filtroExportEstados])

  const nominaFiltrada = useMemo(() => applyExportFilters(
    nominaBaseFiltrada,
    (r) => r.moneda_pago,
    (r) => r.metodos_pago_v2?.nombre,
    (r) => tipoNominaLabel(r),
    () => null,
  ), [nominaBaseFiltrada, filtroExportMonedas, filtroExportMetodos, filtroExportCategorias, filtroExportEstados])

  const liquidacionFiltrada = useMemo(() => applyExportFilters(
    liquidacionBaseFiltrada,
    (r) => r.moneda_pago,
    (r) => r.metodos_pago_v2?.nombre,
    (r) => tipoNominaLabel(r),
    () => null,
  ), [liquidacionBaseFiltrada, filtroExportMonedas, filtroExportMetodos, filtroExportCategorias, filtroExportEstados])

  const resumen=useMemo(()=>{
    const ingresosUsd=ingresosFiltrados.filter((x)=>x.estado==='pagado').reduce((acc,x)=>acc+Number(x.monto_equivalente_usd||0),0)
    const ingresosBs=ingresosFiltrados.filter((x)=>x.estado==='pagado').reduce((acc,x)=>acc+Number(x.monto_equivalente_bs||0),0)
    const egresosBaseUsd=egresosFiltrados.filter((x)=>x.estado==='pagado'||x.estado==='liquidado').reduce((acc,x)=>acc+Number(x.monto_equivalente_usd||0),0)
    const egresosBaseBs=egresosFiltrados.filter((x)=>x.estado==='pagado'||x.estado==='liquidado').reduce((acc,x)=>acc+Number(x.monto_equivalente_bs||0),0)
    const pagosEmpleadoRows = tipo==='nomina' ? nominaFiltrada : tipo==='liquidacion' ? liquidacionFiltrada : []
    const pagosEmpleadoUsd = pagosEmpleadoRows.reduce((acc,x)=>acc+Number(x.monto_equivalente_usd||0),0)
    const pagosEmpleadoBs = pagosEmpleadoRows.reduce((acc,x)=>acc+Number(x.monto_equivalente_bs||0),0)
    const egresosUsd = egresosBaseUsd + pagosEmpleadoUsd
    const egresosBs = egresosBaseBs + pagosEmpleadoBs
    const carteraPendienteUsd=cobranzasFiltradas.reduce((acc,x)=>acc+Number(x.saldo_usd||0),0)
    return{ingresosUsd,ingresosBs,egresosUsd,egresosBs,balanceUsd:ingresosUsd-egresosUsd,balanceBs:ingresosBs-egresosBs,carteraPendienteUsd,totalCitasCompletadas:citasFiltradas.filter((x)=>x.estado==='completada').length,totalCitasCanceladas:citasFiltradas.filter((x)=>x.estado==='cancelada').length}
  },[tipo,citasFiltradas,ingresosFiltrados,egresosFiltrados,cobranzasFiltradas,nominaFiltrada,liquidacionFiltrada])

  const citasEstadoChart=useMemo(()=>{const map=new Map<string,number>();for(const row of citasFiltradas){const key=row.estado||'sin estado';map.set(key,(map.get(key)||0)+1)}return Array.from(map.entries()).map(([name,value])=>({name,value}))},[citasFiltradas])
  const categoriaChart=useMemo(()=>{
    const map=new Map<string,number>()
    const add=(key:string, value:number)=>map.set(key,(map.get(key)||0)+value)
    if(tipo==='ingresos'){
      for(const row of ingresosFiltrados.filter((x)=>x.estado==='pagado')) add(row.categoria||'general', monedaVista==='USD'?Number(row.monto_equivalente_usd||0):Number(row.monto_equivalente_bs||0))
    } else if(tipo==='egresos'){
      for(const row of egresosFiltrados.filter((x)=>x.estado==='pagado'||x.estado==='liquidado')) add(categoriaEgresoLabel(row), monedaVista==='USD'?Number(row.monto_equivalente_usd||0):Number(row.monto_equivalente_bs||0))
    } else if(tipo==='nomina'){
      for(const row of nominaFiltrada) add(row.empleados?.nombre||'Sin empleado', monedaVista==='USD'?Number(row.monto_equivalente_usd||0):Number(row.monto_equivalente_bs||0))
    } else if(tipo==='liquidacion'){
      for(const row of liquidacionFiltrada) add(row.empleados?.nombre||'Sin empleado', monedaVista==='USD'?Number(row.monto_equivalente_usd||0):Number(row.monto_equivalente_bs||0))
    } else {
      for(const row of ingresosFiltrados.filter((x)=>x.estado==='pagado')) add(`Ingreso: ${row.categoria||'general'}`, monedaVista==='USD'?Number(row.monto_equivalente_usd||0):Number(row.monto_equivalente_bs||0))
      for(const row of egresosFiltrados.filter((x)=>x.estado==='pagado'||x.estado==='liquidado')) add(`Egreso: ${categoriaEgresoLabel(row)}`, monedaVista==='USD'?Number(row.monto_equivalente_usd||0):Number(row.monto_equivalente_bs||0))
    }
    return Array.from(map.entries()).map(([name,value])=>({name,value:Math.round(value*100)/100})).sort((a,b)=>b.value-a.value).slice(0,8)
  },[tipo,ingresosFiltrados,egresosFiltrados,nominaFiltrada,liquidacionFiltrada,monedaVista])
  const financieroAgrupadoChart=useMemo(()=>{
    const map=new Map<string,{label:string;ingresosUsd:number;ingresosBs:number;egresosUsd:number;egresosBs:number}>()
    const getKey=(fecha:string)=>{if(agrupacion==='dia')return fecha;if(agrupacion==='semana')return getWeekLabel(fecha);if(agrupacion==='mes')return getMonthLabel(fecha);return getYearLabel(fecha)}
    const ensure=(fecha:string)=>{const key=getKey(fecha);const prev=map.get(key)||{label:key,ingresosUsd:0,ingresosBs:0,egresosUsd:0,egresosBs:0};map.set(key,prev);return prev}
    for(const row of ingresosFiltrados.filter((x)=>x.estado==='pagado')){const prev=ensure(row.fecha);prev.ingresosUsd+=Number(row.monto_equivalente_usd||0);prev.ingresosBs+=Number(row.monto_equivalente_bs||0)}
    for(const row of egresosFiltrados.filter((x)=>x.estado==='pagado'||x.estado==='liquidado')){const prev=ensure(row.fecha);prev.egresosUsd+=Number(row.monto_equivalente_usd||0);prev.egresosBs+=Number(row.monto_equivalente_bs||0)}
    const extraRows = tipo==='nomina' ? nominaFiltrada : tipo==='liquidacion' ? liquidacionFiltrada : []
    for(const row of extraRows){const prev=ensure(row.fecha);prev.egresosUsd+=Number(row.monto_equivalente_usd||0);prev.egresosBs+=Number(row.monto_equivalente_bs||0)}
    return Array.from(map.values()).sort((a,b)=>a.label.localeCompare(b.label)).map((row)=>({...row,ingresos:monedaVista==='USD'?row.ingresosUsd:row.ingresosBs,egresos:monedaVista==='USD'?row.egresosUsd:row.egresosBs}))
  },[tipo,ingresosFiltrados,egresosFiltrados,nominaFiltrada,liquidacionFiltrada,monedaVista,agrupacion])
  const acumuladoChart=useMemo(()=>{let acumulado=0;return financieroAgrupadoChart.map((d)=>{const saldo=d.ingresos-d.egresos;acumulado+=saldo;return{...d,saldo,acumulado:Math.round(acumulado*100)/100}})},[financieroAgrupadoChart])

  function normalizeExportMoneda(value: string | null | undefined) {
    const raw = String(value || '').trim().toUpperCase()
    if (['BS','VES','BOLIVARES','BOLÍVARES','BOLIVAR','BOLÍVAR'].includes(raw)) return 'BS'
    if (['USD','$','DOLAR','DÓLAR','DOLARES','DÓLARES'].includes(raw)) return 'USD'
    return raw
  }

  const exportFilterOptions = useMemo(() => {
    const metodos = new Set<string>()
    const categorias = new Set<string>()
    const estados = new Set<string>()
    const monedas = new Set<string>()

    const addIngreso = (rows: IngresoRow[]) => rows.forEach((r) => {
      if (r.metodos_pago_v2?.nombre) metodos.add(r.metodos_pago_v2.nombre)
      if (r.categoria) categorias.add(r.categoria)
      if (r.estado) estados.add(r.estado)
      const moneda = normalizeExportMoneda(r.moneda_pago || r.metodos_pago_v2?.moneda)
      if (moneda) monedas.add(moneda)
    })

    const addEgreso = (rows: EgresoRow[]) => rows.forEach((r) => {
      if (r.metodos_pago_v2?.nombre) metodos.add(r.metodos_pago_v2.nombre)
      const categoria = categoriaEgresoLabel(r)
      if (categoria) categorias.add(categoria)
      if (r.estado) estados.add(r.estado)
      const moneda = normalizeExportMoneda(r.moneda || r.metodos_pago_v2?.moneda)
      if (moneda) monedas.add(moneda)
    })

    const addNomina = (rows: NominaRow[]) => rows.forEach((r) => {
      if (r.metodos_pago_v2?.nombre) metodos.add(r.metodos_pago_v2.nombre)
      const categoria = tipoNominaLabel(r)
      if (categoria) categorias.add(categoria)
      if (r.moneda_pago) monedas.add(normalizeExportMoneda(r.moneda_pago))
    })

    if (tipo === 'ingresos' || tipo === 'financiero') addIngreso(ingresosBaseFiltrados)
    if (tipo === 'egresos' || tipo === 'financiero') addEgreso(egresosBaseFiltrados)
    if (tipo === 'nomina') addNomina(nominaBaseFiltrada)
    if (tipo === 'liquidacion') addNomina(liquidacionBaseFiltrada)

    return {
      metodos: Array.from(metodos).sort((a,b)=>a.localeCompare(b)),
      categorias: Array.from(categorias).sort((a,b)=>a.localeCompare(b)),
      estados: Array.from(estados).sort((a,b)=>a.localeCompare(b)),
      monedas: Array.from(monedas).sort((a,b)=>a.localeCompare(b)),
    }
  }, [tipo, ingresosBaseFiltrados, egresosBaseFiltrados, nominaBaseFiltrada, liquidacionBaseFiltrada])

  function applyExportFilters<T>(
    rows: T[],
    getMoneda: (r: T) => string | null | undefined,
    getMetodo: (r: T) => string | null | undefined,
    getCategoria: (r: T) => string | null | undefined,
    getEstado: (r: T) => string | null | undefined,
  ): T[] {
    return rows.filter((r) => {
      const moneda = normalizeExportMoneda(getMoneda(r))
      const metodo = getMetodo(r) || ''
      const categoria = getCategoria(r) || ''
      const estado = getEstado(r) || ''
      if (filtroExportMonedas.length > 0 && !filtroExportMonedas.includes(moneda)) return false
      if (filtroExportMetodos.length > 0 && !filtroExportMetodos.includes(metodo)) return false
      if (filtroExportCategorias.length > 0 && !filtroExportCategorias.includes(categoria)) return false
      if (filtroExportEstados.length > 0 && !filtroExportEstados.includes(estado)) return false
      return true
    })
  }

  const ingresosExportFiltrados = ingresosFiltrados
  const egresosExportFiltrados = egresosFiltrados
  const nominaExportFiltrada = nominaFiltrada
  const liquidacionExportFiltrada = liquidacionFiltrada

  const filtrosExportActivos = Boolean(filtroExportMonedas.length || filtroExportMetodos.length || filtroExportCategorias.length || filtroExportEstados.length)
  const exportCountActual = tipo==='ingresos' ? ingresosExportFiltrados.length : tipo==='egresos' ? egresosExportFiltrados.length : tipo==='nomina' ? nominaExportFiltrada.length : tipo==='liquidacion' ? liquidacionExportFiltrada.length : tipo==='financiero' ? ingresosExportFiltrados.length + egresosExportFiltrados.length : null

  function buildExportRows() {
    if(tipo==='clientes')return{title:'Reporte de clientes',filenameBase:'RPM_Clientes',rows:clientesFiltrados.map((row)=>({ID:row.id,Nombre:row.nombre,Cédula:row.cedula||'',Teléfono:row.telefono||'',Email:row.email||'',Dirección:row.direccion||'',Terapeuta:row.empleados?.nombre||'',Estado:row.estado,'Fecha Creación':formatDateTime(row.created_at)}))}
    if(tipo==='planes')return{title:'Reporte de planes',filenameBase:'RPM_Planes',rows:planesFiltrados.map((row)=>{const precioFinal=row.moneda_venta==='USD'?row.precio_final_usd||row.planes?.precio||0:row.monto_final_bs||0;return{ID:row.id,Cliente:row.clientes?.nombre||'',Plan:row.planes?.nombre||'','Precio Final USD':Number(row.precio_final_usd||0),'Precio Final BS':Number(row.monto_final_bs||0),'Moneda Venta':row.moneda_venta||'','Fecha Inicio':row.fecha_inicio||'','Fecha Fin':row.fecha_fin||'','Sesiones Totales':row.sesiones_totales,'Sesiones Usadas':row.sesiones_usadas,'Sesiones Restantes':Number(row.sesiones_totales||0)-Number(row.sesiones_usadas||0),Estado:row.estado}})}
    if(tipo==='citas')return{title:'Reporte de citas',filenameBase:'RPM_Citas',rows:citasFiltradas.map((row)=>({ID:row.id,Fecha:row.fecha,'Hora Inicio':row.hora_inicio,'Hora Fin':row.hora_fin,Cliente:row.clientes?.nombre||'',Terapeuta:row.empleados?.nombre||'',Servicio:row.servicios?.nombre||'',Recurso:row.recursos?.nombre||'',Estado:row.estado}))}
    if(tipo==='ingresos')return{title:'Reporte de ingresos',filenameBase:'RPM_Ingresos',rows:ingresosExportFiltrados.map((row)=>({ID:row.id,Fecha:row.fecha,Hora:row.created_at?new Date(row.created_at).toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}):'',Concepto:row.concepto,Categoría:row.categoria,'Tipo Origen':row.tipo_origen,Cliente:row.clientes?.nombre||'','Método Pago':row.metodos_pago_v2?.nombre||'','Moneda Pago':row.moneda_pago||'',Referencia:row.referencia||'','Monto Original':Number(row.monto||0),'Monto USD':Number(row.monto_equivalente_usd||0),'Monto BS':Number(row.monto_equivalente_bs||0),Estado:row.estado}))}
    if(tipo==='egresos')return{title:'Reporte de egresos',filenameBase:'RPM_Egresos',rows:egresosExportFiltrados.map((row)=>({ID:row.id,Fecha:row.fecha,Hora:row.created_at?new Date(row.created_at).toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}):'',Concepto:row.concepto,Categoría:categoriaEgresoLabel(row),Proveedor:row.proveedor||'',Empleado:row.empleados?.nombre||'','Método Pago':row.metodos_pago_v2?.nombre||'',Moneda:row.moneda||'',Referencia:row.referencia||'','Monto Original':Number(row.monto||0),'Monto USD':Number(row.monto_equivalente_usd||0),'Monto BS':Number(row.monto_equivalente_bs||0),Estado:row.estado}))}
    if(tipo==='cobranzas')return{title:'Reporte de cobranzas',filenameBase:'RPM_Cobranzas',rows:cobranzasFiltradas.map((row)=>({ID:row.id,Cliente:row.clientes?.nombre||row.cliente_nombre||'',Concepto:row.concepto,'Tipo Origen':row.tipo_origen,'Monto Total USD':Number(row.monto_total_usd||0),'Monto Pagado USD':Number(row.monto_pagado_usd||0),'Saldo USD':Number(row.saldo_usd||0),'Fecha Venta':row.fecha_venta,'Fecha Vencimiento':row.fecha_vencimiento||'',Estado:row.estado}))}
    if(tipo==='inventario')return{title:'Reporte de inventario',filenameBase:'RPM_Inventario',rows:inventarioFiltrado.map((row)=>({ID:row.id,Producto:row.inventario?.nombre||'',Tipo:row.tipo,Cantidad:Number(row.cantidad||0),'Cantidad Anterior':Number(row.cantidad_anterior||0),'Cantidad Nueva':Number(row.cantidad_nueva||0),Concepto:row.concepto,'Precio Unitario USD':Number(row.precio_unitario_usd||0),'Monto Total USD':Number(row.monto_total_usd||0),'Fecha Creación':formatDateTime(row.created_at)}))}
    if(tipo==='nomina')return{title:'Reporte de nómina',filenameBase:'RPM_Nomina',rows:nominaExportFiltrada.map((row)=>({ID:row.id,Fecha:row.fecha,Hora:row.created_at?new Date(row.created_at).toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}):'',Empleado:row.empleados?.nombre||'',Tipo:row.tipo,'Moneda Pago':row.moneda_pago,'Monto Pago':Number(row.monto_pago||0),'Monto USD':Number(row.monto_equivalente_usd||0),'Monto BS':Number(row.monto_equivalente_bs||0),'Método Pago':row.metodos_pago_v2?.nombre||'',Referencia:row.referencia||'',Notas:row.notas||''}))}
    if(tipo==='liquidacion')return{title:'Reporte de liquidaciones',filenameBase:'RPM_Liquidaciones',rows:liquidacionExportFiltrada.map((row)=>({ID:row.id,Fecha:row.fecha,Hora:row.created_at?new Date(row.created_at).toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}):'',Empleado:row.empleados?.nombre||'',Tipo:tipoNominaLabel(row),'Moneda Pago':row.moneda_pago,'Monto Pago':Number(row.monto_pago||0),'Monto USD':Number(row.monto_equivalente_usd||0),'Monto BS':Number(row.monto_equivalente_bs||0),'Método Pago':row.metodos_pago_v2?.nombre||'',Referencia:row.referencia||'',Notas:row.notas||''}))}
    return{title:'Reporte financiero',filenameBase:'RPM_Financiero',rows:[...ingresosExportFiltrados.map((row)=>({Fecha:row.fecha,Hora:row.created_at?new Date(row.created_at).toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}):'',Tipo:'Ingreso',Concepto:row.concepto,Categoría:row.categoria,Tercero:row.clientes?.nombre||'','Método Pago':row.metodos_pago_v2?.nombre||'',Referencia:row.referencia||'','Monto USD':Number(row.monto_equivalente_usd||0),'Monto BS':Number(row.monto_equivalente_bs||0),Estado:row.estado})),...egresosExportFiltrados.map((row)=>({Fecha:row.fecha,Hora:row.created_at?new Date(row.created_at).toLocaleTimeString('es-VE',{hour:'2-digit',minute:'2-digit'}):'',Tipo:'Egreso',Concepto:row.concepto,Categoría:categoriaEgresoLabel(row),Tercero:row.empleados?.nombre||row.proveedor||'','Método Pago':row.metodos_pago_v2?.nombre||'',Referencia:row.referencia||'','Monto USD':Number(row.monto_equivalente_usd||0),'Monto BS':Number(row.monto_equivalente_bs||0),Estado:row.estado}))]}
  }

  async function handleExportExcel(){const data=buildExportRows();const stamp=new Date().toISOString().slice(0,19).replace(/:/g,'-');await exportStyledExcel({title:data.title,subtitle:`${getPeriodoTexto(fechaInicio,fechaFin,horaInicio,horaFin)} · Generado por: ${generadoPor||'—'}`,sheetName:data.title,filename:`${data.filenameBase}_${stamp}.xlsx`,rows:data.rows,logoSrc:'/logo-rpm.png',accentColor:'111827'})}
  async function handleExportPDF(){const data=buildExportRows();const stamp=new Date().toISOString().slice(0,19).replace(/:/g,'-');await exportReportePDF({title:data.title,subtitle:getPeriodoTexto(fechaInicio,fechaFin,horaInicio,horaFin),rows:data.rows,filename:`${data.filenameBase}_${stamp}.pdf`,generadoPor,logoSrc:'/logo-imprimir.png'})}
  async function handleCierrePDF(){await exportCierrePDF({ingresos:ingresosExportFiltrados,egresos:egresosExportFiltrados,fechaInicio,fechaFin,horaInicio,horaFin,monedaVista,generadoPor,logoSrc:'/logo-imprimir.png'})}
  async function handlePresupuestoPDF(){await exportPresupuestoPDF({numero:presupNumero,fecha:formatBudgetDate(presupFecha),atencion:presupAtencion,direccion:presupDireccion,rif:presupRif,telefono:presupTelefono,lineas:presupLineas,observaciones:presupObservaciones||undefined,realizadoPor:presupRealizadoPor||generadoPor||undefined});registrarDocumento('presupuesto',presupAtencion||'Sin cliente',`Presupuesto #${presupNumero}`)}
  async function handleInformeSesionesPDF(){await exportInformeSesionesPDF({citas:citasFiltradas,paciente:constanciaPaciente||citasFiltradas[0]?.clientes?.nombre||'',cedula:constanciaCedula,terapeuta:constanciaTerapeuta,ciudad:constanciaCiudad,generadoPor,logoSrc:'/logo-imprimir.png'});registrarDocumento('informe_sesiones',constanciaPaciente||citasFiltradas[0]?.clientes?.nombre||'Sin paciente',`Informe de sesiones · ${citasFiltradas.length} citas`)}
  async function handleConstanciaPDF(){const sesiones=citasFiltradas.filter((row)=>(row.estado||'').toLowerCase()!=='cancelada').map((row)=>({fecha:row.fecha,terapeuta:row.empleados?.nombre||constanciaTerapeuta,tipoSesion:row.servicios?.nombre||'Sesión de fisioterapia'})).sort((a,b)=>(a.fecha>b.fecha?1:-1));await exportConstanciaPDF({paciente:constanciaPaciente||citasFiltradas[0]?.clientes?.nombre||'',cedula:constanciaCedula,terapeuta:constanciaTerapeuta,ciudad:constanciaCiudad,fechaEmision:shortDate(todayISO()),sesiones,generadoPor});registrarDocumento('constancia',constanciaPaciente||citasFiltradas[0]?.clientes?.nombre||'Sin paciente',`Constancia con ${sesiones.length} sesiones`)}
  function updateLinea(index: number,field: keyof LineaPresupuestoPDF,value: string|number){setPresupLineas((prev)=>prev.map((l,i)=>i===index?{...l,[field]:field==='tipoSesion'?value:Number(value)}:l))}
  function addLinea(){setPresupLineas((prev)=>[...prev,{cantidad:1,tipoSesion:'',precio:0}])}
  function removeLinea(index: number){setPresupLineas((prev)=>prev.filter((_,i)=>i!==index))}
  function registrarDocumento(tipoDoc: DocumentoGeneradoItem['tipo'],paciente: string,detalle: string){setHistorialDocumentos((prev)=>[{id:`${tipoDoc}-${Date.now()}`,tipo:tipoDoc,paciente:paciente||'Sin paciente',detalle,fecha:new Date().toISOString()},...prev].slice(0,20))}
  function handleSelectPresupuestoCliente(clienteId: string){syncDocumentoConCliente(clienteId);setPresupuestoClienteSearch('')}

  const tipoActivo = TIPOS.find((t) => t.value === tipo)
  const currency = monedaVista === 'USD' ? 'USD' : 'VES'
  const showFinanciero = tipo === 'ingresos' || tipo === 'egresos' || tipo === 'financiero' || tipo === 'nomina' || tipo === 'liquidacion'

  return (
    <div className="min-h-screen space-y-8 px-4 pb-12 md:px-6">

      {/* ── Header ── */}
      <div className="flex flex-col gap-5 pt-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-widest text-white/30">Administración</p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-3xl">Reportes</h1>
          <p className="mt-1 text-sm text-white/35">{getPeriodoTexto(fechaInicio, fechaFin, horaInicio, horaFin)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showFinanciero && <MonedaToggle value={monedaVista} onChange={setMonedaVista} />}
          <button type="button" onClick={() => router.push('/admin/reportes/analitica')}
            className="rounded-xl border border-indigo-400/20 bg-indigo-400/10 px-4 py-2 text-xs font-semibold text-indigo-300 transition hover:bg-indigo-400/15">
            📊 Analítica
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 px-4 py-3">
          <p className="text-sm text-rose-400">{error}</p>
        </div>
      )}

      {/* ── Selector de tipo (tabs) ── */}
      <div>
        <SectionLabel>Área del reporte</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <button key={t.value} type="button" onClick={() => setTipo(t.value as TipoReporte)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${tipo===t.value?'border-sky-400/30 bg-sky-400/[0.1] text-sky-300':'border-white/[0.06] bg-white/[0.02] text-white/45 hover:border-white/10 hover:text-white/75'}`}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filtros panel ── */}
      <Panel>
        {/* Filtros header: siempre visible */}
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Período rápido */}
            <div className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1">
              {(['hoy','7d','30d','este_mes','este_ano'] as PeriodoRapido[]).map((p) => (
                <button key={p} type="button" onClick={() => { setPeriodo(p); aplicarPeriodo(p) }}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${periodo===p?'bg-white/[0.08] text-white':'text-white/35 hover:text-white/60'}`}>
                  {p==='hoy'?'Hoy':p==='7d'?'7d':p==='30d'?'30d':p==='este_mes'?'Mes':p==='este_ano'?'Año':'Custom'}
                </button>
              ))}
            </div>
            {/* Fechas inline */}
            <div className="flex items-center gap-1.5">
              <input type="date" value={fechaInicio} onChange={(e)=>{setPeriodo('personalizado');setFechaInicio(e.target.value)}}
                className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-white/15" />
              <span className="text-[10px] text-white/25">→</span>
              <input type="date" value={fechaFin} onChange={(e)=>{setPeriodo('personalizado');setFechaFin(e.target.value)}}
                className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[11px] text-white outline-none focus:border-white/15" />
            </div>
            {loading && <span className="animate-pulse text-[11px] text-white/25">Cargando…</span>}
          </div>
          <div className="flex items-center gap-2">
            <GhostBtn onClick={() => loadReporte()} disabled={loading}>🔄 Generar</GhostBtn>
            <GhostBtn onClick={() => setFiltrosOpen((p) => !p)}>{filtrosOpen ? '▲ Ocultar' : '▼ Más filtros'}</GhostBtn>
          </div>
        </div>

        {/* Filtros expandibles */}
        {filtrosOpen && (
          <div className="border-t border-white/[0.06] px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <label className="block">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Turno</p>
                <select value={turnoReporte} onChange={(e)=>setTurnoReporte(e.target.value as TurnoReporte)} className={selectCls}>
                  <option value="todo" className="bg-[#050714]">Todo el día</option>
                  <option value="manana" className="bg-[#050714]">Mañana</option>
                  <option value="tarde" className="bg-[#050714]">Tarde</option>
                  <option value="personalizado" className="bg-[#050714]">Personalizado</option>
                </select>
              </label>
              <label className="block">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Desde hora</p>
                <input type="time" value={horaInicio} onChange={(e)=>{setTurnoReporte('personalizado');setHoraInicio(e.target.value)}} className={inputCls} />
              </label>
              <label className="block">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Hasta hora</p>
                <input type="time" value={horaFin} onChange={(e)=>{setTurnoReporte('personalizado');setHoraFin(e.target.value)}} className={inputCls} />
              </label>
              <label className="block">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Generado por</p>
                <input value={generadoPor} onChange={(e)=>setGeneradoPor(e.target.value)} placeholder="Cristina, José…" className={inputCls} />
              </label>
            </div>

            {/* Agrupación (solo financiero) */}
            {showFinanciero && (
              <div className="mt-3">
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Agrupación</p>
                <div className="flex gap-1.5">
                  {(['dia','semana','mes','anio'] as const).map((a) => (
                    <button key={a} type="button" onClick={() => setAgrupacion(a)}
                      className={`rounded-lg border px-3 py-1.5 text-[11px] font-medium transition ${agrupacion===a?'border-white/15 bg-white/[0.08] text-white':'border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-white/70'}`}>
                      {a==='dia'?'Día':a==='semana'?'Semana':a==='mes'?'Mes':'Año'}
                    </button>
                  ))}
                </div>
              </div>
            )}


            {showFinanciero && (
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Filtros de movimientos / impresión</p>
                  {filtrosExportActivos && (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold text-amber-300">
                        Mostrando {exportCountActual ?? 0} mov.
                      </span>
                      <GhostBtn onClick={() => { setFiltroExportMonedas([]); setFiltroExportMetodos([]); setFiltroExportCategorias([]); setFiltroExportEstados([]) }}>
                        Limpiar
                      </GhostBtn>
                    </div>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MultiFilterDropdown
                    label="Moneda"
                    values={filtroExportMonedas}
                    onChange={setFiltroExportMonedas}
                    options={exportFilterOptions.monedas.map((m) => ({ value: m, label: m }))}
                    placeholder="Todas las monedas"
                  />
                  <MultiFilterDropdown
                    label="Subcartera / método"
                    values={filtroExportMetodos}
                    onChange={setFiltroExportMetodos}
                    options={exportFilterOptions.metodos.map((m) => ({ value: m, label: m }))}
                    placeholder="Todas las subcarteras"
                  />
                  <MultiFilterDropdown
                    label="Categoría"
                    values={filtroExportCategorias}
                    onChange={setFiltroExportCategorias}
                    options={exportFilterOptions.categorias.map((c) => ({ value: c, label: c }))}
                    placeholder="Todas las categorías"
                  />
                  <MultiFilterDropdown
                    label="Estado"
                    values={filtroExportEstados}
                    onChange={setFiltroExportEstados}
                    options={exportFilterOptions.estados.map((estado) => ({ value: estado, label: estado }))}
                    placeholder="Todos los estados"
                  />
                </div>
                <p className="mt-2 text-[10px] text-white/30">
                  Estos filtros actualizan la tabla de movimientos, métricas, gráficos, PDF, Excel y Cierre PDF. Puedes elegir varias opciones por bloque; si dejas un bloque vacío, ese bloque no filtra.
                </p>
              </div>
            )}

            {/* Datos del informe de citas */}
            {tipo === 'citas' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                <label className="block">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Paciente (constancia)</p>
                  <input value={constanciaPaciente} onChange={(e)=>setConstanciaPaciente(e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Cédula</p>
                  <input value={constanciaCedula} onChange={(e)=>setConstanciaCedula(e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Terapeuta</p>
                  <input value={constanciaTerapeuta} onChange={(e)=>setConstanciaTerapeuta(e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">Ciudad</p>
                  <input value={constanciaCiudad} onChange={(e)=>setConstanciaCiudad(e.target.value)} className={inputCls} />
                </label>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* ── Búsqueda + Acciones de exportación ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input type="text" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Buscar en los resultados…"
          className="flex-1 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3.5 py-2.5 text-xs text-white outline-none placeholder:text-white/25 focus:border-white/15" />
        <div className="flex flex-wrap gap-2">
          <GhostBtn onClick={handleExportExcel} disabled={loading}>📗 Excel</GhostBtn>
          <GhostBtn onClick={handleExportPDF} disabled={loading}>📄 PDF</GhostBtn>
          {(tipo==='ingresos'||tipo==='egresos'||tipo==='financiero') && (
            <button type="button" onClick={handleCierrePDF} disabled={loading}
              className="rounded-xl border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-violet-300 transition hover:bg-violet-400/15 disabled:opacity-40">
              🧾 Cierre PDF
            </button>
          )}
          {tipo==='citas' && (
            <>
              <button type="button" onClick={handleConstanciaPDF} disabled={loading||citasFiltradas.length===0}
                className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/15 disabled:opacity-40">
                🧾 Constancia
              </button>
              <button type="button" onClick={handleInformeSesionesPDF} disabled={loading||citasFiltradas.length===0}
                className="rounded-xl border border-teal-400/20 bg-teal-400/10 px-3 py-1.5 text-xs font-semibold text-teal-300 transition hover:bg-teal-400/15 disabled:opacity-40">
                📋 Informe
              </button>
            </>
          )}
          <button type="button" onClick={() => setPresupuestoPanelOpen((p) => !p)}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/60 transition hover:bg-white/[0.06] hover:text-white/80">
            📃 Presupuesto
          </button>
        </div>
      </div>

      {/* ── Métricas ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <MetricTile label="Clientes" value={String(totalGlobal.clientes)} sub={`${totalGlobal.clientesActivos} activos`} accent="text-sky-400" />
        <MetricTile label="Planes" value={String(totalGlobal.planes)} sub={`${totalGlobal.planesActivos} activos`} accent="text-violet-400" />
        <MetricTile label="Citas" value={String(totalGlobal.citas)} sub={`✓${resumen.totalCitasCompletadas} · ✗${resumen.totalCitasCanceladas}`} accent="text-amber-300" />
        <MetricTile
          label={`Ingresos ${monedaVista}`}
          value={money(monedaVista==='USD'?resumen.ingresosUsd:resumen.ingresosBs, currency)}
          accent="text-emerald-400"
        />
        <MetricTile
          label={`Egresos ${monedaVista}`}
          value={money(monedaVista==='USD'?resumen.egresosUsd:resumen.egresosBs, currency)}
          accent="text-rose-400"
        />
        <MetricTile
          label={tipo==='cobranzas'?'Pendiente USD':`Balance ${monedaVista}`}
          value={tipo==='cobranzas'?money(resumen.carteraPendienteUsd,'USD'):money(monedaVista==='USD'?resumen.balanceUsd:resumen.balanceBs,currency)}
          accent={tipo==='cobranzas'?'text-amber-400':(monedaVista==='USD'?resumen.balanceUsd:resumen.balanceBs)>=0?'text-violet-400':'text-rose-400'}
        />
      </div>

      {/* ── Gráficos ── */}
      {(tipo==='citas'||showFinanciero) && (
        <div className="grid gap-4 xl:grid-cols-2">
          {tipo==='citas'&&citasEstadoChart.length>0&&(
            <Panel className="p-4 md:p-5">
              <SectionLabel>Estados de citas</SectionLabel>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={citasEstadoChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                      {citasEstadoChart.map((entry,index)=><Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index%PIE_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle}/>
                    <Legend wrapperStyle={{fontSize:10,color:'rgba(255,255,255,0.35)'}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
          {(tipo==='financiero'||tipo==='ingresos'||tipo==='egresos'||tipo==='nomina'||tipo==='liquidacion')&&financieroAgrupadoChart.length>0&&(
            <Panel className="p-4 md:p-5">
              <SectionLabel>Ingresos vs Egresos ({monedaVista})</SectionLabel>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={financieroAgrupadoChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                    <XAxis dataKey="label" stroke="rgba(255,255,255,0.15)" tick={{fontSize:10}}/>
                    <YAxis stroke="rgba(255,255,255,0.15)" tick={{fontSize:10}}/>
                    <Tooltip formatter={(v)=>money(Number(v),currency)} contentStyle={tooltipStyle}/>
                    <Legend wrapperStyle={{fontSize:10,color:'rgba(255,255,255,0.35)'}}/>
                    <Bar dataKey="ingresos" fill="#10b981" radius={[3,3,0,0]}/>
                    <Bar dataKey="egresos" fill="#f43f5e" radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
          {tipo==='financiero'&&acumuladoChart.length>0&&(
            <Panel className="p-4 md:p-5">
              <SectionLabel>Flujo acumulado ({monedaVista})</SectionLabel>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={acumuladoChart}>
                    <defs><linearGradient id="gradAcum2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a78bfa" stopOpacity={0.2}/><stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                    <XAxis dataKey="label" stroke="rgba(255,255,255,0.15)" tick={{fontSize:10}}/>
                    <YAxis stroke="rgba(255,255,255,0.15)" tick={{fontSize:10}}/>
                    <Tooltip formatter={(v)=>money(Number(v),currency)} contentStyle={tooltipStyle}/>
                    <Area type="monotone" dataKey="acumulado" stroke="#a78bfa" strokeWidth={1.5} fill="url(#gradAcum2)" dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
          {categoriaChart.length>0&&(
            <Panel className="p-4 md:p-5">
              <SectionLabel>Distribución por categoría ({monedaVista})</SectionLabel>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoriaChart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
                    <XAxis type="number" stroke="rgba(255,255,255,0.15)" tick={{fontSize:10}}/>
                    <YAxis type="category" dataKey="name" stroke="rgba(255,255,255,0.15)" width={110} tick={{fontSize:9}}/>
                    <Tooltip formatter={(v)=>money(Number(v),currency)} contentStyle={tooltipStyle}/>
                    <Bar dataKey="value" fill="#60a5fa" radius={[0,3,3,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* ── Tabla de datos ── */}
      <Panel>
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5">
          <div className="flex items-center gap-2">
            <SectionLabel>{tipoActivo?.icon} {tipoActivo?.label}</SectionLabel>
            {loading && <span className="animate-pulse text-[10px] text-white/25">actualizando…</span>}
          </div>
          <span className="text-[11px] text-white/25">
            {tipo==='clientes'?clientesFiltrados.length:tipo==='planes'?planesFiltrados.length:tipo==='citas'?citasFiltradas.length:tipo==='ingresos'?ingresosFiltrados.length:tipo==='egresos'?egresosFiltrados.length:tipo==='cobranzas'?cobranzasFiltradas.length:tipo==='inventario'?inventarioFiltrado.length:tipo==='nomina'?nominaFiltrada.length:tipo==='liquidacion'?liquidacionFiltrada.length:ingresosFiltrados.length+egresosFiltrados.length} reg.
          </span>
        </div>

        {tipo==='clientes'&&<DataTable headers={['Nombre','Cédula','Teléfono','Email','Terapeuta','Estado','Creado']} empty="No hay clientes." rows={clientesFiltrados.map((r)=>[r.nombre,r.cedula||'—',r.telefono||'—',r.email||'—',r.empleados?.nombre||'—',<Pill key={r.id} color={r.estado==='activo'?'emerald':'white'}>{r.estado}</Pill>,r.created_at.slice(0,10)])}/>}
        {tipo==='planes'&&<DataTable headers={['Cliente','Plan','Precio','Moneda','Inicio','Fin','Usadas','Restantes','Estado']} empty="No hay planes." rows={planesFiltrados.map((r)=>{const pf=r.moneda_venta==='USD'?r.precio_final_usd||r.planes?.precio||0:r.monto_final_bs||0;return[r.clientes?.nombre||'—',r.planes?.nombre||'—',r.moneda_venta==='BS'?money(pf,'VES'):money(pf,'USD'),r.moneda_venta||'—',r.fecha_inicio?shortDate(r.fecha_inicio):'—',r.fecha_fin?shortDate(r.fecha_fin):'—',r.sesiones_usadas,Number(r.sesiones_totales||0)-Number(r.sesiones_usadas||0),<Pill key={r.id} color={r.estado==='activo'?'emerald':r.estado==='vencido'?'rose':'white'}>{r.estado}</Pill>]})}/>}
        {tipo==='citas'&&<DataTable headers={['Fecha','Hora','Cliente','Terapeuta','Servicio','Estado']} empty="No hay citas." rows={citasFiltradas.map((r)=>[shortDate(r.fecha),`${r.hora_inicio} - ${r.hora_fin}`,r.clientes?.nombre||'—',r.empleados?.nombre||'—',r.servicios?.nombre||'—',<Pill key={r.id} color={r.estado==='completada'?'emerald':r.estado==='cancelada'?'rose':r.estado==='confirmada'?'sky':'white'}>{r.estado}</Pill>])}/>}
        {tipo==='ingresos'&&<DataTable headers={['Fecha','Concepto','Categoría','Cliente','Método','Monto USD','Monto BS','Estado']} empty="No hay ingresos." rows={ingresosFiltrados.map((r)=>[shortDate(r.fecha),r.concepto,r.categoria,r.clientes?.nombre||'—',r.metodos_pago_v2?.nombre||'—',<span key={r.id} className="font-semibold text-emerald-400">{money(Number(r.monto_equivalente_usd||0),'USD')}</span>,money(Number(r.monto_equivalente_bs||0),'VES'),<Pill key={`${r.id}-p`} color={r.estado==='pagado'?'emerald':r.estado==='pendiente'?'amber':'rose'}>{r.estado}</Pill>])}/>}
        {tipo==='egresos'&&<DataTable headers={['Fecha','Concepto','Categoría','Proveedor / Empleado','Método','Monto USD','Monto BS','Estado']} empty="No hay egresos." rows={egresosFiltrados.map((r)=>[shortDate(r.fecha),r.concepto,categoriaEgresoLabel(r),r.empleados?.nombre||r.proveedor||'—',r.metodos_pago_v2?.nombre||'—',<span key={r.id} className="font-semibold text-rose-400">{money(Number(r.monto_equivalente_usd||0),'USD')}</span>,money(Number(r.monto_equivalente_bs||0),'VES'),<Pill key={`${r.id}-p`} color={r.estado==='pagado'?'emerald':r.estado==='liquidado'?'teal':'white'}>{r.estado}</Pill>])}/>}
        {tipo==='cobranzas'&&<DataTable headers={['Cliente','Concepto','Total USD','Pagado USD','Saldo USD','Vence','Estado']} empty="No hay cobranzas." rows={cobranzasFiltradas.map((r)=>[r.clientes?.nombre||r.cliente_nombre||'—',r.concepto,money(Number(r.monto_total_usd||0),'USD'),money(Number(r.monto_pagado_usd||0),'USD'),<span key={r.id} className={`font-semibold ${Number(r.saldo_usd||0)>0?'text-amber-400':'text-emerald-400'}`}>{money(Number(r.saldo_usd||0),'USD')}</span>,r.fecha_vencimiento?shortDate(r.fecha_vencimiento):'—',<Pill key={`${r.id}-p`} color={r.estado==='pagado'?'emerald':r.estado==='vencido'?'rose':'amber'}>{r.estado}</Pill>])}/>}
        {tipo==='inventario'&&<DataTable headers={['Producto','Tipo','Cantidad','Anterior','Nueva','Concepto','Monto USD','Fecha']} empty="No hay movimientos." rows={inventarioFiltrado.map((r)=>[r.inventario?.nombre||'—',r.tipo,r.cantidad,r.cantidad_anterior??'—',r.cantidad_nueva??'—',r.concepto,money(Number(r.monto_total_usd||0),'USD'),formatDateTime(r.created_at)])}/>}
        {tipo==='nomina'&&<DataTable headers={['Fecha','Empleado','Tipo','Moneda','Monto USD','Monto BS','Método']} empty="No hay pagos de nómina." rows={nominaFiltrada.map((r)=>[shortDate(r.fecha),r.empleados?.nombre||'—',tipoNominaLabel(r),r.moneda_pago,money(Number(r.monto_equivalente_usd||0),'USD'),money(Number(r.monto_equivalente_bs||0),'VES'),r.metodos_pago_v2?.nombre||'—'])}/>}
        {tipo==='liquidacion'&&<DataTable headers={['Fecha','Empleado','Tipo','Moneda','Monto USD','Monto BS','Método','Referencia']} empty="No hay liquidaciones." rows={liquidacionFiltrada.map((r)=>[shortDate(r.fecha),r.empleados?.nombre||'—',tipoNominaLabel(r),r.moneda_pago,<span key={r.id} className="font-semibold text-teal-300">{money(Number(r.monto_equivalente_usd||0),'USD')}</span>,money(Number(r.monto_equivalente_bs||0),'VES'),r.metodos_pago_v2?.nombre||'—',r.referencia||'—'])}/>}
        {tipo==='financiero'&&<DataTable headers={['Fecha','Tipo','Concepto','Categoría','Tercero','Método','Monto USD','Monto BS','Estado']} empty="No hay movimientos." rows={[...ingresosFiltrados.map((r)=>({fecha:r.fecha,created_at:r.created_at,tipo:'ingreso' as const,concepto:r.concepto,categoria:r.categoria,tercero:r.clientes?.nombre||'—',metodo:r.metodos_pago_v2?.nombre||'—',montoUsd:Number(r.monto_equivalente_usd||0),montoBs:Number(r.monto_equivalente_bs||0),estado:r.estado,id:r.id})),...egresosFiltrados.map((r)=>({fecha:r.fecha,created_at:r.created_at,tipo:'egreso' as const,concepto:r.concepto,categoria:categoriaEgresoLabel(r),tercero:r.empleados?.nombre||r.proveedor||'—',metodo:r.metodos_pago_v2?.nombre||'—',montoUsd:Number(r.monto_equivalente_usd||0),montoBs:Number(r.monto_equivalente_bs||0),estado:r.estado,id:r.id}))].sort((a,b)=>(a.created_at<b.created_at?1:-1)).map((r)=>[shortDate(r.fecha),<Pill key={`t-${r.id}`} color={r.tipo==='ingreso'?'sky':'amber'}>{r.tipo}</Pill>,r.concepto,r.categoria,r.tercero,r.metodo,<span key={`u-${r.id}`} className={`font-semibold ${r.tipo==='ingreso'?'text-emerald-400':'text-rose-400'}`}>{money(r.montoUsd,'USD')}</span>,money(r.montoBs,'VES'),<Pill key={`s-${r.id}`} color={r.estado==='pagado'?'emerald':r.estado==='pendiente'?'amber':'white'}>{r.estado}</Pill>])}/>}
      </Panel>

      {/* ── Presupuesto Drawer ── */}
      <PresupuestoDrawer
        open={presupuestoPanelOpen}
        onClose={() => setPresupuestoPanelOpen(false)}
        presupNumero={presupNumero} setPresupNumero={setPresupNumero}
        presupFecha={presupFecha} setPresupFecha={setPresupFecha}
        presupAtencion={presupAtencion} setPresupAtencion={setPresupAtencion}
        presupDireccion={presupDireccion} setPresupDireccion={setPresupDireccion}
        presupRif={presupRif} setPresupRif={setPresupRif}
        presupTelefono={presupTelefono} setPresupTelefono={setPresupTelefono}
        presupObservaciones={presupObservaciones} setPresupObservaciones={setPresupObservaciones}
        presupRealizadoPor={presupRealizadoPor} setPresupRealizadoPor={setPresupRealizadoPor}
        presupLineas={presupLineas} updateLinea={updateLinea} addLinea={addLinea} removeLinea={removeLinea}
        documentoClientes={documentoClientes} documentoClienteId={documentoClienteId}
        presupuestoClienteSearch={presupuestoClienteSearch} setPresupuestoClienteSearch={setPresupuestoClienteSearch}
        handleSelectPresupuestoCliente={handleSelectPresupuestoCliente}
        handlePresupuestoPDF={handlePresupuestoPDF}
      />

    </div>
  )
}