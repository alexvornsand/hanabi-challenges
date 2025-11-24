import { Link, useParams } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';
import { useTeamDetail, type TeamGame } from '../hooks/useTeamDetail';
import { useTeamTemplates, type TeamTemplate } from '../hooks/useTeamTemplates';
import { UserPill } from '../components/UserPill';
import { useState } from 'react';

export function TeamPage() {
  const { slug, teamId } = useParams<{ slug: string; teamId: string }>();

  const parsedTeamId = (() => {
    const n = Number(teamId);
    return Number.isInteger(n) ? n : null;
  })();

  const { data, loading, error, notFound } = useTeamDetail(parsedTeamId);
  const { templates, loading: templatesLoading, error: templatesError } = useTeamTemplates(parsedTeamId);
  const [drafts, setDrafts] = useState<Record<
    number,
    {
      replay: string;
      bdr: string;
      notes: string;
    }
  >>({});

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
  const templateStages = groupTemplatesByStage(templates);

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
                <UserPill
                  name={member.display_name}
                  color={member.color_hex}
                  textColor={member.text_color}
                />
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
                              <div className="flex flex-wrap gap-1 items-center text-sm text-gray-600">
                                <span>Players:</span>
                                {game.players.map((p) => (
                                  <UserPill
                                    key={p.display_name}
                                    name={p.display_name}
                                    color={p.color_hex}
                                    textColor={p.text_color}
                                  />
                                ))}
                              </div>
                            )}
                            {game.notes && (
                              <div className="flex items-center gap-1 text-sm text-gray-700">
                                <span role="img" aria-label="Notes" title={game.notes}>
                                  📝
                                </span>
                                <span className="sr-only">Notes available</span>
                              </div>
                            )}
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

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Games</h2>
          {templatesLoading && <p className="text-sm text-gray-600">Loading games…</p>}
        </div>
        {templatesError && <p className="text-red-600">{templatesError}</p>}
        {!templatesLoading && templates.length === 0 && <p className="text-gray-600">No games found.</p>}
        {!templatesLoading && templates.length > 0 && (
          <div className="space-y-4">
            {templateStages.map((stage) => (
              <div key={stage.stage_label} className="border rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{stage.stage_label}</span>
                    <span className="text-xs text-gray-600 uppercase tracking-wide">{stage.stage_type}</span>
                  </div>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-left text-sm">
                      <th className="px-3 py-2">Index</th>
                      <th className="px-3 py-2">Variant</th>
                      <th className="px-3 py-2">Score</th>
                      <th className="px-3 py-2">Failure reason</th>
                      <th className="px-3 py-2">BDR</th>
                      <th className="px-3 py-2">Players</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Game ID</th>
                      <th className="px-3 py-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stage.templates.map((tpl) =>
                      tpl.result ? (
                        <PlayedRow key={tpl.template_id} template={tpl} />
                      ) : (
                        <UnplayedRow
                          key={tpl.template_id}
                          template={tpl}
                          draft={drafts[tpl.template_id] ?? { replay: '', bdr: '', notes: '' }}
                          onDraftChange={(next) =>
                            setDrafts((prev) => ({ ...prev, [tpl.template_id]: next }))
                          }
                        />
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function groupTemplatesByStage(templates: TeamTemplate[]) {
  const map = new Map<
    string,
    { stage_label: string; stage_type: string; stage_index: number; templates: TeamTemplate[] }
  >();
  templates.forEach((tpl) => {
    const key = `${tpl.stage_index}-${tpl.stage_label}`;
    if (!map.has(key)) {
      map.set(key, {
        stage_label: tpl.stage_label,
        stage_type: tpl.stage_type,
        stage_index: tpl.stage_index,
        templates: [],
      });
    }
    map.get(key)!.templates.push(tpl);
  });
  return Array.from(map.values()).sort((a, b) => a.stage_index - b.stage_index);
}

function PlayedRow({ template }: { template: TeamTemplate }) {
  const r = template.result!;
  const playedAt = r.played_at ? new Date(r.played_at) : null;
  const score = r.score ?? '';
  const reason = r.zero_reason ?? '';

  return (
    <tr className="border-t">
      <td className="px-3 py-2 text-sm">{template.template_index}</td>
      <td className="px-3 py-2 text-sm">{template.variant}</td>
      <td className="px-3 py-2 text-sm">{score}</td>
      <td className="px-3 py-2 text-sm">{reason}</td>
      <td className="px-3 py-2 text-sm">{r.bottom_deck_risk ?? ''}</td>
      <td className="px-3 py-2 text-sm text-gray-500">—</td>
      <td className="px-3 py-2 text-sm">{playedAt ? playedAt.toLocaleString() : ''}</td>
      <td className="px-3 py-2 text-sm">
        {r.hanab_game_id ? (
          <Link
            to={`https://hanab.live/replay/${r.hanab_game_id}`}
            className="text-blue-700 underline"
            target="_blank"
            rel="noreferrer"
          >
            {r.hanab_game_id}
          </Link>
        ) : (
          ''
        )}
      </td>
      <td className="px-3 py-2 text-sm">
        {r.notes && (
          <span role="img" aria-label="Notes" title={r.notes}>
            📝
          </span>
        )}
      </td>
    </tr>
  );
}

function UnplayedRow({
  template,
  draft,
  onDraftChange,
}: {
  template: TeamTemplate;
  draft: { replay: string; bdr: string; notes: string };
  onDraftChange: (next: { replay: string; bdr: string; notes: string }) => void;
}) {
  const [showNotes, setShowNotes] = useState(
    Boolean(draft.replay) || Boolean(draft.bdr) || Boolean(draft.notes),
  );

  const update = (patch: Partial<typeof draft>) => {
    const next = { ...draft, ...patch };
    onDraftChange(next);
    setShowNotes(Boolean(next.replay) || Boolean(next.bdr) || Boolean(next.notes));
  };

  return (
    <>
      <tr className="border-t">
        <td className="px-3 py-2 text-sm">{template.template_index}</td>
        <td className="px-3 py-2 text-sm">{template.variant}</td>
        <td className="px-3 py-2 text-sm text-gray-500">—</td>
        <td className="px-3 py-2 text-sm text-gray-500">—</td>
        <td className="px-3 py-2 text-sm">
          <input
            className="w-20 border rounded px-2 py-1 text-sm"
            placeholder="BDR"
            value={draft.bdr}
            onChange={(e) => update({ bdr: e.target.value })}
          />
        </td>
        <td className="px-3 py-2 text-sm text-gray-500">—</td>
        <td className="px-3 py-2 text-sm text-gray-500">—</td>
        <td className="px-3 py-2 text-sm">
          <input
            className="w-full border rounded px-2 py-1 text-sm"
            placeholder="Game ID or replay URL"
            value={draft.replay}
            onChange={(e) => update({ replay: e.target.value })}
          />
        </td>
        <td className="px-3 py-2 text-sm text-gray-500">—</td>
      </tr>
      {showNotes && (
        <tr className="border-t bg-gray-50">
          <td colSpan={9} className="px-3 py-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm"
              rows={2}
              placeholder="Add notes about this game"
              value={draft.notes}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </td>
        </tr>
      )}
    </>
  );
}
