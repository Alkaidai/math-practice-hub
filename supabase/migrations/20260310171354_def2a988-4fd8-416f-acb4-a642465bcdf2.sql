
-- Drop ALL existing restrictive policies and recreate as explicitly PERMISSIVE

-- app_settings
DROP POLICY IF EXISTS settings_read ON public.app_settings;
DROP POLICY IF EXISTS settings_write ON public.app_settings;
CREATE POLICY settings_read ON public.app_settings AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY settings_write ON public.app_settings AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- attempts
DROP POLICY IF EXISTS attempts_read ON public.attempts;
DROP POLICY IF EXISTS attempts_insert ON public.attempts;
CREATE POLICY attempts_read ON public.attempts AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY attempts_insert ON public.attempts AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);

-- comments
DROP POLICY IF EXISTS comments_read ON public.comments;
DROP POLICY IF EXISTS comments_insert ON public.comments;
CREATE POLICY comments_read ON public.comments AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY comments_insert ON public.comments AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);

-- dashboard_meta
DROP POLICY IF EXISTS dashboard_meta_read ON public.dashboard_meta;
DROP POLICY IF EXISTS dashboard_meta_write ON public.dashboard_meta;
CREATE POLICY dashboard_meta_read ON public.dashboard_meta AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY dashboard_meta_write ON public.dashboard_meta AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- diagnostic_results
DROP POLICY IF EXISTS diagnostic_read ON public.diagnostic_results;
DROP POLICY IF EXISTS diagnostic_write ON public.diagnostic_results;
CREATE POLICY diagnostic_read ON public.diagnostic_results AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY diagnostic_write ON public.diagnostic_results AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- lessons
DROP POLICY IF EXISTS lessons_read ON public.lessons;
DROP POLICY IF EXISTS lessons_write ON public.lessons;
CREATE POLICY lessons_read ON public.lessons AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY lessons_write ON public.lessons AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- notebook_items
DROP POLICY IF EXISTS notebook_read ON public.notebook_items;
DROP POLICY IF EXISTS notebook_write ON public.notebook_items;
CREATE POLICY notebook_read ON public.notebook_items AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY notebook_write ON public.notebook_items AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- profiles
DROP POLICY IF EXISTS profiles_read ON public.profiles;
DROP POLICY IF EXISTS profiles_write ON public.profiles;
CREATE POLICY profiles_read ON public.profiles AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY profiles_write ON public.profiles AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- questions
DROP POLICY IF EXISTS questions_read ON public.questions;
DROP POLICY IF EXISTS questions_write ON public.questions;
CREATE POLICY questions_read ON public.questions AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY questions_write ON public.questions AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- replies
DROP POLICY IF EXISTS replies_read ON public.replies;
DROP POLICY IF EXISTS replies_insert ON public.replies;
CREATE POLICY replies_read ON public.replies AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY replies_insert ON public.replies AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (true);

-- reports
DROP POLICY IF EXISTS reports_read ON public.reports;
DROP POLICY IF EXISTS reports_write ON public.reports;
CREATE POLICY reports_read ON public.reports AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY reports_write ON public.reports AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- topics
DROP POLICY IF EXISTS topics_read ON public.topics;
DROP POLICY IF EXISTS topics_write ON public.topics;
CREATE POLICY topics_read ON public.topics AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY topics_write ON public.topics AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- training_plans
DROP POLICY IF EXISTS training_plans_read ON public.training_plans;
DROP POLICY IF EXISTS training_plans_write ON public.training_plans;
CREATE POLICY training_plans_read ON public.training_plans AS PERMISSIVE FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY training_plans_write ON public.training_plans AS PERMISSIVE FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
