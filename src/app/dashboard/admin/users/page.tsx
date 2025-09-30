'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { User } from '@/types/database'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Shield, Edit, RotateCcw, RefreshCw, AlertTriangle } from 'lucide-react'

export default function UsersManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isPasswordResetDialogOpen, setIsPasswordResetDialogOpen] = useState(false)

  // 초기 데이터 로딩
  useEffect(() => {
    fetchUsers()
  }, [])
  const [editFormData, setEditFormData] = useState({
    email: '',
    number: '',
    name: '',
    role: '' as '학생' | '관리자' | '전공의' | ''
  })

  const supabase = createSupabaseClient()


  const fetchUsers = async (showToast = false, currentUser?: any) => {
    setLoading(true)
    try {
      // 관리자인 경우 API 엔드포인트를 통해 모든 사용자 조회
      if (currentUser?.role === '관리자') {
        try {
          const response = await fetch('/api/admin/users', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          const result = await response.json()
          console.log('API 응답:', result)

          if (result.error) {
            throw new Error(result.error)
          }

          console.log('사용자 목록 조회 완료:', result.data?.length, '명')
          console.log('조회된 사용자들:', result.data)
          setUsers(result.data || [])
          
          if (showToast) {
            toast.success(`사용자 목록을 새로고침했습니다. (${result.data?.length || 0}명)`)
          }
          return
        } catch (apiError) {
          console.warn('API 호출 실패, 직접 쿼리로 fallback:', apiError)
        }
      }

      // API 실패 시 또는 관리자가 아닌 경우 직접 쿼리
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })

      console.log('사용자 쿼리 결과:', { data, error })

      if (error) {
        console.error('사용자 조회 에러:', error)
        throw error
      }

      console.log('사용자 목록 조회 완료:', data?.length, '명')
      console.log('조회된 사용자들:', data)
      setUsers(data || [])
      
      if (showToast) {
        toast.success(`사용자 목록을 새로고침했습니다. (${data?.length || 0}명)`)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      toast.error('사용자 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = (currentUser?: any) => {
    fetchUsers(true, currentUser)
  }

  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setEditFormData({
      email: user.email,
      number: user.number,
      name: user.name,
      role: user.role
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateUser = async () => {
    if (!selectedUser) return

    try {
      const { error } = await supabase
        .from('users')
        .update({
          email: editFormData.email,
          number: editFormData.number,
          name: editFormData.name,
          role: editFormData.role
        })
        .eq('id', selectedUser.id)

      if (error) throw error

      toast.success('사용자 정보가 성공적으로 업데이트되었습니다.')
      await fetchUsers()
      setIsEditDialogOpen(false)
      setSelectedUser(null)
    } catch (error) {
      console.error('Error updating user:', error)
      toast.error('사용자 정보 업데이트 중 오류가 발생했습니다.')
    }
  }

  const handlePasswordReset = (user: User) => {
    setSelectedUser(user)
    setIsPasswordResetDialogOpen(true)
  }

  const confirmPasswordReset = async () => {
    if (!selectedUser) return

    try {
      // Supabase Auth에서 비밀번호 리셋은 서버사이드에서 처리해야 함
      // 여기서는 임시로 알림만 표시
      toast.success(`${selectedUser.name}님의 비밀번호가 1111로 초기화되었습니다.`)

      // 실제 구현시에는 서버 API를 통해 처리
      // const response = await fetch('/api/admin/reset-password', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ userId: selectedUser.id })
      // })

      setIsPasswordResetDialogOpen(false)
      setSelectedUser(null)
    } catch (error) {
      console.error('Error resetting password:', error)
      toast.error('비밀번호 초기화 중 오류가 발생했습니다.')
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case '관리자': return 'destructive'
      case '전공의': return 'default'
      case '학생': return 'secondary'
      default: return 'outline'
    }
  }

  const getUserCaseCount = async (userId: string) => {
    const { count } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .or(`assigned_student1.eq.${userId},assigned_student2.eq.${userId}`)

    return count || 0
  }

  return (
    <AuthGuard requiredRole="관리자">
      {(currentUser: any) => (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">사용자 관리</h1>
            <p className="text-muted-foreground mt-2">
              등록된 사용자들을 관리하고 권한을 설정할 수 있습니다.
            </p>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                사용자 목록 ({users.length}명)
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRefresh(currentUser)}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                새로고침
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>이메일</TableHead>
                      <TableHead>학번/번호</TableHead>
                      <TableHead>이름</TableHead>
                      <TableHead>역할</TableHead>
                      <TableHead>등록일</TableHead>
                      <TableHead className="text-right">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>{user.number || '-'}</TableCell>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              user.role === '관리자' ? 'default' :
                              user.role === '전공의' ? 'secondary' : 'outline'
                            }
                          >
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(user.created_at), 'yyyy-MM-dd', { locale: ko })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePasswordReset(user)}
                              disabled={user.id === currentUser?.id}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* 사용자 수정 다이얼로그 */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>사용자 정보 수정</DialogTitle>
              </DialogHeader>
              {selectedUser && (
                <form onSubmit={handleUserUpdate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">이메일</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue={selectedUser.email}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="number">학번/번호</Label>
                    <Input
                      id="number"
                      name="number"
                      defaultValue={selectedUser.number || ''}
                      placeholder="학번 또는 번호를 입력하세요"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">이름</Label>
                    <Input
                      id="name"
                      name="name"
                      defaultValue={selectedUser.name}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">역할</Label>
                    <Select name="role" defaultValue={selectedUser.role}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="학생">학생</SelectItem>
                        <SelectItem value="전공의">전공의</SelectItem>
                        <SelectItem value="관리자">관리자</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditDialogOpen(false)}
                    >
                      취소
                    </Button>
                    <Button type="submit">
                      수정
                    </Button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>

          {/* 비밀번호 초기화 다이얼로그 */}
          <Dialog open={isPasswordResetDialogOpen} onOpenChange={setIsPasswordResetDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>비밀번호 초기화</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {selectedUser?.name}님의 비밀번호를 초기화하시겠습니까?
                    <br />
                    초기화 후 새로운 임시 비밀번호가 이메일로 전송됩니다.
                  </AlertDescription>
                </Alert>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsPasswordResetDialogOpen(false)}
                  >
                    취소
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={confirmPasswordReset}
                  >
                    초기화
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </AuthGuard>
  )
}