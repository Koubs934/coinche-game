-- Phase 2 "Amis en ligne": public.profiles — a public mirror of auth.users so
-- the app can list ALL registered users (usernames) for the lobby friends list.
-- Auth users live in the protected `auth` schema (unreadable by the anon/
-- authenticated client) and the backend has no Supabase access, so the frontend
-- reads the roster here (RLS allows any authenticated user to SELECT) and the
-- backend supplies presence over sockets.
--
-- This file mirrors the migration applied to the live project via Supabase
-- tooling (migrations: create_profiles_table_for_friends +
-- harden_handle_new_user_revoke_execute). Kept in-repo for reproducibility on a
-- fresh project. Idempotent.

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Any authenticated user can read every profile (needed for the friends roster).
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- A user may update only their own profile row.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a profile whenever a new auth user signs up. SECURITY DEFINER so
-- the trigger can insert regardless of the caller's RLS context.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- handle_new_user is a trigger function, not an API endpoint — revoke EXECUTE
-- from the API roles so it can't be invoked via /rest/v1/rpc. The trigger still
-- fires (it runs with the table owner's privileges).
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing users.
insert into public.profiles (id, username)
select id, coalesce(raw_user_meta_data->>'username', split_part(email, '@', 1))
from auth.users
on conflict (id) do nothing;
