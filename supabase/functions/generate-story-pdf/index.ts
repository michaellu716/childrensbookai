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

// Convert WebP images to PNG for PDF compatibility
async function convertWebPImagesToPNG(pages: Array<any>): Promise<Array<any>> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const convertedPages = [];
  
  for (const page of pages) {
    let convertedPage = { ...page };
    
    if (page.image_url && page.image_url.includes("data:image/webp;base64,")) {
      console.log(`🔄 Converting WebP image for page ${page.page_number}`);
      
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/img-to-png`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ dataUrl: page.image_url })
        });
        
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            convertedPage.image_url = result.dataUrl;
            console.log(`✅ Successfully converted WebP to PNG for page ${page.page_number}`);
          } else {
            console.warn(`⚠️ Failed to convert WebP for page ${page.page_number}:`, result.error);
          }
        } else {
          console.warn(`⚠️ Conversion service failed for page ${page.page_number}: ${response.status}`);
        }
      } catch (error: any) {
        console.error(`💥 Error converting WebP for page ${page.page_number}:`, error.message);
      }
    }
    
    convertedPages.push(convertedPage);
  }
  
  return convertedPages;
}

async function buildPdf(story: any, pages: Array<any>): Promise<Uint8Array> {
  const startTime = Date.now();
  console.log(`Starting PDF generation with images for ${pages.length} pages`);
  
  // Convert WebP images to PNG before processing
  const processedPages = await convertWebPImagesToPNG(pages);
  console.log("WebP conversion complete, proceeding with PDF generation");
  
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

  // Process pages with images - optimized to avoid resource limits
  const limitedPages = processedPages.slice(0, 8); // Limit to 8 pages to avoid timeouts
  
  for (let i = 0; i < limitedPages.length; i++) {
    const p = limitedPages[i];
    console.log(`Processing page ${p.page_number} (${i + 1}/${limitedPages.length})`);
    
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

    // Process image first if available
    if (p.image_url) {
      console.log(`🖼️ Processing image for page ${p.page_number}: ${p.image_url.substring(0, 100)}...`);
      
      try {
        const imageResult = await embedImageOptimized(pdfDoc, p.image_url);
        if (imageResult) {
          const { image, width: imgWidth, height: imgHeight } = imageResult;
          
          // Calculate smaller image dimensions to reduce memory usage
          const maxImageWidth = width - margin * 2;
          const maxImageHeight = 200; // Reduced size for better performance
          
          let drawWidth = imgWidth;
          let drawHeight = imgHeight;
          
          // Scale image to fit
          const widthScale = maxImageWidth / drawWidth;
          const heightScale = maxImageHeight / drawHeight;
          const scale = Math.min(widthScale, heightScale, 0.8); // Max 80% of original to save memory
          
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
          cursorY = imageY - 20;
        } else {
          // Image failed - show informative placeholder
          console.warn(`⚠️ Could not process image for page ${p.page_number}`);
          cursorY -= 15;
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
        cursorY -= 15;
        page.drawText('[Image processing failed]', {
          x: margin, y: cursorY, size: 10, font, color: rgb(0.7, 0.7, 0.7)
        });
        cursorY -= 25;
      }
    }

    // Add text content
    if (p.text_content) {
      cursorY = drawTextWrapped(page, String(p.text_content), font, 14, margin, cursorY, width - margin * 2, 18);
    }
  }

  const pdfBytes = await pdfDoc.save();
  console.log(`PDF generation completed in ${Date.now() - startTime}ms`);
  return pdfBytes;
}

// WebP to PNG conversion function
async function convertWebPToPng(webpData: Uint8Array): Promise<Uint8Array | null> {
  try {
    // Create a canvas to convert WebP to PNG
    const canvas = new OffscreenCanvas(800, 600);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Create blob from WebP data
    const blob = new Blob([webpData], { type: 'image/webp' });
    
    // Create image bitmap from blob
    const imageBitmap = await createImageBitmap(blob);
    
    // Resize canvas to match image dimensions
    canvas.width = imageBitmap.width;
    canvas.height = imageBitmap.height;
    
    // Draw image to canvas
    ctx.drawImage(imageBitmap, 0, 0);
    
    // Convert canvas to PNG blob
    const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
    
    // Convert blob to Uint8Array
    const arrayBuffer = await pngBlob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.log(`❌ Error converting WebP to PNG: ${error}`);
    return null;
  }
}

// Optimized image embedding function with WebP conversion
async function embedImageOptimized(pdfDoc: PDFDocument, imageUrl: string): Promise<{ image: any; width: number; height: number } | null> {
  try {
    console.log(`🖼️ Processing image: ${imageUrl.substring(0, 100)}...`);
    
    // Aggressive timeout for faster failures
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    try {
      let imageBytes: Uint8Array;
      let isWebP = false;
      
      // Handle base64 data URLs
      if (imageUrl.startsWith('data:image/')) {
        const [header, base64Data] = imageUrl.split(',');
        if (!base64Data) return null;
        
        imageBytes = base64ToBytes(base64Data);
        
        // Better WebP detection for base64 data URLs
        isWebP = header.includes('webp') || header.includes('application/octet-stream');
        
        // If octet-stream, check the actual bytes for WebP signature
        if (header.includes('application/octet-stream') && imageBytes.length >= 12) {
          const isWebPSignature = imageBytes[8] === 0x57 && imageBytes[9] === 0x45 && imageBytes[10] === 0x42 && imageBytes[11] === 0x50;
          isWebP = isWebP || isWebPSignature;
        }
        
        console.log(`Processing base64 image: ${imageBytes.length} bytes, WebP: ${isWebP}`);
      } else {
        // Handle remote images
        const response = await fetch(imageUrl, { 
          signal: controller.signal,
          headers: { 'User-Agent': 'StoryPDF/1.0' }
        });
        
        if (!response.ok) {
          console.warn(`Fetch failed: ${response.status} for ${imageUrl}`);
          return null;
        }
        
        // Check content length - more reasonable limit for story images
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
          console.warn(`Remote image too large: ${contentLength} bytes`);
          return null;
        }
        
        imageBytes = new Uint8Array(await response.arrayBuffer());
        isWebP = imageUrl.includes('.webp') || (imageBytes[8] === 0x57 && imageBytes[9] === 0x45 && imageBytes[10] === 0x42 && imageBytes[11] === 0x50);
        
        console.log(`Processing remote image: ${imageBytes.length} bytes, WebP: ${isWebP}`);
      }
      
      // More reasonable size limit for story images
      const maxSize = 5 * 1024 * 1024; // 5MB max to accommodate story images
      if (imageBytes.length > maxSize) {
        console.warn(`Image too large: ${imageBytes.length} bytes, max: ${maxSize}`);
        return null;
      }
      
      // Convert WebP to PNG if needed - use server-side conversion for reliability
      if (isWebP) {
        console.log('🔄 Converting WebP to PNG via img-to-png service');
        
        // Convert to base64 for the conversion service
        const base64Data = btoa(String.fromCharCode(...imageBytes));
        const dataUrl = `data:image/webp;base64,${base64Data}`;
        
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          
          const response = await fetch(`${supabaseUrl}/functions/v1/img-to-png`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ dataUrl })
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.dataUrl) {
              // Convert back to bytes
              const [, convertedBase64] = result.dataUrl.split(',');
              imageBytes = base64ToBytes(convertedBase64);
              console.log(`✅ WebP converted to PNG: ${imageBytes.length} bytes`);
            } else {
              console.error('❌ img-to-png conversion failed:', result.error);
              return null;
            }
          } else {
            console.error('❌ img-to-png service failed:', response.status);
            return null;
          }
        } catch (conversionError: any) {
          console.error('💥 WebP conversion error:', conversionError.message);
          return null;
        }
      }
      
      // Try embedding as PNG first (since we may have converted), then JPEG
      try {
        const img = await pdfDoc.embedPng(imageBytes);
        return { image: img, width: img.width, height: img.height };
      } catch (pngError) {
        try {
          const img = await pdfDoc.embedJpg(imageBytes);
          return { image: img, width: img.width, height: img.height };
        } catch (jpegError) {
          console.warn(`Failed to embed as PNG or JPEG: ${pngError}, ${jpegError}`);
          return null;
        }
      }
      
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    console.warn(`Image processing failed: ${error.message}`);
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
