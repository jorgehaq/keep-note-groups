-- 1. Agregar columnas de vinculación a la tabla tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS linked_note_id uuid REFERENCES public.notes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS linked_board_id uuid REFERENCES public.brain_dumps(id) ON DELETE SET NULL;

-- 2. Función para sincronizar desde TASK hacia NOTE o BRAINDUMP (Pizarrón)
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

        -- Sincronizar hacia BrainDump (Pizarrón)
        IF (NEW.linked_board_id IS NOT NULL) THEN
            UPDATE public.brain_dumps 
            SET title = NEW.title 
            WHERE id = NEW.linked_board_id 
              AND (title IS DISTINCT FROM NEW.title);
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Función para sincronizar desde NOTE hacia TASKS vinculadas
CREATE OR REPLACE FUNCTION public.fn_sync_note_title_to_tasks()
RETURNS trigger AS $$
BEGIN
    IF (NEW.title IS DISTINCT FROM OLD.title) THEN
        UPDATE public.tasks 
        SET title = NEW.title 
        WHERE (linked_note_id = NEW.id OR source_id = NEW.id)
          AND (title IS DISTINCT FROM NEW.title);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Función para sincronizar desde BRAINDUMP hacia TASKS vinculadas
CREATE OR REPLACE FUNCTION public.fn_sync_braindump_title_to_tasks()
RETURNS trigger AS $$
BEGIN
    IF (NEW.title IS DISTINCT FROM OLD.title) THEN
        UPDATE public.tasks 
        SET title = NEW.title 
        WHERE (linked_board_id = NEW.id OR source_id = NEW.id)
          AND (title IS DISTINCT FROM NEW.title);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Crear Triggers

-- Trigger en Tasks
DROP TRIGGER IF EXISTS tr_sync_task_title ON public.tasks;
CREATE TRIGGER tr_sync_task_title
AFTER UPDATE OF title ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_task_title_to_links();

-- Trigger en Notes
DROP TRIGGER IF EXISTS tr_sync_note_title ON public.notes;
CREATE TRIGGER tr_sync_note_title
AFTER UPDATE OF title ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_note_title_to_tasks();

-- Trigger en BrainDumps (Pizarrones)
DROP TRIGGER IF EXISTS tr_sync_braindump_title ON public.brain_dumps;
CREATE TRIGGER tr_sync_braindump_title
AFTER UPDATE OF title ON public.brain_dumps
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_braindump_title_to_tasks();
