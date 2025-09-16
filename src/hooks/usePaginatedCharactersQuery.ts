import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Character {
  id: string;
  name: string;
  hair_color: string;
  hair_style: string;
  eye_color: string;
  skin_tone: string;
  typical_outfit: string;
  accessory: string;
  cartoon_reference_url: string;
  photo_url: string;
  likes: number;
  created_at: string;
  user_id: string;
}

interface PaginatedCharactersResult {
  characters: Character[];
  totalCount: number;
  hasMore: boolean;
}

const fetchPaginatedCharacters = async (
  page: number = 1,
  pageSize: number = 10,
  userId?: string,
  searchQuery?: string
): Promise<PaginatedCharactersResult> => {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Build the query with only essential fields for better performance
  let query = supabase
    .from('character_sheets')
    .select('id, name, hair_color, hair_style, eye_color, skin_tone, typical_outfit, accessory, cartoon_reference_url, photo_url, likes, created_at, user_id', { count: 'exact' });

  // Filter by user if provided
  if (userId) {
    query = query.eq('user_id', userId);
  }

  // Optimized search using full-text search index
  if (searchQuery && searchQuery.trim()) {
    const searchTerm = searchQuery.replace(/[^\w\s]/g, '').trim(); // Sanitize input
    if (searchTerm) {
      // Use the new GIN index for full-text search
      query = query.textSearch('name,hair_color,eye_color,typical_outfit', `'${searchTerm}':*`, {
        type: 'websearch',
        config: 'english'
      });
    }
  }

  // Apply pagination and sorting
  const { data: charactersData, error, count } = await query
    .order('likes', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  const totalCount = count || 0;
  const hasMore = to < totalCount - 1;

  return {
    characters: charactersData || [],
    totalCount,
    hasMore
  };
};

export const usePaginatedCharactersQuery = (
  page: number = 1,
  pageSize: number = 10,
  userId?: string,
  searchQuery?: string
) => {
  return useQuery({
    queryKey: ['characters', 'paginated', page, pageSize, userId, searchQuery],
    queryFn: () => fetchPaginatedCharacters(page, pageSize, userId, searchQuery),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
    // Keep previous data while loading new page
    placeholderData: (previousData) => previousData,
  });
};
