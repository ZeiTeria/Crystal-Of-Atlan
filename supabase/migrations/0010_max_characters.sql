-- How many characters one account may have.
--
-- A setting rather than a constant because the answer is a fact about the
-- game, not about this app, and it has already changed once for the player who
-- asked for it. app_settings already carries the other such numbers, and
-- already has an admin-only write policy, so the cap is editable from the
-- admin screens and by nobody else.
--
-- 12 is today's answer. The check is deliberately loose: it exists to stop a
-- zero or a negative, not to second-guess a future patch.
alter table public.app_settings
  add column if not exists max_characters integer not null default 12
  check (max_characters between 1 and 200);
