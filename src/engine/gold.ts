import { PAID_TIERS, type PaidTier } from './types';

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
