-- Add is_public column to stories table
ALTER TABLE public.stories 
ADD COLUMN is_public BOOLEAN DEFAULT false;

-- Create index for better performance when querying public stories
CREATE INDEX idx_stories_public ON public.stories(is_public) WHERE is_public = true;

-- Update RLS policy to allow public access to public stories and their pages
CREATE POLICY "Anyone can view public stories" 
ON public.stories 
FOR SELECT 
USING (is_public = true);

-- Allow public access to pages of public stories
CREATE POLICY "Anyone can view pages of public stories" 
ON public.story_pages 
FOR SELECT 
USING (EXISTS (
  SELECT 1 
  FROM public.stories 
  WHERE stories.id = story_pages.story_id 
  AND stories.is_public = true
));