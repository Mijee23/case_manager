'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseClient } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'
import { useStudentMaster } from '@/hooks/useStudentMaster'
import { studentCaseAnalytics } from '@/utils/studentCaseAnalytics'
import { CaseFormData, User } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import StudentSelectorNew from '@/components/StudentSelectorNew'
import { toast } from 'sonner'

export default function AddCasePage() {
  const { user } = useUser()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [duplicateCases, setDuplicateCases] = useState<any[]>([])
  // 새로운 학생 시스템은 컴포넌트 내부에서 처리
  const [formData, setFormData] = useState<CaseFormData & {
    assigned_student1?: string
    assigned_student2?: string
  }>({
    datetime: new Date(),
    category: '가철',
    assigned_resident: '',
    patient_number: '',
    patient_name: '',
    treatment_details: '',
    note: '',
    assigned_student1: 'none',
    assigned_student2: 'none',
  })

  const supabase = createSupabaseClient()

  // 현재 사용자의 학생 번호를 assigned_student1에 자동 설정
  useEffect(() => {
    if (user && user.role === '학생' && user.student_number) {
      setFormData(prev => ({
        ...prev,
        assigned_student1: user.student_number
      }))
    }
  }, [user])

  // 학생 유효성 검증 헬퍼
  const validateAndGetStudentId = async (studentNumber: string, studentName: string): Promise<string | null> => {
    if (studentNumber === 'none') return null

    try {
      const { studentMasterManager } = await import('@/utils/studentMasterManager')
      const validation = await studentMasterManager.validateStudentRegistration(studentNumber)

      if (!validation.isValid) {
        toast.error(validation.error || `${studentName}을(를) 선택할 수 없습니다.`)
        return null
      }

      return validation.user?.id || null
    } catch (error) {
      toast.error('학생 검증 중 오류가 발생했습니다.')
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    // 중복 체크
    await checkForDuplicates()
  }

  const checkForDuplicates = async () => {
    if (!user) return

    setIsLoading(true)

    try {
      // 더 정교한 중복 검사: 환자번호 + 분류 + 담당전공의
      const { data: exactMatches, error: checkError } = await supabase
        .from('cases')
        .select('*, assigned_student1_info:assigned_student1(id, name), assigned_student2_info:assigned_student2(id, name)')
        .eq('patient_number', formData.patient_number)
        .eq('category', formData.category)
        .eq('assigned_resident', formData.assigned_resident)

      if (checkError) throw checkError

      if (exactMatches && exactMatches.length > 0) {
        // 정확히 일치하는 케이스들 중에서 참여 가능한 케이스와 이미 full인 케이스 분류
        const joinableCases = exactMatches.filter(case_item =>
          case_item.assigned_student2 === null && // 빈 자리가 있고
          case_item.assigned_student1 !== user.id // 현재 사용자가 이미 참여하지 않은 케이스
        )

        const currentUserCases = exactMatches.filter(case_item =>
          case_item.assigned_student1 === user.id || case_item.assigned_student2 === user.id
        )

        // 사용자가 이미 참여 중인 케이스가 있으면 경고
        if (currentUserCases.length > 0) {
          toast.error('이미 동일한 케이스에 참여하고 있습니다.')
          setIsLoading(false)
          return
        }

        // 참여 가능한 케이스가 있으면 다이얼로그 표시
        if (joinableCases.length > 0) {
          setDuplicateCases(joinableCases)
          setShowDuplicateDialog(true)
          setIsLoading(false)
        } else {
          // 참여 가능한 케이스가 없으면 (모든 케이스가 full) 새 케이스 생성
          await createCase()
        }
      } else {
        // 중복이 없으면 바로 케이스 생성
        await createCase()
      }
    } catch (error) {
      console.error('Error checking duplicates:', error)
      toast.error('중복 확인 중 오류가 발생했습니다.')
      setIsLoading(false)
    }
  }

  const createCase = async () => {
    if (!user) return

    try {
      // 환자 정보가 없으면 추가
      const { error: patientError } = await supabase
        .from('patients')
        .upsert({
          patient_number: formData.patient_number,
          patient_name: formData.patient_name,
        })

      if (patientError) throw patientError

      // 학생 ID 검증 및 변환
      const student1Id = formData.assigned_student1 === 'none' ? user.id :
        await validateAndGetStudentId(formData.assigned_student1 || '', '배정 학생 1')

      const student2Id = formData.assigned_student2 === 'none' ? null :
        await validateAndGetStudentId(formData.assigned_student2 || '', '배정 학생 2')

      // 학생 1이 필수이므로 검증 실패 시 중단
      if (formData.assigned_student1 !== 'none' && !student1Id) {
        return
      }

      // 학생 2는 선택 사항이므로 검증 실패 시에도 계속 진행 (null로 설정)
      if (formData.assigned_student2 !== 'none' && !student2Id) {
        // 이미 토스트 메시지가 표시되었으므로 student2를 null로 설정하고 계속 진행
      }

      // 케이스 생성
      const { error: caseError } = await supabase
        .from('cases')
        .insert({
          datetime: formData.datetime.toISOString(),
          category: formData.category,
          assigned_resident: formData.assigned_resident,
          patient_number: formData.patient_number,
          patient_name: formData.patient_name,
          assigned_student1: student1Id,
          assigned_student2: student2Id,
          case_status: '진행중',
          acquisition_method: '배정',
          treatment_details: formData.treatment_details || null,
          note: formData.note || null,
          change_log: [{
            timestamp: new Date().toISOString(),
            user_id: user.id,
            user_name: user.name,
            action: 'case_created',
          }]
        })

      if (caseError) throw caseError

      // 케이스 생성 후 관련 학생들의 통계 업데이트
      const studentsToUpdate = [
        student1Id,
        student2Id
      ].filter(Boolean) as string[]

      // 각 학생의 케이스 수 동기화
      for (const studentId of studentsToUpdate) {
        try {
          await studentCaseAnalytics.syncStudentCaseCount(studentId)
        } catch (syncError) {
          console.error(`Failed to sync case count for student ${studentId}:`, syncError)
        }
      }

      toast.success('케이스가 성공적으로 등록되었습니다.')
      router.push('/dashboard/my-cases')
    } catch (error) {
      console.error('Error creating case:', error)
      toast.error('케이스 등록 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const joinExistingCase = async (caseId: string) => {
    if (!user) return

    setIsLoading(true)

    try {
      // 기존 케이스에 현재 사용자를 assigned_student2로 추가
      const { error: updateError } = await supabase
        .from('cases')
        .update({
          assigned_student2: user.id,
          change_log: [
            ...duplicateCases.find(c => c.id === caseId)?.change_log || [],
            {
              timestamp: new Date().toISOString(),
              user_id: user.id,
              user_name: user.name,
              action: 'student_joined',
              details: `${user.name}이(가) 케이스에 참여했습니다.`
            }
          ]
        })
        .eq('id', caseId)

      if (updateError) throw updateError

      // 케이스 참여 후 양쪽 학생들의 통계 업데이트
      const targetCase = duplicateCases.find(c => c.id === caseId)
      const studentsToUpdate = [
        targetCase?.assigned_student1,
        user.id
      ].filter(Boolean) as string[]

      // 각 학생의 케이스 수 동기화
      for (const studentId of studentsToUpdate) {
        try {
          await studentCaseAnalytics.syncStudentCaseCount(studentId)
        } catch (syncError) {
          console.error(`Failed to sync case count for student ${studentId}:`, syncError)
        }
      }

      toast.success('기존 케이스에 성공적으로 참여했습니다.')
      router.push('/dashboard/my-cases')
    } catch (error) {
      console.error('Error joining existing case:', error)
      toast.error('케이스 참여 중 오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
      setShowDuplicateDialog(false)
    }
  }

  const handleConfirmDuplicate = async () => {
    setShowDuplicateDialog(false)
    await createCase()
  }

  const handleCancelDuplicate = () => {
    setShowDuplicateDialog(false)
    setIsLoading(false)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'datetime' ? new Date(value) : value
    }))
  }

  if (!user || user.role === '전공의') {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">케이스를 등록할 권한이 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">케이스 입력</h1>
        <p className="text-muted-foreground mt-2">
          새로운 케이스를 등록합니다.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg md:text-xl">케이스 정보 입력</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <Label htmlFor="datetime">일시</Label>
                <Input
                  id="datetime"
                  type="datetime-local"
                  value={formData.datetime.toISOString().slice(0, 16)}
                  onChange={(e) => handleInputChange('datetime', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">분류</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: any) => handleInputChange('category', value)}
                >
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
                  value={formData.assigned_resident}
                  onChange={(e) => handleInputChange('assigned_resident', e.target.value)}
                  placeholder="담당 전공의 이름"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="patient_number">환자번호</Label>
                <Input
                  id="patient_number"
                  value={formData.patient_number}
                  onChange={(e) => handleInputChange('patient_number', e.target.value)}
                  placeholder="환자번호"
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="patient_name">환자명</Label>
                <Input
                  id="patient_name"
                  value={formData.patient_name}
                  onChange={(e) => handleInputChange('patient_name', e.target.value)}
                  placeholder="환자명"
                  required
                  className="text-base"
                />
              </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <StudentSelectorNew
                  label="배정 학생 1"
                  value={formData.assigned_student1}
                  onValueChange={(value) => handleInputChange('assigned_student1', value)}
                  placeholder="학생을 선택하세요"
                  allowNone={true}
                  noneLabel="본인 (나)"
                />

                <StudentSelectorNew
                  label="배정 학생 2"
                  value={formData.assigned_student2}
                  onValueChange={(value) => handleInputChange('assigned_student2', value)}
                  placeholder="학생을 선택하세요"
                  allowNone={true}
                  noneLabel="선택 안함"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="treatment_details">진료내역</Label>
              <Textarea
                id="treatment_details"
                value={formData.treatment_details}
                onChange={(e) => handleInputChange('treatment_details', e.target.value)}
                placeholder="진료내역을 입력하세요"
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                value={formData.note}
                onChange={(e) => handleInputChange('note', e.target.value)}
                placeholder="추가 메모를 입력하세요"
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard/my-cases')}
                className="w-full sm:w-auto"
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full sm:w-auto"
              >
                {isLoading ? '등록 중...' : '케이스 등록'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 중복 케이스 확인 다이얼로그 */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>동일한 케이스가 발견되었습니다!</DialogTitle>
            <DialogDescription>
              같은 환자의 동일한 분류 케이스가 이미 등록되어 있습니다.
              <br />
              기존 케이스에 참여하거나 새로운 케이스를 생성할 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-60 overflow-y-auto">
            <div className="space-y-3">
              <p className="text-sm font-medium">참여 가능한 케이스:</p>
              {duplicateCases.map((case_item) => (
                <div key={case_item.id} className="p-4 border rounded-lg bg-muted/50">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><strong>환자:</strong> {case_item.patient_name} ({case_item.patient_number})</p>
                      <p><strong>분류:</strong> {case_item.category}</p>
                      <p><strong>담당 전공의:</strong> {case_item.assigned_resident}</p>
                    </div>
                    <div>
                      <p><strong>현재 배정:</strong> {case_item.assigned_student1_info?.name || '알 수 없음'}</p>
                      <p><strong>빈 자리:</strong>
                        <span className="text-green-600 font-medium ml-1">
                          1개 (학생 2 미배정)
                        </span>
                      </p>
                      <p><strong>등록일:</strong> {new Date(case_item.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => joinExistingCase(case_item.id)}
                      disabled={isLoading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {isLoading ? '참여 중...' : '이 케이스에 참여하기'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={handleCancelDuplicate}>
              취소
            </Button>
            <Button onClick={handleConfirmDuplicate} disabled={isLoading} variant="secondary">
              {isLoading ? '생성 중...' : '새로운 케이스 생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}