-- A display grouping for dungeons that belong to one family, e.g. the two
-- HexChess bosses. LABEL ONLY: each dungeon keeps its own account_attempts
-- pool, confirmed against the game - the bosses each carry their own weekly
-- claim. No engine code reads this column.
--
-- Named group_name because `group` is a fully reserved word in Postgres and
-- would need quoting at every call site, including through PostgREST.
alter table public.dungeons add column if not exists group_name text;

-- Seed from the live catalogue. Matched on name because the names carry no
-- family prefix ("Checkmate", not "HexChess - Checkmate"), so the grouping
-- cannot be derived and has to be stated. Idempotent: re-running only rewrites
-- the same values.
update public.dungeons set group_name = 'HexChess'
  where name in ('Checkmate', 'Queen Coronation');

update public.dungeons set group_name = 'Lost Ruins'
  where name in ('Temple Of Fate', 'Apocalyptic Descent');

update public.dungeons set group_name = 'Krakya Island'
  where name in ('Kraken''s Spine', 'Heart Of Taboos');

update public.dungeons set group_name = 'Garden of Nihility'
  where name in ('The Deep Dive', 'Shackled Psyche');

-- Duskfeather Lair is deliberately left null: it belongs to no family.
