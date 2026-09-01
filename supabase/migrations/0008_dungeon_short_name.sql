-- A short label for the simplified matrix, where a full dungeon name cannot fit
-- a column. Written by the user, not derived: the app suggests one from the
-- family and the name (HexChess + Checkmate -> "HC") but only fills the field
-- when it is empty, so a deliberate label is never overwritten.
alter table public.dungeons add column if not exists short_name text;

-- Seed the suggestions for the current catalogue, so the simplified view is
-- usable the moment it ships. Every one can be edited on the Dungeons tab.
update public.dungeons set short_name = 'HC'  where name = 'Checkmate';
update public.dungeons set short_name = 'HQC' where name = 'Queen Coronation';
update public.dungeons set short_name = 'LTF' where name = 'Temple Of Fate';
update public.dungeons set short_name = 'LAD' where name = 'Apocalyptic Descent';
update public.dungeons set short_name = 'DL'  where name = 'Duskfeather Lair';
update public.dungeons set short_name = 'KKS' where name = 'Kraken''s Spine';
update public.dungeons set short_name = 'KHT' where name = 'Heart Of Taboos';
update public.dungeons set short_name = 'GDD' where name = 'The Deep Dive';
update public.dungeons set short_name = 'GSP' where name = 'Shackled Psyche';
