import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ApiError, getJson } from '../lib/api';
import { UserPill } from '../components/UserPill';
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
      <main className="p-4">
        <p>Loading user...</p>
      </main>
    );
  }

  return (
    <main className="p-4 space-y-3">
      {error || !user ? (
        <div className="space-y-2">
          <p className="text-red-600">{error ?? 'User not found'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-3 py-2 rounded bg-blue-600 text-white font-semibold"
          >
            Go home
          </button>
        </div>
      ) : (
        <>
          <UserPill
            name={user.display_name}
            color={user.color_hex}
            textColor={user.text_color}
            className="text-base"
          />
          <p className="text-gray-700">Role: {user.role}</p>
          <p className="text-gray-600 text-sm">
            Joined: {new Date(user.created_at).toLocaleString()}
          </p>
          <div className="flex gap-3 text-sm">
            <Link className="text-blue-700 underline" to={`/users/${user.display_name}/events`}>
              Events
            </Link>
            <Link className="text-blue-700 underline" to={`/users/${user.display_name}/badges`}>
              Badges
            </Link>
          </div>
        </>
      )}

      {authUser && (
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="px-3 py-2 rounded bg-red-600 text-white font-semibold"
        >
          Log out
        </button>
      )}
    </main>
  );
}
