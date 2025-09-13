-- Clean up any remaining base64 image data for better performance
UPDATE story_pages 
SET image_url = NULL 
WHERE image_url LIKE 'data:image/%' 
  AND LENGTH(image_url) > 1000;