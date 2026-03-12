import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { subscribeVisibilityChange } from '../lib/visibility';
import { useAuth } from '../contexts/AuthContext';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds

/**
 * Tracks user study sessions.
 * - Creates a session on mount
 * - Updates last_activity on user interactions
 * - Auto-ends session after inactivity
 * - Ends session on unmount / tab close
 * - Waits for auth readiness before starting sessions on tab return
 */
export function useSessionTracker(userId: string | null) {
  const { waitForAuthReady } = useAuth();
  const waitForAuthRef = useRef(waitForAuthReady);
  waitForAuthRef.current = waitForAuthReady;

  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startingSessionRef = useRef<Promise<void> | null>(null);

  const stopInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
      console.log('[SessionTracker] inactivity timer cleared');
    }
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  const endSession = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;

    console.log('[SessionTracker] endSession called, sid:', sid);
    sessionIdRef.current = null;
    startingSessionRef.current = null;

    const now = new Date();
    const durationSeconds = Math.round((now.getTime() - startTimeRef.current) / 1000);

    try {
      await supabase.from('user_sessions').update({
        end_time: now.toISOString(),
        last_activity: new Date(lastActivityRef.current).toISOString(),
        duration_seconds: durationSeconds,
      } as any).eq('id', sid);

      if (userId && durationSeconds > 0) {
        const today = now.toISOString().split('T')[0];
        const { data: existing } = await supabase
          .from('daily_study_stats')
          .select('total_seconds')
          .eq('user_id', userId)
          .eq('date', today)
          .single();

        if (existing) {
          await supabase.from('daily_study_stats')
            .update({ total_seconds: (existing as any).total_seconds + durationSeconds } as any)
            .eq('user_id', userId)
            .eq('date', today);
        } else {
          await supabase.from('daily_study_stats')
            .insert({ user_id: userId, date: today, total_seconds: durationSeconds, questions_answered: 0 } as any);
        }
      }
    } catch {
      // Best effort
    }
  }, [userId]);

  const startSession = useCallback(async () => {
    if (!userId || sessionIdRef.current) return;
    if (startingSessionRef.current) {
      console.log('[SessionTracker] startSession already in progress, waiting...');
      await startingSessionRef.current;
      return;
    }
    console.log('[SessionTracker] startSession called');

    const run = (async () => {
      const now = new Date();
      startTimeRef.current = now.getTime();
      lastActivityRef.current = now.getTime();

      try {
        const { data } = await supabase.from('user_sessions')
          .insert({ user_id: userId, start_time: now.toISOString(), last_activity: now.toISOString() } as any)
          .select('id')
          .single();

        if (data) {
          sessionIdRef.current = (data as any).id;
        }
      } catch {
        // Best effort
      } finally {
        startingSessionRef.current = null;
      }
    })();

    startingSessionRef.current = run;
    await run;
  }, [userId]);

  const resetInactivityTimer = useCallback(() => {
    stopInactivityTimer();
    inactivityTimerRef.current = setTimeout(() => {
      void endSession();
    }, INACTIVITY_TIMEOUT_MS);
  }, [endSession, stopInactivityTimer]);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();

    heartbeatTimerRef.current = setInterval(async () => {
      const sid = sessionIdRef.current;
      if (!sid) return;

      try {
        await supabase.from('user_sessions')
          .update({ last_activity: new Date(lastActivityRef.current).toISOString() } as any)
          .eq('id', sid);
      } catch {
        // Best effort
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [stopHeartbeat]);

  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    resetInactivityTimer();
  }, [resetInactivityTimer]);

  const recordQuestionAnswered = useCallback(async () => {
    if (!userId) return;

    recordActivity();
    const today = new Date().toISOString().split('T')[0];

    try {
      const { data: existing } = await supabase
        .from('daily_study_stats')
        .select('questions_answered')
        .eq('user_id', userId)
        .eq('date', today)
        .single();

      if (existing) {
        await supabase.from('daily_study_stats')
          .update({ questions_answered: (existing as any).questions_answered + 1 } as any)
          .eq('user_id', userId)
          .eq('date', today);
      } else {
        await supabase.from('daily_study_stats')
          .insert({ user_id: userId, date: today, total_seconds: 0, questions_answered: 1 } as any);
      }
    } catch {
      // Best effort
    }
  }, [userId, recordActivity]);

  useEffect(() => {
    if (!userId) return;

    let alive = true;

    void startSession().then(() => {
      if (!alive) return;
      startHeartbeat();
      resetInactivityTimer();
    });

    const events = ['click', 'keydown', 'scroll', 'touchstart'] as const;
    const handler = () => recordActivity();
    events.forEach(e => document.addEventListener(e, handler, { passive: true }));

    const unsubscribeVisibility = subscribeVisibilityChange(async ({ state }) => {
      if (state === 'hidden') {
        stopHeartbeat();
        stopInactivityTimer();
        void endSession();
        return;
      }

      // Tab became visible — wait for auth refresh before starting session
      try {
        await waitForAuthRef.current();
      } catch {
        // Continue even if auth refresh fails
      }

      if (!alive) return;

      lastActivityRef.current = Date.now();
      void startSession().then(() => {
        if (!alive) return;
        startHeartbeat();
        resetInactivityTimer();
      });
    });

    const handleUnload = () => {
      const sid = sessionIdRef.current;
      if (!sid || !userId) return;

      const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      const body = JSON.stringify({
        end_time: new Date().toISOString(),
        last_activity: new Date(lastActivityRef.current).toISOString(),
        duration_seconds: durationSeconds,
      });

      navigator.sendBeacon?.(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${sid}`,
        new Blob([body], { type: 'application/json' }),
      );
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      alive = false;
      events.forEach(e => document.removeEventListener(e, handler));
      unsubscribeVisibility();
      window.removeEventListener('beforeunload', handleUnload);
      stopInactivityTimer();
      stopHeartbeat();
      void endSession();
    };
  }, [userId, startSession, endSession, recordActivity, resetInactivityTimer, startHeartbeat, stopInactivityTimer, stopHeartbeat]);

  return { recordActivity, recordQuestionAnswered };
}
