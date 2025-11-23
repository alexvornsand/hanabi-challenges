import { useParams, Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
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
  const { teams, loading: teamsLoading, error: teamsError } = useEventTeams(slug);
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
      <main className="p-4">
        <h1 className="text-xl font-semibold mb-2">Event not found</h1>
      </main>
    );
  }

  const startsAt = event.starts_at ? new Date(event.starts_at) : null;
  const endsAt = event.ends_at ? new Date(event.ends_at) : null;

  return (
    <main className="p-4 space-y-4">
      <header>
        <h1 className="text-2xl font-bold">{event.name}</h1>

        {event.short_description && (
          <p className="text-gray-700 mt-1">{event.short_description}</p>
        )}

        <p className="text-sm text-gray-500 mt-1">
          Slug: <code>{event.slug}</code>
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

      {event.long_description && (
        <section className="prose max-w-none">
          {event.long_description.split('\n\n').map((block, idx) => (
            <p key={idx}>{block}</p>
          ))}
        </section>
      )}

      <section className="mt-6 border-t pt-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Game templates, teams, and results summary will appear here later.
          </p>
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white font-semibold"
            onClick={() => {
              setRegisterMessage(null);
              setRegisterError(null);
              setShowRegister(true);
            }}
          >
            Register a team
          </button>
        </div>
      </section>

      <section className="mt-6 border-t pt-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-700 font-medium">Player count:</span>
          {[2, 3, 4, 5, 6].map((size) => {
            const isActive = parsedTeamSize === size;
            const target =
              size === 3 ? `/events/${event.slug}` : `/events/${event.slug}/${size}`;

            return (
              <Link
                key={size}
                to={target}
                className={`px-3 py-1 rounded-full border text-sm ${
                  isActive
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                }`}
              >
                {size}p{size === 3 ? ' (default)' : ''}
              </Link>
            );
          })}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2">Teams ({parsedTeamSize} players)</h2>

          {teamsLoading && <p>Loading teams...</p>}
          {teamsError && <p className="text-red-600">{teamsError}</p>}

          {!teamsLoading && !teamsError && (
            <>
              {teams.filter((t) => t.team_size === parsedTeamSize).length === 0 ? (
                <p className="text-gray-600">No teams found for this player count yet.</p>
              ) : (
                <ul className="space-y-2">
                  {teams
                    .filter((t) => t.team_size === parsedTeamSize)
                    .map((team) => (
                      <li
                        key={team.id}
                        className="border rounded-md px-3 py-2 bg-white/70 backdrop-blur-sm"
                      >
                        <div className="flex items-center justify-between">
                          <Link
                            to={`/events/${event.slug}/teams/${team.id}`}
                            className="font-medium text-blue-700 hover:underline"
                          >
                            {team.name}
                          </Link>
                          <span className="text-xs text-gray-500 uppercase tracking-wide">
                            {team.team_size}p team
                          </span>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      {showRegister && (
        <RegisterModal
          eventSlug={event.slug}
          eventName={event.name}
          auth={auth}
          directory={directory}
          memberships={memberships}
          onClose={() => setShowRegister(false)}
          onSuccess={(msg) => setRegisterMessage(msg)}
          onError={(msg) => setRegisterError(msg)}
        />
      )}

      {(registerMessage || registerError) && (
        <div className="border rounded-md p-3 bg-white/70">
          {registerMessage && <p className="text-green-700">{registerMessage}</p>}
          {registerError && <p className="text-red-600">{registerError}</p>}
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
  auth,
  directory,
  memberships,
  onClose,
  onSuccess,
  onError,
}: RegisterModalProps) {
  const user = auth.user;
  const [teamName, setTeamName] = useState(() => (user ? `${user.display_name}'s Team` : ''));
  const [teamSize, setTeamSize] = useState(3);
  const [memberInput, setMemberInput] = useState('');
  const [saving, setSaving] = useState(false);

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
  };

  const handleAddMemberInput = () => {
    const name = memberInput.trim();
    if (!name) return;
    const existing = directory.find((u) => u.display_name.toLowerCase() === name.toLowerCase());
    if (existing && !members.some((m) => m.id === existing.id)) {
      if (conflictsBySize.get(teamSize)?.has(existing.id)) {
        onError(`${existing.display_name} is already on a ${teamSize}p team for this event.`);
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
    if (!teamName.trim()) {
      onError('Team name is required.');
      return;
    }
    if (members.length === 0) {
      onError('Add at least one member.');
      return;
    }
    if (!auth.token) {
      onError('Not authenticated.');
      return;
    }
    setSaving(true);
    onError(null);
    try {
      const payload = {
        team_name: teamName.trim(),
        team_size: teamSize,
        members: members.map((m) =>
          m.id
            ? { user_id: m.id, role: 'PLAYER' }
            : { display_name: m.display_name, role: 'PLAYER' },
        ),
      };
      await postJsonAuth(`/events/${eventSlug}/register`, auth.token, payload);
      onSuccess('Team registered!');
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        onError((err.body as { error?: string })?.error ?? 'Failed to register team.');
      } else {
        onError('Failed to register team.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-4 space-y-4 max-w-2xl w-full">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Register for {eventName}</h2>
            <p className="text-sm text-gray-600">Create a team and invite members.</p>
          </div>
          <button onClick={onClose} className="text-gray-600">
            ✕
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Team name</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Team size</label>
          <select
            className="border rounded px-3 py-2"
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

        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Members</label>
          <div className="border rounded px-2 py-2 flex flex-wrap gap-2 items-center">
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
              }}
            />
          </div>

          {suggestions.length > 0 && (
            <div className="border rounded p-2 bg-white shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Suggestions</p>
              <div className="flex flex-wrap gap-1">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    className="border rounded px-2 py-1 text-sm bg-white hover:bg-blue-50"
                    onClick={() =>
                      addMember({
                        id: s.id,
                        display_name: s.display_name,
                        color_hex: s.color_hex,
                        text_color: s.text_color,
                        role: 'PLAYER',
                      })
                    }
                  >
                    {s.display_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-600">
            The logged-in user is added automatically and cannot be removed.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button className="px-3 py-2 rounded border" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded bg-blue-600 text-white font-semibold disabled:opacity-60"
            onClick={handleSubmit}
            disabled={saving}
          >
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
  return (
    <div className="flex items-center gap-1 border rounded-full pl-2 pr-1 py-1 bg-white shadow-sm">
      <UserPill
        name={member.display_name}
        color={pillBg}
        textColor={pillFg}
        className={member.isPending ? 'italic' : ''}
      />
      {!member.locked && (
        <button
          className="text-xs text-red-600 px-2 py-0.5 rounded-full hover:bg-red-50"
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </div>
  );
}
