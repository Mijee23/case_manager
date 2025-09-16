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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { toast } from 'sonner'
import { Send } from 'lucide-react'

export default function TransferPage() {
  const { user } = useUser()
  const { studentOptions } = useStudentMaster()
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [myCases, setMyCases] = useState<Case[]>([])
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false)
  const [transferNote, setTransferNote] = useState('')
  const [loading, setLoading] = useState(true)

  const supabase = createSupabaseClient()

  useEffect(() => {
    fetchMyCases()
    setLoading(false)
  }, [user])

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

  const handleTransfer = async () => {
    if (!selectedCase || !selectedStudent || !user) return

    try {
      const now = new Date().toISOString()
      // selectedStudent는 ID이므로 학생 정보는 별도로 조회해야 함
      // TODO: 실제로는 studentMasterManager에서 학생 정보를 조회해야 함

      // 케이스 업데이트 (change_log 제외)
      const updateData: any = {}

      // 내가 student1인지 student2인지 확인하고 업데이트
      if (selectedCase.assigned_student1 === user.id) {
        updateData.assigned_student1 = selectedStudent
      } else if (selectedCase.assigned_student2 === user.id) {
        updateData.assigned_student2 = selectedStudent
      }

      const { error } = await supabase
        .from('cases')
        .update(updateData)
        .eq('id', selectedCase.id)

      if (error) throw error

      // change_log 별도 업데이트
      const changelogEntry = {
        timestamp: now,
        user_id: user.id,
        user_name: user.name,
        action: 'case_transfer',
        from_student_id: user.id,
        from_student_name: user.name,
        to_student_id: selectedStudent,
        to_student_name: 'Unknown',
        note: transferNote || null,
      }

      const existingChangelog = Array.isArray(selectedCase.change_log) ? selectedCase.change_log : []
      const updatedChangelog = [...existingChangelog, changelogEntry]

      const { error: changelogError } = await supabase
        .from('cases')
        .update({ change_log: updatedChangelog })
        .eq('id', selectedCase.id)

      if (changelogError) {
        console.error('Changelog update error:', changelogError)
      }

      // 양도 후 두 학생의 케이스 수 동기화
      try {
        await Promise.all([
          studentCaseAnalytics.syncStudentCaseCount(user.id),
          studentCaseAnalytics.syncStudentCaseCount(selectedStudent)
        ])
      } catch (syncError) {
        console.error('Failed to sync case counts after transfer:', syncError)
      }

      toast.success(`케이스가 양도되었습니다.`)

      // 데이터 새로고침
      await fetchMyCases()

      // 상태 초기화
      setSelectedCase(null)
      setSelectedStudent('')
      setTransferNote('')
      setIsTransferDialogOpen(false)
    } catch (error) {
      console.error('Error transferring case:', error)
      toast.error('케이스 양도 중 오류가 발생했습니다.')
    }
  }

  if (!user || user.role !== '학생') {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">케이스 양도 권한이 없습니다.</p>
      </div>
    )
  }

  if (loading) {
    return <div>로딩 중...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">케이스 양도</h1>
        <p className="text-muted-foreground mt-2">
          내 케이스를 다른 학생에게 양도할 수 있습니다.
        </p>
      </div>

      <div className="grid gap-6">
        {/* 양도받을 학생 선택 */}
        <Card>
          <CardHeader>
            <CardTitle>양도받을 학생 선택</CardTitle>
          </CardHeader>
          <CardContent>
            <StudentSelectorNew
              value={selectedStudent}
              onValueChange={setSelectedStudent}
              placeholder="양도받을 학생을 선택하세요"
              allowNone={false}
            />
          </CardContent>
        </Card>

        {/* 내 케이스 목록 */}
        <Card>
          <CardHeader>
            <CardTitle>양도할 케이스 선택</CardTitle>
          </CardHeader>
          <CardContent>
            {myCases.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                양도 가능한 케이스가 없습니다.
              </p>
            ) : (
              <div className="space-y-2">
                {myCases.map(case_ => (
                  <div
                    key={case_.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedCase?.id === case_.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedCase(case_)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{case_.patient_name}</p>
                        <p className="text-sm text-muted-foreground">
                          환자번호: {case_.patient_number}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(case_.datetime), 'yyyy-MM-dd HH:mm', { locale: ko })}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <Badge variant="outline">{case_.category}</Badge>
                        <p className="text-sm text-muted-foreground">
                          {case_.assigned_resident}
                        </p>
                        <Badge variant="secondary">{case_.acquisition_method}</Badge>
                      </div>
                    </div>

                    {case_.treatment_details && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-sm text-muted-foreground">
                          <strong>진료내역:</strong> {case_.treatment_details}
                        </p>
                      </div>
                    )}

                    {case_.note && (
                      <div className="mt-1">
                        <p className="text-sm text-muted-foreground">
                          <strong>Note:</strong> {case_.note}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 양도 버튼 */}
        {selectedCase && selectedStudent && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center space-x-4">
                  <div>
                    <p className="font-medium">{selectedCase.patient_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedCase.category}</p>
                  </div>

                  <Send className="h-6 w-6 text-muted-foreground" />

                  <div>
                    <p className="font-medium">
                      선택된 학생
                    </p>
                    <p className="text-sm text-muted-foreground">
                      (번호 조회 필요)
                    </p>
                  </div>
                </div>

                <Button onClick={() => setIsTransferDialogOpen(true)} className="mt-4">
                  케이스 양도하기
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 양도 확인 다이얼로그 */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>케이스 양도 확인</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p>다음 케이스를 양도하시겠습니까?</p>

              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedCase?.patient_name}</p>
                <p className="text-sm">{selectedCase?.category} - {selectedCase?.assigned_resident}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedCase && format(new Date(selectedCase.datetime), 'yyyy-MM-dd HH:mm', { locale: ko })}
                </p>
              </div>

              <div className="text-center py-2">
                <Send className="h-4 w-4 mx-auto text-muted-foreground" />
              </div>

              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">
                  {studentOptions.find(s => s.registeredUserId === selectedStudent)?.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  ({studentOptions.find(s => s.registeredUserId === selectedStudent)?.number})
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transferNote">양도 사유 (선택사항)</Label>
              <Textarea
                id="transferNote"
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="양도 사유를 입력하세요"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsTransferDialogOpen(false)}
              >
                취소
              </Button>
              <Button onClick={handleTransfer}>
                양도하기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}