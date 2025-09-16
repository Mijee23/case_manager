import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const serviceClient = createSupabaseServiceClient()

    const { data: stats, error } = await serviceClient
      .from('student_master')
      .select('number, name, is_registered, registered_user_id')

    if (error) throw error

    const total = stats?.length || 0
    const registered = stats?.filter(s => s.is_registered).length || 0
    const unregistered = total - registered

    console.log(`Student stats: total=${total}, registered=${registered}, unregistered=${unregistered}`)

    return NextResponse.json({
      success: true,
      data: { total, registered, unregistered }
    })
  } catch (error) {
    console.error('Error fetching student stats:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch student stats' },
      { status: 500 }
    )
  }
}