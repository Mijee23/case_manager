'use client'

import { useState } from 'react'
import { useStudentMaster, useStudentValidation } from '@/hooks/useStudentMaster'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { AlertTriangle, CheckCircle, UserX } from 'lucide-react'
import { toast } from 'sonner'

interface StudentSelectorNewProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  label?: string
  allowNone?: boolean
  noneLabel?: string
  disabled?: boolean
}

export default function StudentSelectorNew({
  value,
  onValueChange,
  placeholder = "학생을 선택하세요",
  label,
  allowNone = true,
  noneLabel = "선택 안함",
  disabled = false
}: StudentSelectorNewProps) {
  const { studentOptions, loading, error } = useStudentMaster()
  const { validateStudent, validationLoading } = useStudentValidation()
  const [showValidationDialog, setShowValidationDialog] = useState(false)
  const [validationResult, setValidationResult] = useState<{
    studentName?: string
    error?: string
  } | null>(null)
  const [pendingValue, setPendingValue] = useState<string>('')


  const handleValueChange = async (newValue: string) => {
    // "선택 안함"이거나 빈 값인 경우 바로 설정
    if (newValue === 'none' || !newValue) {
      onValueChange(newValue)
      return
    }

    // 선택된 학생 정보 찾기
    const selectedStudent = studentOptions.find(student =>
      student.number === newValue || student.id === newValue
    )

    if (!selectedStudent) {
      toast.error('선택된 학생을 찾을 수 없습니다.')
      return
    }

    // 이미 가입된 학생인 경우 바로 설정
    if (selectedStudent.isRegistered) {
      onValueChange(selectedStudent.registeredUserId || newValue)
      return
    }

    // 미가입 학생인 경우 검증 및 안내
    setPendingValue(newValue)
    setValidationResult({
      studentName: selectedStudent.name,
      error: `${selectedStudent.name}님은 아직 회원가입을 하지 않아 선택할 수 없습니다.`
    })
    setShowValidationDialog(true)
  }

  const handleDialogClose = () => {
    setShowValidationDialog(false)
    setPendingValue('')
    setValidationResult(null)
  }

  const getDisplayValue = () => {
    if (!value || value === 'none') return value

    // value가 user ID인 경우, 해당하는 학생을 찾아서 표시
    const studentByUserId = studentOptions.find(student => student.registeredUserId === value)
    if (studentByUserId) {
      return studentByUserId.number
    }

    // value가 number인 경우 그대로 반환
    const studentByNumber = studentOptions.find(student => student.number === value)
    if (studentByNumber) {
      return value
    }

    return value
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {label && <Label>{label}</Label>}
        <Select disabled>
          <SelectTrigger>
            <SelectValue placeholder="학생 목록 로딩 중..." />
          </SelectTrigger>
        </Select>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-2">
        {label && <Label>{label}</Label>}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {label && <Label>{label}</Label>}

        <Select
          value={getDisplayValue()}
          onValueChange={handleValueChange}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {allowNone && (
              <SelectItem value="none">{noneLabel}</SelectItem>
            )}
            {studentOptions.map((student) => (
              <SelectItem
                key={student.id}
                value={student.number}
                className={!student.isRegistered ? 'text-muted-foreground' : ''}
              >
                <div className="flex items-center justify-between w-full">
                  <span>{student.label}</span>
                  {student.isRegistered ? (
                    <CheckCircle className="h-3 w-3 text-green-600 ml-2" />
                  ) : (
                    <UserX className="h-3 w-3 text-orange-600 ml-2" />
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 검증 실패 다이얼로그 */}
      <Dialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              선택할 수 없는 학생
            </DialogTitle>
            <DialogDescription>
              {validationResult?.error}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <UserX className="h-4 w-4" />
              <AlertDescription>
                해당 학생이 회원가입을 완료한 후 다시 시도해주세요.
                또는 다른 학생을 선택해주세요.
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleDialogClose}>
                확인
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}