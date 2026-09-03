-- Add stone gold parameters for blending into clear rewards
alter table public.dungeons
  add column gold_solo_stone   integer not null default 0 check (gold_solo_stone   >= 0),
  add column gold_story_stone  integer not null default 0 check (gold_story_stone  >= 0),
  add column gold_elite_stone  integer not null default 0 check (gold_elite_stone  >= 0),
  add column gold_legend_stone integer not null default 0 check (gold_legend_stone >= 0);

alter table public.app_settings
  add column stone_rate numeric not null default 0.40
    check (stone_rate >= 0 and stone_rate <= 1);
