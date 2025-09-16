'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'
import { useStudentCaseStats } from '@/hooks/useStudentCaseStats'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart3, Users, FileText, TrendingUp, RefreshCw, Database } from 'lucide-react'
import { toast } from 'sonner'

interface DashboardStats {
  totalCases: number
  casesPerCategory: { category: string; count: number }[]
  averageCasesPerCategory: { category: string; average: number }[]
  studentDistribution: { caseCount: string; studentCount: number }[]
  caseStatusDistribution: { status: string; count: number }[]
  recentActivity: number
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

export default function AdminDashboardPage() {
  const { user } = useUser()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [maxSettings, setMaxSettings] = useState({
    가철: 3,
    고정: 3,
    임플: 3,
    임수: 3
  })
  const [isSavingMax, setIsSavingMax] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<{ [category: string]: string }>({
    가철: '전체',
    고정: '전체',
    임플: '전체',
    임수: '전체'
  })
  const {
    allStudentStats,
    categoryDistribution,
    loading: studentStatsLoading,
    error: studentStatsError,
    refreshStats,
    syncAllCounts
  } = useStudentCaseStats()

  const supabase = createSupabaseClient()

  // MAX 설정 로드
  useEffect(() => {
    const savedMaxSettings = localStorage.getItem('caseMaxSettings')
    if (savedMaxSettings) {
      try {
        setMaxSettings(JSON.parse(savedMaxSettings))
      } catch (error) {
        console.error('MAX 설정 로드 오류:', error)
      }
    }
  }, [])

  const fetchDashboardStats = async () => {
    try {
      // 전체 케이스 수
      const { count: totalCases } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })

      // 분류별 케이스 수
      const { data: casesData } = await supabase
        .from('cases')
        .select('category')

      const casesPerCategory = ['가철', '고정', '임플', '임수'].map(category => ({
        category,
        count: casesData?.filter(c => c.category === category).length || 0
      }))

      // 케이스 상태별 분포
      const { data: statusData } = await supabase
        .from('cases')
        .select('case_status')

      const caseStatusDistribution = ['완료', '실패', '진행중'].map(status => ({
        status,
        count: statusData?.filter(c => c.case_status === status).length || 0
      }))

      // 학생 수
      const { count: totalStudents } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', '학생')

      // 분류별 평균 소유 케이스 수 (단순화된 계산)
      const averageCasesPerCategory = casesPerCategory.map(item => ({
        category: item.category,
        average: totalStudents ? Math.round((item.count / totalStudents) * 100) / 100 : 0
      }))

      // 학생별 케이스 소유 분포
      const { data: studentCases } = await supabase
        .from('cases')
        .select('assigned_student1, assigned_student2')

      const studentCaseCount: { [key: string]: number } = {}

      studentCases?.forEach(case_ => {
        if (case_.assigned_student1) {
          studentCaseCount[case_.assigned_student1] = (studentCaseCount[case_.assigned_student1] || 0) + 1
        }
        if (case_.assigned_student2) {
          studentCaseCount[case_.assigned_student2] = (studentCaseCount[case_.assigned_student2] || 0) + 1
        }
      })

      const distribution = { '0개': 0, '1개': 0, '2개': 0, '3개 이상': 0 }

      // 모든 학생 조회
      const { data: allStudents } = await supabase
        .from('users')
        .select('id')
        .eq('role', '학생')

      allStudents?.forEach(student => {
        const count = studentCaseCount[student.id] || 0
        if (count === 0) distribution['0개']++
        else if (count === 1) distribution['1개']++
        else if (count === 2) distribution['2개']++
        else distribution['3개 이상']++
      })

      const studentDistribution = Object.entries(distribution).map(([caseCount, studentCount]) => ({
        caseCount,
        studentCount
      }))

      // 최근 활동 (7일 이내)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { count: recentActivity } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', sevenDaysAgo.toISOString())

      setStats({
        totalCases: totalCases || 0,
        casesPerCategory,
        averageCasesPerCategory,
        studentDistribution,
        caseStatusDistribution,
        recentActivity: recentActivity || 0
      })
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.role === '관리자') {
      fetchDashboardStats()
    }
  }, [user])

  if (!user || user.role !== '관리자') {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">관리자 권한이 필요합니다.</p>
      </div>
    )
  }

  if (loading) {
    return <div>로딩 중...</div>
  }

  const handleSyncAllCounts = async () => {
    try {
      await syncAllCounts()
      toast.success('모든 학생의 케이스 수가 동기화되었습니다.')
    } catch (error) {
      toast.error('동기화 중 오류가 발생했습니다.')
    }
  }

  const handleSaveMaxSettings = async () => {
    setIsSavingMax(true)
    try {
      // MAX 설정을 localStorage에 저장 (추후 DB로 이전 가능)
      localStorage.setItem('caseMaxSettings', JSON.stringify(maxSettings))
      toast.success('MAX 설정이 저장되었습니다.')
    } catch (error) {
      toast.error('MAX 설정 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSavingMax(false)
    }
  }

  // 분류별 분석 렌더링 함수
  const renderCategoryAnalysis = (category: '가철' | '고정' | '임플' | '임수', maxValue: number) => {
    const categoryData = categoryDistribution.find(dist => dist.category === category)

    // MAX 값에 따른 동적 분포 계산
    const distributionCounts: { [key: string]: number } = {}
    const distributionData: { range: string; count: number }[] = []

    // 0개부터 maxValue개까지, 그리고 maxValue 초과
    for (let i = 0; i <= maxValue; i++) {
      distributionCounts[`${i}개`] = 0
    }
    distributionCounts[`${maxValue}개 초과`] = 0

    // 학생들의 해당 분류 소유 개수 계산
    allStudentStats.forEach(student => {
      const count = student[category] || 0
      if (count > maxValue) {
        distributionCounts[`${maxValue}개 초과`]++
      } else {
        distributionCounts[`${count}개`]++
      }
    })

    // 차트용 데이터 생성
    for (let i = 0; i <= maxValue; i++) {
      distributionData.push({
        range: `${i}개`,
        count: distributionCounts[`${i}개`]
      })
    }
    distributionData.push({
      range: `${maxValue}개 초과`,
      count: distributionCounts[`${maxValue}개 초과`]
    })

    // 필터된 학생 목록
    const getFilteredStudents = (filterValue: string) => {
      if (filterValue === '전체') return allStudentStats

      if (filterValue === `${maxValue}개 초과`) {
        return allStudentStats.filter(student => student[category] > maxValue)
      } else {
        const targetCount = parseInt(filterValue.replace('개', ''))
        return allStudentStats.filter(student => student[category] === targetCount)
      }
    }

    const filteredStudents = getFilteredStudents(selectedFilter[category])

    return (
      <>
        {/* 기본 통계 */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>전체 케이스</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categoryData?.totalCases || 0}개</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>배정된 케이스</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categoryData?.assignedCases || 0}개</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>학생당 평균</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categoryData?.averagePerStudent || 0}개</div>
            </CardContent>
          </Card>
        </div>

        {/* 소유 분포 표 */}
        <Card>
          <CardHeader>
            <CardTitle>{category} 소유 분포 (MAX: {maxValue}개)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>소유 개수</TableHead>
                    <TableHead>학생 수</TableHead>
                    <TableHead>비율</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {distributionData.map(item => (
                    <TableRow key={item.range}>
                      <TableCell>{item.range}</TableCell>
                      <TableCell>
                        <Badge variant={item.range === `${maxValue}개 초과` ? 'destructive' : 'default'}>
                          {item.count}명
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {allStudentStats.length > 0
                          ? `${Math.round((item.count / allStudentStats.length) * 100)}%`
                          : '0%'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* 막대그래프 */}
        <Card>
          <CardHeader>
            <CardTitle>{category} 소유 분포 차트</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={distributionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 필터링된 학생 목록 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>학생 목록</span>
              <select
                value={selectedFilter[category]}
                onChange={(e) => setSelectedFilter(prev => ({
                  ...prev,
                  [category]: e.target.value
                }))}
                className="px-3 py-1 border rounded"
              >
                <option value="전체">전체 학생</option>
                {distributionData.map(item => (
                  <option key={item.range} value={item.range}>
                    {item.range} 소유 ({item.count}명)
                  </option>
                ))}
              </select>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>번호</TableHead>
                    <TableHead>이름</TableHead>
                    <TableHead>{category} 소유</TableHead>
                    <TableHead>총 케이스</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        해당하는 학생이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudents.map(student => (
                      <TableRow key={student.studentId}>
                        <TableCell>{student.studentNumber}</TableCell>
                        <TableCell>{student.studentName}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              student[category] > maxValue ? 'destructive' :
                              student[category] === 0 ? 'secondary' : 'default'
                            }
                          >
                            {student[category]}개
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{student.total}개</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">관리자 대시보드</h1>
          <p className="text-muted-foreground mt-2">
            시스템 전체 현황을 한눈에 확인할 수 있습니다.
          </p>
        </div>
        <Button onClick={handleSyncAllCounts} disabled={studentStatsLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${studentStatsLoading ? 'animate-spin' : ''}`} />
          케이스 수 동기화
        </Button>
      </div>

      {/* 주요 지표 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 케이스</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCases}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">완료된 케이스</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.caseStatusDistribution.find(s => s.status === '완료')?.count || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">진행 중인 케이스</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.caseStatusDistribution.find(s => s.status === '진행중')?.count || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">최근 7일 활동</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.recentActivity}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">전체 현황</TabsTrigger>
          <TabsTrigger value="students">학생별 분석</TabsTrigger>
          <TabsTrigger value="category-가철">가철 분석</TabsTrigger>
          <TabsTrigger value="category-고정">고정 분석</TabsTrigger>
          <TabsTrigger value="category-임플">임플 분석</TabsTrigger>
          <TabsTrigger value="category-임수">임수 분석</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* MAX 설정 */}
          <Card>
            <CardHeader>
              <CardTitle>분류별 MAX 설정</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 md:grid-cols-5">
                <div>
                  <Label htmlFor="max-가철">가철 MAX</Label>
                  <Input
                    id="max-가철"
                    type="number"
                    min="1"
                    value={maxSettings.가철}
                    onChange={(e) => setMaxSettings(prev => ({
                      ...prev,
                      가철: parseInt(e.target.value) || 1
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="max-고정">고정 MAX</Label>
                  <Input
                    id="max-고정"
                    type="number"
                    min="1"
                    value={maxSettings.고정}
                    onChange={(e) => setMaxSettings(prev => ({
                      ...prev,
                      고정: parseInt(e.target.value) || 1
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="max-임플">임플 MAX</Label>
                  <Input
                    id="max-임플"
                    type="number"
                    min="1"
                    value={maxSettings.임플}
                    onChange={(e) => setMaxSettings(prev => ({
                      ...prev,
                      임플: parseInt(e.target.value) || 1
                    }))}
                  />
                </div>
                <div>
                  <Label htmlFor="max-임수">임수 MAX</Label>
                  <Input
                    id="max-임수"
                    type="number"
                    min="1"
                    value={maxSettings.임수}
                    onChange={(e) => setMaxSettings(prev => ({
                      ...prev,
                      임수: parseInt(e.target.value) || 1
                    }))}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleSaveMaxSettings}
                    disabled={isSavingMax}
                    className="w-full"
                  >
                    {isSavingMax ? '저장 중...' : '저장'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
        {/* 분류별 케이스 수 막대그래프 */}
        <Card>
          <CardHeader>
            <CardTitle>분류별 케이스 수</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.casesPerCategory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 케이스 상태 분포 파이차트 */}
        <Card>
          <CardHeader>
            <CardTitle>케이스 상태 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats?.caseStatusDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ status, count }) => `${status}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {stats?.caseStatusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 분류별 평균 소유 케이스 수 */}
        <Card>
          <CardHeader>
            <CardTitle>분류별 평균 소유 케이스 수</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.averageCasesPerCategory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="average" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 학생별 케이스 소유 분포 */}
        <Card>
          <CardHeader>
            <CardTitle>학생별 케이스 소유 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats?.studentDistribution.map((item, index) => (
                <div key={item.caseCount} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" style={{ backgroundColor: COLORS[index % COLORS.length], color: 'white', borderColor: COLORS[index % COLORS.length] }}>
                      {item.caseCount}
                    </Badge>
                    <span className="text-sm font-medium">케이스를 소유한 학생</span>
                  </div>
                  <span className="text-lg font-bold">{item.studentCount}명</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
          </div>
        </TabsContent>

        <TabsContent value="students" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                학생별 케이스 소유 현황
              </CardTitle>
            </CardHeader>
            <CardContent>
              {studentStatsLoading ? (
                <div>로딩 중...</div>
              ) : studentStatsError ? (
                <div className="text-red-500">{studentStatsError}</div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>번호</TableHead>
                        <TableHead>이름</TableHead>
                        <TableHead>가철</TableHead>
                        <TableHead>고정</TableHead>
                        <TableHead>임플</TableHead>
                        <TableHead>임수</TableHead>
                        <TableHead>총 케이스</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allStudentStats.map(student => (
                        <TableRow key={student.studentId}>
                          <TableCell>{student.studentNumber}</TableCell>
                          <TableCell>{student.studentName}</TableCell>
                          <TableCell>
                            <Badge variant={student.가철 > 0 ? 'default' : 'secondary'}>
                              {student.가철}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={student.고정 > 0 ? 'default' : 'secondary'}>
                              {student.고정}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={student.임플 > 0 ? 'default' : 'secondary'}>
                              {student.임플}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={student.임수 > 0 ? 'default' : 'secondary'}>
                              {student.임수}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={student.total > 0 ? 'default' : 'outline'}>
                              {student.total}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 가철 분석 탭 */}
        <TabsContent value="category-가철" className="space-y-6">
          {renderCategoryAnalysis('가철', maxSettings.가철)}
        </TabsContent>

        {/* 고정 분석 탭 */}
        <TabsContent value="category-고정" className="space-y-6">
          {renderCategoryAnalysis('고정', maxSettings.고정)}
        </TabsContent>

        {/* 임플 분석 탭 */}
        <TabsContent value="category-임플" className="space-y-6">
          {renderCategoryAnalysis('임플', maxSettings.임플)}
        </TabsContent>

        {/* 임수 분석 탭 */}
        <TabsContent value="category-임수" className="space-y-6">
          {renderCategoryAnalysis('임수', maxSettings.임수)}
        </TabsContent>
      </Tabs>
    </div>
  )
}