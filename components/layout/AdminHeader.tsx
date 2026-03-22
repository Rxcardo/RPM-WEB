export default function AdminHeader() {
  return (
    <header className="
      h-16 
      border-b 
      border-white/10 
      bg-[#0f0f17] 
      flex 
      items-center 
      justify-between 
      px-8
    ">

      <div className="flex items-center gap-4">

        <div className="
          w-10 
          h-10 
          rounded-xl 
          bg-gradient-to-br 
          from-purple-500 
          to-violet-700
        "/>

        <div>

          <p className="text-xs text-white/50">
            RPM
          </p>

          <h1 className="font-semibold">
            Dashboard
          </h1>

        </div>

      </div>

      <div className="flex items-center gap-6">

        <div className="
          px-4
          py-2
          rounded-xl
          bg-[#151520]
          border
          border-white/10
          text-sm
          text-white/70
        ">
          Admin
        </div>

      </div>

    </header>
  )
}