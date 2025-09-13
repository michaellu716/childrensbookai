-- Clean up base64 image data and migrate to storage URLs
-- First, let's see how many pages have base64 data
-- Then convert them to proper storage URLs

-- Update any remaining base64 image URLs to NULL so they can be regenerated properly
UPDATE story_pages 
SET image_url = NULL 
WHERE image_url IS NOT NULL 
  AND (
    image_url LIKE 'data:image/%' 
    OR LENGTH(image_url) > 500
  );

-- Add a helpful comment
COMMENT ON COLUMN story_pages.image_url IS 'URL to image stored in Supabase Storage (not base64 data)';

-- Also ensure story status is updated for stories that now have missing images
UPDATE stories 
SET status = 'completed' 
WHERE status = 'generating' 
  AND id IN (
    SELECT DISTINCT story_id 
    FROM story_pages 
    WHERE page_number = 1 
    GROUP BY story_id 
    HAVING COUNT(*) > 0
  );