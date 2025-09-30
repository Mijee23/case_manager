'use client'

import { ReactNode, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'

interface AuthGuardProps {
  children: ReactNode | ((user: any, isDataLoading: boolean, setDataLoading: (loading: boolean) => void, refreshTrigger: number) => ReactNode)
  requiredRole?: '관리자' | '전공의' | '학생'
  fallbackMessage?: string
  showDataLoading?: boolean
  dataLoadingMessage?: string
}

export function AuthGuard({
  children,
  requiredRole,
  fallbackMessage,
  showDataLoading = false,
  dataLoadingMessage = "데이터를 불러오고 있습니다..."
}: AuthGuardProps) {
  const { user, loading: userLoading, error: userError, retry, softRetry } = useAuth()
  const [dataLoading, setDataLoading] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)


  // 사용자 인증 로딩 중인 경우
  if (userLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">사용자 정보를 불러오고 있습니다...</p>
        </div>
      </div>
    )
  }

  // 데이터 로딩 중인 경우 (showDataLoading이 true이고 dataLoading이 true일 때)
  if (showDataLoading && dataLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{dataLoadingMessage}</p>
        </div>
      </div>
    )
  }

  // 에러가 있는 경우
  if (userError) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">{userError}</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={softRetry} variant="outline" size="sm">
              재시도
            </Button>
            <Button onClick={retry} variant="outline" size="sm">
              새로고침
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // 로딩 완료 후 user가 없는 경우 (인증 실패)
  if (!user) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">사용자 정보를 확인할 수 없습니다.</p>
          <div className="flex gap-2 justify-center">
            <Button onClick={softRetry} variant="outline" size="sm">
              재시도
            </Button>
            <Button onClick={retry} variant="outline" size="sm">
              새로고침
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // 권한 체크 (requiredRole이 지정된 경우)
  if (requiredRole && user.role !== requiredRole) {
    const message = fallbackMessage || `${requiredRole} 권한이 필요합니다.`
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">{message}</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            새로고침
          </Button>
        </div>
      </div>
    )
  }

  // 모든 조건을 통과한 경우 children 렌더링
  // user가 확실히 존재하므로 안전하게 전달
  return <>{typeof children === 'function' ? children(user, dataLoading, setDataLoading, refreshTrigger) : children}</>
}