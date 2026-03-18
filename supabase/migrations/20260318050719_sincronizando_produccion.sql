
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

alter table "public"."notes" drop column "is_open";

alter table "public"."notes" alter column "scratchpad" set default ''::text;

CREATE UNIQUE INDEX yo_memoria_pkey ON public.yo_memoria USING btree (id);

CREATE UNIQUE INDEX yo_perfil_pkey ON public.yo_perfil USING btree (id);

alter table "public"."yo_memoria" add constraint "yo_memoria_pkey" PRIMARY KEY using index "yo_memoria_pkey";

alter table "public"."yo_perfil" add constraint "yo_perfil_pkey" PRIMARY KEY using index "yo_perfil_pkey";

alter table "public"."yo_memoria" add constraint "yo_memoria_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."yo_memoria" validate constraint "yo_memoria_user_id_fkey";

alter table "public"."yo_perfil" add constraint "yo_perfil_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."yo_perfil" validate constraint "yo_perfil_user_id_fkey";

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



