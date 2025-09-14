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

    // Forward the client's auth so RLS applies correctly
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get story (RLS will ensure user can only access their own stories)
    const { data: story, error: storyError } = await supabaseClient
      .from('stories')
      .select('*, character_sheets(*)')
      .eq('id', storyId)
      .single();

    if (storyError || !story) {
      throw new Error('Story not found or unauthorized');
    }

    // Get story pages that need illustrations
    const { data: pages, error: pagesError } = await supabaseClient
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

    // Process pages with staggered timing to avoid rate limits
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      console.log(`Generating illustration for page ${page.page_number}...`);
      
      // Add staggered delay to avoid rate limiting
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second delay between requests
      }
      
      const imagePrompt = createImagePrompt(page.image_prompt || `${selectedAvatarStyle?.style || 'cartoon'} illustration: ${page.text_content}`, characterSheet, selectedAvatarStyle?.style || 'cartoon');
      
      let attempts = 0;
      let success = false;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts && !success) {
        attempts++;
        
        try {
          // Use progressively safer prompts on retries
          const finalPrompt = attempts > 1 ? createSaferImagePrompt(page.text_content, characterSheet, selectedAvatarStyle?.style || 'cartoon') : imagePrompt;
          
          const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-image-1', // Use faster, more reliable model
              prompt: finalPrompt,
              n: 1,
              size: '1024x1024',
              quality: 'medium',
              output_format: 'png'
            }),
          });

          if (!imageResponse.ok) {
            const errorText = await imageResponse.text();
            console.error(`Failed to generate image for page ${page.page_number} (attempt ${attempts}):`, imageResponse.status, errorText);
            
            if (attempts < maxAttempts) {
              // Wait longer between retries, especially for rate limits
              const retryDelay = imageResponse.status === 429 ? 30000 : 10000; // 30s for rate limits, 10s for others
              await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
            continue;
          }

          const imageData = await imageResponse.json();
          console.log(`Image response for page ${page.page_number}:`, JSON.stringify(imageData).substring(0, 200));
          
          // gpt-image-1 returns base64 directly
          const base64Data = imageData.data[0].b64_json;
          const imageUrl = `data:image/png;base64,${base64Data}`;
          console.log(`Generated image URL length for page ${page.page_number}:`, imageUrl.length);

          // Retry database updates with better error handling
          let updateAttempts = 0;
          let updateSuccess = false;
          
          while (updateAttempts < 3 && !updateSuccess) {
            updateAttempts++;
            
            try {
              const { error: updateError } = await supabase
                .from('story_pages')
                .update({ 
                  image_url: imageUrl,
                  image_prompt: finalPrompt
                })
                .eq('story_id', storyId)
                .eq('page_number', page.page_number);

              if (updateError) {
                console.error(`Database update attempt ${updateAttempts} failed for page ${page.page_number}:`, updateError.message);
                if (updateAttempts < 3) {
                  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s before retry
                }
              } else {
                updateSuccess = true;
                success = true;
                console.log(`Page ${page.page_number} illustration completed`);
              }
            } catch (dbError) {
              console.error(`Database error on update attempt ${updateAttempts} for page ${page.page_number}:`, dbError);
              if (updateAttempts < 3) {
                await new Promise(resolve => setTimeout(resolve, 3000));
              }
            }
          }
          
          if (!updateSuccess) {
            console.error(`Failed to save image for page ${page.page_number} after all database retry attempts`);
          }
          
        } catch (error) {
          console.error(`Error generating illustration for page ${page.page_number} (attempt ${attempts}):`, error);
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10s delay before retry
          }
        }
      }
      
      if (!success) {
        console.error(`Failed to generate image for page ${page.page_number} after ${maxAttempts} attempts`);
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

    const totalPages = pages.length;
    const failedPages = missingPages?.length || 0;
    const successRate = ((totalPages - failedPages) / totalPages) * 100;
    
    // Mark as completed if at least 75% of illustrations succeeded
    if (successRate >= 75) {
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
      
      if (failedPages > 0) {
        console.log(`Story ${storyId} completed with ${failedPages} failed illustrations (${successRate.toFixed(1)}% success rate)`);
      } else {
        console.log(`Story ${storyId} illustrations completed successfully`);
      }
    } else {
      // Mark as failed only if success rate is below 75%
      await supabase
        .from('stories')
        .update({ status: 'failed' })
        .eq('id', storyId);
        
      await supabase
        .from('story_generations')
        .update({ 
          status: 'failed',
          error_message: `Only ${successRate.toFixed(1)}% success rate - ${failedPages}/${totalPages} pages failed`
        })
        .eq('story_id', storyId)
        .eq('generation_type', 'illustrations')
        .eq('status', 'in_progress');
        
      console.warn(`Story ${storyId} marked as failed - only ${successRate.toFixed(1)}% success rate (${failedPages}/${totalPages} pages failed)`);
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

function createSaferImagePrompt(sceneDescription: string, characterSheet: any, artStyle: string): string {
  // More aggressive sanitization for retry attempts
  const verySecureDescription = sceneDescription
    .replace(/\b(fight|battle|violence|scary|dangerous|weapon|hurt|pain|fear|afraid|terror|nightmare)\b/gi, 'play')
    .replace(/\b(dark|darkness|shadow|gloomy|night|black)\b/gi, 'bright')
    .replace(/\b(monster|beast|creature|dragon|witch|ghost)\b/gi, 'friendly animal')
    .replace(/\b(lost|alone|sad|crying|worried|anxious)\b/gi, 'happy')
    .replace(/\b(fire|flame|burn|smoke)\b/gi, 'sparkles')
    .replace(/\b(storm|rain|thunder|lightning)\b/gi, 'sunshine');

  if (!characterSheet) {
    return `A simple ${artStyle} children's book illustration: ${verySecureDescription}. Happy, colorful, safe content for young children. Bright cartoon style with cheerful colors.`;
  }

  return `A simple ${artStyle} children's book illustration: ${verySecureDescription}. 
Main character: child with ${characterSheet.hair_color} hair, ${characterSheet.eye_color} eyes, ${characterSheet.skin_tone} skin.
Happy, colorful, safe content for young children. Bright cartoon style with cheerful colors.`;
}

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
- Face: ${characterSheet.face_shape} face
- Clothing: ${characterSheet.typical_outfit}
${characterSheet.accessory ? `- Accessory: ${characterSheet.accessory}` : ''}
${characterSheet.distinctive_features ? `- Features: ${characterSheet.distinctive_features}` : ''}

Style: ${artStyle} art style, bright cheerful colors, safe family-friendly content, whimsical storybook illustration, detailed pleasant background, consistent character design, appealing to young children ages 3-8`;
}