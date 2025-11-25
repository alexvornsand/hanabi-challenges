import { useEffect, useState } from 'react';
import { getJson, ApiError } from '../lib/api';

export type EventSummary = {
  id: number;
  slug: string;
  name: string;
  short_description: string | null;
  long_description: string;
  published: boolean;
  allow_late_registration: boolean;
  registration_cutoff: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

type State = {
  events: EventSummary[];
  loading: boolean;
  error: string | null;
};

export function useEvents() {
  const [state, setState] = useState<State>({
    events: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const data = await getJson<EventSummary[]>('/events');

        if (!cancelled) {
          setState({
            events: data,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (cancelled) return;

        const errorMessage =
          err instanceof ApiError ? 'Failed to load events. Please try again.' : 'Unexpected error';

        console.error('Failed to load events', err);
        setState({
          events: [],
          loading: false,
          error: errorMessage,
        });
      }
    }

    fetchEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
