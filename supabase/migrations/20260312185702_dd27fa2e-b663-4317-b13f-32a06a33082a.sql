-- Topic prerequisites table
CREATE TABLE public.topic_prerequisites (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic_id text NOT NULL,
  prerequisite_topic_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(topic_id, prerequisite_topic_id)
);

ALTER TABLE public.topic_prerequisites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "topic_prerequisites_read" ON public.topic_prerequisites
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "topic_prerequisites_write" ON public.topic_prerequisites
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);