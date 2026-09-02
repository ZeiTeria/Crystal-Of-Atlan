/** A character's unlocked difficulty in one dungeon. `none` = cannot enter. */
export type Tier = 'none' | 'solo' | 'story' | 'elite' | 'legend';

/** The four paying difficulties, in ascending order. */
export const PAID_TIERS = ['solo', 'story', 'elite', 'legend'] as const;
export type PaidTier = (typeof PAID_TIERS)[number];

export interface Dungeon {
  id: string;
  name: string;
  /** Account-wide attempts per week, e.g. 18. */
  accountAttempts: number;
  /** Per-character attempts per week. Minimum 1, never 0. */
  characterAttempts: number;
  /** ISO weekday this dungeon resets on. Monday = 1 ... Sunday = 7. */
  resetWeekday: number;
  /** True when every character should get at least one run for the weekly quest. */
  questCoverage: boolean;
  /** Gold for a single run at each difficulty. Whole gold, no decimals. */
  gold: Record<PaidTier, number>;
  /** The fallback tier a character has if they don't have an explicit entry in the grid. */
  default_tier: Tier;
  /** The fallback min runs a character has if they don't have an explicit entry in the grid. */
  default_min_runs: number;
  /**
   * Display only. The engine never reads either of these - the screens order
   * their columns by sort_order and band them by group_name, and a plan is
   * identical whatever they hold.
   */
  sort_order: number;
  group_name: string | null;
  /** Short label for the simplified matrix. Display only, like the two above. */
  short_name: string | null;
  /**
   * Tiers whose gold was borrowed from another tier because the catalogue has
   * no figure for them yet. Display only - the solver simply uses `gold`, which
   * already holds the substituted values. See engine/gold.ts.
   */
  goldEstimated: PaidTier[];
  /**
   * True when the dungeon has no gold figure for any tier at all. Distinct from
   * goldEstimated: there is nothing to borrow, so the figures are absent rather
   * than approximate.
   */
  goldUnknown: boolean;
}

export interface Character {
  id: string;
  name: string;
  class: string | null;
}

export interface GridEntry {
  characterId: string;
  dungeonId: string;
  tier: Tier;
  /** Hard floor set by the user: this character must run this dungeon at least this often. */
  minRuns: number;
}

/**
 * Everything the planner needs, already reduced to what is *left* right now.
 * Producing this from the run log is `counters.ts`, not the solver's problem.
 */
export interface PlanInput {
  characters: Character[];
  dungeons: Dungeon[];
  grid: GridEntry[];
  /** dungeonId -> account attempts still available this week. */
  accountAttemptsLeft: Record<string, number>;
  /** characterId -> dungeonId -> attempts that character still has this week. */
  characterAttemptsLeft: Record<string, Record<string, number>>;
  /** characterId -> gold still earnable before hitting the weekly cap. */
  goldHeadroom: Record<string, number>;
  /** The settings used to derive this input (for display purposes). */
  settings: {
    goldCap: number;
    goldResetWeekday: number;
    resetHour: number;
    timeZone: string;
  };
}

export interface PlanAssignment {
  characterId: string;
  dungeonId: string;
  runs: number;
  goldPerRun: number;
  goldTotal: number;
}

export interface PlanTotals {
  /** Total runs across the whole plan. Objective 1. */
  attempts: number;
  /** Character-dungeon pairs covered at least once on quest dungeons. Objective 2. */
  coverage: number;
  /** Total gold. Objective 3. */
  gold: number;
}

/** A hard requirement that cannot be met. Wording is the UI's job, not the engine's. */
export type Conflict =
  | { kind: 'minimum-on-locked-dungeon'; characterId: string; dungeonId: string }
  | { kind: 'minimum-exceeds-character-cap'; characterId: string; dungeonId: string;
      required: number; available: number }
  | { kind: 'minimums-exceed-account-cap'; dungeonId: string;
      required: number; available: number }
  | { kind: 'minimums-exceed-gold-cap'; characterId: string;
      requiredGold: number; headroom: number }
  | { kind: 'no-feasible-plan' };

export type PlanResult =
  | { status: 'optimal'; assignments: PlanAssignment[]; totals: PlanTotals }
  | { status: 'infeasible'; conflicts: Conflict[] };
