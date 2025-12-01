import React from 'react';
import { Link } from 'react-router-dom';
import {
  Alert,
  Button,
  Heading,
  Inline,
  PageContainer,
  Pagination,
  Section,
  Stack,
  Text,
} from '../design-system';
import { EventCard } from '../features/events';
import { useAuth } from '../context/AuthContext';
import { useEvents } from '../hooks/useEvents';
import { putJsonAuth } from '../lib/api';

export const EventsPage: React.FC = () => {
  const { events, loading, error, refetch } = useEvents({ includeUnpublishedForAdmin: true });
  const { user, token } = useAuth();
  const [page, setPage] = React.useState(1);
  const pageSize = 10;
  const [now] = React.useState(() => Date.now());
  const isAdmin = user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN');
  const [publishError, setPublishError] = React.useState<string | null>(null);

  const visibleEvents =
    user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN')
      ? events
      : events.filter((e) => e.published);

  const categorize = (e: (typeof visibleEvents)[number]) => {
    const start = e.starts_at ? new Date(e.starts_at).getTime() : null;
    const end = e.ends_at ? new Date(e.ends_at).getTime() : null;
    const regOpens = e.registration_opens_at ? new Date(e.registration_opens_at).getTime() : start;
    const regCutoff = e.registration_cutoff ? new Date(e.registration_cutoff).getTime() : end;
    const isUnbound = start == null && end == null;
    const regOpen = regOpens == null || regOpens <= now;
    const regStillOpen = regCutoff == null || regCutoff >= now || e.allow_late_registration;
    const inPlay = start != null && end != null && start <= now && end >= now;
    const completed = end != null && end < now;

    if (!e.published)
      return { bucket: 1 as const, sort: end ?? Number.MAX_SAFE_INTEGER, unbound: isUnbound };
    if (regOpen && regStillOpen)
      return { bucket: 2 as const, sort: end ?? Number.MAX_SAFE_INTEGER, unbound: isUnbound };
    if (inPlay)
      return { bucket: 3 as const, sort: end ?? Number.MAX_SAFE_INTEGER, unbound: isUnbound };
    if (completed)
      return { bucket: 4 as const, sort: end ?? Number.MAX_SAFE_INTEGER, unbound: isUnbound };
    return { bucket: 4 as const, sort: end ?? Number.MAX_SAFE_INTEGER, unbound: isUnbound };
  };

  const sortedEvents = [...visibleEvents].sort((a, b) => {
    const ca = categorize(a);
    const cb = categorize(b);
    if (ca.bucket !== cb.bucket) return ca.bucket - cb.bucket;
    if (ca.unbound !== cb.unbound) return ca.unbound ? 1 : -1; // unbound last within bucket
    return (cb.sort ?? -Infinity) - (ca.sort ?? -Infinity);
  });

  React.useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(sortedEvents.length / pageSize));
    if (page > totalPages) setPage(totalPages);
  }, [sortedEvents.length, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sortedEvents.length / pageSize));
  const pageStart = (page - 1) * pageSize;
  const pagedEvents = sortedEvents.slice(pageStart, pageStart + pageSize);

  const togglePublish = async (event: (typeof events)[number]) => {
    if (!isAdmin || !token) return;
    try {
      setPublishError(null);
      await putJsonAuth(`/events/${encodeURIComponent(event.slug)}`, token, {
        published: !event.published,
      });
      refetch();
    } catch (err) {
      console.error('Failed to update publish state', err);
      if (err instanceof Error && 'body' in err) {
        const apiErr = err as { body?: { error?: string }; status?: number };
        setPublishError(apiErr.body?.error || 'Failed to update publish state');
      } else {
        setPublishError('Failed to update publish state');
      }
    } finally {
      setSavingId(null);
    }
  };

  return (
    <main>
      <PageContainer>
        <Section paddingY="lg" header={<Heading level={1}>Events</Heading>}>
          <Text variant="body">All Hanabi events, past and present.</Text>

          {loading && <Text variant="muted">Loading events…</Text>}

          {error && <Alert variant="error" message={error ?? 'Unable to load events.'} />}

          {!loading && !error && visibleEvents.length === 0 && (
            <Text variant="muted">No events found yet.</Text>
          )}

          {!loading && !error && visibleEvents.length > 0 && (
            <Stack gap="sm">
              {publishError && <Alert variant="error" message={publishError} />}
              {pagedEvents.map((event) => {
                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    description="short"
                    now={now}
                    headerAction={
                      isAdmin ? (
                        <Button
                          as={Link}
                          to={`/admin/events/${event.slug}/edit`}
                          variant="ghost"
                          size="sm"
                          className="material-symbols-outlined"
                          aria-label="Edit event"
                          title="Edit event"
                        >
                          edit
                        </Button>
                      ) : undefined
                    }
                    secondaryAction={
                      isAdmin ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="material-symbols-outlined"
                          title={event.published ? 'Unpublish' : 'Publish'}
                          aria-label={event.published ? 'Unpublish event' : 'Publish event'}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            togglePublish(event);
                          }}
                        >
                          {event.published ? '\ue8f4' : '\ue8f5'}
                        </Button>
                      ) : undefined
                    }
                  />
                );
              })}
              {totalPages > 1 && (
                <Inline justify="center">
                  <Pagination
                    totalItems={sortedEvents.length}
                    pageSize={pageSize}
                    currentPage={page}
                    onPageChange={setPage}
                  />
                </Inline>
              )}
            </Stack>
          )}
        </Section>
      </PageContainer>
    </main>
  );
};
