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
    console.log('Creating character sheet from uploaded photo');
    
    const { photoUrl, childName, childAge } = await req.json();
    
    if (!photoUrl || !childName) {
      throw new Error('Photo URL and child name are required');
    }

    console.log('Analyzing photo to extract character features...');
    
    // Use GPT-4o-mini with vision to analyze the photo and extract character features
    const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: `You are an expert character designer who analyzes children's photos to create character sheets for cartoon illustrations. 

Analyze the uploaded photo and extract these character features in JSON format:
{
  "hairColor": "descriptive color (e.g., golden blonde, dark brown, auburn)",
  "hairStyle": "detailed style (e.g., curly shoulder-length, straight bob with bangs, messy wavy)",
  "eyeColor": "specific color (e.g., bright blue, warm brown, green with gold flecks)",
  "skinTone": "natural description (e.g., fair with rosy cheeks, warm medium, rich dark)",
  "typicalOutfit": "child-appropriate clothing style (e.g., colorful t-shirt and jeans, flowy dress, overalls)",
  "accessory": "optional distinctive item (e.g., glasses, hair bow, favorite hat)",
  "faceShape": "basic shape (round, oval, heart-shaped)",
  "distinctiveFeatures": "notable characteristics (dimples, freckles, smile style)"
}

Be specific and detailed to ensure consistent character generation. Focus on features that make this child unique.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Please analyze this photo of ${childName} (age ${childAge || 'unknown'}) and create a detailed character sheet.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: photoUrl
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      }),
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('Vision API error:', visionResponse.status, errorText);
      
      if (visionResponse.status === 429) {
        throw new Error('OpenAI API rate limit reached. Please try again in a few minutes or skip the photo feature for now.');
      }
      
      throw new Error(`Vision analysis failed: ${visionResponse.statusText}`);
    }

    const visionData = await visionResponse.json();
    
    // Extract JSON content from markdown formatting if present
    let responseContent = visionData.choices[0].message.content;
    const jsonMatch = responseContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      responseContent = jsonMatch[1];
    }
    
    const characterFeatures = JSON.parse(responseContent);
    
    console.log('Character features extracted:', characterFeatures);

    // Generate 3 cartoon avatar styles
    console.log('Generating cartoon avatar styles...');
    
    const avatarStyles = ['Disney-style cartoon', 'Pixar-style 3D cartoon', 'Studio Ghibli-style illustration'];
    const generatedAvatars = [];
    
    console.log('Starting avatar generation for styles:', avatarStyles);

    for (let i = 0; i < avatarStyles.length; i++) {
      const style = avatarStyles[i];
      console.log(`Generating ${style} avatar...`);
      
      const prompt = `Create a ${style} portrait of a child character based on these features:
- Hair: ${characterFeatures.hairColor} ${characterFeatures.hairStyle}
- Eyes: ${characterFeatures.eyeColor}
- Skin: ${characterFeatures.skinTone}
- Face: ${characterFeatures.faceShape} face
- Outfit: ${characterFeatures.typicalOutfit}
${characterFeatures.accessory ? `- Accessory: ${characterFeatures.accessory}` : ''}
${characterFeatures.distinctiveFeatures ? `- Features: ${characterFeatures.distinctiveFeatures}` : ''}

Style: ${style}, child-friendly, warm and appealing, suitable for a children's storybook, clean background, high quality illustration`;

      const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: prompt,
          n: 1,
          size: '1024x1024',
          quality: 'high',
          output_format: 'png'
        }),
      });

      if (!imageResponse.ok) {
        const errorText = await imageResponse.text();
        console.error(`Failed to generate ${style} avatar:`, imageResponse.status, errorText);
        continue;
      }

      const imageData = await imageResponse.json();
      
      // gpt-image-1 returns base64 directly, not in a data array like DALL-E
      const imageBase64 = imageData.data ? imageData.data[0].b64_json : imageData.b64_json;
      
      if (imageBase64) {
        generatedAvatars.push({
          style: style,
          imageUrl: `data:image/png;base64,${imageBase64}`,
          prompt: prompt
        });
        console.log(`Successfully generated ${style} avatar`);
      } else {
        console.error(`No image data received for ${style} avatar`);
      }
    }

    console.log(`Generated ${generatedAvatars.length} avatar styles`);

    const characterSheet = {
      name: childName,
      age: childAge,
      ...characterFeatures,
      generatedAvatars,
      photoUrl // Keep temporarily for avatar selection
    };

    return new Response(JSON.stringify({ characterSheet }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-character-sheet function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});