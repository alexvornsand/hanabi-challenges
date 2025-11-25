import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { NotFoundPage } from './NotFoundPage';
import { useEventDetail } from '../hooks/useEventDetail';
import { useEventTeams } from '../hooks/useEventTeams';
import { useAuth } from '../context/AuthContext';
import { useUserDirectory } from '../hooks/useUserDirectory';
import { UserPill } from '../components/UserPill';
import { ApiError, postJsonAuth } from '../lib/api';
import { useEventMemberships } from '../hooks/useEventMemberships';

export function EventDetailPage() {
  const { slug, teamSize } = useParams<{ slug: string; teamSize?: string }>();
  const navigate = useNavigate();
  const auth = useAuth();
  const { users: directory } = useUserDirectory();
  const { memberships } = useEventMemberships(slug);
  const [showRegister, setShowRegister] = useState(false);
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const parsedTeamSize = (() => {
    const n = teamSize ? Number(teamSize) : 3;
    if (!Number.isInteger(n) || n < 2 || n > 6) return 3;
    return n;
  })();

  const { event, loading, error, notFound } = useEventDetail(slug);
  const {
    teams,
    loading: teamsLoading,
    error: teamsError,
    refetch: refetchTeams,
  } = useEventTeams(slug);
  if (notFound) {
    return <NotFoundPage />;
  }

  if (loading) {
    return (
      <main className="p-4">
        <p>Loading event...</p>
      </main>
    );
  }

  if (error && !event) {
    return (
      <main className="p-4">
        <h1 className="text-xl font-semibold mb-2">Event</h1>
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  if (!event) {
    return (
      <main className="page">
        <h1 className="text-xl font-semibold mb-2">Event not found</h1>
      </main>
    );
  }

  const startsAt = event.starts_at ? new Date(event.starts_at) : null;
  const endsAt = event.ends_at ? new Date(event.ends_at) : null;
  const cutoff = event.registration_cutoff ? new Date(event.registration_cutoff) : endsAt;
  const now = new Date();
  const registrationClosed =
    (cutoff && now > cutoff) || (!event.allow_late_registration && cutoff && now > cutoff);

  return (
    <main className="page">
      <header className="card" style={{ padding: 'var(--space-md)' }}>
        <div className="stack-sm" style={{ flex: '1 1 auto' }}>
          <h1 className="text-2xl font-bold" style={{ margin: 0 }}>{event.name}</h1>
          {(startsAt || endsAt) && (
            <div className="inline items-center gap-2 text-sm text-gray-700">
              <span className="pill pill--accent">
                {startsAt ? startsAt.toLocaleDateString() : 'TBD'} — {endsAt ? endsAt.toLocaleDateString() : 'TBD'}
              </span>
            </div>
          )}
        </div>
        {event.long_description && (
          <div
            className="text-gray-800"
            style={{ whiteSpace: 'pre-line', marginTop: 'var(--space-md)' }}
          >
            {event.long_description}
          </div>
        )}
      </header>

      <section className="card stack-sm" style={{ position: 'relative' }}>
        <button
          className="btn btn--primary"
          style={{ position: 'absolute', top: 'var(--space-sm)', right: 'var(--space-sm)' }}
          onClick={() => {
            if (registrationClosed) return;
            setRegisterMessage(null);
            setRegisterError(null);
            setShowRegister(true);
          }}
          disabled={registrationClosed}
          title={registrationClosed ? 'Registration for this event is closed' : undefined}
        >
          Register a Team
        </button>
        <div className="flex flex-wrap gap-2">
          {[2, 3, 4, 5, 6].map((size) => {
            const isActive = parsedTeamSize === size;
            const target = size === 3 ? `/events/${event.slug}` : `/events/${event.slug}/${size}`;
            return (
              <Link
                key={size}
                to={target}
                className={`pill ${isActive ? 'pill--accent' : ''}`}
              >
                {size} Player
              </Link>
            );
          })}
        </div>

        <div className="stack-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold" style={{ margin: 0 }}>
              Teams
            </h2>
            {teamsLoading && <p className="text-sm text-gray-600">Loading teams…</p>}
          </div>

          {teamsError && <p className="text-red-600">{teamsError}</p>}

          {!teamsLoading && !teamsError && (
            <>
              {teams.filter((t) => t.team_size === parsedTeamSize).length === 0 ? (
                <p className="text-gray-600">No {parsedTeamSize}-player teams yet.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th className="text-right">Games</th>
                      <th className="text-right">Win Rate</th>
                      <th className="text-right">Avg BDR</th>
                      <th className="text-right">Avg Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams
                      .filter((t) => t.team_size === parsedTeamSize)
                      .map((team) => {
                        const completed = team.completed_games ?? 0;
                        const perfect = team.perfect_games ?? 0;
                        const winRate =
                          completed > 0 ? `${Math.round((perfect / completed) * 100)}%` : '—';
                        const avgBdr =
                          team.avg_bdr != null ? Number(team.avg_bdr).toFixed(2) : '—';
                        const avgScore =
                          team.avg_score != null ? Number(team.avg_score).toFixed(2) : '—';
                        return (
                          <tr key={team.id} className="border-t">
                            <td className="text-sm">
                              <Link
                                to={`/events/${event.slug}/teams/${team.id}`}
                                className="font-medium text-blue-700 hover:underline"
                              >
                                {team.name}
                              </Link>
                            </td>
                            <td className="text-sm text-right text-gray-600">
                              {completed} / {team.total_templates ?? '—'}
                            </td>
                            <td className="text-sm text-right text-gray-600">{winRate}</td>
                            <td className="text-sm text-right text-gray-600">{avgBdr}</td>
                            <td className="text-sm text-right text-gray-600">{avgScore}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </section>

      {showRegister && (
        <RegisterModal
          eventSlug={event.slug}
          eventName={event.name}
          refetchTeams={refetchTeams}
          auth={auth}
          directory={directory}
          memberships={memberships}
          onClose={() => {
            setShowRegister(false);
            setRegisterError(null);
          }}
          onSuccess={(msg) => {
            setRegisterError(null);
            setRegisterMessage(msg);
          }}
          onError={(msg) => {
            setRegisterError(msg);
            setRegisterMessage(null);
          }}
        />
      )}

      {registerError && (
        <div className="border rounded-md p-3 bg-white/70">
          <p className="text-red-600">{registerError}</p>
        </div>
      )}
    </main>
  );
}

type MemberEntry = {
  id?: number;
  display_name: string;
  color_hex: string;
  text_color: string;
  role: 'PLAYER' | 'STAFF';
  isPending?: boolean;
  locked?: boolean;
  ineligible?: boolean;
};

type RegisterModalProps = {
  eventSlug: string;
  eventName: string;
  refetchTeams: () => Promise<void>;
  auth: ReturnType<typeof useAuth>;
  directory: ReturnType<typeof useUserDirectory>['users'];
  memberships: ReturnType<typeof useEventMemberships>['memberships'];
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string | null) => void;
};

function RegisterModal({
  eventSlug,
  eventName,
  refetchTeams,
  auth,
  directory,
  memberships,
  onClose,
  onSuccess,
  onError,
}: RegisterModalProps) {
  const navigate = useNavigate();
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const user = auth.user;
  const defaultTeamName = user ? `${user.display_name}'s Team` : 'My Team';
  const [teamName, setTeamName] = useState('');
  const [teamSize, setTeamSize] = useState(3);
  const [memberInput, setMemberInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [members, setMembers] = useState<MemberEntry[]>(() => {
    if (!user) return [];
    return [
      {
        id: user.id,
        display_name: user.display_name,
        color_hex: user.color_hex,
        text_color: user.text_color,
        role: 'PLAYER',
        locked: true,
      },
    ];
  });

  const conflictsBySize = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const m of memberships) {
      if (!map.has(m.team_size)) map.set(m.team_size, new Set());
      map.get(m.team_size)!.add(m.user_id);
    }
    return map;
  }, [memberships]);

  const markIneligibility = (list: MemberEntry[], size: number) => {
    const blocked = conflictsBySize.get(size) ?? new Set<number>();
    return list.map((m) =>
      m.id && blocked.has(m.id) ? { ...m, ineligible: true } : { ...m, ineligible: false },
    );
  };

  const suggestions = useMemo(() => {
    const term = memberInput.trim().toLowerCase();
    if (!term) return [];
    return directory
      .filter((u) => !members.some((m) => m.id === u.id))
      .filter((u) => !(conflictsBySize.get(teamSize)?.has(u.id)))
      .filter((u) => u.display_name.toLowerCase().includes(term))
      .slice(0, 5);
  }, [memberInput, directory, members, conflictsBySize, teamSize]);

  if (!user) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-4 space-y-3 max-w-md w-full">
          <h2 className="text-xl font-semibold">Log in to register</h2>
          <p className="text-gray-700">You need to log in before registering a team.</p>
          <div className="flex gap-2 justify-end">
            <button className="px-3 py-2 rounded border" onClick={onClose}>
              Cancel
            </button>
            <Link to="/login" className="px-3 py-2 rounded bg-blue-600 text-white font-semibold text-center">
              Go to login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const addMember = (entry: MemberEntry) => {
    setMembers((prev) => markIneligibility([...prev, entry], teamSize));
    setMemberInput('');
    setLocalError(null);
  };

  const handleAddMemberInput = () => {
    const name = memberInput.trim();
    if (!name) return;
    const existing = directory.find((u) => u.display_name.toLowerCase() === name.toLowerCase());
    if (existing && !members.some((m) => m.id === existing.id)) {
      if (conflictsBySize.get(teamSize)?.has(existing.id)) {
        const msg = `${existing.display_name} is already on a ${teamSize}p team for this event.`;
        setLocalError(msg);
        onError(msg);
        return;
      }
      addMember({
        id: existing.id,
        display_name: existing.display_name,
        color_hex: existing.color_hex,
        text_color: existing.text_color,
        role: 'PLAYER',
      });
      return;
    }
    // Pending member
    addMember({
      display_name: name,
      color_hex: '#777777',
      text_color: '#ffffff',
      role: 'PLAYER',
      isPending: true,
    });
  };

  const removeMember = (name: string) => {
    setMembers((prev) =>
      markIneligibility(
        prev.filter((m) => m.display_name !== name || m.locked),
        teamSize,
      ),
    );
  };

  const handleSubmit = async () => {
    const finalName = teamName.trim() || defaultTeamName;
    if (members.length === 0) {
      const msg = 'Add at least one member.';
      setLocalError(msg);
      onError(msg);
      return;
    }
    if (!auth.token) {
      const msg = 'Not authenticated.';
      setLocalError(msg);
      onError(msg);
      return;
    }
    setSaving(true);
    setLocalError(null);
    onError(null);
    try {
      const payload = {
        team_name: finalName,
        team_size: teamSize,
        members: members.map((m) =>
          m.id
            ? { user_id: m.id, role: 'PLAYER' }
            : { display_name: m.display_name, role: 'PLAYER' },
        ),
      };
      await postJsonAuth(`/events/${eventSlug}/register`, auth.token, payload);
      onError(null);
      setLocalError(null);
      onSuccess('Team registered!');
      try {
        await refetchTeams();
      } catch (fetchErr) {
        console.error('Failed to refresh teams after register', fetchErr);
      }
      const target =
        teamSize === 3
          ? `/events/${eventSlug}`
          : `/events/${eventSlug}/${teamSize}`;
      navigate(target, { replace: true });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const msg =
          (err.body as { error?: string })?.error ?? 'Failed to register team.';
        setLocalError(msg);
        onError(msg);
      } else {
        const msg = 'Failed to register team.';
        setLocalError(msg);
        onError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        zIndex: 2000,
        background: 'rgba(0,0,0,0.25)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card stack-sm"
        style={{ maxWidth: '720px', width: '100%', padding: '16px', boxShadow: 'var(--shadow-hover)' }}
      >
        <div style={{ position: 'relative' }}>
          <div className="stack-xxs">
            <h2 className="text-xl font-semibold" style={{ margin: 0 }}>
              Register for {eventName}
            </h2>
            <p className="text-sm text-gray-600" style={{ margin: 0 }}>
              Create a team, set your size, and add members.
            </p>
          </div>
          <button
            onClick={onClose}
            className="material-symbols-outlined"
            aria-label="Close"
            title="Close"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text)',
              cursor: 'pointer',
            }}
          >
            close
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="stack-xxs">
            <label className="text-sm font-medium text-gray-700">Team name</label>
            <input
              className="input"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder={defaultTeamName}
            />
          </div>
          <div className="stack-xxs">
            <label className="text-sm font-medium text-gray-700">Team size</label>
            <select
              className="select"
              value={teamSize}
              onChange={(e) => {
                const next = Number(e.target.value);
                setTeamSize(next);
                setMembers((prev) => markIneligibility(prev, next));
              }}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} players
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="stack-xxs">
          <label className="text-sm font-medium text-gray-700">Members</label>
          <div
            style={{
              position: 'relative',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              background: '#fff',
              padding: '8px',
              minHeight: '52px',
            }}
          >
            <div className="flex flex-wrap gap-2 items-center">
              {members.map((m) => (
                <MemberChip
                  key={`${m.display_name}-${m.id ?? 'pending'}`}
                  member={m}
                  onRemove={() => removeMember(m.display_name)}
                />
              ))}
              <input
                className="flex-1 min-w-[140px] border-0 outline-none px-1 py-1"
                placeholder="Add member by name"
                value={memberInput}
                onChange={(e) => setMemberInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    handleAddMemberInput();
                  }
                  if (e.key === 'Tab') {
                    if (suggestions.length > 0) {
                      e.preventDefault();
                      addMember({
                        id: suggestions[0].id,
                        display_name: suggestions[0].display_name,
                        color_hex: suggestions[0].color_hex,
                        text_color: suggestions[0].text_color,
                        role: 'PLAYER',
                      });
                      setMemberInput('');
                    } else {
                      handleAddMemberInput();
                    }
                  }
                }}
              />
            </div>

            {suggestions.length > 0 && (
              <div
                className="card"
                style={{
                  position: 'absolute',
                  left: '8px',
                  right: '8px',
                  top: 'calc(100% + 6px)',
                  zIndex: 10,
                  padding: '6px',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <p className="text-xs text-gray-500" style={{ margin: '0 0 4px 0' }}>
                  Suggestions
                </p>
                <div className="flex flex-wrap gap-1">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      className="border rounded px-2 py-1 text-sm bg-white hover:bg-blue-50"
                      onClick={() => {
                        addMember({
                          id: s.id,
                          display_name: s.display_name,
                          color_hex: s.color_hex,
                          text_color: s.text_color,
                          role: 'PLAYER',
                        });
                        setMemberInput('');
                      }}
                    >
                      {s.display_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {localError && (
          <div
            className="flex items-center text-sm"
            style={{ color: 'var(--color-danger)', gap: '6px' }}
          >
            <span className="material-symbols-outlined" aria-hidden="true" style={{ color: 'inherit' }}>
              error
            </span>
            <span style={{ color: 'inherit' }}>{localError}</span>
          </div>
        )}

        <div
          style={{
            marginTop: 'var(--space-sm)',
            display: 'flex',
            justifyContent: 'flex-end',
            width: '100%',
          }}
        >
          <button className="btn btn--primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Registering...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MemberChip({
  member,
  onRemove,
}: {
  member: MemberEntry;
  onRemove: () => void;
}) {
  const bg = member.color_hex || '#777777';
  const fg = member.text_color || '#ffffff';
  const pillBg = member.ineligible ? '#dc2626' : member.isPending ? '#777777' : bg;
  const pillFg = member.ineligible ? '#ffffff' : member.isPending ? '#ffffff' : fg;
  const locked = member.locked;
  return (
    <div
      className="flex items-center gap-1 border rounded-full pl-2 pr-1 py-1 bg-white shadow-sm"
      style={{
        display: 'inline-flex',
        cursor: locked ? 'not-allowed' : 'pointer',
        marginRight: '6px',
        marginBottom: '4px',
        fontStyle: member.isPending || !member.id ? 'italic' : undefined,
      }}
      title={
        locked
          ? 'You are automatically included and cannot be removed'
          : 'Click to remove'
      }
      onClick={() => {
        if (!locked) onRemove();
      }}
    >
      <UserPill
        name={member.display_name}
        color={pillBg}
        textColor={pillFg}
        className={member.isPending || !member.id ? 'user-pill--pending' : ''}
      />
    </div>
  );
}
