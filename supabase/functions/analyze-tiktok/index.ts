import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    // Extract payload with better error handling
    const rawBody = await req.text();
    console.log("📥 Raw body length:", rawBody.length);
    
    let prompt;
    try {
      const body = JSON.parse(rawBody);
      prompt = body.prompt;
    } catch (_e) {
      console.error("❌ Body is not valid JSON:", rawBody);
      throw new Error("Cuerpo de solicitud inválido: no es JSON.");
    }

    if (!prompt) {
      throw new Error("Falta el campo 'prompt' en el cuerpo de la solicitud.");
    }

    console.log("📥 Prompt Length:", prompt.length);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    
    console.log("🔑 API Keys presentes: Gemini:", !!apiKey, "OpenRouter:", !!openRouterApiKey);
    if (!apiKey) throw new Error("API Key de Gemini no configurada.");

    let response;
    let data;

    // --- PROVEEDOR 1: Gemini Directo ---
    console.log("🚀 [P1] Intentando Gemini Directo...");
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              topP: 0.95,
              topK: 40,
              maxOutputTokens: 4096,
              responseMimeType: "application/json",
            },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
            ]
          }),
        },
      );
      
      data = await response.json();
      
      // Si hay rate limit (429) o servicio no disponible (503), intentamos fallback
      if (response.status === 429 || response.status === 503) {
        console.warn(`⚡ Gemini status ${response.status}, intentando fallback a OpenRouter...`);
        throw new Error("FALLBACK_TRIGGERED");
      }

      if (!response.ok) {
        throw new Error(data.error?.message || "Google Gemini Error");
      }
    } catch (err: any) {
      if (err.message === "FALLBACK_TRIGGERED" && openRouterApiKey) {
        // --- PROVEEDOR 2: OpenRouter Fallback ---
        console.log("🚀 [P2] Llamando a OpenRouter (Gemini 2.0 Flash Exp)...");
        const orResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openRouterApiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://keep-note-groups.vercel.app",
            "X-Title": "Antigravity AI"
          },
          body: JSON.stringify({
            model: "google/gemini-2.0-flash-exp:free",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 4096
          })
        });

        const orData = await orResponse.json();
        if (!orResponse.ok) {
          console.error("❌ OpenRouter Error:", JSON.stringify(orData));
          throw new Error(orData.error?.message || "OpenRouter Fallback Error");
        }

        // Normalizamos la respuesta de OpenRouter para que el resto del código funcione
        // OpenRouter devuelve content en choices[0].message.content
        data = {
          candidates: [{
            content: {
              parts: [{ text: orData.choices[0].message.content }]
            }
          }]
        };
      } else {
        throw err;
      }
    }

    console.log("📡 Respuesta obtenida correctamente.");

    const aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    console.log("📝 Raw AI Response (first 500 chars):", aiResponseText.substring(0, 500));

    let analysis;
    try {
      // Robust JSON extraction: look for the first '{' and last '}'
      const firstBrace = aiResponseText.indexOf('{');
      const lastBrace = aiResponseText.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error("No se encontró un bloque JSON válido en la respuesta de la IA.");
      }
      const cleanedText = aiResponseText.substring(firstBrace, lastBrace + 1);
      analysis = JSON.parse(cleanedText);
    } catch (parseError: unknown) {
      const pErr = parseError as Error;
      console.error("❌ JSON Parse Error:", pErr.message);
      console.error("📄 Full Content that failed to parse:", aiResponseText);
      throw new Error("No se pudo procesar la respuesta de la IA como JSON: " + pErr.message);
    }

    return new Response(
      JSON.stringify(analysis),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    const err = error as Error;
    console.error("❌ Edge Function internal error:", err.message);
    return new Response(
      JSON.stringify({ 
        error: err.message,
        details: err.stack,
        timestamp: new Date().toISOString()
      }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
