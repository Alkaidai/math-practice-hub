ALTER TABLE public.notebook_items
  ADD COLUMN IF NOT EXISTS next_review_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS review_count integer NOT NULL DEFAULT 0;