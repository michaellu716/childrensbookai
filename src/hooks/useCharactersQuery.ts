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

const fetchCharacters = async (): Promise<Character[]> => {
  const { data: charactersData, error } = await supabase
    .from('character_sheets')
    .select('*')
    .order('likes', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;

  return charactersData || [];
};

export const useCharactersQuery = () => {
  return useQuery({
    queryKey: ['characters'],
    queryFn: fetchCharacters,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2,
  });
};