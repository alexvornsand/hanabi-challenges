import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import { apiPost } from '../api/client';
import { useAuth } from '../lib/auth';

interface LoginResponse {
  ok: boolean;
  user: { id: number; display_name: string; isOrganiser: boolean };
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiPost<LoginResponse>('/api/auth/login', {
        displayName,
        password,
      });
      setUser({
        id: data.user.id,
        displayName: data.user.display_name,
        isOrganiser: data.user.isOrganiser,
      });
      navigate('/admin/events');
    } catch {
      setError('Invalid display name or password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <Paper shadow="sm" p="xl" radius="md" style={{ width: '100%', maxWidth: 400 }}>
        <Stack gap="md">
          <Title order={3}>Sign in</Title>

          <form onSubmit={(e) => void handleSubmit(e)}>
            <Stack gap="sm">
              <TextInput
                label="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.currentTarget.value)}
                required
                autoFocus
              />
              <PasswordInput
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
              />
              {error && (
                <Text c="red" size="sm">
                  {error}
                </Text>
              )}
              <Button type="submit" loading={submitting} fullWidth mt="xs">
                Sign in
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </div>
  );
}
