import { useEffect, useId, useRef, useState } from 'react';
import './InfoDot.css';

/**
 * A "?" that explains itself: the reason on hover via the native title, and the
 * same reason in a small popup on click for anyone who cannot hover, or who
 * wants it to stay put while they read it.
 *
 * The popup is absolutely positioned out of flow, so opening one never moves a
 * table cell or reflows the matrix around it.
 */
export default function InfoDot({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    // Any click elsewhere, or Escape, closes it. Registered only while open so
    // a table full of these costs nothing when they are all shut.
    const onDocClick = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span className="infodot-wrap" ref={wrapRef}>
      <button
        type="button"
        className="infodot"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        title={label}
        onClick={() => setOpen((was) => !was)}
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
