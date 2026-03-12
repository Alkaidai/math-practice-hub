import { useEffect, useRef } from 'react';
import { subscribeVisibilityChange } from '../lib/visibility';

/**
 * Calls `onVisible` when the browser tab becomes visible again.
 * Uses a single global visibility listener to avoid duplicated listeners.
 */
export function useVisibilityRefresh(onVisible: () => void, minHiddenMs = 0) {
  const callbackRef = useRef(onVisible);
  callbackRef.current = onVisible;

  useEffect(() => {
    const thresholdMs = Math.max(0, minHiddenMs);

    return subscribeVisibilityChange(({ state, hiddenDurationMs }) => {
      if (state !== 'visible') return;
      if (hiddenDurationMs >= thresholdMs) {
        callbackRef.current();
      }
    });
  }, [minHiddenMs]);
}
