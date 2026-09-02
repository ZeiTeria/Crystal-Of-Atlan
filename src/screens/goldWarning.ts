import type { PaidTier, Tier } from '../engine/types';

/**
 * Why a cell's gold cannot be trusted, or null when it can.
 *
 * Deliberately per CELL and per TIER, not per dungeon: a dungeon can know
 * exactly what elite pays and nothing about legend, and a character running it
 * at elite has a figure that is simply correct. Flagging the whole dungeon
 * marked those cells too, which trains the eye to ignore the mark.
 *
 * It points at @zteria rather than the Dungeons tab because the catalogue is
 * admin-only: telling a player to edit a screen they cannot open is worse than
 * saying nothing.
 */
export function goldWarning(
  dungeon: { name: string; goldEstimated: PaidTier[]; goldUnknown: boolean },
  tier: Tier | undefined,
): string | null {
  if (dungeon.goldUnknown) {
    return `${dungeon.name} has no gold figures at all, so this plan cannot weigh it against anything else. Contact @zteria on Discord to get it filled in.`;
  }
  if (!tier || tier === 'none') return null;
  if (!dungeon.goldEstimated.includes(tier)) return null;
  return `${dungeon.name} has no gold figure for ${tier}. Another difficulty's figure is standing in, so this row is an estimate. Contact @zteria on Discord to get it filled in.`;
}

/**
 * How many of this dungeon's remaining attempts the plan does not spend, and
 * the sentence explaining why - the solver's own account of that dungeon when
 * it has one, otherwise the general case, which is always one of these three.
 */
export function leftoverText(dungeonName: string, leftOver: number): string {
  return (
    `${leftOver} attempts on ${dungeonName} are left unused. Either no character has it ` +
    'unlocked at a difficulty worth running, or the characters that do have hit their own ' +
    'weekly limit or their gold cap.'
  );
}
