-- Make story-images bucket public so images can be displayed in print previews
UPDATE storage.buckets 
SET public = true 
WHERE id = 'story-images';

-- Add storage policy to allow public access to story images
CREATE POLICY "Story images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'story-images');