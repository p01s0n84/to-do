'use client'
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { markDone, markTodo, markTaskAsRead, getTaskReads } from '@/lib/queries';
import BaseLayout from '@/components/BaseLayout';

export default function TaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;
  
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [taskReads, setTaskReads] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [taskId]);

  async function loadData() {
    setLoading(true);
    const supabase = supabaseBrowser();
    
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', authUser.id)
        .single();

      setUser({
        id: authUser.id,
        name: (profile?.full_name ?? '').trim() || authUser.email,
        role: profile?.role
      });

      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select(`
          id, title, body, status, due_at, done_at, created_at, visible_to_all, created_by,
          creator:profiles!created_by(full_name)
        `)
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;
      setTask(taskData);

      await markTaskAsRead(taskId, authUser.id);

      const { data: commentsData, error: commentsError } = await supabase
        .from('task_comments')
        .select(`
          id, body, created_at, author_id,
          author:profiles!author_id(full_name)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;
      setComments(commentsData || []);

      const readsData = await getTaskReads(taskId);
      setTaskReads(readsData);

    } catch (error) {
      console.error('Errore nel caricare i dati:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleTaskStatusChange(newStatus) {
    if (!task || taskLoading) return;
    
    setTaskLoading(true);
    try {
      const updated = newStatus === 'done' 
        ? await markDone(task.id)
        : await markTodo(task.id);
      
      setTask({ ...task, ...updated });
    } catch (error) {
      console.error('Errore nell\'aggiornare il task:', error);
    } finally {
      setTaskLoading(false);
    }
  }

  async function handleSubmitComment(e) {
    e.preventDefault();
    if (!newComment.trim() || !user || submittingComment) return;

    setSubmittingComment(true);
    const supabase = supabaseBrowser();

    try {
      const { data, error } = await supabase
        .from('task_comments')
        .insert({
          task_id: taskId,
          author_id: user.id,
          body: newComment.trim()
        })
        .select(`
          id, body, created_at, author_id,
          author:profiles!author_id(full_name)
        `)
        .single();

      if (error) throw error;

      setComments([...comments, data]);
      setNewComment('');
    } catch (error) {
      console.error('Errore nell\'aggiungere il commento:', error);
    } finally {
      setSubmittingComment(false);
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('it-IT');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'done': return 'bg-green-100 text-green-700 border-green-200';
      case 'doing': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'todo': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Caricamento task...</div>
      </div>
    );
  }

  if (!task) {
    return (
      <BaseLayout user={user} title="Task non trovato">
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Il task richiesto non è stato trovato.</p>
          <button 
            onClick={() => router.push('/tasks')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Torna ai task
          </button>
        </div>
      </BaseLayout>
    );
  }

  const isOverdue = task.due_at && new Date(task.due_at) < new Date() && task.status !== 'done';

  return (
    <BaseLayout
      user={user}
      title="Dettaglio Task"
      subtitle={task.title}
      actions={
        <button 
          onClick={() => router.push('/tasks')}
          className="text-gray-600 hover:text-gray-800 px-4 py-2 border rounded-lg"
        >
          Torna ai task
        </button>
      }
    >
      <div className="max-w-4xl mx-auto space-y-6">
        <div className={`bg-white rounded-xl shadow-sm border p-6 ${
          isOverdue ? 'border-red-200' : 'border-gray-200'
        }`}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className={`text-2xl font-bold mb-2 ${
                task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-900'
              }`}>
                {task.title}
              </h1>
              
              <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                <span>Creato da: {task.creator?.full_name || 'Utente sconosciuto'}</span>
                <span>•</span>
                <span>{formatDate(task.created_at)}</span>
                <span>•</span>
                <span>{task.visible_to_all ? 'Pubblico' : 'Privato'}</span>
              </div>

              {task.body && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Descrizione</h3>
                  <p className="text-gray-900 whitespace-pre-wrap">{task.body}</p>
                </div>
              )}

              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(task.status)}`}>
                  {task.status === 'todo' ? 'Da fare' : 
                   task.status === 'doing' ? 'In corso' : 'Completato'}
                </span>

                {task.due_at && (
                  <div className={`text-sm ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
                    <strong>Scadenza:</strong> {formatDate(task.due_at)}
                    {isOverdue && <span className="ml-2 font-medium">(In ritardo)</span>}
                  </div>
                )}

                {task.status === 'done' && task.done_at && (
                  <div className="text-sm text-green-600">
                    <strong>Completato:</strong> {formatDate(task.done_at)}
                  </div>
                )}
              </div>
            </div>

            <div className="ml-6">
              {task.status === 'done' ? (
                <button
                  onClick={() => handleTaskStatusChange('todo')}
                  disabled={taskLoading}
                  className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  Riapri
                </button>
              ) : (
                <button
                  onClick={() => handleTaskStatusChange('done')}
                  disabled={taskLoading}
                  className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Completa
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Visualizzazioni ({taskReads.length})
          </h2>

          {taskReads.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              Nessuno ha ancora visto questo task.
            </p>
          ) : (
            <div className="space-y-3">
              {taskReads.map((read, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      👁️
                    </div>
                    <span className="font-medium text-gray-900">
                      {read.user?.full_name || 'Utente sconosciuto'}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDate(read.seen_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Commenti ({comments.length})
          </h2>

          <div className="space-y-4 mb-6">
            {comments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Nessun commento ancora. Sii il primo a commentare!
              </p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="border-l-4 border-blue-200 pl-4 py-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-gray-900">
                      {comment.author?.full_name || 'Utente sconosciuto'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(comment.created_at)}
                    </span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{comment.body}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSubmitComment} className="border-t border-gray-200 pt-4">
            <div className="mb-4">
              <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                Aggiungi un commento
              </label>
              <textarea
                id="comment"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Scrivi il tuo commento..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                disabled={submittingComment}
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!newComment.trim() || submittingComment}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingComment ? 'Invio in corso...' : 'Commenta'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </BaseLayout>
  );
}