# DOMINIO NOTES — Contexto para el Agente

## Componentes del Dominio
- AccordionItem.tsx    → Wrapper de una nota en la lista. Maneja is_pinned, título editable, open/close.
- NoteContent.tsx      → Renderiza el contenido de una nota abierta. Orquesta el editor correcto.
- SmartEditor.tsx      → Wrapper ligero que selecciona SmartNotesEditor vs ChecklistEditor.
- NoteAIPanel.tsx      → Panel derecho de IA por nota. Tabs: Summaries, SubNotas generadas.
- NoteBreadcrumb.tsx   → Navegación parent → child. Muestra jerarquía de subnota activa.
- LinkifiedText.tsx    → Renderiza texto con URLs clicables + markers (highlight #FACC15, translation #10B981).
- MoveToGroupModal.tsx → Modal para mover nota a otro grupo.

## Funcionalidades Recientes
- **Borrado de Sub-notas**: Botón `Trash2` añadido a las pestañas de sub-notas en `AccordionItem.tsx` para eliminación directa desde la pestaña activa.
- **Exportación Markdown v2 (Recursiva)**: 
  - `downloadNoteAsMarkdown`: Genera un .md completo con el contenido de la nota, su `scratchpad`, todos sus `summaries` asociados (con sus propios pizarrones) y todas las sub-notas anidadas.
  - `downloadGroupAsMarkdown`: Aplica la lógica recursiva a todas las notas raíz del grupo, consolidando todo el conocimiento (incluidos análisis AI y pizarrones) en un único archivo.

## Editor Stack
- src/components/editor/SmartNotesEditor.tsx → CodeMirror. Es el editor principal plain-text.
  - Tiene: scroll persistence (localStorage 'scroll-{noteId}'), line numbers toggle, cursor position indicator via Decoration.line().
  - IMPORTANTE: NO mezclar con lógica de Tiptap. Son sistemas separados.
- src/components/editor/ChecklistEditor.tsx  → Editor de checklists (note.is_checklist = true).
- src/components/editor/TiptapExtensions.ts  → Extensions: HighlightMark (#ccff00 → mapped to #FACC15 UI), TranslationMark (#60A5FA), CustomLink, SmartTabs.
- src/components/NoteEditor.tsx             → Wrapper Tiptap (usado en contextos específicos, NO es el editor principal de notas).

## Relaciones Padre-Hijo (Subnota / AI Summary)
- Una nota puede ser hija de otra: note.parent_note_id → nota padre
- note.generation_level: 0 = raíz, 1 = primer nivel hijo, etc.
- note.ai_generated = true → fue generada por IA (subnota AI)
- note.generation_status: idle | queued | processing | done | error | stale
- note.ai_summary_status: idle | queued | processing | done | error
- note.focus_prompt: el prompt usado para generar la subnota
- note.children?: Note[] → árbol hidratado por useNoteTree.ts (NO viene así de DB, se construye en el hook)
- summaries tabla: una nota puede tener N summaries (target_objective diferente cada uno)

## Hooks de Datos
- src/lib/useNoteTree.ts   → Construye árbol parent-child de notas. Lee de groups en store.
- src/lib/useSummaries.ts  → CRUD de summaries para una nota. Llama a Gemini para generar.

## Reglas Críticas
- **Exportación**: Se utiliza el helper `getRecursiveNoteMarkdown` en `App.tsx` para recorrer el árbol. IMPORTANTE: Los resúmenes se filtran por `note_id`.
- NO tocar parent_note_id ni generation_level sin entender el árbol completo.
- summaryCounts en store es solo un contador de badges — la data real está en useSummaries.
- El panel NoteAIPanel tiene su propio estado persistido: aiPanelOpenByNote y activeTabByNote en store.
- LinkifiedText tiene floating selection menu compacto activado por botón 🏷️ — NO reimplementar sin leer el componente completo.
- is_checklist cambia el editor completo — nunca cambiar este flag sin re-montar el editor.