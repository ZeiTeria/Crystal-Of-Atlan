// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme, readStoredTheme, storeTheme } from './theme';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('theme', () => {
  it('has no stored theme until one is chosen, so the OS decides', () => {
    expect(readStoredTheme()).toBe(null);
  });

  it('round-trips a stored choice', () => {
    storeTheme('light');
    expect(readStoredTheme()).toBe('light');
  });

  it('ignores a stored value that is not a theme', () => {
    localStorage.setItem('atlan.theme', 'chartreuse');
    expect(readStoredTheme()).toBe(null);
  });

  it('stamps the choice on the document element', () => {
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('removes the stamp when the choice is cleared, handing it back to the OS', () => {
    applyTheme('dark');
    applyTheme(null);
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('survives localStorage being unavailable', () => {
    // Safari in private mode throws on setItem rather than returning.
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(() => storeTheme('dark')).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});
