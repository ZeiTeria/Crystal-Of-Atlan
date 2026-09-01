import { useEffect, useId, useRef, useState } from 'react';
import './InfoDot.css';

/**
 * A "?" that explains itself.
 *
 * Pointing at it opens the explanation; clicking pins it open so it survives
 * the pointer leaving, which is what makes it usable on a touch screen where
 * there is no hover at all. There is deliberately no `title`: a native tooltip
 * and this popup would say the same thing twice, in two different places, with
 * the browser's own delay before one of them.
 *
 * The popup is absolutely positioned out of flow, so opening one never moves a
 * table cell or reflows the matrix around it.
 */
export default function InfoDot({ label, children }: { label: string; children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  const open = hovered || pinned;

  useEffect(() => {
    if (!pinned) return;
    // Only a pinned popup needs these: an unpinned one closes when the pointer
    // leaves, so a table full of them costs nothing while they are all shut.
    const onDocClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setPinned(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPinned(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [pinned]);

  return (
    <span
      className="infodot-wrap"
      ref={wrapRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="infodot"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        onClick={() => setPinned((was) => !was)}
      >
        ?
      </button>
      {open && (
        <span className="infodot-pop" id={id} role="dialog" aria-label={label}>
          {children}
        </span>
      )}
    </span>
  );
}
