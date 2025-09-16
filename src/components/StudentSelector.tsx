'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { useStudentsHybrid } from '@/hooks/useStudentsHybrid'
import { AlertTriangle, User, UserCheck } from 'lucide-react'

interface StudentSelectorProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  excludeCurrentUser?: string
  onlyRegistered?: boolean
  showRegistrationStatus?: boolean
}

export function StudentSelector({
  value,
  onValueChange,
  placeholder = "학생을 선택하세요",
  excludeCurrentUser,
  onlyRegistered = false,
  showRegistrationStatus = true
}: StudentSelectorProps) {
  const { 
    studentOptions, 
    loading, 
    error, 
    isStudentRegistered,
    unregisteredStudents,
    registeredCount,
    totalStudents
  } = useStudentsHybrid(excludeCurrentUser, onlyRegistered)

  const [selectedOption, setSelectedOption] = useState<string>()

  const handleValueChange = (newValue: string) => {
    setSelectedOption(newValue)
    onValueChange(newValue)

    // 미등록 학생 선택 시 경고
    if (newValue !== 'none') {
      const option = studentOptions.find(opt => opt.value === newValue)
      if (option && !option.isRegistered && showRegistrationStatus) {
        console.warn(`선택된 학생 "${option.label}"은 아직 회원가입하지 않았습니다.`)
      }
    }
  }

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="학생 목록 로딩 중..." />
        </SelectTrigger>
      </Select>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>학생 목록을 불러올 수 없습니다: {error}</AlertDescription>
      </Alert>
    )
  }

  const selectedStudentOption = studentOptions.find(opt => opt.value === value)

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={handleValueChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">선택 안함</SelectItem>
          {studentOptions.map((option) => (
            <SelectItem key={option.id} value={option.value}>
              <div className="flex items-center gap-2">
                <span>{option.label}</span>
                {showRegistrationStatus && (
                  <Badge variant={option.isRegistered ? "default" : "secondary"} className="text-xs">
                    {option.isRegistered ? (
                      <><UserCheck className="w-3 h-3 mr-1" />등록됨</>
                    ) : (
                      <><User className="w-3 h-3 mr-1" />미등록</>
                    )}
                  </Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 등록 상태 정보 */}
      {showRegistrationStatus && (
        <div className="text-sm text-muted-foreground">
          전체 {totalStudents}명 중 {registeredCount}명 회원가입 완료
          {unregisteredStudents.length > 0 && (
            <span className="text-amber-600 ml-2">
              ({unregisteredStudents.length}명 미등록)
            </span>
          )}
        </div>
      )}

      {/* 미등록 학생 선택 시 경고 */}
      {selectedStudentOption && !selectedStudentOption.isRegistered && showRegistrationStatus && (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            선택된 학생 <strong>{selectedStudentOption.label}</strong>은 아직 회원가입하지 않았습니다.
            케이스 배정 시 해당 학생이 로그인할 수 없을 수 있습니다.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
