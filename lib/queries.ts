'use client'
import { supabaseBrowser } from '@/lib/supabase/client'

export async function getMyTasks() {
  const sb = supabaseBrowser()
  return sb.from('tasks')
    .select('*')
    .order('due_at', { ascending: true })
}

export async function markDone(taskId: string) {
  const sb = supabaseBrowser()
  const { data, error } = await sb
    .from('tasks')
    .update({ status: 'done', done_at: new Date().toISOString() })
    .eq('id', taskId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function markTodo(taskId: string) {
  const sb = supabaseBrowser()
  const { data, error } = await sb
    .from('tasks')
    .update({ status: 'todo', done_at: null })
    .eq('id', taskId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function markTaskAsRead(taskId: string, userId: string) {
  const sb = supabaseBrowser()
  // Upsert - inserisce o aggiorna se già esiste
  const { error } = await sb
    .from('task_reads')
    .upsert(
      { task_id: taskId, user_id: userId, seen_at: new Date().toISOString() },
      { onConflict: 'task_id,user_id' }
    )
  if (error) throw error
}

export async function getTaskReads(taskId: string) {
  const sb = supabaseBrowser()
  const { data, error } = await sb
    .from('task_reads')
    .select(`
      seen_at,
      user:profiles!user_id(full_name)
    `)
    .eq('task_id', taskId)
    .order('seen_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

export async function isTaskReadByUser(taskId: string, userId: string) {
  const sb = supabaseBrowser()
  const { data, error } = await sb
    .from('task_reads')
    .select('seen_at')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .single()
  
  if (error && error.code !== 'PGRST116') throw error // PGRST116 = not found
  return data ? data.seen_at : null
}

export async function listGroups() {
  const sb = supabaseBrowser()
  const { data, error } = await sb.from('groups').select('id, name').order('name')
  if (error) throw error
  return data
}

export async function listUsers() {
  const sb = supabaseBrowser()
  const { data, error } = await sb.from('profiles').select('id, full_name').order('full_name')
  if (error) throw error
  return data
}