-- Allow overriding max runs per character/dungeon. Null means inherit default.
alter table public.character_dungeon
  add column max_runs integer null check (max_runs >= 0);
