export default function AnaliticaSkeleton() {
  return (
    <div className="min-h-screen bg-[#0f1a16] p-6 animate-pulse">
      {/* Header */}
      <div className="mb-8">
        <div className="h-8 w-64 rounded-lg bg-white/10 mb-2" />
        <div className="h-4 w-48 rounded bg-white/5" />
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-28 rounded-xl bg-white/10" />
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-white/5" />
        ))}
      </div>

      {/* Chart area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 h-72 rounded-2xl bg-white/5" />
        <div className="h-72 rounded-2xl bg-white/5" />
      </div>

      {/* Table */}
      <div className="h-64 rounded-2xl bg-white/5" />
    </div>
  );
}
