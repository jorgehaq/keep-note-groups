# DOMINIO BRAINDUMP (Pizarrón) — Contexto para el Agente

## Componentes
- BrainDumpApp.tsx        → Orquestador. Lista de pizarrones, status: main|active|history.
- BrainDumpAIPanel.tsx    → Panel IA del pizarrón. Tabs: Summaries, Hijos generados.
- BrainDumpBreadcrumb.tsx → Navegación padre-hijo para pizarrones.
- KanbanSemaphore.tsx     → Semáforo de sincronización (usado en Header, Tray y Tabs).

## Funcionalidades Recientes
- **Borrado de Sub-pizarrones**: Disponible desde la pestaña activa del sub-pizarrón (icono Trash2).
- **Descarga Markdown v2 (Recursiva)**: El botón de exportación genera un .md con la concatenación del contenido principal, el borrador (scratchpad) y todos los niveles de sub-pizarrones hijos.

## BrainDump Schema (types.ts & DB: brain_dumps)
- status: main | active | history
- parent_id?: string         → pizarrón padre (árbol igual que notas)
- generation_level?: number  → profundidad en el árbol
- ai_summary_status: idle | queued | processing | done | error
- generation_status: idle | queued | processing | done | error | stale
- focus_prompt?: string      → prompt de generación
- is_checklist?: boolean     → modo checklist
- scratchpad?: string        → borrador IA interno
- children?: BrainDump[]     → hidratado por useBrainDumpTree.ts

## Hooks
- src/lib/useBrainDumpTree.ts    → Árbol de pizarrones.
- src/lib/useBrainDumpSummaries.ts → Summaries para pizarrones. Gemini client-side.

## Realtime
- Pizarrones se sincronizan via canal 'global-sync' en App.tsx (tabla brain_dumps).
- setBrainDumps en store — lista plana, el árbol se construye en el hook.

## Estado UI Persistido
- aiPanelOpenByBrainDump: Record<string, boolean>
- activeTabByBrainDump: Record<string, string>
- focusedDumpId: string | null
- isDumpTrayOpen: boolean
- isBraindumpMaximized: boolean

## Reglas
- **Sincronización Kanban**: Los semáforos (`KanbanSemaphore`) dependen del `globalTasks` del UIStore. Cualquier cambio de estado se refleja instantáneamente en todos los puntos de acceso (Header, Tray, Tabs).
- **Cierre de Menús**: Al añadir a Kanban, el menú superior debe cerrarse explícitamente (`setOpenMenuId(null)`).
- **Consumo de Estados**: Se prefiere el uso del store global para estados compartidos (tareas, pizarrones visibles) para evitar race conditions entre fetches locales y Realtime.
- La relación summaries ↔ brain_dump: summaries.brain_dump_id (NOT summaries.note_id).
- NO mezclar lógica de notas y pizarrones: son entidades paralelas con hooks propios.