# DOMINIO BRAINDUMP (Pizarrón) — Contexto para el Agente

## Componentes
- BrainDumpApp.tsx        → Orquestador. Lista de pizarrones, status: main|active|history.
- BrainDumpAIPanel.tsx    → Panel IA del pizarrón. Tabs: Summaries, Hijos generados.
- BrainDumpBreadcrumb.tsx → Navegación padre-hijo para pizarrones.

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
- La relación summaries ↔ brain_dump: summaries.brain_dump_id (NOT summaries.note_id).
- NO mezclar lógica de notas y pizarrones: son entidades paralelas con hooks propios.