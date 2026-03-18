# DOMINIO KANBAN — Contexto para el Agente

## Componentes
- KanbanApp.tsx          → Orquestador. Escucha evento 'kanban-updated'.
- KanbanBoard.tsx        → Tablero principal con columnas.
- KanbanList.tsx         → Columna individual (backlog|todo|in_progress|done|archived).
- KanbanTaskModal.tsx    → Crear/editar tarea.
- KanbanTaskViewerModal.tsx → Ver detalle de tarea.
- KanbanLinkerModal.tsx  → Vincular task a nota existente.
- KanbanSemaphore.tsx    → Indicador visual de estado (colores semáforo).
- PizarronLinkerModal.tsx → Vincular task a brain_dump (pizarrón).

## Task Schema (types.ts)
- status: backlog | todo | in_progress | done | archived
- linked_note_id?: string  → vinculada a una nota
- linked_board_id?: string → vinculada a un pizarrón
- source_id?: string       → de dónde fue convertida

## Contadores en Sidebar
- kanbanTodoCount, kanbanInProgressCount, kanbanDoneCount en store.
- Se actualizan vía polling (30s) + evento 'kanban-updated'.
- globalTasks en store: copia plana de todas las tasks para acceso cross-component.

## Reglas
- Drag & drop de columnas usa position (int). Al reordenar, actualizar position en DB.
- Las tasks vinculadas a notas/pizarrones muestran un badge de link — no romper esta relación al editar.