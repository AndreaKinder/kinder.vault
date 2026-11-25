-- Database schema for KinderVault (Supabase / Postgres)
-- Includes: tables, domain constraints, Full-Text Search (tsvector), and Row Level Security (RLS).

create extension if not exists pgcrypto;

-- Official vault folders (root-level notes are forbidden)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'vault_folder') then
    create type public.vault_folder as enum (
      'inbox',
      'journal',
      'zettelkasten',
      'projects',
      'todo',
      'prompts'
    );
  end if;
end $$;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  folder public.vault_folder not null,
  slug text not null,
  title text not null,
  description text not null default '',
  content text not null default '',
  aliases text[] not null default '{}',
  tags text[] not null default '{}',
  project_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Unique slug per user and folder
  constraint notes_user_folder_slug_unique unique (user_id, folder, slug),
  -- Daily journal notes must use YYYY-MM-DD slug and include the daily-notes tag
  constraint notes_journal_slug_format check (
    folder <> 'journal' or slug ~ '^\d{4}-\d{2}-\d{2}$'
  ),
  constraint notes_journal_daily_tag check (
    folder <> 'journal' or ('daily-notes' = any (tags))
  )
);

-- Generated tsvector column for Full-Text Search
alter table public.notes
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(aliases, ' ')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(tags, ' ')), 'B') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'C')
  ) stored;

create index if not exists notes_user_folder_idx on public.notes (user_id, folder);
create index if not exists notes_tags_gin_idx on public.notes using gin (tags);
create index if not exists notes_search_vector_gin_idx on public.notes using gin (search_vector);

-- Trigger to automatically update updated_at on row modification
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row
  execute function public.set_updated_at();

-- Row Level Security (RLS)
alter table public.notes enable row level security;

drop policy if exists "Users can view own notes" on public.notes;
create policy "Users can view own notes"
  on public.notes
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notes" on public.notes;
create policy "Users can insert own notes"
  on public.notes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own notes" on public.notes;
create policy "Users can update own notes"
  on public.notes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own notes" on public.notes;
create policy "Users can delete own notes"
  on public.notes
  for delete
  using (auth.uid() = user_id);
