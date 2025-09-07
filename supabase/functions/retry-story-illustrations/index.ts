import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    console.log('Retrying story illustrations');
    
    const { storyId } = await req.json();

    if (!storyId) {
      throw new Error('Story ID is required');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('No authentication token provided');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }

    // Verify story belongs to user
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('*, character_sheets(*)')
      .eq('id', storyId)
      .eq('user_id', user.id)
      .single();

    if (storyError || !story) {
      throw new Error('Story not found or unauthorized');
    }

    // Get story pages that need illustrations
    const { data: pages, error: pagesError } = await supabase
      .from('story_pages')
      .select('*')
      .eq('story_id', storyId)
      .order('page_number');

    if (pagesError || !pages) {
      throw new Error('Failed to fetch story pages');
    }

    // Update story status to generating
    await supabase
      .from('stories')
      .update({ status: 'generating' })
      .eq('id', storyId);

    // Create generation record
    await supabase
      .from('story_generations')
      .insert({
        story_id: storyId,
        generation_type: 'illustrations',
        status: 'pending'
      });

    console.log(`Starting retry illustration generation for story ${storyId}...`);

    // Start background illustration generation
    EdgeRuntime.waitUntil(generateStoryIllustrations(
      storyId,
      pages,
      story.character_sheets,
      { style: story.art_style },
      supabase
    ));

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Illustration generation retry started'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in retry-story-illustrations function:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Failed to retry illustrations',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateStoryIllustrations(
  storyId: string, 
  pages: any[], 
  characterSheet: any, 
  selectedAvatarStyle: any,
  supabase: any
) {
  console.log(`Generating illustrations for story ${storyId}...`);
  
  try {
    // Mark generation as in progress
    await supabase
      .from('story_generations')
      .update({ status: 'in_progress' })
      .eq('story_id', storyId)
      .eq('generation_type', 'illustrations')
      .eq('status', 'pending');

    for (const page of pages) {
      console.log(`Generating illustration for page ${page.page_number}...`);
      
      const imagePrompt = createImagePrompt(page.image_prompt || `${selectedAvatarStyle?.style || 'cartoon'} illustration: ${page.text_content}`, characterSheet, selectedAvatarStyle?.style || 'cartoon');
      
      const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: imagePrompt,
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          response_format: 'b64_json'
        }),
      });

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        console.error(`Failed to generate image for page ${page.page_number}:`, imageResponse.status, errorText);
        continue;
      }

      const imageData = await imageResponse.json();
      console.log(`Image response for page ${page.page_number}:`, JSON.stringify(imageData).substring(0, 200));
      
      // DALL-E-3 returns base64 in b64_json format
      const base64Data = imageData.data[0].b64_json;
      const imageUrl = `data:image/png;base64,${base64Data}`;
      console.log(`Generated image URL length for page ${page.page_number}:`, imageUrl.length);

      // Update story page with generated image
      const { error: updateError } = await supabase
        .from('story_pages')
        .update({ 
          image_url: imageUrl,
          image_prompt: imagePrompt
        })
        .eq('story_id', storyId)
        .eq('page_number', page.page_number);

      if (updateError) {
        console.error(`Failed to update page ${page.page_number}:`, updateError.message);
      } else {
        console.log(`Page ${page.page_number} illustration completed`);
      }
    }

    // After attempting all pages, verify completion
    const { data: missingPages, error: checkError } = await supabase
      .from('story_pages')
      .select('page_number')
      .eq('story_id', storyId)
      .is('image_url', null);

    if (checkError) {
      console.error('Failed to verify missing pages:', checkError);
    }

    if (!missingPages || missingPages.length === 0) {
      // All good -> mark story and generation as completed
      await supabase
        .from('stories')
        .update({ status: 'completed' })
        .eq('id', storyId);
      
      await supabase
        .from('story_generations')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('story_id', storyId)
        .eq('generation_type', 'illustrations')
        .eq('status', 'in_progress');
        
      console.log(`Story ${storyId} illustrations completed successfully`);
    } else {
      // Some pages failed -> mark as failed
      await supabase
        .from('stories')
        .update({ status: 'failed' })
        .eq('id', storyId);
        
      await supabase
        .from('story_generations')
        .update({ 
          status: 'failed',
          error_message: `${missingPages.length} pages failed to generate illustrations`
        })
        .eq('story_id', storyId)
        .eq('generation_type', 'illustrations')
        .eq('status', 'in_progress');
        
      console.warn(`Story ${storyId} has ${missingPages.length} pages without images. Marked as failed.`);
    }

  } catch (error) {
    console.error('Error generating illustrations:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    // Save error to story_generations table
    try {
      await supabase
        .from('story_generations')
        .update({
          status: 'failed',
          error_message: `Image generation failed: ${error.message || error}`
        })
        .eq('story_id', storyId)
        .eq('generation_type', 'illustrations')
        .eq('status', 'in_progress');
    } catch (dbError) {
      console.error('Failed to save generation error:', dbError);
    }
    
    // Mark story as failed
    try {
      await supabase
        .from('stories')
        .update({ status: 'failed' })
        .eq('id', storyId);
      console.log(`Story ${storyId} marked as failed due to illustration generation error`);
    } catch (dbError) {
      console.error('Failed to update story status to failed:', dbError);
    }
  }
}

function createImagePrompt(sceneDescription: string, characterSheet: any, artStyle: string): string {
  if (!characterSheet) {
    return `${artStyle} illustration: ${sceneDescription}

Style requirements: ${artStyle}, child-friendly, warm colors, storybook illustration, high quality, detailed background, appealing to children`;
  }

  return `${artStyle} illustration: ${sceneDescription}

Main character details (MUST be consistent):
- Name: ${characterSheet.name}
- Hair: ${characterSheet.hair_color} ${characterSheet.hair_style}
- Eyes: ${characterSheet.eye_color}
- Skin: ${characterSheet.skin_tone}
- Face: ${characterSheet.face_shape} face
- Outfit: ${characterSheet.typical_outfit}
${characterSheet.accessory ? `- Accessory: ${characterSheet.accessory}` : ''}
${characterSheet.distinctive_features ? `- Features: ${characterSheet.distinctive_features}` : ''}

Style requirements: ${artStyle}, child-friendly, warm colors, storybook illustration, high quality, detailed background, consistent character design, appealing to children`;
}