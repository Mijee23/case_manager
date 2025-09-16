'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'
import { Case } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { toast } from 'sonner'
import { Edit, Eye, RefreshCw, BarChart3, Target } from 'lucide-react'

export default function MyCasesPage() {
  const { user } = useUser()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [statusUpdate, setStatusUpdate] = useState({
    status: '',
    reason: '',
  })

  const supabase = createSupabaseClient()

  const failureReasons = ['토탈아님', '개인잘못', '레포트반려', '기타']

  useEffect(() => {
    if (user) {
      fetchMyCases()
    }
  }, [user])

  // 실시간 업데이트 구독
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('my-cases')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cases',
          filter: `assigned_student1=eq.${user.id},assigned_student2=eq.${user.id}`,
        },
        (payload: any) => {
          console.log('My cases real-time update:', payload)
          fetchMyCases()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, supabase])

  const fetchMyCases = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('cases')
        .select(`
          *,
          student1:assigned_student1(name, number),
          student2:assigned_student2(name, number)
        `)
        .or(`assigned_student1.eq.${user.id},assigned_student2.eq.${user.id}`)
        .order('datetime', { ascending: false })

      if (error) throw error

      setCases(data || [])
    } catch (error) {
      console.error('Error fetching my cases:', error)
      toast.error('케이스를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async () => {
    if (!selectedCase || !statusUpdate.status) return

    try {
      const updateData: any = {
        case_status: statusUpdate.status,
      }

      const { error } = await supabase
        .from('cases')
        .update(updateData)
        .eq('id', selectedCase.id)

      if (error) throw error

      // change_log 별도 업데이트
      const changelogEntry = {
        timestamp: new Date().toISOString(),
        user_id: user?.id,
        user_name: user?.name,
        action: 'status_change',
        from: selectedCase.case_status,
        to: statusUpdate.status,
        reason: statusUpdate.reason || null,
      }

      const existingChangelog = Array.isArray(selectedCase.change_log) ? selectedCase.change_log : []
      const updatedChangelog = [...existingChangelog, changelogEntry]

      const { error: changelogError } = await supabase
        .from('cases')
        .update({ change_log: updatedChangelog })
        .eq('id', selectedCase.id)

      if (changelogError) {
        console.error('Changelog update error:', changelogError)
      }

      // 케이스 상태 변경 후 데이터 새로고침
      await fetchMyCases()

      toast.success('케이스 상태가 업데이트되었습니다.')
      await fetchMyCases()
      setIsStatusDialogOpen(false)
      setStatusUpdate({ status: '', reason: '' })
      setSelectedCase(null)
    } catch (error) {
      console.error('Error updating case status:', error)
      toast.error('상태 업데이트 중 오류가 발생했습니다.')
    }
  }


  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case '완료': return 'default'
      case '실패': return 'destructive'
      case '진행중': return 'secondary'
      default: return 'outline'
    }
  }

  const getCasesByCategory = (category: string) => {
    return cases.filter(case_ => case_.category === category)
  }

  const categories = ['가철', '고정', '임플', '임수']

  if (loading) {
    return <div>로딩 중...</div>
  }

  const getCategoryProgress = (category: '가철' | '고정' | '임플' | '임수') => {
    const categoryCases = getCasesByCategory(category)
    const completedCases = categoryCases.filter(c => c.case_status === '완료').length
    return categoryCases.length > 0 ? (completedCases / categoryCases.length) * 100 : 0
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">My Cases</h1>
          <p className="text-muted-foreground mt-2">
            내가 배정받은 케이스들을 분류별로 확인하고 상태를 관리할 수 있습니다.
          </p>
        </div>
        <Button onClick={fetchMyCases} disabled={loading} size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 학생 케이스 통계 요약 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            나의 케이스 통계
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {getCasesByCategory('가철').filter(c => c.case_status === '완료').length}/{getCasesByCategory('가철').length}
              </div>
              <div className="text-sm text-muted-foreground">가철</div>
              <Progress value={getCategoryProgress('가철')} className="mt-2 h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {Math.round(getCategoryProgress('가철'))}% 완료
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {getCasesByCategory('고정').filter(c => c.case_status === '완료').length}/{getCasesByCategory('고정').length}
              </div>
              <div className="text-sm text-muted-foreground">고정</div>
              <Progress value={getCategoryProgress('고정')} className="mt-2 h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {Math.round(getCategoryProgress('고정'))}% 완료
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {getCasesByCategory('임플').filter(c => c.case_status === '완료').length}/{getCasesByCategory('임플').length}
              </div>
              <div className="text-sm text-muted-foreground">임플</div>
              <Progress value={getCategoryProgress('임플')} className="mt-2 h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {Math.round(getCategoryProgress('임플'))}% 완료
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {getCasesByCategory('임수').filter(c => c.case_status === '완료').length}/{getCasesByCategory('임수').length}
              </div>
              <div className="text-sm text-muted-foreground">임수</div>
              <Progress value={getCategoryProgress('임수')} className="mt-2 h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {Math.round(getCategoryProgress('임수'))}% 완료
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800">
                {cases.filter(c => c.case_status === '완료').length}/{cases.length}
              </div>
              <div className="text-sm text-muted-foreground">총 케이스</div>
              <Progress
                value={cases.length > 0 ? (cases.filter(c => c.case_status === '완료').length / cases.length) * 100 : 0}
                className="mt-2 h-2"
              />
              <div className="text-xs text-muted-foreground mt-1">
                전체 {Math.round(cases.length > 0 ? (cases.filter(c => c.case_status === '완료').length / cases.length) * 100 : 0)}% 완료
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {categories.map(category => {
          const categoryCases = getCasesByCategory(category)

          return (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span>{category} ({categoryCases.length}개)</span>
                    <div className="flex gap-1">
                      <Badge variant={categoryCases.filter(c => c.case_status === '완료').length > 0 ? 'default' : 'secondary'}>
                        완료 {categoryCases.filter(c => c.case_status === '완료').length}
                      </Badge>
                      <Badge variant={categoryCases.filter(c => c.case_status === '진행중').length > 0 ? 'outline' : 'secondary'}>
                        진행 {categoryCases.filter(c => c.case_status === '진행중').length}
                      </Badge>
                      <Badge variant={categoryCases.filter(c => c.case_status === '실패').length > 0 ? 'destructive' : 'secondary'}>
                        실패 {categoryCases.filter(c => c.case_status === '실패').length}
                      </Badge>
                    </div>
                  </div>
                  <Badge variant="outline">{category}</Badge>
                </CardTitle>
                {categoryCases.length > 0 && (
                  <div className="mt-2">
                    <div className="flex justify-between text-sm text-muted-foreground mb-1">
                      <span>진행률</span>
                      <span>{Math.round(getCategoryProgress(category))}%</span>
                    </div>
                    <Progress value={getCategoryProgress(category)} className="h-2" />
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {categoryCases.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    {category} 케이스가 없습니다.
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>일시</TableHead>
                          <TableHead>담당 전공의</TableHead>
                          <TableHead>환자명</TableHead>
                          <TableHead>배정 학생 1</TableHead>
                          <TableHead>배정 학생 2</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead>획득경로</TableHead>
                          <TableHead>작업</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryCases.map(case_ => (
                          <TableRow key={case_.id}>
                            <TableCell>
                              {format(new Date(case_.datetime), 'MM/dd HH:mm', { locale: ko })}
                            </TableCell>
                            <TableCell>{case_.assigned_resident}</TableCell>
                            <TableCell>{case_.patient_name}</TableCell>
                            <TableCell>
                              {(case_ as any).student1 ? 
                                `${(case_ as any).student1.name} (${(case_ as any).student1.number})` : 
                                '-'
                              }
                            </TableCell>
                            <TableCell>
                              {(case_ as any).student2 ? 
                                `${(case_ as any).student2.name} (${(case_ as any).student2.number})` : 
                                '-'
                              }
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusBadgeVariant(case_.case_status)}>
                                {case_.case_status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{case_.acquisition_method}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedCase(case_)
                                    setIsViewDialogOpen(true)
                                  }}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedCase(case_)
                                    setStatusUpdate({ status: case_.case_status, reason: '' })
                                    setIsStatusDialogOpen(true)
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 케이스 상세보기 다이얼로그 */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>케이스 상세정보</DialogTitle>
          </DialogHeader>
          {selectedCase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>일시</Label>
                  <p className="text-sm">{format(new Date(selectedCase.datetime), 'yyyy-MM-dd HH:mm', { locale: ko })}</p>
                </div>
                <div>
                  <Label>분류</Label>
                  <p className="text-sm">{selectedCase.category}</p>
                </div>
                <div>
                  <Label>담당 전공의</Label>
                  <p className="text-sm">{selectedCase.assigned_resident}</p>
                </div>
                <div>
                  <Label>환자번호</Label>
                  <p className="text-sm">{selectedCase.patient_number}</p>
                </div>
                <div>
                  <Label>환자명</Label>
                  <p className="text-sm">{selectedCase.patient_name}</p>
                </div>
                <div>
                  <Label>상태</Label>
                  <Badge variant={getStatusBadgeVariant(selectedCase.case_status)}>
                    {selectedCase.case_status}
                  </Badge>
                </div>
              </div>

              {selectedCase.treatment_details && (
                <div>
                  <Label>진료내역</Label>
                  <p className="text-sm mt-1">{selectedCase.treatment_details}</p>
                </div>
              )}

              {selectedCase.note && (
                <div>
                  <Label>Note</Label>
                  <p className="text-sm mt-1">{selectedCase.note}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 상태 업데이트 다이얼로그 */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>케이스 상태 변경</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="status">상태</Label>
              <Select
                value={statusUpdate.status}
                onValueChange={(value) => setStatusUpdate(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="상태를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="진행중">진행중</SelectItem>
                  <SelectItem value="완료">완료</SelectItem>
                  <SelectItem value="실패">실패</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {statusUpdate.status === '실패' && (
              <div>
                <Label htmlFor="reason">실패 사유</Label>
                <Select
                  value={statusUpdate.reason}
                  onValueChange={(value) => setStatusUpdate(prev => ({ ...prev, reason: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="실패 사유를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {failureReasons.map(reason => (
                      <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsStatusDialogOpen(false)}
              >
                취소
              </Button>
              <Button onClick={handleStatusUpdate}>
                업데이트
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}