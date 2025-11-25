import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';

type LoginResponse = {
  mode: 'created' | 'login';
  user: {
    id: number;
    display_name: string;
    role: string;
    created_at: string;
    color_hex: string;
    text_color: string;
  };
  token: string;
};

export function LoginPage() {
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LoginResponse | null>(null);
  const navigate = useNavigate();
  const auth = useAuth();

  useEffect(() => {
    // If already logged in (and not in the middle of showing a fresh account creation), bounce home
    if (auth.user && result?.mode !== 'created') {
      navigate('/');
    }
  }, [auth.user, navigate, result?.mode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName.trim(), password: password.trim() }),
      });

      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        // ignore
      }

      if (!res.ok) {
        throw new ApiError('Login failed', res.status, body);
      }

      const loginResult = body as LoginResponse;
      setResult(loginResult);
      auth.login(loginResult.user, loginResult.token);
      setPassword('');

      if (loginResult.mode === 'login') {
        navigate('/');
      } else {
        navigate('/new-user', { state: { displayName: loginResult.user.display_name } });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401
            ? 'Invalid credentials. Please try again.'
            : 'Failed to log in. Please try again.',
        );
      } else {
        setError('Unexpected error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page stack-md" style={{ maxWidth: '480px' }}>
      <header className="stack-xs">
        <h1 className="text-2xl font-bold">Log in</h1>
        <p className="text-gray-700">
          Enter your username and password. New usernames will create an account automatically.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="card stack-sm">
        <div className="stack-xxs">
          <label className="text-sm font-medium text-gray-700" htmlFor="displayName">
            Username
          </label>
          <input
            id="displayName"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input"
            autoComplete="username"
          />
        </div>

        <div className="stack-xxs">
          <label className="text-sm font-medium text-gray-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          className="btn btn--primary"
          disabled={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>

      {error && (
        <p className="text-red-600 text-sm" role="alert">
          {error}
        </p>
      )}

    </main>
  );
}
