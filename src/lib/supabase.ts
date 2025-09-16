import { createClient } from '@supabase/supabase-js'
import { createBrowserClient, createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// 브라우저에서 사용할 단일 클라이언트 인스턴스
let browserClient: ReturnType<typeof createBrowserClient> | null = null

export const createSupabaseClient = () => {
  if (typeof window !== 'undefined' && !browserClient) {
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey)
  }
  return browserClient || createBrowserClient(supabaseUrl, supabaseAnonKey)
}

export const createSupabaseServerClient = (cookieStore: { get: (name: string) => { value?: string } | undefined }) => {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
    },
  })
}

export const createSupabaseServiceClient = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}