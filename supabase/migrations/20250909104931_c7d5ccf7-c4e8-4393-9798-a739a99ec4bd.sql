-- Add likes column to stories table
ALTER TABLE public.stories 
ADD COLUMN likes INTEGER NOT NULL DEFAULT 0;