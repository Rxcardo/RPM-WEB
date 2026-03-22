import type { ReactNode } from "react"
import AdminSidebar from "@/components/layout/AdminSidebar"
import AdminHeader from "@/components/layout/AdminHeader"

export default function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0b0b12] text-white">

      <div className="flex min-h-screen">

        <AdminSidebar />

        <div className="flex-1 flex flex-col">

          <AdminHeader />

          <main className="
            flex-1 
            p-8 
            bg-gradient-to-b 
            from-[#0b0b12] 
            to-[#11111a]
          ">
            {children}
          </main>

        </div>

      </div>

    </div>
  )
}