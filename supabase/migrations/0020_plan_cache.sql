-- The solved plan, stored per game account.
--
-- The plan is a pure function of the stored rows: derivePlanInput reads no
-- clock and there is no run log to subtract (0016 dropped it), so the same
-- inputs always give the same plan. Before this, every page load re-solved a
-- MILP that costs seconds per solve once dungeons.gold_c is filled in, because
-- buffs then price a dungeon differently for every character.
--
-- `fingerprint` is a SHA-256 of exactly the inputs the solver reads plus the
-- solver's own signature (see src/data/planCache.ts). A row whose fingerprint
-- does not match the freshly loaded rows is ignored and overwritten, so a stale
-- plan can never be served - the cache is an optimisation, never a source.

create table if not exists public.plan_cache (
  game_account_id uuid primary key references public.game_accounts (id) on delete cascade,
  fingerprint     text not null,
  plan            jsonb not null,
  solved_at       timestamptz not null default now()
);

alter table public.plan_cache enable row level security;

-- Same shape as characters_own: the row belongs to whoever owns the account.
drop policy if exists plan_cache_own on public.plan_cache;
create policy plan_cache_own on public.plan_cache
  for all to authenticated
  using (exists (select 1 from public.game_accounts ga
                 where ga.id = game_account_id and ga.owner_id = auth.uid()))
  with check (exists (select 1 from public.game_accounts ga
                 where ga.id = game_account_id and ga.owner_id = auth.uid()));

-- Explicit, and to `authenticated` only: nothing here is public.
grant select, insert, update, delete on public.plan_cache to authenticated;
