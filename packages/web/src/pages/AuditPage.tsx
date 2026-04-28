import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Badge,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { apiGet } from '../api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditGame {
  points: number;
  maxScore: boolean;
  bdr?: number;
  turnCount?: number;
  strikes?: number;
  source?: string;
}

interface AuditSlot {
  slotIndex: number;
  specString: string;
  games: AuditGame[];
  slotScore: number;
  scoreContribution: number;
  valid: boolean;
}

interface AuditResponse {
  unitId: number;
  unitName: string;
  unitType: 'individual' | 'team';
  slots: AuditSlot[];
  sectionScore: number;
  sectionRank: number;
}

// ---------------------------------------------------------------------------
// AuditPage
// ---------------------------------------------------------------------------

export function AuditPage() {
  const { slug, unitId } = useParams<{ slug: string; unitId: string }>();
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !unitId) return;
    setLoading(true);
    setError(null);
    apiGet<AuditResponse>(`/api/${slug}/audit/${unitId}`)
      .then(setAudit)
      .catch((err: Error) => {
        if (err.message.includes('404')) {
          setError('Unit not found.');
        } else {
          setError('Failed to load audit data.');
        }
      })
      .finally(() => setLoading(false));
  }, [slug, unitId]);

  if (loading) {
    return (
      <Group justify="center" mt="xl">
        <Loader />
      </Group>
    );
  }

  if (error || !audit) {
    return (
      <Stack align="center" mt="xl">
        <Text c="dimmed">{error ?? 'No data found.'}</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group align="center" gap="sm">
        <Title order={3}>{audit.unitName}</Title>
        <Badge variant="light">{audit.unitType}</Badge>
      </Group>

      {/* Section summary */}
      <Group gap="xl">
        <Text>
          <Text component="span" fw={600}>Section Score: </Text>
          {audit.sectionScore}
        </Text>
        <Text>
          <Text component="span" fw={600}>Rank: </Text>
          {audit.sectionRank > 0 ? `#${audit.sectionRank}` : '—'}
        </Text>
      </Group>

      {/* Per-slot breakdown */}
      {audit.slots.length === 0 && <Text c="dimmed">No game results yet.</Text>}

      {audit.slots.map((slot) => (
        <Stack key={slot.slotIndex} gap="xs">
          <Group gap="sm" align="center">
            <Text fw={600}>Slot {slot.slotIndex + 1}</Text>
            {slot.specString && (
              <Text size="sm" c="dimmed" style={{ fontFamily: 'monospace' }}>
                {slot.specString}
              </Text>
            )}
            <Badge variant="outline" color={slot.valid ? 'green' : 'red'}>
              {slot.valid ? 'valid' : 'invalid'}
            </Badge>
          </Group>

          {slot.games.length === 0 ? (
            <Text size="sm" c="dimmed">No games recorded.</Text>
          ) : (
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Points</Table.Th>
                  <Table.Th>Max Score</Table.Th>
                  <Table.Th>BDR</Table.Th>
                  <Table.Th>Source</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {slot.games.map((game, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{game.points}</Table.Td>
                    <Table.Td>{game.maxScore ? 'Yes' : 'No'}</Table.Td>
                    <Table.Td>{game.bdr ?? '—'}</Table.Td>
                    <Table.Td>{game.source ?? '—'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}

          <Group gap="xl">
            <Text size="sm">
              <Text component="span" fw={600}>Slot Score: </Text>
              {slot.slotScore}
            </Text>
            <Text size="sm">
              <Text component="span" fw={600}>Contribution: </Text>
              {slot.scoreContribution}
            </Text>
          </Group>
        </Stack>
      ))}
    </Stack>
  );
}
