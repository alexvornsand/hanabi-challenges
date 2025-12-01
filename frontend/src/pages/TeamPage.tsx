import { Link, useParams } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';
import { useTeamDetail, type TeamGame } from '../hooks/useTeamDetail';
import { useTeamTemplates, type TeamTemplate } from '../hooks/useTeamTemplates';
import { UserPill } from '../features/users/UserPill';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { postJsonAuth } from '../lib/api';
import { SpoilerGatePage } from './SpoilerGatePage';
import { useEventDetail } from '../hooks/useEventDetail';

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function TeamPage() {
  const { slug, teamId } = useParams<{ slug: string; teamId: string }>();

  const parsedTeamId = (() => {
    const n = Number(teamId);
    return Number.isInteger(n) ? n : null;
  })();

  const { data, loading, error, notFound, refetch, gate } = useTeamDetail(parsedTeamId);
  const { event: eventMeta } = useEventDetail(slug);
  const [templatesEnabled, setTemplatesEnabled] = useState(true);
  const {
    templates,
    loading: templatesLoading,
    error: templatesError,
  } = useTeamTemplates(parsedTeamId, {
    enabled: templatesEnabled,
  });
  const { user, token } = useAuth();
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [drafts, setDrafts] = useState<
    Record<
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
    >
  >({});
  const [forfeitLoading, setForfeitLoading] = useState(false);
  const [nowTs, setNowTs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (gate) {
      setTemplatesEnabled(false);
    } else {
      setTemplatesEnabled(true);
    }
  }, [gate]);

  const members = useMemo(() => data?.members ?? [], [data]);
  const isMember = useMemo(
    () => (user ? members.some((m) => m.user_id === user.id) : false),
    [user, members],
  );
  const hasPlayed = useMemo(() => {
    if (!user || !data?.games) return false;
    return data.games.some((g) =>
      (g.players ?? []).some((p) => p.display_name === user.display_name),
    );
  }, [data?.games, user]);
  const canDeleteTeam =
    user &&
    data?.team.owner_user_id != null &&
    user.id === data.team.owner_user_id &&
    (data.games?.length ?? 0) === 0;

  const memberColorMap = useMemo(() => {
    const map: Record<string, { color: string; textColor: string }> = {};
    members.forEach((m) => {
      map[m.display_name] = { color: m.color_hex, textColor: m.text_color };
    });
    return map;
  }, [members]);

  const games = useMemo(() => (Array.isArray(data?.games) ? data.games : []), [data]);
  const stats = useMemo(() => {
    const totalTemplates = templates.length;
    const completed = templates.filter((t) => t.result).length;
    const totalScore = templates.reduce((sum, t) => sum + (t.result?.score ?? 0), 0);
    const maxScoreTotal = templates.reduce((sum, t) => sum + (t.max_score ?? 25), 0);
    const winCount = templates.filter(
      (t) => t.result && t.max_score != null && t.result.score === t.max_score,
    ).length;
    const avgScore = completed > 0 ? totalScore / completed : null;
    const avgBdrCount = templates.filter((t) => t.result && t.result.bottom_deck_risk != null);
    const avgBdr =
      avgBdrCount.length > 0
        ? avgBdrCount.reduce((sum, t) => sum + (t.result!.bottom_deck_risk ?? 0), 0) /
          avgBdrCount.length
        : null;
    return {
      totalTemplates,
      completed,
      percentMax: maxScoreTotal > 0 ? totalScore / maxScoreTotal : null,
      winRate: completed > 0 ? winCount / completed : null,
      avgScore,
      avgBdr,
    };
  }, [templates]);

  const templateStages = groupTemplatesByStage(templates ?? []);
  const gameByTemplateId = useMemo(() => {
    const map = new Map<number, TeamGame>();
    games.forEach((g) => map.set(g.event_game_template_id, g));
    return map;
  }, [games]);
  const collapsedMap = useMemo(() => {
    const defaults: Record<string, boolean> = {};
    templateStages.forEach((stage) => {
      if (stage.stage_status === 'in_progress') defaults[stage.stage_label] = false;
      if (stage.stage_status === 'complete') defaults[stage.stage_label] = true;
    });
    return defaults;
  }, [templateStages]);
  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<string, boolean>>({});
  const handleForfeit = async () => {
    if (!token || !parsedTeamId) return;
    setForfeitLoading(true);
    try {
      await postJsonAuth(
        `/events/${gate?.event_slug ?? data?.team.event_slug}/eligibility/spoilers`,
        token,
        {
          team_size: gate?.team_size ?? data?.team.team_size,
          source_event_team_id: parsedTeamId,
          reason: 'team_page_spoiler',
        },
      );
      setTemplatesEnabled(true);
      await refetch();
    } catch (err) {
      console.error('Failed to forfeit eligibility', err);
    } finally {
      setForfeitLoading(false);
    }
  };

  const playStartsAt = eventMeta?.starts_at ? new Date(eventMeta.starts_at).getTime() : null;
  const playEndsAt = eventMeta?.ends_at ? new Date(eventMeta.ends_at).getTime() : null;
  const playWindow = useMemo(() => {
    if (!playStartsAt && !playEndsAt) return null;
    if (playStartsAt && nowTs < playStartsAt) {
      return {
        state: 'not_started' as const,
        label: `Play starts in ${formatCountdown(playStartsAt - nowTs)}`,
      };
    }
    if (playEndsAt && nowTs < playEndsAt) {
      return {
        state: 'open' as const,
        label: `Play ends in ${formatCountdown(playEndsAt - nowTs)}`,
      };
    }
    if (playEndsAt && nowTs >= playEndsAt) {
      return { state: 'closed' as const, label: 'Play closed' };
    }
    return { state: 'open' as const, label: 'Play open' };
  }, [playStartsAt, playEndsAt, nowTs]);

  if (!parsedTeamId || notFound) {
    return <NotFoundPage />;
  }

  if (loading) {
    return (
      <main className="page">
        <p>Loading team...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="page">
        <h1 className="text-xl font-semibold mb-2">Team</h1>
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  if (gate && !isMember) {
    return (
      <SpoilerGatePage
        mode={gate.mode === 'prompt' ? 'prompt' : gate.mode === 'blocked' ? 'blocked' : 'login'}
        eventSlug={gate.event_slug || slug}
        onForfeit={gate.mode === 'prompt' ? handleForfeit : undefined}
        loading={forfeitLoading}
        errorMessage={gate.message}
      />
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
    <main className="page">
      <header className="stack-sm">
        <p className="text-sm text-gray-600">
          <Link to={`/events/${data.team.event_slug}`} className="text-blue-700">
            {data.team.event_name}
          </Link>{' '}
          · Team
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{data.team.name}</h1>
          <span className="pill pill--accent text-sm">{data.team.team_size}-Player Team</span>
        </div>
      </header>
      {leaveError && <p className="text-red-600 text-sm">{leaveError}</p>}

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 2fr',
          gap: 'var(--space-md)',
          alignItems: 'stretch',
        }}
      >
        <div className="card stack-sm" style={{ height: '100%' }}>
          <h2 className="text-xl font-semibold">Roster</h2>
          {data.members.length === 0 ? (
            <p className="text-gray-600">No members listed yet.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
              {data.members.map((member) => (
                <UserPill
                  key={member.id}
                  name={member.display_name}
                  color={member.color_hex}
                  textColor={member.text_color}
                />
              ))}
            </div>
          )}
        </div>
        <div className="card stack-sm" style={{ height: '100%' }}>
          <h2 className="text-xl font-semibold">Performance</h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
              gap: 'var(--space-sm)',
            }}
          >
            <div className="card stack-sm kpi-card">
              <span className="kpi-label">Games Completed</span>
              <div className="kpi-value">
                {stats.completed} / {stats.totalTemplates}
              </div>
            </div>
            <div className="card stack-sm kpi-card">
              <span className="kpi-label">Win Rate</span>
              <div className="kpi-value">
                {stats.winRate != null ? `${Math.round(stats.winRate * 100)}%` : '—'}
              </div>
            </div>
            <div className="card stack-sm kpi-card">
              <span className="kpi-label">Avg BDR</span>
              <div className="kpi-value">
                {stats.avgBdr != null ? stats.avgBdr.toFixed(2) : '—'}
              </div>
            </div>
            <div className="card stack-sm kpi-card">
              <span className="kpi-label">Avg Score</span>
              <div className="kpi-value">
                {stats.avgScore != null ? stats.avgScore.toFixed(2) : '—'}
              </div>
            </div>
            <div
              className="card"
              style={{ gridColumn: 3, gridRow: '1 / span 2', minHeight: '180px' }}
            />
          </div>
        </div>
      </section>

      <section className="stack-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Games</h2>
            {playWindow && (
              <span className={`pill text-xs ${playWindow.state === 'open' ? 'pill--accent' : ''}`}>
                {playWindow.label}
              </span>
            )}
          </div>
          {templatesLoading && <p className="text-sm text-gray-600">Loading games…</p>}
        </div>
        {templatesError && <p className="text-red-600">{templatesError}</p>}
        {!templatesLoading && templates.length === 0 && (
          <p className="text-gray-600">No games found.</p>
        )}
        {playWindow?.state === 'not_started' && (
          <div className="card" style={{ padding: 'var(--space-md)' }}>
            <p className="text-gray-700" style={{ margin: 0 }}>
              Play hasn&apos;t started yet. Come back when the window opens to see seeds and submit
              replays.
            </p>
          </div>
        )}
        {!templatesLoading && templates.length > 0 && playWindow?.state !== 'not_started' && (
          <div className="stack">
            {templateStages.map((stage) => (
              <div key={stage.stage_label} className="card" style={{ padding: 0 }}>
                {(() => {
                  const played = stage.templates.filter((t) => Boolean(t.result)).length;
                  const perfect = stage.templates.filter(
                    (t) => t.result && t.max_score != null && t.result.score === t.max_score,
                  ).length;
                  const baseCollapsed = collapsedMap[stage.stage_label];
                  const isCollapsed =
                    collapsedOverrides[stage.stage_label] ?? baseCollapsed ?? false;
                  return (
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedOverrides((prev) => ({
                          ...prev,
                          [stage.stage_label]: !isCollapsed,
                        }))
                      }
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        border: 'none',
                        width: '100%',
                        textAlign: 'left',
                        background: 'var(--color-surface-muted)',
                        padding: '4px var(--space-sm)',
                        gap: 'var(--space-sm)',
                        borderBottom: '1px solid var(--color-border)',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ minWidth: 0, overflow: 'hidden' }}>
                        <h3
                          className="text-base font-semibold"
                          style={{
                            margin: 0,
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                          }}
                        >
                          {stage.stage_label}
                        </h3>
                      </div>
                      <div
                        style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                        className="text-sm text-gray-600"
                      >
                        {perfect} / {played}
                      </div>
                    </button>
                  );
                })()}
                {!(
                  collapsedOverrides[stage.stage_label] ??
                  collapsedMap[stage.stage_label] ??
                  false
                ) && (
                  <table>
                    <thead>
                      <tr>
                        <th>Index</th>
                        <th>Variant</th>
                        <th className="text-right">Score</th>
                        <th>Outcome</th>
                        <th className="text-right">BDR</th>
                        <th>Players</th>
                        <th>Date</th>
                        <th>Game ID</th>
                        <th>Notes</th>
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
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {isMember && !hasPlayed && (
        <div
          style={{ marginTop: 'var(--space-md)', display: 'flex', justifyContent: 'flex-start' }}
        >
          <button
            className="btn"
            style={{ backgroundColor: '#dc2626', color: '#fff' }}
            onClick={() => {
              if (!token || !user) return;
              const promptText = canDeleteTeam
                ? 'Delete this team? This cannot be undone.'
                : 'Leave this team? This cannot be undone.';
              const confirmed = window.confirm(promptText);
              if (!confirmed) return;
              (async () => {
                setLeaving(true);
                setLeaveError(null);
                try {
                  const endpoint = canDeleteTeam
                    ? `/api/event-teams/${data.team.id}`
                    : `/api/event-teams/${data.team.id}/members/${user.id}`;
                  const res = await fetch(endpoint, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    setLeaveError(
                      body.error ||
                        (canDeleteTeam ? 'Failed to delete team' : 'Failed to leave team'),
                    );
                  } else {
                    await refetch();
                    window.location.href = `/events/${data.team.event_slug}`;
                  }
                } catch (err) {
                  console.error('Failed to update team membership', err);
                  setLeaveError(canDeleteTeam ? 'Failed to delete team' : 'Failed to leave team');
                } finally {
                  setLeaving(false);
                }
              })();
            }}
            disabled={leaving}
          >
            {leaving
              ? canDeleteTeam
                ? 'Deleting…'
                : 'Leaving…'
              : canDeleteTeam
                ? 'Delete team'
                : 'Leave team'}
          </button>
        </div>
      )}
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

function StatusIcon({
  draft,
}: {
  draft: {
    validateStatus?: 'idle' | 'loading' | 'ok' | 'error';
    validateMessage?: string | null;
    replayError?: string | null;
  };
}) {
  if (draft.replayError) {
    return (
      <span className="material-symbols-outlined" aria-label="error" title={draft.replayError}>
        &#xe000;
      </span>
    );
  }
  if (draft.validateStatus === 'loading') {
    return (
      <span className="material-symbols-outlined" aria-label="loading" title="Validating replay…">
        &#xea5b;
      </span>
    );
  }
  if (draft.validateStatus === 'ok') {
    return (
      <span
        className="material-symbols-outlined"
        aria-label="ok"
        title={draft.validateMessage ?? 'Valid replay'}
      >
        &#xe86c;
      </span>
    );
  }
  if (draft.validateStatus === 'error') {
    return (
      <span
        className="material-symbols-outlined"
        aria-label="error"
        title={draft.validateMessage ?? 'Validation failed'}
      >
        &#xe000;
      </span>
    );
  }
  return null;
}

function groupTemplatesByStage(templates: TeamTemplate[]) {
  const map = new Map<
    string,
    {
      stage_label: string;
      stage_type: string;
      stage_index: number;
      stage_status?: string | null;
      templates: TeamTemplate[];
      stats?: { games_played: number; perfect_games: number };
    }
  >();
  templates.forEach((tpl) => {
    const key = `${tpl.stage_index}-${tpl.stage_label}`;
    if (tpl.stage_status === 'not_started') {
      return;
    }
    if (!map.has(key)) {
      map.set(key, {
        stage_label: tpl.stage_label,
        stage_type: tpl.stage_type,
        stage_index: tpl.stage_index,
        stage_status: tpl.stage_status,
        templates: [],
        stats: tpl.stats,
      });
    }
    // keep stats if provided on this template
    const existing = map.get(key);
    if (!existing?.stats && tpl.stats) {
      map.get(key)!.stats = tpl.stats;
    }
    map.get(key)!.templates.push(tpl);
  });
  return Array.from(map.values()).sort((a, b) => {
    const rank = (s?: string | null) => (s === 'in_progress' ? 0 : s === 'complete' ? 1 : 2);
    const ra = rank(a.stage_status);
    const rb = rank(b.stage_status);
    if (ra !== rb) return ra - rb;
    if (ra === 0) {
      // in progress ascending
      return a.stage_index - b.stage_index;
    }
    if (ra === 1) {
      // complete descending
      return b.stage_index - a.stage_index;
    }
    return a.stage_index - b.stage_index;
  });
}

function PlayedRow({
  template,
  fallbackGame,
}: {
  template: TeamTemplate;
  fallbackGame?: TeamGame;
}) {
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
      <td className="px-3 py-2 text-sm text-right">{score}</td>
      <td className="px-3 py-2 text-sm">{reason || 'Normal'}</td>
      <td className="px-3 py-2 text-sm text-right">{r.bottom_deck_risk ?? ''}</td>
      <td className="px-3 py-2 text-sm">
        {players.length > 0 ? (
          <div className="pill-row">
            {players.map((p) => (
              <UserPill
                key={p.display_name}
                name={p.display_name}
                color={p.color_hex}
                textColor={p.text_color}
              />
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
          <span className="material-symbols-outlined" aria-label="Notes" title={r.notes}>
            note
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
        err instanceof ApiError
          ? (err.body as { error?: string; details?: string })?.details
          : null;
      const message =
        err instanceof ApiError
          ? (bodyError ?? `Validation failed (status ${err.status})`)
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
      await postJsonAuth('/results', token, {
        event_team_id: teamId,
        event_game_template_id: template.template_id,
        game_id: Number(draft.replayGameId),
        score: draft.derivedScore,
        zero_reason: zeroReasonFromEndCondition(draft.derivedEndConditionCode),
        bottom_deck_risk: draft.bdr ? Number(draft.bdr) : null,
        notes: draft.notes || null,
        played_at: draft.derivedPlayedAt ?? null,
        players: draft.derivedPlayers ?? [],
      });
      window.location.reload();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? ((err.body as { error?: string })?.error ?? `Submit failed (status ${err.status})`)
          : ((err as Error)?.message ?? 'Submit failed');
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
        <td className="px-3 py-2 text-sm text-right">
          {draft.derivedScore != null ? draft.derivedScore : ''}
        </td>
        <td className="px-3 py-2 text-sm">
          {draft.derivedEndCondition ? draft.derivedEndCondition : ''}
        </td>
        <td className="px-3 py-2 text-sm text-right">
          {editable ? (
            <input
              className="input"
              style={{ width: '72px' }}
              placeholder="BDR"
              value={draft.bdr}
              onChange={(e) => update({ bdr: e.target.value })}
            />
          ) : (
            ''
          )}
        </td>
        <td className="px-3 py-2 text-sm">
          {draft.derivedPlayers && draft.derivedPlayers.length > 0 ? (
            <div className="pill-row">
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
            ''
          )}
        </td>
        <td className="px-3 py-2 text-sm">
          {draft.derivedPlayedAt ? (
            <span>{new Date(draft.derivedPlayedAt).toLocaleDateString()}</span>
          ) : (
            ''
          )}
        </td>
        <td className="px-3 py-2 text-sm">
          {editable ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto auto auto',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <input
                className="input"
                style={{ maxWidth: '150px', minWidth: '120px' }}
                placeholder="Game ID or URL"
                value={draft.replay}
                onChange={(e) => validateReplay(e.target.value)}
              />
              <StatusIcon draft={draft} />
              <button
                className="btn btn--primary btn--sm"
                disabled={
                  !draft.replayGameId ||
                  Boolean(draft.replayError) ||
                  draft.validateStatus !== 'ok' ||
                  submitting
                }
                onClick={handleSubmit}
                aria-label="Submit"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  &#xe941;
                </span>
              </button>
            </div>
          ) : (
            ''
          )}
        </td>
        <td className="px-3 py-2 text-sm text-gray-500"></td>
      </tr>
      {showNotes && (
        <tr className="border-t bg-gray-50">
          <td colSpan={9} className="px-3 py-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              className="textarea"
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
