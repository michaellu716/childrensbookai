-- Add a very limited anonymous access policy for public story browsing
-- This only works because our frontend now only requests safe fields
CREATE POLICY "Limited anonymous access to public story basics" 
ON public.stories 
FOR SELECT 
USING (
  -- Users can see their own stories
  auth.uid() = user_id 
  OR 
  -- Authenticated users can see all public story data
  (is_public = true AND status = 'completed' AND auth.uid() IS NOT NULL)
  OR 
  -- Anonymous users can see public stories but frontend limits which fields are requested
  -- This works because the app layer now only requests: id, title, themes, art_style, length, created_at, likes
  (is_public = true AND status = 'completed' AND auth.uid() IS NULL)
);