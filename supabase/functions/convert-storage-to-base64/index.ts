import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('convert-storage-to-base64: Request received', { method: req.method, url: req.url });
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all pages that need conversion (storage URLs)
    const { data: pagesToConvert, error: fetchError } = await supabase
      .from('story_pages')
      .select('id, story_id, page_number, image_url')
      .eq('needs_base64_conversion', true)
      .limit(50); // Process in batches to avoid timeouts

    if (fetchError) {
      console.error('Error fetching pages to convert:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pagesToConvert || pagesToConvert.length === 0) {
      return new Response(JSON.stringify({ 
        message: "No pages need conversion",
        converted: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Converting ${pagesToConvert.length} pages from storage URLs to base64`);

    let convertedCount = 0;
    let failedCount = 0;

    // Process each page
    for (const page of pagesToConvert) {
      try {
        console.log(`Converting page ${page.page_number} from story ${page.story_id}`);
        
        // Fetch the image from the storage URL
        const imageResponse = await fetch(page.image_url);
        
        if (!imageResponse.ok) {
          console.error(`Failed to fetch image for page ${page.id}: ${imageResponse.status}`);
          failedCount++;
          continue;
        }

        // Convert to base64
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
        
        // Determine the image format from the URL
        const imageFormat = page.image_url.includes('.webp') ? 'webp' : 'png';
        const base64Url = `data:image/${imageFormat};base64,${base64Data}`;

        // Update the page with base64 data
        const { error: updateError } = await supabase
          .from('story_pages')
          .update({ 
            image_url: base64Url,
            needs_base64_conversion: false
          })
          .eq('id', page.id);

        if (updateError) {
          console.error(`Failed to update page ${page.id}:`, updateError);
          failedCount++;
        } else {
          console.log(`Successfully converted page ${page.page_number} from story ${page.story_id}`);
          convertedCount++;
        }

      } catch (error) {
        console.error(`Error converting page ${page.id}:`, error);
        failedCount++;
      }
    }

    // Check if there are more pages to convert
    const { data: remainingPages, error: countError } = await supabase
      .from('story_pages')
      .select('id', { count: 'exact', head: true })
      .eq('needs_base64_conversion', true);

    const remainingCount = remainingPages ? parseInt(remainingPages) : 0;

    console.log(`Conversion batch completed: ${convertedCount} converted, ${failedCount} failed, ${remainingCount} remaining`);

    return new Response(JSON.stringify({ 
      success: true,
      converted: convertedCount,
      failed: failedCount,
      remaining: remainingCount,
      message: `Converted ${convertedCount} pages to base64 format`
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("convert-storage-to-base64: unhandled error", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error", 
      details: String(error?.message ?? error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});