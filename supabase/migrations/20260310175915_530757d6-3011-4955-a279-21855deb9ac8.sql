
-- Add ranking_visible column to profiles for individual ranking control
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ranking_visible boolean NOT NULL DEFAULT true;

-- Drop all existing RESTRICTIVE policies and recreate as PERMISSIVE

-- app_settings: public read, admin write (keep open for now)
DROP POLICY IF EXISTS "settings_read" ON public.app_settings;
DROP POLICY IF EXISTS "settings_write" ON public.app_settings;
CREATE POLICY "settings_read" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "settings_write" ON public.app_settings FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- profiles: everyone can read, write open for admin operations
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_write" ON public.profiles;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "profiles_write" ON public.profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- questions: everyone can read, write open
DROP POLICY IF EXISTS "questions_read" ON public.questions;
DROP POLICY IF EXISTS "questions_write" ON public.questions;
CREATE POLICY "questions_read" ON public.questions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "questions_write" ON public.questions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- topics: everyone can read/write
DROP POLICY IF EXISTS "topics_read" ON public.topics;
DROP POLICY IF EXISTS "topics_write" ON public.topics;
CREATE POLICY "topics_read" ON public.topics FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "topics_write" ON public.topics FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- lessons: everyone can read/write
DROP POLICY IF EXISTS "lessons_read" ON public.lessons;
DROP POLICY IF EXISTS "lessons_write" ON public.lessons;
CREATE POLICY "lessons_read" ON public.lessons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "lessons_write" ON public.lessons FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- comments: everyone can read, insert
DROP POLICY IF EXISTS "comments_read" ON public.comments;
DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_read" ON public.comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "comments_insert" ON public.comments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "comments_update" ON public.comments FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- replies: everyone can read, insert
DROP POLICY IF EXISTS "replies_read" ON public.replies;
DROP POLICY IF EXISTS "replies_insert" ON public.replies;
CREATE POLICY "replies_read" ON public.replies FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "replies_insert" ON public.replies FOR INSERT TO anon, authenticated WITH CHECK (true);

-- reports: everyone can read/write
DROP POLICY IF EXISTS "reports_read" ON public.reports;
DROP POLICY IF EXISTS "reports_write" ON public.reports;
CREATE POLICY "reports_read" ON public.reports FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "reports_write" ON public.reports FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- attempts: everyone can read (needed for ranking), insert
DROP POLICY IF EXISTS "attempts_read" ON public.attempts;
DROP POLICY IF EXISTS "attempts_insert" ON public.attempts;
CREATE POLICY "attempts_read" ON public.attempts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "attempts_insert" ON public.attempts FOR INSERT TO anon, authenticated WITH CHECK (true);

-- notebook_items: everyone can read/write (filtered in code by user_id)
DROP POLICY IF EXISTS "notebook_read" ON public.notebook_items;
DROP POLICY IF EXISTS "notebook_write" ON public.notebook_items;
CREATE POLICY "notebook_read" ON public.notebook_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "notebook_write" ON public.notebook_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- dashboard_meta: everyone can read/write
DROP POLICY IF EXISTS "dashboard_meta_read" ON public.dashboard_meta;
DROP POLICY IF EXISTS "dashboard_meta_write" ON public.dashboard_meta;
CREATE POLICY "dashboard_meta_read" ON public.dashboard_meta FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "dashboard_meta_write" ON public.dashboard_meta FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- diagnostic_results: everyone can read/write
DROP POLICY IF EXISTS "diagnostic_read" ON public.diagnostic_results;
DROP POLICY IF EXISTS "diagnostic_write" ON public.diagnostic_results;
CREATE POLICY "diagnostic_read" ON public.diagnostic_results FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "diagnostic_write" ON public.diagnostic_results FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- training_plans: everyone can read/write
DROP POLICY IF EXISTS "training_plans_read" ON public.training_plans;
DROP POLICY IF EXISTS "training_plans_write" ON public.training_plans;
CREATE POLICY "training_plans_read" ON public.training_plans FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "training_plans_write" ON public.training_plans FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
