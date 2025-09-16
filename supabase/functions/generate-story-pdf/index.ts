import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { storyId } = await req.json();
    if (!storyId) {
      return new Response(JSON.stringify({ error: "Missing storyId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("generate-story-pdf: Processing story:", storyId);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Forward user's auth so RLS applies to reads
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch story
    const { data: story, error: storyError } = await supabaseUser
      .from("stories")
      .select("*")
      .eq("id", storyId)
      .maybeSingle();

    if (storyError || !story) {
      console.error("generate-story-pdf: story fetch error", storyError);
      return new Response(JSON.stringify({ error: "Story not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch pages
    const { data: pages, error: pagesError } = await supabaseUser
      .from("story_pages")
      .select("id, page_number, text_content, image_url")
      .eq("story_id", storyId)
      .order("page_number");

    if (pagesError) {
      console.error("generate-story-pdf: pages fetch error", pagesError);
      return new Response(JSON.stringify({ error: "Failed to fetch pages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build PDF
    const pdfBytes = await buildPdf(story, pages || []);

    // Upload to storage with a structured path
    const safeTitle = String(story.title || 'story').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeTitle}_${Date.now()}.pdf`;
    const storagePath = `${story.user_id}/${story.id}/${filename}`;

    const { error: uploadError } = await supabaseService.storage
      .from("story-pdfs")
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError) {
      console.error("generate-story-pdf: upload error", uploadError);
      return new Response(JSON.stringify({ error: "Failed to save PDF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a signed URL (bucket is private)
    const { data: signed, error: signedError } = await supabaseService.storage
      .from("story-pdfs")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

    if (signedError) {
      console.error("generate-story-pdf: signed url error", signedError);
      return new Response(JSON.stringify({ error: "Failed to create download link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Optionally store the storage path for later use
    await supabaseService.from("stories").update({ pdf_url: storagePath }).eq("id", storyId);

    return new Response(
      JSON.stringify({ success: true, pdfUrl: signed?.signedUrl, filename }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("generate-story-pdf error:", error);
    return new Response(JSON.stringify({ error: String(error?.message ?? error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function buildPdf(story: any, pages: Array<any>): Promise<Uint8Array> {
  const startTime = Date.now();
  console.log(`Starting optimized PDF generation for ${pages.length} pages`);
  
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Cover page
  {
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();

    page.drawText(story.title || 'Story', {
      x: 50,
      y: height - 100,
      size: 28,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    const childName = story.child_name ? `A story for ${story.child_name}` : '';
    if (childName) {
      page.drawText(childName, { x: 50, y: height - 140, size: 14, font, color: rgb(0.2, 0.2, 0.2) });
    }
  }

  // Process pages with images - optimized for speed
  const limitedPages = pages.slice(0, 8); // Reduce to 8 pages max for faster processing
  
  for (let i = 0; i < limitedPages.length; i++) {
    const p = limitedPages[i];
    
    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();
    const margin = 50;
    let cursorY = height - margin;

    // Page header
    page.drawText(`Page ${p.page_number}`, {
      x: margin,
      y: cursorY,
      size: 12,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    });
    cursorY -= 40;

    // Add image if available - with faster processing
    if (p.image_url) {
      console.log(`Processing image for page ${p.page_number}`);
      const imageResult = await embedImageFast(pdfDoc, p.image_url);
      if (imageResult) {
        const { image, width: imgWidth, height: imgHeight } = imageResult;
        
        // Calculate smaller image dimensions for faster rendering
        const maxImageWidth = width - margin * 2;
        const maxImageHeight = 250; // Smaller than before
        
        let drawWidth = imgWidth;
        let drawHeight = imgHeight;
        
        // Scale image to fit (simplified calculation)
        const widthScale = maxImageWidth / drawWidth;
        const heightScale = maxImageHeight / drawHeight;
        const scale = Math.min(widthScale, heightScale, 1); // Don't upscale
        
        drawWidth = drawWidth * scale;
        drawHeight = drawHeight * scale;
        
        // Center the image horizontally
        const imageX = margin + (maxImageWidth - drawWidth) / 2;
        const imageY = cursorY - drawHeight;
        
        page.drawImage(image, {
          x: imageX,
          y: imageY,
          width: drawWidth,
          height: drawHeight,
        });
        
        cursorY = imageY - 15; // Less spacing
      } else {
        // Quick fallback for failed images
        page.drawText('[Image unavailable]', {
          x: margin, y: cursorY - 15, size: 9, font, color: rgb(0.7, 0.7, 0.7)
        });
        cursorY -= 30;
      }
    }

    // Add text content
    if (p.text_content) {
      cursorY = drawTextWrapped(page, String(p.text_content), font, 14, margin, cursorY, width - margin * 2, 18);
    }
  }

  const pdfBytes = await pdfDoc.save();
  console.log(`Optimized PDF generation completed in ${Date.now() - startTime}ms`);
  return pdfBytes;
}

async function embedImageFast(pdfDoc: PDFDocument, imageUrl: string): Promise<{ image: any; width: number; height: number } | null> {
  try {
    // More aggressive timeout and size limits for speed
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500); // Shorter timeout
    
    try {
      // Handle data URLs with stricter limits
      if (imageUrl.startsWith('data:image/')) {
        const [header, base64Data] = imageUrl.split(',');
        if (!base64Data) return null;
        
        const bytes = base64ToBytes(base64Data);
        const maxSize = 512 * 1024; // Reduced to 512KB for speed
        if (bytes.length > maxSize) {
          console.warn(`Image too large for fast processing: ${bytes.length} bytes`);
          return null;
        }
        
        // Only handle JPEG for speed (most story images are JPEG)
        if (header.includes('jpeg') || header.includes('jpg')) {
          const img = await pdfDoc.embedJpg(bytes);
          return { image: img, width: img.width, height: img.height };
        } else if (header.includes('png')) {
          const img = await pdfDoc.embedPng(bytes);
          return { image: img, width: img.width, height: img.height };
        }
        return null;
      }
      
      // Handle remote images with strict limits
      const res = await fetch(imageUrl, { 
        signal: controller.signal,
        headers: { 'User-Agent': 'PDF-Generator/1.0' }
      });
      
      if (!res.ok) return null;
      
      // Check size before downloading
      const contentLength = res.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 512 * 1024) {
        console.warn(`Remote image too large: ${contentLength} bytes`);
        return null;
      }
      
      const buf = new Uint8Array(await res.arrayBuffer());
      if (buf.length > 512 * 1024) return null;
      
      // Try JPEG first (most common), then PNG
      try {
        const img = await pdfDoc.embedJpg(buf);
        return { image: img, width: img.width, height: img.height };
      } catch {
        try {
          const img = await pdfDoc.embedPng(buf);
          return { image: img, width: img.width, height: img.height };
        } catch {
          return null;
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (e: any) {
    console.warn(`Fast image embed failed: ${e.message}`);
    return null;
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function drawTextWrapped(
  page: any,
  text: string,
  font: any,
  fontSize: number,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  let line = '';
  let y = startY;

  const lines: string[] = [];
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);

  for (const l of lines) {
    if (y < 60) {
      // New page if overflow
      const newPage = page.doc.addPage([612, 792]);
      page = newPage;
      y = 792 - 60;
    }
    page.drawText(l, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
    y -= lineHeight;
  }
  return y;
}
