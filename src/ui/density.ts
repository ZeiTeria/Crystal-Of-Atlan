import { useCallback, useSyncExternalStore } from 'react';

export type Density = 'simple' | 'detailed';

const KEY = 'atlan.density';

/**
 * Whether the matrices show short labels in a tight table, or full names in a
 * roomy one. Simplified is the default: nine full dungeon names across twelve
 * characters does not fit a screen, and the abbreviations exist precisely so it
 * can.
 *
 * A module-level store rather than component state, because the Grid and the
 * Plan must agree - flipping it on one and finding the other unchanged would
 * read as a bug. Subscribers are notified directly, so both screens follow even
 * though they are never mounted at the same time.
 */
const listeners = new Set<() => void>();

function read(): Density {
  try {
    return localStorage.getItem(KEY) === 'detailed' ? 'detailed' : 'simple';
  } catch {
    // Storage can be unavailable; the default is a better outcome than failing.
    return 'simple';
  }
}

let current: Density = read();

export function setDensity(next: Density): void {
  current = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // The choice will not survive a reload. Not worth breaking the click over.
  }
  for (const listener of listeners) listener();
}

/** Test seam: resets the store so one test's choice cannot leak into the next. */
export function resetDensity(): void {
  current = 'simple';
  for (const listener of listeners) listener();
}

export function useDensity(): [Density, (next: Density) => void] {
  const subscribe = useCallback((onChange: () => void) => {
    listeners.add(onChange);
    return () => listeners.delete(onChange);
  }, []);
  const density = useSyncExternalStore(
    subscribe,
    () => current,
    () => 'simple' as Density,
  );
  return [density, setDensity];
}
