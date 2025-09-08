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
- Each page should have 1-3 sentences of text (keep it simple)
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
    for (const page of pages) {
      console.log(`Generating illustration for page ${page.pageNumber}...`);
      
      const imagePrompt = createImagePrompt(page.sceneDescription, characterSheet, selectedAvatarStyle?.style || 'cartoon');
      
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
        console.error(`Failed to generate image for page ${page.pageNumber}:`, imageResponse.status, errorText);
        continue;
      }

      const imageData = await imageResponse.json();
      console.log(`Image response for page ${page.pageNumber}:`, JSON.stringify(imageData).substring(0, 200));
      
      // DALL-E-3 returns base64 in b64_json format
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
      } else {
        console.log(`Page ${page.pageNumber} illustration completed`);
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
      // All good -> mark story as completed
      await supabase
        .from('stories')
        .update({ status: 'completed' })
        .eq('id', storyId);
      console.log(`Story ${storyId} illustrations completed successfully`);
    } else {
      // Some pages failed -> mark as failed so UI can prompt retry
      await supabase
        .from('stories')
        .update({ status: 'failed' })
        .eq('id', storyId);
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

function createImagePrompt(sceneDescription: string, characterSheet: any, artStyle: string): string {
  if (!characterSheet) {
    return `${artStyle} illustration: ${sceneDescription}

Style requirements: ${artStyle}, child-friendly, warm colors, storybook illustration, high quality, detailed background, appealing to children`;
  }

  return `${artStyle} illustration: ${sceneDescription}

Main character details (MUST be consistent):
- Name: ${characterSheet.name}
- Hair: ${characterSheet.hairColor} ${characterSheet.hairStyle}
- Eyes: ${characterSheet.eyeColor}
- Skin: ${characterSheet.skinTone}
- Face: ${characterSheet.faceShape} face
- Outfit: ${characterSheet.typicalOutfit}
${characterSheet.accessory ? `- Accessory: ${characterSheet.accessory}` : ''}
${characterSheet.distinctiveFeatures ? `- Features: ${characterSheet.distinctiveFeatures}` : ''}

Style requirements: ${artStyle}, child-friendly, warm colors, storybook illustration, high quality, detailed background, consistent character design, appealing to children`;
}