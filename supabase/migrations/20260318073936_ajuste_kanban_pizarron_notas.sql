alter table "public"."notes" drop constraint "notes_parent_note_id_fkey";

alter table "public"."brain_dumps" add column "ai_summary_status" public.ai_job_status default 'idle'::public.ai_job_status;

alter table "public"."brain_dumps" add column "focus_prompt" text;

alter table "public"."brain_dumps" add column "generation_level" integer default 0;

alter table "public"."brain_dumps" add column "generation_status" text default 'idle'::text;

alter table "public"."brain_dumps" add column "parent_id" uuid;

alter table "public"."brain_dumps" add column "scratchpad" text;

alter table "public"."notes" add column "is_open" boolean default false;

alter table "public"."summaries" add column "brain_dump_id" uuid;

alter table "public"."summaries" add column "scratchpad" text default ''::text;

CREATE INDEX idx_brain_dumps_parent ON public.brain_dumps USING btree (parent_id);

CREATE INDEX idx_summaries_brain_dump_id ON public.summaries USING btree (brain_dump_id);

alter table "public"."brain_dumps" add constraint "brain_dumps_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES public.brain_dumps(id) ON DELETE CASCADE not valid;

alter table "public"."brain_dumps" validate constraint "brain_dumps_parent_id_fkey";

alter table "public"."summaries" add constraint "summaries_brain_dump_id_fkey" FOREIGN KEY (brain_dump_id) REFERENCES public.brain_dumps(id) ON DELETE CASCADE not valid;

alter table "public"."summaries" validate constraint "summaries_brain_dump_id_fkey";

alter table "public"."notes" add constraint "notes_parent_note_id_fkey" FOREIGN KEY (parent_note_id) REFERENCES public.notes(id) ON DELETE SET NULL not valid;

alter table "public"."notes" validate constraint "notes_parent_note_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.fn_sync_braindump_title_to_kanban()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF (NEW.title IS DISTINCT FROM OLD.title) THEN
        UPDATE public.tasks 
        SET title = NEW.title 
        WHERE linked_board_id = NEW.id 
          AND (title IS DISTINCT FROM NEW.title);
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_sync_task_title_to_braindump()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF (NEW.title IS DISTINCT FROM OLD.title AND NEW.linked_board_id IS NOT NULL) THEN
        UPDATE public.brain_dumps 
        SET title = NEW.title 
        WHERE id = NEW.linked_board_id 
          AND (title IS DISTINCT FROM NEW.title);
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_sync_braindump_title_to_tasks()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF (NEW.title IS DISTINCT FROM OLD.title) THEN
        UPDATE public.tasks 
        SET title = NEW.title 
        WHERE (linked_board_id = NEW.id OR id = NEW.id)
          AND (title IS DISTINCT FROM NEW.title);
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_sync_note_title_to_tasks()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF (NEW.title IS DISTINCT FROM OLD.title) THEN
        UPDATE public.tasks 
        SET title = NEW.title 
        WHERE (linked_note_id = NEW.id OR id = NEW.id)
          AND (title IS DISTINCT FROM NEW.title);
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_sync_task_title_to_links()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF (NEW.title IS DISTINCT FROM OLD.title) THEN
        -- Sincronizar hacia Notas (por vínculo o por ID legacy)
        UPDATE public.notes 
        SET title = NEW.title 
        WHERE (id = NEW.linked_note_id OR id = NEW.id) 
          AND (title IS DISTINCT FROM NEW.title);

        -- Sincronizar hacia Pizarrones (por vínculo o por ID legacy)
        UPDATE public.brain_dumps 
        SET title = NEW.title 
        WHERE (id = NEW.linked_board_id OR id = NEW.id) 
          AND (title IS DISTINCT FROM NEW.title);
    END IF;
    RETURN NEW;
END;
$function$
;


  create policy "Users can manage summaries of their brain_dumps"
  on "public"."summaries"
  as permissive
  for all
  to authenticated
using (((EXISTS ( SELECT 1
   FROM public.notes
  WHERE ((notes.id = summaries.note_id) AND (notes.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.brain_dumps
  WHERE ((brain_dumps.id = summaries.brain_dump_id) AND (brain_dumps.user_id = auth.uid()))))))
with check (((EXISTS ( SELECT 1
   FROM public.notes
  WHERE ((notes.id = summaries.note_id) AND (notes.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.brain_dumps
  WHERE ((brain_dumps.id = summaries.brain_dump_id) AND (brain_dumps.user_id = auth.uid()))))));


CREATE TRIGGER tr_sync_braindump_primary_title AFTER UPDATE OF title ON public.brain_dumps FOR EACH ROW EXECUTE FUNCTION public.fn_sync_braindump_title_to_tasks();

CREATE TRIGGER tr_sync_braindump_to_task AFTER UPDATE OF title ON public.brain_dumps FOR EACH ROW EXECUTE FUNCTION public.fn_sync_braindump_title_to_kanban();

CREATE TRIGGER tr_sync_task_to_braindump AFTER UPDATE OF title ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.fn_sync_task_title_to_braindump();


