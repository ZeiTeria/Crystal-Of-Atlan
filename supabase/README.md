# Database

The schema lives here as plain SQL. There is no CLI step and no automated
migration runner.

## Applying a migration

1. Open the Supabase dashboard → **SQL Editor** → New query.
2. Paste the whole contents of the next unapplied file in `migrations/`.
3. Run it. Expected result: `Success. No rows returned`.

Every migration is written to be **idempotent**, so re-running one is harmless.

## Rules

- Migrations are numbered and **never edited once applied**. A change means a
  new `000N_<name>.sql` file.
- Every table has Row Level Security enabled and at least one policy. A table
  with RLS off is a data leak; a table with RLS on and no policy denies
  everything. `src/lib/rls.test.ts` asserts neither happens.
- Weekdays are ISO: **Monday = 1 … Sunday = 7**, matching the planner engine.

## After the first login

There is deliberately no self-serve path to admin. Promote yourself once, in the
SQL editor:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users order by created_at limit 1);
```

## Two settings you must confirm

`app_settings` guesses at two facts about the game. A wrong value here silently
shifts every week boundary:

- `reset_hour` — defaults to `0` (midnight)
- `server_timezone` — defaults to `Asia/Jakarta`
