// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { PHONE, useMediaQuery } from './useMediaQuery';
import { stubMatchMedia } from './testing/matchMedia';

afterEach(() => vi.unstubAllGlobals());

describe('useMediaQuery', () => {
  it('reports false when matchMedia is missing, so jsdom gets the desktop tree', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useMediaQuery(PHONE));
    expect(result.current).toBe(false);
  });

  it('reports what matchMedia says', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery(PHONE));
    expect(result.current).toBe(true);
  });

  it('has one phone breakpoint, so screens cannot disagree about it', () => {
    expect(PHONE).toBe('(max-width: 720px)');
  });
});
