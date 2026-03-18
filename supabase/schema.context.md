# SUPABASE SCHEMA — Fuente de Verdad (producción)

## Extensiones Activas
- uuid-ossp, pgcrypto, pg_graphql, moddatetime, supabase_vault

## Enums Definidos
- ai_job_status: idle | queued | processing | completed | error
- summary_status: pending | processing | completed | failed  ← OJO: 'failed' no 'error'

## Tablas y Columnas Exactas

### groups
  id(uuid), user_id(uuid→auth.users), name(text), created_at, is_pinned(bool), 
  last_accessed_at, is_favorite(bool)

### notes
  id, user_id, group_id(→groups CASCADE), title, content, position(int),
  created_at, is_pinned, updated_at [trigger moddatetime], is_docked,
  is_checklist, ai_summary_status(ai_job_status, default idle),
  ai_generated(bool), focus_prompt, generation_level(int default 0),
  generation_status(text default 'idle'), parent_note_id(→notes CASCADE),
  scratchpad(text)
  Índices: idx_notes_ai_status (WHERE queued), idx_notes_parent

### brain_dumps
  id, user_id, content, created_at, status(varchar default 'history'),
  updated_at, title, is_checklist(bool)
  ⚠️ NO tiene: parent_id, generation_level, ai_summary_status, generation_status, scratchpad, focus_prompt

### summaries
  id, note_id(→notes CASCADE), target_objective, content,
  status(summary_status default pending), created_at
  ⚠️ NO tiene: brain_dump_id, scratchpad, user_id
  Índice: idx_summaries_note_id

### tasks
  id, title, status(text default backlog), position, user_id, created_at,
  updated_at [trigger moddatetime], source_id(uuid), content
  ⚠️ NO tiene: linked_note_id, linked_board_id
  Índice: idx_tasks_source_id

### timers
  id, title, type(stopwatch|countdown), status(running|paused), accumulated_seconds,
  target_seconds, last_started_at, user_id, created_at, updated_at [moddatetime],
  content(text), laps(jsonb default []), accumulated_ms(bigint default 0)

### timer_logs
  id, timer_id(uuid), user_id, duration_seconds(int), created_at

### reminders
  id, title, content, due_at, is_completed, user_id, created_at,
  status(text default active), targets(jsonb default []), updated_at [trigger]
  targets schema: [{ id, title, due_at, is_completed, ... }]

### translations
  id, user_id, source_text, translated_text, source_lang(varchar 10),
  target_lang(varchar 10), created_at

### yo_perfil   ← Tabla de perfil AI del usuario
  id, user_id, yo_json(jsonb default {}), updated_at

### yo_memoria  ← Tabla de memoria AI del usuario
  id, user_id, temas(text[]), marcadores_frecuentes(jsonb),
  patrones(text[]), preguntas_abiertas(text[]), palabras_clave(text[]),
  total_notas_procesadas(int), updated_at

## RLS — Todas las tablas tienen RLS ON
  Política estándar: auth.uid() = user_id
  Excepción: summaries NO tiene user_id → hereda acceso vía CASCADE de notes.

## Realtime Publication (tablas habilitadas)
  brain_dumps, groups, notes, reminders, summaries, tasks, translations
  ❌ NO están en realtime: timers, timer_logs, yo_memoria, yo_perfil

## Patrón para Nueva Tabla (nueva app)
  1. Crear tabla con user_id DEFAULT auth.uid() NOT NULL
  2. Agregar FK a auth.users ON DELETE CASCADE
  3. Agregar trigger moddatetime para updated_at
  4. CREATE POLICY: USING (auth.uid() = user_id)
  5. ENABLE ROW LEVEL SECURITY
  6. Si necesita sync: ALTER PUBLICATION supabase_realtime ADD TABLE public.nueva_tabla
  7. Declarar el tipo en types.ts
  8. Agregar al canal en App.tsx si necesita Realtime