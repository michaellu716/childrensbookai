import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PublicStory {
  id: string;
  title: string;
  child_name: string;
  child_age: string;
  themes: string[];
  art_style: string;
  length: number;
  created_at: string;
  likes: number;
  first_page_image?: string;
}

const fetchPublicStoriesWithImages = async (): Promise<PublicStory[]> => {
  // Query public stories with their first page images
  const { data: storiesData, error } = await supabase
    .from('stories')
    .select(`
      id, title, child_name, child_age, themes, art_style, length, 
      created_at, likes,
      story_pages!inner(image_url)
    `)
    .eq('is_public', true)
    .eq('story_pages.page_number', 1)
    .order('likes', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Transform the data to match the expected format
  const storiesWithImages = (storiesData || []).map(story => ({
    ...story,
    first_page_image: (story as any).story_pages?.[0]?.image_url || null
  }));

  return storiesWithImages;
};

const fetchPublicStoriesBasic = async (): Promise<PublicStory[]> => {
  // Fallback query for public stories without requiring first page images
  const { data: storiesData, error } = await supabase
    .from('stories')
    .select('id, title, child_name, child_age, themes, art_style, length, created_at, likes')
    .eq('is_public', true)
    .order('likes', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (storiesData || []).map(story => ({ ...story, first_page_image: null }));
};

export const usePublicStoriesQuery = () => {
  return useQuery({
    queryKey: ['public-stories'],
    queryFn: async () => {
      try {
        // Try optimized query first
        return await fetchPublicStoriesWithImages();
      } catch (error) {
        console.warn('Optimized query failed, falling back to basic query:', error);
        // Fallback to basic query without images
        return await fetchPublicStoriesBasic();
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
};