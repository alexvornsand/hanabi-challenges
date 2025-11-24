import { Link, useParams } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';
import { useTeamDetail, type TeamGame } from '../hooks/useTeamDetail';
import { useTeamTemplates, type TeamTemplate } from '../hooks/useTeamTemplates';
import { UserPill } from '../components/UserPill';
import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { postJsonAuth, ApiError } from '../lib/api';

export function TeamPage() {
  const { slug, teamId } = useParams<{ slug: string; teamId: string }>();

  const parsedTeamId = (() => {
    const n = Number(teamId);
    return Number.isInteger(n) ? n : null;
  })();

  const { data, loading, error, notFound } = useTeamDetail(parsedTeamId);
  const { templates, loading: templatesLoading, error: templatesError } = useTeamTemplates(parsedTeamId);
  const { user, token } = useAuth();
  const [drafts, setDrafts] = useState<Record<
    number,
    {
      replay: string;
      bdr: string;
      notes: string;
      replayError?: string | null;
      replayGameId?: string | null;
      validateStatus?: 'idle' | 'loading' | 'ok' | 'error';
      validateMessage?: string | null;
      derivedScore?: number | null;
      derivedEndCondition?: string | null;
      derivedEndConditionCode?: number | null;
      derivedPlayers?: string[];
      derivedPlayedAt?: string | null;
      validationRaw?: unknown;
    }
  >>({});

  const members = useMemo(() => data?.members ?? [], [data]);
  const isMember = useMemo(() => (user ? members.some((m) => m.user_id === user.id) : false), [user, members]);

  const memberColorMap = useMemo(() => {
    const map: Record<string, { color: string; textColor: string }> = {};
    members.forEach((m) => {
      map[m.display_name] = { color: m.color_hex, textColor: m.text_color };
    });
    return map;
  }, [members]);

  const games = useMemo(() => (Array.isArray(data?.games) ? data.games : []), [data]);

  const templateStages = groupTemplatesByStage(templates ?? []);
  const gameByTemplateId = useMemo(() => {
    const map = new Map<number, TeamGame>();
    games.forEach((g) => map.set(g.event_game_template_id, g));
    return map;
  }, [games]);

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
                        <PlayedRow
                          key={tpl.template_id}
                          template={tpl}
                          fallbackGame={gameByTemplateId.get(tpl.template_id)}
                        />
                      ) : (
                        <UnplayedRow
                          key={tpl.template_id}
                          template={tpl}
                          draft={
                            drafts[tpl.template_id] ?? {
                              replay: '',
                              bdr: '',
                              notes: '',
                              replayError: null,
                              replayGameId: null,
                              validateStatus: 'idle',
                              validateMessage: null,
                              derivedScore: null,
                              derivedEndCondition: null,
                              derivedPlayers: [],
                              derivedPlayedAt: null,
                              derivedEndConditionCode: null,
                              validationRaw: null,
                            }
                          }
                          teamSize={data.team.team_size}
                          tablePassword={data.team.table_password ?? undefined}
                          showCreateLink={isMember}
                          slug={slug ?? ''}
                          teamId={data.team.id}
                          token={token ?? undefined}
                          memberColors={memberColorMap}
                          editable={isMember}
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

function CreateTableLink({
  seed,
  variantName,
  teamSize,
  tablePassword,
  label,
}: {
  seed: string;
  variantName: string;
  teamSize: number;
  tablePassword?: string;
  label?: string;
}) {
  const params = new URLSearchParams({
    name: `!seed ${seed}`,
    variantName,
    deckPlays: 'false',
    emptyClues: 'false',
    detrimentalCharacters: 'false',
    oneLessCard: 'false',
    oneExtraCard: 'false',
    allOrNothing: 'false',
    maxPlayers: String(teamSize),
  });

  if (tablePassword) {
    params.set('password', tablePassword);
  }

  // URLSearchParams encodes spaces as '+', but we prefer '%20' for hanab.live URLs
  const query = params.toString().replace(/\+/g, '%20');
  const url = `https://hanab.live/create-table?${query}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-blue-700 underline text-xs"
      title="Open create-table on hanab.live with this seed"
    >
      {label ?? 'Create table'}
    </a>
  );
}

function mapEndCondition(code: number | null): string | null {
  if (code == null) return null;
  switch (code) {
    case 0:
      return 'In progress';
    case 1:
      return 'Normal';
    case 2:
      return 'Strikeout';
    case 3:
      return 'Timeout';
    case 4:
    case 10:
      return 'VTK';
    case 5:
      return 'Speedrun fail';
    case 6:
      return 'Idle timeout';
    case 7:
      return 'Character softlock';
    case 8:
      return 'All or nothing fail';
    case 9:
      return 'All or nothing softlock';
    default:
      return `Code ${code}`;
  }
}

function StatusIcon({ draft }: { draft: { validateStatus?: 'idle' | 'loading' | 'ok' | 'error'; validateMessage?: string | null; replayError?: string | null } }) {
  if (draft.replayError) {
    return (
      <span role="img" aria-label="error" title={draft.replayError}>
        ❗
      </span>
    );
  }
  if (draft.validateStatus === 'loading') {
    return (
      <span role="img" aria-label="loading" title="Validating replay…">
        ⏳
      </span>
    );
  }
  if (draft.validateStatus === 'ok') {
    return (
      <span role="img" aria-label="ok" title={draft.validateMessage ?? 'Valid replay'}>
        ✅
      </span>
    );
  }
  if (draft.validateStatus === 'error') {
    return (
      <span role="img" aria-label="error" title={draft.validateMessage ?? 'Validation failed'}>
        ❗
      </span>
    );
  }
  return null;
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

function PlayedRow({ template, fallbackGame }: { template: TeamTemplate; fallbackGame?: TeamGame }) {
  const r = template.result!;
  const playedAtIso = r.played_at ?? fallbackGame?.played_at ?? null;
  const playedAt = playedAtIso ? new Date(playedAtIso) : null;
  const score = r.score ?? fallbackGame?.score ?? '';
  const reason = r.zero_reason ?? fallbackGame?.zero_reason ?? '';
  const players =
    (template.result?.players as
      | { display_name: string; color_hex: string; text_color: string }[]
      | undefined) ??
    fallbackGame?.players ??
    [];

  return (
    <tr className="border-t">
      <td className="px-3 py-2 text-sm">{template.template_index}</td>
      <td className="px-3 py-2 text-sm">{template.variant}</td>
      <td className="px-3 py-2 text-sm">{score}</td>
      <td className="px-3 py-2 text-sm">{reason || 'Normal'}</td>
      <td className="px-3 py-2 text-sm">{r.bottom_deck_risk ?? ''}</td>
      <td className="px-3 py-2 text-sm">
        {players.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {players.map((p) => (
              <UserPill key={p.display_name} name={p.display_name} color={p.color_hex} textColor={p.text_color} />
            ))}
          </div>
        ) : (
          <span className="text-gray-500">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-sm">{playedAt ? playedAt.toLocaleDateString() : ''}</td>
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
  teamSize,
  tablePassword,
  showCreateLink,
  slug,
  teamId,
  token,
  editable,
  onDraftChange,
  memberColors,
}: {
  template: TeamTemplate;
  draft: {
    replay: string;
    bdr: string;
    notes: string;
    replayError?: string | null;
    replayGameId?: string | null;
    validateStatus?: 'idle' | 'loading' | 'ok' | 'error';
    validateMessage?: string | null;
    derivedScore?: number | null;
    derivedEndCondition?: string | null;
    derivedEndConditionCode?: number | null;
    derivedPlayers?: string[];
    derivedPlayedAt?: string | null;
    validationRaw?: unknown;
  };
  teamSize: number;
  tablePassword?: string;
  showCreateLink: boolean;
  slug: string;
  teamId: number;
  token?: string;
  editable: boolean;
  onDraftChange: (next: typeof draft) => void;
  memberColors: Record<string, { color: string; textColor: string }>;
}) {
  const [showNotes, setShowNotes] = useState(
    Boolean(draft.replay) || Boolean(draft.bdr) || Boolean(draft.notes),
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const update = (patch: Partial<typeof draft>) => {
    const next = { ...draft, ...patch };
    onDraftChange(next);
    setShowNotes(Boolean(next.replay) || Boolean(next.bdr) || Boolean(next.notes));
  };

  const validateReplay = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      update({
        replay: '',
        replayError: null,
        replayGameId: null,
        validateStatus: 'idle',
        validateMessage: null,
        derivedScore: null,
        derivedEndCondition: null,
        derivedEndConditionCode: null,
        derivedPlayers: [],
        derivedPlayedAt: null,
        validationRaw: null,
      });
      return;
    }
    const matchUrl = trimmed.match(/(?:replay|shared-replay)\/(\d+)/i);
    const matchId = trimmed.match(/^\d+$/);
    const gameId = matchUrl ? matchUrl[1] : matchId ? matchId[0] : null;
    if (!gameId) {
      update({
        replay: '',
        replayError: 'Unable to parse game ID from link',
        replayGameId: null,
        validateStatus: 'error',
        derivedScore: null,
        derivedEndCondition: null,
        derivedEndConditionCode: null,
        derivedPlayers: [],
        derivedPlayedAt: null,
        validationRaw: null,
      });
      return;
    }

    update({
      replay: gameId,
      replayError: null,
      replayGameId: gameId,
      validateStatus: 'loading',
      validateMessage: null,
      derivedScore: null,
      derivedEndCondition: null,
      derivedEndConditionCode: null,
      derivedPlayers: [],
      derivedPlayedAt: null,
      validationRaw: null,
    });

    // attempt validation even if we end up not editable/authorized, and log why
    validateReplayRemote(gameId, trimmed);
  };

  const validateReplayRemote = async (gameId: string, replayValue: string) => {
    if (!replayValue || !gameId) return;

    if (!editable) {
      update({
        validateStatus: 'error',
        validateMessage: 'Not authorized to validate (not a team member).',
      });
      return;
    }
    if (!token) {
      update({
        validateStatus: 'error',
        validateMessage: 'No auth token available.',
      });
      return;
    }
    if (!slug) {
      update({
        validateStatus: 'error',
        validateMessage: 'Missing event slug.',
      });
      return;
    }

    update({ validateStatus: 'loading', validateMessage: null });
    try {
      const resp = await postJsonAuth<{
        ok: boolean;
        derived?: { variant?: string; score?: number; endCondition?: number; playedAt?: string };
        export?: { seed?: string; players?: string[] };
        raw?: unknown;
      }>(
        `/events/${encodeURIComponent(slug)}/teams/${teamId}/validate-replay?template_id=${template.template_id}`,
        token,
        {
          template_id: template.template_id,
          replay: replayValue,
        },
      );
      if (resp.ok) {
        const mappedEnd = mapEndCondition(resp.derived?.endCondition ?? null);
        update({
          validateStatus: 'ok',
          validateMessage: 'Replay matches team, seed, and variant.',
          replay: gameId, // replace input with parsed ID
          replayGameId: gameId,
          derivedScore: resp.derived?.score ?? null,
          derivedEndCondition: mappedEnd,
          derivedEndConditionCode: resp.derived?.endCondition ?? null,
          derivedPlayers: resp.export?.players ?? [],
          derivedPlayedAt: resp.derived?.playedAt ?? null,
          validationRaw: resp,
        });
      } else {
        update({
          validateStatus: 'error',
          validateMessage: 'Validation failed.',
          replay: '',
          replayGameId: null,
          derivedScore: null,
          derivedEndCondition: null,
          derivedEndConditionCode: null,
          derivedPlayers: [],
          derivedPlayedAt: null,
          validationRaw: resp,
        });
      }
    } catch (err) {
      const bodyError =
        err instanceof ApiError ? (err.body as { error?: string; details?: string })?.error : null;
      const bodyDetails =
        err instanceof ApiError ? (err.body as { error?: string; details?: string })?.details : null;
      const message =
        err instanceof ApiError
          ? bodyError ?? `Validation failed (status ${err.status})`
          : `Validation failed: ${(err as Error)?.message ?? String(err)}`;
      const detail = bodyDetails ? ` Details: ${bodyDetails}` : '';
      update({
        validateStatus: 'error',
        validateMessage: `${message}${detail ? ' - ' + detail : ''}`,
        replay: '',
        replayGameId: null,
        derivedScore: null,
        derivedEndCondition: null,
        derivedEndConditionCode: null,
        derivedPlayers: [],
        derivedPlayedAt: null,
        validationRaw:
          err instanceof ApiError
            ? { status: err.status, body: err.body }
            : { error: (err as Error)?.message ?? String(err) },
      });
    }
  };

  const zeroReasonFromEndCondition = (
    code: number | null | undefined,
  ): 'Strike Out' | 'Time Out' | 'VTK' | null => {
    if (code === 2) return 'Strike Out';
    if (code === 3) return 'Time Out';
    if (code === 4 || code === 10) return 'VTK';
    return null;
  };

  const handleSubmit = async () => {
    if (!editable) return;
    setSubmitError(null);
    if (!token) {
      setSubmitError('Not authenticated.');
      return;
    }
    if (!draft.replayGameId || draft.validateStatus !== 'ok') {
      setSubmitError('Validate the replay first.');
      return;
    }
    if (draft.derivedScore == null) {
      setSubmitError('Missing score from validation.');
      return;
    }

    setSubmitting(true);
    try {
      await postJsonAuth(
        '/results',
        token,
        {
          event_team_id: teamId,
          event_game_template_id: template.template_id,
          game_id: Number(draft.replayGameId),
          score: draft.derivedScore,
          zero_reason: zeroReasonFromEndCondition(draft.derivedEndConditionCode),
          bottom_deck_risk: draft.bdr ? Number(draft.bdr) : null,
          notes: draft.notes || null,
          played_at: draft.derivedPlayedAt ?? null,
          players: draft.derivedPlayers ?? [],
        },
      );
      window.location.reload();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? (err.body as { error?: string })?.error ?? `Submit failed (status ${err.status})`
          : (err as Error)?.message ?? 'Submit failed';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <tr className="border-t">
        <td className="px-3 py-2 text-sm">
          {showCreateLink && template.seed_payload ? (
            <CreateTableLink
              seed={template.seed_payload}
              variantName={template.variant}
              teamSize={teamSize}
              tablePassword={tablePassword}
              label={String(template.template_index)}
            />
          ) : (
            <span>{template.template_index}</span>
          )}
        </td>
      <td className="px-3 py-2 text-sm">{template.variant}</td>
      <td className="px-3 py-2 text-sm">
        {draft.derivedScore != null ? draft.derivedScore : <span className="text-gray-500">—</span>}
      </td>
      <td className="px-3 py-2 text-sm">
        {draft.derivedEndCondition ? draft.derivedEndCondition : <span className="text-gray-500">—</span>}
      </td>
      <td className="px-3 py-2 text-sm">
        {editable ? (
          <input
            className="w-20 border rounded px-2 py-1 text-sm"
            placeholder="BDR"
            value={draft.bdr}
            onChange={(e) => update({ bdr: e.target.value })}
          />
        ) : (
          <span className="text-gray-500">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-sm">
        {draft.derivedPlayers && draft.derivedPlayers.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {draft.derivedPlayers.map((p) => (
              <UserPill
                key={p}
                name={p}
                color={memberColors[p]?.color ?? '#777777'}
                textColor={memberColors[p]?.textColor ?? '#ffffff'}
              />
            ))}
          </div>
        ) : (
          <span className="text-gray-500">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-sm">
        {draft.derivedPlayedAt ? (
          <span>{new Date(draft.derivedPlayedAt).toLocaleDateString()}</span>
        ) : (
          <span className="text-gray-500">—</span>
        )}
      </td>
      <td className="px-3 py-2 text-sm">
          {editable ? (
            <div className="flex items-center gap-2">
              <input
                className="w-full border rounded px-2 py-1 text-sm"
                placeholder="Game ID or replay URL"
                value={draft.replay}
                onChange={(e) => validateReplay(e.target.value)}
              />
              <StatusIcon draft={draft} />
              <button
                className="px-3 py-1 rounded bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
                disabled={
                  !draft.replayGameId ||
                  Boolean(draft.replayError) ||
                  draft.validateStatus !== 'ok' ||
                  submitting
                }
                onClick={handleSubmit}
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          ) : (
            <span className="text-gray-500">—</span>
          )}
      </td>
      <td className="px-3 py-2 text-sm text-gray-500">—</td>
      </tr>
      {showNotes && (
        <tr className="border-t bg-gray-50">
          <td colSpan={9} className="px-3 py-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm"
              rows={Math.max(1, draft.notes.split('\n').length + 1)}
              placeholder="Add notes about this game"
              value={draft.notes}
              onChange={(e) => update({ notes: e.target.value })}
              disabled={!editable}
            />
          </td>
        </tr>
      )}
      {submitError && (
        <tr className="border-t bg-red-50">
          <td colSpan={9} className="px-3 py-2 text-sm text-red-700">
            {submitError}
          </td>
        </tr>
      )}
    </>
  );
}
