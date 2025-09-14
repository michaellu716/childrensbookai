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
    console.log('Generating story with consistent character');
    
    const { 
      storyPrompt, 
      characterSheet, 
      selectedAvatarStyle,
      storySettings 
    } = await req.json();

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT (automatically handled by verify_jwt = true)
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('No authentication token provided');
    }

    // Verify token and get user
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error('Invalid authentication token');
    }

    console.log('Generating story content...');

    // Extract child name and age before generating story
    const childName = characterSheet?.name || storySettings.childName || 'Alex';
    const childAge = characterSheet?.age || storySettings.childAge || 'young';

    // Generate story structure and text
    const storyResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a children's book author who creates engaging, age-appropriate stories. 

Create a ${storySettings.length || 2}-page story based on the user's prompt. The main character is ${childName}, a ${childAge} year old child.

Return ONLY a valid JSON object with this exact structure:
{
  "title": "Story Title",
  "pages": [
    {
      "pageNumber": 1,
      "pageType": "cover",
      "text": "Title and subtitle text",
      "sceneDescription": "Cover illustration description with ${childName}"
    },
    {
      "pageNumber": 2,
      "pageType": "story",
      "text": "Page text content",
      "sceneDescription": "Detailed scene description for illustration featuring ${childName}"
    }
  ]
}

IMPORTANT: 
- Return ONLY the JSON object, no other text
- Make ${childName} the main character in every scene
- Age-appropriate for ${childAge} children
- Each page should have exactly 3 sentences of text for better storytelling flow
- The FINAL page should end with "The End" to properly conclude the story
- Create engaging, descriptive text that tells a complete story moment
- Scene descriptions should be detailed enough for consistent illustration
- Reading level: ${storySettings.readingLevel || 'early reader'}`
          },
          {
            role: 'user',
            content: `Create a story based on this prompt: "${storyPrompt}". The main character is ${childName}.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.7
      }),
    });

    if (!storyResponse.ok) {
      const errorText = await storyResponse.text();
      console.error('Story generation failed:', storyResponse.status, errorText);
      
      if (storyResponse.status === 429) {
        throw new Error('OpenAI API rate limit reached. Please wait a few minutes before trying again.');
      }
      
      throw new Error(`Story generation failed: ${storyResponse.statusText}`);
    }

    const storyData = await storyResponse.json();
    
    // Extract JSON content from markdown formatting if present
    let responseContent = storyData.choices[0].message.content;
    console.log('Raw OpenAI response (first 500 chars):', responseContent?.substring(0, 500));
    
    if (!responseContent) {
      throw new Error('Empty response from OpenAI API');
    }
    
    const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      responseContent = jsonMatch[1];
      console.log('Extracted JSON from markdown');
    }
    
    let story;
    try {
      story = JSON.parse(responseContent);
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.error('Content that failed to parse:', responseContent);
      // Fallback: create a minimal valid story so the user can proceed
      const length = Number(storySettings.length || 2);
      story = {
        title: `The Adventures of ${childName}`,
        pages: Array.from({ length }, (_, i) => ({
          pageNumber: i + 1,
          pageType: i === 0 ? 'cover' : 'story',
          text: i === 0
            ? `${childName}'s ${storySettings.themes?.[0] || 'Magical'} Journey`
            : `${childName} explores ${storySettings.themes?.[i % (storySettings.themes?.length || 1)] || 'a new place'}.`,
          sceneDescription: i === 0
            ? `Cover featuring ${childName}, age ${childAge}, smiling with a ${storySettings.themes?.[0] || 'whimsical'} background.`
            : `A simple scene of ${childName} with ${storySettings.themes?.[i % (storySettings.themes?.length || 1)] || 'friends'} in a child-friendly setting.`
        }))
      };
      console.warn('Using fallback story structure');
    }
    
    if (!story || !story.title || !story.pages) {
      // As a final safeguard, create a minimal valid story
      const length = Number(storySettings.length || 2);
      story = {
        title: `A Story for ${childName}`,
        pages: Array.from({ length }, (_, i) => ({
          pageNumber: i + 1,
          pageType: i === 0 ? 'cover' : 'story',
          text: i === 0 ? `${childName}'s Story` : `${childName} has a fun adventure.`,
          sceneDescription: i === 0 ? `Cover with ${childName}` : `Simple scene with ${childName}.`
        }))
      };
      console.warn('Constructed minimal fallback story due to invalid structure');
    }
    
    console.log('Story generated, creating database records...');

    let savedCharacterSheet = null;
    
    // Save character sheet to database only if we have one
    if (characterSheet && selectedAvatarStyle) {
      const { data, error: characterError } = await supabase
        .from('character_sheets')
        .insert({
          user_id: user.id,
          name: characterSheet.name,
          hair_color: characterSheet.hairColor,
          hair_style: characterSheet.hairStyle,
          eye_color: characterSheet.eyeColor,
          skin_tone: characterSheet.skinTone,
          typical_outfit: characterSheet.typicalOutfit,
          accessory: characterSheet.accessory,
          cartoon_reference_url: selectedAvatarStyle.imageUrl
        })
        .select()
        .maybeSingle();

      if (characterError) {
        throw new Error(`Failed to save character sheet: ${characterError.message}`);
      }
      savedCharacterSheet = data;
    }


    // Save story to database
    const { data: savedStory, error: storyError } = await supabase
      .from('stories')
      .insert({
        user_id: user.id,
        character_sheet_id: savedCharacterSheet?.id || null,
        title: story.title,
        prompt: storyPrompt,
        child_name: childName,
        child_age: childAge,
        themes: storySettings.themes || [],
        lesson: storySettings.lesson,
        tone: storySettings.tone,
        length: storySettings.length || 2,
        art_style: selectedAvatarStyle?.style || 'cartoon',
        reading_level: storySettings.readingLevel || 'early_reader',
        language: storySettings.language || 'en',
        status: 'generating'
      })
      .select()
      .maybeSingle();

    if (storyError || !savedStory) {
      throw new Error(`Failed to save story: ${storyError?.message || 'Unknown error'}`);
    }

    // Generate illustrations for each page in background
    console.log('Starting illustration generation...');
    
    // Use background task for illustrations
    EdgeRuntime.waitUntil(generateStoryIllustrations(
      savedStory.id, 
      story.pages, 
      characterSheet, 
      selectedAvatarStyle,
      supabase
    ));

    // Save story pages (text only initially)
    const pageInserts = story.pages.map((page: any) => ({
      story_id: savedStory.id,
      page_number: page.pageNumber,
      page_type: page.pageType,
      text_content: page.text,
      image_prompt: createImagePrompt(page.sceneDescription, characterSheet, selectedAvatarStyle?.style || 'cartoon')
    }));

    const { error: pagesError } = await supabase
      .from('story_pages')
      .insert(pageInserts);

    if (pagesError) {
      throw new Error(`Failed to save story pages: ${pagesError.message}`);
    }

    return new Response(JSON.stringify({ 
      storyId: savedStory.id,
      story: story,
      characterSheetId: savedCharacterSheet?.id || null,
      status: 'generating_illustrations'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-story-with-character function:', error);
    
    // Handle specific error types
    let errorMessage = 'An unexpected error occurred while generating your story.';
    
    if (error.message?.includes('rate limit') || error.message?.includes('429')) {
      errorMessage = 'OpenAI API rate limit reached. Please wait a few minutes and try again.';
    } else if (error.message?.includes('JSON')) {
      errorMessage = 'There was an issue processing the story content. Please try again.';
    } else if (error.message?.includes('authentication')) {
      errorMessage = 'Authentication error. Please sign in again.';
    } else if (error.message?.includes('quota') || error.message?.includes('billing')) {
      errorMessage = 'OpenAI API quota exceeded. Please check your billing settings.';
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
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
    // Generate all images in parallel for much faster performance
    const imagePromises = pages.map(async (page) => {
      console.log(`Generating illustration for page ${page.pageNumber}...`);
      
      const imagePrompt = createImagePrompt(page.sceneDescription, characterSheet, selectedAvatarStyle?.style || 'cartoon');
      
      try {
        // Add rate limiting delay - stagger requests to avoid hitting limits
        const delay = (page.pageNumber - 1) * 2000; // 2 second stagger between requests
        await new Promise(resolve => setTimeout(resolve, delay));
        
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
          console.error(`Failed to generate image for page ${page.pageNumber}:`, imageResponse.status, errorText);
          
          // Handle specific error types
          if (imageResponse.status === 429) {
            return { pageNumber: page.pageNumber, success: false, error: 'rate_limit', details: errorText };
          } else if (imageResponse.status === 400 && errorText.includes('content_policy_violation')) {
            return { pageNumber: page.pageNumber, success: false, error: 'content_policy', details: errorText };
          }
          
          return { pageNumber: page.pageNumber, success: false, error: 'generation_failed', details: errorText };
        }

        const imageData = await imageResponse.json();
        console.log(`Image response for page ${page.pageNumber}:`, JSON.stringify(imageData).substring(0, 200));
        
        // gpt-image-1 returns base64 directly
        const base64Data = imageData.data[0].b64_json;
        const imageUrl = `data:image/png;base64,${base64Data}`;
        console.log(`Generated image URL length for page ${page.pageNumber}:`, imageUrl.length);

        // Update story page with generated image
        const { error: updateError } = await supabase
          .from('story_pages')
          .update({ 
            image_url: imageUrl,
            image_prompt: imagePrompt
          })
          .eq('story_id', storyId)
          .eq('page_number', page.pageNumber);

        if (updateError) {
          console.error(`Failed to update page ${page.pageNumber}:`, updateError.message);
          return { pageNumber: page.pageNumber, success: false, error: updateError.message };
        } else {
          console.log(`Page ${page.pageNumber} illustration completed`);
          return { pageNumber: page.pageNumber, success: true };
        }
      } catch (error) {
        console.error(`Error generating illustration for page ${page.pageNumber}:`, error);
        return { pageNumber: page.pageNumber, success: false, error: error.message };
      }
    });

    // Wait for all images to complete (parallel execution)
    const results = await Promise.allSettled(imagePromises);
    
    // Check results
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
    
    console.log(`Initial illustration generation: ${successful} successful, ${failed} failed`);

    // After attempting all pages, verify completion
    const { data: missingPages, error: checkError } = await supabase
      .from('story_pages')
      .select('page_number')
      .eq('story_id', storyId)
      .is('image_url', null);

    if (checkError) {
      console.error('Failed to verify missing pages:', checkError);
    }

    // Retry failed pages up to 3 times
    let retryAttempts = 0;
    const maxRetries = 3;
    let remainingFailedPages = missingPages || [];

    while (remainingFailedPages.length > 0 && retryAttempts < maxRetries) {
      retryAttempts++;
      console.log(`Retry attempt ${retryAttempts} for ${remainingFailedPages.length} failed pages: ${remainingFailedPages.map(p => p.page_number).join(', ')}`);
      
      // Find the corresponding pages and retry them
      const retryPages = pages.filter(p => remainingFailedPages.some(fp => fp.page_number === p.pageNumber));
      
      const retryPromises = retryPages.map(async (page) => {
        console.log(`Retrying illustration for page ${page.pageNumber}...`);
        
        const imagePrompt = createImagePrompt(page.sceneDescription, characterSheet, selectedAvatarStyle?.style || 'cartoon');
        
        try {
          // Smart retry delays based on error type and attempt number
          let retryDelay = Math.pow(2, retryAttempts - 1) * 2000; // 2s, 4s, 8s base delay
          
          // Add extra delay for rate limiting
          if (retryAttempts > 1) {
            retryDelay += 15000; // Additional 15 seconds for rate limits
          }
          
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          
          // Try to create a safer prompt for content policy issues
          let finalPrompt = imagePrompt;
          if (retryAttempts > 1) {
            finalPrompt = createSaferImagePrompt(page.sceneDescription, characterSheet, selectedAvatarStyle?.style || 'cartoon');
          }
          
          const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openAIApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-image-1',
              prompt: finalPrompt,
              n: 1,
              size: '1024x1024',
              quality: 'medium',
              output_format: 'png'
            }),
          });

          if (!imageResponse.ok) {
            const errorText = await imageResponse.text();
            console.error(`Retry failed for page ${page.pageNumber}:`, imageResponse.status, errorText);
            
            // Log specific error types for better debugging
            if (imageResponse.status === 429) {
              console.error(`Rate limit hit on retry ${retryAttempts} for page ${page.pageNumber}`);
            } else if (imageResponse.status === 400) {
              console.error(`Content policy violation on retry ${retryAttempts} for page ${page.pageNumber}`);
            }
            
            return { pageNumber: page.pageNumber, success: false, error: errorText };
          }

          const imageData = await imageResponse.json();
          const base64Data = imageData.data[0].b64_json;
          const imageUrl = `data:image/png;base64,${base64Data}`;

          // Retry database update with timeout protection
          let updateSuccess = false;
          let updateAttempts = 0;
          const maxUpdateAttempts = 3;
          
          while (!updateSuccess && updateAttempts < maxUpdateAttempts) {
            updateAttempts++;
            try {
              const { error: updateError } = await supabase
                .from('story_pages')
                .update({ 
                  image_url: imageUrl,
                  image_prompt: imagePrompt
                })
                .eq('story_id', storyId)
                .eq('page_number', page.pageNumber);

              if (updateError) {
                console.error(`Database update attempt ${updateAttempts} failed for page ${page.pageNumber}:`, updateError.message);
                if (updateAttempts < maxUpdateAttempts) {
                  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before retry
                }
              } else {
                updateSuccess = true;
                console.log(`Page ${page.pageNumber} illustration retry successful`);
              }
            } catch (dbError) {
              console.error(`Database error on attempt ${updateAttempts} for page ${page.pageNumber}:`, dbError);
              if (updateAttempts < maxUpdateAttempts) {
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          }

          return { pageNumber: page.pageNumber, success: updateSuccess, error: updateSuccess ? null : 'Database update failed' };
        } catch (error) {
          console.error(`Error retrying illustration for page ${page.pageNumber}:`, error);
          return { pageNumber: page.pageNumber, success: false, error: error.message };
        }
      });

      await Promise.allSettled(retryPromises);

      // Check again for remaining failed pages
      const { data: stillMissingPages } = await supabase
        .from('story_pages')
        .select('page_number')
        .eq('story_id', storyId)
        .is('image_url', null);

      remainingFailedPages = stillMissingPages || [];
      console.log(`After retry ${retryAttempts}: ${remainingFailedPages.length} pages still missing`);
    }

    const totalPages = pages.length;
    const finalFailedPages = remainingFailedPages.length;
    const successRate = ((totalPages - finalFailedPages) / totalPages) * 100;
    
    // Only mark as completed if ALL images are generated (100% success rate)
    if (finalFailedPages === 0) {
      await supabase
        .from('stories')
        .update({ status: 'completed' })
        .eq('id', storyId);
      
      console.log(`Story ${storyId} illustrations completed successfully - all ${totalPages} pages have images`);
    } else {
      // Mark as failed if any images are missing
      await supabase
        .from('stories')
        .update({ status: 'failed' })
        .eq('id', storyId);
      console.warn(`Story ${storyId} marked as failed - ${finalFailedPages} of ${totalPages} pages still missing images after ${retryAttempts} retry attempts`);
    }

  } catch (error) {
    console.error('Error generating illustrations:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    // Save error to story_generations table
    try {
      await supabase
        .from('story_generations')
        .insert({
          story_id: storyId,
          generation_type: 'illustrations',
          status: 'failed',
          error_message: `Image generation failed: ${error.message || error}`
        });
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
- Hair: ${characterSheet.hairColor} ${characterSheet.hairStyle}  
- Eyes: ${characterSheet.eyeColor}
- Skin: ${characterSheet.skinTone}
- Face: ${characterSheet.faceShape} face
- Clothing: ${characterSheet.typicalOutfit}
${characterSheet.accessory ? `- Accessory: ${characterSheet.accessory}` : ''}
${characterSheet.distinctiveFeatures ? `- Features: ${characterSheet.distinctiveFeatures}` : ''}

Style: ${artStyle} art style, bright cheerful colors, safe family-friendly content, whimsical storybook illustration, detailed pleasant background, consistent character design, appealing to young children ages 3-8`;
}