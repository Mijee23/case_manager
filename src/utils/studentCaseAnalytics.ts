'use client'

import { createSupabaseClient } from '@/lib/supabase'
import { StudentCaseStats, CategoryDistribution } from '@/types/database'

export class StudentCaseAnalytics {
  private supabase = createSupabaseClient()

  /**
   * 모든 학생의 케이스 소유 현황을 동기화
   */
  async syncAllStudentCaseCounts(): Promise<void> {
    try {
      // 모든 학생 가져오기
      const { data: students, error: studentsError } = await this.supabase
        .from('users')
        .select('id, name, number')
        .eq('role', '학생')

      if (studentsError) throw studentsError

      if (!students) return

      // 각 학생별로 케이스 수 계산 및 업데이트
      for (const student of students) {
        await this.syncStudentCaseCount(student.id)
      }

      console.log('All student case counts synced successfully')
    } catch (error) {
      console.error('Error syncing student case counts:', error)
      throw error
    }
  }

  /**
   * 특정 학생의 케이스 소유 현황을 동기화
   */
  async syncStudentCaseCount(studentId: string): Promise<void> {
    try {
      // 해당 학생의 케이스들 가져오기
      const { data: cases, error: casesError } = await this.supabase
        .from('cases')
        .select('category')
        .or(`assigned_student1.eq.${studentId},assigned_student2.eq.${studentId}`)

      if (casesError) throw casesError

      // 분류별 카운트 계산
      const counts = {
        가철: 0,
        고정: 0,
        임플: 0,
        임수: 0
      }

      cases?.forEach(case_ => {
        if (case_.category in counts) {
          counts[case_.category as keyof typeof counts]++
        }
      })

      const total = Object.values(counts).reduce((sum, count) => sum + count, 0)

      // 사용자 테이블 업데이트
      const { error: updateError } = await this.supabase
        .from('users')
        .update({
          case_count_가철: counts.가철,
          case_count_고정: counts.고정,
          case_count_임플: counts.임플,
          case_count_임수: counts.임수,
          total_cases: total,
          last_case_sync: new Date().toISOString()
        })
        .eq('id', studentId)

      if (updateError) throw updateError

      console.log(`Student ${studentId} case count synced: ${JSON.stringify(counts)}`)
    } catch (error) {
      console.error(`Error syncing case count for student ${studentId}:`, error)
      throw error
    }
  }

  /**
   * 모든 학생의 케이스 통계 가져오기
   */
  async getAllStudentStats(): Promise<StudentCaseStats[]> {
    try {
      const { data: students, error } = await this.supabase
        .from('users')
        .select(`
          id,
          name,
          number,
          case_count_가철,
          case_count_고정,
          case_count_임플,
          case_count_임수,
          total_cases
        `)
        .eq('role', '학생')
        .order('number')

      if (error) throw error

      return students?.map(student => ({
        studentId: student.id,
        studentName: student.name,
        studentNumber: student.number,
        가철: student.case_count_가철 || 0,
        고정: student.case_count_고정 || 0,
        임플: student.case_count_임플 || 0,
        임수: student.case_count_임수 || 0,
        total: student.total_cases || 0
      })) || []
    } catch (error) {
      console.error('Error fetching student stats:', error)
      throw error
    }
  }

  /**
   * 특정 학생의 케이스 통계 가져오기
   */
  async getStudentStats(studentId: string): Promise<StudentCaseStats | null> {
    try {
      const { data: student, error } = await this.supabase
        .from('users')
        .select(`
          id,
          name,
          number,
          case_count_가철,
          case_count_고정,
          case_count_임플,
          case_count_임수,
          total_cases
        `)
        .eq('id', studentId)
        .eq('role', '학생')
        .single()

      if (error) throw error

      if (!student) return null

      return {
        studentId: student.id,
        studentName: student.name,
        studentNumber: student.number,
        가철: student.case_count_가철 || 0,
        고정: student.case_count_고정 || 0,
        임플: student.case_count_임플 || 0,
        임수: student.case_count_임수 || 0,
        total: student.total_cases || 0
      }
    } catch (error) {
      console.error('Error fetching student stats:', error)
      throw error
    }
  }

  /**
   * 분류별 케이스 분포 분석
   */
  async getCategoryDistribution(): Promise<CategoryDistribution[]> {
    try {
      const categories: Array<'가철' | '고정' | '임플' | '임수'> = ['가철', '고정', '임플', '임수']
      const distributions: CategoryDistribution[] = []

      for (const category of categories) {
        // 전체 케이스 수
        const { count: totalCases } = await this.supabase
          .from('cases')
          .select('*', { count: 'exact', head: true })
          .eq('category', category)

        // 배정된 케이스 수
        const { count: assignedCases } = await this.supabase
          .from('cases')
          .select('*', { count: 'exact', head: true })
          .eq('category', category)
          .not('assigned_student1', 'is', null)

        // 학생별 분포
        const { data: students } = await this.supabase
          .from('users')
          .select(`case_count_${category}`)
          .eq('role', '학생')

        let studentsWithZero = 0
        let studentsWithOne = 0
        let studentsWithTwo = 0
        let studentsWithThreeOrMore = 0
        let totalStudentCases = 0

        students?.forEach(student => {
          const count = (student as Record<string, unknown>)[`case_count_${category}`] as number || 0
          totalStudentCases += count

          if (count === 0) studentsWithZero++
          else if (count === 1) studentsWithOne++
          else if (count === 2) studentsWithTwo++
          else studentsWithThreeOrMore++
        })

        const averagePerStudent = students?.length ? totalStudentCases / students.length : 0

        distributions.push({
          category,
          totalCases: totalCases || 0,
          assignedCases: assignedCases || 0,
          averagePerStudent: Math.round(averagePerStudent * 100) / 100,
          studentsWithZero,
          studentsWithOne,
          studentsWithTwo,
          studentsWithThreeOrMore
        })
      }

      return distributions
    } catch (error) {
      console.error('Error fetching category distribution:', error)
      throw error
    }
  }

  /**
   * 케이스 변경 시 관련 학생들의 통계 업데이트
   */
  async onCaseChange(caseData: {
    assigned_student1?: string | null
    assigned_student2?: string | null
    previousStudent1?: string | null
    previousStudent2?: string | null
  }): Promise<void> {
    try {
      const studentsToUpdate = new Set<string>()

      // 현재 배정된 학생들 추가
      if (caseData.assigned_student1) studentsToUpdate.add(caseData.assigned_student1)
      if (caseData.assigned_student2) studentsToUpdate.add(caseData.assigned_student2)

      // 이전에 배정되었던 학생들 추가
      if (caseData.previousStudent1) studentsToUpdate.add(caseData.previousStudent1)
      if (caseData.previousStudent2) studentsToUpdate.add(caseData.previousStudent2)

      // 각 학생의 케이스 수 동기화
      for (const studentId of studentsToUpdate) {
        await this.syncStudentCaseCount(studentId)
      }
    } catch (error) {
      console.error('Error updating student stats on case change:', error)
      throw error
    }
  }

  /**
   * 학생이 특정 분류의 케이스를 몇 개 소유하고 있는지 확인
   */
  async getStudentCaseCount(studentId: string, category: '가철' | '고정' | '임플' | '임수'): Promise<number> {
    try {
      const { data: student, error } = await this.supabase
        .from('users')
        .select(`case_count_${category}`)
        .eq('id', studentId)
        .single()

      if (error) throw error

      return (student as Record<string, unknown>)[`case_count_${category}`] as number || 0
    } catch (error) {
      console.error('Error fetching student case count:', error)
      return 0
    }
  }

  /**
   * 특정 분류의 케이스를 N개 소유한 학생 수 조회
   */
  async getStudentCountByCategory(category: '가철' | '고정' | '임플' | '임수', caseCount: number): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', '학생')
        .eq(`case_count_${category}`, caseCount)

      if (error) throw error

      return count || 0
    } catch (error) {
      console.error('Error fetching student count by category:', error)
      return 0
    }
  }
}

// 싱글톤 인스턴스 생성
export const studentCaseAnalytics = new StudentCaseAnalytics()