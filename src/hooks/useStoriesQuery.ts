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

// Hook for lazy loading individual story images with better caching (including public stories)
export const useStoryImageQuery = (storyId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['story-image', storyId],
    queryFn: async () => {
      // First try to get from database
      const { data: firstPage, error } = await supabase
        .from('story_pages')
        .select('image_url')
        .eq('story_id', storyId)
        .eq('page_number', 1)
        .maybeSingle();
      
      if (error) {
        console.warn('Failed to get story image from database:', error);
      }
      
      // If we have an image URL in database, return it
      if (firstPage?.image_url) {
        return firstPage.image_url;
      }
      
      // If no image in database, check if there's one in storage we can reconnect
      const { data: storageFiles } = await supabase.storage
        .from('story-images')
        .list(`story-${storyId}`, { limit: 10 });
        
      if (storageFiles && storageFiles.length > 0) {
        // Find page 1 image
        const page1File = storageFiles.find(file => 
          file.name.match(/page-1-\d+\.(webp|png|jpg|jpeg)$/i)
        );
        
        if (page1File) {
          const { data: { publicUrl } } = supabase.storage
            .from('story-images')
            .getPublicUrl(`story-${storyId}/${page1File.name}`);
            
          // Automatically reconnect this image to the database
          await supabase
            .from('story_pages')
            .update({ image_url: publicUrl })
            .eq('story_id', storyId)
            .eq('page_number', 1);
            
          return publicUrl;
        }
      }
      
      return null;
    },
    enabled,
    staleTime: 60 * 60 * 1000, // 1 hour - longer cache for images
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    retry: 1, // Quick failure for better UX
  });
};