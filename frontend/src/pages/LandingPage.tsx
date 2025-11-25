import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';

function formatDateRange(startsAt: string | null, endsAt: string | null) {
  if (!startsAt && !endsAt) return 'Dates TBD';
  const start = startsAt ? new Date(startsAt) : null;
  const end = endsAt ? new Date(endsAt) : null;
  if (start && end) return `${start.toLocaleDateString()} — ${end.toLocaleDateString()}`;
  if (start) return `Starts ${start.toLocaleDateString()}`;
  if (end) return `Ends ${end.toLocaleDateString()}`;
  return 'Dates TBD';
}

export const LandingPage: React.FC = () => {
  const { events, loading, error } = useEvents();
  const now = Date.now();
  const activeEvents = useMemo(
    () =>
      events.filter((e) => {
        const start = e.starts_at ? new Date(e.starts_at).getTime() : null;
        const end = e.ends_at ? new Date(e.ends_at).getTime() : null;
        if (start && start > now) return false; // future, not started
        if (end && end < now) return false; // already ended
        return true;
      }),
    [events, now],
  );

  return (
    <main className="page stack">
      <h1 className="text-2xl font-bold" style={{ margin: 0 }}>
        Hanabi Competitions
      </h1>

      <section className="stack-sm">
        <h2 className="text-xl font-semibold" style={{ margin: 0 }}>
          Overview
        </h2>
        <p className="text-gray-700">
          Welcome! This is where Hanabi players organize and track community challenges and tournaments.
          You can browse current events, see their rules and timelines, and join with your team to play
          through preset seeds. We keep your team’s progress and results together so everyone knows where
          they stand. If you’re curious about an event, click in to see the format and how to participate.
          If you’re ready to play, register a team and start logging games. Whether you’re jumping into
          an active challenge or catching up later with friends, this is the hub for following along and
          comparing runs.
        </p>
      </section>

      <section className="stack-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold" style={{ margin: 0 }}>
            Ongoing Competitions
          </h2>
          {loading && <span className="text-sm text-gray-600">Loading…</span>}
        </div>
        {error && <p className="text-red-600">{error}</p>}
        {!loading && !error && activeEvents.length === 0 && (
          <p className="text-gray-600">
            No active events right now. Check out the{' '}
            <Link to="/events" className="text-blue-700 underline">
              events archive
            </Link>
            .
          </p>
        )}
        {!loading && !error && activeEvents.length > 0 && (
          <div className="stack">
            {activeEvents.map((event) => (
              <div key={event.id} className="card" style={{ position: 'relative' }}>
                <div
                  className="flex items-center"
                  style={{ gap: 'var(--space-sm)', paddingRight: '140px' }}
                >
                  <Link
                    to={`/events/${event.slug}`}
                    className="text-lg font-semibold text-blue-700"
                    style={{
                      flex: '1 1 auto',
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {event.name}
                  </Link>
                </div>
                <span
                  className="pill pill--accent text-sm whitespace-nowrap"
                  style={{ position: 'absolute', top: '12px', right: '12px' }}
                >
                  {formatDateRange(event.starts_at, event.ends_at)}
                </span>
                <div
                  className="text-sm text-gray-700"
                  style={{ whiteSpace: 'pre-line' }}
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(event.long_description || event.short_description || ''),
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};

function renderMarkdown(md: string) {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const emojiMap: Record<string, string> = {
    firework: '🎆',
    fireworks: '🎆',
    tada: '🎉',
    sparkles: '✨',
    star: '⭐️',
  };

  let html = escape(md || '');
  html = html.replace(/:([a-z0-9_+-]+):/gi, (_, code) => emojiMap[code] || `:${code}:`);
  html = html.replace(/^### (.*)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.*)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.*)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');
  html = html.replace(/(^|\n)- (.*)/g, (m, p1, item) => `${p1}<li>${item}</li>`);
  html = html.replace(/(<li>.*<\/li>)/gs, (m) => `<ul>${m}</ul>`);
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      if (block.startsWith('<h') || block.startsWith('<ul>')) return block;
      return `<p>${block.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');
  return html || '<p>No description provided.</p>';
}
