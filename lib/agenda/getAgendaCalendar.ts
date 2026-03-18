import { createClient } from "@/lib/supabase/server";

export type AgendaEvent = {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  cliente: string;
  terapeuta: string;
  servicio: string;
};

export async function getAgendaCalendar(fecha?: string): Promise<AgendaEvent[]> {
  const supabase = await createClient();
  const today = fecha ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("citas")
    .select(`
      id,
      fecha,
      hora_inicio,
      hora_fin,
      estado,
      clientes(nombre),
      empleados(nombre),
      servicios(nombre)
    `)
    .eq("fecha", today)
    .order("hora_inicio", { ascending: true });

  if (error) {
    console.error("Error cargando agenda calendario:", error.message);
    return [];
  }

  return (data ?? []).map((item: any) => ({
    id: item.id,
    fecha: item.fecha,
    hora_inicio: item.hora_inicio,
    hora_fin: item.hora_fin,
    estado: item.estado,
    cliente: item.clientes?.nombre ?? "Sin cliente",
    terapeuta: item.empleados?.nombre ?? "Sin terapeuta",
    servicio: item.servicios?.nombre ?? "Sin servicio",
  }));
}
