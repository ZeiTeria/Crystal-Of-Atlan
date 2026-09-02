import { CHARACTER_CLASSES } from '../data/classes';
import './ClassPicker.css';

/**
 * The 26 classes, as an even grid rather than a ragged wrap.
 *
 * A flex wrap sized every chip to its own name, so "Bounty Hunter" and
 * "Gunner" sat on the same row at wildly different widths and the marks never
 * lined up - twenty-six of those reads as a pile, not a list. A fixed track
 * puts every mark in the same column, which is what makes it scannable.
 *
 * Shared deliberately: the add form and the class control on a character have
 * to offer the same set, and a second copy would be the one that goes stale.
 */
export default function ClassPicker({
  value,
  onSelect,
  labelFor,
}: {
  value: string | null | undefined;
  onSelect: (className: string) => void;
  /** Accessible name for one option, e.g. `(c) => \`Set class to ${c}\``. */
  labelFor?: (className: string) => string;
}) {
  return (
    <div className="class-grid" role="group">
      {CHARACTER_CLASSES.map((c) => {
        const selected = value === c.name;
        return (
          <button
            type="button"
            key={c.name}
            className={selected ? 'class-chip selected' : 'class-chip'}
            aria-pressed={selected}
            aria-label={labelFor ? labelFor(c.name) : undefined}
            style={{ '--c-hue': c.hue } as React.CSSProperties}
            onClick={() => onSelect(c.name)}
          >
            <span
              className="class-chip-mark"
              aria-hidden="true"
              style={{
                backgroundColor: c.hue,
                maskImage: `url(${c.icon})`,
                WebkitMaskImage: `url(${c.icon})`,
              }}
            />
            <span className="class-chip-name">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}
