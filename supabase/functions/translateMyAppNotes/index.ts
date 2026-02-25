import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sourceLang, targetLang, text } = await req.json()
    const apiKey = Deno.env.get('GEMINI_API_KEY')

    // 1. Validación de llave
    if (!apiKey) {
        throw new Error("🚨 API Key de Gemini no encontrada en los secretos de Supabase.");
    }

    // 2. Llamada a Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a professional translator. Translate the following text from ${sourceLang === 'en' ? 'English' : 'Spanish'} to ${targetLang === 'en' ? 'English' : 'Spanish'}. Provide ONLY the translated text, no explanations, no quotes, just the direct translation:\n\n${text}`
            }]
          }]
        })
      }
    );

    const data = await response.json();

    // 3. VALIDACIÓN CLAVE: Si Google rechaza la petición
    if (!response.ok) {
        console.error("Error de Google Gemini:", data);
        throw new Error(data.error?.message || "Google rechazó la petición. Verifica la cuota o la llave.");
    }

    const translatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return new Response(
      JSON.stringify({ translation: translatedText.trim() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    // Si algo falla, le mandamos el error a React
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})