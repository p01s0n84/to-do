'use client'
import { useState, useEffect } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import BaseLayout from '@/components/BaseLayout';
import { ActivityLogger } from '@/lib/permissions';

interface PermissionSetting {
  id: string;
  role: string;
  permission_type: string;
  scope: string;
  enabled: boolean;
}

export default function AdminPermissionsPage() {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState<PermissionSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<{[key: string]: Partial<PermissionSetting>}>({});

  const roles = ['dottori', 'igienisti', 'aso', 'consulenti', 'receptionist'];
  const permissionTypes = [
    { key: 'edit_tasks', label: 'Modificare task' },
    { key: 'delete_tasks', label: 'Eliminare task' },
    { key: 'view_tasks', label: 'Visualizzare task' },
    { key: 'assign_tasks', label: 'Assegnare task' }
  ];
  const scopes = [
    { key: 'own', label: 'Solo i propri' },
    { key: 'same_role', label: 'Stesso ruolo' },
    { key: 'same_group', label: 'Stesso gruppo' },
    { key: 'lower_roles', label: 'Ruoli inferiori' },
    { key: 'all', label: 'Tutti' }
  ];

  useEffect(() => {
    loadData();
  }, []);

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

      // Verifica se è admin
      if (profile?.role !== 'amministratore') {
        window.location.href = '/dashboard';
        return;
      }

      setUser({
        id: authUser.id,
        name: (profile?.full_name ?? '').trim() || authUser.email,
        role: profile?.role
      });

      // Carica impostazioni permessi
      const { data: permissionsData, error } = await supabase
        .from('permission_settings')
        .select('*')
        .order('role, permission_type');

      if (error) throw error;
      setPermissions(permissionsData || []);

    } catch (error) {
      console.error('Errore caricamento dati:', error);
    } finally {
      setLoading(false);
    }
  }

  function handlePermissionChange(permissionId: string, field: string, value: any) {
    setChanges(prev => ({
      ...prev,
      [permissionId]: {
        ...prev[permissionId],
        [field]: value
      }
    }));
  }

  async function saveChanges() {
    if (Object.keys(changes).length === 0) return;

    setSaving(true);
    const supabase = supabaseBrowser();

    try {
      for (const [permissionId, changes_data] of Object.entries(changes)) {
        const originalPermission = permissions.find(p => p.id === permissionId);
        
        const { error } = await supabase
          .from('permission_settings')
          .update({
            ...changes_data,
            updated_by: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', permissionId);

        if (error) throw error;

        // Log dell'attività
        await ActivityLogger.permissionChanged(
          permissionId,
          { role: originalPermission?.role, permission_type: originalPermission?.permission_type },
          originalPermission,
          { ...originalPermission, ...changes_data }
        );
      }

      // Ricarica dati aggiornati
      await loadData();
      setChanges({});
      alert('Impostazioni salvate con successo!');

    } catch (error) {
      console.error('Errore salvataggio:', error);
      alert('Errore nel salvare le impostazioni');
    } finally {
      setSaving(false);
    }
  }

  function getPermissionValue(permission: PermissionSetting, field: string) {
    const change = changes[permission.id];
    if (change && field in change) {
      return change[field];
    }
    return permission[field];
  }

  function getRoleLabel(role: string) {
    const labels = {
      'dottori': 'Dottori',
      'igienisti': 'Igienisti',
      'aso': 'ASO',
      'consulenti': 'Consulenti',
      'receptionist': 'Receptionist'
    };
    return labels[role] || role;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Caricamento impostazioni...</div>
      </div>
    );
  }

  return (
    <BaseLayout
      user={user}
      title="Gestione Permessi"
      subtitle="Configura i permessi per ogni ruolo utente"
    >
      <div className="space-y-6">
        {/* Header con azioni */}
        <div className="flex justify-between items-center">
          <div>
            <p className="text-gray-600">
              Configura cosa può fare ogni ruolo nel sistema. Le modifiche si applicano immediatamente.
            </p>
          </div>
          <div className="flex gap-3">
            {Object.keys(changes).length > 0 && (
              <button
                onClick={() => setChanges({})}
                className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                Annulla modifiche
              </button>
            )}
            <button
              onClick={saveChanges}
              disabled={saving || Object.keys(changes).length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salva modifiche'}
            </button>
          </div>
        </div>

        {/* Legenda */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Spiegazione degli ambiti:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
            <div><strong>Solo i propri:</strong> Solo task creati dall'utente</div>
            <div><strong>Stesso ruolo:</strong> Task creati da utenti con lo stesso ruolo</div>
            <div><strong>Stesso gruppo:</strong> Task assegnati ai gruppi dell'utente</div>
            <div><strong>Ruoli inferiori:</strong> Task di ruoli con meno privilegi</div>
            <div><strong>Tutti:</strong> Qualsiasi task nel sistema</div>
          </div>
        </div>

        {/* Tabella permessi */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ruolo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Permesso
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Abilitato
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ambito
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {permissions.map((permission) => (
                  <tr key={permission.id} className={changes[permission.id] ? 'bg-yellow-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                          {getRoleLabel(permission.role)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {permissionTypes.find(pt => pt.key === permission.permission_type)?.label}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={getPermissionValue(permission, 'enabled')}
                          onChange={(e) => handlePermissionChange(permission.id, 'enabled', e.target.checked)}
                          className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                      </label>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={getPermissionValue(permission, 'scope')}
                        onChange={(e) => handlePermissionChange(permission.id, 'scope', e.target.value)}
                        disabled={!getPermissionValue(permission, 'enabled')}
                        className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                      >
                        {scopes.map(scope => (
                          <option key={scope.key} value={scope.key}>
                            {scope.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Riepilogo modifiche */}
        {Object.keys(changes).length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-medium text-yellow-900 mb-2">
              Modifiche in sospeso ({Object.keys(changes).length})
            </h3>
            <div className="text-sm text-yellow-800">
              {Object.entries(changes).map(([permissionId, change]) => {
                const permission = permissions.find(p => p.id === permissionId);
                return (
                  <div key={permissionId} className="mb-1">
                    <strong>{getRoleLabel(permission?.role)} - {permissionTypes.find(pt => pt.key === permission?.permission_type)?.label}:</strong>
                    {' '}
                    {Object.entries(change).map(([field, value]) => (
                      <span key={field} className="ml-2">
                        {field === 'enabled' ? (value ? 'Abilitato' : 'Disabilitato') : 
                         field === 'scope' ? scopes.find(s => s.key === value)?.label : value}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </BaseLayout>
  );
}