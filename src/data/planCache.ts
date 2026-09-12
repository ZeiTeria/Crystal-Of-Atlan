import { buildCells } from '../engine/cells';
import { SOLVER_SIGNATURE } from '../engine/solver';
import type { PlanInput, PlanResult } from '../engine/types';
import { supabase } from '../lib/supabase';

/**
 * The solved plan for one account, and the fingerprint of the inputs it was
 * solved from.
 *
 * The plan is a pure function of the stored rows - `derivePlanInput` reads no
 * clock, and there is no run log to subtract since migration 0016 - so the same
 * inputs always give the same plan and it is safe to store the answer. Without
 * this, every page load re-runs a MILP that costs seconds once `gold_c` is
 * filled in. See `TOLERANCES` in `engine/solver.ts` for why it is not cheap.
 */
export interface CachedPlan {
  fingerprint: string;
  plan: PlanResult;
}

/**
 * Stable JSON. Object keys are sorted, so two objects that differ only in key
 * order render identically, and numbers are printed rather than JSON-encoded so
 * `Infinity` stays distinguishable from `null` instead of collapsing onto it.
 */
function canonical(value: unknown): string {
  if (typeof value === 'number') return String(value);
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Fingerprints exactly what the solver reads, and nothing else.
 *
 * Built from `buildCells` output plus the raw grid and the three cap maps,
 * because between them that IS the solver's input: cells carry the priced,
 * bounded decision variables, and the grid carries what `validate` needs that
 * cells drop - a minimum sitting on a `none` tier, which turns an otherwise
 * identical account infeasible.
 *
 * Deliberately NOT a hash of `PlanInput`: that carries names, classes, short
 * names and sort order, none of which the solver reads, so every rename would
 * throw away a good plan. Equally deliberately not a hand-picked list of
 * columns - a field left off that list serves a stale plan, which is the one
 * failure this cache must not have.
 *
 * Cells are sorted because `character_dungeon` is read without an ORDER BY, so
 * row order is not guaranteed to repeat between reads.
 */
export async function planFingerprint(input: PlanInput): Promise<string> {
  const byPair = (a: { c: string; d: string }, b: { c: string; d: string }) =>
    a.c === b.c ? (a.d < b.d ? -1 : 1) : a.c < b.c ? -1 : 1;

  // `index` is left out: it is a position in the grid, not a fact about the cell.
  const cells = buildCells(input)
    .map((cell) => ({
      c: cell.characterId, d: cell.dungeonId,
      gold: cell.goldPerRun, min: cell.min, max: cell.max,
    }))
    .sort(byPair);

  const grid = input.grid
    .map((g) => ({
      c: g.characterId, d: g.dungeonId,
      tier: g.tier, min: g.minRuns, max: g.maxRuns,
    }))
    .sort(byPair);

  return sha256Hex(canonical({
    // A change to the solver's own tolerances changes the answer for unchanged
    // inputs, so it has to invalidate what is stored.
    solver: SOLVER_SIGNATURE,
    cells,
    grid,
    characters: input.characters.map((c) => c.id).sort(),
    dungeons: input.dungeons.map((d) => d.id).sort(),
    accountAttemptsLeft: input.accountAttemptsLeft,
    characterAttemptsLeft: input.characterAttemptsLeft,
    goldHeadroom: input.goldHeadroom,
  }));
}

/**
 * Reads the stored plan, or null when there is nothing usable.
 *
 * Every failure is a null rather than a throw: a cache that cannot be read must
 * cost a solve, never the screen.
 */
export async function readCachedPlan(gameAccountId: string): Promise<CachedPlan | null> {
  const { data, error } = await supabase
    .from('plan_cache')
    .select('fingerprint, plan')
    .eq('game_account_id', gameAccountId)
    .maybeSingle();

  if (error || !data) return null;

  // Only a solved plan is worth storing, so anything else is treated as absent
  // rather than trusted - including a row written by an older shape.
  const plan = data.plan as PlanResult | null;
  if (!plan || plan.status !== 'optimal' || !Array.isArray(plan.assignments)) return null;
  return { fingerprint: data.fingerprint, plan };
}

/** Stores a solved plan. Never throws - a failed write just costs a solve next time. */
export async function writeCachedPlan(
  gameAccountId: string,
  fingerprint: string,
  plan: PlanResult,
): Promise<void> {
  if (plan.status !== 'optimal') return;
  const { error } = await supabase.from('plan_cache').upsert({
    game_account_id: gameAccountId,
    fingerprint,
    plan: plan as unknown as Record<string, unknown>,
    solved_at: new Date().toISOString(),
  });
  if (error) console.warn(`plan cache write failed: ${error.message}`);
}
