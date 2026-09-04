-- The client never updates profiles (loadProfile only selects), but
-- profiles_update_own granted a whole-row UPDATE with no column grants, so any
-- signed-in user could run
--   update profiles set is_admin = true where id = auth.uid()
-- against the public anon key and become an admin: past the Under Development
-- gate, and holding dungeons_admin_write + app_settings write on the shared
-- catalogue. Drop the policy rather than narrow it -- nothing needs it.
-- handle_new_user() still writes the row; it is security definer.
drop policy if exists profiles_update_own on public.profiles;

-- Belt and braces: even a future policy cannot hand out is_admin by accident.
revoke update on public.profiles from authenticated;
