'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard')
      } else {
        router.push('/auth')
      }
    }
  }, [user, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-gray-600">페이지를 준비하는 중...</p>
      </div>
    </div>
  )
}
