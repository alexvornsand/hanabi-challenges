import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../hooks/useUsers';
import { postJsonAuth, ApiError } from '../../lib/api';
import { UserPill } from '../../components/UserPill';

export function AdminManageUsersPage() {
  const { user, token } = useAuth();
  const { users, error } = useUsers();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!user || user.role !== 'SUPERADMIN') {
    return <Navigate to="/" replace />;
  }

  const suggestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return users
      .filter((u) => u.display_name.toLowerCase().includes(term))
      .slice(0, 7);
  }, [search, users]);

  const selectedUser = users.find((u) => u.id === selectedId) ?? null;

  async function handleRoleChange(nextRole: 'ADMIN' | 'USER') {
    if (!selectedUser || !token) return;
    setSaving(true);
    setMessage(null);
    setActionError(null);
    try {
      await postJsonAuth(`/users/${selectedUser.id}/role`, token, { role: nextRole });
      setMessage(`Updated ${selectedUser.display_name} to ${nextRole}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setActionError((err.body as { error?: string })?.error ?? 'Failed to update role');
      } else {
        setActionError('Failed to update role');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-2xl font-bold">Manage Users</h1>
      <p className="text-gray-700">Promote or demote users. You cannot change your own role.</p>

      {error && <p className="text-red-600">{error}</p>}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Search users</label>
        <input
          className="w-full max-w-md border rounded px-3 py-2"
          placeholder="Type a username"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelectedId(null);
            setMessage(null);
            setActionError(null);
          }}
        />
        {suggestions.length > 0 && (
          <div className="border rounded p-2 bg-white shadow-sm max-w-md">
            <p className="text-xs text-gray-500 mb-1">Select a user</p>
            <div className="flex flex-wrap gap-1">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  className="border rounded px-2 py-1 text-sm bg-white hover:bg-blue-50"
                  onClick={() => {
                    if (s.id === user.id) return;
                    setSelectedId(s.id);
                    setSearch(s.display_name);
                    setMessage(null);
                    setActionError(null);
                  }}
                >
                  {s.display_name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="border rounded p-3 bg-white/80 space-y-2 max-w-xl">
          <div className="flex items-center gap-2">
            <UserPill
              name={selectedUser.display_name}
              color={selectedUser.color_hex || '#777777'}
              textColor={selectedUser.text_color || '#ffffff'}
            />
            <span className="text-sm text-gray-700">Current role: {selectedUser.role}</span>
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded bg-blue-600 text-white font-semibold disabled:opacity-60"
              disabled={saving || selectedUser.id === user.id}
              onClick={() =>
                handleRoleChange(selectedUser.role === 'ADMIN' ? 'USER' : 'ADMIN')
              }
            >
              {selectedUser.role === 'ADMIN' ? 'Demote to User' : 'Promote to Admin'}
            </button>
          </div>
          {message && <p className="text-green-700 text-sm">{message}</p>}
          {actionError && <p className="text-red-600 text-sm">{actionError}</p>}
        </div>
      )}
    </main>
  );
}
