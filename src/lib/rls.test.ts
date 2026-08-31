import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './database.types';

/**
 * Row level security is the entire security model of this app: a static site
 * cannot hold a secret, so the only thing standing between one player's data
 * and another's is the policy set in `supabase/migrations/`. That is worth
 * testing against the real project rather than trusting.
 *
 * These tests hit the network and need two pre-made, auto-confirmed users. They
 * SKIP rather than fail when the credentials are absent, so a fresh clone does
 * not have a red suite for a reason that is not a defect.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const A_EMAIL = import.meta.env.VITE_TEST_A_EMAIL;
const A_PASSWORD = import.meta.env.VITE_TEST_A_PASSWORD;
const B_EMAIL = import.meta.env.VITE_TEST_B_EMAIL;
const B_PASSWORD = import.meta.env.VITE_TEST_B_PASSWORD;

const configured = Boolean(url && key && A_EMAIL && A_PASSWORD && B_EMAIL && B_PASSWORD);

/** Every table in `public`, so "did we forget one" is a test failure. */
const TABLES = [
  'app_settings',
  'profiles',
  'game_accounts',
  'characters',
  'dungeons',
  'character_dungeon',
  'runs',
] as const;

/** The tables whose rows belong to exactly one user. */
const OWNED_TABLES = ['game_accounts', 'characters', 'character_dungeon', 'runs'] as const;

const NETWORK_TIMEOUT = 30_000;

/**
 * Every account name this suite can create, including the ones a *failing* run
 * creates. A run that proves the tests discriminate necessarily leaves rows a
 * passing run never would, so cleanup is by name and happens at both ends.
 */
const TEST_ACCOUNT_NAMES = ['rls-test-account', 'stolen', 'hijacked'];

/**
 * A fresh client per user. The shared `supabase` singleton cannot be used here:
 * it holds one session, so the second sign-in would silently replace the first
 * and both "users" would be the same person — a test that always passes.
 */
function freshClient(): SupabaseClient<Database> {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(client: SupabaseClient<Database>, email: string, password: string) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`${email} could not sign in: ${error.message}`);
  const userId = data.user?.id;
  if (!userId) throw new Error(`${email} signed in without a user id`);
  return userId;
}

/** Removes this suite's accounts. Characters, grid rows and runs cascade. */
async function sweep(client: SupabaseClient<Database>) {
  await client.from('game_accounts').delete().in('name', TEST_ACCOUNT_NAMES);
}

describe.skipIf(!configured)('row level security', () => {
  let a: SupabaseClient<Database>;
  let b: SupabaseClient<Database>;
  let aUserId: string;
  let bUserId: string;
  let aAccountId: string;
  let aCharacterId: string;

  beforeAll(async () => {
    a = freshClient();
    b = freshClient();
    aUserId = await signIn(a, A_EMAIL as string, A_PASSWORD as string);
    bUserId = await signIn(b, B_EMAIL as string, B_PASSWORD as string);
    expect(aUserId).not.toBe(bUserId);

    await sweep(a);

    const account = await a
      .from('game_accounts')
      .insert({ owner_id: aUserId, name: 'rls-test-account' })
      .select()
      .single();
    if (account.error) throw new Error(`A could not create its account: ${account.error.message}`);
    aAccountId = account.data.id;

    const character = await a
      .from('characters')
      .insert({ game_account_id: aAccountId, name: 'rls-test-character' })
      .select()
      .single();
    if (character.error) {
      throw new Error(`A could not create its character: ${character.error.message}`);
    }
    aCharacterId = character.data.id;
  }, NETWORK_TIMEOUT);

  afterAll(async () => {
    if (a) await sweep(a);
    await Promise.all([a?.auth.signOut(), b?.auth.signOut()]);
  }, NETWORK_TIMEOUT);

  it('lets A read back what A wrote', { timeout: NETWORK_TIMEOUT }, async () => {
    const { data, error } = await a.from('characters').select('*').eq('id', aCharacterId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('hides A’s characters from B', { timeout: NETWORK_TIMEOUT }, async () => {
    // Asserted on the ROW COUNT, not on `error`. Row level security filters, it
    // does not raise: a test expecting an error here passes against a
    // wide-open table and proves nothing.
    const { data, error } = await b.from('characters').select('*').eq('id', aCharacterId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('hides A’s game account from B', { timeout: NETWORK_TIMEOUT }, async () => {
    const { data, error } = await b.from('game_accounts').select('*').eq('id', aAccountId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('refuses B inserting a character into A’s account', { timeout: NETWORK_TIMEOUT }, async () => {
    // An insert cannot be silently filtered, so here the `with check` clause
    // must actually raise.
    const { error } = await b
      .from('characters')
      .insert({ game_account_id: aAccountId, name: 'trespasser' });
    expect(error).not.toBeNull();
  });

  it('refuses B creating an account owned by A', { timeout: NETWORK_TIMEOUT }, async () => {
    const { error } = await b
      .from('game_accounts')
      .insert({ owner_id: aUserId, name: 'stolen' });
    expect(error).not.toBeNull();
  });

  it('leaves A’s account untouched when B updates it', { timeout: NETWORK_TIMEOUT }, async () => {
    // An update outside the policy affects zero rows rather than failing, so
    // the proof is A re-reading its own row afterwards.
    const attempt = await b
      .from('game_accounts')
      .update({ name: 'hijacked' })
      .eq('id', aAccountId)
      .select();
    expect(attempt.error).toBeNull();
    expect(attempt.data).toEqual([]);

    const reread = await a.from('game_accounts').select('name').eq('id', aAccountId).single();
    expect(reread.error).toBeNull();
    expect(reread.data?.name).toBe('rls-test-account');
  });

  it('leaves A’s character in place when B deletes it', { timeout: NETWORK_TIMEOUT }, async () => {
    const attempt = await b.from('characters').delete().eq('id', aCharacterId).select();
    expect(attempt.error).toBeNull();
    expect(attempt.data).toEqual([]);

    const reread = await a.from('characters').select('id').eq('id', aCharacterId);
    expect(reread.error).toBeNull();
    expect(reread.data).toHaveLength(1);
  });

  it('refuses a non-admin writing the shared catalogue', { timeout: NETWORK_TIMEOUT }, async () => {
    const dungeon = await b.from('dungeons').insert({ name: 'forged dungeon' });
    expect(dungeon.error).not.toBeNull();

    const settings = await b
      .from('app_settings')
      .update({ gold_cap_per_character: 1 })
      .eq('id', true)
      .select();
    // Either refused outright or filtered to nothing; what must never happen is
    // a non-admin actually changing a row.
    expect(settings.error !== null || settings.data?.length === 0).toBe(true);
  });

  it('lets both users read the shared catalogue', { timeout: NETWORK_TIMEOUT }, async () => {
    for (const client of [a, b]) {
      const dungeons = await client.from('dungeons').select('*');
      expect(dungeons.error).toBeNull();
      expect(Array.isArray(dungeons.data)).toBe(true);

      const settings = await client.from('app_settings').select('*');
      expect(settings.error).toBeNull();
      expect(settings.data).toHaveLength(1);
    }
  });

  it('shows B only its own profile row', { timeout: NETWORK_TIMEOUT }, async () => {
    // A's profile exists — A is signed in — so a policy-less `profiles` would
    // return more than one row here.
    const { data, error } = await b.from('profiles').select('id');
    expect(error).toBeNull();
    expect(data).toEqual([{ id: bUserId }]);
  });

  it('shows B nothing in any owner-scoped table', { timeout: NETWORK_TIMEOUT }, async () => {
    // B owns nothing, and A owns rows in each of these right now, so any table
    // that lost its policy — or had row level security switched off — returns
    // rows here instead of none.
    for (const table of OWNED_TABLES) {
      const { data, error } = await b.from(table).select('*');
      expect(error, `${table} errored for B`).toBeNull();
      expect(data, `${table} leaked rows to B`).toEqual([]);
    }
  });

  it('gives an unauthenticated client nothing from any table', { timeout: NETWORK_TIMEOUT }, async () => {
    const anon = freshClient();
    for (const table of TABLES) {
      const { data, error } = await anon.from(table).select('*');
      // Every policy is `to authenticated`, and anon's grants are revoked, so
      // this is refused outright — but zero rows would be just as correct.
      expect(error !== null || data?.length === 0, `${table} answered anon`).toBe(true);
    }
  });
});
