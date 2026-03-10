
-- 1. Create subjects table
CREATE TABLE public.subjects (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  slug text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subjects_read" ON public.subjects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "subjects_write" ON public.subjects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. Add plan_type and payment_source to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payment_source text DEFAULT NULL;
