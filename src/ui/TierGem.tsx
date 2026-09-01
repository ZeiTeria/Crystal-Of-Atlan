import type { Tier } from '../engine/types';
import './TierGem.css';

/**
 * Tier as a small rotated square rather than a word, so a matrix can show tier
 * without spending a column on it. Decorative and aria-hidden: the tier is
 * always also present as a select or as text beside it, so this adds nothing
 * for a screen reader and everything for an eye scanning 108 cells.
 */
export default function TierGem({ tier }: { tier: Tier }) {
  if (tier === 'none') return null;
  return <span className={`gem gem-${tier}`} aria-hidden="true" />;
}
