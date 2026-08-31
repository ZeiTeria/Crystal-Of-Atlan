import { describe, expect, it } from 'vitest';
import { engineVersion } from './version';

describe('engine', () => {
  it('is wired up', () => {
    expect(engineVersion()).toBe('1');
  });
});
