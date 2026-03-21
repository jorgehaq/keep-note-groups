-- TikTok Kanban Integration Migration
-- 1. Agregar columna de vinculación a TikTok en la tabla tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS linked_tiktok_id uuid REFERENCES public.tiktok_videos(id) ON DELETE SET NULL;

-- 2. Actualizar la función de sincronización Task -> Links
CREATE OR REPLACE FUNCTION public.fn_sync_task_title_to_links()
RETURNS trigger AS $$
BEGIN
    -- Si el título cambió
    IF (NEW.title IS DISTINCT FROM OLD.title) THEN
        -- Sincronizar hacia Note
        IF (NEW.linked_note_id IS NOT NULL) THEN
            UPDATE public.notes 
            SET title = NEW.title 
            WHERE id = NEW.linked_note_id 
              AND (title IS DISTINCT FROM NEW.title);
        END IF;

        -- Sincronizar hacia Pizarrón (BrainDump)
        IF (NEW.linked_board_id IS NOT NULL) THEN
            UPDATE public.brain_dumps 
            SET title = NEW.title 
            WHERE id = NEW.linked_board_id 
              AND (title IS DISTINCT FROM NEW.title);
        END IF;

        -- Sincronizar hacia TikTok
        IF (NEW.linked_tiktok_id IS NOT NULL) THEN
            UPDATE public.tiktok_videos 
            SET title = NEW.title 
            WHERE id = NEW.linked_tiktok_id 
              AND (title IS DISTINCT FROM NEW.title);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear función de sincronización TikTok -> Task
CREATE OR REPLACE FUNCTION public.fn_sync_tiktok_title_to_tasks()
RETURNS trigger AS $$
BEGIN
    IF (NEW.title IS DISTINCT FROM OLD.title) THEN
        UPDATE public.tasks 
        SET title = NEW.title 
        WHERE (linked_tiktok_id = NEW.id OR id = NEW.id)
          AND (title IS DISTINCT FROM NEW.title);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Crear Trigger en TikTok Videos
DROP TRIGGER IF EXISTS tr_sync_tiktok_title ON public.tiktok_videos;
CREATE TRIGGER tr_sync_tiktok_title
AFTER UPDATE OF title ON public.tiktok_videos
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_tiktok_title_to_tasks();
