import type { Conflict, PlanInput } from './types';

/**
 * Detects hard minimums that cannot be met, before any solving happens.
 *
 * This is a fast path for clear, explainable conflicts — it is NOT the
 * authority on feasibility. Minimums can interact in ways no single check sees,
 * so the solvers still report `no-feasible-plan` if they find nothing. An empty
 * result here means "no obvious conflict", not "definitely solvable".
 */
export function validate(input: PlanInput): Conflict[] {
  const conflicts: Conflict[] = [];
  const requiredPerDungeon = new Map<string, number>();
  const requiredGoldPerCharacter = new Map<string, number>();
  const dungeonById = new Map(input.dungeons.map((d) => [d.id, d]));

  for (const entry of input.grid) {
    if (entry.minRuns <= 0) continue;
    const dungeon = dungeonById.get(entry.dungeonId);
    if (!dungeon) continue;

    if (entry.tier === 'none') {
      conflicts.push({
        kind: 'minimum-on-locked-dungeon',
        characterId: entry.characterId,
        dungeonId: entry.dungeonId,
      });
      continue;
    }

    const characterLeft =
      input.characterAttemptsLeft[entry.characterId]?.[entry.dungeonId] ?? 0;
    if (entry.minRuns > characterLeft) {
      conflicts.push({
        kind: 'minimum-exceeds-character-cap',
        characterId: entry.characterId,
        dungeonId: entry.dungeonId,
        required: entry.minRuns,
        available: characterLeft,
      });
    }

    requiredPerDungeon.set(
      entry.dungeonId,
      (requiredPerDungeon.get(entry.dungeonId) ?? 0) + entry.minRuns,
    );
    requiredGoldPerCharacter.set(
      entry.characterId,
      (requiredGoldPerCharacter.get(entry.characterId) ?? 0)
        + entry.minRuns * dungeon.gold[entry.tier],
    );
  }

  for (const [dungeonId, required] of requiredPerDungeon) {
    const available = input.accountAttemptsLeft[dungeonId] ?? 0;
    if (required > available) {
      conflicts.push({ kind: 'minimums-exceed-account-cap', dungeonId, required, available });
    }
  }

  for (const [characterId, requiredGold] of requiredGoldPerCharacter) {
    const headroom = input.goldHeadroom[characterId] ?? 0;
    if (requiredGold > headroom) {
      conflicts.push({ kind: 'minimums-exceed-gold-cap', characterId, requiredGold, headroom });
    }
  }

  return conflicts;
}
