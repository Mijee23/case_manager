'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'
import { ChartingProgress, User } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RefreshCw, BarChart3, Users } from 'lucide-react'

interface ChartingStats {
  chartingDistribution: { range: string; count: number }[]
  diagnosisDistribution: { range: string; count: number }[]
  studentCount: number
  totalCharting: number
  totalDiagnosis: number
  averageCharting: number
  averageDiagnosis: number
}

export default function ChartingStatsPage() {
  const { user } = useUser()
  const [stats, setStats] = useState<ChartingStats | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createSupabaseClient()

  useEffect(() => {
    // 페이지 로드 시 즉시 데이터 fetch 시작
    setLoading(true)
    fetchChartingStats()
      .finally(() => {
        setLoading(false)
      })

    // 뒤로가기/앞으로가기 이벤트 처리
    const handlePopState = () => {
      // 페이지 상태 복원
      if (document.visibilityState === 'visible') {
        fetchChartingStats()
      }
    }

    // 페이지 가시성 변경 이벤트 처리 (탭 전환 등)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchChartingStats()
      }
    }

    window.addEventListener('popstate', handlePopState)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const fetchChartingStats = async () => {
    try {
      // 학생 목록과 차팅 현황 데이터 가져오기
      const [studentsResult, chartingResult] = await Promise.all([
        supabase
          .from('users')
          .select('id, name, number')
          .eq('role', '학생')
          .order('name'),
        supabase
          .from('charting_progress')
          .select('*')
      ])

      if (studentsResult.error) throw studentsResult.error
      if (chartingResult.error) throw chartingResult.error

      const students = studentsResult.data || []
      const chartingData = chartingResult.data || []

      // 학생별 차팅 데이터 매핑 (데이터가 없는 학생은 0으로 처리)
      const studentChartingMap = new Map()
      chartingData.forEach(item => {
        studentChartingMap.set(item.user_id, item)
      })

      const chartingCounts: number[] = []
      const diagnosisCounts: number[] = []

      students.forEach(student => {
        const chartingProgress = studentChartingMap.get(student.id)
        chartingCounts.push(chartingProgress?.charting_count || 0)
        diagnosisCounts.push(chartingProgress?.diagnosis_total_count || 0)
      })

      // 차팅 분포 계산 (0,1,2,3,4,5,6,7,8,9,10,10개초과)
      const calculateChartingDistribution = (counts: number[]) => {
        const ranges = [
          { label: '0개', value: 0 },
          { label: '1개', value: 1 },
          { label: '2개', value: 2 },
          { label: '3개', value: 3 },
          { label: '4개', value: 4 },
          { label: '5개', value: 5 },
          { label: '6개', value: 6 },
          { label: '7개', value: 7 },
          { label: '8개', value: 8 },
          { label: '9개', value: 9 },
          { label: '10개', value: 10 },
          { label: '10개초과', value: -1 }, // -1은 10개 초과를 의미
        ]

        return ranges.map(range => ({
          range: range.label,
          count: range.value === -1
            ? counts.filter(count => count > 10).length
            : counts.filter(count => count === range.value).length
        }))
      }

      // 진단 분포 계산 (0,1,2,2개초과)
      const calculateDiagnosisDistribution = (counts: number[]) => {
        const ranges = [
          { label: '0개', value: 0 },
          { label: '1개', value: 1 },
          { label: '2개', value: 2 },
          { label: '2개초과', value: -1 }, // -1은 2개 초과를 의미
        ]

        return ranges.map(range => ({
          range: range.label,
          count: range.value === -1
            ? counts.filter(count => count > 2).length
            : counts.filter(count => count === range.value).length
        }))
      }

      const chartingDistribution = calculateChartingDistribution(chartingCounts)
      const diagnosisDistribution = calculateDiagnosisDistribution(diagnosisCounts)

      const totalCharting = chartingCounts.reduce((sum, count) => sum + count, 0)
      const totalDiagnosis = diagnosisCounts.reduce((sum, count) => sum + count, 0)

      setStats({
        chartingDistribution,
        diagnosisDistribution,
        studentCount: students.length,
        totalCharting,
        totalDiagnosis,
        averageCharting: students.length > 0 ? totalCharting / students.length : 0,
        averageDiagnosis: students.length > 0 ? totalDiagnosis / students.length : 0,
      })

    } catch (error) {
      console.error('Error fetching charting stats:', error)
      toast.error('차팅 통계를 불러오는 중 오류가 발생했습니다.')
      // 에러 발생 시 빈 통계로 설정
      setStats({
        chartingDistribution: [],
        diagnosisDistribution: [],
        studentCount: 0,
        totalCharting: 0,
        totalDiagnosis: 0,
        averageCharting: 0,
        averageDiagnosis: 0,
      })
    }
  }

  const BarChart = ({ data, title, color }: {
    data: { range: string; count: number }[],
    title: string,
    color: string
  }) => {
    const maxCount = Math.max(...data.map(item => item.count), 1)

    return (
      <div className="space-y-3">
        <h3 className="font-semibold text-lg">{title}</h3>
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-20 text-sm text-right">{item.range}</div>
              <div className="flex-1 relative">
                <div
                  className={`h-6 rounded ${color} transition-all duration-300`}
                  style={{
                    width: `${(item.count / maxCount) * 100}%`,
                    minWidth: item.count > 0 ? '20px' : '0px'
                  }}
                />
                <span className="absolute right-2 top-0 h-6 flex items-center text-xs font-medium">
                  {item.count}명
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // 데이터 로딩 중인 경우
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">차팅 통계 데이터를 불러오고 있습니다...</p>
        </div>
      </div>
    )
  }

  // 관리자가 아닌 경우 (로딩 완료 후 체크)
  if (user && user.role !== '관리자') {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">관리자 권한이 필요합니다.</p>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">통계 데이터를 불러올 수 없습니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">차팅 현황 통계</h1>
          <p className="text-muted-foreground mt-2">
            학생들의 차팅 개수와 진단 토탈 개수 분포를 확인할 수 있습니다.
          </p>
        </div>
        <Button onClick={fetchChartingStats} disabled={loading} size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      {/* 전체 통계 요약 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            전체 현황 요약
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.studentCount}</div>
              <div className="text-sm text-muted-foreground">총 학생 수</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.totalCharting}</div>
              <div className="text-sm text-muted-foreground">총 차팅 수</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.totalDiagnosis}</div>
              <div className="text-sm text-muted-foreground">총 진단 수</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {stats.averageCharting.toFixed(1)} / {stats.averageDiagnosis.toFixed(1)}
              </div>
              <div className="text-sm text-muted-foreground">평균 차팅/진단</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 차팅 분포 차트 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            차팅 개수 분포
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            data={stats.chartingDistribution}
            title="차팅 개수별 학생 분포"
            color="bg-blue-500"
          />
        </CardContent>
      </Card>

      {/* 진단 분포 차트 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            진단 토탈 개수 분포
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            data={stats.diagnosisDistribution}
            title="진단 토탈 개수별 학생 분포"
            color="bg-green-500"
          />
        </CardContent>
      </Card>
    </div>
  )
}