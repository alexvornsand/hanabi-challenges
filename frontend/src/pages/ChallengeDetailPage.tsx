import { useParams } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';
import { useChallengeDetail } from '../hooks/useChallengeDetail';

export function ChallengeDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { challenge, loading, error, notFound } = useChallengeDetail(slug);

  if (notFound) {
    return <NotFoundPage />;
  }

  if (loading) {
    return (
      <main className="p-4">
        <p>Loading challenge...</p>
      </main>
    );
  }

  if (error && !challenge) {
    return (
      <main className="p-4">
        <h1 className="text-xl font-semibold mb-2">Challenge</h1>
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  if (!challenge) {
    return (
      <main className="p-4">
        <h1 className="text-xl font-semibold mb-2">Challenge not found</h1>
      </main>
    );
  }

  const startsAt = challenge.starts_at ? new Date(challenge.starts_at) : null;
  const endsAt = challenge.ends_at ? new Date(challenge.ends_at) : null;

  return (
    <main className="p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-bold">{challenge.name}</h1>

        {challenge.short_description && (
          <p className="text-gray-700 mt-1">{challenge.short_description}</p>
        )}

        <p className="text-sm text-gray-500 mt-1">
          Slug: <code>{challenge.slug}</code>
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

      {challenge.long_description && (
        <section className="prose max-w-none">
          {challenge.long_description.split('\n\n').map((block, idx) => (
            <p key={idx}>{block}</p>
          ))}
        </section>
      )}

      <section className="mt-6 border-t pt-4">
        <p className="text-sm text-gray-500">
          Seeds, teams, and results summary will appear here later.
        </p>
      </section>
    </main>
  );
}
