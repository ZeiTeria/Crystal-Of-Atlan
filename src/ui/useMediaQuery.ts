import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether a media query currently matches, kept in sync as the window changes.
 *
 * The phone layouts are a different component tree, not a restyled table: nine
 * columns cannot be made to work at 390px by CSS alone, so the screens have to
 * know which one to render.
 *
 * `useSyncExternalStore` rather than state-plus-effect: matchMedia IS an
 * external store, and subscribing to it this way means there is no render where
 * the component has already painted the wrong tree and is about to correct
 * itself. It also removes the setState-inside-an-effect the lint rule objects
 * to, correctly - that pattern is exactly the cascading re-render it warns
 * about.
 *
 * Reports false when matchMedia is missing, which is the case under jsdom - so
 * every existing screen test exercises the desktop tree without needing to know
 * this hook exists. A test wanting the phone tree stubs matchMedia; see
 * `src/ui/testing/matchMedia.ts`.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  // The server snapshot is the desktop tree: it is the layout that works
  // without knowing the viewport, and this app is a static bundle anyway.
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/*
 * One breakpoint, defined once, so the screens cannot disagree about it.
 *
 * It MUST stay in step with the CSS media queries. It was 720px while every
 * media query was 768px, and the 48px between them was a dead zone: App.css
 * hid `.coa-tabs` at <=768 while this hook still reported "not phone", so the
 * mobile tab bar was never rendered and the app had no navigation at all
 * between 721px and 768px. Change this and you must change every
 * `@media (max-width: ...)` with it.
 */
export const PHONE = '(max-width: 768px)';
