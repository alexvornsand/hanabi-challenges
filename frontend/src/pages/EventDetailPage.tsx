import { useParams } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';
import { useEventDetail } from '../hooks/useEventDetail';

export function EventDetailPage() {
  const { slug, teamSize } = useParams<{ slug: string; teamSize?: string }>();

  const parsedTeamSize = (() => {
    const n = teamSize ? Number(teamSize) : 3;
    if (!Number.isInteger(n) || n < 2 || n > 6) return 3;
    return n;
  })();

  const { event, loading, error, notFound } = useEventDetail(slug);
  if (notFound) {
    return <NotFoundPage />;
  }

  if (loading) {
    return (
      <main className="p-4">
        <p>Loading event...</p>
      </main>
    );
  }

  if (error && !event) {
    return (
      <main className="p-4">
        <h1 className="text-xl font-semibold mb-2">Event</h1>
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="p-4">
        <h1 className="text-xl font-semibold mb-2">Event not found</h1>
      </main>
    );
  }

  const startsAt = event.starts_at ? new Date(event.starts_at) : null;
  const endsAt = event.ends_at ? new Date(event.ends_at) : null;

  return (
    <main className="p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-bold">{event.name}</h1>

        {event.short_description && (
          <p className="text-gray-700 mt-1">{event.short_description}</p>
        )}

        <p className="text-sm text-gray-500 mt-1">
          Slug: <code>{event.slug}</code>
        </p>

        {(startsAt || endsAt) && (
          <p className="text-sm text-gray-600 mt-1">
            {startsAt && <>Starts: {startsAt.toLocaleDateString()} </>}
            {endsAt && (
              <>
                {startsAt && ' · '}
                Ends: {endsAt.toLocaleDateString()}
              </>
            )}
          </p>
        )}
      </header>

      {event.long_description && (
        <section className="prose max-w-none">
          {event.long_description.split('\n\n').map((block, idx) => (
            <p key={idx}>{block}</p>
          ))}
        </section>
      )}

      <section className="mt-6 border-t pt-4">
        <p className="text-sm text-gray-500">
          Game templates, teams, and results summary will appear here later.
        </p>
      </section>
    </main>
  );
}
