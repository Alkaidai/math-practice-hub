
-- Table to control which subjects each student can access
CREATE TABLE public.user_subject_access (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id text NOT NULL,
  subject_slug text NOT NULL,
  UNIQUE(user_id, subject_slug)
);

-- Enable RLS
ALTER TABLE public.user_subject_access ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "user_subject_access_read"
  ON public.user_subject_access FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "user_subject_access_write"
  ON public.user_subject_access FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
