import { useParams, Link, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { NotFoundPage } from './NotFoundPage';
import { useEventDetail } from '../hooks/useEventDetail';
import { useEventTeams } from '../hooks/useEventTeams';
import { useAuth } from '../context/AuthContext';
import { useUserDirectory } from '../hooks/useUserDirectory';
import { UserPill } from '../features/users/UserPill';
import { UserSearchSelect, type UserSuggestion } from '../features/users/UserSearchSelect';
import { EventCard } from '../features/events';
import { ApiError, postJsonAuth } from '../lib/api';
import { useEventMemberships } from '../hooks/useEventMemberships';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Heading,
  Inline,
  Input,
  InputContainer,
  Modal,
  PageContainer,
  Section,
  Stack,
  Text,
  Alert,
  Tooltip,
} from '../design-system';

export function EventDetailPage() {
  const { slug, teamSize } = useParams<{ slug: string; teamSize?: string }>();
  const auth = useAuth();
  const { users: directory } = useUserDirectory();
  const { memberships } = useEventMemberships(slug);
  const [showRegister, setShowRegister] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  function formatCountdown(ms: number) {
    if (Number.isNaN(ms)) return '';
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

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
  const totalGamesPlayed = useMemo(
    () => (teams ?? []).reduce((sum, t) => sum + (Number(t.completed_games) || 0), 0),
    [teams],
  );
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
  const registrationOpens = event.registration_opens_at
    ? new Date(event.registration_opens_at)
    : startsAt;
  const now = new Date();
  const registrationClosed = !!(cutoff && now > cutoff && !event.allow_late_registration);
  const registrationWindow = (() => {
    if (registrationOpens && nowTs < registrationOpens.getTime()) {
      return {
        label: `Opens in ${formatCountdown(registrationOpens.getTime() - nowTs)}`,
        variant: 'default' as const,
        canRegister: false,
      };
    }
    if (cutoff && nowTs < cutoff.getTime()) {
      return {
        label: `Closes in ${formatCountdown(cutoff.getTime() - nowTs)}`,
        variant: 'accent' as const,
        canRegister: true,
      };
    }
    if (registrationClosed) {
      return { label: 'Registration closed', variant: 'default' as const, canRegister: false };
    }
    return { label: 'Registration open', variant: 'accent' as const, canRegister: true };
  })();

  return (
    <main>
      <PageContainer>
        <Section paddingY="lg">
          <Stack gap="md">
            <EventCard
              event={event}
              description="long"
              now={nowTs}
              disableLink
              headerAction={
                !teamsLoading && totalGamesPlayed > 0 ? (
                  <Button
                    as={Link}
                    to={`/events/${event.slug}/stats`}
                    variant="secondary"
                    size="md"
                  >
                    View stats
                  </Button>
                ) : undefined
              }
            />

            <Card variant="outline" separated>
              <CardHeader>
                <Inline align="center" justify="space-between" wrap>
                  <Heading level={3}>Teams</Heading>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => {
                      if (!registrationWindow.canRegister) return;
                      setRegisterError(null);
                      setShowRegister(true);
                    }}
                    disabled={!registrationWindow.canRegister}
                    title={
                      !registrationWindow.canRegister
                        ? 'Registration for this event is closed or not yet open'
                        : undefined
                    }
                  >
                    Register a Team
                  </Button>
                </Inline>
              </CardHeader>
              <CardBody>
                <Inline gap="sm" wrap align="center" style={{ marginBottom: 'var(--ds-space-sm)' }}>
                  {[2, 3, 4, 5, 6].map((size) => {
                    const isActive = parsedTeamSize === size;
                    const target =
                      size === 3 ? `/events/${event.slug}` : `/events/${event.slug}/${size}`;
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
                </Inline>

                {teamsLoading && <Text variant="muted">Loading teams…</Text>}
                {teamsError && <Text variant="body">{teamsError}</Text>}

                {!teamsLoading && !teamsError && (
                  <>
                    {teams.filter((t) => t.team_size === parsedTeamSize).length === 0 ? (
                      <Text variant="muted">No {parsedTeamSize}-player teams yet.</Text>
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
              </CardBody>
            </Card>
          </Stack>
        </Section>
      </PageContainer>

      {showRegister && (
        <RegisterModal
          eventSlug={event.slug}
          eventName={event.name}
          enforceExactTeamSize={Boolean(event.enforce_exact_team_size)}
          refetchTeams={refetchTeams}
          auth={auth}
          directory={directory}
          memberships={memberships}
          onClose={() => {
            setShowRegister(false);
            setRegisterError(null);
          }}
          onSuccess={() => {
            setRegisterError(null);
          }}
          onError={(msg) => {
            setRegisterError(msg);
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
  enforceExactTeamSize?: boolean;
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
  enforceExactTeamSize = false,
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
  const [teamPassword, setTeamPassword] = useState('');
  const [teamSize, setTeamSize] = useState<number | null>(null);
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

  const markIneligibility = (list: MemberEntry[], size: number | null) => {
    if (!size) return list.map((m) => ({ ...m, ineligible: false }));
    const blocked = conflictsBySize.get(size) ?? new Set<number>();
    return list.map((m) =>
      m.id && blocked.has(m.id) ? { ...m, ineligible: true } : { ...m, ineligible: false },
    );
  };

  const suggestions = useMemo(() => {
    const term = memberInput.trim().toLowerCase();
    if (!term) return [];
    const blocked = teamSize ? conflictsBySize.get(teamSize) : undefined;
    return directory
      .filter((u) => !members.some((m) => m.id === u.id))
      .filter((u) => !blocked?.has(u.id))
      .filter((u) => u.display_name.toLowerCase().includes(term))
      .slice(0, 5);
  }, [memberInput, directory, members, conflictsBySize, teamSize]);

  useEffect(() => {
    const invalid = members.filter((m) => m.ineligible);
    if (invalid.length > 0) {
      setLocalError(
        `${invalid.map((m) => m.display_name).join(', ')} already on a ${teamSize}p team.`,
      );
    } else if (localError && localError.includes('already on a')) {
      setLocalError(null);
    }
  }, [members, teamSize, localError]);

  if (!user) {
    return (
      <Modal open onClose={onClose} maxWidth="520px">
        <Stack gap="sm">
          <Heading level={3}>Log in to register</Heading>
          <Text variant="body">You need to log in before registering a team.</Text>
          <Inline gap="sm" align="center">
            <Button as={Link} to="/login" variant="primary" size="sm">
              Go to login
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </Inline>
        </Stack>
      </Modal>
    );
  }

  const addMember = (entry: MemberEntry) => {
    setMembers((prev) => markIneligibility([...prev, entry], teamSize));
    setLocalError(null);
  };

  const handleAddMemberInput = (inputVal?: string) => {
    const name = (inputVal ?? memberInput).trim();
    if (!name) return;
    const existing = directory.find((u) => u.display_name.toLowerCase() === name.toLowerCase());
    if (existing && !members.some((m) => m.id === existing.id)) {
      const conflictSet = teamSize ? conflictsBySize.get(teamSize) : undefined;
      if (conflictSet?.has(existing.id)) {
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
    setMemberInput('');
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
    if (!teamSize) {
      const msg = 'Select a team size.';
      setLocalError(msg);
      onError(msg);
      return;
    }
    if (enforceExactTeamSize && teamSize && members.length !== teamSize) {
      const msg = `Team must have exactly ${teamSize} players.`;
      setLocalError(msg);
      onError(msg);
      return;
    }
    if (teamPassword && /[^a-zA-Z0-9]/.test(teamPassword)) {
      const msg = 'Team password must be alphanumeric only.';
      setLocalError(msg);
      onError(msg);
      return;
    }
    if (members.length === 0) {
      const msg = 'Add at least one member.';
      setLocalError(msg);
      onError(msg);
      return;
    }
    const invalid = members.filter((m) => m.ineligible);
    if (invalid.length > 0) {
      const msg = `${invalid.map((m) => m.display_name).join(', ')} already on a ${teamSize}p team.`;
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
        team_password: teamPassword || undefined,
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
        teamSize && teamSize !== 3 ? `/events/${eventSlug}/${teamSize}` : `/events/${eventSlug}`;
      navigate(target, { replace: true });
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = (err.body as { error?: string })?.error ?? 'Failed to register team.';
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
        style={{
          maxWidth: '720px',
          width: '100%',
          padding: '16px',
          boxShadow: 'var(--shadow-hover)',
        }}
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

        <Stack gap="md">
          <InputContainer label="Team name">
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder={defaultTeamName}
              fullWidth
            />
          </InputContainer>

          <Inline columnWidths={[3, 7]} align="start" gap="sm">
            <InputContainer label="Team size">
              <select
                className="select"
                value={teamSize ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const next = val ? Number(val) : null;
                  setTeamSize(next);
                  setMembers((prev) => markIneligibility(prev, next));
                }}
                style={{ height: 'var(--ds-size-control-md-height)', width: '100%' }}
              >
                <option value="" disabled>
                  Select team size
                </option>
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} players
                  </option>
                ))}
              </select>
            </InputContainer>
            <InputContainer
              label="Team password (optional)"
              labelAction={
                <Tooltip content="This password is only used to gate access to your table. This is a feature of convenience. While your password won't be visible to anyone but you and your teammates, it is not securely stored. Do not use sensitive passwords. Passwords should be letters and numbers only.">
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '18px', color: 'var(--ds-color-text-muted)' }}
                    aria-label="Team password info"
                  >
                    info
                  </span>
                </Tooltip>
              }
            >
              <Input
                type="text"
                value={teamPassword}
                onChange={(e) => setTeamPassword(e.target.value)}
                placeholder="Set a password for your team"
                fullWidth
              />
            </InputContainer>
          </Inline>

          <InputContainer label="Members">
            <UserSearchSelect
              value={memberInput}
              onChange={(next) => setMemberInput(next)}
              suggestions={suggestions as UserSuggestion[]}
              onSelect={(s) => {
                addMember({
                  id: s.id,
                  display_name: s.display_name,
                  color_hex: s.color_hex || '#777777',
                  text_color: s.text_color || '#ffffff',
                  role: 'PLAYER',
                });
                setMemberInput('');
              }}
              onSubmitFreeText={() => handleAddMemberInput()}
              placeholder="Add member by name"
              maxSelections={enforceExactTeamSize ? (teamSize ?? undefined) : undefined}
              selectedCount={members.length}
              disabled={!teamSize}
              tokens={members.map((m) => {
                const bg = m.ineligible ? '#dc2626' : m.color_hex || '#777777';
                const fg = m.ineligible ? '#ffffff' : m.text_color || '#ffffff';
                const locked = m.locked;
                return (
                  <button
                    type="button"
                    key={`${m.display_name}-${m.id ?? 'pending'}`}
                    className={`ds-search-select__token ds-search-select__token-button${locked ? ' is-locked' : ''}`}
                    onClick={() => {
                      if (!locked) removeMember(m.display_name);
                    }}
                    title={
                      locked
                        ? 'You are automatically included and cannot be removed'
                        : 'Click to remove'
                    }
                    style={{ background: bg, color: fg, borderRadius: '999px', borderColor: bg }}
                  >
                    <UserPill
                      name={m.display_name}
                      size="sm"
                      color={bg}
                      textColor={fg}
                      hoverIcon={
                        !locked ? (
                          <span className="material-symbols-outlined" aria-hidden="true">
                            &#xe5c9;
                          </span>
                        ) : undefined
                      }
                      className={`${m.isPending || !m.id ? 'user-pill--pending' : ''} user-pill--inline`}
                    />
                  </button>
                );
              })}
            />
          </InputContainer>

          {localError && <Alert variant="error" message={localError} />}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              width: '100%',
            }}
          >
            <button className="btn btn--primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Registering...' : 'Submit'}
            </button>
          </div>
        </Stack>
      </div>
    </div>
  );
}
