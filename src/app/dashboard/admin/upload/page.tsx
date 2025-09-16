'use client'

import { useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'
import { ExcelRowData } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { Upload, FileSpreadsheet, Check, X } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function ExcelUploadPage() {
  const { user } = useUser()
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<ExcelRowData[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
    currentRow: ''
  })
  const [uploadResults, setUploadResults] = useState<{
    success: number
    errors: { row: number; error: string }[]
  } | null>(null)

  const supabase = createSupabaseClient()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
      toast.error('엑셀 파일만 업로드 가능합니다.')
      return
    }

    setFile(selectedFile)
    parseExcelFile(selectedFile)
  }

  const parseExcelFile = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      const parsedData: ExcelRowData[] = jsonData.map((row: any) => ({
        예약일시: row['예약일시'] || '',
        예약시간: row['예약시간'] || '',
        진료번호: row['진료번호'] || '',
        환자명: row['환자명'] || '',
        예약의사: row['예약의사'] || '',
        진료내역: row['진료내역'] || '',
        분류: row['분류'] || ''
      }))

      setPreviewData(parsedData.slice(0, 10)) // 미리보기는 첫 10개만
      toast.success(`${jsonData.length}개 행의 데이터를 읽었습니다. 미리보기는 첫 10개 행입니다.`)
    } catch (error) {
      console.error('Error parsing Excel file:', error)
      toast.error('엑셀 파일 파싱 중 오류가 발생했습니다.')
    }
  }

  const validateRow = (row: ExcelRowData): string | null => {
    if (!row.예약일시) return '예약일시가 누락되었습니다.'
    if (!row.예약시간) return '예약시간이 누락되었습니다.'
    if (!row.진료번호) return '진료번호가 누락되었습니다.'
    if (!row.환자명) return '환자명이 누락되었습니다.'
    if (!row.예약의사) return '예약의사가 누락되었습니다.'

    // 분류 검증 강화 - 빈칸, 공백, null, undefined 모두 체크
    const category = row.분류?.toString().trim()
    if (!category || category === '') {
      return '분류가 누락되었습니다. (빈칸은 건너뜁니다)'
    }

    // 유효한 분류가 아닌 경우
    const validCategories = ['가철', '고정', '임플', '임수']
    if (!validCategories.includes(category)) {
      return `분류가 올바르지 않습니다. '${category}'는 유효하지 않습니다. (건너뜁니다)`
    }

    return null
  }

  const handleUpload = async () => {
    if (!file || !user) return

    setIsUploading(true)
    setUploadResults(null)
    setUploadProgress({ current: 0, total: 0, currentRow: '' })

    try {
      // 전체 파일 다시 파싱
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      const allData: ExcelRowData[] = jsonData.map((row: any) => ({
        예약일시: row['예약일시'] || '',
        예약시간: row['예약시간'] || '',
        진료번호: row['진료번호'] || '',
        환자명: row['환자명'] || '',
        예약의사: row['예약의사'] || '',
        진료내역: row['진료내역'] || '',
        분류: row['분류'] || ''
      }))

      // Progress 초기화
      setUploadProgress({ current: 0, total: allData.length, currentRow: '' })

      let successCount = 0
      const errors: { row: number; error: string }[] = []

      // 각 행을 순차 처리
      for (let i = 0; i < allData.length; i++) {
        const row = allData[i]
        
        // Progress 업데이트
        setUploadProgress({
          current: i + 1,
          total: allData.length,
          currentRow: `${row.환자명} (${row.진료번호})`
        })

        const validation = validateRow(row)

        if (validation) {
          errors.push({ row: i + 1, error: validation })
          continue
        }

        try {
          // 날짜와 시간 조합
          const dateTimeStr = `${row.예약일시} ${row.예약시간}`
          const datetime = new Date(dateTimeStr)

          if (isNaN(datetime.getTime())) {
            errors.push({ row: i + 1, error: '유효하지 않은 날짜/시간 형식입니다.' })
            continue
          }

          // 환자 정보 upsert
          const { error: patientError } = await supabase
            .from('patients')
            .upsert({
              patient_number: row.진료번호,
              patient_name: row.환자명,
            })

          if (patientError) {
            errors.push({ row: i + 1, error: `환자 정보 저장 실패: ${patientError.message}` })
            continue
          }

          // 케이스 생성 (배정된 학생은 비어있음)
          const { error: caseError } = await supabase
            .from('cases')
            .insert({
              datetime: datetime.toISOString(),
              category: row.분류 as '가철' | '고정' | '임플' | '임수',
              assigned_resident: row.예약의사,
              patient_number: row.진료번호,
              patient_name: row.환자명,
              assigned_student1: null, // 배정 학생 1 비어있음
              assigned_student2: null, // 배정 학생 2 비어있음
              case_status: '진행중',
              acquisition_method: '장부',
              treatment_details: row.진료내역 || null,
              change_log: [{
                timestamp: new Date().toISOString(),
                user_id: user.id,
                user_name: user.name,
                action: 'case_created_from_excel',
              }]
            })

          if (caseError) {
            errors.push({ row: i + 1, error: `케이스 저장 실패: ${caseError.message}` })
            continue
          }

          successCount++
        } catch (error) {
          errors.push({ row: i + 1, error: `처리 중 오류: ${error}` })
        }
      }

      setUploadResults({ success: successCount, errors })

      if (successCount > 0) {
        toast.success(`${successCount}개 케이스가 성공적으로 업로드되었습니다.`)
      }

      if (errors.length > 0) {
        toast.error(`${errors.length}개 행에서 오류가 발생했습니다.`)
      }

      // 파일 초기화
      setFile(null)
      setPreviewData([])
      const fileInput = document.getElementById('file-input') as HTMLInputElement
      if (fileInput) fileInput.value = ''

    } catch (error) {
      console.error('Error uploading Excel file:', error)
      toast.error('엑셀 업로드 중 오류가 발생했습니다.')
    } finally {
      setIsUploading(false)
      setUploadProgress({ current: 0, total: 0, currentRow: '' })
    }
  }

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
        <h1 className="text-3xl font-bold">엑셀 업로드</h1>
        <p className="text-muted-foreground mt-2">
          정해진 양식의 엑셀 파일을 업로드하여 케이스를 일괄 등록합니다.
        </p>
      </div>

      {/* 업로드 가이드 */}
      <Alert>
        <FileSpreadsheet className="h-4 w-4" />
        <AlertDescription>
          엑셀 파일은 다음 컬럼을 포함해야 합니다: 예약일시, 예약시간, 진료번호, 환자명, 예약의사, 진료내역, 분류
          <br />
          분류는 '가철', '고정', '임플', '임수' 중 하나여야 합니다.
        </AlertDescription>
      </Alert>

      {/* 파일 업로드 */}
      <Card>
        <CardHeader>
          <CardTitle>파일 업로드</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="file-input">엑셀 파일 선택</Label>
            <Input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="mt-1"
            />
          </div>

          {file && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium">{file.name}</span>
                <Badge variant="secondary">{(file.size / 1024).toFixed(1)} KB</Badge>
              </div>
              <Button
                onClick={handleUpload}
                disabled={isUploading}
                size="sm"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? '업로드 중...' : '업로드'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 업로드 진행 상황 */}
      {isUploading && uploadProgress.total > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">업로드 진행 상황</span>
                <span className="font-medium">
                  {uploadProgress.current} / {uploadProgress.total}
                </span>
              </div>
              <Progress 
                value={(uploadProgress.current / uploadProgress.total) * 100} 
                className="w-full"
              />
              {uploadProgress.currentRow && (
                <p className="text-sm text-muted-foreground">
                  처리 중: {uploadProgress.currentRow}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 미리보기 */}
      {previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>데이터 미리보기 (첫 10개 행)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>예약일시</TableHead>
                    <TableHead>예약시간</TableHead>
                    <TableHead>진료번호</TableHead>
                    <TableHead>환자명</TableHead>
                    <TableHead>예약의사</TableHead>
                    <TableHead>진료내역</TableHead>
                    <TableHead>분류</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{row.예약일시}</TableCell>
                      <TableCell>{row.예약시간}</TableCell>
                      <TableCell>{row.진료번호}</TableCell>
                      <TableCell>{row.환자명}</TableCell>
                      <TableCell>{row.예약의사}</TableCell>
                      <TableCell className="max-w-xs truncate">{row.진료내역}</TableCell>
                      <TableCell>
                        {(() => {
                          const category = row.분류?.toString().trim()
                          const isValid = category && ['가철', '고정', '임플', '임수'].includes(category)
                          return (
                            <Badge
                              variant={isValid ? "outline" : "destructive"}
                              className={!isValid ? "text-white" : ""}
                            >
                              {category || '빈칸'}
                              {!isValid && " (무시됨)"}
                            </Badge>
                          )
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 업로드 결과 */}
      {uploadResults && (
        <Card>
          <CardHeader>
            <CardTitle>업로드 결과</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Check className="h-5 w-5 text-green-600" />
                <span className="text-green-600 font-medium">성공: {uploadResults.success}개</span>
              </div>
              {uploadResults.errors.length > 0 && (
                <div className="flex items-center space-x-2">
                  <X className="h-5 w-5 text-red-600" />
                  <span className="text-red-600 font-medium">실패: {uploadResults.errors.length}개</span>
                </div>
              )}
            </div>

            {uploadResults.errors.length > 0 && (
              <div>
                <h4 className="font-medium text-red-600 mb-2">오류 목록</h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {uploadResults.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {error.row}번째 행: {error.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}