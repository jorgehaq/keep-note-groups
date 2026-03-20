-- 🚀 Migración: Añadir order_index (Fraccional Indexing) para ordenamiento Senior

-- Añadir columna order_index de tipo float8 (decimal de doble precisión)
ALTER TABLE IF EXISTS notes ADD COLUMN IF NOT EXISTS order_index float8;
ALTER TABLE IF EXISTS summaries ADD COLUMN IF NOT EXISTS order_index float8;
ALTER TABLE IF EXISTS brain_dumps ADD COLUMN IF NOT EXISTS order_index float8;
ALTER TABLE IF EXISTS tiktok_videos ADD COLUMN IF NOT EXISTS order_index float8;

-- 🛡️ Inicializar valores basados en created_at para preservar el orden cronológico existente
UPDATE notes SET order_index = EXTRACT(EPOCH FROM created_at) WHERE order_index IS NULL;
UPDATE summaries SET order_index = EXTRACT(EPOCH FROM created_at) WHERE order_index IS NULL;
UPDATE brain_dumps SET order_index = EXTRACT(EPOCH FROM created_at) WHERE order_index IS NULL;
UPDATE tiktok_videos SET order_index = EXTRACT(EPOCH FROM created_at) WHERE order_index IS NULL;

-- ⚡ Índices para optimizar la carga de pestañas y trays
CREATE INDEX IF NOT EXISTS idx_notes_order_index ON notes(order_index);
CREATE INDEX IF NOT EXISTS idx_summaries_order_index ON summaries(order_index);
CREATE INDEX IF NOT EXISTS idx_braindumps_order_index ON brain_dumps(order_index);
CREATE INDEX IF NOT EXISTS idx_tiktok_videos_order_index ON tiktok_videos(order_index);
