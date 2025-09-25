// app/dashboard/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { supabaseServer } from '@/lib/supabase/server';
import TaskCard from '@/components/TaskCard';
import TasksLive from '@/components/TasksLive';
import TaskFilters from '@/components/TaskFilters';
import BaseLayout from '@/components/BaseLayout';
import StatsCard from '@/components/StatsCard';
import Link from 'next/link';

type Props = {
  searchParams?: {
    scope?: 'visible' | 'mine' | 'created'
    status?: 'todo' | 'doing' | 'done'
  }
}

export default async function DashboardPage({ searchParams }: Props) {
  const supabase = supabaseServer();

  // utente
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // profilo
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();
  const displayName = (profile?.full_name ?? '').trim() || user.email;

  // filtri
  const scope = (searchParams?.scope ?? 'visible') as 'visible' | 'mine' | 'created';
  const status = searchParams?.status as 'todo' | 'doing' | 'done' | undefined;

  // dati
  let tasks: any[] | null = null;

  if (scope === 'mine') {
    const { data } = await supabase.rpc('tasks_assigned_to', {
      uid: user.id,
      p_status: status ?? null
    });
    tasks = data ?? [];
  } else {
    let q = supabase
      .from('tasks')
      .select('id, title, body, status, due_at, done_at, created_at, visible_to_all, created_by')
      .order('created_at', { ascending: false })
      .limit(20);

    if (status) q = q.eq('status', status);
    if (scope === 'created') q = q.eq('created_by', user.id);

    const { data } = await q;
    tasks = data ?? [];
  }

  // Statistiche
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayTasks = tasks?.filter(task => {
    if (!task.due_at) return false;
    const dueDate = new Date(task.due_at);
    return dueDate >= today && dueDate < tomorrow;
  }) || [];

  const completedToday = todayTasks.filter(t => t.status === 'done').length;
  const pendingToday = todayTasks.filter(t => t.status !== 'done').length;
  const totalTasks = tasks?.length || 0;
  const completedTotal = tasks?.filter(t => t.status === 'done').length || 0;
  const inProgressCount = tasks?.filter(t => t.status === 'doing').length || 0;
  const overdueCount = tasks?.filter(t => 
    t.due_at && 
    new Date(t.due_at) < new Date() && 
    t.status !== 'done'
  ).length || 0;

  return (
    <>
      <TasksLive />
      <BaseLayout
        user={{ name: displayName, role: profile?.role }}
        title={`Ciao ${displayName.split(' ')[0]}`}
        subtitle="Benvenuto nella tua dashboard"
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <StatsCard
            title="Task di oggi"
            value={todayTasks.length}
            subtitle={`${completedToday} completati, ${pendingToday} da fare`}
            color="blue"
          />
          <StatsCard
            title="Totale task"
            value={totalTasks}
            subtitle={`${completedTotal} completati`}
            color="gray"
          />
          <StatsCard
            title="In corso"
            value={inProgressCount}
            subtitle="Task attivi"
            color="orange"
          />
          <StatsCard
            title="In ritardo"
            value={overdueCount}
            subtitle="Da completare"
            color="red"
          />
        </div>

        {/* Sezione task */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800">
                Task ({scope === 'visible' ? 'Visibili a me' : 
                       scope === 'mine' ? 'Assegnati a me' : 'Creati da me'})
              </h2>
              <span className="text-sm text-gray-600">
                {tasks?.length || 0} task trovati
              </span>
            </div>
            
            <TaskFilters />
          </div>

          <div className="p-6">
            {(!tasks || tasks.length === 0) ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">
                  Nessun task da mostrare con i filtri attuali.
                </p>
                <Link 
                  href="/tasks/new" 
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Crea il primo task
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {tasks.map(t => <TaskCard key={t.id} task={t} />)}
              </div>
            )}
          </div>
        </div>

        {/* Task di oggi - sezione separata */}
        {todayTasks.length > 0 && (
          <div className="bg-white rounded-lg shadow mt-6">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">
                Task con scadenza oggi
              </h2>
            </div>
            <div className="p-6">
              <div className="grid gap-4">
                {todayTasks.map(task => (
                  <div key={task.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-800">{task.title}</h3>
                        {task.body && (
                          <p className="text-gray-600 text-sm mt-1">{task.body}</p>
                        )}
                        {task.due_at && (
                          <p className="text-gray-500 text-xs mt-1">
                            Scadenza: {new Date(task.due_at).toLocaleString('it-IT')}
                          </p>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        task.status === 'done' ? 'bg-green-100 text-green-800' :
                        task.status === 'doing' ? 'bg-blue-100 text-blue-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {task.status === 'done' ? 'Completato' :
                         task.status === 'doing' ? 'In corso' : 'Da fare'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </BaseLayout>
    </>
  );
}