import { useEffect, useState } from 'react';
import { ApiError, getJson } from '../lib/api';

export type TeamTemplate = {
  stage_index: number;
  stage_label: string;
  stage_type: string;
  template_id: number;
  template_index: number;
  variant: string;
  seed_payload: string | null;
  result: {
    id: number;
    score: number;
    zero_reason: string | null;
    bottom_deck_risk: number | null;
    notes: string | null;
    played_at: string;
    hanab_game_id: number | null;
  } | null;
};

type State = {
  templates: TeamTemplate[];
  loading: boolean;
  error: string | null;
};

export function useTeamTemplates(teamId: number | null | undefined) {
  const [state, setState] = useState<State>(() =>
    teamId == null ? { templates: [], loading: false, error: 'No team specified' } : { templates: [], loading: true, error: null },
  );

  useEffect(() => {
    if (teamId == null) return;
    let cancelled = false;

    async function fetchTemplates() {
      setState({ templates: [], loading: true, error: null });
      try {
        const data = await getJson<{ templates: TeamTemplate[] }>(`/event-teams/${teamId}/templates`);
        if (!cancelled) {
          setState({ templates: data.templates, loading: false, error: null });
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof ApiError ? 'Failed to load games' : 'Unexpected error';
        setState({ templates: [], loading: false, error: msg });
      }
    }

    fetchTemplates();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return state;
}
