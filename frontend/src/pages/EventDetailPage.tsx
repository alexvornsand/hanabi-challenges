import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';
import { useEventDetail } from '../hooks/useEventDetail';
import { useEventTeams } from '../hooks/useEventTeams';

export function EventDetailPage() {
  const { slug, teamSize } = useParams<{ slug: string; teamSize?: string }>();

  const parsedTeamSize = (() => {
    const n = teamSize ? Number(teamSize) : 3;
    if (!Number.isInteger(n) || n < 2 || n > 6) return 3;
    return n;
  })();

  const { event, loading, error, notFound } = useEventDetail(slug);
  const { teams, loading: teamsLoading, error: teamsError } = useEventTeams(slug);
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

      <section className="mt-6 border-t pt-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-700 font-medium">Player count:</span>
          {[2, 3, 4, 5, 6].map((size) => {
            const isActive = parsedTeamSize === size;
            const target =
              size === 3 ? `/events/${event.slug}` : `/events/${event.slug}/${size}`;

            return (
              <Link
                key={size}
                to={target}
                className={`px-3 py-1 rounded-full border text-sm ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                }`}
              >
                {size}p{size === 3 ? ' (default)' : ''}
              </Link>
            );
          })}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Teams ({parsedTeamSize} players)</h2>

          {teamsLoading && <p>Loading teams...</p>}
          {teamsError && <p className="text-red-600">{teamsError}</p>}

          {!teamsLoading && !teamsError && (
            <>
              {teams.filter((t) => t.team_size === parsedTeamSize).length === 0 ? (
                <p className="text-gray-600">No teams found for this player count yet.</p>
              ) : (
                <ul className="space-y-2">
                  {teams
                    .filter((t) => t.team_size === parsedTeamSize)
                    .map((team) => (
                      <li
                        key={team.id}
                        className="border rounded-md px-3 py-2 bg-white/70 backdrop-blur-sm"
                      >
                        <div className="flex items-center justify-between">
                          <Link
                            to={`/events/${event.slug}/teams/${team.id}`}
                            className="font-medium text-blue-700 hover:underline"
                          >
                            {team.name}
                          </Link>
                          <span className="text-xs text-gray-500 uppercase tracking-wide">
                            {team.team_size}p team
                          </span>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
