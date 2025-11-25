import { useEffect, useMemo, useState } from 'react';
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
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(true);

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

  useEffect(() => {
    setHighlightIndex(0);
  }, [suggestions.length]);

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
    <main className="page stack-sm">
      <header className="stack-sm">
        <h1 className="text-2xl font-bold">Manage Users</h1>
        <p className="text-gray-700">Promote or demote admins. You cannot change your own role.</p>
      </header>

      {error && <p className="text-red-600">{error}</p>}

      <section className="card stack-sm" style={{ maxWidth: '520px' }}>
        <label className="block text-sm font-medium text-gray-700">Find a user</label>
        <div className="relative" style={{ position: 'relative' }}>
          <input
            className="input w-full"
            placeholder="Start typing a username"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setShowSuggestions(true);
              setSelectedId(null);
              setMessage(null);
              setActionError(null);
            }}
            onKeyDown={(e) => {
              if (suggestions.length === 0) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightIndex((prev) => (prev + 1) % suggestions.length);
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightIndex((prev) =>
                  prev - 1 < 0 ? suggestions.length - 1 : prev - 1
                );
              } else if (e.key === 'Tab' || e.key === 'Enter') {
                const choice = suggestions[highlightIndex];
                if (choice) {
                  e.preventDefault();
                  if (choice.id === user.id) return;
                  setSelectedId(choice.id);
                  setSearch(choice.display_name);
                  setShowSuggestions(false);
                  setMessage(null);
                  setActionError(null);
                }
              }
            }}
            autoComplete="off"
            style={{ position: 'relative', zIndex: 11 }}
          />
          {suggestions.length > 0 && showSuggestions && (
            <div
              className="card"
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                width: '100%',
                maxWidth: '100%',
                zIndex: 100,
                boxSizing: 'border-box',
                maxHeight: '176px', // fits ~5.5 rows at ~32px each
                overflowY: 'auto',
                padding: '6px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {suggestions.map((s, idx) => {
                  const isActive = idx === highlightIndex;
                  return (
                    <button
                      key={s.id}
                      className="w-full"
                      style={{
                        textAlign: 'left',
                        background: isActive ? 'var(--color-accent-weak)' : 'transparent',
                        border: 'none',
                        boxShadow: 'none',
                        padding: '2px 0',
                        borderRadius: 'var(--radius-sm)',
                      }}
                      onMouseEnter={() => setHighlightIndex(idx)}
                      onClick={() => {
                        if (s.id === user.id) return;
                        setSelectedId(s.id);
                        setSearch(s.display_name);
                        setShowSuggestions(false);
                        setMessage(null);
                        setActionError(null);
                      }}
                    >
                      <UserPill
                        name={s.display_name}
                        color={s.color_hex || '#777777'}
                        textColor={s.text_color || '#ffffff'}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {selectedUser ? (
          <div className="card stack-sm" style={{ background: 'var(--color-surface-muted)' }}>
            <div className="flex items-center gap-2">
              <UserPill
                name={selectedUser.display_name}
                color={selectedUser.color_hex || '#777777'}
                textColor={selectedUser.text_color || '#ffffff'}
              />
              <span className="pill text-xs" style={{ marginLeft: '4px' }}>
                {selectedUser.role}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn--primary btn--sm"
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
        ) : (
          <p className="text-sm text-gray-600">Search and select a user to manage their role.</p>
        )}
      </section>
    </main>
  );
}
