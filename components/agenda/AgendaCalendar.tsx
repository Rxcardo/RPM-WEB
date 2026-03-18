type AgendaEvent = {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  cliente: string;
  terapeuta: string;
  servicio: string;
};

type Props = {
  events: AgendaEvent[];
};

const hours = Array.from({ length: 12 }, (_, i) => {
  const hour = i + 8;
  return `${hour.toString().padStart(2, "0")}:00`;
});

export default function AgendaCalendar({ events }: Props) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">Calendario de agenda</h2>
        <p className="text-sm text-gray-500">Vista diaria de citas</p>
      </div>

      <div className="divide-y">
        {hours.map((hour) => {
          const citasEnHora = events.filter(
            (event) => event.hora_inicio.slice(0, 2) === hour.slice(0, 2)
          );

          return (
            <div key={hour} className="grid grid-cols-[100px_1fr] min-h-[90px]">
              <div className="border-r p-4 text-sm font-medium text-gray-500">
                {hour}
              </div>

              <div className="p-3 space-y-2">
                {citasEnHora.length === 0 ? (
                  <div className="text-sm text-gray-300">Sin citas</div>
                ) : (
                  citasEnHora.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-xl border bg-gray-50 p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-gray-900">
                          {event.cliente}
                        </p>
                        <span className="text-xs capitalize text-gray-500">
                          {event.estado}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600">
                        {event.hora_inicio} - {event.hora_fin}
                      </p>

                      <p className="text-sm text-gray-600">
                        {event.servicio} · {event.terapeuta}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}