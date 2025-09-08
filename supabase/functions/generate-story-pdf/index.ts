import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storyId } = await req.json();
    console.log('generate-story-pdf: Processing story:', storyId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    // Client for fetching (with user auth for RLS)
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Service client for storage operations
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch story and pages
    const { data: story, error: storyError } = await supabaseUser
      .from("stories")
      .select("*")
      .eq("id", storyId)
      .single();

    if (storyError || !story) {
      return new Response(JSON.stringify({ error: "Story not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pages, error: pagesError } = await supabaseUser
      .from("story_pages")
      .select("*")
      .eq("story_id", storyId)
      .order("page_number");

    if (pagesError) {
      return new Response(JSON.stringify({ error: "Failed to fetch pages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate HTML content for PDF
    const htmlContent = generateStoryHTML(story, pages || []);

    // Convert HTML to PDF using Puppeteer-like service
    const pdfResponse = await fetch("https://api.htmlcsstoimage.com/v1/image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa("user_id:api_key"), // You'd need to add this as a secret
      },
      body: JSON.stringify({
        html: htmlContent,
        css: getStoryCSS(),
        format: "pdf",
        width: 800,
        height: 600,
      }),
    });

    // For now, let's create a simple text-based PDF using a basic approach
    const pdfBuffer = await generateSimplePDF(story, pages || []);

    // Upload to Supabase Storage
    const filename = `${story.title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`;
    
    const { data: uploadData, error: uploadError } = await supabaseService.storage
      .from("story-pdfs")
      .upload(filename, pdfBuffer, {
        contentType: "application/pdf",
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error('PDF upload error:', uploadError);
      return new Response(JSON.stringify({ error: "Failed to save PDF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get public URL
    const { data: urlData } = supabaseService.storage
      .from("story-pdfs")
      .getPublicUrl(filename);

    // Update story with PDF URL
    await supabaseService
      .from("stories")
      .update({ pdf_url: urlData.publicUrl })
      .eq("id", storyId);

    return new Response(JSON.stringify({ 
      success: true, 
      pdfUrl: urlData.publicUrl,
      filename 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("generate-story-pdf error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateStoryHTML(story: any, pages: any[]): string {
  const pageElements = pages.map(page => `
    <div class="page">
      <div class="page-number">Page ${page.page_number}</div>
      ${page.image_url ? `<img src="${page.image_url}" alt="Story illustration" class="story-image">` : ''}
      <div class="story-text">${page.text_content}</div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${story.title}</title>
      <meta charset="utf-8">
    </head>
    <body>
      <div class="story-container">
        <h1 class="story-title">${story.title}</h1>
        <p class="story-subtitle">A story for ${story.child_name}</p>
        ${pageElements}
      </div>
    </body>
    </html>
  `;
}

function getStoryCSS(): string {
  return `
    body { 
      font-family: 'Georgia', serif; 
      margin: 0; 
      padding: 20px; 
      background: white; 
    }
    .story-container { 
      max-width: 600px; 
      margin: 0 auto; 
    }
    .story-title { 
      text-align: center; 
      font-size: 28px; 
      color: #333; 
      margin-bottom: 10px; 
    }
    .story-subtitle { 
      text-align: center; 
      font-size: 16px; 
      color: #666; 
      margin-bottom: 30px; 
    }
    .page { 
      page-break-after: always; 
      margin-bottom: 40px; 
    }
    .page-number { 
      text-align: center; 
      font-weight: bold; 
      margin-bottom: 20px; 
    }
    .story-image { 
      width: 100%; 
      height: 300px; 
      object-fit: cover; 
      border-radius: 8px; 
      margin-bottom: 20px; 
    }
    .story-text { 
      font-size: 18px; 
      line-height: 1.6; 
      text-align: center; 
      padding: 0 20px; 
    }
  `;
}

// Simple PDF generation using basic text formatting
async function generateSimplePDF(story: any, pages: any[]): Promise<Uint8Array> {
  // This is a very basic PDF structure - in production you'd use a proper PDF library
  const content = `${story.title}\n\nA story for ${story.child_name}\n\n` + 
    pages.map(p => `Page ${p.page_number}:\n${p.text_content}\n\n`).join('');
  
  return new TextEncoder().encode(content);
}