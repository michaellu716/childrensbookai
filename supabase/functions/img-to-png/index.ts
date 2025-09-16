import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ImageMagick, initialize, MagickFormat } from "https://esm.sh/@imagemagick/magick-wasm@0.0.28";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let magickInitialized = false;

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dataUrl } = await req.json();
    
    if (!dataUrl || !dataUrl.startsWith("data:image/")) {
      return new Response(JSON.stringify({ error: "Invalid dataUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("img-to-png: Processing image conversion");

    // Initialize ImageMagick WASM once
    if (!magickInitialized) {
      await initialize();
      magickInitialized = true;
      console.log("img-to-png: ImageMagick WASM initialized");
    }

    // Extract base64 data from data URL
    const [header, base64Data] = dataUrl.split(',');
    if (!base64Data) {
      throw new Error("Invalid data URL format");
    }

    // Convert base64 to bytes
    const inputBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    console.log(`img-to-png: Converting ${inputBytes.length} bytes`);

    // Convert to PNG using ImageMagick
    let outputBytes: Uint8Array;
    
    ImageMagick.read(inputBytes, (img) => {
      img.format = MagickFormat.Png;
      img.quality = 90; // High quality PNG
      outputBytes = img.write();
    });

    // Convert back to base64 data URL
    const outputBase64 = btoa(String.fromCharCode(...outputBytes!));
    const pngDataUrl = `data:image/png;base64,${outputBase64}`;

    console.log(`img-to-png: Successfully converted to PNG (${outputBytes!.length} bytes)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        dataUrl: pngDataUrl,
        originalSize: inputBytes.length,
        convertedSize: outputBytes!.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("img-to-png error:", error);
    return new Response(JSON.stringify({ error: String(error?.message ?? error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});