# DOMINIO SUPABASE EDGE FUNCTIONS — Contexto para el Agente

## Funciones Existentes
- translateMyAppNotes/index.ts → Deno. Traduce texto via Gemini Flash.
  - Endpoint: POST con { sourceLang, targetLang, text }
  - Auth: valida JWT de Supabase salvo IS_DEV=true (para local con WSL/Docker).
  - Respuesta: { translation: string }

## Variables de Entorno (Edge)
- SUPABASE_URL, SUPABASE_ANON_KEY → auto-inyectadas por Supabase.
- GEMINI_API_KEY → configurada manualmente en el dashboard de Supabase.
- IS_DEV=true → en .env.local para desarrollo local (bypass de auth).

## Patrones
- Siempre incluir corsHeaders en todas las respuestas.
- Siempre manejar OPTIONS (preflight) retornando 200.
- Importar desde esm.sh y deno.land/std con versiones fijas.

## Reglas
- NO cambiar el endpoint de Gemini sin verificar la versión del modelo disponible.
- La función actual usa gemini-2.5-flash — si se cambia de modelo, actualizar también en cliente.
- Cualquier nueva edge function debe seguir el mismo patrón de auth dual (IS_DEV / JWT).