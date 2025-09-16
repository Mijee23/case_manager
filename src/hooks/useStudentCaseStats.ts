'use client'

import { useState, useEffect } from 'react'
import { studentCaseAnalytics } from '@/utils/studentCaseAnalytics'
import { StudentCaseStats, CategoryDistribution } from '@/types/database'

export function useStudentCaseStats() {
  const [allStudentStats, setAllStudentStats] = useState<StudentCaseStats[]>([])
  const [categoryDistribution, setCategoryDistribution] = useState<CategoryDistribution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAllStats = async () => {
    try {
      setLoading(true)
      setError(null)

      const [students, distribution] = await Promise.all([
        studentCaseAnalytics.getAllStudentStats(),
        studentCaseAnalytics.getCategoryDistribution()
      ])

      setAllStudentStats(students)
      setCategoryDistribution(distribution)
    } catch (err) {
      console.error('Error fetching student stats:', err)
      setError('학생 통계를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const syncAllCounts = async () => {
    try {
      await studentCaseAnalytics.syncAllStudentCaseCounts()
      await fetchAllStats() // 동기화 후 다시 불러오기
    } catch (err) {
      console.error('Error syncing student counts:', err)
      setError('학생 케이스 수를 동기화하는 중 오류가 발생했습니다.')
    }
  }

  const syncStudentCount = async (studentId: string) => {
    try {
      await studentCaseAnalytics.syncStudentCaseCount(studentId)
      await fetchAllStats() // 동기화 후 다시 불러오기
    } catch (err) {
      console.error('Error syncing student count:', err)
      setError('학생 케이스 수를 동기화하는 중 오류가 발생했습니다.')
    }
  }

  useEffect(() => {
    fetchAllStats()
  }, [])

  return {
    allStudentStats,
    categoryDistribution,
    loading,
    error,
    refreshStats: fetchAllStats,
    syncAllCounts,
    syncStudentCount
  }
}

export function useStudentStats(studentId: string | null) {
  const [studentStats, setStudentStats] = useState<StudentCaseStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStudentStats = async () => {
    if (!studentId) {
      setStudentStats(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const stats = await studentCaseAnalytics.getStudentStats(studentId)
      setStudentStats(stats)
    } catch (err) {
      console.error('Error fetching student stats:', err)
      setError('학생 통계를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const syncStudentCount = async () => {
    if (!studentId) return

    try {
      await studentCaseAnalytics.syncStudentCaseCount(studentId)
      await fetchStudentStats() // 동기화 후 다시 불러오기
    } catch (err) {
      console.error('Error syncing student count:', err)
      setError('학생 케이스 수를 동기화하는 중 오류가 발생했습니다.')
    }
  }

  useEffect(() => {
    fetchStudentStats()
  }, [studentId])

  return {
    studentStats,
    loading,
    error,
    refreshStats: fetchStudentStats,
    syncStudentCount
  }
}