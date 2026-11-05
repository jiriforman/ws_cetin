import { useCallback, useEffect, useRef, useState } from 'react';
import { negotiationApi } from '@/lib/api';
import type { TeamState } from '@/lib/negotiation';

const POLL_MS = 5_000;

/** Team state for the Negotiation Room, polled so all teammates see the same counters and deal. */
export const useNegotiationState = (token: string | undefined) => {
  const [state, setState] = useState<TeamState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const next = await negotiationApi<TeamState>('state', token);
      if (!alive.current) return;
      setState(next);
      setError(null);
    } catch (err) {
      if (!alive.current) return;
      setError(err instanceof Error ? err.message : 'Could not load');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [refresh]);

  return { state, error, loading, refresh, setState };
};
