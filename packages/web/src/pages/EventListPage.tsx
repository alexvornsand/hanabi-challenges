import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Group, Table, Text } from '@mantine/core';
import { apiGet } from '../api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EventRow {
  id: number;
  slug: string | null;
  name: string;
  status: string;
  updatedAt: string | null;
}

interface ListResponse {
  events: EventRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: string): string {
  if (status === 'published') return 'blue';
  if (status === 'closed') return 'green';
  return 'gray';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// EventListPage
// ---------------------------------------------------------------------------

export function EventListPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<ListResponse>('/api/admin/events')
      .then((data) => setEvents(data.events))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Text c="dimmed" size="sm" p="xl">
        Loading events…
      </Text>
    );
  }

  if (error) {
    return (
      <Text c="red" size="sm" p="xl">
        Error loading events: {error}
      </Text>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 900 }}>
      <Group justify="space-between" mb="lg">
        <Text fw={600} size="xl">
          Events
        </Text>
        <Button onClick={() => navigate('/admin/events/new')}>New Event</Button>
      </Group>

      {events.length === 0 ? (
        <Text c="dimmed" size="sm">
          No events yet. Click "New Event" to create one.
        </Text>
      ) : (
        <Table striped highlightOnHover withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Last Updated</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {events.map((ev) => (
              <Table.Tr key={ev.id}>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {ev.name}
                  </Text>
                  {ev.slug && (
                    <Text size="xs" c="dimmed">
                      /{ev.slug}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge color={statusColor(ev.status)} variant="light">
                    {ev.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatDate(ev.updatedAt)}</Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      variant="default"
                      onClick={() => navigate(`/admin/events/${ev.id}/edit`)}
                    >
                      Edit
                    </Button>
                    {ev.status === 'draft' && (
                      <Button
                        size="xs"
                        onClick={() => navigate(`/admin/events/${ev.id}/edit`)}
                      >
                        Publish
                      </Button>
                    )}
                    {ev.status === 'published' && (
                      <Button size="xs" color="red" variant="light" disabled>
                        Close
                      </Button>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </div>
  );
}
