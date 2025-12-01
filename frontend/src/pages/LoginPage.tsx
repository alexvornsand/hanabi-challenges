import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  Alert,
  Button,
  Card,
  CardBody,
  Heading,
  Input,
  InputContainer,
  PageContainer,
  Section,
  Stack,
  Text,
} from '../design-system';

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
    <main>
      <PageContainer variant="narrow">
        <Section paddingY="lg">
          <Stack gap="md">
            <Stack gap="xs">
              <Heading level={1}>Log in</Heading>
              <Text variant="muted">
                Enter your username and password. New usernames will create an account
                automatically.
              </Text>
            </Stack>

            {error && <Alert variant="error" message={error} />}

            <Card>
              <CardBody>
                <form onSubmit={handleSubmit}>
                  <Stack gap="sm">
                    <InputContainer label="Username">
                      <Input
                        id="displayName"
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        autoComplete="username"
                        fullWidth
                      />
                    </InputContainer>

                    <InputContainer label="Password">
                      <Input
                        id="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        fullWidth
                      />
                    </InputContainer>

                    <Button type="submit" variant="primary" size="md" disabled={loading}>
                      {loading ? 'Logging in…' : 'Log in'}
                    </Button>
                  </Stack>
                </form>
              </CardBody>
            </Card>
          </Stack>
        </Section>
      </PageContainer>
    </main>
  );
}
