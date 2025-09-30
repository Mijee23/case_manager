'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Search, Edit, Eye } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface Case {
  id: string
  datetime: string
  category: string
  assigned_resident: string
  patient_number: string
  patient_name: string
  assigned_student1: string
  assigned_student2?: string
  case_status: string
  acquisition_method: string
  treatment_details?: string
  note?: string
  created_at: string
}

interface User {
  id: string
  name: string
  number: string
}

export default function AdminCasesPage() {
  const [cases, setCases] = useState<Case[]>([])
  const [students, setStudents] = useState<User[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [editingCase, setEditingCase] = useState<Case | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const supabase = createSupabaseClient()

  // 데이터 로딩을 컴포넌트 레벨에서 처리
  useEffect(() => {
    Promise.all([fetchCases(true), fetchStudents()])
  }, [])


  const fetchCases = async (keepLoadingState = false) => {
    try {

      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .order('datetime', { ascending: false })

      if (error) {
        console.error('Supabase error fetching cases:', error)
        throw error
      }

      setCases(data || [])
    } catch (error) {
      console.error('Error fetching cases:', error)
      // 에러 발생 시 빈 배열로 설정하여 UI가 정상적으로 렌더링되도록 함
      setCases([])
    } finally {
      // 필요한 경우 추가 로직
    }
  }

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, number')
        .eq('role', '학생')
        .order('name')

      if (error) {
        console.error('Supabase error fetching students:', error)
        throw error
      }

      setStudents(data || [])
    } catch (error) {
      console.error('Error fetching students:', error)
      // 에러 발생 시 빈 배열로 설정하여 UI가 정상적으로 렌더링되도록 함
      setStudents([])
    }
  }

  // 케이스 수정 다이얼로그 열기
  const handleEdit = (caseItem: Case) => {
    setEditingCase(caseItem)
    setIsEditDialogOpen(true)
  }

  // 케이스 수정 처리
  const handleCaseUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCase || !user) return

    setIsUpdating(true)

    try {
      const formData = new FormData(e.target as HTMLFormElement)
      const updateData = {
        datetime: new Date(formData.get('datetime') as string).toISOString(),
        category: formData.get('category') as string,
        assigned_resident: formData.get('assigned_resident') as string,
        patient_number: formData.get('patient_number') as string,
        patient_name: formData.get('patient_name') as string,
        assigned_student1: (formData.get('assigned_student1') as string) === 'none' ? null : formData.get('assigned_student1') as string,
        assigned_student2: (formData.get('assigned_student2') as string) === 'none' ? null : formData.get('assigned_student2') as string,
        case_status: formData.get('case_status') as string,
        treatment_details: formData.get('treatment_details') as string || null,
        note: formData.get('note') as string || null,
      }

      const { error } = await supabase
        .from('cases')
        .update(updateData)
        .eq('id', editingCase.id)

      if (error) throw error

      // 로컬 state 직접 업데이트 (서버 재요청 없이)
      setCases(prevCases =>
        prevCases.map(c =>
          c.id === editingCase.id
            ? { ...c, ...updateData }
            : c
        )
      )

      setIsEditDialogOpen(false)
      setEditingCase(null)

      // 성공 알림
      alert('케이스가 성공적으로 수정되었습니다.')

    } catch (error) {
      console.error('Error updating case:', error)
      alert('케이스 수정 중 오류가 발생했습니다.')
    } finally {
      setIsUpdating(false)
    }
  }


  const filteredCases = cases.filter(caseItem => {
    const matchesSearch =
      caseItem.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.patient_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      caseItem.assigned_resident.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = !categoryFilter || categoryFilter === 'all' || caseItem.category === categoryFilter
    const matchesStatus = !statusFilter || statusFilter === 'all' || caseItem.case_status === statusFilter

    return matchesSearch && matchesCategory && matchesStatus
  })

  const getStudentName = (studentId: string) => {
    const student = students.find(s => s.id === studentId)
    return student ? `${student.name}(${student.number})` : studentId
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case '완료': return 'default'
      case '실패': return 'destructive'
      case '진행중': return 'secondary'
      default: return 'outline'
    }
  }

  const formatCaseLog = (logEntry: any, students: User[]): string => {
    const timestamp = new Date(logEntry.timestamp)
    const dateStr = format(timestamp, 'M/dd HH:mm', { locale: ko })

    const getStudentDisplay = (studentId: string) => {
      const student = students.find(s => s.id === studentId)
      return student ? `${student.number}${student.name}` : studentId
    }

    switch (logEntry.action) {
      case 'case_created_from_excel':
        return `${dateStr} 장부`

      case 'status_change':
        let statusText = ''
        if (logEntry.to === '완료') {
          statusText = '완료'
        } else if (logEntry.to === '실패') {
          statusText = `실패${logEntry.reason ? `, ${logEntry.reason}` : ''}`
        } else {
          statusText = logEntry.to
        }
        return `${dateStr} ${statusText}`

      case 'case_assigned':
        const assignedStudent = getStudentDisplay(logEntry.student_id || '')
        return `${dateStr} 배정 ${assignedStudent}`

      case 'case_exchanged':
        const fromStudent = getStudentDisplay(logEntry.from_student || '')
        const toStudent = getStudentDisplay(logEntry.to_student || '')
        return `${dateStr} 교환 ${fromStudent} → ${toStudent}`

      case 'case_transferred':
        const transferFrom = getStudentDisplay(logEntry.from_student || '')
        const transferTo = getStudentDisplay(logEntry.to_student || '')
        return `${dateStr} 양도 ${transferFrom} → ${transferTo}`

      default:
        return `${dateStr} ${logEntry.action}`
    }
  }

  return (
    <AuthGuard requiredRole="관리자">
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">전체 케이스 관리</h1>
        <p className="text-muted-foreground mt-2">
          모든 케이스를 보고 편집할 수 있습니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>케이스 목록</CardTitle>
          <div className="flex flex-wrap gap-4 mt-4">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
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

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 상태</SelectItem>
                <SelectItem value="완료">완료</SelectItem>
                <SelectItem value="실패">실패</SelectItem>
                <SelectItem value="진행중">진행중</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative ml-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="환자명, 환자번호로 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>일시</TableHead>
                  <TableHead>분류</TableHead>
                  <TableHead>환자번호</TableHead>
                  <TableHead>환자명</TableHead>
                  <TableHead>전공의</TableHead>
                  <TableHead>담당학생</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>획득경로</TableHead>
                  <TableHead>작업</TableHead>
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
                  filteredCases.map((caseItem) => (
                    <TableRow
                      key={caseItem.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onDoubleClick={() => {
                        setSelectedCase(caseItem)
                        setIsViewDialogOpen(true)
                      }}
                    >
                      <TableCell>
                        {format(new Date(caseItem.datetime), 'MM/dd HH:mm', { locale: ko })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{caseItem.category}</Badge>
                      </TableCell>
                      <TableCell>{caseItem.patient_number}</TableCell>
                      <TableCell>
                        {caseItem.patient_name}
                      </TableCell>
                      <TableCell>
                        {caseItem.assigned_resident}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div>{getStudentName(caseItem.assigned_student1)}</div>
                          {caseItem.assigned_student2 && (
                            <div>{getStudentName(caseItem.assigned_student2)}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(caseItem.case_status)}>
                          {caseItem.case_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{caseItem.acquisition_method}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedCase(caseItem)
                              setIsViewDialogOpen(true)
                            }}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(caseItem)
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
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

      {/* 케이스 상세보기 다이얼로그 */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>케이스 상세정보 및 로그</DialogTitle>
          </DialogHeader>
          {selectedCase && (
            <div className="space-y-6">
              {/* 케이스 기본 정보 */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/20 rounded-lg">
                <div>
                  <Label className="font-semibold">일시</Label>
                  <p className="text-sm mt-1">{format(new Date(selectedCase.datetime), 'yyyy-MM-dd HH:mm', { locale: ko })}</p>
                </div>
                <div>
                  <Label className="font-semibold">분류</Label>
                  <p className="text-sm mt-1">
                    <Badge variant="outline">{selectedCase.category}</Badge>
                  </p>
                </div>
                <div>
                  <Label className="font-semibold">담당 전공의</Label>
                  <p className="text-sm mt-1">{selectedCase.assigned_resident}</p>
                </div>
                <div>
                  <Label className="font-semibold">환자번호</Label>
                  <p className="text-sm mt-1">{selectedCase.patient_number}</p>
                </div>
                <div>
                  <Label className="font-semibold">환자명</Label>
                  <p className="text-sm mt-1">{selectedCase.patient_name}</p>
                </div>
                <div>
                  <Label className="font-semibold">상태</Label>
                  <p className="text-sm mt-1">
                    <Badge variant={getStatusBadgeVariant(selectedCase.case_status)}>
                      {selectedCase.case_status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <Label className="font-semibold">획득경로</Label>
                  <p className="text-sm mt-1">
                    <Badge variant="secondary">{selectedCase.acquisition_method}</Badge>
                  </p>
                </div>
                <div>
                  <Label className="font-semibold">담당 학생</Label>
                  <div className="text-sm mt-1 space-y-1">
                    <div>{getStudentName(selectedCase.assigned_student1)}</div>
                    {selectedCase.assigned_student2 && (
                      <div>{getStudentName(selectedCase.assigned_student2)}</div>
                    )}
                  </div>
                </div>
              </div>

              {selectedCase.treatment_details && (
                <div>
                  <Label className="font-semibold">진료내역</Label>
                  <p className="text-sm mt-1 p-3 bg-muted/20 rounded">{selectedCase.treatment_details}</p>
                </div>
              )}

              {selectedCase.note && (
                <div>
                  <Label className="font-semibold">Note</Label>
                  <p className="text-sm mt-1 p-3 bg-muted/20 rounded">{selectedCase.note}</p>
                </div>
              )}

              {/* 케이스 로그 */}
              <div>
                <Label className="font-semibold text-base">케이스 로그</Label>
                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                  {Array.isArray(selectedCase.change_log) && selectedCase.change_log.length > 0 ? (
                    selectedCase.change_log
                      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((logEntry: any, index: number) => (
                        <div key={index} className="text-sm p-2 bg-muted/10 rounded border-l-2 border-primary/20">
                          {formatCaseLog(logEntry, students)}
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-muted-foreground">로그가 없습니다.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 케이스 수정 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>케이스 수정</DialogTitle>
          </DialogHeader>
          {editingCase && (
            <form onSubmit={handleCaseUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="datetime">일시</Label>
                  <Input
                    id="datetime"
                    name="datetime"
                    type="datetime-local"
                    defaultValue={new Date(editingCase.datetime).toISOString().slice(0, 16)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">분류</Label>
                  <Select name="category" defaultValue={editingCase.category}>
                    <SelectTrigger>
                      <SelectValue placeholder="분류를 선택하세요" />
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
                  <Label htmlFor="assigned_resident">담당 전공의</Label>
                  <Input
                    id="assigned_resident"
                    name="assigned_resident"
                    defaultValue={editingCase.assigned_resident}
                    placeholder="담당 전공의 이름"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="patient_number">환자번호</Label>
                  <Input
                    id="patient_number"
                    name="patient_number"
                    defaultValue={editingCase.patient_number}
                    placeholder="환자번호"
                    required
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="patient_name">환자명</Label>
                  <Input
                    id="patient_name"
                    name="patient_name"
                    defaultValue={editingCase.patient_name}
                    placeholder="환자명"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assigned_student1">배정 학생 1</Label>
                  <Select name="assigned_student1" defaultValue={editingCase.assigned_student1 || 'none'}>
                    <SelectTrigger>
                      <SelectValue placeholder="학생을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">선택 안함</SelectItem>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name}({student.number})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assigned_student2">배정 학생 2</Label>
                  <Select name="assigned_student2" defaultValue={editingCase.assigned_student2 || 'none'}>
                    <SelectTrigger>
                      <SelectValue placeholder="학생을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">선택 안함</SelectItem>
                      {students.map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.name}({student.number})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="case_status">상태</Label>
                  <Select name="case_status" defaultValue={editingCase.case_status}>
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="treatment_details">진료내역</Label>
                <Textarea
                  id="treatment_details"
                  name="treatment_details"
                  defaultValue={editingCase.treatment_details || ''}
                  placeholder="진료내역을 입력하세요"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Note</Label>
                <Textarea
                  id="note"
                  name="note"
                  defaultValue={editingCase.note || ''}
                  placeholder="추가 메모를 입력하세요"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  취소
                </Button>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating ? '수정 중...' : '케이스 수정'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </AuthGuard>
  )
}