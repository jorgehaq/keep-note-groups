drop policy "Users can manage summaries of their notes" on "public"."summaries";

alter table "public"."summaries" alter column "status" drop default;

alter table "public"."summaries" alter column status type "public"."summary_status" using status::text::"public"."summary_status";

alter table "public"."summaries" alter column "status" set default 'pending'::public.summary_status;

alter table "public"."notes" add column "ai_generated" boolean default false;

alter table "public"."notes" add column "focus_prompt" text;

alter table "public"."notes" add column "generation_level" integer default 0;

alter table "public"."notes" add column "generation_status" text default 'idle'::text;

alter table "public"."notes" add column "parent_note_id" uuid;

alter table "public"."summaries" alter column "content" drop default;

alter table "public"."summaries" alter column "created_at" drop not null;

alter table "public"."summaries" alter column "note_id" drop not null;

alter table "public"."summaries" alter column "status" drop not null;

CREATE INDEX idx_notes_parent ON public.notes USING btree (parent_note_id);

CREATE INDEX idx_summaries_note_id ON public.summaries USING btree (note_id);

alter table "public"."notes" add constraint "notes_parent_note_id_fkey" FOREIGN KEY (parent_note_id) REFERENCES public.notes(id) ON DELETE CASCADE not valid;

alter table "public"."notes" validate constraint "notes_parent_note_id_fkey";


  create policy "Users can manage summaries of their notes"
  on "public"."summaries"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.notes
  WHERE ((notes.id = summaries.note_id) AND (notes.user_id = auth.uid())))));



