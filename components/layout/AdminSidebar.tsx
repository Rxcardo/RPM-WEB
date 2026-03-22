import AdminNav from '@/components/AdminNav'

export default function AdminSidebar() {
  return (
    <aside className="hidden lg:block w-80 shrink-0 border-r border-white/10 bg-[#0f0f17] min-h-screen">
      <AdminNav />
    </aside>
  )
}