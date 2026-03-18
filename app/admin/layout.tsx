import type { ReactNode } from 'react'
import AdminNav from '@/components/AdminNav'

export default function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex flex-col lg:flex-row min-h-screen">
        <AdminNav />
        <main className="flex-1 w-full">
          {children}
        </main>
      </div>
    </div>
  )
}