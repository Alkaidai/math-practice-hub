import { useState, useCallback, useRef, useEffect } from 'react';

const DEFAULT_TIMEOUT_MS = 12000; // 12 seconds
const MAX_RETRIES = 1;
// Safety: absolute max time before force-ending loading state
const ABSOLUTE_MAX_MS = 20000;

interface UseLoadWithTimeoutOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

interface UseLoadWithTimeoutReturn {
  loading: boolean;
  error: string | null;
  timedOut: boolean;
  execute: (fn: () => Promise<void>) => Promise<void>;
  reset: () => void;
}

export function useLoadWithTimeout(options: UseLoadWithTimeoutOptions = {}): UseLoadWithTimeoutReturn {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = MAX_RETRIES } = options;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const mountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const executingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    
    // Safety: if loading is still true after ABSOLUTE_MAX_MS and no execute is running,
    // force end loading to prevent infinite loading states
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current && loading && !executingRef.current) {
        setLoading(false);
        setTimedOut(true);
        setError('Não foi possível carregar os dados. Verifique sua conexão.');
      }
    }, ABSOLUTE_MAX_MS);

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimer);
    };
  }, [loading]);

  const execute = useCallback(async (fn: () => Promise<void>) => {
    if (!mountedRef.current) return;
    executingRef.current = true;
    setLoading(true);
    setError(null);
    setTimedOut(false);

    const attempt = async (): Promise<void> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        await Promise.race([
          fn(),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener('abort', () =>
              reject(new Error('TIMEOUT'))
            );
          }),
        ]);
        if (mountedRef.current) {
          retryCountRef.current = 0;
          setLoading(false);
          setError(null);
        }
      } catch (err: any) {
        if (!mountedRef.current) return;

        const isTimeout = err?.message === 'TIMEOUT';
        const isAuthError = err?.status === 401 || err?.status === 403 ||
          err?.message?.includes('JWT') || err?.message?.includes('token') ||
          err?.message?.includes('refresh_token');

        if (isAuthError) {
          setLoading(false);
          setError('session_expired');
          return;
        }

        if (retryCountRef.current < maxRetries) {
          retryCountRef.current += 1;
          clearTimeout(timer);
          return attempt();
        }

        setLoading(false);
        setTimedOut(isTimeout);
        setError(isTimeout
          ? 'Não foi possível carregar os dados. Verifique sua conexão.'
          : 'Ocorreu um erro ao carregar os dados.');
      } finally {
        clearTimeout(timer);
        executingRef.current = false;
      }
    };

    retryCountRef.current = 0;
    await attempt();
  }, [timeoutMs, maxRetries]);

  const reset = useCallback(() => {
    retryCountRef.current = 0;
    executingRef.current = false;
    setLoading(true);
    setError(null);
    setTimedOut(false);
  }, []);

  return { loading, error, timedOut, execute, reset };
}
