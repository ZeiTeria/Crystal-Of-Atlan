import { vi } from 'vitest';

/**
 * Stub `window.matchMedia` so a test can render the phone tree.
 *
 * jsdom implements no layout and no matchMedia, so `useMediaQuery` reports
 * false there and every screen test exercises the desktop tree by default.
 * This is how a test opts into the other one. It does NOT prove the layout
 * looks right - only that the right tree renders and its controls work.
 */
export function stubMatchMedia(matches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const stub = vi.fn((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
  vi.stubGlobal('matchMedia', stub);
}
