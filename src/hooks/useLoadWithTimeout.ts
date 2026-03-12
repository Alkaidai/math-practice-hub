import { useState, useCallback, useRef, useEffect } from 'react';

const DEFAULT_TIMEOUT_MS = 12000; // 12 seconds
const MAX_RETRIES = 1;
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

const TIMEOUT_MESSAGE = 'Não foi possível carregar os dados. Verifique sua conexão.';
const GENERIC_MESSAGE = 'Ocorreu um erro ao carregar os dados.';

function isAuthError(err: any): boolean {
  return (
    err?.status === 401 ||
    err?.status === 403 ||
    err?.message?.includes('JWT') ||
    err?.message?.includes('token') ||
    err?.message?.includes('refresh_token')
  );
}

function withTimeout(task: () => Promise<void>, timeoutMs: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);

    Promise.resolve()
      .then(task)
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

export function useLoadWithTimeout(options: UseLoadWithTimeoutOptions = {}): UseLoadWithTimeoutReturn {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = MAX_RETRIES } = options;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  const finishRequest = useCallback((requestId: number, next: { loading: boolean; error: string | null; timedOut: boolean }) => {
    if (!mountedRef.current) return;
    if (requestId !== requestIdRef.current) return;

    clearSafetyTimer();
    setLoading(next.loading);
    setError(next.error);
    setTimedOut(next.timedOut);
  }, [clearSafetyTimer]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearSafetyTimer();
    };
  }, [clearSafetyTimer]);

  const execute = useCallback(async (fn: () => Promise<void>) => {
    if (!mountedRef.current) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setLoading(true);
    setError(null);
    setTimedOut(false);

    clearSafetyTimer();
    safetyTimerRef.current = setTimeout(() => {
      finishRequest(requestId, { loading: false, error: TIMEOUT_MESSAGE, timedOut: true });
    }, ABSOLUTE_MAX_MS);

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        await withTimeout(fn, timeoutMs);
        finishRequest(requestId, { loading: false, error: null, timedOut: false });
        return;
      } catch (err: any) {
        if (!mountedRef.current || requestId !== requestIdRef.current) return;

        if (isAuthError(err)) {
          finishRequest(requestId, { loading: false, error: 'session_expired', timedOut: false });
          return;
        }

        const isLastAttempt = attempt >= maxRetries;
        if (!isLastAttempt) continue;

        const timeoutError = err?.message === 'TIMEOUT';
        finishRequest(requestId, {
          loading: false,
          error: timeoutError ? TIMEOUT_MESSAGE : GENERIC_MESSAGE,
          timedOut: timeoutError,
        });
        return;
      }
    }
  }, [clearSafetyTimer, finishRequest, maxRetries, timeoutMs]);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    clearSafetyTimer();
    setLoading(true);
    setError(null);
    setTimedOut(false);
  }, [clearSafetyTimer]);

  return { loading, error, timedOut, execute, reset };
}
