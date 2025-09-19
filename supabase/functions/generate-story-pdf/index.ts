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
    const { storyId, pageOffset = 0, pageLimit = 3, includeAllPages = false } = await req.json();
    if (!storyId) {
      return new Response(JSON.stringify({ error: "Missing storyId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`generate-story-pdf: Processing story: ${storyId}, includeAllPages: ${includeAllPages}, offset: ${pageOffset}, limit: ${pageLimit}`);

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

    // Fetch all pages
    const { data: allPages, error: pagesError } = await supabaseUser
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

    const totalPages = allPages?.length || 0;
    
    // Decide which pages to process
    let pagesToProcess;
    let hasMorePages = false;
    
    if (includeAllPages) {
      // Process all pages in one PDF
      pagesToProcess = allPages || [];
      console.log(`Processing ALL ${pagesToProcess.length} pages in single PDF`);
    } else {
      // Use pagination
      pagesToProcess = allPages?.slice(pageOffset, pageOffset + pageLimit) || [];
      hasMorePages = pageOffset + pageLimit < totalPages;
      console.log(`Processing ${pagesToProcess.length} pages (${pageOffset + 1}-${pageOffset + pagesToProcess.length} of ${totalPages})`);
    }

    // Build PDF
    const pdfBytes = await buildPdf(story, pagesToProcess, includeAllPages || pageOffset === 0);

    // Upload to storage
    const safeTitle = String(story.title || 'story').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = includeAllPages || pageOffset === 0 
      ? `${safeTitle}_complete_${Date.now()}.pdf`
      : `${safeTitle}_${Date.now()}_part${Math.floor(pageOffset / pageLimit) + 1}.pdf`;
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

    // Update story with pdf_url
    if (includeAllPages || pageOffset === 0) {
      await supabaseService.from("stories").update({ pdf_url: storagePath }).eq("id", storyId);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdfUrl: signed?.signedUrl, 
        filename,
        pagination: {
          pageOffset,
          pageLimit,
          totalPages,
          hasMorePages,
          processedPages: pagesToProcess.length,
          includeAllPages
        }
      }),
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

async function buildPdf(story: any, pages: Array<any>, includeCover = true): Promise<Uint8Array> {
  const startTime = Date.now();
  console.log(`Starting PDF generation with images for ${pages.length} pages (cover: ${includeCover})`);
  
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Cover page (only for first batch)
  if (includeCover) {
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

  // Process pages in current batch
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    console.log(`Processing page ${p.page_number} (${i + 1}/${pages.length})`);
    
    const page = pdfDoc.addPage([612, 792]);
    const { width, height } = page.getSize();
    const margin = 30;
    let cursorY = height - margin;

    // Page header
    page.drawText(`Page ${p.page_number}`, {
      x: margin,
      y: cursorY,
      size: 12,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    });
    cursorY -= 25;

    // Process image first if available
    if (p.image_url) {
      console.log(`🖼️ Processing image for page ${p.page_number}: ${p.image_url.substring(0, 100)}...`);
      
      try {
        const imageResult = await embedImageOptimized(pdfDoc, p.image_url);
        if (imageResult) {
          const { image, width: imgWidth, height: imgHeight } = imageResult;
          
          // Calculate larger image dimensions for better visual impact
          const maxImageWidth = width - margin * 2;
          const maxImageHeight = 400; // Increased from 200 for bigger images
          
          let drawWidth = imgWidth;
          let drawHeight = imgHeight;
          
          // Scale image to fit - allow larger scale for better visibility
          const widthScale = maxImageWidth / drawWidth;
          const heightScale = maxImageHeight / drawHeight;
          const scale = Math.min(widthScale, heightScale, 1.2); // Increased from 0.8 to 1.2
          
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
          
          console.log(`✅ Image embedded successfully at ${drawWidth}x${drawHeight}`);
          cursorY = imageY - 30; // Increased spacing between image and text
        } else {
          // Image failed - show informative placeholder
          console.warn(`⚠️ Could not process image for page ${p.page_number}`);
          cursorY -= 10;
          if (p.image_url?.includes('.webp')) {
            page.drawText('[WebP image - not supported in PDF format]', {
              x: margin, y: cursorY, size: 10, font, color: rgb(0.7, 0.7, 0.7)
            });
          } else {
            page.drawText('[Image could not be processed]', {
              x: margin, y: cursorY, size: 10, font, color: rgb(0.7, 0.7, 0.7)
            });
          }
          cursorY -= 25;
        }
      } catch (imageError: any) {
        console.error(`💥 Image processing failed for page ${p.page_number}:`, imageError.message);
        cursorY -= 10;
        page.drawText('[Image processing failed]', {
          x: margin, y: cursorY, size: 10, font, color: rgb(0.7, 0.7, 0.7)
        });
        cursorY -= 25;
      }
    }

    // Add text content with proper spacing and better readability
    if (p.text_content) {
      // Add extra space before text for better visual separation
      cursorY -= 10;
      cursorY = drawTextWrapped(page, String(p.text_content), font, 12, margin, cursorY, width - margin * 2, 18);
    }
  }

  const pdfBytes = await pdfDoc.save();
  console.log(`PDF generation completed in ${Date.now() - startTime}ms`);
  return pdfBytes;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Simplified image embedding function - no conversion, just direct embedding
async function embedImageOptimized(pdfDoc: PDFDocument, imageUrl: string): Promise<{ image: any; width: number; height: number } | null> {
  try {
    console.log(`🖼️ Processing image: ${imageUrl.substring(0, 100)}...`);
    
    let imageBytes: Uint8Array;
    
    // Handle base64 data URLs
    if (imageUrl.startsWith('data:image/')) {
      const [, base64Data] = imageUrl.split(',');
      if (!base64Data) return null;
      imageBytes = base64ToBytes(base64Data);
      console.log(`Processing base64 image: ${imageBytes.length} bytes`);
    } else {
      // Handle remote images with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const response = await fetch(imageUrl, { 
          signal: controller.signal,
          headers: { 'User-Agent': 'StoryPDF/1.0' }
        });
        
        if (!response.ok) {
          console.warn(`Fetch failed: ${response.status} for ${imageUrl}`);
          return null;
        }
        
        imageBytes = new Uint8Array(await response.arrayBuffer());
        console.log(`Processing remote image: ${imageBytes.length} bytes`);
      } finally {
        clearTimeout(timeoutId);
      }
    }
    
    // Size check - reasonable limit
    if (imageBytes.length > 3 * 1024 * 1024) { // 3MB limit
      console.warn(`Image too large: ${imageBytes.length} bytes`);
      return null;
    }
    
    // Try embedding as different formats
    try {
      const img = await pdfDoc.embedJpg(imageBytes);
      console.log(`✅ Successfully embedded as JPEG`);
      return { image: img, width: img.width, height: img.height };
    } catch (jpgError) {
      try {
        const img = await pdfDoc.embedPng(imageBytes);
        console.log(`✅ Successfully embedded as PNG`);
        return { image: img, width: img.width, height: img.height };
      } catch (pngError) {
        console.warn(`Could not embed image - unsupported format`);
        return null;
      }
    }
  } catch (error: any) {
    console.warn(`Image processing failed: ${error.message}`);
    return null;
  }
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
