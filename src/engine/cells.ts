import type { PlanInput, Tier, PaidTier } from './types';

/** One decision variable: how many times this character runs this dungeon. */
export interface Cell {
  index: number;
  characterId: string;
  dungeonId: string;
  /** Gold for one run, at this character's unlocked tier in this dungeon. */
  goldPerRun: number;
  /** Hard floor. */
  min: number;
  /** Upper bound, already narrowed by both the character and the account cap. */
  max: number;
  /** True when a first run here earns weekly-quest coverage. */
  countsForCoverage: boolean;
}

function isPaid(tier: Tier): tier is PaidTier {
  return tier !== 'none';
}

/**
 * Flattens the grid into the solver's variable list. Both the oracle and the
 * MILP consume this, so they cannot disagree about the problem being solved.
 * Cells the character cannot enter are omitted entirely.
 */
export function buildCells(input: PlanInput): Cell[] {
  const dungeonById = new Map(input.dungeons.map((d) => [d.id, d]));
  const cells: Cell[] = [];

  for (const entry of input.grid) {
    const dungeon = dungeonById.get(entry.dungeonId);
    if (!dungeon || !isPaid(entry.tier)) continue;

    const characterLeft = input.characterAttemptsLeft[entry.characterId]?.[entry.dungeonId] ?? 0;
    const accountLeft = input.accountAttemptsLeft[entry.dungeonId] ?? 0;
    const max = Math.min(characterLeft, accountLeft);
    if (max <= 0 && entry.minRuns <= 0) continue;

    cells.push({
      index: cells.length,
      characterId: entry.characterId,
      dungeonId: entry.dungeonId,
      goldPerRun: dungeon.gold[entry.tier],
      min: Math.max(0, entry.minRuns),
      max,
      countsForCoverage: dungeon.questCoverage,
    });
  }

  return cells;
}
