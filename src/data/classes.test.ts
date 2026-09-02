import { describe, expect, it } from 'vitest';
import { CHARACTER_CLASSES, findClass } from './classes';

describe('character classes', () => {
  it('carries every class the official site lists', () => {
    // 26 as of the Sugariff patch. If the game adds one, this fails on purpose:
    // the list is copied from coa.nvsgames.com, not derived, so nothing else
    // would notice it had gone stale.
    expect(CHARACTER_CLASSES).toHaveLength(26);
  });

  it('gives every class a name, a colour and a mark', () => {
    for (const c of CHARACTER_CLASSES) {
      expect(c.name).toMatch(/^[A-Z][A-Za-z ]+$/);
      expect(c.hue).toMatch(/^#[0-9A-F]{6}$/);
      expect(c.icon).toBeTruthy();
    }
  });

  it('has no duplicate names', () => {
    const names = CHARACTER_CLASSES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('finds a class whatever the casing', () => {
    expect(findClass('warlock')?.name).toBe('Warlock');
    expect(findClass('  BOUNTY HUNTER ')?.name).toBe('Bounty Hunter');
  });

  it('still finds a character saved under the old name for Puppeteer', () => {
    // Characters were created before the list came from the official site, so
    // dropping the alias would silently recolour them.
    expect(findClass('Puppet Master')?.name).toBe('Puppeteer');
  });

  it('does not invent a class for an unknown or missing name', () => {
    expect(findClass('Alchemist')).toBeUndefined();
    expect(findClass(null)).toBeUndefined();
    expect(findClass('')).toBeUndefined();
  });
});
