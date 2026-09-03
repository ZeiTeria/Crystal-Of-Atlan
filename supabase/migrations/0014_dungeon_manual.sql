-- Whether a dungeon must be played manually (rotates for newest content)
alter table public.dungeons
  add column manual boolean not null default false;
