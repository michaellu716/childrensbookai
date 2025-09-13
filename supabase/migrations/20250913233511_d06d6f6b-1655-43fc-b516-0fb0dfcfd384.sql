-- Convert all existing storage URLs back to base64 format for consistency
-- This migration will help track which images need conversion

-- First, let's see what we're working with by adding a temporary column
ALTER TABLE story_pages ADD COLUMN IF NOT EXISTS needs_base64_conversion BOOLEAN DEFAULT FALSE;

-- Mark all storage URLs as needing conversion to base64
UPDATE story_pages 
SET needs_base64_conversion = TRUE 
WHERE image_url LIKE 'https://%supabase.co/storage%';

-- Add an index for faster conversion processing
CREATE INDEX IF NOT EXISTS idx_story_pages_conversion 
ON story_pages(needs_base64_conversion) 
WHERE needs_base64_conversion = TRUE;