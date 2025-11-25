import React from 'react';
import { Link } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';
import { useAuth } from '../context/AuthContext';

function formatDateRange(startsAt: string | null, endsAt: string | null) {
  if (!startsAt && !endsAt) return null;

  const start = startsAt ? new Date(startsAt) : null;
  const end = endsAt ? new Date(endsAt) : null;

  if (start && end) {
    return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
  }
  if (start) return `Starts ${start.toLocaleDateString()}`;
  if (end) return `Ends ${end.toLocaleDateString()}`;
  return null;
}

export const EventArchivePage: React.FC = () => {
  const { events, loading, error } = useEvents();
  const { user } = useAuth();
  const visibleEvents = user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN')
    ? events
    : events.filter((e) => e.published);

  const sortedEvents = [...visibleEvents].sort((a, b) => {
    const aStart = a.starts_at ? new Date(a.starts_at).getTime() : -Infinity;
    const bStart = b.starts_at ? new Date(b.starts_at).getTime() : -Infinity;
    if (aStart !== bStart) return bStart - aStart;
    const aEnd = a.ends_at ? new Date(a.ends_at).getTime() : -Infinity;
    const bEnd = b.ends_at ? new Date(b.ends_at).getTime() : -Infinity;
    return bEnd - aEnd;
  });

  return (
    <main className="page">
      <header className="stack-sm">
        <h1 className="text-2xl font-bold">Events</h1>
        <p className="text-gray-700">All Hanabi events, past and present.</p>
      </header>

      {loading && <p>Loading events...</p>}

      {error && (
        <p className="text-red-600">
          {error}
        </p>
      )}

      {!loading && !error && visibleEvents.length === 0 && <p>No events found yet.</p>}

      {!loading && !error && visibleEvents.length > 0 && (
        <div className="stack">
          {sortedEvents.map((event) => {
            const description = event.short_description || event.long_description || 'No description provided.';
            const unpublished = !event.published;
            return (
              <div
                key={event.id}
                className="card stack-sm"
                style={{
                  position: 'relative',
                  opacity: unpublished ? 0.7 : 1,
                  borderStyle: unpublished ? 'dashed' : 'solid',
                }}
              >
                <h2 style={{ margin: 0 }}>
                  <Link
                    to={`/events/${event.slug}`}
                    className="text-2xl font-semibold text-blue-700 hover:underline"
                    style={{
                      flex: '1 1 auto',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'inline-block',
                    }}
                  >
                    {event.name}
                  </Link>
                </h2>
                <div
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {unpublished && (
                    <span className="pill text-sm" style={{ background: 'var(--color-surface-muted)' }}>
                      Unpublished
                    </span>
                  )}
                  {formatDateRange(event.starts_at, event.ends_at) && (
                    <span className="pill pill--accent text-sm whitespace-nowrap">
                      {formatDateRange(event.starts_at, event.ends_at)}
                    </span>
                  )}
                  {user && (user.role === 'ADMIN' || user.role === 'SUPERADMIN') && (
                    <Link
                      to={`/admin/events/${event.slug}/edit`}
                      className="material-symbols-outlined"
                      aria-label="Edit event"
                      title="Edit event"
                      style={{
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '4px',
                        color: 'var(--color-text)',
                        textDecoration: 'none',
                      }}
                    >
                      edit
                    </Link>
                  )}
                </div>
                <p className="text-sm text-gray-700">{description}</p>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
};
