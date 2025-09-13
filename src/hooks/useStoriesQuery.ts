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
      console.log('🖼️ Fetching image for story:', storyId);
      
      try {
        // First try to get the page with image_url
        const { data: firstPage, error } = await supabase
          .from('story_pages')
          .select('image_url, id')
          .eq('story_id', storyId)
          .eq('page_number', 1)
          .maybeSingle();
        
        console.log('📊 Direct query result:', { firstPage, error });
        
        if (error) {
          console.warn('❌ Failed to get story image:', error);
          
          // Try using the edge function approach as fallback
          console.log('🔄 Trying edge function approach for story:', storyId);
          
          try {
            const { data: pageData, error: edgeError } = await supabase.functions.invoke('get-story-details', {
              body: { storyId }
            });
            
            console.log('🌐 Edge function result:', { pageData, edgeError });
            
            if (edgeError) {
              console.error('❌ Edge function error:', edgeError);
              return null;
            }
            
            if (pageData?.pages?.[0]?.image_url) {
              console.log('✅ Found image via edge function:', pageData.pages[0].image_url);
              return pageData.pages[0].image_url;
            }
          } catch (edgeErr) {
            console.error('❌ Edge function failed:', edgeErr);
          }
          
          return null;
        }
        
        const imageUrl = firstPage?.image_url || null;
        console.log('✅ Direct query image result:', imageUrl);
        return imageUrl;
      } catch (err) {
        console.error('❌ Error in useStoryImageQuery:', err);
        return null;
      }
    },
    enabled,
    staleTime: 60 * 60 * 1000, // 1 hour - longer cache for images
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
    retry: 1, // Quick failure for better UX
  });
};