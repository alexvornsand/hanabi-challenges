import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { UserPill } from '../features/users/UserPill';
import { useAuth } from '../context/AuthContext';
import { ApiError, getJson } from '../lib/api';

type UserBadge = {
  id: number;
  event_badge_id: number;
  event_id: number;
  event_name: string;
  event_slug: string;
  team_id: number | null;
  team_name: string | null;
  team_size: number;
  name: string;
  description: string;
  icon: string;
  rank: '1' | '2' | '3' | 'completion' | 'participation';
  awarded_at: string | null;
};

export function UserBadgesPage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<UserBadge | null>(null);

  const displayName = username ?? 'Unknown';
  const isOwnProfile = Boolean(user && user.display_name === username);

  const pillColor = isOwnProfile ? (user?.color_hex ?? '#777777') : '#777777';
  const pillText = isOwnProfile ? (user?.text_color ?? '#ffffff') : '#ffffff';
  const badgeCopy = isOwnProfile
    ? "You haven't earned any badges yet."
    : `${displayName} hasn't earned any badges yet.`;

  useEffect(() => {
    let cancelled = false;
    if (!username) {
      setError('No username provided');
      setLoading(false);
      return;
    }

    const currentUsername = username;

    async function fetchBadges() {
      setLoading(true);
      setError(null);
      try {
        const data = await getJson<UserBadge[]>(
          `/users/${encodeURIComponent(currentUsername)}/badges`,
        );
        if (!cancelled) {
          setBadges(data);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError('User not found');
        } else {
          setError('Failed to load badges');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBadges();
    return () => {
      cancelled = true;
    };
  }, [username]);

  const formatRank = (rank: UserBadge['rank']) => {
    if (rank === 'completion') return 'Completion';
    if (rank === 'participation') return 'Participation';
    return `Rank #${rank}`;
  };

  const renderIcon = (icon: string) => {
    const parsed = Number.parseInt(icon, 16);
    if (Number.isNaN(parsed)) {
      return '🏅';
    }
    return String.fromCodePoint(parsed);
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setSelectedBadge(null);
      }
    }

    if (selectedBadge) {
      window.addEventListener('keydown', onKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedBadge]);

  useEffect(() => {
    if (!selectedBadge) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selectedBadge]);

  return (
    <main className="page stack">
      <div className="flex items-center gap-3">
        <UserPill name={displayName} color={pillColor} textColor={pillText} />
        <h1 className="text-xl font-semibold">Badges</h1>
      </div>

      {loading && (
        <div className="card">
          <p className="text-gray-700">Loading badges...</p>
        </div>
      )}

      {error && (
        <div className="card">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {!loading && !error && badges.length === 0 && (
        <div className="card stack-sm">
          <p className="text-gray-700">{badgeCopy}</p>
          {isOwnProfile && (
            <p className="text-gray-700">
              Participate in an event on the{' '}
              <Link className="text-blue-700 underline" to="/events">
                events page
              </Link>{' '}
              to earn badges.
            </p>
          )}
        </div>
      )}

      {!loading && !error && badges.length > 0 && (
        <div className="card stack-sm">
          <h2 className="text-lg font-semibold" style={{ margin: 0 }}>
            Badge collection
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {badges.map((badge) => (
              <button
                key={badge.id}
                type="button"
                className="card flex items-center justify-center"
                style={{ width: '150px', height: '150px' }}
                onClick={() => setSelectedBadge(badge)}
                aria-label={`${badge.name} (${formatRank(badge.rank)}, ${badge.team_size}p)`}
                title={badge.name}
              >
                <span
                  className="w-full h-full rounded-md flex items-center justify-center text-2xl font-semibold"
                  style={{
                    backgroundColor: 'transparent',
                    color: '#000000',
                    fontFamily: '"Material Symbols Outlined", var(--font-sans)',
                    fontSize: '102px',
                    lineHeight: 1,
                  }}
                  aria-hidden
                >
                  {renderIcon(badge.icon)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <Link className="btn btn--secondary" to={`/users/${displayName}`}>
          Back to profile
        </Link>
      </div>

      {selectedBadge && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Details for ${selectedBadge.name}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedBadge(null);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 2000,
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            className="card stack-sm"
            onClick={(e) => e.stopPropagation()}
            role="document"
            style={{
              maxWidth: '720px',
              width: '100%',
              padding: '16px',
              boxShadow: 'var(--shadow-hover)',
            }}
          >
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setSelectedBadge(null)}
                className="material-symbols-outlined"
                aria-label="Close"
                title="Close"
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                }}
              >
                close
              </button>

              <div className="stack-sm" style={{ alignItems: 'center' }}>
                <div
                  className="rounded-md"
                  style={{
                    width: '300px',
                    height: '300px',
                    display: 'grid',
                    placeItems: 'center',
                    backgroundColor: 'transparent',
                  }}
                  aria-hidden
                >
                  <span
                    style={{
                      fontFamily: '"Material Symbols Outlined", var(--font-sans)',
                      fontSize: '200px',
                      lineHeight: 1,
                      color: '#000000',
                      display: 'inline-block',
                    }}
                  >
                    {renderIcon(selectedBadge.icon)}
                  </span>
                </div>
                <div className="stack-xxs" style={{ alignItems: 'center', textAlign: 'center' }}>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold" style={{ margin: 0 }}>
                      {selectedBadge.name}
                    </h3>
                    <span className="pill text-xs text-gray-700 bg-gray-100">
                      {formatRank(selectedBadge.rank)}
                    </span>
                    <span className="pill text-xs text-gray-700 bg-gray-100">
                      {selectedBadge.team_size}p
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm" style={{ margin: 0 }}>
                    {selectedBadge.description}
                  </p>
                  <div className="text-xs text-gray-600">
                    Event:{' '}
                    <Link
                      className="text-blue-700 underline"
                      to={`/events/${selectedBadge.event_slug}`}
                    >
                      {selectedBadge.event_name}
                    </Link>
                  </div>
                  {selectedBadge.team_name && (
                    <div className="text-xs text-gray-600">
                      Team:{' '}
                      <Link
                        className="text-blue-700 underline"
                        to={`/events/${selectedBadge.event_slug}/teams/${selectedBadge.team_id}`}
                      >
                        {selectedBadge.team_name}
                      </Link>
                    </div>
                  )}
                  {selectedBadge.awarded_at && (
                    <div className="text-xs text-gray-500">
                      Earned on {new Date(selectedBadge.awarded_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
