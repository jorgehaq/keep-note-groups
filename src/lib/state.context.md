# DOMINIO STATE — Contexto para el Agente

## Archivos
- store.ts         → Zustand store con persist (localStorage). ÚNICA fuente de verdad UI.
- supabaseClient.ts → Instancia singleton de Supabase. Importar de aquí siempre.

## UIStore — Campos Críticos
- groups: Group[]                    → Lista maestra de grupos+notas. REALTIME.
- activeGroupId: string | null       → Grupo activo en la vista notes.
- globalView: GlobalAppView          → Vista activa de la app.
- openNotesByGroup: Record<gId, nId[]> → Notas abiertas por grupo (acordeón).
- focusedNoteByGroup: Record<gId, nId> → Nota con foco visual activo.
- lastActiveNoteByGroup: Record<gId, nId> → Última nota activa (para restaurar foco).
- noteTrayOpenByGroup: Record<gId, bool> → Si el panel lateral de notas está abierto.
- summaryCounts: Record<noteId, number> → Contadores de summaries para badges.
- dockedGroupIds: string[]           → Grupos fijados en el Sidebar.
- aiPanelOpenByNote / aiPanelOpenByBrainDump → Estado del panel AI por entidad.
- activeTabByNote / activeTabByBrainDump → Tab activo del panel AI.
- isZenModeByApp: Record<appView, bool> → Zen mode por vista.
- pizarronVisibleByNoteAndTab: Record<noteId, Record<tabId, bool>>

## Acciones Clave
- updateNoteSync(id, partial)  → Actualiza nota en groups[] sin re-fetch.
- deleteNoteSync(id)           → Elimina nota de groups[] sin re-fetch.
- updateGroupSync / deleteGroupSync → Ídem para grupos.
- resetUIState()               → Limpia IDs persistidos (on SIGNED_OUT).
- setFocusedNoteId(gId, nId)   → Sincroniza focusedNoteByGroup y lastActiveNoteByGroup.

## Reglas
- Nunca instanciar Supabase fuera de supabaseClient.ts.
- Nunca escribir directamente en store.groups sin usar setGroups o updateNoteSync.
- El persist de Zustand excluye campos volátiles como overdueRemindersList.
- useUIStore.getState() para acceso síncrono fuera de componentes React.