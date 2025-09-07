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
        model: 'gpt-5-2025-08-07',
        messages: [
          {
            role: 'system',
            content: `You are a children's book author who creates engaging, age-appropriate stories. 

Create a ${storySettings.length || 8}-page story based on the user's prompt. The main character is ${childName}, a ${childAge} year old child.

Return the story as a JSON object with this structure:
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
    // ... more pages
  ]
}

Requirements:
- Make ${childName} the main character in every scene
- Age-appropriate for ${childAge} children
- Include moral lessons and positive themes
- Each page should have 1-3 sentences of text (keep it simple)
- Scene descriptions should be detailed enough for consistent illustration
- Vary the backgrounds and settings while keeping ${childName} as the focus
- Reading level: ${storySettings.readingLevel || 'early reader'}`
          },
          {
            role: 'user',
            content: `Create a story based on this prompt: "${storyPrompt}". The main character is ${childName}.`
          }
        ],
        max_completion_tokens: 2000,
        
      }),
    });

    if (!storyResponse.ok) {
      const errorText = await storyResponse.text();
      console.error('Story generation failed:', storyResponse.status, errorText);
      throw new Error(`Story generation failed: ${storyResponse.statusText}`);
    }

    const storyData = await storyResponse.json();
    
    // Extract JSON content from markdown formatting if present
    let responseContent = storyData.choices[0].message.content;
    console.log('Raw OpenAI response:', responseContent.substring(0, 200));
    
    const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      responseContent = jsonMatch[1];
      console.log('Extracted JSON from markdown');
    }
    
    const story = JSON.parse(responseContent);
    
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
        length: storySettings.length || 8,
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
    return new Response(JSON.stringify({ error: error.message }), {
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
          model: 'gpt-image-1',
          prompt: imagePrompt,
          n: 1,
          size: '1024x1024',
          quality: 'high',
          output_format: 'png'
        }),
      });

      if (!imageResponse.ok) {
        console.error(`Failed to generate image for page ${page.pageNumber}:`, imageResponse.statusText);
        continue;
      }

      const imageData = await imageResponse.json();
      const imageUrl = `data:image/png;base64,${imageData.data[0].b64_json}`;

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

    // Mark story as completed
    await supabase
      .from('stories')
      .update({ status: 'completed' })
      .eq('id', storyId);

    console.log(`Story ${storyId} illustrations completed`);

  } catch (error) {
    console.error('Error generating illustrations:', error);
    
    // Mark story as failed
    await supabase
      .from('stories')
      .update({ status: 'failed' })
      .eq('id', storyId);
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