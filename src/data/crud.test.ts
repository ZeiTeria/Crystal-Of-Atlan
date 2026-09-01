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
 *    loadPlanInput, undo) needs no admin rights, so it runs for any
 *    signed-in account. It borrows an existing active dungeon from the
 *    catalogue instead of creating one, and SKIPS - naming the reason - only
 *    if the catalogue has no active dungeon to borrow.
 *
 * Both blocks skip entirely when credentials are absent, same as before.
 */

const email = import.meta.env.VITE_TEST_A_EMAIL;
const password = import.meta.env.VITE_TEST_A_PASSWORD;
const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY && email && password,
);

const NETWORK_TIMEOUT = 30_000;
const DUNGEON_NAME = 'crud-test-dungeon';
const CHARACTER_NAME = 'crud-test-character';

const ADMIN_REMEDY =
  "update public.profiles set is_admin = true\nwhere id = (select id from auth.users where email = 'rls-test-a@example.com');";

/*
 * Signed in once for the whole file, before either `describe` is collected -
 * the data modules use the shared `supabase` singleton, so a second sign-in
 * later would just replace this session, not add one. `describe.skipIf`
 * needs its condition synchronously, so the admin check and the "does the
 * catalogue have anything to borrow" check both happen here too, via
 * top-level await.
 */
let isAdmin = false;
let catalogueDungeon: DungeonRow | undefined;

if (configured) {
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: email as string,
    password: password as string,
  });
  if (signInError) throw new Error(`test user A could not sign in: ${signInError.message}`);
  const userId = signInData.user?.id;
  if (!userId) throw new Error('test user A signed in without a user id');

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
      });
      dungeonId = created.id;
      expect(created.reset_weekday).toBe(4);
      expect((await listDungeons()).some((d) => d.id === dungeonId)).toBe(true);
    });
  },
);

const ownerSkip = !configured || !catalogueDungeon;
const ownerSkipReason =
  configured && !catalogueDungeon
    ? 'the catalogue has no active dungeon to borrow - create one as admin first (see the catalogue block above)'
    : undefined;
if (ownerSkipReason) {
  console.warn(`[crud.test] owner-scoped block SKIPPED - ${ownerSkipReason}`);
}

describe.skipIf(ownerSkip)(
  ownerSkipReason ? `owner-scoped data [SKIPPED: ${ownerSkipReason}]` : 'owner-scoped data',
  () => {
    // Only reached when catalogueDungeon is defined: ownerSkip above already
    // guards every test body in this block on that being true.
    const dungeon = catalogueDungeon as DungeonRow;

    let accountId: string;
    let characterId: string;

    beforeAll(async () => {
      accountId = await currentGameAccountId();
      for (const c of await listCharacters(accountId)) {
        if (c.name === CHARACTER_NAME) await deleteCharacter(c.id);
      }
    }, NETWORK_TIMEOUT);

    afterAll(async () => {
      // Deleting the character cascades its grid rows and runs. The borrowed
      // dungeon itself is never touched - it belongs to the catalogue block,
      // not this one.
      if (characterId) await deleteCharacter(characterId);
      if (accountId) await supabase.from('game_accounts').delete().eq('id', accountId);
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
      // One of this character's attempts on the borrowed dungeon is spent,
      // and the gold is counted against the fixed 1,000,000 weekly cap.
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
