
-- Add image fields to questions table
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS image_url text DEFAULT NULL;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS image_alt text DEFAULT NULL;

-- Create storage bucket for question images
INSERT INTO storage.buckets (id, name, public) VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read from the bucket
CREATE POLICY "Public read access for question images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'question-images');

-- Allow authenticated users to upload/update/delete
CREATE POLICY "Authenticated upload for question images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'question-images');

CREATE POLICY "Authenticated update for question images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'question-images');

CREATE POLICY "Authenticated delete for question images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'question-images');
