import { useEffect, useId, useRef, useState } from 'react';
import { PAID_TIERS, type Tier } from '../engine/types';
import './TierSelect.css';

/** Every difficulty, `none` first: it is "cannot enter", not a difficulty. */
const TIERS: Tier[] = ['none', ...PAID_TIERS];

/**
 * The difficulty a character enters a dungeon at.
 *
 * A native <select> was showing the operating system's own dropdown in the
 * middle of a dark, square-cornered design - a white rounded list with its own
 * font. This is the same control drawn in the design's own language: the
 * closed state is the tier word in its tier colour, exactly as the handoff
 * specifies, and opening it shows the five words in theirs.
 */
export default function TierSelect({
  value,
  label,
  disabled,
  onChange,
  optionLabel,
}: {
  value: Tier;
  /** Accessible name of the control, e.g. "Mage tier in Abyss". */
  label: string;
  disabled?: boolean;
  onChange: (tier: Tier) => void;
  /** Accessible name for one option, e.g. "Abyss at legend". */
  optionLabel: (tier: Tier) => string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    // Only an open menu needs these - a screen full of closed ones costs
    // nothing while they are all shut.
    const onDocPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDocPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={open ? 'tier-select is-open' : 'tier-select'} ref={wrapRef}>
      <button
        type="button"
        className="tier-value"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={disabled}
        style={{ color: `var(--tier-${value})` }}
        onClick={() => setOpen((was) => !was)}
      >
        {value}
      </button>
      {open && (
        <div className="tier-menu" id={id}>
          {TIERS.map((tier) => (
            <button
              type="button"
              key={tier}
              className={tier === value ? 'tier-option on' : 'tier-option'}
              aria-label={optionLabel(tier)}
              aria-pressed={tier === value}
              style={{ color: `var(--tier-${tier})` }}
              onClick={() => {
                setOpen(false);
                if (tier !== value) onChange(tier);
              }}
            >
              {tier}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
