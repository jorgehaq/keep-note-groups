# ARQUITECTURA ANTIGRAVITY

## Árbol de Dependencias Principal
App.tsx
├── Zustand (useUIStore) — estado UI global persistido
├── Supabase Realtime — channels: global-sync, summaries-global-sync, pizarron-summaries-sync
├── Sub-apps (switch por globalView):
│   ├── [notes]      → AccordionItem > NoteContent > SmartEditor > SmartNotesEditor
│   │                                              > ChecklistEditor
│   │                  NoteAIPanel, NoteBreadcrumb, LinkifiedText
│   ├── [kanban]     → KanbanApp > KanbanBoard > KanbanList > KanbanTaskModal
│   ├── [timers]     → TimeTrackerApp
│   ├── [reminders]  → RemindersApp
│   ├── [braindump]  → BrainDumpApp > BrainDumpAIPanel, BrainDumpBreadcrumb
│   ├── [translator] → TranslatorApp
│   └── [tiktok]     → TikTokApp (Worker Externo en scripts/tiktok_worker.py)
└── Sidebar (siempre visible, muestra contadores de Kanban/Reminders/Timers)
└── Global Search (App.tsx) — Estado unificado en searchQueries (keys: activeGroupId o 'braindump')

## Esquema Supabase (tablas relevantes)
- Revisa supabase/schema.context.md para ver el esquema exacto de la base de datos.

## Eventos Custom (window.dispatchEvent)
- 'kanban-updated'       → recarga tasks en KanbanApp
- 'reminder-attended'    → actualiza overdueRemindersList optimísticamente
- 'timer-changed'        → recalcula activeTimersCount
- 'reload-app-data'      → fetchData() completo
- 'app-theme-changed'    → componentes internos reaccionan al cambio de clase en html
- 'tiktok-updated'       → (implícito via Realtime) recarga videos procesados en TikTokApp
- 'tiktok-to-note'       → conversión de análisis de video en nota regular (insert en `notes`)

## Servicios Externos & Workers
- **TikTok Worker** (`scripts/tiktok_worker.py`): Corre cada 8 minutos en GitHub Actions. Usa `yt-dlp` para extraer transcripciones (sin descargar video) y actualizar la tabla `tiktok_videos`.

## Estándares de UI - Parity, Glow & Responsividad
- **Global Search Parity**: Buscador ámbar con `highlightText` y tray persistent.
- **Responsive Trays**: En móviles, los paneles laterales (Notes, TikTok) se comportan como overlays `fixed inset-0` con botón de cierre explícito.
- **Kanban Glow Standard**: Los estados `todo`, `in_progress` y `done` deben usar colores de la familia Tailwind-400 con un `box-shadow` de 6px (opacidad 0.5) para legibilidad en Dark Mode.
- **Botones Premium (rounded-xl)**: Los botones de acción principal (headers, tabs, card actions) deben usar `rounded-xl` (12px), `border` definido y respuesta táctil `active:scale-95`.
- **Vertical Rhythm**: El espaciado estándar entre componentes principales (Header -> Cards, Cards -> Archive) es de **20px** (`mt-5` o padding-top/bottom equivamente).

## Alias de Paths
- '@/' apunta a la raíz del proyecto (vite.config.ts resolve.alias)

## AI / Gemini
- API Key: process.env.GEMINI_API_KEY (inyectado por Vite desde .env)
- **Traducción Independiente**: Standalone `TranslatorApp` utiliza `MyMemory API` (HTTP) con debounce de 800ms para rapidez; el historial reside en la tabla `translations` sincronizada vía Realtime.
- **Traducción de Notas**: Supabase edge function `translateMyAppNotes` (Deno) para procesos de fondo en el editor.
- Summaries/Generación: llamadas cliente directo a Gemini Flash desde hooks useSummaries / useBrainDumpSummaries