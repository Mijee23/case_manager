'use client'

import { Navigation } from '@/components/layout/navigation'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-background">
      <Navigation />
      <div className="flex-1 md:ml-64 overflow-auto">
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
