import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  console.log('generate-page-image: Request received', { method: req.method, url: req.url });
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('generate-page-image: Request body:', body);
    const { storyId, pageNumber, customPrompt } = body;
    
    if (!storyId || !pageNumber) {
      return new Response(JSON.stringify({ error: "Missing storyId or pageNumber" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("Missing Supabase environment variables");
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Forward the client's auth so RLS applies correctly
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get story and character details
    const { data: story, error: storyError } = await supabase
      .from("stories")
      .select("*, character_sheets(*)")
      .eq("id", storyId)
      .single();

    if (storyError || !story) {
      console.error("generate-page-image: storyError", storyError);
      return new Response(JSON.stringify({ error: "Story not found or unauthorized" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the specific page
    const { data: page, error: pageError } = await supabase
      .from("story_pages")
      .select("*")
      .eq("story_id", storyId)
      .eq("page_number", pageNumber)
      .single();

    if (pageError || !page) {
      console.error("generate-page-image: pageError", pageError);
      return new Response(JSON.stringify({ error: "Page not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating image for page ${pageNumber} with text: ${page.text_content}`);

    // Create image prompt using the page text or custom prompt
    const sceneDescription = customPrompt || page.text_content;
    const imagePrompt = createImagePrompt(sceneDescription, story.character_sheets, story.art_style);
    
    console.log('Generated prompt:', imagePrompt);

    // Generate image using OpenAI
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
        quality: 'high',
        output_format: 'webp'
      }),
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error(`Failed to generate image:`, imageResponse.status, errorText);
      return new Response(JSON.stringify({ 
        error: "Failed to generate image", 
        details: errorText 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageData = await imageResponse.json();
    console.log(`Image generated successfully for page ${pageNumber}`);
    
    // GPT-Image-1 returns base64 data directly
    const base64Data = imageData.data[0].b64_json;
    const imageUrl = `data:image/webp;base64,${base64Data}`;

    // Update the page with the new image
    const { error: updateError } = await supabase
      .from('story_pages')
      .update({ 
        image_url: imageUrl,
        image_prompt: imagePrompt
      })
      .eq('story_id', storyId)
      .eq('page_number', pageNumber);

    if (updateError) {
      console.error(`Failed to update page ${pageNumber}:`, updateError);
      return new Response(JSON.stringify({ 
        error: "Failed to save image", 
        details: updateError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Page ${pageNumber} image updated successfully`);

    return new Response(JSON.stringify({ 
      success: true,
      imageUrl: imageUrl,
      page: pageNumber,
      prompt: imagePrompt
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("generate-page-image: unhandled error", error);
    return new Response(JSON.stringify({ 
      error: "Internal server error", 
      details: String(error?.message ?? error) 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function createImagePrompt(sceneDescription: string, characterSheet: any, artStyle: string): string {
  // Sanitize scene description to avoid safety system triggers
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
${characterSheet.distinctive_features ? `- Features: ${characterSheet.distinctive_features}` : ''}

Style: ${artStyle} art style, bright cheerful colors, safe family-friendly content, whimsical storybook illustration, detailed pleasant background, consistent character design, appealing to young children ages 3-8`;
}