'use client'

import { createSupabaseClient } from '@/lib/supabase'
import { User } from '@/types/database'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createSupabaseClient()
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (userData) {
          setUser(userData)
        }
      }

      setLoading(false)
    }

    getUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (userData) {
          setUser(userData)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }

      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const signOut = async () => {
    try {
      console.log('로그아웃 시작')
      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error('로그아웃 에러:', error)
        throw error
      }

      console.log('로그아웃 성공')
      setUser(null) // 상태 즉시 클리어
      toast.success('로그아웃되었습니다.')

      // 로그아웃 후 인증 페이지로 리디렉션
      router.push('/auth')

      // 페이지 강제 새로고침 (캐시 문제 방지)
      setTimeout(() => {
        window.location.href = '/auth'
      }, 100)

    } catch (error) {
      console.error('로그아웃 중 오류가 발생했습니다:', error)
      toast.error('로그아웃 중 오류가 발생했습니다.')

      // 에러가 발생해도 강제로 인증 페이지로 이동
      setUser(null)
      router.push('/auth')
    }
  }

  return { user, loading, signOut }
}