import { supabase } from '@/integrations/supabase/client';

export const convertStorageToBase64 = async (): Promise<{
  success: boolean;
  converted: number;
  failed: number;
  remaining: number;
  message: string;
}> => {
  try {
    const { data, error } = await supabase.functions.invoke('convert-storage-to-base64', {
      body: {}
    });

    if (error) {
      console.error('Error converting storage URLs to base64:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to convert storage URLs:', error);
    return {
      success: false,
      converted: 0,
      failed: 0,
      remaining: 0,
      message: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

export const checkConversionStatus = async (): Promise<{
  totalPages: number;
  base64Pages: number;
  storagePages: number;
  needsConversion: number;
}> => {
  try {
    const { data: conversionStatus, error } = await supabase
      .from('story_pages')
      .select('image_url, needs_base64_conversion');

    if (error) {
      throw error;
    }

    const totalPages = conversionStatus?.length || 0;
    const base64Pages = conversionStatus?.filter(page => 
      page.image_url?.startsWith('data:image/')
    ).length || 0;
    const storagePages = conversionStatus?.filter(page => 
      page.image_url?.includes('supabase.co/storage')
    ).length || 0;
    const needsConversion = conversionStatus?.filter(page => 
      page.needs_base64_conversion === true
    ).length || 0;

    return {
      totalPages,
      base64Pages,
      storagePages,
      needsConversion
    };
  } catch (error) {
    console.error('Failed to check conversion status:', error);
    return {
      totalPages: 0,
      base64Pages: 0,
      storagePages: 0,
      needsConversion: 0
    };
  }
};