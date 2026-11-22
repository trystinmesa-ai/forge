-- Forge (fitness app) cloud storage. Paste into Supabase: SQL Editor -> New query -> Run.
-- One row per saved item (a workout, logged set, progression state, check-in or setting).
-- Mirrors the app's IndexedDB stores, so the app can sync them as-is.

create table if not exists public.fitness_records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  store      text        not null check (store in ('sessions', 'sets', 'exState', 'overrides', 'customEx', 'substitutions', 'checkins', 'meta')),
  id         text        not null,
  data       jsonb       not null,
  deleted    boolean     not null default false,  -- kept so deletes sync to your other devices
  updated_at timestamptz not null default now(),
  primary key (user_id, store, id)
);

create index if not exists fitness_records_user_updated on public.fitness_records (user_id, updated_at);

-- Let signed-in users reach the table through the Data API (needed when the
-- project's "Automatically expose new tables" option is off). Signed-out
-- visitors (anon) get no access at all.
revoke all on public.fitness_records from anon;
grant select, insert, update, delete on public.fitness_records to authenticated;

-- Row Level Security: a signed-in user can only see and change their own rows.
-- Without a login, nothing can be read or written.
alter table public.fitness_records enable row level security;

drop policy if exists "own rows: read"   on public.fitness_records;
drop policy if exists "own rows: insert" on public.fitness_records;
drop policy if exists "own rows: update" on public.fitness_records;
drop policy if exists "own rows: delete" on public.fitness_records;

create policy "own rows: read"   on public.fitness_records for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows: insert" on public.fitness_records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows: update" on public.fitness_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own rows: delete" on public.fitness_records for delete to authenticated using ((select auth.uid()) = user_id);

-- Keep updated_at current on every change (used to sync only what changed).
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists fitness_records_touch on public.fitness_records;
create trigger fitness_records_touch before insert or update on public.fitness_records
  for each row execute function public.touch_updated_at();
