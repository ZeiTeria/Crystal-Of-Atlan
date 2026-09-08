-- Access is by approval, not by admin. Until now `is_admin` was the only gate:
-- everyone else met the "Under Development" screen. `is_approved` lets an admin
-- let somebody in without handing them the shared catalogue as well.
--
-- Applied by hand in the SQL editor before this file existed, so `if not exists`
-- is what makes running it now a no-op rather than an error.
alter table public.profiles
  add column if not exists is_approved boolean not null default false;

-- ---------------------------------------------------------------------------
-- Re-apply 0015, because it is NOT in effect on the live database.
--
-- `src/lib/rls.test.ts` caught this: signed in as an ordinary user with nothing
-- but the public key, test account B could run
--   update profiles set is_admin = true where id = auth.uid()
-- and it succeeded. That is the exact escalation 0015 was written to stop, so
-- either 0015 was never run or something re-created the policy and the grant
-- afterwards. Adding `is_approved` through the dashboard table editor is the
-- likeliest candidate.
--
-- Repeated here rather than left to 0015 because this file is the one that
-- re-opens UPDATE on `profiles` for the first time since. It must not depend on
-- an earlier migration's state being what the repo says it is.
drop policy if exists profiles_update_own on public.profiles;
revoke update on public.profiles from authenticated;
-- ---------------------------------------------------------------------------

-- An admin has to SEE the roster to approve anyone, and `profiles_select_own`
-- showed each user exactly one row: their own. Widen it for admins only.
--
-- `is_admin()` is security definer (0001), so it reads `profiles` without
-- re-entering this policy. A plain `exists (select ... from profiles ...)` here
-- would recurse.
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- The grant is COLUMN-scoped, not table-scoped: `is_approved` and nothing else.
-- Even if the policy below is ever loosened by accident, Postgres refuses an
-- UPDATE that touches `is_admin` before any policy is consulted. The policy is
-- the lock; the column list is the second lock.
grant update (is_approved) on public.profiles to authenticated;

drop policy if exists profiles_approve_admin on public.profiles;
create policy profiles_approve_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
