import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UserPill } from '../components/UserPill';
import { useAuth } from '../context/AuthContext';
import { ApiError, getJson } from '../lib/api';

type UserEvent = {
  event_team_id: number;
  team_name: string;
  team_size: number;
  event_id: number;
  event_name: string;
  event_slug: string;
  starts_at: string | null;
  ends_at: string | null;
};

export function UserEventsPage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const displayName = username ?? 'Unknown';
  const pillColor = user && user.display_name === username ? user.color_hex : '#777777';
  const pillText = user && user.display_name === username ? user.text_color : '#ffffff';

  const [events, setEvents] = useState<UserEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!username) {
      setError('No username provided');
      setLoading(false);
      return;
    }

    const currentUsername = username;

    async function fetchEvents() {
      setLoading(true);
      setError(null);
      try {
        const data = await getJson<UserEvent[]>(`/users/${encodeURIComponent(currentUsername)}/events`);
        if (!cancelled) {
          setEvents(data);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError('User not found');
        } else {
          setError('Failed to load events');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchEvents();
    return () => {
      cancelled = true;
    };
  }, [username]);

  return (
    <main className="page stack">
      <div className="flex items-center gap-3">
        <UserPill name={displayName} color={pillColor} textColor={pillText} />
        <h1 className="text-xl font-semibold">Events</h1>
      </div>

      {loading && <div className="card"><p>Loading events...</p></div>}
      {error && <div className="card"><p className="text-red-600">{error}</p></div>}

      {!loading && !error && events.length === 0 && (
        <div className="card">
          <p className="text-gray-700">No teams found for this user.</p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {events.map((ev) => (
            <div key={ev.event_team_id} className="card stack-xxs" style={{ marginBottom: 'var(--space-sm)' }}>
              <h2 style={{ margin: 0, lineHeight: 1.3 }}>
                <Link
                  to={`/events/${ev.event_slug}`}
                  className="text-2xl font-semibold text-blue-700 hover:underline"
                >
                  {ev.event_name}
                </Link>
              </h2>
              <div className="text-sm text-gray-700">
                Team:{' '}
                <Link
                  to={`/events/${ev.event_slug}/teams/${ev.event_team_id}`}
                  className="text-blue-700 underline"
                >
                  {ev.team_name}
                </Link>
              </div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">{ev.team_size}p team</p>
            </div>
          ))}
        </div>
      )}

      <div>
        <Link className="btn btn--secondary" to={`/users/${displayName}`}>
          Back to profile
        </Link>
      </div>
    </main>
  );
}
