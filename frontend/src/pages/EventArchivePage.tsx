import React from 'react';
import { Link } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';

function formatDateRange(startsAt: string | null, endsAt: string | null) {
  if (!startsAt && !endsAt) return 'Dates TBD';

  const start = startsAt ? new Date(startsAt) : null;
  const end = endsAt ? new Date(endsAt) : null;

  if (start && end) {
    return `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
  }
  if (start) return `Starts ${start.toLocaleDateString()}`;
  if (end) return `Ends ${end.toLocaleDateString()}`;
  return 'Dates TBD';
}

export const EventArchivePage: React.FC = () => {
  const { events, loading, error } = useEvents();
  const sortedEvents = [...events].sort((a, b) => {
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

      {!loading && !error && events.length === 0 && <p>No events found yet.</p>}

      {!loading && !error && events.length > 0 && (
        <div className="stack">
          {sortedEvents.map((event) => {
            const description = event.long_description || event.short_description || 'No description provided.';
            return (
              <div key={event.id} className="card stack-sm">
                <div className="flex items-baseline gap-3">
                  <Link to={`/events/${event.slug}`} className="text-lg font-semibold text-blue-700 flex-1">
                    {event.name}
                  </Link>
                  <span className="text-sm text-gray-600 whitespace-nowrap ml-auto">
                    {formatDateRange(event.starts_at, event.ends_at)}
                  </span>
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
