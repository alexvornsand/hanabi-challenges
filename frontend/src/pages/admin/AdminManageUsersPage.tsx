import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../hooks/useUsers';
import { postJsonAuth, ApiError } from '../../lib/api';
import { UserPill } from '../../features/users/UserPill';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Inline,
  PageContainer,
  Pill,
  Section,
  Stack,
  Text,
  SearchSelect,
} from '../../design-system';

export function AdminManageUsersPage() {
  const { user, token } = useAuth();
  const { users, error } = useUsers();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const suggestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return users
      .filter((u) => u.id !== user?.id)
      .filter((u) => u.id !== selectedId)
      .filter((u) => u.display_name.toLowerCase().includes(term))
      .slice(0, 7);
  }, [search, users, user, selectedId]);

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

  if (!user || user.role !== 'SUPERADMIN') {
    return <Navigate to="/" replace />;
  }

  return (
    <main>
      <PageContainer>
        <Heading level={1}>Manage users</Heading>
        <Section paddingY="lg">
          <Stack gap="md">
            <Text variant="body">
              Promote or demote admins. You cannot change your own role. Start typing to find a user
              and update their role.
            </Text>

            {error && <Alert variant="error" message={error} />}

            <Card variant="outline">
              <CardHeader>
                <Heading level={3}>Find a user</Heading>
              </CardHeader>
              <CardBody>
                <Stack gap="sm">
                  <SearchSelect
                    value={search}
                    onChange={(next) => {
                      setSearch(next);
                      setSelectedId(null);
                      setMessage(null);
                      setActionError(null);
                    }}
                    suggestions={suggestions.map((s) => ({
                      key: s.id,
                      value: s,
                      node: (
                        <UserPill
                          name={s.display_name}
                          color={s.color_hex || '#777777'}
                          textColor={s.text_color || '#ffffff'}
                        />
                      ),
                    }))}
                    onSelect={(s) => {
                      if (s.id === user.id) return;
                      setSelectedId(s.id);
                      setSearch('');
                      setMessage(null);
                      setActionError(null);
                    }}
                    placeholder="Start typing a username"
                    maxSelections={1}
                    selectedCount={selectedId ? 1 : 0}
                    tokens={
                      selectedUser
                        ? [
                            <button
                              type="button"
                              key={selectedUser.id}
                              className="ds-search-select__token ds-search-select__token-button"
                              onClick={() => {
                                setSelectedId(null);
                                setSearch('');
                                setMessage(null);
                                setActionError(null);
                              }}
                              title="Remove selection"
                            >
                              <UserPill
                                name={selectedUser.display_name}
                                color={selectedUser.color_hex || '#777777'}
                                textColor={selectedUser.text_color || '#ffffff'}
                                hoverIcon={
                                  <span className="material-symbols-outlined" aria-hidden="true">
                                    &#xe5c9;
                                  </span>
                                }
                              />
                            </button>,
                          ]
                        : []
                    }
                  />

                  {selectedUser ? (
                    <Card variant="outline" separated>
                      <CardBody>
                        <Stack gap="sm">
                          <Inline gap="sm" align="center">
                            <UserPill
                              name={selectedUser.display_name}
                              color={selectedUser.color_hex || '#777777'}
                              textColor={selectedUser.text_color || '#ffffff'}
                            />
                            <Pill size="sm" variant="accent">
                              {selectedUser.role}
                            </Pill>
                          </Inline>
                          <Inline gap="sm">
                            <Button
                              variant="primary"
                              size="md"
                              disabled={saving || selectedUser.id === user.id}
                              onClick={() =>
                                handleRoleChange(selectedUser.role === 'ADMIN' ? 'USER' : 'ADMIN')
                              }
                            >
                              {selectedUser.role === 'ADMIN'
                                ? 'Demote to User'
                                : 'Promote to Admin'}
                            </Button>
                          </Inline>
                          {message && <Alert variant="success" message={message} />}
                          {actionError && <Alert variant="error" message={actionError} />}
                        </Stack>
                      </CardBody>
                    </Card>
                  ) : (
                    <Text variant="muted">
                      Search and select a user to manage their role. You cannot change your own.
                    </Text>
                  )}
                </Stack>
              </CardBody>
            </Card>
          </Stack>
        </Section>
      </PageContainer>
    </main>
  );
}
