import { describe, expect, it } from 'vitest';
import { errorMessage } from './errorMessage';

describe('errorMessage', () => {
  it('uses .message for a real Error instance', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
  });

  it('uses .message for a plain object carrying one, like a Supabase error', () => {
    // Supabase errors are plain objects, not Error instances - this is the
    // shape production actually throws.
    expect(errorMessage({ message: 'duplicate key value violates unique constraint', code: '23505' })).toBe(
      'duplicate key value violates unique constraint',
    );
  });

  it('falls back to String() for anything else', () => {
    expect(errorMessage('plain string')).toBe('plain string');
    expect(errorMessage(42)).toBe('42');
    expect(errorMessage(null)).toBe('null');
    expect(errorMessage(undefined)).toBe('undefined');
  });

  it('falls back to String() for an object with a non-string message', () => {
    expect(errorMessage({ message: 404 })).toBe('[object Object]');
  });
});
