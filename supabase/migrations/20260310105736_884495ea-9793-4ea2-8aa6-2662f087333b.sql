
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebook_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_meta ENABLE ROW LEVEL SECURITY;

-- Since this app uses application-level auth (username/password in profiles table)
-- and not Supabase Auth, we need permissive policies for the anon role
-- The app handles authorization logic in the frontend

-- Public read access for reference data
CREATE POLICY "topics_read" ON public.topics FOR SELECT TO anon USING (true);
CREATE POLICY "topics_write" ON public.topics FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "questions_read" ON public.questions FOR SELECT TO anon USING (true);
CREATE POLICY "questions_write" ON public.questions FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "comments_read" ON public.comments FOR SELECT TO anon USING (true);
CREATE POLICY "comments_write" ON public.comments FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "replies_read" ON public.replies FOR SELECT TO anon USING (true);
CREATE POLICY "replies_write" ON public.replies FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "lessons_read" ON public.lessons FOR SELECT TO anon USING (true);
CREATE POLICY "lessons_write" ON public.lessons FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "profiles_read" ON public.profiles FOR SELECT TO anon USING (true);
CREATE POLICY "profiles_write" ON public.profiles FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "attempts_read" ON public.attempts FOR SELECT TO anon USING (true);
CREATE POLICY "attempts_write" ON public.attempts FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "notebook_read" ON public.notebook_items FOR SELECT TO anon USING (true);
CREATE POLICY "notebook_write" ON public.notebook_items FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "reports_read" ON public.reports FOR SELECT TO anon USING (true);
CREATE POLICY "reports_write" ON public.reports FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "training_plans_read" ON public.training_plans FOR SELECT TO anon USING (true);
CREATE POLICY "training_plans_write" ON public.training_plans FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "dashboard_meta_read" ON public.dashboard_meta FOR SELECT TO anon USING (true);
CREATE POLICY "dashboard_meta_write" ON public.dashboard_meta FOR ALL TO anon USING (true) WITH CHECK (true);
