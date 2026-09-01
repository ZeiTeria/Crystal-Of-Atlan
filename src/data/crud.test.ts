import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../lib/supabase';
import { createDungeon, deleteDungeon, listDungeons } from './dungeons';
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
 */

const email = import.meta.env.VITE_TEST_A_EMAIL;
const password = import.meta.env.VITE_TEST_A_PASSWORD;
const configured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY && email && password,
);

const NETWORK_TIMEOUT = 30_000;
const DUNGEON_NAME = 'crud-test-dungeon';
const CHARACTER_NAME = 'crud-test-character';

describe.skipIf(!configured)('data layer against the real project', () => {
  let dungeonId: string;
  let characterId: string;
  let accountId: string;

  beforeAll(async () => {
    // The data modules use the shared singleton, so sign IT in rather than a
    // fresh client - otherwise every call below runs as anon.
    const { error } = await supabase.auth.signInWithPassword({
      email: email as string,
      password: password as string,
    });
    if (error) throw new Error(`test user A could not sign in: ${error.message}`);

    // Leftovers from a failed run would make the assertions below ambiguous.
    const stale = await listDungeons();
    for (const d of stale.filter((d) => d.name === DUNGEON_NAME)) await deleteDungeon(d.id);

    accountId = await currentGameAccountId();
    for (const c of await listCharacters(accountId)) {
      if (c.name === CHARACTER_NAME) await deleteCharacter(c.id);
    }
  }, NETWORK_TIMEOUT);

  afterAll(async () => {
    if (characterId) await deleteCharacter(characterId);
    if (dungeonId) await deleteDungeon(dungeonId);
    if (accountId) await supabase.from('game_accounts').delete().eq('id', accountId);
    await supabase.auth.signOut();
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

  it('round-trips a character', { timeout: NETWORK_TIMEOUT }, async () => {
    const created = await createCharacter(accountId, CHARACTER_NAME);
    characterId = created.id;
    expect((await listCharacters(accountId)).some((c) => c.id === characterId)).toBe(true);
  });

  it('upserts the same grid cell twice without a conflict', { timeout: NETWORK_TIMEOUT }, async () => {
    await setGridCell(characterId, dungeonId, { tier: 'elite' });
    await setGridCell(characterId, dungeonId, { min_runs: 2 });
    const rows = await listGrid([characterId]);
    const cell = rows.find((r) => r.dungeon_id === dungeonId);
    expect(cell?.tier).toBe('elite');
    expect(cell?.min_runs).toBe(2);
  });

  it('logs a run and feeds it back into the engine input', { timeout: NETWORK_TIMEOUT }, async () => {
    await logRun(characterId, dungeonId, 30);
    const input = await loadPlanInput(accountId);
    // One of this character's three attempts is spent, and the gold is counted.
    expect(input.characterAttemptsLeft[characterId]?.[dungeonId]).toBe(2);
    expect(input.goldHeadroom[characterId]).toBe(1_000_000 - 30);
  });

  it('undoes a run', { timeout: NETWORK_TIMEOUT }, async () => {
    const recent = await listRecentRuns([characterId]);
    const first = recent[0];
    expect(first).toBeDefined();
    await deleteRun(first!.id);
    expect(await listRecentRuns([characterId])).toEqual([]);
  });
});
