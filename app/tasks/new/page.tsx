// app/tasks/new/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { listGroups, listUsers } from '@/lib/queries'
import { ActivityLogger } from '@/lib/permissions'
import BaseLayout from '@/components/BaseLayout'

export default function NewTaskPage() {
  const router = useRouter()
  const supabase = supabaseBrowser()
  
  const [user, setUser] = useState<any>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [visibleToAll, setVisibleToAll] = useState(true)
  const [groups, setGroups] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [selGroups, setSelGroups] = useState<string[]>([])
  const [selUsers, setSelUsers] = useState<string[]>([])
  const [error, setError] = useState<string|null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    // Carica utente corrente
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', authUser.id)
      .single()

    setUser({
      id: authUser.id,
      name: (profile?.full_name ?? '').trim() || authUser.email,
      role: profile?.role
    })

    // Carica gruppi e utenti
    try {
      const [g, u] = await Promise.all([listGroups(), listUsers()])
      setGroups(g || [])
      setUsers(u || [])
    } catch (e: any) {
      setError(e.message)
    }
  }

  function onToggleVisibleAll(checked: boolean) {
    setVisibleToAll(checked)
    if (checked) {
      setSelGroups([])
      setSelUsers([])
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Validazione
    if (!visibleToAll && selUsers.length === 0 && selGroups.length === 0) {
      setError('Se togli "Visibile a tutti", seleziona almeno un utente o un gruppo.')
      return
    }

    setLoading(true)
    try {
      const { data: me, error: e1 } = await supabase.from('profiles').select('id').single()
      if (e1 || !me) throw e1 || new Error('Profilo non trovato')

      const taskData = {
        title: title.trim(),
        body: body.trim() || null,
        due_at: dueAt || null,
        visible_to_all: visibleToAll,
        created_by: me.id,
      }

      const { data: task, error: e2 } = await supabase
        .from('tasks')
        .insert(taskData)
        .select('id')
        .single()
      if (e2) throw e2

      // Log della creazione task
      await ActivityLogger.taskCreated(task.id, title.trim(), taskData)

      // Inserisci destinatari solo se NON è "tutti"
      if (!visibleToAll) {
        const rows = [
          ...selUsers.map(uid => ({ task_id: task.id, user_id: uid })),
          ...selGroups.map(gid => ({ task_id: task.id, group_id: gid })),
        ]
        if (rows.length) {
          const { error: e3 } = await supabase.from('task_recipients').insert(rows)
          if (e3) throw e3

          // Log delle assegnazioni
          await ActivityLogger.taskAssigned(task.id, title.trim(), {
            users: selUsers,
            groups: selGroups,
            assignments_count: rows.length
          })
        }
      }

      router.push('/tasks')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
      
      // Log dell'errore
      await ActivityLogger.taskCreated('', title.trim() || 'Task senza titolo', null)
        .catch(() => {}) // Non vogliamo che il logging fallito blocchi l'utente
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-600">Caricamento...</div>
    </div>
  }

  return (
    <BaseLayout
      user={user}
      title="Nuovo Task"
      subtitle="Crea un nuovo task per il tuo team"
    >
      <div className="max-w-2xl mx-auto">
        <form onSubmit={onSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          {/* Titolo */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Titolo *
            </label>
            <input
              id="title"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Inserisci il titolo del task"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Descrizione */}
          <div>
            <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-2">
              Descrizione
            </label>
            <textarea
              id="body"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Descrizione dettagliata del task (opzionale)"
              value={body}
              onChange={e => setBody(e.target.value)}
            />
          </div>

          {/* Scadenza */}
          <div>
            <label htmlFor="dueAt" className="block text-sm font-medium text-gray-700 mb-2">
              Scadenza
            </label>
            <input
              id="dueAt"
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={dueAt}
              onChange={e => setDueAt(e.target.value)}
            />
            <p className="text-sm text-gray-500 mt-1">Opzionale - imposta una scadenza per il task</p>
          </div>

          {/* Visibilità */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-4">
              <input
                id="visibleToAll"
                type="checkbox"
                checked={visibleToAll}
                onChange={e => onToggleVisibleAll(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="visibleToAll" className="ml-2 text-sm font-medium text-gray-700">
                Visibile a tutti
              </label>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Se selezionato, tutti gli utenti potranno vedere questo task. 
              Altrimenti sarà visibile solo agli utenti/gruppi selezionati.
            </p>

            {!visibleToAll && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assegna a utenti
                  </label>
                  <select
                    multiple
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32"
                    value={selUsers}
                    onChange={(e) =>
                      setSelUsers(Array.from(e.target.selectedOptions).map(o => o.value))
                    }
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id} className="py-1">
                        {u.full_name || u.id}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Tieni premuto Ctrl per selezioni multiple</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assegna a gruppi
                  </label>
                  <select
                    multiple
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32"
                    value={selGroups}
                    onChange={(e) =>
                      setSelGroups(Array.from(e.target.selectedOptions).map(o => o.value))
                    }
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id} className="py-1">
                        {g.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Tieni premuto Ctrl per selezioni multiple</p>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Azioni */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Annulla
            </button>
            
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creazione in corso...' : 'Crea Task'}
            </button>
          </div>
        </form>
      </div>
    </BaseLayout>
  )
}