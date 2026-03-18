# Translator App Context

## Propósito
Herramienta de traducción independiente y persistente que permite traducir textos rápidos, escucharlos y archivarlos para consulta futura.

## Estado Local
- `originalText`: Texto de entrada (debounced 800ms).
- `translatedText`: Resultado de la API.
- `sourceLang` / `targetLang`: Idiomas seleccionados.
- `isTranslating` / `isSaving`: Estados de carga de UI.
- `expandedTranslationIds`: Control de acordeón para el historial.

## Dependencias de Supabase (Tabla `translations`)
- `INSERT`: Para guardar nuevas traducciones.
- `DELETE`: Para eliminar del historial.
- `SELECT`: Hidratación inicial del historial (limitado a últimas 10 en vista compacta).
- `Realtime`: Sincronización automática de cambios entre dispositivos.

## Reglas de UI Estrictas
1. **Debounce**: No disparar traducciones mientras el usuario escribe; esperar 800ms de inactividad.
2. **Auto-Swap**: El botón de intercambio invierte idiomas y mueve el resultado al input para traducir de vuelta.
3. **Escucha Privada**: La síntesis de voz (SpeechSynthesis) debe coincidir con el código de idioma seleccionado.
4. **Historial Inteligente**: El historial muestra una vista compacta (unalineal) que se expande para ver el texto completo y controles de audio.
