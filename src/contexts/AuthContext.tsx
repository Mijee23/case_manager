'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { User } from '@/types/database'
import { useRouter } from 'next/navigation'
import { usePageFocus } from '@/hooks/usePageFocus'
import { toast } from 'sonner'

interface AuthContextType {
  user: User | null
  loading: boolean
  error: string | null
  signOut: () => Promise<void>
  retry: () => void
  softRetry: () => Promise<void>
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const supabase = createSupabaseClient()
  const router = useRouter()

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

  const initializeAuth = async (forceRefresh = false) => {
    try {
      setLoading(true)
      setError(null)

      const timeoutId = setTimeout(() => {
        console.warn('인증 초기화 타임아웃')
        setError('인증 확인 중 시간이 초과되었습니다.')
        setLoading(false)
        setInitialized(true)
      }, 5000)

      // 강제 새로고침인 경우 세션을 다시 가져옴
      if (forceRefresh) {
        await supabase.auth.refreshSession()
      }

      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession()

      clearTimeout(timeoutId)

      if (sessionError) {
        console.warn('세션 조회 에러:', sessionError)
        // 세션 에러 시 로컬 상태 정리
        await cleanupAuthState()
        setUser(null)
        return
      }

      if (session?.user) {
        // 세션이 유효한지 추가 검증
        const isSessionValid = await validateSession(session)
        if (isSessionValid) {
          const userData = await fetchUserData(session.user.id)
          setUser(userData)
        } else {
          console.warn('세션이 유효하지 않음')
          await cleanupAuthState()
          setUser(null)
        }
      } else {
        setUser(null)
      }
    } catch (error) {
      console.warn('인증 초기화 중 오류:', error)
      setError('인증 확인 중 오류가 발생했습니다.')
      setUser(null)
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }

  // 세션 유효성 검증
  const validateSession = async (session: any): Promise<boolean> => {
    try {
      // 현재 시간과 세션 만료 시간 비교
      const now = Date.now() / 1000
      if (session.expires_at && session.expires_at < now) {
        console.warn('세션이 만료됨')
        return false
      }

      // 서버에서 실제 사용자 정보를 조회해서 세션 유효성 확인
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('id', session.user.id)
        .single()

      if (error || !data) {
        console.warn('사용자 검증 실패:', error)
        return false
      }

      return true
    } catch (error) {
      console.warn('세션 검증 중 오류:', error)
      return false
    }
  }

  // 인증 상태 정리
  const cleanupAuthState = async () => {
    try {
      // Supabase 세션 정리
      await supabase.auth.signOut({ scope: 'local' })

      // 로컬 스토리지 정리
      if (typeof window !== 'undefined') {
        const authKeys = Object.keys(localStorage).filter(key =>
          key.includes('supabase') || key.includes('sb-')
        )
        authKeys.forEach(key => localStorage.removeItem(key))
      }
    } catch (error) {
      console.warn('인증 상태 정리 중 오류:', error)
    }
  }

  usePageFocus(() => {
    if (initialized && !loading && !user) {
      console.log('페이지 포커스 시 인증 재확인')
      initializeAuth(true) // 강제 새로고침
    }
  })

  useEffect(() => {
    let mounted = true

    // 브라우저 새로고침 감지 및 처리
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // bfcache에서 복원된 경우 - 강제 인증 재확인
        console.log('bfcache에서 페이지 복원됨, 인증 재확인')
        initializeAuth(true)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && initialized) {
        // 페이지가 다시 보이게 되었을 때 세션 검증
        console.log('페이지 가시성 변경, 세션 검증')
        validateCurrentSession()
      }
    }

    // Performance API로 새로고침 감지
    const handleLoad = () => {
      if (performance.getEntriesByType('navigation')[0]?.type === 'reload') {
        console.log('브라우저 새로고침 감지됨')
        // 약간의 지연 후 강제 인증 재확인
        setTimeout(() => {
          if (mounted) {
            initializeAuth(true)
          }
        }, 100)
      }
    }

    // 세션 유효성 검증 (로딩 상태 없이)
    const validateCurrentSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          const isValid = await validateSession(session)
          if (!isValid) {
            console.log('현재 세션이 유효하지 않음, 정리')
            await cleanupAuthState()
            setUser(null)
          }
        }
      } catch (error) {
        console.warn('세션 검증 중 오류:', error)
      }
    }

    // 이벤트 리스너 등록
    window.addEventListener('pageshow', handlePageShow)
    window.addEventListener('load', handleLoad)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    initializeAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('인증 상태 변경:', event, session?.user?.id)

      if (event === 'SIGNED_IN' && session?.user) {
        setLoading(true)
        setError(null)

        const isValid = await validateSession(session)
        if (isValid && mounted) {
          const userData = await fetchUserData(session.user.id)
          if (mounted) {
            setUser(userData)
            setLoading(false)
          }
        } else {
          console.warn('로그인된 세션이 유효하지 않음')
          await cleanupAuthState()
          setUser(null)
          setLoading(false)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setError(null)
        setLoading(false)
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('토큰 갱신됨')
        // 토큰 갱신 시에도 세션 유효성 검증
        const isValid = await validateSession(session)
        if (!isValid) {
          console.warn('갱신된 토큰이 유효하지 않음')
          await cleanupAuthState()
          setUser(null)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
      window.removeEventListener('pageshow', handlePageShow)
      window.removeEventListener('load', handleLoad)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const signOut = async () => {
    try {
      setUser(null)

      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()

        const allCookies = document.cookie.split(';').filter(c => c.trim())
        allCookies.forEach((cookie) => {
          const name = cookie.split('=')[0].trim()
          if (name) {
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

      await supabase.auth.signOut({ scope: 'global' })
      await supabase.auth.signOut({ scope: 'local' })

      toast.success('로그아웃되었습니다.')

      if (typeof window !== 'undefined') {
        window.location.replace('/auth')
      } else {
        router.push('/auth')
      }

    } catch (error) {
      console.error('로그아웃 중 오류:', error)

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

  const retry = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

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

  const value = {
    user,
    loading,
    error,
    signOut,
    retry,
    softRetry,
    isAuthenticated: !!user && !loading && !error
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}