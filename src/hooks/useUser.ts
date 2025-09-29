'use client'

import { createSupabaseClient } from '@/lib/supabase'
import { User } from '@/types/database'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const supabase = createSupabaseClient()
  const router = useRouter()

  useEffect(() => {
    if (initialized) return // 이미 초기화된 경우 재실행 방지

    const getUser = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user) {
          // 세션이 있으면 사용자 데이터 조회
          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (error) {
            console.warn('사용자 데이터 조회 실패:', error)
            setUser(null)
          } else if (userData) {
            setUser(userData)
          }
        } else {
          setUser(null)
        }
      } catch (error) {
        console.warn('인증 확인 중 오류:', error)
        setUser(null)
      } finally {
        setLoading(false)
        setInitialized(true)
      }
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('인증 상태 변경:', event, session?.user?.id)

      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (error) {
            console.warn('로그인 후 사용자 데이터 조회 실패:', error)
            setUser(null)
          } else if (userData) {
            setUser(userData)
          }
        } catch (error) {
          console.warn('로그인 처리 중 오류:', error)
          setUser(null)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }

      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, initialized])

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

  return { user, loading, signOut }
}