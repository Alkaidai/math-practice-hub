import { useEffect, useRef } from 'react';
import { subscribeVisibilityChange } from '../lib/visibility';
import { useAuth } from '../contexts/AuthContext';

/**
 * Calls `onVisible` when the browser tab becomes visible again,
 * AFTER auth token refresh has completed (preventing auth lock contention).
 *
 * @param onVisible - callback to execute when tab becomes visible
 * @param minHiddenMs - minimum hidden duration (ms) to trigger refresh. Default: 30_000 (30s)
 */
export function useVisibilityRefresh(onVisible: () => void, minHiddenMs = 30_000) {
  const callbackRef = useRef(onVisible);
  callbackRef.current = onVisible;

  const { waitForAuthReady } = useAuth();
  const waitRef = useRef(waitForAuthReady);
  waitRef.current = waitForAuthReady;

  useEffect(() => {
    const thresholdMs = Math.max(0, minHiddenMs);

    return subscribeVisibilityChange(async ({ state, hiddenDurationMs }) => {
      if (state !== 'visible') return;
      if (hiddenDurationMs < thresholdMs) {
        console.log(`[VisibilityRefresh] hidden ${Math.round(hiddenDurationMs / 1000)}s < threshold ${thresholdMs / 1000}s — skipping`);
        return;
      }

      console.log(`[VisibilityRefresh] hidden ${Math.round(hiddenDurationMs / 1000)}s >= threshold ${thresholdMs / 1000}s — waiting for auth...`);
      // Wait for auth token refresh to complete before fetching data
      try {
        await waitRef.current();
        console.log('[VisibilityRefresh] auth ready — calling refresh callback');
      } catch {
        console.warn('[VisibilityRefresh] auth wait failed — calling refresh callback anyway');
      }

      callbackRef.current();
    });
  }, [minHiddenMs]);
}
