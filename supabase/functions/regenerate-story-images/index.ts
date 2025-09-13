import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Regenerating story images ===');
    
    const { storyId } = await req.json();
    console.log('Story ID:', storyId);

    if (!storyId) {
      throw new Error('Story ID is required');
    }

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get story details (no authentication required for public stories)
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select(`
        id, title, art_style, child_name, status,
        character_sheets (
          name, hair_color, hair_style, eye_color, 
          skin_tone, typical_outfit, accessory
        )
      `)
      .eq('id', storyId)
      .single();

    if (storyError || !story) {
      console.error('Story fetch error:', storyError);
      throw new Error('Story not found');
    }

    console.log('Found story:', story.title);

    // Get story pages that need images
    const { data: pages, error: pagesError } = await supabase
      .from('story_pages')
      .select('id, page_number, text_content, image_prompt, image_url')
      .eq('story_id', storyId)
      .order('page_number');

    if (pagesError || !pages) {
      console.error('Pages fetch error:', pagesError);
      throw new Error('Failed to fetch story pages');
    }

    console.log(`Found ${pages.length} pages to process`);

    // Update story status to generating
    await supabase
      .from('stories')
      .update({ status: 'generating' })
      .eq('id', storyId);

    // Start regenerating images
    const results = await regenerateImages(storyId, pages, story, supabase);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Image regeneration completed',
      results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in regenerate-story-images function:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Failed to regenerate images',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function regenerateImages(storyId: string, pages: any[], story: any, supabase: any) {
  const results = [];
  let successCount = 0;

  console.log(`Starting image generation for ${pages.length} pages...`);

  for (const page of pages) {
    try {
      console.log(`Generating image for page ${page.page_number}...`);
      
      // Create image prompt
      const imagePrompt = createImagePrompt(
        page.image_prompt || page.text_content, 
        story.character_sheets, 
        story.art_style || 'cartoon'
      );

      console.log(`Prompt for page ${page.page_number}:`, imagePrompt.substring(0, 200) + '...');

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
          output_format: 'png'
        }),
      });

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        console.error(`OpenAI API error for page ${page.page_number}:`, imageResponse.status, errorText);
        results.push({ 
          page: page.page_number, 
          success: false, 
          error: `API error: ${imageResponse.status}` 
        });
        continue;
      }

      const imageData = await imageResponse.json();
      
      // For gpt-image-1, the response format is different
      let imageUrl;
      if (imageData.data && imageData.data[0]) {
        // gpt-image-1 returns base64 data directly
        const base64Data = imageData.data[0].b64_json || imageData.data[0].url;
        if (base64Data && base64Data.startsWith('data:')) {
          imageUrl = base64Data;
        } else if (base64Data) {
          imageUrl = `data:image/png;base64,${base64Data}`;
        } else {
          throw new Error('No image data received');
        }
      } else {
        throw new Error('Invalid response format from OpenAI');
      }

      console.log(`Generated image for page ${page.page_number}, size: ${imageUrl.length} characters`);

      // Update the page with the new image
      const { error: updateError } = await supabase
        .from('story_pages')
        .update({ 
          image_url: imageUrl,
          image_prompt: imagePrompt
        })
        .eq('id', page.id);

      if (updateError) {
        console.error(`Failed to update page ${page.page_number}:`, updateError);
        results.push({ 
          page: page.page_number, 
          success: false, 
          error: updateError.message 
        });
      } else {
        console.log(`Successfully updated page ${page.page_number}`);
        successCount++;
        results.push({ 
          page: page.page_number, 
          success: true 
        });
      }

    } catch (error) {
      console.error(`Error processing page ${page.page_number}:`, error);
      results.push({ 
        page: page.page_number, 
        success: false, 
        error: error.message 
      });
    }
  }

  // Update story status based on results
  const successRate = (successCount / pages.length) * 100;
  const finalStatus = successRate >= 50 ? 'completed' : 'failed';
  
  await supabase
    .from('stories')
    .update({ status: finalStatus })
    .eq('id', storyId);

  console.log(`Image regeneration complete: ${successCount}/${pages.length} successful (${successRate.toFixed(1)}%)`);
  console.log('Results:', results);

  return results;
}

function createImagePrompt(sceneDescription: string, characterSheet: any, artStyle: string): string {
  // Clean and enhance the scene description
  const cleanDescription = sceneDescription
    .replace(/Create a.*?showing:\s*/i, '')
    .replace(/Character appearance.*$/is, '')
    .replace(/Style:.*$/is, '')
    .trim();

  if (!characterSheet) {
    return `Create a wholesome ${artStyle} children's book illustration showing: ${cleanDescription}

Style: ${artStyle} art style, bright cheerful colors, safe family-friendly content, whimsical storybook illustration, detailed pleasant background, appealing to young children ages 3-8`;
  }

  return `Create a wholesome ${artStyle} children's book illustration showing: ${cleanDescription}

Character appearance (maintain consistency):
- Child named ${characterSheet.name}
- Hair: ${characterSheet.hair_color} ${characterSheet.hair_style}  
- Eyes: ${characterSheet.eye_color}
- Skin: ${characterSheet.skin_tone}
- Clothing: ${characterSheet.typical_outfit}
${characterSheet.accessory ? `- Accessory: ${characterSheet.accessory}` : ''}

Style: ${artStyle} art style, bright cheerful colors, safe family-friendly content, whimsical storybook illustration, detailed pleasant background, consistent character design, appealing to young children ages 3-8`;
}