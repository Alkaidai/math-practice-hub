
-- Performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_question_id ON public.attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_topic_id ON public.attempts(topic_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_correct ON public.attempts(user_id, is_correct);

CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON public.questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON public.questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_grade ON public.questions(grade);
CREATE INDEX IF NOT EXISTS idx_questions_status ON public.questions(status);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON public.questions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notebook_items_user_id ON public.notebook_items(user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_items_question_id ON public.notebook_items(question_id);

CREATE INDEX IF NOT EXISTS idx_diagnostic_results_user_id ON public.diagnostic_results(user_id);

CREATE INDEX IF NOT EXISTS idx_comments_question_id ON public.comments(question_id);
CREATE INDEX IF NOT EXISTS idx_replies_comment_id ON public.replies(comment_id);

CREATE INDEX IF NOT EXISTS idx_profiles_auth_user_id ON public.profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

CREATE INDEX IF NOT EXISTS idx_topics_subject ON public.topics(subject);
CREATE INDEX IF NOT EXISTS idx_topics_status ON public.topics(status);

CREATE INDEX IF NOT EXISTS idx_training_plans_user_id ON public.training_plans(user_id);

CREATE INDEX IF NOT EXISTS idx_user_subject_access_user_id ON public.user_subject_access(user_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_meta_user_id ON public.dashboard_meta(user_id);

-- Create a materialized-like ranking function for fast ranking queries
CREATE OR REPLACE FUNCTION public.get_ranking()
RETURNS TABLE(
  user_id text,
  username text,
  total bigint,
  correct bigint,
  rate integer,
  streak integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.user_id,
    a.user_id as username,
    COUNT(*)::bigint as total,
    COUNT(*) FILTER (WHERE a.is_correct)::bigint as correct,
    CASE WHEN COUNT(*) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE a.is_correct)::numeric / COUNT(*)::numeric) * 100)::integer
      ELSE 0
    END as rate,
    COALESCE(dm.streak, 0) as streak
  FROM public.attempts a
  INNER JOIN public.profiles p ON p.username = a.user_id
  LEFT JOIN public.dashboard_meta dm ON dm.user_id = a.user_id
  WHERE p.role = 'student'
    AND p.ranking_visible = true
  GROUP BY a.user_id, dm.streak
  ORDER BY COUNT(*) FILTER (WHERE a.is_correct) DESC,
           rate DESC,
           COALESCE(dm.streak, 0) DESC;
$$;

-- Create aggregated student dashboard function
CREATE OR REPLACE FUNCTION public.get_student_stats(p_user_id text)
RETURNS TABLE(
  total_answered bigint,
  total_correct bigint,
  accuracy_rate integer,
  streak integer,
  last_attempt_date text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(a.total, 0)::bigint,
    COALESCE(a.correct, 0)::bigint,
    CASE WHEN COALESCE(a.total, 0) > 0
      THEN ROUND((COALESCE(a.correct, 0)::numeric / a.total::numeric) * 100)::integer
      ELSE 0
    END,
    COALESCE(dm.streak, 0),
    dm.last_attempt_date
  FROM (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_correct) as correct
    FROM public.attempts
    WHERE user_id = p_user_id
  ) a
  LEFT JOIN public.dashboard_meta dm ON dm.user_id = p_user_id;
$$;
