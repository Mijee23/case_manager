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

export async function GET(request: NextRequest) {
  try {
    console.log('관리자 API: 모든 사용자 조회 시작')
    
    // Service role을 사용하여 RLS 우회하고 모든 사용자 조회
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('관리자 API 에러:', error)
      return NextResponse.json(
        { error: error.message }, 
        { status: 500 }
      )
    }

    console.log('관리자 API: 사용자 조회 성공,', data?.length, '명')
    
    return NextResponse.json({ 
      data,
      success: true 
    })
  } catch (error) {
    console.error('관리자 API 예외:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' }, 
      { status: 500 }
    )
  }
}
