'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { listGroups, listUsers } from '@/lib/queries'

export default function TaskForm() {
  const sb = supabaseBrowser()
  const router = useRouter()
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
    ;(async () => {
      try {
        const [g, u] = await Promise.all([listGroups(), listUsers()])
        setGroups(g || [])
        setUsers(u || [])
      } catch (e:any) {
        setError(e.message)
      }
    })()
  }, [])

  // opzionale: quando rimetti "Visibile a tutti", svuoto le selezioni
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

    // ✅ VALIDAZIONE: se NON è per tutti, serve almeno un destinatario
    if (!visibleToAll && selUsers.length === 0 && selGroups.length === 0) {
      setError('Se togli "Visibile a tutti", seleziona almeno un utente o un gruppo.')
      return
    }

    setLoading(true)
    try {
      const { data: me, error: e1 } = await sb.from('profiles').select('id').single()
      if (e1 || !me) throw e1 || new Error('Profilo non trovato')

      const { data: task, error: e2 } = await sb
        .from('tasks')
        .insert({
          title,
          body,
          due_at: dueAt || null,
          visible_to_all: visibleToAll,
          created_by: me.id,
        })
        .select('id')
        .single()
      if (e2) throw e2

      // Inserisci destinatari solo se NON è "tutti"
      if (!visibleToAll) {
        const rows = [
          ...selUsers.map(uid => ({ task_id: task.id, user_id: uid })),
          ...selGroups.map(gid => ({ task_id: task.id, group_id: gid })),
        ]
        if (rows.length) {
          const { error: e3 } = await sb.from('task_recipients').insert(rows)
          if (e3) throw e3
        }
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err:any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 border rounded-2xl p-6 shadow max-w-2xl">
      <h2 className="text-lg font-semibold">Nuovo Task</h2>

      <input
        className="w-full border rounded-xl p-2"
        placeholder="Titolo"
        value={title}
        onChange={e => setTitle(e.target.value)}
        required
      />

      <textarea
        className="w-full border rounded-xl p-2"
        placeholder="Descrizione"
        value={body}
        onChange={e => setBody(e.target.value)}
      />

      <input
        className="w-full border rounded-xl p-2"
        type="datetime-local"
        value={dueAt}
        onChange={e => setDueAt(e.target.value)}
      />

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={visibleToAll}
          onChange={e => onToggleVisibleAll(e.target.checked)}
        />
        Visibile a tutti
      </label>

      {!visibleToAll && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Assegna a utenti</label>
            <select
              multiple
              className="w-full border rounded-xl p-2 h-32"
              value={selUsers}
              onChange={(e) =>
                setSelUsers(Array.from(e.target.selectedOptions).map(o => o.value))
              }
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Assegna a gruppi</label>
            <select
              multiple
              className="w-full border rounded-xl p-2 h-32"
              value={selGroups}
              onChange={(e) =>
                setSelGroups(Array.from(e.target.selectedOptions).map(o => o.value))
              }
            >
              {groups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl border px-4 py-2"
      >
        {loading ? 'Salvataggio…' : 'Crea Task'}
      </button>
    </form>
  )
}
