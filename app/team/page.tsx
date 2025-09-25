'use client'
import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import BaseLayout from '@/components/BaseLayout';
import StatsCard from '@/components/StatsCard';

export default function TeamPage() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [taskAssignments, setTaskAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'groups' | 'assignments'

  useEffect(() => {
    loadTeamData();
  }, []);

  async function loadTeamData() {
    setLoading(true);
    const supabase = supabaseBrowser();
    
    try {
      // Carica utente corrente
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

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

      // Carica tutti gli utenti
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, role, last_seen_at, created_at')
        .order('full_name');

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Carica tutti i gruppi
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('id, name')
        .order('name');

      if (groupsError) throw groupsError;
      setGroups(groupsData || []);

      // Carica relazioni utenti-gruppi
      const { data: userGroupsData, error: userGroupsError } = await supabase
        .from('user_groups')
        .select(`
          user_id,
          group_id,
          user:profiles!user_id(full_name),
          group:groups!group_id(name)
        `);

      if (userGroupsError) throw userGroupsError;
      setUserGroups(userGroupsData || []);

      // Carica statistiche assegnazioni task
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('task_recipients')
        .select(`
          task_id,
          user_id,
          group_id,
          task:tasks!task_id(title, status),
          user:profiles!user_id(full_name),
          group:groups!group_id(name)
        `);

      if (assignmentsError) throw assignmentsError;
      setTaskAssignments(assignmentsData || []);

    } catch (error) {
      console.error('Errore nel caricare i dati del team:', error);
    } finally {
      setLoading(false);
    }
  }

  // Calcola statistiche
  const totalUsers = users.length;
  const totalGroups = groups.length;
  const activeUsers = users.filter(u => {
    const lastSeen = u.last_seen_at ? new Date(u.last_seen_at) : null;
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return lastSeen && lastSeen > dayAgo;
  }).length;
  
  const totalAssignments = taskAssignments.length;

  // Raggruppa utenti per gruppo
  const getUserGroups = (userId) => {
    return userGroups
      .filter(ug => ug.user_id === userId)
      .map(ug => ug.group?.name)
      .filter(Boolean);
  };

  // Raggruppa utenti per gruppo (per tab gruppi)
  const getGroupMembers = (groupId) => {
    return userGroups
      .filter(ug => ug.group_id === groupId)
      .map(ug => ug.user)
      .filter(Boolean);
  };

  // Conta task assegnati per utente
  const getUserTaskCount = (userId) => {
    return taskAssignments.filter(ta => ta.user_id === userId).length;
  };

  // Conta task assegnati per gruppo
  const getGroupTaskCount = (groupId) => {
    return taskAssignments.filter(ta => ta.group_id === groupId).length;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Mai';
    return new Date(dateString).toLocaleString('it-IT');
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'amministratore': return 'bg-red-100 text-red-700';
      case 'dottori': return 'bg-blue-100 text-blue-700';
      case 'igienisti': return 'bg-green-100 text-green-700';
      case 'aso': return 'bg-purple-100 text-purple-700';
      case 'consulenti': return 'bg-yellow-100 text-yellow-700';
      case 'receptionist': return 'bg-gray-100 text-gray-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Caricamento team...</div>
      </div>
    );
  }

  return (
    <BaseLayout
      user={user}
      title="Team"
      subtitle="Gestisci utenti, gruppi e assegnazioni"
    >
      {/* Statistiche */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatsCard
          title="Utenti totali"
          value={totalUsers}
          color="blue"
        />
        <StatsCard
          title="Utenti attivi oggi"
          value={activeUsers}
          subtitle="Ultimi accessi"
          color="green"
        />
        <StatsCard
          title="Gruppi"
          value={totalGroups}
          color="orange"
        />
        <StatsCard
          title="Task assegnati"
          value={totalAssignments}
          subtitle="Totali"
          color="gray"
        />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Utenti ({totalUsers})
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`py-4 border-b-2 font-medium text-sm ${
                activeTab === 'groups'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Gruppi ({totalGroups})
            </button>
            <button
              onClick={() => setActiveTab('assignments')}
              className={`py-4 border-b-2 font-medium text-sm ${
                activeTab === 'assignments'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Assegnazioni ({totalAssignments})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'users' && (
            <div className="space-y-4">
              {users.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nessun utente trovato.</p>
              ) : (
                <div className="grid gap-4">
                  {users.map((userItem) => (
                    <div key={userItem.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-700 font-semibold">
                              {(userItem.full_name || 'U').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {userItem.full_name || 'Nome non disponibile'}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(userItem.role)}`}>
                                {userItem.role || 'Nessun ruolo'}
                              </span>
                              <span className="text-sm text-gray-500">
                                {getUserTaskCount(userItem.id)} task assegnati
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600">
                            Ultimo accesso: {formatDate(userItem.last_seen_at)}
                          </div>
                          <div className="text-sm text-gray-500">
                            Registrato: {formatDate(userItem.created_at)}
                          </div>
                          {getUserGroups(userItem.id).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {getUserGroups(userItem.id).map((groupName) => (
                                <span key={groupName} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                  {groupName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'groups' && (
            <div className="space-y-4">
              {groups.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nessun gruppo trovato.</p>
              ) : (
                <div className="grid gap-4">
                  {groups.map((group) => {
                    const members = getGroupMembers(group.id);
                    const taskCount = getGroupTaskCount(group.id);
                    
                    return (
                      <div key={group.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                              👥
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{group.name}</h3>
                              <p className="text-sm text-gray-600">
                                {members.length} membri • {taskCount} task assegnati
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        {members.length > 0 && (
                          <div className="border-t pt-3">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Membri:</h4>
                            <div className="flex flex-wrap gap-2">
                              {members.map((member) => (
                                <span key={member.full_name} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                                  {member.full_name}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'assignments' && (
            <div className="space-y-4">
              {taskAssignments.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nessuna assegnazione trovata.</p>
              ) : (
                <div className="space-y-3">
                  {taskAssignments.map((assignment, index) => (
                    <div key={index} className="flex items-center justify-between border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${
                          assignment.task?.status === 'done' ? 'bg-green-500' :
                          assignment.task?.status === 'doing' ? 'bg-blue-500' : 'bg-orange-500'
                        }`} />
                        <div>
                          <h4 className="font-medium text-gray-900">
                            {assignment.task?.title || 'Task eliminato'}
                          </h4>
                          <p className="text-sm text-gray-600">
                            {assignment.task?.status === 'todo' ? 'Da fare' :
                             assignment.task?.status === 'doing' ? 'In corso' : 'Completato'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        {assignment.user ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Utente:</span>
                            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                              {assignment.user.full_name}
                            </span>
                          </div>
                        ) : assignment.group ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Gruppo:</span>
                            <span className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm font-medium">
                              {assignment.group.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Assegnazione rimossa</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </BaseLayout>
  );
}