-- Abnormal sense is consumed once and buffs every character, so it is account-wide.
alter table public.app_settings
  add column abnormal_sense boolean not null default false;

-- Title and potion are per character. has_title defaults TRUE because every gold
-- figure in the catalogue was recorded with the title active, so a fresh migration
-- must leave the plan exactly as it was.
alter table public.characters
  add column has_title  boolean not null default true,
  add column has_potion boolean not null default false;
