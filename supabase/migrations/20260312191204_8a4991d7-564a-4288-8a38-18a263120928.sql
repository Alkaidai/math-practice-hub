-- Performance indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_attempts_user_id ON public.attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_question ON public.attempts(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_notebook_items_user_id ON public.notebook_items(user_id);
CREATE INDEX IF NOT EXISTS idx_notebook_items_user_question ON public.notebook_items(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_daily_missions_user_date ON public.daily_missions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_study_stats_user_date ON public.daily_study_stats(user_id, date);
CREATE INDEX IF NOT EXISTS idx_dashboard_meta_user_id ON public.dashboard_meta(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic_id ON public.questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_questions_status ON public.questions(status);
CREATE INDEX IF NOT EXISTS idx_topic_prerequisites_topic ON public.topic_prerequisites(topic_id);

-- Optimize getAverageTimePerQuestion with a partial index
CREATE INDEX IF NOT EXISTS idx_attempts_time_spent ON public.attempts(user_id, time_spent_seconds) WHERE time_spent_seconds > 0;