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
}

export interface Character {
  id: string;
  name: string;
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
