// components/TaskCard.tsx
'use client'
import { useState, useEffect } from 'react'
import { markDone, markTodo, isTaskReadByUser } from '@/lib/queries'
import { checkUserPermission, ActivityLogger } from '@/lib/permissions'
import { supabaseBrowser } from '@/lib/supabase/client'
import Link from 'next/link'

interface TaskCardProps {
  task: any;
  onTaskUpdate?: (updatedTask: any) => void;
}

export default function TaskCard({ task, onTaskUpdate }: TaskCardProps) {
  const [local, setLocal] = useState(task)
  const [loading, setLoading] = useState(false)
  const [commentsCount, setCommentsCount] = useState<number | null>(null)
  const [isRead, setIsRead] = useState<boolean | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [permissions, setPermissions] = useState({
    canEdit: false,
    canDelete: false,
    canChangeStatus: false
  })

  useEffect(() => {
    loadCardData();
    checkPermissions();
  }, [task.id]);

  async function loadCardData() {
    try {
      const supabase = supabaseBrowser();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setCurrentUserId(user.id);

      const { count, error: commentsError } = await supabase
        .from('task_comments')
        .select('*', { count: 'exact', head: true })
        .eq('task_id', task.id);
      
      if (commentsError) throw commentsError;
      setCommentsCount(count || 0);

      const readDate = await isTaskReadByUser(task.id, user.id);
      setIsRead(!!readDate);

    } catch (error) {
      console.error('Errore nel caricare i dati della card:', error);
      setCommentsCount(0);
      setIsRead(false);
    }
  }

  async function checkPermissions() {
    try {
      const [canEdit, canDelete] = await Promise.all([
        checkUserPermission('edit_tasks', task.id),
        checkUserPermission('delete_tasks', task.id)
      ]);
      
      setPermissions({
        canEdit,
        canDelete,
        canChangeStatus: canEdit // Assumiamo che chi può editare può cambiare status
      });
    } catch (error) {
      console.error('Errore verifica permessi:', error);
      setPermissions({ canEdit: false, canDelete: false, canChangeStatus: false });
    }
  }

  async function onDone() {
    if (loading || !permissions.canChangeStatus) return;
    
    setLoading(true);
    try {
      const oldStatus = local.status;
      const updated = await markDone(task.id);
      setLocal(updated);
      
      // Log dell'attività
      await ActivityLogger.taskStatusChanged(
        task.id, 
        task.title, 
        oldStatus, 
        'done'
      );
      
      if (onTaskUpdate) {
        onTaskUpdate(updated);
      }
    } catch (error) {
      console.error('Errore nel completare il task:', error);
    } finally {
      setLoading(false);
    }
  }

  async function onReopen() {
    if (loading || !permissions.canChangeStatus) return;
    
    setLoading(true);
    try {
      const oldStatus = local.status;
      const updated = await markTodo(task.id);
      setLocal(updated);
      
      // Log dell'attività
      await ActivityLogger.taskStatusChanged(
        task.id,
        task.title,
        oldStatus,
        'todo'
      );
      
      if (onTaskUpdate) {
        onTaskUpdate(updated);
      }
    } catch (error) {
      console.error('Errore nel riaprire il task:', error);
    } finally {
      setLoading(false);
    }
  }

  async function onDelete() {
    if (!permissions.canDelete || !confirm('Sei sicuro di voler eliminare questo task?')) return;
    
    setLoading(true);
    const supabase = supabaseBrowser();
    
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);

      if (error) throw error;
      
      // Log dell'attività
      await ActivityLogger.taskDeleted(task.id, task.title, local);
      
      if (onTaskUpdate) {
        onTaskUpdate({ ...local, deleted: true });
      }
      
    } catch (error) {
      console.error('Errore nell\'eliminare il task:', error);
      alert('Errore nell\'eliminare il task. Riprova.');
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-100 text-green-700 border-green-200'
      case 'doing': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'todo': return 'bg-orange-100 text-orange-700 border-orange-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done': 
        return (
          <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )
      case 'doing': 
        return (
          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )
      case 'todo': 
        return (
          <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
          </svg>
        )
      default: 
        return (
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth={2} />
          </svg>
        )
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isOverdue = local.due_at && new Date(local.due_at) < new Date() && local.status !== 'done'

  if (local.deleted) {
    return null; // Non renderizzare task eliminati
  }

  return (
    <div className={`rounded-xl border p-4 shadow-sm transition-all hover:shadow-md relative ${
      isOverdue ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
    }`}>
      {/* Indicatore di lettura */}
      {isRead !== null && (
        <div className="absolute top-2 right-2">
          {isRead ? (
            <div className="w-3 h-3 bg-blue-500 rounded-full" title="Letto" />
          ) : (
            <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" title="Non letto" />
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {getStatusIcon(local.status)}
          <div className="flex-1 min-w-0">
            <h3 className={`text-lg font-semibold truncate ${
              local.status === 'done' ? 'line-through text-gray-500' : 'text-gray-800'
            }`}>
              {local.title}
            </h3>
            {local.body && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                {local.body}
              </p>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <span className={`px-3 py-1 rounded-full text-xs font-medium border flex-shrink-0 ${getStatusColor(local.status)}`}>
          {local.status === 'todo' ? 'Da fare' : 
           local.status === 'doing' ? 'In corso' : 'Completato'}
        </span>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
        {local.due_at && (
          <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600' : ''}`}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>
              Scadenza: {formatDate(local.due_at)}
              {isOverdue && <span className="ml-1 font-medium">(In ritardo)</span>}
            </span>
          </div>
        )}
        
        {local.visible_to_all !== undefined && (
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>{local.visible_to_all ? 'Pubblico' : 'Privato'}</span>
          </div>
        )}

        {/* Indicatore commenti */}
        {commentsCount !== null && (
          <div className={`flex items-center gap-1 ${commentsCount > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>
              {commentsCount === 0 ? 'Nessun commento' : `${commentsCount} commento${commentsCount > 1 ? 'i' : ''}`}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {local.status === 'done' && local.done_at ? (
            <span className="text-green-600 font-medium">
              ✓ Completato il {formatDate(local.done_at)}
            </span>
          ) : (
            <span>
              Creato il {formatDate(local.created_at)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Link al dettaglio - sempre disponibile */}
          <Link
            href={`/tasks/${task.id}`}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Dettaglio
          </Link>

          {/* Bottone modifica - solo se ha permessi */}
          {permissions.canEdit && (
            <Link
              href={`/tasks/${task.id}/edit`}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 px-3 py-1.5 border border-blue-300 rounded-lg hover:bg-blue-50 text-sm transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Modifica
            </Link>
          )}

          {/* Bottone elimina - solo se ha permessi */}
          {permissions.canDelete && (
            <button
              onClick={onDelete}
              disabled={loading}
              className="flex items-center gap-2 text-red-600 hover:text-red-800 px-3 py-1.5 border border-red-300 rounded-lg hover:bg-red-50 text-sm transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Elimina
            </button>
          )}

          {/* Bottoni di status - solo se ha permessi */}
          {permissions.canChangeStatus && (
            local.status === 'done' ? (
              <button
                onClick={onReopen}
                disabled={loading}
                className="flex items-center gap-2 bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Riapri
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={onDone}
                disabled={loading}
                className="flex items-center gap-2 bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Segna fatto
                  </>
                )}
              </button>
            )
          )}
        </div>
      </div>

      {/* Messaggio per permessi negati */}
      {(!permissions.canChangeStatus && currentUserId) && (
        <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
          Non hai i permessi per modificare lo stato di questo task
        </div>
      )}
    </div>
  )
}