'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { User } from '@/types/database'
import { CURRENT_STUDENTS, getStudentLabel } from '@/data/students'

interface StudentOption {
  id: string
  value: string // 실제 user ID (회원가입한 경우) 또는 번호 (미가입)
  label: string // "번호 - 이름" 형식
  number: string
  name: string
  isRegistered: boolean // 회원가입 여부
}

// 등록된 학생들 캐시 (실제 User 객체)
let registeredStudentsCache: User[] = []
let lastFetchTime = 0
const CACHE_DURATION = 30 * 1000 // 30초 캐시 (개발 중에는 짧게)

export const useStudentsHybrid = (excludeCurrentUser?: string, onlyRegistered = false) => {
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 등록된 학생들만 DB에서 가져오기
  const fetchRegisteredStudents = useCallback(async (): Promise<User[]> => {
    const now = Date.now()
    
    // 캐시가 유효한 경우 캐시 사용
    if (registeredStudentsCache.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
      console.log('캐시에서 학생 데이터 사용:', registeredStudentsCache)
      return registeredStudentsCache
    }

    console.log('DB에서 학생 데이터 조회 시작...')
    const supabase = createSupabaseClient()
    
    // 현재 사용자 정보 확인
    const { data: currentUser, error: userError } = await supabase.auth.getUser()
    console.log('현재 인증된 사용자:', currentUser)
    console.log('사용자 인증 에러:', userError)
    
    // 모든 사용자 먼저 조회 (디버깅용)
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('*')

    console.log('DB의 모든 사용자:', allUsers)
    console.log('모든 사용자 조회 에러:', allUsersError)

    // 학생만 조회 (먼저 직접 쿼리 시도)
    let data, error
    
    try {
      const result = await supabase
        .from('users')
        .select('id, name, number, email, role')
        .eq('role', '학생')
        .order('number')
      
      data = result.data
      error = result.error
      
      console.log('직접 쿼리 결과:', { data, error })
      
      // 직접 쿼리가 실패하면 API 엔드포인트 사용 시도
      if (error || !data || data.length === 0) {
        console.log('직접 쿼리 실패, API 엔드포인트 시도...')
        
        try {
          const response = await fetch('/api/admin/users', {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          })

          if (response.ok) {
            const result = await response.json()
            console.log('API 응답:', result)
            
            if (result.data) {
              // 학생만 필터링
              data = result.data.filter((user: { role: string }) => user.role === '학생')
              error = null
              console.log('API에서 필터링된 학생들:', data)
            }
          } else {
            console.log('API 호출 실패:', response.status, response.statusText)
          }
        } catch (apiError) {
          console.log('API 호출 에러:', apiError)
        }
      }
    } catch (queryError) {
      console.log('쿼리 실행 중 에러:', queryError)
      error = queryError
    }

    console.log('최종 학생 쿼리 결과:', { data, error })
    console.log('학생 쿼리 상세:', {
      dataLength: data?.length || 0,
      dataContent: data,
      errorMessage: error?.message,
      errorDetails: error
    })

    if (error) {
      console.error('Error fetching registered students:', error)
      throw error
    }

    // 캐시 업데이트
    registeredStudentsCache = data || []
    lastFetchTime = now

    console.log('캐시 업데이트 완료:', registeredStudentsCache)
    return registeredStudentsCache
  }, [])

  // 하드코딩된 데이터와 DB 데이터를 결합 (합집합)
  const buildStudentOptions = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // 등록된 학생들 가져오기
      const registeredStudents = await fetchRegisteredStudents()
      
      console.log('DB에서 가져온 등록된 학생들:', registeredStudents)
      console.log('하드코딩된 학생들:', CURRENT_STUDENTS)
      
      // 등록된 학생들을 번호로 매핑
      const registeredMap = new Map(
        registeredStudents.map(student => [student.number, student])
      )

      // 합집합을 위한 Set 사용 (번호 기준)
      const allStudentNumbers = new Set([
        ...CURRENT_STUDENTS.map(s => s.number),
        ...registeredStudents.map(s => s.number)
      ])

      console.log('전체 학생 번호들 (합집합):', Array.from(allStudentNumbers))

      // 합집합으로 옵션 생성
      const options: StudentOption[] = Array.from(allStudentNumbers)
        .map(number => {
          // 하드코딩에서 찾기
          const hardcodedStudent = CURRENT_STUDENTS.find(s => s.number === number)
          // DB에서 찾기
          const registeredStudent = registeredMap.get(number)
          
          // 이름 우선순위: DB > 하드코딩
          const name = registeredStudent?.name || hardcodedStudent?.name || `학생${number}`
          const isRegistered = !!registeredStudent
          
          return {
            id: isRegistered ? registeredStudent.id : number,
            value: isRegistered ? registeredStudent.id : number,
            label: getStudentLabel(number, name),
            number: number,
            name: name,
            isRegistered
          }
        })
        .filter(option => {
          // 현재 사용자 제외 필터링
          if (excludeCurrentUser && option.isRegistered) {
            const registeredStudent = registeredMap.get(option.number)
            if (registeredStudent && registeredStudent.id === excludeCurrentUser) {
              return false
            }
          }
          
          // 등록된 학생만 필터링 옵션
          if (onlyRegistered && !option.isRegistered) {
            return false
          }
          
          return true
        })
        .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })) // 번호순 정렬

      setStudentOptions(options)
      
      console.log(`학생 옵션 생성 완료: ${options.length}명 (등록: ${options.filter(o => o.isRegistered).length}명, 미등록: ${options.filter(o => !o.isRegistered).length}명)`)
      console.log('생성된 옵션들:', options)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '학생 목록을 가져오는데 실패했습니다.'
      setError(errorMessage)
      console.error('Error in buildStudentOptions:', err)
    } finally {
      setLoading(false)
    }
  }, [excludeCurrentUser, onlyRegistered, fetchRegisteredStudents])

  // 초기 로드
  useEffect(() => {
    buildStudentOptions()
  }, [buildStudentOptions])

  // 실시간 업데이트 (필요한 경우에만)
  useEffect(() => {
    const supabase = createSupabaseClient()

    // users 테이블 실시간 구독 (새로운 학생 가입 감지)
    const channel = supabase
      .channel('students-hybrid-updates')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'users',
          filter: 'role=eq.학생'
        }, 
        (payload: unknown) => {
          console.log('학생 회원가입/수정 감지:', payload)
          // 캐시 무효화 및 재빌드
          registeredStudentsCache = []
          lastFetchTime = 0
          buildStudentOptions()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [buildStudentOptions])

  // 수동 새로고침
  const refreshStudents = useCallback(() => {
    registeredStudentsCache = []
    lastFetchTime = 0
    return buildStudentOptions()
  }, [buildStudentOptions])

  // 특정 번호의 학생이 등록되었는지 확인
  const isStudentRegistered = useCallback((studentNumber: string): boolean => {
    return studentOptions.find(option => option.number === studentNumber)?.isRegistered || false
  }, [studentOptions])

  // 등록되지 않은 학생 목록
  const unregisteredStudents = studentOptions?.filter(option => !option.isRegistered) || []

  return {
    studentOptions,
    loading,
    error,
    refreshStudents,
    isStudentRegistered,
    unregisteredStudents,
    totalStudents: CURRENT_STUDENTS.length,
    registeredCount: studentOptions?.filter(o => o.isRegistered).length || 0
  }
}

// 캐시 무효화 함수
export const invalidateStudentsHybridCache = () => {
  registeredStudentsCache = []
  lastFetchTime = 0
}
