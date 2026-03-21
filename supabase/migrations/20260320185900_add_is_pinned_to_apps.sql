-- MIGRACIÓN PARA FUNCIONALIDAD DE PIN EN TIKTOK Y PIZARRÓN
-- Agrega la columna is_pinned a las tablas tiktok_videos y brain_dumps

-- 1. Añadir columna is_pinned a tiktok_videos
ALTER TABLE tiktok_videos 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- 2. Añadir columna is_pinned a brain_dumps
ALTER TABLE brain_dumps 
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
