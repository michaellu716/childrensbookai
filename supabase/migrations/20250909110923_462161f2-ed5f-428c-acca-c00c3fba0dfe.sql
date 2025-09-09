-- Add likes column to character_sheets table
ALTER TABLE public.character_sheets 
ADD COLUMN likes INTEGER NOT NULL DEFAULT 0;