import { createClient } from "@/lib/supabase/server";

export default async function CitasHoyTable() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("citas")
    .select("id, fecha, hora_inicio, hora_fin, estado, notas")
    .eq("fecha", today)
    .order("hora_inicio", { ascending: true });

  if (error) {
    return (
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        Error cargando citas.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Citas de hoy</h2>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-2 pr-4">Hora</th>
              <th className="py-2 pr-4">Estado</th>
              <th className="py-2 pr-4">Notas</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((cita) => (
              <tr key={cita.id} className="border-b last:border-0">
                <td className="py-3 pr-4">
                  {cita.hora_inicio} - {cita.hora_fin}
                </td>
                <td className="py-3 pr-4 capitalize">{cita.estado}</td>
                <td className="py-3 pr-4">{cita.notas || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}