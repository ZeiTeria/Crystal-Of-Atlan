import { buildCells, type Cell } from './cells';
import type { PlanInput, PlanResult } from './types';

/** Why the plan cannot be improved. The UI turns these into sentences. */
export type Reason =
  | { kind: 'account-attempts-exhausted'; dungeonId: string }
  | { kind: 'gold-cap-reached'; characterId: string }
  | { kind: 'attempts-unusable'; dungeonId: string; unusable: number };

/** The most gold the weekly caps physically allow: characters x their headroom. */
export function goldCapCeiling(input: PlanInput): number {
  return input.characters.reduce((sum, c) => sum + (input.goldHeadroom[c.id] ?? 0), 0);
}

function cellsByDungeon(cells: Cell[]): Map<string, Cell[]> {
  const grouped = new Map<string, Cell[]>();
  for (const cell of cells) {
    const list = grouped.get(cell.dungeonId);
    if (list) list.push(cell);
    else grouped.set(cell.dungeonId, [cell]);
  }
  return grouped;
}

/**
 * The most gold the attempts allow, ignoring the gold cap.
 *
 * Exact, not an estimate: drop the gold cap and no constraint spans dungeons,
 * so each dungeon independently hands its attempts to the best-paying
 * characters and a sorted greedy is provably optimal.
 */
export function attemptCeiling(input: PlanInput): number {
  let total = 0;
  for (const [dungeonId, cells] of cellsByDungeon(buildCells(input))) {
    let left = input.accountAttemptsLeft[dungeonId] ?? 0;
    for (const cell of [...cells].sort((a, b) => b.goldPerRun - a.goldPerRun)) {
      if (left <= 0) break;
      const runs = Math.min(cell.max, left);
      total += runs * cell.goldPerRun;
      left -= runs;
    }
  }
  return total;
}

/**
 * True when every character can simply run their maximum — nothing to decide.
 *
 * Tests BOTH caps, not the character count. Six characters at three runs fits
 * an eighteen-attempt dungeon exactly, but if running everything at maximum
 * would push someone past their gold cap, the choice is back.
 */
export function noContention(input: PlanInput): boolean {
  const cells = buildCells(input);

  for (const [dungeonId, group] of cellsByDungeon(cells)) {
    const wanted = group.reduce((sum, c) => sum + c.max, 0);
    if (wanted > (input.accountAttemptsLeft[dungeonId] ?? 0)) return false;
  }

  for (const character of input.characters) {
    const wantedGold = cells
      .filter((c) => c.characterId === character.id)
      .reduce((sum, c) => sum + c.max * c.goldPerRun, 0);
    if (wantedGold > (input.goldHeadroom[character.id] ?? 0)) return false;
  }

  return true;
}

/**
 * Why the plan stops where it does. Empty means nothing was binding — the plan
 * already does everything possible.
 */
export function explainCeiling(input: PlanInput, result: PlanResult): Reason[] {
  if (result.status !== 'optimal') return [];

  const reasons: Reason[] = [];
  const runsByDungeon = new Map<string, number>();
  const goldByCharacter = new Map<string, number>();

  for (const a of result.assignments) {
    runsByDungeon.set(a.dungeonId, (runsByDungeon.get(a.dungeonId) ?? 0) + a.runs);
    goldByCharacter.set(a.characterId, (goldByCharacter.get(a.characterId) ?? 0) + a.goldTotal);
  }

  const cells = buildCells(input);
  for (const dungeon of input.dungeons) {
    const available = input.accountAttemptsLeft[dungeon.id] ?? 0;
    const used = runsByDungeon.get(dungeon.id) ?? 0;
    if (available > 0 && used >= available) {
      reasons.push({ kind: 'account-attempts-exhausted', dungeonId: dungeon.id });
      continue;
    }
    // Nobody can reach the rest of this dungeon's attempts, whatever we do.
    const reachable = cells
      .filter((c) => c.dungeonId === dungeon.id)
      .reduce((sum, c) => sum + c.max, 0);
    if (reachable < available) {
      reasons.push({
        kind: 'attempts-unusable', dungeonId: dungeon.id, unusable: available - reachable,
      });
    }
  }

  for (const character of input.characters) {
    const headroom = input.goldHeadroom[character.id] ?? 0;
    const earned = goldByCharacter.get(character.id) ?? 0;
    // Binding only if more gold was actually available to this character.
    const wanted = cells
      .filter((c) => c.characterId === character.id)
      .reduce((sum, c) => sum + c.max * c.goldPerRun, 0);
    if (headroom > 0 && earned >= headroom && wanted > headroom) {
      reasons.push({ kind: 'gold-cap-reached', characterId: character.id });
    }
  }

  return reasons;
}
