import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function POST() {
  try {
    const serviceClient = createSupabaseServiceClient()
    const result = { updated: 0, errors: [] as string[] }

    // 모든 등록된 학생 조회
    const { data: users, error: usersError } = await serviceClient
      .from('users')
      .select('id, number, name')
      .eq('role', '학생')

    if (usersError) throw usersError

    console.log('Force syncing students:', users)

    // 각 학생을 student_master에 업데이트
    for (const user of users || []) {
      try {
        const { error: upsertError } = await serviceClient
          .from('student_master')
          .upsert({
            number: user.number,
            name: user.name,
            is_registered: true,
            registered_user_id: user.id,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'number',
            ignoreDuplicates: false
          })

        if (upsertError) {
          result.errors.push(`${user.number} ${user.name}: ${upsertError.message}`)
        } else {
          result.updated++
          console.log(`Force synced: ${user.number} ${user.name}`)
        }
      } catch (error) {
        result.errors.push(`${user.number} ${user.name}: ${error}`)
      }
    }

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error in force sync:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to sync students' },
      { status: 500 }
    )
  }
}