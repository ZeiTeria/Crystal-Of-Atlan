import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../lib/supabase';
import { createDungeon, deleteDungeon, listDungeons, type DungeonRow } from './dungeons';
import {
  createCharacter,
  currentGameAccountId,
  deleteCharacter,
  listCharacters,
} from './accounts';
import { listGrid, setGridCell } from './grid';
import { deleteRun, listRecentRuns, logRun } from './runs';
import { loadPlanInput } from './loadPlanInput';

/**
 * Every screen test mocks `src/data/`, so nothing yet proves those queries
 * work against the real schema - a wrong column name or a policy that
 * refuses a write would pass the whole suite. This is one network test
 * covering the full cycle: create, read, upsert, log, and undo.
 *
 * Like `src/lib/rls.test.ts`, it hits the network and SKIPs rather than
 * fails when credentials are absent, so a fresh clone does not have a red
 * suite for a reason that is not a defect.
 *
 * Creating a dungeon is admin-only by row level security
 * (`dungeons_admin_write` in `supabase/migrations/0001_init.sql`), so this
 * file is split in two blocks that skip independently:
 *
 *  - The CATALOGUE block (createDungeon / listDungeons / deleteDungeon) needs
 *    the signed-in account to be an admin. It SKIPS - loudly, naming the
 *    exact SQL to run - when the account is not admin.
 *  - The OWNER-SCOPED block (characters, the grid upsert, logging a run,
 *    loadPlanInput, undo) needs a dungeon to work against but not admin
 *    rights to run its own assertions. It prefers to be self-sufficient: if
 *    the signed-in account is admin, it creates and deletes its own
 *    throwaway dungeon, independent of the catalogue block above. Only when
 *    the account is not admin does it fall back to borrowing an existing
 *    active dungeon from the catalogue (and leaves it alone - it is not this
 *    block's to delete). It SKIPS - naming the reason - only when neither is
 *    possible: not admin, and the catalogue has nothing to borrow.
 *
 * The owner-scoped block also needs a game account to hang characters off.
 * It used to obtain one via `currentGameAccountId()` (the oldest account for
 * the signed-in user) and infer ownership from whether that account existed
 * before the call. That inference took two round-trips - select, then decide
 * - and vitest runs test files concurrently, so `rls.test.ts` (which inserts
 * its own account under the same test user) could insert in the gap between
 * them: this file would latch "not mine" or "mine" based on a stale read,
 * and a wrong latch either leaked an account forever or deleted one that
 * `rls.test.ts` was still using. Narrowing the gap is not the same as
 * closing it. It also made a crashed prior run's leftover account
 * indistinguishable from a borrowed one, so it could never self-heal.
 *
 * The fix, applied the same way this file already treats dungeons via
 * `OWNER_DUNGEON_NAME`, and the way `rls.test.ts` treats its own accounts:
 * this file creates its own account with a distinctive name
 * (`crud-test-account`), inserted directly rather than obtained from
 * `currentGameAccountId()`, and sweeps by that name in both `beforeAll` and
 * `afterAll`. A crashed run leaves a same-named row for the *next* run's
 * sweep to catch instead of leaking, and the name (not a latched flag) is
 * what proves this file owns the row - `rls-test-account` is never
 * `crud-test-account`, so the two suites can run concurrently without
 * touching each other's data.
 *
 * `currentGameAccountId()` itself keeps its own coverage - see the
 * `currentGameAccountId` block below - it just no longer supplies the
 * account this file works in.
 *
 * All three blocks skip entirely when credentials are absent, same as
 * before.
 */

const email = import.meta.env.VITE_TEST_A_EMAIL;
const password = import.meta.env.VITE_TEST_A_PASSWORD;
const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY && email && password,
);

const NETWORK_TIMEOUT = 30_000;
const DUNGEON_NAME = 'crud-test-dungeon';
const OWNER_DUNGEON_NAME = 'crud-test-owner-dungeon';
const ACCOUNT_NAME = 'crud-test-account';
const CHARACTER_NAME = 'crud-test-character';

const ADMIN_REMEDY =
  `update public.profiles set is_admin = true\nwhere id = (select id from auth.users where email = '${email}');`;

/*
 * Signed in once for the whole file, before either `describe` is collected -
 * the data modules use the shared `supabase` singleton, so a second sign-in
 * later would just replace this session, not add one. `describe.skipIf`
 * needs its condition synchronously, so the admin check and the "does the
 * catalogue have anything to borrow" check both happen here too, via
 * top-level await.
 */
let isAdmin = false;
let signedInUserId = '';
let catalogueDungeon: DungeonRow | undefined;

if (configured) {
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: email as string,
    password: password as string,
  });
  if (signInError) throw new Error(`test user A could not sign in: ${signInError.message}`);
  const userId = signInData.user?.id;
  if (!userId) throw new Error('test user A signed in without a user id');
  signedInUserId = userId;

  // RLS permits exactly this: a user reading their own `profiles` row.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single();
  if (profileError) throw profileError;
  isAdmin = profile.is_admin;

  catalogueDungeon = (await listDungeons()).find((d) => d.is_active);
}

afterAll(async () => {
  if (configured) await supabase.auth.signOut();
}, NETWORK_TIMEOUT);

const catalogueSkip = !configured || !isAdmin;
const catalogueSkipReason =
  configured && !isAdmin
    ? `signed-in test account is not admin - run: ${ADMIN_REMEDY.replace(/\n/g, ' ')}`
    : undefined;
if (catalogueSkipReason) {
  console.warn(`[crud.test] catalogue block SKIPPED - ${catalogueSkipReason}`);
}

describe.skipIf(catalogueSkip)(
  catalogueSkipReason ? `catalogue [SKIPPED: ${catalogueSkipReason}]` : 'catalogue',
  () => {
    let dungeonId: string;

    beforeAll(async () => {
      // Leftovers from a failed run would make the assertion below ambiguous.
      const stale = await listDungeons();
      for (const d of stale.filter((d) => d.name === DUNGEON_NAME)) await deleteDungeon(d.id);
    }, NETWORK_TIMEOUT);

    afterAll(async () => {
      if (dungeonId) await deleteDungeon(dungeonId);
    }, NETWORK_TIMEOUT);

    it('round-trips a dungeon', { timeout: NETWORK_TIMEOUT }, async () => {
      const created = await createDungeon({
        name: DUNGEON_NAME,
        account_attempts: 18,
        character_attempts: 3,
        reset_weekday: 4,
        quest_coverage: true,
        gold_solo: 10,
        gold_story: 20,
        gold_elite: 30,
        gold_legend: 40,
        is_active: true,
        default_tier: 'elite',
        default_min_runs: 1,
      });
      dungeonId = created.id;
      expect(created.reset_weekday).toBe(4);
      expect((await listDungeons()).some((d) => d.id === dungeonId)).toBe(true);
    });
  },
);

const ownerSkip = !configured || (!isAdmin && !catalogueDungeon);
const ownerSkipReason =
  configured && !isAdmin && !catalogueDungeon
    ? `not admin and the catalogue has no active dungeon to borrow - either run as admin (${ADMIN_REMEDY.replace(/\n/g, ' ')}), or create an active dungeon as admin first`
    : undefined;
if (ownerSkipReason) {
  console.warn(`[crud.test] owner-scoped block SKIPPED - ${ownerSkipReason}`);
}

describe.skipIf(ownerSkip)(
  ownerSkipReason ? `owner-scoped data [SKIPPED: ${ownerSkipReason}]` : 'owner-scoped data',
  () => {
    // Only reached when ownerSkip above is false: either isAdmin is true (so
    // this block creates its own dungeon in beforeAll below) or
    // catalogueDungeon is defined (the borrow fallback). `dungeon` is set in
    // beforeAll either way, before any `it` runs.
    let dungeon: DungeonRow;
    let ownDungeonId: string | undefined;

    let accountId: string;
    let characterId: string;

    /**
     * Removes only this file's own account, by name. Characters, grid rows
     * and runs cascade from it. Called in both `beforeAll` (so a crashed
     * prior run self-heals instead of leaking) and `afterAll` (so a normal
     * run leaves nothing behind) - the same shape `rls.test.ts` uses for its
     * `rls-test-account`.
     */
    async function sweepOwnAccount() {
      const { error } = await supabase.from('game_accounts').delete().eq('name', ACCOUNT_NAME);
      if (error) throw error;
    }

    beforeAll(async () => {
      if (isAdmin) {
        // Self-sufficient path: don't depend on the catalogue containing
        // anything. Leftovers from a failed prior run would make the
        // assertions below ambiguous.
        const stale = await listDungeons();
        for (const d of stale.filter((d) => d.name === OWNER_DUNGEON_NAME)) {
          await deleteDungeon(d.id);
        }
        const created = await createDungeon({
          name: OWNER_DUNGEON_NAME,
          account_attempts: 18,
          character_attempts: 3,
          reset_weekday: 4,
          quest_coverage: true,
          gold_solo: 10,
          gold_story: 20,
          gold_elite: 30,
          gold_legend: 40,
          is_active: true,
        default_tier: 'elite',
        default_min_runs: 1,
      });
        ownDungeonId = created.id;
        dungeon = created;
      } else {
        // Non-admin fallback: borrow, never delete. ownerSkip above
        // guarantees catalogueDungeon is defined on this branch.
        dungeon = catalogueDungeon as DungeonRow;
      }

      // This file's own account, created directly rather than obtained from
      // `currentGameAccountId()` - see the file-level comment for why
      // sharing that account with `rls.test.ts` was a race. Sweeping first
      // means a row left behind by a crashed prior run of this file is
      // removed before creating a fresh one, rather than accumulating.
      await sweepOwnAccount();
      const created = await supabase
        .from('game_accounts')
        .insert({ owner_id: signedInUserId, name: ACCOUNT_NAME })
        .select()
        .single();
      if (created.error) throw new Error(`could not create ${ACCOUNT_NAME}: ${created.error.message}`);
      accountId = created.data.id;
    }, NETWORK_TIMEOUT);

    afterAll(async () => {
      // Deleting the character cascades its grid rows and runs.
      if (characterId) await deleteCharacter(characterId);
      // Unconditional and name-scoped: this account is always this block's
      // own, so cleanup never risks touching another suite's data.
      await sweepOwnAccount();
      if (ownDungeonId) await deleteDungeon(ownDungeonId);
    }, NETWORK_TIMEOUT);

    it('round-trips a character', { timeout: NETWORK_TIMEOUT }, async () => {
      const created = await createCharacter(accountId, CHARACTER_NAME);
      characterId = created.id;
      expect((await listCharacters(accountId)).some((c) => c.id === characterId)).toBe(true);
    });

    it('upserts the same grid cell twice without a conflict', { timeout: NETWORK_TIMEOUT }, async () => {
      await setGridCell(characterId, dungeon.id, { tier: 'elite' });
      await setGridCell(characterId, dungeon.id, { min_runs: 2 });
      const rows = await listGrid([characterId]);
      const cell = rows.find((r) => r.dungeon_id === dungeon.id);
      expect(cell?.tier).toBe('elite');
      expect(cell?.min_runs).toBe(2);
    });

    it('logs a run and feeds it back into the engine input', { timeout: NETWORK_TIMEOUT }, async () => {
      await logRun(characterId, dungeon.id, 30);
      const input = await loadPlanInput(accountId);
      // One of this character's attempts on the dungeon is spent, and the
      // gold is counted against the fixed 1,000,000 weekly cap.
      expect(input.characterAttemptsLeft[characterId]?.[dungeon.id]).toBe(
        dungeon.character_attempts - 1,
      );
      expect(input.goldHeadroom[characterId]).toBe(1_000_000 - 30);
    });

    it('undoes a run', { timeout: NETWORK_TIMEOUT }, async () => {
      const recent = await listRecentRuns([characterId]);
      const first = recent[0];
      expect(first).toBeDefined();
      await deleteRun(first!.id);
      expect(await listRecentRuns([characterId])).toEqual([]);
    });
  },
);

/*
 * `currentGameAccountId()` no longer supplies the account the owner-scoped
 * block above works in (see the file-level comment for why sharing it with
 * `rls.test.ts` was a race), but its own contract - that concurrent callers
 * converge on the same account rather than each creating their own - is real
 * behaviour worth covering directly, and it is exactly what was fixed to make
 * that convergence happen (see the re-read in `oldestGameAccountId` inside
 * `currentGameAccountId`, in `src/data/accounts.ts`). This test asserts that
 * contract - idempotency - without touching whatever account it returns: the
 * account may be a real one already in use elsewhere, so it is read, never
 * deleted.
 */
describe.skipIf(!configured)('currentGameAccountId', () => {
  it('converges repeated calls on the same account', { timeout: NETWORK_TIMEOUT }, async () => {
    const first = await currentGameAccountId();
    const second = await currentGameAccountId();
    expect(first).toBeTruthy();
    expect(second).toBe(first);
  });
});
