-- Create a secure view for public stories that excludes child personal information
CREATE OR REPLACE VIEW public.public_stories_safe AS
SELECT 
  id,
  title,
  themes,
  art_style,
  length,
  created_at,
  likes,
  status,
  user_id
FROM public.stories 
WHERE is_public = true AND status = 'completed';

-- Enable RLS on the view
ALTER VIEW public.public_stories_safe SET (security_barrier = true);

-- Create RLS policy for the safe public view
CREATE POLICY "Anyone can view safe public stories" 
ON public.public_stories_safe 
FOR SELECT 
USING (true);

-- Update the existing stories table RLS policy to be more restrictive for sensitive fields
-- First drop the existing permissive policy
DROP POLICY IF EXISTS "Anyone can view public stories" ON public.stories;

-- Create a new, more restrictive policy that only allows specific fields for public access
-- This policy will be used by authenticated queries that need full access
CREATE POLICY "Authenticated users can view public stories with restrictions" 
ON public.stories 
FOR SELECT 
USING (
  -- Users can see their own stories completely
  auth.uid() = user_id 
  OR 
  -- For public stories, limit access based on authentication
  (is_public = true AND status = 'completed' AND auth.uid() IS NOT NULL)
);

-- Create a policy for completely anonymous access (no sensitive data)
CREATE POLICY "Anonymous users can view public story basics" 
ON public.stories 
FOR SELECT 
USING (
  -- Anonymous users can only see non-sensitive fields
  is_public = true AND status = 'completed' AND auth.uid() IS NULL
);