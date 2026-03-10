-- Drop all restrictive policies and recreate as permissive

-- attempts
DROP POLICY IF EXISTS "attempts_read" ON public.attempts;
DROP POLICY IF EXISTS "attempts_write" ON public.attempts;
CREATE POLICY "attempts_read" ON public.attempts FOR SELECT TO anon USING (true);
CREATE POLICY "attempts_insert" ON public.attempts FOR INSERT TO anon WITH CHECK (true);

-- comments
DROP POLICY IF EXISTS "comments_read" ON public.comments;
DROP POLICY IF EXISTS "comments_write" ON public.comments;
CREATE POLICY "comments_read" ON public.comments FOR SELECT TO anon USING (true);
CREATE POLICY "comments_insert" ON public.comments FOR INSERT TO anon WITH CHECK (true);

-- dashboard_meta
DROP POLICY IF EXISTS "dashboard_meta_read" ON public.dashboard_meta;
DROP POLICY IF EXISTS "dashboard_meta_write" ON public.dashboard_meta;
CREATE POLICY "dashboard_meta_read" ON public.dashboard_meta FOR SELECT TO anon USING (true);
CREATE POLICY "dashboard_meta_write" ON public.dashboard_meta FOR ALL TO anon USING (true) WITH CHECK (true);

-- lessons
DROP POLICY IF EXISTS "lessons_read" ON public.lessons;
DROP POLICY IF EXISTS "lessons_write" ON public.lessons;
CREATE POLICY "lessons_read" ON public.lessons FOR SELECT TO anon USING (true);
CREATE POLICY "lessons_write" ON public.lessons FOR ALL TO anon USING (true) WITH CHECK (true);

-- notebook_items
DROP POLICY IF EXISTS "notebook_read" ON public.notebook_items;
DROP POLICY IF EXISTS "notebook_write" ON public.notebook_items;
CREATE POLICY "notebook_read" ON public.notebook_items FOR SELECT TO anon USING (true);
CREATE POLICY "notebook_write" ON public.notebook_items FOR ALL TO anon USING (true) WITH CHECK (true);

-- profiles
DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
DROP POLICY IF EXISTS "profiles_write" ON public.profiles;
CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO anon USING (true);
CREATE POLICY "profiles_write" ON public.profiles FOR ALL TO anon USING (true) WITH CHECK (true);

-- questions
DROP POLICY IF EXISTS "questions_read" ON public.questions;
DROP POLICY IF EXISTS "questions_write" ON public.questions;
CREATE POLICY "questions_read" ON public.questions FOR SELECT TO anon USING (true);
CREATE POLICY "questions_write" ON public.questions FOR ALL TO anon USING (true) WITH CHECK (true);

-- replies
DROP POLICY IF EXISTS "replies_read" ON public.replies;
DROP POLICY IF EXISTS "replies_write" ON public.replies;
CREATE POLICY "replies_read" ON public.replies FOR SELECT TO anon USING (true);
CREATE POLICY "replies_insert" ON public.replies FOR INSERT TO anon WITH CHECK (true);

-- reports
DROP POLICY IF EXISTS "reports_read" ON public.reports;
DROP POLICY IF EXISTS "reports_write" ON public.reports;
CREATE POLICY "reports_read" ON public.reports FOR SELECT TO anon USING (true);
CREATE POLICY "reports_write" ON public.reports FOR ALL TO anon USING (true) WITH CHECK (true);

-- topics
DROP POLICY IF EXISTS "topics_read" ON public.topics;
DROP POLICY IF EXISTS "topics_write" ON public.topics;
CREATE POLICY "topics_read" ON public.topics FOR SELECT TO anon USING (true);
CREATE POLICY "topics_write" ON public.topics FOR ALL TO anon USING (true) WITH CHECK (true);

-- training_plans
DROP POLICY IF EXISTS "training_plans_read" ON public.training_plans;
DROP POLICY IF EXISTS "training_plans_write" ON public.training_plans;
CREATE POLICY "training_plans_read" ON public.training_plans FOR SELECT TO anon USING (true);
CREATE POLICY "training_plans_write" ON public.training_plans FOR ALL TO anon USING (true) WITH CHECK (true);
