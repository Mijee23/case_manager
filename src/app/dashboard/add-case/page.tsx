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
      // 같은 환자번호로 등록된 케이스가 있는지 확인
      const { data: existingCases, error: checkError } = await supabase
        .from('cases')
        .select('*')
        .eq('patient_number', formData.patient_number)

      if (checkError) throw checkError

      if (existingCases && existingCases.length > 0) {
        // 중복된 케이스가 있으면 확인 다이얼로그 표시
        setDuplicateCases(existingCases)
        setShowDuplicateDialog(true)
        setIsLoading(false)
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
          <CardTitle>케이스 정보 입력</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                />
              </div>

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

            <div className="space-y-2">
              <Label htmlFor="treatment_details">진료내역</Label>
              <Textarea
                id="treatment_details"
                value={formData.treatment_details}
                onChange={(e) => handleInputChange('treatment_details', e.target.value)}
                placeholder="진료내역을 입력하세요"
                rows={3}
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
              />
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/dashboard/my-cases')}
              >
                취소
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? '등록 중...' : '케이스 등록'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 중복 케이스 확인 다이얼로그 */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>중복된 케이스가 발견되었습니다</DialogTitle>
            <DialogDescription>
              환자번호 "{formData.patient_number}"로 이미 등록된 케이스가 {duplicateCases.length}개 있습니다.
              <br />
              그래도 등록하시겠습니까?
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-60 overflow-y-auto">
            <div className="space-y-2">
              <p className="text-sm font-medium">기존 케이스:</p>
              {duplicateCases.map((case_item, index) => (
                <div key={case_item.id} className="p-3 bg-muted rounded-md text-sm">
                  <p><strong>분류:</strong> {case_item.category}</p>
                  <p><strong>담당 전공의:</strong> {case_item.assigned_resident}</p>
                  <p><strong>환자명:</strong> {case_item.patient_name}</p>
                  <p><strong>등록일:</strong> {new Date(case_item.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelDuplicate}>
              취소
            </Button>
            <Button onClick={handleConfirmDuplicate} disabled={isLoading}>
              {isLoading ? '등록 중...' : '예, 등록하겠습니다'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}