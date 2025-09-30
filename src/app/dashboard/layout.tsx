'use client'

import { Navigation } from '@/components/layout/navigation'
import ProtectedRoute from '@/components/auth/ProtectedRoute'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background">
        <Navigation />
        <div className="flex-1 md:ml-64 overflow-auto">
          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
