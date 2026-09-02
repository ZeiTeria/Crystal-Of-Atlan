import { CLASS_FAMILIES, type CharacterClass } from '../data/classes';
import './ClassPicker.css';

/**
 * The 26 classes, grouped the way the game groups them.
 *
 * Seven base classes, each heading the two or three it advances into. A flat
 * list of 26 was both a pile to read and a lie about the game: you do not pick
 * Warlock instead of Magister, you pick Magister and become a Warlock.
 *
 * The base class leads its own row and is pickable itself - a character that
 * has not advanced yet is one of those.
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
  const chip = (c: CharacterClass, isBase: boolean) => {
    const selected = value === c.name;
    return (
      <button
        type="button"
        key={c.name}
        className={[isBase ? 'class-chip is-base' : 'class-chip', selected ? 'selected' : '']
          .filter(Boolean)
          .join(' ')}
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
  };

  return (
    <div className="class-families">
      {CLASS_FAMILIES.map(({ base, advanced }) => (
        <div className="class-family" key={base.name} role="group" aria-label={base.name}>
          {chip(base, true)}
          <div className="class-grid">{advanced.map((c) => chip(c, false))}</div>
        </div>
      ))}
    </div>
  );
}
