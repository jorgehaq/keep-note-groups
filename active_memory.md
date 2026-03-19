# MEMORIA ACTIVA — DECISIONES RECIENTES

## Estado Actual (actualizar con cada sesión relevante)

### Decisiones Arquitectónicas Vigentes
- SmartNotesEditor usa CodeMirror (NO Tiptap para notas plain-text). Tiptap solo en NoteEditor.tsx (src/components/).
- El editor activo por defecto es SmartNotesEditor; ChecklistEditor se activa cuando note.is_checklist = true.
- summaryCounts en store: Record<note_id, number> — se hidrata en fetchSummaryCounts() y se actualiza vía Realtime en summaries-global-sync.
- isTikTokPizarronOpen en store: controla la visibilidad GLOBAL del borrador para la App TikTok (estandarizado; no por nota).
- TikTok Archiving: uso de columna `status` ('active' | 'archived') en `tiktok_videos`.

### Deuda Técnica Consciente
- App.tsx tiene demasiada lógica (fetchData, sort, CRUD, Realtime) — candidato a custom hooks pero NO refactorizar sin pedirlo.
- Reminder.targets es JSONB en DB pero se tipea como `any[]` en el cliente — no agregar validación de schema sin coordinarlo.
- i18n solo tiene 'es' y 'en'. No agregar más idiomas sin pedirlo.

### Bugs Conocidos / Fixes Recientes
- 2026-03-19: Implementada Respuesta Ágil (Optimistic UI) para eliminaciones y archivos en TikTokApp. Ahora la interfaz reacciona instantáneamente sin esperar a la DB, emulando la fluidez del módulo de notas.
- 2026-03-19: Implementada sincronización en Tiempo Real para `tiktok_videos` y `tiktok_queue` en `App.tsx`. Ahora las eliminaciones, adiciones y cambios de estado se reflejan instantáneamente sin necesidad de F5.
- 2026-03-19: Estandarizada la visualización de resúmenes AI en TikTokApp: ahora los resúmenes pendientes muestran un estado de pulso (animate-pulse) y un loader, y no permiten el clic hasta que el contenido está listo (paridad con Note Groups).
- 2026-03-19: Consolidado script del worker en `scripts/tiktok_worker.py` y eliminado duplicado en el root. Añadido bloque `try-except` para `dotenv` permitiendo ejecución sin dependencias de desarrollo en GitHub Actions.
- 2026-03-19: Implementado **debounce (1000ms)** en `fetchSummaryCounts` (App.tsx) dentro del canal Realtime para colapsar ráfagas de eventos y reducir el ruido de consultas a la DB.
- 2026-03-19: Implementado `ErrorBoundary` global en `index.tsx` para evitar pantallazos negros ante crashes de React; diseño minimalista con opción de recarga.
- 2026-03-19: Mitigado crash de CodeMirror (`Decorations that replace line breaks...`) mediante guard en `safeReplace` que impide reemplazos multilínea en `ViewPlugin`.
- 2026-03-19: Añadido `try-catch` preventivo en el plugin de selección de `SmartNotesEditor.tsx` al calcular coordenadas (`coordsAtPos`).
- 2026-03-19: Corregido error de "Pantalla Negra" en producción al manejar `INITIAL_SESSION` en `onAuthStateChange` (Supabase v2) y unificar la carga inicial de datos.
- 2026-03-19: Optimizada consulta de `summaries` en App.tsx añadiendo filtro de `user_id` para evitar escaneos de tabla completa y errores de RLS.
- 2026-03-19: Estandarización de divisores (resizer) en TikTokApp para paridad absoluta con el módulo "Grupo de Notas" (clases de hover, ancho y animación fadeIn).
- 2026-03-19: Implementado cierre automático (blur/click-outside) del menú de opciones en TikTokApp y persistencia global del toggle de Pizarrón.
- 2026-03-19: Implementado Archivado y Borrado Recursivo en TikTok: eliminación en cascada de summaries, sub-notas y limpieza manual detallada de entradas en `tiktok_queue`.
- 2026-03-18: Finalizada implementación de `TranslatorApp` con traducción automática vía MyMemory API (debounce 800ms) e historial persistente con sincronización Realtime; se priorizó speed-to-result sobre complejidad de backend (MyMemory público).
- 2026-03-18: Corregido cierre automático de menú Kanban en Pizarrón; sincronización de semáforos unificada vía UIStore; implementado borrado de sub-pizarrones y descarga Markdown recursiva completa.
- 2026-03-18: Implementado borrado de sub-notas en AccordionItem.tsx; exportación Markdown recursiva masiva (notas, sub-notas, scratchpads y summaries) tanto individual como por grupo en App.tsx.
- 2026-03-18: Corregido clipping de burbujas Kanban en sidebar para pantallas pequeñas; implementado escalado responsivo de badges (fuente, tamaño y posición) preservando vista desktop (md+).
- 2026-03-18: Implementada Búsqueda Profunda (Paridad) en Pizarrón: recursión en sub-pizarrones/resúmenes, iluminación ámbar global, persistencia de bandeja y unificación de estado con App.tsx.
- 2026-03-18: Estandarización de headers y botón Bell convergente (blanco sobre rojo para contraste); reordenamiento estricto (Bell-Tray-Maximize-Sort-Search) y desacoplamiento del botón Sort en App.tsx para paridad total con Pizarrón.
- 2026-03-18: Implementación del módulo "TikTok a Notas": Worker Python con yt-dlp y Gemini 2.5 Flash, UI responsiva (mobile overlay) y función de conversión a notas regulares con concatenación total de análisis.
- Ejemplo: "2024-03-18: Corregido scroll position en SmartNotesEditor usando localStorage key 'scroll-{noteId}'"

## ⚠️ GAPS CRÍTICOS: DB Real vs types.ts (Verificado del SQL de producción)

### brain_dumps — La DB NO tiene estos campos (son solo tipos fantasma):
  - parent_id, generation_level, ai_summary_status, generation_status, scratchpad, focus_prompt
  - En DB solo existe: id, user_id, content, status, title, is_checklist, created_at, updated_at
  - NUNCA hacer INSERT/UPDATE de esos campos en brain_dumps hasta migrarlos.

### summaries — La DB difiere del tipo Summary en types.ts:
  - NO existe: brain_dump_id, scratchpad, user_id en la tabla real.
  - El enum de status en DB es: pending | processing | completed | FAILED (no 'error').
  - types.ts dice 'error' → el valor real en DB es 'failed'. Cuidado con los filtros.

### tasks — La DB NO tiene:
  - linked_note_id, linked_board_id (solo existe source_id).
  - Si el agente los usa, fallará silenciosamente (columna inexistente).

### timers — La DB tiene campos EXTRA que types.ts no declara:
  - content: text, laps: jsonb (array), accumulated_ms: bigint
  - Usar accumulated_ms para precisión milisegundos si se necesita.

### Tablas en DB que NO están en types.ts (sin tipo declarado):
  - yo_memoria: id, user_id, temas[], marcadores_frecuentes(jsonb), patrones[],
                preguntas_abiertas[], palabras_clave[], total_notas_procesadas, updated_at
  - yo_perfil:  id, user_id, yo_json(jsonb), updated_at
  - timer_logs: id, timer_id, user_id, duration_seconds, created_at
  - Estas tablas tienen RLS activo. Solo las ve el user_id dueño.

### Realtime publication — Tablas habilitadas:
  brain_dumps, groups, notes, reminders, summaries, tasks, translations
  (timers, timer_logs, yo_memoria, yo_perfil NO están en supabase_realtime)