'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { User } from '@/types/database'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface AuthContextType {
  user: User | null
  loading: boolean
  error: string | null
  initialized: boolean
  signOut: () => Promise<void>
  retry: () => void
  softRetry: () => Promise<void>
  updateUserAfterLogin: () => Promise<void>
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
  const [loading, setLoading] = useState(false)
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



  useEffect(() => {
    let mounted = true

    // 초기 세션 확인 (1회만)
    const initializeOnce = async () => {
      try {
        setError(null)

        const { data: { session } } = await supabase.auth.getSession()

        if (mounted) {
          if (session?.user) {
            const userData = await fetchUserData(session.user.id)
            setUser(userData)
          } else {
            setUser(null)
          }
          setInitialized(true)
        }
      } catch (error) {
        if (mounted) {
          console.warn('초기 인증 확인 중 오류:', error)
          setUser(null)
          setInitialized(true)
        }
      }
    }

    initializeOnce()

    return () => {
      mounted = false
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

  // 로그인 성공 후 사용자 상태 업데이트
  const updateUserAfterLogin = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.user) {
        const userData = await fetchUserData(session.user.id)
        setUser(userData)
        setError(null)
      }
    } catch (error) {
      console.warn('로그인 후 사용자 정보 업데이트 실패:', error)
    }
  }

  const value = {
    user,
    loading,
    error,
    initialized,
    signOut,
    retry,
    softRetry,
    updateUserAfterLogin,
    isAuthenticated: !!user && !loading && !error
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}