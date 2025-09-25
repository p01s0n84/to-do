'use client'
import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import BaseLayout from '@/components/BaseLayout';
import StatsCard from '@/components/StatsCard';
import Link from 'next/link';

interface CalendarTask {
  id: string;
  title: string;
  body?: string;
  status: 'todo' | 'doing' | 'done';
  due_at: string;
  created_at: string;
}

export default function CalendarPage() {
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);
  const [editingTask, setEditingTask] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    body: '',
    dueTime: '09:00'
  });
  const [taskForm, setTaskForm] = useState({
    title: '',
    body: '',
    dueTime: '09:00'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = supabaseBrowser();
    
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', authUser.id)
      .single();

    setUser({
      name: (profile?.full_name ?? '').trim() || authUser.email,
      role: profile?.role,
      id: authUser.id
    });

    const { data: tasksData } = await supabase
      .from('tasks')
      .select('id, title, body, status, due_at, created_at')
      .not('due_at', 'is', null)
      .order('due_at', { ascending: true });

    setTasks(tasksData || []);
    setLoading(false);
  }

  const getWeekDates = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    
    const week = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      week.push(day);
    }
    return week;
  };

  const getMonthDates = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    
    const dayOfWeek = firstDay.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startDate.setDate(firstDay.getDate() + diff);

    const dates = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return dates;
  };

  const dates = viewMode === 'week' ? getWeekDates(currentDate) : getMonthDates(currentDate);
  const today = new Date();

  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const getTasksForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return tasks.filter(task => {
      const taskDate = new Date(task.due_at);
      return taskDate.toISOString().split('T')[0] === dateStr;
    });
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setCurrentDate(newDate);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowTaskForm(true);
    const currentHour = new Date().getHours();
    const suggestedTime = currentHour < 12 ? '09:00' : currentHour < 17 ? '14:00' : '18:00';
    setNewTask({
      title: '',
      body: '',
      dueTime: suggestedTime
    });
  };

  const handleTaskClick = (task: CalendarTask, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTask(task);
    setEditingTask(false);
    const taskDate = new Date(task.due_at);
    setTaskForm({
      title: task.title,
      body: task.body || '',
      dueTime: taskDate.toLocaleTimeString('it-IT', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    });
    setShowTaskDetails(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate || !newTask.title.trim() || !user) return;

    setSubmitting(true);
    const supabase = supabaseBrowser();

    try {
      const dueDateTime = new Date(selectedDate);
      const [hours, minutes] = newTask.dueTime.split(':');
      dueDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const { error } = await supabase
        .from('tasks')
        .insert({
          title: newTask.title.trim(),
          body: newTask.body.trim() || null,
          due_at: dueDateTime.toISOString(),
          visible_to_all: true,
          created_by: user.id
        });

      if (error) throw error;

      await loadData();
      setShowTaskForm(false);
      setSelectedDate(null);
      setNewTask({ title: '', body: '', dueTime: '09:00' });

    } catch (error) {
      console.error('Errore nella creazione del task:', error);
      alert('Errore nella creazione del task. Riprova.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !taskForm.title.trim()) return;

    setSubmitting(true);
    const supabase = supabaseBrowser();

    try {
      const taskDate = new Date(selectedTask.due_at);
      const [hours, minutes] = taskForm.dueTime.split(':');
      taskDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      const { error } = await supabase
        .from('tasks')
        .update({
          title: taskForm.title.trim(),
          body: taskForm.body.trim() || null,
          due_at: taskDate.toISOString()
        })
        .eq('id', selectedTask.id);

      if (error) throw error;

      await loadData();
      setShowTaskDetails(false);
      setSelectedTask(null);
      setEditingTask(false);

    } catch (error) {
      console.error('Errore nell\'aggiornare il task:', error);
      alert('Errore nell\'aggiornare il task. Riprova.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkTaskDone = async () => {
    if (!selectedTask) return;

    setSubmitting(true);
    const supabase = supabaseBrowser();

    try {
      const newStatus = selectedTask.status === 'done' ? 'todo' : 'done';
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          done_at: newStatus === 'done' ? new Date().toISOString() : null
        })
        .eq('id', selectedTask.id);

      if (error) throw error;

      await loadData();
      setShowTaskDetails(false);
      setSelectedTask(null);

    } catch (error) {
      console.error('Errore nel cambiare status del task:', error);
      alert('Errore nel cambiare status del task. Riprova.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask || !confirm('Sei sicuro di voler eliminare questo task?')) return;

    setSubmitting(true);
    const supabase = supabaseBrowser();

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', selectedTask.id);

      if (error) throw error;

      await loadData();
      setShowTaskDetails(false);
      setSelectedTask(null);

    } catch (error) {
      console.error('Errore nell\'eliminare il task:', error);
      alert('Errore nell\'eliminare il task. Riprova.');
    } finally {
      setSubmitting(false);
    }
  };

  const getDateTitle = () => {
    if (viewMode === 'week') {
      const weekStart = getWeekDates(currentDate)[0];
      const weekEnd = getWeekDates(currentDate)[6];
      return `${weekStart.getDate()} ${weekStart.toLocaleDateString('it-IT', { month: 'short' })} - ${weekEnd.getDate()} ${weekEnd.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    }
  };

  const upcomingTasks = tasks.filter(t => new Date(t.due_at) >= today && t.status !== 'done').length;
  const overdueTasks = tasks.filter(t => new Date(t.due_at) < today && t.status !== 'done').length;
  const thisWeekTasks = tasks.filter(t => {
    const taskDate = new Date(t.due_at);
    const weekStart = getWeekDates(today)[0];
    const weekEnd = getWeekDates(today)[6];
    return taskDate >= weekStart && taskDate <= weekEnd;
  }).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Caricamento calendario...</div>
      </div>
    );
  }

  return (
    <BaseLayout
      user={user}
      title="Calendario"
      subtitle="Visualizza i tuoi task in calendario"
      actions={
        <Link 
          href="/tasks/new" 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + Nuovo Task
        </Link>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatsCard
          title="In arrivo"
          value={upcomingTasks}
          subtitle="Task futuri"
          color="blue"
        />
        <StatsCard
          title="In ritardo"
          value={overdueTasks}
          subtitle="Da completare"
          color="red"
        />
        <StatsCard
          title="Questa settimana"
          value={thisWeekTasks}
          subtitle="Task in programma"
          color="orange"
        />
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-gray-800">{getDateTitle()}</h2>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => navigateDate('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  ←
                </button>
                <button 
                  onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Oggi
                </button>
                <button 
                  onClick={() => navigateDate('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  →
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 rounded-lg text-sm ${
                  viewMode === 'week'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Settimana
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 rounded-lg text-sm ${
                  viewMode === 'month'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Mese
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-7 gap-2">
            {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => (
              <div key={day} className="text-center text-sm font-semibold text-gray-600 p-2">
                {day}
              </div>
            ))}

            {dates.map((date, index) => {
              const dayTasks = getTasksForDate(date);
              const todayClass = isToday(date);
              const isCurrentMonthDate = viewMode === 'month' ? isCurrentMonth(date) : true;

              return (
                <div
                  key={index}
                  onClick={() => handleDateClick(date)}
                  className={`min-h-[120px] p-2 border rounded-lg cursor-pointer transition-colors ${
                    todayClass 
                      ? 'border-blue-300 bg-blue-50 hover:bg-blue-100' 
                      : 'border-gray-200 hover:bg-gray-50'
                  } ${!isCurrentMonthDate ? 'opacity-40' : ''}`}
                  title="Clicca per creare un task"
                >
                  <div className={`text-sm font-semibold mb-2 ${
                    todayClass 
                      ? 'text-blue-700' 
                      : isCurrentMonthDate ? 'text-gray-900' : 'text-gray-400'
                  }`}>
                    {date.getDate()}
                  </div>

                  <div className="space-y-1">
                    {dayTasks.slice(0, viewMode === 'week' ? 4 : 2).map((task) => (
                      <div
                        key={task.id}
                        onClick={(e) => handleTaskClick(task, e)}
                        className={`text-xs p-2 rounded text-left cursor-pointer hover:opacity-80 transition-opacity ${
                          task.status === 'done' 
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : task.status === 'doing'
                            ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' 
                            : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                        }`}
                        title={`${task.title} - Clicca per dettagli`}
                      >
                        <div className="font-medium">
                          {new Date(task.due_at).toLocaleTimeString('it-IT', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                        <div className="truncate">{task.title}</div>
                        {task.status === 'done' && (
                          <div className="text-green-600 text-xs mt-1">✓ Fatto</div>
                        )}
                      </div>
                    ))}
                    {dayTasks.length > (viewMode === 'week' ? 4 : 2) && (
                      <div className="text-xs text-gray-500 text-center">
                        +{dayTasks.length - (viewMode === 'week' ? 4 : 2)} altri
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal creazione task */}
      {showTaskForm && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Nuovo task per {selectedDate.toLocaleDateString('it-IT', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long' 
                  })}
                </h3>
                <button
                  onClick={() => {
                    setShowTaskForm(false);
                    setSelectedDate(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateTask} className="p-6 space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Titolo *
                </label>
                <input
                  id="title"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Inserisci il titolo del task"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-2">
                  Descrizione
                </label>
                <textarea
                  id="body"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Descrizione opzionale"
                  value={newTask.body}
                  onChange={(e) => setNewTask({ ...newTask, body: e.target.value })}
                />
              </div>

              <div>
                <label htmlFor="dueTime" className="block text-sm font-medium text-gray-700 mb-2">
                  Ora
                </label>
                <input
                  id="dueTime"
                  type="time"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={newTask.dueTime}
                  onChange={(e) => setNewTask({ ...newTask, dueTime: e.target.value })}
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowTaskForm(false);
                    setSelectedDate(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={submitting}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={!newTask.title.trim() || submitting}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Creazione...' : 'Crea Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal dettaglio/modifica task */}
      {showTaskDetails && selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${
                    selectedTask.status === 'done' ? 'bg-green-500' :
                    selectedTask.status === 'doing' ? 'bg-blue-500' : 'bg-orange-500'
                  }`} />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingTask ? 'Modifica Task' : 'Dettaglio Task'}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowTaskDetails(false);
                    setSelectedTask(null);
                    setEditingTask(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            {editingTask ? (
              <form onSubmit={handleUpdateTask} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Titolo *
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Descrizione
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={taskForm.body}
                    onChange={(e) => setTaskForm({ ...taskForm, body: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ora
                  </label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={taskForm.dueTime}
                    onChange={(e) => setTaskForm({ ...taskForm, dueTime: e.target.value })}
                    required
                  />
                </div>

                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingTask(false)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    disabled={submitting}
                  >
                    Annulla modifica
                  </button>
                  <button
                    type="submit"
                    disabled={!taskForm.title.trim() || submitting}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Salvando...' : 'Salva modifiche'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6 space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900 text-xl mb-2">
                    {selectedTask.title}
                  </h4>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      selectedTask.status === 'done' ? 'bg-green-100 text-green-700' :
                      selectedTask.status === 'doing' ? 'bg-blue-100 text-blue-700' : 
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {selectedTask.status === 'todo' ? 'Da fare' : 
                       selectedTask.status === 'doing' ? 'In corso' : 'Completato'}
                    </span>
                    <span>
                      {new Date(selectedTask.due_at).toLocaleString('it-IT')}
                    </span>
                  </div>
                </div>

                {selectedTask.body && (
                  <div>
                    <h5 className="font-medium text-gray-700 mb-2">Descrizione</h5>
                    <p className="text-gray-600 bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">
                      {selectedTask.body}
                    </p>
                  </div>
                )}

                <div className="text-sm text-gray-500">
                  Creato il {new Date(selectedTask.created_at).toLocaleString('it-IT')}
                </div>

                <div className="flex flex-col gap-3 pt-4 border-t">
                  <button
                    onClick={handleMarkTaskDone}
                    disabled={submitting}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                      selectedTask.status === 'done'
                        ? 'bg-orange-600 hover:bg-orange-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    } disabled:opacity-50`}
                  >
                    {submitting ? 'Aggiornando...' : (
                      selectedTask.status === 'done' ? 'Riapri task' : 'Segna come fatto'
                    )}
                  </button>

                  <button
                    onClick={() => setEditingTask(true)}
                    disabled={submitting}
                    className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                  >
                    Modifica task
                  </button>

                  <button
                    onClick={handleDeleteTask}
                    disabled={submitting}
                    className="w-full bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                  >
                    Elimina task
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </BaseLayout>
  );
}