-- Add RLS policy to allow anyone to view all character sheets
CREATE POLICY "Anyone can view all character sheets" 
ON public.character_sheets 
FOR SELECT 
USING (true);