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
│   └── [translator] → TranslatorApp
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

## Alias de Paths
- '@/' apunta a la raíz del proyecto (vite.config.ts resolve.alias)

## AI / Gemini
- API Key: process.env.GEMINI_API_KEY (inyectado por Vite desde .env)
- Traducción: supabase edge function translateMyAppNotes (Deno, IS_DEV bypass para local)
- Summaries/Generación: llamadas cliente directo a Gemini Flash desde hooks useSummaries / useBrainDumpSummaries