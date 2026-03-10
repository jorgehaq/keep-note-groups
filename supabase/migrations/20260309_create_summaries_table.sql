-- migration: create_summaries_table.sql

-- 1. Create the status enum
create type public.summary_status as enum ('pending', 'processing', 'completed', 'failed');

-- 2. Create the summaries table
create table public.summaries (
  id uuid default gen_random_uuid() primary key,
  note_id uuid references public.notes(id) on delete cascade not null,
  target_objective text,
  content text default '',
  status public.summary_status default 'pending' not null,
  created_at timestamptz default now() not null
);

-- 3. Enable RLS
alter table public.summaries enable row level security;

-- 4. Create policy
create policy "Users can manage summaries of their notes" 
on public.summaries
for all using (
  exists (
    select 1 
    from public.notes 
    where notes.id = summaries.note_id 
    and notes.user_id = auth.uid()
  )
);

-- 5. Add to realtime publication
alter publication supabase_realtime add table public.summaries;
