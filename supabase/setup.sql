-- Minister Tax & Wealth Engine — database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- The server only ever stores encrypted text. Row-level security makes sure each
-- signed-in person can only see or change their own rows.

create table if not exists public.vaults (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  salt       text not null,
  check_iv   text not null,
  check_ct   text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.scenarios (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  iv         text not null,
  ct         text not null check (length(ct) < 200000),
  created_at timestamptz not null default now()
);
create index if not exists scenarios_user_idx on public.scenarios(user_id);

alter table public.vaults    enable row level security;
alter table public.scenarios enable row level security;

drop policy if exists "own vault" on public.vaults;
create policy "own vault" on public.vaults for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own scenarios" on public.scenarios;
create policy "own scenarios" on public.scenarios for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.vaults, public.scenarios from anon;
grant select, insert, update, delete on public.vaults, public.scenarios to authenticated;

-- Lets a signed-in person delete their own login (rows cascade).
create or replace function public.delete_my_account()
returns void language sql security definer set search_path = '' as $$
  delete from auth.users where id = (select auth.uid());
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Tiny function the weekly GitHub job calls so the free project never pauses.
create or replace function public.ping()
returns int language sql stable set search_path = '' as $$ select 1 $$;
grant execute on function public.ping() to anon, authenticated;
