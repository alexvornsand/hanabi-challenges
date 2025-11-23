import { useEffect, useState } from 'react';
import { ApiError, getJson } from '../lib/api';

export type EventTeam = {
  id: number;
  event_id: number;
  name: string;
  created_at: string;
  team_size: number;
};

type State = {
  teams: EventTeam[];
  loading: boolean;
  error: string | null;
};

export function useEventTeams(slug: string | undefined) {
  const [state, setState] = useState<State>(() =>
    !slug
      ? { teams: [], loading: false, error: 'No event specified' }
      : { teams: [], loading: true, error: null },
  );

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    async function fetchTeams() {
      setState({ teams: [], loading: true, error: null });

      try {
        const encodedSlug = encodeURIComponent(slug);
        const data = await getJson<EventTeam[]>(`/events/${encodedSlug}/teams`);

        if (!cancelled) {
          setState({ teams: data, loading: false, error: null });
        }
      } catch (err) {
        if (cancelled) return;

        const message =
          err instanceof ApiError ? 'Failed to load teams. Please try again.' : 'Unexpected error';

        console.error('Failed to load event teams', err);
        setState({ teams: [], loading: false, error: message });
      }
    }

    fetchTeams();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  return state;
}
