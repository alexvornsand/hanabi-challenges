import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ApiError, getJson } from '../lib/api';

type UserProfile = {
  id: number;
  display_name: string;
  role: string;
  created_at: string;
};

export function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
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

  if (error || !user) {
    return (
      <main className="p-4 space-y-2">
        <p className="text-red-600">{error ?? 'User not found'}</p>
        <button
          onClick={() => navigate('/')}
          className="px-3 py-2 rounded bg-blue-600 text-white font-semibold"
        >
          Go home
        </button>
      </main>
    );
  }

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-2xl font-bold">{user.display_name}</h1>
      <p className="text-gray-700">Role: {user.role}</p>
      <p className="text-gray-600 text-sm">
        Joined: {new Date(user.created_at).toLocaleString()}
      </p>
    </main>
  );
}
