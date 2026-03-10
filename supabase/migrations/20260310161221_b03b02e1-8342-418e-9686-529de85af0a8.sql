ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE;