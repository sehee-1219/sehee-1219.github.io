create extension if not exists pgcrypto;

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.board_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 40),
  title text not null check (char_length(title) between 1 and 120),
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.board_posts enable row level security;

drop trigger if exists board_posts_set_updated_at on public.board_posts;

create trigger board_posts_set_updated_at
before update on public.board_posts
for each row
execute function public.set_row_updated_at();

drop policy if exists "board_posts_select_public" on public.board_posts;
create policy "board_posts_select_public"
on public.board_posts
for select
to anon, authenticated
using (true);

drop policy if exists "board_posts_insert_own" on public.board_posts;
create policy "board_posts_insert_own"
on public.board_posts
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "board_posts_update_own" on public.board_posts;
create policy "board_posts_update_own"
on public.board_posts
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "board_posts_delete_own" on public.board_posts;
create policy "board_posts_delete_own"
on public.board_posts
for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists board_posts_created_at_idx
on public.board_posts (created_at desc);
