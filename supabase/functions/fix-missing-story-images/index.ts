import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storyId } = await req.json();
    console.log(`Fixing missing images for story ${storyId}`);
    
    if (!storyId) {
      return new Response(JSON.stringify({ error: "Missing storyId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Get story details
    const { data: story, error: storyError } = await supabase
      .from("stories")
      .select(`
        id, title, art_style, child_name, status,
        character_sheets (
          name, hair_color, hair_style, eye_color, 
          skin_tone, typical_outfit, accessory
        )
      `)
      .eq("id", storyId)
      .single();

    if (storyError || !story) {
      console.error("Story fetch error:", storyError);
      return new Response(JSON.stringify({ error: "Story not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pages missing images
    const { data: missingPages, error: pagesError } = await supabase
      .from('story_pages')
      .select('id, page_number, text_content, image_prompt')
      .eq('story_id', storyId)
      .is('image_url', null)
      .order('page_number');

    if (pagesError) {
      console.error("Pages fetch error:", pagesError);
      return new Response(JSON.stringify({ error: "Failed to fetch missing pages" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!missingPages || missingPages.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No missing images found" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${missingPages.length} pages missing images`);

    // Generate missing images
    const results = [];
    for (const page of missingPages) {
      try {
        const imagePrompt = page.image_prompt || createImagePrompt(page.text_content, story.character_sheets, story.art_style);
        
        console.log(`Generating image for page ${page.page_number}...`);

        const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-image-1',
            prompt: imagePrompt,
            n: 1,
            size: '1024x1024',
            quality: 'medium',
            output_format: 'png'
          }),
        });

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text();
          console.error(`Failed to generate image for page ${page.page_number}:`, errorText);
          results.push({ page: page.page_number, success: false, error: errorText });
          continue;
        }

        const imageData = await imageResponse.json();
        const base64Data = imageData.data[0].b64_json;
        
        // Convert base64 to binary data for storage
        const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        // Upload to Supabase Storage (PNG format for PDF compatibility)
        const fileName = `story-${storyId}/page-${page.page_number}-fix-${Date.now()}.png`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('story-images')
          .upload(fileName, imageBuffer, {
            contentType: 'image/png',
            cacheControl: '3600'
          });

        if (uploadError) {
          console.error(`Failed to upload image for page ${page.page_number}:`, uploadError);
          results.push({ page: page.page_number, success: false, error: uploadError.message });
          continue;
        }

        // Get the public URL
        const { data: { publicUrl } } = supabase.storage
          .from('story-images')
          .getPublicUrl(fileName);

        // Update the page with the image URL
        const { error: updateError } = await supabase
          .from('story_pages')
          .update({ 
            image_url: publicUrl,
            image_prompt: imagePrompt
          })
          .eq('id', page.id);

        if (updateError) {
          console.error(`Failed to update page ${page.page_number}:`, updateError);
          results.push({ page: page.page_number, success: false, error: updateError.message });
        } else {
          console.log(`Successfully fixed page ${page.page_number}`);
          results.push({ page: page.page_number, success: true, imageUrl: publicUrl });
        }

        // Add delay between requests
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error processing page ${page.page_number}:`, error);
        results.push({ page: page.page_number, success: false, error: error.message });
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Fixed ${results.filter(r => r.success).length} of ${results.length} missing images`,
      results: results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in fix-missing-story-images function:", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error", 
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function createImagePrompt(sceneDescription: string, characterSheet: any, artStyle: string): string {
  // Sanitize scene description
  const safeSceneDescription = sceneDescription
    .replace(/\b(fight|battle|violence|scary|dangerous|weapon|hurt|pain)\b/gi, 'adventure')
    .replace(/\b(dark|darkness|shadow|gloomy)\b/gi, 'mysterious')
    .replace(/\b(monster|beast|creature)\b/gi, 'friendly character');

  if (!characterSheet) {
    return `Create a wholesome ${artStyle} children's book illustration showing: ${safeSceneDescription}

Style: ${artStyle} art style, bright cheerful colors, safe family-friendly content, whimsical storybook illustration, detailed pleasant background, appealing to young children ages 3-8`;
  }

  return `Create a wholesome ${artStyle} children's book illustration showing: ${safeSceneDescription}

Character appearance (maintain consistency):
- Child named ${characterSheet.name}
- Hair: ${characterSheet.hair_color} ${characterSheet.hair_style}  
- Eyes: ${characterSheet.eye_color}
- Skin: ${characterSheet.skin_tone}
- Clothing: ${characterSheet.typical_outfit}
${characterSheet.accessory ? `- Accessory: ${characterSheet.accessory}` : ''}

Style: ${artStyle} art style, bright cheerful colors, safe family-friendly content, whimsical storybook illustration, detailed pleasant background, consistent character design, appealing to young children ages 3-8`;
}