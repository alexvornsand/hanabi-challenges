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

  return (
    <main className="p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Event Archive</h1>
        <p className="text-gray-700 mt-1">All Hanabi events, past and present.</p>
      </header>

      {loading && <p>Loading events...</p>}

      {error && (
        <p className="text-red-600">
          {error}
        </p>
      )}

      {!loading && !error && events.length === 0 && <p>No events found yet.</p>}

      {!loading && !error && events.length > 0 && (
        <ul className="space-y-3">
          {events.map((event) => {
            const description =
              event.short_description || event.long_description || 'No description provided.';

            return (
              <li
                key={event.id}
                className="border rounded-md p-3 shadow-sm bg-white/60 backdrop-blur-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <Link to={`/events/${event.slug}`} className="text-lg font-semibold text-blue-700">
                      {event.name}
                    </Link>
                    <p className="text-sm text-gray-600">{description}</p>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      {formatDateRange(event.starts_at, event.ends_at)}
                    </p>
                  </div>
                  <code className="text-xs text-gray-500 whitespace-nowrap">{event.slug}</code>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
};
