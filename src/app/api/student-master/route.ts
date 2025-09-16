import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { StudentOption } from '@/utils/studentMasterManager'

// GET: 모든 학생 옵션 조회
export async function GET() {
  try {
    const serviceClient = createSupabaseServiceClient()

    const { data: students, error } = await serviceClient
      .from('student_master')
      .select('*')
      .order('number')

    if (error) throw error

    const studentOptions: StudentOption[] = students?.map(student => ({
      id: student.id,
      number: student.number,
      name: student.name,
      label: `${student.number} - ${student.name}${!student.is_registered ? ' (미가입)' : ''}`,
      isRegistered: student.is_registered,
      registeredUserId: student.registered_user_id || undefined
    })) || []

    return NextResponse.json({ success: true, data: studentOptions })
  } catch (error) {
    console.error('Error fetching student options:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch student options' },
      { status: 500 }
    )
  }
}

// POST: 학생 목록 업로드
export async function POST(request: NextRequest) {
  try {
    const { students } = await request.json()

    if (!Array.isArray(students)) {
      return NextResponse.json(
        { success: false, error: 'Invalid students data' },
        { status: 400 }
      )
    }

    const serviceClient = createSupabaseServiceClient()

    // 기존 등록된 사용자들의 번호 목록 가져오기
    const { data: registeredUsers, error: usersError } = await serviceClient
      .from('users')
      .select('id, number, name')
      .eq('role', '학생')

    if (usersError) throw usersError

    const registeredUserMap = new Map(
      registeredUsers?.map(user => [user.number, user]) || []
    )

    const result = {
      success: false,
      uploaded: 0,
      updated: 0,
      errors: [] as string[]
    }

    // 각 학생 데이터 처리
    for (const student of students) {
      try {
        if (!student.number || !student.name) {
          result.errors.push(`빈 데이터: 번호=${student.number}, 이름=${student.name}`)
          continue
        }

        const registeredUser = registeredUserMap.get(student.number)
        const isRegistered = !!registeredUser
        const registeredUserId = registeredUser?.id || null

        // student_master 테이블에 upsert
        const { error: upsertError } = await serviceClient
          .from('student_master')
          .upsert({
            number: student.number,
            name: student.name,
            is_registered: isRegistered,
            registered_user_id: registeredUserId,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'number',
            ignoreDuplicates: false
          })

        if (upsertError) {
          result.errors.push(`${student.number} ${student.name}: ${upsertError.message}`)
          continue
        }

        if (isRegistered) {
          result.updated++
        } else {
          result.uploaded++
        }
      } catch (error) {
        result.errors.push(`${student.number} ${student.name}: ${error}`)
      }
    }

    result.success = result.errors.length === 0 || result.uploaded + result.updated > 0

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error uploading students:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to upload students' },
      { status: 500 }
    )
  }
}