import type { Tier } from '../engine/types';
import './TierGem.css';

/**
 * Tier as a small rotated square rather than a word, so a grid can show tier
 * without spending a column on it. Decorative: the tier is always also
 * available as text or a select next to it, so this carries aria-hidden.
 */
export default function TierGem({ tier }: { tier: Tier }) {
  if (tier === 'none') return null;
  return <span className={`gem gem-${tier}`} aria-hidden="true" />;
}
