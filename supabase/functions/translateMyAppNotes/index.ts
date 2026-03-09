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
    console.log("🚀 [EDGE] Recibiendo petición...");

    // 1. Validar entorno y auth
    const isDev = Deno.env.get("IS_DEV") === "true";
    const authHeader = req.headers.get("Authorization");

    if (!isDev) {
      if (!authHeader) throw new Error("No se envió el token de autorización.");

      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: authError } = await supabaseClient.auth
        .getUser();
      if (authError || !user) {
        throw new Error("No autorizado o sesión caducada.");
      }
      console.log(`✅ [EDGE] Usuario autenticado: ${user.id}`);
    } else {
      console.log("🛠️ [EDGE] Ejecutando en Modo DEV (Auth bypass)");
    }

    // 2. Extraer payload
    const { sourceLang, targetLang, text } = await req.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("🚨 API Key de Gemini no configurada.");

    // 3. Llamada a Gemini
    console.log(`👉 [EDGE] Traducción: ${sourceLang} -> ${targetLang}`);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text:
                `You are a professional translator. Translate from ${sourceLang} to ${targetLang}. Return ONLY the translation, no extra text:\n\n${text}`,
            }],
          }],
        }),
      },
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(
        data.error?.message || "Google Gemini rechazó la petición.",
      );
    }

    const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "";

    return new Response(
      JSON.stringify({ translation: translatedText.trim() }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: any) {
    console.error("❌ [EDGE] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
