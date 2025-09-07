-- Create user profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create character sheets table for photo-to-cartoon data
CREATE TABLE public.character_sheets (
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
CREATE TABLE public.stories (
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
  length INTEGER DEFAULT 8, -- 8, 12, or 16 pages
  art_style TEXT DEFAULT 'cartoon',
  reading_level TEXT DEFAULT 'early_reader',
  language TEXT DEFAULT 'en',
  status TEXT DEFAULT 'draft', -- draft, generating, completed, failed
  pdf_url TEXT,
  share_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create story pages table
CREATE TABLE public.story_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  page_number INTEGER NOT NULL,
  page_type TEXT DEFAULT 'story', -- cover, story, back
  text_content TEXT,
  image_url TEXT,
  image_prompt TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(story_id, page_number)
);

-- Create story generations table to track AI generation attempts
CREATE TABLE public.story_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE NOT NULL,
  generation_type TEXT NOT NULL, -- full_story, single_page, character_sheet
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_generations ENABLE ROW LEVEL SECURITY;

-- RLS policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS policies for character_sheets
CREATE POLICY "Users can manage their own character sheets" ON public.character_sheets
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for stories
CREATE POLICY "Users can manage their own stories" ON public.stories
  FOR ALL USING (auth.uid() = user_id);

-- RLS policies for story_pages
CREATE POLICY "Users can manage pages of their own stories" ON public.story_pages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stories 
      WHERE stories.id = story_pages.story_id 
      AND stories.user_id = auth.uid()
    )
  );

-- RLS policies for story_generations
CREATE POLICY "Users can view generations for their own stories" ON public.story_generations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.stories 
      WHERE stories.id = story_generations.story_id 
      AND stories.user_id = auth.uid()
    )
  );

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('child-photos', 'child-photos', false),
  ('character-images', 'character-images', false),
  ('story-images', 'story-images', false),
  ('story-pdfs', 'story-pdfs', false);

-- Storage policies for child-photos bucket
CREATE POLICY "Users can upload their own child photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'child-photos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own child photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'child-photos' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for character-images bucket
CREATE POLICY "Users can view their own character images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'character-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "System can manage character images" ON storage.objects
  FOR ALL USING (bucket_id = 'character-images');

-- Storage policies for story-images bucket
CREATE POLICY "Users can view their own story images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'story-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "System can manage story images" ON storage.objects
  FOR ALL USING (bucket_id = 'story-images');

-- Storage policies for story-pdfs bucket
CREATE POLICY "Users can view their own story PDFs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'story-pdfs' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "System can manage story PDFs" ON storage.objects
  FOR ALL USING (bucket_id = 'story-pdfs');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON public.stories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_story_pages_updated_at BEFORE UPDATE ON public.story_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();