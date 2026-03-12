-- Daily missions table
CREATE TABLE public.daily_missions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  mission_type text NOT NULL, -- 'answer_questions', 'study_minutes', 'correct_streak'
  target_value integer NOT NULL DEFAULT 10,
  current_value integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date, mission_type)
);

ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_missions_read" ON public.daily_missions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "daily_missions_write" ON public.daily_missions
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);