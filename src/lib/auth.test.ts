import { describe, it, expect, vi, afterEach } from 'vitest';
import { redirectTarget } from './auth';

describe('auth', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('redirectTarget resolves to root in dev', () => {
    vi.stubEnv('BASE_URL', '/');
    vi.stubGlobal('window', { location: { origin: 'https://host' } });
    expect(redirectTarget()).toBe('https://host/');
  });

  it('redirectTarget resolves to subpath in production', () => {
    vi.stubEnv('BASE_URL', '/Crystal-Of-Atlan/');
    vi.stubGlobal('window', { location: { origin: 'https://host' } });
    expect(redirectTarget()).toBe('https://host/Crystal-Of-Atlan/');
  });
});
