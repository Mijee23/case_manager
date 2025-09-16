import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Service role 클라이언트 (RLS 우회 가능)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function POST(request: NextRequest) {
  try {
    const { email, role, name, number, userId } = await request.json()
    
    console.log(`API: ${role} 사용자 정보 삽입 시도`, { email, role, name, number, userId })

    // Service role을 사용하여 RLS 우회하고 사용자 정보 삽입
    const { data, error } = await supabaseAdmin
      .from('users')
      .upsert({
        id: userId,
        email,
        number,
        name,
        role,
      })

    if (error) {
      console.error('API: 사용자 정보 삽입 실패:', error)
      return NextResponse.json(
        { error: error.message }, 
        { status: 500 }
      )
    }

    console.log('API: 사용자 정보 삽입 성공')
    
    return NextResponse.json({ 
      success: true,
      message: `${role} 계정 정보가 성공적으로 저장되었습니다.`
    })
  } catch (error) {
    console.error('API: 예외 발생:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' }, 
      { status: 500 }
    )
  }
}
