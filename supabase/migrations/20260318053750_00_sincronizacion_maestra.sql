create extension if not exists "moddatetime" with schema "extensions";

drop extension if exists "pg_net";

create type "public"."ai_job_status" as enum ('idle', 'queued', 'processing', 'completed', 'error');

create type "public"."summary_status" as enum ('pending', 'processing', 'completed', 'failed');


  create table "public"."brain_dumps" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null default auth.uid(),
    "content" text not null,
    "created_at" timestamp with time zone default now(),
    "status" character varying default 'history'::character varying,
    "updated_at" timestamp with time zone default now(),
    "title" text,
    "is_checklist" boolean default false
      );


alter table "public"."brain_dumps" enable row level security;


  create table "public"."groups" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "name" text not null,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "is_pinned" boolean default false,
    "last_accessed_at" timestamp with time zone default now(),
    "is_favorite" boolean default false
      );


alter table "public"."groups" enable row level security;


  create table "public"."notes" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "group_id" uuid not null,
    "title" text,
    "content" text,
    "position" integer default 0,
    "created_at" timestamp with time zone not null default timezone('utc'::text, now()),
    "is_pinned" boolean default false,
    "updated_at" timestamp with time zone default now(),
    "is_docked" boolean default false,
    "is_checklist" boolean default false,
    "ai_summary_status" public.ai_job_status default 'idle'::public.ai_job_status,
    "ai_generated" boolean default false,
    "focus_prompt" text,
    "generation_level" integer default 0,
    "generation_status" text default 'idle'::text,
    "parent_note_id" uuid,
    "scratchpad" text default ''::text
      );


alter table "public"."notes" enable row level security;


  create table "public"."reminders" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "content" text,
    "due_at" timestamp with time zone,
    "is_completed" boolean not null default false,
    "user_id" uuid not null default auth.uid(),
    "created_at" timestamp with time zone default now(),
    "status" text default 'active'::text,
    "targets" jsonb default '[]'::jsonb,
    "updated_at" timestamp with time zone default timezone('utc'::text, now())
      );


alter table "public"."reminders" enable row level security;


  create table "public"."summaries" (
    "id" uuid not null default gen_random_uuid(),
    "note_id" uuid,
    "target_objective" text,
    "content" text,
    "status" public.summary_status default 'pending'::public.summary_status,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."summaries" enable row level security;


  create table "public"."tasks" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "status" text not null default 'backlog'::text,
    "position" integer not null default 0,
    "user_id" uuid not null default auth.uid(),
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "source_id" uuid,
    "content" text
      );


alter table "public"."tasks" enable row level security;


  create table "public"."timer_logs" (
    "id" uuid not null default gen_random_uuid(),
    "timer_id" uuid not null,
    "user_id" uuid not null default auth.uid(),
    "duration_seconds" integer not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."timer_logs" enable row level security;


  create table "public"."timers" (
    "id" uuid not null default gen_random_uuid(),
    "title" text not null,
    "type" text not null default 'stopwatch'::text,
    "status" text not null default 'paused'::text,
    "accumulated_seconds" integer not null default 0,
    "target_seconds" integer default 0,
    "last_started_at" timestamp with time zone,
    "user_id" uuid not null default auth.uid(),
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now(),
    "content" text default ''::text,
    "laps" jsonb default '[]'::jsonb,
    "accumulated_ms" bigint default 0
      );


alter table "public"."timers" enable row level security;


  create table "public"."translations" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null default auth.uid(),
    "source_text" text not null,
    "translated_text" text not null,
    "source_lang" character varying(10) not null,
    "target_lang" character varying(10) not null,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."translations" enable row level security;


  create table "public"."yo_memoria" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "temas" text[] default '{}'::text[],
    "marcadores_frecuentes" jsonb default '[]'::jsonb,
    "patrones" text[] default '{}'::text[],
    "preguntas_abiertas" text[] default '{}'::text[],
    "palabras_clave" text[] default '{}'::text[],
    "total_notas_procesadas" integer default 0,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."yo_memoria" enable row level security;


  create table "public"."yo_perfil" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "yo_json" jsonb default '{}'::jsonb,
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."yo_perfil" enable row level security;

CREATE UNIQUE INDEX brain_dumps_pkey ON public.brain_dumps USING btree (id);

CREATE UNIQUE INDEX groups_pkey ON public.groups USING btree (id);

CREATE INDEX idx_notes_ai_status ON public.notes USING btree (ai_summary_status) WHERE (ai_summary_status = 'queued'::public.ai_job_status);

CREATE INDEX idx_notes_parent ON public.notes USING btree (parent_note_id);

CREATE INDEX idx_summaries_note_id ON public.summaries USING btree (note_id);

CREATE INDEX idx_tasks_source_id ON public.tasks USING btree (source_id);

CREATE UNIQUE INDEX notes_pkey ON public.notes USING btree (id);

CREATE UNIQUE INDEX reminders_pkey ON public.reminders USING btree (id);

CREATE UNIQUE INDEX summaries_pkey ON public.summaries USING btree (id);

CREATE UNIQUE INDEX tasks_pkey ON public.tasks USING btree (id);

CREATE UNIQUE INDEX timer_logs_pkey ON public.timer_logs USING btree (id);

CREATE UNIQUE INDEX timers_pkey ON public.timers USING btree (id);

CREATE UNIQUE INDEX translations_pkey ON public.translations USING btree (id);

CREATE UNIQUE INDEX yo_memoria_pkey ON public.yo_memoria USING btree (id);

CREATE UNIQUE INDEX yo_perfil_pkey ON public.yo_perfil USING btree (id);

alter table "public"."brain_dumps" add constraint "brain_dumps_pkey" PRIMARY KEY using index "brain_dumps_pkey";

alter table "public"."groups" add constraint "groups_pkey" PRIMARY KEY using index "groups_pkey";

alter table "public"."notes" add constraint "notes_pkey" PRIMARY KEY using index "notes_pkey";

alter table "public"."reminders" add constraint "reminders_pkey" PRIMARY KEY using index "reminders_pkey";

alter table "public"."summaries" add constraint "summaries_pkey" PRIMARY KEY using index "summaries_pkey";

alter table "public"."tasks" add constraint "tasks_pkey" PRIMARY KEY using index "tasks_pkey";

alter table "public"."timer_logs" add constraint "timer_logs_pkey" PRIMARY KEY using index "timer_logs_pkey";

alter table "public"."timers" add constraint "timers_pkey" PRIMARY KEY using index "timers_pkey";

alter table "public"."translations" add constraint "translations_pkey" PRIMARY KEY using index "translations_pkey";

alter table "public"."yo_memoria" add constraint "yo_memoria_pkey" PRIMARY KEY using index "yo_memoria_pkey";

alter table "public"."yo_perfil" add constraint "yo_perfil_pkey" PRIMARY KEY using index "yo_perfil_pkey";

alter table "public"."brain_dumps" add constraint "brain_dumps_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."brain_dumps" validate constraint "brain_dumps_user_id_fkey";

alter table "public"."groups" add constraint "groups_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."groups" validate constraint "groups_user_id_fkey";

alter table "public"."notes" add constraint "notes_group_id_fkey" FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE CASCADE not valid;

alter table "public"."notes" validate constraint "notes_group_id_fkey";

alter table "public"."notes" add constraint "notes_parent_note_id_fkey" FOREIGN KEY (parent_note_id) REFERENCES public.notes(id) ON DELETE CASCADE not valid;

alter table "public"."notes" validate constraint "notes_parent_note_id_fkey";

alter table "public"."notes" add constraint "notes_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) not valid;

alter table "public"."notes" validate constraint "notes_user_id_fkey";

alter table "public"."reminders" add constraint "reminders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."reminders" validate constraint "reminders_user_id_fkey";

alter table "public"."summaries" add constraint "summaries_note_id_fkey" FOREIGN KEY (note_id) REFERENCES public.notes(id) ON DELETE CASCADE not valid;

alter table "public"."summaries" validate constraint "summaries_note_id_fkey";

alter table "public"."tasks" add constraint "tasks_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."tasks" validate constraint "tasks_user_id_fkey";

alter table "public"."timer_logs" add constraint "timer_logs_timer_id_fkey" FOREIGN KEY (timer_id) REFERENCES public.timers(id) ON DELETE CASCADE not valid;

alter table "public"."timer_logs" validate constraint "timer_logs_timer_id_fkey";

alter table "public"."timer_logs" add constraint "timer_logs_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."timer_logs" validate constraint "timer_logs_user_id_fkey";

alter table "public"."timers" add constraint "timers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."timers" validate constraint "timers_user_id_fkey";

alter table "public"."translations" add constraint "translations_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."translations" validate constraint "translations_user_id_fkey";

alter table "public"."yo_memoria" add constraint "yo_memoria_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."yo_memoria" validate constraint "yo_memoria_user_id_fkey";

alter table "public"."yo_perfil" add constraint "yo_perfil_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."yo_perfil" validate constraint "yo_perfil_user_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_modified_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;   
END;
$function$
;

grant delete on table "public"."brain_dumps" to "anon";

grant insert on table "public"."brain_dumps" to "anon";

grant references on table "public"."brain_dumps" to "anon";

grant select on table "public"."brain_dumps" to "anon";

grant trigger on table "public"."brain_dumps" to "anon";

grant truncate on table "public"."brain_dumps" to "anon";

grant update on table "public"."brain_dumps" to "anon";

grant delete on table "public"."brain_dumps" to "authenticated";

grant insert on table "public"."brain_dumps" to "authenticated";

grant references on table "public"."brain_dumps" to "authenticated";

grant select on table "public"."brain_dumps" to "authenticated";

grant trigger on table "public"."brain_dumps" to "authenticated";

grant truncate on table "public"."brain_dumps" to "authenticated";

grant update on table "public"."brain_dumps" to "authenticated";

grant delete on table "public"."brain_dumps" to "service_role";

grant insert on table "public"."brain_dumps" to "service_role";

grant references on table "public"."brain_dumps" to "service_role";

grant select on table "public"."brain_dumps" to "service_role";

grant trigger on table "public"."brain_dumps" to "service_role";

grant truncate on table "public"."brain_dumps" to "service_role";

grant update on table "public"."brain_dumps" to "service_role";

grant delete on table "public"."groups" to "anon";

grant insert on table "public"."groups" to "anon";

grant references on table "public"."groups" to "anon";

grant select on table "public"."groups" to "anon";

grant trigger on table "public"."groups" to "anon";

grant truncate on table "public"."groups" to "anon";

grant update on table "public"."groups" to "anon";

grant delete on table "public"."groups" to "authenticated";

grant insert on table "public"."groups" to "authenticated";

grant references on table "public"."groups" to "authenticated";

grant select on table "public"."groups" to "authenticated";

grant trigger on table "public"."groups" to "authenticated";

grant truncate on table "public"."groups" to "authenticated";

grant update on table "public"."groups" to "authenticated";

grant delete on table "public"."groups" to "service_role";

grant insert on table "public"."groups" to "service_role";

grant references on table "public"."groups" to "service_role";

grant select on table "public"."groups" to "service_role";

grant trigger on table "public"."groups" to "service_role";

grant truncate on table "public"."groups" to "service_role";

grant update on table "public"."groups" to "service_role";

grant delete on table "public"."notes" to "anon";

grant insert on table "public"."notes" to "anon";

grant references on table "public"."notes" to "anon";

grant select on table "public"."notes" to "anon";

grant trigger on table "public"."notes" to "anon";

grant truncate on table "public"."notes" to "anon";

grant update on table "public"."notes" to "anon";

grant delete on table "public"."notes" to "authenticated";

grant insert on table "public"."notes" to "authenticated";

grant references on table "public"."notes" to "authenticated";

grant select on table "public"."notes" to "authenticated";

grant trigger on table "public"."notes" to "authenticated";

grant truncate on table "public"."notes" to "authenticated";

grant update on table "public"."notes" to "authenticated";

grant delete on table "public"."notes" to "service_role";

grant insert on table "public"."notes" to "service_role";

grant references on table "public"."notes" to "service_role";

grant select on table "public"."notes" to "service_role";

grant trigger on table "public"."notes" to "service_role";

grant truncate on table "public"."notes" to "service_role";

grant update on table "public"."notes" to "service_role";

grant delete on table "public"."reminders" to "anon";

grant insert on table "public"."reminders" to "anon";

grant references on table "public"."reminders" to "anon";

grant select on table "public"."reminders" to "anon";

grant trigger on table "public"."reminders" to "anon";

grant truncate on table "public"."reminders" to "anon";

grant update on table "public"."reminders" to "anon";

grant delete on table "public"."reminders" to "authenticated";

grant insert on table "public"."reminders" to "authenticated";

grant references on table "public"."reminders" to "authenticated";

grant select on table "public"."reminders" to "authenticated";

grant trigger on table "public"."reminders" to "authenticated";

grant truncate on table "public"."reminders" to "authenticated";

grant update on table "public"."reminders" to "authenticated";

grant delete on table "public"."reminders" to "service_role";

grant insert on table "public"."reminders" to "service_role";

grant references on table "public"."reminders" to "service_role";

grant select on table "public"."reminders" to "service_role";

grant trigger on table "public"."reminders" to "service_role";

grant truncate on table "public"."reminders" to "service_role";

grant update on table "public"."reminders" to "service_role";

grant delete on table "public"."summaries" to "anon";

grant insert on table "public"."summaries" to "anon";

grant references on table "public"."summaries" to "anon";

grant select on table "public"."summaries" to "anon";

grant trigger on table "public"."summaries" to "anon";

grant truncate on table "public"."summaries" to "anon";

grant update on table "public"."summaries" to "anon";

grant delete on table "public"."summaries" to "authenticated";

grant insert on table "public"."summaries" to "authenticated";

grant references on table "public"."summaries" to "authenticated";

grant select on table "public"."summaries" to "authenticated";

grant trigger on table "public"."summaries" to "authenticated";

grant truncate on table "public"."summaries" to "authenticated";

grant update on table "public"."summaries" to "authenticated";

grant delete on table "public"."summaries" to "service_role";

grant insert on table "public"."summaries" to "service_role";

grant references on table "public"."summaries" to "service_role";

grant select on table "public"."summaries" to "service_role";

grant trigger on table "public"."summaries" to "service_role";

grant truncate on table "public"."summaries" to "service_role";

grant update on table "public"."summaries" to "service_role";

grant delete on table "public"."tasks" to "anon";

grant insert on table "public"."tasks" to "anon";

grant references on table "public"."tasks" to "anon";

grant select on table "public"."tasks" to "anon";

grant trigger on table "public"."tasks" to "anon";

grant truncate on table "public"."tasks" to "anon";

grant update on table "public"."tasks" to "anon";

grant delete on table "public"."tasks" to "authenticated";

grant insert on table "public"."tasks" to "authenticated";

grant references on table "public"."tasks" to "authenticated";

grant select on table "public"."tasks" to "authenticated";

grant trigger on table "public"."tasks" to "authenticated";

grant truncate on table "public"."tasks" to "authenticated";

grant update on table "public"."tasks" to "authenticated";

grant delete on table "public"."tasks" to "service_role";

grant insert on table "public"."tasks" to "service_role";

grant references on table "public"."tasks" to "service_role";

grant select on table "public"."tasks" to "service_role";

grant trigger on table "public"."tasks" to "service_role";

grant truncate on table "public"."tasks" to "service_role";

grant update on table "public"."tasks" to "service_role";

grant delete on table "public"."timer_logs" to "anon";

grant insert on table "public"."timer_logs" to "anon";

grant references on table "public"."timer_logs" to "anon";

grant select on table "public"."timer_logs" to "anon";

grant trigger on table "public"."timer_logs" to "anon";

grant truncate on table "public"."timer_logs" to "anon";

grant update on table "public"."timer_logs" to "anon";

grant delete on table "public"."timer_logs" to "authenticated";

grant insert on table "public"."timer_logs" to "authenticated";

grant references on table "public"."timer_logs" to "authenticated";

grant select on table "public"."timer_logs" to "authenticated";

grant trigger on table "public"."timer_logs" to "authenticated";

grant truncate on table "public"."timer_logs" to "authenticated";

grant update on table "public"."timer_logs" to "authenticated";

grant delete on table "public"."timer_logs" to "service_role";

grant insert on table "public"."timer_logs" to "service_role";

grant references on table "public"."timer_logs" to "service_role";

grant select on table "public"."timer_logs" to "service_role";

grant trigger on table "public"."timer_logs" to "service_role";

grant truncate on table "public"."timer_logs" to "service_role";

grant update on table "public"."timer_logs" to "service_role";

grant delete on table "public"."timers" to "anon";

grant insert on table "public"."timers" to "anon";

grant references on table "public"."timers" to "anon";

grant select on table "public"."timers" to "anon";

grant trigger on table "public"."timers" to "anon";

grant truncate on table "public"."timers" to "anon";

grant update on table "public"."timers" to "anon";

grant delete on table "public"."timers" to "authenticated";

grant insert on table "public"."timers" to "authenticated";

grant references on table "public"."timers" to "authenticated";

grant select on table "public"."timers" to "authenticated";

grant trigger on table "public"."timers" to "authenticated";

grant truncate on table "public"."timers" to "authenticated";

grant update on table "public"."timers" to "authenticated";

grant delete on table "public"."timers" to "service_role";

grant insert on table "public"."timers" to "service_role";

grant references on table "public"."timers" to "service_role";

grant select on table "public"."timers" to "service_role";

grant trigger on table "public"."timers" to "service_role";

grant truncate on table "public"."timers" to "service_role";

grant update on table "public"."timers" to "service_role";

grant delete on table "public"."translations" to "anon";

grant insert on table "public"."translations" to "anon";

grant references on table "public"."translations" to "anon";

grant select on table "public"."translations" to "anon";

grant trigger on table "public"."translations" to "anon";

grant truncate on table "public"."translations" to "anon";

grant update on table "public"."translations" to "anon";

grant delete on table "public"."translations" to "authenticated";

grant insert on table "public"."translations" to "authenticated";

grant references on table "public"."translations" to "authenticated";

grant select on table "public"."translations" to "authenticated";

grant trigger on table "public"."translations" to "authenticated";

grant truncate on table "public"."translations" to "authenticated";

grant update on table "public"."translations" to "authenticated";

grant delete on table "public"."translations" to "service_role";

grant insert on table "public"."translations" to "service_role";

grant references on table "public"."translations" to "service_role";

grant select on table "public"."translations" to "service_role";

grant trigger on table "public"."translations" to "service_role";

grant truncate on table "public"."translations" to "service_role";

grant update on table "public"."translations" to "service_role";

grant delete on table "public"."yo_memoria" to "anon";

grant insert on table "public"."yo_memoria" to "anon";

grant references on table "public"."yo_memoria" to "anon";

grant select on table "public"."yo_memoria" to "anon";

grant trigger on table "public"."yo_memoria" to "anon";

grant truncate on table "public"."yo_memoria" to "anon";

grant update on table "public"."yo_memoria" to "anon";

grant delete on table "public"."yo_memoria" to "authenticated";

grant insert on table "public"."yo_memoria" to "authenticated";

grant references on table "public"."yo_memoria" to "authenticated";

grant select on table "public"."yo_memoria" to "authenticated";

grant trigger on table "public"."yo_memoria" to "authenticated";

grant truncate on table "public"."yo_memoria" to "authenticated";

grant update on table "public"."yo_memoria" to "authenticated";

grant delete on table "public"."yo_memoria" to "service_role";

grant insert on table "public"."yo_memoria" to "service_role";

grant references on table "public"."yo_memoria" to "service_role";

grant select on table "public"."yo_memoria" to "service_role";

grant trigger on table "public"."yo_memoria" to "service_role";

grant truncate on table "public"."yo_memoria" to "service_role";

grant update on table "public"."yo_memoria" to "service_role";

grant delete on table "public"."yo_perfil" to "anon";

grant insert on table "public"."yo_perfil" to "anon";

grant references on table "public"."yo_perfil" to "anon";

grant select on table "public"."yo_perfil" to "anon";

grant trigger on table "public"."yo_perfil" to "anon";

grant truncate on table "public"."yo_perfil" to "anon";

grant update on table "public"."yo_perfil" to "anon";

grant delete on table "public"."yo_perfil" to "authenticated";

grant insert on table "public"."yo_perfil" to "authenticated";

grant references on table "public"."yo_perfil" to "authenticated";

grant select on table "public"."yo_perfil" to "authenticated";

grant trigger on table "public"."yo_perfil" to "authenticated";

grant truncate on table "public"."yo_perfil" to "authenticated";

grant update on table "public"."yo_perfil" to "authenticated";

grant delete on table "public"."yo_perfil" to "service_role";

grant insert on table "public"."yo_perfil" to "service_role";

grant references on table "public"."yo_perfil" to "service_role";

grant select on table "public"."yo_perfil" to "service_role";

grant trigger on table "public"."yo_perfil" to "service_role";

grant truncate on table "public"."yo_perfil" to "service_role";

grant update on table "public"."yo_perfil" to "service_role";


  create policy "Users manage their own dumps"
  on "public"."brain_dumps"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));



  create policy "Usuarios pueden actualizar sus grupos"
  on "public"."groups"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Usuarios pueden borrar sus grupos"
  on "public"."groups"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Usuarios pueden crear grupos"
  on "public"."groups"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Usuarios pueden ver sus propios grupos"
  on "public"."groups"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Usuarios pueden actualizar sus notas"
  on "public"."notes"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Usuarios pueden borrar sus notas"
  on "public"."notes"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Usuarios pueden crear notas"
  on "public"."notes"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Usuarios pueden ver sus propias notas"
  on "public"."notes"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can manage their own reminders"
  on "public"."reminders"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));



  create policy "Users can manage summaries of their notes"
  on "public"."summaries"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.notes
  WHERE ((notes.id = summaries.note_id) AND (notes.user_id = auth.uid())))));



  create policy "Users can manage their own tasks"
  on "public"."tasks"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));



  create policy "Users can manage their own timer logs"
  on "public"."timer_logs"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));



  create policy "Users can manage their own timers"
  on "public"."timers"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));



  create policy "Users manage their own translations"
  on "public"."translations"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));



  create policy "usuario ve su memoria"
  on "public"."yo_memoria"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));



  create policy "usuario ve su perfil"
  on "public"."yo_perfil"
  as permissive
  for all
  to public
using ((auth.uid() = user_id));


CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');

CREATE TRIGGER update_reminders_modtime BEFORE UPDATE ON public.reminders FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER handle_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');

CREATE TRIGGER handle_timers_updated_at BEFORE UPDATE ON public.timers FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');


