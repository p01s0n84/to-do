// app/tasks/page.tsx
'use client'
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import BaseLayout from '@/components/BaseLayout';
import StatsCard from '@/components/StatsCard';
import TaskCard from '@/components/TaskCard';
import Link from 'next/link';

interface Task {
  id: string;
  title: string;
  body?: string;
  status: 'todo' | 'doing' | 'done';
  due_at?: string;
  done_at?: string;
  created_at: string;
  visible_to_all: boolean;
  created_by: string;
}

export default function TasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]); // Per le statistiche
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filtri dalla URL
  const scope = (searchParams.get('scope') || 'visible') as 'visible' | 'mine' | 'created';
  const status = searchParams.get('status') as 'todo' | 'doing' | 'done' | null;
  const sortBy = (searchParams.get('sort') || 'created_at') as 'created_at' | 'due_at' | 'title' | 'status';
  const sortOrder = (searchParams.get('order') || 'desc') as 'asc' | 'desc';

  useEffect(() => {
    loadData();
  }, [searchParams]);

  async function loadData() {
    setLoading(true);
    const supabase = supabaseBrowser();
    
    // Carica utente
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', authUser.id)
      .single();

    setUser({
      name: (profile?.full_name ?? '').trim() || authUser.email,
      role: profile?.role
    });

    // Carica TUTTI i task per le statistiche (senza filtro status)
    let allTasksQuery;
    if (scope === 'mine') {
      const { data: allTasks } = await supabase.rpc('tasks_assigned_to', {
        uid: authUser.id,
        p_status: null // Tutti i task per le statistiche
      });
      setAllTasks(allTasks || []);
    } else {
      allTasksQuery = supabase
        .from('tasks')
        .select('id, title, body, status, due_at, done_at, created_at, visible_to_all, created_by');

      if (scope === 'created') allTasksQuery = allTasksQuery.eq('created_by', authUser.id);
      
      const { data: allTasks } = await allTasksQuery;
      setAllTasks(allTasks || []);
    }

    // Carica task filtrati per la visualizzazione
    let query;
    
    if (scope === 'mine') {
      // Usa RPC per task assegnati
      const { data } = await supabase.rpc('tasks_assigned_to', {
        uid: authUser.id,
        p_status: status
      });
      setTasks(data || []);
    } else {
      // Query normale per visibili/creati
      query = supabase
        .from('tasks')
        .select('id, title, body, status, due_at, done_at, created_at, visible_to_all, created_by');

      if (status) query = query.eq('status', status);
      if (scope === 'created') query = query.eq('created_by', authUser.id);

      // Ordinamento
      if (sortBy === 'due_at') {
        query = query.order('due_at', { ascending: sortOrder === 'asc', nullsLast: true });
      } else {
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });
      }

      const { data } = await query;
      setTasks(data || []);
    }
    
    setLoading(false);
  }

  // Aggiorna URL con nuovi parametri
  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/tasks?${params.toString()}`);
  };

  // Callback per aggiornare i task quando viene modificato uno
  const handleTaskUpdate = (updatedTask: Task) => {
    // Aggiorna la lista dei task visualizzati
    setTasks(currentTasks => 
      currentTasks.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      )
    );
    
    // Aggiorna anche la lista completa per le statistiche
    setAllTasks(currentAllTasks => 
      currentAllTasks.map(task => 
        task.id === updatedTask.id ? updatedTask : task
      )
    );
  };
  const filteredTasks = tasks.filter(task => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      task.title.toLowerCase().includes(query) ||
      (task.body && task.body.toLowerCase().includes(query))
    );
  });

  // Statistiche basate su TUTTI i task del scope (non filtrati per status)
  const totalTasks = allTasks.filter(task => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      task.title.toLowerCase().includes(query) ||
      (task.body && task.body.toLowerCase().includes(query))
    );
  }).length;
  
  const todoTasks = allTasks.filter(t => {
    const matchesSearch = !searchQuery || 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.body && t.body.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch && t.status === 'todo';
  }).length;
  
  const doingTasks = allTasks.filter(t => {
    const matchesSearch = !searchQuery || 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.body && t.body.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch && t.status === 'doing';
  }).length;
  
  const doneTasks = allTasks.filter(t => {
    const matchesSearch = !searchQuery || 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.body && t.body.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch && t.status === 'done';
  }).length;
  
  const overdueTasks = allTasks.filter(t => {
    const matchesSearch = !searchQuery || 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.body && t.body.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch && t.due_at && new Date(t.due_at) < new Date() && t.status !== 'done';
  }).length;

  const getScopeLabel = () => {
    switch (scope) {
      case 'visible': return 'Visibili a me';
      case 'mine': return 'Assegnati a me';
      case 'created': return 'Creati da me';
      default: return 'Tutti i task';
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-600">Caricamento task...</div>
    </div>;
  }

  return (
    <BaseLayout
      user={user}
      title="Task"
      subtitle={`Gestisci tutti i tuoi task - ${getScopeLabel()}`}
      actions={
        <Link 
          href="/tasks/new" 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Nuovo Task
        </Link>
      }
    >
      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <StatsCard
          title="Totale"
          value={totalTasks}
          color="gray"
          size="sm"
        />
        <StatsCard
          title="Da fare"
          value={todoTasks}
          color="orange"
          size="sm"
        />
        <StatsCard
          title="In corso"
          value={doingTasks}
          color="blue"
          size="sm"
        />
        <StatsCard
          title="Completati"
          value={doneTasks}
          color="green"
          size="sm"
        />
        <StatsCard
          title="In ritardo"
          value={overdueTasks}
          color="red"
          size="sm"
        />
      </div>

      {/* Filtri e controlli */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Barra di ricerca */}
            <div className="flex-1">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Cerca nei task..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Filtri scope */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">Mostra:</span>
              <select 
                value={scope}
                onChange={(e) => updateFilter('scope', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="visible">Visibili a me</option>
                <option value="mine">Assegnati a me</option>
                <option value="created">Creati da me</option>
              </select>
            </div>

            {/* Filtro status */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">Status:</span>
              <select 
                value={status || ''}
                onChange={(e) => updateFilter('status', e.target.value || null)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tutti</option>
                <option value="todo">Da fare</option>
                <option value="doing">In corso</option>
                <option value="done">Completati</option>
              </select>
            </div>

            {/* Ordinamento */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 font-medium">Ordina per:</span>
              <select 
                value={sortBy}
                onChange={(e) => updateFilter('sort', e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="created_at">Data creazione</option>
                <option value="due_at">Scadenza</option>
                <option value="title">Titolo</option>
                <option value="status">Status</option>
              </select>
              <button
                onClick={() => updateFilter('order', sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title={sortOrder === 'asc' ? 'Crescente' : 'Decrescente'}
              >
                <svg className={`w-4 h-4 transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Filtri rapidi */}
        <div className="p-4 bg-gray-50">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => updateFilter('status', null)}
              className={`px-3 py-1 rounded-full text-sm ${
                !status ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Tutti ({totalTasks})
            </button>
            <button
              onClick={() => updateFilter('status', 'todo')}
              className={`px-3 py-1 rounded-full text-sm ${
                status === 'todo' ? 'bg-orange-100 text-orange-700' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Da fare ({todoTasks})
            </button>
            <button
              onClick={() => updateFilter('status', 'doing')}
              className={`px-3 py-1 rounded-full text-sm ${
                status === 'doing' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              In corso ({doingTasks})
            </button>
            <button
              onClick={() => updateFilter('status', 'done')}
              className={`px-3 py-1 rounded-full text-sm ${
                status === 'done' ? 'bg-green-100 text-green-700' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Completati ({doneTasks})
            </button>
            {overdueTasks > 0 && (
              <button
                onClick={() => {
                  // Filtro custom per task in ritardo
                  setSearchQuery('');
                  updateFilter('status', null);
                  // TODO: implementare filtro personalizzato per overdue
                }}
                className="px-3 py-1 rounded-full text-sm bg-red-100 text-red-700 hover:bg-red-200"
              >
                In ritardo ({overdueTasks})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lista task */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun task trovato</h3>
              <p className="text-gray-500 mb-4">
                {searchQuery 
                  ? `Nessun task corrisponde alla ricerca "${searchQuery}"`
                  : 'Non ci sono task da mostrare con i filtri attuali.'
                }
              </p>
              {!searchQuery && (
                <Link 
                  href="/tasks/new" 
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Crea il primo task
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  Mostrando {filteredTasks.length} task
                  {searchQuery && ` per "${searchQuery}"`}
                </p>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Cancella ricerca
                  </button>
                )}
              </div>

              {filteredTasks.map(task => (
                <TaskCard key={task.id} task={task} onTaskUpdate={handleTaskUpdate} />
              ))}
            </div>
          )}
        </div>
      </div>
    </BaseLayout>
  );
}