# DOMINIO EDITOR — Contexto para el Agente

## Archivos
- SmartNotesEditor.tsx → Editor principal. CodeMirror 6.
- ChecklistEditor.tsx  → Editor de checklists. Se monta cuando note.is_checklist = true.
- TiptapExtensions.ts  → Solo extensiones. HighlightMark, TranslationMark, CustomLink, SmartTabs.
- NoteEditor.tsx (src/components/) → Editor Tiptap completo. Contexto específico, NO es el default.

## SmartNotesEditor — Features Implementadas
- Scroll persistence: localStorage key `codemirror-scroll-{noteId}` (guardar/restaurar onBlur/onFocus).
- Line numbers: toggle externo via prop, refleja localStorage 'app-show-line-numbers'.
- Cursor position: Decoration.line() para indicador visual de línea activa.
- Performance: viewport-limited line scanning para pastes grandes.
- Text selection color: definido globalmente en index.html <head> con !important.

## TiptapExtensions — Markers
- HighlightMark: bg #ccff00 en renderHTML. En UI se mapea a #FACC15 (amber).
- TranslationMark: bg #60A5FA. Tiene atributos translationId y translationText.
- CustomLink: openOnClick=true, autolink=true.
- SmartTabs: Tab inserta 4 &nbsp; (no tab character).

## Reglas
- CodeMirror y Tiptap son sistemas completamente separados. NO mezclarlos.
- Nunca cambiar TiptapExtensions sin verificar que NoteEditor.tsx y SmartEditor.tsx sigan funcionando.
- El editor correcto se selecciona en SmartEditor.tsx basándose en is_checklist — la lógica de selección vive ahí.