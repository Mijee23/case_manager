'use client'

import { useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'
import { ExcelRowData, Case } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Upload, FileSpreadsheet, Check, X, AlertTriangle, Info, Eye } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import * as XLSX from 'xlsx'

// 중복 검사 결과 타입 정의
interface DuplicateCheckResult {
  exactDuplicates: ExcelRowData[]
  partialDuplicates: Array<{
    excelRow: ExcelRowData
    existingCase: Case
    shouldInclude: boolean
  }>
  uniqueCases: ExcelRowData[]
}

export default function ExcelUploadPage() {
  const { user } = useUser()
  const [file, setFile] = useState<File | null>(null)
  const [previewData, setPreviewData] = useState<ExcelRowData[]>([])
  const [duplicateCheckResults, setDuplicateCheckResults] = useState<DuplicateCheckResult | null>(null)
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false)
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
  const [selectedCaseForDetail, setSelectedCaseForDetail] = useState<Case | null>(null)
  const [showCaseDetailDialog, setShowCaseDetailDialog] = useState(false)

  const supabase = createSupabaseClient()

  // 상태에 따른 Badge variant 결정 함수
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case '완료':
        return 'outline'
      case '실패':
        return 'destructive'
      case '진행중':
        return 'secondary'
      default:
        return 'secondary'
    }
  }

  // 중복 케이스 검사 함수
  const checkForDuplicates = async (data: ExcelRowData[]): Promise<DuplicateCheckResult> => {
    const exactDuplicates: ExcelRowData[] = []
    const partialDuplicates: Array<{
      excelRow: ExcelRowData
      existingCase: Case
      shouldInclude: boolean
    }> = []
    const uniqueCases: ExcelRowData[] = []

    for (const row of data) {
      // 유효하지 않은 행은 건너뛰기
      const validationError = validateRow(row)
      if (validationError) {
        continue
      }

      try {
        // 날짜와 시간 조합
        const dateTimeStr = `${row.예약일시} ${row.예약시간}`
        const datetime = new Date(dateTimeStr)

        if (isNaN(datetime.getTime())) continue

        // 데이터베이스에서 같은 환자번호의 케이스 검색 (학생 정보 포함)
        const { data: existingCases, error } = await supabase
          .from('cases')
          .select(`
            *,
            student1:assigned_student1(id, name, number),
            student2:assigned_student2(id, name, number)
          `)
          .eq('patient_number', row.진료번호)

        if (error) {
          console.error('Error checking duplicates:', error)
          uniqueCases.push(row)
          continue
        }

        if (!existingCases || existingCases.length === 0) {
          uniqueCases.push(row)
          continue
        }

        // 완전 일치 검사 (일시, 시간, 환자번호, 전공의명, 분류 모두 같음)
        const exactMatch = existingCases.find(existingCase => {
          const existingDateTime = new Date(existingCase.datetime)
          return (
            Math.abs(existingDateTime.getTime() - datetime.getTime()) < 60000 && // 1분 이내 차이 허용
            existingCase.patient_number === row.진료번호 &&
            existingCase.assigned_resident === row.예약의사 &&
            existingCase.category === row.분류
          )
        })

        if (exactMatch) {
          exactDuplicates.push(row)
        } else {
          // 부분 일치 - 환자번호가 같은데 일시, 시간, 전공의명, 분류 중 하나 이상이 다른 경우
          const partialMatch = existingCases.find(existingCase => {
            const existingDateTime = new Date(existingCase.datetime)
            return (
              existingCase.patient_number === row.진료번호 && (
                Math.abs(existingDateTime.getTime() - datetime.getTime()) >= 60000 || // 시간이 다르거나
                existingCase.assigned_resident !== row.예약의사 || // 전공의가 다르거나
                existingCase.category !== row.분류 // 분류가 다른 경우
              )
            )
          })

          if (partialMatch) {
            partialDuplicates.push({
              excelRow: row,
              existingCase: partialMatch,
              shouldInclude: false // 기본값은 체크 해제
            })
          } else {
            // 이상한 경우이지만 안전하게 고유 케이스로 처리
            uniqueCases.push(row)
          }
        }

      } catch (error) {
        console.error('Error processing row:', error)
        uniqueCases.push(row) // 오류 발생 시 고유 케이스로 처리
      }
    }

    return { exactDuplicates, partialDuplicates, uniqueCases }
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.match(/\.(xlsx|xls)$/)) {
      toast.error('엑셀 파일만 업로드 가능합니다.')
      return
    }

    setFile(selectedFile)
    // 파일 변경 시 기존 결과 초기화
    setDuplicateCheckResults(null)
    setUploadResults(null)
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
      toast.success(`${jsonData.length}개 행의 데이터를 읽었습니다.`)

      // 중복 검사 수행
      performDuplicateCheck(parsedData)
    } catch (error) {
      console.error('Error parsing Excel file:', error)
      toast.error('엑셀 파일 파싱 중 오류가 발생했습니다.')
    }
  }

  const performDuplicateCheck = async (data: ExcelRowData[]) => {
    setIsCheckingDuplicates(true)
    try {
      const results = await checkForDuplicates(data)
      setDuplicateCheckResults(results)

      toast.info(
        `중복 검사 완료: 완전 중복 ${results.exactDuplicates.length}개, ` +
        `선택 검토 ${results.partialDuplicates.length}개, ` +
        `신규 ${results.uniqueCases.length}개`
      )
    } catch (error) {
      console.error('Error checking duplicates:', error)
      toast.error('중복 검사 중 오류가 발생했습니다.')
    } finally {
      setIsCheckingDuplicates(false)
    }
  }

  // 부분 중복 케이스 체크박스 상태 업데이트
  const togglePartialDuplicate = (index: number) => {
    if (!duplicateCheckResults) return

    const updated = { ...duplicateCheckResults }
    updated.partialDuplicates[index].shouldInclude = !updated.partialDuplicates[index].shouldInclude
    setDuplicateCheckResults(updated)
  }

  // 케이스 상세 정보 보기
  const showCaseDetail = (caseData: Case) => {
    setSelectedCaseForDetail(caseData)
    setShowCaseDetailDialog(true)
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
    if (!user || !duplicateCheckResults) return

    // 업로드할 케이스 목록 준비
    const casesToUpload: ExcelRowData[] = [
      ...duplicateCheckResults.uniqueCases, // 고유 케이스는 모두 포함
      ...duplicateCheckResults.partialDuplicates
        .filter(item => item.shouldInclude) // 선택된 부분 중복 케이스만 포함
        .map(item => item.excelRow)
      // 완전 중복 케이스는 제외
    ]

    if (casesToUpload.length === 0) {
      toast.error('등록할 케이스가 없습니다.')
      return
    }

    setIsUploading(true)
    setUploadResults(null)
    setUploadProgress({ current: 0, total: 0, currentRow: '' })

    try {

      // Progress 초기화
      setUploadProgress({ current: 0, total: casesToUpload.length, currentRow: '' })

      let successCount = 0
      const errors: { row: number; error: string }[] = []

      // 각 행을 순차 처리
      for (let i = 0; i < casesToUpload.length; i++) {
        const row = casesToUpload[i]

        // Progress 업데이트
        setUploadProgress({
          current: i + 1,
          total: casesToUpload.length,
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

      // 파일 및 상태 초기화
      setFile(null)
      setPreviewData([])
      setDuplicateCheckResults(null)
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
                disabled={isUploading || isCheckingDuplicates || !duplicateCheckResults}
                size="sm"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isUploading ? '업로드 중...' :
                 isCheckingDuplicates ? '중복 검사 중...' :
                 duplicateCheckResults ? '선택된 케이스 등록' : '업로드'}
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

      {/* 중복 검사 결과 */}
      {duplicateCheckResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              중복 검사 결과
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 요약 정보 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                <Check className="h-4 w-4 text-green-600" />
                <div>
                  <div className="text-sm font-medium text-green-700">신규 케이스</div>
                  <div className="text-lg font-bold text-green-800">{duplicateCheckResults.uniqueCases.length}개</div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <div>
                  <div className="text-sm font-medium text-yellow-700">검토 필요</div>
                  <div className="text-lg font-bold text-yellow-800">
                    {duplicateCheckResults.partialDuplicates.length}개
                    <span className="text-sm font-normal ml-1">
                      ({duplicateCheckResults.partialDuplicates.filter(item => item.shouldInclude).length}개 선택됨)
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                <X className="h-4 w-4 text-red-600" />
                <div>
                  <div className="text-sm font-medium text-red-700">완전 중복</div>
                  <div className="text-lg font-bold text-red-800">{duplicateCheckResults.exactDuplicates.length}개</div>
                </div>
              </div>
            </div>

            {/* 완전 중복 케이스 */}
            {duplicateCheckResults.exactDuplicates.length > 0 && (
              <div>
                <h4 className="font-medium text-red-600 mb-2">완전 중복 (자동 스킵)</h4>
                <div className="max-h-40 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-red-50">
                        <TableHead>일시</TableHead>
                        <TableHead>환자번호</TableHead>
                        <TableHead>환자명</TableHead>
                        <TableHead>전공의</TableHead>
                        <TableHead>분류</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {duplicateCheckResults.exactDuplicates.map((row, index) => (
                        <TableRow key={index}>
                          <TableCell>{`${row.예약일시} ${row.예약시간}`}</TableCell>
                          <TableCell>{row.진료번호}</TableCell>
                          <TableCell>{row.환자명}</TableCell>
                          <TableCell>{row.예약의사}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.분류}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* 부분 중복 케이스 (선택 가능) */}
            {duplicateCheckResults.partialDuplicates.length > 0 && (
              <div>
                <h4 className="font-medium text-yellow-600 mb-2">검토 필요 - 등록할 케이스 선택</h4>
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-yellow-50">
                        <TableHead className="w-12">선택</TableHead>
                        <TableHead>신규 케이스</TableHead>
                        <TableHead>기존 케이스</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead className="w-20">상세</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {duplicateCheckResults.partialDuplicates.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Checkbox
                              checked={item.shouldInclude}
                              onCheckedChange={() => togglePartialDuplicate(index)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{item.excelRow.환자명} ({item.excelRow.진료번호})</div>
                              <div className="text-sm text-muted-foreground">
                                {`${item.excelRow.예약일시} ${item.excelRow.예약시간}`}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                전공의: {item.excelRow.예약의사} | 분류: {item.excelRow.분류}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{item.existingCase.patient_name} ({item.existingCase.patient_number})</div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(item.existingCase.datetime).toLocaleString()}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                전공의: {item.existingCase.assigned_resident} | 분류: {item.existingCase.category}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                item.existingCase.case_status === '완료' ? 'outline' :
                                item.existingCase.case_status === '실패' ? 'destructive' : 'secondary'
                              }
                            >
                              {item.existingCase.case_status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => showCaseDetail(item.existingCase)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
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

      {/* 케이스 상세보기 다이얼로그 */}
      <Dialog open={showCaseDetailDialog} onOpenChange={setShowCaseDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>기존 케이스 상세정보</DialogTitle>
          </DialogHeader>
          {selectedCaseForDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>일시</Label>
                  <p className="text-sm">{format(new Date(selectedCaseForDetail.datetime), 'yyyy-MM-dd HH:mm', { locale: ko })}</p>
                </div>
                <div>
                  <Label>분류</Label>
                  <p className="text-sm">{selectedCaseForDetail.category}</p>
                </div>
                <div>
                  <Label>담당 전공의</Label>
                  <p className="text-sm">{selectedCaseForDetail.assigned_resident}</p>
                </div>
                <div>
                  <Label>환자번호</Label>
                  <p className="text-sm">{selectedCaseForDetail.patient_number}</p>
                </div>
                <div>
                  <Label>환자명</Label>
                  <p className="text-sm">{selectedCaseForDetail.patient_name}</p>
                </div>
                <div>
                  <Label>상태</Label>
                  <Badge variant={getStatusBadgeVariant(selectedCaseForDetail.case_status)}>
                    {selectedCaseForDetail.case_status}
                  </Badge>
                </div>
                <div>
                  <Label>획득경로</Label>
                  <Badge variant="secondary">{selectedCaseForDetail.acquisition_method}</Badge>
                </div>
                <div>
                  <Label>등록일</Label>
                  <p className="text-sm">{format(new Date(selectedCaseForDetail.created_at), 'yyyy-MM-dd HH:mm', { locale: ko })}</p>
                </div>
              </div>

              {selectedCaseForDetail.treatment_details && (
                <div>
                  <Label>진료내역</Label>
                  <p className="text-sm mt-1 p-2 bg-gray-50 rounded border">{selectedCaseForDetail.treatment_details}</p>
                </div>
              )}

              {selectedCaseForDetail.note && (
                <div>
                  <Label>Note</Label>
                  <p className="text-sm mt-1 p-2 bg-gray-50 rounded border">{selectedCaseForDetail.note}</p>
                </div>
              )}

              {/* 배정된 학생 정보 */}
              <div>
                <Label>배정 학생</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <p className="text-xs text-muted-foreground">학생 1</p>
                    <p className="text-sm">
                      {(selectedCaseForDetail as any).student1 ?
                        `${(selectedCaseForDetail as any).student1.name} (${(selectedCaseForDetail as any).student1.number})` :
                        '미배정'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">학생 2</p>
                    <p className="text-sm">
                      {(selectedCaseForDetail as any).student2 ?
                        `${(selectedCaseForDetail as any).student2.name} (${(selectedCaseForDetail as any).student2.number})` :
                        '미배정'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}