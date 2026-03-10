
-- Add topic_id column to attempts table
ALTER TABLE public.attempts ADD COLUMN IF NOT EXISTS topic_id text;

-- Create app_settings table for admin controls
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_read" ON public.app_settings FOR SELECT TO anon USING (true);
CREATE POLICY "settings_write" ON public.app_settings FOR ALL TO anon USING (true) WITH CHECK (true);

-- Create diagnostic_results table
CREATE TABLE IF NOT EXISTS public.diagnostic_results (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  total_questions integer NOT NULL DEFAULT 0,
  correct_answers integer NOT NULL DEFAULT 0,
  accuracy_rate numeric(5,2) NOT NULL DEFAULT 0,
  topic_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(user_id)
);

ALTER TABLE public.diagnostic_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "diagnostic_read" ON public.diagnostic_results FOR SELECT TO anon USING (true);
CREATE POLICY "diagnostic_write" ON public.diagnostic_results FOR ALL TO anon USING (true) WITH CHECK (true);

-- Insert default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('ranking_visible', '"true"'::jsonb),
  ('diagnostic_enabled', '"true"'::jsonb),
  ('diagnostic_mandatory', '"true"'::jsonb),
  ('diagnostic_results_visible', '"true"'::jsonb)
ON CONFLICT (key) DO NOTHING;
