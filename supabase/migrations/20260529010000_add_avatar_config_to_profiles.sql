-- Custom cartoon avatar (DiceBear "avataaars"): store the builder options as JSON
-- on the user's profile. Nullable → existing users keep the letter-circle fallback
-- until they build one.
--
-- Saving is gated by the EXISTING profiles_update_own RLS policy (added with the
-- profiles table): authenticated users may UPDATE only their own row
-- (auth.uid() = id with check auth.uid() = id), so no new policy is needed here.
-- The existing profiles_select_authenticated policy already exposes the column to
-- the friends/lobby roster read.
--
-- Mirrors the migration applied to the live project via Supabase tooling
-- (add_avatar_config_to_profiles). Idempotent.

alter table public.profiles
  add column if not exists avatar_config jsonb;
