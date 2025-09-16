'use client'

import { createSupabaseClient } from '@/lib/supabase'
import { User } from '@/types/database'

export interface StudentOption {
  id: string
  number: string
  name: string
  label: string
  isRegistered: boolean
  registeredUserId?: string
}

export interface StudentListUploadResult {
  success: boolean
  uploaded: number
  updated: number
  errors: string[]
}

export class StudentMasterManager {
  private supabase = createSupabaseClient()

  /**
   * 엑셀에서 파싱된 학생 데이터로 student_master 테이블 업데이트
   */
  async uploadStudentList(students: { number: string; name: string }[]): Promise<StudentListUploadResult> {
    try {
      const response = await fetch('/api/student-master', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ students })
      })

      if (!response.ok) {
        throw new Error('Failed to upload students')
      }

      return await response.json()
    } catch (error) {
      console.error('Error uploading students:', error)
      return {
        success: false,
        uploaded: 0,
        updated: 0,
        errors: [`업로드 실패: ${error}`]
      }
    }
  }

  /**
   * 모든 학생 마스터 목록을 드롭다운용 옵션으로 반환
   */
  async getAllStudentOptions(): Promise<StudentOption[]> {
    try {
      const response = await fetch('/api/student-master')

      if (!response.ok) {
        throw new Error('Failed to fetch student options')
      }

      const result = await response.json()
      return result.success ? result.data : []
    } catch (error) {
      console.error('Error fetching student options:', error)
      return []
    }
  }

  /**
   * 특정 학생이 실제로 가입되어 있는지 확인
   */
  async validateStudentRegistration(studentNumber: string): Promise<{
    isValid: boolean
    user?: User
    error?: string
  }> {
    try {
      // 클라이언트에서는 간단한 조회만 가능
      // studentNumber가 UUID인 경우 registered_user_id로 조회
      const { data: masterStudent, error: masterError } = await this.supabase
        .from('student_master')
        .select('*')
        .eq('registered_user_id', studentNumber)
        .single()

      if (masterError || !masterStudent) {
        return {
          isValid: false,
          error: '학생 명단에 없는 번호입니다.'
        }
      }

      if (!masterStudent.is_registered || !masterStudent.registered_user_id) {
        return {
          isValid: false,
          error: `${masterStudent.name}님은 아직 회원가입을 하지 않았습니다.`
        }
      }

      // 실제 users 테이블에서 사용자 확인
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', masterStudent.registered_user_id)
        .eq('role', '학생')
        .single()

      if (userError || !user) {
        return {
          isValid: false,
          error: '회원 정보를 찾을 수 없습니다.'
        }
      }

      return {
        isValid: true,
        user
      }

    } catch (_error) {
      return {
        isValid: false,
        error: '검증 중 오류가 발생했습니다.'
      }
    }
  }

  /**
   * 회원가입 시 student_master 테이블 업데이트
   * 이 메소드는 서버 사이드 또는 트리거에서 처리되므로 클라이언트에서는 사용하지 않음
   */
  async updateStudentRegistration(): Promise<void> {
    console.warn('updateStudentRegistration should be handled by database triggers')
    // 실제로는 데이터베이스 트리거가 처리하므로 클라이언트에서는 빈 구현
  }

  /**
   * 학생 마스터 데이터 통계
   */
  async getStudentStats(): Promise<{
    total: number
    registered: number
    unregistered: number
  }> {
    try {
      const response = await fetch('/api/student-master/stats')

      if (!response.ok) {
        throw new Error('Failed to fetch student stats')
      }

      const result = await response.json()
      return result.success ? result.data : { total: 0, registered: 0, unregistered: 0 }
    } catch (error) {
      console.error('Error fetching student stats:', error)
      return { total: 0, registered: 0, unregistered: 0 }
    }
  }

  /**
   * 번호로 학생 ID 찾기 (유효성 검증 포함)
   */
  async getStudentIdByNumber(studentNumber: string): Promise<string | null> {
    const validation = await this.validateStudentRegistration(studentNumber)
    return validation.isValid ? validation.user!.id : null
  }

  /**
   * 강제로 모든 등록된 학생들을 동기화
   */
  async forceSyncAllRegisteredStudents(): Promise<{ updated: number; errors: string[] }> {
    try {
      const response = await fetch('/api/student-master/sync', {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to sync students')
      }

      const result = await response.json()
      return result.success ? result.data : { updated: 0, errors: ['동기화 실패'] }
    } catch (error) {
      console.error('Error syncing students:', error)
      return { updated: 0, errors: [`동기화 실패: ${error}`] }
    }
  }

  /**
   * 데이터베이스 상태 디버깅 함수
   * 클라이언트에서는 제한된 정보만 조회 가능
   */
  async debugDatabaseState(): Promise<void> {
    try {
      console.log('=== CLIENT-SIDE DATABASE DEBUG ===')

      // 현재 사용자로 접근 가능한 정보만 조회
      const { data: studentMaster, error: masterError } = await this.supabase
        .from('student_master')
        .select('*')

      if (masterError) {
        console.error('Error accessing student_master:', masterError)
        return
      }

      console.log('Student master table (accessible):', studentMaster)

      const stats = await this.getStudentStats()
      console.log('Student stats from API:', stats)

    } catch (error) {
      console.error('Error debugging database state:', error)
    }
  }
}

// 싱글톤 인스턴스
export const studentMasterManager = new StudentMasterManager()