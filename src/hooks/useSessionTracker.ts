import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds

/**
 * Tracks user study sessions.
 * - Creates a session on mount
 * - Updates last_activity on user interactions
 * - Auto-ends session after 5min inactivity
 * - Ends session on unmount / tab close
 */
export function useSessionTracker(userId: string | null) {
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const endSession = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    sessionIdRef.current = null;

    const now = new Date();
    const durationSeconds = Math.round((now.getTime() - startTimeRef.current) / 1000);

    try {
      await supabase.from('user_sessions').update({
        end_time: now.toISOString(),
        last_activity: new Date(lastActivityRef.current).toISOString(),
        duration_seconds: durationSeconds,
      } as any).eq('id', sid);

      // Update daily study stats
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
      // Best effort - don't block UI
    }
  }, [userId]);

  const startSession = useCallback(async () => {
    if (!userId || sessionIdRef.current) return;

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
    }
  }, [userId]);

  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();

    // Reset inactivity timer
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(async () => {
      await endSession();
      // Start a new session when activity resumes
    }, INACTIVITY_TIMEOUT_MS);
  }, [endSession]);

  // Increment daily questions count
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

    startSession();

    // Listen to user interactions for activity tracking
    const events = ['click', 'keydown', 'scroll', 'touchstart'] as const;
    const handler = () => recordActivity();
    events.forEach(e => document.addEventListener(e, handler, { passive: true }));

    // Start inactivity timer
    inactivityTimerRef.current = setTimeout(() => {
      endSession();
    }, INACTIVITY_TIMEOUT_MS);

    // Heartbeat: periodically update last_activity in DB
    heartbeatTimerRef.current = setInterval(async () => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      try {
        await supabase.from('user_sessions')
          .update({ last_activity: new Date(lastActivityRef.current).toISOString() } as any)
          .eq('id', sid);
      } catch { /* best effort */ }
    }, HEARTBEAT_INTERVAL_MS);

    // Visibility change: end session when hidden, start new when visible
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        endSession();
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      } else {
        startSession();
        inactivityTimerRef.current = setTimeout(() => endSession(), INACTIVITY_TIMEOUT_MS);
        heartbeatTimerRef.current = setInterval(async () => {
          const sid = sessionIdRef.current;
          if (!sid) return;
          try {
            await supabase.from('user_sessions')
              .update({ last_activity: new Date(lastActivityRef.current).toISOString() } as any)
              .eq('id', sid);
          } catch { /* best effort */ }
        }, HEARTBEAT_INTERVAL_MS);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // End session on page unload
    const handleUnload = () => {
      const sid = sessionIdRef.current;
      if (!sid || !userId) return;
      const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
      const body = JSON.stringify({
        end_time: new Date().toISOString(),
        last_activity: new Date(lastActivityRef.current).toISOString(),
        duration_seconds: durationSeconds,
      });
      // Use sendBeacon for reliability on page close
      navigator.sendBeacon?.(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_sessions?id=eq.${sid}`,
        new Blob([body], { type: 'application/json' })
      );
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      events.forEach(e => document.removeEventListener(e, handler));
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      endSession();
    };
  }, [userId, startSession, endSession, recordActivity]);

  return { recordActivity, recordQuestionAnswered };
}
