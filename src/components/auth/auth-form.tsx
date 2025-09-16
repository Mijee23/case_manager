'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { studentMasterManager } from '@/utils/studentMasterManager'
// import { invalidateStudentsCache } from '@/hooks/useStudents' // 제거됨

export function AuthForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('signin')
  const [successMessage, setSuccessMessage] = useState('')
  const router = useRouter()
  const supabase = createSupabaseClient()

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccessMessage('')

    const formData = new FormData(event.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    console.log('로그인 시도:', { email })

    try {
      // 미리 정의된 관리자/전공의 계정 확인
      if (email === 'admin@admin.com' && password === '123456') {
        // 관리자 계정 처리
        await handlePredefinedAccount(email, '관리자', '관리자', '99')
        return
      } else if (email === 'doctor@doctor.com' && password === '123456') {
        // 전공의 계정 처리
        await handlePredefinedAccount(email, '전공의', '전공의', '98')
        return
      }

      // 일반 학생 계정 로그인
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      console.log('로그인 응답:', { data, error })

      if (error) {
        console.error('로그인 에러:', error)

        // 더 사용자 친화적인 에러 메시지
        const userFriendlyMessage = error.message.includes('Invalid login credentials')
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : error.message.includes('Email not confirmed')
          ? '이메일 확인이 필요합니다. 이메일을 확인해주세요.'
          : error.message.includes('signups not allowed')
          ? '회원가입이 허용되지 않습니다.'
          : error.message

        setError(userFriendlyMessage)
        return
      }

      console.log('로그인 성공, 대시보드로 이동')
      router.push('/dashboard')
    } catch (error) {
      console.error('로그인 예외:', error)
      setError('로그인 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePredefinedAccount = async (email: string, role: string, name: string, number: string) => {
    try {
      console.log(`${role} 로그인 시도:`, email)

      // 먼저 로그인 시도
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: '123456',
      })

      if (data.user && !error) {
        // 로그인 성공 - users 테이블에 정보가 있는지 확인하고 없으면 추가
        const { data: existingUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single()

        if (!existingUser) {
          console.log(`${role} users 테이블에 정보 추가`)
          // API를 통해 사용자 정보 삽입 (Service role 사용)
          try {
            const response = await fetch('/api/auth/predefined-account', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email: data.user.email!,
                role,
                name,
                number,
                userId: data.user.id,
              }),
            })

            if (!response.ok) {
              const errorData = await response.json()
              console.error('API를 통한 사용자 정보 삽입 실패:', errorData)
            } else {
              const result = await response.json()
              console.log('API를 통한 사용자 정보 삽입 성공:', result.message)
            }
          } catch (apiError) {
            console.error('API 호출 실패:', apiError)
          }
        }

        console.log(`${role} 로그인 성공, 대시보드로 이동`)
        
        // 캐시 무효화 (기존 계정 로그인이지만 혹시 모를 상황 대비)
        // invalidateStudentsCache() // 제거됨
        
        router.push('/dashboard')
        return
      }

      // 로그인 실패 - 계정이 없는 경우이므로 생성
      if (error && error.message.includes('Invalid login credentials')) {
        console.log(`${role} 계정이 없으므로 생성 중:`, email)
        
        // auth에 사용자 생성
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password: '123456',
          options: {
            data: {
              number,
              name,
              role,
            },
          },
        })

        if (authError) {
          // "User already registered" 에러인 경우 이미 존재하므로 다시 로그인 시도
          if (authError.message.includes('User already registered')) {
            console.log(`${role} 계정이 이미 존재하므로 다시 로그인 시도`)
            const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
              email,
              password: '123456',
            })

            if (retryError) {
              console.error(`${role} 재로그인 실패:`, retryError)
              setError(`${role} 로그인에 실패했습니다.`)
              return
            }

            console.log(`${role} 재로그인 성공, 대시보드로 이동`)
            router.push('/dashboard')
            return
          }

          console.error('Auth 사용자 생성 실패:', authError)
          throw authError
        }

        if (authData.user) {
          // API를 통해 사용자 정보 삽입 (Service role 사용)
          try {
            const response = await fetch('/api/auth/predefined-account', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                email: authData.user.email!,
                role,
                name,
                number,
                userId: authData.user.id,
              }),
            })

            if (!response.ok) {
              const errorData = await response.json()
              console.error('API를 통한 사용자 정보 삽입 실패 (계정 생성 후):', errorData)
            } else {
              const result = await response.json()
              console.log('API를 통한 사용자 정보 삽입 성공 (계정 생성 후):', result.message)
            }
          } catch (apiError) {
            console.error('API 호출 실패 (계정 생성 후):', apiError)
          }

          // 계정 생성 후 바로 로그인
          const { error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password: '123456',
          })

          if (loginError) {
            console.error(`${role} 생성 후 로그인 실패:`, loginError)
            setError(`${role} 로그인에 실패했습니다.`)
            return
          }

          console.log(`${role} 계정 생성 및 로그인 성공, 대시보드로 이동`)
          
          // 학생이 아닌 경우에도 캐시 무효화 (관리자/전공의 추가로 인한 ID 변경 가능성)
          // invalidateStudentsCache() // 제거됨
          
          router.push('/dashboard')
          return
        }
      }

      // 다른 에러의 경우
      console.error(`${role} 로그인 실패:`, error)
      setError(`${role} 로그인에 실패했습니다.`)
      
    } catch (error) {
      console.error(`${role} 계정 처리 실패:`, error)
      setError(`${role} 계정 처리 중 오류가 발생했습니다.`)
    }
  }

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setError('')
    setSuccessMessage('')

    const formData = new FormData(event.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const number = formData.get('number') as string
    const name = formData.get('name') as string
    const role = '학생' // 항상 학생으로 설정

    console.log('학생 회원가입 시도:', { email, number, name, role })

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            number,
            name,
            role,
          },
        },
      })

      console.log('Supabase 응답:', { data, error })

      if (error) {
        console.error('회원가입 에러:', error)
        // 더 사용자 친화적인 에러 메시지 제공
        const userFriendlyMessage = error.message.includes('User already registered')
          ? '이미 등록된 이메일입니다.'
          : error.message.includes('Password should be at least')
          ? '비밀번호는 최소 6자 이상이어야 합니다.'
          : error.message.includes('Invalid email')
          ? '유효하지 않은 이메일 형식입니다.'
          : error.message.includes('Database error saving new user')
          ? '데이터베이스 오류가 발생했습니다. 관리자에게 문의하세요.'
          : error.message

        setError(userFriendlyMessage)
        return
      }

      console.log('회원가입 성공')

      // 트리거가 실행되지 않는 경우를 대비한 백업 로직
      if (data.user) {
        try {
          const { error: insertError } = await supabase
            .from('users')
            .upsert({
              id: data.user.id,
              email: data.user.email!,
              number,
              name,
              role,
            })
          
          if (insertError) {
            console.log('사용자 정보 수동 삽입 실패 (트리거가 처리했을 수 있음):', insertError)
          } else {
            console.log('사용자 정보 수동 삽입 성공')
          }
        } catch (insertError) {
          console.log('사용자 정보 삽입 시도 중 오류 (정상적일 수 있음):', insertError)
        }
      }

      // 새 학생이 추가되었으므로 student_master 업데이트
      try {
        await studentMasterManager.updateStudentRegistration(formData.number, authData.user.id)
        console.log('Student master updated for:', formData.number)
      } catch (masterError) {
        console.error('Failed to update student master:', masterError)
      }

      // 회원가입 성공 시 로그인 탭으로 이동하도록 안내
      setSuccessMessage('회원가입이 완료되었습니다! 로그인 탭에서 로그인해주세요.')
      setActiveTab('signin')

      // 폼 초기화
      const form = event.currentTarget
      if (form) {
        form.reset()
      }
    } catch (error) {
      console.error('예외 발생:', error)
      setError('회원가입 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">치과 케이스 관리</CardTitle>
          <CardDescription>계정에 로그인하거나 새 계정을 만드세요</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">로그인</TabsTrigger>
              <TabsTrigger value="signup">회원가입</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              {successMessage && (
                <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md text-sm">
                  {successMessage}
                </div>
              )}
              <div className="mb-4 p-3 bg-gray-50 rounded-md text-sm">
                <p className="font-medium mb-2">미리 정의된 계정:</p>
                <p><strong>관리자:</strong> admin@admin.com / 123456</p>
                <p><strong>전공의:</strong> doctor@doctor.com / 123456</p>
              </div>
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">비밀번호</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                  />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? '로그인 중...' : '로그인'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-md text-sm">
                  학생만 회원가입이 가능합니다. 관리자와 전공의는 별도 계정으로 로그인하세요.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">이메일</Label>
                  <Input
                    id="signup-email"
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="number">학번</Label>
                  <Input
                    id="number"
                    name="number"
                    type="text"
                    placeholder="학번을 입력하세요"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">이름</Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="이름을 입력하세요"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">비밀번호</Label>
                  <Input
                    id="signup-password"
                    name="password"
                    type="password"
                    required
                  />
                </div>
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? '학생 가입 중...' : '학생 회원가입'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}