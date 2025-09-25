'use client'
import { supabaseBrowser } from '@/lib/supabase/client'
import React from 'react'

export type PermissionType = 'edit_tasks' | 'delete_tasks' | 'view_tasks' | 'assign_tasks'
export type Role = 'amministratore' | 'consulenti' | 'dottori' | 'igienisti' | 'aso' | 'receptionist'

export interface PermissionSetting {
  id: string
  role: Role
  permission_type: PermissionType
  scope: 'own' | 'same_role' | 'same_group' | 'lower_roles' | 'all'
  enabled: boolean
}

export async function checkUserPermission(
  permissionType: PermissionType, 
  taskId?: string
): Promise<boolean> {
  const supabase = supabaseBrowser()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    
    const { data, error } = await supabase.rpc('check_user_permission', {
      p_user_id: user.id,
      p_permission_type: permissionType,
      p_target_task_id: taskId || null
    })
    
    if (error) {
      console.error('Errore verifica permessi:', error)
      return false
    }
    
    return data || false
  } catch (error) {
    console.error('Errore verifica permessi:', error)
    return false
  }
}

export async function getUserPermissions(): Promise<PermissionSetting[]> {
  const supabase = supabaseBrowser()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  
  // Ottieni ruolo utente
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
    
  if (!profile) return []
  
  // Ottieni permessi per il ruolo
  const { data: permissions, error } = await supabase
    .from('permission_settings')
    .select('*')
    .eq('role', profile.role)
    
  if (error) {
    console.error('Errore caricamento permessi:', error)
    return []
  }
  
  return permissions || []
}

// Funzioni per logging delle attività
export async function logActivity(
  action: string,
  resourceType: string,
  resourceId?: string,
  resourceTitle?: string,
  oldData?: any,
  newData?: any,
  success: boolean = true,
  errorMessage?: string
): Promise<string | null> {
  const supabase = supabaseBrowser()
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    
    // Ottieni info browser per contestualizzare l'azione
    const userAgent = navigator.userAgent
    const ipAddress = await getClientIP() // Implementare se necessario
    
    const { data, error } = await supabase.rpc('log_activity', {
      p_user_id: user.id,
      p_action: action,
      p_resource_type: resourceType,
      p_resource_id: resourceId || null,
      p_resource_title: resourceTitle || null,
      p_old_data: oldData ? JSON.stringify(oldData) : null,
      p_new_data: newData ? JSON.stringify(newData) : null,
      p_ip_address: ipAddress || null,
      p_user_agent: userAgent,
      p_success: success,
      p_error_message: errorMessage || null
    })
    
    if (error) {
      console.error('Errore logging:', error)
      return null
    }
    
    return data
  } catch (error) {
    console.error('Errore logging:', error)
    return null
  }
}

// Funzioni di convenienza per logging
export const ActivityLogger = {
  taskCreated: (taskId: string, taskTitle: string, taskData: any) =>
    logActivity('create', 'task', taskId, taskTitle, null, taskData),
    
  taskUpdated: (taskId: string, taskTitle: string, oldData: any, newData: any) =>
    logActivity('update', 'task', taskId, taskTitle, oldData, newData),
    
  taskDeleted: (taskId: string, taskTitle: string, taskData: any) =>
    logActivity('delete', 'task', taskId, taskTitle, taskData, null),
    
  taskStatusChanged: (taskId: string, taskTitle: string, oldStatus: string, newStatus: string) =>
    logActivity('status_change', 'task', taskId, taskTitle, 
      { status: oldStatus }, { status: newStatus }),
      
  taskAssigned: (taskId: string, taskTitle: string, assignments: any) =>
    logActivity('assign', 'task', taskId, taskTitle, null, assignments),
    
  commentAdded: (commentId: string, taskId: string, taskTitle: string, commentData: any) =>
    logActivity('create', 'comment', commentId, `Commento su: ${taskTitle}`, null, commentData),
    
  commentDeleted: (commentId: string, taskId: string, taskTitle: string, commentData: any) =>
    logActivity('delete', 'comment', commentId, `Commento su: ${taskTitle}`, commentData, null),
    
  taskViewed: (taskId: string, taskTitle: string) =>
    logActivity('view', 'task', taskId, taskTitle),
    
  loginAttempt: (success: boolean, error?: string) =>
    logActivity('login', 'auth', undefined, undefined, null, null, success, error),
    
  permissionChanged: (settingId: string, settingData: any, oldData: any, newData: any) =>
    logActivity('update', 'permission_setting', settingId, 'Impostazioni permessi', oldData, newData),
    
  userRoleChanged: (userId: string, userName: string, oldRole: string, newRole: string) =>
    logActivity('role_change', 'user', userId, userName, 
      { role: oldRole }, { role: newRole }),
}

// Utility per ottenere IP client (opzionale)
async function getClientIP(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip
  } catch {
    return null
  }
}

// Hook React per gestire i permessi
export function usePermissions() {
  const [permissions, setPermissions] = React.useState<PermissionSetting[]>([])
  const [loading, setLoading] = React.useState(true)
  
  React.useEffect(() => {
    loadPermissions()
  }, [])
  
  async function loadPermissions() {
    setLoading(true)
    const userPermissions = await getUserPermissions()
    setPermissions(userPermissions)
    setLoading(false)
  }
  
  function hasPermission(type: PermissionType): boolean {
    const permission = permissions.find(p => p.permission_type === type)
    return permission?.enabled || false
  }
  
  async function canPerformAction(type: PermissionType, taskId?: string): Promise<boolean> {
    if (!hasPermission(type)) return false
    return await checkUserPermission(type, taskId)
  }
  
  return {
    permissions,
    loading,
    hasPermission,
    canPerformAction,
    reload: loadPermissions
  }
}