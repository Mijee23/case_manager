'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, ReactNode } from 'react'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface ProtectedRouteProps {
  children: ReactNode
  requireAuth?: boolean
  redirectTo?: string
}

export default function ProtectedRoute({
  children,
  requireAuth = true,
  redirectTo = '/auth'
}: ProtectedRouteProps) {
  const { user, loading, error, retry, softRetry } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && requireAuth && !user) {
      if (pathname !== '/auth') {
        router.push(redirectTo)
      }
    }
  }, [user, loading, requireAuth, router, redirectTo, pathname])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" className="text-blue-600" />
          <div className="space-y-1">
            <p className="text-gray-900 font-medium">인증 상태 확인 중</p>
            <p className="text-gray-500 text-sm">잠시만 기다려주세요...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-6 max-w-md mx-auto p-6">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-gray-900">인증 확인 실패</h2>
            <p className="text-gray-600">{error}</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={softRetry}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              다시 시도
            </button>

            <button
              onClick={retry}
              className="w-full px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              페이지 새로고침
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (requireAuth && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" className="text-blue-600" />
          <div className="space-y-1">
            <p className="text-gray-900 font-medium">로그인 페이지로 이동 중</p>
            <p className="text-gray-500 text-sm">인증이 필요합니다</p>
          </div>
        </div>
      </div>
    )
  }

  if (!requireAuth && user && pathname === '/auth') {
    router.push('/dashboard')
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <LoadingSpinner size="lg" className="text-green-600" />
          <div className="space-y-1">
            <p className="text-gray-900 font-medium">대시보드로 이동 중</p>
            <p className="text-gray-500 text-sm">이미 로그인되어 있습니다</p>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}