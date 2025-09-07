-- Change child_age column from integer to text to support age ranges like "4-5"
ALTER TABLE public.stories 
ALTER COLUMN child_age TYPE text;