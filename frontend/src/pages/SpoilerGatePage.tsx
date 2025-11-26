import { Link } from 'react-router-dom';

type Mode = 'prompt' | 'blocked' | 'login' | 'error' | 'loading';

interface Props {
  mode: Mode;
  eventSlug?: string;
  onForfeit?: () => Promise<void> | void;
  loading?: boolean;
  errorMessage?: string | null;
  loginPath?: string;
}

export function SpoilerGatePage({
  mode,
  eventSlug,
  onForfeit,
  loading = false,
  errorMessage,
  loginPath = '/login',
}: Props) {
  const heading =
    mode === 'prompt'
      ? 'Spoilers!'
      : mode === 'blocked'
        ? 'Spoilers!'
        : mode === 'login'
          ? 'Spoilers!'
          : mode === 'error'
            ? 'Spoilers!'
            : 'Checking eligibility…';

  const backHref = eventSlug ? `/events/${eventSlug}` : '/';

  return (
    <main className="page">
      <div className="stack-md" style={{ maxWidth: 640 }}>
        <div className="stack-xs">
          <p className="text-sm text-gray-600">
            <Link to={backHref} className="text-blue-700">
              Back to event
            </Link>
          </p>
          <h1 className="text-2xl font-bold">{heading}</h1>
        </div>

        {mode === 'loading' && <p>Checking your eligibility…</p>}

        {mode === 'prompt' && (
          <div className="stack-sm">
            <p>
              The page you&apos;re trying to look at contains spoilers. If you’re just here
              to browse, you can continue and we’ll mark you as having seen the spoilers. If
              you still plan to play, head back and keep the mystery intact&nbsp;&mdash; no hard feelings either way.
            </p>
            {errorMessage && <p className="text-red-600 text-sm">{errorMessage}</p>}
            <div
              className="flex"
              style={{ display: 'flex', columnGap: '0.75rem', rowGap: '0.5rem', flexWrap: 'wrap' }}
            >
              <button className="btn" onClick={onForfeit} disabled={loading}>
                {loading ? 'Continuing…' : 'Continue to spoilers'}
              </button>
              <Link to={backHref} className="btn btn--secondary">
                Stay eligible
              </Link>
            </div>
          </div>
        )}

        {mode === 'blocked' && (
          <div className="stack-sm">
            <p>
              You’re enrolled for this event and team size, so we’re keeping this page tucked
              away to protect fairness. Finish playing before peeking at other
              teams’ secrets.
            </p>
            <Link to={backHref} className="btn">
              Back to event
            </Link>
          </div>
        )}

        {mode === 'login' && (
          <div className="stack-sm">
            <p>
              The page you&apos;re trying to look at contains spoilers. Log in so we can check
              your eligibility before you decide whether to peek or leave the mystery intact.
            </p>
            <Link
              to={loginPath}
              className="btn btn--primary"
              style={{
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingInline: '14px',
                paddingBlock: '10px',
                alignSelf: 'flex-start',
              }}
            >
              Go to login
            </Link>
          </div>
        )}

        {mode === 'error' && (
          <div className="stack-sm">
            <p className="text-red-600">{errorMessage ?? 'Unable to check eligibility.'}</p>
            <div className="flex gap-3">
              <Link to={backHref} className="btn">
                Back to event
              </Link>
              <Link to={loginPath} className="btn btn--secondary">
                Log in
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
