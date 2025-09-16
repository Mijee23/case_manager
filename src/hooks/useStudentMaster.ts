'use client'

import { useState, useEffect } from 'react'
import { studentMasterManager, StudentOption } from '@/utils/studentMasterManager'

export function useStudentMaster() {
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStudentOptions = async () => {
    try {
      setLoading(true)
      setError(null)

      const options = await studentMasterManager.getAllStudentOptions()
      setStudentOptions(options)
    } catch (err) {
      console.error('Error fetching student options:', err)
      setError('학생 목록을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudentOptions()
  }, [])

  return {
    studentOptions,
    loading,
    error,
    refreshStudents: fetchStudentOptions
  }
}

/**
 * 학생 선택 검증을 포함한 훅
 */
export function useStudentValidation() {
  const [validationLoading, setValidationLoading] = useState(false)

  const validateStudent = async (studentNumber: string) => {
    setValidationLoading(true)
    try {
      return await studentMasterManager.validateStudentRegistration(studentNumber)
    } catch (error) {
      return {
        isValid: false,
        error: '검증 중 오류가 발생했습니다.'
      }
    } finally {
      setValidationLoading(false)
    }
  }

  const getStudentId = async (studentNumber: string) => {
    try {
      return await studentMasterManager.getStudentIdByNumber(studentNumber)
    } catch (error) {
      console.error('Error getting student ID:', error)
      return null
    }
  }

  return {
    validateStudent,
    getStudentId,
    validationLoading
  }
}