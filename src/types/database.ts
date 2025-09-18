export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          number: string
          name: string
          role: '학생' | '관리자' | '전공의'
          created_at: string
          // 학생 케이스 소유 정보
          case_count_가철?: number
          case_count_고정?: number
          case_count_임플?: number
          case_count_임수?: number
          total_cases?: number
          last_case_sync?: string
        }
        Insert: {
          id: string
          email: string
          number: string
          name: string
          role: '학생' | '관리자' | '전공의'
          created_at?: string
          case_count_가철?: number
          case_count_고정?: number
          case_count_임플?: number
          case_count_임수?: number
          total_cases?: number
          last_case_sync?: string
        }
        Update: {
          id?: string
          email?: string
          number?: string
          name?: string
          role?: '학생' | '관리자' | '전공의'
          created_at?: string
          case_count_가철?: number
          case_count_고정?: number
          case_count_임플?: number
          case_count_임수?: number
          total_cases?: number
          last_case_sync?: string
        }
      }
      patients: {
        Row: {
          patient_number: string
          patient_name: string
        }
        Insert: {
          patient_number: string
          patient_name: string
        }
        Update: {
          patient_number?: string
          patient_name?: string
        }
      }
      student_master: {
        Row: {
          id: string
          number: string
          name: string
          is_registered: boolean
          registered_user_id?: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          number: string
          name: string
          is_registered?: boolean
          registered_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          number?: string
          name?: string
          is_registered?: boolean
          registered_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      cases: {
        Row: {
          id: string
          datetime: string
          category: '가철' | '고정' | '임플' | '임수'
          assigned_resident: string
          patient_number: string
          patient_name: string
          assigned_student1?: string | null
          assigned_student2?: string | null
          case_status: '완료' | '실패' | '진행중'
          acquisition_method: '장부' | '배정'
          created_at: string
          treatment_details?: string | null
          note?: string | null
          change_log: Json
        }
        Insert: {
          id?: string
          datetime: string
          category: '가철' | '고정' | '임플' | '임수'
          assigned_resident: string
          patient_number: string
          patient_name: string
          assigned_student1?: string | null
          assigned_student2?: string | null
          case_status?: '완료' | '실패' | '진행중'
          acquisition_method?: '장부' | '배정'
          created_at?: string
          treatment_details?: string | null
          note?: string | null
          change_log?: Json
        }
        Update: {
          id?: string
          datetime?: string
          category?: '가철' | '고정' | '임플' | '임수'
          assigned_resident?: string
          patient_number?: string
          patient_name?: string
          assigned_student1?: string
          assigned_student2?: string | null
          case_status?: '완료' | '실패' | '진행중'
          acquisition_method?: '장부' | '배정'
          created_at?: string
          treatment_details?: string | null
          note?: string | null
          change_log?: Json
        }
      }
      charting_progress: {
        Row: {
          id: string
          user_id: string
          charting_count: number
          diagnosis_total_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          charting_count?: number
          diagnosis_total_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          charting_count?: number
          diagnosis_total_count?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type User = Database['public']['Tables']['users']['Row']
export type Case = Database['public']['Tables']['cases']['Row']
export type Patient = Database['public']['Tables']['patients']['Row']
export type StudentMaster = Database['public']['Tables']['student_master']['Row']
export type ChartingProgress = Database['public']['Tables']['charting_progress']['Row']

// 학생 케이스 통계 타입
export interface StudentCaseStats {
  studentId: string
  studentName: string
  studentNumber: string
  가철: number
  고정: number
  임플: number
  임수: number
  total: number
}

// 분류별 케이스 분포 타입
export interface CategoryDistribution {
  category: '가철' | '고정' | '임플' | '임수'
  totalCases: number
  assignedCases: number
  averagePerStudent: number
  studentsWithZero: number
  studentsWithOne: number
  studentsWithTwo: number
  studentsWithThreeOrMore: number
}

export type CaseWithUser = Case & {
  student1?: User
  student2?: User
}

export interface CaseFormData {
  datetime: Date
  category: '가철' | '고정' | '임플' | '임수'
  assigned_resident: string
  patient_number: string
  patient_name: string
  treatment_details?: string
  note?: string
}

export interface ExcelRowData {
  예약일시: string
  예약시간: string
  진료번호: string
  환자명: string
  예약의사: string
  진료내역: string
  분류: '가철' | '고정' | '임플' | '임수'
}