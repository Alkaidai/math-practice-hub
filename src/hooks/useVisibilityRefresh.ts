import { useEffect, useRef } from 'react';

/**
 * Calls `onVisible` when the browser tab regains focus after being hidden,
 * but only if it's been hidden for at least `minHiddenMs` (default 60s).
 */
export function useVisibilityRefresh(onVisible: () => void, minHiddenMs = 60_000) {
  const hiddenAtRef = useRef<number | null>(null);
  const callbackRef = useRef(onVisible);
  callbackRef.current = onVisible;

  useEffect(() => {
    function handler() {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
      } else if (document.visibilityState === 'visible' && hiddenAtRef.current) {
        const elapsed = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (elapsed >= minHiddenMs) {
          callbackRef.current();
        }
      }
    }
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [minHiddenMs]);
}
