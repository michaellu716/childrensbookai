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
  "hairColor": "descriptive color (e.g., golden blonde, dark brown, auburn, black)",
  "hairStyle": "detailed style (e.g., curly shoulder-length, straight bob with bangs, messy wavy, tight curls, braids)",
  "hairTexture": "texture description (e.g., straight, wavy, curly, coily, kinky)",
  "eyeColor": "specific color (e.g., bright blue, warm brown, green with gold flecks, dark brown, hazel)",
  "eyeShape": "eye shape (e.g., almond-shaped, round, wide-set, narrow)",
  "skinTone": "detailed skin description with ethnicity context (e.g., fair peachy European, warm golden Latino, rich brown African, olive Mediterranean, tan Asian)",
  "facialStructure": "bone structure details (e.g., round cheeks, high cheekbones, broad nose, narrow nose, full lips, thin lips)",
  "ethnicity": "apparent ethnic background (e.g., African American, Latino/Hispanic, Asian, Caucasian, Middle Eastern, Mixed)",
  "typicalOutfit": "child-appropriate clothing style (e.g., colorful t-shirt and jeans, flowy dress, overalls)",
  "accessory": "optional distinctive item (e.g., glasses, hair bow, favorite hat)",
  "faceShape": "basic shape (round, oval, heart-shaped, square)",
  "distinctiveFeatures": "notable characteristics (dimples, freckles, smile style, birthmarks, unique features)"
}

CRITICAL: Pay very close attention to racial and ethnic characteristics. Be specific about skin tone, hair texture, facial structure, and ethnic features. This is essential for accurate character representation.`
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

    // Generate 3 cartoon avatar styles in parallel for much faster generation
    console.log('Generating cartoon avatar styles...');
    
    const avatarStyles = ['Disney-style cartoon', 'Pixar-style 3D cartoon', 'Studio Ghibli-style illustration'];
    
    console.log('Starting avatar generation for styles:', avatarStyles);

    // Generate all avatars in parallel
    const avatarPromises = avatarStyles.map(async (style) => {
      const prompt = `Create a ${style} portrait of a child character based on these features:
- Hair: ${characterFeatures.hairColor} ${characterFeatures.hairStyle}${characterFeatures.hairTexture ? ` with ${characterFeatures.hairTexture} texture` : ''}
- Eyes: ${characterFeatures.eyeColor}${characterFeatures.eyeShape ? ` ${characterFeatures.eyeShape} eyes` : ''}
- Skin: ${characterFeatures.skinTone}
- Face: ${characterFeatures.faceShape} face${characterFeatures.facialStructure ? ` with ${characterFeatures.facialStructure}` : ''}
- Ethnicity: ${characterFeatures.ethnicity || 'as shown in reference'}
- Outfit: ${characterFeatures.typicalOutfit}
${characterFeatures.accessory ? `- Accessory: ${characterFeatures.accessory}` : ''}
${characterFeatures.distinctiveFeatures ? `- Features: ${characterFeatures.distinctiveFeatures}` : ''}

IMPORTANT: Maintain authentic racial and ethnic representation. Keep skin tone, facial features, hair texture, and ethnic characteristics accurate to the description. 

Style: ${style}, child-friendly, warm and appealing, suitable for a children's storybook, clean background, high quality illustration`;

      console.log(`Generating ${style} avatar with prompt:`, prompt);
      
      try {
        const imageResponse = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-image-1',  // Faster than dall-e-3
            prompt: prompt,
            n: 1,
            size: '1024x1024',
            quality: 'medium',  // Faster than high quality
            output_format: 'png'
          }),
        });

        if (!imageResponse.ok) {
          const errorText = await imageResponse.text();
          console.error(`Failed to generate ${style} avatar:`, imageResponse.status, errorText);
          return null;
        }

        const imageData = await imageResponse.json();
        console.log(`Image response for ${style}:`, {
          hasData: !!imageData.data,
          dataLength: imageData.data?.length || 0,
          firstImageKeys: imageData.data?.[0] ? Object.keys(imageData.data[0]) : []
        });
        
        // Handle gpt-image-1 response format (always base64)
        if (imageData.data && imageData.data[0] && imageData.data[0].b64_json) {
          console.log(`Successfully generated ${style} avatar`);
          return {
            style: style,
            imageUrl: `data:image/png;base64,${imageData.data[0].b64_json}`,
            prompt: prompt
          };
        } else {
          console.error(`No image data received for ${style} avatar. Response:`, imageData);
          return null;
        }
      } catch (error) {
        console.error(`Error generating ${style} avatar:`, error);
        return null;
      }
    });

    // Wait for all avatar generations to complete
    const avatarResults = await Promise.all(avatarPromises);
    const generatedAvatars = avatarResults.filter(avatar => avatar !== null);

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