'use client'
import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import BaseLayout from '@/components/BaseLayout';

interface ActivityLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_title: string;
  old_data: any;
  new_data: any;
  ip_address: string;
  user_agent: string;
  success: boolean;
  error_message: string;
  created_at: string;
}

export default function ActivityLogsPage() {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    resource_type: '',
    user_id: '',
    success: '',
    date_from: '',
    date_to: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [filters, pagination.page]);

  async function loadData() {
    const supabase = supabaseBrowser();
    
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', authUser.id)
        .single();

      // Solo admin possono vedere tutti i log
      if (profile?.role !== 'amministratore') {
        window.location.href = '/dashboard';
        return;
      }

      setUser({
        id: authUser.id,
        name: (profile?.full_name ?? '').trim() || authUser.email,
        role: profile?.role
      });

    } catch (error) {
      console.error('Errore caricamento utente:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs() {
    const supabase = supabaseBrowser();
    
    try {
      let query = supabase
        .from('activity_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(
          (pagination.page - 1) * pagination.limit, 
          pagination.page * pagination.limit - 1
        );

      // Applica filtri
      if (filters.action) {
        query = query.eq('action', filters.action);
      }
      if (filters.resource_type) {
        query = query.eq('resource_type', filters.resource_type);
      }
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      if (filters.success !== '') {
        query = query.eq('success', filters.success === 'true');
      }
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to);
      }

      const { data, error, count } = await query;
      
      if (error) throw error;
      
      setLogs(data || []);
      setPagination(prev => ({ ...prev, total: count || 0 }));

    } catch (error) {
      console.error('Errore caricamento log:', error);
    }
  }

  function handleFilterChange(key: string, value: string) {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset a pagina 1
  }

  function clearFilters() {
    setFilters({
      action: '',
      resource_type: '',
      user_id: '',
      success: '',
      date_from: '',
      date_to: ''
    });
  }

  function getActionIcon(action: string, success: boolean) {
    const baseClasses = "w-4 h-4";
    const colorClasses = success ? "text-green-600" : "text-red-600";
    
    switch (action) {
      case 'create':
        return <svg className={`${baseClasses} ${colorClasses}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>;
      case 'update':
        return <svg className={`${baseClasses} ${colorClasses}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>;
      case 'delete':
        return <svg className={`${baseClasses} ${colorClasses}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>;
      case 'view':
        return <svg className={`${baseClasses} ${colorClasses}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>;
      case 'login':
        return <svg className={`${baseClasses} ${colorClasses}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
        </svg>;
      default:
        return <svg className={`${baseClasses} ${colorClasses}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>;
    }
  }

  function getActionLabel(action: string) {
    const labels = {
      'create': 'Creazione',
      'update': 'Modifica', 
      'delete': 'Eliminazione',
      'view': 'Visualizzazione',
      'login': 'Login',
      'assign': 'Assegnazione',
      'status_change': 'Cambio stato',
      'role_change': 'Cambio ruolo'
    };
    return labels[action] || action;
  }

  function getResourceTypeLabel(type: string) {
    const labels = {
      'task': 'Task',
      'comment': 'Commento',
      'user': 'Utente',
      'permission_setting': 'Permesso',
      'auth': 'Autenticazione'
    };
    return labels[type] || type;
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Caricamento log delle attività...</div>
      </div>
    );
  }

  return (
    <BaseLayout
      user={user}
      title="Log delle Attività"
      subtitle="Cronologia completa di tutte le azioni nel sistema"
    >
      <div className="space-y-6">
        {/* Filtri */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Azione</label>
              <select
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Tutte</option>
                <option value="create">Creazione</option>
                <option value="update">Modifica</option>
                <option value="delete">Eliminazione</option>
                <option value="view">Visualizzazione</option>
                <option value="login">Login</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Risorsa</label>
              <select
                value={filters.resource_type}
                onChange={(e) => handleFilterChange('resource_type', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Tutte</option>
                <option value="task">Task</option>
                <option value="comment">Commento</option>
                <option value="user">Utente</option>
                <option value="permission_setting">Permesso</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Successo</label>
              <select
                value={filters.success}
                onChange={(e) => handleFilterChange('success', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Tutti</option>
                <option value="true">Successo</option>
                <option value="false">Errore</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Da data</label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => handleFilterChange('date_from', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">A data</label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => handleFilterChange('date_to', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Pulisci filtri
              </button>
            </div>
          </div>
        </div>

        {/* Statistiche veloci */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Totale eventi</div>
            <div className="text-2xl font-semibold text-gray-900">{pagination.total}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Eventi oggi</div>
            <div className="text-2xl font-semibold text-blue-600">
              {logs.filter(log => 
                new Date(log.created_at).toDateString() === new Date().toDateString()
              ).length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Successi</div>
            <div className="text-2xl font-semibold text-green-600">
              {logs.filter(log => log.success).length}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Errori</div>
            <div className="text-2xl font-semibold text-red-600">
              {logs.filter(log => !log.success).length}
            </div>
          </div>
        </div>

        {/* Tabella log */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Data/Ora
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Utente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Azione
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Risorsa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Dettagli
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Stato
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(log.created_at).toLocaleString('it-IT')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {log.user_name || 'Utente sconosciuto'}
                          </div>
                          <div className="text-sm text-gray-500">{log.user_role}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getActionIcon(log.action, log.success)}
                        <span className="ml-2 text-sm text-gray-900">
                          {getActionLabel(log.action)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{getResourceTypeLabel(log.resource_type)}</div>
                        {log.resource_title && (
                          <div className="text-gray-500 truncate max-w-xs" title={log.resource_title}>
                            {log.resource_title}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      {log.error_message && (
                        <div className="text-red-600 mb-1">{log.error_message}</div>
                      )}
                      {log.ip_address && (
                        <div className="text-xs">IP: {log.ip_address}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        log.success 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {log.success ? 'Successo' : 'Errore'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {logs.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun log trovato</h3>
              <p className="text-gray-500">Prova a modificare i filtri per vedere più risultati.</p>
            </div>
          )}

          {/* Paginazione */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  Mostrando {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} di {pagination.total} risultati
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                    className="px-3 py-2 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Precedente
                  </button>
                  <span className="text-sm text-gray-700">
                    Pagina {pagination.page} di {totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
                    disabled={pagination.page === totalPages}
                    className="px-3 py-2 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    Successiva
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </BaseLayout>
  );
}