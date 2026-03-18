# DOMINIO SHARED / LAYOUT — Contexto para el Agente

## Componentes
- Sidebar.tsx        → Navegación global. Muestra todas las apps + grupos docked.
- Auth.tsx           → Login/Signup/Reset. Se monta si session === null.
- SettingsWindow.tsx → Modal de configuración. Tema, tipografía, idioma, formatos.
- GroupLauncher.tsx  → Modal de búsqueda/acceso a grupos. Tabs: alpha | recent | pinned.
- AccordionItem.tsx  → Item de nota en la lista del grupo activo.

## GlobalAppView — Valores Actuales
type GlobalAppView = 'notes' | 'kanban' | 'timers' | 'reminders' | 'braindump' | 'translator'
  → Definido en types.ts. Al agregar una app nueva, SIEMPRE actualizar este tipo primero.

## Patrón para Agregar una Nueva App al Sidebar
1. types.ts        → Agregar el nuevo valor al type GlobalAppView.
2. store.ts        → isZenModeByApp ya es Record<string,bool>, soporta el nuevo key automáticamente.
3. App.tsx         → Agregar el case en el switch de globalView para renderizar la nueva sub-app.
4. Sidebar.tsx     → Agregar el botón/ícono de navegación con setGlobalView('nueva-app').
5. components/     → Crear NuevaApp.tsx siguiendo el patrón de las apps existentes.
6. Si necesita tabla en DB → crearla con RLS (auth.uid() = user_id) y agregarla a supabase_realtime si necesita sync.
7. Si necesita contadores en Sidebar → agregar campos en UIStore y su polling/realtime en App.tsx.
8. Crear components/nueva-app.context.md con el L2 del dominio.

## Contadores en Sidebar (cómo funcionan)
- Kanban: kanbanTodoCount/InProgress/Done — polling 30s + evento 'kanban-updated'.
- Reminders: overdueRemindersCount, imminentRemindersCount — polling 30s + evento 'reminder-attended'.
- Timers: activeTimersCount — polling 10s + evento 'timer-changed'.
- Patrón: campo en UIStore → setXxxCount action → useEffect en App.tsx con interval + window event.

## SettingsWindow — Preferencias Persistidas en localStorage
- 'app-theme-preference'    → Theme: light | dark | system
- 'app-note-font'           → NoteFont: sans | serif | mono
- 'app-note-font-size'      → small | medium | large
- 'app-note-line-height'    → standard | relaxed | compact
- 'app-date-format'         → dd/mm/yyyy | mm/dd/yyyy
- 'app-time-format'         → 12h | 24h
- 'app-show-line-numbers'   → true | false (CodeMirror)
- 'app-language'            → i18next locale key

## Reglas
- El Sidebar siempre está visible (NO se desmonta con globalView).
- Zen Mode (isZenModeByApp) oculta elementos del layout por app — respetar en nuevas apps.
- Al agregar una app, debe tener su propio isMaximized si aplica (ver isBraindumpMaximized, isTranslatorMaximized en store).
- GroupLauncher solo aplica a la vista 'notes'. No interferir con otras vistas.
- Auth.tsx no tiene estado propio — usa supabase.auth directamente. No agregar state local ahí.