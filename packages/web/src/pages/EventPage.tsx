import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Badge,
  Group,
  Divider,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { apiGet } from '../api/client';
import { useAuth } from '../lib/auth';
import { AdminPanel } from '../components/AdminPanel';
import { Scoreboard } from '../components/Scoreboard';
import type { ComputedScoreboard } from '../components/Scoreboard';
import { BadgeDisplay } from '../components/BadgeDisplay';
import type { BadgeConfig } from '@hanabi/dsl';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EventOverview {
  id: number;
  name: string;
  slug: string;
  status: 'draft' | 'published' | 'closed';
  scoreboards: Array<{ name: string; primary: boolean; featured: boolean }>;
  dimensions?: Array<{ axis: string; values: string[] }>;
  primaryScoreboard?: ComputedScoreboard | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: EventOverview['status']): string {
  if (status === 'published') return 'blue';
  if (status === 'closed') return 'gray';
  return 'gray';
}

// ---------------------------------------------------------------------------
// EventPage
// ---------------------------------------------------------------------------

interface BadgeItem {
  awardName: string;
  issuedAt: string;
  eventName: string;
  badgeConfig: BadgeConfig;
}

export function EventPage() {
  const { slug, division } = useParams<{ slug: string; division?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [badges, setBadges] = useState<BadgeItem[]>([]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    apiGet<EventOverview>(`/api/${slug}`)
      .then(setEvent)
      .catch((err: Error) => {
        if (err.message.includes('404')) {
          setError('Event not found.');
        } else {
          setError('Failed to load event.');
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  // Fetch user badges for this event
  useEffect(() => {
    if (!slug || !user) return;
    apiGet<{ userId: number; badges: Array<{ awardName: string; issuedAt: string; badge: BadgeConfig | null }> }>(`/api/${slug}/badges/${user.id}`)
      .then((data) => {
        setBadges(
          data.badges
            .filter((b) => b.badge !== null)
            .map((b) => ({
              awardName: b.awardName,
              issuedAt: typeof b.issuedAt === 'string' ? b.issuedAt : new Date(b.issuedAt).toISOString(),
              eventName: slug,
              badgeConfig: b.badge!,
            })),
        );
      })
      .catch(() => setBadges([]));
  }, [slug, user]);

  if (loading) {
    return (
      <Group justify="center" mt="xl">
        <Loader />
      </Group>
    );
  }

  if (error || !event) {
    return (
      <Stack align="center" mt="xl">
        <Text c="dimmed">{error ?? 'Event not found.'}</Text>
      </Stack>
    );
  }

  // Division selector: only shown when event has dimension data
  const dimensionBlock = event.dimensions?.[0];
  const divisionValues = dimensionBlock?.values ?? [];

  function handleDivisionChange(value: string) {
    navigate(`/${slug}/${value}`);
  }

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group align="center" gap="sm">
        <Title order={2}>{event.name}</Title>
        <Badge color={statusColor(event.status)} variant="light">
          {event.status}
        </Badge>
      </Group>

      {/* Division selector */}
      {divisionValues.length > 1 && (
        <SegmentedControl
          data={divisionValues}
          value={division ?? divisionValues[0]}
          onChange={handleDivisionChange}
        />
      )}

      {/* Primary scoreboard */}
      {event.primaryScoreboard ? (
        <Scoreboard scoreboard={event.primaryScoreboard} />
      ) : (
        <Text c="dimmed" size="sm">No scoreboard available.</Text>
      )}

      {/* User badges for this event */}
      {badges.length > 0 && (
        <>
          <Divider />
          <Stack gap="sm">
            <Text fw={600}>Your badges</Text>
            <BadgeDisplay badges={badges} />
          </Stack>
        </>
      )}

      {/* Floating admin shortcut for organisers */}
      <AdminPanel eventId={event.id} slug={event.slug} />
    </Stack>
  );
}
