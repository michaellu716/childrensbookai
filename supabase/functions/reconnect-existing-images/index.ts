import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Reconnecting existing images ===');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get all existing images from storage
    const { data: storageFiles, error: storageError } = await supabase.storage
      .from('story-images')
      .list('', { limit: 1000 });
    
    if (storageError) {
      throw new Error(`Failed to list storage files: ${storageError.message}`);
    }
    
    console.log(`Found ${storageFiles?.length || 0} files in storage`);
    
    let reconnectedCount = 0;
    
    // Process each storage file
    for (const file of storageFiles || []) {
      if (!file.name.includes('/')) continue;
      
      // Parse the file path: story-{storyId}/page-{pageNumber}-{timestamp}.webp
      const pathParts = file.name.split('/');
      const storyFolder = pathParts[0]; // e.g., "story-6db292bb-befb-4b72-a32d-108b86d984a4"
      const fileName = pathParts[1]; // e.g., "page-2-1757767897710.webp"
      
      const storyId = storyFolder.replace('story-', '');
      const pageMatch = fileName.match(/page-(\d+)-/);
      
      if (!pageMatch) {
        console.log(`Skipping file with unexpected format: ${file.name}`);
        continue;
      }
      
      const pageNumber = parseInt(pageMatch[1]);
      
      // Get the public URL for this image
      const { data: { publicUrl } } = supabase.storage
        .from('story-images')
        .getPublicUrl(file.name);
        
      console.log(`Reconnecting story ${storyId}, page ${pageNumber} to ${publicUrl}`);
      
      // Update the corresponding story page
      const { error: updateError } = await supabase
        .from('story_pages')
        .update({ image_url: publicUrl })
        .eq('story_id', storyId)
        .eq('page_number', pageNumber);
        
      if (updateError) {
        console.error(`Failed to update page ${pageNumber} for story ${storyId}:`, updateError);
      } else {
        reconnectedCount++;
        console.log(`✓ Reconnected story ${storyId}, page ${pageNumber}`);
      }
    }
    
    console.log(`Reconnection complete: ${reconnectedCount} images reconnected`);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: `Successfully reconnected ${reconnectedCount} existing images`,
      reconnectedCount 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error in reconnect-existing-images function:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Failed to reconnect images',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});