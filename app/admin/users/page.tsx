'use client'
import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { ActivityLogger } from '@/lib/permissions';
import BaseLayout from '@/components/BaseLayout';

interface User {
  id: string;
  full_name: string;
  role: string;
  active: boolean;
  last_seen_at: string;
  created_at: string;
}

export default function AdminUsersPage() {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const [inviteForm, setInviteForm] = useState({
    email: '',
    full_name: '',
    role: 'receptionist'
  });
  
  const [editForm, setEditForm] = useState({
    full_name: '',
    role: ''
  });

  const roles = [
    { value: 'amministratore', label: 'Amministratore' },
    { value: 'consulenti', label: 'Consulenti' },
    { value: 'dottori', label: 'Dottori' },
    { value: 'igienisti', label: 'Igienisti' },
    { value: 'aso', label: 'ASO' },
    { value: 'receptionist', label: 'Receptionist' }
  ];

  useEffect(() => {
    loadData();
  }, [showInactive]);

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

      if (profile?.role !== 'amministratore') {
        window.location.href = '/dashboard';
        return;
      }

      setUser({
        id: authUser.id,
        name: (profile?.full_name ?? '').trim() || authUser.email,
        role: profile?.role
      });

      // Carica utenti (attivi o tutti)
      let query = supabase
        .from('profiles')
        .select('id, full_name, role, active, last_seen_at, created_at')
        .order('created_at', { ascending: false });

      if (!showInactive) {
        query = query.eq('active', true);
      }

      const { data: profilesData } = await query;
      setUsers(profilesData || []);

    } catch (error) {
      console.error('Errore caricamento dati:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteUser(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteForm.email || !inviteForm.full_name) return;

    setInviting(true);
    const supabase = supabaseBrowser();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessione non valida');

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: inviteForm.email,
            full_name: inviteForm.full_name,
            role: inviteForm.role
          })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nell\'invitare l\'utente');
      }

      await ActivityLogger.userRoleChanged(
        result.user?.id || '',
        inviteForm.full_name,
        '',
        inviteForm.role
      );

      alert(`Invito inviato con successo a ${inviteForm.email}!`);
      
      setInviteForm({ email: '', full_name: '', role: 'receptionist' });
      setShowInviteForm(false);
      
      setTimeout(() => loadData(), 1000);

    } catch (error: any) {
      console.error('Errore invito utente:', error);
      alert(error.message || 'Errore nell\'inviare l\'invito. Riprova.');
    } finally {
      setInviting(false);
    }
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    const supabase = supabaseBrowser();

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name.trim(),
          role: editForm.role
        })
        .eq('id', editingUser.id);

      if (error) throw error;

      await ActivityLogger.userRoleChanged(
        editingUser.id,
        editForm.full_name,
        editingUser.role,
        editForm.role
      );

      alert('Utente aggiornato con successo!');
      
      setShowEditForm(false);
      setEditingUser(null);
      await loadData();

    } catch (error) {
      console.error('Errore aggiornamento utente:', error);
      alert('Errore nell\'aggiornare l\'utente. Riprova.');
    }
  }

  async function handleDisableUser(userToDisable: User) {
    const action = userToDisable.active ? 'disabilitare' : 'riabilitare';
    if (!confirm(`Sei sicuro di voler ${action} l'utente ${userToDisable.full_name}?`)) return;

    const supabase = supabaseBrowser();

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ active: !userToDisable.active })
        .eq('id', userToDisable.id);

      if (error) throw error;

      await ActivityLogger.userRoleChanged(
        userToDisable.id,
        userToDisable.full_name,
        userToDisable.role,
        userToDisable.active ? 'disabilitato' : 'riabilitato'
      );

      alert(`Utente ${action} con successo!`);
      await loadData();

    } catch (error) {
      console.error('Errore:', error);
      alert(`Errore nel ${action} l'utente. Riprova.`);
    }
  }

  async function handleDeleteUser(userToDelete: User) {
    if (!confirm(
      `ATTENZIONE: Stai per ELIMINARE DEFINITIVAMENTE l'utente ${userToDelete.full_name}.\n\n` +
      `Questa azione:\n` +
      `- Eliminerà l'account di autenticazione\n` +
      `- Eliminerà tutti i dati associati\n` +
      `- NON PUÒ ESSERE ANNULLATA\n\n` +
      `Se vuoi solo impedire l'accesso temporaneamente, usa "Disabilita" invece.\n\n` +
      `Sei ASSOLUTAMENTE sicuro di voler procedere?`
    )) return;

    const supabase = supabaseBrowser();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessione non valida');

      // Chiama la Edge Function per eliminazione definitiva
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId: userToDelete.id })
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nell\'eliminare l\'utente');
      }

      await ActivityLogger.userRoleChanged(
        userToDelete.id,
        userToDelete.full_name,
        userToDelete.role,
        'eliminato definitivamente'
      );

      alert('Utente eliminato definitivamente!');
      await loadData();

    } catch (error: any) {
      console.error('Errore eliminazione utente:', error);
      alert(error.message || 'Errore nell\'eliminare l\'utente. Riprova.');
    }
  }

  function openEditForm(userToEdit: User) {
    setEditingUser(userToEdit);
    setEditForm({
      full_name: userToEdit.full_name,
      role: userToEdit.role
    });
    setShowEditForm(true);
  }

  function getRoleBadgeColor(role: string) {
    const colors = {
      'amministratore': 'bg-red-100 text-red-700',
      'consulenti': 'bg-yellow-100 text-yellow-700',
      'dottori': 'bg-blue-100 text-blue-700',
      'igienisti': 'bg-green-100 text-green-700',
      'aso': 'bg-purple-100 text-purple-700',
      'receptionist': 'bg-gray-100 text-gray-700'
    };
    return colors[role] || 'bg-gray-100 text-gray-700';
  }

  function getRoleLabel(role: string) {
    const labels = {
      'amministratore': 'Amministratore',
      'consulenti': 'Consulenti',
      'dottori': 'Dottori',
      'igienisti': 'Igienisti',
      'aso': 'ASO',
      'receptionist': 'Receptionist'
    };
    return labels[role] || role;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Caricamento utenti...</div>
      </div>
    );
  }

  const activeUsers = users.filter(u => u.active);
  const inactiveUsers = users.filter(u => !u.active);

  return (
    <BaseLayout user={user} title="Gestione Utenti" subtitle="Invita nuovi utenti e gestisci ruoli esistenti">
      <div className="space-y-6">
        {/* Header con filtri */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <p className="text-gray-600">
              Da qui puoi invitare nuovi utenti via email e gestire i ruoli di quelli esistenti.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="rounded"
              />
              <span>Mostra disabilitati</span>
            </label>
          </div>
          <button
            onClick={() => setShowInviteForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Invita Utente
          </button>
        </div>

        {/* Statistiche */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Utenti Attivi</div>
            <div className="text-2xl font-bold text-green-600">{activeUsers.length}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Utenti Disabilitati</div>
            <div className="text-2xl font-bold text-red-600">{inactiveUsers.length}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Totale</div>
            <div className="text-2xl font-bold text-gray-900">{users.length}</div>
          </div>
        </div>

        {/* Lista utenti */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              {showInactive ? 'Tutti gli Utenti' : 'Utenti Attivi'} ({users.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stato</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ruolo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ultimo Accesso</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Registrato</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((userItem) => (
                  <tr key={userItem.id} className={`hover:bg-gray-50 ${!userItem.active ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {userItem.active ? (
                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                          Attivo
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                          Disabilitato
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-700 font-semibold">
                            {userItem.full_name?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="ml-4 text-sm font-medium text-gray-900">
                          {userItem.full_name || 'Nome non disponibile'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeColor(userItem.role)}`}>
                        {getRoleLabel(userItem.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {userItem.last_seen_at ? new Date(userItem.last_seen_at).toLocaleString('it-IT') : 'Mai'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(userItem.created_at).toLocaleDateString('it-IT')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditForm(userItem)} className="text-blue-600 hover:text-blue-900">
                          Modifica
                        </button>
                        {userItem.id !== user?.id && (
                          <>
                            <button 
                              onClick={() => handleDisableUser(userItem)} 
                              className={userItem.active ? "text-orange-600 hover:text-orange-900" : "text-green-600 hover:text-green-900"}
                            >
                              {userItem.active ? 'Disabilita' : 'Riabilita'}
                            </button>
                            <button onClick={() => handleDeleteUser(userItem)} className="text-red-600 hover:text-red-900">
                              Elimina
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Invita */}
        {showInviteForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Invita Nuovo Utente</h3>
                  <button onClick={() => setShowInviteForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
              </div>

              <form onSubmit={handleInviteUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome e Cognome *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={inviteForm.full_name}
                    onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ruolo</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  >
                    {roles.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">
                    L'utente riceverà un'email di invito per completare la registrazione e impostare la propria password.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowInviteForm(false)} className="px-4 py-2 text-gray-600">
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {inviting ? 'Invio...' : 'Invia Invito'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Modifica */}
        {showEditForm && editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Modifica Utente</h3>
                  <button onClick={() => setShowEditForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
              </div>

              <form onSubmit={handleUpdateUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome e Cognome *</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ruolo</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    {roles.map(role => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowEditForm(false)} className="px-4 py-2 text-gray-600">
                    Annulla
                  </button>
                  <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                    Salva
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </BaseLayout>
  );
}