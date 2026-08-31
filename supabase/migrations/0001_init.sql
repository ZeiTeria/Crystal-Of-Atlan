-- Crystal of Atlan weekly planner: initial schema.
-- Idempotent: safe to run more than once.

create extension if not exists pgcrypto;

do $$ begin
  create type public.tier as enum ('none','solo','story','elite','legend');
exception when duplicate_object then null; end $$;

-- Weekday convention is ISO: Monday = 1 ... Sunday = 7, matching the engine.

create table if not exists public.app_settings (
  id                     boolean primary key default true check (id),
  gold_cap_per_character integer not null default 1000000 check (gold_cap_per_character > 0),
  gold_reset_weekday     smallint not null default 1 check (gold_reset_weekday between 1 and 7),
  reset_hour             smallint not null default 0 check (reset_hour between 0 and 23),
  server_timezone        text not null default 'Asia/Jakarta'
);
insert into public.app_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  discord_username text,
  is_admin         boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists public.game_accounts (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  name       text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists game_accounts_owner_idx on public.game_accounts (owner_id);

create table if not exists public.characters (
  id              uuid primary key default gen_random_uuid(),
  game_account_id uuid not null references public.game_accounts (id) on delete cascade,
  name            text not null check (length(btrim(name)) > 0),
  class           text,
  sort_order      integer not null default 0
);
create index if not exists characters_account_idx on public.characters (game_account_id);

create table if not exists public.dungeons (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (length(btrim(name)) > 0),
  account_attempts   integer not null default 18 check (account_attempts >= 0),
  character_attempts integer not null default 3 check (character_attempts >= 0),
  reset_weekday      smallint not null default 1 check (reset_weekday between 1 and 7),
  quest_coverage     boolean not null default false,
  gold_solo          integer not null default 0 check (gold_solo >= 0),
  gold_story         integer not null default 0 check (gold_story >= 0),
  gold_elite         integer not null default 0 check (gold_elite >= 0),
  gold_legend        integer not null default 0 check (gold_legend >= 0),
  sort_order         integer not null default 0,
  is_active          boolean not null default true
);

create table if not exists public.character_dungeon (
  character_id uuid not null references public.characters (id) on delete cascade,
  dungeon_id   uuid not null references public.dungeons (id) on delete cascade,
  tier         public.tier not null default 'none',
  min_runs     integer not null default 0 check (min_runs >= 0),
  primary key (character_id, dungeon_id)
);

-- gold_earned is stored, not looked up: editing a catalogue value must never
-- rewrite what a past run was actually worth.
create table if not exists public.runs (
  id           uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  dungeon_id   uuid not null references public.dungeons (id) on delete cascade,
  ran_at       timestamptz not null default now(),
  gold_earned  integer not null check (gold_earned >= 0)
);
create index if not exists runs_character_idx on public.runs (character_id, ran_at);
create index if not exists runs_dungeon_idx   on public.runs (dungeon_id, ran_at);

-- security definer so the admin check does not depend on profiles' own policy.
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- A profile row is created by the trigger, never by the client.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, discord_username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.email
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.app_settings      enable row level security;
alter table public.profiles          enable row level security;
alter table public.game_accounts     enable row level security;
alter table public.characters        enable row level security;
alter table public.dungeons          enable row level security;
alter table public.character_dungeon enable row level security;
alter table public.runs              enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists game_accounts_own on public.game_accounts;
create policy game_accounts_own on public.game_accounts
  for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists characters_own on public.characters;
create policy characters_own on public.characters
  for all to authenticated
  using (exists (select 1 from public.game_accounts ga
                 where ga.id = game_account_id and ga.owner_id = auth.uid()))
  with check (exists (select 1 from public.game_accounts ga
                 where ga.id = game_account_id and ga.owner_id = auth.uid()));

drop policy if exists character_dungeon_own on public.character_dungeon;
create policy character_dungeon_own on public.character_dungeon
  for all to authenticated
  using (exists (select 1 from public.characters c
                 join public.game_accounts ga on ga.id = c.game_account_id
                 where c.id = character_id and ga.owner_id = auth.uid()))
  with check (exists (select 1 from public.characters c
                 join public.game_accounts ga on ga.id = c.game_account_id
                 where c.id = character_id and ga.owner_id = auth.uid()));

drop policy if exists runs_own on public.runs;
create policy runs_own on public.runs
  for all to authenticated
  using (exists (select 1 from public.characters c
                 join public.game_accounts ga on ga.id = c.game_account_id
                 where c.id = character_id and ga.owner_id = auth.uid()))
  with check (exists (select 1 from public.characters c
                 join public.game_accounts ga on ga.id = c.game_account_id
                 where c.id = character_id and ga.owner_id = auth.uid()));

-- Shared catalogue: everyone reads, only an admin writes.
drop policy if exists dungeons_read on public.dungeons;
create policy dungeons_read on public.dungeons
  for select to authenticated using (true);

drop policy if exists dungeons_admin_write on public.dungeons;
create policy dungeons_admin_write on public.dungeons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select to authenticated using (true);

drop policy if exists app_settings_admin_write on public.app_settings;
create policy app_settings_admin_write on public.app_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- anon gets nothing anywhere: every policy above is `to authenticated`.
revoke all on all tables in schema public from anon;
