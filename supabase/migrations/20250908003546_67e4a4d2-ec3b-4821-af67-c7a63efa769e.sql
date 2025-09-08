-- Update default length for new stories to be 2 pages
ALTER TABLE public.stories 
ALTER COLUMN length SET DEFAULT 2;