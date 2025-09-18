'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'
import { Case } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { toast } from 'sonner'
import { RefreshCw, User2 } from 'lucide-react'

interface CaseWithStudents extends Case {
  student1?: { id: string; name: string; number: string } | null
  student2?: { id: string; name: string; number: string } | null
}

export default function MyResidentCasesPage() {
  const { user } = useUser()
  const [cases, setCases] = useState<CaseWithStudents[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    month: 'all',
    category: 'all',
    resident: 'all',
  })

  const supabase = createSupabaseClient()

  useEffect(() => {
    if (user?.role === '전공의') {
      fetchMyCases()
    }
  }, [user])

  // 실시간 업데이트 구독
  useEffect(() => {
    if (!user || user.role !== '전공의') return

    const channel = supabase
      .channel('resident-cases')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cases',
        },
        (payload: any) => {
          console.log('Resident cases real-time update:', payload)
          fetchMyCases()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, supabase])

  const fetchMyCases = async () => {
    if (!user || user.role !== '전공의') return

    try {
      // 모든 케이스 조회 (전공의는 전체 케이스를 볼 수 있음)
      const { data: casesData, error } = await supabase
        .from('cases')
        .select('*')
        .order('datetime', { ascending: false })

      if (error) throw error

      // 학생 정보를 별도로 조회
      const studentIds = new Set<string>()
      casesData?.forEach((case_: any) => {
        if (case_.assigned_student1) studentIds.add(case_.assigned_student1)
        if (case_.assigned_student2) studentIds.add(case_.assigned_student2)
      })

      let studentsData: any[] = []
      if (studentIds.size > 0) {
        const { data: students, error: studentsError } = await supabase
          .from('users')
          .select('id, name, number')
          .in('id', Array.from(studentIds))

        if (studentsError) {
          console.error('Error fetching students:', studentsError)
        } else {
          studentsData = students || []
        }
      }

      // 케이스 데이터와 학생 정보를 결합
      const casesWithStudents = casesData?.map((case_: any) => ({
        ...case_,
        student1: studentsData.find(s => s.id === case_.assigned_student1) || null,
        student2: studentsData.find(s => s.id === case_.assigned_student2) || null
      })) || []

      setCases(casesWithStudents)
    } catch (error) {
      console.error('Error fetching my cases:', error)
      toast.error('케이스를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case '완료': return 'default'
      case '실패': return 'destructive'
      case '진행중': return 'secondary'
      default: return 'outline'
    }
  }


  const getUniqueResidents = () => {
    return [...new Set(cases.map(case_ => case_.assigned_resident))].sort()
  }

  const categories = ['가철', '고정', '임플', '임수']

  // 필터링 로직
  const filteredCases = cases.filter(case_ => {
    const matchesMonth = filters.month === 'all' ||
      new Date(case_.datetime).getMonth() + 1 === parseInt(filters.month)

    const matchesCategory = filters.category === 'all' || case_.category === filters.category

    const matchesResident = filters.resident === 'all' || case_.assigned_resident === filters.resident

    return matchesMonth && matchesCategory && matchesResident
  })

  if (loading) {
    return <div>로딩 중...</div>
  }

  if (!user || user.role !== '전공의') {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">전공의 권한이 필요합니다.</p>
      </div>
    )
  }


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">전체 케이스 확인</h1>
          <p className="text-muted-foreground mt-2">
            모든 케이스를 월별, 전공의별, 케이스 타입별로 필터링하여 확인할 수 있습니다.
          </p>
        </div>
        <Button onClick={fetchMyCases} disabled={loading} size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>


      {/* 필터 및 케이스 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User2 className="h-5 w-5" />
            케이스 목록 ({filteredCases.length}개)
          </CardTitle>
          <div className="flex flex-wrap gap-4 mt-4">
            <Select value={filters.month} onValueChange={(value) =>
              setFilters(prev => ({ ...prev, month: value }))
            }>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="월" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                  <SelectItem key={month} value={month.toString()}>{month}월</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.category} onValueChange={(value) =>
              setFilters(prev => ({ ...prev, category: value }))
            }>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="분류" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 분류</SelectItem>
                <SelectItem value="가철">가철</SelectItem>
                <SelectItem value="고정">고정</SelectItem>
                <SelectItem value="임플">임플</SelectItem>
                <SelectItem value="임수">임수</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.resident} onValueChange={(value) =>
              setFilters(prev => ({ ...prev, resident: value }))
            }>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="담당 전공의" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 전공의</SelectItem>
                {getUniqueResidents().map(resident => (
                  <SelectItem key={resident} value={resident}>{resident}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>일시</TableHead>
                  <TableHead>분류</TableHead>
                  <TableHead>담당 전공의</TableHead>
                  <TableHead>환자번호</TableHead>
                  <TableHead>환자명</TableHead>
                  <TableHead>배정 학생 1</TableHead>
                  <TableHead>배정 학생 2</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      조건에 맞는 케이스가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCases.map((case_) => (
                    <TableRow key={case_.id}>
                      <TableCell>
                        {format(new Date(case_.datetime), 'MM/dd HH:mm', { locale: ko })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{case_.category}</Badge>
                      </TableCell>
                      <TableCell>{case_.assigned_resident}</TableCell>
                      <TableCell>{case_.patient_number}</TableCell>
                      <TableCell>{case_.patient_name}</TableCell>
                      <TableCell>
                        {case_.student1 ? (
                          <div className="text-sm">{case_.student1.name} ({case_.student1.number})</div>
                        ) : (
                          <div className="text-sm text-muted-foreground">미배정</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {case_.student2 ? (
                          <div className="text-sm">{case_.student2.name} ({case_.student2.number})</div>
                        ) : (
                          <div className="text-sm text-muted-foreground">미배정</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(case_.case_status)}>
                          {case_.case_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}