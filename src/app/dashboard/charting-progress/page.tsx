'use client'

import { useEffect, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { useUser } from '@/hooks/useUser'
import { ChartingProgress } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Save, TrendingUp } from 'lucide-react'

export default function ChartingProgressPage() {
  const { user } = useUser()
  const [chartingProgress, setChartingProgress] = useState<ChartingProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    charting_count: 0,
    diagnosis_total_count: 0,
  })

  const supabase = createSupabaseClient()

  useEffect(() => {
    if (user?.role === '학생') {
      fetchChartingProgress()
    }
  }, [user])

  const fetchChartingProgress = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('charting_progress')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error
      }

      if (data) {
        setChartingProgress(data)
        setFormData({
          charting_count: data.charting_count,
          diagnosis_total_count: data.diagnosis_total_count,
        })
      }
    } catch (error) {
      console.error('Error fetching charting progress:', error)
      toast.error('차팅 현황을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)

    try {
      const updateData = {
        user_id: user.id,
        charting_count: formData.charting_count,
        diagnosis_total_count: formData.diagnosis_total_count,
        updated_at: new Date().toISOString(),
      }

      if (chartingProgress) {
        // 기존 데이터 업데이트
        const { error } = await supabase
          .from('charting_progress')
          .update(updateData)
          .eq('id', chartingProgress.id)

        if (error) throw error
      } else {
        // 새 데이터 생성
        const { error } = await supabase
          .from('charting_progress')
          .insert(updateData)

        if (error) throw error
      }

      await fetchChartingProgress()
      toast.success('차팅 현황이 저장되었습니다.')
    } catch (error) {
      console.error('Error saving charting progress:', error)
      toast.error('차팅 현황 저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    const numValue = parseInt(value) || 0
    setFormData(prev => ({
      ...prev,
      [field]: Math.max(0, numValue) // 음수 방지
    }))
  }

  if (loading) {
    return <div>로딩 중...</div>
  }

  if (!user || user.role !== '학생') {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">학생 권한이 필요합니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">차팅 현황</h1>
        <p className="text-muted-foreground mt-2">
          차팅 개수와 진단 토탈 개수를 입력하여 현황을 관리하세요.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            나의 차팅 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="charting_count">차팅 개수</Label>
              <Input
                id="charting_count"
                type="number"
                min="0"
                value={formData.charting_count}
                onChange={(e) => handleInputChange('charting_count', e.target.value)}
                placeholder="차팅 개수를 입력하세요"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="diagnosis_total_count">진단 토탈 개수</Label>
              <Input
                id="diagnosis_total_count"
                type="number"
                min="0"
                value={formData.diagnosis_total_count}
                onChange={(e) => handleInputChange('diagnosis_total_count', e.target.value)}
                placeholder="진단 토탈 개수를 입력하세요"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? '저장 중...' : '저장'}
            </Button>
          </div>

          {chartingProgress && (
            <div className="mt-6 p-4 bg-muted/20 rounded-lg">
              <h3 className="font-semibold mb-2">현재 상태</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">차팅 개수: </span>
                  <span className="font-medium">{chartingProgress.charting_count}개</span>
                </div>
                <div>
                  <span className="text-muted-foreground">진단 토탈 개수: </span>
                  <span className="font-medium">{chartingProgress.diagnosis_total_count}개</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">마지막 업데이트: </span>
                  <span className="font-medium">
                    {new Date(chartingProgress.updated_at).toLocaleString('ko-KR')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}