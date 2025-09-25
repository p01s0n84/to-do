'use client'
import { supabaseBrowser } from '@/lib/supabase/client'

export function subscribeTasks(cb: (payload:any) => void) {
  const sb = supabaseBrowser()
  const ch = sb
    .channel('tasks-ch')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, cb)
    .subscribe()
  return () => { sb.removeChannel(ch) }
}
