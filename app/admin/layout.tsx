import type { ReactNode } from "react"

import AdminSidebar from "@/components/layout/AdminSidebar"
import AdminHeader from "@/components/layout/AdminHeader"
import FloatingCurrencyCalculator from "@/components/FloatingCurrencyCalculator"

export default function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0b0b12] text-white">
      <AdminSidebar />

      <div className="flex min-h-screen flex-col">
        <AdminHeader />

        <main
          className="
            flex-1
            p-4
            md:p-6
            lg:p-8
            bg-gradient-to-b
            from-[#0b0b12]
            to-[#11111a]
          "
        >
          <div className="mx-auto w-full max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>

      {/* CALCULADORA FLOTANTE GLOBAL */}
      <FloatingCurrencyCalculator />
    </div>
  )
}