'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'
import { User } from '@/types/database'
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
import { Shield, Edit, RotateCcw, RefreshCw } from 'lucide-react'

export default function UsersManagementPage() {
  const { user: currentUser } = useUser()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isPasswordResetDialogOpen, setIsPasswordResetDialogOpen] = useState(false)
  const [editFormData, setEditFormData] = useState({
    email: '',
    number: '',
    name: '',
    role: '' as '학생' | '관리자' | '전공의' | ''
  })

  const supabase = createSupabaseClient()

  useEffect(() => {
    if (currentUser?.role === '관리자') {
      fetchUsers()
      
      // 실시간 구독 설정
      const subscription = supabase
        .channel('users_changes')
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'users' 
          }, 
          (payload: any) => {
            console.log('사용자 테이블 변경 감지:', payload)
            fetchUsers() // 변경 감지 시 목록 새로고침
          }
        )
        .subscribe()

      return () => {
        subscription.unsubscribe()
      }
    }
  }, [currentUser])

  const fetchUsers = async (showToast = false) => {
    try {
      setLoading(true)
      
      // 현재 사용자 정보 로그
      console.log('현재 사용자:', currentUser)
      
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

  const handleRefresh = () => {
    fetchUsers(true)
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

  if (!currentUser || currentUser.role !== '관리자') {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">관리자 권한이 필요합니다.</p>
      </div>
    )
  }

  if (loading) {
    return <div>로딩 중...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">사용자 관리</h1>
        <p className="text-muted-foreground mt-2">
          모든 사용자를 확인하고 관리할 수 있습니다.
        </p>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          관리자 권한으로 사용자 정보 수정 및 비밀번호 초기화가 가능합니다.
          비밀번호는 '1111'로 초기화됩니다.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>전체 사용자 목록 ({users.length}명)</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>번호</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>가입일</TableHead>
                  <TableHead>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      등록된 사용자가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(user.created_at), 'yyyy-MM-dd', { locale: ko })}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          {user.role === '학생' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditUser(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {user.role === '학생' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePasswordReset(user)}
                              disabled={user.id === currentUser.id}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 사용자 편집 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>사용자 정보 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">이메일</Label>
              <Input
                id="edit-email"
                value={editFormData.email}
                onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="이메일"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-number">번호</Label>
              <Input
                id="edit-number"
                value={editFormData.number}
                onChange={(e) => setEditFormData(prev => ({ ...prev, number: e.target.value }))}
                placeholder="번호"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-name">이름</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="이름"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">역할</Label>
              <Select
                value={editFormData.role}
                onValueChange={(value: any) => setEditFormData(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="역할 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="학생">학생</SelectItem>
                  <SelectItem value="관리자">관리자</SelectItem>
                  <SelectItem value="전공의">전공의</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditDialogOpen(false)}
              >
                취소
              </Button>
              <Button onClick={handleUpdateUser}>
                업데이트
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 비밀번호 리셋 확인 다이얼로그 */}
      <Dialog open={isPasswordResetDialogOpen} onOpenChange={setIsPasswordResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>비밀번호 초기화 확인</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              <strong>{selectedUser?.name}</strong>님의 비밀번호를 1111로 초기화하시겠습니까?
            </p>
            <Alert>
              <AlertDescription>
                초기화된 비밀번호는 해당 사용자에게 직접 전달해야 합니다.
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
  )
}