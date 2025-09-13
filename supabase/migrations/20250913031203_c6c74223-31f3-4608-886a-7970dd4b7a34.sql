-- Fix story status that's stuck at 'generating' when pages are actually complete
UPDATE stories 
SET status = 'completed', updated_at = now()
WHERE id = '6db292bb-befb-4b72-a32d-108b86d984a4' AND status = 'generating';