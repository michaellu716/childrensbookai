import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log('get-story-details: Request received', { method: req.method, url: req.url });
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log('get-story-details: Request body:', body);
    const { storyId } = body;
    if (!storyId) {
      return new Response(JSON.stringify({ error: "Missing storyId" }), {
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

    // Fetch story
    const { data: story, error: storyError } = await supabase
      .from("stories")
      .select("*")
      .eq("id", storyId)
      .maybeSingle();

    if (storyError) {
      console.error("get-story-details: storyError", storyError);
      return new Response(JSON.stringify({ error: storyError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!story) {
      return new Response(
        JSON.stringify({ story: null, pages: [], generations: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optional character sheet
    let character_sheets: any = null;
    if (story.character_sheet_id) {
      const { data: sheet, error: sheetError } = await supabase
        .from("character_sheets")
        .select(
          "name, hair_color, hair_style, eye_color, skin_tone, typical_outfit, cartoon_reference_url"
        )
        .eq("id", story.character_sheet_id)
        .maybeSingle();

      if (sheetError) {
        console.warn("get-story-details: sheetError", sheetError);
      }
      character_sheets = sheet ?? null;
    }

    // Fetch pages
    const { data: pages, error: pagesError } = await supabase
      .from("story_pages")
      .select(
        "id, page_number, page_type, text_content, image_url, image_prompt"
      )
      .eq("story_id", storyId)
      .order("page_number");

    if (pagesError) {
      console.error("get-story-details: pagesError", pagesError);
      return new Response(JSON.stringify({ error: pagesError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch generations
    const { data: generations, error: genError } = await supabase
      .from("story_generations")
      .select("id, generation_type, status, error_message, created_at")
      .eq("story_id", storyId)
      .order("created_at", { ascending: false });

    if (genError) {
      console.error("get-story-details: genError", genError);
      return new Response(JSON.stringify({ error: genError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      story: { ...story, character_sheets },
      pages: pages ?? [],
      generations: generations ?? [],
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("get-story-details: unhandled", error);
    return new Response(JSON.stringify({ error: String(error?.message ?? error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});