import { PAID_TIERS, type Dungeon, type PaidTier } from './types';

/**
 * Fills a dungeon's missing gold figures from the tiers that do have one.
 *
 * The catalogue gets filled in a tier at a time, so a dungeon commonly knows
 * what elite pays and nothing else. A zero is indistinguishable from "not
 * entered yet" - the schema default is 0 - and a zero would tell the solver the
 * run is worthless, so it would plan around a number that is simply absent.
 * Borrowing a neighbour's figure keeps the plan roughly right until the real
 * one arrives, and every borrowed tier is reported so the screens can say so.
 *
 * The substitute is the nearest tier by rank that has a figure. A tie - one
 * filled tier either side, equally far - goes to the HIGHER one, because these
 * numbers are checked against a gold CAP: over-estimating makes the planner
 * stop early, which is merely cautious, while under-estimating produces a plan
 * that blows through the cap, which is wrong.
 *
 * A dungeon with no figures at all is left alone: there is nothing to borrow,
 * and inventing one would be worse than the honest zero.
 */
export function fillGoldGaps(gold: Record<PaidTier, number>): {
  gold: Record<PaidTier, number>;
  estimated: PaidTier[];
  /**
   * True when the dungeon has no figure for ANY tier. Distinct from
   * `estimated`, which lists tiers standing on a neighbour's figure: here there
   * is no neighbour, so the zeros are simply absent data and every tier of the
   * dungeon is unknown.
   */
  unknown: boolean;
} {
  const known = PAID_TIERS.filter((t) => gold[t] > 0);
  if (known.length === 0) return { gold, estimated: [], unknown: true };
  if (known.length === PAID_TIERS.length) return { gold, estimated: [], unknown: false };

  const filled = { ...gold };
  const estimated: PaidTier[] = [];

  for (const tier of PAID_TIERS) {
    if (gold[tier] > 0) continue;
    const rank = PAID_TIERS.indexOf(tier);
    let best = known[0] as PaidTier;
    let bestDistance = Infinity;
    for (const candidate of known) {
      const distance = Math.abs(PAID_TIERS.indexOf(candidate) - rank);
      // `>=` on the tie, walking low to high, leaves the HIGHER tier holding.
      if (distance < bestDistance || (distance === bestDistance && gold[candidate] > gold[best])) {
        best = candidate;
        bestDistance = distance;
      }
    }
    filled[tier] = gold[best];
    estimated.push(tier);
  }

  return { gold: filled, estimated, unknown: false };
}

/**
 * The dungeon's stone bonus: the flat gold a stone adds to a clear.
 *
 * Measured, not assumed. The bonus is the same at every difficulty - Kraken's
 * Spine and Heart Of Taboos each pay 5,000 at story and at elite - and no buff
 * touches it, so it is a property of the dungeon rather than of the tier.
 *
 * Reading it per tier is what made The Deep Dive price legend BELOW elite.
 * `fillGoldGaps` gives legend elite's base, but `gold_legend_stone` is still 0,
 * so `stone - base` came out negative, clamped to zero, and legend silently
 * lost the 5,000 that elite keeps. Taking one bonus for the whole dungeon
 * removes that class of bug: a borrowed base now borrows its bonus with it.
 *
 * Zero when no tier has both figures - the honest answer when the dungeon has
 * never been run with a stone, and the same thing the old per-tier code did.
 */
export function stoneBonus(
  gold: Record<PaidTier, number>,
  stone: Record<PaidTier, number>,
): number {
  for (const tier of PAID_TIERS) {
    if (gold[tier] > 0 && stone[tier] > gold[tier]) return stone[tier] - gold[tier];
  }
  return 0;
}

/**
 * What one run of this dungeon is worth to one character, at one difficulty.
 *
 * Gold buffs multiply C and nothing else - not the rest of the clear reward and
 * not the stone bonus - and they add their percentages rather than compounding.
 * `dungeon.gold` is the UNBUFFED figure, so the character's own buffs are what
 * turns it into the gold they actually collect.
 *
 * Every caller that prices a run for a specific character goes through here.
 * Reading `dungeon.gold` directly is what the buff toggles exist to stop, and a
 * plan built that way would silently ignore every buff on the account.
 *
 * Rounded: `renderTerms` states LP coefficients are always integers, and
 * assertFeasible re-checks the finished plan in integer arithmetic.
 */
export function goldPerRun(
  dungeon: Pick<Dungeon, 'gold' | 'goldC'>,
  tier: PaidTier,
  buffPct: number,
): number {
  return Math.round(dungeon.gold[tier] + dungeon.goldC * buffPct);
}
