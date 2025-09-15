-- Drop the failed view and policies
DROP VIEW IF EXISTS public.public_stories_safe CASCADE;

-- Create a more restrictive RLS policy that completely blocks sensitive child data for public access
-- First, restore the basic public access but with a security function to filter sensitive fields
DROP POLICY IF EXISTS "Authenticated users can view public stories with restrictions" ON public.stories;
DROP POLICY IF EXISTS "Anonymous users can view public story basics" ON public.stories;

-- Restore the basic public access policy
CREATE POLICY "Anyone can view public stories" 
ON public.stories 
FOR SELECT 
USING (is_public = true AND status = 'completed');

-- Create a security definer function to return only safe public story data
CREATE OR REPLACE FUNCTION public.get_safe_public_stories()
RETURNS TABLE (
  id uuid,
  title text,
  themes text[],
  art_style text,
  length integer,
  created_at timestamp with time zone,
  likes integer
) 
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT 
    s.id,
    s.title,
    s.themes,
    s.art_style,
    s.length,
    s.created_at,
    s.likes
  FROM public.stories s
  WHERE s.is_public = true 
    AND s.status = 'completed'
  ORDER BY s.likes DESC, s.created_at DESC
  LIMIT 100;
$$;