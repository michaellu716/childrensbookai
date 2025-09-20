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
    const { storyId, pageOffset = 0, pageLimit = null, usePagination = false } = await req.json();
    if (!storyId) {
      return new Response(JSON.stringify({ error: "Missing storyId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`generate-story-pdf: Processing story: ${storyId}, offset: ${pageOffset}, limit: ${pageLimit || 'all'}, pagination: ${usePagination}`);

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

    // Fetch pages with pagination
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

    // Apply pagination only if explicitly requested
    const totalPages = allPages?.length || 0;
    let paginatedPages, hasMorePages;
    
    if (usePagination && pageLimit) {
      // Use pagination - process only a subset of pages
      paginatedPages = allPages?.slice(pageOffset, pageOffset + pageLimit) || [];
      hasMorePages = pageOffset + pageLimit < totalPages;
      console.log(`Processing ${paginatedPages.length} pages (${pageOffset + 1}-${pageOffset + paginatedPages.length} of ${totalPages}) with pagination`);
    } else {
      // Process all pages at once
      paginatedPages = allPages || [];
      hasMorePages = false;
      console.log(`Processing all ${paginatedPages.length} pages in single PDF`);
    }

    // Build PDF with selected pages
    const pdfBytes = await buildPdf(story, paginatedPages, !usePagination || pageOffset === 0);

    // Upload to storage with appropriate filename
    const safeTitle = String(story.title || 'story').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = usePagination && pageLimit && pageOffset > 0
      ? `${safeTitle}_${Date.now()}_part${Math.floor(pageOffset / pageLimit) + 1}.pdf`
      : `${safeTitle}_${Date.now()}.pdf`;
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

    // Update story with pdf_url for complete PDFs (not paginated parts)
    if (!usePagination || pageOffset === 0) {
      await supabaseService.from("stories").update({ pdf_url: storagePath }).eq("id", storyId);
    }

    // Prepare response based on pagination setting
    const responseData: any = { 
      success: true, 
      pdfUrl: signed?.signedUrl, 
      filename
    };

    // Only include pagination info if pagination is being used
    if (usePagination && pageLimit) {
      responseData.pagination = {
        pageOffset,
        pageLimit,
        totalPages,
        hasMorePages,
        processedPages: paginatedPages.length
      };
    }

    return new Response(
      JSON.stringify(responseData),
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
  console.log(`Starting PDF generation for ${pages.length} pages (cover: ${includeCover})`);
  
  // Limit pages to prevent memory issues
  const limitedPages = pages.slice(0, 50); // Max 50 pages to prevent resource issues
  if (limitedPages.length < pages.length) {
    console.warn(`Limited to ${limitedPages.length} pages (original: ${pages.length})`);
  }
  
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
  for (let i = 0; i < limitedPages.length; i++) {
    const p = limitedPages[i];
    console.log(`Processing page ${p.page_number} (${i + 1}/${limitedPages.length})`);
    
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
          
          // Calculate image dimensions - ensure full images are shown
          const maxImageWidth = width - margin * 2;
          const maxImageHeight = Math.min(500, cursorY - 120); // Allow larger images, respect page space
          
          let drawWidth = imgWidth;
          let drawHeight = imgHeight;
          
          // Scale image to fit properly, preserve aspect ratio
          const widthScale = maxImageWidth / drawWidth;
          const heightScale = maxImageHeight / drawHeight;
          const scale = Math.min(widthScale, heightScale, 1.0); // Don't upscale
          
          drawWidth = Math.floor(drawWidth * scale);
          drawHeight = Math.floor(drawHeight * scale);
          
          // Ensure minimum image size for visibility
          if (drawHeight < 100 && cursorY > 200) {
            const minScale = 100 / imgHeight;
            if (minScale <= 1.0) {
              drawHeight = 100;
              drawWidth = Math.floor(imgWidth * minScale);
            }
          }
          
          // Center the image horizontally
          const imageX = margin + (maxImageWidth - drawWidth) / 2;
          const imageY = cursorY - drawHeight;
          
          page.drawImage(image, {
            x: imageX,
            y: imageY,
            width: drawWidth,
            height: drawHeight,
          });
          
          console.log(`✅ Image embedded at ${drawWidth}x${drawHeight}`);
          cursorY = imageY - 20;
        } else {
          // Image failed - show detailed error and skip gracefully
          console.error(`❌ CRITICAL: Image failed for page ${p.page_number}, URL: ${p.image_url}`);
          cursorY -= 10;
          
          // Try to identify the issue
          if (p.image_url?.includes('.webp')) {
            page.drawText('[WebP format - conversion needed]', {
              x: margin, y: cursorY, size: 10, font, color: rgb(0.8, 0.2, 0.2)
            });
            console.log(`WebP image detected - may need format conversion: ${p.image_url}`);
          } else if (p.image_url?.startsWith('data:')) {
            page.drawText('[Base64 image - processing failed]', {
              x: margin, y: cursorY, size: 10, font, color: rgb(0.8, 0.2, 0.2)
            });
          } else {
            page.drawText('[Remote image - fetch/processing failed]', {
              x: margin, y: cursorY, size: 10, font, color: rgb(0.8, 0.2, 0.2)
            });
          }
          cursorY -= 25;
        }
      } catch (imageError: any) {
        console.error(`💥 CRITICAL ERROR: Image processing failed for page ${p.page_number}:`, {
          error: imageError.message,
          stack: imageError.stack,
          url: p.image_url?.substring(0, 100)
        });
        cursorY -= 10;
        page.drawText(`[ERROR: ${imageError.message.substring(0, 50)}...]`, {
          x: margin, y: cursorY, size: 10, font, color: rgb(0.8, 0.2, 0.2)
        });
        cursorY -= 25;
      }
    }

    // Add text content with proper spacing and better readability
    if (p.text_content && cursorY > 100) {
      cursorY -= 10;
      cursorY = drawTextWrapped(pdfDoc, page, String(p.text_content), font, 12, margin, cursorY, width - margin * 2, 18);
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

// Optimized image embedding with strict resource limits
async function embedImageOptimized(pdfDoc: PDFDocument, imageUrl: string): Promise<{ image: any; width: number; height: number } | null> {
  try {
    console.log(`🖼️ Processing image: ${imageUrl.substring(0, 80)}...`);
    
    let imageBytes: Uint8Array;
    
    // Handle base64 data URLs
    if (imageUrl.startsWith('data:image/')) {
      const [, base64Data] = imageUrl.split(',');
      if (!base64Data) return null;
      imageBytes = base64ToBytes(base64Data);
      console.log(`Base64 image: ${imageBytes.length} bytes`);
    } else {
      // Handle remote images with adequate timeout for processing
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Allow more time for image processing
      
      try {
        const response = await fetch(imageUrl, { 
          signal: controller.signal,
          headers: { 'User-Agent': 'StoryPDF/1.0' }
        });
        
        if (!response.ok) {
          console.warn(`Fetch failed: ${response.status}`);
          return null;
        }
        
        imageBytes = new Uint8Array(await response.arrayBuffer());
        console.log(`Remote image: ${imageBytes.length} bytes`);
      } finally {
        clearTimeout(timeoutId);
      }
    }
    
    // Allow larger images to ensure all images are included
    if (imageBytes.length > 3 * 1024 * 1024) { // 3MB limit - more generous
      console.warn(`Image too large: ${imageBytes.length} bytes, attempting to process anyway`);
      // Don't return null, try to process it anyway
    }
    
    // Try embedding as different formats with retries
    console.log(`Attempting to embed image format detection...`);
    
    // First try JPEG
    try {
      const img = await pdfDoc.embedJpg(imageBytes);
      console.log(`✅ Successfully embedded as JPEG (${img.width}x${img.height})`);
      return { image: img, width: img.width, height: img.height };
    } catch (jpgError) {
      console.log(`JPEG embedding failed: ${jpgError.message}`);
    }
    
    // Then try PNG
    try {
      const img = await pdfDoc.embedPng(imageBytes);
      console.log(`✅ Successfully embedded as PNG (${img.width}x${img.height})`);
      return { image: img, width: img.width, height: img.height };
    } catch (pngError) {
      console.log(`PNG embedding failed: ${pngError.message}`);
    }
    
    // Log format detection details
    const header = Array.from(imageBytes.slice(0, 10)).map(b => b.toString(16).padStart(2, '0')).join(' ');
    console.error(`❌ Could not embed image. Header: ${header}, Size: ${imageBytes.length} bytes`);
    return null;
  } catch (error: any) {
    console.warn(`Image processing failed: ${error.message}`);
    return null;
  }
}

function drawTextWrapped(
  pdfDoc: PDFDocument,
  currentPage: any,
  text: string,
  font: any,
  fontSize: number,
  x: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
) {
  // Prevent infinite recursion by limiting text length
  if (text.length > 2000) {
    text = text.substring(0, 2000) + "...";
  }

  const words = text.split(/\s+/);
  let line = '';
  let y = startY;
  let page = currentPage;

  const lines: string[] = [];
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);

  // Limit number of lines to prevent overflow
  const maxLines = Math.floor((y - 60) / lineHeight);
  const limitedLines = lines.slice(0, Math.max(1, maxLines));

  for (const l of limitedLines) {
    if (y < 60) {
      // Stop if we run out of space - don't create new pages from text overflow
      console.warn("Text truncated - insufficient space on page");
      break;
    }
    page.drawText(l, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
    y -= lineHeight;
  }
  return y;
}
