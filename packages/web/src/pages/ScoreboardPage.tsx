import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Group, Loader, Stack, Tabs, Text, Title } from '@mantine/core';
import { apiGet } from '../api/client';
import { Scoreboard } from '../components/Scoreboard';
import type { ComputedScoreboard } from '../components/Scoreboard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreboardMeta {
  name: string;
  primary: boolean;
  featured: boolean;
}

interface ScoreboardsResponse {
  scoreboards: ScoreboardMeta[];
}

interface StandingsResponse extends ComputedScoreboard {
  hidden?: boolean;
}

// ---------------------------------------------------------------------------
// ScoreboardPage
// ---------------------------------------------------------------------------

export function ScoreboardPage() {
  const { slug, name: nameParam } = useParams<{ slug: string; name?: string }>();
  const [tabs, setTabs] = useState<ScoreboardMeta[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(nameParam ?? null);
  const [scoreboard, setScoreboard] = useState<ComputedScoreboard | null>(null);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load tab list
  useEffect(() => {
    if (!slug) return;
    apiGet<ScoreboardsResponse>(`/api/${slug}/scoreboards`)
      .then((data) => {
        setTabs(data.scoreboards);
        if (!activeTab && data.scoreboards.length > 0) {
          const primary = data.scoreboards.find((s) => s.primary) ?? data.scoreboards[0];
          setActiveTab(primary?.name ?? null);
        }
      })
      .catch(() => setTabs([]));
  }, [slug]);

  // Load scoreboard data
  const fetchStandings = useCallback(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    const url = activeTab ? `/api/${slug}/standings/${activeTab}` : `/api/${slug}/standings`;
    apiGet<StandingsResponse>(url)
      .then((data) => {
        if (data.hidden) {
          setHidden(true);
          setScoreboard(null);
        } else {
          setHidden(false);
          setScoreboard(data);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug, activeTab]);

  useEffect(() => {
    fetchStandings();
  }, [fetchStandings]);

  if (!slug) return null;

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <Title order={3}>Standings</Title>
        <Button variant="default" size="xs" onClick={fetchStandings} loading={loading}>
          Refresh
        </Button>
      </Group>

      {tabs.length > 1 && (
        <Tabs
          value={activeTab}
          onChange={(val) => {
            setActiveTab(val);
          }}
        >
          <Tabs.List>
            {tabs.map((t) => (
              <Tabs.Tab key={t.name} value={t.name}>
                {t.name}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      )}

      {loading && (
        <Group justify="center">
          <Loader size="sm" />
        </Group>
      )}

      {!loading && error && <Text c="red">{error}</Text>}

      {!loading && hidden && (
        <Text c="dimmed">Results are not yet visible for this event.</Text>
      )}

      {!loading && !error && !hidden && scoreboard && (
        <Scoreboard scoreboard={scoreboard} />
      )}
    </Stack>
  );
}
