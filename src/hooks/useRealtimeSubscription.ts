'use client'

import { useEffect } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

export function useRealtimeSubscription(
  table: string,
  callback: (payload: any) => void,
  filter?: string
) {
  const supabase = createSupabaseClient()

  useEffect(() => {
    let channel: RealtimeChannel

    const setupSubscription = async () => {
      channel = supabase
        .channel(`public:${table}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: table,
            ...(filter && { filter }),
          },
          callback
        )
        .subscribe()
    }

    setupSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [table, callback, filter, supabase])
}

export function useCaseRealtimeUpdates(onUpdate: () => void) {
  return useRealtimeSubscription('cases', onUpdate)
}