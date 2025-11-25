import { useEffect, useState } from 'react';
import { ApiError, getJson } from '../lib/api';

export type TeamMember = {
  id: number;
  event_team_id: number;
  user_id: number;
  role: 'PLAYER' | 'STAFF';
  is_listed: boolean;
  created_at: string;
  display_name: string;
  color_hex: string;
  text_color: string;
};

export type TeamGame = {
  id: number;
  event_game_template_id: number;
  game_id: number | null;
  score: number;
  zero_reason: string | null;
  bottom_deck_risk: number | null;
  notes: string | null;
  played_at: string;
  event_stage_id: number;
  stage_index: number;
  stage_label: string;
  stage_type: 'SINGLE' | 'ROUND_ROBIN' | 'BRACKET' | 'GAUNTLET';
  template_index: number;
  variant: string;
  players: {
    display_name: string;
    color_hex: string;
    text_color: string;
  }[];
};

export type TeamDetail = {
  team: {
    id: number;
    event_id: number;
    name: string;
    team_size: number;
    created_at: string;
    event_slug: string;
    event_name: string;
    table_password?: string | null;
    owner_user_id?: number | null;
  };
  members: TeamMember[];
  games: TeamGame[];
};

type State = {
  data: TeamDetail | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
};

export function useTeamDetail(teamId: number | null | undefined) {
  const [state, setState] = useState<State>(() =>
    teamId == null
      ? { data: null, loading: false, error: 'No team specified', notFound: false }
      : { data: null, loading: true, error: null, notFound: false },
  );

  useEffect(() => {
    if (teamId == null) return;

    let cancelled = false;

    async function fetchTeam() {
      setState((prev) => ({ ...prev, loading: true, error: null, notFound: false }));

      try {
        const data = await getJson<TeamDetail>(`/event-teams/${teamId}`);

        if (!cancelled) {
          setState({ data, loading: false, error: null, notFound: false });
        }
      } catch (err) {
        if (cancelled) return;

        if (err instanceof ApiError && err.status === 404) {
          setState({ data: null, loading: false, error: null, notFound: true });
        } else {
          console.error('Failed to load team detail', err);
          setState({
            data: null,
            loading: false,
            error: 'Failed to load team. Please try again.',
            notFound: false,
          });
        }
      }
    }

    fetchTeam();

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const refetch = async () => {
    if (teamId == null) return;
    setState((prev) => ({ ...prev, loading: true, error: null, notFound: false }));
    try {
      const data = await getJson<TeamDetail>(`/event-teams/${teamId}`);
      setState({ data, loading: false, error: null, notFound: false });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setState({ data: null, loading: false, error: null, notFound: true });
      } else {
        console.error('Failed to load team detail', err);
        setState({
          data: null,
          loading: false,
          error: 'Failed to load team. Please try again.',
          notFound: false,
        });
      }
    }
  };

  return { ...state, refetch };
}
