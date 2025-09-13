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
  is_public?: boolean;
}

const fetchStoriesOptimized = async (): Promise<Story[]> => {
  // Fast query - get stories only, no joins to avoid timeouts
  const { data: storiesData, error } = await supabase
    .from('stories')
    .select('id, title, child_name, child_age, themes, art_style, length, created_at, status, updated_at, user_id, likes, is_public')
    .order('likes', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100); // Limit initial load for performance

  if (error) throw error;

  return (storiesData || []).map(story => ({ ...story, first_page_image: null }));
};

export const useStoriesQuery = () => {
  return useQuery({
    queryKey: ['stories'],
    queryFn: fetchStoriesOptimized,
    staleTime: 10 * 60 * 1000, // 10 minutes - longer cache
    gcTime: 30 * 60 * 1000, // 30 minutes - longer garbage collection
    refetchOnWindowFocus: false,
    retry: 1, // Reduce retries for faster failure
  });
};

// Hook for lazy loading individual story images with better caching
export const useStoryImageQuery = (storyId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['story-image', storyId],
    queryFn: async () => {
      // Use the existing edge function for consistency and potential caching
      const { data, error } = await supabase.functions.invoke('get-page-image', {
        body: { 
          storyId,
          pageNumber: 1 
        }
      });
      
      if (error) {
        console.warn('Failed to get image via edge function, trying direct query');
        // Fallback to direct query
        const { data: firstPage } = await supabase
          .from('story_pages')
          .select('image_url')
          .eq('story_id', storyId)
          .eq('page_number', 1)
          .maybeSingle();
        
        return firstPage?.image_url || null;
      }
      
      return data?.image_url || null;
    },
    enabled,
    staleTime: 60 * 60 * 1000, // 1 hour - longer cache for images
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    retry: 1, // Quick failure for better UX
  });
};