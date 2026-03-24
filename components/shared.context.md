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

## Sidebar y Badges Responsivos
- **Comportamiento**: Los badges de notificaciones (Kanban, Recordatorios, Timers) escalan su tamaño según el ancho del sidebar.
- **Reglas de UI Estrictas**:
  - **Desktop (md+)**: Mantener `h-5`, `min-w-[20px]`, `text-[12px]`, `px-1.5`. NO modificar este estado ya que es el diseño base aprobado.
  - **Mobile/Small**: Reducir a `h-4`, `min-w-[16px]`, `text-[10px]` y ajustar posición (`-top-1 -right-1`) para evitar clipping en el sidebar `w-12`.
- **Kanban Stack**: Las 3 burbujas de colores deben permanecer alineadas (`flex items-center gap-px`) y visibles.

## Estándar de Headers (Navegación y Controles por App)
- **Secuencia Estricta de Botones**: Para mantener la paridad entre `App.tsx` y `BrainDumpApp.tsx`, el orden debe ser:
  1. **Campana de Recordatorios**: Red (activo con marquee) / Tinted (disabled/idle).
  2. **Bandeja de Accesos**: Toggle para tray lateral o lista de items del grupo.
  3. **Maximizar/Minimizar**: Botón de vista de enfoque.
  4. **Ordenar (Sort)**: Botón **independiente** (fuente de verdad: `isSortMenuOpen`).
  5. **Búsqueda (Search)**: Input field (dentro de cápsula en Notas / independiente en Pizarrón).
- **Reglas de UI del Botón Bell & Toogle**: 
  - **Estado Inactivo**: Fondo `zinc-100` (dark: `zinc-800`), borde `zinc-200`, texto `zinc-500`.
  - **Estado Activo (Tinted)**: Fondo sutil del color de la app (20% opacidad), borde del color de la app (40% opacidad), texto/icono del color de la app (700-800). **NUNCA usar fondo sólido con texto blanco para estos toggles**. Esto garantiza legibilidad del ícono original y una estética premium.
- **Botón Sort Independiente**: En `App.tsx` (Notas), el botón de ordenar NO debe estar dentro de la cápsula gris de acciones secundarias; debe ser un botón `rounded-xl` independiente al lado de Maximizar.

## Filosofía de Diseño: Botones y Colores de App
- **Botones "Clickable"**: Deben usar `rounded-xl`, `border` y `active:scale-95`. Si son icon-only, usar `p-2` o `p-1.5`.
- **Tarjetas de Notas (Dashboard)**: Deben usar `rounded-2xl` y `p-5`. El espaciado entre tarjetas (gap) es estricto de **16px** (`gap-4`).
- **Identidad Cromática por App**:
  - **Notes (General)**: Indigo `#4940D9`.
  - **Reminders**: Red `#DC2626`.
  - **Timers**: Blue `#2563EB`.
  - **Kanban**: Emerald `#10B981`.
  - **TikTok**: TikTok Red/Pink `#EE1D52`.
  - **Translator**: Violet `#8B5CF6`.
  - **Braindump**: Gold/Amber `#FFD700`.
- **Acciones en Tarjeta (Dashboard)**: Los botones internos (Pin, Archivar) deben ser `rounded-xl`, discretos (`border-transparent`) pero perceptibles al hover/active, manteniendo siempre el ícono original.
- **Vertical Rhythm**: La separación general entre grandes bloques (ej: Header a Cards, Cards a Archive) es de **20px** (`mt-5`).

## Reglas
- El Sidebar siempre está visible (NO se desmonta con globalView).
- Zen Mode (isZenModeByApp) oculta elementos del layout por app — respetar en nuevas apps.
- Al agregar una app, debe tener su propio isMaximized si aplica (ver isBraindumpMaximized, isTranslatorMaximized en store).
- GroupLauncher solo aplica a la vista 'notes'. No interferir con otras vistas.
- Auth.tsx no tiene estado propio — usa supabase.auth directamente. No agregar state local ahí.