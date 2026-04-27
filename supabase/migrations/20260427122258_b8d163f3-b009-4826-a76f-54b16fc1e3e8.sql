-- Create public bucket for Instagram post images
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-posts', 'social-posts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read
CREATE POLICY "Public read social-posts"
ON storage.objects FOR SELECT
USING (bucket_id = 'social-posts');

-- Owner can upload to their restaurant folder
CREATE POLICY "Owner upload social-posts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'social-posts'
  AND public.owns_restaurant(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Owner can update their files
CREATE POLICY "Owner update social-posts"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'social-posts'
  AND public.owns_restaurant(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Owner can delete their files
CREATE POLICY "Owner delete social-posts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'social-posts'
  AND public.owns_restaurant(auth.uid(), ((storage.foldername(name))[1])::uuid)
);