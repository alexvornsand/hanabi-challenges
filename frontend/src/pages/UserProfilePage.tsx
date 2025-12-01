import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ApiError, getJson } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type UserProfile = {
  id: number;
  display_name: string;
  role: string;
  color_hex: string;
  text_color: string;
  created_at: string;
};

export function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!username) {
      setError('No username provided');
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const currentUsername = username;

    async function fetchUser() {
      setLoading(true);
      setError(null);

      try {
        const data = await getJson<UserProfile>(`/users/${encodeURIComponent(currentUsername)}`);
        if (!cancelled) {
          setUser(data);
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError('User not found');
        } else {
          setError('Failed to load user');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchUser();
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (loading) {
    return (
      <main className="page">
        <div className="card">
          <p className="text-gray-700">Loading user…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="page stack">
      {error || !user ? (
        <div className="card stack-sm">
          <p className="text-red-600">{error ?? 'User not found'}</p>
          <button onClick={() => navigate('/')} className="btn btn--primary">
            Go home
          </button>
        </div>
      ) : (
        <div className="card stack-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold" style={{ margin: 0 }}>
                {user.display_name}
              </h1>
              <span className="pill text-xs text-gray-700 bg-gray-100">{user.role}</span>
            </div>
            {authUser && authUser.displayName === user.display_name && (
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="btn"
                style={{ backgroundColor: '#dc2626', color: '#fff' }}
              >
                Log out
              </button>
            )}
          </div>

          <p className="text-gray-600 text-sm">
            Joined {new Date(user.created_at).toLocaleDateString()}
          </p>

          <div className="flex gap-3 text-sm flex-wrap">
            <Link className="btn btn--secondary" to={`/users/${user.display_name}/events`}>
              Events
            </Link>
            <Link className="btn btn--secondary" to={`/users/${user.display_name}/badges`}>
              Badges
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
