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

const fetchCharacters = async (userId?: string): Promise<Character[]> => {
  let query = supabase
    .from('character_sheets')
    .select('*');

  // If userId is provided, filter by user_id
  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: charactersData, error } = await query
    .order('likes', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  return charactersData || [];
};

export const useCharactersQuery = (userId?: string) => {
  return useQuery({
    queryKey: ['characters', userId],
    queryFn: () => fetchCharacters(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
};