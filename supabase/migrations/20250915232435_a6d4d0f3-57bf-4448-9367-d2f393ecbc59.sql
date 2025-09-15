-- Create a more restrictive approach: Remove the overly permissive policy and replace with user-specific access
DROP POLICY IF EXISTS "Anyone can view public stories" ON public.stories;

-- Create a policy that only allows authenticated users to see public stories 
-- This prevents anonymous access to ANY story data, including child information
CREATE POLICY "Authenticated users can view public stories" 
ON public.stories 
FOR SELECT 
USING (
  -- Users can always see their own stories
  auth.uid() = user_id 
  OR 
  -- Only authenticated users can see public stories (adds protection layer)
  (is_public = true AND status = 'completed' AND auth.uid() IS NOT NULL)
);

-- For anonymous users who need to browse stories, we'll handle this through the application
-- The app will authenticate users before showing public stories, providing better security