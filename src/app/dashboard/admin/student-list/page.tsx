'use client'

import React, { useState } from 'react'
import { useUser } from '@/hooks/useUser'
import { studentMasterManager, StudentListUploadResult } from '@/utils/studentMasterManager'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Upload, Download, Users, AlertTriangle, CheckCircle, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

interface StudentStats {
  total: number
  registered: number
  unregistered: number
}

export default function StudentListPage() {
  const { user } = useUser()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadResult, setUploadResult] = useState<StudentListUploadResult | null>(null)
  const [studentStats, setStudentStats] = useState<StudentStats>({ total: 0, registered: 0, unregistered: 0 })
  const [isLoadingStats, setIsLoadingStats] = useState(false)

  // 엑셀 파일 업로드 처리
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // 파일 확장자 확인
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast.error('Excel 파일(.xlsx, .xls)만 업로드 가능합니다.')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setUploadStatus('파일 읽는 중...')
    setUploadResult(null)

    try {
      setUploadProgress(20)
      const buffer = await file.arrayBuffer()

      setUploadProgress(40)
      setUploadStatus('데이터 파싱 중...')
      const workbook = XLSX.read(buffer)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

      // 첫 번째 행이 헤더라고 가정하고 제거
      const dataRows = jsonData.slice(1)

      setUploadProgress(60)
      setUploadStatus('학생 데이터 처리 중...')

      // 데이터 파싱 (첫 번째 컬럼: 번호, 두 번째 컬럼: 이름)
      const students = dataRows
        .filter(row => row.length >= 2 && row[0] && row[1]) // 빈 행 제거
        .map(row => ({
          number: String(row[0]).trim(),
          name: String(row[1]).trim()
        }))

      if (students.length === 0) {
        toast.error('유효한 학생 데이터가 없습니다. 번호와 이름이 모두 입력된 행이 있는지 확인하세요.')
        return
      }

      setUploadProgress(80)
      setUploadStatus(`${students.length}명의 학생 데이터 업로드 중...`)

      // 학생 명단 업로드
      const result = await studentMasterManager.uploadStudentList(students)

      setUploadProgress(100)
      setUploadStatus('업로드 완료!')
      setUploadResult(result)

      if (result.success) {
        toast.success(`학생 명단이 업로드되었습니다. (업로드: ${result.uploaded}, 업데이트: ${result.updated})`)
        await refreshStats()
      } else {
        toast.error('업로드 중 오류가 발생했습니다.')
      }

    } catch (error) {
      console.error('File upload error:', error)
      toast.error('파일 처리 중 오류가 발생했습니다.')
    } finally {
      setTimeout(() => {
        setIsUploading(false)
        setUploadProgress(0)
        setUploadStatus('')
      }, 1000) // 완료 상태를 1초간 보여준 후 초기화

      // input 초기화
      event.target.value = ''
    }
  }

  // 학생 통계 새로고침
  const refreshStats = async () => {
    setIsLoadingStats(true)
    try {
      const stats = await studentMasterManager.getStudentStats()
      setStudentStats(stats)
    } catch (error) {
      console.error('Error refreshing stats:', error)
      toast.error('통계를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setIsLoadingStats(false)
    }
  }

  // 데이터베이스 상태 디버깅
  const handleDebugDatabase = async () => {
    await studentMasterManager.debugDatabaseState()
    toast.info('디버깅 정보가 콘솔에 출력되었습니다.')
  }

  // 강제 동기화
  const handleForceSync = async () => {
    try {
      const result = await studentMasterManager.forceSyncAllRegisteredStudents()
      if (result.errors.length > 0) {
        toast.error(`동기화 중 오류: ${result.errors.join(', ')}`)
      } else {
        toast.success(`${result.updated}명의 학생 동기화 완료`)
      }
      await refreshStats()
    } catch (error) {
      toast.error('강제 동기화 실패')
    }
  }

  // 템플릿 다운로드
  const downloadTemplate = () => {
    const templateData = [
      ['번호', '이름'],
      ['1', '김철수'],
      ['2', '이영희'],
      ['3', '박민수'],
      ['...', '...']
    ]

    const worksheet = XLSX.utils.aoa_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, '학생명단')
    XLSX.writeFile(workbook, '학생명단_템플릿.xlsx')
  }

  // 페이지 진입 시 통계 로드
  React.useEffect(() => {
    refreshStats()
  }, [])

  if (!user || user.role !== '관리자') {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">관리자 권한이 필요합니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">학생 명단 관리</h1>
        <p className="text-muted-foreground mt-2">
          엑셀 파일로 학생 명단을 업로드하고 관리합니다.
        </p>
      </div>

      {/* 현재 통계 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 학생</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{studentStats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">가입 완료</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{studentStats.registered}</div>
            {studentStats.total > 0 && (
              <div className="text-xs text-muted-foreground">
                {Math.round((studentStats.registered / studentStats.total) * 100)}%
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">미가입</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{studentStats.unregistered}</div>
            {studentStats.total > 0 && (
              <div className="text-xs text-muted-foreground">
                {Math.round((studentStats.unregistered / studentStats.total) * 100)}%
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {studentStats.total > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>가입 진행률</span>
                <span>{Math.round((studentStats.registered / studentStats.total) * 100)}%</span>
              </div>
              <Progress
                value={(studentStats.registered / studentStats.total) * 100}
                className="h-2"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 업로드 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            학생 명단 업로드
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              엑셀 파일의 첫 번째 컬럼은 <strong>번호</strong>, 두 번째 컬럼은 <strong>이름</strong>이어야 합니다.
              첫 번째 행은 헤더로 간주되어 제외됩니다.
            </AlertDescription>
          </Alert>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              템플릿 다운로드
            </Button>

            <div className="flex-1">
              <Label htmlFor="student-file" className="sr-only">
                학생 명단 파일
              </Label>
              <Input
                id="student-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="cursor-pointer"
              />
            </div>

            {isUploading && (
              <Button disabled className="flex items-center gap-2">
                <Upload className="h-4 w-4 animate-spin" />
                업로드 중...
              </Button>
            )}
          </div>

          {/* 업로드 진행률 표시 */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{uploadStatus}</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 업로드 결과 */}
      {uploadResult && (
        <Card>
          <CardHeader>
            <CardTitle className={uploadResult.success ? 'text-green-600' : 'text-red-600'}>
              업로드 결과
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <Badge variant="default">
                  신규 업로드: {uploadResult.uploaded}명
                </Badge>
              </div>
              <div>
                <Badge variant="secondary">
                  기존 업데이트: {uploadResult.updated}명
                </Badge>
              </div>
            </div>

            {uploadResult.errors.length > 0 && (
              <div>
                <h4 className="font-medium text-red-600 mb-2">오류 목록:</h4>
                <div className="bg-red-50 p-3 rounded-md max-h-40 overflow-y-auto">
                  {uploadResult.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-700">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 관리 버튼들 */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleDebugDatabase}
          className="flex items-center gap-2"
        >
          <AlertTriangle className="h-4 w-4" />
          디버깅 로그
        </Button>
        <Button
          variant="destructive"
          onClick={handleForceSync}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          강제 동기화
        </Button>
        <Button
          variant="outline"
          onClick={refreshStats}
          disabled={isLoadingStats}
          className="flex items-center gap-2"
        >
          <Users className={`h-4 w-4 ${isLoadingStats ? 'animate-spin' : ''}`} />
          통계 새로고침
        </Button>
      </div>
    </div>
  )
}