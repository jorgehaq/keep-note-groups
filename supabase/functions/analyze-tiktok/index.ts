import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Extract payload
    const { prompt, videoId } = await req.json();
    console.log("📥 Payload recibido:", { videoId, promptLength: prompt?.length });

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    console.log("🔑 API Key presente:", !!apiKey);
    if (!apiKey) throw new Error("API Key de Gemini no configurada.");

    console.log("🚀 Llamando a Gemini...");

    // 3. Gemini Call
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }],
          }],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          }
        }),
      },
    );

    console.log("📡 Gemini status:", response.status);
    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Gemini error:", JSON.stringify(data));
      throw new Error(data.error?.message || "Google Gemini Error");
    }

    const aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const analysis = JSON.parse(aiResponseText);

    return new Response(
      JSON.stringify(analysis),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
