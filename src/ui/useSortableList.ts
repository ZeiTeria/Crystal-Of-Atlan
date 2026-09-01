import { useCallback, useRef, useState } from 'react';
import { reorder } from './reorder';

/**
 * Drag-to-reorder by a grip handle, for mouse, touch, pen and keyboard.
 *
 * Hand-rolled on Pointer Events rather than taking a library: @dnd-kit last
 * shipped December 2024 and react-sortablejs in 2022, and Atlassian's
 * pragmatic-drag-and-drop - the one that is current - is built on the HTML5
 * drag API, whose touch behaviour is the exact thing at issue here. Pointer
 * Events give one code path for all three input kinds and cannot go stale.
 *
 * The handle carries `touch-action: none`, so dragging it does not fight the
 * page's own scroll gesture. Grabbing anywhere else on the row still scrolls
 * normally, which is why the handle exists at all rather than the whole row
 * being draggable.
 *
 * The keyboard path is not a fallback bolted on afterwards: the user chose
 * drag-only over keeping the up/down buttons, so this is the ONLY way to
 * reorder without a pointer. Space lifts, arrows move, Space drops, Escape
 * cancels and restores the order as it was.
 */
export function useSortableList({
  ids,
  onReorder,
}: {
  ids: string[];
  /** Called once, on drop, with the final order. Not called for a no-op move. */
  onReorder: (ids: string[]) => void;
}) {
  // While a drag or a keyboard lift is in flight the list shows this instead of
  // `ids`, so the row follows the pointer before anything is written.
  const [preview, setPreview] = useState<string[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lifted, setLifted] = useState(false);

  // Refs, not state: the pointermove handler is attached once and must read the
  // current values without being re-created on every move.
  const orderRef = useRef<string[]>(ids);
  const beforeRef = useRef<string[]>(ids);

  const order = preview ?? ids;

  const finish = useCallback(
    (commit: boolean) => {
      const next = orderRef.current;
      const before = beforeRef.current;
      setPreview(null);
      setActiveId(null);
      setLifted(false);
      if (!commit) return;
      // A drag that ends where it started is not a change; writing it would
      // cost a round trip and a refresh for nothing.
      if (next.length === before.length && next.every((id, i) => id === before[i])) return;
      onReorder(next);
    },
    [onReorder],
  );

  const startPointerDrag = useCallback(
    (id: string, event: React.PointerEvent<HTMLElement>) => {
      // Only the primary button; a right-click must not start a drag.
      if (event.button !== 0) return;
      event.preventDefault();

      const current = preview ?? ids;
      orderRef.current = current;
      beforeRef.current = current;
      setPreview(current);
      setActiveId(id);

      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);

      const onMove = (move: PointerEvent) => {
        // Whatever row is under the pointer becomes the target index. Reading
        // the element beats measuring offsets: it stays correct with rows of
        // different heights, and with a table that scrolls under the pointer.
        const under = document
          .elementFromPoint(move.clientX, move.clientY)
          ?.closest<HTMLElement>('[data-sortable-id]');
        const overId = under?.dataset.sortableId;
        if (!overId || overId === id) return;

        const from = orderRef.current.indexOf(id);
        const to = orderRef.current.indexOf(overId);
        if (from === -1 || to === -1) return;

        const next = reorder(orderRef.current, from, to);
        orderRef.current = next;
        setPreview(next);
      };

      const onUp = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onCancel);
        finish(true);
      };

      const onCancel = () => {
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onCancel);
        orderRef.current = beforeRef.current;
        finish(false);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onCancel);
    },
    [finish, ids, preview],
  );

  const onKeyDown = useCallback(
    (id: string, event: React.KeyboardEvent<HTMLElement>) => {
      const key = event.key;

      if (key === ' ' || key === 'Enter') {
        event.preventDefault();
        if (lifted) {
          finish(true);
        } else {
          const current = preview ?? ids;
          orderRef.current = current;
          beforeRef.current = current;
          setPreview(current);
          setActiveId(id);
          setLifted(true);
        }
        return;
      }

      if (!lifted) return;

      if (key === 'Escape') {
        event.preventDefault();
        orderRef.current = beforeRef.current;
        finish(false);
        return;
      }

      const step = key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : key === 'ArrowDown' || key === 'ArrowRight' ? 1 : 0;
      if (step === 0) return;
      event.preventDefault();

      const from = orderRef.current.indexOf(id);
      if (from === -1) return;
      const next = reorder(orderRef.current, from, from + step);
      orderRef.current = next;
      setPreview(next);
    },
    [finish, ids, lifted, preview],
  );

  /** Spread onto the grip. The row itself gets `data-sortable-id`. */
  const handleProps = useCallback(
    (id: string, label: string) => ({
      role: 'button' as const,
      tabIndex: 0,
      'aria-label': lifted && activeId === id ? `${label} — lifted, arrows to move` : label,
      'aria-pressed': activeId === id && lifted,
      className: 'grip',
      onPointerDown: (event: React.PointerEvent<HTMLElement>) => startPointerDrag(id, event),
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => onKeyDown(id, event),
    }),
    [activeId, lifted, onKeyDown, startPointerDrag],
  );

  return { order, activeId, lifted, handleProps };
}
