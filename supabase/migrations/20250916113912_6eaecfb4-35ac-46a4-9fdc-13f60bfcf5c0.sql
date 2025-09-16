-- Add missing indexes to optimize common query patterns

-- Index for character_sheets ordering by likes and created_at (used in usePaginatedCharactersQuery and useCharactersQuery)
CREATE INDEX IF NOT EXISTS idx_character_sheets_likes_created_at ON public.character_sheets (likes DESC, created_at DESC);

-- Index for character_sheets user_id filtering (used in user-specific queries)
CREATE INDEX IF NOT EXISTS idx_character_sheets_user_id ON public.character_sheets (user_id);

-- Index for character_sheets search queries (name, hair_color, eye_color, typical_outfit)
CREATE INDEX IF NOT EXISTS idx_character_sheets_search ON public.character_sheets USING gin (to_tsvector('english', name || ' ' || COALESCE(hair_color, '') || ' ' || COALESCE(eye_color, '') || ' ' || COALESCE(typical_outfit, '')));

-- Index for stories ordering by likes and created_at (used in useStoriesQuery and usePublicStoriesQuery)
CREATE INDEX IF NOT EXISTS idx_stories_likes_created_at ON public.stories (likes DESC, created_at DESC);

-- Index for stories user_id filtering  
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories (user_id);

-- Index for public stories with status (used in usePublicStoriesQuery)
CREATE INDEX IF NOT EXISTS idx_stories_public_completed ON public.stories (is_public, status) WHERE is_public = true AND status = 'completed';

-- Index for story_pages by story_id and page_number (used frequently for first page queries)
CREATE INDEX IF NOT EXISTS idx_story_pages_story_id_page_number ON public.story_pages (story_id, page_number);

-- Index for story_generations by story_id (used in RLS policies)
CREATE INDEX IF NOT EXISTS idx_story_generations_story_id ON public.story_generations (story_id);

-- Partial index for story_pages with image_urls (optimize image queries)
CREATE INDEX IF NOT EXISTS idx_story_pages_with_images ON public.story_pages (story_id, page_number) WHERE image_url IS NOT NULL;