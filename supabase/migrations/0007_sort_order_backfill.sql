-- Give every existing character a distinct slot, 10 apart, so there is
-- somewhere to drag between. Dungeons are already spaced 10..90 and are left
-- alone.
--
-- This preserves the order currently ON SCREEN, which is the alphabetical
-- accident the sort_order bug produced - not true creation order. Creation
-- order is not recoverable: characters and dungeons have no created_at (only
-- profiles and game_accounts do), and the ids are random UUIDs. The user
-- reorders once by hand, and every character created after the nextSortOrder
-- fix keeps its creation order automatically.
with ranked as (
  select
    id,
    row_number() over (
      partition by game_account_id
      order by sort_order, name
    ) * 10 as slot
  from public.characters
)
update public.characters as c
set sort_order = ranked.slot
from ranked
where ranked.id = c.id;
