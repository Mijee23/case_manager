'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'
import StudentSelectorNew from '@/components/StudentSelectorNew'
import { CaseWithUser } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export default function DashboardPage() {
  const { user } = useUser()
  const router = useRouter()
  const [cases, setCases] = useState<CaseWithUser[]>([])
  const [filteredCases, setFilteredCases] = useState<CaseWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    category: 'all',
    resident: 'all',
    month: 'all',
  })
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingCase, setEditingCase] = useState<CaseWithUser | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [editFormData, setEditFormData] = useState({
    datetime: '',
    category: '',
    assigned_resident: '',
    patient_number: '',
    patient_name: '',
    assigned_student1: 'none',
    assigned_student2: 'none',
    case_status: '',
    acquisition_method: '',
    treatment_details: '',
    note: '',
  })

  const supabase = createSupabaseClient()

  // 역할별 리다이렉트
  useEffect(() => {
    if (user?.role === '관리자') {
      router.replace('/dashboard/admin/cases')
      return
    }
    if (user?.role === '전공의') {
      router.replace('/dashboard/doctor-cases')
      return
    }
  }, [user, router])

  useEffect(() => {
    if (user && user.role !== '관리자' && user.role !== '전공의') {
      fetchCases()
    }
  }, [user])

  useEffect(() => {
    applyFilters()
  }, [cases, filters])

  // 실시간 업데이트 구독
  useEffect(() => {
    const channel = supabase
      .channel('cases')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cases',
        },
        (payload: any) => {
          console.log('Real-time update received:', payload)
          console.log('Event type:', payload.eventType)
          console.log('Table:', payload.table)
          console.log('New record:', payload.new)
          console.log('Old record:', payload.old)
          fetchCases() // 변경사항이 있을 때 데이터 새로고침
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  const fetchCases = async () => {
    try {
      console.log('fetchCases 시작')
      
      // 먼저 케이스 데이터만 가져오기
      let query = supabase
        .from('cases')
        .select('*')
        .order('datetime', { ascending: false })

      if (user?.role === '전공의') {
        query = query.eq('assigned_resident', user.name)
      }

      const { data: casesData, error } = await query

      if (error) {
        console.error('케이스 데이터 조회 오류:', error)
        console.error('오류 코드:', error.code)
        console.error('오류 메시지:', error.message)
        console.error('오류 세부사항:', error.details)
        throw error
      }

      console.log('케이스 데이터 가져오기 완료, 개수:', casesData?.length)

      // 학생 정보를 별도로 조회
      const studentIds = new Set<string>()
      casesData?.forEach((case_: any) => {
        if (case_.assigned_student1) studentIds.add(case_.assigned_student1)
        if (case_.assigned_student2) studentIds.add(case_.assigned_student2)
      })

      console.log('조회할 학생 ID들:', Array.from(studentIds))

      let studentsData: any[] = []
      if (studentIds.size > 0) {
        const { data: students, error: studentsError } = await supabase
          .from('users')
          .select('id, name, number')
          .in('id', Array.from(studentIds))

        if (studentsError) {
          console.error('학생 정보 조회 오류:', studentsError)
          console.error('학생 조회 오류 코드:', studentsError.code)
          console.error('학생 조회 오류 메시지:', studentsError.message)
          console.error('학생 조회 오류 세부사항:', studentsError.details)
        } else {
          studentsData = students || []
          console.log('학생 정보 조회 완료:', studentsData)
        }
      }

      // 케이스 데이터와 학생 정보를 결합
      const casesWithStudents = casesData?.map((case_: any) => ({
        ...case_,
        student1: studentsData.find(s => s.id === case_.assigned_student1) || null,
        student2: studentsData.find(s => s.id === case_.assigned_student2) || null
      })) || []

      console.log('첫 번째 케이스의 학생 정보:', casesWithStudents[0] ? {
        student1: casesWithStudents[0].student1,
        student2: casesWithStudents[0].student2,
        assigned_student1: casesWithStudents[0].assigned_student1,
        assigned_student2: casesWithStudents[0].assigned_student2
      } : '데이터 없음')

      setCases(casesWithStudents)
    } catch (error) {
      console.error('Error fetching cases:', error)
      console.error('Error type:', typeof error)
      console.error('Error stringified:', JSON.stringify(error, null, 2))
      if (error instanceof Error) {
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
      }
    } finally {
      setLoading(false)
    }
  }


  const applyFilters = () => {
    let filtered = [...cases]

    if (filters.category !== 'all') {
      filtered = filtered.filter(case_ => case_.category === filters.category)
    }

    if (filters.resident !== 'all') {
      filtered = filtered.filter(case_ => case_.assigned_resident === filters.resident)
    }

    if (filters.month !== 'all') {
      const targetMonth = parseInt(filters.month)
      filtered = filtered.filter(case_ => {
        const caseMonth = new Date(case_.datetime).getMonth() + 1
        return caseMonth === targetMonth
      })
    }

    setFilteredCases(filtered)
  }

  const getUniqueResidents = () => {
    return [...new Set(cases.map(case_ => case_.assigned_resident))].sort()
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case '완료': return 'default'
      case '실패': return 'destructive'
      case '진행중': return 'secondary'
      default: return 'outline'
    }
  }

  const handleCaseDoubleClick = (case_: CaseWithUser) => {
    if (user?.role !== '관리자') return
    
    setEditingCase(case_)
    setEditFormData({
      datetime: format(new Date(case_.datetime), "yyyy-MM-dd'T'HH:mm"),
      category: case_.category,
      assigned_resident: case_.assigned_resident,
      patient_number: case_.patient_number,
      patient_name: case_.patient_name,
      assigned_student1: case_.assigned_student1 || 'none',
      assigned_student2: case_.assigned_student2 || 'none',
      case_status: case_.case_status,
      acquisition_method: case_.acquisition_method,
      treatment_details: case_.treatment_details || '',
      note: case_.note || '',
    })
    setIsEditDialogOpen(true)
  }

  const handleUpdateCase = async () => {
    if (!editingCase || !user) return

    setIsUpdating(true)

    try {
      console.log('케이스 수정 시작')
      
      // 네트워크 상태 확인
      if (!navigator.onLine) {
        throw new Error('인터넷 연결을 확인해주세요.')
      }
      console.log('네트워크 연결 상태 확인 완료')
      
      // 기존 change_log 가져오기
      const existingChangelog = Array.isArray(editingCase.change_log)
        ? editingCase.change_log
        : []

      const updateData = {
        datetime: new Date(editFormData.datetime).toISOString(),
        category: editFormData.category as '가철' | '고정' | '임플' | '임수',
        assigned_resident: editFormData.assigned_resident,
        patient_number: editFormData.patient_number,
        patient_name: editFormData.patient_name,
        assigned_student1: editFormData.assigned_student1 === 'none' ? null : (editFormData.assigned_student1 || null),
        assigned_student2: editFormData.assigned_student2 === 'none' ? null : (editFormData.assigned_student2 || null),
        case_status: editFormData.case_status as '완료' | '실패' | '진행중',
        acquisition_method: editFormData.acquisition_method as '장부' | '배정',
        treatment_details: editFormData.treatment_details || null,
        note: editFormData.note || null,
        change_log: [
          ...(Array.isArray(editingCase.change_log) ? editingCase.change_log : []),
          {
            timestamp: new Date().toISOString(),
            user_id: user.id,
            user_name: user.name,
            action: 'case_updated_by_admin',
            changes: {
              datetime: editFormData.datetime !== format(new Date(editingCase.datetime), "yyyy-MM-dd'T'HH:mm"),
              category: editFormData.category !== editingCase.category,
              assigned_resident: editFormData.assigned_resident !== editingCase.assigned_resident,
              assigned_student1: (editFormData.assigned_student1 === 'none' ? null : editFormData.assigned_student1) !== editingCase.assigned_student1,
              assigned_student2: (editFormData.assigned_student2 === 'none' ? null : editFormData.assigned_student2) !== editingCase.assigned_student2,
              case_status: editFormData.case_status !== editingCase.case_status,
            }
          }
        ]
      }

      console.log('케이스 업데이트 시작:', editingCase.id)
      console.log('업데이트 데이터:', updateData)

      // Supabase 연결 상태 확인
      try {
        const { data: connectionTest } = await supabase
          .from('cases')
          .select('id')
          .limit(1)
        console.log('Supabase 연결 상태 확인 완료')
      } catch (connectionError) {
        console.error('Supabase 연결 오류:', connectionError)
        throw new Error('데이터베이스 연결에 문제가 있습니다.')
      }

      // 타임아웃과 함께 Supabase 업데이트 실행
      const updatePromise = supabase
        .from('cases')
        .update(updateData)
        .eq('id', editingCase.id)

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('케이스 업데이트 타임아웃 (30초)')), 30000)
      )

      const { error } = await Promise.race([updatePromise, timeoutPromise]) as any

      if (error) {
        console.error('Supabase update error:', error)
        console.error('Error code:', error.code)
        console.error('Error message:', error.message)
        console.error('Error details:', error.details)
        throw error
      }

      console.log('케이스 업데이트 완료')

      // 환자 정보도 업데이트
      console.log('환자 정보 업데이트 시작')
      const { error: patientError } = await supabase
        .from('patients')
        .upsert({
          patient_number: editFormData.patient_number,
          patient_name: editFormData.patient_name,
        })

      if (patientError) {
        console.error('Patient update error:', patientError)
        throw patientError
      }

      console.log('환자 정보 업데이트 완료')

      toast.success('케이스가 성공적으로 수정되었습니다.')
      setIsEditDialogOpen(false)
      setEditingCase(null)
      await fetchCases()
    } catch (error) {
      console.error('Error updating case:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      toast.error(`케이스 수정 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    } finally {
      console.log('케이스 수정 프로세스 종료')
      setIsUpdating(false)
    }
  }

  const handleFormChange = (field: string, value: string) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // 관리자 또는 전공의인 경우 리다이렉트 중
  if (user?.role === '관리자' || user?.role === '전공의') {
    return <div>리다이렉트 중...</div>
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
              </div>
              <Skeleton className="h-96 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          {user?.role === '전공의' ? '내 담당 케이스' : '전체 케이스'}
        </h1>
        <p className="text-muted-foreground mt-2">
          {user?.role === '전공의'
            ? '본인이 담당하는 케이스 목록입니다.'
            : user?.role === '관리자'
            ? '모든 케이스를 확인하고 관리할 수 있습니다. 케이스를 더블 클릭하면 수정할 수 있습니다.'
            : '모든 케이스를 확인할 수 있습니다.'
          }
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>케이스 목록</CardTitle>
          <div className="flex flex-wrap gap-4 mt-4">
            <Select value={filters.category} onValueChange={(value) =>
              setFilters(prev => ({ ...prev, category: value }))
            }>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="분류" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 분류</SelectItem>
                <SelectItem value="가철">가철</SelectItem>
                <SelectItem value="고정">고정</SelectItem>
                <SelectItem value="임플">임플</SelectItem>
                <SelectItem value="임수">임수</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.resident} onValueChange={(value) =>
              setFilters(prev => ({ ...prev, resident: value }))
            }>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="담당 전공의" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 전공의</SelectItem>
                {getUniqueResidents().map(resident => (
                  <SelectItem key={resident} value={resident}>{resident}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.month} onValueChange={(value) =>
              setFilters(prev => ({ ...prev, month: value }))
            }>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="월" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <SelectItem key={month} value={month.toString()}>{month}월</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>일시</TableHead>
                  <TableHead>분류</TableHead>
                  <TableHead>담당 전공의</TableHead>
                  <TableHead>환자번호</TableHead>
                  <TableHead>환자명</TableHead>
                  <TableHead>배정 학생 1</TableHead>
                  <TableHead>배정 학생 2</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>획득경로</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      조건에 맞는 케이스가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCases.map((case_) => (
                    <TableRow 
                      key={case_.id}
                      onDoubleClick={() => handleCaseDoubleClick(case_)}
                      className={user?.role === '관리자' ? 'cursor-pointer hover:bg-muted/50' : ''}
                    >
                      <TableCell>
                        {format(new Date(case_.datetime), 'MM/dd HH:mm', { locale: ko })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{case_.category}</Badge>
                      </TableCell>
                      <TableCell>{case_.assigned_resident}</TableCell>
                      <TableCell>{case_.patient_number}</TableCell>
                      <TableCell>{case_.patient_name}</TableCell>
                      <TableCell>
                        {case_.student1 ? (
                          <div className="text-sm">{case_.student1.name}</div>
                        ) : (
                          <div className="text-sm text-muted-foreground">미배정</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {case_.student2 ? (
                          <div className="text-sm">{case_.student2.name}</div>
                        ) : (
                          <div className="text-sm text-muted-foreground">미배정</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(case_.case_status)}>
                          {case_.case_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{case_.acquisition_method}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 케이스 수정 다이얼로그 */}
      <Dialog 
        open={isEditDialogOpen} 
        onOpenChange={(open) => {
          console.log('다이얼로그 상태 변경:', open)
          setIsEditDialogOpen(open)
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>케이스 수정</DialogTitle>
            <DialogDescription>
              케이스 정보를 수정할 수 있습니다. 모든 변경사항은 즉시 저장됩니다.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-datetime">일시</Label>
              <Input
                id="edit-datetime"
                type="datetime-local"
                value={editFormData.datetime}
                onChange={(e) => handleFormChange('datetime', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-category">분류</Label>
              <Select
                value={editFormData.category}
                onValueChange={(value) => handleFormChange('category', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="가철">가철</SelectItem>
                  <SelectItem value="고정">고정</SelectItem>
                  <SelectItem value="임플">임플</SelectItem>
                  <SelectItem value="임수">임수</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-resident">담당 전공의</Label>
              <Input
                id="edit-resident"
                value={editFormData.assigned_resident}
                onChange={(e) => handleFormChange('assigned_resident', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-patient-number">환자번호</Label>
              <Input
                id="edit-patient-number"
                value={editFormData.patient_number}
                onChange={(e) => handleFormChange('patient_number', e.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-patient-name">환자명</Label>
              <Input
                id="edit-patient-name"
                value={editFormData.patient_name}
                onChange={(e) => handleFormChange('patient_name', e.target.value)}
              />
            </div>

            <StudentSelectorNew
              label="배정 학생 1"
              value={editFormData.assigned_student1}
              onValueChange={(value) => handleFormChange('assigned_student1', value)}
              placeholder="학생을 선택하세요"
              allowNone={true}
              noneLabel="선택 안함"
            />

            <StudentSelectorNew
              label="배정 학생 2"
              value={editFormData.assigned_student2}
              onValueChange={(value) => handleFormChange('assigned_student2', value)}
              placeholder="학생을 선택하세요"
              allowNone={true}
              noneLabel="선택 안함"
            />

            <div className="space-y-2">
              <Label htmlFor="edit-status">케이스 상태</Label>
              <Select
                value={editFormData.case_status}
                onValueChange={(value) => handleFormChange('case_status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="진행중">진행중</SelectItem>
                  <SelectItem value="완료">완료</SelectItem>
                  <SelectItem value="실패">실패</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-acquisition">획득경로</Label>
              <Select
                value={editFormData.acquisition_method}
                onValueChange={(value) => handleFormChange('acquisition_method', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="장부">장부</SelectItem>
                  <SelectItem value="배정">배정</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-treatment">진료내역</Label>
              <Textarea
                id="edit-treatment"
                value={editFormData.treatment_details}
                onChange={(e) => handleFormChange('treatment_details', e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="edit-note">Note</Label>
              <Textarea
                id="edit-note"
                value={editFormData.note}
                onChange={(e) => handleFormChange('note', e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isUpdating}
            >
              취소
            </Button>
            <Button
              onClick={handleUpdateCase}
              disabled={isUpdating}
            >
              {isUpdating ? '수정 중...' : '수정 완료'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}