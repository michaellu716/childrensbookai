-- Create character sheets table for photo-to-cartoon data
CREATE TABLE IF NOT EXISTS public.character_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  hair_color TEXT,
  hair_style TEXT,
  eye_color TEXT,
  skin_tone TEXT,
  typical_outfit TEXT,
  accessory TEXT,
  photo_url TEXT,
  cartoon_reference_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create stories table
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  character_sheet_id UUID REFERENCES public.character_sheets(id),
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  child_name TEXT,
  child_age INTEGER,
  themes TEXT[],
  lesson TEXT,
  tone TEXT,
  length INTEGER DEFAULT 8,
  art_style TEXT DEFAULT 'cartoon',
  reading_level TEXT DEFAULT 'early_reader',
  language TEXT DEFAULT 'en',
  status TEXT DEFAULT 'draft',
  pdf_url TEXT,
  share_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create story pages table
CREATE TABLE IF NOT EXISTS public.story_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER NOT NULL,
  page_type TEXT DEFAULT 'story',
  text_content TEXT,
  image_url TEXT,
  image_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(story_id, page_number)
);

-- Create story generations table to track AI generation attempts
CREATE TABLE IF NOT EXISTS public.story_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  generation_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all tables
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'character_sheets') THEN
    ALTER TABLE public.character_sheets ENABLE ROW LEVEL SECURITY;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stories') THEN
    ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_pages') THEN
    ALTER TABLE public.story_pages ENABLE ROW LEVEL SECURITY;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_generations') THEN
    ALTER TABLE public.story_generations ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- RLS policies for character_sheets
DROP POLICY IF EXISTS "Users can manage their own character sheets" ON public.character_sheets;
CREATE POLICY "Users can manage their own character sheets" ON public.character_sheets
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for stories
DROP POLICY IF EXISTS "Users can manage their own stories" ON public.stories;
CREATE POLICY "Users can manage their own stories" ON public.stories
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for story_pages
DROP POLICY IF EXISTS "Users can manage pages of their own stories" ON public.story_pages;
CREATE POLICY "Users can manage pages of their own stories" ON public.story_pages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stories 
      WHERE stories.id = story_pages.story_id 
      AND stories.user_id = auth.uid()
    )
  );

-- RLS policies for story_generations
DROP POLICY IF EXISTS "Users can view generations for their own stories" ON public.story_generations;
CREATE POLICY "Users can view generations for their own stories" ON public.story_generations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stories 
      WHERE stories.id = story_generations.story_id 
      AND stories.user_id = auth.uid()
    )
  );

-- Create storage buckets (ignore if they exist)
INSERT INTO storage.buckets (id, name, public) 
SELECT 'child-photos', 'child-photos', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'child-photos');

INSERT INTO storage.buckets (id, name, public) 
SELECT 'character-images', 'character-images', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'character-images');

INSERT INTO storage.buckets (id, name, public) 
SELECT 'story-images', 'story-images', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'story-images');

INSERT INTO storage.buckets (id, name, public) 
SELECT 'story-pdfs', 'story-pdfs', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'story-pdfs');

-- Storage policies
DROP POLICY IF EXISTS "Users can upload their own child photos" ON storage.objects;
CREATE POLICY "Users can upload their own child photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'child-photos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view their own child photos" ON storage.objects;
CREATE POLICY "Users can view their own child photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'child-photos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view their own character images" ON storage.objects;
CREATE POLICY "Users can view their own character images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'character-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "System can manage character images" ON storage.objects;
CREATE POLICY "System can manage character images" ON storage.objects
  FOR ALL USING (bucket_id = 'character-images');

DROP POLICY IF EXISTS "Users can view their own story images" ON storage.objects;
CREATE POLICY "Users can view their own story images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'story-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "System can manage story images" ON storage.objects;
CREATE POLICY "System can manage story images" ON storage.objects
  FOR ALL USING (bucket_id = 'story-images');

DROP POLICY IF EXISTS "Users can view their own story PDFs" ON storage.objects;
CREATE POLICY "Users can view their own story PDFs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'story-pdfs' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );