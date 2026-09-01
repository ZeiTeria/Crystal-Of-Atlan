import { PAID_TIERS, type PaidTier, type Tier } from '../engine/types';

export interface TemplateDungeon {
  id: string;
  default_tier: Tier;
  default_min_runs: number;
}

export interface TemplateCell {
  character_id: string;
  dungeon_id: string;
  tier: Tier;
  min_runs: number;
}

/**
 * What a new character's grid starts as.
 *
 * Encoded as a string because it comes straight off a `<select>`:
 *   'blank'        - dungeon defaults, i.e. write nothing
 *   'tier:legend'  - every dungeon at that difficulty
 *   'char:<id>'    - a copy of that character's grid
 */
export type TemplateValue = string;

export const TIER_TEMPLATES = PAID_TIERS.map((t) => ({
  value: `tier:${t}`,
  label: `All ${t}`,
})).reverse(); // legend first: the strongest template is the one usually wanted

/**
 * The cells to write for a chosen template, or an empty list when there is
 * nothing to write.
 *
 * 'blank' returns nothing deliberately rather than writing the defaults out:
 * a pair with no row already displays the dungeon's defaults, so writing them
 * would only freeze today's values and stop the character following a later
 * change to the catalogue.
 *
 * A character copy takes what the SOURCE DISPLAYS, defaults included - copying
 * only its stored rows would leave the two matching by coincidence and diverging
 * the moment a dungeon default changed.
 */
export function templateCells(
  template: TemplateValue,
  opts: {
    targetId: string;
    dungeons: TemplateDungeon[];
    /**
     * Looks up an existing grid row. A function rather than a Map because the
     * caller owns the key format - passing a Map meant this module had to guess
     * it, and guessing wrong silently produced dungeon defaults instead of the
     * copied values, which looks like a working copy until you read it closely.
     */
    lookup: (characterId: string, dungeonId: string) => { tier: Tier; min_runs: number } | undefined;
  },
): TemplateCell[] {
  const { targetId, dungeons, lookup } = opts;

  if (template === 'blank' || template === '') return [];

  if (template.startsWith('tier:')) {
    const tier = template.slice('tier:'.length) as PaidTier;
    if (!PAID_TIERS.includes(tier)) return [];
    return dungeons.map((d) => ({
      character_id: targetId,
      dungeon_id: d.id,
      tier,
      min_runs: d.default_min_runs,
    }));
  }

  if (template.startsWith('char:')) {
    const sourceId = template.slice('char:'.length);
    if (sourceId === targetId) return [];
    return dungeons.map((d) => {
      const row = lookup(sourceId, d.id);
      return {
        character_id: targetId,
        dungeon_id: d.id,
        tier: row?.tier ?? d.default_tier,
        min_runs: row?.min_runs ?? d.default_min_runs,
      };
    });
  }

  return [];
}
