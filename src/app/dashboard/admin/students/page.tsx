'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useStudentsHybrid } from '@/hooks/useStudentsHybrid'
import { CURRENT_STUDENTS } from '@/data/students'
import { fetchAllStudentsFromDB, generateStudentDataCode, compareStudentData, logComparisonResults } from '@/utils/syncStudentData'
import { Upload, Download, Users, UserCheck, AlertTriangle, Database, Code } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

export default function StudentsManagementPage() {
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const [isUploading, setIsUploading] = useState(false)
  const [previewData, setPreviewData] = useState<any[]>([])
  
  const { 
    studentOptions, 
    loading, 
    refreshStudents,
    registeredCount,
    totalStudents,
    unregisteredStudents 
  } = useStudentsHybrid()

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      
      // 파일 읽기
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      console.log('엑셀 데이터:', jsonData)
      setPreviewData(jsonData)

      // 여기서 실제로는 students.ts 파일을 업데이트하는 로직이 필요
      // 또는 별도의 설정 파일에 저장
      toast.success('엑셀 파일을 성공적으로 읽었습니다. 미리보기를 확인하세요.')
      
    } catch (error) {
      console.error('엑셀 업로드 오류:', error)
      toast.error('엑셀 파일 처리 중 오류가 발생했습니다.')
    } finally {
      setIsUploading(false)
    }
  }

  const downloadTemplate = () => {
    const templateData = [
      { number: '2024001', name: '김철수' },
      { number: '2024002', name: '이영희' },
      { number: '2024003', name: '박민수' }
    ]

    const ws = XLSX.utils.json_to_sheet(templateData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '학생목록')
    XLSX.writeFile(wb, '학생목록_템플릿.xlsx')
  }

  // DB 데이터와 하드코딩 데이터 동기화 확인
  const checkDataSync = async () => {
    try {
      const dbStudents = await fetchAllStudentsFromDB()
      const comparison = compareStudentData(dbStudents, CURRENT_STUDENTS)
      
      logComparisonResults(comparison)
      
      if (comparison.onlyInDB.length > 0) {
        toast.warning(`DB에 ${comparison.onlyInDB.length}명의 추가 학생이 있습니다. 콘솔을 확인하세요.`)
      } else if (comparison.matchedCount === comparison.totalDB) {
        toast.success('모든 DB 사용자가 하드코딩 데이터와 정확히 매칭됩니다!')
      }
    } catch (error) {
      console.error('데이터 동기화 확인 실패:', error)
      toast.error('데이터 동기화 확인 중 오류가 발생했습니다.')
    }
  }

  // DB에서 하드코딩 코드 생성
  const generateHardcodedData = async () => {
    try {
      const dbStudents = await fetchAllStudentsFromDB()
      const code = generateStudentDataCode(dbStudents)
      
      // 클립보드에 복사
      await navigator.clipboard.writeText(code)
      
      console.log('=== 생성된 하드코딩 코드 ===')
      console.log(code)
      
      toast.success(`DB 기반 하드코딩 코드가 클립보드에 복사되었습니다! (${dbStudents.length}명)`)
    } catch (error) {
      console.error('코드 생성 실패:', error)
      toast.error('코드 생성 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">학생 관리</h1>
        <Button onClick={refreshStudents} disabled={loading}>
          새로고침
        </Button>
      </div>

      {/* 현황 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 학생</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}명</div>
            <p className="text-xs text-muted-foreground">하드코딩된 학생 수</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">회원가입 완료</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{registeredCount}명</div>
            <p className="text-xs text-muted-foreground">
              {totalStudents > 0 ? Math.round((registeredCount / totalStudents) * 100) : 0}% 완료
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">미등록</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{unregisteredStudents?.length || 0}명</div>
            <p className="text-xs text-muted-foreground">회원가입 필요</p>
          </CardContent>
        </Card>
      </div>

      {/* DB 동기화 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            DB 데이터 동기화
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription>
              기존 DB 사용자들과 하드코딩 데이터의 매칭 상태를 확인하고 동기화할 수 있습니다.
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-4">
            <Button 
              onClick={checkDataSync}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              DB 매칭 확인
            </Button>
            
            <Button 
              onClick={generateHardcodedData}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Code className="h-4 w-4" />
              하드코딩 코드 생성
            </Button>
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p>• <strong>DB 매칭 확인</strong>: 현재 DB 사용자와 하드코딩 데이터 비교</p>
            <p>• <strong>하드코딩 코드 생성</strong>: DB 기반으로 students.ts 파일용 코드 생성</p>
          </div>
        </CardContent>
      </Card>

      {/* 엑셀 업로드 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            학생 명단 엑셀 업로드
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              새 학년도 시작 시에만 사용하세요. 업로드 후 코드 재배포가 필요합니다.
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-4">
            <Button 
              onClick={downloadTemplate} 
              variant="outline"
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              템플릿 다운로드
            </Button>
            
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="max-w-md"
            />
          </div>

          {isUploading && (
            <div className="space-y-2">
              <Progress value={(uploadProgress.current / uploadProgress.total) * 100} />
              <p className="text-sm text-muted-foreground">
                처리 중... {uploadProgress.current}/{uploadProgress.total}
              </p>
            </div>
          )}

          {previewData.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">미리보기 ({previewData.length}명)</h3>
              <div className="max-h-40 overflow-y-auto border rounded p-2">
                {previewData.slice(0, 10).map((student, index) => (
                  <div key={index} className="text-sm">
                    {student.number} - {student.name}
                  </div>
                ))}
                {previewData.length > 10 && (
                  <div className="text-sm text-muted-foreground">
                    ... 외 {previewData.length - 10}명
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 미등록 학생 목록 */}
      {unregisteredStudents && unregisteredStudents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              회원가입이 필요한 학생들
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {unregisteredStudents?.map((student) => (
                <Badge key={student.id} variant="secondary" className="justify-start">
                  {student.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 전체 학생 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>전체 학생 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {studentOptions?.map((student) => (
              <div key={student.id} className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm">{student.label}</span>
                <Badge variant={student.isRegistered ? "default" : "secondary"}>
                  {student.isRegistered ? "등록됨" : "미등록"}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
