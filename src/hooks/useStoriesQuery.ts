import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Story {
  id: string;
  title: string;
  child_name: string;
  child_age: string;
  themes: string[];
  art_style: string;
  length: number;
  created_at: string;
  status: string;
  updated_at: string;
  user_id: string;
  likes: number;
  first_page_image?: string;
}

const fetchStoriesWithImages = async (): Promise<Story[]> => {
  // Single optimized query to get stories with their first page images
  const { data: storiesData, error } = await supabase
    .from('stories')
    .select(`
      id, title, child_name, child_age, themes, art_style, length, 
      created_at, status, updated_at, user_id, likes,
      story_pages!inner(image_url)
    `)
    .eq('story_pages.page_number', 1)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Transform the data to match the expected format
  const storiesWithImages = (storiesData || []).map(story => ({
    ...story,
    first_page_image: (story as any).story_pages?.[0]?.image_url || null
  }));

  return storiesWithImages;
};

const fetchStoriesBasic = async (): Promise<Story[]> => {
  // Fallback query for stories without requiring first page images
  const { data: storiesData, error } = await supabase
    .from('stories')
    .select('id, title, child_name, child_age, themes, art_style, length, created_at, status, updated_at, user_id, likes')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (storiesData || []).map(story => ({ ...story, first_page_image: null }));
};

export const useStoriesQuery = () => {
  return useQuery({
    queryKey: ['stories'],
    queryFn: async () => {
      try {
        // Try optimized query first
        return await fetchStoriesWithImages();
      } catch (error) {
        console.warn('Optimized query failed, falling back to basic query:', error);
        // Fallback to basic query without images
        return await fetchStoriesBasic();
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
};

// Hook for lazy loading individual story images
export const useStoryImageQuery = (storyId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['story-image', storyId],
    queryFn: async () => {
      const { data: firstPage } = await supabase
        .from('story_pages')
        .select('image_url')
        .eq('story_id', storyId)
        .eq('page_number', 1)
        .maybeSingle();
      
      return firstPage?.image_url || null;
    },
    enabled,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};