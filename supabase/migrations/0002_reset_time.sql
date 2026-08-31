-- The game resets at 06:00 UTC+8, confirmed 2026-09-01. The 0001 defaults
-- (00:00 Asia/Jakarta) were a guess, and a wrong reset time silently shifts
-- every week boundary the planner computes.
--
-- Asia/Singapore is a permanent +08:00 zone with no daylight saving, so this
-- boundary never moves. Any other fixed +08:00 zone would behave identically;
-- Asia/Jakarta would NOT, it is +07:00.
--
-- This is a data migration, so re-running it re-asserts these two values rather
-- than doing nothing. Change them here, in a later migration, not by hand.

update public.app_settings
   set reset_hour      = 6,
       server_timezone = 'Asia/Singapore'
 where id = true;

alter table public.app_settings
  alter column reset_hour      set default 6,
  alter column server_timezone set default 'Asia/Singapore';
