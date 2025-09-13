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

const fetchPublicStoriesOptimized = async (): Promise<PublicStory[]> => {
  // Fast query - get public stories only, no joins to avoid timeouts
  const { data: storiesData, error } = await supabase
    .from('stories')
    .select('id, title, child_name, child_age, themes, art_style, length, created_at, likes')
    .eq('is_public', true)
    .eq('status', 'completed') // Only show completed public stories
    .order('likes', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100); // Limit for performance

  if (error) throw error;

  return (storiesData || []).map(story => ({ ...story, first_page_image: null }));
};

export const usePublicStoriesQuery = () => {
  return useQuery({
    queryKey: ['public-stories'],
    queryFn: fetchPublicStoriesOptimized,
    staleTime: 15 * 60 * 1000, // 15 minutes - longer cache for public content
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });
};