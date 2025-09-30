'use client'

import { useEffect } from 'react'

export function usePageFocus(onFocus: () => void) {
  useEffect(() => {
    // bfcache 비활성화 - 뒤로가기 시 캐시된 페이지 대신 새로 로드
    const handleBeforeUnload = () => {
      // 페이지가 언로드될 때 빈 함수 실행으로 bfcache 비활성화
    }

    // 페이지 가시성 변경 감지
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onFocus()
      }
    }

    // 페이지 포커스 감지
    const handleFocus = () => {
      onFocus()
    }

    // popstate 이벤트 (뒤로가기/앞으로가기)
    const handlePopState = () => {
      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          onFocus()
        }
      }, 100) // 약간의 지연을 두어 페이지 로드 완료 후 실행
    }

    // 페이지 로드 완료 시
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // bfcache에서 복원된 경우
        onFocus()
      }
    }

    // 이벤트 리스너 등록
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('popstate', handlePopState)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [onFocus])
}