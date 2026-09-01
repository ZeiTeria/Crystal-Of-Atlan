export type Theme = 'dark' | 'light';

const KEY = 'atlan.theme';

function isTheme(value: unknown): value is Theme {
  return value === 'dark' || value === 'light';
}

/**
 * The stored choice, or null when the person has never chosen - in which case
 * the OS preference decides, because tokens.css keys light off
 * prefers-color-scheme when no data-theme is stamped.
 */
export function readStoredTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(KEY);
    return isTheme(raw) ? raw : null;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies). Falling back
    // to the OS preference is a better outcome than failing to render.
    return null;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // The choice will not survive a reload. Not worth breaking the click over.
  }
}

/** `null` removes the stamp, handing the decision back to the OS. */
export function applyTheme(theme: Theme | null): void {
  const root = document.documentElement;
  if (theme === null) root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}
