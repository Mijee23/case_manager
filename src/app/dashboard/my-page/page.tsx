'use client'

import { useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'

export default function MyPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    number: '',
    name: '',
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const supabase = createSupabaseClient()

  const handleUpdateProfile = async (e: React.FormEvent, user: any) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const { error } = await supabase
        .from('users')
        .update({
          number: formData.number,
          name: formData.name,
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success('프로필이 성공적으로 업데이트되었습니다.')
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('프로필 업데이트 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('새 비밀번호가 일치하지 않습니다.')
      return
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('비밀번호는 최소 6자 이상이어야 합니다.')
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      })

      if (error) throw error

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })

      toast.success('비밀번호가 성공적으로 변경되었습니다.')
    } catch (error) {
      console.error('Error updating password:', error)
      toast.error('비밀번호 변경 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthGuard>
      {(user: any) => {
        // useEffect를 여기서 호출
        if (formData.number === '' && formData.name === '') {
          setFormData({
            number: user.number,
            name: user.name,
          })
        }

        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold">My Page</h1>
              <p className="text-muted-foreground mt-2">
                개인정보를 확인하고 수정할 수 있습니다.
              </p>
            </div>

            <div className="grid gap-6 lg:gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg md:text-xl">기본 정보</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:gap-6">
                    <div className="grid gap-2">
                      <Label>이메일</Label>
                      <Input value={user.email} disabled />
                      <p className="text-sm text-muted-foreground">
                        이메일은 변경할 수 없습니다.
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label>역할</Label>
                      <Input value={user.role} disabled />
                      <p className="text-sm text-muted-foreground">
                        역할은 관리자만 변경할 수 있습니다.
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label>가입일</Label>
                      <Input value={new Date(user.created_at).toLocaleDateString('ko-KR')} disabled />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg md:text-xl">수정 가능한 정보</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={(e) => handleUpdateProfile(e, user)} className="space-y-4 md:space-y-6">
                    <div className="grid gap-2">
                      <Label htmlFor="number">번호</Label>
                      <Input
                        id="number"
                        value={formData.number}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, number: e.target.value }))
                        }
                        placeholder="학번 또는 번호"
                        required
                        className="text-base"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="name">이름</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData(prev => ({ ...prev, name: e.target.value }))
                        }
                        placeholder="이름"
                        required
                        className="text-base"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-full md:w-auto"
                      size="lg"
                    >
                      {isLoading ? '업데이트 중...' : '프로필 업데이트'}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg md:text-xl">비밀번호 변경</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordChange} className="space-y-4 md:space-y-6">
                    <div className="grid gap-2">
                      <Label htmlFor="newPassword">새 비밀번호</Label>
                      <Input
                        id="newPassword"
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) =>
                          setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))
                        }
                        placeholder="새 비밀번호 (최소 6자)"
                        required
                        className="text-base"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) =>
                          setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))
                        }
                        placeholder="새 비밀번호 확인"
                        required
                        className="text-base"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={isLoading}
                      variant="outline"
                      className="w-full md:w-auto"
                      size="lg"
                    >
                      {isLoading ? '변경 중...' : '비밀번호 변경'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        )
      }}
    </AuthGuard>
  )
}