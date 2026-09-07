-- The buffable component of a dungeon's clear reward. Gold buffs multiply this
-- part only; the rest of the reward and the stone premium are never buffed.
alter table public.dungeons
  add column gold_c integer not null default 0 check (gold_c >= 0);
