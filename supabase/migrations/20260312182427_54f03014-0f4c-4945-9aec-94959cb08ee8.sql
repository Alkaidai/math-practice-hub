
-- Create user_sessions table for tracking study sessions
CREATE TABLE public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  start_time timestamptz NOT NULL DEFAULT now(),
  last_activity timestamptz NOT NULL DEFAULT now(),
  end_time timestamptz,
  duration_seconds integer DEFAULT 0
);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_sessions_read" ON public.user_sessions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "user_sessions_write" ON public.user_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Create daily_study_stats table
CREATE TABLE public.daily_study_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  total_seconds integer NOT NULL DEFAULT 0,
  questions_answered integer NOT NULL DEFAULT 0,
  UNIQUE(user_id, date)
);

ALTER TABLE public.daily_study_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_study_stats_read" ON public.daily_study_stats FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "daily_study_stats_write" ON public.daily_study_stats FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Add tracking columns to existing attempts table
ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS time_spent_seconds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS possible_guess boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS difficulty_detected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS question_abandoned boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS question_skipped boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS attempt_number integer DEFAULT 1;
