
-- Profiles table (replaces localStorage users)
CREATE TABLE public.profiles (
  id text PRIMARY KEY,
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  grade_level text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

-- Topics table
CREATE TABLE public.topics (
  id text PRIMARY KEY,
  name text NOT NULL,
  label text NOT NULL,
  subject text NOT NULL DEFAULT '',
  grade text NOT NULL DEFAULT 'all',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

-- Questions table
CREATE TABLE public.questions (
  id text PRIMARY KEY,
  grade text NOT NULL DEFAULT '7EF',
  subject text NOT NULL DEFAULT 'math',
  difficulty text NOT NULL DEFAULT 'easy',
  topic_id text REFERENCES public.topics(id) ON DELETE SET NULL,
  statement text NOT NULL DEFAULT '',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer NOT NULL DEFAULT 0,
  explanation text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'draft')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Comments table
CREATE TABLE public.comments (
  id text PRIMARY KEY,
  question_id text NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  author_username text NOT NULL DEFAULT 'anônimo',
  author_role text NOT NULL DEFAULT 'student',
  text text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Replies table
CREATE TABLE public.replies (
  id text PRIMARY KEY,
  comment_id text NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  author_username text NOT NULL DEFAULT 'admin',
  author_role text NOT NULL DEFAULT 'admin',
  text text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Lessons table
CREATE TABLE public.lessons (
  id text PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  topic text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  grade text NOT NULL DEFAULT ''
);

-- Attempts table
CREATE TABLE public.attempts (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  question_id text NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_index integer NOT NULL DEFAULT -1,
  is_correct boolean NOT NULL DEFAULT false,
  answered_at timestamptz NOT NULL DEFAULT now()
);

-- Notebook items table
CREATE TABLE public.notebook_items (
  id bigserial PRIMARY KEY,
  user_id text NOT NULL,
  question_id text NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  grade text,
  subject text,
  difficulty text,
  topic_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'mastered')),
  what_i_erred text NOT NULL DEFAULT '',
  rule_insight text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, question_id)
);

-- Reports table
CREATE TABLE public.reports (
  id text PRIMARY KEY,
  question_id text NOT NULL,
  question_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  type text NOT NULL DEFAULT 'outro',
  message text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by jsonb NOT NULL DEFAULT '{"username":"","role":"student"}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  admin_note text NOT NULL DEFAULT '',
  resolved_at timestamptz,
  resolved_by jsonb
);

-- Training plans table
CREATE TABLE public.training_plans (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  topic text NOT NULL DEFAULT '',
  qty integer NOT NULL DEFAULT 0,
  distribution jsonb NOT NULL DEFAULT '{"easy":0,"medium":0,"hard":0}'::jsonb,
  question_ids jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- Dashboard meta table
CREATE TABLE public.dashboard_meta (
  user_id text PRIMARY KEY,
  streak integer NOT NULL DEFAULT 0,
  last_attempt_date text,
  last_filters jsonb NOT NULL DEFAULT '{"grade":"","subject":"","difficulty":"","topicId":"","search":""}'::jsonb
);

-- Create indexes
CREATE INDEX idx_questions_topic_id ON public.questions(topic_id);
CREATE INDEX idx_questions_grade ON public.questions(grade);
CREATE INDEX idx_questions_subject ON public.questions(subject);
CREATE INDEX idx_attempts_user_id ON public.attempts(user_id);
CREATE INDEX idx_attempts_question_id ON public.attempts(question_id);
CREATE INDEX idx_notebook_user_id ON public.notebook_items(user_id);
CREATE INDEX idx_comments_question_id ON public.comments(question_id);
CREATE INDEX idx_replies_comment_id ON public.replies(comment_id);
CREATE INDEX idx_training_plans_user_id ON public.training_plans(user_id);
