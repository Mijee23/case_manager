'use client'

import { createSupabaseClient } from '@/lib/supabase'
import { User } from '@/types/database'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createSupabaseClient()
  const router = useRouter()

  // 사용자 데이터 조회 함수
  const fetchUserData = async (userId: string): Promise<User | null> => {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.warn('사용자 데이터 조회 실패:', error)
        setError('사용자 데이터를 불러올 수 없습니다.')
        return null
      }

      setError(null)
      return userData
    } catch (error) {
      console.warn('사용자 데이터 조회 중 오류:', error)
      setError('사용자 데이터 조회 중 오류가 발생했습니다.')
      return null
    }
  }

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        setLoading(true)
        setError(null)

        // timeout을 설정하여 무한 로딩 방지
        const timeoutId = setTimeout(() => {
          if (mounted) {
            console.warn('인증 초기화 타임아웃')
            setError('인증 확인 중 시간이 초과되었습니다.')
            setLoading(false)
          }
        }, 5000) // 5초 타임아웃

        const {
          data: { session },
        } = await supabase.auth.getSession()

        clearTimeout(timeoutId)

        if (!mounted) return

        if (session?.user) {
          const userData = await fetchUserData(session.user.id)
          if (mounted) {
            setUser(userData)
          }
        } else {
          setUser(null)
        }
      } catch (error) {
        if (mounted) {
          console.warn('인증 초기화 중 오류:', error)
          setError('인증 확인 중 오류가 발생했습니다.')
          setUser(null)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('인증 상태 변경:', event, session?.user?.id)

      // 인증 상태 변경 시 로딩 상태 설정
      if (event === 'SIGNED_IN' && session?.user) {
        setLoading(true)
        setError(null)

        const userData = await fetchUserData(session.user.id)
        if (mounted) {
          setUser(userData)
          setLoading(false)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setError(null)
        setLoading(false)
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // 토큰 갱신 시에는 사용자 데이터를 다시 조회하지 않음
        console.log('토큰 갱신됨')
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const signOut = async () => {
    try {
      // 로컬 상태 즉시 클리어
      setUser(null)

      // 브라우저 저장소 정리
      if (typeof window !== 'undefined') {
        // localStorage & sessionStorage 정리
        localStorage.clear()
        sessionStorage.clear()

        // 쿠키 정리 (Supabase 인증 쿠키 포함)
        const allCookies = document.cookie.split(';').filter(c => c.trim())
        allCookies.forEach((cookie) => {
          const name = cookie.split('=')[0].trim()
          if (name) {
            // 다양한 도메인/경로 조합으로 삭제
            const domains = [window.location.hostname, `.${window.location.hostname}`]
            const paths = ['/', '/auth', '/dashboard']

            domains.forEach(domain => {
              paths.forEach(path => {
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path};domain=${domain}`
                document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=${path}`
              })
            })
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
          }
        })

        // IndexedDB 정리 (Supabase 관련)
        try {
          const databases = await indexedDB.databases()
          const supabaseDbs = databases.filter(db =>
            db.name?.includes('supabase') || db.name?.includes('auth') || db.name?.includes('sb-')
          )

          await Promise.allSettled(supabaseDbs.map(async (db) => {
            if (db.name) {
              await new Promise<void>((resolve) => {
                const deleteReq = indexedDB.deleteDatabase(db.name!)
                deleteReq.onsuccess = deleteReq.onerror = deleteReq.onblocked = () => resolve()
              })
            }
          }))
        } catch (error) {
          console.warn('IndexedDB 정리 실패:', error)
        }
      }

      // Supabase 로그아웃
      await supabase.auth.signOut({ scope: 'global' })
      await supabase.auth.signOut({ scope: 'local' })

      toast.success('로그아웃되었습니다.')

      // /auth로 리디렉션
      if (typeof window !== 'undefined') {
        window.location.replace('/auth')
      } else {
        router.push('/auth')
      }

    } catch (error) {
      console.error('로그아웃 중 오류:', error)

      // 에러 발생시에도 강제 정리 및 이동
      setUser(null)

      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
        window.location.replace('/auth')
      } else {
        router.push('/auth')
      }

      toast.error('로그아웃되었습니다.')
    }
  }

  // 재시도 함수 - 강제로 페이지 새로고침
  const retry = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  // 소프트 재시도 함수 - 인증만 다시 확인
  const softRetry = async () => {
    setLoading(true)
    setError(null)

    try {
      const timeoutId = setTimeout(() => {
        setError('재시도 중 시간이 초과되었습니다.')
        setLoading(false)
      }, 5000)

      const { data: { session } } = await supabase.auth.getSession()
      clearTimeout(timeoutId)

      if (session?.user) {
        const userData = await fetchUserData(session.user.id)
        setUser(userData)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.warn('재시도 중 오류:', error)
      setError('재시도 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return { user, loading, error, signOut, retry, softRetry }
}