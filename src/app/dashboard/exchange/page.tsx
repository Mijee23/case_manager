'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'
import { useStudentMaster } from '@/hooks/useStudentMaster'
import StudentSelectorNew from '@/components/StudentSelectorNew'
import { studentCaseAnalytics } from '@/utils/studentCaseAnalytics'
import { Case, User } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { toast } from 'sonner'
import { RefreshCcw } from 'lucide-react'

export default function ExchangePage() {
  const { user } = useUser()
  // const { studentOptions } = useStudentMaster() // 새 컴포넌트로 대체됨
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [myCases, setMyCases] = useState<Case[]>([])
  const [theirCases, setTheirCases] = useState<Case[]>([])
  const [selectedMyCase, setSelectedMyCase] = useState<Case | null>(null)
  const [selectedTheirCase, setSelectedTheirCase] = useState<Case | null>(null)
  const [isExchangeDialogOpen, setIsExchangeDialogOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const supabase = createSupabaseClient()

  useEffect(() => {
    fetchMyCases()
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (selectedStudent) {
      fetchTheirCases(selectedStudent)
    } else {
      setTheirCases([])
    }
  }, [selectedStudent])

  const fetchMyCases = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .or(`assigned_student1.eq.${user.id},assigned_student2.eq.${user.id}`)
        .eq('case_status', '진행중')
        .order('datetime', { ascending: false })

      if (error) throw error

      setMyCases(data || [])
    } catch (error) {
      console.error('Error fetching my cases:', error)
    }
  }

  const fetchTheirCases = async (studentId: string) => {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .or(`assigned_student1.eq.${studentId},assigned_student2.eq.${studentId}`)
        .eq('case_status', '진행중')
        .order('datetime', { ascending: false })

      if (error) throw error

      setTheirCases(data || [])
    } catch (error) {
      console.error('Error fetching their cases:', error)
    }
  }

  const handleExchange = async () => {
    if (!selectedMyCase || !selectedTheirCase || !user) return

    try {
      const now = new Date().toISOString()
      
      // 케이스 교환 로직: 완전한 소유권 교체
      
      // 1. 내 케이스에서 나를 찾아서 상대방으로 교체
      const myCaseUpdate: any = {}
      
      if (selectedMyCase.assigned_student1 === user.id) {
        myCaseUpdate.assigned_student1 = selectedStudent
        // assigned_student2는 그대로 유지 (있다면)
        if (selectedMyCase.assigned_student2) {
          myCaseUpdate.assigned_student2 = selectedMyCase.assigned_student2
        }
      } else if (selectedMyCase.assigned_student2 === user.id) {
        myCaseUpdate.assigned_student2 = selectedStudent
        // assigned_student1은 그대로 유지
        if (selectedMyCase.assigned_student1) {
          myCaseUpdate.assigned_student1 = selectedMyCase.assigned_student1
        }
      }

      // 2. 상대방 케이스에서 상대방을 찾아서 나로 교체
      const theirCaseUpdate: any = {}
      
      if (selectedTheirCase.assigned_student1 === selectedStudent) {
        theirCaseUpdate.assigned_student1 = user.id
        console.log('selectedTheirCase.assigned_student1 === selectedStudent', selectedTheirCase.assigned_student1,selectedStudent)
        // assigned_student2는 그대로 유지 (있다면)
        if (selectedTheirCase.assigned_student2) {
          theirCaseUpdate.assigned_student2 = selectedTheirCase.assigned_student2
        }
      } else if (selectedTheirCase.assigned_student2 === selectedStudent) {
        theirCaseUpdate.assigned_student2 = user.id
        console.log('selectedTheirCase.assigned_student2 === selectedStudent', selectedTheirCase.assigned_student2,selectedStudent)
        // assigned_student1은 그대로 유지
        if (selectedTheirCase.assigned_student1) {
          theirCaseUpdate.assigned_student1 = selectedTheirCase.assigned_student1
        }
      }

      console.log('📋 교환 로직 검증:', {
        selectedStudent,
        user: { id: user.id, name: user.name },
        myCase: {
          id: selectedMyCase.id,
          before: { student1: selectedMyCase.assigned_student1, student2: selectedMyCase.assigned_student2 },
          after: myCaseUpdate
        },
        theirCase: {
          id: selectedTheirCase.id,
          before: { student1: selectedTheirCase.assigned_student1, student2: selectedTheirCase.assigned_student2 },
          after: theirCaseUpdate
        }
      })

      console.log('🚀 Promise.all 실행 직전 - state 값들:', {
        selectedStudentAtExecution: selectedStudent,
        selectedMyCaseAtExecution: {
          id: selectedMyCase.id,
          student1: selectedMyCase.assigned_student1,
          student2: selectedMyCase.assigned_student2
        },
        selectedTheirCaseAtExecution: {
          id: selectedTheirCase.id,
          student1: selectedTheirCase.assigned_student1,
          student2: selectedTheirCase.assigned_student2
        }
      })

    // 업데이트 실행 (순차 실행으로 변경하여 트랜잭션 충돌 방지)
    console.log('🔄 MyCase 업데이트 시작...')
    const myResult = await supabase
      .from('cases')
      .update(myCaseUpdate)
      .eq('id', selectedMyCase.id)

    console.log('🔄 MyCase 업데이트 완료:', {
      error: myResult.error,
      status: myResult.status,
      data: myResult.data
    })

    console.log('🔄 TheirCase 업데이트 시작...')
    const theirResult = await supabase
      .from('cases')
      .update(theirCaseUpdate)
      .eq('id', selectedTheirCase.id)

    console.log('🔄 TheirCase 업데이트 완료:', {
      error: theirResult.error,
      status: theirResult.status,
      data: theirResult.data
    })

    console.log('✅ Promise.all 결과:', {
      myResult: {
        error: myResult.error,
        data: myResult.data,
        status: myResult.status
      },
      theirResult: {
        error: theirResult.error,
        data: theirResult.data,
        status: theirResult.status
      }
    })

    if (myResult.error) throw myResult.error
    if (theirResult.error) throw theirResult.error

      // 업데이트 후 실제 DB 값 확인 (순차 실행)
      console.log('🔍 DB 값 확인 시작...')
      const updatedMyCase = await supabase.from('cases').select('*').eq('id', selectedMyCase.id).single()
      const updatedTheirCase = await supabase.from('cases').select('*').eq('id', selectedTheirCase.id).single()

      console.log('🔍 DB 업데이트 후 실제 값 확인:', {
        updatedMyCase: {
          id: updatedMyCase.data?.id,
          student1: updatedMyCase.data?.assigned_student1,
          student2: updatedMyCase.data?.assigned_student2,
          error: updatedMyCase.error
        },
        updatedTheirCase: {
          id: updatedTheirCase.data?.id,
          student1: updatedTheirCase.data?.assigned_student1,
          student2: updatedTheirCase.data?.assigned_student2,
          error: updatedTheirCase.error
        }
      })

      // change_log 별도 업데이트
      const myChangelogEntry = {
        timestamp: now,
        user_id: user.id,
        user_name: user.name,
        action: 'case_exchange_out',
        target_case_id: selectedTheirCase.id,
        target_student_id: selectedStudent,
        target_student_name: 'Unknown',
      }

      const theirChangelogEntry = {
        timestamp: now,
        user_id: user.id,
        user_name: user.name,
        action: 'case_exchange_in',
        source_case_id: selectedMyCase.id,
        source_student_id: user.id,
        source_student_name: user.name,
      }

      // 🔍 change_log 업데이트 전 DB 값 확인
      console.log('📝 change_log 업데이트 전 DB 상태:', {
        updatedMyCase: {
          id: updatedMyCase.data?.id,
          student1: updatedMyCase.data?.assigned_student1,
          student2: updatedMyCase.data?.assigned_student2
        },
        updatedTheirCase: {
          id: updatedTheirCase.data?.id,
          student1: updatedTheirCase.data?.assigned_student1,
          student2: updatedTheirCase.data?.assigned_student2
        }
      })

      // 업데이트된 케이스에서 change_log 가져오기 (교환 후 데이터 기준)
      const myExistingChangelog = Array.isArray(updatedMyCase.data?.change_log) ? updatedMyCase.data.change_log : []
      const theirExistingChangelog = Array.isArray(updatedTheirCase.data?.change_log) ? updatedTheirCase.data.change_log : []

      console.log('📝 change_log 업데이트 시작:', {
        myChangelogEntry,
        theirChangelogEntry,
        myExistingChangelogLength: myExistingChangelog.length,
        theirExistingChangelogLength: theirExistingChangelog.length
      })

      const changelogResults = await Promise.all([
        supabase
          .from('cases')
          .update({ change_log: [...myExistingChangelog, myChangelogEntry] })
          .eq('id', selectedMyCase.id),
        supabase
          .from('cases')
          .update({ change_log: [...theirExistingChangelog, theirChangelogEntry] })
          .eq('id', selectedTheirCase.id)
      ])

      console.log('📝 change_log 업데이트 결과:', {
        myChangelogResult: {
          error: changelogResults[0].error,
          status: changelogResults[0].status
        },
        theirChangelogResult: {
          error: changelogResults[1].error,
          status: changelogResults[1].status
        }
      })

      // change_log 업데이트 후 최종 DB 값 확인
      const [finalMyCase, finalTheirCase] = await Promise.all([
        supabase.from('cases').select('*').eq('id', selectedMyCase.id).single(),
        supabase.from('cases').select('*').eq('id', selectedTheirCase.id).single()
      ])

      console.log('🏁 change_log 업데이트 후 최종 DB 값:', {
        finalMyCase: {
          id: finalMyCase.data?.id,
          student1: finalMyCase.data?.assigned_student1,
          student2: finalMyCase.data?.assigned_student2,
          changelogLength: Array.isArray(finalMyCase.data?.change_log) ? finalMyCase.data.change_log.length : 0
        },
        finalTheirCase: {
          id: finalTheirCase.data?.id,
          student1: finalTheirCase.data?.assigned_student1,
          student2: finalTheirCase.data?.assigned_student2,
          changelogLength: Array.isArray(finalTheirCase.data?.change_log) ? finalTheirCase.data.change_log.length : 0
        }
      })

      // 교환 후 두 학생의 케이스 수 동기화
      try {
        await Promise.all([
          studentCaseAnalytics.syncStudentCaseCount(user.id),
          studentCaseAnalytics.syncStudentCaseCount(selectedStudent)
        ])
      } catch (syncError) {
        console.error('Failed to sync case counts after exchange:', syncError)
      }

      toast.success('케이스 교환이 완료되었습니다.')

      // 데이터 새로고침
      await fetchMyCases()
      if (selectedStudent) {
        await fetchTheirCases(selectedStudent)
      }

      // 상태 초기화
      setSelectedMyCase(null)
      setSelectedTheirCase(null)
      setIsExchangeDialogOpen(false)
    } catch (error) {
      console.error('Error exchanging cases:', error)
      toast.error('케이스 교환 중 오류가 발생했습니다.')
    }
  }

  if (!user || user.role !== '학생') {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">케이스 교환 권한이 없습니다.</p>
      </div>
    )
  }

  if (loading) {
    return <div>로딩 중...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">케이스 교환</h1>
        <p className="text-muted-foreground mt-2">
          다른 학생과 1:1로 케이스를 교환할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-6">
        {/* 학생 선택 */}
        <Card>
          <CardHeader>
            <CardTitle>교환할 학생 선택</CardTitle>
          </CardHeader>
          <CardContent>
            <StudentSelectorNew
              value={selectedStudent}
              onValueChange={setSelectedStudent}
              placeholder="교환할 학생을 선택하세요"
              allowNone={false}
            />
          </CardContent>
        </Card>

        {selectedStudent && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* 내 케이스 */}
            <Card>
              <CardHeader>
                <CardTitle>내 케이스</CardTitle>
              </CardHeader>
              <CardContent>
                {myCases.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    교환 가능한 케이스가 없습니다.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {myCases.map(case_ => (
                      <div
                        key={case_.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedMyCase?.id === case_.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-primary/50'
                        }`}
                        onClick={() => setSelectedMyCase(case_)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{case_.patient_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(case_.datetime), 'MM/dd HH:mm', { locale: ko })}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline">{case_.category}</Badge>
                            <p className="text-sm text-muted-foreground mt-1">
                              {case_.assigned_resident}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 상대방 케이스 */}
            <Card>
              <CardHeader>
                <CardTitle>
                  선택된 학생의 케이스
                </CardTitle>
              </CardHeader>
              <CardContent>
                {theirCases.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    교환 가능한 케이스가 없습니다.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {theirCases.map(case_ => (
                      <div
                        key={case_.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedTheirCase?.id === case_.id
                            ? 'border-primary bg-primary/5'
                            : 'hover:border-primary/50'
                        }`}
                        onClick={() => setSelectedTheirCase(case_)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{case_.patient_name}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(case_.datetime), 'MM/dd HH:mm', { locale: ko })}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline">{case_.category}</Badge>
                            <p className="text-sm text-muted-foreground mt-1">
                              {case_.assigned_resident}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* 교환 버튼 */}
        {selectedMyCase && selectedTheirCase && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center space-x-4">
                <div className="text-center">
                  <p className="font-medium">{selectedMyCase.patient_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedMyCase.category}</p>
                </div>

                <RefreshCcw className="h-6 w-6 text-muted-foreground" />

                <div className="text-center">
                  <p className="font-medium">{selectedTheirCase.patient_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedTheirCase.category}</p>
                </div>
              </div>

              <div className="mt-4 flex justify-center">
                <Button onClick={() => setIsExchangeDialogOpen(true)}>
                  케이스 교환하기
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 교환 확인 다이얼로그 */}
      <Dialog open={isExchangeDialogOpen} onOpenChange={setIsExchangeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>케이스 교환 확인</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>다음 케이스들을 교환하시겠습니까?</p>

            <div className="space-y-2">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">내 케이스</p>
                <p className="text-sm">{selectedMyCase?.patient_name} - {selectedMyCase?.category}</p>
                <p className="text-sm text-muted-foreground">{selectedMyCase?.assigned_resident}</p>
              </div>

              <div className="text-center">
                <RefreshCcw className="h-4 w-4 mx-auto text-muted-foreground" />
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">
                  선택된 학생의 케이스
                </p>
                <p className="text-sm">{selectedTheirCase?.patient_name} - {selectedTheirCase?.category}</p>
                <p className="text-sm text-muted-foreground">{selectedTheirCase?.assigned_resident}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsExchangeDialogOpen(false)}
              >
                취소
              </Button>
              <Button onClick={handleExchange}>
                교환하기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}