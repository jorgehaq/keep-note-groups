-- Agregar columnas a la tabla notas existente
ALTER TABLE notes ADD COLUMN IF NOT EXISTS parent_note_id UUID REFERENCES notes(id) ON DELETE CASCADE;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS generation_level INTEGER DEFAULT 0;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS focus_prompt TEXT;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS generation_status TEXT DEFAULT 'idle';
-- generation_status: 'idle' | 'queued' | 'processing' | 'done' | 'error' | 'stale'

-- Índice para consultar hijos de una nota eficientemente
CREATE INDEX IF NOT EXISTS idx_notes_parent ON notes(parent_note_id);
