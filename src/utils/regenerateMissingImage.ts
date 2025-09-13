import { supabase } from '@/integrations/supabase/client';

export const regenerateMissingImage = async (storyId: string, pageNumber: number) => {
  try {
    console.log(`Regenerating image for story ${storyId}, page ${pageNumber}`);
    
    const { data, error } = await supabase.functions.invoke('generate-page-image', {
      body: {
        storyId,
        pageNumber
      }
    });

    if (error) {
      console.error('Error regenerating image:', error);
      throw error;
    }

    console.log('Image regeneration response:', data);
    return data;
  } catch (error) {
    console.error('Failed to regenerate image:', error);
    throw error;
  }
};

// Function to call from browser console for immediate fix
(window as any).regenerateVanessaPage2 = async () => {
  try {
    const result = await regenerateMissingImage('e1bb4f85-9ebf-4a6d-a683-c1f01fa5daa5', 2);
    console.log('Regeneration result:', result);
    alert('Image regenerated! Please refresh the page to see it.');
    return result;
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to regenerate image. Check console for details.');
    return error;
  }
};