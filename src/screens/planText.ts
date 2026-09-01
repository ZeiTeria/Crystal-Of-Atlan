import type { Reason } from '../engine/ceilings';
import type { Conflict } from '../engine/types';

/** Ids are the engine's language; names are the player's. */
export interface Names {
  character(id: string): string;
  dungeon(id: string): string;
}

export function gold(amount: number): string {
  return amount.toLocaleString('en-US');
}

export function describeReason(reason: Reason, names: Names): string {
  switch (reason.kind) {
    case 'account-attempts-exhausted':
      return `${names.dungeon(reason.dungeonId)} has no account attempts left this week.`;
    case 'gold-cap-reached':
      return `${names.character(reason.characterId)} has reached its weekly gold cap.`;
    case 'attempts-unusable':
      return (
        `${reason.unusable} attempts on ${names.dungeon(reason.dungeonId)} cannot be used — ` +
        'not enough characters have it unlocked.'
      );
  }
}

export function describeConflict(conflict: Conflict, names: Names): string {
  switch (conflict.kind) {
    case 'minimum-on-locked-dungeon':
      return (
        `${names.character(conflict.characterId)} has a minimum on ` +
        `${names.dungeon(conflict.dungeonId)} but has not unlocked it.`
      );
    case 'minimum-exceeds-character-cap':
      return (
        `${names.character(conflict.characterId)} needs ${conflict.required} runs of ` +
        `${names.dungeon(conflict.dungeonId)} but only has ${conflict.available} attempts left.`
      );
    case 'minimums-exceed-account-cap':
      return (
        `${names.dungeon(conflict.dungeonId)}: your minimums require ${conflict.required} runs ` +
        `but only ${conflict.available} attempts exist.`
      );
    case 'minimums-exceed-gold-cap':
      return (
        `${names.character(conflict.characterId)}'s minimums would earn ` +
        `${gold(conflict.requiredGold)} gold but only ${gold(conflict.headroom)} fits under the cap.`
      );
    case 'no-feasible-plan':
      return 'No plan satisfies every requirement.';
  }
}
