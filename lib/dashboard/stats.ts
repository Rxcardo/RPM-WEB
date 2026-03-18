import { createClient } from "@/lib/supabase/server";

export type DashboardStats = {
  citasHoy: number;
  clientesActivos: number;
  planesActivos: number;
  sesionesCompletadasHoy: number;
  ingresosHoy: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const today = new Date().toISOString().slice(0, 10);

  const [
    citasHoyRes,
    clientesActivosRes,
    planesActivosRes,
    sesionesCompletadasHoyRes,
    citasCompletadasHoyRes,
  ] = await Promise.all([
    supabase
      .from("citas")
      .select("*", { count: "exact", head: true })
      .eq("fecha", today),

    supabase
      .from("clientes")
      .select("*", { count: "exact", head: true })
      .eq("estado", "activo"),

    supabase
      .from("clientes_planes")
      .select("*", { count: "exact", head: true })
      .eq("estado", "activo"),

    supabase
      .from("citas")
      .select("*", { count: "exact", head: true })
      .eq("fecha", today)
      .eq("estado", "completada"),

    supabase
      .from("citas")
      .select(`
        id,
        servicio_id,
        servicios (
          precio
        )
      `)
      .eq("fecha", today)
      .eq("estado", "completada"),
  ]);

  const ingresosHoy =
    citasCompletadasHoyRes.data?.reduce((acc: number, item: any) => {
      const precio = item.servicios?.precio ?? 0;
      return acc + Number(precio);
    }, 0) ?? 0;

  return {
    citasHoy: citasHoyRes.count ?? 0,
    clientesActivos: clientesActivosRes.count ?? 0,
    planesActivos: planesActivosRes.count ?? 0,
    sesionesCompletadasHoy: sesionesCompletadasHoyRes.count ?? 0,
    ingresosHoy,
  };
}