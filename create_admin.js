const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// .env.local 파일에서 환경변수 읽기
let supabaseUrl, supabaseServiceKey
try {
  const envPath = path.join(__dirname, '.env.local')
  const envContent = fs.readFileSync(envPath, 'utf8')

  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=')
    if (key === 'NEXT_PUBLIC_SUPABASE_URL') {
      supabaseUrl = value
    } else if (key === 'SUPABASE_SERVICE_ROLE_KEY') {
      supabaseServiceKey = value
    }
  })
} catch (error) {
  console.error('.env.local 파일을 읽을 수 없습니다:', error.message)
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Supabase URL 또는 Service Role Key가 설정되지 않았습니다.')
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl)
  console.error('SUPABASE_SERVICE_ROLE_KEY 있음:', !!supabaseServiceKey)
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdminUser() {
  try {
    console.log('관리자 계정 생성을 시작합니다...')

    // 1. Supabase Auth에서 사용자 생성
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'admin@admin.com',
      password: '123456',
      email_confirm: true
    })

    if (authError) {
      if (authError.code === 'email_exists' || authError.message.includes('already registered')) {
        console.log('이미 등록된 사용자입니다. users 테이블 확인 중...')

        // 기존 사용자 확인
        const { data: existingUser, error: getUserError } = await supabase.auth.admin.getUserByEmail('admin@admin.com')

        if (getUserError) {
          console.error('기존 사용자 조회 오류:', getUserError)
          return
        }

        console.log('기존 인증 사용자:', existingUser)

        if (existingUser?.user) {
          // users 테이블에 관리자 정보 추가/업데이트
          const { data: userData, error: userError } = await supabase
            .from('users')
            .upsert({
              id: existingUser.user.id,
              email: 'admin@admin.com',
              name: '관리자',
              role: '관리자',
              number: 'ADMIN001',
              created_at: new Date().toISOString()
            })
            .select()

          if (userError) {
            console.error('Users 테이블 업데이트 오류:', userError)
          } else {
            console.log('관리자 정보가 users 테이블에 업데이트되었습니다:', userData)
          }
        }
      } else {
        console.error('Auth 사용자 생성 오류:', authError)
        return
      }
    } else {
      console.log('Auth 사용자 생성 성공:', authData.user?.email)

      // 2. users 테이블에 관리자 정보 추가
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: 'admin@admin.com',
          name: '관리자',
          role: '관리자',
          number: 'ADMIN001',
          created_at: new Date().toISOString()
        })
        .select()

      if (userError) {
        console.error('Users 테이블 삽입 오류:', userError)
      } else {
        console.log('Users 테이블 삽입 성공:', userData)
      }
    }

    // 3. 최종 확인
    const { data: finalCheck, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@admin.com')
      .single()

    if (checkError) {
      console.error('최종 확인 오류:', checkError)
    } else {
      console.log('최종 관리자 계정 정보:', finalCheck)
    }

  } catch (error) {
    console.error('예외 발생:', error)
  }
}

createAdminUser()