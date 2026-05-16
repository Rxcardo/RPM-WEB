import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type PeriodoKey = "actual" | "anterior";
type Moneda = "USD" | "BS";

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getPeriodo(key: PeriodoKey) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  let primera = now.getDate() <= 15;

  if (key === "anterior") {
    if (!primera) {
      primera = true;
    } else {
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
      primera = false;
    }
  }

  const start = primera ? new Date(year, month, 1) : new Date(year, month, 16);
  const end = primera ? new Date(year, month, 15) : new Date(year, month + 1, 0);

  return {
    key,
    start: dateKey(start),
    end: dateKey(end),
    label: primera ? "Primera quincena" : "Segunda quincena",
  };
}

function num(value: any) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function r2(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function uniqueStrings(values: any[]): string[] {
  return [...new Set(values.map((v) => (v ? String(v) : "")).filter(Boolean))];
}

function mapById<T extends { id?: any }>(rows: T[] | null | undefined): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows || []) {
    if (row?.id) map.set(String(row.id), row);
  }
  return map;
}

function normalizarEstado(value: any) {
  return String(value || "").trim().toLowerCase();
}

function isPendienteEstado(value: any, pagado: any) {
  if (pagado === true) return false;
  const e = normalizarEstado(value);
  return e === "pendiente" || e === "parcial" || e === "";
}

function isLiquidadoEstado(value: any, pagado: any) {
  if (pagado === true) return true;
  return ["liquidado", "liquidada", "pagado", "pagada", "cobrada"].includes(normalizarEstado(value));
}

function inferirMoneda(row: any): Moneda {
  const raw = String(row?.moneda || row?.moneda_pago || "").toUpperCase();
  if (raw === "BS" || raw === "VES" || raw === "VEF") return "BS";
  if (raw === "USD" || raw === "$") return "USD";
  const bs = num(row?.monto_profesional_bs);
  const usd = num(row?.monto_profesional_usd ?? row?.profesional);
  return bs > 0 && usd <= 0 ? "BS" : "USD";
}

function getComisionBrutoByMoneda(row: any, moneda: Moneda) {
  return moneda === "USD" ? num(row?.monto_profesional_usd ?? row?.profesional) : num(row?.monto_profesional_bs);
}

function getComisionDescuentoByMoneda(row: any, moneda: Moneda) {
  return moneda === "USD" ? num(row?.descuento_deuda_usd) : num(row?.descuento_deuda_bs);
}

function getComisionNetoByMoneda(row: any, moneda: Moneda) {
  return r2(Math.max(getComisionBrutoByMoneda(row, moneda) - getComisionDescuentoByMoneda(row, moneda), 0));
}

function getComisionConcepto(row: any): string {
  const concepto = String(row?.pago_concepto || "").trim();
  if (concepto) return concepto;

  const tipo = String(row?.tipo || "").toLowerCase();
  const servicio = String(row?.servicio_nombre || "").trim();
  const cliente = String(row?.cliente_nombre || row?.pago_cliente_nombre || "").trim();

  if (tipo === "plan") {
    if (servicio && cliente) return `Plan · ${servicio} · ${cliente}`;
    if (servicio) return `Plan · ${servicio}`;
    if (cliente) return `Plan · ${cliente}`;
    return "Comisión por plan";
  }

  if (tipo === "cita") {
    if (servicio && cliente) return `Cita · ${servicio} · ${cliente}`;
    if (servicio) return `Cita · ${servicio}`;
    if (cliente) return `Cita · ${cliente}`;
    return "Comisión por cita";
  }

  if (servicio && cliente) return `${servicio} · ${cliente}`;
  if (servicio) return servicio;
  if (cliente) return `Comisión · ${cliente}`;

  const fecha = String(row?.cita_fecha || row?.fecha || "").slice(0, 10);
  return `Comisión · ${fecha || "—"}`;
}

function buildResumen(detalle: any[], estadoCuenta: any) {
  const pendientes = detalle.filter((c) => isPendienteEstado(c.estado, c.pagado));
  const liquidadas = detalle.filter((c) => isLiquidadoEstado(c.estado, c.pagado));

  const sum = (items: any[], picker: (row: any) => number) => r2(items.reduce((acc, row) => acc + picker(row), 0));

  const pendienteProfesionalUsd = sum(pendientes, (c) => getComisionNetoByMoneda(c, "USD"));
  const pendienteProfesionalBs = sum(pendientes, (c) => getComisionNetoByMoneda(c, "BS"));
  const pagadoProfesionalUsd = sum(liquidadas, (c) => getComisionNetoByMoneda(c, "USD"));
  const pagadoProfesionalBs = sum(liquidadas, (c) => getComisionNetoByMoneda(c, "BS"));
  const basePendienteUsd = sum(pendientes, (c) => num(c.monto_base_usd ?? (c.moneda === "USD" ? c.base : 0)));
  const basePendienteBs = sum(pendientes, (c) => num(c.monto_base_bs ?? (c.moneda === "BS" ? c.base : 0)));
  const rpmPendienteUsd = sum(pendientes, (c) => num(c.monto_rpm_usd ?? (c.moneda === "USD" ? c.rpm : 0)));
  const rpmPendienteBs = sum(pendientes, (c) => num(c.monto_rpm_bs ?? (c.moneda === "BS" ? c.rpm : 0)));
  const deduccionesUsd = sum(detalle, (c) => num(c.descuento_deuda_usd));
  const deduccionesBs = sum(detalle, (c) => num(c.descuento_deuda_bs));

  return {
    total_facturado_usd: pendienteProfesionalUsd,
    total_pagado_usd: pagadoProfesionalUsd,
    total_pagado_bs: pagadoProfesionalBs,
    total_pendiente_usd: pendienteProfesionalUsd,
    total_pendiente_bs: pendienteProfesionalBs,
    total_base_pendiente_usd: basePendienteUsd,
    total_base_pendiente_bs: basePendienteBs,
    total_rpm_pendiente_usd: rpmPendienteUsd,
    total_rpm_pendiente_bs: rpmPendienteBs,
    total_deducciones_usd: deduccionesUsd,
    total_deducciones_bs: deduccionesBs,
    credito_disponible_usd: r2(num(estadoCuenta?.credito_disponible_usd)),
    saldo_favor_neto_usd: r2(num(estadoCuenta?.saldo_favor_neto_usd)),
    saldo_pendiente_neto_usd: r2(num(estadoCuenta?.saldo_pendiente_neto_usd ?? estadoCuenta?.total_pendiente_usd)),
  };
}

export async function GET(req: NextRequest) {
  try {
    let response = NextResponse.next();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: Record<string, any>) {
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: Record<string, any>) {
            response.cookies.set({ name, value: "", ...options });
          },
        },
      },
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data: empleado, error: empleadoError } = await supabaseAdmin
      .from("empleados")
      .select("id,nombre,rol,email,auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (empleadoError || !empleado) {
      return NextResponse.json({ error: empleadoError?.message || "No se encontró empleado vinculado." }, { status: 404 });
    }

    const periodoParam: PeriodoKey = req.nextUrl.searchParams.get("periodo") === "anterior" ? "anterior" : "actual";
    const periodo = getPeriodo(periodoParam);

    const [estadoRes, comisionesRes] = await Promise.all([
      supabaseAdmin
        .from("v_empleados_estado_cuenta")
        .select("total_facturado_usd,total_pagado_usd,total_pendiente_usd,credito_disponible_usd,saldo_favor_neto_usd,saldo_pendiente_neto_usd")
        .eq("empleado_id", empleado.id)
        .maybeSingle(),
      supabaseAdmin
        .from("comisiones_detalle")
        .select("id,empleado_id,tipo,estado,fecha,moneda,tasa_bcv,pagado,fecha_pago,liquidacion_id,pago_empleado_id,cliente_id,pago_id,cita_id,servicio_id,cliente_plan_id,monto_base_usd,monto_base_bs,monto_rpm_usd,monto_rpm_bs,monto_profesional_usd,monto_profesional_bs,profesional,base,rpm")
        .eq("empleado_id", empleado.id)
        .gte("fecha", periodo.start)
        .lte("fecha", periodo.end)
        .not("estado", "in", '("retenida","cancelada","cancelado","retenido")')
        .order("fecha", { ascending: false })
        .limit(500),
    ]);

    if (estadoRes.error) console.error("Error estado cuenta empleado:", estadoRes.error);
    if (comisionesRes.error) return NextResponse.json({ error: comisionesRes.error.message }, { status: 500 });

    const comisionesRaw = Array.isArray(comisionesRes.data) ? comisionesRes.data : [];
    const comisionIds = uniqueStrings(comisionesRaw.map((r) => r.id));

    const { data: descuentosData, error: descuentosError } = comisionIds.length > 0
      ? await supabaseAdmin
          .from("comisiones_descuentos_deuda")
          .select("id,comision_id,monto_descuento_usd,monto_descuento_bs,estado,modo,liquidacion_id,pago_empleado_id,created_at,notas")
          .in("comision_id", comisionIds)
      : { data: [], error: null as any };

    if (descuentosError) console.error("Error cargando descuentos de deuda:", descuentosError);

    const estadosAnulados = ["anulado", "anulada", "cancelado", "cancelada", "revertido", "revertida"];
    const descuentosMap = new Map<string, { usd: number; bs: number; registros: any[] }>();

    for (const d of (descuentosData || []) as any[]) {
      if (estadosAnulados.includes(normalizarEstado(d.estado))) continue;
      const key = String(d.comision_id || "");
      if (!key) continue;
      const prev = descuentosMap.get(key) || { usd: 0, bs: 0, registros: [] };
      descuentosMap.set(key, {
        usd: r2(prev.usd + num(d.monto_descuento_usd)),
        bs: r2(prev.bs + num(d.monto_descuento_bs)),
        registros: [...prev.registros, d],
      });
    }

    const pagoIds = uniqueStrings(comisionesRaw.map((r) => r.pago_id));
    const citaIds = uniqueStrings(comisionesRaw.map((r) => r.cita_id));
    const clientePlanIds = uniqueStrings(comisionesRaw.map((r) => r.cliente_plan_id));

    const [pagosRes, citasRes, planesRes] = await Promise.all([
      pagoIds.length > 0 ? supabaseAdmin.from("pagos").select("id,concepto,categoria,fecha,cliente_id").in("id", pagoIds) : Promise.resolve({ data: [], error: null }),
      citaIds.length > 0 ? supabaseAdmin.from("citas").select("id,fecha,hora_inicio,cliente_id,servicio_id").in("id", citaIds) : Promise.resolve({ data: [], error: null }),
      clientePlanIds.length > 0 ? supabaseAdmin.from("clientes_planes").select("id,cliente_id").in("id", clientePlanIds) : Promise.resolve({ data: [], error: null }),
    ]);

    if ((pagosRes as any).error) console.error("Error pagos:", (pagosRes as any).error);
    if ((citasRes as any).error) console.error("Error citas:", (citasRes as any).error);
    if ((planesRes as any).error) console.error("Error planes:", (planesRes as any).error);

    const pagosMap = mapById(((pagosRes as any).data || []) as any[]);
    const citasMap = mapById(((citasRes as any).data || []) as any[]);
    const planesMap = mapById(((planesRes as any).data || []) as any[]);

    const servicioIds = uniqueStrings([
      ...comisionesRaw.map((r) => r.servicio_id),
      ...[...citasMap.values()].map((c: any) => c?.servicio_id),
    ]);

    const clienteIds = uniqueStrings([
      ...comisionesRaw.map((r) => r.cliente_id),
      ...[...pagosMap.values()].map((p: any) => p?.cliente_id),
      ...[...citasMap.values()].map((c: any) => c?.cliente_id),
      ...[...planesMap.values()].map((p: any) => p?.cliente_id),
    ]);

    const [serviciosRes, clientesRes] = await Promise.all([
      servicioIds.length > 0 ? supabaseAdmin.from("servicios").select("id,nombre").in("id", servicioIds) : Promise.resolve({ data: [], error: null }),
      clienteIds.length > 0 ? supabaseAdmin.from("clientes").select("id,nombre").in("id", clienteIds) : Promise.resolve({ data: [], error: null }),
    ]);

    if ((serviciosRes as any).error) console.error("Error servicios:", (serviciosRes as any).error);
    if ((clientesRes as any).error) console.error("Error clientes:", (clientesRes as any).error);

    const serviciosMap = mapById(((serviciosRes as any).data || []) as any[]);
    const clientesMap = mapById(((clientesRes as any).data || []) as any[]);

    const detalle = comisionesRaw.map((row: any) => {
      const pago = row?.pago_id ? pagosMap.get(String(row.pago_id)) : null;
      const cita = row?.cita_id ? citasMap.get(String(row.cita_id)) : null;
      const plan = row?.cliente_plan_id ? planesMap.get(String(row.cliente_plan_id)) : null;

      const clientePago = pago?.cliente_id ? clientesMap.get(String(pago.cliente_id)) : null;
      const clienteDirecto = row?.cliente_id ? clientesMap.get(String(row.cliente_id)) : null;
      const clienteCita = cita?.cliente_id ? clientesMap.get(String(cita.cliente_id)) : null;
      const clientePlan = plan?.cliente_id ? clientesMap.get(String(plan.cliente_id)) : null;

      const servicioDirecto = row?.servicio_id ? serviciosMap.get(String(row.servicio_id)) : null;
      const servicioCita = cita?.servicio_id ? serviciosMap.get(String(cita.servicio_id)) : null;

      const descuento = row?.id ? descuentosMap.get(String(row.id)) : null;
      const descuentoUsd = r2(num(descuento?.usd));
      const descuentoBs = r2(num(descuento?.bs));
      const moneda = inferirMoneda(row);

      const enriched: any = {
        ...row,
        moneda,
        pago_concepto: pago?.concepto || null,
        pago_categoria: pago?.categoria || null,
        pago_fecha: pago?.fecha || null,
        pago_cliente_nombre: clientePago?.nombre || null,
        cliente_nombre: clientePago?.nombre || clienteDirecto?.nombre || clienteCita?.nombre || clientePlan?.nombre || null,
        servicio_nombre: servicioDirecto?.nombre || servicioCita?.nombre || null,
        cita_fecha: cita?.fecha || null,
        cita_hora_inicio: cita?.hora_inicio || null,
        descuento_deuda_usd: descuentoUsd,
        descuento_deuda_bs: descuentoBs,
        descuento_deuda_registros: descuento?.registros || [],
      };

      enriched.monto_profesional_neto_usd = getComisionNetoByMoneda(enriched, "USD");
      enriched.monto_profesional_neto_bs = getComisionNetoByMoneda(enriched, "BS");
      enriched.concepto = getComisionConcepto(enriched);

      return enriched;
    });

    const resumen = buildResumen(detalle, estadoRes.data || {});

    return NextResponse.json({
      empleado: { id: empleado.id, nombre: empleado.nombre, rol: empleado.rol },
      periodo,
      fuente: "comisiones_detalle",
      resumen,
      detalle,
      pagos: [],
      debug: {
        periodo,
        empleado_id: empleado.id,
        comisiones_raw: comisionesRaw.length,
        comisiones_detalle: detalle.length,
        pendientes: detalle.filter((c) => isPendienteEstado(c.estado, c.pagado)).length,
        liquidadas: detalle.filter((c) => isLiquidadoEstado(c.estado, c.pagado)).length,
        descuentos: (descuentosData || []).length,
        nota: "No se consultan columnas inexistentes: concepto, descripcion, monto_profesional_neto_usd ni monto_profesional_neto_bs. Se calculan/enriquecen en API.",
      },
    });
  } catch (err: any) {
    console.error("GET /api/empleado/quincena error:", err);
    return NextResponse.json({ error: err?.message || "No se pudo cargar la quincena." }, { status: 500 });
  }
}
