import React, { useEffect, useState } from 'react';
import { Group, Loader, Stack, Text, Title } from '@mantine/core';
import type { BadgeConfig } from '@hanabi/dsl';
import { apiGet } from '../api/client';
import { useAuth } from '../lib/auth';
import { BadgeDisplay } from '../components/BadgeDisplay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BadgeItem {
  awardId: number;
  awardName: string;
  issuedAt: string;
  eventName: string;
  badge: BadgeConfig | null;
}

interface AwardsResponse {
  userId: number;
  badges: BadgeItem[];
}

// ---------------------------------------------------------------------------
// AwardsPage
// ---------------------------------------------------------------------------

export function AwardsPage() {
  const { user } = useAuth();
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    apiGet<AwardsResponse>(`/api/users/${user.id}/awards`)
      .then((data) => setBadges(data.badges))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) {
    return (
      <Group justify="center" mt="xl">
        <Loader />
      </Group>
    );
  }

  if (error) {
    return (
      <Stack align="center" mt="xl">
        <Text c="dimmed">{error}</Text>
      </Stack>
    );
  }

  const displayBadges = badges
    .filter((b) => b.badge !== null)
    .map((b) => ({
      awardName: b.awardName,
      issuedAt: typeof b.issuedAt === 'string' ? b.issuedAt : new Date(b.issuedAt).toISOString(),
      eventName: b.eventName,
      badgeConfig: b.badge!,
    }));

  return (
    <Stack gap="lg">
      <Title order={2}>My Awards</Title>
      <BadgeDisplay badges={displayBadges} />
    </Stack>
  );
}
