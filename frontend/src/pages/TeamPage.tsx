import { Link, useParams } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';
import { useTeamDetail, TeamGame } from '../hooks/useTeamDetail';

export function TeamPage() {
  const { slug, teamId } = useParams<{ slug: string; teamId: string }>();

  const parsedTeamId = (() => {
    const n = Number(teamId);
    return Number.isInteger(n) ? n : null;
  })();

  const { data, loading, error, notFound } = useTeamDetail(parsedTeamId);

  if (!parsedTeamId || notFound) {
    return <NotFoundPage />;
  }

  if (loading) {
    return (
      <main className="p-4">
        <p>Loading team...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="p-4">
        <h1 className="text-xl font-semibold mb-2">Team</h1>
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  if (!data) {
    return <NotFoundPage />;
  }

  // If slug is provided and doesn't match, treat as not found to prevent cross-event access
  if (slug && slug !== data.team.event_slug) {
    return <NotFoundPage />;
  }

  const groupedByStage = data.games.reduce(
    (acc, game) => {
      const key = `${game.stage_index}-${game.stage_label}`;
      if (!acc[key]) {
        acc[key] = {
          stage_label: game.stage_label,
          stage_index: game.stage_index,
          stage_type: game.stage_type,
          games: [],
        };
      }
      acc[key].games.push(game);
      return acc;
    },
    {} as Record<
      string,
      {
        stage_label: string;
        stage_index: number;
        stage_type: TeamGame['stage_type'];
        games: TeamGame[];
      }
    >,
  );

  const stages = Object.values(groupedByStage).sort((a, b) => a.stage_index - b.stage_index);

  return (
    <main className="p-4 space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-gray-600">
          <Link to={`/events/${data.team.event_slug}`} className="text-blue-700">
            {data.team.event_name}
          </Link>{' '}
          · Team
        </p>
        <h1 className="text-2xl font-bold">{data.team.name}</h1>
        <p className="text-gray-700">
          Player count: {data.team.team_size} · Team ID: <code>{data.team.id}</code>
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Roster</h2>
        {data.members.length === 0 ? (
          <p className="text-gray-600">No members listed yet.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.members.map((member) => (
              <li
                key={member.id}
                className="border rounded-md px-3 py-2 bg-white/70 backdrop-blur-sm flex items-center justify-between"
              >
                <span className="font-medium text-gray-900">{member.display_name}</span>
                <span className="text-xs uppercase tracking-wide text-gray-600">{member.role}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Completed games</h2>
          <p className="text-sm text-gray-600">{data.games.length} total</p>
        </div>

        {data.games.length === 0 ? (
          <p className="text-gray-600">No completed games yet.</p>
        ) : (
          <div className="space-y-4">
            {stages.map((stage) => (
              <div key={stage.stage_index} className="border rounded-lg p-3 bg-white/60 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {stage.stage_label} (Stage {stage.stage_index + 1})
                  </h3>
                  <span className="text-xs text-gray-600 uppercase tracking-wide">{stage.stage_type}</span>
                </div>

                <ul className="mt-3 space-y-2">
                  {stage.games
                    .slice()
                    .sort((a, b) => a.template_index - b.template_index || a.id - b.id)
                    .map((game) => (
                      <li key={game.id} className="border rounded-md px-3 py-2 bg-white/80">
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-medium text-gray-900">
                              Template #{game.template_index} · {game.variant}
                            </p>
                            <p className="text-sm text-gray-700">
                              Score: {game.score}
                              {game.zero_reason ? ` (0 for ${game.zero_reason})` : ''}
                            </p>
                            <p className="text-sm text-gray-600">
                              Played: {new Date(game.played_at).toLocaleString()}
                            </p>
                            {game.players.length > 0 && (
                              <p className="text-sm text-gray-600">
                                Players: {game.players.join(', ')}
                              </p>
                            )}
                            {game.notes && <p className="text-sm text-gray-700">Notes: {game.notes}</p>}
                          </div>

                          {game.game_id && (
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              Game ID: {game.game_id}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
